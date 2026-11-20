// FRAMES DURING A ROUND, TWO BUILDS (the fairway-tour goal, 18 November
// 2026). frame-ab times fixed camera spots; this times the frames of a round
// being played, so whatever happens in it -- a computer golfer planning its
// shot on the frame loop, its ball in flight with the camera following --
// is in the numbers.
//
//   node tools/frame-round.mjs --goal <name> --a <build A> --b <build B> [--tier ultra|low|phone]
//        [--device desktop|iphone-13] [--seconds 60] [--rounds 2]
//        [--b-cpu 3]     build B's group: this many computer golfers out
//                        first, then the person (A: the person alone)
//
// Each build in a fresh browser, alternated (A B B A ...), the same seeded
// nine; the frames are every requestAnimationFrame interval for `seconds`
// from the first tee, uncapped as frame-ab is, with the person swinging on
// the pad whenever it is their turn (so A is a person playing, not one
// standing still). Through the card's gate and logged like frame-ab
// (tools/gpu-gate.mjs).
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gpuGate, logRun} from './gpu-gate.mjs';
import {DEVICES, cpuThrottle} from './devices.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const goal = flag('goal', null);
if (!goal) throw Error('--goal is required.');
const DEVICE = DEVICES[flag('device', 'desktop')], TIER = flag('tier', DEVICE.tier);
const SECONDS = Number(flag('seconds', 60)), ROUNDS = Number(flag('rounds', 2)), B_CPU = Number(flag('b-cpu', 3));
const A = flag('a'), B = flag('b');
const GPU_ARGS = ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit',
 '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];

const serve = file => { const html = fs.readFileSync(path.resolve(ROOT, file)); return new Promise(r => { const s = createServer((q, res) => { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); }); s.listen(0, '127.0.0.1', () => r({s, port: s.address().port})); }); };

// A pull to the blue stop (a putt) or most of a full pull, then straight up
// through the line -- tools/smoke.mjs `strokeOnPad`, by mouse.
async function swingOnPad(page) {
 if (!(await page.evaluate(() => document.getElementById('swingPad')?.hidden === false))) await page.click('#shotButton', {timeout: 3000});
 await page.waitForFunction(() => document.getElementById('swingPad')?.hidden === false, null, {timeout: 3000});
 const g = await page.evaluate(() => { const a = document.getElementById('swingArea'), r = a.getBoundingClientRect();
  return {x: r.left + +a.dataset.x0, y: r.top + +a.dataset.y0, full: +a.dataset.full, share: +document.getElementById('swingMeter')?.dataset.target || .8}; });
 const pull = Math.max(12, g.share * g.full), over = Math.max(8, .12 * g.full), y0 = g.y + 6;
 await page.mouse.move(g.x, y0); await page.mouse.down();
 for (let i = 1; i <= 10; i++) { await page.mouse.move(g.x, y0 + (g.y + pull - y0) * i / 10); await page.waitForTimeout(25); }
 await page.waitForTimeout(200);
 const from = g.y + pull, to = g.y - over, steps = Math.max(10, Math.round(10 * (pull + over) / Math.max(1, pull)));
 for (let i = 1; i <= steps; i++) { await page.mouse.move(g.x, from - (from - to) * i / steps); await page.waitForTimeout(22); }
 await page.mouse.up();
}

