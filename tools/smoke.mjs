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
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

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
 constructor(page, name) {
  this.page = page; this.name = name;
  this.errors = []; this.requests = []; this.steps = [];
  page.on('pageerror', e => this.errors.push(`uncaught: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') this.errors.push(`console.error: ${m.text()}`); });
  page.on('request', r => {
   const u = r.url();
   if (!/^(file|data|blob):/.test(u)) this.requests.push(u);
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
   await this.page.click('#toolsButton');
   await this.until(() => this.page.evaluate(() => document.getElementById('toolsTray')?.hidden === false), 'the tools tray', 5 * SLOW);
  }
  await this.page.click(`#${id}`);
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

 // A shot, the way a keyboard player takes one: Space to hit, Enter to skip
 // the flight. It checks the shot actually STARTED -- the game refuses a shot
 // silently in several states, and a harness that assumed every Space was a
 // shot would report a round it never played.
 async shot() {
  await this.until(async () => !(await this.inFlight()), 'the previous shot to finish', 30 * SLOW);
  await this.key('Space');
  await this.until(() => this.inFlight(), 'Space to start a shot (the game refused it)', 5 * SLOW);
  await this.key('Enter');
  await this.until(async () => !(await this.inFlight()), 'Enter to finish the shot', 30 * SLOW);
 }
}

// Every journey starts here. The menu is up when the lab is attached and the
// main menu is showing; the backdrop behind it is a real one-hole Endless
// course, which is what makes the Endless journey nearly free to run.
const menuReady = t => t.step('menu ready', () =>
 t.until(() => t.page.evaluate(() => !!window.lab && !document.getElementById('mainMenu')?.hidden), 'the main menu', 60 * SLOW));
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

// ------------------------------------------------------------ the journeys
//
// Each is a thing a player actually does, start to finish, in a fresh page.
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
    await t.press('Start an endless run');
    await t.inPlay();
   });
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
   // Power taps DOWN: it starts at 100% and up has nowhere to go -- the first
   // draft of this tapped up and reported a dead key that was merely at its cap.
   //
   // THE TAP THAT NO FRAME SAW. A synthetic press puts key-down and key-up
   // back to back with no frame between -- exactly the tap a slow machine used
   // to lose, and exactly what this harness's first draft took for a broken
   // control. The game now owes that tap to the next frame.
   for (const [code, readout, what] of [['ArrowLeft', '#aimOutput', 'aim'], ['ArrowDown', '#powerOutput', 'power']]) {
    await t.step(`an instant ${code} tap still moves ${what}`, async () => {
     const before = await t.page.textContent(readout);
     await t.key(code);
     await t.until(async () => (await t.page.textContent(readout)) !== before,
      `a tap of ${code} to register (it read "${before}" and never changed)`, 5 * SLOW);
    });
   }
   await t.step('power with ↑ and ↓', async () => {
    await t.hold('ArrowDown', '#powerOutput');
    await t.hold('ArrowUp', '#powerOutput');
   });
   await t.step('cameras: overview, player, green view, back', async () => {
    for (const id of ['overview', 'playerView', 'greenView', 'playerView']) await t.page.click(`#${id}`);
   });
   await t.step('tee shot', () => t.shot());
   await t.step('drop beside the pin', async () => {
    // The sim drop lives in the tools tray; "Drop at the green" puts the ball
    // two yards from the pin, which makes the putting below deterministic
    // whatever the tee shot did.
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
     await t.shot();
     // The hole reveal holds for three seconds of WALL time, then the card opens.
     const done = await t.page.waitForSelector('#nextHoleScore', {state: 'visible', timeout: 6000}).then(() => true, () => false);
     if (done) return;
    }
    throw new Error('six putts from two yards and the ball never dropped');
   });
   await t.step('the scorecard offers the next hole', async () => {
    const title = await t.drawerTitle();
    if (!title) throw new Error('no panel open after holing out');
   });
   await t.step('next hole grows and loads', () => t.nextHole(() => t.page.click('#nextHoleScore', {timeout: 3000 * SLOW})));
   await t.step('and plays', () => t.shot());
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
    await t.page.click('#scoreNav');
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
    if (!phone) { await check(`${w}x${h}`); continue; }
    // The details toggle exists only on a phone. Folded is the default.
    await t.page.evaluate(() => { if (document.getElementById('world').classList.contains('card-open')) document.getElementById('cardToggle').click(); });
    await check(`${w}x${h} details folded`);
    await t.page.click('#cardToggle');
    await check(`${w}x${h} details open`, OPENED_FLOOR);
    await t.page.click('#cardToggle');
   }
   await t.step('every control reachable, no scrolling, the course visible, at every size', async () => {
    if (problems.length) throw new Error(`layout problems at ${problems.join(', ')}`);
   });
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
   await t.step('the details are folded, and one tap opens and closes them', async () => {
    const visible = () => t.page.evaluate(() => !!document.getElementById('shotResult')?.offsetHeight);
    if (await visible()) throw new Error('the shot numbers show before anything was tapped');
    await tap('#cardToggle');
    await t.until(visible, 'the shot numbers to appear', 5 * SLOW);
    await tap('#cardToggle');
    await t.until(async () => !(await visible()), 'the shot numbers to fold away', 5 * SLOW);
   });
   await t.step('aim by tapping the course', async () => {
    const before = await t.page.textContent('#aimOutput');
    const box = await t.page.locator('#scene').boundingBox();
    // Off to one side of the middle of the screen, which is fairway or rough
    // on any hole -- the point is only that the aim moves.
    await t.page.touchscreen.tap(box.x + box.width * 0.62, box.y + box.height * 0.45);
    await t.until(async () => (await t.page.textContent('#aimOutput')) !== before, 'a tap on the course to move the aim', 5 * SLOW);
   });
   const swing = async () => {
    await t.until(async () => !(await t.inFlight()), 'the previous shot to finish', 30 * SLOW);
    await tap('#swing');
    await t.until(() => t.inFlight(), 'the shot button to start a shot', 5 * SLOW);
    await t.page.locator('#skipFlight').tap({timeout: 10000 * SLOW});
    await t.until(async () => !(await t.inFlight()), 'Skip to finish the shot', 30 * SLOW);
   };
   await t.step('the shot button, then Skip', swing);
   await t.step('drop beside the pin, through the tools', async () => {
    await tap('#toolsButton');
    await t.until(() => t.page.evaluate(() => document.getElementById('toolsTray')?.hidden === false), 'the tools', 5 * SLOW);
    await tap('#simDrop');
    await tap('#dropAtGreen');
    await tap('#confirmDrop');
    await t.until(() => t.page.evaluate(() => document.getElementById('dropBar')?.hidden !== false), 'the drop to be confirmed', 5 * SLOW);
    await t.closeTools();
   });
   await t.step('putt out with the shot button', async () => {
    for (let putt = 1; putt <= 6; putt++) {
     await swing();
     if (await t.page.waitForSelector('#nextHoleScore', {state: 'visible', timeout: 6000}).then(() => true, () => false)) return;
    }
    throw new Error('six putts from two yards and the ball never dropped');
   });
   await t.step('the next hole, from the scorecard', () => t.nextHole(() => t.page.locator('#nextHoleScore').tap({timeout: 3000 * SLOW})));
   await t.step('and plays', swing);
   await t.step('nothing on the play screen is out of reach', async () => {
    const bad = await t.page.evaluate(unreachableControls);
    if (bad.length) throw new Error(`${bad.length} unreachable: ${bad.join('; ')}`);
   });
  },
 })),
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
 const page = await context.newPage();
 // EVERY wait scales with the renderer, including the ones not written here.
 // A bare `page.click` uses Playwright's own 30-second limit, and with no GPU
 // its actionability check -- is the element stable across two frames -- can
 // need longer than that on its own while the page is rebuilding a course.
 // The first software run lost two journeys to exactly this, both of them
 // working.
 page.setDefaultTimeout(30000 * SLOW);
 const trip = new Trip(page, journey.name);
 const t0 = Date.now();
 let failure = null;
 try {
  await page.goto(url, {waitUntil: 'load'});
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
  const where = await page.evaluate(() => {
   const map = document.getElementById('map');
   return {seed: map?.dataset.courseSeed || null, course: document.getElementById('courseTitle')?.textContent?.trim() || null,
    hole: document.getElementById('holeNumber')?.textContent?.trim() || null};
  }).catch(() => ({}));
  if (where.seed || where.course) console.log(`   on: ${where.course ?? '?'} · seed ${where.seed ?? '?'} · hole ${where.hole ?? '?'}`);
  for (const extra of trip.steps.at(-1)?.extra ?? []) console.log(`       also: ${extra}`);
 }
 const seconds = (Date.now() - t0) / 1000;
 results.push({name: journey.name, ok: !failure, seconds});
 console.log(`   ${failure ? 'FAILED' : 'passed'} in ${seconds.toFixed(1)}s\n`);
 await context.close();
}
await browser.close();

const failed = results.filter(r => !r.ok);
const total = ((Date.now() - started) / 1000).toFixed(0);
console.log(`${results.length - failed.length} of ${results.length} journeys passed in ${total}s` +
 (failed.length ? ` · FAILED: ${failed.map(r => r.name).join(', ')}` : ''));
process.exit(failed.length ? 1 : 0);
