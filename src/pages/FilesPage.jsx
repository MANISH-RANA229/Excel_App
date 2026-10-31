import { Button } from 'primereact/button';
import { ArrowLeftRight } from 'lucide-react';
import PageHeader from '../layout/PageHeader.jsx';
import FileDropCard from '../shared/FileDropCard.jsx';
import ToolPicker from '../features/ToolPicker.jsx';
import { tools } from '../features/index.js';

export default function FilesPage({ files, onFiles, ready, onOpenTool }) {
  const setFile = (i) => (f) => onFiles(files.map((p, j) => (j === i ? f : p)));

  return (
    <div className="page">
      <PageHeader
        title="Files"
        subtitle="Load the two spreadsheets to work with (.xlsx, .xls, .csv). Header rows are detected automatically."
        actions={files[0] && files[1] && (
          <Button label="Swap files" size="small" outlined icon={<ArrowLeftRight size={14} />} onClick={() => onFiles([files[1], files[0]])} />
        )}
      />
      <div className="grid-2">
        <FileDropCard label="Excel 1" value={files[0]} onChange={setFile(0)} />
        <FileDropCard label="Excel 2" value={files[1]} onChange={setFile(1)} />
      </div>
      <section className="section">
        <h2 className="section__title">Tools</h2>
        <ToolPicker tools={tools} disabled={!ready} onOpen={onOpenTool} />
      </section>
    </div>
  );
}
