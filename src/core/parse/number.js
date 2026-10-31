// Turns what people type into amounts: "₹ 1,23,456.50", "(1,234.50)", "1234-", "−5", "Rs. 500", "1.234,56" (decimal comma).
// Returns NaN when the text is not clearly a number. It never guesses: "12-34", "1,2,3", "5 Dr" are NaN.

const CURRENCY = /^(?:inr|usd|eur|gbp|rs\.?|[₹$€£¥])\s*|\s*(?:inr|usd|eur|gbp|rs\.?|[₹$€£¥])$/i;

// Dot-decimal text: plain, scientific, or with well-formed grouping — western 1,234,567, Indian 12,34,567 or spaced 1 234 567.
// "1,2,3" and "12,34" match none of these.
const PLAIN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const SCIENTIFIC = /^\d+(?:\.\d+)?e[+-]?\d+$/i;
const GROUPED = /^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?$/;
const SPACED = /^\d{1,3}(?: \d{3})+(?:\.\d+)?$/;
// Comma-decimal text: 1.234,56 · 1 234,56 · 12,5 · 1234
const COMMA_DECIMAL = /^(?:\d{1,3}(?:[. ]\d{3})+|\d+)(?:,\d+)?$/;

/**
 * @param {unknown} input
 * @param {{ decimal?: '.' | ',' }} [opts]  which character is the decimal mark (default '.')
 */
export function parseAmount(input, { decimal = '.' } = {}) {
  if (typeof input === 'number') return input;
  let s = String(input ?? '').replace(/[   ]/g, ' ').trim();
  if (!s) return NaN;

  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1).trim(); } // accounting brackets
  s = s.replace(CURRENCY, '').replace(CURRENCY, '').trim();
  if (/^[-−–]/.test(s)) { negative = !negative; s = s.slice(1).trim(); }
  else if (/[-−–]$/.test(s)) { negative = !negative; s = s.slice(0, -1).trim(); } // trailing minus: 1234-
  s = s.replace(/^\+/, '').replace(CURRENCY, '').trim();
  if (!s) return NaN;

  let value = NaN;
  if (decimal === ',') {
    if (COMMA_DECIMAL.test(s)) value = Number(s.replace(/[. ]/g, '').replace(',', '.'));
  } else if (PLAIN.test(s) || SCIENTIFIC.test(s)) value = Number(s);
  else if (GROUPED.test(s)) value = Number(s.replace(/,/g, ''));
  else if (SPACED.test(s)) value = Number(s.replace(/ /g, ''));
  return Number.isFinite(value) ? (negative ? -value : value) : NaN;
}

/** Text that looks like a number but is not stored as one (and is not a code with leading zeros like 00123). */
export const looksLikeStoredNumber = (text, opts) => {
  const t = String(text ?? '').trim();
  return t !== '' && !/^0\d+$/.test(t) && !Number.isNaN(parseAmount(t, opts));
};

/**
 * Numeric value of one cell of a column `{ text, nums }`: the stored number when the cell holds one, otherwise its text read
 * as an amount ("₹1,200", "(500)"). NaN when the cell is blank or not clearly a number.
 */
export function cellNumber(col, r, opts) {
  const n = col.nums?.[r];
  return n !== undefined && !Number.isNaN(n) ? n : parseAmount(col.text[r], opts);
}
