import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import ToolWorkflow from '../../shared/ToolWorkflow.jsx';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { OPS } from '../../core/clean/operations.js';
import { previewSteps, suggestionsFrom, tableFromDataset } from '../../core/clean/pipeline.js';
import { useSource } from '../../shared/fields/SourcePicker.jsx';
import CleanerConfig from './CleanerConfig.jsx';
import CleanerResults from './CleanerResults.jsx';

const createCleanWorker = () => new Worker(new URL('./clean.worker.js', import.meta.url), { type: 'module' });
const createScanWorker = () => new Worker(new URL('./scan.worker.js', import.meta.url), { type: 'module' });
const PREVIEW_ROWS = 500;
const PREVIEW_SHOWN = 12;

const isComplete = (s) => OPS[s.op].structural || s.columns.length > 0;
const newStep = (id, opId, columns = []) => ({ id, op: opId, columns, options: structuredClone(OPS[opId].defaults) });

export default function CleanerTool({ datasets, onRestart }) {
  const source = useSource(datasets);
  const ds = source.dataset;
  const [steps, setSteps] = useState([]);
  const [ctx, setCtx] = useState(null);
  const nextId = useRef(1);
  const task = useWorkerTask(createCleanWorker);
  const scanTask = useWorkerTask(createScanWorker);

  // A new file (or sheet) means new problems: scan it and drop steps that referred to the old one.
  useEffect(() => {
    setSteps([]);
    scanTask.start({ table: { names: ds.columns, text: ds.text, nums: ds.nums, rowCount: ds.rowCount } });
  }, [ds.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo(() => (scanTask.result ? suggestionsFrom(scanTask.result.scan) : []), [scanTask.result]);
  const valid = useMemo(() => steps.filter(isComplete), [steps]);

  // live preview on the first rows; deferred so typing in a field never waits for it
  const deferred = useDeferredValue(valid);
  const preview = useMemo(() => {
    if (!deferred.length) return { rows: [], total: 0, rowsPreviewed: Math.min(PREVIEW_ROWS, ds.rowCount) };
    const table = tableFromDataset(ds, deferred);
    const { result, rowsPreviewed } = previewSteps(table, deferred, { rows: PREVIEW_ROWS });
    const { log } = result;
    const rows = Array.from({ length: Math.min(PREVIEW_SHOWN, log.row.length) }, (_, i) => ({
      rowNum: ds.rowNums[log.row[i]], column: table.names[log.col[i]], before: log.before[i], after: log.after[i],
    }));
    return { rows, total: log.count, rowsPreviewed };
  }, [deferred, ds]);

  const patchStep = (id, patch) => setSteps((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const add = (opId, columns) => setSteps((all) => [...all, newStep(nextId.current++, opId, columns)]);
  const addFix = ({ opId, column }) => setSteps((all) => {
    const existing = all.find((s) => s.op === opId);
    if (!existing) return [...all, newStep(nextId.current++, opId, [column])];
    return existing.columns.includes(column) ? all : all.map((s) => (s === existing ? { ...s, columns: [...s.columns, column] } : s));
  });
  const addAll = () => suggestions.forEach(addFix);
  const move = (id, dir) => setSteps((all) => {
    const i = all.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= all.length) return all;
    const next = [...all];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  function run() {
    setCtx({ ds, steps: valid });
    task.start({ table: tableFromDataset(ds, valid), steps: valid.map(({ op, columns, options }) => ({ op, columns, options })) });
  }

  return (
    <ToolWorkflow
      title="Data Cleaner"
      subtitle="Fix the things that make spreadsheets annoying: stray spaces, numbers and dates stored as text, inconsistent case."
      task={task}
      job={{ title: `Cleaning ${ds.rowCount.toLocaleString()} rows`, stages: ['Cleaning cells'], unit: 'rows' }}
      renderConfig={() => (
        <CleanerConfig
          source={source}
          steps={steps}
          scan={{ ...scanTask, suggestions, dismiss: scanTask.reset }}
          preview={preview}
          canRun={valid.length > 0 && valid.length === steps.length}
          onAdd={add}
          onAddFix={addFix}
          onAddAll={addAll}
          onChangeStep={patchStep}
          onRemoveStep={(id) => setSteps((all) => all.filter((s) => s.id !== id))}
          onMoveStep={move}
          onRun={run}
        />
      )}
      renderResults={(result) => <CleanerResults result={result} ctx={ctx} ms={task.elapsedMs} onRestart={onRestart} />}
    />
  );
}
