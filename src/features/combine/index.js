import { lazy } from 'react';
import { Combine } from 'lucide-react';

export default {
  id: 'combine',
  title: 'Combine Files',
  resultLabel: 'Combined result',
  description: 'Stack many files, or many sheets of one workbook, into one sheet. Columns are matched by header name, whatever their order.',
  icon: Combine,
  category: 'organize',
  needs: 0, // the tool loads its own files, so it does not depend on the two slots of the Files page
  cta: 'Combine',
  Component: lazy(() => import('./CombineTool.jsx')),
};
