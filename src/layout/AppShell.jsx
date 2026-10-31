import { useState } from 'react';
import GlobalHeader from './GlobalHeader.jsx';
import Sidebar from './Sidebar.jsx';

/**
 * App frame: global header on top, navigation sidebar on the left, scrollable page area. storage = bytes of the loaded files.
 * phase = what the active tool reported ({ phase, back }, see shared/ToolPhase.js): on its results the breadcrumb gains a last level
 * (Workspace › Diff Check › Diff result) and the tool name goes back to the settings.
 */
export default function AppShell({ nav, active, phase, storage, onNavigate, onClear, children }) {
  const [navOpen, setNavOpen] = useState(false);
  const current = nav.flatMap((g) => g.items).find((i) => i.id === active);
  const onResults = phase?.phase === 'results' && !!current?.resultLabel;
  const crumbs = current && [
    { label: 'Workspace', href: '#/files' },
    { label: current.crumb ?? current.label, onClick: onResults ? phase.back : undefined },
    ...(onResults ? [{ label: current.resultLabel }] : []),
  ];

  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <GlobalHeader crumbs={crumbs} nav={nav} onNavigate={onNavigate} onMenu={() => setNavOpen((o) => !o)} />
      <Sidebar nav={nav} active={active} storage={storage} onSelect={(id) => { onNavigate(id); setNavOpen(false); }} onClear={onClear} />
      {navOpen && <div className="shell__backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <main className="shell__main">{children}</main>
    </div>
  );
}
