import { defineWorker, withTransfer } from '../../workers/defineWorker.js';
import { MODES } from './config.js';
import { summarize } from './engine.js';
import { transpose, unpivot } from './reshape.js';

// payload { mode, input, options }  (see config.js toPayload)
defineWorker(({ mode, input, options }, { report }) => {
  const total = input.rowCount;
  const stage = MODES.find((m) => m.id === mode).stage;
  const progress = (fraction) => report({ step: 1, stage, fraction, processed: Math.round(fraction * total), total });
  report({ step: 1, stage, fraction: null });
  const run = mode === 'unpivot' ? unpivot : mode === 'transpose' ? transpose : summarize;
  const result = { ...run(input, options, progress), mode };
  return withTransfer(result, result.table.columns.flatMap((c) => (c.nums ? [c.nums.buffer] : [])));
});
