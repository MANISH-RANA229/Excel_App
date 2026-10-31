import { useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Plus, Play, Sparkles } from 'lucide-react';
import { OPERATION_GROUPS } from '../../core/clean/operations.js';
import SourcePicker from '../../shared/fields/SourcePicker.jsx';
import ErrorNotice from '../../shared/ErrorNotice.jsx';
import JobProgress from '../../shared/JobProgress.jsx';
import StepCard from './StepCard.jsx';

/**
 * Settings screen: problems found by the scanner (one click to add the fix), the ordered steps, and a live
 * preview of what the steps would change in the first rows.
 */
export default function CleanerConfig({ source, steps, scan, preview, canRun, onAdd, onAddFix, onAddAll, onChangeStep, onRemoveStep, onMoveStep, onRun }) {
  const [pick, setPick] = useState(null);
  const { suggestions } = scan;

  return (
    <div className="cleaner">
      <div className="card cleaner__section">
        <div className="cleaner__head">
          <div><h2>Problems found</h2><p className="muted">Checked every cell of “{source.dataset.fileName}” for common mess.</p></div>
          <SourcePicker source={source} label="File to clean" />
        </div>
        {scan.status === 'running' && (
          <JobProgress variant="inline" title="Looking for problems" stages={['Scanning for problems']} unit="columns" progress={scan.progress} elapsedMs={scan.elapsedMs} etaMs={scan.etaMs} onCancel={scan.cancel} />
        )}
        <ErrorNotice error={scan.error} onDismiss={scan.dismiss} />
        {scan.status === 'done' && (suggestions.length ? (
          <>
            <ul className="suggestions">
              {suggestions.map((s) => (
                <li key={`${s.opId}|${s.column}`}>
                  <Sparkles size={14} className="text-brand" aria-hidden="true" />
                  <span>{s.message}</span>
                  <Button label="Add fix" size="small" outlined onClick={() => onAddFix(s)} />
                </li>
              ))}
            </ul>
            <Button label="Add all suggested fixes" size="small" icon={<Plus size={14} />} onClick={onAddAll} className="cleaner__addall" />
          </>
        ) : <p className="muted">No common problems found. You can still add steps below.</p>)}
      </div>

      <div className="card cleaner__section">
        <div className="cleaner__head"><div><h2>Cleaning steps</h2><p className="muted">Steps run in this order. Each one sees the result of the one before.</p></div></div>
        {steps.length === 0 && <p className="muted">No steps yet. Add a suggested fix above, or choose an operation below.</p>}
        {steps.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            index={i}
            count={steps.length}
            dataset={source.dataset}
            onChange={(patch) => onChangeStep(step.id, patch)}
            onRemove={() => onRemoveStep(step.id)}
            onMove={(dir) => onMoveStep(step.id, dir)}
          />
        ))}
        <div className="cleaner__add">
          <Dropdown value={pick} options={OPERATION_GROUPS} optionLabel="label" optionValue="value" optionGroupLabel="label" optionGroupChildren="items"
            onChange={(e) => setPick(e.value)} placeholder="Add a step…" inputId="add-step" className="cleaner__pick" />
          <label htmlFor="add-step" className="sr-only">Add a step</label>
          <Button label="Add step" size="small" icon={<Plus size={14} />} disabled={!pick} onClick={() => { onAdd(pick); setPick(null); }} />
        </div>
      </div>

      <div className="card cleaner__section">
        <div className="cleaner__head"><div><h2>Preview</h2><p className="muted">What the steps would change in the first {preview.rowsPreviewed.toLocaleString()} rows. Nothing is changed in your file.</p></div></div>
        {preview.rows.length === 0 ? (
          <p className="muted">{canRun ? 'These steps would not change anything in the first rows.' : 'Add a step and choose its columns to see a preview.'}</p>
        ) : (
          <table className="members">
            <thead><tr><th className="num">Row</th><th>Column</th><th>Before</th><th>After</th></tr></thead>
            <tbody>
              {preview.rows.map((r, i) => (
                <tr key={i}>
                  <td className="num">{r.rowNum}</td><td>{r.column}</td>
                  <td><span className="cell muted" title={r.before}>{r.before || '(blank)'}</span></td>
                  <td><span className="cell" title={r.after}><strong>{r.after || '(blank)'}</strong></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {preview.total > preview.rows.length && <p className="muted">…and {(preview.total - preview.rows.length).toLocaleString()} more changes in these rows.</p>}
      </div>

      <div className="config__foot card">
        <p className="hint">Your original file is never modified. You review the result first, then download a cleaned copy with a change log.</p>
        <Button label="Clean data" size="small" icon={<Play size={14} />} disabled={!canRun} onClick={onRun} />
      </div>
    </div>
  );
}
