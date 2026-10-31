import { GROUPS, STATUSES } from './status.js';

/**
 * Counts and money per outcome group, plus the headline figure: what is still unreconciled.
 * @param result  reconcile() output
 * @returns {{ groups: Record<string, { count: number, sumA: number, sumB: number, net: number }>, unreconciled: number, totals: object }}
 *   sumA / sumB add up the amounts each file contributes to the group; net = sumA − sumB.
 */
export function summarizeRecon(result) {
  const groups = Object.fromEntries(GROUPS.map((g) => [g.key, { count: 0, sumA: 0, sumB: 0, net: 0 }]));
  for (let i = 0; i < result.n; i++) {
    const g = groups[STATUSES[result.status[i]].group];
    g.count++;
    if (!Number.isNaN(result.sumA[i])) g.sumA += result.sumA[i];
    if (!Number.isNaN(result.sumB[i])) g.sumB += result.sumB[i];
  }
  for (const g of Object.values(groups)) g.net = g.sumA - g.sumB;
  return { groups, unreconciled: result.totals.sumA - result.totals.sumB, totals: result.totals };
}

export const money = (n) => (Number.isNaN(n) ? '' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
