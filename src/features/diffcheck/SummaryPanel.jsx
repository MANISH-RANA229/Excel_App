import { BANDS, bandRange } from '../../core/bands.js';
import KpiStrip from '../../shared/results/KpiStrip.jsx';
import StatusChips from '../../shared/results/StatusChips.jsx';

/** Headline numbers + band distribution; the band chips double as table filters. */
export default function SummaryPanel({ summary, ctx, unmatchedB = 0, activeBand, onBand }) {
  const rowCountA = (ctx?.a?.ds || ctx?.a?.dataset)?.rowCount ?? 0;
  const rowCountB = (ctx?.b?.ds || ctx?.b?.dataset)?.rowCount ?? 0;
  const counts = summary?.counts || { strong: 0, good: 0, partial: 0, weak: 0, none: 0 };

  return (
    <div className="card summary">
      <KpiStrip
        items={[
          ['Excel 1 rows', rowCountA.toLocaleString()],
          ['Excel 2 rows', rowCountB.toLocaleString()],
          ['Avg best match', `${summary?.avg ?? 0}%`],
          ['Strong (≥ 90%)', (counts.strong ?? 0).toLocaleString()],
          ['Excel 2 never matched', (unmatchedB ?? 0).toLocaleString()],
        ]}
      />
      <div className="dist">
        <div className="bandbar" role="img" aria-label="Distribution of best matches by band">
          {BANDS.map((b) => (counts[b.key] ?? 0) > 0 && (
            <span key={b.key} style={{ flexGrow: counts[b.key], background: b.bar }} title={`${b.label}: ${counts[b.key]}`} />
          ))}
        </div>
        <StatusChips
          label="Filter results by band"
          active={activeBand}
          onSelect={onBand}
          items={BANDS.map((b, i) => ({ key: b.key, label: b.label, detail: bandRange(b, i), count: counts[b.key] ?? 0, color: b.bar }))}
        />
      </div>
    </div>
  );
}
