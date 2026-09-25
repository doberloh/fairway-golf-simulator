// WHAT A TESTER CANNOT TELL YOU, ASSEMBLED INTO ONE BLOCK THEY CAN PASTE.
//
// A course code already carries the recipe for a course -- schema, generator,
// name and the settings that differ from the defaults -- and for "this hole
// looks wrong" it is most of the answer. It is the rest that arrives wrong or
// not at all: which build they are on, what their machine is, which tier they
// actually got, and whether anything threw.
//
// People report those from memory and the memory is unreliable. Half of them
// say Chrome and mean Edge. Nobody knows what their GPU is called. And nobody
// can know which build they are running, because until this file existed the
// build did not have a name.
//
// NOTHING HERE IS EVER SENT ANYWHERE. It is assembled when a button is pressed
// and copied to the clipboard, and that is the whole lifecycle. The project's
// distribution review verifies a claim of zero runtime network requests, and a
// diagnostic that phoned home would break it -- so this module has no fetch,
// no image, no beacon, and must never acquire one. Adding telemetry here is
// not a feature, it is a breach of a published claim.
//
// The formatting is kept apart from the gathering so the formatting can be
// tested without a browser. `diagnosticReport` takes plain facts and returns a
// string; everything above it is the part that has to touch a real window.

// The build stamp is injected at build time by vite.config.js. It is NOT
// defined when these modules are imported directly by the test runner, so the
// read is guarded -- a bare reference to an undefined `define` is a
// ReferenceError, not undefined, and would take the whole module down.
export function buildStamp() {
 try {
  // eslint-disable-next-line no-undef
  const b = typeof __FAIRWAY_BUILD__ === 'undefined' ? null : __FAIRWAY_BUILD__;
  if (!b || typeof b !== 'object') return {commit: null, built: null, source: 'unstamped'};
  return {commit: b.commit ?? null, built: b.built ?? null, source: b.commit ? 'git' : 'clock'};
 } catch { return {commit: null, built: null, source: 'unstamped'}; }
}

// A build the tester can name in one short string. The commit is what ties a
// report to a tree; the date is what a human recognises.
export function buildLabel(stamp = buildStamp()) {
 const date = stamp.built ? String(stamp.built).slice(0, 16).replace('T', ' ') : null;
 if (stamp.commit && date) return `${stamp.commit} (${date})`;
 if (stamp.commit) return stamp.commit;
 if (date) return `unversioned build, ${date}`;
 return 'unknown build';
}

// Browser, platform and screen, read defensively: every one of these is
// optional somewhere, and a diagnostic that throws while being collected is
// worse than one that says "unknown".
export function deviceFacts(win = globalThis) {
 const n = win?.navigator ?? {};
 const s = win?.screen ?? {};
 const pick = v => (typeof v === 'string' || typeof v === 'number') && String(v).length ? v : null;
 return {
  agent: pick(n.userAgent),
  // userAgentData is the honest one where it exists; the UA string is a museum.
  platform: pick(n.userAgentData?.platform) ?? pick(n.platform),
  languages: Array.isArray(n.languages) && n.languages.length ? n.languages.slice(0, 3).join(', ') : pick(n.language),
  cores: pick(n.hardwareConcurrency),
  memoryGb: pick(n.deviceMemory),
  touch: typeof n.maxTouchPoints === 'number' ? n.maxTouchPoints > 0 : null,
  screen: pick(s.width) && pick(s.height) ? `${s.width}x${s.height}` : null,
  viewport: pick(win?.innerWidth) && pick(win?.innerHeight) ? `${win.innerWidth}x${win.innerHeight}` : null,
  pixelRatio: typeof win?.devicePixelRatio === 'number' ? Math.round(win.devicePixelRatio * 100) / 100 : null,
 };
}

// THE GPU, WHICH THE APP HAS NEVER ASKED FOR UNTIL NOW. `tools/gpu-probe.mjs`
// reads this from outside through Playwright; nothing in the running game did.
// It is the single most useful line when somebody reports that it is slow,
// because "it is slow" and "it fell back to software rendering" look identical
// from the other end of a message.
//
// WEBGL_debug_renderer_info is not granted everywhere -- Firefox withholds it
// under resistFingerprinting, and it can be absent on locked-down mobile. A
// missing renderer is a normal answer, not a failure.
export function webglFacts(gl) {
 if (!gl || typeof gl.getExtension !== 'function') return {renderer: null, vendor: null, version: null};
 try {
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const get = p => { try { const v = gl.getParameter(p); return typeof v === 'string' && v ? v : null; } catch { return null; } };
  return {
   renderer: dbg ? get(dbg.UNMASKED_RENDERER_WEBGL) : get(gl.VERSION ?? 0x1f02),
   vendor: dbg ? get(dbg.UNMASKED_VENDOR_WEBGL) : null,
   version: get(0x1f02),
  };
 } catch { return {renderer: null, vendor: null, version: null}; }
}

