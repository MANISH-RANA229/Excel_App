import { useDeferredValue, useMemo, useState } from 'react';
import { Button, InputText } from '../../components/ui/index.js';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { RotateCcw, Search, X } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { formatDuration } from '../../core/format.js';
import ExportButton from '../../shared/results/ExportButton.jsx';
import GridTable from '../../shared/results/GridTable.jsx';
import KpiStrip from '../../shared/results/KpiStrip.jsx';
import StatusChips from '../../shared/results/StatusChips.jsx';
import { describeConfig } from './config.js';
import { ADDED, CHANGED, REMOVED, SAME, changedColumns, makeEqual } from './engine.js';
import { buildKeyCompareExport, pairsOf } from './exportSpec.js';
import { STATUSES } from './status.js';

const SHOWN_CHANGES = 3;
const SHOWN_COLUMNS = 12;

const Value = ({ text }) => (text === '' ? <span className="chg__blank">(blank)</span> : text);
const CellChange = ({ name, from, to }) => (
  <span className="chg">
    <span className="chg__name">{name}:</span>
    <span className="chg__old"><Value text={from} /></span> → <span className="chg__new"><Value text={to} /></span>
  </span>
);

export default function KeyCompareResults({ result, ctx, ms, onRestart }) {
  const { a, b, config = { keys: [], values: {} }, compared = [] } = ctx || {};
  const t = result?.totals || ctx?.totals || { rowsA: 0, rowsB: 0, same: 0, changed: 0, added: 0, removed: 0, noKeyA: 0, noKeyB: 0, duplicateKeys: 0 };
  const [status, setStatus] = useState(null);
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());

  const keyColsA = useMemo(() => (a?.columns ? (config.keys || []).map((k) => a.columns.indexOf(k.a)) : []), [config.keys, a]);
  const keyColsB = useMemo(() => (b?.columns ? (config.keys || []).map((k) => b.columns.indexOf(k.b)) : []), [config.keys, b]);
  const pairs = useMemo(() => (a && b ? pairsOf(compared, a, b) : []), [compared, a, b]);
  const eq = useMemo(() => makeEqual({ ...config.values, tolerance: config.tolerance }), [config.values, config.tolerance]);
  // changedColumns returns indexes into `pairs`; turn them into { name, from, to } for display.
  const changesOf = (ra, rb) => changedColumns(pairs, eq, ra, rb)
    .map((p) => ({ name: pairs[p].name, from: pairs[p].a.text[ra], to: pairs[p].b.text[rb] }));

  const keyText = (i) => {
    if (!result?.rowA || !result?.rowB) return '';
    const ra = result.rowA[i];
    const rb = result.rowB[i];
    const cols = ra >= 0 ? keyColsA : keyColsB;
    const ds = ra >= 0 ? a : b;
    const row = ra >= 0 ? ra : rb;
    if (!ds || !ds.text) return '';
    return cols.map((c) => ds.text[c]?.[row] ?? '').join(' · ');
  };

  const accept = (i) => (status == null || result?.status?.[i] === status) && (!query || keyText(i).toLowerCase().includes(query));

  // Only the visible rows ever compute which cells changed.
  const getRow = (i) => {
    const st = result?.status?.[i] ?? SAME;
    const ra = result?.rowA?.[i] ?? -1;
    const rb = result?.rowB?.[i] ?? -1;
    const changes = st === CHANGED && ra >= 0 && rb >= 0 ? changesOf(ra, rb) : [];
    return {
      index: i,
      status: st,
      key: keyText(i),
      rowA: ra >= 0 ? (a?.rowNums?.[ra] ?? ra + 1) : null,
      rowB: rb >= 0 ? (b?.rowNums?.[rb] ?? rb + 1) : null,
      ra,
      rb,
      changes,
    };
  };

  const columns = [
    { expander: true, className: 'col-expander' },
    { field: 'key', header: 'Key', sortable: true, body: (r) => <span className="clip" title={r.key}><strong>{r.key || <span className="muted">(blank key)</span>}</strong></span> },
    {
      field: 'status', header: 'Status', sortable: true, className: 'col-status', style: { width: '1%' },
      body: (r) => {
        const meta = STATUSES[r.status] || { bg: '#eee', fg: '#333', label: 'Unknown' };
        return <span className="band-tag" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>;
      },
    },
    { field: 'rowA', header: 'Excel 1 row', sortable: true, style: { width: '1%' }, className: 'rownum', body: (r) => r.rowA ?? '—' },
    { field: 'rowB', header: 'Excel 2 row', sortable: true, style: { width: '1%' }, className: 'rownum', body: (r) => r.rowB ?? '—' },
    {
      field: 'changes', header: 'Changed values',
      body: (r) => {
        if (r.status === SAME) return <span className="muted">All compared values match</span>;
        if (r.status === ADDED) return <span className="muted">New in Excel 2</span>;
        if (r.status === REMOVED) return <span className="muted">Removed from Excel 2</span>;
        const shown = r.changes.slice(0, SHOWN_CHANGES);
        return (
          <span>
            {shown.map((c) => <CellChange key={c.name} name={c.name} from={c.from} to={c.to} />)}
            {r.changes.length > SHOWN_CHANGES && <span className="muted">+ {r.changes.length - SHOWN_CHANGES} more</span>}
          </span>
        );
      },
    },
  ];

  const sorters = {
    key: (i) => keyText(i).toLowerCase(),
    status: (i) => result?.status?.[i] ?? 0,
    rowA: (i) => (result?.rowA && result.rowA[i] >= 0 ? (a?.rowNums?.[result.rowA[i]] ?? result.rowA[i]) : Infinity),
    rowB: (i) => (result?.rowB && result.rowB[i] >= 0 ? (b?.rowNums?.[result.rowB[i]] ?? result.rowB[i]) : Infinity),
  };

  const expansion = (r) => {
    if (r.status === CHANGED) {
      return (
        <div className="wd">
          <table className="members">
            <thead><tr><th>Column</th><th>Excel 1 (old)</th><th>Excel 2 (new)</th></tr></thead>
            <tbody>
              {r.changes.map((c) => (
                <tr key={c.name}>
                  <td><strong>{c.name}</strong></td>
                  <td><span className="chg__old"><Value text={c.from} /></span></td>
                  <td><span className="chg__new"><Value text={c.to} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (r.status === SAME) return <div className="wd"><span className="muted">{pairs.length ? `All ${pairs.length} compared columns are equal.` : 'Only the key was compared.'}</span></div>;
    const isA = r.status === REMOVED;
    const ds = isA ? a : b;
    const row = isA ? r.ra : r.rb;
    if (!ds || row < 0) return null;
    const rowCells = (ds.columns || []).map((_, k) => ds.text?.[k]?.[row] ?? '');
    return (
      <div className="wd">
        <table className="members">
          <thead><tr>{(ds.columns || []).slice(0, SHOWN_COLUMNS).map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            <tr>{rowCells.slice(0, SHOWN_COLUMNS).map((c, i) => <td key={i}><span className="cell clip" title={c}>{c || <span className="muted">(blank)</span>}</span></td>)}</tr>
          </tbody>
        </table>
        {(ds.columns || []).length > SHOWN_COLUMNS && <span className="muted">… and {ds.columns.length - SHOWN_COLUMNS} more columns</span>}
      </div>
    );
  };

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search key" aria-label="Search key" size="sm" className="w-full" />
      </IconField>
      {status != null && STATUSES[status] && (
        <button type="button" className="filter-chip" onClick={() => setStatus(null)}>
          {STATUSES[status].label} <X size={12} aria-label="Clear filter" />
        </button>
      )}
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} records</span>
    </div>
  );

  const n = (v) => (v ?? 0).toLocaleString();
  const nameA = a?.fileName ?? 'Excel 1';
  const nameB = b?.fileName ?? 'Excel 2';

  return (
    <div className="page">
      <PageHeader
        title="Comparison results"
        subtitle={`${nameA} (old) ↔ ${nameB} (new) · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="New comparison" size="sm" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton label="Download report" buildSpec={() => buildKeyCompareExport(result, { a, b, config, compared, description: describeConfig(config, compared) })} />
          </>
        )}
      />

      <div className="card summary">
        <KpiStrip items={[['Rows in Excel 1', n(t.rowsA)], ['Rows in Excel 2', n(t.rowsB)], ['Unchanged', n(t.same)], ['Changed', n(t.changed)], ['Added', n(t.added)], ['Removed', n(t.removed)]]} />
        <div className="dist">
          <StatusChips
            label="Filter by outcome"
            active={status}
            onSelect={setStatus}
            items={[
              { key: CHANGED, count: t.changed ?? 0 }, { key: ADDED, count: t.added ?? 0 }, { key: REMOVED, count: t.removed ?? 0 }, { key: SAME, count: t.same ?? 0 },
            ].map((x) => ({ ...x, label: STATUSES[x.key].label, color: STATUSES[x.key].color }))}
          />
          {((t.noKeyA ?? 0) > 0 || (t.noKeyB ?? 0) > 0) && <small className="muted">Rows with no key cannot be matched (Excel 1: {n(t.noKeyA)} · Excel 2: {n(t.noKeyB)}).</small>}
          {(t.duplicateKeys ?? 0) > 0 && <small className="muted">{n(t.duplicateKeys)} key{t.duplicateKeys === 1 ? ' appears' : 's appear'} more than once; repeated keys are paired in order (1st with 1st, 2nd with 2nd).</small>}
        </div>
      </div>

      <div className="card table-card">
        <GridTable
          count={result?.n ?? 0}
          getRow={getRow}
          columns={columns}
          accept={accept}
          filterKey={`${status}|${query}`}
          sorters={sorters}
          expansion={expansion}
          toolbar={toolbar}
          className="cmp-table"
        />
      </div>
    </div>
  );
}
