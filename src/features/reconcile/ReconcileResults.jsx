import { useDeferredValue, useMemo, useState } from 'react';
import { Button, InputText } from '../../components/ui/index.js';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { RotateCcw, Search, X } from 'lucide-react';
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
    if (!ds || !result || !result[rows] || !result[start]) return null;
    const all = Array.from(result[rows].subarray(result[start][i], result[start][i + 1]));
    if (!all.length) return <div><span className="wd__key">{label}</span><span className="muted">no rows</span></div>;
    const shown = all.slice(0, MAX_LINES_SHOWN);
    return (
      <div>
        <span className="wd__key">{label}</span>
        <table className="members">
          <thead><tr><th className="num">Row</th><th>Reference</th><th className="num">Amount</th><th>Date</th></tr></thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row}>
                <td className="num">{ds?.rowNums?.[row] ?? (row + 1)}</td>
                <td><span className="cell clip" title={cfg?.key ? ds?.text?.[columnIndex(ds, cfg.key)]?.[row] : ''}>{cfg?.key ? ds?.text?.[columnIndex(ds, cfg.key)]?.[row] : '—'}</span></td>
                <td className="num">{amounts ? money(amounts[row]) : '—'}</td>
                <td>{cfg?.date ? ds?.text?.[columnIndex(ds, cfg.date)]?.[row] : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {all.length > MAX_LINES_SHOWN && <span className="muted">… and {all.length - MAX_LINES_SHOWN} more rows</span>}
      </div>
    );
  };
  return (
    <div className="wd wd__texts">
      {block('Excel 1 lines', ctx?.a, ctx?.config?.a, 'startA', 'rowsA', ctx?.amountsA)}
      {block('Excel 2 lines', ctx?.b, ctx?.config?.b, 'startB', 'rowsB', ctx?.amountsB)}
    </div>
  );
}

