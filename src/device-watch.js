// WATCH THIS DEVICE (branch phone-performance, 15 November 2026). The owner,
// of the iPhone changing speed by itself: "Let's build more checks in but I
// want it to live under a single touch to grab all the data just like the
// measure button. That makes it repeatable."
//
// Measure this device (device-bench.js) found the phone switching between a
// fast state and one about five times slower, with nothing in the game
// changed. A web page on an iPhone cannot read the phone's heat, its chip's
// clock or its battery. What it can do, and what this does:
//
//   - A RECORDER, ALWAYS ON (`secondRecorder`): one line a second for the last
//     five minutes of play -- frames that second, the slowest gap, the view,
//     and what happened (a touch, a shot, a new hole, a program built, a panel,
//     the page put away). No read back, nothing that slows a frame. The
//     diagnostic's own fps line is a ring of the last 240 frames, read when
//     Copy is pressed, so after a benchmark it measured the benchmark's end and
//     never play (the correction is in RESEARCH): this is what measures play.
//   - PROBES OF THE PHONE ITSELF (renderer.js `probeDevice`): the same small
//     piece of graphics arithmetic, the same piece of graphics memory reading
//     and the same piece of processor work, timed every two seconds of the
//     watch. If all three slow with the game, the whole phone has slowed (heat
//     or power); the graphics alone, the chip's own speed control; the memory
//     probe most, what the ground's slow state suggested; none, the game.
//   - A SCRIPTED WATCH (`runWatch`), about two and a half minutes on the hole
//     being played: the player's own view untouched with no probes (what play
//     is), the same with probes (what the probes cost), the hole's flyover
//     (a moving camera, as play has), then -- late, after the minute in which
//     the phone has stayed fast in every run so far -- rests of 1, 3 and 6
//     seconds with nothing drawn, each followed by ten seconds of watching
//     (twice the phone went from slow to fast just after a blank frame), and
//     the view from above.
//
// Pure: no DOM, no three.js. main.js hands `runWatch` an `io` that does the
// work; tests/device-watch.test.mjs drives it with a fake one.

// The script, in order. `probes`: whether the probes run in that phase.
// PLACED: the lengths, chosen so the whole is about two and a half minutes.
export const WATCH_SCRIPT = Object.freeze([
 {id: 'play', label: 'your view', seconds: 30, probes: false},
 {id: 'probed', label: 'your view, probed', seconds: 30, probes: true},
 {id: 'flyover', label: 'the flyover', seconds: 40, probes: true},
 {id: 'rest1', label: 'rest 1 s', rest: 1, seconds: 10, probes: true},
 {id: 'rest3', label: 'rest 3 s', rest: 3, seconds: 10, probes: true},
 {id: 'rest6', label: 'rest 6 s', rest: 6, seconds: 10, probes: true},
 {id: 'above', label: '250 m up', seconds: 15, probes: true},
]);
export const PROBE_EVERY = 2;       // seconds between probes
export const RECORD_SECONDS = 300;  // the recorder's memory: five minutes
export const BEFORE_SECONDS = 180;  // how much of play before the tap the report shows

// ONE LINE A SECOND. `frame(now)` every rendered frame (ms, the frame clock);
// `event(name)` whenever something happens; the line for a second is closed
// by the first frame of the next. `read(from, to)` gives the closed lines
// between two times (seconds since the recorder began).
export function secondRecorder(size = RECORD_SECONDS) {
 const lines = [];
 let open = null, last = null, pending = [];
 const close = () => { if (!open) return; lines.push(open); if (lines.length > size) lines.shift(); open = null; };
 return {
  frame(now, info = {}) {
   const s = Math.floor(now / 1000);
   if (open && open.t !== s) close();
   if (!open) { open = {t: s, frames: 0, worstMs: 0, view: info.view ?? null, events: pending}; pending = []; }
   open.frames++;
   if (last != null) { const gap = now - last; if (gap <= 1000 && gap > open.worstMs) open.worstMs = Math.round(gap); }
   last = now;
   if (info.view) open.view = info.view;
   if (info.phase) open.phase = info.phase;
  },
  event(name) {
   const into = open ? open.events : pending;
   if (!into.includes(name)) into.push(name);
  },
  // Attach a probe's reading to the line now open (the watch).
  note(key, value) { if (open) open[key] = value; },
  read(from = -Infinity, to = Infinity) { return lines.filter(l => l.t >= from && l.t < to).map(l => ({...l, events: [...l.events]})); },
  get length() { return lines.length; },
 };
}

// The watch itself. `io`: `start()` (closes the panel, lifts the frame cap,
// keeps the screen on), `phase(step)` (sets the view for it: the player's
// own, the flyover, above), `seconds(n)` (resolves after n seconds of frames),
// `probe()` (times the probes; resolves with {trip, math, memory, cpu} or
// {failed}), `rest(n)` (n seconds with nothing drawn), `restore()` (always,
// last). `onStep(i, n)` is told how far along it is.
export async function runWatch(io, {script = WATCH_SCRIPT, every = PROBE_EVERY, onStep = null} = {}) {
 const probes = [];
 let elapsed = 0;
 try {
  await io.start();
  for (let i = 0; i < script.length; i++) {
   const step = script[i];
   onStep?.(i + 1, script.length, step);
   await io.phase(step);
   if (step.rest) { await io.rest(step.rest); elapsed += step.rest; }
   for (let s = 0; s < step.seconds; s += every) {
    const n = Math.min(every, step.seconds - s);
    await io.seconds(n);
    elapsed += n;
    if (step.probes) probes.push({at: elapsed, phase: step.id, ...await io.probe()});
   }
  }
 } finally {
  await io.restore();
 }
 return {probes, seconds: elapsed};
}

