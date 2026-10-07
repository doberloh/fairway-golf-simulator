// THE PLAYERS' PROFILES: who plays on this device, what each of them has hit,
// and every round each has played -- kept in this browser until its site data
// is cleared.
//
// One store under one key: every golfer who has ever been in a group here, and
// which of them is the MAIN profile -- the device's owner, who starts every new
// group as player 1 and whom the menu and My profile open on. Apart from that
// the main profile is a profile like any other; everyone's shots are counted.
//
// The store has its own version and its own migrations, so a later build can
// add to it without losing what is already there. Profiles are deliberately NOT
// part of a round or a course: those can be exported, shared and deleted, and a
// golfer's history should survive all three.
//
// ADDING A STAT is one entry in COUNTERS or BESTS and one line in `tallyShot`
// that counts it. Old profiles simply read zero for a counter they have never
// seen, so it needs no migration; the page lists whatever the registry holds.
// A change to the SHAPE of the record -- renaming a counter, restructuring a
// round -- bumps PROFILE_VERSION and adds a MIGRATIONS entry, with a test that
// the older record still loads.
//
// WHOSE STATS. Every golfer in a group is a profile: a round's player carries
// the profile's id, and each seat's shots and card go to that profile. A player
// with no id -- a save from before profiles -- is matched by name, ignoring case.
import {simHandicap} from './handicap.js';

export const PROFILE_KEY = 'fairway-profiles-v1';
// The single-profile record the first build wrote, read once and converted.
export const LEGACY_KEY = 'fairway-profile-v1';
export const PROFILE_VERSION = 2;
export const MAX_PROFILES = 60;
// The same limit a player's name has on a round, so the profile name always
// fits in the group editor it is copied into.
export const MAX_PLAYER_NAME = 24;
export const MAX_HISTORY = 150;

// Running totals. `help` is what the profile page says the number means.
export const COUNTERS = [
 {key: 'shots', label: 'Shots hit', help: 'Every ball struck on a course, putts included. Mulligans count -- the ball was still hit.'},
 {key: 'sandShots', label: 'Sand shots', help: 'Shots played from a bunker.'},
 {key: 'bunkers', label: 'Bunkers found', help: 'Shots that came to rest in sand.'},
 {key: 'water', label: 'Water hazards', help: 'Balls that found water.'},
 {key: 'outOfBounds', label: 'Out of bounds', help: 'Balls that left the course.'},
 {key: 'trees', label: 'Trees hit', help: 'Every trunk the ball struck, counted per hit.'},
 {key: 'houses', label: 'Houses hit', help: 'Every time a ball struck a house.'},
 {key: 'chipIns', label: 'Chip-ins', help: 'Holed from off the green, tee shots aside.'},
 {key: 'lipOuts', label: 'Lip-outs', help: 'Balls that caught the cup and stayed out.'},
 {key: 'mulligans', label: 'Mulligans', help: 'Shots taken back.'},
 {key: 'distance', label: 'Ball travel', unit: 'mi', scale: 1 / 1760, help: 'How far all your balls have travelled, in miles.'},
 {key: 'airtime', label: 'Hang time', unit: 'min', scale: 1 / 60, help: 'Minutes your balls have spent in the air.'},
 {key: 'rangeBalls', label: 'Range balls', help: 'Balls hit on the driving range. They count for nothing else here.'},
];
// Personal bests: the largest value ever seen.
export const BESTS = [
 {key: 'longestDrive', label: 'Longest drive', unit: 'yd', help: 'The farthest tee shot with a driver, carry and roll, that stayed in play.'},
 {key: 'longestPutt', label: 'Longest putt holed', unit: 'ft'},
 {key: 'ballSpeed', label: 'Fastest ball speed', unit: 'mph', help: 'Off the club face, on a course or the range.'},
];
// Score names, best first. `ace` is kept out of the eagle and albatross counts
// so the rows add up to the holes played.
export const SCORE_TYPES = [
 {key: 'ace', label: 'Holes in one'},
 {key: 'albatross', label: 'Albatross or better'},
 {key: 'eagle', label: 'Eagles'},
 {key: 'birdie', label: 'Birdies'},
 {key: 'par', label: 'Pars'},
 {key: 'bogey', label: 'Bogeys'},
 {key: 'double', label: 'Double bogeys'},
 {key: 'triple', label: 'Triple or worse'},
];
// Decimal putting makes fractional scores; they are named by the nearest whole
// stroke, so a 4.3 on a par 4 is a par.
export function scoreType(score, par) {
 if (score === 1) return 'ace';
 const rel = Math.round(score - par);
 return rel <= -3 ? 'albatross' : rel === -2 ? 'eagle' : rel === -1 ? 'birdie' : rel === 0 ? 'par' : rel === 1 ? 'bogey' : rel === 2 ? 'double' : 'triple';
}

