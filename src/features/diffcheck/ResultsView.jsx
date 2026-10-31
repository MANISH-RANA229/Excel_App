import { useDeferredValue, useMemo, useState } from 'react';
import { Column } from 'primereact/column';
import { ColumnGroup } from 'primereact/columngroup';
import { Row } from 'primereact/row';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Checkbox } from 'primereact/checkbox';
import { RotateCcw, Search, X } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { BANDS, bandIndex, summarize } from '../../core/bands.js';
import { formatDuration } from '../../core/format.js';
import { explainPair } from '../../core/text/similarity.js';
import { tokenize } from '../../core/text/tokenize.js';
import GridTable from '../../shared/results/GridTable.jsx';
import ExportButton from '../../shared/results/ExportButton.jsx';
import SummaryPanel from './SummaryPanel.jsx';
import BandTag from '../../shared/results/BandTag.jsx';
import WordDiff from './WordDiff.jsx';
import { HighlightedText, highlightSets } from '../../shared/results/WordBreakdown.jsx';
import { buildDiffExport } from './exportSpec.js';
import { sideText } from './side.js';

const NO_MATCH_ROW = 2 ** 31; // sorts unmatched rows last

export default function ResultsView({ result, ms, ctx, onRestart }) {
  const { a, b, topK } = ctx;
  const [band, setBand] = useState(null);
  const [search, setSearch] = useState('');
  const [bestOnly, setBestOnly] = useState(false);
  const query = useDeferredValue(search.trim().toLowerCase());

  const summary = useMemo(() => summarize(result), [result]);
  const bandOf = useMemo(() => Uint8Array.from(result.pct, bandIndex), [result]);
  const bandNo = band == null ? -1 : BANDS.findIndex((x) => x.key === band);

  const textA = (i) => sideText(a, result.a[i]);
  const textB = (i) => (result.b[i] >= 0 ? sideText(b, result.b[i]) : '');
  const accept = (i) =>
    (bandNo < 0 || bandOf[i] === bandNo) &&
    (!bestOnly || result.rank[i] === 1) &&
    (!query || textA(i).toLowerCase().includes(query) || textB(i).toLowerCase().includes(query));

  // Only the rows on screen ever go through here.
  const getRow = (i) => {
    const ai = result.a[i];
    const bi = result.b[i];
    const aText = sideText(a, ai);
    const bText = bi >= 0 ? sideText(b, bi) : '';
    return {
      a: ai, b: bi, aText, bText, pct: result.pct[i], rank: result.rank[i],
      aRowNum: a.ds.rowNums[ai], bRowNum: bi >= 0 ? b.ds.rowNums[bi] : null,
      words: explainPair(aText, bText), emptyA: tokenize(aText).length === 0,
    };
  };

  const sorters = {
    aRowNum: (i) => a.ds.rowNums[result.a[i]],
    aText: textA,
    bRowNum: (i) => (result.b[i] >= 0 ? b.ds.rowNums[result.b[i]] : NO_MATCH_ROW),
    bText: textB,
    pct: (i) => result.pct[i],
    rank: (i) => result.rank[i],
  };

  const textCell = (side) => (r) => {
    if (side === 'b' && r.b < 0) return <span className="muted">{r.emptyA ? 'Excel 1 cell is empty' : 'No matching row'}</span>;
    const text = side === 'a' ? r.aText : r.bText;
    return <span className="cell" title={text}><HighlightedText text={text} {...highlightSets(r.words, side)} /></span>;
  };

  const columns = [
    { expander: true, className: 'col-expander' },
    { field: 'aRowNum', className: 'rownum' },
    { field: 'aText', body: textCell('a') },
    { field: 'bRowNum', className: 'rownum', body: (r) => r.bRowNum ?? '—' },
    { field: 'bText', body: textCell('b') },
    { field: 'pct', className: 'col-match', body: (r) => <BandTag pct={r.pct} /> },
    ...(topK > 1 ? [{ field: 'rank', className: 'col-rank' }] : []),
  ];

  const headerGroup = (
    <ColumnGroup>
      <Row>
        <Column rowSpan={2} headerClassName="col-expander" />
        <Column header={<span className="clip" title={a.ds.fileName}>Excel 1 · {a.ds.fileName}</span>} colSpan={2} headerClassName="group-head" />
        <Column header={<span className="clip" title={b.ds.fileName}>Excel 2 · {b.ds.fileName}</span>} colSpan={2} headerClassName="group-head" />
        <Column header="Match" field="pct" sortable rowSpan={2} headerClassName="col-match" />
        {topK > 1 && <Column header="Rank" field="rank" sortable rowSpan={2} headerClassName="col-rank" />}
      </Row>
      <Row>
        <Column header="Row" field="aRowNum" sortable headerClassName="rownum" />
        <Column header={a.column} field="aText" sortable />
        <Column header="Row" field="bRowNum" sortable headerClassName="rownum" />
        <Column header={b.column} field="bText" sortable />
      </Row>
    </ColumnGroup>
  );

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search text" aria-label="Search results" className="p-inputtext-sm w-full" />
      </IconField>
      {topK > 1 && (
        <label className="check">
          <Checkbox checked={bestOnly} onChange={(e) => setBestOnly(e.checked)} />
          <span>Best match only</span>
        </label>
      )}
      {band && (
        <button type="button" className="filter-chip" onClick={() => setBand(null)}>
          {BANDS[bandNo].label} <X size={12} aria-label="Clear band filter" />
        </button>
      )}
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} rows</span>
      <span className="toolbar__legend"><mark className="hl-match">match</mark><mark className="hl-fuzzy">typo</mark></span>
    </div>
  );

  return (
    <div className="page">
      <PageHeader
        title="Diff Check results"
        subtitle={`"${a.column}" vs "${b.column}" · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="New comparison" size="small" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton buildSpec={() => buildDiffExport(result, ctx)} />
          </>
        )}
      />

      <SummaryPanel summary={summary} ctx={ctx} unmatchedB={result.unmatchedB.length} activeBand={band} onBand={setBand} />

      <div className="card table-card">
        <GridTable
          count={result.n}
          getRow={getRow}
          columns={columns}
          accept={accept}
          filterKey={`${band}|${bestOnly}|${query}`}
          sorters={sorters}
          headerGroup={headerGroup}
          expansion={(row) => <WordDiff row={row} ctx={ctx} />}
          toolbar={toolbar}
          className="results-table"
        />
      </div>
    </div>
  );
}
