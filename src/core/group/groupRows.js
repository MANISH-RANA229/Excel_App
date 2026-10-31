/**
 * Groups rows by the value of one column, in one pass.
 *
 * Values are compared after trimming and collapsing whitespace; `ignoreCase` also merges "North" / "north".
 * A group's label is the first spelling seen; blank cells form one group named `blankLabel`.
 *
 * @param {string[]} values  one cell per row
 * @returns {{ labels: string[], counts: Int32Array, offsets: Int32Array, order: Int32Array, blankGroup: number }}
 *   groups are in order of first appearance; the rows of group g are order[offsets[g] … offsets[g + 1]),
 *   in their original order.
 */
export function groupRows(values, { ignoreCase = true, blankLabel = '(Blank)' } = {}, onProgress) {
  const n = values.length;
  const index = new Map();
  const labels = [];
  const tally = [];
  const groupOf = new Int32Array(n);
  const step = Math.max(1, Math.floor(n / 100));

  for (let i = 0; i < n; i++) {
    const clean = String(values[i] ?? '').replace(/\s+/g, ' ').trim();
    const key = ignoreCase ? clean.toLowerCase() : clean;
    let g = index.get(key);
    if (g === undefined) {
      g = labels.length;
      index.set(key, g);
      labels.push(clean === '' ? blankLabel : clean);
      tally.push(0);
    }
    groupOf[i] = g;
    tally[g]++;
    if (onProgress && i % step === 0) onProgress(i / n);
  }

  // counting sort: rows grouped by group, original order kept inside each group
  const counts = Int32Array.from(tally);
  const offsets = new Int32Array(labels.length + 1);
  for (let g = 0; g < labels.length; g++) offsets[g + 1] = offsets[g] + counts[g];
  const fill = offsets.slice(0, labels.length);
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[fill[groupOf[i]]++] = i;

  onProgress?.(1);
  return { labels, counts, offsets, order, blankGroup: index.has('') ? index.get('') : -1 };
}
