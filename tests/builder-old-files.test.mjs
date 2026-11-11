// OLD FILES STILL OPEN (the builder-ux goal, 10 November 2026; the owner: "add
// this"). A course file saved by the builder before the goal changed anything
// -- tests/fixtures/builder-ux/door2-a351f84.fairway, saved by the
// builder-door-2 journey at a351f84, whose file format is main's (4c39aa5) --
// must keep opening as the same course in the game and the same draft in the
// builder, through every change the goal makes (the new layout, the pen, the
// sharper pictures, which change what is saved).
//
// What it opened as at a351f84 is frozen beside it (.expect.json). Rewrite
// that only on purpose: UPDATE_OLD_FILES=1 node --test tests/builder-old-files.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readBuiltFile, builderPart, validateDoc} from '../src/course-doc.js';
import {readDraft} from '../src/builder/draft.js';
import {worldFromDoc} from '../src/built-world.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, 'fixtures', 'builder-ux', 'door2-a351f84.fairway');
const EXPECT = FILE.replace(/[.]fairway$/, '.expect.json');
const r2 = v => Math.round(v * 100) / 100;

// The course as the game sees it: its holes, trees, and the lie and the
// ground's height on a 24 by 24 grid over the land.
function gameSide(doc) {
 const w = worldFromDoc(doc), lies = {}, heights = [];
 for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++) {
  const x = -doc.halfX + (i + .5) * doc.halfX * 2 / 24, z = -doc.halfZ + (j + .5) * doc.halfZ * 2 / 24;
  const lie = w.surface(x, z); lies[lie] = (lies[lie] ?? 0) + 1; heights.push(r2(w.height(x, z)));
 }
 return {
  name: doc.name, landscape: doc.landscape, builtVersion: doc.builtVersion,
  holes: doc.holes.map(h => ({number: h.number, par: h.par ?? null, index: h.index ?? null, tees: h.tees.map(t => [t.set, r2(t.x), r2(t.z)]), green: [r2(h.green.x), r2(h.green.z)]})),
  yards: w.holes.map(h => h.yards ? Object.fromEntries(Object.entries(h.yards).map(([k, v]) => [k, Math.round(v)])) : null),
  trees: w.trees.length, firstTrees: w.trees.slice(0, 5).map(t => [r2(t.x), r2(t.z), r2(t.y), r2(t.h)]),
  homes: (doc.homes ?? []).length, rocks: (doc.rocks ?? []).length, lies, heights,
 };
}
// The builder's own section, a door 2 draft: where it was, its holes, its
// layers (each mask's painted cells), its pictures and its trees.
function builderSide(d) {
 const sum = m => { let n = 0; for (let k = 0; k < m.length; k++) n += m[k] ? 1 : 0; return n; };
 const masks = d.trace?.masks ? Object.fromEntries([...(d.trace.masks instanceof Map ? d.trace.masks : Object.entries(d.trace.masks))].map(([k, m]) => [k, sum(m)]).sort()) : null;
 return {
  step: d.step, name: d.name, landscape: d.landscape, holesN: d.holesN,
  holes: (d.holes ?? []).map(h => h ? {tees: h.tees.length, aims: h.aims?.length ?? 0, green: !!h.green} : null),
  masks, trees: (d.trees ?? []).length, pics: (d.pics ?? []).map(p => [p.group, p.width, p.height]),
  land: d.land ? [d.land.nx, d.land.nz, d.land.cell] : null,
 };
}

test('a course file saved before the builder-ux goal opens as the same course and the same draft', async () => {
 const bytes = new Uint8Array(fs.readFileSync(FILE));
 const doc = validateDoc(await readBuiltFile(bytes)), part = await builderPart(bytes);
 assert.ok(part, 'the file carries its builder\'s section');
 const got = {game: gameSide(doc), builder: builderSide(await readDraft(part))};
 if (process.env.UPDATE_OLD_FILES) { fs.writeFileSync(EXPECT, JSON.stringify(got, null, 1) + '\n'); return; }
 const want = JSON.parse(fs.readFileSync(EXPECT, 'utf8'));
 assert.deepEqual(got.game, want.game, 'the game opens it as it did');
 assert.deepEqual(got.builder, want.builder, 'the builder reopens its draft as it did');
});
