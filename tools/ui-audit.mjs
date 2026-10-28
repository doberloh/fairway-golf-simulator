#!/usr/bin/env node
// EVERY SCREEN AT EVERY SIZE, CHECKED FOR LAYOUT BUGS (the 1.0 polish, 27
// October 2026; docs/UI_POLISH.md).
//
//   node tools/capture/build-hooked.mjs        the capture build it opens
//   node tools/ui-audit.mjs                     every screen, every size
//   node tools/ui-audit.mjs --sizes 390x844,1920x1080 --screens play,main-menu
//   node tools/ui-audit.mjs --quick             four sizes: phone both ways, laptop, 4K
//   node tools/ui-audit.mjs --game bench/ab/main-ui/index.html --out before
//   node tools/ui-audit.mjs --list              the screens and sizes
//
// WHY. Nothing else checks layout: `npm test` cannot see the page and the smoke
// test proves the buttons work, not that they sit right. The audits of the
// UI/UX pass (October 2026) were people looking at pictures, and they found
// what they found -- the owner later saw a menu with two yellow boxes at once.
// This reads what the page drew, on every screen at every size, and names each
// element that breaks a rule: text or controls on top of each other, text cut
// off, things off the screen, content off the middle of its button, two
// highlights at once, targets too small to tap, text too faint or too small.
// The rules are tools/ui-audit-rules.mjs, pure and tested in Node.
//
// IT DRIVES THE GAME AS A PLAYER WOULD where it can (the menu's buttons, the
// steps along a sheet's top), and through the capture build's `lab` only to set
// up a round. Each size is a fresh browser page; a touch screen (phones and
// tablets) gets a touch device, so the phone layout is the real one.
//
// OUTPUT: bench/shots/ui-audit/<out>/ -- a picture of every screen at every
// size (<size>/<screen>.png), findings.json, and report.md (the list, grouped
// by rule). Findings explained in tools/ui-audit-known.json are listed apart
// and do not fail the run; anything else exits non-zero.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {audit, explained, SOFT, RULES} from './ui-audit-rules.mjs';
import {TEXT_SIZE, maxTextSize} from '../src/ui-scale.js';

const argv = process.argv.slice(2);
const opt = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const flag = n => argv.includes(`--${n}`);
const GAME = path.resolve(opt('game') || 'bench/shots/dist-exp/index.html');
const OUT = path.resolve('bench/shots/ui-audit', opt('out') || 'latest');
const KNOWN = fs.existsSync('tools/ui-audit-known.json') ? JSON.parse(fs.readFileSync('tools/ui-audit-known.json', 'utf8')) : [];

// The sizes (docs/reports/ui-polish-goal.md; PLACED): phones both ways,
// tablets both ways, laptops, desktops, 4K, ultrawide. `text` is the Text size
// in percent; the smallest and largest are tried at a laptop and a phone.
const SIZES = [
 {w: 360, h: 740, touch: true}, {w: 390, h: 844, touch: true}, {w: 844, h: 390, touch: true}, {w: 740, h: 360, touch: true},
 {w: 768, h: 1024, touch: true}, {w: 1024, h: 768, touch: true},
 {w: 1280, h: 720}, {w: 1366, h: 768}, {w: 1920, h: 1080}, {w: 2560, h: 1440}, {w: 3840, h: 2160}, {w: 3440, h: 1440},
 // The Text size at its ends. Its largest is capped by what the screen holds
 // (ui-scale.js `maxTextSize`: 100% at 1280x720 and on phones, 150% at
 // 1080p, 200% at 1440p and up), so the largest is tried where it is larger.
 {w: 1280, h: 720, text: TEXT_SIZE.min}, {w: 390, h: 844, touch: true, text: TEXT_SIZE.min}, {w: 1920, h: 1080, text: 'max'}, {w: 2560, h: 1440, text: 'max'},
].map(s => ({...s, text: s.text === 'max' ? maxTextSize(s.w, s.h) : (s.text ?? 100)}))
 .map(s => ({...s, name: `${s.w}x${s.h}${s.text !== 100 ? `@${s.text}` : ''}`}))
 .filter((s, i, all) => all.findIndex(o => o.name === s.name) === i);
const QUICK = ['390x844', '844x390', '1280x720', '3840x2160'];

