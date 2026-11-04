import { tokenize } from '../../core/text/tokenize.js';

const SPLIT = /([^\p{L}\p{N}]+)/u;

/** Original cell text with matched words (green) and typo-matched words (amber) highlighted. */
export function HighlightedText({ text, matched, fuzzy, sets }) {
  if (!text) return <span className="muted">—</span>;
  const m = matched ?? sets?.matched;
  const f = fuzzy ?? sets?.fuzzy;
  return String(text).split(SPLIT).map((part, i) => {
    const t = tokenize(part)[0];
    const cls = t && m?.has(t) ? 'hl-match' : t && f?.has(t) ? 'hl-fuzzy' : null;
    return cls ? <mark key={i} className={cls}>{part}</mark> : part;
  });
}

/** Word sets to highlight in one side's text, from explainPair's result. */
export const highlightSets = (words, side) => {
  if (!words) return { matched: new Set(), fuzzy: new Set() };
  return {
    matched: new Set(words.matched || []),
    fuzzy: new Set((words.fuzzy || []).map((f) => f[side === 'a' ? 0 : 1])),
  };
};

function Words({ title, words = [], kind }) {
  const list = words || [];
  return (
    <div className="wd__words">
      <span className="wd__key">{title}</span>
      {list.length ? list.map((w) => <span key={w} className={`chip chip--${kind}`}>{w}</span>) : <span className="muted">—</span>}
    </div>
  );
}

/**
 * Expanded-row detail for any tool that matches text: both texts with highlights, the word-by-word breakdown
 * (explainPair result) and optional extra label/value pairs.
 */
export default function WordBreakdown({ aText, bText, hasB, words, extra = [], labelA = 'Excel 1', labelB = 'Excel 2' }) {
  const w = words || { matched: [], fuzzy: [], onlyA: [], onlyB: [] };
  return (
    <div className="wd">
      <div className="wd__texts">
        <div><span className="wd__key">{labelA}</span><HighlightedText text={aText} {...highlightSets(w, 'a')} /></div>
        <div>
          <span className="wd__key">{labelB}</span>
          {hasB ? <HighlightedText text={bText} {...highlightSets(w, 'b')} /> : <span className="muted">No matching row</span>}
        </div>
      </div>
      <div className="wd__grid">
        <Words title="Matched" words={w.matched} kind="match" />
        <Words title="Typo" words={(w.fuzzy || []).map(([x, y]) => `${x} → ${y}`)} kind="fuzzy" />
        <Words title={`Only in ${labelA.replace('Excel ', '')}`} words={w.onlyA} kind="only" />
        <Words title={`Only in ${labelB.replace('Excel ', '')}`} words={w.onlyB} kind="only" />
      </div>
      {extra.length > 0 && (
        <dl className="wd__extra">
          {extra.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}
        </dl>
      )}
    </div>
  );
}
