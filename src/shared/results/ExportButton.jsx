import { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Download } from 'lucide-react';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { toAppError } from '../../core/errors.js';
import { downloadBlob } from '../download.js';
import JobDialog from '../JobDialog.jsx';
import { useToast } from '../ToastProvider.jsx';

const createWorker = () => new Worker(new URL('../../workers/exportWorkbook.worker.js', import.meta.url), { type: 'module' });

/**
 * Download button for any tool. `buildSpec()` returns an ExportSpec (core/export/spec.js); building the file
 * happens in a worker behind a blocking, cancellable progress dialog, then the browser download starts.
 * Failures become a toast with what to do next; throwing an AppError from buildSpec works too.
 */
export default function ExportButton({ buildSpec, label = 'Download Excel', title = 'Building your Excel file', disabled, ...buttonProps }) {
  const toast = useToast();
  const task = useWorkerTask(createWorker);
  const [unit, setUnit] = useState('rows');
  const running = task.status === 'running';

  function run() {
    let spec;
    try {
      spec = buildSpec();
    } catch (e) {
      const err = toAppError(e);
      toast.error(err.message, err.hint);
      return;
    }
    setUnit(spec.zip ? 'files' : 'rows');
    task.start({ spec });
  }

  useEffect(() => {
    if (task.status === 'done') {
      downloadBlob(task.result.blob, task.result.fileName);
      toast.success('Download ready', task.result.fileName);
      task.reset();
    } else if (task.status === 'error') {
      toast.error(task.error.message, task.error.hint);
      console.error('[export]', task.error.detail);
      task.reset();
    }
  }, [task.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Button label={label} size="small" icon={<Download size={14} />} disabled={disabled || running} onClick={run} {...buttonProps} />
      <JobDialog visible={running} title={title} progress={task.progress} elapsedMs={task.elapsedMs} etaMs={task.etaMs} unit={unit} onCancel={task.cancel} />
    </>
  );
}
