import { tokenize } from '../../core/text/tokenize.js';

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

/** Word sets to highlight in one side's text, from explainPair's result. */
export const highlightSets = (words, side) => ({
  matched: new Set(words.matched),
  fuzzy: new Set(words.fuzzy.map((f) => f[side === 'a' ? 0 : 1])),
});

function Words({ title, words, kind }) {
  return (
    <div className="wd__words">
      <span className="wd__key">{title}</span>
      {words.length ? words.map((w) => <span key={w} className={`chip chip--${kind}`}>{w}</span>) : <span className="muted">—</span>}
    </div>
  );
}

/**
 * Expanded-row detail for any tool that matches text: both texts with highlights, the word-by-word breakdown
 * (explainPair result) and optional extra label/value pairs.
 */
export default function WordBreakdown({ aText, bText, hasB, words, extra = [], labelA = 'Excel 1', labelB = 'Excel 2' }) {
  return (
    <div className="wd">
      <div className="wd__texts">
        <div><span className="wd__key">{labelA}</span><HighlightedText text={aText} {...highlightSets(words, 'a')} /></div>
        <div>
          <span className="wd__key">{labelB}</span>
          {hasB ? <HighlightedText text={bText} {...highlightSets(words, 'b')} /> : <span className="muted">No matching row</span>}
        </div>
      </div>
      <div className="wd__grid">
        <Words title="Matched" words={words.matched} kind="match" />
        <Words title="Typo" words={words.fuzzy.map(([x, y]) => `${x} → ${y}`)} kind="fuzzy" />
        <Words title={`Only in ${labelA.replace('Excel ', '')}`} words={words.onlyA} kind="only" />
        <Words title={`Only in ${labelB.replace('Excel ', '')}`} words={words.onlyB} kind="only" />
      </div>
      {extra.length > 0 && (
        <dl className="wd__extra">
          {extra.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}
        </dl>
      )}
    </div>
  );
}
