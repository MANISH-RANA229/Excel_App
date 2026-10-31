import assert from 'node:assert/strict';
import { tools } from '../../features/index.js';
import * as content from './content.js';
import { EXAMPLE, runExample } from './example.js';

const { GUIDE, SECTIONS } = content;

// Every tool is explained, and nothing is explained that does not exist.
assert.deepEqual(Object.keys(GUIDE).sort(), tools.map((t) => t.id).sort(), 'one guide per tool');
for (const [id, g] of Object.entries(GUIDE)) {
  assert.ok(g.does, `${id}: does`);
  for (const k of ['steps', 'output', 'careful']) assert.ok(Array.isArray(g[k]) && g[k].length, `${id}: ${k} is a non-empty list`);
}
assert.equal(new Set(SECTIONS.map((s) => s.id)).size, SECTIONS.length, 'section ids are unique');

// Plain language: no technical words in anything the page shows.
const JARGON = /TF-?IDF|cosine|\bworkers?\b|OOXML|typed array|posting|\bidf\b|vector|algorithm|regex|union-find|Levenshtein|tokeni[sz]/i;
const strings = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
for (const text of strings(content)) assert.ok(!JARGON.test(text), `jargon in: ${text}`);

// The worked example is real: the engine picks the intended row and finds every kind of word the page describes.
const r = runExample();
assert.equal(r.best, 0, 'the engine picks the example row');
assert.ok(r.pct > 0 && r.pct < 100, `example score ${r.pct}%`);
assert.deepEqual(r.words.matched.sort(), ['ltd', 'pvt', 'sharma']);
assert.deepEqual(r.words.fuzzy, [['traders', 'trader']]);
assert.deepEqual(r.words.onlyA, ['delhi']);
assert.deepEqual(r.words.onlyB, ['mumbai']);
assert.equal(r.text, EXAMPLE.rows[0]);
console.log(`info page content ok (example = ${r.pct}%)`);
