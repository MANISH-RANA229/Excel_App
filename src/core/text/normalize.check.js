import assert from 'node:assert/strict';
import { normalizeHeader, normalizeKey } from './normalize.js';

assert.equal(normalizeKey('  Acme   Steel Ltd. '), 'acme steel ltd.', 'case, spaces and NBSP');
assert.equal(normalizeKey('Acme, Steel (Ltd.)', { ignorePunctuation: true }), 'acme steel ltd');
assert.equal(normalizeKey('A-B', { ignorePunctuation: true }), 'ab');
assert.equal(normalizeKey('Acme', { ignoreCase: false }), 'Acme');
assert.equal(normalizeKey('a  b', { collapseSpaces: false }), 'a  b');
assert.equal(normalizeKey('ＡＢＣ １２３'), 'abc 123', 'full-width characters fold to ASCII (NFKC)');
assert.equal(normalizeKey('Café', { ignoreCase: true }), 'café', 'accents are kept (they are letters)');
assert.equal(normalizeKey(null), '');
assert.equal(normalizeKey(42), '42');

assert.equal(normalizeHeader('Cust. ID'), normalizeHeader('cust_id'));
assert.equal(normalizeHeader('  Order  No '), 'orderno');
assert.notEqual(normalizeHeader('Name'), normalizeHeader('Names'));

console.log('normalize: all checks passed');