export default function ReconcileResults({ result, ctx, ms, onRestart }) {
  const { a, b, config = { mode: 'line' } } = ctx || {};
  const [group, setGroup] = useState(null);
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());

  const summary = useMemo(() => (result ? summarizeRecon(result) : {
    groups: { matched: { count: 0, sumA: 0, sumB: 0 }, probable: { count: 0, sumA: 0, sumB: 0 }, difference: { count: 0, net: 0 }, onlyA: { count: 0, sumA: 0 }, onlyB: { count: 0, sumB: 0 } },
    unreconciled: 0,
    totals: { noAmountA: 0, noAmountB: 0 },
  }), [result]);
  const g = summary.groups;

  const keyText = (i) => result?.keyA?.[i] || result?.keyB?.[i] || '';
  const accept = (i) => {
    if (group && result?.status && STATUSES[result.status[i]]?.group !== group) return false;
    if (!query) return true;
    return keyText(i).toLowerCase().includes(query);
  };

  const getRow = (i) => {
    const st = result?.status?.[i] ?? 0;
    const meta = STATUSES[st] || { label: 'Unknown', group: 'unknown', color: { bg: '#eee', fg: '#333' } };
    const diff = result?.diff?.[i] ?? 0;
    const rowA = result?.startA && result.startA[i + 1] - result.startA[i] === 1 ? (a?.rowNums?.[result.rowsA[result.startA[i]]] ?? result.rowsA[result.startA[i]]) : null;
    const rowB = result?.startB && result.startB[i + 1] - result.startB[i] === 1 ? (b?.rowNums?.[result.rowsB[result.startB[i]]] ?? result.rowsB[result.startB[i]]) : null;
    return {
      i,
      key: keyText(i),
      status: meta.label,
      statusGroup: meta.group,
      color: meta.color,
      pass: result?.pass ? (PASS_LABELS[result.pass[i]] ?? '') : '',
      amountA: result?.hasAmountA?.[i] ? money(result.amountA[i]) : '—',
      amountB: result?.hasAmountB?.[i] ? money(result.amountB[i]) : '—',
      diff: diff ? money(diff) : '—',
      rawDiff: diff,
      rowA,
      rowB,
      linesA: result?.startA ? result.startA[i + 1] - result.startA[i] : 0,
      linesB: result?.startB ? result.startB[i + 1] - result.startB[i] : 0,
    };
  };

  const columns = [
    { field: 'key', header: 'Reference', sortable: true, body: (r) => <span className="clip" title={r.key}><strong>{r.key || <span className="muted">(no reference)</span>}</strong></span> },
    {
      field: 'status', header: 'Status', sortable: true, className: 'col-status', style: { width: '1%' },
      body: (r) => <span className="band-tag" style={{ background: r.color.bg, color: r.color.fg }}>{r.status}</span>,
    },
    { field: 'pass', header: 'Matched on', sortable: true, style: { width: '1%' }, body: (r) => <span className="muted">{r.pass}</span> },
    { field: 'amountA', header: 'Excel 1', sortable: true, className: 'num', style: { width: '1%' } },
    { field: 'amountB', header: 'Excel 2', sortable: true, className: 'num', style: { width: '1%' } },
    {
      field: 'diff', header: 'Difference', sortable: true, className: 'num', style: { width: '1%' },
      body: (r) => (r.rawDiff ? <strong className="is-diff">{r.diff}</strong> : <span className="muted">—</span>),
    },
    { field: 'rowA', header: config.mode === 'sum' ? 'Lines 1' : 'Row 1', sortable: true, className: 'rownum', style: { width: '1%' }, body: (r) => (config.mode === 'sum' ? r.linesA || '—' : r.rowA ?? '—') },
    { field: 'rowB', header: config.mode === 'sum' ? 'Lines 2' : 'Row 2', sortable: true, className: 'rownum', style: { width: '1%' }, body: (r) => (config.mode === 'sum' ? r.linesB || '—' : r.rowB ?? '—') },
  ];

  const sorters = {
    key: (i) => keyText(i).toLowerCase(),
    status: (i) => result?.status?.[i] ?? 0,
    pass: (i) => result?.pass?.[i] ?? 0,
    amountA: (i) => (result?.hasAmountA?.[i] ? result.amountA[i] : -Infinity),
    amountB: (i) => (result?.hasAmountB?.[i] ? result.amountB[i] : -Infinity),
    diff: (i) => Math.abs(result?.diff?.[i] ?? 0),
    rowA: (i) => (result?.startA && result.startA[i + 1] > result.startA[i] ? (a?.rowNums?.[result.rowsA[result.startA[i]]] ?? result.rowsA[result.startA[i]]) : Infinity),
    rowB: (i) => (result?.startB && result.startB[i + 1] > result.startB[i] ? (b?.rowNums?.[result.rowsB[result.startB[i]]] ?? result.rowsB[result.startB[i]]) : Infinity),
  };

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference" aria-label="Search reference" size="sm" className="w-full" />
      </IconField>
      {group && (
        <button type="button" className="filter-chip" onClick={() => setGroup(null)}>
          {GROUPS.find((x) => x.key === group)?.label ?? group} <X size={12} aria-label="Clear filter" />
        </button>
      )}
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} {config.mode === 'sum' ? 'references' : 'items'}</span>
    </div>
  );

  const both = (x) => `${(x?.count ?? 0).toLocaleString()} · ${money(x?.sumA || x?.sumB || 0)}`;
  const nameA = a?.fileName ?? 'Excel 1';
  const nameB = b?.fileName ?? 'Excel 2';

  return (
    <div className="page">
      <PageHeader
        title="Reconciliation results"
        subtitle={`${nameA} ↔ ${nameB} · ${config.mode === 'sum' ? 'total per reference' : 'line by line'} · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="New reconciliation" size="sm" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
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
            ['Differences', `${(g.difference?.count ?? 0).toLocaleString()} · net ${money(g.difference?.net ?? 0)}`],
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
            items={GROUPS.map((x) => ({ key: x.key, label: x.label, count: g[x.key]?.count ?? 0, color: x.color }))}
          />
          {((summary.totals?.noAmountA ?? 0) > 0 || (summary.totals?.noAmountB ?? 0) > 0) && (
            <small className="muted">Rows with no readable amount cannot be matched: Excel 1 {(summary.totals.noAmountA ?? 0).toLocaleString()} · Excel 2 {(summary.totals.noAmountB ?? 0).toLocaleString()}.</small>
          )}
        </div>
      </div>

      <div className="card table-card">
        <GridTable
          count={result?.n ?? 0}
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
