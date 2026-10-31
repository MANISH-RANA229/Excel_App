import { defineWorker, withTransfer } from '../../workers/defineWorker.js';
import { findDuplicates } from './engine.js';

defineWorker(({ keyColumns, options }, { report }) => {
  const total = keyColumns[0].length;
  const similar = options.mode === 'similar';
  report({ step: 1, stage: similar ? 'Indexing words' : 'Reading keys', fraction: null });
  const result = findDuplicates(keyColumns, options, (fraction) => report({
    step: 2, stage: similar ? 'Comparing rows' : 'Finding duplicates', fraction, processed: Math.round(fraction * total), total,
  }));
  return withTransfer(result, [result.groupOf.buffer, result.groupStart.buffer, result.members.buffer, result.keep.buffer, result.minScore.buffer]);
});
