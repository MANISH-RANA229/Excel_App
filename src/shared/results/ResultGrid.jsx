import { useDeferredValue, useState } from 'react';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from '../../components/ui/index.js';
import { Search } from 'lucide-react';
import { isDateFormat } from '../../core/dataset/dataset.js';
import { formatSerial } from '../../core/parse/date.js';
import GridTable from './GridTable.jsx';

function formatNumber(v, fmt) {
  if (isDateFormat(fmt)) return formatSerial(v);
  const two = /0\.00/.test(fmt ?? '');
  return v.toLocaleString(undefined, { minimumFractionDigits: two ? 2 : 0, maximumFractionDigits: two ? 2 : 4 });
}

/**
 * A computed table as a searchable, sortable grid. The table is the same shape the export takes:
 *   { rowCount, columns: [{ header, text?: string[], nums?: Float64Array, numFmt? }] }
 * A column with `text` shows its text; a column with only `nums` shows formatted numbers, right-aligned.
 */
export default function ResultGrid({ table, searchLabel = 'Search the result', className = '' }) {
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());

  const display = (c, i) => {
    const t = c.text?.[i];
    if (t) return t;
    const v = c.nums?.[i];
    return v === undefined || Number.isNaN(v) ? '' : formatNumber(v, c.numFmt);
  };
  const getRow = (i) => Object.fromEntries(table.columns.map((c, k) => [`c${k}`, display(c, i)]));
  const accept = (i) => !query || table.columns.some((c) => c.text && c.text[i].toLowerCase().includes(query));
  const columns = table.columns.map((c, k) => ({
    field: `c${k}`, header: c.header, sortable: true,
    className: c.text ? undefined : 'num',
    body: (r) => <span className={c.text ? 'cell' : 'num'} title={r[`c${k}`]}>{r[`c${k}`]}</span>,
  }));
  const sorters = Object.fromEntries(table.columns.map((c, k) => [`c${k}`, c.text
    ? (i) => (Number.isNaN(c.nums?.[i] ?? NaN) ? c.text[i].toLowerCase() : c.nums[i])
    : (i) => (Number.isNaN(c.nums[i]) ? -Infinity : c.nums[i])]));

  const toolbar = ({ total, count }) => (
    <div className="toolbar">
      <IconField iconPosition="left" className="toolbar__search">
        <InputIcon><Search size={14} /></InputIcon>
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchLabel} aria-label={searchLabel} size="sm" className="w-full" />
      </IconField>
      <span className="toolbar__count">{total.toLocaleString()} of {count.toLocaleString()} rows</span>
    </div>
  );

  return (
    <GridTable
      count={table.rowCount}
      getRow={getRow}
      columns={columns}
      accept={accept}
      filterKey={query}
      sorters={sorters}
      toolbar={toolbar}
      className={className}
    />
  );
}
