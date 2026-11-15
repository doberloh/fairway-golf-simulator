// MEASURE THIS DEVICE (branch phone-performance, 14 November 2026). The owner,
// on an iPhone: "The performance on iPhone and android is pretty bad ... I would
// still like to target 45-60fps on an iPhone." Every frame figure the project
// had came from one desktop graphics card (tools/frame-ab.mjs and friends); a
// phone's own chip cannot be measured from that machine. So the game measures
// itself, on the device, in a minute, and adds what it found to Report a
// problem's diagnostic for the player to paste.
//
// What it does, on the hole being played and nowhere else (the round is not
// touched: no hole is changed, no shot is played):
//   - stands the camera at four places on the hole -- the tee, the fairway, the
//     green, 250 m up -- and reads each one as drawn;
//   - at the tee and from above, takes the frame apart: each part of the scene
//     switched off in turn (the planting, the course's ground, the far ground,
//     the far trees, the shadow maps' redraw, half the pixels), with a reading
//     of the whole frame between every two, because a phone warms up within a
//     minute and later readings would otherwise all read slow (the same rule as
//     tools/frame-variants.mjs on the desktop);
//   - puts the camera back where the player had it.
//
// Each reading is two halves: frames per second as the display shows them,
// and the WORK of a frame -- the draw call and a one-pixel read back, which
// waits for the graphics chip to finish -- because Safari shows at most 60
// frames a second and a frame rate hides how far under that a frame is. Safari
// has no timer for the graphics chip alone (EXT_disjoint_timer_query), which is
// why the read back. The work is split in two: SCRIPT, the game's own code up
// to the last draw call returning (placing, culling, choosing the ground,
// handing the draws over), and the WAIT after it for the chip to finish. A
// large wait is the chip; a large script is the phone's processor. (A browser
// may block a draw call when its queue is full, which moves chip time into
// the script column; a script time near the whole is worth a second look.)
// Draws and triangles are a frame's average over the reading, shadow maps
// included: they are exact and the same on any device. (Counted on one frame,
// as at first, they jumped with the Phone tier's every-fourth-frame shadow.)
//
// Pure: no DOM, no three.js. main.js hands `runBench` an `io` that does the
// work (`place`, `frames`, `measure`, `hide`, `restore`); tests/device-bench
// drives it with a fake one.

// Frames to settle after a move (the cull's rebuild, the shadow maps catching
// up) and after a part is switched; the reading's own frames are main.js's.
// main.js waits that many frames OR their time at 60 frames a second,
// whichever comes first (at least three), so the tour takes about a minute
// at any frame rate. PLACED: half a second, a quarter of a second.
export const BENCH = Object.freeze({settle: 30, settlePart: 15});

// The four places, in a hole's own frame (main.js placePose). The tee and the
// view from above are tools/frame-ab.mjs's `tee1` and `flyhigh`, so a desktop
// reading and a phone reading of the same course can be laid side by side.
export const BENCH_SPOTS = Object.freeze([
 {id: 'tee', label: 'tee', parts: true, pose: h => ({hole: h, along: -4, height: 1.8, look: 'pin'})},
 {id: 'fairway', label: 'fairway', pose: (h, length) => ({hole: h, along: Math.round(Math.max(60, (length || 300) * .55)), height: 1.8, look: 'pin'})},
 {id: 'green', label: 'green', pose: h => ({hole: h, fromPin: 18, height: 1.6})},
 {id: 'above', label: '250 m up', parts: true, pose: h => ({hole: h, along: -150, height: 250, look: 'pin'})},
]);

