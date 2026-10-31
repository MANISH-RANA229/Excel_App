import { Button } from 'primereact/button';
import { RotateCcw } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { formatDuration } from '../../core/format.js';
import ExportButton from '../../shared/results/ExportButton.jsx';
import KpiStrip from '../../shared/results/KpiStrip.jsx';
import ResultGrid from '../../shared/results/ResultGrid.jsx';
import { notesOf } from './config.js';
import { buildCombineExport } from './exportSpec.js';

const MAX_NOTES = 6;

export default function CombineResults({ result, ms, onRestart }) {
  const { table, stats } = result;
  const notes = notesOf(stats);
  return (
    <div className="page">
      <PageHeader
        title="Combined result"
        subtitle={`${stats.sources.length} files and sheets · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="Start again" size="small" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton label="Download Excel" buildSpec={() => buildCombineExport(result)} />
          </>
        )}
      />
      <div className="card summary">
        <KpiStrip items={[['Files and sheets', stats.sources.length.toLocaleString()], ['Rows', stats.rows.toLocaleString()], ['Columns', table.columns.length.toLocaleString()]]} />
        {notes.length > 0 && (
          <div className="dist">
            {notes.slice(0, MAX_NOTES).map((t) => <small key={t} className="muted">{t}</small>)}
            {notes.length > MAX_NOTES && <small className="muted">… and {notes.length - MAX_NOTES} more notes (all of them are in the downloaded file).</small>}
          </div>
        )}
      </div>
      <div className="card table-card">
        <ResultGrid table={table} />
      </div>
    </div>
  );
}
