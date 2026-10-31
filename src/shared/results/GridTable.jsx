import { useMemo, useRef, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { useGrid } from '../../hooks/useGrid.js';

/**
 * Compact Excel-style results grid for any tool. Driven by accessors, not by an array of row objects:
 * only the rows on the current page are ever materialised (via getRow), so it stays fast at 500k rows.
 *
 * @param count     total rows
 * @param getRow    (i) => plain object with the values for row i (called for visible rows only)
 * @param columns   [{ field, header, body?, sortable?, className?, style?, expander? }]  body = (row) => node
 * @param accept / filterKey / sorters   see useGrid
 * @param rowsKey   change it when what getRow returns changes without the data changing (checkboxes, edited names)
 * @param expansion (row) => node — enables the row-expander column content
 * @param headerGroup  optional PrimeReact <ColumnGroup> for a grouped header
 * @param toolbar   ({ total, count }) => node — rendered above the grid (search, filters, counts)
 */
export default function GridTable({
  count, getRow, columns, accept, filterKey, rowsKey, sorters, expansion, headerGroup, toolbar,
  emptyMessage = 'No rows match the current filters.', className = '', rowsPerPageOptions = [50, 100, 250], pageSize,
}) {
  const grid = useGrid({ count, accept, filterKey, sorters, pageSize });
  const getRowRef = useRef(getRow);
  getRowRef.current = getRow;
  const [expanded, setExpanded] = useState(null);

  const pageRows = useMemo(() => {
    const rows = [];
    const end = Math.min(grid.total, grid.first + grid.rows);
    for (let k = grid.first; k < end; k++) rows.push({ ...getRowRef.current(grid.view[k]), __i: grid.view[k] });
    return rows;
  }, [grid.view, grid.first, grid.rows, grid.total, count, rowsKey]);

  return (
    <>
      {toolbar?.({ total: grid.total, count })}
      <DataTable
        value={pageRows}
        dataKey="__i"
        lazy
        paginator
        first={grid.first}
        rows={grid.rows}
        totalRecords={grid.total}
        onPage={grid.onPage}
        sortField={grid.sortField}
        sortOrder={grid.sortOrder}
        onSort={grid.onSort}
        removableSort
        rowsPerPageOptions={rowsPerPageOptions}
        paginatorTemplate="RowsPerPageDropdown CurrentPageReport FirstPageLink PrevPageLink NextPageLink LastPageLink"
        currentPageReportTemplate="{first}–{last} of {totalRecords}"
        headerColumnGroup={headerGroup}
        size="small"
        showGridlines
        scrollable
        scrollHeight="max(320px, calc(100vh - 380px))"
        tableStyle={{ minWidth: '760px' }}
        expandedRows={expanded}
        onRowToggle={(e) => setExpanded(e.data)}
        rowExpansionTemplate={expansion}
        emptyMessage={emptyMessage}
        className={`grid-table ${className}`}
      >
        {columns.map((c) => (
          <Column key={c.field ?? c.header ?? 'expander'} field={c.field} header={c.header} body={c.body} sortable={c.sortable} className={c.className} headerClassName={c.className} style={c.style} expander={c.expander} />
        ))}
      </DataTable>
    </>
  );
}
