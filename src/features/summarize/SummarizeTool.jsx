import { useState } from 'react';
import ToolWorkflow from '../../shared/ToolWorkflow.jsx';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { useSource } from '../../shared/fields/SourcePicker.jsx';
import { MODES, defaultConfig, pruneConfig, toPayload, validateConfig } from './config.js';
import SummarizeConfig from './SummarizeConfig.jsx';
import SummarizeResults from './SummarizeResults.jsx';

const createWorker = () => new Worker(new URL('./summarize.worker.js', import.meta.url), { type: 'module' });

export default function SummarizeTool({ datasets, onRestart }) {
  const source = useSource(datasets);
  const ds = source.dataset;
  const [config, setConfig] = useState(defaultConfig);
  const [ctx, setCtx] = useState(null);
  const task = useWorkerTask(createWorker);
  const current = pruneConfig(config, ds); // forget columns if the other file was chosen
  const mode = MODES.find((m) => m.id === current.mode);

  function run() {
    setCtx({ ds, config: current });
    task.start(toPayload(current, ds));
  }

  return (
    <ToolWorkflow
      title="Summarize"
      subtitle="Totals, counts and averages per group, columns turned into rows, or rows and columns swapped."
      task={task}
      job={{ title: `${mode.action === 'Summarize' ? 'Summarizing' : mode.action} ${ds.rowCount.toLocaleString()} rows`, stages: [mode.stage], unit: 'rows' }}
      renderConfig={() => <SummarizeConfig source={source} config={current} problem={validateConfig(current)} onChange={setConfig} onRun={run} />}
      renderResults={(result) => <SummarizeResults result={result} ctx={ctx} ms={task.elapsedMs} onRestart={onRestart} />}
    />
  );
}
