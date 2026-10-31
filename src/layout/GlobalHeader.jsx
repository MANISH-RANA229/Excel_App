import { Fragment } from 'react';
import { ChevronRight, FileSpreadsheet, Menu, ShieldCheck } from 'lucide-react';
import HeaderSearch from './HeaderSearch.jsx';

// crumbs = [{ label, href? | onClick? }]; the last one is the current page. Hash links: useHashRoute turns "#/files" into the Files page.
export default function GlobalHeader({ crumbs, nav, onNavigate, onMenu }) {
  return (
    <header className="gheader">
      <button type="button" className="gheader__menu" onClick={onMenu} aria-label="Toggle navigation">
        <Menu size={18} />
      </button>
      <a className="gheader__brand" href="#/files" aria-label="Excel Suite, go to Files">
        <span className="gheader__logo" aria-hidden="true"><FileSpreadsheet size={20} /></span>
        <span className="gheader__name">Excel Suite</span>
        <span className="gheader__pro">PRO</span>
      </a>
      <span className="gheader__divider" aria-hidden="true" />
      {crumbs && (
        <nav className="gheader__crumb" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <Fragment key={c.label}>
              {i > 0 && <ChevronRight size={14} aria-hidden="true" />}
              {i === crumbs.length - 1 ? <span className="gheader__page" aria-current="page">{c.label}</span>
                : c.onClick ? <button type="button" className="gheader__link" onClick={c.onClick}>{c.label}</button>
                : <a href={c.href}>{c.label}</a>}
            </Fragment>
          ))}
        </nav>
      )}
      <HeaderSearch nav={nav} onNavigate={onNavigate} />
      <span className="gheader__badge" title="All processing happens in your browser. Files are never uploaded.">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Local only · 100% Private</span>
      </span>
    </header>
  );
}
