import PageHeader from '../layout/PageHeader.jsx';
import ErrorNotice from './ErrorNotice.jsx';
import JobProgress from './JobProgress.jsx';
import { useToolPhase } from './ToolPhase.js';

/**
 * The shared lifecycle of every tool: configure → run (loader) → results.
 * The tool owns its config state and calls task.start(); this renders whichever phase is current.
 *
 * @param task  useWorkerTask() instance
 * @param job   { title, stages?, unit? } shown on the loader while running
 * @param renderConfig   () => node
 * @param renderResults  (result) => node   (renders its own PageHeader, it needs action buttons)
 */
export default function ToolWorkflow({ title, subtitle, task, job, renderConfig, renderResults }) {
  useToolPhase(task.status === 'done' ? 'results' : 'config', task.reset); // the header breadcrumb follows it
  if (task.status === 'done') return renderResults(task.result);
  return (
    <div className="page page--config">
      <PageHeader title={title} subtitle={subtitle} />
      <ErrorNotice error={task.error} onDismiss={task.reset} />
      {task.status === 'running' ? (
        <JobProgress {...job} progress={task.progress} elapsedMs={task.elapsedMs} etaMs={task.etaMs} onCancel={task.cancel} />
      ) : renderConfig()}
    </div>
  );
}