// `version` n upgrades a store FROM version n to n + 1.
const MIGRATIONS = {
 // 1 -> 2: one profile becomes a store of them, and that profile is main.
 1: d => { const id = newProfileId(); return {version: 2, main: id, profiles: [{...d, id}]}; },
};
export const newProfileId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const sameGolfer = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim().length > 0;

export function validName(name) {
 const n = String(name ?? '').trim().replace(/\s+/g, ' ');
 if (!n.length) throw Error('Type a name to play under.');
 if (n.length > MAX_PLAYER_NAME) throw Error(`Keep it to ${MAX_PLAYER_NAME} characters or fewer.`);
 return n;
}

export function blankProfile(name, now = Date.now(), id = newProfileId()) {
 return {id, name: validName(name), created: now, counters: {}, bests: {}, rounds: []};
}

const finite = v => Number.isFinite(v) ? v : 0;
// What survives from a stored record. Anything unreadable is dropped rather
// than allowed to take the profile down: a golfer who loses one corrupt round
// keeps the rest, and one who loses a counter keeps the others.
export function normaliseProfile(d) {
 if (!d || typeof d !== 'object' || typeof d.id !== 'string') return null;
 let name;
 try { name = validName(d.name); } catch { return null; }
 const counters = {}, bests = {};
 for (const {key} of COUNTERS) if (Number.isFinite(d.counters?.[key]) && d.counters[key] >= 0) counters[key] = d.counters[key];
 for (const {key} of BESTS) if (Number.isFinite(d.bests?.[key]) && d.bests[key] > 0) bests[key] = d.bests[key];
 const rounds = Array.isArray(d.rounds) ? d.rounds.filter(r => r && typeof r.id === 'string' && Array.isArray(r.card)).slice(0, MAX_HISTORY) : [];
 return {id: d.id, name, created: finite(d.created), counters, bests, rounds};
}
// The whole store. A profile that cannot be read is dropped, not the store; two
// with the same name or id keep the first. Main falls back to the first profile
// when it points at nothing. No profiles at all reads as no store.
export function normalise(raw) {
 if (!raw || typeof raw !== 'object') return null;
 let d = raw, v = Number.isInteger(raw.version) ? raw.version : 1;
 while (v < PROFILE_VERSION) { if (!MIGRATIONS[v]) return null; d = MIGRATIONS[v](d); v++; }
 if (v > PROFILE_VERSION) return null;
 const profiles = [], ids = new Set();
 for (const raw of Array.isArray(d.profiles) ? d.profiles : []) {
  const p = normaliseProfile(raw);
  if (!p || ids.has(p.id) || profiles.some(q => sameGolfer(q.name, p.name))) continue;
  ids.add(p.id); profiles.push(p);
  if (profiles.length >= MAX_PROFILES) break;
 }
 if (!profiles.length) return null;
 return {version: PROFILE_VERSION, main: ids.has(d.main) ? d.main : profiles[0].id, profiles};
}

