import { lazy } from 'react';
import { Sparkles } from 'lucide-react';

export default {
  id: 'cleaner',
  title: 'Data Cleaner',
  resultLabel: 'Cleaning result',
  description: 'Fix stray spaces, numbers and dates stored as text, and inconsistent case. It finds the problems for you, shows a preview, and keeps a change log.',
  icon: Sparkles,
  category: 'clean',
  needs: 1,
  cta: 'Clean data',
  Component: lazy(() => import('./CleanerTool.jsx')),
};
