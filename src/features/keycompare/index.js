import { lazy } from 'react';
import { Diff } from 'lucide-react';
import { suggestKey } from './config.js';

export default {
  id: 'keycompare',
  title: 'Compare by Key',
  resultLabel: 'Key comparison result',
  description: 'Exact comparison of two versions of a list by an ID column. Shows what was added, removed or changed, with old and new values side by side.',
  icon: Diff,
  category: 'compare',
  needs: 2,
  cta: 'Launch',
  badge: 'Fast', // exact matching on an ID is a hash lookup, much quicker than the fuzzy tools
  recommend: ([a, b]) => { const key = suggestKey(a, b); return key && `Key: ${key}`; },
  Component: lazy(() => import('./KeyCompareTool.jsx')),
};
