#!/usr/bin/env node
// THE BUILT GAME, OPENED IN A REAL BROWSER AND PLAYED.
//
//   npm run smoke                     build, then every journey on this GPU
//   node tools/smoke.mjs              every journey against the current build
//   node tools/smoke.mjs --only endless-round
//   node tools/smoke.mjs --software   the renderer CI has: no GPU at all
//   node tools/smoke.mjs --headed     watch it happen
//   node tools/smoke.mjs --list       what the journeys are
//   node tools/smoke.mjs --file x.html  test some other built file
//
// WHY THIS EXISTS. `npm test` covers physics, generation and scoring, and
// cannot see the interface at all: `main.js` is several thousand lines of
// panels and handlers that no test ever runs. PROJECT_HANDOFF records two
// times that shipped broken with every test green -- a variable used outside
// the function that defined it, which threw the moment the live score drew,
// and a deleted line that took its neighbour with it and left "Surprise me",
// "Start fresh round" and the course picker all dead while the panel still
// LOOKED fine. Both were one click away from being found.
//
// So this clicks. Every button it presses is found by the name a PLAYER sees
// -- "Surprise me & play", not `#surpriseBtn` -- because the name is the
// contract with the player and the id is an implementation detail. A renamed
// button failing here is a feature: it means a label a player relied on moved.
//
// WHAT FAILS A JOURNEY, beyond a step not doing what it should:
//
// - Any uncaught exception or unhandled rejection in the page.
// - Any console.error. The game does not log errors it expects, so one
//   appearing means something went wrong, even if the screen looks right.
// - ANY NETWORK REQUEST. DISTRIBUTION_REVIEW publishes a verified claim that
//   the built file makes zero runtime network requests. This turns that claim
//   from something checked once by hand into something checked every run.
//
// IT OPENS THE FILE ITSELF, BY file:// URL, rather than serving it. That is
// how a player opens it -- unzip, double-click -- and it is the claim the whole
// single-file design exists to support. It used to be recorded as impossible
// to automate, which was true of the in-app browser pane used during
// development and never true of a real browser.
//
// THE `window.lab` CONSOLE API IS USED ONLY TO LOOK, never to drive: it reports
// whether a ball is in flight, which the screen shows only as motion. Driving
// through `lab` would test the lab, and the lab is not what a player touches.
//
// SOFTWARE RENDERING IS SLOW IN A SPECIFIC WAY, measured before this was
// written: with no GPU a nine-hole course took 99 s to build on one run and
// 213 s on the next, against 4.5 s on this machine's GPU, and each frame costs
// 0.8 to 1.6 s. Halving the window halved the frame cost and did NOT shorten
// the build, so the build is dominated by something that does not scale with
// pixels -- shader compilation is the obvious suspect. The journeys are
// arranged around that: the core round loop runs on Endless, whose first hole
// is the menu backdrop the game has already built, and only the journeys whose
// whole point is a nine-hole course pay for one.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {MISS_AT, OVERSWING, RUN_UP, markerAt} from '../src/swing-meter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.html');
const SHOTS = path.join(ROOT, 'bench', 'shots', 'smoke');

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const option = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
const SOFTWARE = flag('software');
const HEADED = flag('headed');
const ONLY = option('only');
// `--file some/Fairway.html` tests any built file instead of dist/ -- the one
// inside a release ZIP, or an older build to prove a check goes red on the bug
// it was written for. No staleness gate: the file was named on purpose.
const FILE = option('file');

