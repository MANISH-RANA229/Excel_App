import { lazy } from 'react';
import { Files } from 'lucide-react';

export default {
  id: 'split',
  title: 'Split by Column',
  resultLabel: 'Split result',
  description: 'Create one file (or sheet) for every value in a column, for example one workbook per region. Formats and dates are kept exactly as they are.',
  icon: Files,
  category: 'organize',
  needs: 1,
  cta: 'Split',
  Component: lazy(() => import('./SplitTool.jsx')),
};