const wait = (p, ms) => p.waitForTimeout(ms);
const byId = (p, id) => p.evaluate(i => { const e = document.getElementById(i); if (!e) throw Error('no #' + i); e.click(); }, id);
// Back to the main menu from anywhere, as a player would: Escape closes what
// is in front first; a round is left through the pause list's Main menu.
// Home is the main menu with no sheet over it: the menu stays drawn under a
// sheet, and a walk that took that for home pressed the next tile behind the
// sheet (the first full run's range screens show Challenges for that reason).
const atHome = p => p.evaluate(() => { const m = document.getElementById('mainMenu'), d = document.getElementById('drawer'); return !m.hidden && m.checkVisibility() && d.hidden; });
async function home(p) {
 for (let i = 0; i < 8 && !await atHome(p); i++) {
  const menu = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.checkVisibility() && /^main menu$/i.test(b.textContent.trim())); if (b) { b.click(); return true; } return false; });
  if (!menu) await p.keyboard.press('Escape');
  await wait(p, 450);
 }
}
// The steps along a sheet's top, by their names.
const steps = p => p.evaluate(() => [...document.querySelectorAll('#drawer .sx-steps .sx-step')].filter(b => b.checkVisibility()).map(b => ({label: (b.getAttribute('aria-label') || b.textContent).trim(), disabled: b.disabled})));
const step = (p, n) => p.evaluate(n => [...document.querySelectorAll('#drawer .sx-steps .sx-step')].filter(b => b.checkVisibility())[n]?.click(), n);
const clickSel = (p, sel) => p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(e => e.checkVisibility()); if (!e) return false; e.click(); return true; }, sel);

// A ROUND, from the main menu, through the lab (one golfer, or the four the
// round-matrix plays). Waits for the opening flyover to finish.
const GOLFERS = n => ({players: ['Alex', 'Sam', 'Jordan', 'Riley'].slice(0, n).map((name, i) => ({name, team: i % 2 ? 'B' : 'A', hand: i === 2 ? 'LH' : 'RH'})), mode: 'stroke', tee: 'white'});
async function round(p, n = 1, biome = 'autumn') {
 await p.evaluate(([g, b]) => window.lab.course({biome: b, holes: 9, seed: 'AUDIT'}, g), [GOLFERS(n), biome]);
 // The opening flyover ends on its own; wait until a swing can start.
 await p.waitForFunction(() => window.lab.state().canSwing, null, {timeout: 60000}).catch(() => {});
 await wait(p, 1500);
}

