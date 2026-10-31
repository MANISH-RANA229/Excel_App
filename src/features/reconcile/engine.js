import { parseAmount } from '../../core/parse/number.js';
import { parseDate } from '../../core/parse/date.js';
import { normalizeKey } from '../../core/text/normalize.js';
import { createSimilarityIndex } from '../../core/text/similarity.js';
import { DIFFERENCE, FUZZY, MATCHED, ONLY_A, ONLY_B, PROBABLE } from './status.js';

const EPS = 1e-9;
const MAX_SCAN = 500; // ponytail: amount+date pass looks at most this many equal-amount candidates per row; raise it if recon rows share thousands of identical amounts
// A reference is compared by its letters and digits only, so "INV-001", "inv 001" and "INV/001" are the same.
const referenceKey = (t) => normalizeKey(t, { ignoreCase: true, collapseSpaces: true, ignorePunctuation: true }).replace(/\s+/g, '');

// ---------------------------------------------------------------- input
const cell = (col, r, decimal) => {
  const num = col.nums?.[r];
  return num !== undefined && !Number.isNaN(num) ? num : parseAmount(col.text[r], { decimal });
};

/**
 * Turns one file's raw columns into what the matcher needs.
 * @param side  { n, key: string[]|null, date: {text, nums}|null,
 *                amount: { single: {text, nums} } | { debit: {text, nums}, credit: {text, nums} } }
 * @param {{ absolute?: boolean, decimal?: '.'|',', dayFirst?: boolean }} o
 * @returns {{ n, key: string[], raw: string[], amount: Float64Array, date: Float64Array, hasDate: boolean }}
 *   key = reference reduced to letters+digits ('' = no reference), raw = the original text; amount NaN = no amount
 *   (such rows can never match); credit − debit for two-column amounts.
 */
export function prepareSide(side, { absolute = false, decimal = '.', dayFirst = true } = {}) {
  const { n } = side;
  const amount = new Float64Array(n);
  for (let r = 0; r < n; r++) {
    let v;
    if (side.amount.single) {
      v = cell(side.amount.single, r, decimal);
    } else {
      const debit = cell(side.amount.debit, r, decimal);
      const credit = cell(side.amount.credit, r, decimal);
      v = Number.isNaN(debit) && Number.isNaN(credit) ? NaN : (Number.isNaN(credit) ? 0 : credit) - (Number.isNaN(debit) ? 0 : debit);
    }
    amount[r] = absolute ? Math.abs(v) : v;
  }
  const date = new Float64Array(n).fill(NaN);
  let hasDate = false;
  if (side.date) {
    for (let r = 0; r < n; r++) {
      const num = side.date.nums?.[r];
      const v = num !== undefined && !Number.isNaN(num) ? num : (parseDate(side.date.text[r], { dayFirst })?.serial ?? NaN);
      if (!Number.isNaN(v)) { date[r] = v; hasDate = true; }
    }
  }
  const raw = side.key ? Array.from(side.key, (t) => t ?? '') : new Array(n).fill('');
  return { n, key: raw.map(referenceKey), raw, amount, date, hasDate };
}

// ---------------------------------------------------------------- result
// Items are the rows of the reconciliation report: a matched pair, a difference, or a row left over on one side.
// In "sum by reference" mode one item is a whole reference (many lines per side). Rows are stored CSR-style.
class Items {
  status = [];
  pass = [];
  startA = [0];
  startB = [0];
  rowsA = [];
  rowsB = [];

  add(status, pass, rowsA, rowsB) {
    this.status.push(status);
    this.pass.push(pass);
    for (const r of rowsA) this.rowsA.push(r); // not push(...rows): a reference can have 100k lines
    for (const r of rowsB) this.rowsB.push(r);
    this.startA.push(this.rowsA.length);
    this.startB.push(this.rowsB.length);
  }

