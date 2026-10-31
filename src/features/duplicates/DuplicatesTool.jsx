import { useState } from 'react';
import ToolWorkflow from '../../shared/ToolWorkflow.jsx';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { columnTexts } from '../../core/dataset/dataset.js';
import { useSource } from '../../shared/fields/SourcePicker.jsx';
import DuplicatesConfig from './DuplicatesConfig.jsx';
import DuplicatesResults from './DuplicatesResults.jsx';
import { KEEP_RULES, rowCompleteness } from './engine.js';

const createWorker = () => new Worker(new URL('./duplicates.worker.js', import.meta.url), { type: 'module' });
const STAGES = { exact: ['Reading keys', 'Finding duplicates'], similar: ['Indexing words', 'Comparing rows'] };

export default function DuplicatesTool({ datasets, onRestart }) {
  const source = useSource(datasets);
  const ds = source.dataset;
  const [config, setConfig] = useState({
    keyColumns: [], mode: 'exact', threshold: 90, keep: 'first',
    normalize: { ignoreCase: true, collapseSpaces: true, ignorePunctuation: false },
  });
  const [ctx, setCtx] = useState(null);
  const task = useWorkerTask(createWorker);
  const keyColumns = config.keyColumns.filter((c) => ds.columns.includes(c)); // forget columns if the file changed

  function run() {
    const { mode, threshold, normalize, keep } = config;
    const options = { mode, threshold, normalize, keep };
    if (KEEP_RULES[keep].needsCompleteness) options.completeness = rowCompleteness(ds.text, ds.rowCount);
    setCtx({ ds, keyColumns, config });
    task.start({ keyColumns: keyColumns.map((c) => columnTexts(ds, c)), options });
  }

  return (
    <ToolWorkflow
      title="Duplicate Finder"
      subtitle="Finds repeated rows, even with typos or different word order, then lets you review and clean them."
      task={task}
      job={{ title: `Looking for duplicates in ${ds.rowCount.toLocaleString()} rows`, stages: STAGES[config.mode], unit: 'rows' }}
      renderConfig={() => <DuplicatesConfig source={source} config={{ ...config, keyColumns }} onChange={setConfig} onRun={run} />}
      renderResults={(result) => <DuplicatesResults result={result} ctx={ctx} ms={task.elapsedMs} onEdit={task.reset} onRestart={onRestart} />}
    />
  );
}
