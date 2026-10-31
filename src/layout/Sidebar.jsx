import { Trash2 } from 'lucide-react';
import { formatBytes } from '../core/format.js';

/** nav = [{ title, items: [{ id, label, icon, hint, badge, disabled, disabledReason }] }]; storage = bytes of the loaded files. */
export default function Sidebar({ nav, active, storage, onSelect, onClear }) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <nav className="sidebar__nav">
        {nav.map((group) => (
          <div key={group.title} className="sidebar__group">
            <div className="sidebar__title">{group.title}</div>
            {group.items.map(({ id, label, icon: Icon, hint, badge, disabled, disabledReason }) => (
              <button
                key={id}
                type="button"
                className={`sidebar__item${active === id ? ' is-active' : ''}`}
                aria-current={active === id ? 'page' : undefined}
                disabled={disabled}
                title={disabled ? disabledReason : undefined}
                onClick={() => onSelect(id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="sidebar__label">{label}</span>
                {badge && <span className="sidebar__badge">{badge}</span>}
                {hint && <span className="sidebar__hint">{hint}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar__foot">
        <button type="button" className="sidebar__item sidebar__item--danger" onClick={onClear}>
          <Trash2 size={18} aria-hidden="true" />
          <span>Clear workspace</span>
        </button>
        <div className="sidebar__storage" title="Size of the files loaded on the Files page. Nothing is saved to disk or uploaded.">
          <span>Storage: In-Memory</span>
          <b>{formatBytes(storage)}</b>
        </div>
      </div>
    </aside>
  );
}
