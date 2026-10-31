import { Suspense, useMemo, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import AppShell from './layout/AppShell.jsx';
import FilesPage from './pages/FilesPage.jsx';
import ErrorBoundary from './shared/ErrorBoundary.jsx';
import ToolSkeleton from './shared/ToolSkeleton.jsx';
import { CATEGORIES, isReady, needsHint, tools } from './features/index.js';

export default function App() {
  const [files, setFiles] = useState([null, null]); // { file, sheetNames, dims, warnings, dataset } — see FileDropCard
  const [route, setRoute] = useState('files');
  const [visited, setVisited] = useState({}); // tool id → data key it was opened with
  const [resetCount, setResetCount] = useState(0); // bumps on "Clear workspace"

  const datasets = useMemo(() => files.map((f) => f?.dataset ?? null), [files]);
  const loaded = datasets.map((d) => !!d?.rowCount);
  // Tools mount on first visit and stay mounted (results survive navigation); they reset when any dataset is re-loaded.
  const dataKey = datasets.map((d) => d?.id ?? '').join('/');
  // Tools that load their own files (needs: 0) must not reset when Excel 1 / Excel 2 change, only on "Clear workspace".
  const keyOf = (t) => (t.needs === 0 ? `reset${resetCount}` : dataKey);
  const mounted = tools.filter((t) => visited[t.id] === keyOf(t) && isReady(t, loaded));

  const navigate = (id) => {
    setRoute(id);
    if (id !== 'files') setVisited((v) => ({ ...v, [id]: keyOf(tools.find((t) => t.id === id)) }));
  };

  const nav = [
    { title: 'Workspace', items: [{ id: 'files', label: 'Files', icon: FolderOpen, hint: `${files.filter(Boolean).length}/2` }] },
    ...CATEGORIES.map(({ id, title }) => ({
      title,
      items: tools.filter((t) => t.category === id).map((t) => ({
        id: t.id, label: t.title, icon: t.icon, disabled: !isReady(t, loaded), disabledReason: needsHint(t),
      })),
    })).filter((g) => g.items.length),
  ];

  function clear() {
    setFiles([null, null]);
    setResetCount((n) => n + 1);
    setRoute('files');
  }

  return (
    <AppShell nav={nav} active={route} onNavigate={navigate} onClear={clear}>
      {route === 'files' && <FilesPage files={files} onFiles={setFiles} loaded={loaded} onOpenTool={navigate} />}
      {mounted.map((t) => {
        const { id, title, Component } = t;
        return (
          <div key={id + keyOf(t)} hidden={route !== id}>
            <ErrorBoundary label={title} retryLabel="Reload tool">
              <Suspense fallback={<ToolSkeleton title={title} />}>
                <Component datasets={datasets} onRestart={clear} />
              </Suspense>
            </ErrorBoundary>
          </div>
        );
      })}
    </AppShell>
  );
}
