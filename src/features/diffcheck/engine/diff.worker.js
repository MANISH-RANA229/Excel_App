import { defineWorker, withTransfer } from '../../../workers/defineWorker.js';
import { runDiff } from './diffEngine.js';

defineWorker(({ textsA, textsB, options }, { report }) => {
  const total = textsA.length;
  report({ step: 1, stage: 'Indexing words', fraction: null });
  const result = runDiff(textsA, textsB, options, (fraction) => report({
    step: 2, stage: 'Matching rows', fraction, processed: Math.round(fraction * total), total,
  }));
  return withTransfer(result, [result.a.buffer, result.b.buffer, result.pct.buffer, result.rank.buffer, result.unmatchedB.buffer]);
});
