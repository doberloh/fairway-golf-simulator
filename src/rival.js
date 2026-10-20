// CHALLENGE A FRIEND (20 October 2026; the owner's pick from IDEAS.md).
//
// One golfer's card from a finished stroke-play round, packed into a code with
// the course it was played on and every shot behind it. A friend pastes the
// code, plays the same course, and is measured against the card hole by hole,
// with the challenger's shots flown again and drawn on each hole. No server:
// the code travels however the two of them like, as a course code does.
//
// DECIDED WITH THE OWNER (20 October 2026): the card AND the ball flights; the
// result is total strokes, with each hole's winner shown beside it; the rules
// the challenger played under are SHOWN, not forced -- the friend plays their
// own, and the result names where they differed; and a challenge is played on
// the SAME VERSION OF FAIRWAY it was made on, or not at all. The version is
// package.json's and the build's commit (main.js GAME_VERSION): the commit
// tells two releases apart even when package.json was not bumped between
// them, and every copy of one release download shares it.
//
// THE SAME VERSION IS WHAT LETS A CODE CARRY SHOTS RATHER THAN FLIGHTS. The
// ball model changes between versions with no number of its own
// (GENERATOR_VERSION covers the ground, not the flight), so on another version
// the same launch numbers fly somewhere else. On the same one, the model has no
// randomness and the wind is a pure function of the settings (both measured,
// PROJECT_HANDOFF *replayShot*), so each shot is its five launch numbers, where
// it was struck from, and what the flight met: the flagstick, the floodlight
// poles, the challenger's turf. The friend's machine flies them again.
//
// REJECTED, 20 October 2026: the paths themselves, thinned to within 10 cm and
// packed in centimetres. It worked on any version, but cost about 84 characters
// a shot (126 at 5 cm, 72 at 20 cm; 139 generated shots), so a typical 18-hole
// round came to about 7,500 characters -- past what some chat apps accept.
// Shots cost about 21 characters each, about 2,300 for a typical round (the
// same 139 shots, 20 October 2026). The owner chose the version rule.
//
// EXACT, OR IT IS NOT THE SAME SHOT. One part in a thousand of launch speed
// moves a drive's finish about 30 cm (docs/reports/MULTIPLAYER_FEASIBILITY.md),
// so the numbers cannot be rounded when the code is made. They are rounded
// BEFORE THE BALL FLIES (`gridShot`, main.js takeShot): to 0.01 m/s, 0.01
// degree, 0.001 degree of aim, 1 rpm and 1 mm -- far finer than any launch
// monitor reports -- so what the code carries is exactly what was flown.
//
// THE FINISH TRAVELS TOO. Two machines that agree to fourteen decimal places
// can still fall on opposite sides of a lip or a branch (the same study), so
// each shot carries where its ball stopped, and a re-flown shot that ends
// somewhere else is drawn to the true finish. The card never depends on it:
// the card is carried whole.
//
// Pure: no DOM, no three.js. main.js records the shots, flies them again, draws
// them and shows the comparison; tests/rival.test.mjs checks the rest.

import {SCHEMA_VERSION, GENERATOR_VERSION, validateSettings, migrateSettings} from './settings-schema.js';
import {courseSettings, settingsDiff, checksum} from './course-library.js';
import {puttingConfig} from './putting.js';
import {firmnessName} from './firmness.js';

const PREFIX = 'FWC1';
const KEY = 'fairway-rivals-v1';
export const MAX_RIVALS = 20;
// Generous ceilings, so a damaged or hostile code cannot make the game fly
// more than a round's worth: no hole needs 40 shots.
const MAX_SHOTS_PER_HOLE = 40, MAX_CODE = 50000;

