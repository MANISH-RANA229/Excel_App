import { useDeferredValue, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { columnTexts } from '../../core/dataset/dataset.js';
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

export default function KeyCompareResults({ result, ctx, ms, onEdit, onRestart }) {
  const { a, b, config, compared } = ctx;
  const [status, setStatus] = useState(null);
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());
  const t = result.totals;
  const pairs = useMemo(() => pairsOf(compared, a, b), [compared, a, b]);
  const equal = useMemo(() => makeEqual({ ...config.values, tolerance: config.tolerance }), [config]);
  const keysA = config.keys.map((k) => columnTexts(a, k.a));
  const keysB = config.keys.map((k) => columnTexts(b, k.b));

  const keyOf = (i) => (result.rowA[i] >= 0 ? keysA.map((c) => c[result.rowA[i]]) : keysB.map((c) => c[result.rowB[i]])).join(' · ');
  const changesOf = (i) => changedColumns(pairs, equal, result.rowA[i], result.rowB[i]);
  const accept = (i) => (status == null || result.status[i] === status) && (!query || keyOf(i).toLowerCase().includes(query));
  const getRow = (i) => {
    const ra = result.rowA[i];
    const rb = result.rowB[i];
    const changes = result.status[i] === CHANGED ? changesOf(i) : [];
    return {
      i, status: result.status[i], key: keyOf(i), aRow: ra >= 0 ? a.rowNums[ra] : null, bRow: rb >= 0 ? b.rowNums[rb] : null,
      count: result.changedCount[i],
      shown: changes.slice(0, SHOWN_CHANGES).map((p) => ({ name: pairs[p].name, from: pairs[p].a.text[ra], to: pairs[p].b.text[rb] })),
      more: Math.max(0, changes.length - SHOWN_CHANGES),
    };
  };

  const columns = [
    { expander: true, className: 'col-expander' },
    { field: 'status', header: 'Status', sortable: true, className: 'col-status', body: (r) => { const s = STATUSES[r.status]; return <span className="band-tag" style={{ background: s.bg, color: s.fg }}><strong>{s.label}</strong></span>; } },
    { field: 'key', header: 'Key', sortable: true, body: (r) => <span className="cell" title={r.key}>{r.key || <span className="muted">(no key)</span>}</span> },
    { field: 'aRow', header: 'Excel 1 row', sortable: true, className: 'rownum', body: (r) => r.aRow ?? '—' },
    { field: 'bRow', header: 'Excel 2 row', sortable: true, className: 'rownum', body: (r) => r.bRow ?? '—' },
    { field: 'count', header: 'Changed cells', sortable: true, className: 'rownum', body: (r) => (r.status === CHANGED ? r.count : '') },
    {
      field: 'shown', header: 'What changed',
      body: (r) => (r.shown.length ? <span className="cell">{r.shown.map((c) => <CellChange key={c.name} {...c} />)}{r.more > 0 && <span className="muted">+{r.more} more</span>}</span> : null),
    },
  ];
  const sorters = {
    status: (i) => result.status[i], key: (i) => keyOf(i).toLowerCase(),
    aRow: (i) => (result.rowA[i] >= 0 ? a.rowNums[result.rowA[i]] : 2 ** 31), bRow: (i) => (result.rowB[i] >= 0 ? b.rowNums[result.rowB[i]] : 2 ** 31),
    count: (i) => result.changedCount[i],
  };

  const expansion = (r) => {
    if (r.status === CHANGED) {
      const ra = result.rowA[r.i];
      const rb = result.rowB[r.i];
      return (
        <div className="wd">
          <table className="members">
            <thead><tr><th>Column</th><th>Excel 1 (old)</th><th>Excel 2 (new)</th></tr></thead>
            <tbody>
              {changesOf(r.i).map((p) => (
                <tr key={pairs[p].name}><td>{pairs[p].name}</td><td><span className="chg__old"><Value text={pairs[p].a.text[ra]} /></span></td><td><span className="chg__new"><Value text={pairs[p].b.text[rb]} /></span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (r.status === SAME) return <div className="wd"><span className="muted">{pairs.length ? `All ${pairs.length} compared columns are equal.` : 'Only the key was compared.'}</span></div>;
    const ds = r.status === ADDED ? b : a;
    const row = r.status === ADDED ? result.rowB[r.i] : result.rowA[r.i];
    return (
      <div className="wd">
        <table className="members">
          <thead><tr><th>Column</th><th>{r.status === ADDED ? 'Excel 2 (new)' : 'Excel 1 (old)'}</th></tr></thead>
          <tbody>
            {ds.columns.slice(0, SHOWN_COLUMNS).map((c, k) => <tr key={c}><td>{c}</td><td>{ds.text[k][row]}</td></tr>)}
          </tbody>
        </table>
        {ds.columns.length > SHOWN_COLUMNS && <span className="muted">… and {ds.columns.length - SHOWN_COLUMNS} more columns</span>}
      </div>
    );
  };

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search key" aria-label="Search key" className="p-inputtext-sm w-full" />
      </IconField>
      {status != null && (
        <button type="button" className="filter-chip" onClick={() => setStatus(null)}>
          {STATUSES[status].label} <X size={12} aria-label="Clear filter" />
        </button>
      )}
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} records</span>
    </div>
  );

  const n = (v) => v.toLocaleString();
  return (
    <div className="page">
      <PageHeader
        title="Comparison results"
        subtitle={`${a.fileName} (old) ↔ ${b.fileName} (new) · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="Settings" size="small" outlined severity="secondary" icon={<SlidersHorizontal size={14} />} onClick={onEdit} />
            <Button label="New comparison" size="small" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
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
              { key: CHANGED, count: t.changed }, { key: ADDED, count: t.added }, { key: REMOVED, count: t.removed }, { key: SAME, count: t.same },
            ].map((x) => ({ ...x, label: STATUSES[x.key].label, color: STATUSES[x.key].color }))}
          />
          {(t.noKeyA > 0 || t.noKeyB > 0) && <small className="muted">Rows with no key cannot be matched (Excel 1: {n(t.noKeyA)} · Excel 2: {n(t.noKeyB)}).</small>}
          {t.duplicateKeys > 0 && <small className="muted">{n(t.duplicateKeys)} key{t.duplicateKeys === 1 ? ' appears' : 's appear'} more than once; repeated keys are paired in order (1st with 1st, 2nd with 2nd).</small>}
        </div>
      </div>

      <div className="card table-card">
        <GridTable
          count={result.n}
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
