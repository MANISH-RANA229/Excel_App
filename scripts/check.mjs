// Runs every src/**/*.check.js (plain assert scripts) in its own process: `npm run check [filter]`.
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const filter = process.argv[2] ?? '';
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  return e.isDirectory() ? walk(p) : e.name.endsWith('.check.js') ? [p] : [];
});

const files = walk('src').filter((f) => f.includes(filter));
let failed = 0;
for (const file of files) {
  const t = performance.now();
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${relative('.', file)}  (${Math.round(performance.now() - t)} ms)`);
  if (!ok) console.log((r.stderr || r.stdout).split('\n').map((l) => '      ' + l).join('\n'));
}
console.log(`\n${files.length - failed}/${files.length} check files passed`);
process.exit(failed ? 1 : 0);
