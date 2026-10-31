import { useMemo, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import AppShell from './layout/AppShell.jsx';
import FilesPage from './pages/FilesPage.jsx';
import { tools } from './features/index.js';

export default function App() {
  const [files, setFiles] = useState([null, null]); // { fileName, sheets, sheet, headerRow, table }
  const [route, setRoute] = useState('files');

  const ready = files.every((f) => f?.table.rows.length);
  const datasets = useMemo(
    () => files.map((f) => f && { fileName: f.fileName, sheet: f.sheet, headerRow: f.headerRow, ...f.table }),
    [files],
  );
  // Tools stay mounted while you browse (results survive), and reset when the input data changes.
  const dataKey = files.map((f) => f && `${f.fileName}|${f.sheet}|${f.headerRow}`).join('/');

  const nav = [
    { title: 'Workspace', items: [{ id: 'files', label: 'Files', icon: FolderOpen, hint: `${files.filter(Boolean).length}/2` }] },
    { title: 'Tools', items: tools.map((t) => ({ id: t.id, label: t.title, icon: t.icon, disabled: !ready })) },
  ];

  function clear() {
    setFiles([null, null]);
    setRoute('files');
  }

  return (
    <AppShell nav={nav} active={route} onNavigate={setRoute} onClear={clear}>
      {route === 'files' && <FilesPage files={files} onFiles={setFiles} ready={ready} onOpenTool={setRoute} />}
      {ready && tools.map(({ id, Component }) => (
        <div key={id + dataKey} hidden={route !== id}>
          <Component datasets={datasets} onRestart={clear} />
        </div>
      ))}
    </AppShell>
  );
}
