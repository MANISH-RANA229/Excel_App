import { useMemo, useState } from 'react';
import ToolWorkflow from '../../shared/ToolWorkflow.jsx';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { defaultConfig, toOptions, validate } from './config.js';
import CombineConfig from './CombineConfig.jsx';
import CombineResults from './CombineResults.jsx';
import { MAX_SOURCES, planColumns } from './engine.js';

const createWorker = () => new Worker(new URL('./combine.worker.js', import.meta.url), { type: 'module' });
let nextKey = 1;

/**
 * Owns its own list of sources (a source = one sheet of one file), so it works regardless of the two slots on the Files page.
 * source = { key, file: File, sheet: string|null, value: { file, sheetNames, dims, warnings, dataset } | null } — value is
 * null while the file is being read (or if reading failed); the card for it does the reading.
 */
export default function CombineTool({ onRestart }) {
  const [sources, setSources] = useState([]);
  const [config, setConfig] = useState(defaultConfig);
  const task = useWorkerTask(createWorker);

  const loaded = useMemo(() => sources.filter((s) => s.value?.dataset?.rowCount).map((s) => ({ key: s.key, ...s.value.dataset })), [sources]);
  const pending = sources.length - loaded.length; // still loading, failed, or without data rows
  const plan = useMemo(() => planColumns(loaded, toOptions(config, loaded)), [loaded, config]);

  const add = (files) => setSources((prev) => [
    ...prev,
    ...Array.from(files).slice(0, Math.max(0, MAX_SOURCES - prev.length)).map((file) => ({ key: nextKey++, file, sheet: null, value: null })),
  ]);
  const setValue = (key, value) => setSources((prev) => (value ? prev.map((s) => (s.key === key ? { ...s, value } : s)) : prev.filter((s) => s.key !== key)));
  const addSheets = (key) => setSources((prev) => {
    const from = prev.find((s) => s.key === key);
    const used = new Set(prev.filter((s) => s.file === from.file).map((s) => s.value?.dataset.sheet ?? s.sheet).filter(Boolean));
    const rest = from.value.sheetNames.filter((name) => !used.has(name)).slice(0, Math.max(0, MAX_SOURCES - prev.length));
    return [...prev, ...rest.map((sheet) => ({ key: nextKey++, file: from.file, sheet, value: null }))];
  });

  return (
    <ToolWorkflow
      title="Combine Files"
      subtitle="Stack many files, or many sheets of one workbook, into one sheet. Columns are matched by header name."
      task={task}
      job={{ title: `Combining ${loaded.length} files and sheets`, stages: ['Stacking rows'], unit: 'rows' }}
      renderConfig={() => (
        <CombineConfig
          sources={sources} loaded={loaded} plan={plan} config={config} problem={validate({ loaded: loaded.length, pending, plan })}
          onAdd={add} onValue={setValue} onAddSheets={addSheets} onChange={setConfig}
          onRun={() => task.start({ sources: loaded, options: toOptions(config, loaded) })}
        />
      )}
      renderResults={(result) => <CombineResults result={result} ms={task.elapsedMs} onEdit={task.reset} onRestart={onRestart} />}
    />
  );
}
