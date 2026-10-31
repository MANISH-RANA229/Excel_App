import assert from 'node:assert/strict';
import { resolveRoute, tools } from './index.js';

const byNeeds = (n) => tools.find((t) => t.needs === n).id;
const none = [false, false], one = [true, false], both = [true, true];

assert.equal(new Set(tools.map((t) => t.id)).size, tools.length, 'tool ids are unique (they are the URLs)');
assert.ok(!tools.some((t) => t.id === 'files'), '"files" is reserved for the Files page');
assert.ok(tools.every((t) => t.resultLabel), 'every tool names its results page (header breadcrumb)');

assert.equal(resolveRoute('files', both), 'files');
assert.equal(resolveRoute('nope', both), 'files', 'unknown route');
assert.equal(resolveRoute(byNeeds(2), one), 'files', 'needs both files');
assert.equal(resolveRoute(byNeeds(2), both), byNeeds(2));
assert.equal(resolveRoute(byNeeds(1), none), 'files', 'needs a file');
assert.equal(resolveRoute(byNeeds(1), one), byNeeds(1));
assert.equal(resolveRoute(byNeeds(0), none), byNeeds(0), 'tools that load their own files are always open');
console.log('features/index ok');
