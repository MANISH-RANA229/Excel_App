import { useState } from 'react';
import ToolWorkflow from '../../shared/ToolWorkflow.jsx';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { comparedColumns, defaultConfig, toPayload, validateConfig } from './config.js';
import { STAGES } from './engine.js';
import KeyCompareConfig from './KeyCompareConfig.jsx';
import KeyCompareResults from './KeyCompareResults.jsx';

const createWorker = () => new Worker(new URL('./keycompare.worker.js', import.meta.url), { type: 'module' });

export default function KeyCompareTool({ datasets, onRestart }) {
  const [a, b] = datasets;
  const [config, setConfig] = useState(() => defaultConfig(a, b));
  const [ctx, setCtx] = useState(null);
  const task = useWorkerTask(createWorker);
  const problem = validateConfig(config);

  function run() {
    setCtx({ a, b, config, compared: comparedColumns(config, a, b) });
    task.start(toPayload(config, a, b));
  }

  return (
    <ToolWorkflow
      title="Compare by Key"
      subtitle="Compare two versions of a list by an ID column: what was added, removed or changed."
      task={task}
      job={{ title: `Comparing ${a.rowCount.toLocaleString()} and ${b.rowCount.toLocaleString()} rows`, stages: STAGES, unit: 'rows' }}
      renderConfig={() => <KeyCompareConfig datasets={datasets} config={config} problem={problem} onChange={setConfig} onRun={run} />}
      renderResults={(result) => <KeyCompareResults result={result} ctx={ctx} ms={task.elapsedMs} onEdit={task.reset} onRestart={onRestart} />}
    />
  );
}
