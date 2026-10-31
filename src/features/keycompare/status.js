import { BANDS } from '../../core/bands.js';
import { ADDED, CHANGED, REMOVED, SAME } from './engine.js';

const band = (k) => ({ color: BANDS[k].bar, bg: BANDS[k].bg, fg: BANDS[k].fg });

// Index = status code from engine.js. Unchanged is deliberately neutral grey: only differences should stand out.
export const STATUSES = [];
STATUSES[SAME] = { code: SAME, label: 'Unchanged', color: '#7F7F7F', bg: '#F2F2F2', fg: '#595959' };
STATUSES[CHANGED] = { code: CHANGED, label: 'Changed', ...band(2) };
STATUSES[ADDED] = { code: ADDED, label: 'Added (only in Excel 2)', ...band(0) };
STATUSES[REMOVED] = { code: REMOVED, label: 'Removed (only in Excel 1)', ...band(4) };

/** Old value / new value cell colours, as in a text diff: red for what was, green for what is. */
export const OLD_STYLE = { fill: BANDS[4].bg, color: BANDS[4].fg };
export const NEW_STYLE = { fill: BANDS[0].bg, color: BANDS[0].fg };
