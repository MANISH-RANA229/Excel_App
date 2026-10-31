import { runColumns } from '../../core/columns/pipeline.js';
import { defineWorker, withTransfer } from '../../workers/defineWorker.js';

// payload { table, steps, options }  (see table.js)
defineWorker(({ table, steps, options }, { report }) => {
  const stage = 'Working out the new columns';
  report({ step: 1, stage, fraction: null });
  const result = runColumns(table, steps, options, (fraction) => report({ step: 1, stage, fraction, processed: Math.round(fraction * table.rowCount), total: table.rowCount }));
  return withTransfer(result, result.added.flatMap((c) => [...(c.nums ? [c.nums.buffer] : []), ...(c.failed ? [c.failed.buffer] : [])]));
});