// BYTES AS TEXT. Base64 that survives a URL, a chat message and a paste.
export function bytesToB64(bytes) {
 let bin = '';
 for (const b of bytes) bin += String.fromCharCode(b);
 return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64ToBytes(text) {
 if (!/^[A-Za-z0-9_-]*$/.test(text)) throw Error('not base64');
 const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
 return Uint8Array.from(bin, ch => ch.charCodeAt(0));
}
const textToB64 = s => bytesToB64(new TextEncoder().encode(s));
const b64ToText = s => new TextDecoder().decode(b64ToBytes(s));

// Whole numbers, small ones in one byte: seven bits a byte, and zigzag for
// signed ones so -1 is small too.
function writeUint(out, z) {
 while (z >= 128) { out.push(z % 128 + 128); z = Math.floor(z / 128); }
 out.push(z);
}
const writeInt = (out, n) => writeUint(out, n < 0 ? -2 * n - 1 : 2 * n);
function reader(bytes) {
 let at = 0;
 const uint = () => {
  let n = 0, scale = 1;
  for (;;) {
   if (at >= bytes.length || scale > 2 ** 35) throw Error('truncated');
   const b = bytes[at++];
   n += (b & 127) * scale;
   if (b < 128) return n;
   scale *= 128;
  }
 };
 const int = () => { const z = uint(); return z % 2 ? -(z + 1) / 2 : z / 2; };
 return {uint, int, get done() { return at >= bytes.length; }};
}

// THE GRID. Each field and how many steps make one unit: aim in thousandths
// of a degree, speed in hundredths of a metre a second, and so on. A value on
// the grid is k / steps, and k comes back exactly from it.
const GRID = {aim: 1000, speed: 100, vla: 100, hla: 100, spin: 1, spinAxis: 100};
const MM = 1000;
const onGrid = (v, steps) => Math.round(v * steps) / steps;
// The shot as it will be flown: every number simulateShot reads, on the grid.
// `height` (a ball sitting up) and `roll` (a putt's own pace) when it has them.
export function gridShot(shot) {
 const out = {...shot, origin: {...shot.origin, x: onGrid(shot.origin.x, MM), z: onGrid(shot.origin.z, MM)}};
 for (const [k, steps] of Object.entries(GRID)) out[k] = onGrid(Number(shot[k]) || 0, steps);
 if (Number.isFinite(shot.height) && shot.height) out.height = onGrid(shot.height, MM);
 if (Number.isFinite(shot.roll) && shot.roll) out.roll = onGrid(shot.roll, 100);
 return out;
}

// THE SHOT LOG of a round in progress: every ball struck, in order, as
// {hole, seat, s: [whole numbers]}. It lives beside the round, not inside it --
// inside, it would be copied into each of the thirty mulligan snapshots -- so
// a mulligan takes the last one back here, as it takes back the last tracer.
//
// `s` is [flags, x, z, aim, speed, vla, hla, spin, spinAxis, endX, endZ,
// height?, roll?]: positions in millimetres, the rest in grid steps. Flags:
// 1 the flagstick was in, 2 the floodlight poles stood, 4 a height follows,
// 8 a roll follows.
const FLAG_IN = 1, POLES = 2, HEIGHT = 4, ROLL = 8;
export function shotNumbers(shot, end, {flagstick = false, poles = false} = {}) {
 const g = gridShot(shot), k = (v, steps) => Math.round(v * steps);
 const flags = (flagstick ? FLAG_IN : 0) | (poles ? POLES : 0) | (g.height ? HEIGHT : 0) | (g.roll ? ROLL : 0);
 const s = [flags, k(g.origin.x, MM), k(g.origin.z, MM), ...Object.entries(GRID).map(([key, steps]) => k(g[key], steps)), k(end.x, MM), k(end.z, MM)];
 if (g.height) s.push(k(g.height, MM));
 if (g.roll) s.push(k(g.roll, 100));
 return s;
}
// Back to something to fly: {shot, end, flagstick, poles}.
export function shotFrom(s) {
 const [flags, x, z, ...rest] = s, keys = Object.entries(GRID);
 const shot = {origin: {x: x / MM, z: z / MM}};
 keys.forEach(([key, steps], i) => { shot[key] = rest[i] / steps; });
 let at = keys.length + 2;
 if (flags & HEIGHT) shot.height = rest[at++] / MM;
 if (flags & ROLL) shot.roll = rest[at++] / 100;
 return {shot, end: {x: rest[keys.length] / MM, z: rest[keys.length + 1] / MM}, flagstick: !!(flags & FLAG_IN), poles: !!(flags & POLES)};
}
const SHOT_LENGTH = s => 11 + (s[0] & HEIGHT ? 1 : 0) + (s[0] & ROLL ? 1 : 0);
const cleanShot = s => Array.isArray(s) && s.length >= 11 && s.length <= 13 && s.every(Number.isSafeInteger) && s[0] >= 0 && s[0] < 16 && s.length === SHOT_LENGTH(s)
 && Math.abs(s[1]) < 2e7 && Math.abs(s[2]) < 2e7 && s[4] >= 0 && Math.abs(s[9]) < 2e7 && Math.abs(s[10]) < 2e7;

export function recordShot(log, {hole, seat, shot, end, flagstick, poles}) {
 log.push({hole, seat, s: shotNumbers(shot, end, {flagstick, poles})});
 return log;
}
export const takeBackShot = log => { log.pop(); return log; };
// A log read back from a save: anything that is not a clean entry is dropped.
export function normaliseShots(d) {
 if (!Array.isArray(d)) return [];
 return d.filter(f => f && Number.isInteger(f.hole) && f.hole >= 0 && f.hole < 18 && Number.isInteger(f.seat) && f.seat >= 0 && f.seat < 4 && cleanShot(f.s))
  .slice(0, 18 * 4 * MAX_SHOTS_PER_HOLE).map(({hole, seat, s}) => ({hole, seat, s: [...s]}));
}

// WHAT A GOLFER PLAYED UNDER, as the code carries it and the setup shows it.
// The turf is the challenger's own (it is a player setting, not the course's),
// and it is also what their shots are flown again on.
export function rulesOf(round, seat, settings = {}, input = 'monitor') {
 const p = round.players[seat] || {}, putting = puttingConfig(round.putting), t = settings.turf || {};
 const turf = Object.fromEntries(['stimp', 'fairway', 'semi', 'rough', 'firmness'].filter(k => Number.isFinite(t[k])).map(k => [k, t[k]]));
 return {
  tee: p.tee || round.tee,
  putting: {mode: putting.mode, one: putting.one, two: putting.two, three: putting.three},
  ob: round.outOfBounds,
  lie: round.monitorLie,
  input: input === 'meter' ? 'meter' : 'monitor',
  turf,
 };
}
const PUTTING_NAMES = {holeout: 'hole out', dartboard: 'dartboard putting', decimal: 'decimal putting'};
const puttingText = p => p.mode === 'holeout' ? PUTTING_NAMES.holeout : `${PUTTING_NAMES[p.mode]} (${p.one}/${p.two}/${p.three} yd)`;
// Each rule in words, for the setup's list.
export function describeRules(r) {
 const t = r.turf || {};
 return [
  ['Tees', `${r.tee[0].toUpperCase()}${r.tee.slice(1)}`],
  ['Putting', puttingText(r.putting)],
  ['Out of bounds', r.ob === 'e5' ? 'two-stroke drop (Local Rule E-5)' : 'stroke and distance'],
  ['Lie penalty on monitor shots', r.lie ? 'on' : 'off'],
  ['Played on', r.input === 'meter' ? 'the Swing Meter' : 'a launch monitor'],
  ...(Number.isFinite(t.stimp) ? [['Green speed', `Stimp ${t.stimp}`]] : []),
  ...(Number.isFinite(t.firmness) ? [['Green firmness', firmnessName(t.firmness)]] : []),
  ...(['fairway', 'semi', 'rough'].every(k => Number.isFinite(t[k])) ? [['Roll', `fairway ${t.fairway}%, semi-rough ${t.semi}%, rough ${t.rough}%`]] : []),
 ];
}
// WHERE TWO GOLFERS' RULES DIFFERED, as sentences naming the challenger. Empty
// when they played the same game.
export function rulesDiff(theirs, mine, name = 'They') {
 const a = new Map(describeRules(theirs)), b = new Map(describeRules(mine)), out = [];
 for (const [k, v] of a) if (b.has(k) && b.get(k) !== v) out.push(`${k}: ${name} ${v}, you ${b.get(k)}.`);
 return out;
}

// THE CODE. Two parts behind the prefix -- the card and course as text, the
// shots as bytes -- and a checksum over both, so a code cut short in a message
// is caught rather than half read.
//
// In the bytes, per hole: how many shots, then each shot's numbers. A shot
// struck from exactly where the one before it stopped (most of them) says so in
// its flags (16) instead of carrying its position again; the first of a hole
// is measured from nothing. `log` is the round's shot log, of which only this
// golfer's entries are packed.
const SAME_SPOT = 16;
export function makeRivalCode({name, course, version, generator = GENERATOR_VERSION, settings, holes, pars, card, putts = [], rules, log = [], seat = 0, day = '', weekly = ''}) {
 if (![9, 18].includes(holes)) throw Error('Only a round of 9 or 18 holes can be sent.');
 if (!Array.isArray(card) || card.length !== holes || !card.every(v => Number.isFinite(v) && v > 0 && v < 100)) throw Error('Only a finished card can be sent.');
 if (typeof version !== 'string' || !version) throw Error('This build of Fairway has no version to put on a challenge.');
 const head = {v: 1, s: SCHEMA_VERSION, g: generator, f: version.slice(0, 32), n: String(name || 'Golfer').slice(0, 24), c: String(course || 'A Fairway course').slice(0, 40),
  d: settingsDiff(validateSettings({...settings, holes})), h: holes, r: pars, k: card, u: putts.slice(0, holes).map(v => Number.isFinite(v) ? v : null), q: rules, t: String(day).slice(0, 10), w: weekly || ''};
 const bytes = [];
 for (let h = 0; h < holes; h++) {
  const mine = log.filter(f => f.hole === h && f.seat === seat && cleanShot(f.s)).slice(0, MAX_SHOTS_PER_HOLE);
  writeUint(bytes, mine.length);
  let prev = [0, 0];
  for (const {s} of mine) {
   const same = s[1] === prev[0] && s[2] === prev[1];
   writeUint(bytes, s[0] | (same ? SAME_SPOT : 0));
   if (!same) { writeInt(bytes, s[1] - prev[0]); writeInt(bytes, s[2] - prev[1]); }
   for (let i = 3; i < 9; i++) writeInt(bytes, s[i]);
   writeInt(bytes, s[9] - s[1]); writeInt(bytes, s[10] - s[2]);
   for (let i = 11; i < s.length; i++) writeInt(bytes, s[i]);
   prev = [s[9], s[10]];
  }
 }
 const body = `${textToB64(JSON.stringify(head))}.${bytesToB64(bytes)}`;
 return `${PREFIX}.${body}.${checksum(body)}`;
}
export const isRivalCode = code => String(code ?? '').replace(/\s+/g, '').startsWith(PREFIX + '.');

function readShots(text, holes) {
 const r = reader(b64ToBytes(text)), out = [];
 for (let h = 0; h < holes; h++) {
  const n = r.uint();
  if (n > MAX_SHOTS_PER_HOLE) throw Error('too many shots');
  const hole = [];
  let prev = [0, 0];
  for (let i = 0; i < n; i++) {
   const raw = r.uint(), flags = raw & 15;
   if (raw >= 32) throw Error('bad flags');
   const at = raw & SAME_SPOT ? prev : [prev[0] + r.int(), prev[1] + r.int()];
   const s = [flags, at[0], at[1]];
   for (let k = 3; k < 9; k++) s.push(r.int());
   s.push(at[0] + r.int(), at[1] + r.int());
   if (flags & HEIGHT) s.push(r.int());
   if (flags & ROLL) s.push(r.int());
   if (!cleanShot(s)) throw Error('bad shot');
   hole.push(s);
   prev = [s[9], s[10]];
  }
  out.push(hole);
 }
 if (!r.done) throw Error('trailing bytes');
 return out;
}

const score = v => Number.isFinite(v) && v > 0 && v < 100;
// Reads a code into a challenge: {name, course, version, generator, settings,
// holes, pars, card, putts, rules, shots: [[numbers, ...] per hole], day,
// weekly}. Refuses anything incomplete, altered or from a newer Fairway, in
// words a player can act on. Whether THIS Fairway can play it is
// `rivalProblem`'s question, so an unplayable one can still be shown.
export function readRivalCode(code) {
 const text = String(code ?? '').replace(/\s+/g, '');
 if (text.length > MAX_CODE) throw Error('That code is far too long to be a Fairway challenge.');
 const parts = text.split('.');
 if (parts[0] !== PREFIX) throw Error('That does not look like a Fairway challenge code.');
 const body = `${parts[1]}.${parts[2]}`;
 // A code cut short in a message has lost its end, checksum and all.
 if (parts.length !== 4 || checksum(body) !== parts[3]) throw Error('This challenge code looks incomplete or altered. Copy the whole code and try again.');
 let head;
 try { head = JSON.parse(b64ToText(parts[1])); } catch { throw Error('This challenge code could not be read.'); }
 if (!head || typeof head !== 'object' || Array.isArray(head)) throw Error('This challenge code could not be read.');
 if (head.v !== 1 || (Number.isInteger(head.s) && head.s > SCHEMA_VERSION)) throw Error('This challenge was made by a newer version of Fairway. Update Fairway, then paste it again.');
 const holes = head.h;
 if (![9, 18].includes(holes) || !Array.isArray(head.k) || head.k.length !== holes || !head.k.every(score)) throw Error('This challenge code carries no complete card.');
 const pars = Array.isArray(head.r) && head.r.length === holes && head.r.every(p => Number.isInteger(p) && p >= 3 && p <= 6) ? head.r : null;
 const putts = Array.isArray(head.u) ? head.u.slice(0, holes).map(v => Number.isFinite(v) && v >= 0 && v < 100 ? v : null) : [];
 let settings;
 try { settings = courseSettings(validateSettings(migrateSettings(head.d || {}, Number.isInteger(head.s) ? head.s : 1))); } catch { throw Error('This challenge code’s course could not be read.'); }
 if (settings.holes !== holes) throw Error('This challenge code’s course could not be read.');
 const q = head.q || {}, t = q.turf && typeof q.turf === 'object' ? q.turf : {};
 let putting;
 try { putting = puttingConfig(q.putting); } catch { putting = puttingConfig(); }
 const rules = {tee: ['blue', 'white', 'red'].includes(q.tee) ? q.tee : 'blue', putting: {mode: putting.mode, one: putting.one, two: putting.two, three: putting.three},
  ob: q.ob === 'e5' ? 'e5' : 'stroke', lie: q.lie !== false, input: q.input === 'meter' ? 'meter' : 'monitor',
  turf: Object.fromEntries(['stimp', 'fairway', 'semi', 'rough', 'firmness'].filter(k => Number.isFinite(t[k]) && t[k] >= 0 && t[k] < 1000).map(k => [k, t[k]]))};
 let shots;
 try { shots = readShots(parts[2], holes); } catch { throw Error('This challenge code’s shots could not be read.'); }
 return {name: String(head.n || 'Golfer').slice(0, 24), course: String(head.c || 'A Fairway course').slice(0, 40), version: typeof head.f === 'string' ? head.f.slice(0, 32) : '',
  generator: Number.isInteger(head.g) ? head.g : 0, settings, holes, pars, card: head.k, putts, rules, shots, day: typeof head.t === 'string' ? head.t.slice(0, 10) : '',
  weekly: typeof head.w === 'string' && /^WEEK-[0-9]{4}-[0-9]{2}@g[0-9]{1,4}$/.test(head.w) ? head.w : ''};
}
// Why this Fairway cannot play a challenge, or '' when it can. The version is
// the rule (the owner, 20 October 2026); the generator is checked as well so a
// build stamped with the wrong version still cannot grow other holes under it.
export function rivalProblem(rival, {version, generator = GENERATOR_VERSION} = {}) {
 if (!rival) return 'There is no challenge to play.';
 if (rival.version !== version || rival.generator !== generator)
  return `${rival.name} played this on Fairway ${rival.version || 'of an unknown version'}, and this is Fairway ${version}. A challenge is played on the same version it was made on, so the course and every shot come out the same. One of you needs to update.`;
 return '';
}

// THE COMPARISON. Total strokes decide it (the owner, 20 October 2026); each
// hole's winner is shown beside it. Only holes both golfers have finished
// count, so it reads correctly part of the way round. `lead` is their total
// minus yours: positive means you are ahead.
export function compareCards(theirs, mine) {
 const holes = theirs.map((t, h) => {
  const m = mine?.[h];
  if (!Number.isFinite(m) || !Number.isFinite(t)) return {theirs: t, mine: Number.isFinite(m) ? m : null, won: null};
  return {theirs: t, mine: m, won: m < t ? 'you' : m > t ? 'them' : 'halved'};
 });
 const both = holes.filter(h => h.won);
 const sum = k => Math.round(both.reduce((a, h) => a + h[k], 0) * 100) / 100;
 const theirTotal = sum('theirs'), myTotal = sum('mine');
 const count = w => both.filter(h => h.won === w).length;
 return {holes, played: both.length, finished: both.length === theirs.length, theirTotal, myTotal, lead: Math.round((theirTotal - myTotal) * 100) / 100,
  won: count('you'), lost: count('them'), halved: count('halved')};
}
// The comparison in a line: "2 ahead of Sam after 7", "Sam wins by 3".
export function compareText(cmp, name, who = 'You') {
 const n = String(Math.abs(cmp.lead));
 if (!cmp.played) return `${name}’s card is waiting on the first hole.`;
 if (cmp.finished) return cmp.lead > 0 ? `${who} beat ${name} by ${n}` : cmp.lead < 0 ? `${name} wins by ${n}` : `${who} tied with ${name}`;
 const after = `after ${cmp.played}`;
 return cmp.lead > 0 ? `${n} ahead of ${name} ${after}` : cmp.lead < 0 ? `${n} behind ${name} ${after}` : `Level with ${name} ${after}`;
}
export const holesText = cmp => `Holes won ${cmp.won}, lost ${cmp.lost}, halved ${cmp.halved}`;

// THE CHALLENGES A PLAYER HAS PASTED, kept on this device so a round against
// one still has its card when it is resumed. Newest first; the oldest go.
function readStore() {
 try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return Array.isArray(d?.rivals) ? d.rivals : []; } catch { return []; }
}
function writeStore(list) {
 try { localStorage.setItem(KEY, JSON.stringify({version: 1, rivals: list})); } catch { throw Error('This device has no room left to keep the challenge.'); }
}
const newId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Keeps a pasted code. The same code pasted twice is one challenge.
export function saveRival(code) {
 const rival = readRivalCode(code), clean = String(code).replace(/\s+/g, '');
 const list = readStore(), same = list.find(r => r.code === clean);
 const entry = {id: same?.id || newId(), received: Date.now(), code: clean};
 writeStore([entry, ...list.filter(r => r.code !== clean)].slice(0, MAX_RIVALS));
 return {id: entry.id, received: entry.received, ...rival};
}
export function listRivals() {
 const out = [];
 for (const r of readStore()) { try { out.push({id: r.id, received: r.received, ...readRivalCode(r.code)}); } catch {} }
 return out;
}
export const findRival = id => (id && listRivals().find(r => r.id === id)) || null;
