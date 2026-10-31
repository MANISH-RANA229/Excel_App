import { lazy } from 'react';
import { CopyCheck } from 'lucide-react';

export default {
  id: 'duplicates',
  title: 'Duplicate Finder',
  description: 'Find repeated rows, even with typos or different word order. Review each group, choose which row to keep, and download a cleaned copy.',
  icon: CopyCheck,
  category: 'clean',
  needs: 1,
  Component: lazy(() => import('./DuplicatesTool.jsx')),
};
