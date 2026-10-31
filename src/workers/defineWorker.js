import { serializeError } from '../core/errors.js';

// Worker side of the job protocol. Every worker is just `defineWorker(handler)`:
//   main → worker  { type: 'run', payload }
//   worker → main  { type: 'progress', fraction|null, stage, step, steps, processed, total }
//                  { type: 'done', result }          (typed arrays in a Transfer are moved, not copied)
//                  { type: 'error', error }          (serialised AppError)

const PROGRESS_INTERVAL_MS = 50;

/** Return `withTransfer(result, [typedArray.buffer, …])` from a handler to move buffers instead of copying. */
export class Transfer {
  constructor(result, list) {
    this.result = result;
    this.list = list;
  }
}
export const withTransfer = (result, list) => new Transfer(result, list);

/**
 * @param {(payload: any, ctx: { report: (p: object) => void }) => any | Promise<any>} handler
 */
export function defineWorker(handler) {
  self.onmessage = async ({ data }) => {
    if (data?.type !== 'run') return;
    let lastAt = 0;
    let lastKey = '';
    // Throttled: always delivers step changes and completion, otherwise at most every 50 ms.
    const report = (p) => {
      const key = `${p.step ?? ''}|${p.stage ?? ''}`;
      const now = performance.now();
      if (key === lastKey && p.fraction !== 1 && now - lastAt < PROGRESS_INTERVAL_MS) return;
      lastAt = now;
      lastKey = key;
      self.postMessage({ type: 'progress', ...p });
    };
    try {
      const out = await handler(data.payload, { report });
      if (out instanceof Transfer) self.postMessage({ type: 'done', result: out.result }, out.list);
      else self.postMessage({ type: 'done', result: out });
    } catch (e) {
      self.postMessage({ type: 'error', error: serializeError(e) });
    }
  };
}
