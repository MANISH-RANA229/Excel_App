import { lazy } from 'react';
import { Scale } from 'lucide-react';

export default {
  id: 'reconcile',
  title: 'Reconcile',
  description: 'Match two lists of amounts, such as a ledger and a bank statement, by reference, amount and date. See differences, leftovers and what is still unexplained.',
  icon: Scale,
  category: 'compare',
  needs: 2,
  Component: lazy(() => import('./ReconcileTool.jsx')),
};
