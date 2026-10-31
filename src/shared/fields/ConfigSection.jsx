/**
 * One titled block of a tool's settings card: a heading (+ one-line explanation, + optional buttons on the right), then its fields in a
 * two-column grid (`cols={1}` for a single full-width column). Give a field `className="span-2"` to make it span both columns.
 */
export default function ConfigSection({ title, hint, actions, cols = 2, children }) {
  return (
    <section className="cfg-sec">
      {(title || actions) && (
        <header className="cfg-sec__head">
          <div>
            {title && <h3>{title}</h3>}
            {hint && <p>{hint}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={`cfg-sec__body${cols === 1 ? ' cfg-sec__body--1' : ''}`}>{children}</div>
    </section>
  );
}
