import { useDeferredValue, useMemo, useState } from 'react';
import { Button, Checkbox, InputText, SelectButton } from '../../components/ui/index.js';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Message } from 'primereact/message';
import { RotateCcw, Search } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { MAX_GROUPS, MAX_GROUPS_WARN } from '../../core/limits.js';
import { formatDuration } from '../../core/format.js';
import ExportButton from '../../shared/results/ExportButton.jsx';
import GridTable from '../../shared/results/GridTable.jsx';
import KpiStrip from '../../shared/results/KpiStrip.jsx';
import { buildSplitExport, nameFor } from './exportSpec.js';

const OUTPUTS = [{ label: 'ZIP of workbooks', value: 'zip' }, { label: 'One workbook, a sheet per value', value: 'workbook' }];

export default function SplitResults({ result, ctx, ms, onRestart }) {
  const { ds, column = 'Column' } = ctx || {};
  const groups = result?.labels?.length ?? 0;
  const [output, setOutput] = useState('zip');
  const [pattern, setPattern] = useState('{file} - {value}');
  const [excluded, setExcluded] = useState(() => new Set());
  const [names, setNames] = useState(() => new Map());
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());
  const touch = () => setVersion((v) => v + 1);

  const fileName = ds?.fileName ?? 'file';
  const rowCount = ds?.rowCount ?? 0;

  const included = useMemo(() => Array.from({ length: groups }, (_, g) => g).filter((g) => !excluded.has(g)), [groups, excluded]);
  const rowsIncluded = included.reduce((n, g) => n + (result?.counts?.[g] ?? 0), 0);
  const { largest, smallest } = useMemo(() => {
    let big = 0;
    let small = 0;
    if (result?.counts) {
      for (let g = 1; g < groups; g++) {
        if (result.counts[g] > result.counts[big]) big = g;
        if (result.counts[g] < result.counts[small]) small = g;
      }
    }
    return { largest: big, smallest: small };
  }, [result, groups]);

  const defaultName = (g) => (result?.labels ? nameFor(pattern, result.labels[g], fileName) : '');
  const toggle = (g) => { setExcluded((s) => { const next = new Set(s); if (next.has(g)) next.delete(g); else next.add(g); return next; }); touch(); };
  const rename = (g, value) => { setNames((m) => new Map(m).set(g, value)); touch(); };

  const getRow = (g) => {
    const count = result?.counts?.[g] ?? 0;
    const totalOrder = result?.order?.length || 1;
    return {
      g,
      label: result?.labels?.[g] ?? '',
      count,
      pct: totalOrder ? count / totalOrder : 0,
      name: names.get(g) ?? defaultName(g),
      included: !excluded.has(g),
    };
  };
  const columns = [
    { field: 'included', className: 'col-check', body: (r) => <Checkbox checked={r.included} onChange={() => toggle(r.g)} aria-label={`Include ${r.label}`} /> },
    { field: 'label', header: column, sortable: true, body: (r) => <span className="cell" title={r.label}>{r.label}</span> },
    { field: 'count', header: 'Rows', sortable: true, className: 'num', body: (r) => r.count.toLocaleString() },
    { field: 'pct', header: 'Share', sortable: true, className: 'col-share', body: (r) => (
      <span className="sharebar" title={`${(r.pct * 100).toFixed(1)}%`}><span style={{ width: `${Math.max(2, r.pct * 100)}%` }} /></span>
    ) },
    { field: 'name', header: output === 'zip' ? 'File name' : 'Sheet name', body: (r) => (
      <InputText value={r.name} onChange={(e) => rename(r.g, e.target.value)} size="sm" className="w-full" aria-label={`Name for ${r.label}`} />
    ) },
  ];

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search values" aria-label="Search values" size="sm" className="w-full" />
      </IconField>
      <Button label="Select all" size="sm" text severity="secondary" onClick={() => { setExcluded(new Set()); touch(); }} />
      <Button label="Select none" size="sm" text severity="secondary" onClick={() => { setExcluded(new Set(Array.from({ length: groups }, (_, g) => g))); touch(); }} />
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} values</span>
    </div>
  );

  return (
    <div className="page">
      <PageHeader
        title="Split by Column results"
        subtitle={`“${column}” · ${rowCount.toLocaleString()} rows · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="New split" size="sm" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton
              reuse={false}
              label={output === 'zip' ? 'Download ZIP' : 'Download Excel'}
              title={output === 'zip' ? 'Building your files' : 'Building your Excel file'}
              disabled={!included.length}
              buildSpec={() => buildSplitExport(result, ctx, { output, pattern, included, names })}
            />
          </>
        )}
      />

      <div className="card summary">
        <KpiStrip
          items={[
            ['Unique values', groups.toLocaleString()],
            ['Files to create', included.length.toLocaleString()],
            ['Rows included', `${rowsIncluded.toLocaleString()} (${rowCount ? Math.round((rowsIncluded / rowCount) * 100) : 0}%)`],
            ['Largest file', groups ? `${result?.counts?.[largest]?.toLocaleString() ?? 0} rows` : '—'],
            ['Smallest file', groups ? `${result?.counts?.[smallest]?.toLocaleString() ?? 0} rows` : '—'],
          ]}
        />
      </div>

      <div className="card config">
        <div className="config__grid">
          <div className="field">
            <span>Download as</span>
            <SelectButton value={output} options={OUTPUTS} onChange={(e) => e.value && setOutput(e.value)} unselectable={false} />
          </div>
          <div className="field">
            <span>{output === 'zip' ? 'File name pattern' : 'Sheet name pattern'}</span>
            <InputText value={pattern} onChange={(e) => { setPattern(e.target.value); touch(); }} placeholder="{file} - {value}" size="sm" />
            <small className="muted">Use <code>{'{value}'}</code> for the column value, <code>{'{file}'}</code> for the original file name.</small>
          </div>
        </div>
      </div>

      {groups > MAX_GROUPS && (
        <Message severity="error" className="w-full" text={`${groups.toLocaleString()} different values found; at most ${MAX_GROUPS.toLocaleString()} can be exported. Untick some, or split by a column with fewer values.`} />
      )}
      {groups > MAX_GROUPS_WARN && groups <= MAX_GROUPS && (
        <Message severity="warn" className="w-full" text={`Splitting into ${groups.toLocaleString()} files can take a while to download and extract.`} />
      )}
      {output === 'workbook' && included.length > 100 && (
        <Message severity="warn" className="w-full" text="Workbooks with more than 100 sheets are slow to open in Excel. A ZIP of separate files is usually easier." />
      )}

      <div className="card table-card">
        <GridTable
          count={groups}
          getRow={getRow}
          columns={columns}
          rowsKey={`${version}|${output}`}
          sorters={{
            label: (g) => (result?.labels?.[g] ?? '').toLowerCase(),
            count: (g) => result?.counts?.[g] ?? 0,
            pct: (g) => result?.counts?.[g] ?? 0,
            name: (g) => (names.get(g) ?? defaultName(g)).toLowerCase(),
          }}
          accept={(g) => {
            if (!query) return true;
            const lbl = result?.labels?.[g] ?? '';
            const nm = names.get(g) ?? defaultName(g);
            return lbl.toLowerCase().includes(query) || nm.toLowerCase().includes(query);
          }}
          filterKey={`${query}|${pattern}`}
          toolbar={toolbar}
          emptyMessage="No values match your search."
          className="split-table"
        />
      </div>
    </div>
  );
}
