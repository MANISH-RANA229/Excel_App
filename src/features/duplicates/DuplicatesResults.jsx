import { useDeferredValue, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { RadioButton } from 'primereact/radiobutton';
import { SelectButton } from 'primereact/selectbutton';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
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
function Members({ row, result, ds, keyColumns, onKeep }) {
  const shown = [...keyColumns, ...ds.columns.filter((c) => !keyColumns.includes(c)).slice(0, EXTRA_COLUMNS)];
  // a plain array: Int32Array.map would coerce the JSX rows to numbers
  const members = Array.from(result.members.subarray(result.groupStart[row.g], result.groupStart[row.g + 1]));
  return (
    <div className="wd">
      <table className="members">
        <thead>
          <tr><th>Keep</th><th className="num">Row</th>{shown.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m} className={m === row.keptRow ? 'is-kept' : ''}>
              <td><RadioButton checked={m === row.keptRow} onChange={() => onKeep(row.g, m)} aria-label={`Keep row ${ds.rowNums[m]}`} /></td>
              <td className="num">{ds.rowNums[m]}</td>
              {shown.map((c) => <td key={c}><span className="cell" title={ds.text[columnIndex(ds, c)][m]}>{ds.text[columnIndex(ds, c)][m]}</span></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DuplicatesResults({ result, ctx, ms, onEdit, onRestart }) {
  const { ds, keyColumns, config } = ctx;
  const [keepOverride, setKeepOverride] = useState(() => new Map());
  const [ignored, setIgnored] = useState(() => new Set());
  const [output, setOutput] = useState('remove');
  const [version, setVersion] = useState(0); // bumps when a decision changes so visible rows refresh
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());

  const decisions = useMemo(() => ({ keepOverride, ignored }), [keepOverride, ignored]);
  const { stats } = useMemo(() => applyDecisions(result, decisions), [result, decisions]);
  const keyIdx = keyColumns.map((c) => columnIndex(ds, c));
  const keyText = (row) => keyIdx.map((i) => ds.text[i][row]).filter((t) => t !== '').join(' · ');
  const keptOf = (g) => keepOverride.get(g) ?? result.keep[g];

  const chooseKeep = (g, row) => {
    setKeepOverride((m) => { const next = new Map(m); if (row === result.keep[g]) next.delete(g); else next.set(g, row); return next; });
    setVersion((v) => v + 1);
  };
  const toggleIgnored = (g) => {
    setIgnored((s) => { const next = new Set(s); if (next.has(g)) next.delete(g); else next.add(g); return next; });
    setVersion((v) => v + 1);
  };

  const getRow = (g) => {
    const kept = keptOf(g);
    return {
      g, id: g + 1, size: result.groupStart[g + 1] - result.groupStart[g], score: result.minScore[g],
      keptRow: kept, keptNum: ds.rowNums[kept], key: keyText(kept), ignored: ignored.has(g),
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
    id: (g) => g, size: (g) => result.groupStart[g + 1] - result.groupStart[g], score: (g) => result.minScore[g],
    keptNum: (g) => ds.rowNums[keptOf(g)], key: (g) => keyText(keptOf(g)),
  };
  const accept = (g) => {
    if (!query) return true;
    for (let k = result.groupStart[g]; k < result.groupStart[g + 1]; k++) if (keyText(result.members[k]).toLowerCase().includes(query)) return true;
    return false;
  };

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups" aria-label="Search groups" className="p-inputtext-sm w-full" />
      </IconField>
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} groups</span>
    </div>
  );

  const description = [
    `Key columns: ${keyColumns.join(' + ')}`,
    config.mode === 'similar' ? `Compared: Similar, at least ${config.threshold}% alike` : 'Compared: Exact match',
    `Keep rule: ${KEEP_RULES[config.keep].label}`,
  ];
  const none = result.groupCount === 0;

  return (
    <div className="page">
      <PageHeader
        title="Duplicate Finder results"
        subtitle={`${keyColumns.join(' + ')} · ${config.mode === 'similar' ? `similar ≥ ${config.threshold}%` : 'exact'} · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="Settings" size="small" outlined severity="secondary" icon={<SlidersHorizontal size={14} />} onClick={onEdit} />
            <Button label="New search" size="small" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
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
            ['Rows scanned', ds.rowCount.toLocaleString()],
            ['Duplicate groups', stats.groups.toLocaleString()],
            ['Rows in groups', stats.rowsInGroups.toLocaleString()],
            [output === 'mark' ? 'Rows to mark' : 'Rows to remove', stats.toRemove.toLocaleString()],
            [output === 'mark' ? 'Rows left unmarked' : 'Rows remaining', stats.unique.toLocaleString()],
          ]}
        />
      </div>

      {none ? (
        <Message severity="success" className="w-full" text={`No duplicates found in ${ds.rowCount.toLocaleString()} rows${config.mode === 'exact' ? '. Try “Similar” to catch typos and different word order.' : '. Try a lower similarity, or different columns.'}`} />
      ) : (
        <>
          <div className="card config">
            <div className="config__grid">
              <div className="field">
                <span>Output</span>
                <SelectButton value={output} options={OUTPUTS} onChange={(e) => e.value && setOutput(e.value)} allowEmpty={false} />
              </div>
              <div className="field">
                <span>Review</span>
                <small className="muted">Expand a group to choose a different row to keep. Tick “Not duplicates” to leave a group untouched.</small>
              </div>
            </div>
          </div>
          <div className="card table-card">
            <GridTable
              count={result.groupCount}
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
