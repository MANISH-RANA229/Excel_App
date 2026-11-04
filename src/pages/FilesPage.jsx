import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/index.js';
import { ArrowLeftRight, ClipboardPaste, Plus, Undo2, X, Zap } from 'lucide-react';
import PageHeader from '../layout/PageHeader.jsx';
import FileDropCard from '../shared/FileDropCard.jsx';
import PasteTableDialog from '../shared/PasteTableDialog.jsx';
import ToolPicker from '../features/ToolPicker.jsx';
import { isReady, needsHint, tools } from '../features/index.js';
import DataHealthCard from './DataHealthCard.jsx';

// Shortcuts to the clean-up tools, for files that need tidying before they are compared.
const PREP = [{ id: 'duplicates', label: 'Find exact duplicates' }, { id: 'cleaner', label: 'Clean text & dates' }];

// onLoadFile(file, slot) opens a File like a dropped one (App's loader); restorable = { slot, previous, current } after "Use as input" or a paste replaced a file.
export default function FilesPage({ files, onFiles, datasets, loaded, onOpenTool, onLoadFile, restorable, onRestore, onDismissRestore }) {
  // Functional updates: two cards can finish loading at nearly the same moment.
  const setFile = (i) => (f) => onFiles((prev) => prev.map((p, j) => (j === i ? f : p)));
  const cards = [useRef(null), useRef(null)];
  const free = files.findIndex((f) => !f); // the slot "Add file" fills; -1 when both are taken
  const names = files.map((f) => f?.dataset?.fileName ?? null);
  const [paste, setPaste] = useState(null); // null = closed, otherwise the text the paste box starts with

  // Ctrl+V anywhere on the page (not while typing in a field) offers to load the copied table.
  useEffect(() => {
    const onPaste = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const text = e.clipboardData?.getData('text');
      if (!text?.trim()) return;
      e.preventDefault();
      setPaste(text);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  return (
    <div className="page">
      <PageHeader
        title="Files & Spreadsheets"
        badge={`${files.filter(Boolean).length} Loaded`}
        subtitle="Load spreadsheets to compare, reconcile and clean (.xlsx, .xls, .csv). Header rows are detected automatically."
        actions={(
          <>
            {files[0] && files[1] && (
              <Button label="Swap files" outlined severity="secondary" icon={<ArrowLeftRight size={16} />} onClick={() => onFiles((prev) => [prev[1], prev[0]])} />
            )}
            <Button label="Paste table" outlined severity="secondary" icon={<ClipboardPaste size={16} />} title="Copy cells in Excel, then paste them here. No file needed." onClick={() => setPaste('')} />
            <Button
              label="Add file"
              icon={<Plus size={16} />}
              disabled={free < 0}
              title={free < 0 ? 'Both files are loaded. Remove one to add another.' : undefined}
              onClick={() => cards[free].current.open()}
            />
          </>
        )}
      />
      {restorable && (
        <div className="restore-bar" role="status">
          <Undo2 size={16} aria-hidden="true" />
          <span>Excel {restorable.slot + 1} is now <b>{restorable.current?.dataset?.fileName ?? 'new file'}</b>. The file you had before is kept in this tab.</span>
          <Button label={`Restore ${restorable.previous?.dataset?.fileName ?? 'previous file'}`} size="sm" outlined severity="secondary" onClick={onRestore} />
          <Button text rounded size="sm" severity="secondary" aria-label="Dismiss" icon={<X size={16} />} onClick={onDismissRestore} />
        </div>
      )}
      <div className="grid-2">
        <FileDropCard ref={cards[0]} label="Excel 1" value={files[0]} onChange={setFile(0)} />
        <FileDropCard ref={cards[1]} label="Excel 2" accent="b" value={files[1]} onChange={setFile(1)} />
      </div>
      <DataHealthCard datasets={datasets} onOpenTool={onOpenTool} />
      <ToolPicker datasets={datasets} loaded={loaded} onOpen={onOpenTool} />
      <aside className="quickprep" aria-label="Quick pre-processing">
        <span className="quickprep__icon" aria-hidden="true"><Zap size={18} /></span>
        <div className="quickprep__text">
          <strong>Quick pre-processing needed?</strong>
          <span>Trim stray spaces, fix numbers and dates stored as text, standardize case, or remove exact duplicates before matching.</span>
        </div>
        <div className="quickprep__actions">
          {PREP.map(({ id, label }) => {
            const tool = tools.find((t) => t.id === id);
            const ready = tool && isReady(tool, loaded);
            return tool && (
              <Button key={id} label={label} outlined severity="secondary" disabled={!ready} title={ready ? undefined : needsHint(tool)} onClick={() => onOpenTool(id)} />
            );
          })}
        </div>
      </aside>
      <PasteTableDialog visible={paste !== null} initialText={paste ?? ''} names={names} onHide={() => setPaste(null)} onLoad={onLoadFile} />
    </div>
  );
}
