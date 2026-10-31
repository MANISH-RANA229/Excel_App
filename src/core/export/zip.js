// Minimal streaming ZIP writer: entries are compressed with the platform's native deflate (CompressionStream)
// and written chunk by chunk, so memory stays near the size of the *compressed* output.
// Used for .xlsx (an xlsx is a zip) and for zips of xlsx files. No zip64: entries and archives must be < 4 GB.

import { AppError } from '../errors.js';

const encoder = new TextEncoder();
const MAX_U32 = 0xffffffff;
const FLAGS = 0x0808; // bit 3: sizes/CRC follow the data · bit 11: UTF-8 names

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32; pass the previous result as `crc` to continue across chunks. */
export function crc32(bytes, crc = 0) {
  let c = ~crc;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function dosDateTime(d = new Date()) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function localHeader(name, method, { time, date }) {
  const b = new Uint8Array(30 + name.length);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, FLAGS, true);
  v.setUint16(8, method, true);
  v.setUint16(10, time, true);
  v.setUint16(12, date, true);
  v.setUint16(26, name.length, true); // CRC and sizes are 0 here; they follow the data
  b.set(name, 30);
  return b;
}

function dataDescriptor(crc, csize, usize) {
  const b = new Uint8Array(16);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x08074b50, true);
  v.setUint32(4, crc, true);
  v.setUint32(8, csize, true);
  v.setUint32(12, usize, true);
  return b;
}

function centralHeader(e, { time, date }) {
  const b = new Uint8Array(46 + e.name.length);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 20, true);
  v.setUint16(8, FLAGS, true);
  v.setUint16(10, e.method, true);
  v.setUint16(12, time, true);
  v.setUint16(14, date, true);
  v.setUint32(16, e.crc, true);
  v.setUint32(20, e.csize, true);
  v.setUint32(24, e.usize, true);
  v.setUint16(28, e.name.length, true);
  v.setUint32(42, e.offset, true);
  b.set(e.name, 46);
  return b;
}

function endOfCentralDirectory(count, size, offset) {
  const b = new Uint8Array(22);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, size, true);
  v.setUint32(16, offset, true);
  return b;
}

const tooLarge = (what) => new AppError('TOO_LARGE', { message: 'The result is too large to put in one file.', detail: what });

async function* asChunks(content) {
  if (typeof content === 'string') yield encoder.encode(content);
  else if (content instanceof Uint8Array) yield content;
  else for await (const c of content) yield typeof c === 'string' ? encoder.encode(c) : c;
}

export class ZipWriter {
  #parts = [];
  #entries = [];
  #offset = 0;
  #stamp = dosDateTime();

  #push(bytes) {
    this.#parts.push(bytes);
    this.#offset += bytes.length;
    if (this.#offset > MAX_U32) throw tooLarge('Archive exceeds 4 GB (zip64 is not supported).');
  }

  /**
   * @param {string} name
   * @param {string | Uint8Array | AsyncIterable<string | Uint8Array>} content  chunks must not be mutated afterwards
   * @param {{ compress?: boolean }} [opts]  compress:false stores bytes as-is (for already-compressed data)
   */
  async add(name, content, { compress = true } = {}) {
    if (this.#entries.length >= 0xffff) throw tooLarge('More than 65,535 files in one archive.');
    const nameBytes = encoder.encode(name);
    const method = compress ? 8 : 0;
    const entry = { name: nameBytes, method, offset: this.#offset, crc: 0, csize: 0, usize: 0 };
    this.#push(localHeader(nameBytes, method, this.#stamp));
    const emit = (bytes) => { entry.csize += bytes.length; this.#push(bytes); };

    if (compress) {
      const stream = new CompressionStream('deflate-raw');
      const writer = stream.writable.getWriter();
      const drain = (async () => {
        const reader = stream.readable.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          emit(value);
        }
      })();
      try {
        for await (const bytes of asChunks(content)) {
          entry.crc = crc32(bytes, entry.crc);
          entry.usize += bytes.length;
          await writer.write(bytes);
        }
        await writer.close();
        await drain;
      } catch (e) {
        await writer.abort(e).catch(() => {});
        await drain.catch(() => {}); // aborting also rejects the reader loop; swallow it, rethrow the real error
        throw e;
      }
    } else {
      for await (const bytes of asChunks(content)) {
        entry.crc = crc32(bytes, entry.crc);
        entry.usize += bytes.length;
        emit(bytes);
      }
    }
    if (entry.usize > MAX_U32) throw tooLarge(`"${name}" exceeds 4 GB.`);
    this.#push(dataDescriptor(entry.crc, entry.csize, entry.usize));
    this.#entries.push(entry);
  }

  /** Writes the directory and returns the finished archive as a Blob. */
  finish(type = 'application/zip') {
    const start = this.#offset;
    for (const e of this.#entries) this.#push(centralHeader(e, this.#stamp));
    this.#push(endOfCentralDirectory(this.#entries.length, this.#offset - start, start));
    return new Blob(this.#parts, { type });
  }
}
