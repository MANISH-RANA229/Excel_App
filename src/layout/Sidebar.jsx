import { Trash2 } from 'lucide-react';

/** nav = [{ title, items: [{ id, label, icon, hint, disabled }] }] */
export default function Sidebar({ nav, active, onSelect, onClear }) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <nav className="sidebar__nav">
        {nav.map((group) => (
          <div key={group.title} className="sidebar__group">
            <div className="sidebar__title">{group.title}</div>
            {group.items.map(({ id, label, icon: Icon, hint, disabled }) => (
              <button
                key={id}
                type="button"
                className={`sidebar__item${active === id ? ' is-active' : ''}`}
                aria-current={active === id ? 'page' : undefined}
                disabled={disabled}
                title={disabled ? 'Load both files first' : undefined}
                onClick={() => onSelect(id)}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="sidebar__label">{label}</span>
                {hint && <span className="sidebar__hint">{hint}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar__foot">
        <button type="button" className="sidebar__item" onClick={onClear}>
          <Trash2 size={16} aria-hidden="true" />
          <span className="sidebar__label">Clear workspace</span>
        </button>
      </div>
    </aside>
  );
}
