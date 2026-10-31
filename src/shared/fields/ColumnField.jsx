import { Dropdown } from 'primereact/dropdown';
import { sampleValues } from '../../core/dataset/dataset.js';

/** Pick one column of a dataset; shows a few sample values so the user can tell columns apart. */
export default function ColumnField({ label, dataset, value, onChange, samples = true, error, placeholder = 'Select a column', hint, clearable = false }) {
  const examples = samples && value ? sampleValues(dataset, value, 4) : [];
  return (
    <label className="field">
      <span>{label}</span>
      <Dropdown
        value={value}
        options={dataset.columns}
        onChange={(e) => onChange(e.value ?? null)}
        placeholder={placeholder}
        showClear={clearable}
        filter
        className={`w-full${error ? ' p-invalid' : ''}`}
      />
      {examples.length > 0 && <p className="samples clip" title={examples.join(', ')}>e.g. {examples.join(' · ')}</p>}
      {hint && <small className="muted">{hint}</small>}
      {error && <small className="field-error" role="alert">{error}</small>}
    </label>
  );
}
