// Single source of truth for match-% colour bands (UI and Excel export, shared by every matching tool).
// Colours follow Excel's built-in Good / Neutral / Bad cell styles.
export const BANDS = [
  { key: 'strong',  label: 'Strong',   min: 90, fg: '#006100', bg: '#C6EFCE', bar: '#00B050' },
  { key: 'good',    label: 'Good',     min: 70, fg: '#375623', bg: '#E2EFDA', bar: '#92D050' },
  { key: 'partial', label: 'Partial',  min: 50, fg: '#7F6000', bg: '#FFEB9C', bar: '#FFC000' },
  { key: 'weak',    label: 'Weak',     min: 1,  fg: '#843C0C', bg: '#FCE4D6', bar: '#ED7D31' },
  { key: 'none',    label: 'No match', min: 0,  fg: '#9C0006', bg: '#FFC7CE', bar: '#C00000' },
];

export const bandIndex = (pct) => BANDS.findIndex((b) => pct >= b.min);
export const getBand = (pct) => BANDS[bandIndex(pct)];

export const bandRange = (b, i) => (i === 0 ? `≥ ${b.min}%` : b.min === 0 ? '0%' : `${b.min}–${BANDS[i - 1].min - 1}%`);

/** Best match per Excel 1 row (rank 1) counted by band. `result` = { n, pct: ArrayLike, rank: ArrayLike }. */
export function summarize({ n, pct, rank }) {
  const counts = Object.fromEntries(BANDS.map((b) => [b.key, 0]));
  let total = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    if (rank[i] !== 1) continue;
    counts[BANDS[bandIndex(pct[i])].key]++;
    sum += pct[i];
    total++;
  }
  return { total, avg: total ? Math.round(sum / total) : 0, counts };
}