// Same flags the profiler settled on for each renderer; see tools/profile.mjs.
// `--enable-unsafe-swiftshader` is new since then: current Chromium refuses to
// fall back to SwiftShader for WebGL without it, and the page simply gets no
// context -- which reads as the game being broken rather than the harness.
const ARGS = SOFTWARE
 ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-vsync']
 : ['--use-angle=default', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync'];

// Everything that waits on FRAMES scales with the renderer; everything that
// waits on the game's own timers (the three-second hole reveal) does not.
const SLOW = SOFTWARE ? 12 : 1;

// ------------------------------------------------------------ the build gate
//
// A smoke test against a stale build is worse than none: it passes, and the
// pass is about code that is no longer there. The packager refuses on exactly
// the same condition for exactly the same reason.
function refuseStaleBuild() {
 if (!fs.existsSync(DIST)) fail('No build at dist/index.html. Run `npm run build` first, or use `npm run smoke`.');
 const built = fs.statSync(DIST).mtimeMs;
 const inputs = ['index.html', 'vite.config.js', 'LICENSE', 'docs/THIRD_PARTY_NOTICES.txt',
  ...fs.readdirSync(path.join(ROOT, 'src')).map(f => `src/${f}`)];
 const newer = inputs.filter(f => fs.statSync(path.join(ROOT, f)).mtimeMs > built);
 if (newer.length) fail(`The build is older than ${newer.slice(0, 3).join(', ')}${newer.length > 3 ? ` and ${newer.length - 3} more` : ''}. ` +
  'Run `npm run build` first, or use `npm run smoke`, which builds.');
}

function fail(message) { console.error(message); process.exit(2); }

// --------------------------------------------------------------- one journey
//
// A FRESH PAGE PER JOURNEY. Journeys must not lean on each other's state -- a
// round saved by one would be offered as "Continue" to the next, and a failure
// in one would cascade into every journey after it and bury the first cause.
class Trip {
 // `home` is where the page came from. Opened from disk it is a file: URL and
 // ANY request is a failure -- the portable file promises none. Served, the
 // page may fetch its own files from its own address (the manifest, the
 // icons), and nothing from anywhere else.
 constructor(page, name, home = null) {
  this.page = page; this.name = name;
  this.errors = []; this.requests = []; this.steps = [];
  this.home = home;
  const own = home && /^https?:/.test(home) ? new URL(home).origin : null;
  page.on('pageerror', e => this.errors.push(`uncaught: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') this.errors.push(`console.error: ${m.text()}`); });
  // A REFUSED REQUEST IS A FAILURE, whether or not anything logs it. A host
  // behind a password answers 401 to any request without the visitor's login,
  // and that is exactly how the home-screen icon went missing on the owner's
  // private Netlify site -- the page loaded fine and the icon quietly did not.
  page.on('response', r => { if (r.status() === 401) this.errors.push(`401 Unauthorized: ${r.url()}`); });
  page.on('request', r => {
   const u = r.url();
   if (/^(file|data|blob):/.test(u)) return;
   if (own && u.startsWith(own + '/')) return;
   this.requests.push(u);
  });
 }

 // A step is a named thing a player does. It fails if it throws, OR if the
 // page reported an error or made a request while it ran -- and the failure
 // is pinned to that step, because "an error happened somewhere in the
 // journey" sends the next person reading the whole journey to find it.
 async step(label, fn) {
  const start = Date.now(), errorsBefore = this.errors.length, requestsBefore = this.requests.length;
  let problem = null;
  try { await fn(); } catch (e) { problem = e.message.split('\n')[0]; }
  const errors = this.errors.slice(errorsBefore), requests = this.requests.slice(requestsBefore);
  if (!problem && errors.length) problem = errors[0];
  if (!problem && requests.length) problem = `made a network request, and the build must make none: ${requests[0]}`;
  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  this.steps.push({label, seconds, problem, extra: [...errors.slice(problem === errors[0] ? 1 : 0), ...requests.slice(1)]});
  console.log(`   ${problem ? '✗' : '✓'} ${label}  ${seconds}s`);
  if (problem) {
   console.log(`       ${problem}`);
   throw new JourneyFailed(label, problem);
  }
 }

 // A DevTools session on the page, for input stamped with the moment it
 // happened (`tapOnTarget`), which Playwright's own mouse cannot do.
 cdp() { return this.cdpSession ??= this.page.context().newCDPSession(this.page); }

 // ------------------------------------------------------------- observing
 mode() { return this.page.evaluate(() => document.getElementById('world')?.dataset.mode); }
 inFlight() { return this.page.evaluate(() => !!window.lab?.state?.().inFlight); }
 // The drawer shows itself by `hidden` alone -- the first draft of this also
 // demanded an `open` class the drawer has never used, and failed every panel.
 drawerOpen() { return this.page.evaluate(() => document.getElementById('drawer')?.hidden === false); }
 drawerTitle() { return this.page.evaluate(() => document.getElementById('drawerTitle')?.textContent?.trim() ?? ''); }

 async until(test, what, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
   if (await test()) return;
   await this.page.waitForTimeout(100);
  }
  throw new Error(`waited ${seconds}s for ${what}`);
 }

 // The game is ready to play when the generating overlay is gone and the
 // world says it is in play. Checked together because either alone lies:
 // data-mode flips to play before the overlay lifts.
 async inPlay(seconds = 60 * SLOW) {
  await this.until(() => this.page.evaluate(() =>
   document.getElementById('world')?.dataset.mode === 'play' && document.getElementById('generating')?.hidden !== false),
   'the round to be ready to play', seconds);
 }

 // ------------------------------------------------------------- doing
 // By the name a player reads, among the things actually on screen.
 async press(name) {
  const target = this.page.getByRole('button', {name, exact: true}).or(this.page.getByRole('tab', {name, exact: true}))
   .filter({visible: true}).first();
  await target.click({timeout: 10000 * SLOW});
 }

 // A PRESS THAT STARTS A ROUND counts if the round starts. Playwright's click
 // waits for the page to take the press, and with no GPU the page can be busy
 // for minutes once a round begins: on GitHub on 14 October 2026 the click on
 // Start an endless run timed out at 120 s with the round already started
 // behind it (the screenshot: in play on hole 1, nothing hit yet). So a click
 // that timed out is forgiven when the game has left the menu, and reported
 // at once when it has not.
 async pressToPlay(name) {
  const missed = await this.press(name).then(() => null, e => e);
  if (missed && await this.page.evaluate(() => document.getElementById('world')?.dataset.mode === 'menu'
   && document.getElementById('generating')?.hidden !== false)) throw missed;
  await this.inPlay();
  if (missed) console.log('       (the click outlasted its timeout while the page was busy; the round started anyway)');
 }

 // Keys go to the window, so nothing may be holding focus -- a focused
 // slider eats the arrow keys, which is deliberate in the game and a trap here.
 async key(code) {
  await this.page.evaluate(() => document.activeElement?.blur?.());
  await this.page.keyboard.press(code);
 }

 // AIM AND POWER TURN WHILE A KEY IS HELD, per frame, not per press. The game
 // adds `aimDelta(turn, dt * 18)` on every frame an arrow is down, so a
 // synthetic press -- down and up before any frame runs -- turns nothing,
 // which the first draft of this took for a broken control. A person's tap
 // lasts 50 to 120 ms and spans several frames. So the key is held until the
 // reading moves, the way a person holds it until they see it move; that also
 // copes with a software frame taking most of a second.
 async hold(code, readout, seconds = 5 * SLOW) {
  await this.page.evaluate(() => document.activeElement?.blur?.());
  const before = await this.page.textContent(readout);
  await this.page.keyboard.down(code);
  try {
   await this.until(async () => (await this.page.textContent(readout)) !== before, `holding ${code} to move ${readout}`, seconds);
  } finally { await this.page.keyboard.up(code); }
  return {before, after: await this.page.textContent(readout)};
 }

 // THE TOOLS BUTTON IS A TOGGLE. A second press closes the tray, which the
 // first draft of this found by pressing it twice and then waiting thirty
 // seconds for a Mulligan button that had just been put away. So it is opened
 // only if it is shut, and then the tool is pressed.
 async tool(id) {
  if (await this.page.evaluate(() => document.getElementById('toolsTray')?.hidden !== false)) {
   // Whichever Tools button this screen shows: the camera strip's on a
   // laptop, the top bar's on a phone, where the strip folds away.
   const bar = this.page.locator('#barTools');
   await (await bar.isVisible() ? bar : this.page.locator('#toolsButton')).click();
   await this.until(() => this.page.evaluate(() => document.getElementById('toolsTray')?.hidden === false), 'the tools tray', 5 * SLOW);
  }
  // An id, or a selector for a tray button that has none (`[data-panel="bag"]`).
  await this.page.click(id.startsWith('[') ? id : `#${id}`);
 }

 // Put the tray away, the way a tidy player does when finished with it.
 //
 // Not optional. A tool window left open sits BEHIND any panel opened after
 // it, and Escape closes the small windows first -- so with the tray still
 // up, the first Escape shuts a window hidden behind the scorecard's blur and
 // the scorecard, the thing visibly on top, needs a second press. That is
 // recorded in TODO as a keyboard question for the owner rather than decided
 // here; this harness stays neutral by not leaving the tray open.
 async closeTools() {
  if (await this.page.evaluate(() => document.getElementById('toolsTray')?.hidden === false)) {
   // By the window's own close button, the way a person closes it. On a phone
   // the Tools window sits over the Tools BUTTON, so pressing the button a
   // second time -- which is what this did first -- is not possible there.
   await this.page.getByRole('button', {name: 'Close Tools', exact: true}).click();
   await this.until(() => this.page.evaluate(() => document.getElementById('toolsTray')?.hidden !== false), 'the tools tray to close', 5 * SLOW);
  }
 }

 // A PANEL IS WHATEVER WINDOW HAS THAT NAME, wherever it opened. During a
 // round several panels open as floating tool windows rather than in the
 // bottom drawer -- Graphics is one -- and they are proper dialogs carrying
 // their title as a name, with a "Close <title>" button. So "is Graphics
 // open" is asked the way a player would see it, not by which container
 // happens to hold it this time.
 async panelShowing(title) {
  if (await this.drawerOpen() && (await this.drawerTitle()) === title) return 'drawer';
  if (await this.page.getByRole('dialog', {name: title, exact: true}).isVisible().catch(() => false)) return 'window';
  return null;
 }
 async closePanel(title) {
  const where = await this.panelShowing(title);
  if (where === 'window') await this.page.getByRole('button', {name: `Close ${title}`, exact: true}).click();
  else await this.key('Escape');
  await this.until(async () => !(await this.panelShowing(title)), `"${title}" to close`, 5 * SLOW);
 }

 // THE NEXT HOLE ARRIVES ONE OF TWO WAYS, and both are correct: the player
 // presses Next hole on the scorecard, or the scorecard advances by itself
 // after eight seconds. On a GPU the press lands in well under a second. With
 // no GPU a frame takes a second, Playwright's check that the button is stable
 // across two frames can outlast the eight, and the button is rightly gone --
 // the first software run after the layout work waited six minutes to click it
 // while the game sat on hole 2, three under. So: press it if it is still
 // there, accept the automatic advance if it got there first, fail only if
 // the hole never changes, and say which way it went.
 async nextHole(press) {
  const before = await this.page.textContent('#holeNumber');
  const pressed = await press().then(() => true, () => false);
  await this.inPlay();
  await this.until(async () => (await this.page.textContent('#holeNumber')) !== before, 'the hole number to change', 30 * SLOW);
  if (!pressed) console.log('       (arrived by the eight-second automatic advance; the button was gone before it could be pressed)');
 }

 async closeDrawer() {
  await this.key('Escape');
  await this.until(async () => !(await this.drawerOpen()), 'the panel to close', 5 * SLOW);
 }

 // THE SWING METER (14 October 2026) is three taps of Space: start, set the
 // distance, strike. Real gaps between them, because the meter judges each tap
 // on its own time -- three back to back would be a swing of nothing.
 async swing() {
  await this.key('Space');
  await this.page.waitForTimeout(800);
  await this.key('Space');
  await this.page.waitForTimeout(300);
  await this.key('Space');
 }

 // A shot, the way a keyboard player takes one: the Swing Meter's three taps,
 // Enter to skip the flight. It checks the shot actually STARTED -- the game
 // refuses a shot silently in several states, and a harness that assumed every
 // swing was a shot would report a round it never played.
 // A PUTT, the way a player putts one: Space starts the stroke and it stops on
 // the blue target marker (`tapOnTarget`). Three Space taps at fixed gaps hole a
 // two-yard putt only by luck, which is how `profile` and `bag` passed one run
 // and failed the next (14 October 2026).
 async putt() {
  await this.until(async () => !(await this.inFlight()), 'the previous shot to finish', 30 * SLOW);
  await this.key('Space');
  await tapOnTarget(this);
  await this.until(() => this.inFlight(), 'the putt to start', 5 * SLOW);
  await this.key('Enter');
  await this.until(async () => !(await this.inFlight()), 'Enter to finish the putt', 30 * SLOW);
 }

 // HOLED OR NOT, asked of the game once a putt has stopped -- the round
 // records the hole in the same step that ends the flight. Until 16 October
 // 2026 the harness decided by whether a scorecard turned up within six, later
 // twelve, seconds; with no GPU it can take longer, and the 0.6 and 0.6.1
 // merges failed on GitHub by putting again on a hole already holed ("Space to
 // start a shot (the game refused it)", the screenshot one under par and the
 // next hole growing). undefined from a build whose lab cannot say.
 holed() { return this.page.evaluate(() => window.lab?.state?.().holeComplete); }

 async shot() {
  await this.until(async () => !(await this.inFlight()), 'the previous shot to finish', 30 * SLOW);
  await this.swing();
  await this.until(() => this.inFlight(), 'the Swing Meter to start a shot (the game refused it)', 5 * SLOW);
  await this.key('Enter');
  await this.until(async () => !(await this.inFlight()), 'Enter to finish the shot', 30 * SLOW);
 }
}

// Every journey starts here. The menu is up when the lab is attached and the
// main menu is showing; the backdrop behind it is a real one-hole Endless
// course, which is what makes the Endless journey nearly free to run.
// The splash must be GONE too: the menu opens underneath it and the splash
// fades only once frames come smoothly (main.js, smoothFrames), so a menu that
// is "showing" can still be covered.
const menuReady = t => t.step('menu ready', () =>
 t.until(() => t.page.evaluate(() => !!window.lab && !document.getElementById('mainMenu')?.hidden && !document.getElementById('splash')), 'the main menu', 60 * SLOW));
// A RANDOM COURSE CAN PUT ANY SHOT IN THE WATER. Since penalty relief, a ball
// in trouble waits for its golfer's choice and nothing else can be played --
// a sim drop included. A journey that is not about relief takes whichever drop
// is offered first and carries on; `press` is how it presses (a tap on a phone).
// The course, its seed and the hole, as the screen names them.
const whereAmI = page => page.evaluate(() => {
 const map = document.getElementById('map');
 return {seed: map?.dataset.courseSeed || null, course: document.getElementById('courseTitle')?.textContent?.trim() || null,
  hole: document.getElementById('holeNumber')?.textContent?.trim() || null};
}).catch(() => ({}));
const reliefFirst = async (t, press = sel => t.page.click(sel)) => {
 if (await t.page.evaluate(() => document.getElementById('reliefBar')?.hidden === false)) await press('#reliefTake');
};
const fromMenu = (t, entry) => t.page.locator('#mainMenu').getByRole('button', {name: entry}).first().click();

// Every control on the play screen that a player can see must be one a player
// can click. Checked by asking the browser what is actually under the centre of
// each control -- the only honest test, because a control can be displayed,
// enabled and in the DOM and still be sitting underneath another window.
function unreachableControls(scope = '#world button, #world input, #world select, #world a, #shotControls button, #shotControls input, #shotControls select, header button') {
 const out = [];
 const seen = new Set();
 for (const b of document.querySelectorAll(scope)) {
  if (seen.has(b)) continue; seen.add(b);
  const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
  if (!r.width || !r.height || cs.visibility === 'hidden' || b.closest('[hidden]') || b.disabled) continue;
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const label = b.id ? '#' + b.id : (b.getAttribute('aria-label') || b.textContent || b.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { out.push(`${label} is off screen`); continue; }
  const hit = document.elementFromPoint(x, y);
  if (hit && (hit === b || b.contains(hit) || hit.contains(b))) continue;
  const c = hit?.closest('[id],[class]');
  out.push(`${label} is under ${c ? (c.id ? '#' + c.id : '.' + [...c.classList][0]) : hit?.tagName}`);
 }
 return out;
}

// A THUMB-SIZED TARGET, measured the way a finger meets it: from the middle
// of each control, walk outward in each direction until the point no longer
// lands on it. A control passes if it is 44 px across both ways, or if the
// walk stopped on ANOTHER control -- two buttons sharing the space between
// them is a fair split, dead space around a small one is the fault. The
// invisible margins that give small buttons their reach are pseudo-elements,
// and `elementFromPoint` reports them as the button, so this sees what a tap
// sees rather than what the button looks like.
function smallTargets(selectors) {
 const out = [], REACH = 22;
 const control = el => el?.closest('button,select,input,a,[role=button]');
 for (const b of document.querySelectorAll(selectors)) {
  const r = b.getBoundingClientRect();
  if (!r.width || !r.height || b.closest('[hidden]') || getComputedStyle(b).visibility === 'hidden') continue;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const walk = (dx, dy) => {
   for (let d = 1; d <= REACH; d++) {
    const x = cx + dx * d, y = cy + dy * d;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return {d: d - 1, shared: true};
    const hit = document.elementFromPoint(x, y);
    if (hit === b || b.contains(hit)) continue;
    return {d: d - 1, shared: !!control(hit) && control(hit) !== b};
   }
   return {d: REACH, shared: false};
  };
  const [l, rt, u, dn] = [walk(-1, 0), walk(1, 0), walk(0, -1), walk(0, 1)];
  const short = (a, c) => a.d + c.d + 1 < 43 && !(a.shared || c.shared);
  const label = b.id ? '#' + b.id : (b.getAttribute('aria-label') || b.textContent || b.tagName).trim().slice(0, 30);
  if (short(l, rt) || short(u, dn)) out.push(`${label} ${l.d + rt.d + 1}x${u.d + dn.d + 1}`);
 }
 return out;
}
// TWO FINGERS AT ONCE, which Playwright's touchscreen cannot do -- it has
// `tap` and nothing else. Chrome's own touch input, through the DevTools
// protocol, can: the page receives real touch and pointer events, one pointer
// per finger. `points` is a list of [x, y]; an empty list lifts every finger.
async function fingers(t, type, points) {
 // One DevTools session per page, shared with the stamped mouse tap
 // (`t.cdp()`); `t.cdp` is that method, so never assign to it.
 const cdp = await t.cdp();
 await cdp.send('Input.dispatchTouchEvent', {type, touchPoints: points.map(([x, y], id) => ({x, y, id}))});
}

// The rest of the layout's health, beside reachability: a game screen must
// never scroll, and the HUD must not hide most of the course. The second is a
// floor, not a target -- phone portrait used to show 7% of the course, with
// the card covering the rest, and 30% is far enough above that to catch it
// coming back without failing a laptop that is merely busy.
const SCENE_FLOOR = 30;
// ...except with the card's details OPENED on a phone, which the player does on
// purpose to read their numbers and folds with the same tap. Measured at 26%
// with the card capped at 45% of the screen, and it reads well: the numbers
// scroll inside the card, the camera row and the wind sit under it, the course
// shows in the middle. Tuning that smaller to clear 30 would make the numbers
// harder to read to satisfy a threshold written for a different state. It
// keeps a floor of its own, so an open card that swallows the screen -- the
// uncapped first draft covered 81% -- still fails.
const OPENED_FLOOR = 20;
function layoutHealth() {
 let covered = 0, total = 0;
 for (let y = 0; y < innerHeight; y += 20) for (let x = 0; x < innerWidth; x += 20) {
  total++;
  const el = document.elementFromPoint(x, y);
  if (el && el.id !== 'scene') covered++;
 }
 const d = document.documentElement;
 return {scene: Math.round(100 * (1 - covered / total)), scrolls: d.scrollWidth > innerWidth + 1 || d.scrollHeight > innerHeight + 1,
  page: `${d.scrollWidth}x${d.scrollHeight}`};
}

class JourneyFailed extends Error {
 constructor(step, problem) { super(`${step}: ${problem}`); this.step = step; }
}

// AIMING BY TOUCH: the aim pad, the big map and two-finger zoom, and a thumb's
// worth of target on every control a round needs. Shared by both phone
// journeys, run after a tap on the course has aimed once.
async function touchAiming(t) {
 const aimNow = () => t.page.evaluate(() => ({
  aim: parseFloat(document.getElementById('aimOutput').textContent),
  reach: parseFloat(document.getElementById('aimRange').value),
 }));
 const pad = name => t.page.locator('#aimPad').getByRole('button', {name, exact: true});
 await t.step('the aim pad: half a degree a tap, a yard further, and the pin', async () => {
  let was = await aimNow();
  await pad('Aim right').tap();
  let now = await aimNow();
  if (Math.abs(now.aim - was.aim + 0.5) > 0.051) throw new Error(`one tap right turned the aim ${(now.aim - was.aim).toFixed(2)} degrees, not -0.5`);
  was = now;
  await pad('Aim further').tap();
  now = await aimNow();
  if (Math.abs(now.reach - was.reach - 1) > 0.051) throw new Error(`one tap further moved the target ${(now.reach - was.reach).toFixed(2)} yd, not 1`);
  await pad('Aim at the pin').tap();
  now = await aimNow();
  // The same answer as the "Aim at pin" button a laptop has in its shot bar.
  // That one is hidden on a phone, so it is pressed through the page -- as a
  // yardstick for the pad, not as something a player on a phone could reach.
  // (The card's DISTANCE is no yardstick: it is the tee yardage, measured
  // along the hole, not the straight line to the pin.)
  await pad('Aim right').tap();
  await t.page.evaluate(() => document.getElementById('aimAtPin').click());
  const bar = await aimNow();
  if (bar.aim !== now.aim || bar.reach !== now.reach) throw new Error(`the pad aimed at ${now.aim} deg, ${now.reach} yd; the bar's Aim at pin at ${bar.aim} deg, ${bar.reach} yd`);
 });
 await t.step('held, the pad sweeps -- and stops when the finger lifts', async () => {
  const box = await pad('Aim left').boundingBox();
  const was = (await aimNow()).aim;
  await fingers(t, 'touchStart', [[box.x + box.width / 2, box.y + box.height / 2]]);
  await t.page.waitForTimeout(1500);
  await fingers(t, 'touchEnd', []);
  const held = (await aimNow()).aim;
  if (held - was < 2) throw new Error(`a 1.5 s hold turned the aim ${(held - was).toFixed(1)} degrees`);
  await t.page.waitForTimeout(600);
  if ((await aimNow()).aim !== held) throw new Error('the aim kept turning after the finger lifted');
 });
 await t.step('a tap on the map thumbnail opens the big map', async () => {
  await t.page.locator('#map').tap();
  await t.until(() => t.page.evaluate(() => document.getElementById('world').classList.contains('aim-view')), 'the big map', 5 * SLOW);
  const box = await t.page.locator('#map').boundingBox();
  const vp = t.page.viewportSize();
  if (box.width < vp.width * 0.6 || box.height < vp.height * 0.45) throw new Error(`the big map is ${Math.round(box.width)}x${Math.round(box.height)} on a ${vp.width}x${vp.height} screen`);
 });
 await t.step('two fingers zoom it', async () => {
  const box = await t.page.locator('#map').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await fingers(t, 'touchStart', [[cx - 25, cy], [cx + 25, cy]]);
  for (let i = 1; i <= 8; i++) await fingers(t, 'touchMove', [[cx - 25 - i * 12, cy], [cx + 25 + i * 12, cy]]);
  await fingers(t, 'touchEnd', []);
  const zoom = await t.page.evaluate(() => document.getElementById('map').mapNav?.zoom ?? 1);
  // Spread from 50 px apart to 242: close to five times, less the clamp.
  if (zoom < 3) throw new Error(`a pinch from 50 px to 242 px zoomed the map to ${zoom.toFixed(2)}x`);
  if (!/×/.test(await t.page.textContent('#mapTitle'))) throw new Error('the map title does not say it is zoomed');
 });
 await t.step('a tap on the big map aims, and Done puts it away', async () => {
  // Either number may move: a tap that happens to land on the line already
  // aimed down changes the distance and not the bearing, which the first
  // version of this read as the tap doing nothing.
  const before = JSON.stringify(await aimNow());
  const box = await t.page.locator('#map').boundingBox();
  await t.page.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await t.until(async () => JSON.stringify(await aimNow()) !== before, 'a tap on the big map to aim', 5 * SLOW);
  if (!await t.page.evaluate(() => document.getElementById('world').classList.contains('aim-view'))) throw new Error('aiming closed the big map; it should stay open to adjust');
  await t.page.getByRole('button', {name: 'Done', exact: true}).tap();
  await t.until(() => t.page.evaluate(() => !document.getElementById('world').classList.contains('aim-view')), 'the big map to close', 5 * SLOW);
  const zoom = await t.page.evaluate(() => document.getElementById('map').mapNav?.zoom ?? 1);
  if (zoom !== 1) throw new Error(`the thumbnail came back zoomed ${zoom}x`);
 });
 await t.step('every control a round needs is a thumb wide', async () => {
  const coarse = await t.page.evaluate(() => matchMedia('(pointer:coarse)').matches);
  if (!coarse) throw new Error('the browser is not reporting a touch screen, so the touch sizes never applied');
  const small = await t.page.evaluate(smallTargets, '.topbar button:not(.hud-grip):not(.hud-size), #shotToggle, #camButton, #aimPad button, #club, #pickCurve, #pickHeight, #pickSpin, #swing, #mapExpand');
  if (small.length) throw new Error(`under 44 px to a finger: ${small.join('; ')}`);
 });
}

// What the bridge says about the device: red is no device, amber a device with
// no ball on the mat, green a ball ready to hit. Shaped as `bridge/server.mjs`
// sends it.
const monitorStatus = state => JSON.stringify(state === 'red' ? {type: 'status', deviceConnected: false}
 : {type: 'status', deviceConnected: true, device: {ready: true, ballDetected: state === 'green'}});

// A BALL IN THE AIR CLEARS THE SCREEN. Checked while a flight is running: the
// shot controls, the camera strip and the aim pad have stepped aside at every
// size, the map and the wind are still there, and the shot panel says a ball
// is up and carries a Skip that can be pressed. `phone` is kept for callers;
// since the shot panel (10 October 2026) the rule is the same at every size.
// Since 13 October the shot panel is a line in the play window, so the window
// stays through a flight with that line alone in it: what must go is
// everything else in it -- club, the shot's shape, the shot button, the keyboard hints.
// The panels FADE, over a fifth of a second, so a check made the instant the
// ball leaves catches them half-way; it is retried until it passes or two
// seconds are up, and only the last failure is reported.
// A SWING THAT STOPS ON THE TARGET MARKER, the way a player aims one: the meter
// is started by the caller, then this waits, frame by frame inside the page,
// for the marker to reach the blue target and taps the screen there, and taps
// again as it comes back over the strike line (if the swing has a third tap).
// Used where the harness needs the ball to go where it is aimed -- putting out
// -- which three taps at fixed gaps cannot do since the Swing Meter replaced
// a power that was set to the hole for you (14 October 2026).
//
// THE TAP IS TIMED ON THE CLOCK, NOT ON A FRAME (16 October 2026). The game
// judges a tap on the time the input happened (`event.timeStamp`), never on the
// frame that handled it. The first version of this watched the marker frame by
// frame and tapped once it had passed the target -- right on a GPU, where a
// frame is 16 ms, and wrong with no GPU, where a frame is most of a second and
// the marker crosses a putt's whole bar in about 1.6 s: the tap came up to a
// bar-length late, every putt ran long, and GitHub failed "six putts from two
// yards" on both 0.8 merges (the screenshots: the ball 8 ft and 23 ft away
// after six putts). So the harness reads when the swing started and how fast
// it runs (`lab.state().swing`, a look), works out when the marker reaches the
// target, and sends a real press STAMPED with that moment -- what a player's
// tap during a slow frame is: on time, handled late. A build from before the
// lab reported the swing falls back to watching frames.
async function tapOnTarget(t) {
 const now = await t.page.evaluate(() => {
  const target = document.getElementById('smTarget'), catcher = document.getElementById('swingCatcher').getBoundingClientRect();
  const state = window.lab?.state?.() ?? {};
  return {known: 'swing' in state, swing: state.swing ?? null, origin: performance.timeOrigin,
   goal: target && !target.hidden ? parseFloat(target.style.left) : 70,
   x: catcher.left + catcher.width / 2, y: catcher.top + catcher.height / 2};
 });
 if (!now.known) return tapOnTargetByFrame(t);
 // No swing: the game refused to start one, which the caller's wait reports.
 if (!now.swing) return;
 const sw = now.swing;
 // The target is drawn at `barX(share)` (main.js); this is that, inverted.
 const share = MISS_AT + now.goal / 100 * (1 + OVERSWING - MISS_AT);
 // The marker sweeps up from the left edge (swing-meter.js `riseAt`) ...
 const power = sw.start + (share + RUN_UP) * sw.rise;
 if (Math.abs(markerAt({...sw, power: null}, power) - share) > 1e-6) throw new Error('the meter does not run the way the harness reads it');
 const taps = [power];
 // ... and, on a swing with a strike tap, back down to the strike line at 0.
 if (sw.accuracy) taps.push(power + share * sw.rise);
 const cdp = await t.cdp();
 for (const at of taps) {
  const wait = now.origin + at - Date.now();
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  // CDP takes seconds since the epoch; the page's clock is milliseconds from
  // its time origin, which is itself on the epoch.
  const timestamp = (now.origin + at) / 1000;
  for (const type of ['mousePressed', 'mouseReleased'])
   await cdp.send('Input.dispatchMouseEvent', {type, x: now.x, y: now.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1, timestamp});
 }
}
// The frame-watching tap, kept for builds whose lab does not report the swing.
// Right on a GPU; late by up to a frame without one (above).
async function tapOnTargetByFrame(t) {
 await t.page.evaluate(() => new Promise((resolve, reject) => {
  const meter = document.getElementById('swingMeter'), marker = document.getElementById('smMarker');
  const target = document.getElementById('smTarget'), catcher = document.getElementById('swingCatcher');
  const goal = target && !target.hidden ? parseFloat(target.style.left) : 70;
  const line = parseFloat(document.querySelector('#smTicks .strike')?.style.left ?? '21');
  const tap = () => catcher.dispatchEvent(new PointerEvent('pointerdown', {button: 0, bubbles: true, isPrimary: true}));
  const until = performance.now() + 10000;
  const step = () => {
   if (performance.now() > until) return reject(new Error('the meter never reached the target'));
   const stage = meter.dataset.stage, x = parseFloat(marker.style.left);
   if (stage === 'ready') return resolve();
   if (stage === 'power' && x >= goal) tap();
   else if (stage === 'strike' && x <= line) { tap(); return resolve(); }
   requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
 }));
}

async function flightClearsTheScreen(t, phone) {
 const until = Date.now() + 2000 * SLOW;
 for (;;) {
  try { return await flightScreenOnce(t, phone); }
  catch (e) { if (Date.now() > until || !(await t.inFlight())) throw e; await t.page.waitForTimeout(100); }
 }
}
async function flightScreenOnce(t, phone) {
 const state = await t.page.evaluate(() => {
  const gone = s => { const e = document.querySelector(s); if (!e) return true; const c = getComputedStyle(e); return c.visibility === 'hidden' || c.display === 'none' || !e.offsetParent || Number(c.opacity) === 0; };
  return {
   flag: document.getElementById('world').classList.contains('in-flight'),
   panel: gone('#shapeControl') && gone('#bottomHints'),
   // On the Swing Meter the meter stays up through the flight with carry,
   // total and apex, and the floating tiles are gone (14 October 2026).
   meterMode: document.getElementById('world').classList.contains('meter-mode'),
   meterNumbers: !gone('#smResult') && /CARRY/.test(document.getElementById('smResult')?.textContent || ''),
   tiles: !gone('#shotTiles .shot-tile'), club: gone('#club'), swing: gone('#swing'), strip: gone('.view-tools'), pad: gone('#aimPad'),
   numbers: gone('#shotPanel'), map: gone('#map'), wind: gone('.weather'),
   // The panel's header, where Skip and the flight's state live; its tiles
   // may be folded away on a phone, the header never is.
   head: document.querySelector('#shotPanel .sp-head')?.textContent || '',
   live: !!document.getElementById('liveShotSpeed'),
  };
 });
 const bad = [];
 if (!state.flag) bad.push('the playing area is not marked in-flight');
 if (!state.club || !state.swing) bad.push('the club or the shot button is still showing');
 if (!state.strip) bad.push('the camera strip is still showing');
 if (!state.pad) bad.push('the aim pad is still showing');
 // Since 10 October 2026 the shot controls go at every size: the numbers they
 // used to keep through a flight are in the shot panel, whose line is all that
 // is left of the window (13 October 2026).
 if (!state.panel) bad.push('the shot controls are still showing');
 if (state.numbers) bad.push('the shot panel went, and it carries the flight');
 if (state.map) bad.push('the map went, and it should follow the ball');
 if (state.wind) bad.push('the wind went');
 if (!/BALL (IN FLIGHT|ROLLING)/.test(state.head)) bad.push(`the shot panel's header reads "${state.head}"`);
 if (state.live) bad.push('an old live readout is back');
 if (state.meterMode && !state.meterNumbers) bad.push('the Swing Meter is not showing carry, total and apex in flight');
 if (state.meterMode && state.tiles) bad.push('the number tiles show on the Swing Meter');
 if (bad.length) throw new Error(bad.join('; '));
 const skip = await t.page.evaluate(unreachableControls, '#skipFlight');
 if (skip.length) throw new Error(`Skip cannot be pressed: ${skip.join('; ')}`);
}

// ------------------------------------------------------------ the journeys
//
// Each is a thing a player actually does, start to finish, in a fresh page.
// The shipped-bridge journey, kept by name so the compiled-program one can reuse it.
let JOURNEY_BRIDGE_BUNDLE;
const JOURNEYS = [
 {
  name: 'boot',
  what: 'opens from a file:// URL, the way a player opens it, and reaches the menu',
  async run(t) {
   await t.step('the menu appears', async () => {
    await t.until(() => t.page.evaluate(() => !!window.lab && !document.getElementById('mainMenu')?.hidden),
     'the main menu', 60 * SLOW);
   });
   await t.step('the world is in menu mode behind it', async () => {
    const mode = await t.mode();
    if (mode !== 'menu') throw new Error(`world data-mode is "${mode}", expected "menu"`);
   });
   await t.step('the build names itself', async () => {
    // The stamp the diagnostic reports. A build that cannot say which commit it
    // is makes every tester's report untraceable.
    const stamped = await t.page.evaluate(() => /commit:`[0-9a-f]{7,}`|"commit":"[0-9a-f]{7,}"/.test(document.documentElement.innerHTML));
    if (!stamped) throw new Error('no build stamp in the page -- was it built outside a git checkout?');
   });
  },
 },

 // Run three times: on a desktop, and on a phone both ways up -- the panels
 // are what a phone player taps first, and a panel that fits a desktop can
 // strand its buttons on 390 px.
 ...[['', {}], ['-phone-portrait', {viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true}],
     ['-phone-landscape', {viewport: {width: 844, height: 390}, hasTouch: true, isMobile: true}]].map(([suffix, context]) => ({
  name: `menu-panels${suffix}`,
  context,
  what: 'every panel the menu opens, every tab in it, and the diagnostic',
  async run(t) {
   await menuReady(t);
   // Label on the menu -> the tabs that panel must offer. A tab that throws on
   // render kills every handler after it, which is the incident this guards.
   const PANELS = [
    ['Saved courses', ['Your courses', 'Save a course', 'Import & export']],
    ['My profile', []],
    ['Camera & bay', []],
    ['Graphics', ['Overview', 'Reading the ground', 'Costs a frame']],
    ['Help & controls', ['The essentials', 'Explore the course', 'Controller', 'Made to travel', 'The physics', 'Report a problem', 'Open source & credits']],
    ['Driving range', ['The green', 'Who is hitting']],
    ['Endless', ['Format & tees', 'Your group']],
    ['Play', ['Your course', 'Format & tees', 'Your group', 'Saved rounds']],
   ];
   for (const [entry, tabs] of PANELS) {
    await t.step(`open "${entry}"`, async () => {
     await fromMenu(t, entry);
     await t.until(() => t.drawerOpen(), `the "${entry}" panel`, 5 * SLOW);
    });
    for (const tab of tabs) await t.step(`  "${entry}" → ${tab}`, () => t.press(tab));
    await t.step(`close "${entry}"`, () => t.closeDrawer());
   }
   await t.step('Help → Report a problem → Copy diagnostic', async () => {
    await t.page.locator('#mainMenu').getByRole('button', {name: 'Help & controls'}).click();
    await t.press('Report a problem');
    await t.press('Copy diagnostic');
    const text = await t.page.inputValue('#diagnosticText');
    if (!text.startsWith('Fairway diagnostic')) throw new Error('the diagnostic box is empty or malformed');
    if (/undefined|\bnull\b|NaN/.test(text)) throw new Error(`the diagnostic leaked a raw value: ${text.match(/.*(undefined|\bnull\b|NaN).*/)[0].trim()}`);
    if (!/version\s+[0-9a-f]{7}/.test(text)) throw new Error('the diagnostic does not name the build');
   });
  },
 })),

 {
  name: 'endless-round',
  what: 'the whole round loop: clubs, aim, cameras, a tee shot, a drop, putting out, the scorecard, the next hole',
  async run(t) {
   await menuReady(t);
   await t.step('Endless → Start an endless run', async () => {
    await fromMenu(t, 'Endless');
    await t.pressToPlay('Start an endless run');
   });
   // Which course, on every run and not only a failed one: a software frame's
   // cost depends on the course as well as the machine, and a slow run cannot
   // be told from a slow course without it (16 October 2026).
   const where = await whereAmI(t.page);
   console.log(`       (on ${where.course ?? '?'} · seed ${where.seed ?? '?'})`);
   await t.step('change club with Q and E', async () => {
    const before = await t.page.inputValue('#club');
    await t.key('KeyE'); await t.key('KeyE'); await t.key('KeyQ');
    const after = await t.page.inputValue('#club');
    if (after === before) throw new Error(`the club did not change (still ${before})`);
    await t.key('KeyQ');
   });
   await t.step('aim with ← and →', async () => {
    await t.hold('ArrowLeft', '#aimOutput');
    await t.hold('ArrowRight', '#aimOutput');
   });
   // Up and down move the aim point further and shorter (the power slider went
   // with the Swing Meter, 14 October 2026). Down, so a tee shot near the end
   // of the hole cannot be at the 2000-yard cap.
   //
   // THE TAP THAT NO FRAME SAW. A synthetic press puts key-down and key-up
   // back to back with no frame between -- exactly the tap a slow machine used
   // to lose, and exactly what this harness's first draft took for a broken
   // control. The game now owes that tap to the next frame.
   for (const [code, readout, what] of [['ArrowLeft', '#aimOutput', 'aim'], ['ArrowDown', '#aimRange', 'the aim point']]) {
    await t.step(`an instant ${code} tap still moves ${what}`, async () => {
     const read = () => readout === '#aimRange' ? t.page.inputValue(readout) : t.page.textContent(readout);
     const before = await read();
     await t.key(code);
     await t.until(async () => (await read()) !== before,
      `a tap of ${code} to register (it read "${before}" and never changed)`, 5 * SLOW);
    });
   }
   await t.step('the aim point with ↑ and ↓', async () => {
    await t.hold('ArrowDown', '#aimLabelDistance');
    await t.hold('ArrowUp', '#aimLabelDistance');
   });
   await t.step('the Swing Meter: the bar in yards, the lie, and S, W and X shape the shot', async () => {
    if (!await t.page.evaluate(() => !!document.getElementById('swingMeter').offsetParent)) throw new Error('the Swing Meter is not showing');
    const full = await t.page.textContent('#smTicks .full');
    if (!/\d+\s*yd/.test(full)) throw new Error(`the bar's full line reads "${full}"`);
    if (!/LIE/.test(await t.page.textContent('#lieReadout'))) throw new Error('the lie readout is empty');
    // Phase 2: the target marker is on the bar, inside it.
    await t.until(() => t.page.evaluate(() => { const m = document.getElementById('smTarget'); return !m.hidden && parseFloat(m.style.left) > 0; }), 'the target marker on the bar', 5 * SLOW);
    for (const [code, label] of [['KeyS', '#curveLabel'], ['KeyW', '#heightLabel'], ['KeyX', '#spinLabel']]) {
     const before = await t.page.textContent(label);
     await t.key(code);
     await t.until(async () => (await t.page.textContent(label)) !== before, `${code} to change ${label}`, 5 * SLOW);
    }
    // Back to a plain shot: the curve and height round their lists, and Shift+X
    // takes the step of spin off again.
    await t.key('KeyS'); await t.key('KeyS'); await t.key('KeyW'); await t.key('KeyW');
    await t.page.keyboard.press('Shift+KeyX');
    if (await t.page.textContent('#spinLabel') !== '0') throw new Error('Shift+X did not take the spin back off');
   });
   await t.step('Escape cancels a swing before the distance is set, with no stroke', async () => {
    await t.key('Space');
    await t.until(() => t.page.evaluate(() => document.getElementById('swingMeter').dataset.stage === 'power'), 'Space to start the swing', 5 * SLOW);
    await t.key('Escape');
    await t.until(() => t.page.evaluate(() => document.getElementById('swingMeter').dataset.stage === 'ready'), 'Escape to cancel the swing', 5 * SLOW);
    if (await t.inFlight()) throw new Error('a cancelled swing hit the ball');
   });
   await t.step('cameras: overview, player, green view, back', async () => {
    for (const id of ['overview', 'playerView', 'greenView', 'playerView']) await t.page.click(`#${id}`);
   });
   await t.step('a ball in the air clears the screen, and it comes back when the ball settles', async () => {
    await t.swing();
    await t.until(() => t.inFlight(), 'the Swing Meter to start a shot', 5 * SLOW);
    await flightClearsTheScreen(t, false);
    await t.key('Enter');
    await t.until(async () => !(await t.inFlight()), 'Enter to finish the shot', 30 * SLOW);
    await t.until(() => t.page.evaluate(() => !document.getElementById('world').classList.contains('in-flight')), 'the screen to come back', 5 * SLOW);
    if (!await t.page.evaluate(() => !!document.getElementById('swing').offsetParent)) throw new Error('the shot button did not come back');
    // The swing's marks clear once the ball stops; the three numbers stay
    // (14 October 2026).
    if (await t.page.evaluate(() => !document.getElementById('smPower').hidden)) throw new Error('the meter kept the last swing after the ball stopped');
    if (!/d/.test(await t.page.textContent('#smResult'))) throw new Error('the meter lost the last shot numbers');
   });
   await t.step('drop beside the pin', async () => {
    // The sim drop lives in the tools tray; "Drop at the green" puts the ball
    // two yards from the pin, which makes the putting below deterministic
    // whatever the tee shot did.
    await reliefFirst(t);
    await t.tool('simDrop');
    await t.page.click('#dropAtGreen');
    await t.page.click('#confirmDrop');
    await t.until(() => t.page.evaluate(() => document.getElementById('dropBar')?.hidden !== false), 'the drop to be confirmed', 5 * SLOW);
    // Only once the drop is placed. Putting the tray away between starting a
    // drop and choosing where it goes breaks the drop -- found by doing it.
    await t.closeTools();
   });
   await t.step('putt out', async () => {
    for (let putt = 1; putt <= 6; putt++) {
     await t.putt();
     const holed = await t.holed();
     if (holed === false) continue;
     // THE BALL CLOSE UP in the hole-out banner (Phase 5): drawn, turning, and
     // pictured for a look.
     if (await t.page.waitForSelector('#holeOut:not([hidden]) .hole-out-ball', {timeout: 2500}).then(() => true, () => false)) {
      await t.page.waitForTimeout(400);
      const drawn = await t.page.evaluate(() => { const c = document.querySelector('#holeOut .hole-out-ball'); if (!c) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) n += d[i] > 200; return n / (c.width * c.height); });
      if (drawn < .5) throw new Error(`the ball in the hole-out banner is ${(drawn * 100).toFixed(0)}% drawn`);
      await t.page.locator('#holeOut').screenshot({path: 'bench/shots/smoke/hole-out.png'}).catch(() => {});
     }
     // The XP popup comes up as the hole is paid (14 October 2026): caught here,
     // while it is on screen, and pictured for a look.
     if (await t.page.waitForSelector('#xpGain:not([hidden])', {timeout: 6000}).then(() => true, () => false))
      await t.page.locator('#xpGain').screenshot({path: 'bench/shots/smoke/xp-popup.png'}).catch(() => {});
     // The hole reveal holds for three seconds of WALL time at least, and the
     // card waits for the XP popup to finish (14 October 2026). Once the game
     // says the ball is down there is no deciding left to do, so the wait
     // scales with the renderer; only a build that cannot say waits a fixed
     // time and putts again.
     const done = await t.page.waitForSelector('#nextHoleScore', {state: 'visible', timeout: holed ? 12000 * SLOW : 12000}).then(() => true, () => false);
     if (done) {
      if (await t.page.evaluate(() => !document.getElementById('xpGain').hidden)) throw new Error('the scorecard opened over the XP popup');
      return;
     }
     if (holed) throw new Error(`the putt dropped and no scorecard offered the next hole in ${12 * SLOW}s`);
    }
    throw new Error('six putts from two yards and the ball never dropped');
   });
   await t.step('the scorecard offers the next hole', async () => {
    const title = await t.drawerTitle();
    if (!title) throw new Error('no panel open after holing out');
   });
   // XP AND LEVELS (Phase 4, 14 October 2026): a finished hole pays at least its
   // ten for finishing, and the golfer's chip carries their level.
   await t.step('the hole paid XP, and the score chip shows the level', async () => {
    const p = await t.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('fairway-profiles-v1') || 'null'); return s?.profiles?.find(q => q.id === s.main); });
    if (!(p?.xp >= 10)) throw new Error(`the main golfer has ${p?.xp} XP after a finished hole`);
    if (!(await t.page.evaluate(() => Number(document.getElementById('xpGain')?.dataset.shown) || 0) > 0)) throw new Error('the XP popup never came up');
    // The level sits on the golfer's circle (15 October 2026), not beside the name.
    const level = await t.page.evaluate(() => document.querySelector('.score-chip .chip-level')?.textContent || '');
    if (!/^[0-9]+$/.test(level)) throw new Error(`no level on the score chip's circle (read "${level}")`);
   });
   await t.step('next hole grows and loads', () => t.nextHole(() => t.page.click('#nextHoleScore', {timeout: 3000 * SLOW})));
   await t.step('and plays', () => t.shot());
   // REPLAY ON A LATER ENDLESS HOLE (6 October). An endless world holds one hole,
   // index 0, whatever hole the player has reached; Replay asked the renderer for
   // the round's hole number instead, threw on every frame from hole 2 on and
   // left the round unplayable. Hole 1 never showed it.
   await t.step('replay that shot on the second hole, end it early, and play on', async () => {
    await t.tool('replayShot');
    await t.until(() => t.inFlight(), 'Replay to start', 5 * SLOW);
    await t.closeTools();
    await t.key('Enter');
    await t.until(async () => !(await t.inFlight()), 'the replay to end', 30 * SLOW);
    await t.shot();
   });
  },
 },
 // NO SHADER IS BUILT ONCE THE COURSE IS ON SCREEN (B7 in TODO). A lit program
 // built on first draw freezes that frame for 70 ms or more -- an Ultra course
 // on PNW froze for 170 ms three seconds in, when the arrival camera came down
 // among trees and the forest floor was drawn for the first time. Every lit
 // program must be built behind the loading screen, including those for things
 // that only appear later. Counted from the moment the overlay goes: a program
 // CREATED after that and then DRAWN is a miss. Created and never drawn is
 // allowed -- the floodlit set is warmed in the background on purpose.
 //
 // UNLIT PROGRAMS COUNT TOO, once the camera has turned round (9 October). They
 // were allowed, on the grounds that they build in a few milliseconds -- and
 // they do, alone. But the browser builds programs one at a time, and the first
 // one the page has to wait for waits behind every other in the queue: the god
 // rays' black mask, built the first time the camera faced the sun, froze the
 // owner's Course studio for 8 s on Ultra. So the camera turns a full circle
 // and nothing of any kind may be built.
 //
 // Ultra, because it has the most to warm. GPU only: Ultra on the software
 // rasteriser is minutes a frame, and what is checked is which programs exist,
 // not how fast. Surprise me grows a different course every run, so this is a
 // general check rather than the one PNW course the freeze was found on.
 {
  name: 'no-late-shaders',
  what: 'an Ultra course builds every shader behind the loading screen, none after it appears, even turning to face the sun',
  gpuOnly: true,
  async prepare(page) {
   await page.addInitScript(() => {
    try { localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'ultra', frameCap: 0})); } catch {}
    const P = WebGL2RenderingContext.prototype, create = P.createProgram, use = P.useProgram;
    const src = new WeakMap(), parts = new WeakMap();
    let late = new WeakSet(), watching = false;
    window.__lateLit = []; window.__lateAny = [];
    const shaderSource = P.shaderSource, attach = P.attachShader;
    P.shaderSource = function (shader, text) { src.set(shader, text); return shaderSource.call(this, shader, text); };
    P.attachShader = function (program, shader) { (parts.get(program) || parts.set(program, []).get(program)).push(shader); return attach.call(this, program, shader); };
    P.createProgram = function () { const program = create.call(this); if (watching) late.add(program); return program; };
    P.useProgram = function (program) {
     if (program && late.has(program)) {
      late.delete(program);
      const text = (parts.get(program) || []).map(s => src.get(s) || '').join('\n');
      const type = (text.match(/#define SHADER_TYPE (\w+)/) || [])[1];
      const at = {type: type || 'ShaderMaterial', after: Math.round(performance.now() - window.__shownAt)};
      window.__lateAny.push(at);
      if (/^Mesh(Toon|Standard|Physical|Lambert|Phong)Material$/.test(type)) window.__lateLit.push(at);
     }
     return use.call(this, program);
    };
    // The overlay going is the moment the course is on screen. Watched from
    // inside the page so nothing slips through between two polls.
    addEventListener('DOMContentLoaded', () => {
     const overlay = document.getElementById('generating');
     if (!overlay) return;
     new MutationObserver(() => {
      if (overlay.hidden && !watching) { watching = true; late = new WeakSet(); window.__lateLit = []; window.__lateAny = []; window.__shownAt = performance.now(); }
      else if (!overlay.hidden) watching = false;
     }).observe(overlay, {attributes: true, attributeFilter: ['hidden']});
    });
   });
  },
  async run(t) {
   await menuReady(t);
   await t.step('Play → Surprise me & play, on Ultra', async () => {
    await fromMenu(t, 'Play');
    await t.press('Surprise me & play');
    await t.inPlay(120 * SLOW);
   });
   await t.step('no lit shader is built during the arrival', async () => {
    // The arrival is about three seconds: the hold, then the descent that
    // brings the camera down to where the grass and the forest floor are.
    await t.page.waitForTimeout(5000);
    const late = await t.page.evaluate(() => window.__lateLit);
    if (late.length) throw new Error(`${late.length} lit shader(s) built after the course appeared: ${late.map(l => `${l.type} at ${l.after} ms`).join(', ')}`);
   });
   // THE FIRST SHOT'S TRACER (Phase 5). The tracer styles moved every line onto
   // one program with per-vertex colour and the dash switch; it is not the aim
   // line's program any more, and nothing on screen at load draws it -- so it
   // would be built on the first shot of every course, a frozen frame as the
   // ball leaves. A stand-in now builds it behind the loading screen.
   await t.step('the first shot, its tracer and its glints build no shader', async () => {
    await t.swing();
    await t.until(() => t.inFlight(), 'the first shot to start', 5 * SLOW);
    await t.page.waitForTimeout(2500);
    const late = await t.page.evaluate(() => window.__lateAny);
    if (late.length) throw new Error(`${late.length} shader(s) built during the first shot: ${late.map(l => `${l.type} at ${l.after} ms`).join(', ')}`);
    await t.key('Enter');
    await t.until(async () => !(await t.inFlight()), 'the shot to end', 30 * SLOW);
   });
   await t.step('turning a full circle, toward the sun and away, builds no shader of any kind', async () => {
    // From above the first fairway, looking up a little: the sun is in shot
    // for part of the turn whatever the hour and the course's heading.
    for (let yaw = 0; yaw < 360; yaw += 30) {
     await t.page.evaluate(y => window.lab.camera({hole: 0, along: 60, height: 25, look: y, pitch: 25}), yaw);
     await t.page.waitForTimeout(300);
    }
    const late = await t.page.evaluate(() => window.__lateAny);
    if (late.length) throw new Error(`${late.length} shader(s) built after the course appeared: ${late.map(l => `${l.type} at ${l.after} ms`).join(', ')}`);
   });
  },
 },
 // NO LIT SHADER WHEN THE BALL COMES OR GOES (15 October 2026). The ball's glow
 // light was the ball's child, and three counts only visible lights: the menu
 // hides the ball, so every lit program was built for "no point light", and
 // starting Endless from the menu -- which adopts the hole on screen with no
 // loading screen -- rebuilt all of them in view: 35-40 programs, 1.8 s frozen
 // on a first visit. The end-of-hole flyover hides the ball too, and did the
 // same as the camera pulled back. Watched from the moment the menu settles,
 // with no loading screen to hide behind.
 {
  name: 'ball-light-shaders',
  what: 'starting Endless from the menu builds no lit shader',
  gpuOnly: true,
  async prepare(page) {
   await page.addInitScript(() => {
    const P = WebGL2RenderingContext.prototype, create = P.createProgram, use = P.useProgram, shaderSource = P.shaderSource, attach = P.attachShader;
    // FIRST DRAWN, not created, after the watch starts: on Windows a program is
    // finished on its first real draw, so one created earlier and first drawn
    // in view is the same frozen frame -- and this check, counting creations,
    // passed on the build it was written to catch.
    const src = new WeakMap(), parts = new WeakMap(), fresh = new WeakSet();
    window.__watch = false; window.__lateLit = []; window.__lateAny = [];
    P.shaderSource = function (shader, text) { src.set(shader, text); return shaderSource.call(this, shader, text); };
    P.attachShader = function (program, shader) { (parts.get(program) || parts.set(program, []).get(program)).push(shader); return attach.call(this, program, shader); };
    P.createProgram = function () { const program = create.call(this); fresh.add(program); return program; };
    P.useProgram = function (program) {
     if (program && fresh.has(program)) {
      fresh.delete(program);
      // Behind a loading screen is allowed: that is where programs belong.
      if (window.__watch && document.getElementById('generating')?.hidden !== false) {
       const text = (parts.get(program) || []).map(s => src.get(s) || '').join('\n');
       const type = (text.match(/#define SHADER_TYPE (\w+)/) || [])[1] || 'ShaderMaterial';
       window.__lateAny.push(type);
       if (/^Mesh(Toon|Standard|Physical|Lambert|Phong)Material$/.test(type)) window.__lateLit.push(type);
      }
     }
     return use.call(this, program);
    };
   });
  },
  async run(t) {
   const lit = async when => {
    const late = await t.page.evaluate(() => window.__lateLit);
    if (late.length) throw new Error(`${late.length} lit shader(s) built ${when}: ${late.join(', ')}`);
   };
   await menuReady(t);
   await t.step('Endless from the menu builds no lit shader', async () => {
    await t.page.waitForTimeout(2000);
    await t.page.evaluate(() => { window.__watch = true; });
    await fromMenu(t, 'Endless');
    await t.press('Start an endless run');
    await t.inPlay();
    await t.page.waitForTimeout(3000);
    await lit('as the menu hole became the first hole');
   });
  },
 },
 // The flyover half of the same fault, on a course built through Play. An
 // Endless round adopts the menu's hole, whose no-light programs already exist,
 // so its flyover passed even before the fix; a course behind a loading screen
 // had never drawn without the ball, and its flyover built 17 lit programs as
 // the camera pulled back -- the hole-out stutter the owner reported.
 {
  name: 'ball-light-hole-out',
  what: 'holing out on a Play course: the end-of-hole flyover builds no lit shader',
  gpuOnly: true,
  prepare: page => JOURNEYS.find(j => j.name === 'ball-light-shaders').prepare(page),
  async run(t) {
   await menuReady(t);
   await t.step('Play → Surprise me & play', async () => {
    await fromMenu(t, 'Play');
    await t.press('Surprise me & play');
    await t.inPlay(120 * SLOW);
   });
   await t.step('drop beside the pin', async () => {
    await t.swing();
    await t.until(() => t.inFlight(), 'the shot to start', 5 * SLOW);
    await t.key('Enter');
    await t.until(async () => !(await t.inFlight()), 'the shot to end', 30 * SLOW);
    await reliefFirst(t);
    await t.tool('simDrop');
    await t.page.click('#dropAtGreen');
    await t.page.click('#confirmDrop');
    await t.until(() => t.page.evaluate(() => document.getElementById('dropBar')?.hidden !== false), 'the drop to be confirmed', 5 * SLOW);
    await t.closeTools();
   });
   await t.step('holing out and the end-of-hole flyover build no lit shader', async () => {
    await t.page.evaluate(() => { window.__watch = true; });
    for (let putt = 1; putt <= 6; putt++) {
     await t.putt();
     if (await t.page.waitForSelector('#nextHoleScore', {state: 'visible', timeout: 14000}).then(() => true, () => false)) {
      // The flyover orbits while the scorecard is up.
      await t.page.waitForTimeout(3000);
      const late = await t.page.evaluate(() => window.__lateLit);
      if (late.length) throw new Error(`${late.length} lit shader(s) built during the hole-out and its flyover: ${late.join(', ')}`);
      return;
     }
    }
    throw new Error('six putts from two yards and the ball never dropped');
   });
  },
 },
 // THE FLOODLIGHTS ON ULTRA, SWITCHED ON MID-ROUND THE WAY A PLAYER DOES IT.
 //
 // Two failures this guards. Each casting lamp is a texture unit in every lit
 // shader, against the sixteen WebGL promises, and the first attempt at lamp
 // shadows went over: the ground's program failed to link and the ground
 // disappeared, with every test green. A link failure is a console.error from
 // three, which fails any step here. And switching the lights on used to swap
 // every lit shader for one built on the spot -- 12 to 16 s frozen on Ultra,
 // 26 s on eighteen holes -- because the warm-up built them for the screen
 // while Ultra draws into bloom's target. Everything the lights need is now
 // built behind the loading screen, so the switch must not freeze: the longest
 // frame across it is measured and held under half a second.
 //
 // A round starts at midday with the lights off (the owner, 30 September), so
 // that is checked too. GPU only, for the same reason as above.
 {
  name: 'floodlit-night',
  what: 'Ultra: a round starts at midday with the lights off; switching them on mid-round does not freeze, the nearest lamps cast shadows, and the shadow switch turns them off and on',
  gpuOnly: true,
  async prepare(page) {
   await page.addInitScript(() => {
    try {
     // Saved as night with the lights on: a new round must start at midday with them off anyway.
     localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'ultra', frameCap: 0}));
     localStorage.setItem('fairway-time-v1', JSON.stringify({hour: 22, rate: 0, syncToLocal: false, floodlights: true}));
    } catch {}
   });
  },
  async run(t) {
   await menuReady(t);
   await t.step('Play → Surprise me & play', async () => {
    await fromMenu(t, 'Play');
    await t.press('Surprise me & play');
    await t.inPlay(120 * SLOW);
   });
   await t.step('it starts at midday with the floodlights off', async () => {
    const lit = await t.page.evaluate(() => window.lab.floodlights());
    if (lit) throw new Error('the floodlights were on at the start of the round');
    const clock = (await t.page.textContent('#clockLabel'))?.trim() ?? '';
    if (!/12:00\s*PM/i.test(clock)) throw new Error(`the clock reads "${clock}", not 12:00 PM`);
   });
   const casting = () => t.page.evaluate(() => window.lab.floodShadows().live);
   await t.step('Floodlight the course, from the clock: no freeze', async () => {
    await t.page.click('#clockButton');
    const box = t.page.getByRole('checkbox', {name: 'Floodlight the course'});
    await box.scrollIntoViewIfNeeded();
    // Every frame for three seconds from the click.
    const watch = t.page.evaluate(() => new Promise(done => {
     const s = [], t0 = performance.now();
     const f = n => { s.push(n); if (n - t0 < 3000) requestAnimationFrame(f); else done(Math.max(...s.slice(1).map((x, i) => x - s[i]))); };
     requestAnimationFrame(f);
    }));
    await box.setChecked(true);
    const worst = await watch;
    if (worst > 500) throw new Error(`switching the floodlights on froze the picture for ${Math.round(worst)} ms`);
    await t.page.click('#clockButton');
   });
   await t.step('the lamps nearest the shot cast shadows', async () => {
    await t.until(async () => (await casting()) === 3, 'three lamps casting on Ultra', 15 * SLOW);
   });
   const flip = async on => {
    await t.page.click('#menuNav');
    await t.page.locator('#menuDrop').getByRole('menuitem', {name: 'Graphics & performance'}).click();
    await t.until(async () => !!(await t.panelShowing('Graphics & performance')), 'the graphics window', 5 * SLOW);
    // It lives on the window's "Costs a frame" tab.
    await t.press('Costs a frame');
    const box = t.page.getByRole('checkbox', {name: 'Floodlight shadows'});
    await box.scrollIntoViewIfNeeded();
    await box.setChecked(on);
    // The new programs are built before the switch lands, so it takes a moment.
    await t.until(async () => (await casting()) === (on ? 3 : 0), `floodlight shadows ${on ? 'on' : 'off'}`, 20 * SLOW);
    await t.closePanel('Graphics & performance');
   };
   await t.step('Graphics → Floodlight shadows off', () => flip(false));
   await t.step('and on again', () => flip(true));
   await t.step('and keeps playing', () => t.shot());
  },
 },
 {
  name: 'profile',
  fresh: true,
  what: 'a first visit asks for a name; a new player joins mid-hole and leaves again; every shot reaches its own profile; a round in the history can be played again',
  async run(t) {
   // The store, its main profile, and a profile by name.
   const stored = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-profiles-v1') || 'null'));
   const main = s => s?.profiles.find(p => p.id === s.main);
   const named = (s, n) => s?.profiles.find(p => p.name === n);
   const saved = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-round-v1') || 'null')?.round);
   const groupPanel = async () => {
    await t.page.getByRole('button', {name: 'Players and round'}).first().click();
    await t.until(() => t.drawerOpen(), 'the group panel', 5 * SLOW);
    await t.press('Your group');
   };
   await t.step('the welcome is up, over the menu', () =>
    t.until(() => t.page.evaluate(() => document.getElementById('welcome')?.hidden === false && !document.getElementById('splash')), 'the welcome', 60 * SLOW));
   await t.step('it will not take a blank name', async () => {
    await t.page.click('#welcomeGo');
    const why = await t.page.textContent('#welcomeError');
    if (!why?.trim()) throw new Error('a blank name was accepted, or refused without saying why');
    if (await stored()) throw new Error('a profile was saved with no name');
   });
   await t.step('a name, and it is the main profile', async () => {
    await t.page.fill('#welcomeName', 'Tester');
    // Enter IN THE BOX, the way a player submits it. t.key() blurs the focused
    // element first so arrow keys reach the game, which here sends Enter nowhere.
    await t.page.press('#welcomeName', 'Enter');
    await t.until(() => t.page.evaluate(() => document.getElementById('welcome').hidden), 'the welcome to close', 5 * SLOW);
    if (main(await stored())?.name !== 'Tester') throw new Error('the name was not stored as the main profile');
    const note = await t.page.textContent('#menuProfileNote');
    if (!note?.includes('Tester')) throw new Error(`the menu tile reads "${note}"`);
   });
   await t.step('a new run starts with the main profile as player 1', async () => {
    await fromMenu(t, 'Endless');
    await t.press('Start an endless run');
    await t.inPlay();
    const who = (await saved())?.players?.[0], me = main(await stored());
    if (who?.name !== 'Tester' || who.profile !== me.id) throw new Error(`player 1 is ${JSON.stringify(who)}`);
   });
   await t.step('a new player joins on the tee and becomes a profile', async () => {
    await groupPanel();
    await t.press('Add player');
    // Nobody else is on this device yet, so the new row is a name to type.
    await t.page.fill('#name1', 'Newcomer');
    await t.page.click('#applyGroup');
    await t.until(async () => !(await t.drawerOpen()), 'the group to apply', 5 * SLOW);
    const s = await stored(), n = named(s, 'Newcomer'), players = (await saved())?.players;
    if (!n) throw new Error('no profile was made for the new player');
    if (players?.[1]?.profile !== n.id) throw new Error(`player 2 is ${JSON.stringify(players?.[1])}`);
   });
   await t.step('the main profile tees off and is counted', async () => {
    await t.shot();
    const s = await stored();
    if (main(s).counters.shots !== 1) throw new Error(`Tester's shots read ${main(s).counters.shots}`);
    if (named(s, 'Newcomer').counters.shots) throw new Error("Tester's shot was counted for the newcomer");
   });
   // The same two-yard drop and putt-out the endless journey uses, waiting for
   // the golfer to be IN rather than for the hole: the newcomer is still to play.
   await t.step('drop beside the pin and putt out', async () => {
    await reliefFirst(t);
    await t.tool('simDrop');
    await t.page.click('#dropAtGreen');
    await t.page.click('#confirmDrop');
    await t.until(() => t.page.evaluate(() => document.getElementById('dropBar')?.hidden !== false), 'the drop to be confirmed', 5 * SLOW);
    await t.closeTools();
    for (let putt = 1; ; putt++) {
     await t.putt();
     if ((await saved())?.done?.[0]) break;
     if (putt === 6) throw new Error('six putts from two yards and the ball never dropped');
    }
   });
   // THE TURN FLASH (15 October 2026): the turn has passed to the newcomer, so
   // their name comes up in the middle of the screen, with their circle.
   await t.step('the turn passing to the newcomer flashes their name', async () => {
    await t.until(() => t.page.evaluate(() => { const f = document.getElementById('turnFlash'); return !f.hidden && /Newcomer/.test(f.textContent) && !!f.querySelector('.chip-ball, .chip-dot'); }), 'the turn flash naming the newcomer', 10 * SLOW);
    await t.page.locator('#turnFlash').screenshot({path: 'bench/shots/smoke/turn-flash.png'}).catch(() => {});
    // And the top-bar chip carries the circle with the level on it.
    if (!await t.page.evaluate(() => !!document.querySelector('.score-chip .chip-ball .chip-level'))) throw new Error('no ball circle with the level in the score chip');
   });
   await t.step("the newcomer's tee shot goes to the newcomer", async () => {
    await t.shot();
    const s = await stored(), n = named(s, 'Newcomer');
    if (n.counters.shots !== 1) throw new Error(`the newcomer's shots read ${n.counters.shots}`);
    if (n.rounds.length !== 1) throw new Error('the newcomer has no history entry for this round');
   });
   await t.step('the newcomer leaves mid-hole, and the hole is over', async () => {
    await groupPanel();
    await t.page.click('[data-drop="1"]');
    // Removing a golfer asks twice, by name.
    await t.page.click('#applyGroup');
    await t.page.click('#applyGroup');
    await t.until(() => t.page.waitForSelector('#nextHoleScore', {state: 'visible', timeout: 3000}).then(() => true, () => false), 'the hole to finish', 15 * SLOW);
    if ((await saved())?.players?.length !== 1) throw new Error('the newcomer is still in the group');
    if (!named(await stored(), 'Newcomer')) throw new Error("leaving the round removed the newcomer's profile");
   });
   await t.step('the finished hole is on the history, matching the card', async () => {
    const card = (await saved())?.cards?.[0]?.[0], hole = main(await stored()).rounds[0].card[0];
    if (!Number.isFinite(hole?.score) || hole.score !== card) throw new Error(`the history says ${hole?.score}, the card says ${card}`);
    await t.closeDrawer().catch(() => {});
   });
   await t.step('the profile page shows both players', async () => {
    await t.page.click('#menuNav');
    await t.page.click('#dropMenu');
    // Leaving asks whether to keep the round. The history keeps it either way:
    // it was written hole by hole, not on the way out.
    await t.until(() => t.page.evaluate(() => document.getElementById('leaveNotice')?.hidden === false), 'the leave question', 10 * SLOW);
    await t.page.click('#leaveDiscard');
    await t.until(() => t.page.evaluate(() => !document.getElementById('mainMenu').hidden && document.getElementById('app').dataset.mode === 'menu'), 'the main menu', 60 * SLOW);
    await fromMenu(t, 'My profile');
    await t.until(() => t.drawerOpen(), 'the profile', 5 * SLOW);
    const text = await t.page.textContent('#drawerContent');
    if (!/Tester/.test(text) || !/Shots hit/.test(text) || !/Replay this course/.test(text)) throw new Error('the profile page is missing its name, its stats or its history');
    await t.press('Newcomer');
    await t.until(async () => /Make main profile/.test(await t.page.textContent('#drawerContent')), "the newcomer's page", 5 * SLOW);
    await t.press('Tester main');
   });
   // THE LOOK (Phase 5): the ball as the picture, the starting ball and tracer
   // on, what is not earned shown with its level, and an earned one put on and
   // kept.
   await t.step('My profile: the look picker shows what is earned and saves a choice', async () => {
    if (!await t.page.evaluate(() => !!document.querySelector('#drawerContent .profile-id img.ball-avatar'))) throw new Error('no ball picture on the profile');
    await t.page.click('[data-look-tab="tracer"]');
    await t.until(() => t.page.evaluate(() => !!document.querySelector('.look-item.on')), 'the tracer list', 5 * SLOW);
    const view = await t.page.evaluate(() => ({on: document.querySelector('.look-item.on')?.textContent, locked: document.querySelectorAll('.look-item.locked').length, open: [...document.querySelectorAll('.look-item:not(.on):not(.locked)')].map(b => b.dataset.wear)}));
    if (!/Classic/.test(view.on || '')) throw new Error(`a new golfer wears "${view.on}", not Classic`);
    if (view.locked < 10) throw new Error(`only ${view.locked} tracers are locked for a new golfer`);
    // Locked, not grey (15 October 2026): a padlock, and the colours at full strength.
    if (!await t.page.evaluate(() => { const l = document.querySelector('.look-item.locked'); return !!l?.querySelector('.look-lock') && getComputedStyle(l).opacity === '1'; })) throw new Error('a locked tracer is greyed out or has no padlock');
    if (view.open.length) {
     await t.page.click(`[data-wear="${view.open[0]}"]`);
     await t.until(async () => main(await stored())?.worn?.tracer === view.open[0].split(':')[1], 'the tracer to be saved', 5 * SLOW);
    }
   });
   await t.step('Replay this course grows the same run again', async () => {
    const seed = main(await stored()).rounds[0].course.seed;
    await t.press('Replay this course');
    await t.until(() => t.page.evaluate(s => JSON.parse(localStorage.getItem('fairway-round-v1') || 'null')?.round?.seed === s && !JSON.parse(localStorage.getItem('fairway-round-v1')).round.cards[0].some(Number.isFinite) && document.getElementById('app').dataset.mode === 'play', seed),
     `a fresh run on seed ${seed}`, 120 * SLOW);
   });
  },
 },

 // THE PLAYER'S OWN BAG (12 October 2026, main.js *THE BAG IS THE GOLFER'S*).
 // Edited from the profile, refused when it cannot be played, played in a
 // round longest first, and a second golfer's bag beside the first -- with
 // the club picker following whoever is up.
 {
  name: 'bag',
  what: "each golfer's own bag: named clubs and added kinds, saved in the profile, played in a round, and switched with the golfer who is up",
  async run(t) {
   const stored = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-profiles-v1') || 'null'));
   const named = (s, n) => s?.profiles.find(p => p.name === n);
   const saved = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-round-v1') || 'null')?.round);
   const picker = () => t.page.evaluate(() => [...document.getElementById('club').options].map(o => o.textContent));
   const rows = () => t.page.locator('#bagList .bag-row');
   await menuReady(t);
   await t.step("My profile → Edit Smoke's bag", async () => {
    await fromMenu(t, 'My profile');
    await t.until(() => t.drawerOpen(), 'the profile', 5 * SLOW);
    await t.press("Edit Smoke's bag");
    await t.until(() => t.page.locator('#bagList').isVisible().catch(() => false), 'the bag editor', 5 * SLOW);
    if (await rows().count() !== 8) throw new Error(`a new golfer's bag has ${await rows().count()} clubs, not the stock eight`);
   });
   await t.step('rename the driver and add a club, which follows a change of kind', async () => {
    await rows().first().locator('.bag-name').fill('Big Dog');
    await t.press('Add a club');
    // Added just above the putter, as the first kind the bag does not hold.
    const added = rows().nth(-2);
    if (await added.locator('.bag-name').inputValue() !== '5 Wood') throw new Error(`the new club is called "${await added.locator('.bag-name').inputValue()}"`);
    await added.locator('.bag-kind').selectOption('gap');
    const name = await added.locator('.bag-name').inputValue(), yards = await added.locator('.bag-carry').inputValue();
    if (name !== 'Gap wedge' || yards !== '85') throw new Error(`a fresh club changed to a gap wedge reads "${name}", ${yards} yd`);
   });
   await t.step('a bag with two clubs of one name is refused, and nothing is saved', async () => {
    await rows().nth(-2).locator('.bag-name').fill('big dog');
    await t.press('Save bag');
    const why = await t.page.textContent('#playError');
    if (!/Two clubs are called/.test(why || '')) throw new Error(`the duplicate was answered with "${why}"`);
    if (named(await stored(), 'Smoke').bag) throw new Error('a refused bag was stored');
   });
   await t.step('saved, it is in the profile and back on the profile page', async () => {
    await rows().nth(-2).locator('.bag-name').fill('Gap wedge');
    await t.press('Save bag');
    await t.until(() => t.page.locator('.profile-bag').isVisible().catch(() => false), 'the profile page', 5 * SLOW);
    const bag = named(await stored(), 'Smoke').bag?.map(c => `${c.name} ${c.carry}`);
    if (!bag?.includes('Big Dog 250') || !bag.includes('Gap wedge 85') || bag.length !== 9) throw new Error(`stored bag: ${JSON.stringify(bag)}`);
    if (!(await t.page.textContent('.profile-bag')).includes('Big Dog')) throw new Error('the profile page does not show the new bag');
    await t.closeDrawer();
   });
   await t.step('a round plays the bag, longest first and the putter last', async () => {
    await fromMenu(t, 'Endless');
    await t.press('Start an endless run');
    await t.inPlay();
    const want = ['Big Dog', '3 Wood', '5 Iron', '7 Iron', '9 Iron', 'Pitching wedge', 'Gap wedge', 'Sand wedge', 'Putter'];
    const got = await picker();
    if (got.join() !== want.join()) throw new Error(`the club picker reads ${got.join(', ')}`);
   });
   await t.step('a second golfer joins, and their bag is edited in the round', async () => {
    await t.page.getByRole('button', {name: 'Players and round'}).first().click();
    await t.until(() => t.drawerOpen(), 'the group panel', 5 * SLOW);
    await t.press('Your group');
    await t.press('Add player');
    await t.page.fill('#name1', 'Second');
    await t.page.click('#applyGroup');
    await t.until(async () => !(await t.drawerOpen()), 'the group to apply', 5 * SLOW);
    await t.tool('[data-panel="bag"]');
    await t.until(() => t.page.locator('#bagOwner').isVisible().catch(() => false), 'the bag window with a choice of golfer', 5 * SLOW);
    const owners = await t.page.locator('#bagOwner option').allTextContents();
    if (owners.join() !== 'Smoke,Second') throw new Error(`whose bag offers ${owners.join(', ')}`);
    if (await t.page.locator('#bagOwner').inputValue() !== named(await stored(), 'Smoke').id) throw new Error('the bag window did not open on the golfer who is up');
    await t.page.locator('#bagOwner').selectOption({label: 'Second'});
    await t.until(async () => (await rows().first().locator('.bag-name').inputValue()) === 'Driver', "Second's stock bag", 5 * SLOW);
    await rows().first().locator('.bag-name').fill('Hammer');
    await t.press('Save bag');
    await t.until(async () => named(await stored(), 'Second')?.bag?.[0]?.name === 'Hammer', "Second's bag to be stored", 5 * SLOW);
    if ((await picker())[0] !== 'Big Dog') throw new Error("saving Second's bag changed the clubs of the golfer who is up");
    await t.page.getByRole('button', {name: 'Close Bag', exact: true}).click();
    await t.closeTools();
   });
   await t.step("when Second is up, the picker is Second's bag", async () => {
    await t.shot();
    await reliefFirst(t);
    await t.tool('simDrop');
    await t.page.click('#dropAtGreen');
    await t.page.click('#confirmDrop');
    await t.until(() => t.page.evaluate(() => document.getElementById('dropBar')?.hidden !== false), 'the drop to be confirmed', 5 * SLOW);
    await t.closeTools();
    for (let putt = 1; ; putt++) {
     await t.putt();
     if ((await saved())?.done?.[0]) break;
     if (putt === 6) throw new Error('six putts from two yards and the ball never dropped');
    }
    await t.until(async () => (await picker())[0] === 'Hammer', "Second's clubs in the picker", 5 * SLOW);
   });
  },
 },
 {
  name: 'relief',
  what: 'water and out of bounds offer the relief the Rules allow, through a reload, under both out-of-bounds rules; a player backup saves and restores',
  async run(t) {
   const saved = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-round-v1') || 'null')?.round);
   const barUp = () => t.page.evaluate(() => document.getElementById('reliefBar')?.hidden === false);
   // `lab.trouble` sends the ball at the nearest water, or straight out of
   // bounds, through the same finishShot a struck ball takes.
   const trouble = kind => t.page.evaluate(k => window.lab.trouble(k), kind);
   await menuReady(t);
   await t.step('a course with plenty of water', async () => {
    await t.page.evaluate(() => window.lab.course({water: 100, lakes: 2, holes: 9}));
    await t.inPlay(120 * SLOW);
   });
   await t.step('out of bounds from the tee: stroke and distance, applied, one penalty', async () => {
    const before = await saved();
    const r = await trouble('out');
    if (r) throw new Error('the Rules give out of bounds one option, so nothing should be left to choose');
    const after = await saved();
    if (after.strokes[0] !== 2) throw new Error(`strokes read ${after.strokes[0]}, want 2 (the shot and the penalty)`);
    if (JSON.stringify(after.positions[0]) !== JSON.stringify(before.positions[0])) throw new Error('the ball did not go back to where it was hit from');
    if (await barUp()) throw new Error('the relief bar is up with nothing to choose');
   });
   await t.step('into the water: the choices, and the drop', async () => {
    const r = await trouble('water');
    if (!r) throw new Error('no water found on this hole');
    const ids = r.options.map(o => o.id);
    if (ids[0] !== 'stroke' || !ids.includes('line') && !ids.includes('lateral')) throw new Error(`offered ${ids.join(', ')}`);
    if (r.options.some(o => o.penalty !== 1)) throw new Error('water relief is one stroke, whichever option');
    if (!(await barUp())) throw new Error('the relief bar did not appear');
    if (!(await t.page.evaluate(() => document.getElementById('swing').disabled))) throw new Error('a shot could be taken before relief');
   });
   await t.step('the choice survives a reload', async () => {
    await t.page.reload();
    await menuReady(t);
    await t.page.click('#menuContinue');
    await t.inPlay(120 * SLOW);
    await t.until(barUp, 'the relief bar to come back', 10 * SLOW);
    // By keyboard: an arrow steps to another option, Enter takes it.
    const active = () => t.page.evaluate(() => [...document.querySelectorAll('[data-relief]')].findIndex(b => b.classList.contains('active')));
    const was = await active();
    await t.key('ArrowRight');
    if ((await active()) === was) throw new Error('the arrow key did not move to another option');
    await t.key('Enter');
    const after = await saved();
    if (after.relief) throw new Error('relief is still waiting after the drop');
    if (after.strokes[0] !== 4) throw new Error(`strokes read ${after.strokes[0]}, want 4`);
    if (await barUp()) throw new Error('the relief bar stayed up');
   });
   await t.step('Local Rule E-5, chosen in Format & tees, offers the two-stroke drop', async () => {
    await t.page.getByRole('button', {name: 'Players and round'}).first().click();
    await t.until(() => t.drawerOpen(), 'the round panel', 5 * SLOW);
    await t.press('Format & tees');
    await t.page.selectOption('#roundOB', 'e5');
    await t.closeDrawer();
    if ((await saved()).outOfBounds !== 'e5') throw new Error('the round did not take the rule');
    await t.shot();
    const before = (await saved()).strokes[0], r = await trouble('out');
    const e5 = r?.options.find(o => o.id === 'e5');
    if (e5) {
     if (e5.penalty !== 2) throw new Error('E-5 is two penalty strokes');
     await t.page.click(`[data-relief="${r.options.indexOf(e5)}"]`);
     await t.page.click('#reliefTake');
     if ((await saved()).strokes[0] !== before + 3) throw new Error('the shot and two penalty strokes were not counted');
    } else if ((await saved()).strokes[0] !== before + 2) throw new Error('with no fairway to drop on, stroke and distance should have applied');
   });
   await t.step('a player backup saves, and restores a player into this device', async () => {
    await t.page.click('#menuNav');
    await t.page.click('#dropMenu');
    await t.until(() => t.page.evaluate(() => document.getElementById('leaveNotice')?.hidden === false), 'the leave question', 10 * SLOW);
    await t.page.click('#leaveDiscard');
    await t.until(() => t.page.evaluate(() => !document.getElementById('mainMenu').hidden && document.getElementById('app').dataset.mode === 'menu'), 'the main menu', 60 * SLOW);
    await fromMenu(t, 'My profile');
    await t.until(() => t.drawerOpen(), 'the profile', 5 * SLOW);
    const [download] = await Promise.all([t.page.waitForEvent('download'), t.page.click('#profilesExport')]);
    const file = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'));
    if (file.kind !== 'fairway-profiles' || !file.profiles.some(p => p.name === 'Smoke')) throw new Error('the backup does not hold the players');
    file.profiles.push({id: 'prestored', name: 'Restored', created: 1, counters: {shots: 3}, bests: {}, rounds: []});
    const [chooser] = await Promise.all([t.page.waitForEvent('filechooser'), t.page.click('#profilesImport')]);
    await chooser.setFiles({name: 'fairway-players.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file))});
    await t.until(async () => /Restored/.test(await t.page.textContent('#drawerContent')), 'the restored player on the page', 5 * SLOW);
    const names = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-profiles-v1')).profiles.map(p => p.name));
    if (!names.includes('Smoke') || !names.includes('Restored')) throw new Error(`players are ${names.join(', ')}`);
   });
  },
 },

 {
  name: 'no-swallowed-errors',
  what: 'starting the game and building a course throw nothing at all -- not even an error something catches and hides',
  async run(t) {
   // THE CONSOLE CANNOT SEE A CAUGHT ERROR. A TODO entry once reported a
   // TypeError "thrown during load and swallowed"; it could not be reproduced
   // on any version in the repository's history (7 October), so this keeps it
   // from coming back unseen: the browser's debugger is told to stop on EVERY
   // exception, caught or not, and each one is recorded and let go. A clean
   // start and course build throw none, so any is a failure.
   const cdp = await t.page.context().newCDPSession(t.page);
   const thrown = [];
   cdp.on('Debugger.paused', ev => {
    const lines = (ev.data?.description || ev.reason || '').toString().split(String.fromCharCode(10));
    thrown.push(lines.slice(0, 3).map(l => l.trim()).join(' | '));
    cdp.send('Debugger.resume').catch(() => {});
   });
   await cdp.send('Debugger.enable');
   await cdp.send('Debugger.setPauseOnExceptions', {state: 'all'});
   const check = what => { if (thrown.length) throw new Error(`${thrown.length} thrown while ${what}: ${[...new Set(thrown)].slice(0, 3).join(' || ')}`); };
   await t.step('a fresh start, to the menu', async () => {
    await t.page.reload();
    await menuReady(t);
    check('starting');
   });
   await t.step('an 18-hole course', async () => {
    await t.page.evaluate(() => window.lab.course({holes: 18}));
    await t.inPlay(120 * SLOW);
    check('building an 18-hole course');
   });
   await t.step('a tee shot', async () => {
    await t.shot();
    check('playing a shot');
   });
   await cdp.send('Debugger.disable').catch(() => {});
  },
 },

 {
  name: 'surprise-round',
  what: 'Play → Surprise me & play builds a nine-hole course, and every in-round tool opens',
  async run(t) {
   await menuReady(t);
   // The button that died once already, along with "Start fresh round" and
   // the course picker, while the panel looked completely normal.
   await t.step('Play → Surprise me & play', async () => {
    await fromMenu(t, 'Play');
    await t.press('Surprise me & play');
    await t.inPlay(120 * SLOW);
   });
   await t.step('it is a nine-hole course, on hole one', async () => {
    const hole = (await t.page.textContent('#holeNumber'))?.trim();
    if (!/^0?1\b/.test(hole ?? '')) throw new Error(`hole number reads "${hole}"`);
   });
   await t.step('tee shot', () => t.shot());
   await t.step('replay the shot', async () => {
    await t.tool('replayShot');
    await t.until(() => t.inFlight(), 'the replay to start', 5 * SLOW);
    await t.key('Enter');
    await t.until(async () => !(await t.inFlight()), 'the replay to finish', 30 * SLOW);
   });
   await t.step('mulligan', async () => {
    await t.tool('mulligan');
    await t.inPlay();
    await t.closeTools();
   });
   // ONE ESCAPE CLOSES THE PANEL IN FRONT OF YOU. With the Tools window open,
   // opening the scorecard puts its blur over the Tools window; Escape used to
   // shut the hidden Tools window first and need a second press for the
   // scorecard. The Tools window must survive, for when the card is gone.
   await t.step('the scorecard over an open Tools window, closed by one Escape', async () => {
    await t.tool('replayShot').catch(() => {});
    if (await t.inFlight()) { await t.key('Enter'); await t.until(async () => !(await t.inFlight()), 'the replay to finish', 30 * SLOW); }
    await t.until(() => t.page.evaluate(() => document.getElementById('toolsTray')?.hidden === false), 'the Tools window to be open', 5 * SLOW);
    // The score chips in the top bar are the way to the card now.
    await t.page.getByRole('button', {name: /Open the scorecard/}).first().click();
    await t.until(() => t.drawerOpen(), 'the scorecard', 5 * SLOW);
    await t.key('Escape');
    await t.until(async () => !(await t.drawerOpen()), 'ONE Escape to close the scorecard', 3 * SLOW);
    const toolsStillOpen = await t.page.evaluate(() => document.getElementById('toolsTray')?.hidden === false);
    if (!toolsStillOpen) throw new Error('Escape closed the scorecard and the Tools window with it');
    await t.closeTools();
   });
   // Every panel the in-round menu offers, opened and closed. Found by the
   // label the player reads in the top menu.
   // Menu label -> the title of the window it opens. Not always the same:
   // Help opens as "Welcome to Fairway".
   for (const [entry, title] of [['Saved courses', 'Saved courses'], ['Graphics & performance', 'Graphics & performance'], ['Help & controls', 'Welcome to Fairway']]) {
    await t.step(`menu → ${entry}`, async () => {
     await t.page.click('#menuNav');
     await t.page.locator('#menuDrop').getByRole('menuitem', {name: entry}).click();
     await t.until(async () => !!(await t.panelShowing(title)), `a window called "${title}"`, 5 * SLOW);
     await t.closePanel(title);
    });
   }
   await t.step('and keeps playing', () => t.shot());
  },
 },

 {
  name: 'range',
  what: 'the driving range opens from the menu and takes shots',
  async run(t) {
   await menuReady(t);
   await t.step('Driving range → Open the driving range', async () => {
    await fromMenu(t, 'Driving range');
    await t.press('Open the driving range');
    await t.inPlay(120 * SLOW);
   });
   await t.step('a shot', () => t.shot());
   await t.step('another, after changing club', async () => {
    await t.key('KeyQ');
    await t.shot();
   });
  },
 },

 {
  name: 'sound',
  what: 'the Sound window turns the sound down and off and keeps the choice, and shots still fly and land with sound playing',
  async run(t) {
   await menuReady(t);
   await t.step('Sound → its window, from the menu', async () => {
    await t.page.locator('#mainMenu').getByRole('button', {name: 'Sound', exact: true}).click();
    await t.until(async () => !!(await t.panelShowing('Sound')), 'the sound window', 5 * SLOW);
   });
   await t.step('the volume and the switch are kept', async () => {
    await t.page.locator('#sndMaster').evaluate(el => { el.value = '40'; el.dispatchEvent(new Event('input', {bubbles: true})); });
    const box = t.page.getByRole('checkbox', {name: 'Sound on'});
    await box.setChecked(false);
    await box.setChecked(true);
    const kept = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-sound-v1') || '{}'));
    if (kept.master !== 40 || kept.on !== true) throw new Error(`the sound settings were not kept: ${JSON.stringify(kept)}`);
    await t.closePanel('Sound');
   });
   await t.step('Driving range, with sound: shots fly and land', async () => {
    await fromMenu(t, 'Driving range');
    await t.press('Open the driving range');
    await t.inPlay(120 * SLOW);
    await t.shot();
    await t.shot();
   });
  },
 },

 {
  name: 'studio',
  what: 'Course studio grows a landscape and saves it as a course',
  async run(t) {
   await menuReady(t);
   await t.step('Course studio → Grow this landscape', async () => {
    await fromMenu(t, 'Course studio');
    await t.press('Grow this landscape');
    await t.until(() => t.page.evaluate(() => document.getElementById('world')?.dataset.mode === 'studio'
     && document.getElementById('generating')?.hidden !== false), 'the studio landscape', 120 * SLOW);
   });
   // The bar and every panel are both pinned to the bottom of the course, and
   // until 12 October 2026 the bar sat over the panel's lowest rows. main.js
   // lifts it above an open panel (*THE STUDIO BAR RIDES ABOVE*) and folds it to
   // icons where the room above is short. Checked as geometry -- the bar clear
   // of the panel and inside the course -- plus every bar button clickable,
   // because a scrolled panel's own controls are clipped on purpose and would
   // read as covered.
   await t.step('the studio bar clears an open panel, desktop to phone', async () => {
    const was = t.page.viewportSize();
    await t.page.click('#studioSettings');
    await t.until(() => t.drawerOpen(), 'the settings panel', 5 * SLOW);
    const problems = [];
    for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 720], [844, 390], [390, 844]]) {
     await t.page.setViewportSize({width: w, height: h});
     await t.page.waitForTimeout(600 * SLOW);
     const fit = await t.page.evaluate(() => {
      const bar = document.getElementById('studioBar').getBoundingClientRect();
      const panel = document.getElementById('drawer').getBoundingClientRect();
      const world = document.getElementById('world').getBoundingClientRect();
      // The settings take the play area but for a strip holding the bar (15
      // October 2026): `spare` is the course still showing besides that strip.
      return {gap: Math.round(panel.top - bar.bottom), above: Math.round(bar.top - world.top),
       spare: Math.round((panel.top - world.top) - (bar.height + 28) + (world.bottom - panel.bottom)),
       compact: document.getElementById('studioBar').classList.contains('compact')};
     });
     const bad = await t.page.evaluate(unreachableControls, '#studioBar button, #closeDrawer');
     const notes = [...(fit.gap < 0 ? [`the bar overlaps the panel by ${-fit.gap}px`] : []),
      ...(Math.abs(fit.spare) > 2 ? [`the settings leave ${fit.spare}px of course showing`] : []),
      ...(fit.above < 0 ? [`the bar runs ${-fit.above}px off the top of the course`] : []),
      ...(bad.length ? [`${bad.length} unreachable -- ${bad.join('; ')}`] : [])];
     console.log(`     ${`${w}x${h}`.padEnd(10)} ${fit.compact ? 'icons only' : 'full bar  '}  ${notes.length ? notes.join('; ') : 'fine'}`);
     if (notes.length) problems.push(`${w}x${h}`);
    }
    if (was) await t.page.setViewportSize(was);
    await t.closeDrawer();
    // And back down to the foot of the course once the panel goes.
    await t.until(() => t.page.evaluate(() => document.getElementById('studioBar').style.getPropertyValue('--panel-lift') === '0px'),
     'the studio bar to come back down', 2 * SLOW);
    if (problems.length) throw new Error(`the studio bar and the panel collide at ${problems.join(', ')}`);
   });
   await t.step('save it', async () => {
    await t.page.click('#studioSave');
    // Saving opens Saved courses with the name already filled in, so a player
    // can accept it with one click.
    await t.until(() => t.drawerOpen(), 'the save panel', 5 * SLOW);
    await t.press('Save a course');
    // Scoped to the open panel: the leave-without-saving dialogue carries a
    // name box with the same label, hidden, and matching both is an error.
    const name = await t.page.locator('#drawerContent').getByLabel('Name this course').inputValue();
    if (!name.trim()) throw new Error('the name box was not pre-filled');
    await t.press('Save this landscape');
    // Checked the way a player would check it -- is it in Saved courses, by
    // the name it was given -- rather than by reading storage. The first draft
    // read localStorage, got the format wrong, and failed a save that worked.
    await t.press('Your courses');
    await t.until(() => t.page.locator('#drawerContent').getByText(name, {exact: true}).first().isVisible().catch(() => false),
     `"${name}" to be listed in Your courses`, 5 * SLOW);
    await t.closeDrawer();
   });
   await t.step('leave the studio', async () => {
    await t.page.click('#studioExit');
    await t.until(async () => (await t.mode()) === 'menu', 'the menu', 10 * SLOW);
   });
  },
 },

 {
  name: 'hud-reachable',
  what: 'every play-screen control can be clicked, nothing scrolls, and the course shows -- desktop to phone',
  // Runs its own window sizes rather than the shared one. Desktop and the
  // commonest laptops, an iPad both ways up, and a phone both ways up. The
  // phone sizes are checked with the card's details folded AND open, because
  // opening them makes the card taller and moves everything stacked under it.
  sizes: [[1920, 1080], [1536, 864], [1440, 900], [1366, 768], [1280, 720],
   [1180, 820], [820, 1180], [844, 390], [390, 844]],
  async run(t) {
   await menuReady(t);
   // THE MENU FIRST, at every size. It is the first screen anybody sees, and
   // on a phone its bottom buttons used to sit below the screen with no way to
   // scroll to them. The splash fades for a couple of seconds; wait it out.
   await t.page.waitForTimeout(3000);
   const menuProblems = [];
   for (const [w, h] of this.sizes) {
    await t.page.setViewportSize({width: w, height: h});
    await t.page.waitForTimeout(300 * SLOW);
    const bad = await t.page.evaluate(unreachableControls, '#mainMenu button');
    const health = await t.page.evaluate(layoutHealth);
    const notes = [...(bad.length ? [`${bad.length} unreachable -- ${bad.join('; ')}`] : []), ...(health.scrolls ? [`the page scrolls (${health.page})`] : [])];
    console.log(`     menu ${`${w}x${h}`.padEnd(19)} ${notes.length ? notes.join('; ') : 'fine'}`);
    if (notes.length) menuProblems.push(`${w}x${h}`);
   }
   await t.step('every menu button reachable, at every size', async () => {
    if (menuProblems.length) throw new Error(`the menu has problems at ${menuProblems.join(', ')}`);
   });
   await t.page.setViewportSize({width: 1920, height: 1080});
   await t.step('Endless → Start an endless run', async () => {
    await fromMenu(t, 'Endless');
    await t.press('Start an endless run');
    await t.inPlay();
   });
   // The toast that announces an Endless run sits at the top for four
   // seconds. It no longer swallows clicks, but let it go before measuring.
   await t.page.waitForTimeout(4500);
   const problems = [];
   const check = async (label, floor = SCENE_FLOOR) => {
    // The HUD lays itself out on resize, and the layout measures itself a
    // frame after that; give it a few.
    await t.page.waitForTimeout(500 * SLOW);
    const bad = await t.page.evaluate(unreachableControls);
    const health = await t.page.evaluate(layoutHealth);
    const notes = [];
    if (bad.length) notes.push(`${bad.length} unreachable -- ${bad.join('; ')}`);
    if (health.scrolls) notes.push(`the page scrolls (${health.page})`);
    if (health.scene < floor) notes.push(`the HUD hides ${100 - health.scene}% of the course (floor ${floor}% visible)`);
    console.log(`     ${label.padEnd(24)} course ${String(health.scene).padStart(2)}%  ${notes.length ? notes.join('; ') : 'fine'}`);
    if (notes.length) problems.push(label);
   };
   for (const [w, h] of this.sizes) {
    await t.page.setViewportSize({width: w, height: h});
    const phone = w <= 560 || h <= 500;
    // The shot panel folds to one line at every size: folded by default on a
    // phone, open on anything bigger. Both are checked: an open grid is the
    // most of the course the panel covers, and on a phone the one state that
    // can crowd the map.
    // On the Swing Meter there are no tiles and no fold (14 October 2026), so
    // the open state is only checked where the fold is on screen.
    await t.page.evaluate(() => { if (document.getElementById('world').classList.contains('shot-open')) document.getElementById('shotToggle').click(); });
    await check(`${w}x${h} shot panel folded`);
    if (await t.page.isVisible('#shotToggle')) {
     await t.page.click('#shotToggle');
     await check(`${w}x${h} shot panel open`, phone ? OPENED_FLOOR : SCENE_FLOOR);
     await t.page.click('#shotToggle');
    }
   }
   await t.step('every control reachable, no scrolling, the course visible, at every size', async () => {
    if (problems.length) throw new Error(`layout problems at ${problems.join(', ')}`);
   });
  },
 },
 // TEXT SIZE, FOR A PROJECTOR (ui-scale.js). The whole interface is CSS-zoomed and
 // laid out as a smaller window would be, so the same three things as above have
 // to hold at a larger text size: every control reachable, nothing scrolling, the
 // course showing. And the course must still be drawn at the screen's full
 // resolution -- the canvas sits inside the zoom, and without the pixel ratio
 // carrying it the course would be drawn smaller and stretched. 200% asked for on
 // a 1080p screen must come out at the 150% that screen holds.
 {
  name: 'text-size',
  what: 'larger text at 150% and 200%: every control reachable, nothing scrolls, the course sharp; 200% on 1080p held to 150%',
  context: {viewport: {width: 1920, height: 1080}},
  async prepare(page) {
   await page.addInitScript(() => { try { localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'low', frameCap: 0, textSize: 150})); } catch {} });
  },
  async run(t) {
   await menuReady(t);
   const zoom = () => t.page.evaluate(() => Number(getComputedStyle(document.getElementById('app')).zoom));
   await t.step('the menu, at 150%', async () => {
    if (Math.abs((await zoom()) - 1.5) > .01) throw new Error(`the interface is at ${await zoom()}, not 1.5`);
    const bad = await t.page.evaluate(unreachableControls, '#mainMenu button');
    if (bad.length) throw new Error(`${bad.length} menu buttons unreachable: ${bad.join('; ')}`);
   });
   await t.step('Endless → Start an endless run', async () => {
    await fromMenu(t, 'Endless');
    await t.press('Start an endless run');
    await t.inPlay();
   });
   await t.page.waitForTimeout(4500);
   const play = async label => {
    await t.page.waitForTimeout(800 * SLOW);
    const bad = await t.page.evaluate(unreachableControls);
    const health = await t.page.evaluate(layoutHealth);
    const sharp = await t.page.evaluate(() => { const c = document.getElementById('scene'), r = c.getBoundingClientRect(); return {drawn: c.width, shown: Math.round(r.width * devicePixelRatio)}; });
    const notes = [];
    if (bad.length) notes.push(`${bad.length} unreachable -- ${bad.join('; ')}`);
    if (health.scrolls) notes.push(`the page scrolls (${health.page})`);
    if (health.scene < SCENE_FLOOR) notes.push(`the HUD hides ${100 - health.scene}% of the course`);
    // Low draws at .75 of the screen's pixels on purpose (its tier); anything
    // else under that is the zoom shrinking the course.
    if (sharp.drawn < sharp.shown * .74) notes.push(`the course is drawn ${sharp.drawn} px wide for ${sharp.shown} on screen`);
    console.log(`     ${label.padEnd(24)} course ${String(health.scene).padStart(2)}%  drawn ${sharp.drawn}/${sharp.shown}  ${notes.length ? notes.join('; ') : 'fine'}`);
    if (notes.length) throw new Error(notes.join('; '));
   };
   await t.step('the play screen at 150% on 1920x1080', () => play('1920x1080 at 150%'));
   await t.step('200% on 2560x1440, set in Graphics', async () => {
    await t.page.setViewportSize({width: 2560, height: 1440});
    await t.page.click('#menuNav');
    await t.page.locator('#menuDrop').getByRole('menuitem', {name: 'Graphics & performance'}).click();
    await t.until(async () => !!(await t.panelShowing('Graphics & performance')), 'the graphics window', 5 * SLOW);
    await t.page.$eval('#gfxTextSize', el => { el.value = 200; el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); });
    await t.until(async () => Math.abs((await zoom()) - 2) < .01, 'the interface at 200%', 5 * SLOW);
    await t.closePanel('Graphics & performance');
    await play('2560x1440 at 200%');
   });
   await t.step('the same 200% on a 1080p screen is held to 150%', async () => {
    await t.page.setViewportSize({width: 1920, height: 1080});
    await t.until(async () => Math.abs((await zoom()) - 1.5) < .01, 'the interface held to 150%', 5 * SLOW);
    await play('1920x1080, 200% held');
   });
   await t.step('and keeps playing', () => t.shot());
  },
 },
 // A HOLE PLAYED ON A PHONE, WITH NOTHING BUT A THUMB. No keyboard at all:
 // aim by tapping the course, shoot and skip with the on-screen buttons, drop
 // through the tools, putt out, and take the next hole. The browser pretends
 // to be a phone -- touch events, a phone's screen -- which proves everything
 // fits and answers a tap. It cannot prove how a real iPhone's Safari feels or
 // how fast a real phone renders; that takes the phone.
 ...['portrait', 'landscape'].map(way => ({
  name: `phone-${way}`,
  what: `a hole on a phone held ${way === 'portrait' ? 'upright' : 'sideways'}, by touch alone`,
  context: {viewport: way === 'portrait' ? {width: 390, height: 844} : {width: 844, height: 390},
   hasTouch: true, isMobile: true, deviceScaleFactor: 2},
  async run(t) {
   await menuReady(t);
   const tap = sel => t.page.tap(sel);
   await t.step('Endless → Start an endless run', async () => {
    await t.page.locator('#mainMenu').getByRole('button', {name: 'Endless'}).first().tap();
    await t.page.getByRole('button', {name: 'Start an endless run', exact: true}).tap();
    await t.inPlay();
   });
   // On the Swing Meter the floating number tiles and their fold are gone: the
   // meter carries carry, total and apex itself (14 October 2026), checked in
   // flight by flightClearsTheScreen. Before that, from 13 October, the tiles
   // started shown on a phone; before that, folded.
   await t.step('on the Swing Meter the number tiles and their fold are gone', async () => {
    const shown = await t.page.evaluate(() => ({tiles: !!document.querySelector('#shotTiles .shot-tile')?.offsetHeight, fold: !!document.getElementById('shotToggle')?.offsetParent}));
    if (shown.tiles || shown.fold) throw new Error(`still showing: ${JSON.stringify(shown)}`);
   });
   await t.step('aim by tapping the course', async () => {
    const before = await t.page.textContent('#aimOutput');
    const box = await t.page.locator('#scene').boundingBox();
    // Off to one side of the middle of the screen, which is fairway or rough
    // on any hole -- the point is only that the aim moves.
    await t.page.touchscreen.tap(box.x + box.width * 0.62, box.y + box.height * 0.45);
    await t.until(async () => (await t.page.textContent('#aimOutput')) !== before, 'a tap on the course to move the aim', 5 * SLOW);
   });
   await touchAiming(t);
   let checkedFlight = false;
   const swing = async () => {
    await t.until(async () => !(await t.inFlight()), 'the previous shot to finish', 30 * SLOW);
    // The Swing button starts the meter; mid-swing the whole screen is the tap
    // target, so the next two taps land anywhere.
    // A putt is two taps, so the third is only made while a swing still waits.
    // The marker starts from the far left (14 October 2026), so the distance tap
    // waits for it to pass the strike line and the strike comes on its way back.
    await tap('#swing');
    await t.page.waitForTimeout(800);
    await tap('#swingCatcher');
    await t.page.waitForTimeout(300);
    if (await t.page.evaluate(() => !document.getElementById('swingCatcher').hidden)) await t.page.tap('#swingCatcher', {timeout: 2000}).catch(() => {});
    await t.until(() => t.inFlight(), 'the Swing button and two taps to start a shot', 5 * SLOW);
    if (!checkedFlight) { checkedFlight = true; await flightClearsTheScreen(t, true); }
    await t.page.locator('#skipFlight').tap({timeout: 10000 * SLOW});
    await t.until(async () => !(await t.inFlight()), 'Skip to finish the shot', 30 * SLOW);
    // The screen comes back a frame after the ball settles, and fades in.
    await t.until(() => t.page.evaluate(() => !document.getElementById('world').classList.contains('in-flight')), 'the screen to come back after the shot', 5 * SLOW);
    await t.page.waitForTimeout(300);
   };
   await t.step('the shot button, then Skip', swing);
   await t.step('drop beside the pin, through the tools', async () => {
    await reliefFirst(t, tap);
    await tap('#barTools');
    await t.until(() => t.page.evaluate(() => document.getElementById('toolsTray')?.hidden === false), 'the tools', 5 * SLOW);
    await tap('#simDrop');
    await tap('#dropAtGreen');
    await tap('#confirmDrop');
    await t.until(() => t.page.evaluate(() => document.getElementById('dropBar')?.hidden !== false), 'the drop to be confirmed', 5 * SLOW);
    await t.closeTools();
   });
   await t.step('putt out with the shot button', async () => {
    for (let putt = 1; putt <= 6; putt++) {
     await t.until(async () => !(await t.inFlight()), 'the previous putt to finish', 30 * SLOW);
     await tap('#swing');
     await tapOnTarget(t);
     await t.until(() => t.inFlight(), 'the putt to start', 5 * SLOW);
     await t.page.locator('#skipFlight').tap({timeout: 10000 * SLOW}).catch(() => {});
     await t.until(async () => !(await t.inFlight()), 'the putt to finish', 30 * SLOW);
     // Holed or not from the game (`holed`); the card waits for the XP popup
     // (14 October 2026), so give it time.
     const holed = await t.holed();
     if (holed === false) continue;
     if (await t.page.waitForSelector('#nextHoleScore', {state: 'visible', timeout: holed ? 12000 * SLOW : 12000}).then(() => true, () => false)) return;
     if (holed) throw new Error(`the putt dropped and no scorecard offered the next hole in ${12 * SLOW}s`);
    }
    throw new Error('six putts from two yards and the ball never dropped');
   });
   await t.step('the next hole, from the scorecard', () => t.nextHole(() => t.page.locator('#nextHoleScore').tap({timeout: 3000 * SLOW})));
   await t.step('and plays', swing);
   await t.step('nothing on the play screen is out of reach', async () => {
    // A random course can put that shot in water, and the relief bar is MEANT
    // to cover the club and the aim pad while relief is chosen -- so relief is
    // taken first and the screen checked as a golfer about to hit sees it
    // (the flake in TODO, closed 14 October 2026).
    await reliefFirst(t, tap);
    await t.until(() => t.page.evaluate(() => document.getElementById('reliefBar')?.hidden !== false), 'relief to be taken', 10 * SLOW);
    const bad = await t.page.evaluate(unreachableControls);
    if (bad.length) throw new Error(`${bad.length} unreachable: ${bad.join('; ')}`);
   });
  },
 })),
 // THE GAME AS A HOSTED WEB APP -- what an iPhone sees when it is added to the
 // home screen from Netlify. Served from a real local web address rather than
 // opened from disk, which only these two journeys do: every other one proves
 // the PORTABLE file makes no requests and links no manifest.
 //
 // Twice: once as a public host, and once as a PASSWORD-PROTECTED one, the way
 // the owner's Netlify site is kept private. That server refuses every request
 // without the visitor's login with a 401, as Netlify does, and the journey
 // logs in first, as the owner did in Safari. The first version of this failed
 // there -- the icon and the manifest were fetched without the login and came
 // back 401 -- and this is the journey that reproduces it.
 //
 // The verdicts come from Chrome itself, not from reading the spec: its own
 // manifest parser, through the DevTools protocol, and its own install check.
 // What it cannot test is Safari on an iPhone, which is checked on the phone.
 ...[['home-screen', false], ['home-screen-private', true]].map(([name, protect]) => ({
  name,
  what: protect
   ? 'served behind a password, like the private Netlify site: nothing the home screen needs is refused'
   : 'served from a web address, the page links its manifest and icons, and Chrome can parse them',
  serve: {protect},
  async run(t) {
   await menuReady(t);
   await t.step('the iPhone tags are in the page', async () => {
    const tags = await t.page.evaluate(() => ({
     capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
     title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
     bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
    }));
    if (tags.capable !== 'yes') throw new Error('no apple-mobile-web-app-capable meta -- the home-screen icon would open inside Safari');
    if (tags.title !== 'Fairway') throw new Error(`home-screen title is "${tags.title}"`);
    // Deliberately not black-translucent until the controls keep clear of the notch.
    if (tags.bar !== 'black') throw new Error(`status bar style is "${tags.bar}"`);
   });
   await t.step('no Add to Home Screen hint: this is not an iPhone', async () => {
    if (!await t.page.evaluate(() => document.getElementById('homeHint').hidden)) throw new Error('the iPhone hint shows on a desktop browser');
   });
   await t.step('the home-screen icon is INSIDE the page, a 180 px PNG', async () => {
    const icon = await t.page.evaluate(() => document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') || '');
    // Inside, because a phone fetches a linked icon WITHOUT the visitor's login.
    if (!icon.startsWith('data:image/png;base64,')) throw new Error(`the icon is a link to "${icon.slice(0, 60)}", which a password-protected host refuses`);
    const size = await t.page.evaluate(src => new Promise((ok, no) => {
     const img = new Image(); img.onload = () => ok([img.naturalWidth, img.naturalHeight]); img.onerror = () => no(new Error('the icon data does not decode')); img.src = src;
    }), icon);
    if (size.join('x') !== '180x180') throw new Error(`apple-touch-icon is ${size.join('x')}`);
   });
   await t.step('the manifest is linked, and asks to carry the login', async () => {
    const link = await t.page.evaluate(() => { const l = document.querySelector('link[rel="manifest"]'); return l && {href: l.href, cross: l.crossOrigin}; });
    if (!link) throw new Error('no manifest link on a served page');
    if (link.cross !== 'use-credentials') throw new Error(`manifest crossorigin is "${link.cross}"; without use-credentials a private host refuses it`);
   });
   await t.step("Chrome's own parser reads the manifest, and every icon is inside it", async () => {
    const cdp = await t.page.context().newCDPSession(t.page);
    const got = await cdp.send('Page.getAppManifest');
    const problems = (got.errors || []).map(e => e.message);
    if (!got.data) throw new Error('Chrome could not fetch the manifest');
    if (problems.length) throw new Error(`manifest problems: ${problems.join('; ')}`);
    const m = JSON.parse(got.data);
    if (m.display !== 'standalone') throw new Error(`display is "${m.display}"`);
    for (const icon of m.icons) {
     if (!icon.src.startsWith('data:image/png;base64,')) throw new Error(`manifest icon ${icon.src.slice(0, 40)} is a link a private host would refuse`);
     const ok = await t.page.evaluate(src => new Promise(done => { const i = new Image(); i.onload = () => done(i.naturalWidth > 0); i.onerror = () => done(false); i.src = src; }), icon.src);
     if (!ok) throw new Error(`manifest icon ${icon.sizes} does not decode`);
    }
   });
   await t.step("Chrome's install check: what, if anything, stops it being installable", async () => {
    const cdp = await t.page.context().newCDPSession(t.page);
    const got = await cdp.send('Page.getInstallabilityErrors');
    const errs = (got.installabilityErrors || []).map(e => e.errorId);
    // Reported rather than required: Android and desktop installs are a bonus;
    // the iPhone, which is the point, does not use this check.
    console.log(`       Chrome installability: ${errs.length ? errs.join(', ') : 'installable'}`);
   });
   await t.step('and it still plays: into an Endless round', async () => {
    await fromMenu(t, 'Endless');
    await t.press('Start an endless run');
    await t.inPlay();
    await t.shot();
   });
  },
 })),
 // THE ADD TO HOME SCREEN HINT, as an iPhone meets it: the hosted copy, a
 // phone's screen and touch, and the identity Safari on an iPhone gives. It is
 // Chrome underneath, which does not matter -- the hint only reads the
 // identity and whether the page is running from the home screen, and both
 // are set here the way an iPhone sets them.
 {
  name: 'home-screen-hint',
  what: 'on an iPhone in a browser, the menu says once how to add Fairway to the home screen',
  serve: {protect: false},
  context: {viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
   userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'},
  async run(t) {
   const shown = () => t.page.evaluate(() => !document.getElementById('homeHint').hidden && !!document.getElementById('homeHint').offsetHeight);
   await menuReady(t);
   await t.step('the hint is on the menu, and says what to press', async () => {
    if (!await shown()) throw new Error('no hint on the first visit from an iPhone');
    const text = await t.page.textContent('#homeHint');
    if (!/Share/.test(text) || !/Add to Home Screen/.test(text)) throw new Error(`the hint says "${text.trim()}"`);
    const bad = await t.page.evaluate(unreachableControls, '#homeHint button');
    if (bad.length) throw new Error(bad.join('; '));
   });
   await t.step('"Got it" puts it away', async () => {
    await t.page.getByRole('button', {name: 'Got it', exact: true}).tap();
    if (await shown()) throw new Error('the hint is still showing');
   });
   await t.step('and it is said once: not again on the next visit', async () => {
    await t.page.reload();
    await t.until(() => t.page.evaluate(() => !!window.lab && !document.getElementById('mainMenu')?.hidden), 'the main menu', 60 * SLOW);
    if (await shown()) throw new Error('the hint came back after it was dismissed');
   });
   await t.step('never from disk, where there is no address to add', async () => {
    // A file opened from disk is its own origin with its own storage, so
    // nothing remembered above hides the hint here: only the address does.
    // Before the installed-app step, whose pretence would hide it anyway.
    await t.page.goto(url);
    await t.until(() => t.page.evaluate(() => !!window.lab && !document.getElementById('mainMenu')?.hidden), 'the main menu', 60 * SLOW);
    if (await shown()) throw new Error('the hint shows on a file opened from disk');
   });
   await t.step('and never inside the home-screen app itself', async () => {
    await t.page.goto(t.home);
    await t.page.evaluate(() => localStorage.removeItem('fairway-home-hint-v1'));
    await t.page.addInitScript(() => Object.defineProperty(navigator, 'standalone', {value: true}));
    await t.page.reload();
    await t.until(() => t.page.evaluate(() => !!window.lab && !document.getElementById('mainMenu')?.hidden), 'the main menu', 60 * SLOW);
    if (await shown()) throw new Error('the hint shows in the installed app, which is already on the home screen');
   });
  },
 },
 // PLAYING WITH A LAUNCH MONITOR, which is the way Fairway is meant to be
 // played. No device and no bridge process: Playwright answers the game's
 // WebSocket itself, the way the bridge in `bridge/server.mjs` does -- a
 // status message for what the device is doing, a shot message for a swing --
 // and the journey checks what a player at the mat would see.
 {
  name: 'monitor',
  what: 'a launch monitor through a pretend bridge: the window that replaces the shot controls, aiming by key, a measured shot, its numbers, and disarming',
  context: {viewport: {width: 1366, height: 768}},
  async prepare(page) {
   this.acks = [];
   await page.routeWebSocket('ws://127.0.0.1:1922/', ws => {
    this.bridge = ws;
    ws.onMessage(m => { try { const d = JSON.parse(m); if (d.type === 'ack') this.acks.push(d); } catch {} });
    ws.send(monitorStatus('green'));
   });
  },
  async run(t) {
   const acks = this.acks, bridge = {send: m => this.bridge.send(m)}, status = monitorStatus;
   const shown = sel => t.page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.closest('[hidden]') && e.offsetParent !== null; }, sel);
   const title = () => t.page.textContent('#monTitle');
   await menuReady(t);
   await t.step('Endless → Start an endless run', async () => {
    await fromMenu(t, 'Endless');
    await t.press('Start an endless run');
    await t.inPlay();
   });
   await t.step('connect the bridge and arm the monitor', async () => {
    await t.page.getByRole('button', {name: 'Connect monitor'}).click();
    await t.press('Connect bridge');
    await t.until(() => shown('#monState'), 'the monitor strip on the shot controls', 5 * SLOW);
    await t.page.getByLabel(/Arm monitor/).check();
    await t.key('Escape');
    await t.until(async () => (await title()) === 'Ready', 'the panel to say Ready', 5 * SLOW);
   });
   await t.step('armed: the shot controls go and the launch monitor window takes their place', async () => {
    for (const sel of ['.bottom-area', '#swing', '#swingMeter', '#shapeControl', '.meter-button', '.aim-control', '#aimRange', '#monState'])
     if (await shown(sel)) throw new Error(`${sel} still shows with the monitor armed`);
    for (const sel of ['#monitorPanel', '#monClub', '#monReconnect', '#monArm', '#monLie'])
     if (!await shown(sel)) throw new Error(`${sel} is missing from the launch monitor window`);
    if (await shown('#monByHand')) throw new Error('Hit by hand is back; the Armed switch replaced it');
   });
   await t.step('armed, up and down move the aim point, and the pin label gives way while aiming', async () => {
    const {before, after} = await t.hold('ArrowUp', '#aimLabelDistance');
    const n = v => parseFloat(String(v).replace(/[^0-9.]/g, ''));
    if (!(n(after) > n(before))) throw new Error(`up moved the aim point from ${before} to ${after}`);
    if (await shown('#swingMeter')) throw new Error('the Swing Meter came up while the monitor is armed');
    const faded = sel => t.page.evaluate(q => document.querySelector(q).classList.contains('faded'), sel);
    if (await faded('#aimLabel') || !await faded('#flagLabel')) throw new Error('while aiming, the aim label should show and the pin label give way');
    await t.until(async () => (await faded('#aimLabel')) && !(await faded('#flagLabel')), 'the pin label to come back after aiming stops', 5 * SLOW);
   });
   await t.step('a measured shot flies, and the shot panel carries its numbers', async () => {
    bridge.send(JSON.stringify({type: 'shot', requestId: 'smoke-1', payload: {DeviceID: 'Smoke', Units: 'Yards', ShotNumber: 1, APIversion: '1',
     BallData: {Speed: 147.5, VLA: 14.3, HLA: 2.3, TotalSpin: 3250, SpinAxis: -13.2}, ShotDataOptions: {ContainsBallData: true, ContainsClubData: false}}}));
    await t.until(() => t.inFlight(), 'the monitor shot to start', 5 * SLOW);
    await t.key('Enter');
    await t.until(async () => !(await t.inFlight()), 'the shot to finish', 30 * SLOW);
    if (!acks.some(a => a.requestId === 'smoke-1' && a.accepted)) throw new Error(`the game did not accept the shot: ${JSON.stringify(acks)}`);
    if (!await shown('#shotPanel')) throw new Error('the shot panel is not showing');
    const carry = await t.page.textContent('#shotTiles [data-field=carry]');
    if (!/\d+\s*yd/.test(carry) || !/CARRY/.test(carry)) throw new Error(`the carry tile reads "${carry}"`);
   });
   await t.step('every ticked number is a tile of its own, and club tiles show dashes without club data', async () => {
    const tiles = await t.page.$$eval('#shotTiles .shot-tile', els => els.map(e => e.dataset.field));
    if (!tiles.includes('ballSpeed') || !tiles.includes('carry')) throw new Error(`tiles are ${JSON.stringify(tiles)}`);
    // A ticked number always shows (the owner found club numbers missing and
    // took the tick for broken); without club data it is a dash.
    const club = await t.page.textContent('#shotTiles [data-field=clubSpeed]');
    if (!/—/.test(club)) throw new Error(`club speed reads "${club}" from a shot that sent none`);
    // The caption names the device the shot came from -- it once printed the
    // bridge's status object instead, as "[object Object]". It is the panel's
    // header now, which a penalty message does not replace: when it was the
    // first line of the grid, a random course putting this shot in water
    // failed this step (10 October 2026).
    const caption = await t.page.textContent('#shotCaption');
    if (!/Smoke/.test(caption) || /object/i.test(caption)) throw new Error(`the caption reads "${caption}"`);
   });
   await t.step('the numbers stay while the monitor finds and tees the next ball', async () => {
    bridge.send(status('amber'));
    await t.until(async () => (await title()) === 'Finding ball', 'the panel to say Finding ball', 5 * SLOW);
    bridge.send(status('green'));
    await t.until(async () => (await title()) === 'Ready', 'the panel to say Ready', 5 * SLOW);
    if (!/\d/.test(await t.page.textContent('#shotTiles [data-field=carry]'))) throw new Error('the shot numbers went when the next ball was teed');
   });
   await t.step('no device: red, with Reconnect', async () => {
    bridge.send(status('red'));
    await t.until(async () => (await title()) === 'No monitor', 'the window to say No monitor', 5 * SLOW);
    await t.page.getByRole('button', {name: 'Reconnect', exact: true}).waitFor({state: 'visible', timeout: 5000 * SLOW});
   });
   await t.step('the Armed switch in the window brings back the shot controls', async () => {
    await t.page.click('#monArm');
    await t.until(() => shown('#swing'), 'the shot button to come back', 5 * SLOW);
    if (!await shown('#swingMeter')) throw new Error('the Swing Meter did not come back');
    if (await shown('#monitorPanel')) throw new Error('the launch monitor window stayed after disarming');
    if (!await shown('#monState')) throw new Error('the strip to re-arm the monitor is missing from the shot controls');
    await t.shot();
   });
  },
 },
 // A LAUNCH MONITOR FROM A PHONE, the way it actually works: the game loaded
 // FROM the bridge over the home network (plain http -- a secure hosted copy
 // cannot reach the bridge at all; RESEARCH.md has why), on a phone's screen.
 // Served here by the harness's own server, with a pretend bridge answering at
 // the address the page came from, which is where the real bridge would be.
 // The phone's top bar has no room for "Connect monitor", so the ways in are
 // the main menu and the Tools window -- the first cut hid the button with no
 // way in at all, which the owner found on an iPhone.
 // A MIXED GROUP (Phase 3, 14 October 2026): one golfer on the launch monitor,
 // one on the Swing Meter, the monitor armed throughout. Stroke play keeps a
 // golfer on the hole until they hole out, so rather than playing a hole out
 // this switches the golfer who is up between the two ways of playing, mid-
 // round, through the group editor -- which is how a player changes it.
 {
  name: 'mixed-group',
  what: 'a monitor golfer and a Swing Meter golfer in one group: the meter on a meter golfer\'s turn with the monitor waiting, a monitor ball refused then, and the monitor back the moment the golfer switches',
  context: {viewport: {width: 1366, height: 768}},
  async prepare(page) {
   this.acks = [];this.players = [];
   await page.routeWebSocket('ws://127.0.0.1:1922/', ws => {
    this.bridge = ws;
    ws.onMessage(m => { try { const d = JSON.parse(m); if (d.type === 'ack') this.acks.push(d); if (d.type === 'player') this.players.push(d); } catch {} });
    ws.send(monitorStatus('green'));
   });
  },
  async run(t) {
   const shown = sel => t.page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.closest('[hidden]') && e.offsetParent !== null; }, sel);
   const shot = n => JSON.stringify({type: 'shot', requestId: 'mixed-' + n, payload: {DeviceID: 'Smoke', Units: 'Yards', ShotNumber: n, APIversion: '1',
    BallData: {Speed: 140, VLA: 14, HLA: 0, TotalSpin: 3000, SpinAxis: 0}, ShotDataOptions: {ContainsBallData: true, ContainsClubData: false}}});
   const groupPanel = async () => {
    await t.page.getByRole('button', {name: 'Players and round'}).first().click();
    await t.until(() => t.drawerOpen(), 'the group panel', 5 * SLOW);
    await t.press('Your group');
   };
   await menuReady(t);
   await t.step('connect and arm from the main menu', async () => {
    await t.page.locator('#mainMenu').getByRole('button', {name: 'Launch monitor'}).click();
    await t.press('Connect bridge');
    await t.until(async () => (await t.page.textContent('#connectionLabel')) === 'Bridge connected', 'the bridge to connect', 5 * SLOW);
    await t.page.getByLabel(/Arm monitor/).check();
    await t.key('Escape');
   });
   await t.step('a group of two: the first golfer on the Swing Meter, left-handed; the second on the monitor', async () => {
    await fromMenu(t, 'Endless');
    await t.press('Your group');
    await t.press('Add player');
    await t.page.fill('#name1', 'Second');
    // The "plays with" and hand choices are there: a bridge has connected.
    if (!await shown('#input0') || !await shown('#hand0')) throw new Error('the group editor does not ask how each golfer plays');
    await t.page.selectOption('#input0', 'meter');
    await t.page.selectOption('#hand0', 'LH');
    await t.page.selectOption('#input1', 'monitor');
    await t.press('Start an endless run');
    await t.inPlay();
   });
   await t.step('on the Swing Meter golfer\'s turn: the meter is up and the monitor waits on its strip', async () => {
    await t.until(() => shown('#swingMeter'), 'the Swing Meter', 5 * SLOW);
    if (await shown('#monitorPanel')) throw new Error('the launch monitor window is up on a Swing Meter turn');
    if (!await shown('#monState')) throw new Error('the monitor strip is missing');
    const text = await t.page.textContent('#monStateText');
    if (!/Swing Meter/.test(text)) throw new Error(`the strip says "${text}"`);
    if (!await t.page.isChecked('#monArmHand')) throw new Error('Armed went off; it should stay on for the monitor golfer');
   });
   await t.step('a ball hit into the monitor then is refused', async () => {
    this.bridge.send(shot(1));
    await t.until(() => this.acks.some(a => a.requestId === 'mixed-1'), 'the bridge to hear back', 5 * SLOW);
    if (this.acks.find(a => a.requestId === 'mixed-1').accepted) throw new Error('a monitor shot was played on a Swing Meter golfer\'s turn');
    if (await t.inFlight()) throw new Error('a ball is in the air');
   });
   await t.step('switched to the monitor mid-round: the window is back, the device is told the hand, and a shot plays', async () => {
    await groupPanel();
    await t.page.selectOption('#input0', 'monitor');
    await t.page.click('#applyGroup');
    await t.until(async () => !(await t.drawerOpen()), 'the group to apply', 5 * SLOW);
    await t.until(() => shown('#monitorPanel'), 'the launch monitor window', 5 * SLOW);
    if (await shown('#swingMeter')) throw new Error('the Swing Meter stayed up');
    await t.until(() => this.players.some(p => p.Player?.Handed === 'LH' && p.ready), 'the device to be told this golfer is left-handed and ready', 5 * SLOW);
    this.bridge.send(shot(2));
    await t.until(() => t.inFlight(), 'the monitor shot to fly', 5 * SLOW);
    if (!this.acks.find(a => a.requestId === 'mixed-2')?.accepted) throw new Error('the monitor shot was not accepted');
    await t.key('Enter');
    await t.until(async () => !(await t.inFlight()), 'the shot to finish', 30 * SLOW);
   });
   await t.step('and back to the Swing Meter: the meter returns and swings', async () => {
    await groupPanel();
    await t.page.selectOption('#input0', 'meter');
    await t.page.click('#applyGroup');
    await t.until(async () => !(await t.drawerOpen()), 'the group to apply', 5 * SLOW);
    await t.until(() => shown('#swingMeter'), 'the Swing Meter', 5 * SLOW);
    await t.shot();
   });
   await t.step('the golfers\' choices are remembered in their profiles', async () => {
    const store = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-profiles-v1') || 'null'));
    const first = store?.profiles?.find(p => p.id === store.main), second = store?.profiles?.find(p => p.name === 'Second');
    if (first?.input !== 'meter' || first?.hand !== 'LH') throw new Error(`the first golfer's profile reads ${JSON.stringify({input: first?.input, hand: first?.hand})}`);
    if (second?.input !== 'monitor') throw new Error(`the second golfer's profile reads ${JSON.stringify({input: second?.input})}`);
   });
  },
 },
 {
  name: 'monitor-phone',
  what: 'a phone reaches the launch monitor from the menu and Tools, with the bridge address filled in and remembered',
  serve: {protect: false},
  context: {viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 2},
  async prepare(page) {
   await page.routeWebSocket(u => /^ws:\/\/127\.0\.0\.1:\d+\/?$/.test(String(u)), ws => { ws.onMessage(() => {}); ws.send(monitorStatus('green')); });
  },
  async run(t) {
   const address = () => t.page.inputValue('#bridgeUrl');
   const expected = new URL(t.home).host;
   await menuReady(t);
   await t.step('the main menu has a way to the launch monitor', async () => {
    const bad = await t.page.evaluate(unreachableControls, '#menuMonitor');
    if (bad.length) throw new Error(bad.join('; '));
    // The phone's camera button belongs to play; it once floated over the menu.
    if (await t.page.evaluate(() => !!document.getElementById('camButton').offsetParent)) throw new Error('the camera button shows on the main menu');
    await t.page.locator('#mainMenu').getByRole('button', {name: 'Launch monitor'}).tap();
    await t.until(() => t.page.evaluate(() => !!document.getElementById('bridgeUrl')), 'the monitor panel', 5 * SLOW);
   });
   await t.step('the bridge address is where the page came from, not this phone', async () => {
    const got = await address();
    if (got !== `ws://${expected}`) throw new Error(`the address box reads "${got}", not ws://${expected}`);
    if (await t.page.evaluate(() => /loaded securely/.test(document.getElementById('drawerContent')?.textContent || ''))) throw new Error('the secure-copy warning shows on a page served over http');
   });
   await t.step('connect and arm', async () => {
    await t.page.getByRole('button', {name: 'Connect bridge'}).tap();
    await t.until(async () => (await t.page.textContent('#connectionLabel')) === 'Bridge connected', 'the bridge to connect', 5 * SLOW);
    await t.page.getByLabel(/Arm monitor/).check();
    await t.key('Escape');
   });
   await t.step('into a round: the shot panel says Ready, and Tools has the monitor too', async () => {
    await t.page.locator('#mainMenu').getByRole('button', {name: 'Endless'}).first().tap();
    await t.page.getByRole('button', {name: 'Start an endless run', exact: true}).tap();
    await t.inPlay();
    await t.until(async () => (await t.page.textContent('#monTitle')) === 'Ready', 'the panel to say Ready', 5 * SLOW);
    await t.page.tap('#barTools');
    await t.page.getByRole('button', {name: 'Launch monitor', exact: true}).tap();
    await t.until(() => t.page.evaluate(() => !!document.getElementById('bridgeUrl')), 'the monitor panel from Tools', 5 * SLOW);
    await t.key('Escape');
   });
   await t.step('the address is remembered on this device', async () => {
    await t.page.reload();
    await t.until(() => t.page.evaluate(() => !!window.lab && !document.getElementById('mainMenu')?.hidden), 'the main menu', 60 * SLOW);
    await t.page.locator('#mainMenu').getByRole('button', {name: 'Launch monitor'}).tap();
    await t.until(() => t.page.evaluate(() => !!document.getElementById('bridgeUrl')), 'the monitor panel', 5 * SLOW);
    if ((await address()) !== `ws://${expected}`) throw new Error(`after a reload the address box reads "${await address()}"`);
   });
  },
 },
 // THE BRIDGE A PLAYER RUNS: the bundled `fairway-bridge.mjs` from the build,
 // started as its own process, serving the game, with a pretend CONNECTOR on
 // its TCP port sending a real Open Connect shot -- the whole path from a
 // launch monitor's software to a ball in the air, with nothing pretend on
 // the Fairway side of it. The shot is acknowledged back to the connector
 // with the bridge's own reply code.
 JOURNEY_BRIDGE_BUNDLE = {
  name: 'bridge-bundle',
  what: 'the shipped bridge, run as a player runs it: it serves the game, takes a connector, and a shot flies',
  bridge: true,
  context: {viewport: {width: 1366, height: 768}},
  async run(t) {
   const {tcp} = t.bridgePorts;
   await menuReady(t);
   await t.step('the page came from the bridge, and the panel already knows where it is', async () => {
    await t.page.locator('#mainMenu').getByRole('button', {name: 'Launch monitor'}).click();
    const got = await t.page.inputValue('#bridgeUrl');
    if (got !== `ws://127.0.0.1:${t.bridgePorts.http}`) throw new Error(`the address box reads "${got}"`);
    await t.press('Connect bridge');
    await t.until(async () => (await t.page.textContent('#connectionLabel')) === 'Bridge connected', 'the bridge to connect', 10 * SLOW);
   });
   const connector = net.connect(tcp, '127.0.0.1');
   await new Promise((ok, no) => { connector.once('connect', ok); connector.once('error', no); });
   let replies = '';
   connector.on('data', d => { replies += d; });
   try {
    await t.step('a connector joins, and the panel sees the device', async () => {
     connector.write(JSON.stringify({DeviceID: 'Smoke connector', ShotDataOptions: {ContainsBallData: false, LaunchMonitorIsReady: true, LaunchMonitorBallDetected: true}}));
     await t.until(async () => /Ready|Finding ball/.test(await t.page.textContent('#monTitle') || ''), 'the device to show in the panel', 10 * SLOW);
     await t.page.getByLabel(/Arm monitor/).check();
     await t.key('Escape');
    });
    await t.step('into a round, and a shot from the connector flies and is acknowledged', async () => {
     await fromMenu(t, 'Endless');
     await t.press('Start an endless run');
     await t.inPlay();
     await t.until(async () => (await t.page.textContent('#monTitle')) === 'Ready', 'the panel to say Ready', 10 * SLOW);
     connector.write(JSON.stringify({DeviceID: 'Smoke connector', Units: 'Yards', ShotNumber: 1, APIversion: '1',
      BallData: {Speed: 147.5, VLA: 14.3, HLA: 2.3, TotalSpin: 3250, SpinAxis: -13.2}, ShotDataOptions: {ContainsBallData: true, ContainsClubData: false}}));
     await t.until(() => t.inFlight(), 'the connector shot to fly', 10 * SLOW);
     await t.key('Enter');
     await t.until(async () => !(await t.inFlight()), 'the shot to finish', 30 * SLOW);
     await t.until(async () => /"Code"\s*:\s*200/.test(replies), `the connector to hear 200 (it heard ${replies.trim() || 'nothing'})`, 10 * SLOW);
    });
   } finally { connector.destroy(); }
  },
 },
 // PHASES 5-7 (14 October 2026), written while the owner's machine was busy and
 // first run once it was free. Each seeds a golfer of a known level, so what is
 // open is known.
 {
  name: 'challenge',
  what: 'Challenges: five tabs holding all 27, closest to the pin plays five balls on the Challenge Course with the bar up, nothing is saved as a round, the results card offers it again; a putting one holes out, a range one plays on the range, and a long drive starts',
  async prepare(page) {
   // A golfer at level 7 with a record from before medals. Every challenge is
   // open from the start (15 and 16 October 2026).
   await page.addInitScript(() => { try { localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'pch', profiles: [{id: 'pch', name: 'Chal', created: 1, counters: {}, bests: {}, rounds: [], xp: 3150, xpLog: {}, challenges: {closest: {feet: 9, at: 1}}}]})); localStorage.removeItem('fairway-round-v1'); } catch {} });
  },
  async run(t) {
   await menuReady(t);
   const bar = re => t.page.evaluate(src => !document.getElementById('challengeBar').hidden && new RegExp(src).test(document.getElementById('challengeBar').textContent), re.source);
   // From the main menu to a challenge's Start, by its tab and card.
   const open = async (tab, id) => {
    if (!(await t.page.evaluate(() => !document.getElementById('mainMenu').hidden))) {
     await t.page.click('#menuNav');await t.page.click('#dropMenu');
     await t.until(() => t.page.evaluate(() => !document.getElementById('mainMenu').hidden), 'the main menu', 60 * SLOW);
    }
    await fromMenu(t, 'Challenges');
    await t.page.click(`[data-chal-tab="${tab}"]`);
    await t.page.click(`[data-challenge="${id}"]`);
    await t.page.waitForSelector('#challengeGo', {timeout: 10000 * SLOW});
    await t.page.click('#challengeGo');
    await t.inPlay(180 * SLOW);
   };
   await t.step('Challenges → five tabs, all 27, none locked, the old record already a medal', async () => {
    await fromMenu(t, 'Challenges');
    await t.until(() => t.page.evaluate(() => document.querySelectorAll('.chal-tabs .panel-tab').length === 5), 'the five tabs', 10 * SLOW);
    let cards = 0;
    for (const tab of ['tee', 'approach', 'range', 'short', 'putting']) {
     await t.page.click(`[data-chal-tab="${tab}"]`);
     await t.until(() => t.page.evaluate(id => document.querySelector(`[data-chal-tab="${id}"]`)?.classList.contains('active'), tab), `the ${tab} tab`, 10 * SLOW);
     // The challenge of the week's card sits above the tabs, on every one: count the tab's own.
     cards += await t.page.evaluate(() => document.querySelectorAll('.chal-card[data-challenge]').length);
    }
    if (cards !== 27) throw new Error(`${cards} challenge cards`);
    if (await t.page.evaluate(() => document.querySelectorAll('.chal-card.locked, .chal-card[disabled]').length)) throw new Error('a challenge is locked');
    const m = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-profiles-v1')).profiles[0].medals);
    if (m?.closest !== 3) throw new Error(`the 9-foot record from before medals is not a gold: ${JSON.stringify(m)}`);
   });
   await t.step('closest to the pin starts on a par 3 of the Challenge Course, with the bar', async () => {
    await t.page.click('[data-chal-tab="approach"]');
    await t.page.click('[data-challenge="closest"]');
    await t.page.waitForSelector('#challengeGo', {timeout: 10000 * SLOW});
    await t.page.click('#challengeGo');
    await t.inPlay(180 * SLOW);
    await t.until(() => bar(/Ball 1 of 5/), 'the challenge bar on ball 1', 20 * SLOW);
    if (await t.page.textContent('#holePar') !== '3') throw new Error(`the challenge is on a par ${await t.page.textContent('#holePar')}`);
   });
   await t.step('five balls, and the results card', async () => {
    for (let i = 1; i <= 5; i++) {
     await t.shot();
     if (i < 5) await t.until(() => t.page.evaluate(n => new RegExp('Ball ' + n + ' of 5').test(document.getElementById('challengeBar').textContent), i + 1), `the bar to move to ball ${i + 1}`, 10 * SLOW);
    }
    await t.until(async () => (await t.drawerOpen()) && (await t.drawerTitle()) === 'Challenge', 'the results card', 10 * SLOW);
    const text = await t.page.textContent('#drawerContent');
    if (!/Closest to the pin/.test(text) || !/Chal/.test(text)) throw new Error(`the card reads: ${text.slice(0, 200)}`);
    await t.page.screenshot({path: 'bench/shots/smoke/challenge-results.png'}).catch(() => {});
   });
   await t.step('nothing of it was saved as a round; the play is counted', async () => {
    const slot = await t.page.evaluate(() => localStorage.getItem('fairway-round-v1'));
    if (slot) throw new Error('the challenge wrote the round slot');
    const p = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-profiles-v1')).profiles[0]);
    if (p.rounds?.length) throw new Error(`the challenge put ${p.rounds.length} round(s) in the history`);
    if (!(p.challenges?.closest?.plays >= 1)) throw new Error(`the play was not counted: ${JSON.stringify(p.challenges)}`);
    if (!p.xpChallenge) throw new Error('the day\'s challenge XP was not kept');
   });
   await t.step('Play it again starts ball 1 again', async () => {
    await t.page.click('#challengeAgain');
    await t.until(() => bar(/Ball 1 of 5/), 'ball 1 again', 10 * SLOW);
   });
   await t.step('a putting challenge holes out, on the green, with the putter', async () => {
    await open('putting', 'fourft');
    await t.until(() => bar(/Ball 1 of 10/), 'the four-footers bar', 20 * SLOW);
    const s = await t.page.evaluate(() => window.lab.state().challenge);
    if (s?.id !== 'fourft' || s.putting !== 'holeout') throw new Error(`the putting challenge is not holing out: ${JSON.stringify(s)}`);
    if (await t.page.evaluate(() => document.getElementById('club').value) !== 'putter') throw new Error('not putting from four feet');
    await t.shot();
    await t.until(() => bar(/Ball 2 of 10/), 'the second putt', 15 * SLOW);
   });
   await t.step('a range challenge plays on the range', async () => {
    await open('range', 'dartboard');
    await t.until(() => bar(/Ball 1 of 6/), 'the dartboard bar', 20 * SLOW);
    const s = await t.page.evaluate(() => window.lab.state().challenge);
    if (!s?.range) throw new Error(`the dartboard is not on the range: ${JSON.stringify(s)}`);
    await t.shot();
    await t.until(() => bar(/Ball 2 of 6/), 'the second ball', 15 * SLOW);
    if (await t.page.evaluate(() => localStorage.getItem('fairway-round-v1'))) throw new Error('the range challenge wrote the round slot');
   });
   await t.step('a long drive starts from the menu, on a par 4 or 5', async () => {
    await open('tee', 'long');
    await t.until(() => bar(/Ball 1 of 6/), 'the long-drive bar', 20 * SLOW);
    if (!['4', '5'].includes(await t.page.textContent('#holePar'))) throw new Error('the long drive is not on a par 4 or 5');
    if (await t.page.evaluate(() => window.lab.state().challenge?.range)) throw new Error('the long drive is still on the range');
    await t.shot();
    await t.until(() => bar(/Ball 2 of 6/), 'the second drive', 10 * SLOW);
   });
  },
 },
 // THE CHALLENGE OF THE WEEK (16 October 2026): whichever the date picks, from
 // the card across the top of the Challenges screen. It may be on the range or
 // the course of the week, so this follows the game's own state, not a name.
 {
  name: 'challenge-week',
  what: 'The challenge of the week: its card on the Challenges screen and the menu tile, started on the course of the week or the range, a ball played, nothing saved as a round',
  async prepare(page) {
   await page.addInitScript(() => { try { localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'pcw', profiles: [{id: 'pcw', name: 'Week', created: 1, counters: {}, bests: {}, rounds: [], xp: 0, xpLog: {}}]})); localStorage.removeItem('fairway-round-v1'); } catch {} });
  },
  async run(t) {
   await menuReady(t);
   const bar = re => t.page.evaluate(src => !document.getElementById('challengeBar').hidden && new RegExp(src).test(document.getElementById('challengeBar').textContent), re.source);
   await t.step('the menu tile names this week\'s challenge', async () => {
    const note = await t.page.textContent('#menuChallengesNote');
    if (!/^This week: .+ · 0 of 81 medals$/.test(note)) throw new Error(`the tile reads: ${note}`);
   });
   await t.step('its card is on the Challenges screen, and it starts', async () => {
    await fromMenu(t, 'Challenges');
    await t.page.waitForSelector('[data-chal-week]', {timeout: 10000 * SLOW});
    await t.page.click('[data-chal-week]');
    await t.until(() => t.page.evaluate(() => /This week:/.test(document.querySelector('#drawerContent h3')?.textContent || '')), 'the week\'s details', 10 * SLOW);
    await t.page.click('#challengeGo');
    await t.inPlay(180 * SLOW);
    await t.until(() => bar(/This week/), 'the bar says this week', 20 * SLOW);
    const s = await t.page.evaluate(() => window.lab.state().challenge);
    if (!/^CHAL-[0-9]{4}-[0-9]{2}:[a-z]+/.test(s?.week || '')) throw new Error(`no week's key: ${JSON.stringify(s)}`);
   });
   await t.step('a ball moves the play on, and nothing is saved as a round', async () => {
    const before = await t.page.evaluate(() => window.lab.state().challenge.balls.reduce((a, b) => a + b, 0));
    for (let i = 0; i < 9; i++) {
     await t.shot();
     const now = await t.page.evaluate(() => window.lab.state().challenge.balls.reduce((a, b) => a + b, 0));
     if (now > before) break;
     if (i === 8) throw new Error('nine strokes and no ball finished');
    }
    if (await t.page.evaluate(() => localStorage.getItem('fairway-round-v1'))) throw new Error('the week\'s challenge wrote the round slot');
   });
  },
 },
 // SKINS, A ROUND FORMAT (16 October 2026; it was the fourth challenge). Play
 // offers it under Format with its note; a two-golfer skins round starts, each
 // chip counts skins, and the scorecard names the format and carries the Skins
 // row. Written while the GPU was not to be used; the hole-out banner's skins
 // line is not reached here (two golfers holing out is minutes of putting).
 {
  name: 'skins',
  what: 'Skins: Play offers it as a format with its note, a two-golfer skins round starts, the chips count skins and the scorecard has the Skins row',
  async run(t) {
   await menuReady(t);
   await t.step('Play → Format offers Skins, with its note', async () => {
    await fromMenu(t, 'Play');
    await t.page.waitForSelector('#roundMode', {state: 'attached', timeout: 10000 * SLOW});
    const note = await t.page.evaluate(() => {
     const sel = document.getElementById('roundMode');
     if (![...sel.options].some(o => o.value === 'skins')) return null;
     sel.value = 'skins'; sel.dispatchEvent(new Event('change'));
     return document.getElementById('formatNote').textContent;
    });
    if (note === null) throw new Error('Format has no Skins choice');
    if (!/skin/i.test(note)) throw new Error(`the Skins note reads: ${note}`);
   });
   await t.step('a two-golfer skins round starts', async () => {
    await t.page.evaluate(() => window.lab.course({holes: 9}, {players: [{name: 'Ann', team: 'A', hand: 'RH'}, {name: 'Ben', team: 'A', hand: 'RH'}], mode: 'skins', tee: 'blue'}));
    await t.inPlay(120 * SLOW);
    const mode = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-round-v1') || 'null')?.round?.mode);
    if (mode !== 'skins') throw new Error(`the saved round's format is ${mode}`);
   });
   await t.step('each chip counts skins', async () => {
    const chips = await t.page.evaluate(() => [...document.querySelectorAll('#scoreChips .score-chip small')].map(e => e.textContent));
    if (chips.length !== 2 || !chips.every(c => /0 skins/.test(c))) throw new Error(`the chips read ${JSON.stringify(chips)}`);
   });
   await t.step('a shot, then the scorecard: Skins, the count and the Skins row', async () => {
    await t.shot();
    await t.page.getByRole('button', {name: /Open the scorecard/}).first().click();
    await t.until(() => t.drawerOpen(), 'the scorecard', 5 * SLOW);
    const card = await t.page.evaluate(() => ({text: document.getElementById('drawerContent').textContent, row: !!document.querySelector('#drawerContent .skins-row')}));
    if (!/Skins: Ann 0 · Ben 0/.test(card.text)) throw new Error(`the card's top line is missing: ${card.text.slice(0, 200)}`);
    if (!/· Skins ·/.test(card.text)) throw new Error('the card does not name the format');
    if (!card.row) throw new Error('the card has no Skins row');
    await t.page.screenshot({path: 'bench/shots/smoke/skins-card.png'}).catch(() => {});
    await t.key('Escape');
   });
  },
 },
 {
  name: 'weekly',
  what: 'the course of the week: the tile names the week, the panel says what it is, and the round it starts is eighteen holes that remember their week',
  async run(t) {
   await menuReady(t);
   await t.step('the tile names the week and its landscape', async () => {
    const note = await t.page.textContent('#menuWeeklyNote');
    if (!/^Week [0-9]+ · /.test(note)) throw new Error(`the tile reads "${note}"`);
   });
   await t.step('the panel, then play it', async () => {
    await fromMenu(t, 'Course of the week');
    await t.until(async () => /course generator/.test(await t.page.textContent('#drawerContent')), 'the panel', 10 * SLOW);
    await t.page.click('#weeklyGo');
    await t.inPlay(180 * SLOW);
   });
   await t.step('eighteen holes, and the saved round knows its week', async () => {
    const hole = await t.page.textContent('#holeNumber');
    if (!/\/18/.test(hole)) throw new Error(`the hole counter reads ${hole}`);
    await t.shot();
    const saved = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-round-v1') || 'null'));
    if (!/^WEEK-[0-9]{4}-[0-9]{2}@g[0-9]+$/.test(saved?.round?.weekly || '')) throw new Error(`the saved round's week is ${saved?.round?.weekly}`);
   });
  },
 },
 // LEVELLING UP, PLAYED (15 October 2026). The owner cannot reach most rewards
 // without weeks of play, so this golfer starts five XP short of level 2, which
 // brings the Sky tracer. Before: Sky is shown with a padlock and cannot be put
 // on. Then one hole: the level-up banner names it. After: it goes on and is
 // kept. Every item's level and lock is checked in Node (rewards.test.mjs,
 // profile.test.mjs); this is the one path through the real interface.
 {
  name: 'level-up',
  what: 'a golfer a few XP short of level 2: Sky locked, one hole, the banner names it, and it goes on',
  async prepare(page) {
   await page.addInitScript(() => { try { localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'plu', profiles: [{id: 'plu', name: 'Climber', created: 1, counters: {}, bests: {}, rounds: [], xp: 395, xpLog: {}}]})); } catch {} });
  },
  async run(t) {
   await menuReady(t);
   const stored = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-profiles-v1')).profiles[0]);
   const skyItem = '.look-grid .look-item[title^="Sky"]';
   await t.step('at level 1, Sky has a padlock and cannot be put on', async () => {
    await fromMenu(t, 'My profile');
    await t.until(() => t.drawerOpen(), 'the profile', 10 * SLOW);
    await t.page.click('[data-look-tab="tracer"]');
    await t.page.waitForSelector(skyItem, {timeout: 10000 * SLOW});
    const v = await t.page.evaluate(sel => { const b = document.querySelector(sel); return {locked: b.classList.contains('locked'), lock: !!b.querySelector('.look-lock'), disabled: b.disabled, wear: b.dataset.wear || null}; }, skyItem);
    if (!v.locked || !v.lock || !v.disabled || v.wear) throw new Error(`Sky at level 1 is not locked: ${JSON.stringify(v)}`);
    await t.page.click(skyItem, {force: true}).catch(() => {});
    await t.page.waitForTimeout(300);
    if ((await stored()).worn?.tracer === 'sky') throw new Error('a locked Sky was put on');
    await t.closeDrawer();
   });
   await t.step('one hole: Endless, a drop beside the pin, putt out', async () => {
    await fromMenu(t, 'Endless');
    await t.press('Start an endless run');
    await t.inPlay();
    await t.swing();
    await t.until(() => t.inFlight(), 'the shot to start', 5 * SLOW);
    await t.key('Enter');
    await t.until(async () => !(await t.inFlight()), 'the shot to end', 30 * SLOW);
    await reliefFirst(t);
    await t.tool('simDrop');
    await t.page.click('#dropAtGreen');
    await t.page.click('#confirmDrop');
    await t.until(() => t.page.evaluate(() => document.getElementById('dropBar')?.hidden !== false), 'the drop to be confirmed', 5 * SLOW);
    await t.closeTools();
   });
   await t.step('the level-up banner says level 2 and names Sky', async () => {
    for (let putt = 1; putt <= 6; putt++) {
     await t.putt();
     const banner = await t.page.waitForSelector('#levelUp:not([hidden])', {timeout: 15000 * SLOW}).then(() => true, () => false);
     if (!banner) continue;
     const text = await t.page.textContent('#levelUp');
     await t.page.locator('#levelUp').screenshot({path: 'bench/shots/smoke/level-up.png'}).catch(() => {});
     if (!/Level 2/.test(text) || !/New tracer:\s*Sky/.test(text)) throw new Error(`the banner reads "${text.replace(/\s+/g, ' ').trim()}"`);
     return;
    }
    throw new Error('six putts and no level-up banner');
   });
   await t.step('now Sky goes on, and is kept', async () => {
    await t.until(() => t.page.evaluate(() => document.getElementById('levelUp')?.hidden !== false), 'the banner to go', 15 * SLOW);
    if (await t.drawerOpen()) await t.closeDrawer().catch(() => {});
    await t.page.click('#menuNav');
    await t.page.click('#dropMenu');
    // Leaving a round with a hole played asks whether to keep it.
    if (await t.page.waitForSelector('#leaveNotice:not([hidden])', {timeout: 5000 * SLOW}).then(() => true, () => false)) await t.page.click('#leaveDiscard');
    await t.until(() => t.page.evaluate(() => !document.getElementById('mainMenu').hidden && document.getElementById('generating')?.hidden !== false), 'the main menu', 60 * SLOW);
    await fromMenu(t, 'My profile');
    await t.until(() => t.drawerOpen(), 'the profile', 10 * SLOW);
    await t.page.click('[data-look-tab="tracer"]');
    await t.page.click('[data-wear="tracer:sky"]', {timeout: 10000 * SLOW});
    await t.until(async () => (await stored()).worn?.tracer === 'sky', 'Sky to be saved', 10 * SLOW);
   });
  },
 },
 {
  name: 'look',
  what: 'Your look on My profile: every tab, a frame and a meter skin put on and kept, the skin on the meter in play, the achievements list, and a flourish when the hole is finished',
  async prepare(page) {
   await page.addInitScript(() => { try { localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'plk', profiles: [{id: 'plk', name: 'Looks', created: 1, counters: {}, bests: {}, rounds: [], xp: 78400, xpLog: {}, achievements: {ace: 1}}]})); } catch {} });
  },
  async run(t) {
   await menuReady(t);
   const stored = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-profiles-v1')).profiles[0]);
   await t.step('My profile: the framed picture, the badge, the achievements', async () => {
    await fromMenu(t, 'My profile');
    await t.until(() => t.drawerOpen(), 'the profile', 10 * SLOW);
    const v = await t.page.evaluate(() => ({framed: !!document.querySelector('.profile-id img.ball-avatar.framed'), level: document.querySelector('.profile-level small')?.textContent, ach: document.querySelectorAll('.achievement').length, earned: document.querySelectorAll('.achievement.earned').length}));
    if (!v.framed) throw new Error('no frame on the picture');
    if (!/FAIRWAY MASTER/.test(v.level || '')) throw new Error(`the level reads ${v.level}`);
    if (v.ach !== 13 || v.earned !== 1) throw new Error(`${v.ach} achievements listed, ${v.earned} earned`);
   });
   for (const [tab, wear, key, val] of [['frame', '[data-wear="frame:legend"]', 'frame', 'legend'], ['skin', '[data-wear="skin:neon"]', 'skin', 'neon'], ['ball', '[data-wear="ball:galaxy"]', 'ball', 'galaxy'], ['tracer', '[data-wear="tracer:aurora"]', 'tracer', 'aurora']]) {
    await t.step(`the ${tab} tab: put one on, and it is kept`, async () => {
     await t.page.click(`[data-look-tab="${tab}"]`);
     await t.page.waitForSelector(wear, {timeout: 10000 * SLOW});
     await t.page.locator('.look-grid').first().screenshot({path: `bench/shots/smoke/look-${tab}.png`}).catch(() => {});
     await t.page.click(wear);
     await t.until(async () => (await stored()).worn?.[key] === val, `the ${key} to be saved`, 10 * SLOW);
    });
   }
   // 15 OCTOBER 2026: frames that move, and flourishes you can watch.
   await t.step('an animated frame moves, and the Flourishes tab plays one', async () => {
    await t.page.click('[data-look-tab="frame"]');
    const anim = await t.page.evaluate(() => getComputedStyle(document.querySelector('.look-item img.framed[data-anim="flames"]')).animationName);
    if (!/frame-turn/.test(anim)) throw new Error(`the Flames frame does not move (animation "${anim}")`);
    await t.page.click('[data-look-tab="flourish"]');
    await t.page.click('[data-flourish-preview="fireworks-eagle"]');
    await t.page.waitForTimeout(700);
    const drawn = await t.page.evaluate(() => { const c = document.getElementById('flourishPreview'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) n += d[i] > 0; return n; });
    await t.page.locator('#drawerContent').screenshot({path: 'bench/shots/smoke/look-flourish.png'}).catch(() => {});
    if (drawn < 30) throw new Error(`the flourish preview drew ${drawn} pixels`);
   });
   await t.step('the title list holds the earned achievement title', async () => {
    await t.page.click('[data-look-tab="title"]');
    await t.page.selectOption('#wearTitle', 'ach-ace');
    await t.until(async () => (await stored()).worn?.title === 'ach-ace', 'the title to be saved', 10 * SLOW);
   });
   await t.step('in play, the meter wears the skin', async () => {
    await t.page.click('#closeDrawer');
    await fromMenu(t, 'Endless');
    await t.press('Start an endless run');
    await t.inPlay(120 * SLOW);
    const skin = await t.page.evaluate(() => ({id: document.getElementById('swingMeter').dataset.skin, track: getComputedStyle(document.getElementById('swingMeter')).getPropertyValue('--sm-track')}));
    if (skin.id !== 'neon' || !/#0d0b1f/.test(skin.track)) throw new Error(`the meter wears ${JSON.stringify(skin)}`);
    await t.page.locator('#swingMeter').screenshot({path: 'bench/shots/smoke/meter-neon.png'}).catch(() => {});
   });
   // THE FLOURISH (Phase 6): level 50 has gold confetti on every hole-out, at
   // the least, drawn on the overlay over the cup.
   await t.step('holing out plays a flourish over the cup', async () => {
    await t.shot();
    await reliefFirst(t);
    await t.tool('simDrop');
    await t.page.click('#dropAtGreen');
    await t.page.click('#confirmDrop');
    await t.until(() => t.page.evaluate(() => document.getElementById('dropBar')?.hidden !== false), 'the drop to be confirmed', 5 * SLOW);
    await t.closeTools();
    for (let putt = 1; putt <= 6; putt++) {
     await t.putt();
     if (await t.page.waitForSelector('#flourish:not([hidden])', {timeout: 3000}).then(() => true, () => false)) {
      await t.page.waitForTimeout(700);
      const drawn = await t.page.evaluate(() => { const c = document.getElementById('flourish'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) n += d[i] > 0; return n; });
      await t.page.screenshot({path: 'bench/shots/smoke/flourish.png'}).catch(() => {});
      if (drawn < 50) throw new Error(`the flourish drew ${drawn} pixels (${await t.page.evaluate(() => { const c = document.getElementById('flourish'); return `cup at ${c.dataset.at} on ${c.dataset.size}, ${c.dataset.parts} particles alive`; })})`);
      return;
     }
     if (await t.page.evaluate(() => !document.getElementById('holeOut').hidden)) throw new Error('holed out with no flourish');
    }
    throw new Error('six putts from two yards and the ball never dropped');
   });
  },
 },
 // THE SAME, WITH THE PROGRAM IN THE DOWNLOAD: run_fairway_server, compiled with
 // Bun for this computer (npm run server), instead of the bundle under Node.
 // Inside Bun the WebSocket library runs on Bun's own implementation, so the one
 // thing the bundle passing cannot prove is that a browser and a connector can
 // still talk through it. Skipped until it has been built.
 {
  ...JOURNEY_BRIDGE_BUNDLE,
  name: 'server-program',
  what: 'run_fairway_server, the program in the download: it serves the game, takes a connector, and a shot flies',
  bridge: 'program',
 }
];

