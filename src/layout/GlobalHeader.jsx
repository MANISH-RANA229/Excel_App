import { ChevronRight, Menu, ShieldCheck, Sheet } from 'lucide-react';

export default function GlobalHeader({ page, onMenu }) {
  return (
    <header className="gheader">
      <button type="button" className="gheader__menu" onClick={onMenu} aria-label="Toggle navigation">
        <Menu size={18} />
      </button>
      <span className="gheader__logo" aria-hidden="true"><Sheet size={16} /></span>
      <span className="gheader__name">Excel App</span>
      {page && (
        <>
          <ChevronRight size={14} className="gheader__sep" aria-hidden="true" />
          <span className="gheader__page">{page}</span>
        </>
      )}
      <span className="gheader__badge" title="All processing happens in your browser. Files are never uploaded.">
        <ShieldCheck size={14} aria-hidden="true" />
        <span>Local only</span>
      </span>
    </header>
  );
}
