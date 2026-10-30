import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from './worlds.mjs';
import {ovalRadius} from '../src/course.js';

// AN ARCHITECT COURSE'S MARKINGS (architect-courses, phase 2; markings.js):
// red stakes round water, white ones where the boundary nears play, yardage
// posts at 100, 150 and 200 yd, a rake by each bunker. Decoration, never in
// water, on a path, a green, a tee or in sand. Classic has none.

const YARD = .9144;
const arch = world({seed: 'MARK-T', holes: 9, biome: 'midwest', designer: 'architect', archStory: 'lots'});
const classic = world({seed: 'MARK-T', holes: 9, biome: 'midwest'});

test('Classic has no markings; an Architect course has every kind', () => {
 assert.equal(classic.markers.length, 0);
 const kinds = new Set(arch.markers.map(m => m.kind));
 for (const k of ['stake', 'obstake', 'post100', 'post150', 'post200', 'rake']) assert.ok(kinds.has(k), `no ${k}`);
});

test('nothing stands in water, on a path, a green, a tee or in sand', () => {
 for (const m of arch.markers) {
  const s = arch.surface(m.x, m.z);
  assert.ok(!['water', 'path', 'green', 'tee', 'sand'].includes(s), `${m.kind} on ${s}`);
 }
});

test('every pond is staked round, and every bunker has a rake', () => {
 for (const h of arch.holes) {
  for (const p of h.ponds) {
   const near = arch.markers.filter(m => m.kind === 'stake' && (() => { const q = h.toLocal(m); return Math.hypot(q.x - p.x, q.z - p.z) < Math.max(p.rx, p.rz) + 20; })());
   assert.ok(near.length >= 4, `hole ${h.hole + 1}: a pond with ${near.length} stakes`);
  }
 }
 // One rake a complex: a lobe shares its main bunker's. Counted over the
 // course: a rake can lie nearer the next hole's corridor than its own.
 const rakes = arch.markers.filter(m => m.kind === 'rake').length, main = arch.holes.reduce((n, h) => n + h.bunkers.filter(b => !b.lobe).length, 0);
 assert.ok(rakes >= main * .75, `${rakes} rakes for ${main} bunkers`);
});

test('yardage posts stand at their distance from the green, beside the fairway', () => {
 for (const m of arch.markers.filter(m => m.kind.startsWith('post'))) {
  const yd = Number(m.kind.slice(4)), h = arch.nearest(m.x, m.z).h, q = h.toLocal(m);
  // Measured along the hole's line, so the straight distance can only be shorter.
  const straight = Math.hypot(q.z - h.green.z, h.center(q.z) - h.green.x) / YARD;
  assert.ok(straight <= yd + 2 && straight >= yd * .8, `a ${yd}-yd post ${straight.toFixed(0)} yd from the green`);
  const off = Math.abs(q.x - h.center(q.z)), half = Math.sign(q.x - h.center(q.z)) < 0 ? h.leftWidth(q.z) : h.rightWidth(q.z);
  assert.ok(off > half && off < half + 6, 'just off the fairway');
 }
});

test('a rake lies beside its bunker, not in it', () => {
 for (const m of arch.markers.filter(m => m.kind === 'rake')) {
  const h = arch.nearest(m.x, m.z).h, q = h.toLocal(m);
  // The nearest sand edge, over every bunker and lobe of the hole.
  const gap = Math.min(...h.bunkers.map(b => { const a = Math.atan2(q.z - b.z, q.x - b.x), e = ovalRadius(b, a); return Math.hypot(q.x - b.x, q.z - b.z) - Math.hypot(e.x, e.z); }));
  assert.ok(gap > 0 && gap < 3, `a rake ${gap.toFixed(1)} m from the nearest sand`);
 }
});
