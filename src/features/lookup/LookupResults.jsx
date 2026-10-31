import { useDeferredValue, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
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
  const { a, b, keyA, keyB, pull, threshold } = ctx;
  const [status, setStatus] = useState(null); // status code or null
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());

  const textA = useMemo(() => columnTexts(a, keyA), [a, keyA]);
  const textB = useMemo(() => columnTexts(b, keyB), [b, keyB]);
  const pullIdx = pull.map((c) => columnIndex(b, c));
  const counts = useMemo(() => {
    const c = [0, 0, 0];
    for (let i = 0; i < result.n; i++) c[result.status[i]]++;
    return c;
  }, [result]);

  const accept = (i) =>
    (status == null || result.status[i] === status) &&
    (!query || textA[i].toLowerCase().includes(query) || (result.b[i] >= 0 && textB[result.b[i]].toLowerCase().includes(query)));

  const getRow = (i) => {
    const j = result.b[i];
    const st = result.status[i];
    const pulls = st !== NOT_FOUND && j >= 0;
    return {
      i, status: st, pct: result.pct[i], aRowNum: a.rowNums[i], aKey: textA[i], j, bKey: j >= 0 ? textB[j] : '',
      pulled: pullIdx.map((c) => (pulls ? b.text[c][j] : '')),
      words: explainPair(textA[i], j >= 0 ? textB[j] : ''),
    };
  };

  const columns = [
    { expander: true, className: 'col-expander' },
    { field: 'aRowNum', header: 'Row', sortable: true, className: 'rownum' },
    { field: 'aKey', header: `Excel 1 · ${keyA}`, sortable: true, body: (r) => <span className="cell" title={r.aKey}><HighlightedText text={r.aKey} {...highlightSets(r.words, 'a')} /></span> },
    { field: 'bKey', header: `Excel 2 · ${keyB}`, sortable: true, body: (r) => (r.j < 0
      ? <span className="muted">No similar row</span>
      : <span className={`cell${r.status === NOT_FOUND ? ' muted' : ''}`} title={r.bKey}>
        {r.status === NOT_FOUND ? <>nearest: {r.bKey}</> : <HighlightedText text={r.bKey} {...highlightSets(r.words, 'b')} />}
      </span>) },
    ...pull.map((c, k) => ({ field: `pull${k}`, header: c, body: (r) => <span className="cell" title={r.pulled[k]}>{r.pulled[k]}</span> })),
    { field: 'pct', header: 'Match', sortable: true, className: 'col-match', body: (r) => <BandTag pct={r.pct} /> },
    { field: 'status', header: 'Status', sortable: true, className: 'col-status', body: (r) => {
      const s = STATUSES[r.status];
      return <span className="band-tag" style={{ background: s.bg, color: s.fg }}><strong>{s.label}</strong></span>;
    } },
  ];
  const sorters = {
    aRowNum: (i) => a.rowNums[i], aKey: (i) => textA[i], bKey: (i) => (result.b[i] >= 0 ? textB[result.b[i]] : ''),
    pct: (i) => result.pct[i], status: (i) => result.status[i],
  };

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search text" aria-label="Search results" className="p-inputtext-sm w-full" />
      </IconField>
      {status != null && (
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
        subtitle={`“${keyA}” → “${keyB}” · at least ${threshold}% · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="New lookup" size="small" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton label="Download merged file" buildSpec={() => buildLookupExport(result, ctx)} />
          </>
        )}
      />

      <div className="card summary">
        <KpiStrip
          items={[
            ['Excel 1 rows', result.n.toLocaleString()],
            ['Matched', counts[0].toLocaleString()],
            ['Ambiguous', counts[1].toLocaleString()],
            ['Not found', counts[2].toLocaleString()],
            ['Reference rows never used', result.unusedB.length.toLocaleString()],
          ]}
        />
        <div className="dist">
          <div className="bandbar" role="img" aria-label="Matched, ambiguous and not found rows">
            {STATUSES.map((s, code) => counts[code] > 0 && <span key={s.key} style={{ flexGrow: counts[code], background: s.color }} title={`${s.label}: ${counts[code]}`} />)}
          </div>
          <StatusChips
            label="Filter by status"
            active={status == null ? null : STATUSES[status].key}
            onSelect={(key) => setStatus(key == null ? null : STATUSES.findIndex((s) => s.key === key))}
            items={STATUSES.map((s, code) => ({ key: s.key, label: s.label, count: counts[code], color: s.color }))}
          />
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
          expansion={(r) => (
            <WordBreakdown
              aText={r.aKey}
              bText={r.bKey}
              hasB={r.j >= 0}
              words={r.words}
              extra={r.status === NOT_FOUND ? [['Why', `Best candidate scored ${r.pct}%, below the ${threshold}% minimum, so nothing was pulled in.`]] : r.status === 1 ? [['Check', `Another reference row scored ${result.runnerUp[r.i]}%, almost as good as ${r.pct}%.`]] : []}
            />
          )}
          toolbar={toolbar}
          className="lookup-table"
        />
      </div>
    </div>
  );
}
