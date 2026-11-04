import { useDeferredValue, useMemo, useState } from 'react';
import { Button, Checkbox, InputText, SelectButton } from '../../components/ui/index.js';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Message } from 'primereact/message';
import { RadioButton } from 'primereact/radiobutton';
import { RotateCcw, Search } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { columnIndex } from '../../core/dataset/dataset.js';
import { formatDuration } from '../../core/format.js';
import BandTag from '../../shared/results/BandTag.jsx';
import ExportButton from '../../shared/results/ExportButton.jsx';
import GridTable from '../../shared/results/GridTable.jsx';
import KpiStrip from '../../shared/results/KpiStrip.jsx';
import { applyDecisions } from './decisions.js';
import { KEEP_RULES } from './engine.js';
import { buildDuplicatesExport } from './exportSpec.js';

const OUTPUTS = [{ label: 'Remove duplicates', value: 'remove' }, { label: 'Mark duplicates, keep all rows', value: 'mark' }];
const EXTRA_COLUMNS = 3;

/** Expanded group: every member row with a radio to choose which one survives. */
function Members({ row, result, ds, keyColumns = [], onKeep }) {
  if (!ds || !result || !result.members) return null;
  const shown = [...keyColumns, ...(ds.columns || []).filter((c) => !keyColumns.includes(c)).slice(0, EXTRA_COLUMNS)];
  const members = Array.from(result.members.subarray(result.groupStart[row.g], result.groupStart[row.g + 1]));
  return (
    <div className="wd">
      <table className="members">
        <thead>
          <tr>
            <th style={{ width: '1%' }}>Keep</th>
            <th className="num">Row</th>
            {shown.map((c) => <th key={c}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {members.map((r) => {
            const isKept = r === row.keptRow && !row.ignored;
            return (
              <tr key={r} className={isKept ? 'is-kept' : undefined}>
                <td>
                  <RadioButton
                    checked={isKept}
                    disabled={row.ignored}
                    onChange={() => onKeep(row.g, r)}
                    aria-label={`Keep row ${ds?.rowNums?.[r] ?? (r + 1)}`}
                  />
                </td>
                <td className="num">{ds?.rowNums?.[r] ?? (r + 1)}</td>
                {shown.map((c) => {
                  const ci = columnIndex(ds, c);
                  const val = ci >= 0 && ds?.text?.[ci] ? ds.text[ci][r] : '';
                  return <td key={c}><span className="cell clip" title={val}>{val || <span className="muted">(blank)</span>}</span></td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DuplicatesResults({ result, ctx, ms, onRestart }) {
  const { ds, config = { keyColumns: [], mode: 'exact', keep: 'first' } } = ctx || {};
  const { keyColumns = [] } = config;
  const keyIdxs = useMemo(() => (ds ? keyColumns.map((c) => columnIndex(ds, c)) : []), [ds, keyColumns]);
  const [output, setOutput] = useState('remove');
  const [decisions, setDecisions] = useState({}); // g -> { keptRow?, ignored? }
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState(0);
  const query = useDeferredValue(search.trim().toLowerCase());

  const stats = useMemo(() => (result ? applyDecisions(result, decisions) : { groups: 0, rowsInGroups: 0, toRemove: 0, unique: 0 }), [result, decisions]);
  const keyText = (row) => keyIdxs.map((c) => (c >= 0 && ds?.text?.[c] ? ds.text[c][row] : '')).join(' · ');

  const keptOf = (g) => decisions[g]?.keptRow ?? result?.keptRow?.[g];
  const chooseKeep = (g, keptRow) => {
    setDecisions((d) => ({ ...d, [g]: { ...d[g], keptRow } }));
    setVersion((v) => v + 1);
  };
  const toggleIgnored = (g) => {
    setDecisions((d) => ({ ...d, [g]: { ...d[g], ignored: !(d[g]?.ignored ?? false) } }));
    setVersion((v) => v + 1);
  };

  const getRow = (g) => {
    const k = keptOf(g);
    const ignored = decisions[g]?.ignored ?? false;
    return {
      g,
      id: g + 1,
      size: result?.groupStart ? result.groupStart[g + 1] - result.groupStart[g] : 0,
      score: result?.minScore?.[g] ?? 0,
      keptRow: k,
      keptNum: ignored ? '—' : (ds?.rowNums?.[k] ?? (k + 1)),
      key: keyText(k),
      ignored,
    };
  };

  const columns = [
    { expander: true, className: 'col-expander' },
    { field: 'id', header: '#', sortable: true, className: 'rownum' },
    { field: 'size', header: 'Rows', sortable: true, className: 'num' },
    { field: 'score', header: 'Weakest match', sortable: true, className: 'col-match', body: (r) => <BandTag pct={r.score} /> },
    { field: 'keptNum', header: 'Keeps row', sortable: true, className: 'rownum' },
    { field: 'key', header: keyColumns.join(' + '), sortable: true, body: (r) => <span className="cell" title={r.key}>{r.key}</span> },
    { field: 'ignored', header: 'Not duplicates', className: 'col-check', body: (r) => <Checkbox checked={r.ignored} onChange={() => toggleIgnored(r.g)} aria-label={`Group ${r.id} is not a duplicate`} /> },
  ];
  const sorters = {
    id: (g) => g,
    size: (g) => (result?.groupStart ? result.groupStart[g + 1] - result.groupStart[g] : 0),
    score: (g) => result?.minScore?.[g] ?? 0,
    keptNum: (g) => (ds?.rowNums && keptOf(g) != null ? ds.rowNums[keptOf(g)] : 0),
    key: (g) => keyText(keptOf(g)),
  };
  const accept = (g) => {
    if (!query) return true;
    if (!result?.groupStart || !result?.members) return false;
    for (let k = result.groupStart[g]; k < result.groupStart[g + 1]; k++) {
      if (keyText(result.members[k]).toLowerCase().includes(query)) return true;
    }
    return false;
  };

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups" aria-label="Search groups" size="sm" className="w-full" />
      </IconField>
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} groups</span>
    </div>
  );

  const description = [
    `Key columns: ${keyColumns.join(' + ')}`,
    config.mode === 'similar' ? `Compared: Similar, at least ${config.threshold}% alike` : 'Compared: Exact match',
    `Keep rule: ${KEEP_RULES[config.keep]?.label ?? 'Keep first row'}`,
  ];
  const none = (result?.groupCount ?? 0) === 0;
  const fileName = ds?.fileName ?? 'File';

  return (
    <div className="page">
      <PageHeader
        title="Duplicate Finder results"
        subtitle={`${keyColumns.join(' + ')} · ${config.mode === 'similar' ? `similar ≥ ${config.threshold}%` : 'exact'} · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="New search" size="sm" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton
              label={output === 'mark' ? 'Download marked copy' : 'Download cleaned copy'}
              disabled={none || stats.groups === 0}
              buildSpec={() => buildDuplicatesExport(result, ds, { keyColumns, decisions, output, description })}
            />
          </>
        )}
      />

      <div className="card summary">
        <KpiStrip
          items={[
            ['Rows scanned', (ds?.rowCount ?? 0).toLocaleString()],
            ['Duplicate groups', (stats.groups ?? 0).toLocaleString()],
            ['Rows in groups', (stats.rowsInGroups ?? 0).toLocaleString()],
            [output === 'mark' ? 'Rows to mark' : 'Rows to remove', (stats.toRemove ?? 0).toLocaleString()],
            [output === 'mark' ? 'Rows left unmarked' : 'Rows remaining', (stats.unique ?? 0).toLocaleString()],
          ]}
        />
      </div>

      {none ? (
        <Message severity="success" className="w-full" text={`No duplicates found in ${(ds?.rowCount ?? 0).toLocaleString()} rows${config.mode === 'exact' ? '. Try “Similar” to catch typos and different word order.' : '. Try a lower similarity, or different columns.'}`} />
      ) : (
        <>
          <div className="card config">
            <div className="config__grid">
              <div className="field">
                <span>Output</span>
                <SelectButton value={output} options={OUTPUTS} onChange={(e) => e.value && setOutput(e.value)} unselectable={false} />
              </div>
              <div className="field">
                <span>Review</span>
                <small className="muted">Expand a group to choose a different row to keep. Tick “Not duplicates” to leave a group untouched.</small>
              </div>
            </div>
          </div>
          <div className="card table-card">
            <GridTable
              count={result?.groupCount ?? 0}
              getRow={getRow}
              columns={columns}
              rowsKey={version}
              sorters={sorters}
              accept={accept}
              filterKey={query}
              toolbar={toolbar}
              expansion={(row) => <Members row={row} result={result} ds={ds} keyColumns={keyColumns} onKeep={chooseKeep} />}
              emptyMessage="No groups match your search."
              className="dup-table"
            />
          </div>
        </>
      )}
    </div>
  );
}
