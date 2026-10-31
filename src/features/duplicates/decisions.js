/**
 * Applies the user's review choices to the engine result.
 *   keepOverride  Map<group, row>  — the user picked a different row to keep
 *   ignored       Set<group>       — the user said "these are not duplicates"
 * @returns {{ removed: Uint8Array, keepOf: Int32Array, groupNo: Int32Array,
 *             stats: { groups, rowsInGroups, toRemove, unique } }}
 *   removed[row] = 1 when the row would be deleted; keepOf[row] = the surviving row of its group (−1 if none);
 *   groupNo[row] = 1-based group number (0 = not in an active group).
 */
export function applyDecisions(result, { keepOverride = new Map(), ignored = new Set() } = {}) {
  const { n, groupCount, groupStart, members, keep } = result;
  const removed = new Uint8Array(n);
  const keepOf = new Int32Array(n).fill(-1);
  const groupNo = new Uint32Array(n);
  let groups = 0;
  let rowsInGroups = 0;
  let toRemove = 0;
  for (let g = 0; g < groupCount; g++) {
    if (ignored.has(g)) continue;
    const kept = keepOverride.get(g) ?? keep[g];
    groups++;
    for (let k = groupStart[g]; k < groupStart[g + 1]; k++) {
      const row = members[k];
      groupNo[row] = g + 1;
      keepOf[row] = kept;
      rowsInGroups++;
      if (row !== kept) { removed[row] = 1; toRemove++; }
    }
  }
  return { removed, keepOf, groupNo, stats: { groups, rowsInGroups, toRemove, unique: n - toRemove } };
}
