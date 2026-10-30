#!/usr/bin/env node
// HOW MUCH HARDER AN ARCHITECT COURSE PLAYS (architect-courses, 30 October
// 2026). The owner's limit: at most 1.5 strokes per 18 harder than Classic,
// for the virtual golfer (tests/virtual-golfer.mjs).
//
//   node tools/architect-difficulty.mjs                  every landscape, 2 seeds
//   node tools/architect-difficulty.mjs links midwest    some of them
//   node tools/architect-difficulty.mjs --seeds 4 --set archStyle=links
//
// The same seeds, landscapes and golfers play eighteen holes of each designer
// at its defaults (Classic's sliders, Architect's dials), every stroke through
// the round's own rules (game.js), relief as stroke and distance. Two golfers:
// a steady one and a looser one. What it prints is strokes per 18 for each,
// and the Architect-minus-Classic difference, which is the number the goal
// holds to 1.5.
import {generateWorld, BIOMES} from '../src/course.js';
import {Round} from '../src/game.js';
import {virtualGolfer} from '../tests/virtual-golfer.mjs';

const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const seeds = Number(opt('--seeds', 2)), holes = Number(opt('--holes', 18));
const set = {};
for (let i = argv.indexOf('--set'); i >= 0; i = argv.indexOf('--set')) { const [k, v] = argv[i + 1].split('='); set[k] = v; argv.splice(i, 2); }
const biomes = argv.length ? argv : Object.keys(BIOMES);
const SKILLS = {steady: .010, loose: .018};
const TEE = 'white';

const stuck = [];
let where = '';
function playHole(r, h, golfer) {
 r.pars[r.hole] = h.par;
 if (!r.teePlaced) r.placeTee(h.tees);
 let last = null;
 for (let guard = 0; !r.holeComplete; guard++) {
  // A hole the golfer cannot finish in 40 strokes is reported, not hidden:
  // the count goes on the card as it stands and the round carries on.
  // Named with where the golfer was left and on what, so it can be found.
  if (guard > 40) { const p = r.position, w = h.toWorld ? h.toWorld(p) : p; stuck.push(`${where} hole ${r.hole + 1} (${h.design?.template || h.design?.concept || 'classic'}; on ${h.surface(p.x, p.z)} at ${w.x.toFixed(0)},${w.z.toFixed(0)})`); r.cards[0][r.hole] = 40; r.holeComplete = true; return; }
  if (r.relief) { r.takeRelief({spot: {...r.relief.from}, penalty: 1}, h.pin); continue; }
  // A golfer whose last stroke left the ball where it was tries the other
  // shot -- a putt after a chip, a chip after a putt -- as a real one would.
  // Chipping every time, it sat below a raised green's back edge chipping
  // onto the slope and watching the ball run back to its feet (40 strokes on
  // three Architect holes); putting from every fringe instead stranded it
  // below other banks, on both designers. Only a stroke that did nothing
  // changes the club.
  const lie = h.surface(r.position.x, r.position.z), here = {...r.position};
  const stuckHere = last && Math.hypot(last.x - here.x, last.z - here.z) < 1;
  const club = lie === 'green' ? null : stuckHere ? (last.putt ? null : 'putter') : null;
  const s = golfer.shot({hole: h, from: here, club});
  last = {...here, putt: club === 'putter'};
  r.takeShot({...s.result, puttStroke: lie === 'green', onGreen: s.result.onGreen}, h.pin);
 }
}
function round(w, settings, skill, seed) {
 const r = new Round({players: [{name: 'V', team: 'A'}], mode: 'stroke', holes, putting: {mode: 'holeout'}, tee: TEE});
 const g = virtualGolfer({seed, skill, settings});
 for (let i = 0; i < holes; i++) { playHole(r, w.holes[i], g); if (!r.finished) r.nextHole(); }
 return r.cards[0].reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

const rows = [];
let sumC = 0, sumA = 0, n = 0;
for (const biome of biomes) {
 for (let k = 0; k < seeds; k++) {
  const seed = `DIFFICULTY-${k + 1}`;
  const out = {};
  for (const designer of ['classic', 'architect']) {
   const s = {seed, biome, holes, designer, ...(designer === 'architect' ? set : {})};
   const w = generateWorld(s);
   where = `${biome} ${seed} ${designer}`;
   const par = w.holes.reduce((a, h) => a + h.par, 0);
   out[designer] = Object.fromEntries(Object.entries(SKILLS).map(([name, skill]) => [name, round(w, s, skill, `${seed}:${name}`) - par]));
  }
  for (const name of Object.keys(SKILLS)) {
   const c = out.classic[name] * 18 / holes, a = out.architect[name] * 18 / holes;
   sumC += c; sumA += a; n++;
   rows.push(`${biome.padEnd(10)} ${seed.padEnd(13)} ${name.padEnd(7)} classic ${c >= 0 ? '+' : ''}${c.toFixed(1).padStart(5)}  architect ${a >= 0 ? '+' : ''}${a.toFixed(1).padStart(5)}  diff ${(a - c).toFixed(1).padStart(5)}`);
  }
  console.log(rows.slice(-Object.keys(SKILLS).length).join('\n'));
 }
}
console.log(`\nper 18, over ${n} rounds each: classic ${(sumC / n).toFixed(2)} over par, architect ${(sumA / n).toFixed(2)}; architect is ${((sumA - sumC) / n).toFixed(2)} strokes harder (the limit is 1.5)`);
if (stuck.length) console.log(`NOT FINISHED in 40 strokes: ${stuck.length} holes:\n  ${stuck.join('\n  ')}`);
