import { useDeferredValue, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { RotateCcw, Search } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { formatDuration } from '../../core/format.js';
import ExportButton from '../../shared/results/ExportButton.jsx';
import GridTable from '../../shared/results/GridTable.jsx';
import KpiStrip from '../../shared/results/KpiStrip.jsx';
import { buildCleanerExport, describeStat, stepLabel } from './exportSpec.js';

export default function CleanerResults({ result, ctx, ms, onRestart }) {
  const { ds, steps } = ctx;
  const { names, log, stats, totals } = result;
  const [highlight, setHighlight] = useState(true);
  const [column, setColumn] = useState(null);
  const [stepNo, setStepNo] = useState(null);
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());
  const shown = log.row.length;

  const columnOptions = useMemo(() => [{ label: 'All columns', value: null }, ...[...new Set(log.col)].sort((a, b) => a - b).map((c) => ({ label: names[c], value: c }))], [log, names]);
  const stepOptions = useMemo(() => [{ label: 'All steps', value: null }, ...[...new Set(log.step)].sort((a, b) => a - b).map((s) => ({ label: stepLabel(steps[s], s), value: s }))], [log, steps]);

  const accept = (i) =>
    (column == null || log.col[i] === column) &&
    (stepNo == null || log.step[i] === stepNo) &&
    (!query || log.before[i].toLowerCase().includes(query) || log.after[i].toLowerCase().includes(query));
  const getRow = (i) => ({
    rowNum: ds.rowNums[log.row[i]], column: names[log.col[i]], before: log.before[i], after: log.after[i], step: stepLabel(steps[log.step[i]], log.step[i]),
  });
  const cell = (key, extra = '') => (r) => <span className={`cell ${extra}`} title={r[key]}>{r[key] === '' ? '(blank)' : r[key]}</span>;
  const columns = [
    { field: 'rowNum', header: 'Row', sortable: true, className: 'rownum' },
    { field: 'column', header: 'Column', sortable: true },
    { field: 'before', header: 'Before', sortable: true, body: cell('before', 'muted') },
    { field: 'after', header: 'After', sortable: true, body: (r) => <strong>{cell('after')(r)}</strong> },
    { field: 'step', header: 'Step', sortable: true, body: cell('step') },
  ];
  const sorters = {
    rowNum: (i) => ds.rowNums[log.row[i]], column: (i) => names[log.col[i]], before: (i) => log.before[i],
    after: (i) => log.after[i], step: (i) => log.step[i],
  };

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search before / after" aria-label="Search changes" className="p-inputtext-sm w-full" />
      </IconField>
      <Dropdown value={column} options={columnOptions} onChange={(e) => setColumn(e.value)} placeholder="All columns" className="toolbar__select" aria-label="Filter by column" />
      <Dropdown value={stepNo} options={stepOptions} onChange={(e) => setStepNo(e.value)} placeholder="All steps" className="toolbar__select toolbar__select--wide" aria-label="Filter by step" />
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} changes</span>
    </div>
  );

  const nothing = totals.changed === 0 && totals.rowsRemoved === 0 && totals.columnsRemoved === 0;

  return (
    <div className="page">
      <PageHeader
        title="Data Cleaner results"
        subtitle={`${ds.fileName} · ${steps.length} ${steps.length === 1 ? 'step' : 'steps'} · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="Clean another" size="small" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton label="Download cleaned file" disabled={nothing} buildSpec={() => buildCleanerExport(result, ctx, { highlight })} />
          </>
        )}
      />

      <div className="card summary">
        <KpiStrip
          items={[
            ['Cells changed', totals.changed.toLocaleString()],
            ['Left as they were', totals.failed.toLocaleString()],
            ['Rows removed', totals.rowsRemoved.toLocaleString()],
            ['Columns removed', totals.columnsRemoved.toLocaleString()],
            ['Rows in file', `${(ds.rowCount - totals.rowsRemoved).toLocaleString()}`],
          ]}
        />
      </div>

      {nothing && <Message severity="info" className="w-full" text="These steps did not change anything. Your data already looks clean for them." />}

      <div className="card cleaner__section">
        <div className="cleaner__head"><div><h2>What each step did</h2></div></div>
        <ol className="step-summary">
          {steps.map((s, i) => (
            <li key={i}><strong>{stepLabel(s, i)}</strong><span className="muted">{describeStat(s, stats[i])}</span></li>
          ))}
        </ol>
        <label className="check">
          <Checkbox checked={highlight} onChange={(e) => setHighlight(e.checked)} />
          <span>Highlight changed cells in yellow in the downloaded file</span>
        </label>
      </div>

      {log.count > shown && <Message severity="info" className="w-full" text={`Showing the first ${shown.toLocaleString()} of ${log.count.toLocaleString()} changes. The downloaded file has every change applied; its Change log sheet has the same limit.`} />}

      {shown > 0 && (
        <div className="card table-card">
          <GridTable
            count={shown}
            getRow={getRow}
            columns={columns}
            accept={accept}
            filterKey={`${column}|${stepNo}|${query}`}
            sorters={sorters}
            toolbar={toolbar}
            emptyMessage="No changes match the filters."
            className="log-table"
          />
        </div>
      )}
    </div>
  );
}