// THE SCREENS. Each `go` starts at the main menu and ends on the screen; a
// `walk` screen yields several (each step of a sheet). Names are what the
// report and the pictures use.
const SCREENS = [
 {name: 'main-menu', go: async p => { await wait(p, 600); }},
 // The double yellow boxes: the mouse resting on one tile while the arrows move
 // the focus to another.
 {name: 'main-menu-keys', go: async p => {
  const r = await p.evaluate(() => { const b = document.getElementById('menuPlay').getBoundingClientRect(); return {x: b.x + b.width / 2, y: b.y + b.height / 2}; });
  await p.mouse.move(r.x, r.y); await wait(p, 200);
  await p.keyboard.press('ArrowDown'); await wait(p, 150); await p.keyboard.press('ArrowDown'); await wait(p, 300);
 }},
 {name: 'play', walk: true, go: async (p, shot) => {
  await byId(p, 'menuPlay'); await wait(p, 1200);
  const games = await p.evaluate(() => [...document.querySelectorAll('#drawer [data-game]')].filter(b => b.checkVisibility()).map(b => b.dataset.game));
  await shot('game');
  for (const g of games) {
   if (g === 'studio' || g === 'surprise') continue;
   await clickSel(p, `#drawer [data-game="${g}"]`); await wait(p, 700);
   const st = await steps(p);
   for (let n = 1; n < st.length; n++) { if (st[n].disabled) continue; await step(p, n); await wait(p, 700); await shot(`${g}-${n}-${st[n].label}`); }
   await step(p, 0); await wait(p, 400);
  }
 }},
 {name: 'play-keys', go: async p => { await byId(p, 'menuPlay'); await wait(p, 1200); await p.keyboard.press('ArrowRight'); await wait(p, 150); await p.keyboard.press('ArrowDown'); await wait(p, 300); }},
 {name: 'challenges', walk: true, go: async (p, shot) => {
  await byId(p, 'menuChallenges'); await wait(p, 1500); await shot('first');
  const st = await steps(p);
  for (let n = 1; n < st.length; n++) { if (st[n].disabled) continue; await step(p, n); await wait(p, 700); await shot(`${n}-${st[n].label}`); }
 }},
 {name: 'range', walk: true, go: async (p, shot) => {
  await byId(p, 'menuRange'); await wait(p, 1200); await shot('first');
  const st = await steps(p);
  for (let n = 1; n < st.length; n++) { if (st[n].disabled) continue; await step(p, n); await wait(p, 700); await shot(`${n}-${st[n].label}`); }
 }},
 {name: 'studio-setup', walk: true, go: async (p, shot) => {
  await byId(p, 'menuStudio'); await wait(p, 1500); await shot('');
  // Each settings menu down the left (ui-studio.js puts the tabs there).
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#drawer .panel-tabs>.panel-tab')].filter(b => b.checkVisibility()).map((b, i) => i));
  for (const i of tabs.slice(1)) { await p.evaluate(i => [...document.querySelectorAll('#drawer .panel-tabs>.panel-tab')].filter(b => b.checkVisibility())[i].click(), i); await wait(p, 500); await shot(`menu-${i + 1}`); }
 }},
 // The studio flying, and its Save course box with the picture step.
 {name: 'studio-flying', walk: true, leaves: true, go: async (p, shot) => {
  await byId(p, 'menuStudio'); await wait(p, 1200); await byId(p, 'growStudio');
  await p.waitForFunction(() => document.getElementById('world')?.dataset.mode === 'studio' && document.getElementById('generating')?.hidden !== false, null, {timeout: 120000});
  await wait(p, 2500); await shot('');
  await byId(p, 'studioSave'); await wait(p, 1200); await shot('save');
 }},
 {name: 'settings-menus', walk: true, go: async (p, shot) => {
  await byId(p, 'menuGraphics'); await wait(p, 1000);
  const n = await p.evaluate(() => [...document.querySelectorAll('#drawer .st-cat')].filter(b => b.checkVisibility()).length);
  for (let i = 0; i < n; i++) { await p.evaluate(i => [...document.querySelectorAll('#drawer .st-cat')].filter(b => b.checkVisibility())[i].click(), i); await wait(p, 600); await shot(`cat-${i + 1}`); }
 }},
 {name: 'help-topics', walk: true, go: async (p, shot) => {
  await byId(p, 'menuHelp'); await wait(p, 1000);
  const n = await p.evaluate(() => [...document.querySelectorAll('#drawer .st-cat,#drawer .hp-topic,#drawer [data-topic]')].filter(b => b.checkVisibility()).length);
  for (let i = 0; i < n; i++) { await p.evaluate(i => [...document.querySelectorAll('#drawer .st-cat,#drawer .hp-topic,#drawer [data-topic]')].filter(b => b.checkVisibility())[i].click(), i); await wait(p, 500); await shot(`topic-${i + 1}`); }
 }},
 {name: 'saved-courses', go: async p => { await byId(p, 'menuCourses'); await wait(p, 1200); }},
 {name: 'profile', walk: true, go: async (p, shot) => {
  await byId(p, 'menuProfile'); await wait(p, 1200);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-hub-tab]')].filter(b => b.checkVisibility()).map(b => b.dataset.hubTab));
  for (const t of tabs) { await clickSel(p, `[data-hub-tab="${t}"]`); await wait(p, 600); await shot(t.toLowerCase().replace(/\W+/g, '-')); }
 }},
 {name: 'camera', go: async p => { await byId(p, 'menuCamera'); await wait(p, 1000); }},
 {name: 'graphics', go: async p => { await byId(p, 'menuGraphics'); await wait(p, 1000); }},
 {name: 'sound', go: async p => { await byId(p, 'menuSound'); await wait(p, 1000); }},
 {name: 'monitor', go: async p => { await byId(p, 'menuMonitor'); await wait(p, 1000); }},
 {name: 'help', go: async p => { await byId(p, 'menuHelp'); await wait(p, 1000); }},
 // In a round.
 {name: 'round', round: 1, go: async p => {}},
 {name: 'round-four', round: 4, go: async p => {}},
 {name: 'round-pause', round: 1, go: async p => { await p.keyboard.press('Escape'); await wait(p, 700); }},
 {name: 'round-scorecard', round: 4, go: async p => { await p.keyboard.press('Escape'); await wait(p, 600); await byId(p, 'scoreNav').catch(() => {}); await wait(p, 1200); }},
 {name: 'round-bigmap', round: 1, go: async p => { await p.keyboard.press('KeyM'); await wait(p, 1200); }},
 // The tool windows from the tray (TODO: "the floating tool windows are not
 // swept for layout"): T opens the tray, each of its rows opens a window.
 {name: 'round-tools', round: 1, walk: true, go: async (p, shot) => {
  await p.keyboard.press('KeyT'); await wait(p, 700); await shot('tray');
  const n = await p.evaluate(() => [...document.querySelectorAll('#world .tools-tray .tools-row>button')].filter(b => b.checkVisibility()).length);
  for (let i = 0; i < n; i++) {
   const label = await p.evaluate(i => { const b = [...document.querySelectorAll('#world .tools-tray .tools-row>button')].filter(b => b.checkVisibility())[i]; const t = b?.textContent.trim().slice(0, 20) || String(i); b?.click(); return t; }, i);
   await wait(p, 800); await shot(`tool-${i + 1}-${label}`);
   for (let k = 0; k < 3 && await p.evaluate(() => !!document.querySelector('.popup:not([hidden])') || document.getElementById('drawer').checkVisibility()); k++) { await p.keyboard.press('Escape'); await wait(p, 300); }
   if (!await p.evaluate(() => !!document.querySelector('#world .tools-tray:not([hidden])')?.checkVisibility())) { await p.keyboard.press('KeyT'); await wait(p, 500); }
  }
 }},
 {name: 'round-settings', round: 1, go: async p => { await p.keyboard.press('Escape'); await wait(p, 600); await byId(p, 'pauseSettings'); await wait(p, 1000); }},
 {name: 'round-golfers', round: 4, go: async p => { await p.keyboard.press('Escape'); await wait(p, 600); await p.evaluate(() => [...document.querySelectorAll('.topbar button')].find(b => /golfers/i.test(b.textContent) && b.checkVisibility())?.click()); await wait(p, 1200); }},
 {name: 'round-shot', round: 1, go: async p => {
  await p.evaluate(() => window.__takeShot({speed: 67, vla: 11.5, hla: .5, spin: 2700, spinAxis: -2}));
  await p.waitForFunction(() => !window.lab.state?.().inFlight, null, {timeout: 30000}).catch(() => {}); await wait(p, 1200);
 }},
];
const SCREEN_NAMES = SCREENS.map(s => s.name);

