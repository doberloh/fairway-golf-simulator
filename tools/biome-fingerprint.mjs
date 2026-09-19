#!/usr/bin/env node
// A fingerprint of what every biome generates, so a refactor can prove it
// changed nothing.
//
//   node tools/biome-fingerprint.mjs            print the hash per biome
//   node tools/biome-fingerprint.mjs --save     store them
//   node tools/biome-fingerprint.mjs --check    compare against the stored set
//
// WHY THIS EXISTS. Moving a biome's behaviour out of scattered conditionals and
// into one record is a refactor with no visible intent: every existing biome
// must come out identical, and "it looks the same" is not a check when the
// differences would be a metre of terrain here and one missing shrub there.
//
// Generation is deterministic in its settings, so a hash over what it produces
// is exact. Anything this misses is something the refactor could silently
// change, so it samples widely rather than cheaply: ground height and surface
// on a grid, every hole's geometry, every tree, house, water body and channel,
// and the biome's own palette and light.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateWorld, BIOMES} from '../src/course.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(here, '..', 'bench', 'biome-fingerprints.json');

// Two seeds per biome: one course can hide a difference that only shows when a
// feature happens to be present.
const SEEDS = ['FINGER-1', 'FINGER-2'];

const n = v => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(4) : String(v));

function fingerprint(biome) {
 const h = crypto.createHash('sha1');
 // The parts of the record a player can SEE, hashed by an explicit list rather
 // than by iterating the object -- consolidating scattered behaviour into this
 // record adds fields, and a fingerprint that changed every time one was added
 // would prove nothing about the fields that were already there.
 for (const k of ['name','title','tag','rough','semi','fairway','fringe','green',
  'tree','sky','sand','water','rock','altitude','temperature','treeKind','sun'])
  h.update(`${k}=${BIOMES[biome][k]};`);
 for (const seed of SEEDS) {
  const w = generateWorld({seed, biome, holes: 9, rivers: 1, creeks: 2, water: 60, lakes: 1, trees: 60, homes: true});
  h.update(`|${seed}|${n(w.halfX)},${n(w.halfZ)},${n(w.waterLevel)}|`);
  // The ground itself, and what it plays as.
  for (let x = -900; x <= 900; x += 29)
   for (let z = -900; z <= 900; z += 29) h.update(n(w.height(x, z)) + w.surface(x, z) + ';');
  for (const hole of w.holes) {
   h.update(`H${hole.hole},${n(hole.length)},${n(hole.par)},${n(hole.greenSize)};`);
   for (const t of Object.values(hole.tees)) h.update(`t${n(t.x)},${n(t.z)},${n(t.yards)};`);
   for (const p of hole.ponds) h.update(`p${n(p.x)},${n(p.z)},${n(p.rx)},${n(p.rz)},${n(p.level)};`);
   for (const b of hole.bunkers) h.update(`b${n(b.x)},${n(b.z)},${n(b.rx)};`);
   for (const t of hole.trees || []) h.update(`T${n(t.x)},${n(t.z)},${n(t.h)},${n(t.r)};`);
  }
  // Scenery and water are where a biome's own rules live.
  for (const t of w.trees || []) h.update(`w${n(t.x)},${n(t.z)},${t.kind},${n(t.h)};`);
  for (const home of w.homes || []) h.update(`m${n(home.x)},${n(home.z)},${n(home.width)};`);
  for (const st of w.streams.streams) {
   h.update(`s${st.kind},${st.end},${st.points.length};`);
   for (const p of st.points) h.update(`${n(p.x)},${n(p.z)},${n(p.level)},${n(p.width)};`);
  }
 }
 return h.digest('hex').slice(0, 16);
}

const biomes = Object.keys(BIOMES);
const now = {};
for (const b of biomes) {
 const started = performance.now();
 now[b] = fingerprint(b);
 console.log(`${b.padEnd(10)} ${now[b]}   ${((performance.now() - started) / 1000).toFixed(1)}s`);
}

const argv = process.argv.slice(2);
if (argv.includes('--save')) {
 fs.mkdirSync(path.dirname(STORE), {recursive: true});
 fs.writeFileSync(STORE, JSON.stringify(now, null, 1) + '\n');
 console.log(`\nstored ${biomes.length} fingerprints`);
} else if (argv.includes('--check')) {
 if (!fs.existsSync(STORE)) {console.error('\nnothing stored yet -- run with --save first'); process.exit(1);}
 const was = JSON.parse(fs.readFileSync(STORE, 'utf8'));
 const moved = biomes.filter(b => was[b] && was[b] !== now[b]);
 const added = biomes.filter(b => !was[b]);
 const gone = Object.keys(was).filter(b => !now[b]);
 for (const b of moved) console.error(`CHANGED  ${b}: ${was[b]} -> ${now[b]}`);
 for (const b of added) console.log(`new      ${b}`);
 for (const b of gone) console.error(`REMOVED  ${b}`);
 if (moved.length || gone.length) {console.error(`\n${moved.length + gone.length} biome(s) moved`); process.exit(1);}
 console.log(`\nevery existing biome is unchanged${added.length ? `, ${added.length} new` : ''}`);
}
