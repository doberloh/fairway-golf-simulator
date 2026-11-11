#!/usr/bin/env node
// THE MAP CHECKS, SCORED ON REAL COURSES (the builder-ux goal, item 24, 10
// November 2026; GOAL.md: "parts of the map are removed on purpose ... and the
// completion scored"). Each built course in bench/courses (local: made by
// tools/build-courses.mjs from OpenStreetMap refined with the LIDAR) gives its
// holes and the surfaces the game plays; each hole is then damaged one way at
// a time and src/builder/map-checks.js asked whether it notices:
//   wrong green  -- the hole's green swapped for the one two holes on (a line
//                   to the wrong place, as on Worthington's map);
//   tee moved    -- its back tee 80 m sideways, off any tee;
//   no green     -- its green left out (an incomplete map).
// Caught: that hole has a doubt (or a crossing or shared green naming it).
// Fixed: for a wrong green, a fix offered that puts it back within 15 m.
// (Since 10 November 2026 no fix is offered for a wrong green -- the owner:
// tell the player it needs fixing -- so Fixed is 0 and a wrong fix counts any
// other fix offered for that hole, which should also be none.)
// False alarms: doubts on the course as built, undamaged.
//
//   node tools/map-checks-bench.mjs [--only worthington,chambers-bay] [--skip-big]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readBuiltFile} from '../src/course-doc.js';
import {worldFromDoc} from '../src/built-world.js';
import {blobs, checkHoles, LIMITS} from '../src/builder/map-checks.js';
const limits = LIMITS;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const dirs = fs.readdirSync(path.join(ROOT, 'bench', 'courses'), {withFileTypes: true}).filter(d => d.isDirectory() && (!only || only.includes(d.name)));
const rows = [];
for (const d of dirs) {
 const file = fs.readdirSync(path.join(ROOT, 'bench', 'courses', d.name)).find(f => f.endsWith('.fairway'));
 if (!file) continue;
 const full = path.join(ROOT, 'bench', 'courses', d.name, file), size = fs.statSync(full).size;
 if (argv.includes('--skip-big') && size > 50e6) { console.log(`${d.name}: skipped (${(size / 1e6).toFixed(0)} MB)`); continue; }
 const doc = await readBuiltFile(new Uint8Array(fs.readFileSync(full))), w = worldFromDoc(doc);
 // The surfaces on a 2 m grid, as the checks read a trace.
 const cell = 2, nx = Math.floor(2 * doc.halfX / cell) + 1, nz = Math.floor(2 * doc.halfZ / cell) + 1, grid = {nx, nz, cell, halfX: doc.halfX, halfZ: doc.halfZ};
 const green = new Uint8Array(nx * nz), tee = new Uint8Array(nx * nz);
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const s = w.surface(-doc.halfX + i * cell, -doc.halfZ + j * cell); if (s === 'green') green[j * nx + i] = 1; else if (s === 'tee') tee[j * nx + i] = 1; }
 const greens = blobs(green, grid, {min: 20}), tees = blobs(tee, grid, {min: 6}), fair = new Set(['fairway', 'semi']);
 const played = (x, z) => fair.has(w.surface(x, z));
 const holes = doc.holes.map(h => ({tees: h.tees.map(t => ({...t})), aims: h.line.slice(1, -1).map(([x, z]) => ({x, z})), green: {...h.green}, par: h.par ?? 4}));
 const check = hs => checkHoles(hs, {greens, tees, played, limits});
 const names = (doubts, n) => doubts.some(q => q.hole === n || q.other === n);
 const base = check(holes), alarmed = new Set(base.flatMap(q => [q.hole, q.other].filter(v => v != null)));
 const tally = {wrong: [0, 0], tee: [0, 0], none: [0, 0], fixed: [0, 0], badfix: [0, 0]};
 holes.forEach((h, n) => {
  if (alarmed.has(n)) return;   // only holes the course as built raises no doubt about
  const other = holes[(n + 2) % holes.length];
  if (other?.green && Math.hypot(other.green.x - h.green.x, other.green.z - h.green.z) > 60) {
   const hs = holes.map(q => ({...q, tees: q.tees.map(t => ({...t})), aims: [...q.aims]})); hs[n].green = {...other.green}; hs[n].aims = [];
   const got = check(hs), caught = names(got, n); tally.wrong[1]++; if (caught) tally.wrong[0]++;
   tally.fixed[1]++; if (got.some(q => q.hole === n && q.fix?.kind === 'green' && Math.hypot(q.fix.to.x - h.green.x, q.fix.to.z - h.green.z) < 15)) tally.fixed[0]++;
   // A fix offered for this hole that does not put it back: a wrong fix.
   tally.badfix[1]++; if (got.some(q => q.hole === n && q.fix && !(q.fix.kind === 'green' && Math.hypot(q.fix.to.x - h.green.x, q.fix.to.z - h.green.z) < 15))) tally.badfix[0]++;
  }
  { const hs = holes.map(q => ({...q, tees: q.tees.map(t => ({...t}))})), b = hs[n].tees.find(t => t.set === 'back') ?? hs[n].tees[0], dir = Math.atan2(h.green.z - b.z, h.green.x - b.x) + Math.PI / 2; b.x += Math.cos(dir) * 80; b.z += Math.sin(dir) * 80; tally.tee[1]++; if (names(check(hs), n)) tally.tee[0]++; }
  { const hs = holes.map(q => ({...q})); hs[n] = {...hs[n], green: null}; tally.none[1]++; if (names(check(hs), n)) tally.none[0]++; }
 });
 const pc = ([a, b]) => b ? `${Math.round(100 * a / b)}% (${a}/${b})` : '--';
 const row = {course: d.name, holes: holes.length, alarms: alarmed.size, wrong: pc(tally.wrong), tee: pc(tally.tee), none: pc(tally.none), fixed: pc(tally.fixed), t: tally};
 rows.push(row);
 console.log(`${d.name.padEnd(16)} holes ${String(holes.length).padStart(2)}  false alarms ${String(alarmed.size).padStart(2)}  wrong green caught ${row.wrong.padEnd(13)} tee moved ${row.tee.padEnd(13)} no green ${row.none.padEnd(13)} wrong green fixed ${row.fixed}`);
}
const sum = k => rows.reduce((s, r) => [s[0] + r.t[k][0], s[1] + r.t[k][1]], [0, 0]), pc = ([a, b]) => b ? `${Math.round(100 * a / b)}% (${a}/${b})` : '--';
const holesAll = rows.reduce((s, r) => s + r.holes, 0), alarmsAll = rows.reduce((s, r) => s + r.alarms, 0);
console.log(`ALL ${rows.length} courses: ${holesAll} holes, false alarms on ${alarmsAll} (${Math.round(100 * alarmsAll / holesAll)}%); wrong green caught ${pc(sum('wrong'))}, tee moved ${pc(sum('tee'))}, no green ${pc(sum('none'))}; wrong green fixed ${pc(sum('fixed'))}, a wrong fix offered ${pc(sum('badfix'))}`);
