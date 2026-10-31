import { BANDS } from '../../core/bands.js';

// Outcome of one reconciliation item. Colours come from the shared Excel-style bands.
export const MATCHED = 0; // same reference, amount within tolerance
export const FUZZY = 1; // similar reference, amount within tolerance
export const PROBABLE = 2; // same amount and nearby date only — the user should check
export const DIFFERENCE = 3; // same reference, different amount
export const ONLY_A = 4;
export const ONLY_B = 5;

const style = (band) => ({ color: BANDS[band].bar, bg: BANDS[band].bg, fg: BANDS[band].fg });

export const STATUSES = [
  { code: MATCHED, group: 'matched', label: 'Matched', ...style(0) },
  { code: FUZZY, group: 'matched', label: 'Matched · similar reference', ...style(1) },
  { code: PROBABLE, group: 'probable', label: 'Probable · amount & date only', ...style(2) },
  { code: DIFFERENCE, group: 'difference', label: 'Amount difference', ...style(3) },
  { code: ONLY_A, group: 'onlyA', label: 'Only in Excel 1', ...style(4) },
  { code: ONLY_B, group: 'onlyB', label: 'Only in Excel 2', ...style(4) },
];

/** The coarser groups shown as filter chips. */
export const GROUPS = [
  { key: 'matched', label: 'Matched', color: BANDS[0].bar },
  { key: 'probable', label: 'Probable', color: BANDS[2].bar },
  { key: 'difference', label: 'Differences', color: BANDS[3].bar },
  { key: 'onlyA', label: 'Only in Excel 1', color: BANDS[4].bar },
  { key: 'onlyB', label: 'Only in Excel 2', color: '#7F7F7F' },
];

export const PASS_LABELS = ['', 'Same reference & amount', 'Same reference, different amount', 'Similar reference & amount', 'Amount & date', 'Total per reference'];
