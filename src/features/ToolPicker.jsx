import { ArrowRight } from 'lucide-react';

export default function ToolPicker({ tools, disabled, onOpen }) {
  return (
    <div className="tool-grid">
      {tools.map(({ id, title, description, icon: Icon }) => (
        <button key={id} type="button" className="tool-card" disabled={disabled} onClick={() => onOpen(id)}>
          <span className="tool-card__icon" aria-hidden="true"><Icon size={18} /></span>
          <span className="tool-card__body">
            <span className="tool-card__title">{title}</span>
            <span className="tool-card__desc">{disabled ? 'Load both files to use this tool.' : description}</span>
          </span>
          <ArrowRight size={16} className="tool-card__go" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
