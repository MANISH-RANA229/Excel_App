/** Compact row of headline numbers: items = [[label, value], …]. */
export default function KpiStrip({ items }) {
  return (
    <dl className="kpis">
      {items.map(([label, value]) => (
        <div key={label} className="kpi">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
