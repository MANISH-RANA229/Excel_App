import { defineWorker, withTransfer } from '../../workers/defineWorker.js';
import { prepareSide, reconcile } from './engine.js';

// payload { a, b, prepare, options }  (see config.js toPayload)
defineWorker(({ a, b, prepare, options }, { report }) => {
  report({ step: 1, stage: 'Reading amounts and dates', fraction: null });
  const pa = prepareSide(a, prepare);
  const pb = prepareSide(b, prepare);
  const result = reconcile(pa, pb, options, ({ step, steps, stage, fraction }) => report({ step: step + 1, steps: steps + 1, stage, fraction }));
  const out = { ...result, amountA: pa.amount, amountB: pb.amount };
  return withTransfer(out, [
    out.status.buffer, out.pass.buffer, out.startA.buffer, out.rowsA.buffer, out.startB.buffer, out.rowsB.buffer,
    out.repA.buffer, out.repB.buffer, out.countA.buffer, out.countB.buffer, out.sumA.buffer, out.sumB.buffer, out.diff.buffer,
    out.amountA.buffer, out.amountB.buffer,
  ]);
});
