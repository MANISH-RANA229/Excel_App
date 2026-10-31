import assert from 'node:assert/strict';
import { toSerial } from '../../parse/date.js';
import { OPS } from '../operations.js';
import { run, table } from '../testkit.js';
import { parseEdges } from './logic.js';

const rule = (column, cmp, value = '', result = '', value2 = '') => ({ column, cmp, value, value2, result });
const ifThen = (t, rules, otherwise = '') => run(t, 'ifThen', { rules, otherwise }).values;

// ---- IF … THEN: the first rule that fits wins; unreadable numbers never satisfy a greater/less test
const score = table({ Score: ['90', '55', '72', '', 'abc', '100'] });
assert.deepEqual(ifThen(score, [rule('Score', 'gt', '80', 'A'), rule('Score', 'between', '60', 'B', '79')], 'C'), ['A', 'C', 'B', 'C', 'C', 'A']);
assert.deepEqual(ifThen(score, [rule('Score', 'ge', '90', 'Top'), rule('Score', 'lt', '60', 'Low')]), ['Top', 'Low', '', '', '', 'Top'], 'no rule fits and no "otherwise": blank');
assert.deepEqual(ifThen(score, [rule('Score', 'le', '55', 'Low'), rule('Score', 'blank', '', 'Missing')], 'ok'), ['ok', 'Low', 'ok', 'Missing', 'ok', 'ok']);
// results that are all numbers make a number column
const bonus = run(score, 'ifThen', { rules: [rule('Score', 'gt', '80', '5000'), rule('Score', 'gt', '60', '2000')], otherwise: '0' });
assert.deepEqual(bonus.values, [5000, 0, 2000, 0, 0, 5000]);
assert.ok(bonus.nums, 'numeric result column');
assert.equal(run(score, 'ifThen', { rules: [rule('Score', 'gt', '80', 'Gold')], otherwise: '0' }).nums, null, 'one text result keeps the column text');

// text tests ignore case and surrounding spaces; "equal to" also equates 100 and 100.0
const code = table({ Code: ['100', '100.0', 'abc', ' ABC ', 'xabcx', ''] });
assert.deepEqual(ifThen(code, [rule('Code', 'eq', '100', 'num'), rule('Code', 'eq', 'abc', 'txt')], '-'), ['num', 'num', 'txt', 'txt', '-', '-']);
assert.deepEqual(ifThen(code, [rule('Code', 'ne', 'abc', 'not')], 'is'), ['not', 'not', 'is', 'is', 'not', 'not']);
assert.deepEqual(ifThen(code, [rule('Code', 'contains', 'ABC', 'has')], '-'), ['-', '-', 'has', 'has', 'has', '-']);
assert.deepEqual(ifThen(code, [rule('Code', 'notcontains', 'abc', 'no')], 'yes'), ['no', 'no', 'yes', 'yes', 'yes', 'no']);
assert.deepEqual(ifThen(code, [rule('Code', 'starts', 'ab', 's')], '-'), ['-', '-', 's', 's', '-', '-']);
assert.deepEqual(ifThen(code, [rule('Code', 'ends', 'bc', 'e')], '-'), ['-', '-', 'e', 'e', '-', '-']);
assert.deepEqual(ifThen(code, [rule('Code', 'filled', '', 'full')], 'empty'), ['full', 'full', 'full', 'full', 'full', 'empty']);

// dates compare as dates
const when = table({ D: { text: ['01-Jan-2024', '01-Sep-2024', ''], nums: [toSerial(2024, 1, 1), toSerial(2024, 9, 1), NaN], format: 'dd-mmm-yyyy' } });
assert.deepEqual(ifThen(when, [rule('D', 'lt', '2024-06-01', 'H1')], 'H2'), ['H1', 'H2', 'H2']);
assert.deepEqual(ifThen(when, [rule('D', 'between', '2024-01-01', 'in', '2024-03-31')], 'out'), ['in', 'out', 'out'], 'both ends included');
// a rule can read a number with a decimal comma
assert.deepEqual(run(table({ A: ['1.234,5', '999'] }), 'ifThen', { rules: [rule('A', 'gt', '1000', 'big')], otherwise: 'small' }, { decimal: ',' }).values, ['big', 'small']);

