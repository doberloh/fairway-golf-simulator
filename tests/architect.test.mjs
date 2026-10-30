import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCourse, greenDistance, ovalRadius} from '../src/course.js';
import {landingZones, CONCEPTS, TEMPLATES, MAX_HAZARDS} from '../src/architect.js';
import {architectChoices, STYLES, CLUBS, styleOf} from '../src/architect-styles.js';
import {GOLFER_TABLE} from '../src/golfer-table.js';
import {DEFAULT_COURSE, validateSettings, SETTINGS} from '../src/settings-schema.js';
import {designSettings} from '../src/designer.js';

// THE ARCHITECT (architect-courses, phase 1). A Classic hole places hazards by
// chance; an Architect hole places each against a shot and says why. These
// pin that: the plan exists and is sane, every hazard has a reason, the drive
// bunkers sit where drives land, the green is guarded from the wrong side,
// templates do what they are named for, and every style and club gives valid
// settings.

const YARD = .9144;
const holesOf = (s, n = 18) => Array.from({length: n}, (_, i) => generateCourse(s, i));
const COURSES = [
 {seed: 'ARCH-A', holes: 18, biome: 'midwest', designer: 'architect'},
 {seed: 'ARCH-B', holes: 18, biome: 'links', designer: 'architect', archClub: 'championship'},
 {seed: 'ARCH-C', holes: 18, biome: 'autumn', designer: 'architect', archStyle: 'raynor'},
 {seed: 'ARCH-D', holes: 18, biome: 'desert', designer: 'architect', archStyle: 'modern', archClub: 'resort'},
];
const built = COURSES.map(s => ({s, holes: holesOf(s)}));

test('the golfer table is the ball model\'s, and within the study\'s ranges', () => {
 const good = GOLFER_TABLE.good.clubs.driver.total, avg = GOLFER_TABLE.average.clubs.driver.total;
 assert.ok(good >= 250 && good <= 285, `a good player's drive ${good} yd (250-280 in the study)`);
 assert.ok(avg >= 175 && avg <= 230, `an average drive ${avg} yd (175-225)`);
 for (const g of Object.values(GOLFER_TABLE)) {
  const order = Object.values(g.clubs).map(c => c.total);
  assert.deepEqual(order, [...order].sort((a, b) => b - a), 'longest club first goes furthest');
 }
});

test('every style, club and age gives valid generator settings', () => {
 for (const archStyle of Object.keys(STYLES)) for (const archClub of Object.keys(CLUBS)) for (const archAge of ['new', 'mature', 'old', 'restored']) {
  const d = architectChoices({...DEFAULT_COURSE, designer: 'architect', archStyle, archClub, archAge, holes: 18, seed: 'S'});
  assert.doesNotThrow(() => validateSettings(d), `${archStyle} ${archClub} ${archAge}`);
 }
 const muni = designSettings({designer: 'architect', archClub: 'municipal', holes: 18, seed: 'L'}).courseYards;
 const champ = designSettings({designer: 'architect', archClub: 'championship', holes: 18, seed: 'L'}).courseYards;
 assert.ok(champ - muni >= 700, `a championship venue plays longer than a municipal course (${muni} -> ${champ})`);
 assert.equal(designSettings({designer: 'architect', archStyle: 'links', biome: 'midwest', seed: 'W'}).water, 0, 'links have no ponds');
});

test('every hole has a plan, and every hazard a reason', () => {
 for (const {s, holes} of built) for (const h of holes) {
  const d = h.design;
  assert.ok(d, `${s.seed} ${h.hole + 1}: a design`);
  assert.ok(CONCEPTS[d.concept], `${s.seed} ${h.hole + 1}: concept ${d.concept}`);
  if (d.template) assert.ok(TEMPLATES[d.template].par.includes(h.par), `${d.template} on a par ${h.par}`);
  assert.ok(typeof d.note === 'string' && d.note.length > 20, 'the architect\'s note');
  assert.ok(h.bunkers.length + h.ponds.length <= MAX_HAZARDS, 'the shader paints twelve hazards a hole');
  h.bunkers.forEach((_, i) => assert.ok(d.reasons.some(r => r.kind === 'bunker' && r.i === i && r.why.length > 10), `bunker ${i} has a reason`));
  h.ponds.forEach((_, i) => assert.ok(d.reasons.some(r => r.kind === 'pond' && r.i === i), `pond ${i} has a reason`));
 }
});

test('drive bunkers sit where drives land, far more often than Classic\'s', () => {
 const share = holes => {
  let n = 0, near = 0;
  for (const h of holes) { const z = landingZones(h); for (const b of h.bunkers) if (!b.greenSide) { n++; if (Math.min(Math.abs(b.z - z.good), Math.abs(b.z - z.average)) <= 30) near++; } }
  return {n, near, share: n ? near / n : 0};
 };
 const arch = share(built.flatMap(b => b.holes));
 const classic = share(COURSES.flatMap(s => holesOf({...s, designer: 'classic'})));
 assert.ok(arch.n > 20, 'Architect places fairway bunkers');
 assert.ok(arch.share >= .7, `Architect: ${arch.near} of ${arch.n} by a landing zone`);
 assert.ok(arch.share > classic.share + .2, `Architect ${arch.share.toFixed(2)} against Classic ${classic.share.toFixed(2)}`);
});

