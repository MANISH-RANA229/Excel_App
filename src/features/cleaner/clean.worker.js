import { defineWorker, withTransfer } from '../../workers/defineWorker.js';
import { runPipeline } from '../../core/clean/pipeline.js';

defineWorker(({ table, steps }, { report }) => {
  report({ step: 1, stage: 'Cleaning cells', fraction: null });
  const result = runPipeline(table, steps, {
    report: (fraction) => report({ step: 1, stage: 'Cleaning cells', fraction, processed: Math.round(fraction * table.rowCount), total: table.rowCount }),
  });
  const buffers = [
    ...result.modified.flatMap((m) => [m.changed.buffer, ...(m.nums ? [m.nums.buffer] : [])]),
    ...(result.keepRows ? [result.keepRows.buffer] : []),
    result.log.row.buffer, result.log.col.buffer, result.log.step.buffer,
  ];
  return withTransfer({ ...result, names: table.names }, buffers);
});
