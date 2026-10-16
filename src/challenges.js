// CHALLENGES (Phase 7, 14 October 2026; widened to a table of them, 16 October
// 2026 -- the owner's plan, docs/reports/CHALLENGES_PLAN.md, local).
//
// ONE TABLE DRIVES THEM. Every challenge is a row of plain data below: what it
// is, where it plays, how its balls are placed and scored, and its bronze,
// silver and gold. The Challenges screen, the bar on the course, the results
// card, the records, the medals and the tests all read it; a new challenge is
// one row (plus a scoring or spot kind in challenge-play.js or
// challenge-spots.js only when it needs a new one).
//
// They are practice games, as they always were: no card, no round history, no
// handicap, no hole XP, no mulligans, nothing saved part-way. Every one is
// open from the start (the owner, 15 and 16 October 2026); medals are what is
// chased, and the XP for playing one again is small and capped a day
// (progression.js, `challengePay`).
//
// WHERE THEY PLAY (the owner, 16 October 2026): every hole challenge plays on
// ONE FIXED COURSE, the Challenge Course (CHALLENGE_COURSE below), so a score
// is the same test for everyone on the same course generator; range ones on
// the driving range, which has no seed at all.
//
// Skins was a challenge until it became a round format (16 October 2026;
// skins.js). Its record stays here with the others' (`recordChallenge(prof,
// 'skins', won)`), so profiles keep the shape they had.
//
// Pure. Every name, medal score and spot rule is PLACED (RESEARCH.md
// *Challenges and medals*).

import {DEFAULT_COURSE, validateSettings} from './settings-schema.js';

const FOOT = .3048, YARD = .9144;

// THE CHALLENGE COURSE: eighteen holes at the default settings from a fixed
// seed, chosen because it hosts every challenge (a par 3, water to carry, a
// greenside bunker, a short side, a green big enough for long lag putts) --
// tests/challenge-spots.test.mjs proves it. When a generator change means it
// no longer does, the seed moves on (`CHALLENGE-2`), written down in RESEARCH
// like a generator bump; records and medals are kept across it.
export const CHALLENGE_SEED = 'CHALLENGE-1';
export const CHALLENGE_BIOME = 'pnw';
export const challengeCourseSettings = () => validateSettings({...DEFAULT_COURSE, seed: CHALLENGE_SEED, biome: CHALLENGE_BIOME, holes: 18});
export const CHALLENGE_COURSE_NAME = 'The Challenge Course';

// The tabs, in order. Head to head and Rounds join in the plan's third step.
export const GROUPS = [
 {id: 'tee', name: 'Off the tee'},
 {id: 'approach', name: 'Approach'},
 {id: 'range', name: 'On the range'},
 {id: 'short', name: 'Short game'},
 {id: 'putting', name: 'Putting'},
];
export const MEDALS = ['', 'Bronze', 'Silver', 'Gold'];

