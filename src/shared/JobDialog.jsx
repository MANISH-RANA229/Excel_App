import { Dialog } from 'primereact/dialog';
import JobProgress from './JobProgress.jsx';

/** Blocking loader for operations the user should wait for (e.g. building a download). */
export default function JobDialog({ visible, title, ...jobProps }) {
  return (
    <Dialog
      visible={visible}
      header={title}
      modal
      closable={false}
      closeOnEscape={false}
      draggable={false}
      resizable={false}
      onHide={() => {}}
      style={{ width: 'min(460px, 92vw)' }}
    >
      <JobProgress variant="dialog" title={title} {...jobProps} />
    </Dialog>
  );
}