// The parts of a frame switched off one at a time, and what each is called in
// the report. main.js's `hide` knows how to switch each off and back on.
export const BENCH_PARTS = Object.freeze([
 {id: 'planting', label: 'no trees or plants'},
 {id: 'ground', label: 'no course ground'},
 // Both at once: the floor under everything else, what no thinning of the
 // trees or the ground can go below (the second iPhone run, 15 November).
 {id: 'bare', label: 'no trees, plants or ground'},
 // WHAT-IFS: not a part taken away but a lever tried, so one run prices it.
 // The fifth run (15 November) priced the grass round the camera (-8% at the
 // tee), the old 60 m ring (+15%) and the far versions from twice as near
 // (-6%), the far ground (0 to -9%) and the shadows' redraw (0 to -9%); those
 // rows are gone, the Phone tier took what paid. The sixth tried every tree
 // past the ring as its far version and the trees in the plainest paint, but
 // the phone changed speed under them (below, BENCH_HOLD) and they read as
 // noise; gone too. The ground in plain paint (no light, no shadow, one
 // colour) read -37% and -39% in the slow state, as much as no ground at all
 // -- but plain paint takes away the ground's light and its shadow as well as
 // its painting, so the seventh run takes them apart, each a uniform written
 // and no new program built (the ground's is the slowest to build): its
 // shadow not read; its painted cues off (the sheen, the turf colour
 // variation, the shade under trees, the relief, the slope's drying, the mow
 // stripes); its two byte textures (the cover and the turf detail) as one
 // texel each. Plain paint stays, as the most there is to gain. The seventh
 // run (03:06, from 250 m up, slow): no shadow +1%, cues off -3%, no cover or
 // detail 0%, plain paint -33% -- the cost is the painting itself; those three
 // rows are gone. The eighth prices the painting's parts, each a define on
 // the ground's program (a new program, built during the part's settling):
 // the Phone tier's bunker skip taken away (what it saved), the hazards'
 // loop skipped, the mowing (stripes, diamonds, laps, divots) skipped, the
 // ground types' and far ring's painting skipped. Only the first is exact;
 // the others change what the ground looks like and are prices, not plans.
 // The eighth run (03:25, 250 m up, slow): the skip +2%, no hazards -4%, no
 // mowing -2%, no ground types -2%, plain paint -35% -- no one part is the
 // cost; those rows are gone. The ninth reads the Phone tier's painted ground
 // (ground-bake.js) against the painter it replaces, and plain paint stays as
 // the most there is to gain.
 {id: 'groundUnbaked', label: 'ground without the bake'},
 // The tenth: the Phone tier's harder thinning of the trees outside the
 // hole (graphics.js `lowTrees`) put back to Low's own -- what it saved.
 {id: 'treesAsLow', label: 'trees thinned as on Low'},
 {id: 'plainGround', label: 'ground in plain paint'},
 {id: 'pixels', label: 'half the pixels'},
]);

// THE HOLD (the sixth iPhone run, 15 November; the owner: "the game framerate
// fluctuates quite a bit during play. Things seem to speed up and then slow
// down for no reason"). The same tee read 14 ms of work at 2 s and 31 ms at
// 62 s, every draw and triangle the same, and the step began as the
// what-ifs started switching materials. So before anything is switched or
// resized, the first place is read over and over for about a minute --
// as drawn, without the ground, without trees, plants or ground, and with
// nothing drawn at all (the floor under every work figure: the clear and the
// read back) -- each reading's second and the game's light beside it. If
// "as drawn" steps while the floor holds, the step is in what the game
// draws; if everything steps together, it is the device.
// Three rounds since the seventh run: five showed the flip and a run of two
// minutes is long to sit through.
export const BENCH_HOLD = Object.freeze({
 cycles: 3,
 parts: Object.freeze([
  {id: 'ground', label: 'no course ground'},
  {id: 'bare', label: 'no trees, plants or ground'},
  {id: 'empty', label: 'nothing drawn'},
 ]),
});

const mean2 = (a, b) => a == null ? b : b == null ? a : (a + b) / 2;
// PLACED: the wholes either side of a part a fifth apart (1.2) -- within one
// state the hold read them within about a tenth.
export const STRADDLE = 1.2;

