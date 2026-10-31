import { lazy } from 'react';
import { Sigma } from 'lucide-react';

export default {
  id: 'summarize',
  title: 'Summarize',
  description: 'Totals, counts and averages per group without building a pivot table. Also turns columns into rows (unpivot) and swaps rows and columns.',
  icon: Sigma,
  category: 'organize',
  needs: 1,
  Component: lazy(() => import('./SummarizeTool.jsx')),
};