// ------------------------------------------------------------------ runner
if (flag('list')) {
 const width = Math.max(...JOURNEYS.map(j => j.name.length)) + 2;
 for (const j of JOURNEYS) console.log(`${j.name.padEnd(width)} ${j.what}`);
 process.exit(0);
}
// `--only boot,range` runs a subset, in the order given. CI runs one: see
// .github/workflows/test.yml for which, and why not all of them.
const wanted = ONLY ? ONLY.split(',').map(n => n.trim()).filter(Boolean) : null;
const unknown = (wanted ?? []).filter(n => !JOURNEYS.some(j => j.name === n));
if (unknown.length) fail(`No journey called ${unknown.map(n => `"${n}"`).join(', ')}. Try --list.`);
const chosen = wanted ? wanted.map(n => JOURNEYS.find(j => j.name === n)) : JOURNEYS;

if (FILE && !fs.existsSync(FILE)) fail(`No file at ${FILE}.`);
if (!FILE) refuseStaleBuild();
const url = pathToFileURL(FILE ? path.resolve(FILE) : DIST).href;
const started = Date.now();
// `npm ci` DOES NOT FETCH THE BROWSER. Playwright 1.63 has no install script,
// so a fresh checkout has the library and no Chromium, and the launch fails
// with a stack trace that buries the one-line fix. Say the fix instead.
const browser = await chromium.launch({headless: !HEADED, args: ARGS}).catch(e => {
 if (/Executable doesn't exist|browserType\.launch/i.test(e.message))
  fail('Playwright is installed but its browser is not. Run this once, then try again:\n\n  npx playwright install chromium\n');
 throw e;
});
const renderer = await (async () => {
 const p = await browser.newPage();
 const r = await p.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return gl ? (d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'WebGL2, renderer withheld') : null;
 });
 await p.close();
 return r;
})();
if (!renderer) fail('This browser has no WebGL2 context, so the game cannot run here at all. That is the harness or the machine, not the game.');
console.log(`Fairway smoke test · ${SOFTWARE ? 'SOFTWARE' : 'GPU'} · ${renderer}\n${url}\n`);