// The tour. Resolves with the rows; `io.restore()` runs whatever happens.
// `onStep(i, n)` is told how far along it is, for the player's progress line.
export async function runBench(io, {hole = 0, length = 300, spots = BENCH_SPOTS, parts = BENCH_PARTS, hold = BENCH_HOLD, onStep = null} = {}) {
 const rows = [];
 const holdEach = 1 + hold.parts.length;
 const steps = spots.reduce((n, s, i) => n + 1 + (i === 0 ? hold.cycles * holdEach : 0) + (s.parts ? parts.length : 0), 1);
 let done = 0;
 const step = () => { done++; onStep?.(done, steps); };
 try {
  for (const spot of spots) {
   io.place(spot.pose(hole, length));
   await io.frames(BENCH.settle);
   let base = await io.measure();
   rows.push({spot: spot.id, part: null, ...base});
   step();
   // The hold, at the first place only, before anything else is switched.
   if (spot === spots[0]) {
    for (let cycle = 1; cycle <= hold.cycles; cycle++) {
     for (const h of [null, ...hold.parts]) {
      let reading;
      const undo = h ? io.hide(h.id) : null;
      try {
       await io.frames(BENCH.settlePart);
       reading = await io.measure();
      } finally { undo?.(); }
      rows.push({spot: spot.id, part: 'hold', hold: h?.id ?? null, cycle, ...reading});
      step();
     }
    }
    await io.frames(BENCH.settlePart);
    base = await io.measure();
   }
   if (!spot.parts) continue;
   for (const part of parts) {
    let reading;
    const undo = io.hide(part.id);
    try {
     await io.frames(BENCH.settlePart);
     reading = await io.measure();
    } finally { undo?.(); }
    await io.frames(BENCH.settlePart);
    const after = await io.measure();
    // Against the mean of the whole frame either side of it -- unless the two
    // differ by more than a fifth: the phone changed speed during the part
    // (BENCH_HOLD), and the row is marked, not trusted.
    const straddle = base.workMs > 0 && after.workMs > 0 && Math.max(base.workMs, after.workMs) / Math.min(base.workMs, after.workMs) > STRADDLE;
    rows.push({spot: spot.id, part: part.id, ...reading, baseWork: mean2(base.workMs, after.workMs), baseFps: mean2(base.fps, after.fps), ...(straddle ? {straddle: true} : {})});
    base = after;
    step();
   }
  }
  // THE FIRST PLACE AGAIN, AT THE END (the owner's first run, 14 November
  // 2026: the same view read 31 ms of work at the start and 60 to 70 ms twenty
  // seconds later, as the phone slowed). Read against the first row, it says
  // how far the device drifted over the run.
  const first = spots[0];
  io.place(first.pose(hole, length));
  await io.frames(BENCH.settle);
  rows.push({spot: first.id, part: 'again', ...await io.measure()});
  step();
 } finally {
  io.restore();
 }
 return rows;
}

