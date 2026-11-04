import { useRef, useState } from 'react';
import { Button, Checkbox, Dropdown } from '../../components/ui/index.js';
import { FilePlus2, Layers, Play } from 'lucide-react';
import FileDropCard, { ACCEPT } from '../../shared/FileDropCard.jsx';
import { MAX_SOURCES } from './engine.js';

const KEEP = { label: 'Keep as its own column', value: null };
const MAX_MAPPINGS = 60;

/** The columns a source has that not every source has, plus ones already joined by hand (so the join can be undone). */
function mappingRows(loaded, plan, config) {
  return loaded.flatMap((ds, i) => {
    const partial = new Set(plan.partial[i].map((p) => p.column));
    return ds.columns.filter((c) => partial.has(c) || config.overrides[ds.key]?.[c]).map((column) => ({ ds, column, target: config.overrides[ds.key]?.[column] ?? null }));
  });
}

export default function CombineConfig({ sources, loaded, plan, config, problem, onAdd, onValue, onAddSheets, onChange, onRun }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const set = (patch) => onChange({ ...config, ...patch });
  const setOverride = (key, column, target) => {
    const mine = { ...(config.overrides[key] ?? {}) };
    if (target) mine[column] = target; else delete mine[column];
    set({ overrides: { ...config.overrides, [key]: mine } });
  };
  const rows = loaded.length >= 2 ? mappingRows(loaded, plan, config) : [];
  const full = sources.length >= MAX_SOURCES;
  const totalRows = loaded.reduce((n, s) => n + s.rowCount, 0);
  // sheets of a source's workbook that are not in the list yet
  const unusedSheets = (s) => (s.value ? s.value.sheetNames.filter((name) => !sources.some((x) => x.file === s.file && (x.value?.dataset.sheet ?? x.sheet) === name)) : []);

  return (
    <div className="card config">
      <div className="config__grid">
        <div className="span-2">
          <button
            type="button"
            className={`dropzone${dragging ? ' is-dragging' : ''}`}
            disabled={full}
            onClick={() => inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); onAdd(e.dataTransfer.files); }}
          >
            <FilePlus2 size={24} aria-hidden="true" />
            <span className="dropzone__title">{sources.length ? 'Add more files' : 'Drop the files to combine, or click to browse'}</span>
            <span className="dropzone__hint">.xlsx · .xls · .csv · several at once · up to {MAX_SOURCES}</span>
          </button>
          <input ref={inputRef} type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => { onAdd(e.target.files); e.target.value = ''; }} />
        </div>

        {sources.length > 0 && (
          <div className="source-list span-2">
            {sources.map((s) => {
              const more = unusedSheets(s);
              return (
                <FileDropCard
                  key={s.key}
                  compact
                  initialFile={s.file}
                  initialSheet={s.sheet}
                  value={s.value}
                  onChange={(v) => onValue(s.key, v)}
                  actions={more.length > 0 && (
                    <Button
                      label="Add its other sheets"
                      icon={<Layers size={14} />}
                      text
                      size="sm"
                      onClick={() => onAddSheets(s.file, more)}
                      title={`Adds ${more.join(', ')} as separate sources`}
                    />
                  )}
                />
              );
            })}
          </div>
        )}

        <div className="field">
          <span>Extra columns in the result</span>
          <label className="check"><Checkbox checked={config.includeSourceFile} onChange={(e) => set({ includeSourceFile: e.checked })} /><span>Source file name</span></label>
          <label className="check"><Checkbox checked={config.includeSourceSheet} onChange={(e) => set({ includeSourceSheet: e.checked })} /><span>Sheet name</span></label>
          <label className="check"><Checkbox checked={config.includeSourceRow} onChange={(e) => set({ includeSourceRow: e.checked })} /><span>Original row number</span></label>
        </div>

        <div className="field">
          <span>Columns</span>
          <label className="check">
            <Checkbox checked={config.commonOnly} onChange={(e) => set({ commonOnly: e.checked })} />
            <span>Only keep columns found in every file</span>
          </label>
          <small className="muted">Columns are matched by name (ignoring upper/lower case, spaces and punctuation).</small>
        </div>
      </div>

      {rows.length > 0 && !config.commonOnly && (
        <div className="cfg-sec map-panel">
          <div className="cfg-sec__head">
            <h3>Columns found in some files only</h3>
            <p className="muted">These are kept as their own columns by default. You can join them into an existing column if they mean the same thing.</p>
          </div>
          <div className="measure-rows">
            {rows.slice(0, MAX_MAPPINGS).map(({ ds, column, target }) => (
              <div className="map-row" key={`${ds.key}|${column}`}>
                <span className="clip muted">{ds.fileName} · {ds.sheet}</span>
                <strong className="clip" title={column}>{column}</strong>
                <label className="field">
                  <span className="sr-only">Join {column} of {ds.fileName} to</span>
                  <Dropdown
                    value={target}
                    options={[KEEP, ...plan.all.filter((t) => t.name !== column && t.name !== target).map((t) => ({ label: t.name, value: t.name })), ...(target ? [{ label: target, value: target }] : [])]}
                    onChange={(e) => setOverride(ds.key, column, e.value)}
                    className="w-full"
                  />
                </label>
              </div>
            ))}
            {rows.length > MAX_MAPPINGS && <small className="muted">… and {rows.length - MAX_MAPPINGS} more.</small>}
          </div>
        </div>
      )}

      <div className="config__foot">
        {problem ? <p className="field-error" role="alert">{problem}</p> : (
          <p className="hint">{totalRows.toLocaleString()} rows from {loaded.length} files and sheets will be stacked into {plan.targets.length} columns. Your files are not changed.</p>
        )}
        <Button label="Combine" size="sm" icon={<Play size={14} />} disabled={!!problem} onClick={onRun} />
      </div>
    </div>
  );
}
