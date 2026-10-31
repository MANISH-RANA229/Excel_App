import { lazy } from 'react';
import { Scale } from 'lucide-react';

export default {
  id: 'reconcile',
  title: 'Reconcile',
  resultLabel: 'Reconciliation result',
  description: 'Match two lists of amounts, such as a ledger and a bank statement, by reference, amount and date. See differences, leftovers and what is still unexplained.',
  icon: Scale,
  category: 'compare',
  needs: 2,
  cta: 'Reconcile',
  Component: lazy(() => import('./ReconcileTool.jsx')),
};