if (flag('list')) { console.log('screens:', SCREEN_NAMES.join(' ')); console.log('sizes:', SIZES.map(s => s.name).join(' ')); process.exit(0); }
const wantSizes = (opt('sizes') || (flag('quick') ? QUICK.join(',') : '')).split(',').filter(Boolean);
const wantScreens = (opt('screens') || '').split(',').filter(Boolean);
const sizes = SIZES.filter(s => !wantSizes.length || wantSizes.includes(s.name));
const screens = SCREENS.filter(s => !wantScreens.length || wantScreens.some(w => s.name === w || s.name.startsWith(w)));
if (!sizes.length || !screens.length) throw Error('no sizes or screens match');
if (!fs.existsSync(GAME)) throw Error(`No build at ${GAME}. Run: node tools/capture/build-hooked.mjs`);

// THE COLLECTOR, run in the page: one record per visible element of the screen
// in front (see ui-audit-rules.mjs for the fields). Kept self-contained -- it
// is sent to the page as source.
function collect() {
 const drawer = document.getElementById('drawer'), menu = document.getElementById('mainMenu');
 const shown = e => !!e && !e.hidden && e.checkVisibility({checkOpacity: true, checkVisibilityCSS: true});
 // The screen in front: a sheet, else the main menu, else the round screen and
 // its windows. Whatever is under a sheet or the menu is covered.
 let roots, skip = new Set();
 if (shown(drawer)) roots = [drawer, ...['toast', 'notices'].map(id => document.getElementById(id)).filter(shown)];
 else if (shown(menu)) roots = [menu, ...['toast'].map(id => document.getElementById(id)).filter(shown)];
 else { roots = [document.body]; skip = new Set([drawer, menu, document.getElementById('splash')].filter(Boolean)); }
 const INTERACTIVE = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=option],[role=switch],[role=slider],[tabindex]:not([tabindex="-1"])';
 const px = v => parseFloat(v) || 0;
 const rectOf = r => ({x: r.x, y: r.y, w: r.width, h: r.height});
 const parse = c => { const m = /rgba?\(([^)]*)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
 const colours = s => (String(s).match(/rgba?\([^)]*\)/g) || []).map(parse).filter(Boolean);
 const near = (a, b) => a && b && a[3] > .5 && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 36;
 const hotOf = el => { const v = getComputedStyle(el).getPropertyValue('--hot').trim(); if (!v) return null; const t = document.createElement('i'); t.style.color = v; document.body.append(t); const c = parse(getComputedStyle(t).color); t.remove(); return c; };
 const hotCache = new Map();
 const hot = el => { const k = getComputedStyle(el).getPropertyValue('--hot').trim(); if (!hotCache.has(k)) hotCache.set(k, hotOf(el)); return hotCache.get(k); };
 // How a control is highlighted: a ring (outline, border, glow, or a traced
 // drop-shadow edge) in the hot colour or in white, and whether it is filled
 // with the hot colour.
 const WHITE = [255, 255, 255, 1];
 const look = (cs, h) => {
  const out = {ring: null, fill: false};
  const ring = c => { if (near(c, h)) out.ring = 'hot'; else if (!out.ring && near(c, WHITE)) out.ring = 'white'; };
  if (cs.outlineStyle !== 'none' && px(cs.outlineWidth) >= 1) ring(parse(cs.outlineColor));
  for (const s of ['Top', 'Right', 'Bottom', 'Left']) if (cs[`border${s}Style`] !== 'none' && px(cs[`border${s}Width`]) >= 2) ring(parse(cs[`border${s}Color`]));
  if (cs.boxShadow !== 'none') for (const sh of cs.boxShadow.split(/,(?![^(]*\))/)) { const m = sh.match(/(-?[\d.]+)px/g) || []; if (m.length >= 4 && Math.abs(px(m[3])) >= 1.5 || /inset/.test(sh)) colours(sh).forEach(ring); }
  if (cs.filter && cs.filter !== 'none') for (const sh of cs.filter.match(/drop-shadow\([^)]*\)[^)]*\)?/g) || []) { const m = sh.match(/(-?[\d.]+)px/g) || []; if (m.some(v => Math.abs(px(v)) >= 2)) colours(sh).forEach(ring); }
  if (near(parse(cs.backgroundColor), h) || (cs.backgroundImage !== 'none' && colours(cs.backgroundImage).some(c => near(c, h)))) out.fill = true;
  return out;
 };
 const recs = [], index = new Map();
 const walk = (el, parent) => {
  if (skip.has(el)) return;
  if (el instanceof HTMLCanvasElement || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
  if (!shown(el)) return;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const isSvg = el instanceof SVGElement;
  let me = parent;
  if (r.width > 0 && r.height > 0) {
   const i = recs.length; me = i; index.set(el, i);
   const own = isSvg ? [] : [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
   let text = own.map(n => n.textContent.trim()).join(' ').replace(/\s+/g, ' '), textRect = null, lines = 0;
   if (!text && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) text = '';
   if (own.length) {
    const rg = document.createRange(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, tops = new Set();
    for (const n of own) { rg.selectNodeContents(n); for (const q of rg.getClientRects()) { if (!q.width) continue; x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom); tops.add(Math.round(q.top)); } }
    if (x1 > x0) { textRect = {x: x0, y: y0, w: x1 - x0, h: y1 - y0}; lines = tops.size; }
   }
   // The drawn font size: the computed size times every scale above it (CSS
   // zoom and transforms both show as the box drawn larger than its layout).
   const scale = el.offsetHeight > 0 ? r.height / el.offsetHeight : (el.offsetWidth > 0 ? r.width / el.offsetWidth : 1);
   const m = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform);
   const skew = m.a ? m.c / m.d : 0;
   const h = hot(el), mine = look(cs, h), before = look(getComputedStyle(el, '::before'), h), after = look(getComputedStyle(el, '::after'), h);
   // What clips this element: the nearest ancestor that hides overflow.
   let clip = null, scroll = null, scrollRoom = 0, fixed = cs.position === 'fixed', ellipsis = cs.textOverflow === 'ellipsis';
   // The ways a box that scrolls sits between this and its clip: past it that
   // way, the text is scrolled to, not cut off (Play's lower cards on a phone).
   const reach = {x: false, y: false};
   for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    const s = getComputedStyle(a);
    // Past a fixed box, the boxes above clip and scroll nothing of it (unless
    // one is its containing block, by a transform, filter or containment --
    // rare here, and then the fixed box moves with it anyway).
    if (fixed && s.transform === 'none' && s.filter === 'none' && !/paint|layout|strict|content/.test(s.contain)) continue;
    if (s.position === 'fixed') fixed = true;
    // Only a box that hides its overflow cuts text off; one that scrolls lets
    // the player reach it (`scroll` below).
    const hides = v => v === 'hidden' || v === 'clip';
    const scrolls = v => v === 'auto' || v === 'scroll';
    if (!clip && scrolls(s.overflowX)) reach.x = true;
    if (!clip && scrolls(s.overflowY)) reach.y = true;
    if (!clip && (hides(s.overflowX) || hides(s.overflowY))) clip = rectOf(a.getBoundingClientRect());
    // A box that scrolls the way that brings this into view: a sideways
    // scroller (a wide table) does not reach what lies below the screen, the
    // sheet scrolling down round it does.
    const rr = a.getBoundingClientRect(), below = r.bottom > innerHeight || r.top < 0, beside = r.right > innerWidth || r.left < 0;
    const scrollsY = (s.overflowY === 'auto' || s.overflowY === 'scroll') && a.scrollHeight > a.clientHeight + 1;
    const scrollsX = (s.overflowX === 'auto' || s.overflowX === 'scroll') && a.scrollWidth > a.clientWidth + 1;
    // The nearest such box that is itself on screen: a box that scrolls but
    // lies wholly below the screen (Help's topic page on a sideways phone) is
    // reached by the sheet scrolling round it, the next one up.
    const onScreen = rr.bottom > 0 && rr.top < innerHeight && rr.right > 0 && rr.left < innerWidth;
    if ((!scroll || !scroll.onScreen) && ((scrollsY && (below || !beside)) || (scrollsX && beside && !below)) && (onScreen || !scroll)) {
     scroll = {...rectOf(rr), onScreen};
     // How far it can still scroll down: content under a fixed foot that can
     // scroll clear of it is how a scrolling sheet works, not an overlap.
     if (s.overflowY === 'auto' || s.overflowY === 'scroll') scrollRoom = a.scrollHeight - a.clientHeight - a.scrollTop;
    }
   }
   // Its own hidden overflow clips its own text at its own box.
   if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && own.length) { clip = rectOf(r); reach.x = reach.y = false; }
   if (clip) clip.reach = reach;
   // What the text sits on is read from the picture afterwards (`behind`): the
   // panels here are leaning ::before layers, gradients and see-through glass
   // over the course, which no walk of CSS colours gets right.
   // Centring: buttons centre their content both ways by default; a flex or grid
   // box centres it when told to.
   const flex = /flex|grid/.test(cs.display);
   const centreX = flex ? /center|space-around|space-evenly/.test(cs.justifyContent) && !/column/.test(cs.flexDirection) || (/column/.test(cs.flexDirection) && /center/.test(cs.alignItems)) : (el.tagName === 'BUTTON' && cs.textAlign === 'center');
   const centreY = flex ? (/column/.test(cs.flexDirection) ? /center/.test(cs.justifyContent) : /center/.test(cs.alignItems)) : el.tagName === 'BUTTON';
   const content = {x: r.x + (px(cs.paddingLeft) + px(cs.borderLeftWidth)) * scale, y: r.y + (px(cs.paddingTop) + px(cs.borderTopWidth)) * scale, w: r.width - (px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth)) * scale, h: r.height - (px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth)) * scale};
   let inner = textRect ? {...textRect} : null;
   for (const c of el.children) {
    if (!shown(c)) continue;
    const cc = getComputedStyle(c); if (cc.position === 'absolute' || cc.position === 'fixed') continue;
    const q = c.getBoundingClientRect(); if (!q.width || !q.height) continue;
    inner = inner ? {x: Math.min(inner.x, q.x), y: Math.min(inner.y, q.y), w: Math.max(inner.x + inner.w, q.right) - Math.min(inner.x, q.x), h: Math.max(inner.y + inner.h, q.bottom) - Math.min(inner.y, q.y)} : rectOf(q);
   }
   const interactive = !isSvg && el.matches(INTERACTIVE) && cs.pointerEvents !== 'none';
   // Covered: the element's middle belongs to something else on top (a sheet
   // over the round screen, a window over a button).
   const cx = Math.min(innerWidth - 1, Math.max(0, r.x + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.y + r.height / 2));
   const top = document.elementFromPoint(cx, cy);
   const covered = (interactive || text) && !!top && top !== el && !el.contains(top) && !top.contains(el) && cs.pointerEvents !== 'none' && r.x + r.width > 0 && r.y + r.height > 0 && r.x < innerWidth && r.y < innerHeight;
   // A tall box whose words sit under something else (Add player's words under
   // a phone sheet's fixed foot, its tile's middle clear of it): judged at the
   // words, for what reads (the contrast rule) -- they are scrolled to, not
   // read through the foot.
   let textCovered = covered;
   if (!covered && text && textRect) {
    // At its top, middle and foot: words half under the foot's buttons read
    // their sampled ground off the buttons.
    const tx = Math.min(innerWidth - 1, Math.max(0, textRect.x + textRect.w / 2));
    textCovered = cs.pointerEvents !== 'none' && [0.15, 0.5, 0.85].some(f => {
     const ty = textRect.y + textRect.h * f;
     if (ty < 0 || ty >= innerHeight) return false;
     const over = document.elementFromPoint(tx, ty);
     return !!over && over !== el && !el.contains(over) && !over.contains(el);
    });
   }
   const path = (() => { const bits = []; for (let a = el; a && bits.length < 3 && a !== document.body; a = a.parentElement) bits.unshift(a.id ? `#${a.id}` : a.tagName.toLowerCase() + ([...a.classList].slice(0, 2).map(c => '.' + c).join(''))); return bits.join(' > ') + (text ? ` "${text.slice(0, 24)}"` : ''); })();
   recs.push({i, parent, path, tag: el.tagName, rect: rectOf(r), skew, interactive, disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true', text,
    textRect, lines, fontPx: px(cs.fontSize) * scale, bold: px(cs.fontWeight) >= 600, color: text ? cs.color : null, bg: null,
    ring: [mine.ring, before.ring, after.ring].includes('hot') ? 'hot' : (mine.ring || before.ring || after.ring), fill: mine.fill || before.fill, multi: el.getAttribute('role') === 'checkbox' || el.type === 'checkbox' || el.hasAttribute('data-multi'),
    // Outlined: a stroke, or two or more tight shadows (the dark edge drawn
    // round the letters that lets text read on any ground).
    outlined: (() => { if (px(cs.webkitTextStrokeWidth) >= 1) return true; const sh = cs.textShadow === 'none' ? [] : cs.textShadow.split(/,(?![^(]*\))/); // Two or more TIGHT shadows (blur 3 px or less) make the outline; a soft
    // glow beside them (the cards' symbols) does not undo it.
    return sh.filter(x => { const m = x.match(/(-?[0-9.]+)px/g) || []; return m.length >= 3 && px(m[2]) <= 3; }).length >= 2; })(),
    focused: el === document.activeElement, clip, ellipsis, scroll, scrollRoom, fixed, centreX, centreY, content, inner, covered, textCovered});
  }
  if (isSvg) return;
  for (const c of el.children) walk(c, me);
 };
 for (const root of roots) walk(root, -1);
 return {recs, view: {width: innerWidth, height: innerHeight}, focus: document.activeElement?.id || document.activeElement?.tagName};
}