// A ROW:
//   id, name, group, how      what the player is told
//   where   'course' (a hole of the Challenge Course) or 'range'
//   hole    which hole (challenge-spots.js `chooseHole`): par3, shortPar3,
//           longest, longPar4, par4, spots (the first the spots fit),
//           bigGreen (the green with room for the longest putts)
//   spot    where each ball is played from (challenge-spots.js `spotsFor`);
//           none = the tee, or the mat on the range
//   targets range only: the target each ball is aimed at, in yards
//   calls   'shape' (draw or fade), 'height' (high or low), 'carry' (yards)
//   club    a club every ball must be hit with (the nearest in the bag)
//   balls   balls a golfer plays (the most, for a streak)
//   order   'turns' (a ball each in turn), 'streak' (in turn, out at the first
//           miss), 'spotOut' (a golfer plays the spot out, then the next)
//   ball    how one ball scores (challenge-play.js `scoreBall`)
//   play    how a play's balls make the score: max, min, sum, mean, updown
//   better  'high' or 'low'
//   medals  [bronze, silver, gold]; `scale` says what they are measured on:
//           driverPlus (yards over the golfer's own driver carry),
//           driverShare (a share of it), lengthFeet (a share of the hole's
//           length, in feet)
//   show    how the score is written: feet, yards, points, count, updown
//   noun    for a count
//   putts   always hole out, whatever the group's putting setting
//   long    a long challenge (pays double for its first medals)
export const CHALLENGES = [
 // OFF THE TEE
 {id: 'long', name: 'Long drive', group: 'tee', how: 'Six drives down the longest hole. The longest that stops on the fairway counts.',
  where: 'course', hole: 'longest', balls: 6, order: 'turns', ball: 'driveFairway', play: 'max', better: 'high', medals: [5, 20, 35], scale: 'driverPlus', show: 'yards'},
 {id: 'fairway', name: 'Fairway finder', group: 'tee', how: 'Ten drives down a long par 4. Count the fairways.',
  where: 'course', hole: 'longPar4', balls: 10, order: 'turns', ball: 'fairway', play: 'sum', better: 'high', medals: [5, 7, 9], show: 'count', noun: 'fairways'},
 {id: 'straight', name: 'Long and straight', group: 'tee', how: 'Six drives. Each scores its yards if it stops on the fairway or first cut, nothing if not; the average counts.',
  where: 'course', hole: 'longest', balls: 6, order: 'turns', ball: 'driveInPlay', play: 'mean', better: 'high', medals: [.75, .85, .95], scale: 'driverShare', show: 'yards'},
 {id: 'streak', name: 'Fairway streak', group: 'tee', how: 'Drive until one misses the fairway, twenty at most. Fairways in a row.',
  where: 'course', hole: 'longPar4', balls: 20, order: 'streak', ball: 'fairway', play: 'sum', better: 'high', medals: [3, 6, 10], show: 'count', noun: 'in a row'},
 {id: 'shape', name: 'Draw and fade', group: 'tee', how: 'Six drives, each called draw or fade. It counts if it curves the called way by five yards or more and stops on the fairway.',
  where: 'course', hole: 'longPar4', balls: 6, order: 'turns', calls: 'shape', ball: 'shapeFairway', play: 'sum', better: 'high', medals: [2, 4, 6], show: 'count', noun: 'shaped'},
 {id: 'zone', name: 'Find the zone', group: 'tee', how: 'A 30-yard circle on the fairway, where your driver reaches. Three points in it, one on the fairway anywhere else.',
  where: 'course', hole: 'longPar4', balls: 5, order: 'turns', ball: 'zone', play: 'sum', better: 'high', medals: [5, 9, 13], show: 'points'},
 // APPROACH
 {id: 'closest', name: 'Closest to the pin', group: 'approach', how: 'Five balls at a par 3. Your nearest counts.',
  where: 'course', hole: 'par3', balls: 5, order: 'turns', ball: 'pinFeet', play: 'min', better: 'low', medals: [.08, .04, .02], scale: 'lengthFeet', show: 'feet'},
 {id: 'ace', name: 'Hole-in-one hunt', group: 'approach', how: 'Ten balls at the shortest par 3. Holed 25 points, inside 3 feet 5, inside 10 feet 2, on the green 1.',
  where: 'course', hole: 'shortPar3', balls: 10, order: 'turns', ball: 'acePoints', play: 'sum', better: 'high', medals: [10, 20, 35], show: 'points'},
 {id: 'ladder', name: 'Distance ladder', group: 'approach', how: 'From the fairway at 100, 125, 150, 175 and 200 yards. Within 3% of the distance 3 points, 6% 2, on the green 1.',
  where: 'course', hole: 'longest', spot: {kind: 'line', yards: [100, 125, 150, 175, 200]}, balls: 5, order: 'turns', ball: 'ringShare', rings: [.03, .06], play: 'sum', better: 'high', medals: [5, 9, 13], show: 'points'},
 {id: 'water', name: 'Over the water', group: 'approach', how: 'From the fairway with water between you and the green. Count the balls that stop on the green.',
  where: 'course', hole: 'spots', spot: {kind: 'water'}, balls: 5, order: 'turns', ball: 'onGreen', play: 'sum', better: 'high', medals: [2, 3, 5], show: 'count', noun: 'on the green'},
 {id: 'hold', name: 'Hold the green', group: 'approach', how: 'Five balls at a par 3. It counts if it stops on the green within 5 yards of where it landed.',
  where: 'course', hole: 'par3', balls: 5, order: 'turns', ball: 'holdGreen', play: 'sum', better: 'high', medals: [2, 3, 5], show: 'count', noun: 'held'},
 // ON THE RANGE -- targets are paint, not greens, so these score where a ball LANDS
 {id: 'dartboard', name: 'Dartboard', group: 'range', how: 'Six balls at the 150 target, scored where they land: within 3 yards 10, 6 yards 5, on the target 3, within 15 yards 1.',
  where: 'range', targets: [150, 150, 150, 150, 150, 150], balls: 6, order: 'turns', ball: 'dart', play: 'sum', better: 'high', medals: [15, 30, 45], show: 'points'},
 {id: 'clock', name: 'Around the clock', group: 'range', how: 'One ball at each target, 50 to 250. Landing within 2% of the distance 10, 4% 5, 6% 3, 10% 1.',
  where: 'range', targets: [50, 100, 150, 200, 250], balls: 5, order: 'turns', ball: 'clock', play: 'sum', better: 'high', medals: [12, 25, 38], show: 'points'},
 {id: 'number', name: 'On the number', group: 'range', how: 'Each ball has a carry called for it. Your average miss in yards counts.',
  where: 'range', balls: 6, order: 'turns', calls: 'carry', ball: 'carryMiss', play: 'mean', better: 'low', medals: [8, 5, 3], show: 'yards'},
 {id: 'oneclub', name: 'One club', group: 'range', how: 'Your 8-iron at the 50, 100 and 150 targets, two balls each, scored as Around the clock. Any other club scores nothing.',
  where: 'range', targets: [50, 50, 100, 100, 150, 150], club: 'iron8', balls: 6, order: 'turns', ball: 'clock', play: 'sum', better: 'high', medals: [12, 25, 38], show: 'points'},
 {id: 'highlow', name: 'High and low', group: 'range', how: 'Your 7-iron at the 150, each ball called high or low. It counts if it flies high or low enough for the call and lands within 15 yards.',
  where: 'range', targets: [150, 150, 150, 150, 150, 150], club: 'iron7', balls: 6, order: 'turns', calls: 'height', ball: 'height', play: 'sum', better: 'high', medals: [3, 4, 6], show: 'count', noun: 'called'},
 {id: 'curve', name: 'Curve it', group: 'range', how: 'Your 7-iron at the 150, each ball called draw or fade. It counts if it curves the called way by 4 yards or more and lands within 15 yards.',
  where: 'range', targets: [150, 150, 150, 150, 150, 150], club: 'iron7', balls: 6, order: 'turns', calls: 'shape', ball: 'curveTarget', play: 'sum', better: 'high', medals: [2, 4, 6], show: 'count', noun: 'curved'},
 // SHORT GAME
 {id: 'updown', name: 'Up and down', group: 'short', how: 'Five drops round a green. Hole out from each; water or out of bounds costs two strokes, and a drop is picked up after eight.',
  where: 'course', hole: 'par4', spot: {kind: 'around', lo: 3, hi: 18}, balls: 5, order: 'spotOut', ball: 'strokes', play: 'updown', better: 'high', medals: [2, 3, 5], show: 'updown'},
 {id: 'sand', name: 'Sand save', group: 'short', how: 'Five drops in greenside bunkers. Hole out from each, as in Up and down.',
  where: 'course', hole: 'spots', spot: {kind: 'bunker'}, balls: 5, order: 'spotOut', ball: 'strokes', play: 'updown', better: 'high', medals: [1, 3, 4], show: 'updown'},
 {id: 'chipclose', name: 'Chip it close', group: 'short', how: 'Six chips from 5 to 25 yards off the green, one stroke each. Your total feet from the hole counts.',
  where: 'course', hole: 'par4', spot: {kind: 'around', lo: 5, hi: 25, grass: true}, balls: 6, order: 'turns', ball: 'feetLeft', play: 'sum', better: 'low', medals: [60, 36, 18], show: 'feet'},
 {id: 'chipin', name: 'Chip-in challenge', group: 'short', how: 'Ten chips from 5 to 20 yards off the green. Holed 5 points, inside 3 feet 2, inside 6 feet 1.',
  where: 'course', hole: 'par4', spot: {kind: 'around', lo: 5, hi: 20, grass: true}, balls: 10, order: 'turns', ball: 'chipPoints', play: 'sum', better: 'high', medals: [6, 12, 20], show: 'points'},
 {id: 'pitch', name: 'Pitch ladder', group: 'short', how: 'From the fairway at 30, 40, 50, 60 and 70 yards. Within 5% of the distance 3 points, 10% 2, on the green 1.',
  where: 'course', hole: 'longPar4', spot: {kind: 'line', yards: [30, 40, 50, 60, 70]}, balls: 5, order: 'turns', ball: 'ringShare', rings: [.05, .1], play: 'sum', better: 'high', medals: [5, 9, 13], show: 'points'},
 {id: 'shortside', name: 'Short side', group: 'short', how: 'Five drops with a bunker between you and the pin. Hole out from each, as in Up and down.',
  where: 'course', hole: 'spots', spot: {kind: 'shortSide'}, balls: 5, order: 'spotOut', ball: 'strokes', play: 'updown', better: 'high', medals: [1, 2, 4], show: 'updown'},
 // PUTTING -- always hole out
 {id: 'fourft', name: 'Four-footers', group: 'putting', how: 'Ten putts from four feet, from all round the hole. Count the ones you hole.',
  where: 'course', hole: 'par4', spot: {kind: 'putt', feet: Array(10).fill(4), angles: 'seeded'}, balls: 10, order: 'turns', ball: 'holed', play: 'sum', better: 'high', medals: [6, 8, 10], show: 'count', noun: 'holed', putts: true},
 {id: 'puttladder', name: 'Putting ladder', group: 'putting', how: 'From 3 feet; every putt you hole moves you back 3 feet, up to 30. A miss ends it. Your longest holed counts.',
  where: 'course', hole: 'bigGreen', spot: {kind: 'putt', feet: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30], angles: 'line'}, balls: 10, order: 'streak', ball: 'holedFeet', play: 'max', better: 'high', medals: [9, 15, 24], show: 'feet', putts: true},
 {id: 'lag', name: 'Lag putting', group: 'putting', how: 'From 30, 40, 50, 60 and 70 feet, or as far as the green allows. First putt only: your total feet left counts.',
  where: 'course', hole: 'bigGreen', spot: {kind: 'putt', feet: [30, 40, 50, 60, 70], angles: 'seeded', shrink: true}, balls: 5, order: 'turns', ball: 'feetLeft', play: 'sum', better: 'low', medals: [25, 15, 8], show: 'feet', putts: true},
 {id: 'world', name: 'Around the world', group: 'putting', how: 'Eight putts from eight feet, one from each point of the compass, so every break. Count the ones you hole.',
  where: 'course', hole: 'par4', spot: {kind: 'putt', feet: Array(8).fill(8), angles: 'compass'}, balls: 8, order: 'turns', ball: 'holed', play: 'sum', better: 'high', medals: [4, 6, 8], show: 'count', noun: 'holed', putts: true},
];
export const challenge = id => CHALLENGES.find(c => c.id === id) || null;
export const challengesIn = group => CHALLENGES.filter(c => c.group === group);
// How many strokes a spot may take before it is picked up. PLACED.
export const UPDOWN_GIVE_UP = 8;
// A ball in water or out of bounds where every ball's distance is added up. PLACED.
export const HAZARD_FEET = 99;
export const isUpAndDown = strokes => Number.isFinite(strokes) && strokes <= 2;

