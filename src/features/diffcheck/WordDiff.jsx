import { tokenize } from './engine/diffEngine.js';

const SPLIT = /([^\p{L}\p{N}]+)/u;

/** Original cell text with matched words (green) and typo-matched words (amber) highlighted. */
export function HighlightedText({ text, matched, fuzzy }) {
  if (!text) return <span className="muted">—</span>;
  return String(text).split(SPLIT).map((part, i) => {
    const t = tokenize(part)[0];
    const cls = t && matched.has(t) ? 'hl-match' : t && fuzzy.has(t) ? 'hl-fuzzy' : null;
    return cls ? <mark key={i} className={cls}>{part}</mark> : part;
  });
}

export const highlightSets = (row, side) => ({
  matched: new Set(row.matched),
  fuzzy: new Set(row.fuzzy.map((f) => f[side === 'a' ? 0 : 1])),
});

function Words({ title, words, kind }) {
  return (
    <div className="wd__words">
      <span className="wd__key">{title}</span>
      {words.length ? words.map((w) => <span key={w} className={`chip chip--${kind}`}>{w}</span>) : <span className="muted">—</span>}
    </div>
  );
}

/** Row expansion: full texts, word-by-word breakdown and carry-along columns. */
export default function WordDiff({ row, ctx }) {
  const extra = [
    ...ctx.a.carry.map((c) => [`Excel 1 · ${c}`, ctx.a.rows[row.a][c]]),
    ...(row.b >= 0 ? ctx.b.carry.map((c) => [`Excel 2 · ${c}`, ctx.b.rows[row.b][c]]) : []),
  ];
  return (
    <div className="wd">
      <div className="wd__texts">
        <div><span className="wd__key">Excel 1</span><HighlightedText text={row.aText} {...highlightSets(row, 'a')} /></div>
        <div><span className="wd__key">Excel 2</span>{row.b >= 0 ? <HighlightedText text={row.bText} {...highlightSets(row, 'b')} /> : <span className="muted">No matching row</span>}</div>
      </div>
      <div className="wd__grid">
        <Words title="Matched" words={row.matched} kind="match" />
        <Words title="Typo" words={row.fuzzy.map(([x, y]) => `${x} → ${y}`)} kind="fuzzy" />
        <Words title="Only in 1" words={row.onlyA} kind="only" />
        <Words title="Only in 2" words={row.onlyB} kind="only" />
      </div>
      {extra.length > 0 && (
        <dl className="wd__extra">
          {extra.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}
        </dl>
      )}
    </div>
  );
}
