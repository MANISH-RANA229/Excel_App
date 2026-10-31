// Single source of truth for match-% colour bands (used by the UI and the Excel export).
// Colours follow Excel's built-in Good / Neutral / Bad cell styles.
export const BANDS = [
  { key: 'strong',  label: 'Strong',   min: 90, fg: '#006100', bg: '#C6EFCE', bar: '#00B050' },
  { key: 'good',    label: 'Good',     min: 70, fg: '#375623', bg: '#E2EFDA', bar: '#92D050' },
  { key: 'partial', label: 'Partial',  min: 50, fg: '#7F6000', bg: '#FFEB9C', bar: '#FFC000' },
  { key: 'weak',    label: 'Weak',     min: 1,  fg: '#843C0C', bg: '#FCE4D6', bar: '#ED7D31' },
  { key: 'none',    label: 'No match', min: 0,  fg: '#9C0006', bg: '#FFC7CE', bar: '#C00000' },
];

export const getBand = (pct) => BANDS.find((b) => pct >= b.min);

export const bandRange = (b, i) => (i === 0 ? `≥ ${b.min}%` : b.min === 0 ? '0%' : `${b.min}–${BANDS[i - 1].min - 1}%`);

// Summary is based on each Excel1 row's best match (rank 1).
export function summarize(rows) {
  const best = rows.filter((r) => r.rank === 1);
  const counts = Object.fromEntries(BANDS.map((b) => [b.key, 0]));
  let sum = 0;
  for (const r of best) { counts[getBand(r.pct).key]++; sum += r.pct; }
  return { total: best.length, avg: best.length ? Math.round(sum / best.length) : 0, counts };
}
