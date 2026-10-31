import { useEffect, useMemo, useRef, useState } from 'react';
import { GRID_PAGE_SIZE } from '../core/limits.js';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * Filtering, sorting and paging over *row indexes* (Int32Array), so a 500k-row result never becomes 500k objects.
 *
 * @param count      number of rows
 * @param accept     (i) => boolean — filter; read through a ref, so pass a new closure freely
 * @param filterKey  anything that changes whenever the filter outcome changes (recomputes the view)
 * @param sorters    { [field]: (i) => number | string } sort keys by column field
 * Returns { view, total, first, rows, sortField, sortOrder, onPage, onSort } — wire onPage/onSort/first/rows/
 * sortField/sortOrder/total straight into a lazy PrimeReact DataTable and render `view[first … first + rows)`.
 */
export function useGrid({ count, accept, filterKey, sorters = {}, pageSize = GRID_PAGE_SIZE }) {
  const live = useRef({ accept, sorters });
  live.current = { accept, sorters };
  const [page, setPage] = useState({ first: 0, rows: pageSize });
  const [sort, setSort] = useState({ field: null, order: 1 });

  const filtered = useMemo(() => {
    const idx = new Int32Array(count);
    const fn = live.current.accept;
    let n = 0;
    for (let i = 0; i < count; i++) if (!fn || fn(i)) idx[n++] = i;
    return idx.subarray(0, n);
  }, [count, filterKey]);

  const view = useMemo(() => {
    const get = sort.field && live.current.sorters[sort.field];
    if (!get) return filtered;
    const out = filtered.slice();
    const keys = new Array(count);
    for (let k = 0; k < out.length; k++) keys[out[k]] = get(out[k]);
    const numeric = out.length === 0 || typeof keys[out[0]] === 'number';
    const dir = sort.order < 0 ? -1 : 1;
    // index tiebreak keeps equal keys in their original order, so sorting is stable and repeatable
    out.sort(numeric
      ? (x, y) => dir * (keys[x] - keys[y]) || x - y
      : (x, y) => dir * collator.compare(keys[x], keys[y]) || x - y);
    return out;
  }, [filtered, count, sort.field, sort.order]);

  useEffect(() => { setPage((p) => (p.first ? { ...p, first: 0 } : p)); }, [filterKey, sort.field, sort.order]);

  return {
    view,
    total: view.length,
    first: page.first,
    rows: page.rows,
    sortField: sort.field,
    sortOrder: sort.field ? sort.order : 0,
    onPage: (e) => setPage({ first: e.first, rows: e.rows }),
    onSort: (e) => setSort({ field: e.sortOrder ? e.sortField : null, order: e.sortOrder || 1 }),
  };
}