// ---- storage --------------------------------------------------------------
// The store, or null when nobody has been named on this device yet. A store
// written by the first, single-profile build is converted on the way in.
export function loadProfiles() {
 try {
  const raw = localStorage.getItem(PROFILE_KEY) ?? localStorage.getItem(LEGACY_KEY);
  return normalise(JSON.parse(raw || 'null'));
 } catch { return null; }
}
// A full browser keeps the store it has rather than throwing in the middle of a
// shot. Round history is what gets big, so the oldest half of everyone's goes.
export function storeProfiles(store) {
 const write = () => { localStorage.setItem(PROFILE_KEY, JSON.stringify(store)); try { localStorage.removeItem(LEGACY_KEY); } catch {} };
 try { write(); return true; }
 catch {
  try { for (const p of store.profiles) p.rounds = p.rounds.slice(0, Math.ceil(p.rounds.length / 2)); write(); return true; }
  catch { return false; }
 }
}
export const findProfile = (store, id) => store?.profiles.find(p => p.id === id) || null;
export const profileByName = (store, name) => store?.profiles.find(p => sameGolfer(p.name, name)) || null;
export const mainProfile = store => findProfile(store, store?.main);

// A new golfer. The first one on a device becomes main. Names are unique on a
// device, ignoring case, because a name is what a player picks from a list.
export function addProfile(store, name) {
 const n = validName(name);
 if (profileByName(store, n)) throw Error(`There is already a player called ${profileByName(store, n).name}.`);
 if (store && store.profiles.length >= MAX_PROFILES) throw Error(`This device keeps at most ${MAX_PROFILES} players.`);
 const p = blankProfile(n);
 store ||= {version: PROFILE_VERSION, main: p.id, profiles: []};
 store.profiles.push(p);
 storeProfiles(store);
 return {store, profile: p};
}
export function renameProfile(store, id, name) {
 const p = findProfile(store, id), n = validName(name);
 if (!p) throw Error('That player is no longer on this device.');
 const other = profileByName(store, n);
 if (other && other !== p) throw Error(`There is already a player called ${other.name}.`);
 p.name = n; storeProfiles(store); return p;
}
export function setMainProfile(store, id) { if (findProfile(store, id)) { store.main = id; storeProfiles(store); } return store; }
// Everyone but main can be removed; main has to be handed to someone else first.
export function deleteProfile(store, id) {
 if (id === store.main) throw Error('Make someone else the main profile first.');
 store.profiles = store.profiles.filter(p => p.id !== id); storeProfiles(store); return store;
}

// ---- recording ------------------------------------------------------------
// The history entry for a round, created the first time anything happens on it.
// `meta` is what main.js knows about the round: id, me, mode, players, tee,
// holes, endless, course {name, settings, seed, biome, generator, schema}.
function entryFor(p, meta, now) {
 let e = p.rounds.find(r => r.id === meta.id);
 if (!e) {
  e = {id: meta.id, started: now, card: []};
  p.rounds.unshift(e);
  if (p.rounds.length > MAX_HISTORY) p.rounds.length = MAX_HISTORY;
 }
 Object.assign(e, {updated: now, me: meta.me, mode: meta.mode, players: meta.players, tee: meta.tee,
  holes: meta.holes, endless: !!meta.endless, finished: !!meta.finished, course: meta.course});
 return e;
}
const holeRecord = (e, hole) => (e.card[hole] ||= {});

