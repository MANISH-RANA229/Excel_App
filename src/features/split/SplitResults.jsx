import { useDeferredValue, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { InputText } from 'primereact/inputtext';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Message } from 'primereact/message';
import { SelectButton } from 'primereact/selectbutton';
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
  const { ds, column } = ctx;
  const groups = result.labels.length;
  const [output, setOutput] = useState('zip');
  const [pattern, setPattern] = useState('{file} - {value}');
  const [excluded, setExcluded] = useState(() => new Set());
  const [names, setNames] = useState(() => new Map());
  const [version, setVersion] = useState(0); // bumps when checkboxes / names change so visible rows refresh
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());
  const touch = () => setVersion((v) => v + 1);

  const included = useMemo(() => Array.from({ length: groups }, (_, g) => g).filter((g) => !excluded.has(g)), [groups, excluded]);
  const rowsIncluded = included.reduce((n, g) => n + result.counts[g], 0);
  const { largest, smallest } = useMemo(() => {
    let big = 0;
    let small = 0;
    for (let g = 1; g < groups; g++) {
      if (result.counts[g] > result.counts[big]) big = g;
      if (result.counts[g] < result.counts[small]) small = g;
    }
    return { largest: big, smallest: small };
  }, [result, groups]);

  const defaultName = (g) => nameFor(pattern, result.labels[g], ds.fileName);
  const toggle = (g) => { setExcluded((s) => { const next = new Set(s); if (next.has(g)) next.delete(g); else next.add(g); return next; }); touch(); };
  const rename = (g, value) => { setNames((m) => new Map(m).set(g, value)); touch(); };

  const getRow = (g) => ({
    g, label: result.labels[g], count: result.counts[g], pct: result.order.length ? result.counts[g] / result.order.length : 0,
    name: names.get(g) ?? defaultName(g), included: !excluded.has(g),
  });
  const columns = [
    { field: 'included', className: 'col-check', body: (r) => <Checkbox checked={r.included} onChange={() => toggle(r.g)} aria-label={`Include ${r.label}`} /> },
    { field: 'label', header: column, sortable: true, body: (r) => <span className="cell" title={r.label}>{r.label}</span> },
    { field: 'count', header: 'Rows', sortable: true, className: 'num', body: (r) => r.count.toLocaleString() },
    { field: 'pct', header: 'Share', sortable: true, className: 'col-share', body: (r) => (
      <span className="sharebar" title={`${(r.pct * 100).toFixed(1)}%`}><span style={{ width: `${Math.max(2, r.pct * 100)}%` }} /></span>
    ) },
    { field: 'name', header: output === 'zip' ? 'File name' : 'Sheet name', body: (r) => (
      <InputText value={r.name} onChange={(e) => rename(r.g, e.target.value)} className="p-inputtext-sm w-full" aria-label={`Name for ${r.label}`} />
    ) },
  ];

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search values" aria-label="Search values" className="p-inputtext-sm w-full" />
      </IconField>
      <Button label="Select all" size="small" text severity="secondary" onClick={() => { setExcluded(new Set()); touch(); }} />
      <Button label="Select none" size="small" text severity="secondary" onClick={() => { setExcluded(new Set(Array.from({ length: groups }, (_, g) => g))); touch(); }} />
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} values</span>
    </div>
  );

  return (
    <div className="page">
      <PageHeader
        title="Split by Column results"
        subtitle={`“${column}” · ${ds.rowCount.toLocaleString()} rows · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="New split" size="small" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton
              reuse={false} // many files: nothing single to keep working on
              label={output === 'zip' ? 'Download ZIP' : 'Download Excel'}
              title={output === 'zip' ? 'Building your files' : 'Building your Excel file'}
              disabled={!included.length}
              buildSpec={() => buildSplitExport(result, ctx, { output, pattern, included, names })}
            />
          </>
        )}
      />

      {groups > MAX_GROUPS && <Message severity="error" className="w-full" text={`${groups.toLocaleString()} different values found; at most ${MAX_GROUPS.toLocaleString()} can be exported. Untick some, or split by a column with fewer values.`} />}
      {groups > MAX_GROUPS_WARN && groups <= MAX_GROUPS && <Message severity="warn" className="w-full" text={`“${column}” has ${groups.toLocaleString()} different values, so ${groups.toLocaleString()} ${output === 'zip' ? 'files' : 'sheets'} will be created. Is this the column you meant?`} />}
      {output === 'workbook' && included.length > 100 && <Message severity="warn" className="w-full" text="Workbooks with more than 100 sheets are slow to open in Excel. A ZIP of separate files is usually easier." />}

      <div className="card summary">
        <KpiStrip
          items={[
            ['Rows to export', `${rowsIncluded.toLocaleString()} of ${ds.rowCount.toLocaleString()}`],
            [output === 'zip' ? 'Files' : 'Sheets', `${included.length.toLocaleString()} of ${groups.toLocaleString()}`],
            ['Largest', `${result.counts[largest].toLocaleString()} · ${result.labels[largest]}`],
            ['Smallest', `${result.counts[smallest].toLocaleString()} · ${result.labels[smallest]}`],
            ...(result.blankGroup >= 0 ? [['Blank cells', result.counts[result.blankGroup].toLocaleString()]] : []),
          ]}
        />
      </div>

      <div className="card config">
        <div className="config__grid">
          <div className="field">
            <span>Output</span>
            <SelectButton value={output} options={OUTPUTS} onChange={(e) => e.value && (setOutput(e.value), touch())} allowEmpty={false} />
          </div>
          <label className="field">
            <span>{output === 'zip' ? 'File name' : 'Sheet name'} pattern</span>
            <InputText value={pattern} onChange={(e) => { setPattern(e.target.value); touch(); }} />
            <small className="muted">Use {'{value}'} for the value and {'{file}'} for the source file name. You can still edit any name below.</small>
          </label>
        </div>
      </div>

      <div className="card table-card">
        <GridTable
          count={groups}
          getRow={getRow}
          columns={columns}
          rowsKey={version}
          accept={(g) => !query || result.labels[g].toLowerCase().includes(query)}
          filterKey={query}
          sorters={{ label: (g) => result.labels[g], count: (g) => result.counts[g], pct: (g) => result.counts[g] }}
          toolbar={toolbar}
          emptyMessage="No values match your search."
          className="split-table"
        />
      </div>
    </div>
  );
}
