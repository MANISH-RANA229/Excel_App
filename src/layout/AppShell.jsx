import { useState } from 'react';
import GlobalHeader from './GlobalHeader.jsx';
import Sidebar from './Sidebar.jsx';

/** App frame: global header on top, navigation sidebar on the left, scrollable page area. */
export default function AppShell({ nav, active, onNavigate, onClear, children }) {
  const [navOpen, setNavOpen] = useState(false);
  const current = nav.flatMap((g) => g.items).find((i) => i.id === active);

  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <GlobalHeader page={current?.label} onMenu={() => setNavOpen((o) => !o)} />
      <Sidebar nav={nav} active={active} onSelect={(id) => { onNavigate(id); setNavOpen(false); }} onClear={onClear} />
      {navOpen && <div className="shell__backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <main className="shell__main">{children}</main>
    </div>
  );
}
