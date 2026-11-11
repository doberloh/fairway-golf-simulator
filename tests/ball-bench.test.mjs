// The ball against real measurements, as a regression test: runs
// tools/ball-bench.mjs and fails on any check it fails. The bench is where the
// targets and their sources live; this file only makes the suite run it, one
// test per section, so a failure names what a player would notice.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(os.tmpdir(), `fairway-ball-bench-${process.pid}.json`);
const run = spawnSync(process.execPath, [path.join(root, 'tools', 'ball-bench.mjs'), '--quiet', '--json', out], {cwd: root, encoding: 'utf8'});
const {checks} = JSON.parse(fs.readFileSync(out, 'utf8'));
fs.rmSync(out, {force: true});

const TITLES = {
 firmgreen: 'a firm green bounces a ball as the USGA and R&A measured',
 greens: 'each club runs out the right distance on soft, medium and firm greens',
 spin: 'spin: hop and check, come-back only with the spin for it, never ten yards on the flat',
 chips: 'chips roll out by loft as TrackMan\'s chip study found',
 fairway: 'a drive bounces several times and runs as far as drives do',
 stimp: 'a green rolls exactly its Stimp, and holds a ball only on a slope it could',
 putts: 'a putt runs as far as a measured putt of that speed',
 break: 'putts break as AimPoint\'s charts say',
 cup: 'the hole catches what Holmes found a hole catches',
 slopes: 'shots behave on sloping greens',
 flight: 'the ball flies as TrackMan and the USGA publish',
};

test('the bench ran every section', () => {
 assert.ok(checks.length > 120, `${checks.length} checks; ${run.stderr}`);
 assert.deepEqual([...new Set(checks.map(c => c.section))].sort(), Object.keys(TITLES).sort());
});
for (const [section, title] of Object.entries(TITLES)) test(title, () => {
 const failed = checks.filter(c => c.section === section && !c.pass);
 assert.equal(failed.length, 0, failed.map(c => `${c.name}: ${Number(c.value).toFixed(2)} ${c.unit}, want ${c.lo} to ${c.hi}${c.note ? ` (${c.note})` : ''}`).join('\n'));
});
