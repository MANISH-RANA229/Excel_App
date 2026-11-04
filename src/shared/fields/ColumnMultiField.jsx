import { MultiSelect } from '../../components/ui/index.js';

/** Pick any number of columns of a dataset (shown as chips). `exclude` hides columns chosen elsewhere. */
export default function ColumnMultiField({ label, dataset, value, onChange, exclude = [], placeholder = 'None', error, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      <MultiSelect
        value={value}
        options={dataset.columns.filter((c) => !exclude.includes(c))}
        onChange={(e) => onChange(e.value)}
        placeholder={placeholder}
        display="chip"
        filter
        className={`w-full${error ? ' p-invalid' : ''}`}
      />
      {hint && <small className="muted">{hint}</small>}
      {error && <small className="field-error" role="alert">{error}</small>}
    </label>
  );
}
