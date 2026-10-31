import { useState } from 'react';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { Message } from 'primereact/message';
import { X } from 'lucide-react';
import PageHeader from '../../layout/PageHeader.jsx';
import DiffConfig from './DiffConfig.jsx';
import ResultsView from './ResultsView.jsx';
import { useDiffWorker } from './useDiffWorker.js';

// Pre-select a column name that exists in both files, if any.
const commonColumn = (a, b) => a.columns.find((c) => b.columns.includes(c)) ?? null;

export default function DiffCheck({ datasets, onRestart }) {
  const [a, b] = datasets;
  const [config, setConfig] = useState(() => {
    const col = commonColumn(a, b);
    return { colA: col, colB: col, carryA: [], carryB: [], topK: 1 };
  });
  const [ctx, setCtx] = useState(null);
  const run = useDiffWorker();

  function start() {
    setCtx({
      a: { ...a, column: config.colA, carry: config.carryA },
      b: { ...b, column: config.colB, carry: config.carryB },
      topK: config.topK,
    });
    run.start(a.rows.map((r) => r[config.colA]), b.rows.map((r) => r[config.colB]), { topK: config.topK });
  }

  if (run.status === 'done') {
    return <ResultsView result={run.result} ctx={ctx} onEdit={run.reset} onRestart={onRestart} />;
  }

  return (
    <div className="page">
      <PageHeader title="Diff Check" subtitle="Finds the best matching Excel 2 row for every Excel 1 row, word by word." />
      {run.error && <Message severity="error" text={run.error} className="w-full" />}
      {run.status === 'running' ? (
        <div className="card running" role="status">
          <div className="running__text">
            <strong>Comparing {a.rows.length.toLocaleString()} × {b.rows.length.toLocaleString()} rows…</strong>
            <span className="muted">"{ctx.a.column}" vs "{ctx.b.column}"</span>
          </div>
          <ProgressBar value={Math.round(run.progress * 100)} className="running__bar" />
          <Button label="Cancel" size="small" outlined severity="secondary" icon={<X size={14} />} onClick={run.cancel} />
        </div>
      ) : (
        <DiffConfig datasets={datasets} config={config} onChange={setConfig} onRun={start} />
      )}
    </div>
  );
}
