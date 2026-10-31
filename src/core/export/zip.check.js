import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import JSZip from 'jszip';
import { ZipWriter, crc32 } from './zip.js';

// crc32 vs the well-known check value, and chunked == whole
assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
const data = Uint8Array.from({ length: 10_000 }, (_, i) => (i * 31) % 251);
assert.equal(crc32(data.subarray(5000), crc32(data.subarray(0, 5000))), crc32(data), 'crc continues across chunks');

// read back with an independent implementation (JSZip verifies CRC-32 with checkCRC32)
const text = 'Zażółć gęślą jaźń — ₹ 1,00,000 — 日本語 — 🙂\n'.repeat(500);
const big = Uint8Array.from({ length: 3_000_000 }, (_, i) => (i * 2654435761) >>> 24); // poorly compressible
async function* chunks() { for (let i = 0; i < big.length; i += 700_000) yield big.subarray(i, i + 700_000); }

const zw = new ZipWriter();
await zw.add('hello.txt', text);
await zw.add('empty.bin', new Uint8Array(0));
await zw.add('dir/ünïcode 名前.txt', 'name is utf-8');
await zw.add('streamed.bin', chunks()); // multi-chunk async iterable, deflated
await zw.add('stored.bin', big, { compress: false });
await zw.add('mixed.txt', (async function* () { yield 'a'; yield Uint8Array.of(98); yield 'c'; })());
const blob = zw.finish();
assert.equal(blob.type, 'application/zip');

const zip = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
assert.deepEqual(Object.keys(zip.files).sort(), ['dir/ünïcode 名前.txt', 'empty.bin', 'hello.txt', 'mixed.txt', 'stored.bin', 'streamed.bin']);
assert.equal(await zip.file('hello.txt').async('string'), text);
assert.equal((await zip.file('empty.bin').async('uint8array')).length, 0);
assert.equal(await zip.file('dir/ünïcode 名前.txt').async('string'), 'name is utf-8');
assert.equal(await zip.file('mixed.txt').async('string'), 'abc');
const sha = (u8) => createHash('sha256').update(u8).digest('hex');
assert.equal(sha(await zip.file('streamed.bin').async('uint8array')), sha(big), 'chunked, deflated content identical');
assert.equal(sha(await zip.file('stored.bin').async('uint8array')), sha(big), 'stored content identical');

// deflate really happened for compressible text, and not for stored data
const raw = new Uint8Array(await blob.arrayBuffer());
assert.ok(raw.length < text.length * 2 + big.length * 2 + 2000);
assert.ok(zip.file('hello.txt')._data.compressedSize < text.length / 5, 'text compressed');
assert.equal(inflateRawSync(Buffer.from(raw.subarray(30 + 'hello.txt'.length, 30 + 'hello.txt'.length + zip.file('hello.txt')._data.compressedSize))).toString(), text, 'valid raw deflate (node:zlib)');

// an abandoned stream must not hang or corrupt the writer
const bad = new ZipWriter();
await assert.rejects(bad.add('x', (async function* () { yield 'ok'; throw new Error('source failed'); })()), /source failed/);

console.log('zip: all checks passed');
