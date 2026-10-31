import { useMemo, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { ColumnGroup } from 'primereact/columngroup';
import { Row } from 'primereact/row';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Checkbox } from 'primereact/checkbox';
import { Message } from 'primereact/message';
import { Download, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import { BANDS, getBand, summarize } from './bands.js';
import { exportDiffExcel } from './exportExcel.js';
import SummaryPanel from './SummaryPanel.jsx';
import BandTag from './BandTag.jsx';
import WordDiff, { HighlightedText, highlightSets } from './WordDiff.jsx';

const duration = (ms) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

export default function ResultsView({ result, ctx, onEdit, onRestart }) {
  const [band, setBand] = useState(null);
  const [search, setSearch] = useState('');
  const [bestOnly, setBestOnly] = useState(false);
  const [expandedRows, setExpandedRows] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const summary = useMemo(() => summarize(result.rows), [result]);
  const rows = useMemo(
    () => result.rows.map((r, id) => ({
      ...r,
      id,
      aRowNum: ctx.a.rowNums[r.a],
      aText: ctx.a.rows[r.a][ctx.a.column],
      bRowNum: r.b >= 0 ? ctx.b.rowNums[r.b] : null,
      bText: r.b >= 0 ? ctx.b.rows[r.b][ctx.b.column] : '',
      band: getBand(r.pct).key,
    })),
    [result, ctx],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (!band || r.band === band) &&
      (!bestOnly || r.rank === 1) &&
      (!q || r.aText.toLowerCase().includes(q) || r.bText.toLowerCase().includes(q)));
  }, [rows, band, bestOnly, search]);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      await exportDiffExcel(result, ctx);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  const textCell = (side) => (r) => {
    if (side === 'b' && r.b < 0) return <span className="muted">{r.emptyA ? 'Excel 1 cell is empty' : 'No matching row'}</span>;
    const text = side === 'a' ? r.aText : r.bText;
    return <span className="cell" title={text}><HighlightedText text={text} {...highlightSets(r, side)} /></span>;
  };

  const headerGroup = (
    <ColumnGroup>
      <Row>
        <Column rowSpan={2} headerClassName="col-expander" />
        <Column header={<span className="clip" title={ctx.a.fileName}>Excel 1 · {ctx.a.fileName}</span>} colSpan={2} headerClassName="group-head" />
        <Column header={<span className="clip" title={ctx.b.fileName}>Excel 2 · {ctx.b.fileName}</span>} colSpan={2} headerClassName="group-head" />
        <Column header="Match" field="pct" sortable rowSpan={2} headerClassName="col-match" />
        {ctx.topK > 1 && <Column header="Rank" field="rank" sortable rowSpan={2} headerClassName="col-rank" />}
      </Row>
      <Row>
        <Column header="Row" field="aRowNum" sortable headerClassName="rownum" />
        <Column header={ctx.a.column} field="aText" sortable />
        <Column header="Row" field="bRowNum" sortable headerClassName="rownum" />
        <Column header={ctx.b.column} field="bText" sortable />
      </Row>
    </ColumnGroup>
  );

  return (
    <div className="page">
      <PageHeader
        title="Diff Check results"
        subtitle={`"${ctx.a.column}" vs "${ctx.b.column}" · ${duration(result.ms)}`}
        actions={(
          <>
            <Button label="Settings" size="small" outlined severity="secondary" icon={<SlidersHorizontal size={14} />} onClick={onEdit} />
            <Button label="New comparison" size="small" text severity="secondary" icon={<RotateCcw size={14} />} onClick={onRestart} />
            <Button label="Download Excel" size="small" icon={<Download size={14} />} loading={downloading} onClick={download} />
          </>
        )}
      />

      {error && <Message severity="error" text={error} className="w-full" />}

      <SummaryPanel summary={summary} ctx={ctx} unmatchedB={result.unmatchedB.length} activeBand={band} onBand={setBand} />

      <div className="card table-card">
        <div className="toolbar">
          <IconField iconPosition="left" className="toolbar__search">
            <InputIcon><Search size={14} /></InputIcon>
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search text" aria-label="Search results" className="p-inputtext-sm w-full" />
          </IconField>
          {ctx.topK > 1 && (
            <label className="check">
              <Checkbox checked={bestOnly} onChange={(e) => setBestOnly(e.checked)} />
              <span>Best match only</span>
            </label>
          )}
          {band && (
            <button type="button" className="filter-chip" onClick={() => setBand(null)}>
              {BANDS.find((b) => b.key === band).label} <X size={12} aria-label="Clear band filter" />
            </button>
          )}
          <span className="toolbar__count">{filtered.length.toLocaleString()} of {rows.length.toLocaleString()} rows</span>
          <span className="toolbar__legend"><mark className="hl-match">match</mark><mark className="hl-fuzzy">typo</mark></span>
        </div>

        <DataTable
          value={filtered}
          dataKey="id"
          headerColumnGroup={headerGroup}
          size="small"
          showGridlines
          scrollable
          scrollHeight="max(320px, calc(100vh - 380px))"
          tableStyle={{ minWidth: '760px' }}
          paginator
          rows={50}
          rowsPerPageOptions={[50, 100, 250]}
          paginatorTemplate="RowsPerPageDropdown CurrentPageReport FirstPageLink PrevPageLink NextPageLink LastPageLink"
          currentPageReportTemplate="{first}–{last} of {totalRecords}"
          removableSort
          expandedRows={expandedRows}
          onRowToggle={(e) => setExpandedRows(e.data)}
          rowExpansionTemplate={(r) => <WordDiff row={r} ctx={ctx} />}
          emptyMessage="No rows match the current filters."
          className="grid-table results-table"
        >
          <Column expander className="col-expander" />
          <Column field="aRowNum" className="rownum" />
          <Column field="aText" body={textCell('a')} />
          <Column field="bRowNum" className="rownum" body={(r) => r.bRowNum ?? '—'} />
          <Column field="bText" body={textCell('b')} />
          <Column field="pct" className="col-match" body={(r) => <BandTag pct={r.pct} />} />
          {ctx.topK > 1 && <Column field="rank" className="col-rank" />}
        </DataTable>
      </div>
    </div>
  );
}
