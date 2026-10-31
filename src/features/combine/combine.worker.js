import { defineWorker, withTransfer } from '../../workers/defineWorker.js';
import { combineTables } from './engine.js';

// payload { sources: Dataset[], options }
defineWorker(({ sources, options }, { report }) => {
  const total = sources.reduce((n, s) => n + s.rowCount, 0);
  const stage = 'Stacking rows';
  report({ step: 1, stage, fraction: null });
  const result = combineTables(sources, options, (fraction) => report({ step: 1, stage, fraction, processed: Math.round(fraction * total), total }));
  return withTransfer(result, result.table.columns.flatMap((c) => (c.nums ? [c.nums.buffer] : [])));
});
