import { useState } from 'react';
import ToolWorkflow from '../../shared/ToolWorkflow.jsx';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { columnTexts } from '../../core/dataset/dataset.js';
import DiffConfig from './DiffConfig.jsx';
import ResultsView from './ResultsView.jsx';
import { makeSide } from './side.js';

const createWorker = () => new Worker(new URL('./engine/diff.worker.js', import.meta.url), { type: 'module' });
const STAGES = ['Indexing words', 'Matching rows'];

// Pre-select a column name that exists in both files, if any.
const commonColumn = (a, b) => a.columns.find((c) => b.columns.includes(c)) ?? null;

export default function DiffCheck({ datasets, onRestart }) {
  const [a, b] = datasets;
  const [config, setConfig] = useState(() => {
    const col = commonColumn(a, b);
    return { colA: col, colB: col, carryA: [], carryB: [], topK: 1 };
  });
  const [ctx, setCtx] = useState(null);
  const task = useWorkerTask(createWorker);

  function start() {
    setCtx({ a: makeSide(a, config.colA, config.carryA), b: makeSide(b, config.colB, config.carryB), topK: config.topK });
    task.start({
      textsA: columnTexts(a, config.colA),
      textsB: columnTexts(b, config.colB),
      options: { topK: config.topK },
    });
  }

  return (
    <ToolWorkflow
      title="Diff Check"
      subtitle="Finds the best matching Excel 2 row for every Excel 1 row, word by word."
      task={task}
      job={{ title: `Comparing ${a.rowCount.toLocaleString()} × ${b.rowCount.toLocaleString()} rows`, stages: STAGES, unit: 'rows' }}
      renderConfig={() => <DiffConfig datasets={datasets} config={config} onChange={setConfig} onRun={start} />}
      renderResults={(result) => <ResultsView result={result} ms={task.elapsedMs} ctx={ctx} onRestart={onRestart} />}
    />
  );
}
