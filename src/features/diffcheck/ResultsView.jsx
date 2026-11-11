import { useDeferredValue, useMemo, useState } from 'react';
import { Column } from 'primereact/column';
import { ColumnGroup } from 'primereact/columngroup';
import { Row } from 'primereact/row';
import { Button, Checkbox, InputText } from '../../components/ui/index.js';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
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
  const { a, b, topK = 1 } = ctx || {};
  const [band, setBand] = useState(null);
  const [search, setSearch] = useState('');
  const [bestOnly, setBestOnly] = useState(false);
  const query = useDeferredValue(search.trim().toLowerCase());

  const dsA = a?.ds || a?.dataset;
  const dsB = b?.ds || b?.dataset;
  const nameA = dsA?.fileName ?? 'Excel 1';
  const nameB = dsB?.fileName ?? 'Excel 2';
  const colA = a?.column ?? 'Excel 1';
  const colB = b?.column ?? 'Excel 2';

  const summary = useMemo(() => (result ? summarize(result) : { counts: { strong: 0, good: 0, partial: 0, weak: 0, none: 0 }, total: 0, avg: 0 }), [result]);
  const bandOf = useMemo(() => (result?.pct ? Uint8Array.from(result.pct, bandIndex) : new Uint8Array(0)), [result]);
  const bandNo = band == null ? -1 : BANDS.findIndex((x) => x.key === band);

  const textA = (i) => (a && result?.a ? sideText(a, result.a[i]) : '');
  const textB = (i) => (b && result?.b && result.b[i] >= 0 ? sideText(b, result.b[i]) : '');
  const accept = (i) =>
    (bandNo < 0 || bandOf[i] === bandNo) &&
    (!bestOnly || result?.rank?.[i] === 1) &&
    (!query || textA(i).toLowerCase().includes(query) || textB(i).toLowerCase().includes(query));

  // Only the rows on screen ever go through here.
  const getRow = (i) => {
    const ai = result?.a?.[i] ?? 0;
    const bi = result?.b?.[i] ?? -1;
    const aText = textA(i);
    const bText = textB(i);
    // explainPair takes the two cell texts (it tokenizes them itself)
    const explanation = explainPair(aText, bText);
    return {
      emptyA: tokenize(aText).length === 0,
      index: i,
      aRowNum: dsA?.rowNums?.[ai] ?? ai + 1,
      bRowNum: bi >= 0 ? (dsB?.rowNums?.[bi] ?? bi + 1) : null,
      aText,
      bText,
      explanation,
      words: explanation,
      pct: result?.pct?.[i] ?? 0,
      rank: result?.rank?.[i] ?? 1,
      ai,
      bi,
      a: ai,
      b: bi,
    };
  };

  const columns = [
    { expander: true, className: 'col-expander', style: { width: '2.5rem' } },
    { field: 'aRowNum', header: 'Row', sortable: true, style: { width: '1%' }, className: 'rownum' },
    {
      field: 'aText',
      header: colA,
      sortable: true,
      style: { width: '45%' },
      body: ({ aText, explanation }) => (
        <span className="cell clip" title={aText}>
          <HighlightedText text={aText} sets={highlightSets(explanation, 'a')} />
        </span>
      ),
    },
    { field: 'bRowNum', header: 'Row', sortable: true, style: { width: '1%' }, className: 'rownum', body: (r) => r.bRowNum ?? '—' },
    {
      field: 'bText',
      header: colB,
      sortable: true,
      style: { width: '45%' },
      body: ({ bText, explanation, bi, emptyA }) => (bi < 0
        ? <span className="muted">{emptyA ? 'Excel 1 cell is empty' : 'No matching row'}</span>
        : (
          <span className="cell clip" title={bText}>
            <HighlightedText text={bText} sets={highlightSets(explanation, 'b')} />
          </span>
        )),
    },
    {
      field: 'pct',
      header: 'Match',
      sortable: true,
      style: { width: '1%' },
      className: 'col-match num',
      body: ({ pct }) => <BandTag pct={pct} />,
    },
    ...(topK > 1 ? [{ field: 'rank', header: 'Rank', sortable: true, style: { width: '1%' }, className: 'col-rank' }] : []),
  ];

  const sorters = {
    aRowNum: (i) => (dsA?.rowNums && result?.a ? dsA.rowNums[result.a[i]] : (result?.a?.[i] ?? i)),
    aText: (i) => textA(i).toLowerCase(),
    bRowNum: (i) => (result?.b && result.b[i] >= 0 ? (dsB?.rowNums ? dsB.rowNums[result.b[i]] : result.b[i]) : NO_MATCH_ROW),
    bText: (i) => (result?.b && result.b[i] >= 0 ? textB(i).toLowerCase() : '\uffff'),
    pct: (i) => result?.pct?.[i] ?? 0,
    rank: (i) => result?.rank?.[i] ?? 1,
  };

  const headerGroup = (
    <ColumnGroup>
      <Row>
        <Column header="" rowSpan={2} className="col-expander" style={{ width: '2.5rem' }} />
        <Column header={`Excel 1 · ${nameA}`} colSpan={2} className="group-head" style={{ width: '48%' }} />
        <Column header={`Excel 2 · ${nameB}`} colSpan={2} className="group-head" style={{ width: '48%' }} />
        <Column header="Match" field="pct" sortable rowSpan={2} className="col-match" style={{ width: '1%' }} />
        {topK > 1 && <Column header="Rank" field="rank" sortable rowSpan={2} className="col-rank" style={{ width: '1%' }} />}
      </Row>
      <Row>
        <Column header="Row" field="aRowNum" sortable headerClassName="rownum" style={{ width: '1%' }} />
        <Column header={colA} field="aText" sortable style={{ width: '45%' }} />
        <Column header="Row" field="bRowNum" sortable headerClassName="rownum" style={{ width: '1%' }} />
        <Column header={colB} field="bText" sortable style={{ width: '45%' }} />
      </Row>
    </ColumnGroup>
  );

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search text" aria-label="Search results" size="sm" className="w-full" />
      </IconField>
      {topK > 1 && (
        <label className="check">
          <Checkbox checked={bestOnly} onChange={(e) => setBestOnly(e.checked)} />
          <span>Best match only</span>
        </label>
      )}
      {band && (
        <button type="button" className="filter-chip" onClick={() => setBand(null)}>
          {BANDS[bandNo]?.label ?? band} <X size={12} aria-label="Clear band filter" />
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
        subtitle={`"${colA}" vs "${colB}" · ${formatDuration(ms)}`}
        actions={(
          <>
            <Button label="New comparison" size="sm" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <ExportButton buildSpec={() => buildDiffExport(result, ctx)} />
          </>
        )}
      />

      <SummaryPanel summary={summary} ctx={ctx} unmatchedB={result?.unmatchedB?.length ?? 0} activeBand={band} onBand={setBand} />

      <div className="card table-card">
        <GridTable
          count={result?.n ?? 0}
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
