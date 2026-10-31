import { defineWorker, withTransfer } from '../../workers/defineWorker.js';
import { compareByKey, STAGES } from './engine.js';

// payload { keyColsA, keyColsB, pairs, options }  (see config.js toPayload)
defineWorker(({ keyColsA, keyColsB, pairs, options }, { report }) => {
  const total = keyColsA[0].length;
  report({ step: 1, steps: STAGES.length, stage: STAGES[0], fraction: null });
  const result = compareByKey(keyColsA, keyColsB, pairs, options, (fraction) => report({
    step: 2, steps: STAGES.length, stage: STAGES[1], fraction, processed: Math.round(fraction * total), total,
  }));
  return withTransfer(result, [result.status.buffer, result.rowA.buffer, result.rowB.buffer, result.changedCount.buffer]);
});