// WHAT EACH TEXT SITS ON, READ FROM THE PICTURE. For each text box: the
// pixels in it that are clearly not the text's own colour (further from it
// than 60% of the furthest), and of those the one a tenth of the way from the
// nearest in brightness -- the low-contrast patch the Xbox guideline says to
// measure against, without letting one stray pixel decide. Returned as a
// colour; the ratio is worked in Node with the palette's own `contrast`.
async function behind(page, recs) {
 const png = (await page.screenshot({type: 'png'})).toString('base64');
 const boxes = recs.map((r, k) => r.text && r.textRect && r.color ? {k, box: r.textRect, fg: r.color} : null).filter(Boolean);
 const got = await page.evaluate(async ([src, boxes]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', {willReadFrequently: true}); g.drawImage(img, 0, 0);
  const parse = s => { const m = /rgba?\(([^)]*)\)/.exec(s); const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2]]; };
  const lum = ([r, g, b]) => .2126 * r * r + .7152 * g * g + .0722 * b * b;
  const out = {};
  for (const {k, box, fg} of boxes) {
   const x = Math.max(0, Math.floor(box.x)), y = Math.max(0, Math.floor(box.y)), w = Math.min(img.width - x, Math.ceil(box.w)), h = Math.min(img.height - y, Math.ceil(box.h));
   if (w < 1 || h < 1) continue;
   const d = g.getImageData(x, y, w, h).data, f = parse(fg), px = [];
   let far = 0;
   for (let i = 0; i < d.length; i += 4) { const dist = Math.hypot(d[i] - f[0], d[i + 1] - f[1], d[i + 2] - f[2]); px.push([d[i], d[i + 1], d[i + 2], dist]); far = Math.max(far, dist); }
   const cand = px.filter(p => p[3] > .6 * far);
   if (!cand.length) continue;
   const lf = lum(f);
   cand.sort((a, b) => Math.abs(lum(a) - lf) - Math.abs(lum(b) - lf));
   const pick = cand[Math.floor(cand.length * .1)];
   out[k] = `rgb(${pick[0]},${pick[1]},${pick[2]})`;
  }
  return out;
 }, [png, boxes]);
 for (const [k, bg] of Object.entries(got)) recs[k].bg = bg;
 return png;
}

