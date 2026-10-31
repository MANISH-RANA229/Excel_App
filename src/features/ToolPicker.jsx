import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { CATEGORIES, isReady, needsHint, tools } from './index.js';

const USES = ['Loads its own files', 'Uses one file', 'Uses both files']; // by tool.needs

/** "Execute operation" section: one category of tools at a time. A card is disabled until the tool's file requirements are met. */
export default function ToolPicker({ datasets, loaded, onOpen }) {
  const [category, setCategory] = useState(CATEGORIES[0].id);

  return (
    <section className="section">
      <div className="ops-head">
        <div>
          <h2>
            Execute Operation on Current Spreadsheets
            <span className={`ops-dot${loaded.some(Boolean) ? ' is-on' : ''}`} aria-hidden="true" />
          </h2>
          <p>Select a specialized engine to compute differences, match fuzzy strings, or reconcile values.</p>
        </div>
        <div className="seg" role="group" aria-label="Tool category">
          {CATEGORIES.map(({ id, tab }) => (
            <button key={id} type="button" aria-pressed={id === category} onClick={() => setCategory(id)}>{tab}</button>
          ))}
        </div>
      </div>
      <div className="tool-grid">
        {tools.filter((t) => t.category === category).map((tool) => {
          const ready = isReady(tool, loaded);
          const note = ready ? tool.recommend?.(datasets) : null; // e.g. "Key: Reference ID": marks the card as the suggested one
          const Icon = tool.icon;
          return (
            <button key={tool.id} type="button" className={`tool-card${note ? ' is-recommended' : ''}`} disabled={!ready} title={tool.description} onClick={() => onOpen(tool.id)}>
              {note && <span className="tool-card__ribbon">Recommended</span>}
              <span className="tool-card__top">
                <span className="tool-card__icon" aria-hidden="true"><Icon size={18} /></span>
                <span className="tool-card__title">{tool.title}</span>
                <ArrowRight size={18} className="tool-card__go" aria-hidden="true" />
              </span>
              <span className="tool-card__desc">{tool.description}</span>
              <span className="tool-card__foot">
                <span className={note ? 'tool-card__note' : undefined}>{note ?? (ready ? USES[tool.needs] : needsHint(tool))}</span>
                <span className="tool-card__cta">{tool.cta ?? 'Open'} →</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
