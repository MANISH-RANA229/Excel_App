import { Dialog } from 'primereact/dialog';
import { FileSpreadsheet, ShieldCheck } from 'lucide-react';

/** "Use as input" when both Excel slots are taken: which one should the result replace? names = [string, string]. */
export default function ReuseDialog({ visible, names, onPick, onHide }) {
  return (
    <Dialog visible={visible} header="Use this result as…" modal draggable={false} resizable={false} onHide={onHide} style={{ width: 'min(480px, 94vw)' }}>
      <div className="reuse">
        <p className="muted">Both Excel 1 and Excel 2 are in use. Which one should the result replace?</p>
        <div className="reuse__choices">
          {names.map((name, i) => (
            <button key={i} type="button" className="reuse__choice" onClick={() => onPick(i)}>
              <span className={`file-tag${i === 1 ? ' file-tag--b' : ''}`}><FileSpreadsheet size={14} aria-hidden="true" />Excel {i + 1}</span>
              <span className="clip" title={name}>{name}</span>
              <b>Replace</b>
            </button>
          ))}
        </div>
        <p className="hint"><ShieldCheck size={14} aria-hidden="true" /><span>Your files on your computer are never changed. You can bring the replaced one back with Restore.</span></p>
      </div>
    </Dialog>
  );
}
