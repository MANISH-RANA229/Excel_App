import { useMemo } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { rowPreview } from '../core/dataset/dataset.js';

export default function DataPreview({ dataset, count = 5 }) {
  const value = useMemo(
    () => Array.from({ length: Math.min(count, dataset.rowCount) }, (_, r) => ({ ...rowPreview(dataset, r), __row: dataset.rowNums[r] })),
    [dataset, count],
  );
  return (
    <DataTable value={value} size="small" scrollable showGridlines className="grid-table preview-table">
      <Column field="__row" header="#" className="rownum" headerClassName="rownum" />
      {dataset.columns.map((c) => (
        <Column key={c} field={c} header={c} body={(r) => <span className="cell" title={r[c]}>{r[c]}</span>} />
      ))}
    </DataTable>
  );
}
