import assert from 'node:assert/strict';
import { toSerial } from '../parse/date.js';
import { displayNumber, OPS, OPERATIONS, OPERATION_GROUPS } from './operations.js';

const run = (id, text, options = {}, { num = NaN, state = {} } = {}) => OPS[id].apply(text, num, { ...OPS[id].defaults, ...options }, state);

// --- registry shape
assert.ok(OPERATIONS.every((o) => o.id && o.label && o.group && o.description && o.defaults && o.fields && (o.structural || typeof o.apply === 'function')));
assert.equal(new Set(OPERATIONS.map((o) => o.id)).size, OPERATIONS.length, 'ids are unique');
assert.ok(OPERATION_GROUPS.every((g) => g.items.length) && OPERATION_GROUPS.flatMap((g) => g.items).length === OPERATIONS.length);

// --- trim: leading, trailing, repeated and non-breaking spaces; unchanged → undefined
assert.equal(run('trim', '  Acme   Steel  '), 'Acme Steel');
assert.equal(run('trim', 'A  B'), 'A B');
assert.equal(run('trim', 'Acme Steel'), undefined);
assert.equal(OPS.trim.suggestion(1, 'City'), '1 cell in “City” has extra spaces');
assert.equal(OPS.trim.suggestion(1200, 'City'), '1,200 cells in “City” have extra spaces');
assert.equal(OPS.toNumber.suggestion(1, 'Amount'), '1 number in “Amount” is stored as text');
assert.equal(OPS.toDate.suggestion(5, 'Date'), '5 dates in “Date” are stored as text');
assert.equal(OPS.trim.issue('  x'), true);
assert.equal(OPS.trim.issue('x y'), false);

// --- invisible characters
assert.equal(run('invisible', 'Quan​tum Pharma\u0007'), 'Quantum Pharma');
assert.equal(run('invisible', '﻿Name'), 'Name');
assert.equal(run('invisible', 'plain'), undefined);
assert.equal(OPS.invisible.issue('a​b'), true);
assert.equal(OPS.invisible.issue('a b'), true, 'NBSP counts');
assert.equal(OPS.invisible.issue('Zürich ₹'), false, 'ordinary unicode is fine');

// --- case
assert.equal(run('case', 'ACME steel PVT ltd', { mode: 'title' }), 'Acme Steel Pvt Ltd');
assert.equal(run('case', 'o-brien (north)/south', { mode: 'title' }), 'O-Brien (North)/South');
assert.equal(run('case', 'Acme', { mode: 'upper' }), 'ACME');
assert.equal(run('case', 'ACME', { mode: 'lower' }), 'acme');
assert.equal(run('case', 'HELLO there. HOW are you? fine', { mode: 'sentence' }), 'Hello there. How are you? Fine');
assert.equal(run('case', 'Acme', { mode: 'title' }), undefined, 'already right');
assert.equal(run('case', 'ÉCOLE', { mode: 'title' }), 'École');

// --- find & replace: whole cell vs part, case sensitivity, several pairs, empty "find" ignored
const pairs = [{ find: 'Bombay', with: 'Mumbai' }, { find: '', with: 'x' }];
assert.equal(run('replace', ' bombay ', { pairs }), 'Mumbai');
assert.equal(run('replace', 'New Bombay', { pairs }), undefined, 'whole-cell mode leaves partial matches');
assert.equal(run('replace', 'New Bombay', { pairs, match: 'contains' }), 'New Mumbai');
assert.equal(run('replace', 'bombay', { pairs, caseSensitive: true }), undefined);
assert.equal(run('replace', 'a.b', { pairs: [{ find: '.', with: '-' }], match: 'contains' }), 'a-b', 'special characters are literal');
assert.equal(run('replace', 'x', { pairs: [{ find: 'x', with: '$&' }], match: 'contains' }), '$&', 'replacement is literal');
assert.equal(run('replace', 'AB', { pairs: [{ find: 'A', with: 'B' }, { find: 'B', with: 'C' }], match: 'contains' }), 'CC', 'pairs apply in order');

