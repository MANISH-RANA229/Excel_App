import { useCallback, useEffect, useRef, useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import NumberInput from './fields/NumberInput.jsx';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { FileSpreadsheet, FileUp, X } from 'lucide-react';
import { useWorkerTask } from '../hooks/useWorkerTask.js';
import DataPreview from './DataPreview.jsx';
import ErrorNotice from './ErrorNotice.jsx';
import JobProgress from './JobProgress.jsx';

const createWorker = () => new Worker(new URL('../workers/readWorkbook.worker.js', import.meta.url), { type: 'module' });
const STAGES = ['Reading file', 'Scanning sheets', 'Building columns'];
export const ACCEPT = '.xlsx,.xls,.csv';
const HEADER_DEBOUNCE_MS = 500;

/**
 * Upload slot for one spreadsheet. Parsing runs in a worker (loader shown inline, cancellable).
 * value = { file, sheetNames, dims, warnings, dataset } | null  — see core/dataset/dataset.js
 *
 * For tools that own a list of files: `initialFile` (+ `initialSheet`) starts reading on mount, `compact` shows a one-row
 * card without the preview, `actions` adds buttons to its header, and onChange(null) means "remove this one".
 */
export default function FileDropCard({ label, value, onChange, initialFile, initialSheet, compact = false, actions }) {
  const inputRef = useRef(null);
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
    if (!initialFile || value || started.current) return;
    started.current = true;
    read(initialFile, initialSheet ? { sheet: initialSheet } : undefined);
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

  if (!value) {
    return (
      <div className="card file-card">
        <div className="card__label">{label}</div>
        {busy ? loader : (
          <button
            type="button"
            className={`dropzone${dragging ? ' is-dragging' : ''}`}
            onClick={() => inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); }}
          >
            <FileUp size={24} aria-hidden="true" />
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
    <div className="card file-card">
      <div className="file-card__head">
        <FileSpreadsheet size={18} className="text-brand" aria-hidden="true" />
        <div className="file-card__name">
          <span className="card__label">{label}</span>
          <strong title={dataset.fileName}>{dataset.fileName}</strong>
        </div>
        <span className="file-card__meta">{dataset.rowCount.toLocaleString()} rows · {dataset.columns.length} cols</span>
        <Button text rounded size="small" severity="secondary" aria-label={`Remove ${label}`} icon={<X size={16} />} onClick={() => { task.reset(); onChange(null); }} />
      </div>
      <div className="file-card__controls">
        <label className="field">
          <span>Sheet</span>
          <Dropdown
            value={dataset.sheet}
            options={value.sheetNames}
            disabled={busy}
            onChange={(e) => read(value.file, { sheet: e.value })}
            className="w-full"
          />
        </label>
        <label className="field field--narrow">
          <span>Header row</span>
          <NumberInput
            label="header row"
            value={headerDraft}
            onValueChange={(e) => e.value && setHeaderDraft(e.value)}
            min={1}
            disabled={busy}
            inputClassName="num-input"
          />
        </label>
      </div>
      {error}
      {value.warnings.map((w) => <Message key={w} severity="warn" text={w} className="w-full" />)}
      {busy ? loader : dataset.rowCount ? (
        <DataPreview dataset={dataset} />
      ) : (
        <Message severity="warn" text="No data rows below the header row." className="w-full" />
      )}
      {input}
    </div>
  );
}
