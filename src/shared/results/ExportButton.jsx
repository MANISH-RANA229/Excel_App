import { useEffect, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { ArrowRightToLine, Download } from 'lucide-react';
import { useWorkerTask } from '../../hooks/useWorkerTask.js';
import { toAppError } from '../../core/errors.js';
import { downloadBlob } from '../download.js';
import JobDialog from '../JobDialog.jsx';
import { useToast } from '../ToastProvider.jsx';
import { useWorkspace } from '../Workspace.js';
import ReuseDialog from './ReuseDialog.jsx';

const createWorker = () => new Worker(new URL('../../workers/exportWorkbook.worker.js', import.meta.url), { type: 'module' });

/**
 * Download button for any tool. `buildSpec()` returns an ExportSpec (core/export/spec.js); building the file
 * happens in a worker behind a blocking, cancellable progress dialog, then the browser download starts.
 * Failures become a toast with what to do next; throwing an AppError from buildSpec works too.
 *
 * "Use as input" (unless reuse={false}) builds the very same file but opens it as Excel 1 / Excel 2 instead of downloading,
 * so the next tool can work on it. It goes through the normal file reader, which is why it needs no per-tool code; the
 * file card's Sheet box then picks another sheet of the result. Nothing the user loaded is edited: it is a new file.
 */
export default function ExportButton({ buildSpec, label = 'Download Excel', title = 'Building your Excel file', disabled, reuse = true, ...buttonProps }) {
  const toast = useToast();
  const workspace = useWorkspace();
  const task = useWorkerTask(createWorker);
  const [unit, setUnit] = useState('rows');
  const [as, setAs] = useState('download'); // what the running job is for
  const [choosing, setChoosing] = useState(false); // slot picker (both slots taken)
  const slot = useRef(0);
  const running = task.status === 'running';

  function run(mode, target = 0) {
    let spec;
    try {
      spec = buildSpec();
    } catch (e) {
      const err = toAppError(e);
      toast.error(err.message, err.hint);
      return;
    }
    if (mode === 'reuse' && spec.zip) {
      toast.warn('This result is several files', 'Download it, then drop the file you want to keep working on.');
      return;
    }
    slot.current = target;
    setAs(mode);
    setUnit(spec.zip ? 'files' : 'rows');
    task.start({ spec });
  }

  function reuseResult() {
    const free = workspace.names.findIndex((n) => !n); // a free slot is used silently; with none free the user chooses what to replace
    if (free < 0) setChoosing(true);
    else run('reuse', free);
  }

  useEffect(() => {
    if (task.status === 'done') {
      const { blob, fileName } = task.result;
      if (as === 'reuse') {
        workspace.loadFile(new File([blob], fileName, { type: blob.type }), slot.current);
      } else {
        downloadBlob(blob, fileName);
        toast.success('Download ready', fileName);
      }
      task.reset();
    } else if (task.status === 'error') {
      toast.error(task.error.message, task.error.hint);
      console.error('[export]', task.error.detail);
      task.reset();
    }
  }, [task.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {reuse && workspace && (
        <Button
          label="Use as input"
          size="small"
          outlined
          severity="secondary"
          icon={<ArrowRightToLine size={14} />}
          disabled={disabled || running}
          title="Open this result as Excel 1 or Excel 2 to keep working on it. Your original files are not changed."
          onClick={reuseResult}
        />
      )}
      <Button label={label} size="small" icon={<Download size={14} />} disabled={disabled || running} onClick={() => run('download')} {...buttonProps} />
      <JobDialog visible={running} title={as === 'reuse' ? 'Preparing the result' : title} progress={task.progress} elapsedMs={task.elapsedMs} etaMs={task.etaMs} unit={unit} onCancel={task.cancel} />
      {workspace && <ReuseDialog visible={choosing} names={workspace.names} onHide={() => setChoosing(false)} onPick={(i) => { setChoosing(false); run('reuse', i); }} />}
    </>
  );
}
