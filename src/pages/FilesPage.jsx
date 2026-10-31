import { useRef } from 'react';
import { Button } from 'primereact/button';
import { ArrowLeftRight, Plus, Zap } from 'lucide-react';
import PageHeader from '../layout/PageHeader.jsx';
import FileDropCard from '../shared/FileDropCard.jsx';
import ToolPicker from '../features/ToolPicker.jsx';
import { isReady, needsHint, tools } from '../features/index.js';

// Shortcuts to the clean-up tools, for files that need tidying before they are compared.
const PREP = [{ id: 'duplicates', label: 'Find exact duplicates' }, { id: 'cleaner', label: 'Clean text & dates' }];

export default function FilesPage({ files, onFiles, datasets, loaded, onOpenTool }) {
  // Functional updates: two cards can finish loading at nearly the same moment.
  const setFile = (i) => (f) => onFiles((prev) => prev.map((p, j) => (j === i ? f : p)));
  const cards = [useRef(null), useRef(null)];
  const free = files.findIndex((f) => !f); // the slot "Add file" fills; -1 when both are taken

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
      <div className="grid-2">
        <FileDropCard ref={cards[0]} label="Excel 1" value={files[0]} onChange={setFile(0)} />
        <FileDropCard ref={cards[1]} label="Excel 2" accent="b" value={files[1]} onChange={setFile(1)} />
      </div>
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
    </div>
  );
}