  finish(a, b) {
    const n = this.status.length;
    const startA = Int32Array.from(this.startA);
    const startB = Int32Array.from(this.startB);
    const rowsA = Int32Array.from(this.rowsA);
    const rowsB = Int32Array.from(this.rowsB);
    const sums = (start, rows, amount) => {
      const sum = new Float64Array(n).fill(NaN);
      for (let i = 0; i < n; i++) {
        if (start[i] === start[i + 1]) continue;
        let s = 0;
        for (let k = start[i]; k < start[i + 1]; k++) if (!Number.isNaN(amount[rows[k]])) s += amount[rows[k]];
        sum[i] = s;
      }
      return sum;
    };
    const sumA = sums(startA, rowsA, a.amount);
    const sumB = sums(startB, rowsB, b.amount);
    const diff = new Float64Array(n).map((_, i) => sumA[i] - sumB[i]); // NaN when one side is missing
    const totalOf = (amount) => amount.reduce((s, v) => (Number.isNaN(v) ? s : s + v), 0);
    const noAmount = (amount) => amount.reduce((c, v) => c + (Number.isNaN(v) ? 1 : 0), 0);
    return {
      n,
      status: Uint8Array.from(this.status), pass: Uint8Array.from(this.pass),
      startA, rowsA, startB, rowsB,
      repA: Int32Array.from({ length: n }, (_, i) => (startA[i] < startA[i + 1] ? rowsA[startA[i]] : -1)),
      repB: Int32Array.from({ length: n }, (_, i) => (startB[i] < startB[i + 1] ? rowsB[startB[i]] : -1)),
      countA: Uint32Array.from({ length: n }, (_, i) => startA[i + 1] - startA[i]),
      countB: Uint32Array.from({ length: n }, (_, i) => startB[i + 1] - startB[i]),
      sumA, sumB, diff,
      totals: { sumA: totalOf(a.amount), sumB: totalOf(b.amount), rowsA: a.n, rowsB: b.n, noAmountA: noAmount(a.amount), noAmountB: noAmount(b.amount) },
    };
  }
}

// ---------------------------------------------------------------- line by line: ordered passes
const within = (x, y, tol) => Math.abs(x - y) <= tol + EPS;
const openRows = (side, matched, needKey) => Array.from({ length: side.n }, (_, i) => i)
  .filter((i) => matched[i] < 0 && !Number.isNaN(side.amount[i]) && (!needKey || side.key[i] !== ''));

function groupByKey(side, rows) {
  const map = new Map();
  for (const j of rows) { const l = map.get(side.key[j]); if (l) l.push(j); else map.set(side.key[j], [j]); }
  return map;
}

/** Ordered passes: each works on rows the earlier ones left open, so a row matches at most once. */
const PASSES = [
  {
    id: 1, stage: 'Same reference & amount',
    run({ a, b, tol, matchA, matchB, link }) {
      const byKey = groupByKey(b, openRows(b, matchB, true));
      for (const i of openRows(a, matchA, true)) {
        let best = -1;
        let bestDiff = Infinity;
        for (const j of byKey.get(a.key[i]) ?? []) {
          const d = Math.abs(a.amount[i] - b.amount[j]);
          if (matchB[j] < 0 && d <= tol + EPS && d < bestDiff) { best = j; bestDiff = d; }
        }
        if (best >= 0) link(i, best, MATCHED, 1);
      }
    },
  },
  {
    id: 2, stage: 'Same reference, different amount',
    run({ a, b, matchA, matchB, link }) {
      const byKey = groupByKey(b, openRows(b, matchB, true));
      for (const i of openRows(a, matchA, true)) {
        let best = -1;
        let bestDiff = Infinity;
        for (const j of byKey.get(a.key[i]) ?? []) {
          const d = Math.abs(a.amount[i] - b.amount[j]);
          if (matchB[j] < 0 && d < bestDiff) { best = j; bestDiff = d; }
        }
        if (best >= 0) link(i, best, DIFFERENCE, 2);
      }
    },
  },
  {
    id: 3, stage: 'Similar reference & amount',
    enabled: (o) => o.fuzzyKey,
    run({ a, b, tol, options, matchA, matchB, link }) {
      const openA = openRows(a, matchA, true);
      const openB = openRows(b, matchB, true);
      if (!openA.length || !openB.length) return;
      // similarity needs the words, so it reads the original text (the exact passes use the stripped key)
      const index = createSimilarityIndex(openA.map((i) => a.raw[i]), openB.map((j) => b.raw[j]));
      const out = index.makeOut(8);
      const min = (options.fuzzyThreshold - 0.5) / 100;
      openA.forEach((i, x) => {
        const found = index.query(x, { topK: 8, min }, out);
        for (let k = 0; k < found; k++) {
          const j = openB[out.j[k]];
          if (matchB[j] < 0 && Math.round(out.s[k] * 100) >= options.fuzzyThreshold && within(a.amount[i], b.amount[j], tol)) { link(i, j, FUZZY, 3); break; }
        }
      });
    },
  },
  {
    id: 4, stage: 'Amount & date',
    enabled: (o) => o.amountOnly,
    run({ a, b, tol, options, matchA, matchB, link }) {
      const useDates = options.useDates && a.hasDate && b.hasDate;
      const sorted = openRows(b, matchB, false).sort((x, y) => b.amount[x] - b.amount[y] || x - y);
      const amounts = Float64Array.from(sorted, (j) => b.amount[j]);
      for (const i of openRows(a, matchA, false)) {
        let lo = 0;
        let hi = amounts.length;
        while (lo < hi) { const m = (lo + hi) >>> 1; if (amounts[m] < a.amount[i] - tol - EPS) lo = m + 1; else hi = m; }
        let best = -1;
        let bestScore = Infinity;
        for (let p = lo, scanned = 0; p < amounts.length && amounts[p] <= a.amount[i] + tol + EPS && scanned < MAX_SCAN; p++) {
          const j = sorted[p];
          if (matchB[j] >= 0) continue;
          scanned++;
          let score = Math.abs(a.amount[i] - b.amount[j]);
          if (useDates) {
            const days = Math.abs(a.date[i] - b.date[j]);
            if (!(days <= options.windowDays)) continue; // also rejects missing dates (NaN)
            score += days * 1e6;
          }
          if (score < bestScore) { best = j; bestScore = score; }
        }
        if (best >= 0) link(i, best, PROBABLE, 4);
      }
    },
  },
];