// FAST OR SLOW, by the graphics arithmetic probe against the run's own best:
// more than twice the quickest is slow. PLACED (the states differed about
// five times on the benchmark). Null where nothing was probed.
export function speedOf(probes, factor = 2) {
 const ok = probes.filter(p => p.math > 0);
 if (!ok.length) return null;
 const best = Math.min(...ok.map(p => p.math));
 return ok.map(p => ({at: p.at, phase: p.phase, slow: p.math > best * factor}));
}

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const ms = v => v == null ? '-' : v < 10 ? v.toFixed(1) : String(Math.round(v));

// The report section: play before the tap (ten-second lines), then the watch
// (a line a probe, two seconds), the changes of speed it saw, and the rests.
export function formatWatch(w) {
 if (!w) return '';
 const out = [' SPEED WATCH'];
 out.push(`  took            ${w.seconds ?? '?'} s`);
 out.push(`  frame cap       ${w.cap ? `${w.cap} fps, lifted for the watch` : 'none'}`);
 if (w.course) out.push(`  course          ${w.course}`);
 for (const n of w.notes ?? []) out.push(`  note            ${n}`);
 // PLAY BEFORE THE TAP, ten seconds a line: the median second's frames, the
 // slowest second, the slowest gap, the views, what happened.
 const before = w.before ?? [];
 out.push(`  play before the tap (${before.length} s recorded):`);
 if (!before.length) out.push('    nothing recorded (the game had just opened?)');
 else {
  out.push(`    ${pad('from s', 8)}${lpad('fps', 5)}${lpad('worst s', 9)}${lpad('gap ms', 8)}  view, what happened`);
  const t0 = before[before.length - 1].t;
  for (let i = 0; i < before.length; i += 10) {
   const chunk = before.slice(i, i + 10), fps = chunk.map(l => l.frames).sort((a, b) => a - b);
   const views = [...new Set(chunk.map(l => l.view).filter(Boolean))].join('/');
   const events = [...new Set(chunk.flatMap(l => l.events))].join(', ');
   out.push(`    ${pad(chunk[0].t - t0, 8)}${lpad(fps[Math.floor(fps.length / 2)], 5)}${lpad(fps[0], 9)}${lpad(Math.max(...chunk.map(l => l.worstMs)), 8)}  ${views}${events ? '; ' + events : ''}`);
  }
 }
 // THE WATCH: frames in the seconds since the last probe, then the probes.
 // `trip`: a read back with nothing to wait for; `math`, `memory`: the two
 // graphics probes less the trip; `cpu`: the processor probe.
 out.push('  the watch, a line a probe:');
 out.push(`    ${pad('at s', 6)}${pad('phase', 20)}${lpad('fps', 5)}${lpad('trip', 7)}${lpad('math', 7)}${lpad('memory', 8)}${lpad('cpu', 7)}  what happened`);
 const during = w.during ?? [];
 let from = -Infinity;
 for (const p of w.probes ?? []) {
  const lines = during.filter(l => l.at > from && l.at <= p.at), fps = lines.map(l => l.frames).sort((a, b) => a - b);
  const events = [...new Set(lines.flatMap(l => l.events))].join(', ');
  const step = (w.script ?? WATCH_SCRIPT).find(s => s.id === p.phase);
  const tail = p.failed ? `probe failed: ${p.failed}` : events;
  out.push(`    ${pad(p.at, 6)}${pad(step?.label ?? p.phase, 20)}${lpad(fps.length ? fps[Math.floor(fps.length / 2)] : '-', 5)}${lpad(ms(p.trip), 7)}${lpad(ms(p.math), 7)}${lpad(ms(p.memory), 8)}${lpad(ms(p.cpu), 7)}  ${tail}`);
  from = p.at;
 }
 // The unprobed first phase, as frames only.
 const play = during.filter(l => l.phase === 'play');
 if (play.length) {
  const f = play.map(l => l.frames).sort((a, b) => a - b);
  out.push(`  your view without probes: ${f[Math.floor(f.length / 2)]} fps median, ${f[0]} slowest second, over ${play.length} s`);
 }
 const speed = speedOf(w.probes ?? []);
 if (speed) {
  const flips = [];
  for (let i = 1; i < speed.length; i++) if (speed[i].slow !== speed[i - 1].slow) flips.push(`${speed[i].slow ? 'slow' : 'fast'} at ${speed[i].at} s (${speed[i].phase})`);
  out.push(`  speed changes   ${flips.length ? flips.join('; ') : `none: ${speed[0].slow ? 'slow' : 'fast'} throughout`}`);
 }
 return out.join('\n');
}
