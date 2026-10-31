import { BANDS } from '../../core/bands.js';
import { AMBIGUOUS, MATCHED, NOT_FOUND } from './engine.js';

// Indexed by the engine's status codes. Colours come from the shared Excel-style bands.
export const STATUSES = [];
STATUSES[MATCHED] = { key: 'matched', label: 'Matched', color: BANDS[0].bar, bg: BANDS[0].bg, fg: BANDS[0].fg };
STATUSES[AMBIGUOUS] = { key: 'ambiguous', label: 'Ambiguous', color: BANDS[2].bar, bg: BANDS[2].bg, fg: BANDS[2].fg };
STATUSES[NOT_FOUND] = { key: 'notfound', label: 'Not found', color: BANDS[4].bar, bg: BANDS[4].bg, fg: BANDS[4].fg };
