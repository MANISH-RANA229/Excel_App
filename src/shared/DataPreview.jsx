import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';

export default function DataPreview({ columns, rows, rowNums, count = 5 }) {
  const value = rows.slice(0, count).map((r, i) => ({ ...r, __row: rowNums[i] }));
  return (
    <DataTable value={value} size="small" scrollable showGridlines className="grid-table preview-table">
      <Column field="__row" header="" className="rownum" headerClassName="rownum" />
      {columns.map((c) => (
        <Column key={c} field={c} header={c} body={(r) => <span className="cell" title={r[c]}>{r[c]}</span>} />
      ))}
    </DataTable>
  );
}
