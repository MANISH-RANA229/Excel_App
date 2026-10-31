import { useState } from 'react';
import ToolWorkflow from '../../shared/ToolWorkflow.jsx';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { columnTexts } from '../../core/dataset/dataset.js';
import { useSource } from '../../shared/fields/SourcePicker.jsx';
import SplitConfig from './SplitConfig.jsx';
import SplitResults from './SplitResults.jsx';

const createWorker = () => new Worker(new URL('./split.worker.js', import.meta.url), { type: 'module' });

export default function SplitTool({ datasets, onRestart }) {
  const source = useSource(datasets);
  const ds = source.dataset;
  const [config, setConfig] = useState({ column: null, ignoreCase: true });
  const [ctx, setCtx] = useState(null);
  const task = useWorkerTask(createWorker);
  const column = ds.columns.includes(config.column) ? config.column : null; // forget the column if the file changed

  function run() {
    setCtx({ ds, column });
    task.start({ values: columnTexts(ds, column), options: { ignoreCase: config.ignoreCase } });
  }

  return (
    <ToolWorkflow
      title="Split by Column"
      subtitle="Create one file (or sheet) for each value in a column, for example one workbook per region."
      task={task}
      job={{ title: `Grouping ${ds.rowCount.toLocaleString()} rows`, stages: ['Grouping rows'], unit: 'rows' }}
      renderConfig={() => <SplitConfig source={source} config={config} column={column} onChange={setConfig} onRun={run} />}
      renderResults={(result) => <SplitResults result={result} ctx={ctx} ms={task.elapsedMs} onEdit={task.reset} onRestart={onRestart} />}
    />
  );
}
