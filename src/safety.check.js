import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// The promises the app makes on the welcome note and the How-it-works page, enforced:
//   · your original file is never written to: the browser only lets us READ a dropped file, and nothing here asks for write access
//   · nothing is sent anywhere
//   · nothing is stored in the browser except the "don't show the welcome note again" choice (shared/welcomeSeen.js)
//   · every download gets its own name, never just the original's name

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  return e.isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(e.name) && !e.name.endsWith('.check.js') ? [p] : [];
});
const code = (file) => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, ''); // comments may talk about these things
const sources = walk('src').map((file) => ({ file: relative('.', file).replaceAll('\\', '/'), text: code(file) }));
assert.ok(sources.length > 50, 'found the source files');

const FORBIDDEN = [
  [/\bshowSaveFilePicker|showOpenFilePicker|showDirectoryPicker|createWritable|FileSystemFileHandle|FileSystemDirectoryHandle/, 'write access to the user\'s files'],
  [/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|EventSource/, 'a network request'],
  [/document\.cookie/, 'cookies'],
  [/sessionStorage|indexedDB/, 'browser storage'],
];
for (const { file, text } of sources) {
  for (const [pattern, what] of FORBIDDEN) assert.ok(!pattern.test(text), `${file} uses ${what} (${pattern.exec(text)?.[0]})`);
  if (file !== 'src/shared/welcomeSeen.js') assert.ok(!/localStorage/.test(text), `${file} uses localStorage: only shared/welcomeSeen.js may (the welcome note choice)`);
}

// Download names: a template that is nothing but the original's name would invite saving over it.
for (const { file, text } of sources.filter((s) => s.file.endsWith('/exportSpec.js'))) {
  const names = [...text.matchAll(/fileName:\s*`([^`]*)`/g)].map((m) => m[1]);
  assert.ok(names.length, `${file} names its download`);
  for (const name of names) {
    let literal = name.replace(/\$\{[^}]*\}/g, '').replace(/\.(xlsx|zip)$/, '');
    const single = /^\$\{(\w+)\}\.(xlsx|zip)$/.exec(name)?.[1]; // `${stem}.xlsx`: fine when stem itself is built with extra words
    if (single) literal = (new RegExp(`const ${single} = \`([^\`]*)\``).exec(text)?.[1] ?? '').replace(/\$\{[^}]*\}/g, '');
    // some fixed text or a "_" joiner between parts is required: never the bare original name
    assert.ok(/[A-Za-z_]/.test(literal), `${file}: download name \`${name}\` could equal the original file's name`);
  }
}
console.log(`safety ok (${sources.length} source files scanned)`);