async function measure(file, withCpu) {
 const {s, port} = await serve(file);
 const browser = await chromium.launch({headless: true, args: GPU_ARGS});
 try {
  const page = await browser.newPage({viewport: {width: DEVICE.viewport[0], height: DEVICE.viewport[1]}, deviceScaleFactor: DEVICE.dpr});
  await page.addInitScript(p => {
   try { localStorage.setItem('fairway-graphics-v1', JSON.stringify(p)); } catch {}
   try { localStorage.removeItem('fairway-round-v1'); } catch {}
   // A player already made, so the first tee's welcome does not cover the pad (frame-ab's).
   try { if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 2, main: 'pprof', profiles: [{id: 'pprof', name: 'Profiler', created: Date.now(), counters: {}, bests: {}, rounds: []}]})); } catch {}
   // Every computer golfer's shot flown in full: the heaviest watching.
   try { localStorage.setItem('fairway-rules-v1', JSON.stringify({cpuWatch: 'all', cpuChat: p.chat})); } catch {}
  }, {quality: TIER, frameCap: 0, autoResolution: false, chat: flag('chat', '1') !== '0'});
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).split('\n')[0]));
  await page.goto(`http://127.0.0.1:${port}/`, {waitUntil: 'load'});
  await page.waitForFunction(() => window.lab?.course && !document.getElementById('mainMenu').hidden, null, {timeout: 120000});
  const person = {name: 'Person', team: 'A', hand: 'RH', input: 'meter'};
  const cpu = Array.from({length: withCpu}, (_, i) => ({name: `Computer ${i + 1}`, team: 'A', hand: 'RH', input: 'cpu', cpu: {id: `g0${40 + i}`, handicap: flag('b-hcp', null) != null ? Number(flag('b-hcp')) : 6 + 7 * i}}));
  // lab.course resolves once the round is on the first tee (0.9.18 has it too).
  await page.evaluate(g => window.lab.course({holes: 9, biome: 'pacnw', seed: 'FRAMEROUND'}, g), {players: [...cpu, person], mode: 'stroke', tee: 'blue'});
  const renderer = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'), d = gl && gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  if (/swiftshader|llvmpipe|software/i.test(renderer)) throw Error('got a software rasteriser, not the card');
  await page.evaluate(() => new Promise(r => { let n = 0; const t = () => (++n > 60 ? r() : requestAnimationFrame(t)); requestAnimationFrame(t); }));
  const throttle = cpuThrottle(DEVICE);
  if (throttle > 1.01) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', {rate: throttle});
  // The frames gather in the page while the person plays: whenever it is
  // the person's turn and a shot can be taken, a pull and push on the swing
  // pad (smoke's `strokeOnPad`, mouse), the flight watched to the end. So
  // both builds have balls in the air -- the person's own on 0.9.18, the
  // computer golfers' (then the person's) on the branch.
  // Beside the frames, the round's state ten times a second (both builds pay
  // the same), so each long frame can be laid against what had just happened.
  await page.evaluate(() => {
   const d = window.__frames = [], at = window.__at = [], st = window.__states = []; let last = performance.now();
   const tick = now => { d.push(now - last); at.push(now); last = now; if (!window.__framesStop) requestAnimationFrame(tick); };
   requestAnimationFrame(t => { last = t; requestAnimationFrame(tick); });
   const id = setInterval(() => {
    if (window.__framesStop) return clearInterval(id);
    const s = window.lab.state();
    st.push({t: performance.now(), hole: document.getElementById('holeNumber')?.textContent, done: !!s.holeComplete, fly: !!s.inFlight, who: s.turn ? s.turn.active : 0, cpu: !!s.turn?.computer});
   }, 100);
  });
  // --cpuprofile: where the page's main thread went over the whole window,
  // by function, heaviest first (frame-ab's, over a round instead of a spot).
  const cdp = flag('cpuprofile', false) ? await page.context().newCDPSession(page) : null;
  let p0 = 0;
  if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 200}); await cdp.send('Profiler.start'); p0 = await page.evaluate(() => performance.now()); }
  const end = Date.now() + SECONDS * 1000;
  let swings = 0;
  while (Date.now() < end) {
   // The scorecard's Next hole, if it is up (it moves on by itself after 8 s).
   if (await page.isVisible('#nextHoleScore').catch(() => false)) await page.click('#nextHoleScore', {timeout: 2000}).catch(() => {});
   const ready = await page.evaluate(() => window.lab.state().canSwing).catch(() => false);
   if (ready) {
    await swingOnPad(page).catch(() => {});
    // Counted only when a ball is in the air; then its flight is watched out.
    const flew = await page.waitForFunction(() => window.lab.state().inFlight, null, {timeout: 4000}).then(() => true, () => false);
    if (flew) { swings++; await page.waitForFunction(() => !window.lab.state().inFlight, null, {timeout: Math.max(1000, end - Date.now())}).catch(() => {}); }
   }
   await page.waitForTimeout(400);
  }
  const out = await page.evaluate(() => { window.__framesStop = true; const turn = window.lab.state().turn; return {d: window.__frames.slice(1), at: window.__at.slice(1), states: window.__states, strokes: turn?.strokes || [], ahead: turn?.flownAhead || null}; });
  let cpuProfile = null;
  if (cdp) {
   const {profile} = await cdp.send('Profiler.stop');
   const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
   profile.samples.forEach((id, i) => { const n = byId.get(id).callFrame, key = `${n.functionName || '(anon)'} ${n.url.split('/').pop()}:${n.lineNumber}`; self.set(key, (self.get(key) || 0) + (profile.timeDeltas[i] || 0)); });
   cpuProfile = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, us]) => [k, +(us / 1000 / out.d.length).toFixed(3)]);
   // INSIDE THE LONGEST FRAMES: each sample's whole stack, counted for every
   // function on it (inclusive time), over the samples that fell in the
   // frame. The profile's clock is lined up with the page's at its start
   // (within a few ms; the frames looked at are 100 ms and more). Read on an
   // unminified build (`vite build --minify false`) for real names.
   const parent = new Map();
   for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
   const when = []; let ts = profile.startTime;
   for (const dt of profile.timeDeltas) { ts += dt; when.push(p0 + (ts - profile.startTime) / 1000); }
   // And over EVERY frame over 50 ms together: what the long frames as a
   // whole spent their time on (ms summed over the load).
   const sum = new Map(), windows = out.d.map((ms, i) => [ms, out.at[i]]).filter(([ms]) => ms > 50);
   profile.samples.forEach((id, i) => {
    if (!windows.some(([ms, end]) => when[i] >= end - ms && when[i] <= end)) return;
    const seen = new Set();
    for (let n = id; n !== undefined; n = parent.get(n)) {
     const f = byId.get(n).callFrame, k = `${f.functionName || '(anon)'}:${f.lineNumber}`;
     if (!seen.has(k)) { seen.add(k); sum.set(k, (sum.get(k) || 0) + (profile.timeDeltas[i] || 0)); }
    }
   });
   out.longSum = `${windows.length} frames over 50 ms: ` + [...sum].filter(([k]) => !/^\((root|idle|anon)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, us]) => `${k} ${(us / 1000).toFixed(0)}`).join(' > ');
   // And the same split by what came just before each (blame's moments).
   const ev = eventsOf(out.states), byCat = new Map();
   for (const [ms, end] of windows) {
    const cat = categoryOf(ev, end, ms);
    if (!byCat.has(cat)) byCat.set(cat, {n: 0, sum: new Map()});
    const c = byCat.get(cat); c.n++;
    profile.samples.forEach((id, i) => {
     if (when[i] < end - ms || when[i] > end) return;
     const seen = new Set();
     for (let n = id; n !== undefined; n = parent.get(n)) {
      const f = byId.get(n).callFrame, k = `${f.functionName || '(anon)'}:${f.lineNumber}`;
      if (!seen.has(k)) { seen.add(k); c.sum.set(k, (c.sum.get(k) || 0) + (profile.timeDeltas[i] || 0)); }
     }
    });
   }
   out.byCat = [...byCat].map(([cat, c]) => `${cat} (${c.n}): ` + [...c.sum].filter(([k]) => !/^\((root|idle|anon)\)|^tick:|^render:|WebGLRenderer\.render:|renderBufferDirect|renderObjects?:|renderScene/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, us]) => `${k} ${(us / 1000).toFixed(0)}`).join(' > '));
   const longest = out.d.map((ms, i) => [ms, out.at[i]]).sort((x, y) => y[0] - x[0]).slice(0, 3);
   out.inside = longest.map(([ms, end]) => {
    const inc = new Map();
    profile.samples.forEach((id, i) => {
     if (when[i] < end - ms || when[i] > end) return;
     const seen = new Set();
     for (let n = id; n !== undefined; n = parent.get(n)) {
      const f = byId.get(n).callFrame, k = `${f.functionName || '(anon)'}:${f.lineNumber}`;
      if (!seen.has(k)) { seen.add(k); inc.set(k, (inc.get(k) || 0) + (profile.timeDeltas[i] || 0)); }
     }
    });
    const top = [...inc].filter(([k]) => !/^\((root|program|idle|anon)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 14);
    return `${Math.round(ms)} ms frame at ${((end - out.at[0]) / 1000).toFixed(1)} s: ${top.map(([k, us]) => `${k} ${(us / 1000).toFixed(0)}`).join(' > ')}`;
   });
  }
  return {...out, swings, errors, cpuProfile};
 } finally { await browser.close(); s.close(); }
}

