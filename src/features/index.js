import cleaner from './cleaner/index.js';
import colbuilder from './colbuilder/index.js';
import combine from './combine/index.js';
import diffcheck from './diffcheck/index.js';
import duplicates from './duplicates/index.js';
import keycompare from './keycompare/index.js';
import lookup from './lookup/index.js';
import reconcile from './reconcile/index.js';
import split from './split/index.js';
import summarize from './summarize/index.js';

// Tool registry. A tool is a folder under features/ with a manifest like diffcheck/index.js:
//   { id, title, resultLabel, description, icon, category, needs: 0 | 1 | 2, cta?, badge?, recommend?, Component: lazy(() => import('./X.jsx')) }
// `needs` = how many files must be loaded (1: any one of them, 2: both; 0: the tool loads its own files). Add the manifest here and it
// appears in the sidebar and on the Files page. Optional: `cta` = the verb on its Files-page card ("Run diff"), `badge` = small tag in the
// sidebar ("Fast"), `recommend(datasets)` = a short note ("Key: Order ID") when the tool suits the loaded files, else null.
// `title` names the group in the sidebar, `tab` on the Files page. `resultLabel` = last level of the header breadcrumb on the tool's
// results ("Workspace › Diff Check › Diff result").
export const CATEGORIES = [
  { id: 'compare', title: 'Compare & Match', tab: 'Compare & Match' },
  { id: 'clean', title: 'Clean & Validate', tab: 'Clean & Fix' },
  { id: 'organize', title: 'Organize', tab: 'Transform' },
];

export const tools = [diffcheck, keycompare, lookup, reconcile, duplicates, cleaner, split, summarize, combine, colbuilder];

/** loaded = [bool, bool] for the two file slots. */
export const isReady = (tool, loaded) => (tool.needs === 0 ? true : tool.needs === 1 ? loaded.some(Boolean) : loaded.every(Boolean));
export const needsHint = (tool) => (tool.needs === 1 ? 'Load a file first' : 'Load both files first');

/** The page a URL may show: unknown ids and tools whose files are not loaded yet fall back to the Files page. */
export const resolveRoute = (id, loaded) => {
  const tool = tools.find((t) => t.id === id);
  return tool && isReady(tool, loaded) ? tool.id : 'files';
};
