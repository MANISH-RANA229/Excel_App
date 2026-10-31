import { lazy } from 'react';
import { GitCompareArrows } from 'lucide-react';

export default {
  id: 'diffcheck',
  title: 'Diff Check',
  description: 'Compare one column from each file word by word. Finds the best matching row in Excel 2 for every row in Excel 1, with a match % and colour-coded result file.',
  icon: GitCompareArrows,
  category: 'compare',
  needs: 2,
  Component: lazy(() => import('./DiffCheck.jsx')),
};
