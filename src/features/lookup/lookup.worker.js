import { defineWorker, withTransfer } from '../../workers/defineWorker.js';
import { runLookup } from './engine.js';

defineWorker(({ textsA, textsB, options }, { report }) => {
  const total = textsA.length;
  report({ step: 1, stage: 'Indexing words', fraction: null });
  const result = runLookup(textsA, textsB, options, (fraction) => report({
    step: 2, stage: 'Looking up rows', fraction, processed: Math.round(fraction * total), total,
  }));
  return withTransfer(result, [result.b.buffer, result.pct.buffer, result.runnerUp.buffer, result.status.buffer, result.unusedB.buffer]);
});
