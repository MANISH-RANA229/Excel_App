import assert from 'node:assert/strict';
import { AppError, ErrorCode, reviveError, serializeError, toAppError } from './errors.js';

const e = new AppError(ErrorCode.TOO_LARGE, { detail: '9M cells' });
assert.equal(e.code, 'TOO_LARGE');
assert.match(e.message, /too large/i);
assert.ok(e.hint.length > 0, 'default hint filled in');

// explicit message/hint override the defaults
const custom = new AppError('BAD_CONFIG', { message: 'Pick a column.', hint: '' });
assert.equal(custom.message, 'Pick a column.');
assert.equal(custom.hint, '');

// unknown codes degrade to UNKNOWN instead of throwing
assert.equal(new AppError('NOPE').code, 'UNKNOWN');

// plain errors and AbortError are wrapped
assert.equal(toAppError(new Error('boom')).code, 'UNKNOWN');
assert.match(toAppError(new Error('boom')).detail, /boom/);
assert.equal(toAppError(Object.assign(new Error('x'), { name: 'AbortError' })).code, 'CANCELLED');
assert.equal(toAppError(e), e, 'AppError passes through');
assert.equal(toAppError('text').code, 'UNKNOWN');

// survives the worker boundary (structured clone = JSON-safe plain object)
const back = reviveError(JSON.parse(JSON.stringify(serializeError(e))));
assert.ok(back instanceof AppError);
assert.deepEqual([back.code, back.message, back.hint, back.detail], [e.code, e.message, e.hint, e.detail]);

console.log('errors: all checks passed');
