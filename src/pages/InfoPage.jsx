import { useEffect, useState } from 'react';
import { Button } from '../components/ui/index.js';
import { Check, ChevronDown, Download, FolderOpen, Info, Laptop, Search, ShieldCheck, SlidersHorizontal, Upload } from 'lucide-react';
import PageHeader from '../layout/PageHeader.jsx';
import BandTag from '../shared/results/BandTag.jsx';
import WordBreakdown from '../shared/results/WordBreakdown.jsx';
import { BANDS, bandRange } from '../core/bands.js';
import { CATEGORIES, tools } from '../features/index.js';
import { FAQ, GUIDE, PRIVACY, READING, RESULT_FILE, SCORE_NOTES, SCORE_STEPS, SECTIONS, STEPS } from './info/content.js';
import { EXAMPLE, runExample } from './info/example.js';

const STEP_ICONS = [Upload, SlidersHorizontal, Download];
const IDS = SECTIONS.map((s) => `info-${s.id}`); // prefixed: tools stay mounted (hidden) and must not share element ids
const example = runExample();

// The URL hash is the route here ("#/info"), so contents links scroll instead of using "#section" anchors.
function scrollToSection(id) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/** The section currently near the top of the page (the page scrolls inside .shell__main; an observer on the viewport still sees it). */
function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const seen = new Set();
    const last = ids.at(-1);
    // The last section is short and never reaches the top of the page: once all of it is on screen, it is the current one.
    let atEnd = false;
    const resolve = () => { const id = atEnd ? last : ids.find((i) => seen.has(i)); if (id) setActive(id); }; // same answer whichever observer fires last
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id));
      resolve();
    }, { rootMargin: '0px 0px -65% 0px' });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    const end = new IntersectionObserver(([e]) => { atEnd = e.isIntersecting; resolve(); }, { threshold: 1 });
    end.observe(document.getElementById(last));
    return () => { io.disconnect(); end.disconnect(); };
  }, [ids]);
  return [active, setActive];
}

function Section({ id, title, lead, children }) {
  return (
    <section id={`info-${id}`} className="info-sec" aria-labelledby={`info-${id}-title`}>
      <div className="info-sec__head">
        <h2 id={`info-${id}-title`}>{title}</h2>
        {lead && <p>{lead}</p>}
      </div>
      {children}
    </section>
  );
}

const Checks = ({ items }) => (
  <ul className="info-checks">
    {items.map((t) => <li key={t}><Check size={16} aria-hidden="true" /><span>{t}</span></li>)}
  </ul>
);

const Facts = ({ items }) => (
  <div className="info-facts">
    {items.map(({ title, text }) => (
      <div key={title} className="card info-fact"><strong>{title}</strong><p>{text}</p></div>
    ))}
  </div>
);

