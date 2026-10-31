import { useRef, useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { ProgressSpinner } from 'primereact/progressspinner';
import { FileSpreadsheet, FileUp, X } from 'lucide-react';
import { detectHeaderRow, readWorkbook, toTable } from './readWorkbook.js';
import DataPreview from './DataPreview.jsx';

const ACCEPT = '.xlsx,.xls,.csv';

// Selects a sheet + header row and derives its table in one step.
function withSheet(wb, sheet, headerRow = detectHeaderRow(wb.sheets[sheet])) {
  return { ...wb, sheet, headerRow, table: toTable(wb.sheets[sheet], headerRow) };
}

/** Upload slot for one spreadsheet. value = { fileName, sheets, sheet, headerRow, table } | null */
export default function FileDropCard({ label, value, onChange }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  async function load(file) {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError('Please choose a .xlsx, .xls or .csv file.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const wb = await readWorkbook(file);
      const names = Object.keys(wb.sheets);
      onChange(withSheet(wb, names.find((n) => wb.sheets[n].matrix.length > 1) ?? names[0]));
    } catch (e) {
      setError(`Could not read this file: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  const input = (
    <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(e) => { load(e.target.files[0]); e.target.value = ''; }} />
  );

  if (!value) {
    return (
      <div className="card file-card">
        <div className="card__label">{label}</div>
        <button
          type="button"
          className={`dropzone${dragging ? ' is-dragging' : ''}`}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); load(e.dataTransfer.files[0]); }}
          disabled={loading}
        >
          {loading ? <ProgressSpinner style={{ width: 28, height: 28 }} strokeWidth="5" /> : <FileUp size={24} aria-hidden="true" />}
          <span className="dropzone__title">{loading ? 'Reading file…' : 'Drop a file or click to browse'}</span>
          <span className="dropzone__hint">.xlsx · .xls · .csv</span>
        </button>
        {input}
        {error && <Message severity="error" text={error} className="w-full" />}
      </div>
    );
  }

  const sheet = value.sheets[value.sheet];
  const { columns, rows } = value.table;

  return (
    <div className="card file-card">
      <div className="file-card__head">
        <FileSpreadsheet size={18} className="text-brand" aria-hidden="true" />
        <div className="file-card__name">
          <span className="card__label">{label}</span>
          <strong title={value.fileName}>{value.fileName}</strong>
        </div>
        <span className="file-card__meta">{rows.length.toLocaleString()} rows · {columns.length} cols</span>
        <Button text rounded size="small" severity="secondary" aria-label={`Remove ${label}`} icon={<X size={16} />} onClick={() => onChange(null)} />
      </div>
      <div className="file-card__controls">
        <label className="field">
          <span>Sheet</span>
          <Dropdown value={value.sheet} options={Object.keys(value.sheets)} onChange={(e) => onChange(withSheet(value, e.value))} className="w-full" />
        </label>
        <label className="field field--narrow">
          <span>Header row</span>
          <InputNumber
            value={value.headerRow}
            onValueChange={(e) => e.value && onChange(withSheet(value, value.sheet, e.value))}
            min={sheet.firstRow}
            max={sheet.firstRow + Math.max(0, sheet.matrix.length - 1)}
            showButtons
            buttonLayout="horizontal"
            inputClassName="num-input"
          />
        </label>
      </div>
      {rows.length ? (
        <DataPreview columns={columns} rows={rows} rowNums={value.table.rowNums} />
      ) : (
        <Message severity="warn" text="No data rows below the header row." className="w-full" />
      )}
      {input}
    </div>
  );
}