// One shot by the profile's golfer. Pure apart from the clock: it changes `p`
// and returns it, so the counting can be tested without a browser.
//
// `f` is the shot as main.js saw it:
//   range         true on the driving range -- only the range count moves
//   lie           where it was played from ('tee', 'sand', 'green', ...)
//   rest          where it came to rest
//   hazard        'Water', 'Out of bounds' or null
//   holed, lipped, trees, houses
//   yards, airtime, mph
//   teeShot       the first stroke on the hole
//   driver        played with the driver
//   puttFeet      the putt's length, when played from the green
//   strokes       the golfer's score on the hole after this shot, penalties in
//   hole          {index, par, yards}
export function tallyShot(p, f, meta = null, now = Date.now()) {
 const c = p.counters, add = (k, n = 1) => { c[k] = (c[k] || 0) + n; };
 const best = (k, v) => { if (Number.isFinite(v) && v > (p.bests[k] || 0)) p.bests[k] = Math.round(v * 10) / 10; };
 best('ballSpeed', f.mph);
 if (f.range) { add('rangeBalls'); return p; }
 add('shots');
 if (f.lie === 'sand') add('sandShots');
 if (!f.hazard && f.rest === 'sand') add('bunkers');
 if (f.hazard === 'Water') add('water');
 if (f.hazard === 'Out of bounds') add('outOfBounds');
 if (f.trees) add('trees', f.trees);
 if (f.houses) add('houses', f.houses);
 if (f.lipped && !f.holed) add('lipOuts');
 if (f.holed && f.lie !== 'green' && !f.teeShot) add('chipIns');
 if (Number.isFinite(f.yards)) add('distance', Math.max(0, f.yards));
 if (Number.isFinite(f.airtime)) add('airtime', Math.max(0, f.airtime));
 if (f.teeShot && f.driver && !f.hazard) best('longestDrive', f.yards);
 if (f.holed && f.lie === 'green') best('longestPutt', f.puttFeet);
 // Fairway and green in regulation belong to the HOLE, so they are written on
 // the round's card rather than counted: a hole replayed after a mulligan
 // overwrites its own record instead of counting twice.
 if (meta && f.hole) {
  const h = holeRecord(entryFor(p, meta, now), f.hole.index);
  h.par = f.hole.par; h.yards = f.hole.yards;
  if (f.teeShot && f.hole.par >= 4) h.fairway = !f.hazard && f.rest === 'fairway';
  if (!f.hazard && (f.rest === 'green' || f.holed) && f.strokes <= f.hole.par - 2) h.gir = true;
  else if (f.teeShot) h.gir = false;
 }
 return p;
}
export function tallyMulligan(p) { p.counters.mulligans = (p.counters.mulligans || 0) + 1; return p; }

// The hole as the scorecard has it. Called whenever the round is saved, so a
// mulligan that un-holes a putt takes the score back off as well.
export function syncHole(p, meta, {index, par, yards, score, putts}, now = Date.now()) {
 const e = p.rounds.find(r => r.id === meta.id);
 if (!e && !Number.isFinite(score)) return p;
 const h = holeRecord(entryFor(p, meta, now), index);
 h.par = par; h.yards = yards;
 if (Number.isFinite(score)) { h.score = score; h.putts = Number.isFinite(putts) ? putts : null; }
 else { delete h.score; delete h.putts; }
 return p;
}
export function deleteHistory(p, id) { p.rounds = p.rounds.filter(r => r.id !== id); return p; }

// ---- reading --------------------------------------------------------------
const scored = h => h && Number.isFinite(h.score) && Number.isInteger(h.par);
// A round the scoring totals believe: individual cards only. A scramble card is
// the team's score, so it is listed but kept out.
const ownScore = r => r.mode !== 'scramble';
// What the handicap is allowed to see: a whole 9 or 18 on a course that has an
// end, every hole scored with its par and length.
export function qualifies(r) {
 if (r.endless || !ownScore(r) || ![9, 18].includes(r.holes)) return false;
 for (let i = 0; i < r.holes; i++) { const h = r.card[i]; if (!scored(h) || !(h.yards > 0)) return false; }
 return true;
}

export function roundTotals(r) {
 const holes = r.card.filter(scored);
 const score = holes.reduce((t, h) => t + h.score, 0), par = holes.reduce((t, h) => t + h.par, 0);
 return {played: holes.length, score: Math.round(score * 100) / 100, par, rel: Math.round((score - par) * 100) / 100};
}