function ToolGuide({ tool }) {
  const g = GUIDE[tool.id];
  const Icon = tool.icon;
  return (
    <details className="card info-tool">
      <summary>
        <span className="tool-card__icon" aria-hidden="true"><Icon size={18} /></span>
        <span className="info-tool__title">
          <strong>{tool.title}</strong>
          <span>{g.does}</span>
        </span>
        <ChevronDown size={18} className="info-tool__chev" aria-hidden="true" />
      </summary>
      <div className="info-tool__body">
        <div>
          <h4>How it works</h4>
          <ol className="info-ol">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
        <div>
          <h4>What you get</h4>
          <ul className="info-ul">{g.output.map((s) => <li key={s}>{s}</li>)}</ul>
          <h4>Where it plays safe</h4>
          <ul className="info-ul">{g.careful.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </div>
    </details>
  );
}

/** "How it works": plain-language documentation, reached from the "i" button in the header. onNavigate = route change. */
export default function InfoPage({ onNavigate }) {
  const [active, setActive] = useScrollSpy(IDS);

  return (
    <div className="page">
      <PageHeader
        title="How Excel Suite works"
        subtitle="What happens to your file, how each tool decides, and where it plays safe."
        actions={<Button label="Go to Files" outlined severity="secondary" icon={<FolderOpen size={16} />} onClick={() => onNavigate('files')} />}
      />
      <div className="info">
        <nav className="info__toc" aria-label="On this page">
          <span className="info__toc-title">On this page</span>
          {SECTIONS.map(({ id, title }) => (
            <button
              key={id}
              type="button"
              className={active === `info-${id}` ? 'is-active' : undefined}
              aria-current={active === `info-${id}` ? 'location' : undefined}
              onClick={() => { setActive(`info-${id}`); scrollToSection(`info-${id}`); }}
            >
              {title}
            </button>
          ))}
        </nav>

        <div className="info__body">
          <Section id="steps" title="In 3 steps">
            <ol className="info-steps">
              {STEPS.map(({ title, text }, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <li key={title} className="card info-step">
                    <span className="info-step__icon" aria-hidden="true"><Icon size={18} /></span>
                    <strong><span className="muted">{i + 1}.</span> {title}</strong>
                    <p>{text}</p>
                  </li>
                );
              })}
            </ol>
          </Section>

          <Section id="privacy" title="Your files stay with you" lead="Excel Suite is a web page that works entirely on your computer. There is no server behind it.">
            <div className="grid-2">
              <div className="card info-panel">
                <h3><Laptop size={18} aria-hidden="true" /> What happens</h3>
                <Checks items={PRIVACY.happens} />
              </div>
              <div className="card info-panel">
                <h3><ShieldCheck size={18} aria-hidden="true" /> What never happens</h3>
                <Checks items={PRIVACY.never} />
              </div>
            </div>
            <p className="hint"><Info size={14} aria-hidden="true" /><span>{PRIVACY.note}</span></p>
            <aside className="info-callout">
              <span className="info-callout__icon" aria-hidden="true"><Search size={18} /></span>
              <div><strong>Check it yourself</strong><p>{PRIVACY.check}</p></div>
            </aside>
          </Section>

          <Section id="reading" title="How your file is read" lead="Before any tool runs, the file is turned into a clean table. This is what happens.">
            <Facts items={READING} />
          </Section>

          <Section id="scores" title="How match scores work" lead="Diff Check, Fuzzy Lookup, similar Duplicates and similar references in Reconcile all use the same word score.">
            <div className="info-scores">
              <ol className="info-ol info-ol--big">
                {SCORE_STEPS.map(({ title, text }) => <li key={title}><strong>{title}</strong><span>{text}</span></li>)}
              </ol>
              <div className="card info-example">
                <div className="info-example__head">
                  <span className="card__label">Worked example</span>
                  <BandTag pct={example.pct} />
                </div>
                <WordBreakdown aText={EXAMPLE.query} bText={example.text} hasB words={example.words} />
                <p className="muted">Three words match exactly. "Traders" and "Trader" are one letter apart, so they still count. "Delhi" and "Mumbai" are only on one side each. Result: {example.pct}%.</p>
              </div>
            </div>
            <div className="info-bands" role="list" aria-label="Colour bands">
              {BANDS.map((b, i) => (
                <span key={b.key} role="listitem" className="info-band">
                  <span className="legend__swatch" style={{ background: b.bg, border: `1px solid ${b.bar}` }} aria-hidden="true" />
                  <strong>{bandRange(b, i)}</strong> {b.label}
                </span>
              ))}
            </div>
            {SCORE_NOTES.map((n) => <p key={n} className="hint">{n}</p>)}
          </Section>

          <Section id="tools" title="Every tool, explained" lead="Open a tool to see how it decides, what you get, and where it is careful.">
            {CATEGORIES.map((c) => (
              <div key={c.id} className="info-group">
                <h3>{c.title}</h3>
                {tools.filter((t) => t.category === c.id).map((t) => <ToolGuide key={t.id} tool={t} />)}
              </div>
            ))}
          </Section>

          <Section id="results" title="Your result file">
            <Facts items={RESULT_FILE} />
          </Section>

          <Section id="faq" title="Good to know">
            <div className="card info-faq">
              {FAQ.map(({ q, a }) => (
                <details key={q}>
                  <summary><span>{q}</span><ChevronDown size={18} className="info-tool__chev" aria-hidden="true" /></summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
