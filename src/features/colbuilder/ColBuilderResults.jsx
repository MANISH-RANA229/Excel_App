import { useMemo } from 'react';
import { Button } from '../../components/ui/index.js';
import { RotateCcw } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { OPS } from '../../core/columns/operations.js';
import { formatDuration } from '../../core/format.js';
import ExportButton from '../../shared/results/ExportButton.jsx';
import KpiStrip from '../../shared/results/KpiStrip.jsx';
import ResultGrid from '../../shared/results/ResultGrid.jsx';
import { buildBuilderExport } from './exportSpec.js';
import { usedColumns } from './table.js';

export default function ColBuilderResults({ result, ctx, ms, onRestart }) {
  const { ds, steps = [] } = ctx || {};
  const { added = [], stats = [] } = result || {};
  const failed = stats.reduce((n, s) => n + (s?.failed ?? 0), 0);

  // the grid shows the row number, the columns the steps read, and the new columns (the download has everything)
  const table = useMemo(() => {
    if (!ds) return { rowCount: 0, columns: [] };
    const used = usedColumns(ds, steps);
    return {
      rowCount: ds.rowCount ?? 0,
      columns: [
        { header: 'Row', nums: ds.rowNums },
        ...used.map((c) => {
          const i = ds.columns ? ds.columns.indexOf(c) : -1;
          return {
            header: c,
            text: i >= 0 && ds.text ? ds.text[i] : [],
            nums: i >= 0 && ds.nums ? (ds.nums[i] ?? undefined) : undefined,
            numFmt: i >= 0 && ds.formats ? (ds.formats[i] ?? undefined) : undefined,
          };
        }),
        ...added.map((a) => ({ header: a.name, text: a.text, nums: a.nums ?? undefined, numFmt: a.format ?? undefined })),
      ],
    };
  }, [ds, steps, added]);

  const fileName = ds?.fileName ?? 'File';
  const sheetName = ds?.sheet ?? 'Sheet';

  return (
    <div className="page">
      <PageHeader
        title="New columns"
        subtitle={`${fileName} · ${sheetName} · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="Start again" size="sm" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton label="Download Excel" buildSpec={() => buildBuilderExport(result, { ds, steps })} />
          </>
        )}
      />
      <div className="card summary">
        <KpiStrip items={[['Rows', (ds?.rowCount ?? 0).toLocaleString()], ['New columns', added.length.toLocaleString()], ['Cells that could not be worked out', failed.toLocaleString()]]} />
        <div className="dist">
          <table className="members">
            <thead><tr><th>New column</th><th>What it does</th><th className="num">Blank</th><th className="num">Could not work out</th></tr></thead>
            <tbody>
              {added.map((a, i) => (
                <tr key={a.name}>
                  <td><strong>{a.name}</strong></td><td>{OPS[steps[i]?.op]?.label ?? 'Custom'}</td>
                  <td className="num">{(stats[i]?.blank ?? 0).toLocaleString()}</td>
                  <td className="num">{stats[i]?.failed ? <strong>{(stats[i].failed).toLocaleString()}</strong> : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {failed > 0 && <small className="muted">Cells that could not be worked out are left blank, and marked red in the download. Look for text in a date or number column.</small>}
        </div>
      </div>
      <div className="card table-card">
        <ResultGrid table={table} searchLabel="Search the columns shown" />
      </div>
    </div>
  );
}