// One reading from frame gaps, work times and script times (milliseconds):
// the median frame rate, the slowest frame, the median work and the median
// script. Null where nothing was sampled.
export function readingOf(gaps = [], work = [], counts = {}, script = []) {
 const med = xs => { const s = xs.filter(x => x > 0).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
 const gap = med(gaps), w = med(work), sc = med(script);
 return {
  fps: gap ? Math.round(1000 / gap) : null,
  worstMs: gaps.length ? Math.round(Math.max(...gaps)) : null,
  workMs: w == null ? null : Math.round(w * 10) / 10,
  scriptMs: sc == null ? null : Math.round(sc * 10) / 10,
  draws: counts.draws ?? null,
  triangles: counts.triangles ?? null,
 };
}

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const label = (list, id) => list.find(x => x.id === id)?.label ?? id;
const millions = t => t == null ? '-' : (t / 1e6).toFixed(1) + ' M';

// The report section, in the diagnostic's own layout: a heading line, then
// one row a reading. A part's row says how its work compares with the whole
// frame round it (`-40%`: switching that part off saved 40% of the work).
export function formatBench(bench) {
 if (!bench?.rows?.length) return '';
 const {rows, tier, ratio, canvas, seconds, course} = bench;
 const out = [' DEVICE BENCHMARK'];
 out.push(`  tier            ${tier ?? '?'}`);
 if (ratio != null || canvas) out.push(`  drawn at        ${ratio != null ? `${ratio} pixel ratio` : ''}${canvas ? `${ratio != null ? ', ' : ''}${canvas[0]}x${canvas[1]}` : ''}`);
 if (course) out.push(`  course          ${course}`);
 if (seconds != null) out.push(`  took            ${seconds} s`);
 // What may have spoiled the readings (main.js: the page put away, a shot flown).
 for (const n of bench.notes ?? []) out.push(`  note            ${n}`);
 // `whole ms`: the whole frame's work either side of a part's reading, so a
 // device slowing over the run shows in the column itself.
 // `script`: the part of the work that was the game's own code (see the top).
 out.push(`  ${pad('place', 9)}${pad('reading', 34)}${lpad('fps', 4)}${lpad('worst', 7)}${lpad('work ms', 9)}${lpad('script', 8)}${lpad('whole ms', 10)}${lpad('vs whole', 10)}${lpad('draws', 7)}${lpad('tris', 9)}${lpad('at s', 6)}`);
 for (const r of rows) {
  const vs = r.part && r.workMs != null && r.baseWork ? `${r.straddle ? '~' : ''}${r.workMs <= r.baseWork ? '-' : '+'}${Math.round(Math.abs(r.workMs - r.baseWork) / r.baseWork * 100)}%` : '';
  // The pixels row says the size it drew at, so it proves itself.
  const what = r.part === 'again' ? 'as drawn, at the end' : r.part === 'hold' ? `hold ${r.cycle}: ${r.hold ? label(BENCH_HOLD.parts, r.hold) : 'as drawn'}` : r.part ? label(BENCH_PARTS, r.part) + (r.part === 'pixels' && r.canvas ? ` ${r.canvas[0]}x${r.canvas[1]}` : '') : 'as drawn';
  out.push(`  ${pad(label(BENCH_SPOTS, r.spot), 9)}${pad(what, 34)}${lpad(r.fps ?? '-', 4)}${lpad(r.worstMs ?? '-', 7)}${lpad(r.workMs ?? '-', 9)}${lpad(r.scriptMs ?? '-', 8)}${lpad(r.baseWork != null ? r.baseWork.toFixed(1) : '', 10)}${lpad(vs, 10)}${lpad(r.draws ?? '-', 7)}${lpad(millions(r.triangles), 9)}${lpad(r.at ?? '-', 6)}`);
 }
 if (rows.some(r => r.straddle)) out.push(`  ~ the phone changed speed during that part: its whole frame either side differs by more than ${Math.round((STRADDLE - 1) * 100)}%`);
 // THE GAME'S LIGHT AND VIEW (main.js `benchState`): once, and again
 // wherever it changed, so a step in the table can be laid beside it.
 let was = null;
 for (const r of rows) {
  if (r.state == null || r.state === was) continue;
  out.push(`  ${was == null ? 'state' : 'changed'} at ${r.at ?? '?'} s: ${r.state}`);
  was = r.state;
 }
 // WHAT THE TRIANGLES ARE, where a place was read as drawn: the heaviest
 // things held in view (main.js `heaviestHeld`), so a heavy row names its
 // cause without a second run.
 for (const r of rows) {
  if (r.part || !r.heavy?.length) continue;
  out.push(`  heaviest held at the ${label(BENCH_SPOTS, r.spot)}:`);
  for (const m of r.heavy) out.push(`    ${pad(m.name, 40)}${lpad(millions(m.triangles), 9)}${lpad(m.held != null ? `x${m.held}` : '', 8)}`);
 }
 return out.join('\n');
}
