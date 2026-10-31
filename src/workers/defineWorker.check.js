import assert from 'node:assert/strict';

// Fake the worker global so the real message flow runs in Node.
const posted = [];
globalThis.self = { postMessage: (msg, list) => posted.push({ msg, list }), onmessage: null };
const { defineWorker, withTransfer } = await import('./defineWorker.js');
const send = async (payload) => {
  posted.length = 0;
  await self.onmessage({ data: { type: 'run', payload } });
  return posted.map((p) => p.msg);
};

// success path + progress
defineWorker(async (p, { report }) => {
  if (p.mode === 'throw') throw Object.assign(new Error('boom'), { name: 'Error' });
  if (p.mode === 'transfer') { const b = new Uint8Array(4); return withTransfer({ b }, [b.buffer]); }
  report({ step: 1, steps: 2, stage: 'A', fraction: null });
  for (let i = 1; i <= 100; i++) report({ step: 2, steps: 2, stage: 'B', fraction: i / 100 });
  return { sum: p.x + 1 };
});

let out = await send({ x: 1 });
assert.deepEqual(out.at(-1), { type: 'done', result: { sum: 2 } });
assert.equal(out[0].stage, 'A', 'first progress is delivered');
assert.ok(out.filter((m) => m.type === 'progress').length < 102, 'progress is throttled');
assert.equal(out.filter((m) => m.type === 'progress').at(-1).fraction, 1, 'completion always delivered');

// errors are serialised, never thrown across the boundary
out = await send({ mode: 'throw' });
assert.equal(out.length, 1);
assert.equal(out[0].type, 'error');
assert.equal(out[0].error.code, 'UNKNOWN');
assert.match(out[0].error.detail, /boom/);

// transfer list is forwarded
await send({ mode: 'transfer' });
assert.equal(posted.at(-1).list.length, 1);

// unknown message types are ignored
posted.length = 0;
await self.onmessage({ data: { type: 'noise' } });
assert.equal(posted.length, 0);

console.log('defineWorker: all checks passed');
