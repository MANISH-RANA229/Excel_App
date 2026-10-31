import { BANDS, bandRange } from '../../core/bands.js';
import KpiStrip from '../../shared/results/KpiStrip.jsx';
import StatusChips from '../../shared/results/StatusChips.jsx';

/** Headline numbers + band distribution; the band chips double as table filters. */
export default function SummaryPanel({ summary, ctx, unmatchedB, activeBand, onBand }) {
  return (
    <div className="card summary">
      <KpiStrip
        items={[
          ['Excel 1 rows', ctx.a.ds.rowCount.toLocaleString()],
          ['Excel 2 rows', ctx.b.ds.rowCount.toLocaleString()],
          ['Avg best match', `${summary.avg}%`],
          ['Strong (≥ 90%)', summary.counts.strong.toLocaleString()],
          ['Excel 2 never matched', unmatchedB.toLocaleString()],
        ]}
      />
      <div className="dist">
        <div className="bandbar" role="img" aria-label="Distribution of best matches by band">
          {BANDS.map((b) => summary.counts[b.key] > 0 && (
            <span key={b.key} style={{ flexGrow: summary.counts[b.key], background: b.bar }} title={`${b.label}: ${summary.counts[b.key]}`} />
          ))}
        </div>
        <StatusChips
          label="Filter results by band"
          active={activeBand}
          onSelect={onBand}
          items={BANDS.map((b, i) => ({ key: b.key, label: b.label, detail: bandRange(b, i), count: summary.counts[b.key], color: b.bar }))}
        />
      </div>
    </div>
  );
}
