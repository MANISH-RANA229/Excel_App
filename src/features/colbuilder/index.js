import { lazy } from 'react';
import { SquareFunction } from 'lucide-react';

export default {
  id: 'colbuilder',
  title: 'Column Builder',
  resultLabel: 'New columns result',
  description: 'Add new columns worked out from existing ones, without formulas: join or split text, calculate, pick the month or age from a date, IF rules, ranges, ranks.',
  icon: SquareFunction,
  category: 'organize',
  needs: 1,
  cta: 'Add columns',
  Component: lazy(() => import('./ColBuilderTool.jsx')),
};
