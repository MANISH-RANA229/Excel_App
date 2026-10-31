import assert from 'node:assert/strict';
import { OPERATIONS, OPERATION_GROUPS, OPS } from './operations.js';
import { displayText, outputNames, runColumns, stepName, stepProblem } from './pipeline.js';
import { table } from './testkit.js';

const t = table({ First: ['Asha', 'Bilal', ''], Last: ['Rao', 'Khan', 'Solo'], Qty: { text: ['2', '3', 'x'], nums: [2, 3, NaN] } });
const step = (op, options, name) => ({ id: Math.random(), op, name, options: { ...structuredClone(OPS[op].defaults), ...options } });

// ---- the registry is consistent: every operation has what the screens and the engine rely on
for (const op of OPERATIONS) {
  assert.ok(op.id && op.label && op.group && op.description, `${op.id}: has text for the screen`);
  assert.equal(typeof op.build, 'function', op.id);
  assert.equal(typeof op.uses, 'function', op.id);
  assert.equal(typeof op.defaultName, 'function', op.id);
  for (const f of op.fields) assert.ok(['column', 'columns', 'text', 'number', 'select', 'checkbox', 'pairs', 'conditions'].includes(f.type), `${op.id}.${f.key}: known field type`);
  for (const f of op.fields) assert.ok(f.key in op.defaults, `${op.id}.${f.key}: has a default`);
  assert.equal(typeof op.defaultName(op.defaults), 'string', `${op.id}: default name works on the defaults`);
}
assert.equal(new Set(OPERATIONS.map((o) => o.id)).size, OPERATIONS.length, 'unique ids');
assert.deepEqual(OPERATION_GROUPS.flatMap((g) => g.items).length, OPERATIONS.length, 'every operation is in a dropdown group');
assert.deepEqual(OPERATION_GROUPS.map((g) => g.label), ['Text', 'Numbers', 'Dates', 'Logic', 'Numbering']);

// ---- steps build on each other
const steps = [
  step('join', { columns: ['First', 'Last'] }, 'Full name'),
  step('splitPart', { column: 'Full name', delimiter: 'space', part: 2 }),
  step('math', { left: 'Qty', op: 'mul', rightKind: 'value', value: 10 }, 'Qty x10'),
];
const { added, stats } = runColumns(t, steps, { today: 45000 });
assert.deepEqual(added.map((c) => c.name), ['Full name', 'Full name part 2', 'Qty x10'], 'new columns in step order');
assert.deepEqual(added[0].text, ['Asha Rao', 'Bilal Khan', 'Solo']);
assert.deepEqual(added[1].text, ['Rao', 'Khan', ''], 'step 2 reads the column step 1 made');
assert.deepEqual(Array.from(added[2].nums.slice(0, 2)), [20, 30]);
assert.deepEqual(stats, [{ blank: 0, failed: 0 }, { blank: 1, failed: 0 }, { blank: 0, failed: 1 }], '"x" cannot be multiplied; "Solo" has no second word');
assert.equal(added[0].nums, null, 'text columns carry no numbers');
assert.equal(added[0].failed, null, 'and no failure marks when nothing failed');
assert.deepEqual(Array.from(added[2].failed), [0, 0, 1]);
assert.equal(added[2].text[2], '', 'a failed cell is blank');
assert.deepEqual(t.names, ['First', 'Last', 'Qty'], 'the input table is not modified');

// ---- names: blank → the operation's default; clashes get a number, case-insensitively
assert.equal(stepName(step('join', { columns: ['First'] })), 'Joined');
assert.equal(stepName(step('join', { columns: ['First'] }, '  Who  ')), 'Who');
assert.deepEqual(outputNames(['Joined', 'FIRST'], [step('join', {}), step('join', {}), step('join', {}, 'first'), step('join', {}, 'Who'), step('join', {}, 'who')]),
  ['Joined (2)', 'Joined (3)', 'first (2)', 'Who', 'who (2)']);

// ---- names also avoid columns that were not sent along
assert.deepEqual(runColumns(t, [step('rowNumber', {}, 'Hidden')], { reserved: ['hidden', 'Other'] }).added.map((c) => c.name), ['Hidden (2)']);

// ---- number display
assert.deepEqual([displayText(5, null), displayText(1234.5, null), displayText(0.30000000000000004, null), displayText(3.1, '0.00'), displayText(0.125, '0.0%'), displayText(7.6, '0')], ['5', '1234.5', '0.3', '3.10', '12.5%', '8']);
assert.equal(displayText(45356, 'dd-mmm-yyyy'), '05-Mar-2024');

// ---- step problems
const available = ['First', 'Last'];
assert.equal(stepProblem(step('join', { columns: ['First', 'Last'] }), available), null);
assert.equal(stepProblem(step('join', { columns: [] }), available), 'Choose “Columns to join, in this order”.');
assert.equal(stepProblem(step('splitPart', { column: null }), available), 'Choose “Column”.');
assert.equal(stepProblem(step('template', { template: '' }), available), 'Fill in “Template (column names in braces)”.');
assert.equal(stepProblem(step('template', { template: '{Nope}' }), available), 'The column “Nope” is not in the file, and no step above this one creates it.');
assert.equal(stepProblem(step('splitPart', { column: 'Full name' }), available), 'The column “Full name” is not in the file, and no step above this one creates it.');
assert.equal(stepProblem(step('splitPart', { column: 'Full name' }), [...available, 'Full name']), null, 'available once an earlier step makes it');
assert.equal(stepProblem(step('splitPart', { column: 'First', delimiter: 'custom', custom: '' }), available), 'Fill in “The character(s) to split at”.');
assert.equal(stepProblem(step('rowNumber', {}), []), null, 'operations that read no column need none');
assert.equal(stepProblem(step('runningTotal', { column: 'Qty', groupBy: [] }), ['Qty']), null, 'optional columns may stay empty');

// ---- progress, and an empty table
let last = -1;
runColumns(t, steps, {}, (f) => { last = f; });
assert.equal(last, 1);
assert.deepEqual(runColumns(table({ A: [] }), [step('rowNumber', {})]).added[0].text, []);
assert.deepEqual(runColumns(t, []).added, [], 'no steps, no new columns');

// ---- a reading error in a later step cannot hide an earlier result: unreadable dates only fail their own cells
const mixed = table({ D: ['2024-03-05', 'soon', ''] });
const r = runColumns(mixed, [step('datePart', { column: 'D', part: 'year' }), step('dateAdd', { column: 'D', amount: 1, unit: 'days' })], { today: 45000 });
assert.deepEqual(r.stats, [{ blank: 1, failed: 1 }, { blank: 1, failed: 1 }]);
assert.equal(r.added[1].text[0], '06-Mar-2024', 'dates come out in the Excel-style text');

console.log('columns pipeline: all checks passed');
