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
//   node tools/smoke.mjs --only endless-round --endless-seed HARROW-4021
//                                     an Endless run on a seed of your choosing
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
import os from 'node:os';
import {randomBytes} from 'node:crypto';
import {startRelay} from '../relay/node-relay.mjs';
import {createLink} from '../src/online/link.js';
import {GuestSession} from '../src/online/session.js';
import {readRoomCode} from '../src/online/room-code.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.html');
const SHOTS = path.join(ROOT, 'bench', 'shots', 'smoke');

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const option = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
const SOFTWARE = flag('software');
const HEADED = flag('headed');
const ONLY = option('only');
// `--endless-seed HARROW-4021`: every journey's fresh Endless run takes this
// seed (the game's lab.pinRun), so a run that failed is played again on the
// same holes. Its journeys still press Start an endless run as a player does.
const ENDLESS_SEED = option('endless-seed');
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
  // A WEBSOCKET IS NOT A REQUEST to Playwright, so it is watched apart (online
  // play, 19 November 2026): the bridge and a relay on this machine, or the
  // page's own server, and nothing anywhere else -- no journey reaches the
  // internet.
  page.on('websocket', ws => {
   let host = '';
   try { host = new URL(ws.url()).host; } catch {}
   const name = host.replace(/:\d+$/, '');
   if (name === '127.0.0.1' || name === 'localhost' || (own && host === new URL(own).host)) return;
   this.requests.push(ws.url());
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
  const find = () => this.page.getByRole('button', {name, exact: true}).or(this.page.getByRole('tab', {name, exact: true}))
   .filter({visible: true}).first();
  // A step sheet's main button (Start the run, Play...) is on its last step
  // since round 14: a player not seeing it goes through the steps, so do that.
  if (!await find().count() && await this.page.locator('#drawer .sx-steps .sx-step').filter({visible: true}).count())
   await this.page.locator('#drawer .sx-steps .sx-step').last().click();
  await find().click({timeout: 10000 * SLOW});
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
  const before = await this.read(readout);
  await this.page.keyboard.down(code);
  try {
   await this.until(async () => (await this.read(readout)) !== before, `holding ${code} to move ${readout}`, seconds);
  } finally { await this.page.keyboard.up(code); }
  return {before, after: await this.read(readout)};
 }
 // A reading: an element's text, or, for `@name`, #world's data-name -- the aim's
 // angle (`@aim`) and the aim point's yards (`@aimYards`), which no box shows as
 // a number since the old aim box went (18 October 2026).
 read(readout) {
  if (readout.startsWith('@')) return this.page.evaluate(k => document.getElementById('world').dataset[k] ?? '', readout.slice(1));
  return this.page.textContent(readout);
 }

 // THE TOOLS BUTTON IS A TOGGLE. A second press closes the tray, which the
 // first draft of this found by pressing it twice and then waiting thirty
 // seconds for a Mulligan button that had just been put away. So it is opened
 // only if it is shut, and then the tool is pressed.
 // THE TOP BAR'S CONTROLS, WHEREVER THIS SCREEN KEEPS THEM (17 October 2026).
 // In a round on anything bigger than a phone, the 1.0 round screen has no top
 // bar: Escape opens its controls as the pause list (round-hud.css), and the
 // list closes itself once one of them is pressed -- all but the clock and the
 // tee picker, which are worked in place. Everywhere else the bar is there to
 // click. `chrome` makes them clickable either way.
 async hud1() { return this.page.evaluate(() => getComputedStyle(document.getElementById('world')).getPropertyValue('--hud1').trim() === '1'); }
 async paused() { return this.page.evaluate(() => document.getElementById('app').classList.contains('rh-paused')); }
 async chrome() {
  if (!await this.hud1() || await this.paused()) return;
  await this.page.evaluate(() => document.activeElement?.blur?.());
  await this.page.keyboard.press('Escape');
  await this.until(() => this.paused(), 'the pause list', 5 * SLOW);
 }
 async unpause() { if (await this.paused()) await this.page.click('#pauseResume'); }
 // An entry in the in-round menu: under Menu in the top bar on a phone, in the
 // pause list everywhere else.
 async menuItem(name) {
  await this.chrome();
  if (!await this.page.locator('#menuDrop').isVisible()) await this.page.click('#menuNav');
  await this.page.locator('#menuDrop').getByRole('menuitem', {name}).click();
 }

 // THE SETTINGS WINDOW (21 October 2026): Settings in the pause list, then a tab.
 async settings(tab) {
  if (!await this.page.locator('.popup[data-popup=settings]').isVisible().catch(() => false)) {
   await this.chrome();
   if (!await this.page.locator('#pauseSettings').isVisible()) await this.page.click('#menuNav');
   await this.page.click('#pauseSettings');
   await this.until(() => this.page.locator('.popup[data-popup=settings]').isVisible(), 'the Settings window', 5 * SLOW);
  }
  await this.page.click(`.popup[data-popup=settings] [data-sw="${tab}"]`);
 }

 // Out of the monitor screen opened from the round's Settings window: Esc goes
 // back to the window (22 October 2026), which is then closed too.
 async leaveMonitor() {
  await this.key('Escape');
  const win = this.page.locator('.popup[data-popup=settings]');
  await this.until(async () => !(await this.drawerOpen()), 'the monitor screen to close', 5 * SLOW);
  if (await win.isVisible().catch(() => false)) await this.page.getByRole('button', {name: 'Close Settings', exact: true}).click();
  await this.until(async () => !(await win.isVisible().catch(() => false)), 'the Settings window to close', 5 * SLOW);
 }

 async tool(id) {
  if (await this.page.evaluate(() => document.getElementById('toolsTray')?.hidden !== false)) {
   // T on the round screen (the pause list lost its Tools row, 21 October
   // 2026); the pause list's Tools row on a phone, which keeps it.
   if (await this.hud1()) { await this.unpause(); await this.key('KeyT'); }
   else { await this.chrome(); await this.page.locator('#barTools').click(); }
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
  // A step sheet backs out a step per Escape and closes from its first step
  // (the owner, 22 October 2026), so press until it is gone.
  else for (let i = 0; i < 6 && (await this.panelShowing(title)); i++) await this.key('Escape');
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
  // One Escape per step on a step sheet (see closePanel).
  for (let i = 0; i < 6 && (await this.drawerOpen()); i++) await this.key('Escape');
  await this.until(async () => !(await this.drawerOpen()), 'the panel to close', 5 * SLOW);
 }

 // THE SWING (pull-push-swing, 16 November 2026: the three-tap bar and Space
 // are gone) is a pull and push on the swing pad with the mouse: most of a
 // full pull, straight back up through the line (`strokeOnPad`).
 async swing() {
  await strokeOnPad(this, .8);
 }

 // A shot, the way a PC player takes one: a pull and push with the mouse,
 // Enter to skip the flight. It checks the shot actually STARTED -- the game
 // refuses a shot silently in several states, and a harness that assumed every
 // swing was a shot would report a round it never played.
 // A PUTT, the way a player putts one: pulled to the blue stop and pushed
 // straight. A fixed pull holes a two-yard putt only by luck, which is how
 // `profile` and `bag` passed one run and failed the next (14 October 2026).
 async putt() {
  await this.until(async () => !(await this.inFlight()), 'the previous shot to finish', 30 * SLOW);
  await strokeOnPad(this, await targetPull(this));
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
  await this.until(() => this.inFlight(), 'the pull and push to start a shot (the game refused it)', 5 * SLOW);
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
 return {seed: map?.dataset.courseSeed || null, course: document.getElementById('barCourse')?.textContent?.trim() || null,
  hole: document.getElementById('holeNumber')?.textContent?.trim() || null};
}).catch(() => ({}));
const reliefFirst = async (t, press = sel => t.page.click(sel)) => {
 if (await t.page.evaluate(() => document.getElementById('reliefBar')?.hidden === false)) await press('#reliefTake');
};
// EVERY MODE BUT THE RANGE IS IN PLAY (21 October 2026): Endless, the course of
// the week and Challenges are cards on Play's first step, not menu rows.
// Play's game types (UI/UX pass V2): a journey names the card it takes.
const VIA_PLAY = {'Endless': 'Endless', 'Course of the week': 'Course of the week', 'Surprise me': 'Surprise me', 'Saved course': 'Saved course', 'Friend challenge': 'Friend challenge'};
// The challenges' tabs and cards are on the first step, Challenge: a journey
// that left it for Golfers (a head-to-head refused alone) goes back first.
async function chalClick(t, sel) {
 if (!await t.page.locator(sel).first().isVisible().catch(() => false)) await t.page.locator('#drawer .sx-step[aria-label="Challenge"]').click({timeout: 10000 * SLOW});
 await t.page.click(sel);
}
// A challenge's Start is on its last step, Rules (UI/UX pass V2): go there, then start.
async function challengeGo(t) {
 await t.page.locator('#drawer .sx-step[aria-label="Rules"]').click({timeout: 10000 * SLOW});
 await t.page.click('#challengeGo', {timeout: 10000 * SLOW});
}
async function fromMenu(t, entry, press = 'click') {
 if (!VIA_PLAY[entry]) return t.page.locator('#mainMenu').getByRole('button', {name: entry}).first()[press]();
 await t.page.locator('#mainMenu').getByRole('button', {name: 'Play'}).first()[press]();
 await t.until(() => t.page.locator('#drawer .sx-card').first().isVisible().catch(() => false), 'Play', 10 * SLOW);
 await t.page.locator(`#drawer .sx-card[aria-label^="${VIA_PLAY[entry]}"]`).first()[press]();
}

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
  // A select under a 1.0 drop-down (round 14) is not the control: its field is.
  if (b.classList.contains('dd-native')) continue;
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
  aim: parseFloat(document.getElementById('world').dataset.aim),
  reach: parseFloat(document.getElementById('world').dataset.aimYards),
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
  await pad('Aim right').tap();
  await pad('Aim at the pin').tap();
  now = await aimNow();
  // The aim point now sits on the pin: the angle and the straight-line yards
  // from the ball, worked out from the course itself. (The card's DISTANCE is
  // no yardstick: it is the tee yardage, measured along the hole.)
  const pin = await t.page.evaluate(() => { const s = window.lab.state(); const p = s.pinAt, b = s.ballAt; return p && b ? {aim: Math.atan2(p.x - b.x, p.z - b.z) * 180 / Math.PI, reach: Math.hypot(p.x - b.x, p.z - b.z) / 0.9144} : null; });
  if (!pin) throw new Error('lab.state() has no pin or ball to check the pad against');
  if (Math.abs(now.aim - pin.aim) > 0.06 || Math.abs(now.reach - pin.reach) > 0.06) throw new Error(`the pad aimed at ${now.aim} deg, ${now.reach} yd; the pin is at ${pin.aim.toFixed(1)} deg, ${pin.reach.toFixed(1)} yd`);
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
 await t.step('MAP shows the map, and a tap on it opens the big map', async () => {
  // A phone's map is behind the MAP chip (the owner, 28 October 2026): hidden
  // until it is pressed, shown after.
  if (await t.page.evaluate(() => document.getElementById('map').checkVisibility())) throw new Error('the map shows before MAP is pressed');
  await t.page.locator('#rhMap').tap();
  await t.until(() => t.page.evaluate(() => document.getElementById('map').checkVisibility()), 'the map after MAP', 5 * SLOW);
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
 // The phone's bar (the owner, 28 October 2026): before it a phone could not
 // change the camera at all.
 await t.step('VIEWS steps the camera round, FLY flies by touch and comes back', async () => {
  const mode = () => t.page.evaluate(() => window.lab.view());
  const seen = [];
  for (let i = 0; i < 3; i++) { await t.page.locator('#rhViews').tap(); await t.page.waitForTimeout(400); seen.push(await mode()); }
  if (seen.join() !== 'target,green,player') throw new Error(`VIEWS went ${seen.join(' -> ')}`);
  await t.page.locator('#rhFly').tap();
  await t.until(async () => (await mode()) === 'free', 'free flight after FLY', 5 * SLOW);
  if (!await t.page.evaluate(() => document.querySelector('.fly-pad [data-fly=KeyW]')?.checkVisibility())) throw new Error('no fly pad in free flight');
  const small = await t.page.evaluate(smallTargets, '.fly-pad button');
  if (small.length) throw new Error(`fly pad under 44 px to a finger: ${small.join('; ')}`);
  await t.page.locator('.fly-pad [data-fly=KeyW]').tap();
  await t.page.locator('#rhFly').tap();
  await t.until(async () => (await mode()) === 'player', 'back to the ball after FLY again', 5 * SLOW);
 });
 await t.step('every control a round needs is a thumb wide', async () => {
  const coarse = await t.page.evaluate(() => matchMedia('(pointer:coarse)').matches);
  if (!coarse) throw new Error('the browser is not reporting a touch screen, so the touch sizes never applied');
  const small = await t.page.evaluate(smallTargets, '.topbar button, #shotToggle, #aimPad button, .club-control, #pickSpin, #shotButton, #mapExpand, #rhBar button');
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
// A point of the course itself -- found by asking the page what is under it,
// since the round's cards sit over parts of it -- with `pullPx` of room below.
async function coursePoint(t, pullPx) {
 return t.page.evaluate(room => {
  const scene = document.getElementById('scene');
  for (const fy of [.4, .45, .35, .5, .3, .55, .25, .6]) for (const fx of [.5, .4, .6, .3, .7]) {
   const x = Math.round(innerWidth * fx), y = Math.round(innerHeight * fy);
   if (y + room > innerHeight - 12) continue;
   const el = document.elementFromPoint(x, y);
   if (el && (el === scene || scene.contains(el))) return {x, y};
  }
  return null;
 }, Math.round(pullPx * 1.15) + 20);
}
// THE PULL AND PUSH ON THE SWING PAD (pull-push-swing, 16 November 2026: the
// three-tap bar and Space are gone, and the owner's second try put the swing
// on a pad the Swing button opens). Opens the pad if it is shut (a click, or a
// tap with `touch`), reads its strike line, aim line and full pull from the
// drawing area's `data-` values (main.js `placeSwingPad`), presses just below
// the line, pulls `share` of a full pull, rests, and pushes straight up
// through the line, so the line is perfect and a putt's length exact, then
// `follow` full pulls past it (a little, by default: a Low shot), `bend` full
// pulls out to the side by the finish, from the shape point (right is a draw). The moves are a
// steady pace, so the game's own sample times make the tempo. `push: false`
// stops after the pull; `lift: false` keeps the button down (for Escape to
// cancel); `during` runs mid-pull; `shot` saves a picture.
//
// (Until 16 November 2026 this was `tapOnTarget`, which timed the bar's taps on
// the clock -- "six putts from two yards" on GitHub, 16 October, was a tap
// timed on a frame. A pull has no such clock: the length is the length. Then,
// for a day, `strokeOnCourse`: a drag down on the course itself.)
async function openPad(t, {touch = false} = {}) {
 const shown = () => t.page.evaluate(() => document.getElementById('swingPad')?.hidden === false);
 if (await shown()) return;
 // A ball that has just found water on a random Endless course puts its
 // relief choice over the Swing button, sometimes between a step's own check
 // and this press (19 November 2026, PELICAN-2683-1): relief is taken first,
 // and once more if the press is blocked.
 const relief = () => reliefFirst(t, sel => touch ? t.page.locator(sel).tap() : t.page.click(sel));
 // Short tries, relief taken between them, for as long as a ball can fly: the
 // button is not pressable while one is in the air, and relief can come up at
 // any moment of that wait.
 const press = async () => {
  const go = timeout => touch ? t.page.locator('#shotButton').tap({timeout}) : t.page.click('#shotButton', {timeout});
  const until = Date.now() + 40000 * SLOW;
  for (;;) {
   await relief();
   try { await go(2000 * SLOW); return; } catch (e) { if (Date.now() > until) throw e; }
  }
 };
 await press();
 // A press just as a panel finishes closing can be taken by the panel's last
 // frame (19 November 2026, surprise-round after Help & controls): one more
 // press, as a person would, before calling it a failure.
 const soon = Date.now() + 1500;
 while (Date.now() < soon && !(await shown())) await t.page.waitForTimeout(100);
 if (!(await shown())) await press();
 await t.until(shown, 'the Swing button to open the swing pad', 5 * SLOW);
}
async function padPoint(t) {
 return t.page.evaluate(() => {
  const a = document.getElementById('swingArea'), r = a.getBoundingClientRect();
  return {x: r.left + +a.dataset.x0, y: r.top + +a.dataset.y0, full: +a.dataset.full};
 });
}
async function strokeOnPad(t, share, {touch = false, push = true, lift = true, shot = null, during = null, follow = .12, bend = 0} = {}) {
 await openPad(t, {touch});
 const g = await padPoint(t);
 const pull = Math.max(12, share * g.full), over = Math.max(8, follow * g.full), x = g.x, y = g.y + 6;
 const down = touch ? () => fingers(t, 'touchStart', [[x, y]]) : async () => { await t.page.mouse.move(x, y); await t.page.mouse.down(); };
 const move = touch ? (mx, my) => fingers(t, 'touchMove', [[mx, my]]) : (mx, my) => t.page.mouse.move(mx, my);
 const up = touch ? () => fingers(t, 'touchEnd', []) : () => t.page.mouse.up();
 await down();
 for (let i = 1; i <= 10; i++) { await move(x, y + (g.y + pull - y) * i / 10); await t.page.waitForTimeout(25); }
 await t.page.waitForTimeout(200);
 if (shot) await t.page.screenshot({path: path.join(SHOTS, shot)});
 if (during) await during(g);
 if (push) {
  // From the top, up through the line and on; the bend grows in from the shape point.
  const from = g.y + pull, to = g.y - over, apex = g.y + Math.min(.3 * g.full, pull / 2);
  const steps = Math.max(10, Math.round(10 * (pull + over) / Math.max(1, pull)));
  for (let i = 1; i <= steps; i++) {
   const my = from - (from - to) * i / steps, b = Math.max(0, Math.min(1, (apex - my) / Math.max(1, apex - to)));
   await move(x + bend * g.full * b * b, my); await t.page.waitForTimeout(22);
  }
 }
 if (lift) await up();
}
// The blue stop's share of a full pull (main.js `drawTarget`), or most of a
// pull when there is none.
const targetPull = t => t.page.evaluate(() => +document.getElementById('swingMeter')?.dataset.target || .6);

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
   panel: gone('#shapeControl'),
   // On the Swing Meter the meter stays up through the flight and the
   // floating tiles are gone (14 October 2026); since 16 November it shows
   // what was hit -- the chips and the tempo -- where carry, total and apex
   // were. (On a phone the swing pad has the foot for its first second.)
   meterMode: document.getElementById('world').classList.contains('meter-mode'),
   meterNumbers: !gone('#strokeReport') && /LINE[^]*CARRY[^]*TOTAL/.test(document.getElementById('strokeReport')?.textContent || '') && !/PULL\s*\d/.test(document.getElementById('strokeReport')?.textContent || '') && /TEMPO/.test(document.getElementById('strokeTempo')?.textContent || '') && !/CARRY/.test(document.getElementById('smResult')?.textContent || ''),
   tiles: !gone('#shotTiles .shot-tile'), club: gone('#club'), pad: gone('#aimPad'),
   // The round screen's wind is in the conditions under the hole.
   numbers: gone('#shotPanel'), map: gone('#map'), wind: gone('#rhSubs [data-sub=wind]'),
   // The panel's header, where Skip and the flight's state live; its tiles
   // may be folded away on a phone, the header never is.
   head: document.querySelector('#shotPanel .sp-head')?.textContent || '',
   live: !!document.getElementById('liveShotSpeed'),
   // Round 13 on a big screen: no flight panel; Skip in the meter's title, the
   // launch numbers in a strip above it.
   roundScreen: getComputedStyle(document.getElementById('world')).getPropertyValue('--hud1').trim() === '1' && !document.querySelector('.rh-launch')?.closest('[hidden]') && getComputedStyle(document.querySelector('.rh-tools') || document.body).display !== 'none',
   meterSkip: !gone('#smSkip'),
   // A phone (its bar of Menu, Map, Views, Fly is drawn only there) has no
   // flight panel since the foot was compacted (28 October 2026): the meter
   // carries the flight, and off the meter a lone Skip stands bottom right.
   phone: !gone('#rhBar'),
  };
 });
 const bad = [];
 if (!state.flag) bad.push('the playing area is not marked in-flight');
 if (!state.club) bad.push('the club is still showing');
 if (!state.pad) bad.push('the aim pad is still showing');
 // Since 10 October 2026 the shot controls go at every size: the numbers they
 // used to keep through a flight are in the shot panel, whose line is all that
 // is left of the window (13 October 2026).
 if (!state.panel) bad.push('the shot controls are still showing');
 if (state.numbers && !state.roundScreen && !state.phone) bad.push('the shot panel went, and it carries the flight');
 if (state.roundScreen && !state.numbers) bad.push('the old flight panel is back on the round screen');
 if (state.roundScreen && state.meterMode && !state.meterSkip) bad.push('Skip is not in the meter\'s title');
 if (state.map) bad.push('the map went, and it should follow the ball');
 if (state.wind) bad.push('the wind went');
 if (!state.roundScreen && !state.phone && !/BALL (IN FLIGHT|ROLLING)/.test(state.head)) bad.push(`the shot panel's header reads "${state.head}"`);
 if (state.live) bad.push('an old live readout is back');
 if (state.meterMode && !state.meterNumbers) bad.push('the swing box is not showing what was hit, with carry and total, in flight (and nothing beside its buttons)');
 if (state.meterMode && state.tiles) bad.push('the number tiles show on the Swing Meter');
 if (bad.length) throw new Error(bad.join('; '));
 // Skip is in the meter's number row whenever the Swing Meter is in use, on a
 // phone too (the foot compacted, 28 October 2026); off the meter, a big screen
 // has no button (Enter skips) and a phone keeps the old Skip alone.
 const skipSel = state.meterMode ? '#smSkip' : state.roundScreen ? null : '#skipFlight';
 const skip = skipSel ? await t.page.evaluate(unreachableControls, skipSel) : [];
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
    ['Settings', []],
    ['Help & controls', ['The essentials', 'Explore the course', 'Controller', 'Made to travel', 'The physics', 'Report a problem', 'Open source & credits']],
    ['Driving range', ['The range', 'Golfers']],
    ['Endless', ['Golfers', 'Landscape']],
    // Play remembers the game type chosen last (Endless, just above): these steps are in every one.
    ['Play', ['Golfers', 'Format', 'Rules', 'Game']],
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
   if (ENDLESS_SEED) await t.page.evaluate(s => window.lab.pinRun(s), ENDLESS_SEED);
   await t.step('Endless → Start an endless run', async () => {
    await fromMenu(t, 'Endless');
    await t.pressToPlay('Start an endless run');
   });
   if (ENDLESS_SEED) {
    // The map names the COURSE, an Endless hole's own seed: the run's seed and
    // the hole's number (HARROW-4021-1 on run HARROW-4021). The first replay
    // compared that with the run's seed and failed a correctly pinned run.
    const course = (await whereAmI(t.page)).seed, pinned = course?.slice(0, course.lastIndexOf('-'));
    if (pinned !== ENDLESS_SEED) throw new Error(`asked for Endless seed ${ENDLESS_SEED}, the run is on ${pinned} (course ${course})`);
   }
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
    await t.hold('ArrowLeft', '@aim');
    await t.hold('ArrowRight', '@aim');
   });
   // Up and down move the aim point further and shorter (the power slider went
   // with the Swing Meter, 14 October 2026). Down, so a tee shot near the end
   // of the hole cannot be at the 2000-yard cap.
   //
   // THE TAP THAT NO FRAME SAW. A synthetic press puts key-down and key-up
   // back to back with no frame between -- exactly the tap a slow machine used
   // to lose, and exactly what this harness's first draft took for a broken
   // control. The game now owes that tap to the next frame.
   for (const [code, readout, what] of [['ArrowLeft', '@aim', 'aim'], ['ArrowDown', '@aimYards', 'the aim point']]) {
    await t.step(`an instant ${code} tap still moves ${what}`, async () => {
     const read = () => t.read(readout);
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
   await t.step('the swing box: how to swing, the lie, the blue stop, and the spin ball', async () => {
    if (!await t.page.evaluate(() => !!document.getElementById('swingMeter').offsetParent)) throw new Error('the swing box is not showing');
    if (!/DRAG/i.test(await t.page.textContent('#smHint'))) throw new Error(`the swing box does not say how to swing: "${await t.page.textContent('#smHint')}"`);
    if (!/LIE/.test(await t.page.textContent('#lieReadout'))) throw new Error('the lie readout is empty');
    // Phase 2: the blue stop is worked out (drawn on the pad once a stroke starts).
    await t.until(() => t.page.evaluate(() => +document.getElementById('swingMeter').dataset.target > 0), 'the blue stop to be worked out', 5 * SLOW);
    // THE SPIN BALL (16 November 2026, in place of the Curve, Height and Spin
    // boxes): drag the dot down and right, and it moves and says so; a tap
    // puts it back in the middle.
    const ball = await t.page.locator('#pickSpin').boundingBox();
    if (!ball) throw new Error('the spin ball is not showing');
    const label = () => t.page.getAttribute('#pickSpin', 'aria-label');
    const cx = ball.x + ball.width / 2, cy = ball.y + ball.height / 2;
    await t.page.mouse.move(cx, cy);await t.page.mouse.down();
    for (let i = 1; i <= 6; i++) { await t.page.mouse.move(cx + 6 * i, cy + 8 * i); await t.page.waitForTimeout(15); }
    if (!await t.page.evaluate(() => document.getElementById('spinPad')?.hidden === false)) throw new Error('the big spin ball did not show while dragging');
    // Dragged right: a fade, and the numbers the ball will leave with.
    const read = await t.page.textContent('#spinPadRead');
    if (!/rpm/.test(read) || !/FADE/.test(read)) throw new Error(`the big spin ball reads "${read}" for a dot dragged right`);
    await t.page.mouse.up();
    if (!/backspin/.test(await label()) || !/fade/.test(await label())) throw new Error(`dragging the dot did not change the spin: "${await label()}"`);
    if (!await t.page.evaluate(() => document.getElementById('shapeControl').classList.contains('spun'))) throw new Error('the spin ball does not show it is set');
    await t.page.mouse.click(cx, cy);
    await t.until(async () => /club's own/.test(await label()), 'a tap on the spin ball to centre the dot', 5 * SLOW);
   });
   await t.step('Escape cancels a stroke mid-pull, with no stroke', async () => {
    await strokeOnPad(t, .5, {push: false, lift: false});
    await t.until(() => t.page.evaluate(() => document.getElementById('swingMeter').dataset.stage === 'stroke'), 'a drag down in the swing pad to start a stroke', 5 * SLOW);
    await t.page.keyboard.press('Escape');
    await t.page.mouse.up();
    await t.until(() => t.page.evaluate(() => document.getElementById('swingMeter').dataset.stage === 'ready'), 'Escape to cancel the swing', 5 * SLOW);
    if (await t.inFlight()) throw new Error('a cancelled swing hit the ball');
   });
   await t.step('cameras: overview, player, green view, back', async () => {
    // The keys (the pause list's camera chips went on 21 October 2026): C the
    // overview and back, G the aim point, the green, and back.
    for (const [code, want] of [['KeyC', 'overview'], ['KeyC', 'player'], ['KeyG', 'target'], ['KeyG', 'green'], ['KeyG', 'player']]) {
     await t.key(code);
     await t.until(async () => (await t.page.evaluate(() => window.lab.view())) === want, `${code} to the ${want} camera`, 5 * SLOW);
    }
   });
   await t.step('a ball in the air clears the screen, and it comes back when the ball settles', async () => {
    await t.swing();
    await t.until(() => t.inFlight(), 'the pull and push to start a shot', 5 * SLOW);
    await flightClearsTheScreen(t, false);
    await t.key('Enter');
    await t.until(async () => !(await t.inFlight()), 'Enter to finish the shot', 30 * SLOW);
    await t.until(() => t.page.evaluate(() => !document.getElementById('world').classList.contains('in-flight')), 'the screen to come back', 5 * SLOW);
    // A seed whose tee shot finds water asks for relief first (2 November
    // 2026: a pond beside a Puget Sound fairway); the meter comes back after.
    await reliefFirst(t);
    // The swing box is what comes back, with what was hit (carry, total and
    // apex until 16 November 2026). The swing pad shut a second after the
    // shot (16 November 2026); Swing opens it again, ready for the next stroke
    // and keeping the last one's path.
    if (!await t.page.evaluate(() => !!document.getElementById('swingMeter').offsetParent)) throw new Error('the swing box did not come back');
    await t.until(() => t.page.evaluate(() => document.getElementById('swingPad').hidden), 'the swing pad to shut after the shot', 4 * SLOW);
    await openPad(t);
    if (await t.page.evaluate(() => document.getElementById('swingPad').classList.contains('stroking'))) throw new Error('the swing pad is still mid-stroke after the ball stopped');
    if (!await t.page.evaluate(() => !!document.querySelector('#strokePad .sp-ghost'))) throw new Error('the swing pad did not keep the stroke\'s path');
    if (!/LINE/.test(await t.page.textContent('#strokeReport')) || !/TEMPO/.test(await t.page.textContent('#strokeTempo'))) throw new Error('the swing box lost what was hit');
    // Carry and total came back (the owner, 17 November 2026), written once
    // the ball has landed and stopped.
    const landed = await t.page.textContent('#strokeReport');
    if (!/CARRY\s*\d/.test(landed) || !/TOTAL\s*\d/.test(landed)) throw new Error(`the swing box has no carry and total once the ball stopped: "${landed}"`);
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
     // The hole's par and score name, on every run (26 October 2026): one run
     // failed after an albatross and the passing runs' scores were not kept.
     const named = await t.page.waitForSelector('#holeOut:not([hidden])', {timeout: 2500}).then(() => t.page.evaluate(() => document.getElementById('holeOut').textContent.replace(/\s+/g, ' ').trim().slice(0, 60)), () => '?');
     console.log(`       (${await t.page.evaluate(() => document.getElementById('holePar')?.textContent?.trim() || '?')}: "${named}")`);
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
     // HARROW-4021, replayed (the far-landscape goal): 12 s was too short for
     // an albatross. The card waits for the XP popup and the level-up banner,
     // and 250 XP on the smoke run's fresh profile crosses several levels --
     // each about 2.4 s of filling bar, then a banner of up to 4.2 s -- so the
     // card came at 12-14 s, and the journey failed one replay in three with
     // the card on screen counting down. The game was right; 30 s now.
     const waitFrom = Date.now();
     const done = await t.page.waitForSelector('#nextHoleScore', {state: 'visible', timeout: holed ? 30000 * SLOW : 12000}).then(() => true, () => false);
     if (done) console.log(`       (the card ${((Date.now() - waitFrom) / 1000).toFixed(1)} s after the banner and XP checks)`);
     if (done) {
      if (await t.page.evaluate(() => !document.getElementById('xpGain').hidden)) throw new Error('the scorecard opened over the XP popup');
      return;
     }
     if (holed) throw new Error(`the putt dropped and no scorecard offered the next hole in ${30 * SLOW}s`);
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
      const at = {type: type || 'ShaderMaterial', after: Math.round(performance.now() - window.__shownAt), marks: [...new Set((text.match(/#define (USE_[A-Z_0-9]+|[A-Z_]*INSTANC[A-Z_]*|DOUBLE_SIDED|FLAT_SHADED|ALPHATEST|OPAQUE)/g) || []).map(d => d.slice(8)))].join(' ') + ' | ' + ['farNormals', 'vThin', 'thinLvl', 'windTime', 'treeRoot', 'flex', 'vMistWorld', 'groundPoint', 'mirrorMap', 'aFoot', 'floodlit', 'snow'].filter(n => text.includes(n)).join(',')};
      // The object being drawn (capture build only: `__naming`, below).
      if (window.__drawing) at.who = window.__drawing();
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
   await t.step('Play → Surprise me → Tee off, on Ultra', async () => {
    await fromMenu(t, 'Surprise me');
    await t.press('Tee off on the surprise course');
    await t.inPlay(120 * SLOW);
   });
   await t.step('no lit shader is built during the arrival', async () => {
    // The arrival is about three seconds: the hold, then the descent that
    // brings the camera down to where the grass and the forest floor are.
    await t.page.waitForTimeout(5000);
    const late = await t.page.evaluate(() => window.__lateLit);
    if (late.length) throw new Error(`${late.length} lit shader(s) built after the course appeared: ${late.map(l => `${l.type} at ${l.after} ms${l.marks ? ' [' + l.marks + ']' : ''}`).join(', ')}`);
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
    if (late.length) throw new Error(`${late.length} shader(s) built during the first shot: ${late.map(l => `${l.type} at ${l.after} ms${l.marks ? ' [' + l.marks + ']' : ''}`).join(', ')}`);
    await t.key('Enter');
    await t.until(async () => !(await t.inFlight()), 'the shot to end', 30 * SLOW);
   });
   await t.step('turning a full circle, toward the sun and away, builds no shader of any kind', async () => {
    // From above the first fairway, looking up a little: the sun is in shot
    // for part of the turn whatever the hour and the course's heading.
    // On the capture build (`--file bench/shots/dist-exp/index.html`, which
    // has window.__view), every object's before-draw hook notes the object,
    // so a late program names what it was drawn for -- an override material
    // (the god rays' black mask) holds no program of its own to look up.
    await t.page.evaluate(() => {
     const v = window.__view;
     if (!v) return;
     const proto = Object.getPrototypeOf(Object.getPrototypeOf(v.scene)), was = proto.onBeforeRender;
     let cur = null;
     proto.onBeforeRender = function (...a) { cur = this; return was.apply(this, a); };
     window.__drawing = () => {
      if (!cur) return '(nothing noted)';
      const path = []; for (let q = cur; q && q !== v.scene; q = q.parent) path.push(q.name || q.type);
      const g = cur.geometry?.attributes || {};
      return `${path.join(' < ')} | ${cur.isInstancedMesh ? 'instanced ' + cur.count : cur.type} | ${g.position?.count} verts | attributes ${Object.keys(g).join(',')} | material ${[].concat(cur.material || []).map(m => m.type).join(',')} | in scene ${!!cur.parent} | mask override ${v.scene.overrideMaterial ? v.scene.overrideMaterial.type : 'none'} | userData ${JSON.stringify(cur.userData).slice(0, 80)}`;
     };
    });
    for (let yaw = 0; yaw < 360; yaw += 30) {
     await t.page.evaluate(y => window.lab.camera({hole: 0, along: 60, height: 25, look: y, pitch: 25}), yaw);
     await t.page.waitForTimeout(300);
    }
    const late = await t.page.evaluate(() => window.__lateAny);
    if (late.length) throw new Error(`${late.length} shader(s) built after the course appeared: ${late.map(l => `${l.type} at ${l.after} ms${l.marks ? ' [' + l.marks + ']' : ''}${l.who ? ' -- drawn for ' + l.who : ''}`).join(', ')}`);
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
       if (/^Mesh(Toon|Standard|Physical|Lambert|Phong)Material$/.test(type)) {
        window.__lateLit.push(type);
        (window.__latePrograms = window.__latePrograms || []).push(program);
        // Its switches, so a failure says WHICH variant arrived late (the
        // type alone left ball-light-hole-out unexplained for a day).
        const defs = [...new Set((text.match(/#define [A-Z_][A-Z0-9_]*( [^\n]*)?/g) || []).map(d => d.slice(8)).filter(d => !/^(SHADER_TYPE|SHADER_NAME|STANDARD|PHYSICAL|TOON|PI|RECIPROCAL_PI|EPSILON|LOG2|saturate|whiteComplement|PI2|PI_HALF|LINE_DISTANCE|HIGH_PRECISION|GAMMA_FACTOR|LOW_PRECISION|MEDIUM_PRECISION|varying|texture2D|attribute|gl_FragColor|DITHERING|OPAQUE)/.test(d)))];
        (window.__lateWhy = window.__lateWhy || []).push(type + ': ' + defs.join(', '));
       }
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
   await t.step('Play → Surprise me → Tee off', async () => {
    await fromMenu(t, 'Surprise me');
    await t.press('Tee off on the surprise course');
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
      if (late.length) {
       const why = await t.page.evaluate(() => window.__lateWhy || []);
       // With the capture build (`--file bench/shots/dist-exp/index.html`,
       // window.__view): which meshes in the scene use the late programs.
       const who = await t.page.evaluate(() => {
        const v = window.__view, late = new Set(window.__latePrograms || []), out = [];
        if (!v) return ['(no window.__view: run against the capture build to name the mesh)'];
        v.scene.traverse(o => {
         if (!o.material) return;
         for (const m of [].concat(o.material)) {
          const p = v.renderer.properties.get(m)?.currentProgram;
          if (p && late.has(p.program)) {
           const path = []; for (let q = o; q && q !== v.scene; q = q.parent) path.push(q.name || q.type);
           out.push(`${path.join(' < ')} | ${o.isInstancedMesh ? 'instanced ' + o.count : 'mesh'} | ${o.geometry?.attributes?.position?.count} verts | colour #${m.color?.getHexString?.()} | visible ${o.visible} | userData ${JSON.stringify(o.userData).slice(0, 80)}`);
          }
         }
        });
        return out.length ? out : ['(no mesh holds the late program now)'];
       });
       why.push('--- meshes:', ...who);
       fs.mkdirSync(path.join('bench', 'shots', 'smoke'), {recursive: true});
       fs.writeFileSync(path.join('bench', 'shots', 'smoke', 'late-shaders.txt'), why.join('\n'));
       throw new Error(`${late.length} lit shader(s) built during the hole-out and its flyover: ${late.join(', ')}\n         ${why.join('\n         ')}`);
      }
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
   await t.step('Play → Surprise me → Tee off', async () => {
    await fromMenu(t, 'Surprise me');
    await t.press('Tee off on the surprise course');
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
    await t.settings('time');
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
    await t.closePanel('Settings');
    await t.unpause();
   });
   await t.step('the lamps nearest the shot cast shadows', async () => {
    await t.until(async () => (await casting()) === 3, 'three lamps casting on Ultra', 15 * SLOW);
   });
   const flip = async on => {
    await t.settings('graphics');
    // It lives on the window's "Costs a frame" tab.
    await t.press('Costs a frame');
    const box = t.page.getByRole('checkbox', {name: 'Floodlight shadows'});
    await box.scrollIntoViewIfNeeded();
    await box.setChecked(on);
    // The new programs are built before the switch lands, so it takes a moment.
    await t.until(async () => (await casting()) === (on ? 3 : 0), `floodlight shadows ${on ? 'on' : 'off'}`, 20 * SLOW);
    await t.closePanel('Settings');
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
    await t.chrome();await t.page.getByRole('button', {name: 'Golfers & rules'}).first().click();
    await t.until(() => t.drawerOpen(), 'the group panel', 5 * SLOW);
    // Mid-round the panel is Golfers & rules: the seats and Apply, no steps (21 October 2026).
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
    await t.menuItem('Main menu');
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
    await t.press('Locker'); // the look is the hub's Locker tab (1.0, 17 October 2026)
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
    await t.press('History'); // the round history is the hub's History tab
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
    await t.press('Bag'); // the bag is the hub's Bag tab
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
    await t.chrome();await t.page.getByRole('button', {name: 'Golfers & rules'}).first().click();
    await t.until(() => t.drawerOpen(), 'the group panel', 5 * SLOW);
    // Mid-round the panel is Golfers & rules: the seats and Apply, no steps (21 October 2026).
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
  // THE PULL AND PUSH (branch pull-push-swing, 15-16 November 2026): how a
  // golfer swings, the three-tap bar gone, on the swing pad the Swing button
  // opens. Driven with the mouse, the way a PC player would; the phone
  // journeys swing by touch (`strokeOnPad` with `touch`), and a thumb's feel
  // needs the owner's phone. The controller's stick is not driven here (no
  // pad in the harness).
  name: 'pull-push',
  what: 'the pull-and-push swing on the swing pad with the mouse: a click on the course still aims and a drag on it is not a swing, the Swing button opens the pad clear of the round\'s cards, a lift before the push is no stroke, a lost lift does not leave the pad stuck, a finish out to the right and high strikes a High Draw, the report says what was hit, the path stays, the pad moves and keeps its place, Escape cancels mid-pull',
  async run(t) {
   const stage = () => t.page.evaluate(() => document.getElementById('swingMeter').dataset.stage);
   await menuReady(t);
   await t.step('Endless → Start an endless run', async () => {
    await fromMenu(t, 'Endless');
    await t.pressToPlay('Start an endless run');
   });
   await t.step('a click on the course still aims, and a drag down on it is no swing', async () => {
    const before = await t.read('@aim');
    const p = await coursePoint(t, 140);
    await t.page.mouse.click(p.x + 60, p.y);
    await t.until(async () => (await t.read('@aim')) !== before, 'a click on the course to move the aim', 5 * SLOW);
    if ((await stage()) !== 'ready' || await t.inFlight()) throw new Error('a click on the course started a swing');
    await t.page.mouse.move(p.x, p.y);await t.page.mouse.down();
    for (let i = 1; i <= 8; i++) { await t.page.mouse.move(p.x, p.y + 15 * i); await t.page.waitForTimeout(20); }
    if ((await stage()) !== 'ready') throw new Error('a drag down on the course started a stroke');
    for (let i = 7; i >= -4; i--) { await t.page.mouse.move(p.x, p.y + 15 * i); await t.page.waitForTimeout(20); }
    await t.page.mouse.up();
    if (await t.inFlight()) throw new Error('a drag on the course hit the ball');
   });
   await t.step('the Swing button opens the pad, clear of the round\'s cards; lifting before the push is no stroke', async () => {
    await strokeOnPad(t, .5, {push: false, shot: 'pull-push-pad.png', during: async () => {
     if ((await stage()) !== 'stroke') throw new Error('a drag down in the pad did not start a stroke');
     if (!await t.page.evaluate(() => document.querySelector('#strokePad .sp-aim'))) throw new Error('the pad drew no aim line while pulling');
     // The blue stop's line only when the aim is in reach (the first hole of
     // one run was 251 yd with a 250 yd driver).
     const reach = await t.page.evaluate(() => !!document.getElementById('swingMeter').dataset.target);
     for (const sel of ['.sp-cell.push', '.sp-cell.pull', '.sp-ruler, .sp-rule', ...(reach ? ['.sp-stopline'] : [])]) if (!await t.page.evaluate(s => !!document.querySelector(`#strokePad :is(${s})`), sel)) throw new Error(`the pad drew no ${sel}`);
     // Drawn at the pad's size, not shrunk into a corner.
     const box = await t.page.evaluate(() => { const r = document.getElementById('strokePad').getBoundingClientRect(), a = document.getElementById('swingArea').getBoundingClientRect(); return [r.width, a.width, r.height, a.height]; });
     if (Math.abs(box[0] - box[1]) > 1 || Math.abs(box[2] - box[3]) > 1) throw new Error(`the pad's drawing is ${box[0]}x${box[2]} in a ${box[1]}x${box[3]} pad`);
     // Nothing of the round's may sit over the pad's strike line.
     const over = await t.page.evaluate(() => {
      const line = document.querySelector('#strokePad .sp-strike')?.getBoundingClientRect();
      if (!line) return 'no strike line';
      const top = document.elementFromPoint(line.left + line.width / 2, line.top + line.height / 2);
      return top && !top.closest('#swingPad') ? (top.id || top.className || top.tagName) : null;
     });
     if (over) throw new Error(`the pad's strike line is covered by ${over}`);
    }});
    await t.page.waitForTimeout(300);
    if (await t.inFlight()) throw new Error('a lift before the push hit the ball');
    if ((await stage()) !== 'ready') throw new Error(`the pad stayed mid-stroke after the lift (stage ${await stage()})`);
    if (!/No stroke/.test(await t.page.textContent('#smHint'))) throw new Error('nothing said the lift was no stroke');
   });
   await t.step('a lift the pad never hears about does not leave it stuck', async () => {
    // The owner's pad stayed on the screen after a pull and a lift (16
    // November 2026). Here the window loses focus mid-pull, one of the ways a
    // lift goes missing; the stroke must end, and the next press must work.
    await strokeOnPad(t, .5, {push: false, lift: false});
    if ((await stage()) !== 'stroke') throw new Error('no stroke under way');
    await t.page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await t.until(async () => (await stage()) === 'ready', 'the stroke to end when its lift was lost', 5 * SLOW);
    await t.page.mouse.up();
    if (await t.inFlight()) throw new Error('a lost lift hit the ball');
   });
   await t.step('a pull and push finished out to the right and high is a High Push, and the report says what was hit', async () => {
    // A ball from an earlier step may be in water on a random course, and
    // its relief choice covers the Swing button until taken (19 November
    // 2026, BRAMBLE-6232-1; the same as the step above).
    await reliefFirst(t);
    await strokeOnPad(t, .6, {follow: .6, bend: .36});
    await t.until(() => t.inFlight(), 'the pull and push to start a shot', 5 * SLOW);
    const said = await t.page.textContent('#smHint');
    if (!/strike|Straight|Push|Pull|High/i.test(said)) throw new Error(`the words said "${said}" after the stroke`);
    // The chips over the Spin and Swing buttons, and the tempo in their row.
    const report = await t.page.evaluate(() => { const r = document.getElementById('strokeReport'), tp = document.getElementById('strokeTempo'); return r && !r.hidden && r.offsetParent && tp?.offsetParent && !tp.classList.contains('empty') ? r.textContent + ' ' + tp.textContent : null; });
    if (!report) throw new Error('no report of what was hit');
    if (/PULL\s*\d/.test(report)) throw new Error(`the report still has the PULL distance: "${report}"`);
    for (const want of ['LINE', 'START', 'HEIGHT', 'SPIN', 'CARRY', 'TOTAL', 'TEMPO', 'ideal', 'back']) if (!report.includes(want)) throw new Error(`the report has no ${want}: "${report}"`);
    const last = await t.page.evaluate(() => window.lab.state().lastStroke);
    if (last?.height !== 'high') throw new Error(`a long follow-through was not High: ${JSON.stringify(last)}`);
    if (last?.shape !== 'push') throw new Error(`a finish out to the right was not a Push: ${JSON.stringify(last)}`);
    // The pad shuts a second after the shot (the owner, 16 November 2026);
    // opened again, it still has the path, its finish in the High Push cell.
    await t.until(() => t.page.evaluate(() => document.getElementById('swingPad').hidden), 'the pad to shut after the shot', 4 * SLOW);
    // Endless draws a new course each run: a push can find water, and its
    // relief choice covers the Swing button until it is taken (18 November
    // 2026, MARROWOOD-4146-1). The path is the last stroke's, kept through it.
    await reliefFirst(t);
    await openPad(t);
    if (!await t.page.evaluate(() => !!document.querySelector('#strokePad .sp-ghost') && !!document.querySelector('#strokePad .sp-cell.push.high.lit'))) throw new Error('the pad did not keep the path and its cell');
    await t.page.screenshot({path: path.join(SHOTS, 'pull-push-path.png')});
    await t.key('Enter');
    await t.until(async () => !(await t.inFlight()), 'Enter to finish the shot', 30 * SLOW);
    await reliefFirst(t);
   });
   await t.step('the pad moves by its top bar, keeps its place, and closes', async () => {
    await openPad(t);
    const before = await t.page.locator('#swingPad').boundingBox(), head = await t.page.locator('#swingPadHead').boundingBox();
    const hx = head.x + 30, hy = head.y + head.height / 2;
    await t.page.mouse.move(hx, hy);await t.page.mouse.down();
    for (let i = 1; i <= 8; i++) { await t.page.mouse.move(hx + 15 * i, hy + 5 * i); await t.page.waitForTimeout(15); }
    await t.page.mouse.up();
    const moved = await t.page.locator('#swingPad').boundingBox();
    if (Math.abs(moved.x - (before.x + 120)) > 3 || Math.abs(moved.y - (before.y + 40)) > 3) throw new Error(`the pad did not follow its top bar: ${JSON.stringify(before)} to ${JSON.stringify(moved)}`);
    await t.page.click('#swingPadClose');
    await t.until(() => t.page.evaluate(() => document.getElementById('swingPad').hidden), 'the close button to shut the pad', 5 * SLOW);
    await openPad(t);
    const back = await t.page.locator('#swingPad').boundingBox();
    if (Math.abs(back.x - moved.x) > 1 || Math.abs(back.y - moved.y) > 1) throw new Error('the pad did not come back where it was left');
   });
   await t.step('Escape cancels mid-pull, with no stroke', async () => {
    await strokeOnPad(t, .5, {push: false, lift: false});
    await t.page.keyboard.press('Escape');
    await t.until(async () => (await stage()) === 'ready', 'Escape to cancel the stroke', 5 * SLOW);
    await t.page.mouse.up();
    if (await t.inFlight()) throw new Error('a cancelled stroke hit the ball');
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
    if (await t.page.evaluate(() => window.lab.state().canSwing)) throw new Error('a shot could be taken before relief');
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
   await t.step('Local Rule E-5, chosen in the Rules step, offers the two-stroke drop', async () => {
    await t.chrome();await t.page.getByRole('button', {name: 'Golfers & rules'}).first().click();
    await t.until(() => t.drawerOpen(), 'the round panel', 5 * SLOW);
    // The house rules are on the Golfers & rules screen itself (21 October 2026).
    // Every rule is ON it, not left in the put-away old sections: the order of
    // play and the fairway-tour goal's caddie and computer-golfer settings were
    // drawn and never shown until the owner looked (19 November 2026).
    const hidden = await t.page.evaluate(() => ['roundOB', 'roundOrder', 'roundCaddie', 'roundCpuWatch', 'roundCpuChat'].filter(id => { const el = document.getElementById(id); return !el || !!el.closest('.sx-emptied') || !el.closest('.lb-pick'); }));
    if (hidden.length) throw new Error(`not on the Golfers & rules screen: ${hidden.join(', ')}`);
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
    await t.menuItem('Main menu');
    await t.until(() => t.page.evaluate(() => document.getElementById('leaveNotice')?.hidden === false), 'the leave question', 10 * SLOW);
    await t.page.click('#leaveDiscard');
    await t.until(() => t.page.evaluate(() => !document.getElementById('mainMenu').hidden && document.getElementById('app').dataset.mode === 'menu'), 'the main menu', 60 * SLOW);
    await fromMenu(t, 'My profile');
    await t.until(() => t.drawerOpen(), 'the profile', 5 * SLOW);
    await t.press('History'); // the backup is on the hub's History tab
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
  what: 'Play → Surprise me → Tee off builds a nine-hole course, and every in-round tool opens',
  async run(t) {
   await menuReady(t);
   // The button that died once already, along with "Start fresh round" and
   // the course picker, while the panel looked completely normal.
   await t.step('Play → Surprise me → Tee off', async () => {
    await fromMenu(t, 'Surprise me');
    await t.press('Tee off on the surprise course');
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
   // Help opens as "Keys & help" (round 14, frame c-help).
   for (const [entry, title] of [['Settings', 'Settings'], ['Help & controls', 'Keys & help']]) {
    await t.step(`menu → ${entry}`, async () => {
     await t.menuItem(entry);
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
  name: 'range-greens',
  what: 'the range: its controls reopen from the tool column, a ball finishes on the 100 target green, the putt and chip stations play on the short-game green, a slope regrows it, and the session exports as CSV and PDF',
  async run(t) {
   await menuReady(t);
   const range = () => t.page.evaluate(() => window.lab.state().range);
   await t.step('Driving range → Open the driving range', async () => {
    await fromMenu(t, 'Driving range');
    await t.press('Open the driving range');
    await t.inPlay(120 * SLOW);
    // They no longer open by themselves (21 October 2026): R opens them.
    await t.key('KeyR');
    await t.until(async () => !!(await t.panelShowing('Range controls')), 'the range controls, from R', 5 * SLOW);
   });
   // The owner's report (16 October 2026): once closed, there was no way back.
   await t.step('closed, the range controls come back from the tool column', async () => {
    await t.closePanel('Range controls');
    await t.page.click('#rhTools [data-hud=range]');
    await t.until(async () => !!(await t.panelShowing('Range controls')), 'the range controls from the tool column', 5 * SLOW);
   });
   await t.step('a ball at the 100 target lands on a green', async () => {
    // Its number from the centre mat, turned 19 degrees left (range.js). A
    // wedge's numbers, a little harder each try until one finishes on it: the
    // point is what the ground does with the ball, not the launch numbers.
    let r = null;
    const tries = [];
    for (const speed of [79, 81, 77, 83, 75]) {
     const before = (await range())?.shots ?? 0;
     await t.page.evaluate(v => window.lab.strike({speed: v, vla: 27, hla: -19.1, spin: 8500, axis: 0}), speed);
     await t.until(async () => (await range())?.shots === before + 1 && !(await t.inFlight()), 'the shot at the 100 target', 30 * SLOW);
     r = await range();
     tries.push(`${speed} mph: ${r.last.on}`);
     if (r.last.on === 'green') break;
    }
    if (r.last.on !== 'green') throw new Error(`no ball finished on the 100 target's green: ${tries.join(', ')}`);
    if (r.ball !== 'tee') throw new Error(`the next ball is not on the mat: ${JSON.stringify(r)}`);
   });
   await t.step('Putt: on the short-game green, with the putter', async () => {
    await t.page.click('[data-station="putt"]');
    await t.until(async () => (await range())?.ball === 'green', 'the ball on the short-game green', 5 * SLOW);
    const r = await range();
    if (r.active !== 'short') throw new Error(`putting to ${r.active}, not the short-game green`);
    await t.shot();
    const after = await range();
    if (after.last.from !== 'putt' || after.last.green !== 'Short-game green') throw new Error(`the putt was recorded as ${JSON.stringify(after.last)}`);
   });
   await t.step('Chip: from off the green, with a wedge', async () => {
    await t.page.click('[data-station="chip"]');
    await t.until(async () => !['green', 'tee'].includes((await range())?.ball), 'the ball off the green', 5 * SLOW);
    if (await t.page.evaluate(() => document.getElementById('club').value) === 'putter') throw new Error('a chip was set up with the putter');
    await t.shot();
    if ((await range()).last.from !== 'chip') throw new Error('the chip was not recorded as one');
   });
   await t.step('a slope on the short-game green regrows it, and it can be read', async () => {
    await t.page.selectOption('#rangeShortSlope', 'ltr');
    await t.until(() => t.page.evaluate(() => document.getElementById('generating')?.hidden !== false && !!document.getElementById('rangeShortTilt')), 'the green regrown', 30 * SLOW);
    await t.page.click('[data-station="putt"]');
    await t.until(async () => (await range())?.ball === 'green', 'the ball back on the green', 5 * SLOW);
    if (await t.page.evaluate(() => document.getElementById('readSlope').disabled)) throw new Error('a sloped range green cannot be read');
   });
   await t.step('the session exports as CSV and as a PDF report', async () => {
    const fsp = await import('node:fs/promises');
    const [csv] = await Promise.all([t.page.waitForEvent('download'), t.page.click('#rangeCsv')]);
    const text = await fsp.readFile(await csv.path(), 'utf8');
    if (!text.startsWith('"Shot","Golfer","Club"') || text.trim().split('\r\n').length < 3) throw new Error(`the CSV is not the session: ${text.slice(0, 200)}`);
    const [pdf] = await Promise.all([t.page.waitForEvent('download'), t.page.click('#rangePdf')]);
    const bytes = await fsp.readFile(await pdf.path());
    if (bytes.subarray(0, 8).toString('latin1') !== '%PDF-1.4' || bytes.length < 2000) throw new Error(`the report is not a PDF (${bytes.length} bytes)`);
    if (!pdf.suggestedFilename().endsWith('.pdf')) throw new Error(`the report is named ${pdf.suggestedFilename()}`);
   });
   await t.step('back to the mats, and a shot', async () => {
    await t.page.click('[data-station="mats"]');
    await t.until(async () => (await range())?.ball === 'tee', 'the ball on the mat', 5 * SLOW);
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
    await t.page.locator('#mainMenu').getByRole('button', {name: 'Settings', exact: true}).click();
    await t.until(() => t.drawerOpen(), 'the settings screen', 5 * SLOW);
    await t.page.locator('#drawer .st-cat', {hasText: 'SOUND'}).click();
    await t.until(async () => !!(await t.panelShowing('Sound')), 'the sound settings', 5 * SLOW);
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
   // The studio's settings, desktop to phone (round 13): the whole-screen
   // sheet, the same as from the menu, with its own Back and Grow this
   // landscape, the studio bar stepped aside. Until round 13 the settings left
   // a strip for the bar and this checked the bar cleared them (PROJECT_HANDOFF
   // *THE STUDIO BAR RIDES ABOVE*).
   await t.step('the studio settings are the sheet, desktop to phone', async () => {
    const was = t.page.viewportSize();
    await t.page.click('#studioSettings');
    await t.until(() => t.drawerOpen(), 'the settings panel', 5 * SLOW);
    const problems = [];
    for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 720], [844, 390], [390, 844]]) {
     await t.page.setViewportSize({width: w, height: h});
     await t.page.waitForTimeout(600 * SLOW);
     const sheet = await t.page.evaluate(() => ({bar: getComputedStyle(document.getElementById('studioBar')).display,
      grow: !!document.getElementById('growStudio')}));
     const bad = await t.page.evaluate(unreachableControls, '#growStudio, #closeDrawer');
     const notes = [...(sheet.bar !== 'none' ? ['the studio bar shows over the settings sheet'] : []),
      ...(!sheet.grow ? ['the sheet has no Grow this landscape'] : []),
      ...(bad.length ? [`${bad.length} unreachable -- ${bad.join('; ')}`] : [])];
     console.log(`     ${`${w}x${h}`.padEnd(10)} ${notes.length ? notes.join('; ') : 'fine'}`);
     if (notes.length) problems.push(`${w}x${h}`);
    }
    if (was) await t.page.setViewportSize(was);
    await t.closeDrawer();
    // And back down to the foot of the course once the panel goes.
    await t.until(() => t.page.evaluate(() => document.getElementById('studioBar').style.getPropertyValue('--panel-lift') === '0px'),
     'the studio bar to come back down', 2 * SLOW);
    if (problems.length) throw new Error(`the studio settings are not the sheet at ${problems.join(', ')}`);
   });
   let name = '';
   await t.step('save it', async () => {
    await t.page.click('#studioSave');
    // Save course asks for the name in a box over the landscape (20 October
    // 2026; it used to open Saved courses), filled in already, so a player
    // can accept it with one press.
    await t.until(() => t.page.locator('#leaveNotice').isVisible(), 'the name box', 5 * SLOW);
    name = await t.page.inputValue('#leaveName');
    if (!name.trim()) throw new Error('the name box was not pre-filled');
    if (await t.page.locator('#leaveDiscard').isVisible()) throw new Error('the name box offers to leave without saving');
    await t.page.click('#leaveSave');
    await t.until(async () => !await t.page.locator('#leaveNotice').isVisible(), 'the name box to close', 5 * SLOW);
   });
   await t.step('leave the studio', async () => {
    // Saved, so leaving asks nothing.
    await t.page.click('#studioExit');
    await t.until(async () => (await t.mode()) === 'menu', 'the menu', 10 * SLOW);
   });
   await t.step('it is in Saved courses', async () => {
    // Checked the way a player would check it -- is it in Saved courses, by
    // the name it was given -- rather than by reading storage. The first draft
    // read localStorage, got the format wrong, and failed a save that worked.
    await fromMenu(t, 'Saved courses');
    await t.until(() => t.drawerOpen(), 'Saved courses', 5 * SLOW);
    await t.until(() => t.page.locator('#drawerContent').getByText(name, {exact: true}).first().isVisible().catch(() => false),
     `"${name}" to be listed in Your courses`, 5 * SLOW);
    await t.closeDrawer();
   });
  },
 },

 // THE MAP OF THE LANDSCAPES (the US landscapes goal, 2 November 2026;
 // ui-map.js): Course studio's landscapes have the map over them and a globe
 // on every picture; a region pressed on the map picks its landscape (every
 // landscape is on the map since 5 November 2026).
 {
  name: 'landscape-map',
  what: 'Course studio: the map of the landscapes picks one, every picture carries its globe',
  async run(t) {
   await menuReady(t);
   const {BIOME_KEYS} = await import('../src/settings-schema.js');
   await t.step('Course studio → the map over the landscapes, a globe on every picture', async () => {
    await fromMenu(t, 'Course studio');
    await t.until(() => t.page.evaluate(() => !!document.querySelector('#drawer .lmap-svg')), 'the map', 10 * SLOW);
    const v = await t.page.evaluate(() => ({live: new Set([...document.querySelectorAll('#drawer .lmap-land.live')].map(p => p.dataset.land)).size,
     coming: document.querySelectorAll('#drawer .lmap-land.coming').length, globes: document.querySelectorAll('#drawer .sd-pic .globe-corner svg').length}));
    console.log(`       ${v.live} landscapes to pick on the map, ${v.coming} shapes coming, ${v.globes} globes`);
    // Every landscape is on the map since Scottish Links left (5 November 2026).
    if (v.live !== BIOME_KEYS.length) throw new Error(`${v.live} landscapes on the map, not ${BIOME_KEYS.length}`);
    if (v.globes !== BIOME_KEYS.length) throw new Error(`${v.globes} globes for ${BIOME_KEYS.length} landscapes`);
   });
   // Pressed where the region is on top, as a player would: the middle of a
   // region's box can be another region (Desert Mountain spans several states
   // round a hollow, 8 November 2026), and a click there never reaches it.
   const pressLand = async key => {
    const at = await t.page.evaluate(k => {
     for (const p of document.querySelectorAll('#drawer .lmap-land.live[data-land="' + k + '"]')) {
      const r = p.getBoundingClientRect();
      for (let j = 1; j < 80; j++) for (let i = 1; i < 80; i++) {
       const x = r.left + r.width * i / 80, y = r.top + r.height * j / 80;
       if (document.elementFromPoint(x, y)?.closest('.lmap-land')?.dataset.land === k) return {x, y};
      }
     }
     return null;
    }, key);
    if (!at) throw new Error(key + ' has no point on the map a press reaches');
    await t.page.mouse.click(at.x, at.y);
   };
   await t.step('a region pressed on the map picks its landscape', async () => {
    await pressLand('dmountain');
    await t.until(() => t.page.evaluate(() => document.querySelector('#drawer [data-biome="dmountain"]')?.classList.contains('active')), 'Desert Mountain chosen', 3 * SLOW);
    await pressLand('seaside');
    await t.until(() => t.page.evaluate(() => document.querySelector('#drawer [data-biome="seaside"]')?.classList.contains('active')), 'Seaside Links chosen', 3 * SLOW);
   });
   await t.step('a landscape picture pressed moves the map with it', async () => {
    await t.page.click('#drawer [data-biome="flpalms"]');
    await t.until(() => t.page.evaluate(() => document.querySelector('#drawer .lmap-land.on')?.dataset.land === 'flpalms'), 'Florida Palms lit on the map', 3 * SLOW);
    // Pictures to look at: the sheet on a desktop and on a phone.
    await t.page.waitForTimeout(1500 * SLOW);
    await t.page.screenshot({path: 'bench/shots/smoke/landscape-map.png'}).catch(() => {});
    const was = t.page.viewportSize();
    await t.page.setViewportSize({width: 390, height: 844});
    await t.page.waitForTimeout(800 * SLOW);
    await t.page.screenshot({path: 'bench/shots/smoke/landscape-map-phone.png'}).catch(() => {});
    if (was) await t.page.setViewportSize(was);
   });
  },
 },
 // EVERY LANDSCAPE GROWS (the US landscapes goal): each one a player can pick,
 // grown once in Course studio, with no error -- the cheapest proof a
 // landscape's record, models and pictures are all there in the built game.
 {
  name: 'every-landscape',
  what: 'Course studio grows every landscape once',
  async run(t) {
   await menuReady(t);
   const {BIOME_KEYS} = await import('../src/settings-schema.js');
   const {BIOMES} = await import('../src/biomes.js');
   for (const [i, key] of BIOME_KEYS.entries()) {
    const name = BIOMES[key].name.toUpperCase();
    await t.step(`grow ${key}`, async () => {
     if (i === 0) await fromMenu(t, 'Course studio');
     else { await t.page.click('#studioSettings'); await t.until(() => t.drawerOpen(), 'the settings panel', 5 * SLOW); }
     await t.page.click(`#drawer [data-biome="${key}"]`);
     await t.press('Grow this landscape');
     // Grown when the studio's slab names it, nothing is growing and no
     // change waits to be grown.
     await t.until(() => t.page.evaluate(n => document.getElementById('world')?.dataset.mode === 'studio'
      && document.getElementById('generating')?.hidden !== false && document.getElementById('studioChip')?.hidden !== false
      && (document.querySelector('#studioSlab small')?.textContent || '').startsWith(n), name), `${key} grown`, 120 * SLOW);
    });
   }
  },
 },
 // A HOLE PLAYED THROUGH AMONG THE COURSE'S PIECES: a saved generated course
 // -- its clubhouse, cart paths, walls, markings and animals, which every
 // generated course has since Architect was removed (2 November 2026) --
 // played from Saved courses to the hole-out, with no error. (It was
 // `architect-round`, an Architect course, until then.)
 {
  name: 'course-pieces-round',
  what: 'A saved generated course, hole 1 played through to the hole-out',
  async run(t) {
   await menuReady(t);
   const {generatorFor, SCHEMA_VERSION} = await import('../src/settings-schema.js');
   // A current landscape: an old key (heartland, before 8 November 2026) stamped with
   // today's schema skips the migration that would carry it, and the store drops it.
   const settings = {biome: 'parkland', holes: 9, seed: 'HT-2'};
   await t.step('the course in Saved courses, played', async () => {
    await t.page.evaluate(([s, g, v]) => {
     const key = 'fairway-courses-v1', d = JSON.parse(localStorage.getItem(key) || '{"version":1,"courses":[]}');
     d.courses = (d.courses || []).filter(c => c.id !== 'smoke-pieces');
     d.courses.unshift({id: 'smoke-pieces', name: 'Smoke Pieces', created: 1, generator: g, schema: v, settings: s});
     localStorage.setItem(key, JSON.stringify(d));
    }, [settings, generatorFor(settings), SCHEMA_VERSION]);
    await fromMenu(t, 'Saved courses');
    await t.until(() => t.drawerOpen(), 'Saved courses', 5 * SLOW);
    await t.page.click('[data-play="smoke-pieces"]');
    await t.inPlay(150 * SLOW);
   });
   await t.step('hole 1 played and holed out', async () => {
    // Two full shots down the hole, then a drop by the pin of the
    // green and putts until it drops.
    for (let shot = 0; shot < 2; shot++) {
     await t.swing();
     await t.until(() => t.inFlight(), 'the shot to start', 5 * SLOW);
     await t.key('Enter');
     await t.until(async () => !(await t.inFlight()), 'the shot to end', 30 * SLOW);
     await reliefFirst(t);
    }
    await t.tool('simDrop');
    await t.page.click('#dropAtGreen');
    await t.page.click('#confirmDrop');
    await t.until(() => t.page.evaluate(() => document.getElementById('dropBar')?.hidden !== false), 'the drop to be confirmed', 5 * SLOW);
    await t.closeTools();
    for (let putt = 1; putt <= 8; putt++) {
     await t.putt();
     if (await t.page.waitForSelector('#nextHoleScore', {state: 'visible', timeout: 14000}).then(() => true, () => false)) return;
    }
    throw new Error('eight putts on the green and the ball never dropped');
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
    await t.settings('graphics');
    await t.page.$eval('#gfxTextSize', el => { el.value = 200; el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); });
    await t.until(async () => Math.abs((await zoom()) - 2) < .01, 'the interface at 200%', 5 * SLOW);
    await t.closePanel('Settings');
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
   // The owner's iPhone, 16 November 2026: the menu scrolled 11 px sideways,
   // its column sized by the week's challenge line (PROJECT_HANDOFF *The main
   // menu's one column is the screen's width*).
   await t.step('the main menu fits the screen\'s width', async () => {
    const wide = await t.page.evaluate(() => {
     const m = document.getElementById('mainMenu'), W = document.documentElement.clientWidth;
     return [...m.querySelectorAll('*')].filter(el => { const b = el.getBoundingClientRect(); return b.width && b.right > W + 1; })
      .slice(0, 5).map(el => `${el.className} to ${Math.round(el.getBoundingClientRect().right)} of ${W}`).concat(m.scrollWidth > m.clientWidth + 1 ? [`the menu scrolls ${m.scrollWidth - m.clientWidth} px sideways`] : []);
    });
    if (wide.length) throw new Error(`the menu is wider than the screen: ${wide.join('; ')}`);
   });
   await t.step('Endless → Start an endless run', async () => {
    await fromMenu(t, 'Endless', 'tap');
    // Endless is a kind of round in Play (21 October 2026): it starts from the last step, Rules.
    await t.page.locator('#drawer .sx-steps .sx-step').last().tap();
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
    const before = await t.read('@aim');
    const box = await t.page.locator('#scene').boundingBox();
    // Off to one side of the middle of the screen, which is fairway or rough
    // on any hole -- the point is only that the aim moves.
    await t.page.touchscreen.tap(box.x + box.width * 0.62, box.y + box.height * 0.45);
    await t.until(async () => (await t.read('@aim')) !== before, 'a tap on the course to move the aim', 5 * SLOW);
   });
   await touchAiming(t);
   let checkedFlight = false;
   const swing = async () => {
    await t.until(async () => !(await t.inFlight()), 'the previous shot to finish', 30 * SLOW);
    // A finger swings by the pull and push on the swing pad (pull-push-swing);
    // the first one leaves a picture of the pad mid-pull and of the report after.
    await strokeOnPad(t, .8, {touch: true, ...(checkedFlight ? {} : {shot: `phone-${way}-pad.png`})});
    await t.until(() => t.inFlight(), 'a pull and push on the swing pad to start a shot', 5 * SLOW);
    // While the pad shows, the foot of the screen is its alone (the owner, 16
    // November 2026); it shuts a second after the shot and the rest comes back.
    if (!checkedFlight) {
     const foot = await t.page.evaluate(() => ({padUp: document.getElementById('world').classList.contains('pad-up'), pad: !document.getElementById('swingPad').hidden, meter: !!document.getElementById('swingMeter').offsetParent, club: !!document.querySelector('.club-control')?.offsetParent, gap: Math.round(innerHeight - document.getElementById('swingPad').getBoundingClientRect().bottom)}));
     if (foot.pad && (!foot.padUp || foot.meter || foot.club)) throw new Error(`the swing pad is up but the foot of the screen was not cleared: ${JSON.stringify(foot)}`);
     if (foot.pad && foot.gap > 40) throw new Error(`the swing pad did not open at the foot of the screen: ${JSON.stringify(foot)}`);
     await t.until(() => t.page.evaluate(() => document.getElementById('swingPad').hidden && !document.getElementById('world').classList.contains('pad-up')), 'the swing pad to shut after the shot', 4 * SLOW);
     await t.page.screenshot({path: path.join(SHOTS, `phone-${way}-report.png`)});
    }
    if (!checkedFlight) { checkedFlight = true; await flightClearsTheScreen(t, true); }
    await t.page.locator('#smSkip:visible, #skipFlight:visible').first().tap({timeout: 10000 * SLOW});
    await t.until(async () => !(await t.inFlight()), 'Skip to finish the shot', 30 * SLOW);
    // The screen comes back a frame after the ball settles, and fades in.
    await t.until(() => t.page.evaluate(() => !document.getElementById('world').classList.contains('in-flight')), 'the screen to come back after the shot', 5 * SLOW);
    await t.page.waitForTimeout(300);
   };
   await t.step('the shot button, then Skip', swing);
   await t.step('drop beside the pin, through the tools', async () => {
    await reliefFirst(t, tap);
    await t.chrome(); await tap('#barTools');
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
     await strokeOnPad(t, await targetPull(t), {touch: true});
     await t.until(() => t.inFlight(), 'the putt to start', 5 * SLOW);
     await t.page.locator('#smSkip:visible, #skipFlight:visible').first().tap({timeout: 10000 * SLOW}).catch(() => {});
     await t.until(async () => !(await t.inFlight()), 'the putt to finish', 30 * SLOW);
     // Holed or not from the game (`holed`); the card waits for the XP popup
     // (14 October 2026), so give it time.
     const holed = await t.holed();
     if (holed === false) continue;
     // 30 s once holed, as the endless round's (an albatross's level-ups).
     if (await t.page.waitForSelector('#nextHoleScore', {state: 'visible', timeout: holed ? 30000 * SLOW : 12000}).then(() => true, () => false)) return;
     if (holed) throw new Error(`the putt dropped and no scorecard offered the next hole in ${30 * SLOW}s`);
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
    // Settings → Launch monitor (the pause list's Connect monitor row went, 21 October 2026).
    await t.settings('monitor');
    await t.press('Connect bridge');
    await t.until(() => shown('#monState'), 'the monitor strip on the shot controls', 5 * SLOW);
    await t.page.getByLabel(/Arm monitor/).check();
    await t.leaveMonitor();
    await t.until(async () => (await title()) === 'Ready', 'the panel to say Ready', 5 * SLOW);
   });
   await t.step('armed: the shot controls go and the launch monitor window takes their place', async () => {
    for (const sel of ['.bottom-area', '#swingMeter', '#shapeControl', '.meter-button', '#monState'])
     if (await shown(sel)) throw new Error(`${sel} still shows with the monitor armed`);
    for (const sel of ['#monitorPanel', '#monArm', '#club', '#lieReadout'])
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
    // A ball in the water waits for its relief before anything else comes back.
    await reliefFirst(t);
    await t.until(() => shown('#swingMeter'), 'the Swing Meter to come back', 5 * SLOW);
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
    await t.chrome();await t.page.getByRole('button', {name: 'Golfers & rules'}).first().click();
    await t.until(() => t.drawerOpen(), 'the group panel', 5 * SLOW);
    // Mid-round the panel is Golfers & rules: the seats and Apply, no steps (21 October 2026).
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
    await t.press('Golfers'); // the Endless steps (round 13)
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
    if (!/swing pad/.test(text)) throw new Error(`the strip says "${text}"`);
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
    // An earlier shot that found water leaves its relief to take first (a
    // seed with a pond off the tee, 2 November 2026).
    await reliefFirst(t);
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
 // A COMPUTER GOLFER IN THE GROUP (the fairway-tour goal, 17 November 2026):
 // the seat editor makes one, the round starts with it up first, and it
 // plays its own hole -- the turn card names its club, its balls fly, the
 // person's swing is refused on its turn -- and hands the turn over.
 {
  name: 'cpu-group',
  what: 'a computer golfer in the group: made in the seat editor, it plays its hole out by itself (its card, its flights, its score) and the turn comes to the person',
  context: {viewport: {width: 1366, height: 768}},
  async run(t) {
   const state = () => t.page.evaluate(() => window.lab.state().turn);
   await menuReady(t);
   await t.step('a group of two: a computer golfer first, then a new player', async () => {
    await fromMenu(t, 'Endless');
    await t.press('Golfers');
    await t.page.selectOption('#who0', '__cpu');
    await t.until(() => t.page.locator('#level0').count().then(n => n > 0), 'the computer golfer\'s level', 5 * SLOW);
    await t.press('Add player');
    if (await t.page.locator('#name1').count()) await t.page.fill('#name1', 'Person');
    const sub = await t.page.locator('#playerRows .seat').first().textContent();
    if (!/COMPUTER/.test(sub)) throw new Error(`the first seat does not say it is a computer golfer: "${sub.trim().slice(0, 80)}"`);
    await t.page.selectOption('#level0', '10');
   });
   // TODO's *A computer golfer can lose its record when Play keeps a group
   // across steps* (fixed 20 November 2026): choosing the game again redraws
   // Play from the group being set up, and the computer golfer came back as
   // a new person by its name.
   await t.step('choosing the game again keeps the computer golfer one', async () => {
    const name = (await t.page.locator('#playerRows .seat').first().textContent()).trim().slice(0, 40);
    await t.page.locator('[aria-label="Steps"]').getByRole('button', {name: 'Game', exact: true}).click();
    await t.page.locator('[data-game="endless"]').click();
    await t.press('Golfers');
    await t.until(() => t.page.locator('#playerRows .seat').first().isVisible(), 'the Golfers step', 5 * SLOW);
    const sub = await t.page.locator('#playerRows .seat').first().textContent();
    if (!/COMPUTER/.test(sub)) throw new Error(`after choosing the game again the first seat is "${sub.trim().slice(0, 80)}", was "${name}"`);
    if (!(await t.page.locator('#level0').count())) throw new Error('the computer golfer\'s level is gone');
    if ((await t.page.inputValue('#level0')) !== '10') throw new Error(`its level is ${await t.page.inputValue('#level0')}, chosen 10`);
   });
   await t.step('the round starts with it', async () => {
    await t.press('Start an endless run');
    await t.inPlay();
   });
   await t.step('the computer golfer is up, its card names a club, and its ball flies', async () => {
    const s = await state();
    if (!s?.computer || s.active !== 0) throw new Error(`the first turn is not the computer golfer's: ${JSON.stringify(s)}`);
    await t.until(async () => /yd to the hole/.test(await t.page.textContent('#turnFlash').catch(() => '')), 'the computer golfer\'s turn card', 20 * SLOW);
    await t.page.locator('#turnFlash').screenshot({path: path.join(SHOTS, 'cpu-turn-card.png')}).catch(() => {});
    await t.until(() => t.inFlight(), 'the computer golfer\'s first ball in the air', 20 * SLOW);
    await t.page.screenshot({path: path.join(SHOTS, 'cpu-flight.png')});
   });
   await t.step('a swing of the person\'s is not taken on the computer golfer\'s turn', async () => {
    const ok = await t.page.evaluate(() => window.lab.state().canSwing);
    const s = await state();
    if (s.computer && ok) throw new Error('the swing is offered on the computer golfer\'s turn');
   });
   await t.step('it plays the hole out by itself and the turn comes to the person', async () => {
    await t.until(async () => { const s = await state(); return s && (s.active === 1 || s.holeComplete); }, 'the computer golfer to hole out', 240 * SLOW);
    const s = await state();
    const score = s.cards[0][s.hole];
    if (!(score >= 1 && score < 15)) throw new Error(`the computer golfer's card for hole ${s.hole + 1} says ${score}`);
    await t.page.screenshot({path: path.join(SHOTS, 'cpu-handed-over.png')});
   });
  },
 },
 // A TOUR EVENT'S FIRST TEE (the fairway-tour goal): a Quick season from the
 // main menu, its first event started, round one begun -- the field made
 // ready, the person's group of four with three computer golfers, the
 // leaderboard's line on the round screen -- and the first shot struck.
 {
  name: 'tour-event',
  what: 'a Quick season from the main menu: its hub, the first event started, round one with three computer golfers in the group, the field ready and the leaderboard line on the round screen, the first shot',
  context: {viewport: {width: 1366, height: 768}},
  async run(t) {
   await menuReady(t);
   await t.step('the Fairway Tour from the main menu: a Quick season', async () => {
    await t.page.locator('#mainMenu').getByRole('button', {name: /Fairway Tour/}).first().click();
    await t.until(() => t.page.locator('[data-tour="quick"]').isVisible().catch(() => false), 'the tour\'s start screen', 10 * SLOW);
    await t.page.screenshot({path: path.join(SHOTS, 'tour-start.png')});
    await t.page.click('[data-tour="quick"]');
    await t.until(() => t.page.locator('[data-tour="start"]').isVisible().catch(() => false), 'the hub', 10 * SLOW);
    await t.page.screenshot({path: path.join(SHOTS, 'tour-hub.png')});
   });
   await t.step('the first event started; round one begins on its course', async () => {
    await t.page.click('[data-tour="start"]');
    await t.until(() => t.page.locator('[data-tour="play"]').isVisible().catch(() => false), 'Play round 1', 10 * SLOW);
    await t.page.click('[data-tour="play"]');
    await t.inPlay(180 * SLOW);
   });
   await t.step('the field ready: the leaderboard line, a group of four with three computer golfers', async () => {
    await t.until(() => t.page.locator('#eventTicker').isVisible().catch(() => false), 'the leaderboard line', 120 * SLOW);
    const text = await t.page.textContent('#eventTicker');
    // Before anyone has a score it names the event and the field; when the
    // person's group is not first out, the groups ahead are already on the
    // course and it names the leader and the person's place (ui-tour.js).
    if (!/ROUND 1 OF \d · \d+ GOLFERS|YOU (T?\d+|LEAD)/.test(text)) throw new Error(`the leaderboard line says "${text}"`);
    const s = await t.page.evaluate(() => window.lab.state().turn);
    if (!s || s.cards.length !== 4) throw new Error(`the group is ${s?.cards.length} golfers, not four`);
    if (s.computer) throw new Error('a computer golfer is up first; the person is seat one');
    await t.page.screenshot({path: path.join(SHOTS, 'tour-first-tee.png')});
   });
   await t.step('the first shot', () => t.shot());
  },
 },
 // NET STABLEFORD WITH A COMPUTER GOLFER, AND THE CADDIE (the fairway-tour
 // goal): Play offers Stableford and the Scoring choice; a net Stableford
 // round with a computer golfer starts with each golfer's strokes worked out;
 // a swing pad golfer's turn shows the caddie's line, gone after the swing.
 {
  name: 'net-stableford',
  what: 'Play offers Stableford and net scoring; a net Stableford round with a computer golfer starts with the strokes worked out; the caddie\'s line on a swing pad turn, gone after the swing',
  context: {viewport: {width: 1366, height: 768}},
  async run(t) {
   await menuReady(t);
   await t.step('Play: Stableford with its note, and Scoring with Net', async () => {
    await fromMenu(t, 'Play');
    await t.page.waitForSelector('#roundMode', {state: 'attached', timeout: 10000 * SLOW});
    const r = await t.page.evaluate(() => {
     const sel = document.getElementById('roundMode');
     if (![...sel.options].some(o => o.value === 'stableford')) return null;
     sel.value = 'stableford'; sel.dispatchEvent(new Event('change'));
     return {note: document.getElementById('formatNote').textContent, net: [...(document.getElementById('roundNet')?.options || [])].map(o => o.value)};
    });
    if (!r) throw new Error('Format has no Stableford choice');
    if (!/points/i.test(r.note)) throw new Error(`the Stableford note reads: ${r.note}`);
    if (!r.net.includes('net')) throw new Error('Scoring has no Net choice');
   });
   await t.step('a net Stableford round with a computer golfer, the strokes worked out', async () => {
    await t.page.evaluate(() => window.lab.course({holes: 9}, {players: [{name: 'Ann', team: 'A', hand: 'RH', input: 'meter'}, {name: 'Calum Lennox', team: 'A', hand: 'RH', input: 'cpu', cpu: {id: 'g050', handicap: 12}}], mode: 'stableford', tee: 'blue', handicaps: true}));
    await t.inPlay(120 * SLOW);
    const saved = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-round-v1') || 'null')?.round);
    if (saved?.mode !== 'stableford' || !saved?.handicaps) throw new Error(`the saved round is ${saved?.mode}, handicaps ${saved?.handicaps}`);
    if (!saved.net || saved.net.strokes.length !== 2 || saved.net.strokes[1].reduce((s, v) => s + v, 0) < 1) throw new Error(`the strokes are ${JSON.stringify(saved.net?.strokes)}`);
   });
   await t.step('the caddie\'s line on the swing pad golfer\'s turn, gone after the swing', async () => {
    await t.until(() => t.page.locator('#caddieLine').isVisible().catch(() => false), 'the caddie\'s line', 20 * SLOW);
    const line = await t.page.textContent('#caddieLine');
    if (!/^CADDIE · .+ yd$/.test(line)) throw new Error(`the caddie says "${line}"`);
    await t.page.screenshot({path: path.join(SHOTS, 'caddie-line.png')});
    // After the swing the golfer plays on from where the ball stopped (stroke
    // play's order): the line, if up, is a new suggestion from the new spot.
    await t.shot();
    const after = await t.page.locator('#caddieLine').isVisible().catch(() => false) ? await t.page.textContent('#caddieLine') : '';
    if (after === line) throw new Error(`the caddie's line did not change after the swing: "${line}"`);
   });
  },
 },
 // THE TOUR EDITOR AND A TOUR FILE (the fairway-tour goal): a tour built in
 // the editor and saved; shared as a .fairway-tour; opened again, its
 // contents shown before Add tour, and added.
 {
  name: 'tour-file',
  what: 'Build your own: the editor names a tour, sets one round a weekend and adds an event; saved, it is the hub; shared as a .fairway-tour and opened again, shown before Add tour, and added',
  context: {viewport: {width: 1366, height: 768}, acceptDownloads: true},
  async run(t) {
   await menuReady(t);
   let bytes = null;
   await t.step('the editor: a name, one round a weekend, a second event, saved', async () => {
    await t.page.locator('#mainMenu').getByRole('button', {name: /Fairway Tour/}).first().click();
    await t.until(() => t.page.locator('[data-tour="blank"]').isVisible().catch(() => false), 'the tour\'s start screen', 10 * SLOW);
    await t.page.click('[data-tour="blank"]');
    await t.until(() => t.page.locator('#tourName').isVisible().catch(() => false), 'the editor', 10 * SLOW);
    await t.page.fill('#tourName', 'Smoke Tour');
    await t.page.selectOption('#tourRounds', '1');
    await t.page.click('[data-tour="add"]');
    await t.until(async () => (await t.page.locator('.tour-events li').count()) === 2, 'a second event', 5 * SLOW);
    await t.page.screenshot({path: path.join(SHOTS, 'tour-editor.png')});
    await t.page.click('[data-tour="save"]');
    await t.until(async () => /Smoke Tour/.test(await t.page.textContent('#drawerContent')) && await t.page.locator('[data-tour="start"]').isVisible().catch(() => false), 'the hub of the saved tour', 10 * SLOW);
    if (!/one round/.test(await t.page.textContent('#drawerContent'))) throw new Error('the hub does not say one round');
   });
   await t.step('shared as one .fairway-tour file', async () => {
    const [download] = await Promise.all([t.page.waitForEvent('download'), t.page.click('[data-tour="share"]')]);
    if (!/\.fairway-tour$/.test(download.suggestedFilename())) throw new Error(`the file is called ${download.suggestedFilename()}`);
    bytes = await (await import('node:fs/promises')).readFile(await download.path());
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('the file is not a ZIP');
   });
   await t.step('opened again: shown before Add tour, then added', async () => {
    await t.page.click('[data-tour="switch"]');
    await t.until(() => t.page.locator('[data-tour="import"]').isVisible().catch(() => false), 'the start screen', 5 * SLOW);
    const [chooser] = await Promise.all([t.page.waitForEvent('filechooser'), t.page.click('[data-tour="import"]')]);
    await chooser.setFiles({name: 'Smoke Tour.fairway-tour', mimeType: 'application/zip', buffer: bytes});
    await t.until(() => t.page.locator('[data-tour="addimport"]').isVisible().catch(() => false), 'the file\'s contents and Add tour', 10 * SLOW);
    if (!/2 events/.test(await t.page.textContent('#drawerContent'))) throw new Error('the preview does not say two events');
    await t.page.screenshot({path: path.join(SHOTS, 'tour-import.png')});
    await t.page.click('[data-tour="addimport"]');
    await t.until(() => t.page.locator('[data-tour="start"]').isVisible().catch(() => false), 'the added tour\'s hub', 10 * SLOW);
    const n = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-tours-v1')).tours.length);
    if (n !== 2) throw new Error(`${n} tours kept, not two`);
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
    await fromMenu(t, 'Endless', 'tap');
    // Endless is a kind of round in Play (21 October 2026): it starts from the last step, Rules.
    await t.page.locator('#drawer .sx-steps .sx-step').last().tap();
    await t.page.getByRole('button', {name: 'Start an endless run', exact: true}).tap();
    await t.inPlay();
    await t.until(async () => (await t.page.textContent('#monTitle')) === 'Ready', 'the panel to say Ready', 5 * SLOW);
    // Settings → Launch monitor (it left Tools for Settings, 21 October 2026).
    await t.settings('monitor');
    await t.until(() => t.page.evaluate(() => !!document.getElementById('bridgeUrl')), 'the monitor panel from Tools', 5 * SLOW);
    await t.leaveMonitor();
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
  what: 'Challenges: seven tabs holding all 36, closest to the pin plays five balls on the Challenge Course with the bar up, nothing is saved as a round, the results card offers it again; a putting one holes out, a range one plays on the range, and a long drive starts',
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
     await t.menuItem('Main menu');
     await t.until(() => t.page.evaluate(() => !document.getElementById('mainMenu').hidden), 'the main menu', 60 * SLOW);
    }
    await fromMenu(t, 'Challenges');
    await chalClick(t, `[data-chal-tab="${tab}"]`);
    await chalClick(t, `[data-challenge="${id}"]`);
    await challengeGo(t);
    await t.inPlay(180 * SLOW);
   };
   await t.step('Challenges → seven tabs, all 36, none locked, the old record already a medal', async () => {
    await fromMenu(t, 'Challenges');
    await t.until(() => t.page.evaluate(() => document.querySelectorAll('.chal-tabs .panel-tab').length === 7), 'the seven tabs', 10 * SLOW);
    let cards = 0;
    for (const tab of ['tee', 'approach', 'range', 'short', 'putting', 'versus', 'rounds']) {
     await chalClick(t, `[data-chal-tab="${tab}"]`);
     await t.until(() => t.page.evaluate(id => document.querySelector(`[data-chal-tab="${id}"]`)?.classList.contains('active'), tab), `the ${tab} tab`, 10 * SLOW);
     // The challenge of the week's card sits above the tabs, on every one: count the tab's own.
     cards += await t.page.evaluate(() => document.querySelectorAll('.chal-card[data-challenge]').length);
    }
    if (cards !== 36) throw new Error(`${cards} challenge cards`);
    if (await t.page.evaluate(() => document.querySelectorAll('.chal-card.locked, .chal-card[disabled]').length)) throw new Error('a challenge is locked');
    const m = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-profiles-v1')).profiles[0].medals);
    if (m?.closest !== 3) throw new Error(`the 9-foot record from before medals is not a gold: ${JSON.stringify(m)}`);
   });
   await t.step('closest to the pin starts on a par 3 of the Challenge Course, with the bar', async () => {
    await chalClick(t, '[data-chal-tab="approach"]');
    await chalClick(t, '[data-challenge="closest"]');
    await challengeGo(t);
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
    if (!/^This week: .+ · 0 of 99 medals$/.test(note)) throw new Error(`the tile reads: ${note}`);
   });
   await t.step('its card is on the Challenges screen, and it starts', async () => {
    await fromMenu(t, 'Challenges');
    await t.page.waitForSelector('[data-chal-week]', {timeout: 10000 * SLOW});
    await t.page.click('[data-chal-week]');
    await t.until(() => t.page.evaluate(() => /This week:/.test(document.querySelector('#drawerContent h3')?.textContent || '')), 'the week\'s details', 10 * SLOW);
    await challengeGo(t);
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
 // STEP 3 OF THE CHALLENGES (16 October 2026): a challenge that goes from hole
 // to hole, a head-to-head (refused alone, played with two), and the two
 // rounds with a goal, which are real rounds and do save.
 {
  name: 'challenge-more',
  what: 'Challenges, step 3: seven tabs holding all 36; Every par 3 moves from hole to hole; a head-to-head is refused alone and played by two; Bogey-free nine and Sudden death start as real rounds that save, with the goal on the bar',
  async prepare(page) {
   await page.addInitScript(() => { try { localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'pcm', profiles: [{id: 'pcm', name: 'More', created: 1, counters: {}, bests: {}, rounds: [], xp: 0, xpLog: {}}]})); localStorage.removeItem('fairway-round-v1'); } catch {} });
  },
  async run(t) {
   await menuReady(t);
   const bar = re => t.page.evaluate(src => !document.getElementById('challengeBar').hidden && new RegExp(src).test(document.getElementById('challengeBar').textContent), re.source);
   // Leaving a real round (a goal round is one) asks first: leave it unsaved.
   const toMenu = async () => {
    await t.menuItem('Main menu');
    const leave = t.page.getByRole('button', {name: /Leave without saving/});
    await leave.waitFor({timeout: 3000 * SLOW}).then(() => leave.click(), () => {});
    await t.until(() => t.page.evaluate(() => !document.getElementById('mainMenu').hidden), 'the main menu', 60 * SLOW);
   };
   await t.step('Challenges → seven tabs, all 36', async () => {
    await fromMenu(t, 'Challenges');
    await t.until(() => t.page.evaluate(() => document.querySelectorAll('.chal-tabs .panel-tab').length === 7), 'the seven tabs', 10 * SLOW);
    let cards = 0;
    for (const tab of ['tee', 'approach', 'range', 'short', 'putting', 'versus', 'rounds']) {
     await chalClick(t, `[data-chal-tab="${tab}"]`);
     await t.until(() => t.page.evaluate(id => document.querySelector(`[data-chal-tab="${id}"]`)?.classList.contains('active'), tab), `the ${tab} tab`, 10 * SLOW);
     cards += await t.page.evaluate(() => document.querySelectorAll('.chal-card[data-challenge]').length);
    }
    if (cards !== 36) throw new Error(`${cards} challenge cards`);
   });
   await t.step('a head-to-head alone is refused, with the reason', async () => {
    await chalClick(t, '[data-chal-tab="versus"]');
    await chalClick(t, '[data-challenge="shootout"]');
    await challengeGo(t);
    await t.until(() => t.page.evaluate(() => /two to four/.test(document.getElementById('roundError')?.textContent || '')), 'the refusal', 10 * SLOW);
   });
   await t.step('Every par 3 starts on a par 3 and moves to the next after a ball', async () => {
    await chalClick(t, '[data-chal-tab="approach"]');
    await chalClick(t, '[data-challenge="par3s"]');
    await challengeGo(t);
    await t.inPlay(180 * SLOW);
    // One ball for each par 3 on the Challenge Course: three since 0.9.14
    // (seed CHALLENGE-13 on the starting course), seven on the short course
    // before it. The count is the course's, so only "more than one" is asked.
    await t.until(() => bar(/Ball 1 of [2-9]/), 'the bar on ball 1 of the par 3s', 20 * SLOW);
    if (await t.page.textContent('#holePar') !== '3') throw new Error('not on a par 3');
    const first = await t.page.textContent('#holeNumber');
    await t.shot();
    await t.until(() => bar(/Ball 2 of [2-9]/), 'ball 2', 15 * SLOW);
    await t.until(async () => (await t.page.textContent('#holeNumber')) !== first, 'the next par 3', 15 * SLOW);
    if (await t.page.textContent('#holePar') !== '3') throw new Error('the second hole is not a par 3');
    if (await t.page.evaluate(() => localStorage.getItem('fairway-round-v1'))) throw new Error('the challenge wrote the round slot');
   });
   await t.step('a shootout for two: a round, then someone out or both on', async () => {
    await t.page.evaluate(() => window.lab.challenge('shootout', [{name: 'Ann', team: 'A', hand: 'RH'}, {name: 'Ben', team: 'A', hand: 'RH'}]));
    await t.inPlay(180 * SLOW);
    await t.until(() => bar(/Round 1 · 2 left/), 'round 1 with two left', 20 * SLOW);
    await t.shot();
    await t.shot();
    await t.until(() => t.page.evaluate(() => { const c = window.lab.state().challenge; return c && (c.done || c.turn.k === 1); }), 'the round judged', 15 * SLOW);
   });
   await t.step('Bogey-free nine starts as a real round: it saves, with the goal on the bar', async () => {
    await toMenu();
    await fromMenu(t, 'Challenges');
    await chalClick(t, '[data-chal-tab="rounds"]');
    await chalClick(t, '[data-challenge="bogeyfree"]');
    await challengeGo(t);
    await t.inPlay(180 * SLOW);
    await t.until(() => bar(/Bogey-free nine/), 'the goal on the bar', 20 * SLOW);
    await t.shot();
    await t.until(() => t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-round-v1') || 'null')?.round?.goal === 'bogeyfree'), 'the round saved with its goal', 15 * SLOW);
   });
   await t.step('Sudden death starts an endless run with its goal', async () => {
    await toMenu();
    await fromMenu(t, 'Challenges');
    await chalClick(t, '[data-chal-tab="rounds"]');
    await chalClick(t, '[data-challenge="suddendeath"]');
    await challengeGo(t);
    await t.inPlay(180 * SLOW);
    await t.until(() => bar(/Sudden death/), 'the goal on the bar', 20 * SLOW);
    const g = await t.page.evaluate(() => window.lab.state().goal);
    if (g?.goal !== 'suddendeath') throw new Error(`the round's goal: ${JSON.stringify(g)}`);
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
    // The week is a course chosen in Play now: its line names the week.
    await t.until(async () => /WEEK [0-9]+/.test(await t.page.textContent('#drawerContent')), 'Play on the week', 10 * SLOW);
    // Round 14: Play is on the Golfers step; press goes there first.
    await t.press('Play the course of the week');
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
 // A FRIEND'S CHALLENGE (rival.js, 20 October 2026): a code made in Node from
 // two shots on hole 1, pasted on Play's friend card; the setup reads it, the
 // round it starts remembers it, and its scorecard carries the friend's row.
 // Making a code at the end of a round, and the shots drawn on the course, are
 // still to be looked at by eye.
 {
  name: 'friend-challenge',
  what: 'a friend’s challenge: a pasted code is read and kept, its round starts on its course and remembers it, and the scorecard shows the friend’s card',
  async run(t) {
   const {makeRivalCode} = await import('../src/rival.js');
   const {DEFAULT_COURSE} = await import('../src/settings-schema.js');
   const shot = [1, 0, 0, 0, 6500, 1400, 0, 3000, 0, 0, 180000];
   await menuReady(t);
   // The page's own version: package.json's and the build's commit.
   const version = await t.page.evaluate(() => window.lab.version);
   const code = makeRivalCode({name: 'Sam', course: 'Smoke Links', version, settings: {...DEFAULT_COURSE, seed: 'SMOKE-FRIEND', holes: 9}, holes: 9,
    pars: [4, 4, 3, 5, 4, 4, 3, 5, 4], card: [4, 5, 3, 5, 4, 4, 3, 6, 4],
    rules: {tee: 'blue', putting: {mode: 'holeout', one: 3, two: 10, three: 20}, ob: 'stroke', lie: true, input: 'meter', turf: {}},
    log: [{hole: 0, seat: 0, s: shot}, {hole: 0, seat: 0, s: [1, 0, 180000, 0, 3000, 2800, 0, 7000, 0, 500, 260000]}]});
   await t.step('Play → A friend’s challenge, paste the code', async () => {
    await fromMenu(t, 'Friend challenge');
    await t.page.fill('#rivalPaste', code);
    await t.press('Read the code');
    await t.until(async () => /Sam shot 38/.test(await t.page.textContent('#drawerContent')), 'the challenge read', 10 * SLOW);
   });
   await t.step('play it: nine holes that remember the challenge', async () => {
    await t.pressToPlay('Play the friend’s challenge');
    const hole = await t.page.textContent('#holeNumber');
    if (!/\/9/.test(hole)) throw new Error(`the hole counter reads ${hole}`);
    const saved = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-round-v1') || 'null'));
    if (!/^f[a-z0-9]+$/.test(saved?.round?.rival || '')) throw new Error(`the saved round's challenge is ${saved?.round?.rival}`);
    await t.shot();
    const after = await t.page.evaluate(() => JSON.parse(localStorage.getItem('fairway-round-v1') || 'null'));
    if (after?.shots?.length !== 1) throw new Error(`the saved round logged ${after?.shots?.length} shots`);
   });
   await t.step('the scorecard carries Sam’s card', async () => {
    await t.page.getByRole('button', {name: /Open the scorecard/}).first().click();
    await t.until(() => t.drawerOpen(), 'the scorecard', 5 * SLOW);
    await t.until(async () => /Sam.s card/.test(await t.page.textContent('#drawerContent').catch(() => '')), 'the friend’s row', 10 * SLOW);
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
    await t.press('Locker');
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
    await t.menuItem('Main menu');
    // Leaving a round with a hole played asks whether to keep it.
    if (await t.page.waitForSelector('#leaveNotice:not([hidden])', {timeout: 5000 * SLOW}).then(() => true, () => false)) await t.page.click('#leaveDiscard');
    await t.until(() => t.page.evaluate(() => !document.getElementById('mainMenu').hidden && document.getElementById('generating')?.hidden !== false), 'the main menu', 60 * SLOW);
    await fromMenu(t, 'My profile');
    await t.until(() => t.drawerOpen(), 'the profile', 10 * SLOW);
    await t.press('Locker');
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
    // Every achievement the game has (thirteen from the spec and five for the
    // challenges, 16 October 2026; one fewer since Haunted Hollow's went, 2
    // November 2026) -- counted from the list, not written here.
    const {ACHIEVEMENTS} = await import('../src/achievements.js');
    if (v.ach !== ACHIEVEMENTS.length || v.earned !== 1) throw new Error(`${v.ach} achievements listed of ${ACHIEVEMENTS.length}, ${v.earned} earned`);
    await t.press('Locker'); // the look is the hub's Locker tab (1.0, 17 October 2026)
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
 },
 // ONLINE PLAY (19 November 2026; src/online/): two players in two browsers,
 // each opened from the file as a player opens it, through the relay's Node
 // twin on this machine. The host starts a room, the guest knocks with the
 // code and is let in, the host tees off on a course both build, each swings
 // on their own turn and the other screen flies the same ball and lands in
 // the same place. A WebSocket is the one connection allowed, and only to the
 // relay, and only once a room is opened.
 {
  name: 'online',
  what: 'a host (file from disk) and a guest (served over plain http, with a launch monitor) through a local relay: knock, let in, a late knock, tee off, a shot each, the same ball on both screens, the guest cut off and back',
  async run(t) {
   // A refused message or a socket closed other than by its own page, said
   // as it happens (a run on 20 November 2026 lost both screens at once).
   const relay = await startRelay({port: 0, log: s => { if (/refused|\((?!1000\b|1005\b)\d+/.test(s)) console.log(`       relay: ${s}`); }});
   const sockets = [], guestSockets = [];
   t.page.on('websocket', ws => sockets.push(ws.url()));
   // THE OWNER'S CASE (19 November 2026): a phone that loaded the game from
   // run_fairway_server on a PC, over plain http on the home network, with
   // the launch monitor on that PC's bridge. Served here from this machine's
   // own network address, which a browser does not count as secure.
   const lan = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address || '127.0.0.1';
   const dir = path.dirname(FILE ? path.resolve(FILE) : DIST);
   const served = createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(dir, name);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': {'.html': 'text/html; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json'}[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
   });
   await new Promise(r => served.listen(0, lan, r));
   const guestHome = `http://${lan}:${served.address().port}/`;
   const gctx = await t.page.context().browser().newContext({viewport: {width: 1440, height: 900}});
   await gctx.addInitScript(() => {
    try { localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'low', frameCap: 0})); } catch {}
    try { if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 2, main: 'pguest', profiles: [{id: 'pguest', name: 'Guest', created: Date.now(), counters: {}, bests: {}, rounds: []}]})); } catch {}
   });
   const gpage = await gctx.newPage();
   gpage.setDefaultTimeout(30000 * SLOW);
   gpage.on('websocket', ws => guestSockets.push(ws.url()));
   // The PC's bridge, answered here as the `monitor` journey answers it.
   let bridge = null;
   const acks = [];
   await gpage.routeWebSocket(u => String(u).startsWith(`ws://${lan}:${served.address().port}`) || /^ws:\/\/127\.0\.0\.1:1922/.test(String(u)), ws => {
    bridge = ws;
    ws.onMessage(m => { try { const d = JSON.parse(m); if (d.type === 'ack') acks.push(d); } catch {} });
    ws.send(monitorStatus('green'));
   });
   const g = new Trip(gpage, 'online-guest', guestHome);
   let dropLink = null;
   const turn = p => p.evaluate(() => window.lab.state().turn);
   try {
    await menuReady(t);
    await t.step('no connection is made before a room is opened', async () => {
     if (sockets.length) throw new Error(`a socket opened at the menu: ${sockets[0]}`);
    });
    let code = '';
    await t.step('Play online → Start a room shows a room code', async () => {
     await fromMenu(t, 'Play online');
     await t.until(() => t.page.locator('#onlineHost').isVisible(), 'the online sheet', 10 * SLOW);
     // The relay is built in and never shown (the owner, 20 November 2026):
     // nothing on the sheet names it, and this page is pointed at the local one.
     const shown = await t.page.textContent('#drawerContent');
     if (/wss?:\/\/|workers\.dev|relay address/i.test(shown)) throw new Error(`the sheet shows a relay: "${shown.slice(0, 200)}"`);
     await t.page.evaluate(u => window.lab.relay(u), relay.url);
     await t.press('Start a room');
     await t.until(async () => /^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/.test((await t.page.textContent('#onlineCodeText').catch(() => '')) || ''), 'the room code', 10 * SLOW);
     code = (await t.page.textContent('#onlineCodeText')).trim();
     await t.until(() => t.page.evaluate(() => document.querySelector('.online-status')?.dataset.state === 'open'), 'the host to reach the relay', 10 * SLOW);
    });
    await t.step('the relay is told the room number, never the code', async () => {
     if (!sockets.some(u => u.startsWith(relay.url + '/room/'))) throw new Error(`no socket to the relay: ${sockets.join(', ')}`);
     if (sockets.some(u => u.toUpperCase().includes(code.replace(/-/g, '').slice(0, 8)))) throw new Error('the code is in the relay address');
    });
    await gpage.goto(guestHome);
    await menuReady(g);
    await g.step('the guest\'s page is not a secure one, and has no browser encryption', async () => {
     const sec = await gpage.evaluate(() => ({secure: isSecureContext, subtle: !!globalThis.crypto?.subtle, random: typeof globalThis.crypto?.getRandomValues}));
     if (lan !== '127.0.0.1' && (sec.secure || sec.subtle)) throw new Error(`served from ${guestHome} the page is secure (${JSON.stringify(sec)}): this is not the phone's case`);
     if (sec.random !== 'function') throw new Error('no getRandomValues on a plain-http page');
     if (lan === '127.0.0.1') console.log('       (no network address on this machine: served from 127.0.0.1, which counts as secure)');
    });
    await g.step('the guest joins with the code and knocks, playing with the launch monitor', async () => {
     await fromMenu(g, 'Play online');
     await g.until(() => gpage.locator('#onlineJoin').isVisible(), 'the online sheet', 10 * SLOW);
     await gpage.evaluate(() => { const s = document.getElementById('onlineInput'); s.value = 'monitor'; s.dispatchEvent(new Event('change', {bubbles: true})); });
     await gpage.evaluate(u => window.lab.relay(u), relay.url);
     await gpage.fill('#onlineCode', code.toLowerCase());
     await g.press('Join the room');
     await g.until(() => gpage.locator('#onlineCancel').isVisible(), 'the knocking screen', 10 * SLOW);
    });
    await t.step('the host sees the knock and lets the guest in', async () => {
     await t.until(() => t.page.locator('[data-admit]').first().isVisible(), 'the knock', 10 * SLOW);
     await t.page.screenshot({path: path.join(SHOTS, 'online-host-knock.png')});
     await t.page.locator('[data-admit]').first().click();
     await t.until(async () => /Guest/.test(await t.page.textContent('.online-people') || ''), 'the guest in the room list', 10 * SLOW);
    });
    await g.step('the guest is in the room, waiting for the host', async () => {
     await g.until(() => gpage.locator('#onlineLeave').isVisible(), 'the room screen', 10 * SLOW);
     await gpage.screenshot({path: path.join(SHOTS, 'online-guest-room.png')});
    });
    await t.step('Choose the course: the guest has a seat; Rules of golf order; Surprise me → Tee off', async () => {
     await t.press('Choose the course and start');
     await t.until(() => t.page.locator('#drawer .sx-card').first().isVisible().catch(() => false), 'Play', 10 * SLOW);
     await t.page.locator('#drawer .sx-card[aria-label^="Surprise me"]').first().click();
     const seated = await t.page.evaluate(() => [...document.querySelectorAll('#playerRows .online-seat-name')].map(e => e.textContent));
     if (!seated.includes('Guest')) throw new Error(`the guest has no seat: ${JSON.stringify(seated)}`);
     // On the Rules step, which a player would open; set where it lies.
     await t.page.evaluate(() => { const s = document.getElementById('roundOrder'); s.value = 'farthest'; s.dispatchEvent(new Event('change', {bubbles: true})); });
    });
    await t.step('a late knock while Play is open: the new guest\'s seat appears and the choices made stay', async () => {
     const version = await t.page.evaluate(() => window.lab.version || 'unstamped');
     const late = new GuestSession({link: createLink({relay: relay.url, code: readRoomCode(code), random: n => new Uint8Array(randomBytes(n))}), member: 'smokelate1', golfer: {name: 'Late'}, game: version});
     try {
      await t.until(() => t.page.locator('#onlineKnock [data-admit]').isVisible(), 'the knock bar over Play', 10 * SLOW);
      await t.page.screenshot({path: path.join(SHOTS, 'online-late-knock.png')});
      await t.page.locator('#onlineKnock [data-admit]').click();
      await t.until(async () => (await t.page.evaluate(() => [...document.querySelectorAll('#playerRows .online-seat-name')].map(e => e.textContent))).includes('Late'), 'the late guest\'s seat', 10 * SLOW);
      const order = await t.page.evaluate(() => document.getElementById('roundOrder').value);
      if (order !== 'farthest') throw new Error(`the order of play went back to "${order}" when the seats were drawn again`);
      // The late guest is only passing through: taken out of the group again.
      await t.page.locator('#playerRows .player-row', {hasText: 'Late'}).locator('[data-drop]').click();
     } finally { late.link.close(); }
    });
    await t.step('Surprise me → Tee off', async () => {
     await t.press('Tee off on the surprise course');
     await t.inPlay(120 * SLOW);
    });
    await g.step('the guest\'s screen builds the same course and joins the round', async () => {
     await g.inPlay(120 * SLOW);
     const [a, b] = [await whereAmI(t.page), await whereAmI(gpage)];
     if (a.seed !== b.seed || a.hole !== b.hole) throw new Error(`host ${JSON.stringify(a)}, guest ${JSON.stringify(b)}`);
     const s = await turn(gpage);
     if (s.active !== 0) throw new Error(`the guest's round has seat ${s.active} up, not the host`);
     if (await gpage.evaluate(() => window.lab.state().canSwing)) throw new Error('the guest can swing on the host\'s turn');
    });
    await g.step('the guest connects their PC\'s bridge and arms the monitor while the host is up', async () => {
     await g.settings('monitor');
     await g.press('Connect bridge');
     await g.until(() => gpage.evaluate(() => !!document.getElementById('monArm')), 'the monitor controls', 5 * SLOW);
     await gpage.getByLabel(/Arm monitor/).check();
     await g.leaveMonitor();
    });
    await t.step('the host swings; the ONLINE chip is up', async () => {
     if (!await t.page.evaluate(() => document.getElementById('onlineChip')?.hidden === false)) throw new Error('no online chip in the round');
     await t.shot();
    });
    await g.step('the guest\'s screen flies it and lands where the host\'s did', async () => {
     await g.until(async () => (await turn(gpage)).strokes?.[0] === 1, 'the host\'s stroke on the guest\'s card', 30 * SLOW);
     const [a, b] = await Promise.all([t.page, gpage].map(p => p.evaluate(() => window.lab.state().turn)));
     if (JSON.stringify(a.strokes) !== JSON.stringify(b.strokes) || a.active !== b.active) throw new Error(`host ${JSON.stringify(a)}, guest ${JSON.stringify(b)}`);
     if (b.active !== 1) throw new Error(`after the honour, seat ${b.active} is up rather than the guest`);
    });
    await t.step('the host cannot swing on the guest\'s turn', async () => {
     if (await t.page.evaluate(() => window.lab.state().canSwing)) throw new Error('the host can swing for the guest');
    });
    await g.step('the guest hits a ball into the launch monitor at their house', async () => {
     await g.until(async () => (await turn(gpage)).active === 1 && !(await g.inFlight()), 'the guest\'s turn', 10 * SLOW);
     bridge.send(JSON.stringify({type: 'shot', requestId: 'online-1', payload: {DeviceID: 'Smoke', Units: 'Yards', ShotNumber: 1, APIversion: '1',
      BallData: {Speed: 141.2, VLA: 13.1, HLA: -1.4, TotalSpin: 2980, SpinAxis: 4.2}, ShotDataOptions: {ContainsBallData: true, ContainsClubData: false}}}));
     await g.until(() => g.inFlight(), 'the guest\'s monitor shot to fly', 5 * SLOW);
     if (!acks.some(a => a.requestId === 'online-1' && a.accepted)) await g.until(() => acks.some(a => a.requestId === 'online-1'), 'the bridge\'s answer', 5 * SLOW);
     if (!acks.find(a => a.requestId === 'online-1').accepted) throw new Error(`the guest's game refused the monitor shot: ${JSON.stringify(acks)}`);
     await gpage.screenshot({path: path.join(SHOTS, 'online-guest-shot.png')});
    });
    await t.step('the host flies the guest\'s ball, and both rounds agree', async () => {
     await t.until(async () => (await turn(t.page)).strokes?.[1] === 1, 'the guest\'s stroke on the host\'s card', 30 * SLOW);
     await t.until(async () => !(await t.inFlight()), 'the guest\'s ball to land on the host\'s screen', 30 * SLOW);
     await g.until(async () => !(await g.inFlight()) && (await turn(gpage)).strokes?.[1] === 1, 'the guest\'s own card', 30 * SLOW);
     const both = await Promise.all([t.page, gpage].map(p => p.evaluate(() => ({turn: window.lab.state().turn, ball: window.lab.state().ballAt}))));
     if (JSON.stringify(both[0].turn.strokes) !== JSON.stringify(both[1].turn.strokes) || both[0].turn.active !== both[1].turn.active) throw new Error(`host ${JSON.stringify(both[0])}, guest ${JSON.stringify(both[1])}`);
     if (Math.hypot(both[0].ball.x - both[1].ball.x, both[0].ball.z - both[1].ball.z) > 0.01) throw new Error(`the ball up lies in two places: ${JSON.stringify(both)}`);
     await t.page.screenshot({path: path.join(SHOTS, 'online-host-round.png')});
    });
    await g.step('the guest is cut off at the relay and comes back to the same round', async () => {
     // The relay keeps a room's sockets in the order they came: the host's
     // first. Every other one is cut, as a phone's Wi-Fi drops.
     let cut = 0;
     for (const r of relay.rooms.values()) for (const p of [...r.values()].slice(1)) { p.ws.terminate(); cut++; }
     if (!cut) throw new Error('nothing to cut at the relay');
     await g.until(async () => (await gpage.evaluate(() => window.lab.online()?.status)) !== 'open', 'the guest to notice', 5 * SLOW).catch(() => {});
     await g.until(async () => (await gpage.evaluate(() => window.lab.online()?.status)) === 'open', 'the guest to reconnect', 20 * SLOW);
     await gpage.waitForTimeout(1500);
     const seats = await t.page.evaluate(() => window.lab.online()?.seats);
     if (!seats?.[1]) throw new Error(`the guest's seat was lost: ${JSON.stringify(seats)}`);
     const both = await Promise.all([t.page, gpage].map(p => p.evaluate(() => ({turn: window.lab.state().turn, ball: window.lab.state().ballAt, online: window.lab.online()}))));
     if (both[1].online.phase !== 'playing') throw new Error(`the guest is ${both[1].online.phase}, not playing`);
     if (JSON.stringify(both[0].turn.strokes) !== JSON.stringify(both[1].turn.strokes)) throw new Error(`host ${JSON.stringify(both[0].turn)}, guest ${JSON.stringify(both[1].turn)}`);
    });
    const room = p => p.evaluate(() => window.lab.online());
    // DROPPING IN (the owner, 20 November 2026): a friend knocks mid-round.
    // A third screen here is the Node guest `drop`, which shows each hole's
    // card when it has one (so the host's countdown is not kept waiting) and
    // plays no shots: seated, it leaves again, and the host plays its ball.
    const version = await t.page.evaluate(() => window.lab.version || 'unstamped');
    const drop = new GuestSession({link: createLink({relay: relay.url, code: readRoomCode(code), random: n => new Uint8Array(randomBytes(n))}), member: 'smokedrop1', golfer: {name: 'Drop', input: 'meter'}, game: version});
    dropLink = drop.link;
    const dropStarts = [];
    drop.on('start', m => dropStarts.push(m));
    drop.on('state', m => { if (m.round?.holeComplete && !m.round.finished) drop.seen(m.round.hole); });
    await t.step('a friend knocks mid-round: let in to watch, sent the round alone, seated from the pause list\'s Online room', async () => {
     await t.until(() => t.page.locator('#onlineKnock [data-admit-play]').isVisible(), 'the knock bar with Let in to play', 15 * SLOW);
     await t.page.screenshot({path: path.join(SHOTS, 'online-drop-knock.png')});
     await t.page.locator('#onlineKnock [data-admit]').click();
     await t.until(() => dropStarts.length > 0, 'the round sent to the watcher', 10 * SLOW);
     if (dropStarts[0].to !== 'smokedrop1') throw new Error(`the round was not sent to the watcher alone: ${JSON.stringify({to: dropStarts[0].to})}`);
     try { await t.until(async () => /WATCHING/.test(await t.page.textContent('#onlineChip') || ''), 'WATCHING on the host\'s chip', 5 * SLOW); }
     catch (e) { console.log('       host:', JSON.stringify(await room(t.page)), await t.page.textContent('#onlineChip')); throw e; }
     // The code is on the pause list only (the owner, 20 November 2026), and
     // the host reaches the room from there.
     const chip = await t.page.textContent('#onlineChip');
     if (chip.replace(/-/g, '').includes(code.replace(/-/g, ''))) throw new Error(`the room code is on the round screen: "${chip}"`);
     await t.chrome();
     const row = await t.page.textContent('#pauseRoom');
     if (!row.includes(code)) throw new Error(`the pause list's Online room row says "${row}", not the code`);
     await t.page.screenshot({path: path.join(SHOTS, 'online-pause-room.png')});
     await t.page.click('#pauseRoom');
     await t.until(() => t.page.locator('[data-seat="smokedrop1"]').isVisible(), 'the watcher on the Online sheet', 5 * SLOW);
     await t.page.locator('[data-seat="smokedrop1"]').click();
     await t.until(async () => /FROM THE NEXT TEE/.test(await t.page.textContent('.online-people') || ''), 'the watcher seated from the next tee', 5 * SLOW);
     await t.page.screenshot({path: path.join(SHOTS, 'online-drop-seated.png')});
     const r = await room(t.page);
     if (!r.seatNext?.includes('smokedrop1') || r.seats.includes('smokedrop1')) throw new Error(`seated before the next tee: ${JSON.stringify(r)}`);
     await t.page.keyboard.press('Escape');
     await t.until(async () => !(await t.drawerOpen()), 'the sheet closed', 5 * SLOW);
    });
    const settle = async () => {
     await t.until(async () => !(await t.inFlight()), 'the host\'s ball to land', 30 * SLOW);
     await g.until(async () => !(await g.inFlight()), 'the guest\'s ball to land', 30 * SLOW);
     await g.until(async () => JSON.stringify((await turn(gpage)).strokes) === JSON.stringify((await turn(t.page)).strokes), 'both cards to agree', 15 * SLOW);
    };
    await t.step('a ball in the water: its golfer chooses the relief on their own screen, the other waits', async () => {
     await settle();
     const up = (await turn(t.page)).active, owner = up === 0 ? t : g, other = up === 0 ? g : t;
     const into = await t.page.evaluate(() => window.lab.trouble('water'));
     if (!into) { console.log('       (no water in reach on this hole: skipped)'); return; }
     await owner.until(() => owner.page.evaluate(() => document.getElementById('reliefBar')?.hidden === false), `the relief choice on ${up === 0 ? 'the host' : 'the guest'}'s screen`, 15 * SLOW);
     await owner.page.waitForTimeout(500);
     if (await other.page.evaluate(() => document.getElementById('reliefBar')?.hidden === false)) throw new Error('the relief choice showed on the screen whose ball it is not');
     await owner.page.click('#reliefTake');
     await t.until(async () => (await room(t.page)).relief === null, 'the host\'s round to take the relief', 10 * SLOW);
     await g.until(async () => (await room(gpage)).relief === null, 'the guest\'s round to take the relief', 10 * SLOW);
     await settle();
    });
    // Each golfer up, on their own screen, putts from beside the pin until
    // the hole is over.
    const holeOut = async () => {
     await t.page.evaluate(() => { for (const s of [0, 1, 2, 3]) window.lab.nearPin(s, .3); });
     for (let i = 0; i < 12; i++) {
      await settle();
      if ((await turn(t.page)).holeComplete) return;
      // The guest's seat is putted on the guest's screen; any other (the
      // host's own, or one the host plays on) on the host's.
      const up = (await turn(t.page)).active, who = up === 1 ? g : t;
      await who.until(() => who.page.evaluate(() => window.lab.state().canSwing), `seat ${up}'s putt to be allowed`, 15 * SLOW);
      await who.putt();
     }
     throw new Error('twelve putts from a foot and the hole is not over');
    };
    await g.step('the guest disarms the monitor to putt on the swing pad', async () => {
     await settle();
     await g.settings('monitor');
     await gpage.getByLabel(/Arm monitor/).uncheck();
     await g.leaveMonitor();
    });
    await t.step('both hole out from beside the pin: the scorecard on both screens', async () => {
     await holeOut();
     await g.until(async () => (await turn(gpage)).holeComplete, 'the hole to be over on the guest\'s screen', 15 * SLOW);
     // Each card waits for that screen's own XP to be shown first.
     await t.until(() => t.drawerOpen(), 'the scorecard on the host\'s screen', 30 * SLOW);
     // ...and the host waits for every guest's card before its countdown to
     // the next tee starts (the owner, 20 November 2026): the guest's card
     // is shown however long its own XP takes.
     try { await g.until(() => g.drawerOpen(), 'the scorecard on the guest\'s screen', 60 * SLOW); }
     finally { await gpage.screenshot({path: path.join(SHOTS, 'online-guest-card.png')}); }
     if ((await room(gpage)).hole !== 0) throw new Error('the guest was moved to the next tee before seeing the card');
     const guestLabel = await gpage.textContent('#autoAdvanceLabel').catch(() => '');
     if (!/host moves everyone/i.test(guestLabel || '')) throw new Error(`the guest's card says "${guestLabel}"`);
     const [a, b] = [await room(t.page), await room(gpage)];
     if (JSON.stringify(a.cards) !== JSON.stringify(b.cards)) throw new Error(`host ${JSON.stringify(a.cards)}, guest ${JSON.stringify(b.cards)}`);
    });
    await g.step('the host moves the group on: the guest arrives on the next tee', async () => {
     await t.until(async () => (await room(t.page)).hole === 1, 'the host\'s next hole', 20 * SLOW);
     await g.until(async () => (await room(gpage)).hole === 1, 'the guest\'s next hole', 20 * SLOW);
     await g.inPlay(60 * SLOW);
     const [a, b] = [await whereAmI(t.page), await whereAmI(gpage)];
     if (a.hole !== b.hole) throw new Error(`host on ${a.hole}, guest on ${b.hole}`);
    });
    await t.step('the watcher joins the group at this tee, on every screen, with nothing on the hole they watched', async () => {
     const [a, b] = [await room(t.page), await room(gpage)];
     if (a.seats[2] !== 'smokedrop1' || b.seats[2] !== 'smokedrop1') throw new Error(`host seats ${JSON.stringify(a.seats)}, guest seats ${JSON.stringify(b.seats)}`);
     if (Number.isFinite(a.cards[2]?.[0])) throw new Error(`a score for the hole the watcher only watched: ${JSON.stringify(a.cards[2])}`);
    });
    await t.step('the dropped-in golfer leaves again: their ball is the host\'s to play', async () => {
     drop.leave();
     await t.until(async () => !(await room(t.page)).seats.includes('smokedrop1'), 'the host to take the seat over', 10 * SLOW);
     await g.until(async () => !(await room(gpage)).seats.includes('smokedrop1'), 'the guest\'s round to say so', 10 * SLOW);
    });
    await t.step('the last hole: the round ends on both screens', async () => {
     await settle();
     await t.page.evaluate(() => window.lab.hole(8));
     await g.until(async () => (await room(gpage)).hole === 8, 'the guest on the last hole', 30 * SLOW);
     await g.inPlay(60 * SLOW);
     await holeOut();
     await t.until(async () => (await room(t.page)).finished, 'the host\'s round to finish', 15 * SLOW);
     await g.until(async () => (await room(gpage)).finished, 'the guest\'s round to finish', 15 * SLOW);
     // The card waits for the guest's own XP for the round to be shown
     // (main.js showHoleCompletion: the XP and any level-up first).
     try { await g.until(() => g.drawerOpen(), 'round complete on the guest\'s screen', 30 * SLOW); }
     finally { await gpage.screenshot({path: path.join(SHOTS, 'online-guest-finished.png')}); }
    });
    await g.step('the guest\'s only other connection was to the relay (and their own bridge)', async () => {
     if (!guestSockets.length || guestSockets.some(u => !u.startsWith(relay.url + '/room/') && !u.startsWith(`ws://${lan}:${served.address().port}`))) throw new Error(`guest sockets: ${guestSockets.join(', ')}`);
    });
   } finally {
    try { dropLink?.close(); } catch {}
    await gctx.close().catch(() => {});
    await relay.close();
    served.close();
   }
  },
 },
 // THE HOST LEAVES MID-ROUND (the owner, 20 November 2026: "when the host
 // leaves it asks joined players to save the round too ... need to tell joined
 // players that the host left"). Two screens, both from the file; the host
 // tees off, swings, and leaves for the menu: the guest is told in a box over
 // the menu, and never asked to keep a round that was the host's.
 {
  name: 'online-host-leaves',
  what: 'an online round with the host\'s computer golfer, shown on the guest\'s screen as the guest\'s own Shot views say (results only); then the host leaves mid-hole: the guest is taken to the menu and told, with no question about saving the round',
  async run(t) {
   const relay = await startRelay({port: 0, log: s => { if (/refused|\((?!1000\b|1005\b)\d+/.test(s)) console.log(`       relay: ${s}`); }});
   const gctx = await t.page.context().browser().newContext({viewport: {width: 1440, height: 900}});
   await gctx.addInitScript(() => {
    try { localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'low', frameCap: 0})); } catch {}
    // The guest watches computer golfers' shots as results only.
    try { localStorage.setItem('fairway-rules-v1', JSON.stringify({cpuWatch: 'results'})); } catch {}
    try { if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 2, main: 'pguest', profiles: [{id: 'pguest', name: 'Guest', created: Date.now(), counters: {}, bests: {}, rounds: []}]})); } catch {}
   });
   const gpage = await gctx.newPage();
   gpage.setDefaultTimeout(30000 * SLOW);
   const g = new Trip(gpage, 'online-host-leaves-guest', t.page.url());
   try {
    await menuReady(t);
    let code = '';
    await t.step('the host starts a room; the guest knocks and is let in', async () => {
     await fromMenu(t, 'Play online');
     await t.until(() => t.page.locator('#onlineHost').isVisible(), 'the online sheet', 10 * SLOW);
     await t.page.evaluate(u => window.lab.relay(u), relay.url);
     await t.press('Start a room');
     await t.until(() => t.page.evaluate(() => document.querySelector('.online-status')?.dataset.state === 'open'), 'the host to reach the relay', 10 * SLOW);
     code = (await t.page.textContent('#onlineCodeText')).trim();
     await gpage.goto(t.page.url());
     await menuReady(g);
     await fromMenu(g, 'Play online');
     await g.until(() => gpage.locator('#onlineJoin').isVisible(), 'the online sheet', 10 * SLOW);
     await gpage.evaluate(u => window.lab.relay(u), relay.url);
     await gpage.fill('#onlineCode', code);
     await g.press('Join the room');
     await t.until(() => t.page.locator('[data-admit]').first().isVisible(), 'the knock', 10 * SLOW);
     await t.page.locator('[data-admit]').first().click();
     await g.until(() => gpage.locator('#onlineLeave').isVisible(), 'the room screen', 10 * SLOW);
    });
    await t.step('Surprise me with a computer golfer → Tee off, on both screens; the host swings, then the guest', async () => {
     await t.press('Choose the course and start');
     await t.until(() => t.page.locator('#drawer .sx-card').first().isVisible().catch(() => false), 'Play', 10 * SLOW);
     await t.page.locator('#drawer .sx-card[aria-label^="Surprise me"]').first().click();
     await t.press('Add player');
     const who = t.page.locator('#playerRows select[id^="who"]').last();
     await who.selectOption('__cpu');
     await t.until(async () => /COMPUTER/.test(await t.page.locator('#playerRows .seat').last().textContent()), 'the computer golfer\'s seat', 5 * SLOW);
     // Farthest out plays first, so the turn goes round the group off the tee
     // (in seat order each golfer would play the hole out first).
     await t.page.evaluate(() => { const s = document.getElementById('roundOrder'); s.value = 'farthest'; s.dispatchEvent(new Event('change', {bubbles: true})); });
     await t.press('Tee off on the surprise course');
     await t.inPlay(120 * SLOW);
     await g.inPlay(120 * SLOW);
     const seats = await t.page.evaluate(() => window.lab.online().seats);
     if (seats.length !== 3 || !seats[1] || seats[2]) throw new Error(`the group is not host, guest, computer: ${JSON.stringify(seats)}`);
     // Every flight on the guest's screen while the computer golfer is up.
     await gpage.evaluate(() => { window.__cpuFlights = 0; setInterval(() => { const s = window.lab.state(); if (s.inFlight && s.turn?.computer) window.__cpuFlights++; }, 25); });
     await t.shot();
     await g.until(async () => (await gpage.evaluate(() => window.lab.state().turn?.strokes?.[0])) === 1, 'the host\'s stroke on the guest\'s card', 30 * SLOW);
     try { await g.until(async () => (await gpage.evaluate(() => window.lab.state().turn?.active)) === 1 && !(await g.inFlight()), 'the guest\'s turn', 30 * SLOW); }
     catch (e) {
      for (const [who, p] of [['host', t.page], ['guest', gpage]]) console.log(`       ${who}:`, JSON.stringify(await p.evaluate(() => ({turn: window.lab.state().turn, inFlight: window.lab.state().inFlight, online: window.lab.online(), chip: document.getElementById('onlineChip')?.textContent}))));
      throw e;
     }
     await g.shot();
    });
    await g.step('the computer golfer\'s drive lands on the guest\'s screen without flying (the guest\'s own Results only)', async () => {
     await t.until(async () => (await t.page.evaluate(() => window.lab.state().turn?.strokes?.[2])) === 1, 'the computer golfer\'s drive on the host', 60 * SLOW);
     await g.until(async () => (await gpage.evaluate(() => window.lab.state().turn?.strokes?.[2])) === 1 && !(await g.inFlight()), 'the computer golfer\'s drive on the guest\'s card', 30 * SLOW);
     const n = await gpage.evaluate(() => window.__cpuFlights);
     if (n > 2) throw new Error(`the guest's screen flew the computer golfer's ball (${n} looks in the air) though its Shot views say results only`);
     await t.until(async () => !(await t.inFlight()), 'the host\'s screen to settle', 30 * SLOW);
    });
    await t.step('the host leaves for the menu', async () => {
     await t.menuItem('Main menu');
     if (await t.page.waitForSelector('#leaveNotice:not([hidden])', {timeout: 5000 * SLOW}).then(() => true, () => false)) await t.page.click('#leaveDiscard');
     await t.until(() => t.page.evaluate(() => document.getElementById('app').dataset.mode === 'menu'), 'the host\'s menu', 60 * SLOW);
    });
    await g.step('the guest is taken to the menu and told the host has left, and asked nothing', async () => {
     await g.until(() => gpage.evaluate(() => document.getElementById('onlineEnded')?.hidden === false), 'the host-left box', 60 * SLOW);
     if (await gpage.evaluate(() => document.getElementById('leaveNotice')?.hidden === false)) throw new Error('the guest was asked whether to keep the round');
     const said = await gpage.textContent('#onlineEnded');
     if (!/Smoke has left/.test(said)) throw new Error(`the box says "${said.trim().slice(0, 160)}"`);
     if (await gpage.evaluate(() => document.getElementById('app').dataset.mode) !== 'menu') throw new Error('the guest is not on the menu');
     await gpage.screenshot({path: path.join(SHOTS, 'online-host-left.png')});
     await gpage.click('#onlineEndedOk');
     if (await gpage.evaluate(() => window.lab.online())) throw new Error('the guest is still in a room');
    });
   } finally {
    await gctx.close().catch(() => {});
    await relay.close();
   }
  },
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
  } else {
   // A bridge that is missing or will not start FAILS ITS JOURNEY and the run
   // goes on (the 1.0 polish: a build made with a bare `vite build`, which
   // does not bundle the bridge, threw here and ended the whole run, so the
   // ten journeys after it never ran).
   const bundle = path.join(dir, 'fairway-bridge.mjs');
   if (!fs.existsSync(bundle)) {
    console.log(`   ✗ no ${path.relative(ROOT, bundle)}: \`npm run build\` makes it, a bare \`vite build\` does not\n   FAILED in 0.0s\n`);
    results.push({name: journey.name, ok: false, seconds: 0}); await context.close(); continue;
   }
   bridgeProc = spawn(process.execPath, [bundle], {cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env});
  }
  let said = '';
  bridgeProc.stdout.on('data', d => { said += d; });
  bridgeProc.stderr.on('data', d => { said += d; });
  const until = Date.now() + 15000;
  while (!said.includes('Fairway bridge:') && Date.now() < until && bridgeProc.exitCode === null) await new Promise(r => setTimeout(r, 100));
  if (!said.includes('Fairway bridge:')) {
   bridgeProc.kill();
   console.log(`   ✗ the bridge did not start: ${(said.trim() || 'no output').split('\n').slice(0, 3).join(' / ')}\n   FAILED in 0.0s\n`);
   results.push({name: journey.name, ok: false, seconds: 0}); await context.close(); continue;
  }
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
