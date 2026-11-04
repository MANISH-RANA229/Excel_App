import { useEffect } from 'react';
import { Button } from '../components/ui/index.js';
import { CircleCheck, FileSpreadsheet, TriangleAlert } from 'lucide-react';
import ErrorNotice from '../shared/ErrorNotice.jsx';
import JobProgress from '../shared/JobProgress.jsx';
import KpiStrip from '../shared/results/KpiStrip.jsx';
import { useWorkerTask } from '../hooks/useWorkerTask.js';

const createWorker = () => new Worker(new URL('../workers/dataHealth.worker.js', import.meta.url), { type: 'module' });
const MAX_SHOWN = 6;
const n = (v) => v.toLocaleString();
const pct = (share) => `${Math.round(share * 100)}%`;
const plural = (count, one, many = `${one}s`) => `${n(count)} ${count === 1 ? one : many}`;

/** What is worth a look, as { text, tool }: `tool` = the tool that can fix it (or null when it is only good to know). */
function findings({ health, suggestions }) {
  const list = [];
  const { emptyColumns, sparseColumns, repeatedRows } = health;
  const be = (count) => (count === 1 ? 'is' : 'are');
  if (emptyColumns.length) list.push({ text: `${plural(emptyColumns.length, 'column')} ${be(emptyColumns.length)} completely empty: ${emptyColumns.slice(0, 3).join(', ')}${emptyColumns.length > 3 ? '…' : ''}`, tool: 'cleaner' });
  if (repeatedRows) list.push({ text: `${plural(repeatedRows, 'row')} ${repeatedRows === 1 ? 'repeats' : 'repeat'} an earlier row exactly`, tool: 'duplicates' });
  if (sparseColumns.length) {
    const top = sparseColumns.slice(0, 3).map((c) => `${c.name} (${pct(c.share)})`).join(', ');
    list.push({ text: `${plural(sparseColumns.length, 'column')} ${be(sparseColumns.length)} mostly blank: ${top}${sparseColumns.length > 3 ? '…' : ''}`, tool: null });
  }
  for (const s of suggestions) list.push({ text: s.message, tool: 'cleaner' });
  return list;
}

function Panel({ ds, label, accent, onOpenTool }) {
  const task = useWorkerTask(createWorker);
  useEffect(() => {
    task.start({ table: { names: ds.columns, text: ds.text, nums: ds.nums, rowCount: ds.rowCount } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps  (one scan per loaded file: the panel is keyed by dataset id)

  const done = task.status === 'done' ? task.result : null;
  const list = done ? findings(done) : [];
  const tools = new Set(list.map((f) => f.tool).filter(Boolean));

  return (
    <div className="card health">
      <div className="health__head">
        <span className={`file-tag${accent === 'b' ? ' file-tag--b' : ''}`}><FileSpreadsheet size={14} aria-hidden="true" />{label}</span>
        <strong className="clip" title={ds.fileName}>{ds.fileName}</strong>
        {done && (
          <span className={`health__verdict${list.length ? ' is-warn' : ''}`}>
            {list.length ? <TriangleAlert size={14} aria-hidden="true" /> : <CircleCheck size={14} aria-hidden="true" />}
            {list.length ? `${plural(list.length, 'thing')} to check` : 'Looks clean'}
          </span>
        )}
      </div>

      {task.status === 'running' && <JobProgress variant="inline" title={`Checking ${ds.fileName}`} progress={task.progress} elapsedMs={task.elapsedMs} etaMs={task.etaMs} unit="rows" />}
      {task.status === 'error' && <ErrorNotice error={task.error} onDismiss={task.reset} />}

      {done && (
        <>
          <KpiStrip items={[
            ['Rows', n(done.health.rows)],
            ['Columns', n(done.health.columns)],
            ['Blank cells', `${n(done.health.blankCells)} · ${pct(done.health.blankShare)}`],
            ['Repeated rows', n(done.health.repeatedRows)],
          ]} />
          {list.length > 0 && (
            <ul className="health__list">
              {list.slice(0, MAX_SHOWN).map((f) => <li key={f.text}>{f.text}</li>)}
              {list.length > MAX_SHOWN && <li className="muted">and {n(list.length - MAX_SHOWN)} more. The Data Cleaner lists them all.</li>}
            </ul>
          )}
          {tools.size > 0 && (
            <div className="health__actions">
              {tools.has('cleaner') && <Button label="Open Data Cleaner" size="sm" outlined severity="secondary" onClick={() => onOpenTool('cleaner')} />}
              {tools.has('duplicates') && <Button label="Open Duplicate Finder" size="sm" outlined severity="secondary" onClick={() => onOpenTool('duplicates')} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** "Data health" on the Files page: plain facts about each loaded file, computed in a worker. Nothing is changed or scored. */
export default function DataHealthCard({ datasets, onOpenTool }) {
  const loaded = datasets.map((ds, i) => ({ ds, i })).filter(({ ds }) => ds?.rowCount);
  if (!loaded.length) return null;
  return (
    <section className="section" aria-label="Data health">
      <div className="ops-head">
        <div>
          <h2>Data health</h2>
          <p>Quick checks on what you loaded: blanks, repeated rows, extra spaces, hidden characters, numbers and dates stored as text. Nothing is changed.</p>
        </div>
      </div>
      <div className="health-grid">
        {loaded.map(({ ds, i }) => <Panel key={ds.id} ds={ds} label={`Excel ${i + 1}`} accent={i === 1 ? 'b' : 'a'} onOpenTool={onOpenTool} />)}
      </div>
    </section>
  );
}
