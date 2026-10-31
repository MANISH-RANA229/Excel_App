import { defineWorker, withTransfer } from '../../workers/defineWorker.js';
import { groupRows } from '../../core/group/groupRows.js';

defineWorker(({ values, options }, { report }) => {
  const total = values.length;
  const result = groupRows(values, options, (fraction) => report({
    step: 1, stage: 'Grouping rows', fraction, processed: Math.round(fraction * total), total,
  }));
  return withTransfer(result, [result.counts.buffer, result.offsets.buffer, result.order.buffer]);
});
