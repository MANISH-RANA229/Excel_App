/**
 * Coloured legend that doubles as a filter: click a chip to show only that status, click again to clear.
 * items = [{ key, label, detail?, count, color }]
 */
export default function StatusChips({ items, active, onSelect, label = 'Filter results by status' }) {
  return (
    <div className="legend" role="group" aria-label={label}>
      {items.map(({ key, label: text, detail, count, color }) => {
        const pressed = active === key;
        return (
          <button
            key={key}
            type="button"
            className={`legend__item${pressed ? ' is-active' : ''}`}
            aria-pressed={pressed}
            title={`Show only ${text}${detail ? ` (${detail})` : ''}`}
            onClick={() => onSelect(pressed ? null : key)}
          >
            <span className="legend__swatch" style={{ background: color }} aria-hidden="true" />
            {text} {detail && <span className="muted">{detail}</span>}
            <strong>{count.toLocaleString()}</strong>
          </button>
        );
      })}
    </div>
  );
}
