import { BANDS, bandRange } from './bands.js';

/** Compact KPI strip + band distribution; legend items double as table filters. */
export default function SummaryPanel({ summary, ctx, unmatchedB, activeBand, onBand }) {
  const kpis = [
    ['Excel 1 rows', ctx.a.rows.length.toLocaleString()],
    ['Excel 2 rows', ctx.b.rows.length.toLocaleString()],
    ['Avg best match', `${summary.avg}%`],
    ['Strong (≥ 90%)', summary.counts.strong.toLocaleString()],
    ['Excel 2 never matched', unmatchedB.toLocaleString()],
  ];
  return (
    <div className="card summary">
      <dl className="kpis">
        {kpis.map(([k, v]) => <div key={k} className="kpi"><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <div className="dist">
        <div className="bandbar" role="img" aria-label="Distribution of best matches by band">
          {BANDS.map((b) => summary.counts[b.key] > 0 && (
            <span key={b.key} style={{ flexGrow: summary.counts[b.key], background: b.bar }} title={`${b.label}: ${summary.counts[b.key]}`} />
          ))}
        </div>
        <div className="legend" role="group" aria-label="Filter results by band">
          {BANDS.map((b, i) => {
            const n = summary.counts[b.key];
            const pressed = activeBand === b.key;
            return (
              <button key={b.key} type="button" className={`legend__item${pressed ? ' is-active' : ''}`} aria-pressed={pressed}
                onClick={() => onBand(pressed ? null : b.key)} title={`Show only ${b.label} (${bandRange(b, i)})`}>
                <span className="legend__swatch" style={{ background: b.bar }} aria-hidden="true" />
                {b.label} <span className="muted">{bandRange(b, i)}</span>
                <strong>{n.toLocaleString()}</strong>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
