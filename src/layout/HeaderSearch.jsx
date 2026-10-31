import { useEffect, useRef, useState } from 'react';
import { AutoComplete } from 'primereact/autocomplete';
import { Search } from 'lucide-react';

const SHORTCUT = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

/** Jump-to box for the sidebar's pages and tools. Ctrl/⌘ + K focuses it. A tool whose files are not loaded yet sends you to Files. */
export default function HeaderSearch({ nav, onNavigate }) {
  const ref = useRef(null);
  const [text, setText] = useState('');
  const [hits, setHits] = useState([]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.getInput().focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const search = ({ query }) => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    setHits(nav.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })))
      .filter((i) => words.every((w) => `${i.label} ${i.group}`.toLowerCase().includes(w))));
  };

  return (
    <div className="hsearch">
      <Search size={16} className="hsearch__icon" aria-hidden="true" />
      <AutoComplete
        ref={ref}
        value={text}
        suggestions={hits}
        completeMethod={search}
        field="label"
        autoHighlight
        emptyMessage="No matching tool or page"
        placeholder="Search tools and pages…"
        aria-label="Search tools and pages"
        onChange={(e) => setText(typeof e.value === 'string' ? e.value : '')}
        onSelect={(e) => {
          onNavigate(e.value.disabled ? 'files' : e.value.id);
          setText('');
          setTimeout(() => ref.current?.getInput().blur()); // PrimeReact re-focuses the input right after onSelect
        }}
        itemTemplate={({ label, group, icon: Icon, disabled, disabledReason }) => (
          <span className={`hsearch-item${disabled ? ' is-disabled' : ''}`}>
            <Icon size={16} aria-hidden="true" />
            {label}
            <small>{disabled ? disabledReason : group}</small>
          </span>
        )}
      />
      <kbd className="hsearch__kbd" aria-hidden="true">{SHORTCUT}</kbd>
    </div>
  );
}