const stats = d => { const s = [...d].sort((x, y) => x - y), q = p => s[Math.min(s.length - 1, Math.floor(s.length * p))];
 return {n: d.length, mean: d.reduce((t, v) => t + v, 0) / d.length, p50: q(.5), p95: q(.95), p99: q(.99), worst: s[s.length - 1], over50: d.filter(v => v > 50).length, over33: d.filter(v => v > 33.3).length}; };

// WHAT CAME JUST BEFORE EACH LONG FRAME: the state samples turned into
// events (a computer golfer's turn starting, a shot starting or landing, a
// new hole, the hole finished), and each frame over 50 ms put down to the
// latest event in the second before it, or "nothing". Also the mean frame of
// each 30 s of the load, so a cheap stretch (a green, a scorecard) shows.
function eventsOf(states) {
 const ev = [];
 for (let i = 1; i < states.length; i++) {
  const a = states[i - 1], b = states[i];
  if (b.hole !== a.hole) ev.push([b.t, 'new hole']);
  else if (b.done && !a.done) ev.push([b.t, 'hole finished']);
  else if (b.cpu && (!a.cpu || b.who !== a.who)) ev.push([b.t, 'computer turn starts']);
  else if (b.fly && !a.fly) ev.push([b.t, b.cpu ? 'computer shot starts' : 'shot starts']);
  else if (!b.fly && a.fly) ev.push([b.t, 'shot lands']);
  else if (b.cpu && a.cpu && !b.fly && !a.fly && b.who === a.who && i > 1 && states[i - 2].fly) ev.push([b.t, 'computer plans next shot']);
 }
 return ev;
}
// The latest event in the second before a frame that ended at `end` and
// lasted `ms`, or 'nothing'.
const categoryOf = (ev, end, ms) => (ev.filter(([t]) => t <= end && t >= end - ms - 1000).at(-1) || [0, 'nothing'])[1];
function blame({d, at, states}) {
 const ev = eventsOf(states);
 const counts = {};
 d.forEach((ms, i) => {
  if (ms <= 50) return;
  const k = categoryOf(ev, at[i], ms);
  counts[k] = (counts[k] || 0) + 1;
 });
 // The three longest, each with the events a second either side of it.
 const worst = d.map((ms, i) => [ms, i]).sort((x, y) => y[0] - x[0]).slice(0, 3).map(([ms, i]) => {
  const near = ev.filter(([t]) => Math.abs(t - at[i]) < 1500).map(([t, k]) => `${k} ${t < at[i] ? '' : '+'}${Math.round(t - at[i])} ms`);
  return `${Math.round(ms)} ms at ${((at[i] - at[0]) / 1000).toFixed(1)} s (${near.join('; ') || 'nothing near'})`;
 });
 const buckets = [], start = at[0];
 for (let b = 0; ; b++) { const xs = d.filter((_, i) => at[i] >= start + b * 30000 && at[i] < start + (b + 1) * 30000); if (!xs.length) break; buckets.push((xs.reduce((t, v) => t + v, 0) / xs.length).toFixed(2)); }
 return {counts, buckets, worst, holes: [...new Set(states.map(s => s.hole))].join(',')};
}