test('the green is guarded from the wrong side and opens from the preferred one', () => {
 let checked = 0, frontWrong = 0;
 for (const {holes} of built) for (const h of holes) {
  if (h.par === 3 || h.design.template) continue;
  checked++;
  const wrong = h.design.preferred === 'left' ? -1 : 1;
  // A greenside bunker in front of the green on the wrong side (local +x is
  // the player's left).
  if (h.bunkers.some(b => b.greenSide && b.z < h.green.z && Math.sign(b.x - h.green.x) === wrong)) frontWrong++;
 }
 assert.ok(frontWrong >= checked * .8, `${frontWrong} of ${checked} holes guard the front corner on the wrong side`);
});

test('templates do what they are named for', () => {
 const found = {};
 for (let k = 0; k < 60 && Object.keys(found).length < 4; k++) {
  const s = {seed: `TPL-${k}`, holes: 18, biome: 'autumn', designer: 'architect', archStyle: 'raynor'};
  for (const h of holesOf(s)) if (h.design.template && !found[h.design.template]) found[h.design.template] = h;
 }
 if (found.eden) {
  const h = found.eden, g = h.green;
  const sides = new Set(h.bunkers.filter(b => b.greenSide).map(b => b.z > g.z + 3 ? 'back' : Math.sign(b.x - g.x)));
  assert.ok(sides.has(1) && sides.has(-1) && sides.has('back'), 'Eden: bunkers left, right and behind');
 }
 if (found.nose) {
  const h = found.nose, mid = h.bunkers.filter(b => !b.greenSide && Math.abs(b.x - h.center(b.z)) < 6);
  assert.ok(mid.length >= 2, "the Principal's Nose: two bunkers in the middle of the fairway");
 }
 assert.ok(Object.keys(found).length >= 3, `found ${Object.keys(found).join(', ')}`);
});

test('a fairway tucks round the bunker beside it', () => {
 let tucked = 0, n = 0;
 for (const {holes} of built) for (const h of holes) for (const b of h.bunkers) {
  if (b.greenSide || Math.abs(b.x - h.center(b.z)) < 8) continue;
  n++;
  const sign = Math.sign(b.x - h.center(b.z)), half = sign < 0 ? h.leftWidth(b.z) : h.rightWidth(b.z);
  const inner = Math.abs(b.x - h.center(b.z)) - b.rx;
  if (half <= inner) tucked++;
 }
 assert.ok(n > 10 && tucked / n >= .9, `${tucked} of ${n} side bunkers clear of the mown fairway`);
});

test('the style a landscape leans toward, and its settings, reach the hole', () => {
 const s = {seed: 'LEAN', holes: 18, biome: 'links', designer: 'architect'};
 const style = styleOf(s);
 assert.ok(['links', 'minimalist', 'heathland'].includes(style));
 assert.equal(generateCourse(s, 0).design.style, style);
});

import {world} from './worlds.mjs';
// PHASE 3: the hand (architect-courses). Collection areas play as fairway and
// only off rough or semi-rough; a style that plays along the ground has them,
// one that does not has none; big-bunker styles grow lobes, others none;
// wear sits on tees and short grass only.
test('collection areas play as fairway, on the styles that run along the ground', () => {
 const links = world({seed: 'P3-A', holes: 9, biome: 'links', designer: 'architect', archStyle: 'links'});
 const park = world({seed: 'P3-A', holes: 9, biome: 'midwest', designer: 'architect', archStyle: 'parkland'});
 const cols = links.holes.flatMap(h => (h.collections || []).map(c => ({h, c})));
 assert.ok(cols.length >= 4, `links: ${cols.length} collection areas`);
 for (const {h, c} of cols) {
  const p = h.toWorld(c);
  assert.equal(links.surface(p.x, p.z), 'fairway', 'a collection area\'s middle plays as fairway');
 }
 assert.equal(park.holes.flatMap(h => h.collections || []).length, 0, 'parkland greens have collars, not collection areas');
 assert.ok(links.settings.fringe <= .8, 'links fairways run into the greens on a thin collar');
});

test('lobes on the big-bunker styles only, and wear only on tees and short grass', () => {
 const heath = world({seed: 'P3-B', holes: 9, biome: 'pnw', designer: 'architect', archStyle: 'heathland'});
 const park = world({seed: 'P3-B', holes: 9, biome: 'midwest', designer: 'architect', archStyle: 'parkland'});
 const lobes = w => w.holes.reduce((n, h) => n + h.bunkers.filter(b => b.lobe).length, 0);
 assert.ok(lobes(heath) > 0 && lobes(heath) <= heath.holes.reduce((n, h) => n + h.bunkers.length, 0) * .4, `heathland: ${lobes(heath)} lobes`);
 assert.equal(lobes(park), 0);
 assert.ok(heath.wear.length > 50);
 for (const d of heath.wear) assert.ok(['tee', 'fairway', 'semi'].includes(heath.surface(d.x, d.z)), 'a divot on ' + heath.surface(d.x, d.z));
});
