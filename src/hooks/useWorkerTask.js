import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError, reviveError } from '../core/errors.js';
import { estimateEta } from '../core/format.js';

const TICK_MS = 250;
const IDLE = { status: 'idle', progress: null, result: null, error: null, elapsedMs: 0, etaMs: null };

/**
 * Runs one job at a time in a Web Worker (see workers/defineWorker.js for the protocol).
 * `createWorker` must be `() => new Worker(new URL('./x.worker.js', import.meta.url), { type: 'module' })`
 * so the bundler can see the worker file.
 *
 * Returns { status: 'idle'|'running'|'done'|'error', progress, elapsedMs, etaMs, result, error,
 *           start(payload, transfer?), cancel(), reset() }.
 * `elapsedMs` keeps its final value when the job finishes. `cancel` and `reset` both terminate the worker
 * and return to idle.
 */
export function useWorkerTask(createWorker) {
  const factory = useRef(createWorker);
  const workerRef = useRef(null);
  const startedAt = useRef(0);
  const stepStartedAt = useRef(0);
  const stepKey = useRef('');
  const [state, setState] = useState(IDLE);

  useEffect(() => { factory.current = createWorker; });

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const finish = useCallback((worker, next) => {
    if (workerRef.current !== worker) return; // stale message from a cancelled/replaced job
    stop();
    setState({ ...IDLE, ...next, elapsedMs: performance.now() - startedAt.current });
  }, [stop]);

  const start = useCallback((payload, transfer = []) => {
    stop();
    let worker;
    try {
      worker = factory.current();
    } catch (e) {
      setState({ ...IDLE, status: 'error', error: new AppError('WORKER_CRASH', { detail: e.message }) });
      return;
    }
    workerRef.current = worker;
    startedAt.current = stepStartedAt.current = performance.now();
    stepKey.current = '';
    setState({ ...IDLE, status: 'running' });

    const crash = (detail) => finish(worker, { status: 'error', error: new AppError('WORKER_CRASH', { detail }) });
    worker.onmessage = ({ data }) => {
      if (workerRef.current !== worker) return;
      if (data.type === 'progress') {
        const { type, ...progress } = data;
        const key = `${progress.step ?? ''}|${progress.stage ?? ''}`;
        if (key !== stepKey.current) { stepKey.current = key; stepStartedAt.current = performance.now(); }
        setState((s) => (s.status === 'running' ? { ...s, progress } : s));
      } else if (data.type === 'done') {
        finish(worker, { status: 'done', result: data.result });
      } else if (data.type === 'error') {
        finish(worker, { status: 'error', error: reviveError(data.error) });
      }
    };
    worker.onerror = (e) => { e.preventDefault?.(); console.error('[worker]', e.message); crash(e.message); };
    worker.onmessageerror = () => crash('The result could not be passed back from the worker.');
    try {
      worker.postMessage({ type: 'run', payload }, transfer);
    } catch (e) {
      crash(e.message); // e.g. DataCloneError
    }
  }, [stop, finish]);

  const reset = useCallback(() => { stop(); setState(IDLE); }, [stop]);

  // Elapsed time and ETA tick while running; terminate the worker if the component goes away.
  useEffect(() => {
    if (state.status !== 'running') return undefined;
    const id = setInterval(() => {
      const now = performance.now();
      setState((s) => (s.status !== 'running' ? s : {
        ...s,
        elapsedMs: now - startedAt.current,
        etaMs: estimateEta(s.progress?.fraction, now - stepStartedAt.current),
      }));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [state.status]);
  useEffect(() => stop, [stop]);

  return { ...state, start, cancel: reset, reset };
}
