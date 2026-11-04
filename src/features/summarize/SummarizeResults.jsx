import { Button } from '../../components/ui/index.js';
import { RotateCcw } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { formatDuration } from '../../core/format.js';
import ExportButton from '../../shared/results/ExportButton.jsx';
import KpiStrip from '../../shared/results/KpiStrip.jsx';
import ResultGrid from '../../shared/results/ResultGrid.jsx';
import { describeConfig } from './config.js';
import { buildSummarizeExport } from './exportSpec.js';

const TITLES = { group: 'Summary', unpivot: 'Columns turned into rows', transpose: 'Rows and columns swapped' };

export default function SummarizeResults({ result, ctx, ms, onRestart }) {
  const { ds, config } = ctx || {};
  const { table = { rowCount: 0, columns: [] }, stats = {}, mode = 'group' } = result || {};
  const n = (v) => (v ?? 0).toLocaleString();

  const kpis = mode === 'group'
    ? [['Rows read', n(stats.rows)], ['Groups', n(stats.groups)], ...(stats.acrossValues ? [['Columns across', n(stats.acrossValues)]] : []), ['Rows in result', n(table.rowCount)]]
    : mode === 'unpivot'
      ? [['Rows read', n(stats.rows)], ['Rows created', n(stats.outRows)], ['Blank cells skipped', n(stats.blanksSkipped)]]
      : [['Rows read', n(stats.rows)], ['Rows in result', n(stats.outRows)], ['Columns in result', n(table.columns.length)]];
  const notes = [
    ...(stats.notNumeric ?? []).map((x) => `${n(x.count)} cell${x.count === 1 ? '' : 's'} in “${x.header}” ${x.count === 1 ? 'is' : 'are'} not a number and ${x.count === 1 ? 'was' : 'were'} skipped.`),
    ...(stats.notes ?? []),
  ];

  const fileName = ds?.fileName ?? 'File';
  const sheetName = ds?.sheet ?? 'Sheet';

  return (
    <div className="page">
      <PageHeader
        title={TITLES[mode] ?? 'Summary'}
        subtitle={`${fileName} · ${sheetName} · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="Start again" size="sm" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton label="Download Excel" buildSpec={() => buildSummarizeExport(result, { ds, description: describeConfig(config) })} />
          </>
        )}
      />
      <div className="card summary">
        <KpiStrip items={kpis} />
        {notes.length > 0 && <div className="dist">{notes.map((t) => <small key={t} className="muted">{t}</small>)}</div>}
      </div>
      <div className="card table-card">
        <ResultGrid table={table} />
      </div>
    </div>
  );
}
