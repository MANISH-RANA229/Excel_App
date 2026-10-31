import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import NumberInput from './fields/NumberInput.jsx';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileUp, X } from 'lucide-react';
import { keyCandidate } from '../core/dataset/keyCandidate.js';
import { formatBytes } from '../core/format.js';
import { useWorkerTask } from '../hooks/useWorkerTask.js';
import DataPreview from './DataPreview.jsx';
import ErrorNotice from './ErrorNotice.jsx';
import JobProgress from './JobProgress.jsx';

const createWorker = () => new Worker(new URL('../workers/readWorkbook.worker.js', import.meta.url), { type: 'module' });
const STAGES = ['Reading file', 'Scanning sheets', 'Building columns'];
export const ACCEPT = '.xlsx,.xls,.csv';
const HEADER_DEBOUNCE_MS = 500;

/** Under the preview: which column could identify a row, and what the file is. */
function CardFoot({ dataset, file }) {
  const key = useMemo(() => keyCandidate(dataset), [dataset]);
  const type = /\.(\w+)$/.exec(file.name)?.[1]?.toUpperCase();
  return (
    <div className="file-card__foot">
      <span>{key ? <>Primary key candidate: <code>{key}</code> (100% unique)</> : 'No single column is unique'}</span>
      <span>{[type, formatBytes(file.size)].filter(Boolean).join(' · ')}</span>
    </div>
  );
}

/**
 * Upload slot for one spreadsheet. Parsing runs in a worker (loader shown inline, cancellable).
 * value = { file, sheetNames, dims, warnings, dataset } | null  — see core/dataset/dataset.js
 *
 * For tools that own a list of files: `initialFile` (+ `initialSheet`) starts reading on mount, `compact` shows a one-row
 * card without the preview, `actions` adds buttons to its header, and onChange(null) means "remove this one".
 * `accent` ('a' | 'b') colours the Excel 1 / Excel 2 tag; `ref.current.open()` opens the file picker (the page's "Add file" button).
 */
