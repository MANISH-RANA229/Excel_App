import { useState } from 'react';
import ToolWorkflow from '../../shared/ToolWorkflow.jsx';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { defaultConfig, toPayload, validateConfig } from './config.js';
import { stagesFor } from './engine.js';
import ReconcileConfig from './ReconcileConfig.jsx';
import ReconcileResults from './ReconcileResults.jsx';

const createWorker = () => new Worker(new URL('./reconcile.worker.js', import.meta.url), { type: 'module' });

export default function ReconcileTool({ datasets, onRestart }) {
  const [a, b] = datasets;
  const [config, setConfig] = useState(() => defaultConfig(a, b));
  const [ctx, setCtx] = useState(null);
  const task = useWorkerTask(createWorker);
  const problem = validateConfig(config);

  function run() {
    setCtx({ a, b, config });
    task.start(toPayload(config, a, b));
  }

  return (
    <ToolWorkflow
      title="Reconcile"
      subtitle="Match two lists of amounts, such as a ledger and a bank statement, and see what is left unexplained."
      task={task}
      job={{ title: `Reconciling ${a.rowCount.toLocaleString()} and ${b.rowCount.toLocaleString()} rows`, stages: stagesFor(toPayload(config, a, b).options), unit: 'rows' }}
      renderConfig={() => <ReconcileConfig datasets={datasets} config={config} problem={problem} onChange={setConfig} onRun={run} />}
      renderResults={(result) => <ReconcileResults result={result} ctx={ctx} ms={task.elapsedMs} onEdit={task.reset} onRestart={onRestart} />}
    />
  );
}
