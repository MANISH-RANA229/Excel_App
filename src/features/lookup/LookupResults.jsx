import { useDeferredValue, useMemo, useState } from 'react';
import { Button, InputText } from '../../components/ui/index.js';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { RotateCcw, Search, X } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { columnIndex, columnTexts } from '../../core/dataset/dataset.js';
import { formatDuration } from '../../core/format.js';
import { explainPair } from '../../core/text/similarity.js';
import BandTag from '../../shared/results/BandTag.jsx';
import ExportButton from '../../shared/results/ExportButton.jsx';
import GridTable from '../../shared/results/GridTable.jsx';
import KpiStrip from '../../shared/results/KpiStrip.jsx';
import StatusChips from '../../shared/results/StatusChips.jsx';
import WordBreakdown, { HighlightedText, highlightSets } from '../../shared/results/WordBreakdown.jsx';
import { NOT_FOUND } from './engine.js';
import { buildLookupExport } from './exportSpec.js';
import { STATUSES } from './status.js';

export default function LookupResults({ result, ctx, ms, onRestart }) {
  const { a, b, keyA, keyB, pull = [], threshold = 0 } = ctx || {};
  const [status, setStatus] = useState(null); // status code or null
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());

  const textA = useMemo(() => (a && keyA ? columnTexts(a, keyA) : []), [a, keyA]);
  const textB = useMemo(() => (b && keyB ? columnTexts(b, keyB) : []), [b, keyB]);
  const pullIdx = useMemo(() => (pull || []).map((c) => (b ? columnIndex(b, c) : -1)), [pull, b]);
  const counts = useMemo(() => {
    const c = [0, 0, 0];
    if (result?.status) {
      for (let i = 0; i < result.n; i++) {
        if (result.status[i] in c) c[result.status[i]]++;
      }
    }
    return c;
  }, [result]);

  const accept = (i) =>
    (status == null || result?.status?.[i] === status) &&
    (!query || (textA[i] && textA[i].toLowerCase().includes(query)) || (result?.b && result.b[i] >= 0 && textB[result.b[i]] && textB[result.b[i]].toLowerCase().includes(query)));

  const getRow = (i) => {
    const j = result?.b?.[i] ?? -1;
    const aKey = textA[i] ?? '';
    const bKey = j >= 0 ? (textB[j] ?? '') : '';
    const words = explainPair(aKey, bKey);
    const st = result?.status?.[i] ?? 0;
    const pulls = st !== NOT_FOUND && j >= 0; // a row below the threshold pulls nothing in
    return {
      i,
      j,
      aRowNum: a?.rowNums?.[i] ?? i + 1,
      bRowNum: j >= 0 ? (b?.rowNums?.[j] ?? j + 1) : null,
      aKey,
      bKey,
      pct: result?.pct?.[i] ?? 0,
      status: st,
      pulled: pullIdx.map((k) => (pulls && k >= 0 && b?.text?.[k] ? b.text[k][j] : '')),
      words,
    };
  };

  const columns = [
    { expander: true, className: 'col-expander' },
    { field: 'aRowNum', header: 'Row', sortable: true, style: { width: '1%' }, className: 'rownum' },
    {
      field: 'aKey', header: keyA ?? 'Key A', sortable: true,
      body: ({ aKey, words }) => <span className="cell clip" title={aKey}>{words ? <HighlightedText text={aKey} sets={highlightSets(words, 'a')} /> : aKey}</span>,
    },
    { field: 'bRowNum', header: 'Ref row', sortable: true, style: { width: '1%' }, className: 'rownum', body: (r) => r.bRowNum ?? '—' },
    {
      field: 'bKey', header: keyB ?? 'Key B', sortable: true,
      body: ({ bKey, words, j, status: s }) => (j < 0
        ? <span className="muted">No similar row</span>
        : (
          <span className={`cell clip${s === NOT_FOUND ? ' muted' : ''}`} title={bKey}>
            {s === NOT_FOUND ? <>nearest: {bKey}</> : <HighlightedText text={bKey} sets={highlightSets(words, 'b')} />}
          </span>
        )),
    },
    { field: 'pct', header: 'Match', sortable: true, className: 'col-match', style: { width: '1%' }, body: (r) => <BandTag pct={r.pct} /> },
    {
      field: 'status', header: 'Status', sortable: true, className: 'col-status', style: { width: '1%' },
      body: ({ status: s }) => {
        const meta = STATUSES[s] || { label: 'Unknown' };
        return <span className="band-tag" style={{ background: meta.bg, color: meta.fg }}><strong>{meta.label}</strong></span>;
      },
    },
    ...(pull || []).map((c, k) => ({
      field: `pull_${k}`, header: c, sortable: true,
      body: (r) => <span className="cell clip" title={r.pulled?.[k]}>{r.pulled?.[k] || <span className="muted">—</span>}</span>,
    })),
  ];

  const sorters = {
    aRowNum: (i) => a?.rowNums?.[i] ?? i,
    aKey: (i) => (textA[i] ?? '').toLowerCase(),
    bRowNum: (i) => (result?.b && result.b[i] >= 0 ? (b?.rowNums?.[result.b[i]] ?? result.b[i]) : Infinity),
    bKey: (i) => (result?.b && result.b[i] >= 0 ? (textB[result.b[i]] ?? '').toLowerCase() : '\uffff'),
    pct: (i) => result?.pct?.[i] ?? 0,
    status: (i) => result?.status?.[i] ?? 0,
    ...Object.fromEntries((pull || []).map((_, k) => [`pull_${k}`, (i) => (result?.b && result.b[i] >= 0 && result.status[i] !== NOT_FOUND && pullIdx[k] >= 0 && b?.text?.[pullIdx[k]] ? String(b.text[pullIdx[k]][result.b[i]] ?? '').toLowerCase() : '')])),
  };

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search matched text" aria-label="Search matched text" size="sm" className="w-full" />
      </IconField>
      {status != null && STATUSES[status] && (
        <button type="button" className="filter-chip" onClick={() => setStatus(null)}>
          {STATUSES[status].label} <X size={12} aria-label="Clear status filter" />
        </button>
      )}
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} rows</span>
      <span className="toolbar__legend"><mark className="hl-match">match</mark><mark className="hl-fuzzy">typo</mark></span>
    </div>
  );

  return (
    <div className="page">
      <PageHeader
        title="Fuzzy Lookup results"
        subtitle={`“${keyA ?? ''}” → “${keyB ?? ''}” · at least ${threshold}% · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="New lookup" size="sm" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton label="Download merged file" buildSpec={() => buildLookupExport(result, ctx)} />
          </>
        )}
      />

      <div className="card summary">
        <KpiStrip
          items={[
            ['Excel 1 rows', (result?.n ?? 0).toLocaleString()],
            ['Matched', (counts[0] ?? 0).toLocaleString()],
            ['Ambiguous', (counts[1] ?? 0).toLocaleString()],
            ['Not found', (counts[2] ?? 0).toLocaleString()],
            ['Reference rows never used', (result?.unusedB?.length ?? 0).toLocaleString()],
          ]}
        />
        <div className="dist">
          <div className="bandbar" role="img" aria-label="Matched, ambiguous and not found rows">
            {STATUSES.map((s, code) => (counts[code] ?? 0) > 0 && <span key={s.key} style={{ flexGrow: counts[code], background: s.color }} title={`${s.label}: ${counts[code]}`} />)}
          </div>
          <StatusChips
            label="Filter by status"
            active={status == null ? null : STATUSES[status]?.key}
            onSelect={(key) => setStatus(key == null ? null : STATUSES.findIndex((s) => s.key === key))}
            items={STATUSES.map((s, code) => ({ key: s.key, label: s.label, count: counts[code] ?? 0, color: s.color }))}
          />
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
          expansion={(r) => (
            <WordBreakdown
              aText={r.aKey}
              bText={r.bKey}
              hasB={r.j >= 0}
              words={r.words}
              extra={r.status === NOT_FOUND ? [['Why', `Best candidate scored ${r.pct}%, below the ${threshold}% minimum, so nothing was pulled in.`]] : r.status === 1 ? [['Check', `Another reference row scored ${result?.runnerUp?.[r.i] ?? 0}%, almost as good as ${r.pct}%.`]] : []}
            />
          )}
          toolbar={toolbar}
          className="lookup-table"
        />
      </div>
    </div>
  );
}