// The SCORE of a play, compared: is `a` better than `b`? (Up and down: more
// made, then fewer strokes.) A null is no score at all.
export function better(def, a, b) {
 if (a == null) return false;
 if (b == null) return true;
 if (def.play === 'updown') return a.made > b.made || (a.made === b.made && a.strokes < b.strokes);
 return def.better === 'low' ? a < b : a > b;
}
// The bronze, silver and gold scores for a golfer: `driver` is the carry of
// their own driver in yards, `length` the hole's in yards. Rounded the way
// they are shown.
export function medalTargets(def, {driver = 250, length = 160} = {}) {
 if (def.scale === 'driverPlus') return def.medals.map(m => Math.round(driver + m));
 if (def.scale === 'driverShare') return def.medals.map(m => Math.round(driver * m));
 if (def.scale === 'lengthFeet') return def.medals.map(m => Math.round(length * 3 * m));
 return def.medals;
}
// The medal a score reaches: 0 none, 1 bronze, 2 silver, 3 gold.
export function medalOf(def, score, ctx) {
 if (score == null) return 0;
 const value = def.play === 'updown' ? score.made : score, t = medalTargets(def, ctx);
 let m = 0;
 t.forEach((x, i) => { if (def.better === 'low' ? value <= x : value >= x) m = i + 1; });
 return m;
}

