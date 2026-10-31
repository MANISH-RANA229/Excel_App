import { dateOps } from './ops/date.js';
import { logicOps } from './ops/logic.js';
import { numberOps } from './ops/number.js';
import { sequenceOps } from './ops/sequence.js';
import { textOps } from './ops/text.js';

// Column Builder operations: each one works out a NEW column from existing ones (see ops/text.js for the contract).
export const OPERATIONS = [...textOps, ...numberOps, ...dateOps, ...logicOps, ...sequenceOps];
export const OPS = Object.fromEntries(OPERATIONS.map((op) => [op.id, op]));

const GROUP_ORDER = ['Text', 'Numbers', 'Dates', 'Logic', 'Numbering'];
/** For a grouped dropdown. */
export const OPERATION_GROUPS = GROUP_ORDER.map((label) => ({
  label,
  items: OPERATIONS.filter((op) => op.group === label).map((op) => ({ label: op.label, value: op.id })),
}));