const browser = await chromium.launch({args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});
const all = [];
// Every string each screen shows (the words pass reads it: UI_POLISH.md, P1).
const texts = {};
fs.mkdirSync(OUT, {recursive: true});
async function openAt(size) {
 const ctx = await browser.newContext({viewport: {width: size.w, height: size.h}, deviceScaleFactor: 1, hasTouch: !!size.touch, isMobile: !!size.touch && size.w < 1024});
 const page = await ctx.newPage();
 page.errors = [];
 page.on('pageerror', e => page.errors.push(e.message));
 page.on('console', m => m.type() === 'error' && page.errors.push(m.text().slice(0, 200)));
 // Low, so the audit is quick and light; the interface is the same on every tier.
 await page.addInitScript(t => localStorage.setItem('fairway-graphics-v1', JSON.stringify({quality: 'low', autoResolution: false, frameCap: 0, textSize: t})), size.text);
 await page.addInitScript(() => { if (!localStorage.getItem('fairway-profiles-v1')) localStorage.setItem('fairway-profiles-v1', JSON.stringify({version: 3, main: 'pa', profiles: [{id: 'pa', name: 'Alex', created: Date.now(), xp: 9400, counters: {}, bests: {}, rounds: []}]})); });
 await page.goto(pathToFileURL(GAME).href);
 await page.waitForFunction(() => window.lab && !document.getElementById('mainMenu').hidden && !document.getElementById('splash'), null, {timeout: 120000});
 await wait(page, 800);
 return page;
}
const t0 = Date.now();
try {
 for (const size of sizes) {
  // `stale`: the last screen left the game somewhere home() cannot leave
  // (the studio asks about saving), so the next starts on a fresh page.
  let page = await openAt(size), inRound = 0, stale = false;
  const dir = path.join(OUT, size.name);
  fs.mkdirSync(dir, {recursive: true});
  for (const s of screens) {
   const shot = async label => {
    const name = label ? `${s.name}~${label.replace(/[^\w-]+/g, '-').toLowerCase()}` : s.name;
    const got = await page.evaluate(collect);
    const png = await behind(page, got.recs);
    const found = audit(got.recs, got.view, {touch: !!size.touch}).map(f => ({...f, screen: name, size: size.name}));
    fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.from(png, 'base64'));
    all.push(...found);
    for (const r of got.recs) if (r.text) (texts[name] ??= new Set()).add(r.text);
    process.stdout.write(`${size.name} ${name}: ${found.filter(f => !SOFT.has(f.rule)).length}\n`);
   };
   try {
    // A round screen starts from the plain round: a fresh page for a new group
    // (lab.course from inside a round would ask about leaving it), else
    // whatever the last screen opened closed with Escape until nothing is in
    // front -- never one Escape more, which would pause.
    const reopen = async () => { await page.context().close(); page = await openAt(size); };
    if (s.round) {
     if (inRound !== s.round) { if (inRound) await reopen(); await round(page, s.round); inRound = s.round; }
     else for (let i = 0; i < 6 && await page.evaluate(() => document.getElementById('drawer').checkVisibility() || document.getElementById('app').classList.contains('rh-paused') || document.getElementById('world').classList.contains('aim-view')); i++) { await page.keyboard.press('Escape'); await wait(page, 400); }
    } else { if (inRound || stale) { await reopen(); inRound = 0; stale = false; } await home(page); }
    if (s.leaves) stale = true;
    if (s.walk) await s.go(page, shot); else { await s.go(page); await shot(''); }
   } catch (e) { all.push({rule: 'walk-failed', screen: s.name, size: size.name, path: '-', detail: e.message.split('\n')[0]}); console.log(`${size.name} ${s.name}: FAILED ${e.message.split('\n')[0]}`); }
   for (const e of page.errors.splice(0)) all.push({rule: 'page-error', screen: s.name, size: size.name, path: '-', detail: e});
  }
  await page.context().close();
 }
} finally { await browser.close(); }