// HOW A SCORE IS WRITTEN.
export const feetText = f => f == null ? 'missed' : f < 1 ? `${Math.round(f * 12)} in` : `${Math.floor(f)} ft ${Math.round((f % 1) * 12) % 12} in`;
export function scoreText(def, score) {
 if (score == null) return def.show === 'feet' && def.better === 'low' ? 'no ball on the green' : 'no score';
 if (def.show === 'updown') return `${score.made} up and down, ${score.strokes} strokes`;
 if (def.show === 'feet') return def.play === 'sum' ? `${Math.round(score)} ft` : feetText(score);
 if (def.show === 'yards') return `${Math.round(score)} yd`;
 if (def.show === 'points') return `${Math.round(score)} point${Math.round(score) === 1 ? '' : 's'}`;
 return `${Math.round(score)} ${def.noun || ''}`.trim();
}
// What a medal asks for, as the card writes it: "Gold: 9 fairways".
export function targetText(def, value) {
 if (def.show === 'updown') return `${value} up and down`;
 if (def.show === 'feet') return def.play === 'sum' ? `${value} ft or less` : def.better === 'low' ? `within ${value} ft` : `${value} ft`;
 if (def.show === 'yards') return def.better === 'low' ? `${value} yd or less` : `${value} yd`;
 if (def.show === 'points') return `${value} points`;
 return `${value} ${def.noun || ''}`.trim();
}

