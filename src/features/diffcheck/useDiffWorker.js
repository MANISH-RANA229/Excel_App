import { useCallback, useEffect, useRef, useState } from 'react';

// Runs the diff engine in a Web Worker so the UI stays responsive.
export function useDiffWorker() {
  const workerRef = useRef(null);
  const [state, setState] = useState({ status: 'idle', progress: 0, result: null, error: null });

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const start = useCallback((textsA, textsB, options) => {
    stop();
    const worker = new Worker(new URL('./engine/diff.worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const startedAt = performance.now();
    setState({ status: 'running', progress: 0, result: null, error: null });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') setState((s) => ({ ...s, progress: data.value }));
      else {
        stop();
        setState(data.type === 'done'
          ? { status: 'done', progress: 1, result: { ...data.result, ms: performance.now() - startedAt }, error: null }
          : { status: 'error', progress: 0, result: null, error: data.message });
      }
    };
    worker.onerror = (e) => { stop(); setState({ status: 'error', progress: 0, result: null, error: e.message || 'Comparison failed' }); };
    worker.postMessage({ textsA, textsB, options });
  }, [stop]);

  const reset = useCallback(() => { stop(); setState({ status: 'idle', progress: 0, result: null, error: null }); }, [stop]);

  useEffect(() => stop, [stop]);
  return { ...state, start, cancel: reset, reset };
}