// THE REPORT. A finding that recurs at several sizes on the same element is one
// line with its sizes, so the list reads as things to fix, not a flood.
const known = [], open = [], soft = [];
for (const f of all) { const k = explained(f, KNOWN); (k ? known : SOFT.has(f.rule) ? soft : open).push(k ? {...f, why: k.why} : f); }
const group = list => { const m = new Map(); for (const f of list) { const key = `${f.rule}|${f.screen}|${f.path}`; const g = m.get(key) || {...f, sizes: []}; g.sizes.push(f.size); m.set(key, g); } return [...m.values()]; };
const lines = [`# Interface audit -- ${new Date().toISOString().slice(0, 16)}`, '', `Build: ${path.relative(process.cwd(), GAME)}; ${sizes.length} sizes, ${screens.length} screens; ${Math.round((Date.now() - t0) / 1000)} s.`, '',
 `**${open.length} findings** (${group(open).length} distinct), ${known.length} explained, ${soft.length} ellipses.`, ''];
for (const rule of [...RULES, 'walk-failed', 'page-error']) {
 const g = group(open.filter(f => f.rule === rule));
 if (!g.length) continue;
 lines.push(`## ${rule} (${g.length})`, '');
 for (const f of g) lines.push(`- **${f.screen}** \`${f.path}\` -- ${f.detail} [${f.sizes.join(', ')}]`);
 lines.push('');
}
if (known.length) { lines.push('## Explained', ''); for (const f of group(known)) lines.push(`- ${f.rule} **${f.screen}** \`${f.path}\` -- ${f.why} [${f.sizes.join(', ')}]`); lines.push(''); }
if (soft.length) { lines.push('## Ellipses (reported, not failed)', ''); for (const f of group(soft)) lines.push(`- **${f.screen}** \`${f.path}\` -- ${f.detail} [${f.sizes.join(', ')}]`); }
fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify({open, known, soft}, null, 1));
fs.writeFileSync(path.join(OUT, 'texts.md'), Object.entries(texts).map(([k, v]) => `## ${k}\n\n${[...v].map(t => '- ' + t).join('\n')}\n`).join('\n'));
console.log(`\n${open.length} findings (${group(open).length} distinct), ${known.length} explained. ${path.relative(process.cwd(), path.join(OUT, 'report.md'))}`);
process.exit(open.length ? 1 : 0);
