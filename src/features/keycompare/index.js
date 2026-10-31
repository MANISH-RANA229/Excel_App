import { lazy } from 'react';
import { Diff } from 'lucide-react';

export default {
  id: 'keycompare',
  title: 'Compare by Key',
  description: 'Exact comparison of two versions of a list by an ID column. Shows what was added, removed or changed, with old and new values side by side.',
  icon: Diff,
  category: 'compare',
  needs: 2,
  Component: lazy(() => import('./KeyCompareTool.jsx')),
};