// RECORDS (My profile). Today's first three keep the shapes they were saved in
// -- closest {feet}, long {yards}, updown {made, strokes} -- and every other
// challenge is {best}; all of them gain `plays`. Skins keeps {won, games}.
const LEGACY = {closest: 'feet', long: 'yards'};
export const recordScore = (id, r) => !r ? null : LEGACY[id] ? r[LEGACY[id]] : id === 'updown' ? {made: r.made, strokes: r.strokes} : r.best ?? null;
export const blankRecords = () => ({});
export function normaliseRecords(d) {
 const out = {}, num = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi, plays = r => num(r?.plays, 0, 1e7) ? {plays: Math.floor(r.plays)} : {};
 if (!d || typeof d !== 'object') return out;
 if (num(d.closest?.feet, 0, 5000)) out.closest = {feet: d.closest.feet, at: Number(d.closest.at) || 0, ...plays(d.closest)};
 if (num(d.long?.yards, 0, 1000)) out.long = {yards: d.long.yards, at: Number(d.long.at) || 0, ...plays(d.long)};
 if (num(d.updown?.made, 0, 5) && num(d.updown?.strokes, 0, 999)) out.updown = {made: d.updown.made, strokes: d.updown.strokes, at: Number(d.updown.at) || 0, ...plays(d.updown)};
 if (num(d.skins?.won, 0, 1e6) && num(d.skins?.games, 0, 1e6)) out.skins = {won: d.skins.won, games: d.skins.games};
 for (const c of CHALLENGES) {
  if (LEGACY[c.id] || c.id === 'updown') continue;
  const r = d[c.id];
  if (c.play === 'updown') { if (num(r?.best?.made, 0, 99) && num(r?.best?.strokes, 0, 999)) out[c.id] = {best: {made: r.best.made, strokes: r.best.strokes}, at: Number(r.at) || 0, ...plays(r)}; }
  else if (num(r?.best, 0, 1e5)) out[c.id] = {best: r.best, at: Number(r.at) || 0, ...plays(r)};
 }
 return out;
}
// Record a finished play; true when it is a new best. Skins, from a skins
// round, adds a game and the skins won.
export function recordChallenge(prof, id, value, now = Date.now()) {
 const r = (prof.challenges ||= {});
 if (id === 'skins') { r.skins = {won: (r.skins?.won || 0) + value, games: (r.skins?.games || 0) + 1}; return false; }
 const def = challenge(id);
 if (!def) return false;
 const was = r[id], plays = (was?.plays || 0) + 1, best = value != null && better(def, value, recordScore(id, was));
 const round1 = v => Math.round(v * 10) / 10;
 if (best) {
  if (id === 'closest') r[id] = {feet: round1(value), at: now, plays};
  else if (id === 'long') r[id] = {yards: round1(value), at: now, plays};
  else if (id === 'updown') r[id] = {...value, at: now, plays};
  else r[id] = {best: def.play === 'updown' ? {...value} : round1(value), at: now, plays};
 } else if (was) was.plays = plays;
 return best;
}

// MEDALS: {[id]: 1 | 2 | 3}, the best reached, kept for ever.
export function normaliseMedals(d) {
 const out = {};
 if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) if (challenge(k) && [1, 2, 3].includes(v)) out[k] = v;
 return out;
}
export const medalCount = (prof, at = 1) => Object.values(prof?.medals || {}).filter(m => m >= at).length;
export const MEDAL_TOTAL = CHALLENGES.length * 3;
// OLD RECORDS BECOME MEDALS, WITH NO XP (the owner's rule for XP itself:
// nothing back-filled). A record kept before medals existed shows the medal it
// already reaches. Closest to the pin's old record never kept its hole's
// length, so it is measured against a 160-yard hole. Done ONCE, the first time
// a profile is seen without `medals` -- after that every medal is earned in
// play, against the hole it was played on. Returns true when it ran.
export function medalsFromRecords(prof, {driver = 250} = {}) {
 if (prof.medals) return false;
 const m = prof.medals = {};
 for (const id of ['closest', 'long', 'updown']) {
  const score = recordScore(id, prof.challenges?.[id]), reached = score == null ? 0 : medalOf(challenge(id), score, {driver, length: 160});
  if (reached) m[id] = reached;
 }
 return true;
}
