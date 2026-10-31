import { lazy } from 'react';
import { Merge } from 'lucide-react';

export default {
  id: 'lookup',
  title: 'Fuzzy Lookup / Merge',
  resultLabel: 'Lookup result',
  description: 'Bring columns from Excel 2 into Excel 1 by matching names that are close but not identical, like VLOOKUP that forgives typos and tells you when it is unsure.',
  icon: Merge,
  category: 'compare',
  needs: 2,
  cta: 'Start merge',
  Component: lazy(() => import('./LookupTool.jsx')),
};