const results = [];
for (const journey of chosen) {
 console.log(`${journey.name} — ${journey.what}`);
 if (journey.gpuOnly && SOFTWARE) { console.log('   skipped: needs a GPU\n'); continue; }
 // FLOWS RUN AT 1920x1080, the commonest desktop size, and a size where the
 // HUD's default layout is known to leave the controls a flow presses
 // uncovered. Layout is a different question with its own journey --
 // `hud-reachable` -- so that a covered button and a dead one are never
 // reported as the same failure.
 // A journey may ask for its own screen -- the phone journeys do, with touch.
 const context = await browser.newContext({viewport: {width: 1920, height: 1080}, ...(journey.context || {})});
 // The cheapest tier, so a slow machine spends its time on the journey rather
 // than on shadows. What is being tested is wiring, not pictures.
 await context.addInitScript(() => {
  try { localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'low', frameCap: 0})); } catch {}
 });
 // A PLAYER WHO HAS ALREADY SAID WHO THEY ARE. With no profile the game opens
 // on the welcome, over the menu every other journey starts from. Only when
 // there is none: init scripts run again on every reload, and a journey that
 // reloads must keep what it has recorded. `fresh` journeys meet the welcome.
 if (!journey.fresh) await context.addInitScript(() => {
  try { if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 2, main: 'psmoke', profiles: [{id: 'psmoke', name: 'Smoke', created: Date.now(), counters: {}, bests: {}, rounds: []}]})); } catch {}
 });
 const page = await context.newPage();
 // EVERY wait scales with the renderer, including the ones not written here.
 // A bare `page.click` uses Playwright's own 30-second limit, and with no GPU
 // its actionability check -- is the element stable across two frames -- can
 // need longer than that on its own while the page is rebuilding a course.
 // The first software run lost two journeys to exactly this, both of them
 // working.
 page.setDefaultTimeout(30000 * SLOW);
 // A journey that wants the HOSTED game gets dist/ from a small local server,
 // the same files Netlify serves. Started per journey and closed after it.
 let server = null, home = url;
 if (journey.serve) {
  const dir = path.dirname(FILE ? path.resolve(FILE) : DIST);
  const TYPES = {'.html': 'text/html; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json'};
  // A PRIVATE host refuses anything without the visitor's login cookie, with
  // a 401 and a password page -- which is what Netlify's password protection
  // does. The cookie is set on the browser below, before the page loads, the
  // way a visitor is logged in after typing the password once.
  const PASS = 'fairway-smoke-login';
  server = createServer((req, res) => {
   if (journey.serve.protect && !(req.headers.cookie || '').includes(`nf_private=${PASS}`)) {
    res.writeHead(401, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('<!doctype html><title>Password required</title><p>This site is private.</p>');
    return;
   }
   const name = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
   const file = path.join(dir, name);
   if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
   res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream'});
   fs.createReadStream(file).pipe(res);
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  home = `http://127.0.0.1:${server.address().port}/`;
  if (journey.serve.protect) await context.addCookies([{name: 'nf_private', value: PASS, url: home}]);
 }
 // A journey that wants THE SHIPPED BRIDGE gets it: the bundled
 // `fairway-bridge.mjs` from the build, started as its own process exactly as
 // a player's start script starts it, on two free ports, serving the game
 // beside it. The page is loaded from it. Stopped after the journey.
 let bridgeProc = null, bridgePorts = null;
 if (journey.bridge) {
  const dir = path.dirname(FILE ? path.resolve(FILE) : DIST);
  const free = () => new Promise(done => { const s = net.createServer().listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => done(port)); }); });
  bridgePorts = {http: await free(), tcp: await free()};
  const env = {...process.env, FAIRWAY_HTTP_PORT: String(bridgePorts.http), FAIRWAY_TCP_PORT: String(bridgePorts.tcp), FAIRWAY_HTTP_HOST: '127.0.0.1'};
  // `program`: this computer's run_fairway_server (tools/build-server.mjs), told
  // where the built game is rather than copied beside it.
  if (journey.bridge === 'program') {
   const host = process.platform === 'win32' ? ['windows', 'run_fairway_server.exe'] : process.platform === 'darwin' ? [process.arch === 'arm64' ? 'macos-apple' : 'macos-intel', 'run_fairway_server'] : ['linux', 'run_fairway_server'];
   const exe = path.join(ROOT, 'release', 'server', ...host);
   if (!fs.existsSync(exe)) { console.log(`   skipped: no ${path.relative(ROOT, exe)} (npm run server)
`); await context.close(); continue; }
   bridgeProc = spawn(exe, [], {cwd: path.dirname(exe), stdio: ['ignore', 'pipe', 'pipe'], env: {...env, FAIRWAY_HTML: path.join(dir, path.basename(FILE ? path.resolve(FILE) : DIST))}});
  } else bridgeProc = spawn(process.execPath, [path.join(dir, 'fairway-bridge.mjs')], {cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env});
  let said = '';
  bridgeProc.stdout.on('data', d => { said += d; });
  bridgeProc.stderr.on('data', d => { said += d; });
  const until = Date.now() + 15000;
  while (!said.includes('Fairway bridge:') && Date.now() < until && bridgeProc.exitCode === null) await new Promise(r => setTimeout(r, 100));
  if (!said.includes('Fairway bridge:')) { bridgeProc.kill(); throw new Error(`the bundled bridge did not start: ${said.trim() || 'no output'}`); }
  home = `http://127.0.0.1:${bridgePorts.http}/`;
 }
 const trip = new Trip(page, journey.name, home);
 trip.bridgePorts = bridgePorts;
 const t0 = Date.now();
 let failure = null;
 try {
  // A journey may set the page up BEFORE it loads. WebSocket routing has to
  // be: Playwright patches the page's WebSocket as the document starts, so a
  // route added after load never sees the game's connection.
  if (journey.prepare) await journey.prepare(page);
  await page.goto(home, {waitUntil: 'load'});
  await journey.run(trip);
 } catch (e) {
  failure = e;
  fs.mkdirSync(SHOTS, {recursive: true});
  const shot = path.join(SHOTS, `${journey.name}.png`);
  await page.screenshot({path: shot}).catch(() => {});
  if (!(e instanceof JourneyFailed)) console.log(`   ✗ ${e.message.split('\n')[0]}`);
  console.log(`   screenshot: ${path.relative(ROOT, shot)}`);
  // THE COURSE IT FAILED ON. Endless and Surprise me grow a different course
  // every run, which is wider coverage over time and useless if a failure on
  // one unlucky seed cannot be found again. So the seed is printed, and the
  // full diagnostic block -- build, mode, hole, machine, errors -- because it
  // is exactly what a player's report would carry, and it cannot be collected
  // afterwards once the page is gone.
  const where = await whereAmI(page);
  if (where.seed || where.course) console.log(`   on: ${where.course ?? '?'} · seed ${where.seed ?? '?'} · hole ${where.hole ?? '?'}`);
  for (const extra of trip.steps.at(-1)?.extra ?? []) console.log(`       also: ${extra}`);
 }
 const seconds = (Date.now() - t0) / 1000;
 results.push({name: journey.name, ok: !failure, seconds});
 console.log(`   ${failure ? 'FAILED' : 'passed'} in ${seconds.toFixed(1)}s\n`);
 await context.close();
 // The local server goes with its journey: nothing is left listening.
 if (server) await new Promise(done => server.close(done));
 if (bridgeProc) { bridgeProc.kill(); await new Promise(done => bridgeProc.exitCode !== null ? done() : bridgeProc.once('exit', done)); }
}
await browser.close();

const failed = results.filter(r => !r.ok);
const total = ((Date.now() - started) / 1000).toFixed(0);
console.log(`${results.length - failed.length} of ${results.length} journeys passed in ${total}s` +
 (failed.length ? ` · FAILED: ${failed.map(r => r.name).join(', ')}` : ''));
process.exit(failed.length ? 1 : 0);