function reconcileLines(a, b, options, onProgress) {
  const matchA = new Int32Array(a.n).fill(-1);
  const matchB = new Int32Array(b.n).fill(-1);
  const statusOf = new Uint8Array(a.n);
  const passOf = new Uint8Array(a.n);
  const link = (i, j, status, pass) => { matchA[i] = j; matchB[j] = i; statusOf[i] = status; passOf[i] = pass; };
  const ctx = { a, b, options, tol: options.tolerance, matchA, matchB, link };
  const passes = PASSES.filter((p) => !p.enabled || p.enabled(options));
  passes.forEach((p, k) => {
    onProgress?.({ step: k + 1, steps: passes.length, stage: p.stage, fraction: k / passes.length });
    p.run(ctx);
  });

  const items = new Items();
  for (let i = 0; i < a.n; i++) if (matchA[i] >= 0) items.add(statusOf[i], passOf[i], [i], [matchA[i]]);
  for (let i = 0; i < a.n; i++) if (matchA[i] < 0) items.add(ONLY_A, 0, [i], []);
  for (let j = 0; j < b.n; j++) if (matchB[j] < 0) items.add(ONLY_B, 0, [], [j]);
  onProgress?.({ step: passes.length, steps: passes.length, stage: passes.at(-1).stage, fraction: 1 });
  return items.finish(a, b);
}

// ---------------------------------------------------------------- sum by reference
function reconcileSums(a, b, options, onProgress) {
  const collect = (side) => {
    const groups = new Map();
    const loose = [];
    for (let r = 0; r < side.n; r++) {
      if (side.key[r] === '') { loose.push(r); continue; }
      const g = groups.get(side.key[r]);
      if (g) g.push(r); else groups.set(side.key[r], [r]);
    }
    return { groups, loose };
  };
  const sumOf = (side, rows) => rows.reduce((s, r) => (Number.isNaN(side.amount[r]) ? s : s + side.amount[r]), 0);
  const A = collect(a);
  const B = collect(b);
  const items = new Items();
  onProgress?.({ step: 1, steps: 1, stage: 'Total per reference', fraction: 0 });
  for (const [key, rowsA] of A.groups) {
    const rowsB = B.groups.get(key);
    if (!rowsB) items.add(ONLY_A, 5, rowsA, []);
    else items.add(within(sumOf(a, rowsA), sumOf(b, rowsB), options.tolerance) ? MATCHED : DIFFERENCE, 5, rowsA, rowsB);
  }
  for (const [key, rowsB] of B.groups) if (!A.groups.has(key)) items.add(ONLY_B, 5, [], rowsB);
  for (const r of A.loose) items.add(ONLY_A, 0, [r], []);
  for (const r of B.loose) items.add(ONLY_B, 0, [], [r]);
  onProgress?.({ step: 1, steps: 1, stage: 'Total per reference', fraction: 1 });
  return items.finish(a, b);
}

/**
 * @param a, b  prepareSide() results
 * @param {{ mode: 'line'|'sum', tolerance: number, fuzzyKey?: boolean, fuzzyThreshold?: number,
 *           amountOnly?: boolean, useDates?: boolean, windowDays?: number }} options
 * @param onProgress ({ step, steps, stage, fraction }) => void
 */
export function reconcile(a, b, options, onProgress) {
  const o = { tolerance: 0, fuzzyKey: false, fuzzyThreshold: 85, amountOnly: true, useDates: false, windowDays: 3, ...options };
  return o.mode === 'sum' ? reconcileSums(a, b, o, onProgress) : reconcileLines(a, b, o, onProgress);
}

/** Names of the progress steps for these options, in order (the worker reports them; the loader shows the trail). */
export const stagesFor = (options) => ['Reading amounts and dates', ...(options.mode === 'sum'
  ? ['Total per reference']
  : PASSES.filter((p) => !p.enabled || p.enabled({ fuzzyKey: false, amountOnly: true, ...options })).map((p) => p.stage))];
