import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import ToolWorkflow from '../../shared/ToolWorkflow.jsx';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { OPS } from '../../core/columns/operations.js';
import { outputNames } from '../../core/columns/pipeline.js';
import { useSource } from '../../shared/fields/SourcePicker.jsx';
import ColBuilderConfig from './ColBuilderConfig.jsx';
import ColBuilderResults from './ColBuilderResults.jsx';
import { previewOf, problemsOf, runOptions, tableFor, toRunSteps } from './table.js';

const createWorker = () => new Worker(new URL('./colbuilder.worker.js', import.meta.url), { type: 'module' });
const PREVIEW_ROWS = 200; // enough for group counts / ranks to look right; only the first few are shown

const newStep = (id, opId) => ({ id, op: opId, name: '', options: structuredClone(OPS[opId].defaults) });

export default function ColBuilderTool({ datasets, onRestart }) {
  const source = useSource(datasets);
  const ds = source.dataset;
  const [steps, setSteps] = useState([]);
  const [settings, setSettings] = useState({ dayFirst: true, decimal: '.' });
  const [ctx, setCtx] = useState(null);
  const nextId = useRef(1);
  const task = useWorkerTask(createWorker);

  useEffect(() => { setSteps([]); }, [ds.id]); // another file or sheet: the steps referred to the old one

  const names = useMemo(() => outputNames(ds.columns, steps), [ds, steps]);
  const problems = useMemo(() => problemsOf(ds, steps), [ds, steps]);
  const canRun = steps.length > 0 && problems.every((p) => !p);

  // live preview; deferred so typing in a field never waits for it
  const deferred = useDeferredValue(steps);
  const preview = useMemo(() => previewOf(ds, deferred, settings, PREVIEW_ROWS), [ds, deferred, settings]);

  const patchStep = (id, patch) => setSteps((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (id, dir) => setSteps((all) => {
    const i = all.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= all.length) return all;
    const next = [...all];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  function run() {
    setCtx({ ds, steps });
    task.start({ table: tableFor(ds, steps), steps: toRunSteps(steps), options: runOptions(ds, settings) });
  }

  return (
    <ToolWorkflow
      title="Column Builder"
      subtitle="Add new columns worked out from existing ones, without writing formulas: join names, split text, calculate, pick parts of dates, IF rules."
      task={task}
      job={{ title: `Building ${steps.length} new column${steps.length === 1 ? '' : 's'} for ${ds.rowCount.toLocaleString()} rows`, stages: ['Working out the new columns'], unit: 'rows' }}
      renderConfig={() => (
        <ColBuilderConfig
          source={source} steps={steps} names={names} problems={problems} settings={settings} preview={preview} canRun={canRun}
          onSettings={setSettings}
          onAdd={(opId) => setSteps((all) => [...all, newStep(nextId.current++, opId)])}
          onChangeStep={patchStep}
          onRemoveStep={(id) => setSteps((all) => all.filter((s) => s.id !== id))}
          onMoveStep={move}
          onRun={run}
        />
      )}
      renderResults={(result) => <ColBuilderResults result={result} ctx={ctx} ms={task.elapsedMs} onEdit={task.reset} onRestart={onRestart} />}
    />
  );
}
