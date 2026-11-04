import { useState } from 'react';
import { Button, Checkbox, Dropdown } from '../../components/ui/index.js';
import { Play, Plus } from 'lucide-react';
import { OPERATION_GROUPS } from '../../core/columns/operations.js';
import SourcePicker from '../../shared/fields/SourcePicker.jsx';
import BuilderStepCard from './BuilderStepCard.jsx';

const PREVIEW_SHOWN = 10;
const PREVIEW_SOURCE_COLUMNS = 4;

function Preview({ preview, ds }) {
  const cols = preview.used.slice(0, PREVIEW_SOURCE_COLUMNS).map((c) => ds.columns.indexOf(c));
  const shown = Math.min(PREVIEW_SHOWN, preview.rows);
  return (
    <div className="preview-scroll">
      <table className="members">
        <thead>
          <tr>
            <th className="num">Row</th>
            {cols.map((c) => <th key={c}>{ds.columns[c]}</th>)}
            {preview.added.map((a) => <th key={a.name} className="is-new">{a.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: shown }, (_, r) => (
            <tr key={r}>
              <td className="num">{ds.rowNums[r]}</td>
              {cols.map((c) => <td key={c}>{ds.text[c][r]}</td>)}
              {preview.added.map((a) => (a.failed?.[r]
                ? <td key={a.name} className="is-failed" title="Could not be worked out">can’t work out</td>
                : <td key={a.name} className="is-new" title={a.text[r]}><strong>{a.text[r]}</strong></td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Settings screen: the file, how to read dates and numbers, the ordered new-column steps, and a live preview. */
export default function ColBuilderConfig({ source, steps, names, problems, settings, preview, canRun, onSettings, onAdd, onChangeStep, onRemoveStep, onMoveStep, onRun }) {
  const [pick, setPick] = useState(null);
  const ds = source.dataset;
  return (
    <div className="cleaner">
      <div className="cleaner__grid">
        <div className="cleaner__col cleaner__col--config">
          <div className="card cleaner__section">
            <div className="cleaner__head">
              <div><h2>File</h2><p className="muted">New columns are added to the right of “{ds.fileName}”. Your original columns and file are not changed.</p></div>
              <SourcePicker source={source} label="File to add columns to" />
            </div>
            <div className="cb-settings">
              <label className="check"><Checkbox checked={settings.dayFirst} onChange={(e) => onSettings({ ...settings, dayFirst: e.checked })} /><span>Read dates typed like 05/03/2024 as 5 March (day first)</span></label>
              <label className="check"><Checkbox checked={settings.decimal === ','} onChange={(e) => onSettings({ ...settings, decimal: e.checked ? ',' : '.' })} /><span>Numbers stored as text use a decimal comma (1.234,50)</span></label>
            </div>
          </div>

          <div className="card cleaner__section">
            <div className="cleaner__head"><div><h2>New columns</h2><p className="muted">Each step adds one column. A step can use the columns made by the steps above it.</p></div></div>
            {steps.length === 0 && <p className="muted">No columns yet. Choose what to work out below, for example “Join columns” or “Part of a date”.</p>}
            {steps.map((step, i) => (
              <BuilderStepCard
                key={step.id}
                step={step}
                index={i}
                count={steps.length}
                available={[...ds.columns, ...names.slice(0, i)]}
                finalName={names[i]}
                problem={problems[i]}
                onChange={(patch) => onChangeStep(step.id, patch)}
                onRemove={() => onRemoveStep(step.id)}
                onMove={(dir) => onMoveStep(step.id, dir)}
              />
            ))}
            <div className="cleaner__add">
              <Dropdown value={pick} options={OPERATION_GROUPS} optionLabel="label" optionValue="value" optionGroupLabel="label" optionGroupChildren="items"
                onChange={(e) => setPick(e.value)} placeholder="Add a column…" inputId="add-column" className="cleaner__pick" filter />
              <label htmlFor="add-column" className="sr-only">Add a column</label>
              <Button label="Add column" size="sm" icon={<Plus size={14} />} disabled={!pick} onClick={() => { onAdd(pick); setPick(null); }} />
            </div>
          </div>
        </div>

        <div className="cleaner__col cleaner__col--preview">
          <div className="card cleaner__section cleaner__preview-card">
            <div className="cleaner__head"><div><h2>Preview</h2><p className="muted">The new columns for the first {preview ? Math.min(PREVIEW_SHOWN, preview.rows) : PREVIEW_SHOWN} rows. Nothing is changed in your file.</p></div></div>
            {preview ? <Preview preview={preview} ds={ds} /> : <p className="muted">{steps.length ? 'Finish the steps above to see a preview.' : 'Add a column to see a preview.'}</p>}
          </div>
        </div>
      </div>

      <div className="config__foot card">
        <p className="hint">You get your sheet back with the new columns added at the end, plus a Steps sheet that says how each one was made.</p>
        <Button label="Build columns" size="sm" icon={<Play size={14} />} disabled={!canRun} onClick={onRun} />
      </div>
    </div>
  );
}