// Everything the profile page shows, worked from the record.
export function profileSummary(p) {
 const types = Object.fromEntries(SCORE_TYPES.map(t => [t.key, 0]));
 const byPar = {3: [0, 0], 4: [0, 0], 5: [0, 0]};
 let holes = 0, putts = 0, puttHoles = 0, fairways = 0, fairwayChances = 0, gir = 0, girChances = 0;
 const played = p.rounds.filter(r => r.card.some(scored));
 for (const r of played) {
  if (!ownScore(r)) continue;
  for (const h of r.card) {
   if (!scored(h)) continue;
   holes++;
   types[scoreType(h.score, h.par)]++;
   if (byPar[h.par]) { byPar[h.par][0] += h.score; byPar[h.par][1]++; }
   if (Number.isFinite(h.putts)) { putts += h.putts; puttHoles++; }
   if (typeof h.fairway === 'boolean') { fairwayChances++; if (h.fairway) fairways++; }
   if (typeof h.gir === 'boolean') { girChances++; if (h.gir) gir++; }
  }
 }
 const full = played.filter(qualifies).sort((a, b) => a.started - b.started);
 const bestOf = n => {
  const list = full.filter(r => r.holes === n).map(r => ({r, t: roundTotals(r)}));
  return list.length ? list.reduce((a, b) => b.t.rel < a.t.rel ? b : a) : null;
 };
 return {
  name: p.name, created: p.created, counters: p.counters, bests: p.bests,
  roundsPlayed: played.length, roundsFinished: played.filter(r => r.finished).length,
  holes, types,
  scoringAverage: Object.fromEntries(Object.entries(byPar).map(([par, [s, n]]) => [par, n ? Math.round(s / n * 100) / 100 : null])),
  puttsPerHole: puttHoles ? Math.round(putts / puttHoles * 100) / 100 : null,
  fairways: {hit: fairways, of: fairwayChances}, greens: {hit: gir, of: girChances},
  best9: bestOf(9), best18: bestOf(18),
  handicap: simHandicap(full.map(r => ({holes: r.card.slice(0, r.holes).map(h => ({par: h.par, yards: h.yards, score: h.score}))}))),
  history: played,
 };
}

// ---- backup ---------------------------------------------------------------
// EVERY PLAYER ON THIS DEVICE, AS A FILE. Profiles live in one browser, and the
// game opened from disk, from the server and on a phone are three different
// browsers as far as storage goes -- so a file is how a history moves, and how
// it survives clearing the browser.
export const BACKUP_KIND = 'fairway-profiles';
export function exportProfiles(store, now = Date.now()) {
 if (!store) throw Error('There are no players on this device to back up.');
 return JSON.stringify({kind: BACKUP_KIND, version: PROFILE_VERSION, exported: now, main: store.main, profiles: store.profiles}, null, 1);
}
// When a player was last active: their newest round, or when they were made.
const lastActive = p => Math.max(finite(p.created), ...p.rounds.map(r => finite(r.updated) || finite(r.started)));

// A BACKUP IS MERGED, NEVER POURED OVER. Restoring onto a device that already
// has players must not lose any of them, so:
//  - a player the device does not have is added;
//  - the SAME player (same id -- the file came from this device, or from one it
//    was restored to) keeps whichever copy was active more recently, because
//    counters cannot be added together without counting shots twice;
//  - a DIFFERENT player with a name already taken here comes in renamed,
//    "Sam (2)", since a name is what a player is picked by.
// The device's main profile stays main; a device with nobody on it takes the
// file's. Reads a backup of any version this build knows, the single-profile
// first build's included. Returns the store and what happened.
export function importProfiles(store, text) {
 let raw;
 try { raw = JSON.parse(text); } catch { throw Error('That file is not a Fairway player backup.'); }
 if (raw?.kind && raw.kind !== BACKUP_KIND) throw Error('That file is not a Fairway player backup.');
 const incoming = normalise(raw);
 if (!incoming) throw Error('That file has no players this version of Fairway can read.');
 const report = {added: [], updated: [], kept: [], renamed: []};
 store ||= {version: PROFILE_VERSION, main: incoming.main, profiles: []};
 for (const p of incoming.profiles) {
  const same = findProfile(store, p.id);
  if (same) {
   if (lastActive(p) > lastActive(same)) { Object.assign(same, p); report.updated.push(p.name); } else report.kept.push(same.name);
   continue;
  }
  if (store.profiles.length >= MAX_PROFILES) throw Error(`This device keeps at most ${MAX_PROFILES} players.`);
  let name = p.name;
  for (let n = 2; profileByName(store, name); n++) name = `${p.name.slice(0, MAX_PLAYER_NAME - 4)} (${n})`;
  if (name !== p.name) report.renamed.push(`${p.name} → ${name}`);
  store.profiles.push({...p, name});
  report.added.push(name);
 }
 if (!findProfile(store, store.main)) store.main = findProfile(store, incoming.main) ? incoming.main : store.profiles[0].id;
 storeProfiles(store);
 return {store, ...report};
}
