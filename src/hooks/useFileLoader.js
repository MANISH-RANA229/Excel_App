import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkerTask } from './useWorkerTask.js';
import { useToast } from '../shared/ToastProvider.jsx';

const createWorker = () => new Worker(new URL('../workers/readWorkbook.worker.js', import.meta.url), { type: 'module' });
const STAGES = ['Reading file', 'Scanning sheets', 'Building columns'];
const MAX_STASH = 5; // replaced files kept in memory for "Restore"

/**
 * Puts a File (a pasted table, or a tool's result) into one of the two file slots from anywhere in the app.
 * Same reader as the file cards, so the same checks and errors apply.
 *
 * Safety rule: the slot is only replaced AFTER the new file was read successfully, and what it replaced is kept
 * (up to MAX_STASH) so "Restore" brings it back. A failed read leaves everything exactly as it was.
 *
 * files = App's slots ({ file, … } | null); setFiles = App's setter; navigate = hash route setter.
 * Returns { loadFile(file, slot), job (props for <JobDialog>), restorable, restore(), dismiss(), clearStash() }.
 */
export function useFileLoader({ files, setFiles, navigate }) {
  const toast = useToast();
  const task = useWorkerTask(createWorker);
  const pending = useRef(null); // { file, slot }
  const filesRef = useRef(files);
  filesRef.current = files;
  const [stash, setStash] = useState([]); // [{ slot, previous, current }] oldest first; current = the slot object that replaced it

  const loadFile = useCallback((file, slot) => {
    pending.current = { file, slot };
    task.start({ file });
  }, [task.start]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (task.status === 'done') {
      const { file, slot } = pending.current;
      const current = { file, ...task.result };
      const previous = filesRef.current[slot];
      setFiles((prev) => prev.map((p, j) => (j === slot ? current : p)));
      if (previous) setStash((s) => [...s, { slot, previous, current }].slice(-MAX_STASH));
      navigate('files');
      toast.success(`Excel ${slot + 1} is ready`, current.dataset.fileName);
      task.reset();
    } else if (task.status === 'error') {
      toast.error(task.error.message, task.error.hint);
      console.error('[load file]', task.error.detail);
      task.reset();
    }
  }, [task.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // An entry is only valid while the slot still holds the file it put there (the user may have swapped it by hand since).
  useEffect(() => { setStash((s) => (s.every((e) => files[e.slot] === e.current) ? s : s.filter((e) => files[e.slot] === e.current))); }, [files]);

  const restorable = stash.at(-1) ?? null; // { slot, previous, current } | null
  const restore = useCallback(() => {
    if (!restorable) return;
    setFiles((prev) => prev.map((p, j) => (j === restorable.slot ? restorable.previous : p)));
    setStash((s) => s.filter((e) => e !== restorable));
  }, [restorable, setFiles]);

  const job = useMemo(() => ({
    visible: task.status === 'running',
    title: `Opening ${pending.current?.file.name ?? 'file'}`,
    stages: STAGES,
    progress: task.progress,
    elapsedMs: task.elapsedMs,
    etaMs: task.etaMs,
    unit: 'rows',
    onCancel: task.cancel,
  }), [task.status, task.progress, task.elapsedMs, task.etaMs, task.cancel]);

  return { loadFile, job, restorable, restore, dismiss: () => setStash([]), clearStash: () => setStash([]) };
}
