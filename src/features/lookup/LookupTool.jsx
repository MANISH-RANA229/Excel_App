import { useState } from 'react';
import ToolWorkflow from '../../shared/ToolWorkflow.jsx';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { columnTexts } from '../../core/dataset/dataset.js';
import LookupConfig from './LookupConfig.jsx';
import LookupResults from './LookupResults.jsx';

const createWorker = () => new Worker(new URL('./lookup.worker.js', import.meta.url), { type: 'module' });
const STAGES = ['Indexing words', 'Looking up rows'];

// Pre-select a column name that exists in both files, if any.
const commonColumn = (a, b) => a.columns.find((c) => b.columns.includes(c)) ?? null;

export default function LookupTool({ datasets, onRestart }) {
  const [a, b] = datasets;
  const [config, setConfig] = useState(() => {
    const key = commonColumn(a, b);
    return { keyA: key, keyB: key, pull: [], threshold: 80 };
  });
  const [ctx, setCtx] = useState(null);
  const task = useWorkerTask(createWorker);

  function run() {
    setCtx({ a, b, keyA: config.keyA, keyB: config.keyB, pull: config.pull, threshold: config.threshold });
    task.start({ textsA: columnTexts(a, config.keyA), textsB: columnTexts(b, config.keyB), options: { threshold: config.threshold } });
  }

  return (
    <ToolWorkflow
      title="Fuzzy Lookup / Merge"
      subtitle="Bring columns from Excel 2 into Excel 1 by matching names that are close but not identical."
      task={task}
      job={{ title: `Looking up ${a.rowCount.toLocaleString()} rows in ${b.rowCount.toLocaleString()}`, stages: STAGES, unit: 'rows' }}
      renderConfig={() => <LookupConfig datasets={datasets} config={config} onChange={setConfig} onRun={run} />}
      renderResults={(result) => <LookupResults result={result} ctx={ctx} ms={task.elapsedMs} onEdit={task.reset} onRestart={onRestart} />}
    />
  );
}