const before = gpuGate({goal, cap: Infinity, utilMax: Number(flag('util', 10)), tempMax: Number(flag('temp', 60)), restMin: Number(flag('rest', 5))});
const all = {A: [], B: []}, shots = {A: [], B: []}, swung = {A: [], B: []}, loads = {A: [], B: []}, errs = [];
const started = new Date().toISOString();
for (let r = 0; r < ROUNDS; r++) for (const which of r % 2 ? ['B', 'A'] : ['A', 'B']) {
 const res = await measure(which === 'A' ? A : B, which === 'A' ? 0 : B_CPU);
 all[which].push(...res.d); shots[which].push(res.strokes.reduce((t, v) => t + v, 0)); swung[which].push(res.swings); errs.push(...res.errors.map(e => `${which}: ${e}`));
 const m = stats(res.d); loads[which].push(m);
 process.stderr.write(`${which} (${m.n} frames, mean ${m.mean.toFixed(2)} ms, p50 ${m.p50.toFixed(2)})\n`);
 const why = blame(res); m.blame = why.counts;
 process.stderr.write(`    by 30 s: ${why.buckets.join(' ')} ms · holes seen ${why.holes} · long frames (>50 ms) after: ${Object.entries(why.counts).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}\n`);
 process.stderr.write(`    longest: ${why.worst.join(' | ')}\n`);
 if (res.ahead) process.stderr.write(`    computer strikes on a flight flown ahead: ${res.ahead[0]}, flown at the strike: ${res.ahead[1]}\n`);
 for (const line of res.inside || []) process.stderr.write(`    inside: ${line}\n`);
 if (res.longSum) process.stderr.write(`    all long frames: ${res.longSum}\n`);
 for (const line of res.byCat || []) process.stderr.write(`    after ${line}\n`);
 if (res.cpuProfile) for (const [k, ms] of res.cpuProfile) process.stderr.write(`    ${ms.toFixed(3).padStart(7)} ms a frame  ${k}\n`);
}
const sa = stats(all.A), sb = stats(all.B), f = v => v.toFixed(2).padStart(7);
console.log(`\n${TIER} · ${DEVICE.label} · ${SECONDS} s a load, ${ROUNDS} loads a build · A: ${path.basename(A)} (the person alone) · B: ${path.basename(B)} (${B_CPU} computer golfers out first, then the person; every shot watched)`);
console.log(`        frames     mean      p50      p95      p99    worst  >33ms  >50ms   person's swings · computer shots`);
for (const [k, s] of [['A', sa], ['B', sb]]) console.log(`  ${k}   ${String(s.n).padStart(7)}${f(s.mean)}${f(s.p50)}${f(s.p95)}${f(s.p99)}${f(s.worst)}${String(s.over33).padStart(7)}${String(s.over50).padStart(7)}   ${swung[k].join(', ')} · ${k === 'A' ? '-' : shots[k].join(', ')}`);
console.log(`  B vs A: mean ${((sb.mean / sa.mean - 1) * 100).toFixed(1)}%, p95 ${((sb.p95 / sa.p95 - 1) * 100).toFixed(1)}%, p99 ${((sb.p99 / sa.p99 - 1) * 100).toFixed(1)}%`);
// A load runs in one of two modes on this machine, one about twice the other
// for the same work (docs/history/SURROUNDINGS.md, *A load runs in one of two
// modes*), so frame-ab's rule: four loads a build, and the best load beside
// the pooled figure.
const best = k => loads[k].reduce((x, y) => (y.mean < x.mean ? y : x));
const ba = best('A'), bb = best('B');
console.log(`  loads, mean ms: A ${loads.A.map(s => s.mean.toFixed(2)).join(' ')} · B ${loads.B.map(s => s.mean.toFixed(2)).join(' ')}`);
console.log(`  best load: A ${ba.mean.toFixed(2)} (p99 ${ba.p99.toFixed(2)}) · B ${bb.mean.toFixed(2)} (p99 ${bb.p99.toFixed(2)}) · B vs A ${((bb.mean / ba.mean - 1) * 100).toFixed(1)}%`);
const sumBlame = k => loads[k].reduce((o, s) => { for (const [e, v] of Object.entries(s.blame || {})) o[e] = (o[e] || 0) + v; return o; }, {});
for (const k of ['A', 'B']) console.log(`  long frames (>50 ms) by what came just before, ${k}: ${Object.entries(sumBlame(k)).sort((x, y) => y[1] - x[1]).map(([e, v]) => `${e} ${v}`).join(', ') || 'none'}`);
if (errs.length) console.log('  errors:', [...new Set(errs)].slice(0, 5).join(' | '));
logRun({goal, tool: 'frame-round', tier: TIER, device: flag('device', 'desktop'), started, before, result: {A: sa, B: sb, shots, swung}});
