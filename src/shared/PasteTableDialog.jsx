import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button, SelectButton } from '../components/ui/index.js';
import { ClipboardPaste, Info, ShieldCheck } from 'lucide-react';
import { describePasted, pasteTooLarge, pastedFile } from '../core/dataset/pasted.js';
import { MAX_PASTE_MB } from '../core/limits.js';

const SLOTS = [{ label: 'Excel 1', value: 0 }, { label: 'Excel 2', value: 1 }];

/**
 * "Paste a table": copy cells in Excel or Google Sheets, press Ctrl+V in the box. The text becomes a CSV file that is opened
 * like a dropped file (core/dataset/pasted.js). names = [string | null, string | null] file names in the two slots;
 * onLoad(file, slot) hands the file to the app's loader.
 */
export default function PasteTableDialog({ visible, onHide, initialText = '', names, onLoad }) {
  const free = names.findIndex((n) => !n);
  const box = useRef(null);
  const [text, setText] = useState('');
  const [slot, setSlot] = useState(0);
  useEffect(() => {
    if (!visible) return;
    setText(initialText);
    setSlot(free < 0 ? 0 : free);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const tooLarge = pasteTooLarge(text);
  const info = useMemo(() => (tooLarge ? null : describePasted(text)), [text, tooLarge]);
  const ready = !!info && info.columns > 0 && info.dataRows > 0;

  function load() {
    onLoad(pastedFile(text), slot);
    onHide();
  }

  let status = 'Nothing pasted yet.';
  if (tooLarge) status = `That is more than ${MAX_PASTE_MB} MB of text. Save it as a file (.xlsx or .csv) and drop it on the page instead.`;
  else if (info?.columns && !info.dataRows) status = 'Only one row found. The first row is used as the header, so paste at least one more row.';
  else if (ready) status = `${info.columns.toLocaleString()} ${info.columns === 1 ? 'column' : 'columns'} · ${info.dataRows.toLocaleString()} data ${info.dataRows === 1 ? 'row' : 'rows'}`;

  return (
    <Dialog
      visible={visible}
      header="Paste a table"
      modal
      draggable={false}
      resizable={false}
      onHide={onHide}
      onShow={() => box.current?.focus()} // the dialog moves focus itself after its animation: put it back in the box
      style={{ width: 'min(640px, 94vw)' }}
      footer={(
        <>
          <Button label="Cancel" text severity="secondary" onClick={onHide} />
          <Button label="Load table" icon={<ClipboardPaste size={16} />} disabled={!ready} onClick={load} />
        </>
      )}
    >
      <div className="paste">
        <p className="muted">Copy cells in Excel or Google Sheets, then press <kbd>Ctrl</kbd> + <kbd>V</kbd> in the box. The first row is used as the header.</p>
        <textarea
          className="paste__box"
          aria-label="Pasted table"
          placeholder="Paste here…"
          spellCheck={false}
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className={`paste__status${ready ? ' is-ready' : ''}`} role="status">
          {ready ? <span><b>{status}</b></span> : status}
          {ready && info.header.length > 0 && <span className="muted clip"> · {info.header.slice(0, 6).join(', ')}{info.header.length > 6 ? '…' : ''}</span>}
        </p>
        <div className="paste__target">
          <span className="paste__label">Open as</span>
          <SelectButton value={slot} options={SLOTS} unselectable={false} onChange={(e) => e.value != null && setSlot(e.value)} aria-label="Open the table as Excel 1 or Excel 2" />
        </div>
        {names[slot] && (
          <p className="hint"><Info size={14} aria-hidden="true" /><span>This replaces <b>{names[slot]}</b> in the app. You can bring it back with Restore. The file on your computer is not changed.</span></p>
        )}
        <p className="hint"><ShieldCheck size={14} aria-hidden="true" /><span>What you paste stays in this browser tab. It is not sent anywhere.</span></p>
      </div>
    </Dialog>
  );
}
