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
import {GENERATOR_VERSION} from '../src/settings-schema.js';
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

// TWO HASHES, BECAUSE ONLY ONE OF THEM OWES A VERSION BUMP.
//
// `record` covers the biome's own fields -- its name, its palette, its light.
// `ground` covers what the generator built. Both are worth watching, and they
// mean completely different things: a palette or a title is a LOOK, and changing
// one cannot move a ball or invalidate a saved round, while a metre of terrain
// can do both.
//
// They used to be one hash, and that made the tool lie in a specific way: it
// reported "output moved for an unchanged seed, so GENERATOR_VERSION has to go
// up" after three biome TITLES were renamed. Nothing had moved. The instruction
// was wrong, and an arbiter that cries wolf gets ignored the one time it
// matters -- which is precisely the failure the version rule exists to prevent.
function recordHash(biome) {
 const h = crypto.createHash('sha1');
 // Hashed by an explicit list rather than by iterating the object: consolidating
 // scattered behaviour into this record adds fields, and a fingerprint that
 // changed every time one was added would prove nothing about the fields that
 // were already there.
 for (const k of ['name','title','tag','rough','semi','fairway','fringe','green',
  'tree','sky','sand','water','rock','altitude','temperature','treeKind','sun'])
  h.update(`${k}=${BIOMES[biome][k]};`);
 return h.digest('hex').slice(0, 16);
}

function fingerprint(biome) {
 const h = crypto.createHash('sha1');
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
 // Boulders joined the world in the slice that made them solid. They were
 // placed by the renderer before that, so the generator had nothing to hash
 // and a change to where they sit went unnoticed -- which matters now that a
 // ball can stop against one.
 for (const r of w.rocks || []) h.update(`r${n(r.x)},${n(r.z)},${n(r.reach)};`);
  for (const st of w.streams.streams) {
   h.update(`s${st.kind},${st.end},${st.points.length};`);
   for (const p of st.points) h.update(`${n(p.x)},${n(p.z)},${n(p.level)},${n(p.width)};`);
  }
 }
 return h.digest('hex').slice(0, 16);
}

const biomes = Object.keys(BIOMES);
const now = {}, rec = {};
for (const b of biomes) {
 const started = performance.now();
 rec[b] = recordHash(b);
 now[b] = fingerprint(b);
 console.log(`${b.padEnd(10)} ${now[b]}  rec ${rec[b]}   ${((performance.now() - started) / 1000).toFixed(1)}s`);
}

const argv = process.argv.slice(2);
if (argv.includes('--save')) {
 fs.mkdirSync(path.dirname(STORE), {recursive: true});
 // The generator version rides WITH the hashes, so `--check` can tell the two
 // reasons output moves apart: a refactor that should have changed nothing,
 // and a deliberate change that owes a version bump.
 fs.writeFileSync(STORE, JSON.stringify({generator: GENERATOR_VERSION, biomes: now, records: rec}, null, 1) + '\n');
 console.log(`\nstored ${biomes.length} fingerprints at generator ${GENERATOR_VERSION}`);
} else if (argv.includes('--check')) {
 if (!fs.existsSync(STORE)) {console.error('\nnothing stored yet -- run with --save first'); process.exit(1);}
 const stored = JSON.parse(fs.readFileSync(STORE, 'utf8'));
 // Older stores are a flat {biome: hash} with no version in them.
 const was = stored.biomes || stored, wasGen = stored.generator ?? null;
 // A store written before the split has no records; treat those as unknown
 // rather than as changed, or the first run after this lands reports every
 // biome as moved and teaches exactly the wrong lesson.
 const wasRec = stored.records || null;
 const movedRecord = wasRec ? biomes.filter(b => wasRec[b] && wasRec[b] !== rec[b]) : [];
 const moved = biomes.filter(b => was[b] && was[b] !== now[b]);
 const added = biomes.filter(b => !was[b]);
 const gone = Object.keys(was).filter(b => !now[b]);
 for (const b of moved) console.error(`CHANGED  ${b}: ${was[b]} -> ${now[b]}`);
 for (const b of added) console.log(`new      ${b}`);
 for (const b of gone) console.error(`REMOVED  ${b}`);
 // Said first and separately, because it is the common case and it owes
 // nothing: a palette tweak or a rename is a look, not a landscape.
 if (movedRecord.length && !moved.length && !gone.length) {
  console.log(`\n${movedRecord.length} biome record(s) changed: ${movedRecord.join(', ')}`);
  console.log('The GROUND is unchanged, so no GENERATOR_VERSION bump is owed --');
  console.log('a name, a palette or a light is a look and cannot move a ball or');
  console.log('invalidate a saved round. Re-run with --save to accept them.');
  process.exit(0);
 }
 if (moved.length || gone.length) {
  if (movedRecord.length) console.error(`record(s) also changed: ${movedRecord.join(', ')}`);
  console.error(`\n${moved.length + gone.length} biome(s) moved GROUND`);
  // THE CHECK THAT WAS MISSING. GENERATOR_VERSION exists so a player's saved
  // round is never silently rebuilt on different ground, and the only way to
  // know it was needed is exactly this: output moved for an unchanged seed.
  // It was documented in AGENTS.md and missed anyway, so it is enforced here
  // rather than remembered.
  if (wasGen !== null && wasGen === GENERATOR_VERSION) {
   console.error(`\nGENERATOR_VERSION is still ${GENERATOR_VERSION}.`);
   console.error('Output moved for an unchanged seed, so it has to go up, with a');
   console.error('line describing the change in the list above the constant in');
   console.error('src/settings-schema.js. Then re-run with --save.');
  }
  process.exit(1);
 }
 if (wasGen !== null && wasGen !== GENERATOR_VERSION)
  console.log(`\nnote: GENERATOR_VERSION went ${wasGen} -> ${GENERATOR_VERSION} and nothing moved. If that bump was for terrain, it did not land.`);
 console.log(`\nevery existing biome is unchanged${added.length ? `, ${added.length} new` : ''}`);
}