// FRAME RATE, REPORTED AS A MEDIAN AND A WORST CASE, NEVER AS A MEAN.
//
// A mean hides exactly the thing being asked about: a run that holds 60 and
// stalls for 200 ms twice a second averages out respectable and is unplayable.
// The median says what it normally feels like and the slowest frame says what
// is wrong with it.
//
// Samples are a fixed ring so this costs nothing and cannot grow. It is fed
// from the frame loop, which means it measures the frames the player actually
// got, including ones lost to a cap.
export function frameMeter(size = 240) {
 const gaps = new Float32Array(size);
 let n = 0, i = 0;
 return {
  sample(ms) {
   // Anything beyond a second is a tab that was in the background, not a slow
   // frame, and folding it in would make every report look catastrophic.
   if (!(ms > 0) || ms > 1000) return;
   gaps[i] = ms; i = (i + 1) % size; if (n < size) n++;
  },
  read() {
   if (n < 8) return null;
   const sorted = Array.from(gaps.slice(0, n)).sort((a, b) => a - b);
   const at = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
   return {
    frames: n,
    median: Math.round(1000 / at(0.5)),
    low: Math.round(1000 / at(0.95)),   // the slow 5% of frames
    worstMs: Math.round(sorted[sorted.length - 1]),
   };
  },
 };
}

// THE LAST FEW THINGS THAT WENT WRONG, WHICH IS THE ONE PIECE OF A BUG REPORT
// NOBODY EVER INCLUDES.
//
// A tester does not open the console. They will not be asked to. So errors are
// caught as they happen and kept in a small ring, and the diagnostic carries
// whatever is in it.
//
// The original console.error is always called. A logger that swallows what it
// logs would make this project harder to debug, not easier.
export function errorLog(limit = 5) {
 const seen = [];
 const push = text => {
  const line = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!line) return;
  // A broken frame throws sixty times a second. Counting a repeat is useful;
  // printing it sixty times fills the report with one fault.
  const last = seen[seen.length - 1];
  if (last && last.line === line) { last.count++; return; }
  seen.push({line, count: 1});
  while (seen.length > limit) seen.shift();
 };
 return {
  push,
  install(win = globalThis) {
   const original = win.console?.error;
   if (original) win.console.error = (...args) => { try { push(args.map(a => a instanceof Error ? (a.stack || a.message) : String(a)).join(' ')); } catch {} original.apply(win.console, args); };
   win.addEventListener?.('error', e => push(e?.error?.stack || e?.message));
   win.addEventListener?.('unhandledrejection', e => push(`Unhandled promise rejection: ${e?.reason?.stack || e?.reason}`));
  },
  read() { return seen.map(e => e.count > 1 ? `${e.line}  (x${e.count})` : e.line); },
 };
}

const blank = v => v === null || v === undefined || v === '';
const show = v => blank(v) ? 'unknown' : String(v);

// TWO KINDS OF MISSING, AND THEY MUST NOT LOOK THE SAME.
//
// In the MACHINE block a blank means the browser would not say -- Firefox
// withholds the GPU under resistFingerprinting, and mobile Safari withholds
// several of these. That is itself information, so it prints as "unknown":
// the reader needs to know the question was asked and refused.
//
// In the WHERE block a blank means the question does not apply. There is no
// hole number while somebody is sitting in the menu and no course on the
// driving range, and printing "unknown" there reads as a fault, which sends
// whoever received the report looking for one that was never there. Those rows
// are dropped instead.
const required = (k, v) => `  ${k.padEnd(16)}${show(v)}`;
const optional = (k, v) => blank(v) ? null : `  ${k.padEnd(16)}${v}`;

// The block itself. Plain text on purpose: it has to survive being pasted into
// a GitHub issue, a forum post, a Discord message and an email, and anything
// with formatting in it survives exactly one of those.
export function diagnosticReport(facts = {}) {
 const {build = {}, app = {}, device = {}, webgl = {}, frames = null, errors = [], courseCode = null,
        takenAt = null} = facts;
 const out = [
  'Fairway diagnostic',
  // When it was taken, so two reports from one session can be put in order.
  ...(takenAt ? [`${String(takenAt).slice(0, 19).replace('T', ' ')} UTC`] : []),
  '',
  ' BUILD',
  required('version', build.label),
  required('generator', app.generator),
  required('schema', app.schema),
  '',
  ' WHERE',
  required('mode', app.mode),
  optional('course', app.course),
  optional('hole', app.hole),
  optional('biome', app.biome),
  '',
  ' MACHINE',
  required('browser', device.agent),
  required('platform', device.platform),
  required('gpu', webgl.renderer),
  required('gpu vendor', webgl.vendor),
  required('screen', device.screen),
  required('viewport', device.viewport),
  required('pixel ratio', device.pixelRatio),
  required('cores', device.cores),
  required('memory', device.memoryGb ? `${device.memoryGb} GB` : null),
  required('touch', device.touch === null ? null : (device.touch ? 'yes' : 'no')),
  '',
  ' GRAPHICS',
  required('tier', app.tier),
  required('frame cap', app.frameCap ? `${app.frameCap} fps` : 'follow display'),
  required('fps', frames ? `${frames.median} median, ${frames.low} low, worst frame ${frames.worstMs} ms` : 'not measured yet'),
 ].filter(l => l !== null);
 if (errors.length) {
  out.push('', ' ERRORS', ...errors.map(e => `  ${e}`));
 }
 if (courseCode) {
  out.push('', ' COURSE CODE', `  ${courseCode}`);
 }
 out.push('', 'Nothing in this report was sent anywhere. You pasted it yourself.');
 return out.join('\n');
}
