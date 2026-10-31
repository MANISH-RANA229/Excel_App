import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import AppShell from './layout/AppShell.jsx';
import FilesPage from './pages/FilesPage.jsx';
import ErrorBoundary from './shared/ErrorBoundary.jsx';
import JobDialog from './shared/JobDialog.jsx';
import ToolSkeleton from './shared/ToolSkeleton.jsx';
import WelcomeModal from './shared/WelcomeModal.jsx';
import { ToolPhaseContext } from './shared/ToolPhase.js';
import { WorkspaceContext } from './shared/Workspace.js';
import { welcomeDismissed } from './shared/welcomeSeen.js';
import useHashRoute from './hooks/useHashRoute.js';
import { useFileLoader } from './hooks/useFileLoader.js';
import { CATEGORIES, isReady, needsHint, resolveRoute, tools } from './features/index.js';

const InfoPage = lazy(() => import('./pages/InfoPage.jsx')); // static documentation, kept out of the main chunk

export default function App() {
  const [files, setFiles] = useState([null, null]); // { file, sheetNames, dims, warnings, dataset } — see FileDropCard
  const [urlRoute, navigate] = useHashRoute();
  const [visited, setVisited] = useState({}); // tool id → data key it was opened with
  const [resetCount, setResetCount] = useState(0); // bumps on "Clear workspace"
  const [phases, setPhases] = useState({}); // tool id → { phase: 'config' | 'results', back } reported by ToolWorkflow, for the breadcrumb
  const [welcome, setWelcome] = useState(() => !welcomeDismissed()); // the "your data stays with you" note, until closed
  // Opens a File (pasted table, a tool's result) in a slot; the slot is replaced only after a successful read, and kept for "Restore".
  const loader = useFileLoader({ files, setFiles, navigate });
  const workspace = useMemo(
    () => ({ names: files.map((f) => f?.dataset.fileName ?? null), loadFile: loader.loadFile }),
    [files, loader.loadFile],
  );

  const datasets = useMemo(() => files.map((f) => f?.dataset ?? null), [files]);
  const loaded = datasets.map((d) => !!d?.rowCount);
  const route = resolveRoute(urlRoute, loaded);
  // A typed or stale URL (unknown tool, files not loaded) is corrected in place so Back doesn't bounce into it.
  useEffect(() => { if (route !== urlRoute) navigate(route, { replace: true }); }, [route, urlRoute, navigate]);

  // Tools mount on first visit and stay mounted (results survive navigation); they reset when any dataset is re-loaded.
  const dataKey = datasets.map((d) => d?.id ?? '').join('/');
  // Tools that load their own files (needs: 0) must not reset when Excel 1 / Excel 2 change, only on "Clear workspace".
  const keyOf = (t) => (t.needs === 0 ? `reset${resetCount}` : dataKey);
  const activeTool = tools.find((t) => t.id === route); // undefined on the Files and How-it-works pages
  const activeKey = activeTool ? keyOf(activeTool) : null;
  useEffect(() => {
    if (activeKey !== null) setVisited((v) => (v[route] === activeKey ? v : { ...v, [route]: activeKey }));
  }, [route, activeKey]);
  const mounted = tools.filter((t) => isReady(t, loaded) && (t.id === route || visited[t.id] === keyOf(t)));

  const nav = [
    { title: 'Workspace', items: [{ id: 'files', label: 'Files', crumb: 'Files & Operations', icon: FolderOpen, hint: `${files.filter(Boolean).length}/2` }] },
    ...CATEGORIES.map(({ id, title }) => ({
      title,
      items: tools.filter((t) => t.category === id).map((t) => ({
        id: t.id, label: t.title, resultLabel: t.resultLabel, icon: t.icon, badge: t.badge, disabled: !isReady(t, loaded), disabledReason: needsHint(t),
      })),
    })).filter((g) => g.items.length),
  ];

  function clear() {
    setFiles([null, null]);
    loader.clearStash();
    setResetCount((n) => n + 1);
    navigate('files');
  }

  return (
    <WorkspaceContext.Provider value={workspace}>
      <AppShell nav={nav} active={route} phase={phases[route]} storage={files.reduce((n, f) => n + (f?.file.size ?? 0), 0)} onNavigate={navigate} onClear={clear}>
        {route === 'files' && (
          <FilesPage
            files={files}
            onFiles={setFiles}
            datasets={datasets}
            loaded={loaded}
            onOpenTool={navigate}
            onLoadFile={loader.loadFile}
            restorable={loader.restorable}
            onRestore={loader.restore}
            onDismissRestore={loader.dismiss}
          />
        )}
        {route === 'info' && (
          <Suspense fallback={<ToolSkeleton title="How it works" />}>
            <InfoPage onNavigate={navigate} />
          </Suspense>
        )}
        {mounted.map((t) => {
          const { id, title, Component } = t;
          return (
            <div key={id + keyOf(t)} hidden={route !== id}>
              <ErrorBoundary label={title} retryLabel="Reload tool">
                <Suspense fallback={<ToolSkeleton title={title} />}>
                  <ToolPhaseContext.Provider value={{ id, set: setPhases }}>
                    <Component datasets={datasets} onRestart={clear} />
                  </ToolPhaseContext.Provider>
                </Suspense>
              </ErrorBoundary>
            </div>
          );
        })}
      </AppShell>
      <JobDialog {...loader.job} />
      <WelcomeModal visible={welcome} onClose={() => setWelcome(false)} onLearnMore={() => navigate('info')} />
    </WorkspaceContext.Provider>
  );
}
