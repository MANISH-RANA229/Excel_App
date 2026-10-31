import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { ArrowRight, Play, Plus, X } from 'lucide-react';
import ColumnField from '../../shared/fields/ColumnField.jsx';
import NumberInput from '../../shared/fields/NumberInput.jsx';
import { comparedColumns, sharedColumns } from './config.js';

const MAX_KEYS = 5;

export default function KeyCompareConfig({ datasets: [a, b], config, problem, onChange, onRun }) {
  const set = (patch) => onChange({ ...config, ...patch });
  const setKey = (i, patch) => set({ keys: config.keys.map((k, j) => (j === i ? { ...k, ...patch } : k)) });
  const setKeyNormalize = (patch) => set({ keyNormalize: { ...config.keyNormalize, ...patch } });
  const setValues = (patch) => set({ values: { ...config.values, ...patch } });

  const usedA = config.keys.map((k) => k.a);
  const usedB = config.keys.map((k) => k.b);
  const selectable = sharedColumns(a, b).filter((s) => !usedA.includes(s.colA) && !usedB.includes(s.colB));
  const compared = comparedColumns(config, a, b);
  const toggle = (name, on) => set({ skipped: on ? config.skipped.filter((n) => n !== name) : [...config.skipped, name] });

  return (
    <div className="card config">
      <div className="config__grid">
        <div className="field span-2">
          <span className="config__section-title">Key — rows with the same key are the same record</span>
          {config.keys.map((k, i) => (
            <div className="key-row" key={i}>
              <ColumnField label={config.keys.length > 1 ? `Excel 1 (old) · key ${i + 1}` : 'Excel 1 (old)'} dataset={a} value={k.a} onChange={(v) => setKey(i, { a: v })} />
              <ArrowRight size={14} className="key-row__link" aria-hidden="true" />
              <ColumnField label={config.keys.length > 1 ? `Excel 2 (new) · key ${i + 1}` : 'Excel 2 (new)'} dataset={b} value={k.b} onChange={(v) => setKey(i, { b: v })} />
              {config.keys.length > 1 ? (
                <Button icon={<X size={14} />} text severity="secondary" size="small" aria-label={`Remove key column ${i + 1}`} onClick={() => set({ keys: config.keys.filter((_, j) => j !== i) })} />
              ) : <span />}
            </div>
          ))}
          {config.keys.length < MAX_KEYS && (
            <div><Button label="Add another key column" icon={<Plus size={14} />} text size="small" onClick={() => set({ keys: [...config.keys, { a: null, b: null }] })} /></div>
          )}
          <small className="muted">Use more than one column when no single column is unique, e.g. Order no. + Line no.</small>
        </div>

        <div className="field span-2">
          <span>Columns to compare <em>({compared.length} of {selectable.length}, columns with the same name in both files)</em></span>
          {selectable.length ? (
            <>
              <div className="col-picks">
                {selectable.map((s) => (
                  <label key={s.name} className="check">
                    <Checkbox checked={!config.skipped.includes(s.name)} onChange={(e) => toggle(s.name, e.checked)} />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
              <div>
                <Button label="All" text size="small" onClick={() => set({ skipped: [] })} />
                <Button label="None" text size="small" onClick={() => set({ skipped: selectable.map((s) => s.name) })} />
              </div>
            </>
          ) : <small className="muted">The files have no other column with the same name, so only added and removed keys can be found.</small>}
        </div>
      </div>

      <div className="config__grid cmp-options">
        <div className="field">
          <span>Keys: ignore when matching</span>
          <label className="check"><Checkbox checked={config.keyNormalize.ignoreCase} onChange={(e) => setKeyNormalize({ ignoreCase: e.checked })} /><span>Upper / lower case</span></label>
          <label className="check"><Checkbox checked={config.keyNormalize.collapseSpaces} onChange={(e) => setKeyNormalize({ collapseSpaces: e.checked })} /><span>Extra spaces</span></label>
          <label className="check"><Checkbox checked={config.keyNormalize.ignorePunctuation} onChange={(e) => setKeyNormalize({ ignorePunctuation: e.checked })} /><span>Punctuation (INV-001 = INV001)</span></label>
        </div>
        <div className="field">
          <span>Values: ignore when comparing</span>
          <label className="check"><Checkbox checked={config.values.trim} onChange={(e) => setValues({ trim: e.checked })} /><span>Spaces at the start / end</span></label>
          <label className="check"><Checkbox checked={config.values.ignoreCase} onChange={(e) => setValues({ ignoreCase: e.checked })} /><span>Upper / lower case</span></label>
        </div>
        <label className="field">
          <span>Numbers count as equal when they differ by up to</span>
          <NumberInput label="number tolerance" value={config.tolerance} onValueChange={(e) => set({ tolerance: e.value ?? 0 })} min={0} minFractionDigits={0} maxFractionDigits={4} step={0.01} inputClassName="num-input cmp-tol" />
        </label>
        <div className="field">
          <span>Download</span>
          <label className="check"><Checkbox checked={config.includeSame} onChange={(e) => set({ includeSame: e.checked })} /><span>Also include the unchanged rows</span></label>
        </div>
      </div>

      <div className="config__foot">
        {problem ? <p className="field-error" role="alert">{problem}</p> : <p className="hint">Excel 1 is treated as the old version and Excel 2 as the new one. Rows without a key are never matched.</p>}
        <Button label="Compare" size="small" icon={<Play size={14} />} disabled={!!problem} onClick={onRun} />
      </div>
    </div>
  );
}
