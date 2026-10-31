import assert from 'node:assert/strict';
import { buildKeys, KEY_SEPARATOR } from './keys.js';

const a = ['INV-1', 'inv-1 ', '', 'X'];
const b = ['N', 'N', '', ''];

assert.deepEqual(buildKeys([a]), ['inv-1', 'inv-1', null, 'x'], 'case and spacing ignored by default; blank rows have no key');
assert.deepEqual(buildKeys([a], { ignoreCase: false, collapseSpaces: false }), ['INV-1', 'inv-1 ', null, 'X']);
assert.deepEqual(buildKeys([a], { ignorePunctuation: true }), ['inv1', 'inv1', null, 'x']);
assert.deepEqual(buildKeys([a, b]), [`inv-1${KEY_SEPARATOR}n`, `inv-1${KEY_SEPARATOR}n`, null, `x${KEY_SEPARATOR}`], 'one blank part still makes a key; all blank does not');
assert.notEqual(buildKeys([['a b'], ['c']])[0], buildKeys([['a'], ['b c']])[0], 'the separator keeps column boundaries');
assert.deepEqual(buildKeys([]), []);

console.log('keys: all checks passed');
