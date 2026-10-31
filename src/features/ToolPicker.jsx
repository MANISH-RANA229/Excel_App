import { ArrowRight } from 'lucide-react';
import { CATEGORIES, isReady, needsHint, tools } from './index.js';

/** Tool cards grouped by category; disabled until the tool's file requirements are met. */
export default function ToolPicker({ loaded, onOpen }) {
  return CATEGORIES.map(({ id: category, title }) => {
    const items = tools.filter((t) => t.category === category);
    if (!items.length) return null;
    return (
      <div key={category} className="tool-group">
        <h3 className="tool-group__title">{title}</h3>
        <div className="tool-grid">
          {items.map((tool) => {
            const ready = isReady(tool, loaded);
            const Icon = tool.icon;
            return (
              <button key={tool.id} type="button" className="tool-card" disabled={!ready} onClick={() => onOpen(tool.id)}>
                <span className="tool-card__icon" aria-hidden="true"><Icon size={18} /></span>
                <span className="tool-card__body">
                  <span className="tool-card__title">{tool.title}</span>
                  <span className="tool-card__desc">{ready ? tool.description : `${needsHint(tool)} to use this tool.`}</span>
                </span>
                <ArrowRight size={16} className="tool-card__go" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    );
  });
}