// --- text → number
assert.deepEqual(run('toNumber', '1,234.50'), { text: '1,234.50', num: 1234.5, format: '#,##0.00' });
assert.deepEqual(run('toNumber', '₹ 5,00,000', { format: '0' }), { text: '500000', num: 500000, format: '0' });
assert.equal(run('toNumber', '(1,500.00)').num, -1500);
assert.equal(run('toNumber', '1.234,56', { decimal: ',' }).num, 1234.56);
assert.equal(run('toNumber', '75.25', { format: 'General' }).text, '75.25');
assert.equal(run('toNumber', 'n/a'), null, 'cannot convert → counted, left unchanged');
assert.equal(run('toNumber', '12-34'), null);
assert.equal(run('toNumber', '00123'), null, 'codes with leading zeros are never converted');
assert.equal(run('toNumber', '   '), undefined, 'blank cells are not failures');
assert.equal(OPS.toNumber.issue('1,234.50', NaN), true);
assert.equal(OPS.toNumber.issue('1,234.50', 1234.5), false, 'already a number');
assert.equal(OPS.toNumber.issue('00123', NaN), false);
assert.equal(OPS.toNumber.issue('Acme', NaN), false);
assert.equal(OPS.toNumber.suggest(30, 100), true);
assert.equal(OPS.toNumber.suggest(2, 100), false, 'a few numeric-looking cells in a text column are not a stored-number problem');
assert.equal(displayNumber(1234.567, '#,##0.00'), '1,234.57');
assert.equal(displayNumber(1234.5, '#,##0'), '1,235');
assert.equal(displayNumber(-5, '0.00'), '-5.00');

// --- leading zeros: text and numbers; result is text
assert.deepEqual(run('padZeros', '123', { width: 6 }), { text: '000123', num: NaN });
assert.deepEqual(run('padZeros', '', { width: 6 }), undefined);
assert.deepEqual(run('padZeros', '395003', { width: 6 }, { num: 395003 }), undefined, 'already long enough');
assert.deepEqual(run('padZeros', '7', { width: 3 }, { num: 7 }), { text: '007', num: NaN }, 'numeric cell becomes text');
assert.equal(run('padZeros', 'AB12', { width: 6 }), undefined, 'not a whole number');
assert.equal(run('padZeros', '12.5', { width: 6 }), undefined);

// --- text → date: formats, day-first, ambiguity note, failures
assert.deepEqual(run('toDate', '05/03/2026'), { text: '05-Mar-2026', num: 46086, format: 'dd-mmm-yyyy', note: 'ambiguous' });
assert.deepEqual(run('toDate', '2026-03-05', { format: 'dd/mm/yyyy' }), { text: '05/03/2026', num: 46086, format: 'dd/mm/yyyy' });
assert.equal(run('toDate', '05/03/2026', { dayFirst: false }).num, toSerial(2026, 5, 3), 'month first → 3 May');
assert.equal(run('toDate', '13/03/2026').note, undefined, 'unambiguous');
assert.equal(run('toDate', 'someday'), null);
assert.equal(run('toDate', '31/04/2026'), null, 'impossible date');
assert.equal(run('toDate', ''), undefined);
assert.equal(OPS.toDate.issue('05/03/2026', NaN), true);
assert.equal(OPS.toDate.issue('20260305', NaN), false, 'plain 8-digit numbers are not suggested as dates');
assert.equal(OPS.toDate.issue('05/03/2026', 46086), false);

// --- fill blanks: constant and "value above" (carries the number too)
const st = {};
assert.equal(run('fillBlanks', 'North', {}, { state: st }), undefined);
assert.deepEqual(run('fillBlanks', '', {}, { state: st }), { text: 'North', num: NaN });
assert.deepEqual(run('fillBlanks', '  ', {}, { state: st }), { text: 'North', num: NaN }, 'whitespace-only counts as blank');
const st2 = {};
run('fillBlanks', '1,200.00', {}, { num: 1200, state: st2 });
assert.deepEqual(run('fillBlanks', '', {}, { state: st2 }), { text: '1,200.00', num: 1200 }, 'numeric value carried down as a number');
assert.equal(run('fillBlanks', '', {}, { state: {} }), undefined, 'nothing above → stays blank');
assert.equal(run('fillBlanks', '', { mode: 'constant', value: 'Unknown' }), 'Unknown');
assert.equal(run('fillBlanks', 'x', { mode: 'constant', value: 'Unknown' }), undefined);
assert.equal(run('fillBlanks', '', { mode: 'constant', value: '' }), undefined);

console.log('operations: all checks passed');
