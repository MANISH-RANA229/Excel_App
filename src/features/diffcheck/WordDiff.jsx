import WordBreakdown from '../../shared/results/WordBreakdown.jsx';
import { carryText } from './side.js';

/** Diff Check's expanded row: the shared word breakdown plus the carry-along columns the user picked. row = a grid row from ResultsView. */
export default function WordDiff({ row, ctx }) {
  const rowA = row?.ai ?? row?.a ?? 0;
  const rowB = row?.bi ?? row?.b ?? -1;
  const extra = [
    ...(ctx?.a?.carry || []).map((c, k) => [`Excel 1 · ${c}`, carryText(ctx.a, k, rowA)]),
    ...(rowB >= 0 ? (ctx?.b?.carry || []).map((c, k) => [`Excel 2 · ${c}`, carryText(ctx.b, k, rowB)]) : []),
  ];
  return <WordBreakdown aText={row?.aText ?? ''} bText={row?.bText ?? ''} hasB={rowB >= 0} words={row?.words ?? row?.explanation} extra={extra} />;
}
