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
//   { id, title, description, icon, category, needs: 0 | 1 | 2, Component: lazy(() => import('./X.jsx')) }
// `needs` = how many files must be loaded (1: any one of them, 2: both; 0: the tool loads its own files). Add the manifest here and it
// appears in the sidebar and on the Files page.
export const CATEGORIES = [
  { id: 'compare', title: 'Compare & match' },
  { id: 'clean', title: 'Clean' },
  { id: 'organize', title: 'Organize' },
];

export const tools = [diffcheck, keycompare, lookup, reconcile, duplicates, cleaner, split, summarize, combine, colbuilder];

/** loaded = [bool, bool] for the two file slots. */
export const isReady = (tool, loaded) => (tool.needs === 0 ? true : tool.needs === 1 ? loaded.some(Boolean) : loaded.every(Boolean));
export const needsHint = (tool) => (tool.needs === 1 ? 'Load a file first' : 'Load both files first');