// problems the screen shows
const check = (o) => OPS.ifThen.check(o, []);
assert.equal(check({ rules: [rule(null, 'eq', 'x', 'y')] }), 'Choose a column in every rule.');
assert.equal(check({ rules: [rule('Score', 'eq', ' ', 'y')] }), 'Type what “Score” is compared with.');
assert.equal(check({ rules: [rule('Score', 'between', '1', 'y', '')] }), 'Type both ends of the range.');
assert.equal(check({ rules: [rule('Score', 'blank', '', 'y')] }), null);

// ---- bucket
const age = table({ Age: ['5', '17', '18', '34', '35', '60', '100', '', 'x'] });
const bucket = (edges) => run(age, 'bucket', { column: 'Age', edges }).values;
assert.deepEqual(bucket('18, 35, 60'), ['Under 18', 'Under 18', '18–34', '18–34', '35–59', '60 and over', '60 and over', '', null]);
assert.deepEqual(bucket('60 18 35 18'), bucket('18,35,60'), 'any order, duplicates ignored');
assert.deepEqual(run(table({ N: ['0.2', '1', '2'] }), 'bucket', { column: 'N', edges: '0.5, 1.5' }).values, ['Under 0.5', '0.5 to under 1.5', '1.5 and over']);
assert.deepEqual(run(table({ N: ['0', '1', '2', '3'] }), 'bucket', { column: 'N', edges: '1,2,3' }).values, ['Under 1', '1', '2', '3 and over'], 'ranges of one number are named by it');
assert.deepEqual(parseEdges('x, 5; 2 , 5'), [2, 5]);
assert.match(OPS.bucket.check({ edges: 'abc' }), /at least one number/);

// ---- translate with a list
const city = table({ Code: ['del', 'MUM ', 'xyz', ''] });
const pairs = [{ find: 'DEL', with: 'Delhi' }, { find: 'mum', with: 'Mumbai' }, { find: '', with: 'ignored' }];
const map = (o) => run(city, 'mapValues', { column: 'Code', pairs, ...o }).values;
assert.deepEqual(map({}), ['Delhi', 'Mumbai', 'xyz', ''], 'matches ignore case and spaces; others are kept; a blank cell stays blank');
assert.deepEqual(map({ otherwise: 'blank' }), ['Delhi', 'Mumbai', '', '']);
assert.deepEqual(map({ otherwise: 'text', otherText: 'Other' }), ['Delhi', 'Mumbai', 'Other', '']);
assert.deepEqual(run(table({ Size: ['S', 'm', 'XL'] }), 'mapValues', { column: 'Size', pairs: [{ find: 's', with: '1' }, { find: 'M', with: '2' }], otherwise: 'blank' }).values, [1, 2, ''], 'a list of numbers gives numbers');
assert.match(OPS.mapValues.check({ pairs: [{ find: ' ', with: 'x' }] }), /at least one value/);

// ---- do two columns match
const same = table({ A: { text: ['Pune', 'Delhi', '', '100'], nums: [NaN, NaN, NaN, 100] }, B: { text: ['pune ', 'Mumbai', '', '100.0'], nums: [NaN, NaN, NaN, 100] } });
assert.deepEqual(run(same, 'sameColumns', { a: 'A', b: 'B' }).values, ['Match', 'Different', '', 'Match']);
assert.deepEqual(run(same, 'sameColumns', { a: 'A', b: 'B', ignoreCase: false, yes: 'Y', no: 'N' }).values, ['N', 'N', '', 'Y']);

console.log('columns logic ops: all checks passed');
