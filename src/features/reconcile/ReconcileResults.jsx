import { useDeferredValue, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { columnIndex, columnTexts } from '../../core/dataset/dataset.js';
import { formatDuration } from '../../core/format.js';
import ExportButton from '../../shared/results/ExportButton.jsx';
import GridTable from '../../shared/results/GridTable.jsx';
import KpiStrip from '../../shared/results/KpiStrip.jsx';
import StatusChips from '../../shared/results/StatusChips.jsx';
import { describeConfig } from './config.js';
import { buildReconcileExport } from './exportSpec.js';
import { GROUPS, PASS_LABELS, STATUSES } from './status.js';
import { money, summarizeRecon } from './summary.js';

const MAX_LINES_SHOWN = 25;

/** Expanded item: the lines each file contributed (one each in line mode, many in "total per reference"). */
function Lines({ i, result, ctx }) {
  const block = (label, ds, cfg, start, rows, amounts) => {
    const all = Array.from(result[rows].subarray(result[start][i], result[start][i + 1]));
    if (!all.length) return <div><span className="wd__key">{label}</span><span className="muted">no rows</span></div>;
    const shown = all.slice(0, MAX_LINES_SHOWN);
    return (
      <div>
        <span className="wd__key">{label}</span>
        <table className="members">
          <thead><tr><th className="num">Row</th>{cfg.key && <th>Reference</th>}<th className="num">Amount</th>{cfg.date && <th>Date</th>}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r}>
                <td className="num">{ds.rowNums[r]}</td>
                {cfg.key && <td>{ds.text[columnIndex(ds, cfg.key)][r]}</td>}
                <td className="num">{money(amounts[r])}</td>
                {cfg.date && <td>{ds.text[columnIndex(ds, cfg.date)][r]}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {all.length > shown.length && <span className="muted">… and {(all.length - shown.length).toLocaleString()} more lines</span>}
      </div>
    );
  };
  return (
    <div className="wd">
      <div className="wd__texts">
        {block('Excel 1', ctx.a, ctx.config.a, 'startA', 'rowsA', result.amountA)}
        {block('Excel 2', ctx.b, ctx.config.b, 'startB', 'rowsB', result.amountB)}
      </div>
    </div>
  );
}

export default function ReconcileResults({ result, ctx, ms, onEdit, onRestart }) {
  const { a, b, config } = ctx;
  const [group, setGroup] = useState(null);
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());
  const summary = useMemo(() => summarizeRecon(result), [result]);
  const g = summary.groups;
  const keyA = config.a.key ? columnTexts(a, config.a.key) : null;
  const keyB = config.b.key ? columnTexts(b, config.b.key) : null;

  const refOf = (i) => (keyA && result.repA[i] >= 0 ? keyA[result.repA[i]] : keyB && result.repB[i] >= 0 ? keyB[result.repB[i]] : '');
  const accept = (i) => (group == null || STATUSES[result.status[i]].group === group) && (!query || refOf(i).toLowerCase().includes(query));
  const getRow = (i) => ({
    i, status: result.status[i], ref: refOf(i), how: PASS_LABELS[result.pass[i]] ?? '',
    aRow: result.repA[i] >= 0 ? a.rowNums[result.repA[i]] : null, aAmount: result.sumA[i],
    bRow: result.repB[i] >= 0 ? b.rowNums[result.repB[i]] : null, bAmount: result.sumB[i], diff: result.diff[i],
    lines: config.mode === 'sum' ? `${result.countA[i]} / ${result.countB[i]}` : '',
  });
  const amountCell = (key) => (r) => <span className="num">{money(r[key])}</span>;
  const columns = [
    { expander: true, className: 'col-expander' },
    { field: 'status', header: 'Status', sortable: true, className: 'col-status', body: (r) => { const s = STATUSES[r.status]; return <span className="band-tag" style={{ background: s.bg, color: s.fg }}><strong>{s.label}</strong></span>; } },
    { field: 'ref', header: 'Reference', sortable: true, body: (r) => <span className="cell" title={r.ref}>{r.ref || <span className="muted">—</span>}</span> },
    { field: 'aRow', header: 'Excel 1 row', sortable: true, className: 'rownum', body: (r) => r.aRow ?? '—' },
    { field: 'aAmount', header: 'Excel 1 amount', sortable: true, className: 'num', body: amountCell('aAmount') },
    { field: 'bRow', header: 'Excel 2 row', sortable: true, className: 'rownum', body: (r) => r.bRow ?? '—' },
    { field: 'bAmount', header: 'Excel 2 amount', sortable: true, className: 'num', body: amountCell('bAmount') },
    { field: 'diff', header: 'Difference', sortable: true, className: 'num', body: (r) => <span className={`num${r.diff ? ' is-diff' : ''}`}>{money(r.diff)}</span> },
    ...(config.mode === 'sum' ? [{ field: 'lines', header: 'Lines 1 / 2', className: 'rownum' }] : []),
    { field: 'how', header: 'How matched', sortable: true, body: (r) => <span className="cell muted" title={r.how}>{r.how}</span> },
  ];
  const sorters = {
    status: (i) => result.status[i], ref: refOf, how: (i) => result.pass[i],
    aRow: (i) => (result.repA[i] >= 0 ? a.rowNums[result.repA[i]] : 2 ** 31), bRow: (i) => (result.repB[i] >= 0 ? b.rowNums[result.repB[i]] : 2 ** 31),
    aAmount: (i) => (Number.isNaN(result.sumA[i]) ? -Infinity : result.sumA[i]), bAmount: (i) => (Number.isNaN(result.sumB[i]) ? -Infinity : result.sumB[i]),
    diff: (i) => (Number.isNaN(result.diff[i]) ? -Infinity : Math.abs(result.diff[i])),
  };

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference" aria-label="Search reference" className="p-inputtext-sm w-full" />
      </IconField>
      {group && (
        <button type="button" className="filter-chip" onClick={() => setGroup(null)}>
          {GROUPS.find((x) => x.key === group).label} <X size={12} aria-label="Clear filter" />
        </button>
      )}
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} {config.mode === 'sum' ? 'references' : 'items'}</span>
    </div>
  );

  const both = (x) => `${x.count.toLocaleString()} · ${money(x.sumA || x.sumB)}`;
  return (
    <div className="page">
      <PageHeader
        title="Reconciliation results"
        subtitle={`${a.fileName} ↔ ${b.fileName} · ${config.mode === 'sum' ? 'total per reference' : 'line by line'} · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="Settings" size="small" outlined severity="secondary" icon={<SlidersHorizontal size={14} />} onClick={onEdit} />
            <Button label="New reconciliation" size="small" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton
              label="Download report"
              buildSpec={() => buildReconcileExport(result, { a, b, cfgA: config.a, cfgB: config.b, mode: config.mode, description: describeConfig(config) })}
            />
          </>
        )}
      />

      <div className="card summary">
        <KpiStrip
          items={[
            ['Matched', both(g.matched)],
            ['Probable', both(g.probable)],
            ['Differences', `${g.difference.count.toLocaleString()} · net ${money(g.difference.net)}`],
            ['Only in Excel 1', both(g.onlyA)],
            ['Only in Excel 2', both(g.onlyB)],
            ['Unreconciled (1 − 2)', money(summary.unreconciled)],
          ]}
        />
        <div className="dist">
          <StatusChips
            label="Filter by outcome"
            active={group}
            onSelect={setGroup}
            items={GROUPS.map((x) => ({ key: x.key, label: x.label, count: g[x.key].count, color: x.color }))}
          />
          {(summary.totals.noAmountA > 0 || summary.totals.noAmountB > 0) && (
            <small className="muted">Rows with no readable amount cannot be matched: Excel 1 {summary.totals.noAmountA.toLocaleString()} · Excel 2 {summary.totals.noAmountB.toLocaleString()}.</small>
          )}
        </div>
      </div>

      <div className="card table-card">
        <GridTable
          count={result.n}
          getRow={getRow}
          columns={columns}
          accept={accept}
          filterKey={`${group}|${query}`}
          sorters={sorters}
          expansion={(r) => <Lines i={r.i} result={result} ctx={ctx} />}
          toolbar={toolbar}
          className="recon-table"
        />
      </div>
    </div>
  );
}
