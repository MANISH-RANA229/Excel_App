import assert from 'node:assert/strict';
import { OPS } from '../operations.js';
import { run, table } from '../testkit.js';

// ---- join
const names = table({ First: ['Asha', 'Bilal', '', 'Chitra'], Last: ['Rao', ' Khan', 'Solo', ''] });
assert.deepEqual(run(names, 'join', { columns: ['First', 'Last'] }).values, ['Asha Rao', 'Bilal Khan', 'Solo', 'Chitra'], 'blank cells leave no stray space');
assert.deepEqual(run(names, 'join', { columns: ['First', 'Last'], separator: ', ', skipBlank: false }).values, ['Asha, Rao', 'Bilal, Khan', ', Solo', 'Chitra, ']);
assert.deepEqual(run(table({ A: { text: ['5'], nums: [5], format: '0' }, B: ['x'] }), 'join', { columns: ['A', 'B'], separator: '-' }).values, ['5-x'], 'numbers join as the text shown');

// ---- template
assert.deepEqual(run(names, 'template', { template: '{Last}, {First}' }).values, ['Rao, Asha', 'Khan, Bilal', 'Solo,', ', Chitra'].map((s) => s.replace('Solo,', 'Solo, ')), 'column values are trimmed');
assert.deepEqual(OPS.template.uses({ template: '{Last}, {First} {Last}' }), ['Last', 'First', 'Last']);
assert.equal(OPS.template.check({ template: '{Nope}' }, ['First', 'Last']), 'There is no column called “Nope”.');
assert.equal(OPS.template.check({ template: '{First}!' }, ['First', 'Last']), null);
assert.deepEqual(run(names, 'template', { template: 'fixed' }).values, ['fixed', 'fixed', 'fixed', 'fixed'], 'no braces: the same text every row');

// ---- split: pick a part
const full = table({ Full: ['Asha Kumari  Rao', 'Bilal', '', 'a,b,c'] });
assert.deepEqual(run(full, 'splitPart', { column: 'Full', delimiter: 'space', part: 2 }).values, ['Kumari', '', '', ''], 'a run of spaces is one split; missing piece = blank');
assert.deepEqual(run(full, 'splitPart', { column: 'Full', delimiter: 'space', part: 1, fromEnd: true }).values, ['Rao', 'Bilal', '', 'a,b,c']);
assert.deepEqual(run(full, 'splitPart', { column: 'Full', delimiter: 'comma', part: 3 }).values, ['', '', '', 'c']);
assert.deepEqual(run(table({ Code: ['AB-12-X', 'ZZ'] }), 'splitPart', { column: 'Code', delimiter: 'custom', custom: '-', part: 2 }).values, ['12', '']);
assert.match(OPS.splitPart.check({ delimiter: 'custom', custom: '' }), /character/);
assert.equal(OPS.splitPart.check({ delimiter: 'comma', custom: '' }), null);

// ---- text before / after
const mail = table({ Email: ['ann@acme.com', 'bob@x.org', 'nomail', '', 'a@b@c.com'] });
const ba = (o) => run(mail, 'beforeAfter', { column: 'Email', delimiter: 'custom', custom: '@', ...o }).values;
assert.deepEqual(ba({ side: 'before' }), ['ann', 'bob', '', '', 'a']);
assert.deepEqual(ba({ side: 'before', whenMissing: 'whole' }), ['ann', 'bob', 'nomail', '', 'a']);
assert.deepEqual(ba({ side: 'after' }), ['acme.com', 'x.org', '', '', 'b@c.com']);
assert.deepEqual(ba({ side: 'after', occurrence: 'last' }), ['acme.com', 'x.org', '', '', 'c.com']);

// ---- first / last characters
const word = table({ Word: ['Hello', 'Hi', '', ' Wide '] });
assert.deepEqual(run(word, 'part', { column: 'Word', mode: 'first', count: 3 }).values, ['Hel', 'Hi', '', 'Wid']);
assert.deepEqual(run(word, 'part', { column: 'Word', mode: 'last', count: 2 }).values, ['lo', 'Hi', '', 'de']);
assert.deepEqual(run(word, 'part', { column: 'Word', mode: 'middle', start: 2, count: 3 }).values, ['ell', 'i', '', 'ide']);

// ---- pull out of text
const notes = table({ Note: ['Call +91 98765 43210 or mail ann@acme.com', 'visit https://www.acme.com/x now', 'no data here', 'total 1,250.50 due INV-2041'] });
const ex = (what, pattern = '') => run(notes, 'extract', { column: 'Note', what, pattern }).values;
assert.deepEqual(ex('email'), ['ann@acme.com', '', '', '']);
assert.deepEqual(ex('phone'), ['+91 98765 43210', '', '', '']);
assert.deepEqual(ex('number'), [91, '', '', 1250.5], 'the first number; "-2041" of INV-2041 is not negative');
assert.deepEqual(ex('url'), ['', 'https://www.acme.com/x', '', '']);
assert.deepEqual(ex('domain'), ['acme.com', 'acme.com', '', '']);
assert.deepEqual(ex('custom', 'INV-(\\d+)'), ['', '', '', '2041'], 'the first (group) is kept');
assert.deepEqual(ex('custom', 'inv-\\d+'), ['', '', '', 'INV-2041'], 'case does not matter');
assert.equal(OPS.extract.check({ what: 'custom', pattern: '(' }), 'This is not a valid pattern.');
assert.equal(OPS.extract.check({ what: 'custom', pattern: 'x'.repeat(201) }), 'The pattern is too long.');
assert.equal(OPS.extract.check({ what: 'email', pattern: '(' }), null);

console.log('columns text ops: all checks passed');