export default function FileDropCard({ ref, label, accent = 'a', value, onChange, initialFile, initialSheet, compact = false, actions }) {
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => ({ open: () => inputRef.current?.click() }), []);
  const pendingFile = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [headerDraft, setHeaderDraft] = useState(null);
  const task = useWorkerTask(createWorker);
  const busy = task.status === 'running';
  const dataset = value?.dataset;

  const read = useCallback((file, opts) => {
    pendingFile.current = file;
    task.start({ file, ...opts });
  }, [task.start]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (task.status !== 'done') return;
    onChange({ file: pendingFile.current, ...task.result });
    task.reset();
  }, [task.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const started = useRef(false);
  useEffect(() => {
    if (!initialFile || value || started.current) return undefined;
    started.current = true;
    read(initialFile, initialSheet ? { sheet: initialSheet } : undefined);
    return () => { started.current = false; }; // dev StrictMode unmounts once, which kills this read: let the remount start it again
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Header-row edits re-read the sheet; wait until the user stops clicking.
  useEffect(() => { setHeaderDraft(dataset?.headerRow ?? null); }, [dataset?.id, task.status === 'error']); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!value || headerDraft == null || headerDraft === dataset.headerRow) return undefined;
    const t = setTimeout(() => read(value.file, { sheet: dataset.sheet, headerRow: headerDraft }), HEADER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [headerDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const loader = (
    <JobProgress
      variant="inline"
      title={`Reading ${pendingFile.current?.name ?? 'file'}`}
      stages={STAGES}
      progress={task.progress}
      elapsedMs={task.elapsedMs}
      etaMs={task.etaMs}
      unit="rows"
      onCancel={task.cancel}
    />
  );
  const input = (
    <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(e) => { if (e.target.files[0]) read(e.target.files[0]); e.target.value = ''; }} />
  );
  const error = <ErrorNotice error={task.error} onRetry={value ? undefined : () => inputRef.current.click()} retryLabel="Choose another file" onDismiss={task.reset} />;

  if (compact) {
    const name = dataset?.fileName ?? pendingFile.current?.name ?? initialFile?.name ?? label;
    return (
      <div className="card file-card file-card--compact">
        <div className="file-card__head">
          <FileSpreadsheet size={18} className="text-brand" aria-hidden="true" />
          <div className="file-card__name">
            <span className="card__label">{label}</span>
            <strong title={name}>{name}</strong>
          </div>
          {dataset && <span className="file-card__meta">{dataset.rowCount.toLocaleString()} rows · {dataset.columns.length} cols</span>}
          {actions}
          <Button text rounded size="small" severity="secondary" aria-label={`Remove ${name}`} icon={<X size={16} />} onClick={() => { task.reset(); onChange(null); }} />
        </div>
        {value && (
          <div className="file-card__controls">
            <label className="field">
              <span>Sheet</span>
              <Dropdown value={dataset.sheet} options={value.sheetNames} disabled={busy} onChange={(e) => read(value.file, { sheet: e.value })} className="w-full" />
            </label>
            <label className="field field--narrow">
              <span>Header row</span>
              <NumberInput label={`header row of ${name}`} value={headerDraft} onValueChange={(e) => e.value && setHeaderDraft(e.value)} min={1} disabled={busy} inputClassName="num-input" />
            </label>
          </div>
        )}
        {error}
        {value?.warnings.map((w) => <Message key={w} severity="warn" text={w} className="w-full" />)}
        {value && !dataset.rowCount && !busy && <Message severity="warn" text="No data rows below the header row." className="w-full" />}
        {busy && loader}
        {input}
      </div>
    );
  }

  const tag = (
    <span className={`file-tag${accent === 'b' ? ' file-tag--b' : ''}`}>
      <FileSpreadsheet size={14} aria-hidden="true" />{label}
    </span>
  );

  if (!value) {
    return (
      <div className="card file-card file-card--full">
        <div className="file-card__head">{tag}</div>
        {busy ? loader : (
          <button
            type="button"
            className={`dropzone${dragging ? ' is-dragging' : ''}`}
            onClick={() => inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); }}
          >
            <span className="dropzone__icon"><FileUp size={22} aria-hidden="true" /></span>
            <span className="dropzone__title">Drop a file or click to browse</span>
            <span className="dropzone__hint">.xlsx · .xls · .csv</span>
          </button>
        )}
        {input}
        {error}
      </div>
    );
  }

  return (
    <div className="card file-card file-card--full">
      <div className="file-card__head">
        {tag}
        <strong className="file-card__title clip" title={dataset.fileName}>{dataset.fileName}</strong>
        <span className="file-card__meta">{dataset.rowCount.toLocaleString()} rows · {dataset.columns.length} cols</span>
        <Button text rounded size="small" severity="secondary" aria-label={`Remove ${label}`} icon={<X size={16} />} onClick={() => { task.reset(); onChange(null); }} />
      </div>
      <div className="file-card__controls">
        <label className="field field--inline">
          <span>Sheet</span>
          <Dropdown
            value={dataset.sheet}
            options={value.sheetNames}
            disabled={busy}
            onChange={(e) => read(value.file, { sheet: e.value })}
          />
        </label>
        <label className="field field--inline">
          <span>Header row</span>
          <NumberInput
            label="header row"
            value={headerDraft}
            onValueChange={(e) => e.value && setHeaderDraft(e.value)}
            min={1}
            disabled={busy}
            inputClassName="num-input"
            decrementButtonIcon={<ChevronLeft size={14} />}
            incrementButtonIcon={<ChevronRight size={14} />}
          />
        </label>
      </div>
      {error}
      {value.warnings.map((w) => <Message key={w} severity="warn" text={w} className="w-full" />)}
      {busy ? loader : dataset.rowCount ? (
        <>
          <DataPreview dataset={dataset} />
          <CardFoot dataset={dataset} file={value.file} />
        </>
      ) : (
        <Message severity="warn" text="No data rows below the header row." className="w-full" />
      )}
      {input}
    </div>
  );
}
