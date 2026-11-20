// A TOURNAMENT (the fairway-tour goal, 17 November 2026; SPEC section 5).
// Pure: the event as data and every rule of it -- the field, the pairings
// and tee times, the field's scores, the leaderboard, the cut, the playoff,
// points and prize money. main.js plays the person's group shot by shot and
// hands their cards in here.
//
// THE FIELD IS DRAWN, NOT FLOWN (measured 17 November 2026: one computer
// golfer's eighteen through the ball model takes about 2.5 s on the owner's
// PC, so a field of 60 would take two and a half minutes a round). Each
// field golfer's round is drawn hole by hole from a HOLE MODEL: the strokes
// table's expectation for a golfer of their handicap on a hole that long
// (src/ai/strokes.js), scaled so the whole course comes to what a scratch
// and a bogey computer golfer scored on it (src/ai/rating.js) -- so water,
// trees and hard greens count -- with a spread per hole and a form for the
// day. Seeded by the event, the round and the golfer: the same however often
// the round is resumed, and nothing the person does changes it.
import {seeded} from './challenges.js';
import {ROSTER, rosterGolfer, pickField, shortName} from './ai/roster.js';
import {strokesFor} from './ai/strokes.js';
import {roundStrokes, netCard} from './net.js';
import {pointsCard} from './stableford.js';

const YARD = .9144;
export const YOU = 'you';
export const ROUNDS = [1, 2, 3, 4];
export const FIELD_SIZES = {min: 30, max: 144, standard: 60};
export const GROUP_SIZES = [3, 4];

// THE HOLE MODEL. `holes` [{par, yards}] from the event's tee; `rated`
// {scratch, bogey} the computer golfers' totals on the course (rating.js
// `scores`), or null to use the table alone.
export function holeModel(holes, rated = null) {
 const m0 = holes.map(h => strokesFor(0, 'tee', h.yards * YARD)), m20 = holes.map(h => strokesFor(20, 'tee', h.yards * YARD));
 const sum = a => a.reduce((s, v) => s + v, 0);
 const k0 = rated?.scratch ? rated.scratch / sum(m0) : 1, k20 = rated?.bogey ? rated.bogey / sum(m20) : 1;
 return {pars: holes.map(h => h.par), scratch: m0.map(v => v * k0), bogey: m20.map(v => v * k20)};
}
// The mean score on hole `i` for a golfer of handicap `h`: between the
// scratch and bogey figures, and on past them in the same line (PLACED).
export const holeMean = (model, i, h) => model.scratch[i] + (model.bogey[i] - model.scratch[i]) * h / 20;
// A hole's spread (strokes, one standard deviation; PLACED from round
// spreads of about 3 for tour golfers and 4-5 for club golfers, shared over
// eighteen holes): 0.75 for scratch, 0.02 more a stroke of handicap.
export const holeSpread = h => .75 + .02 * Math.max(-4, h);
// The day's form: a golfer's whole round shifted by about a stroke either
// way (PLACED).
export const DAY_FORM = 1.1;

const normal = rnd => { const u = Math.max(1e-9, rnd()), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// One field golfer's round, hole by hole.
export function drawRound(model, handicap, key) {
 const rnd = seeded(key), form = normal(rnd) * DAY_FORM / model.pars.length;
 return model.pars.map((par, i) => {
  const s = Math.round(holeMean(model, i, handicap) + form + normal(rnd) * holeSpread(handicap));
  return Math.min(par + 6, Math.max(1, s));
 });
}

// A NEW EVENT. `course` {name, settings} as main.js starts a round on it;
// `size` the whole field with the person; `strength` roster.js STRENGTHS or
// an average handicap (a tour's Auto); `partners` how many computer golfers
// play with the person (Q2: three, or two).
export function newEvent({name = 'Fairway Invitational', seed = 'event', course, holes = 18, rounds = 4, format = 'stroke', net = false, major = false,
 size = FIELD_SIZES.standard, strength = 'mixed', partners = 3, person = {name: 'You'}, purse = null, points = null} = {}) {
 if (!ROUNDS.includes(rounds)) throw Error('An event is one to four rounds.');
 if (![9, 18].includes(holes)) throw Error('An event round is 9 or 18 holes.');
 if (!['stroke', 'stableford'].includes(format)) throw Error('An event is stroke play or Stableford.');
 const n = Math.max(FIELD_SIZES.min, Math.min(FIELD_SIZES.max, size | 0));
 const field = pickField(Math.min(ROSTER.length, n - 1), strength, seed).map(g => g.id);
 return {kind: 'fairway-event', v: 1, id: 'e' + seededId(seed), name: String(name).slice(0, 48), seed: String(seed).slice(0, 60), course, holes, rounds, format, net: !!net, major: !!major,
  strength, partners: GROUP_SIZES.includes(partners + 1) ? partners : 3, person: {name: String(person.name || 'You').slice(0, 24), profile: person.profile || null, index: Number.isFinite(person.index) ? person.index : null},
  field, round: 0, scores: {}, pars: [], model: null, cut: null, done: false, purse: purse ?? (major ? 4000000 : 2000000), points: points ?? (major ? 1000 : 500)};
}
const seededId = seed => { const r = seeded('id|' + seed); return Math.floor(r() * 2 ** 32).toString(36) + Math.floor(r() * 2 ** 32).toString(36); };

// Whose round a golfer is: the person or a roster golfer, with a handicap.
export const golferOf = (ev, id) => id === YOU ? {id, name: ev.person.name, short: ev.person.name, handicap: ev.person.index ?? 0, you: true}
 : (g => g ? {id, name: g.name, short: shortName(g), handicap: g.handicap + (ev.shifts?.[id] || 0), nation: g.nation, ball: g.ball, tracer: g.tracer, traits: g.traits} : null)(rosterGolfer(id));
export const everyone = ev => [YOU, ...ev.field];

// Who is still playing in round `r` (0-based): everyone, until the cut.
export const playing = (ev, r) => ev.cut && r >= ev.cut.after ? ev.cut.made : everyone(ev);

// PAIRINGS. Rounds one and two: groups drawn from the field (seeded).
// Weekends: by score, the leaders last. The person's group is the group the
// person is in; its computer golfers play shot by shot (SPEC 5).
export function pairings(ev, r) {
 const size = ev.partners + 1, ids = playing(ev, r);
 let order;
 if (r < 2) { const rnd = seeded(`${ev.seed}|pair|${r}`); order = ids.map(id => ({id, k: rnd()})).sort((a, b) => a.k - b.k).map(x => x.id); }
 else { const t = totals(ev, r); order = [...ids].sort((a, b) => better(ev, t[a], t[b]) || (a < b ? -1 : 1)); }
 const groups = [];
 for (let i = 0; i < order.length; i += size) groups.push(order.slice(i, i + size));
 // A last group of one plays with the group before (PLACED).
 if (groups.length > 1 && groups[groups.length - 1].length === 1) groups[groups.length - 2].push(...groups.pop());
 return groups;
}
export const myGroup = (ev, r) => pairings(ev, r).find(g => g.includes(YOU)) || [YOU];
// Tee times: ten minutes apart from 7:30 (PLACED), the group with the
// leaders last on the weekend.
export const teeTime = (ev, r, g) => { const m = 7 * 60 + 30 + 10 * g; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

// A golfer's score on the event's scale for one card: strokes (or net
// strokes) to par, or Stableford points.
function scoreOf(ev, id, card) {
 const pars = ev.pars, played = card.filter(Number.isFinite).length;
 if (!played) return {value: 0, played: 0};
 const strokes = ev.net && ev.netStrokes?.[id] ? ev.netStrokes[id] : null;
 if (ev.format === 'stableford') return {value: pointsCard(card, pars, strokes || []).reduce((s, v) => s + (v || 0), 0), played};
 const c = strokes ? netCard(card, strokes) : card;
 return {value: c.reduce((s, v, i) => s + (Number.isFinite(v) ? v - pars[i] : 0), 0), played};
}
// Which of two totals is better: fewer strokes, or more points. Positive
// when `a` is better.
const better = (ev, a, b) => ev.format === 'stableford' ? (a ?? -1e9) - (b ?? -1e9) : (b ?? 1e9) - (a ?? 1e9);
// Every golfer's total over the rounds before `r` (null: not played).
export function totals(ev, r = ev.round) {
 const out = {};
 for (const id of everyone(ev)) {
  const rounds = (ev.scores[id] || []).slice(0, r).filter(Boolean);
  out[id] = rounds.length ? rounds.reduce((s, card) => s + scoreOf(ev, id, card).value, 0) : null;
 }
 return out;
}

// THE FIELD'S ROUND `r`: every golfer still playing but the person and the
// computer golfers in their group (who are played), drawn from the hole
// model. Writes ev.scores; returns the ids drawn.
export function drawField(ev, r = ev.round, mine = myGroup(ev, r)) {
 if (!ev.model) throw Error('The hole model is not ready.');
 const ids = playing(ev, r).filter(id => !mine.includes(id));
 for (const id of ids) {
  const g = golferOf(ev, id);
  (ev.scores[id] ||= [])[r] = drawRound(ev.model, g.handicap, `${ev.seed}|round${r}|${id}`);
 }
 return ids;
}

// A card from the person's group, played: the person's or a partner's.
export function recordCard(ev, id, card, r = ev.round) {
 (ev.scores[id] ||= [])[r] = card.slice(0, ev.holes).map(v => Number.isFinite(v) ? v : null);
}

// THE LEADERBOARD during round `r`, the person `thru` holes in. A field
// golfer's holes are shown as far as their tee time has got them: groups
// go off ten minutes apart and a hole takes thirteen (PLACED), so a group
// two ahead of the person's is about one and a half holes further on.
export function leaderboard(ev, {r = ev.round, thru = 0, partnerThru = {}} = {}) {
 const groups = pairings(ev, r), mineAt = groups.findIndex(g => g.includes(YOU));
 const before = totals(ev, r);
 const rows = playing(ev, r).map(id => {
  const gi = groups.findIndex(g => g.includes(id));
  const ahead = id === YOU || myGroup(ev, r).includes(id) ? 0 : (mineAt - gi) * 10 / 13;
  const theirThru = id === YOU ? thru : partnerThru[id] ?? Math.max(0, Math.min(ev.holes, Math.floor(thru + ahead)));
  const card = (ev.scores[id]?.[r] || []).slice(0, theirThru);
  const today = theirThru ? scoreOf(ev, id, card).value : 0;
  return {id, ...golferOf(ev, id), today, thru: theirThru, total: (before[id] ?? 0) + today, started: theirThru > 0 || (before[id] ?? null) !== null};
 });
 // Those who missed the cut after it, at the foot with MC.
 const missed = ev.cut && r >= ev.cut.after ? everyone(ev).filter(id => !ev.cut.made.includes(id)).map(id => ({id, ...golferOf(ev, id), total: totals(ev, ev.cut.after)[id], mc: true})) : [];
 rows.sort((a, b) => better(ev, b.total, a.total) || (a.id === YOU ? -1 : b.id === YOU ? 1 : 0));
 placeRows(ev, rows);
 return [...rows, ...missed.sort((a, b) => better(ev, b.total, a.total)).map(x => ({...x, pos: 'MC'}))];
}
function placeRows(ev, rows) {
 rows.forEach((row, i) => {
  const first = rows.findIndex(x => x.total === row.total), tied = rows.filter(x => x.total === row.total).length > 1;
  row.place = first + 1; row.pos = `${tied ? 'T' : ''}${first + 1}`;
 });
}

// THE CUT (SPEC 5; PLACED, scaled from the professional tours' "top 65 and
// ties"): after round two of a four-round event (round two of three: after
// one; PLACED), the top 45% and ties play on. Writes ev.cut; returns it.
export function makeCut(ev) {
 if (ev.rounds < 3 || ev.cut) return ev.cut;
 const after = ev.rounds === 4 ? 2 : 1, t = totals(ev, after), ids = everyone(ev);
 const sorted = [...ids].sort((a, b) => better(ev, t[b], t[a]));
 const n = Math.max(1, Math.ceil(ids.length * .45)), line = t[sorted[n - 1]];
 const made = sorted.filter(id => better(ev, t[id], line) >= 0);
 ev.cut = {after, line, made};
 return ev.cut;
}
// Where the cut line would fall now (shown on the leaderboard in round two).
export function projectedCut(ev, rows) {
 if (ev.rounds < 3 || ev.cut) return null;
 const n = Math.max(1, Math.ceil(rows.length * .45));
 return rows[n - 1]?.total ?? null;
}

// AFTER THE LAST ROUND: a tie for first is a playoff (SPEC 5). Field golfers
// play theirs out by the hole model on the eighteenth, hole after hole until
// one is left; the person in it plays (main.js), or -- when the person has
// left it to the game -- is drawn at their handicap (PLACED).
export function playoffFor(ev) {
 const final = totals(ev, ev.rounds), ids = (ev.cut?.made || everyone(ev));
 const best = ids.reduce((b, id) => better(ev, final[id], b) > 0 ? final[id] : b, ev.format === 'stableford' ? -1e9 : 1e9);
 const tied = ids.filter(id => final[id] === best);
 return tied.length > 1 ? tied : null;
}
export function drawPlayoff(ev, ids, {you = null} = {}) {
 const last = ev.pars.length - 1;
 let left = [...ids];
 for (let hole = 0; left.length > 1 && hole < 30; hole++) {
  const s = Object.fromEntries(left.map(id => [id, id === YOU && Number.isFinite(you?.[hole]) ? you[hole] : drawRound({pars: [ev.pars[last]], scratch: [ev.model.scratch[last]], bogey: [ev.model.bogey[last]]}, golferOf(ev, id).handicap, `${ev.seed}|playoff${hole}|${id}`)[0]]));
  const low = Math.min(...Object.values(s));
  left = left.filter(id => s[id] === low);
 }
 ev.playoff = {ids, winner: left[0]};
 return left[0];
}

// THE FINISH: places, points and prize money (for show, Q5).
// Points by place (PLACED: the shape of the professional tours' tables, 500
// to the winner; majors double) and the purse's share by place (PLACED from
// the professional tours' usual split: 18% to the winner).
export const POINT_SHARE = [1, .6, .38, .27, .22, .2, .18, .17, .16, .15, .14, .13, .12, .11, .1, .095, .09, .085, .08, .075];
export const PURSE_SHARE = [.18, .109, .069, .049, .041, .036, .0335, .031, .029, .027, .025, .023, .021, .019, .018, .017, .016, .015, .014, .013];
const shareAt = (table, place) => place <= table.length ? table[place - 1] : Math.max(0, table[table.length - 1] * (1 - (place - table.length) / 60));
export function finish(ev) {
 const rows = leaderboard(ev, {r: ev.rounds - 1, thru: ev.holes, partnerThru: Object.fromEntries(everyone(ev).map(id => [id, ev.holes]))}).filter(x => !x.mc);
 if (ev.playoff?.winner) { const w = rows.find(x => x.id === ev.playoff.winner); rows.splice(rows.indexOf(w), 1); rows.unshift(w); }
 const out = rows.map((row, i) => {
  const place = ev.playoff?.winner && i === 0 ? 1 : (ev.playoff?.winner && row.place === 1 ? 2 : row.place);
  const tiedHere = rows.filter(x => x.place === row.place).length;
  // Tied places share the points and money of the places they cover.
  const span = Array.from({length: tiedHere}, (_, k) => place + k), avg = t => span.reduce((s, p) => s + shareAt(t, p), 0) / span.length;
  return {id: row.id, name: row.name, place, pos: place === 1 ? '1' : row.pos, total: row.total, points: Math.round(ev.points * avg(POINT_SHARE)), money: Math.round(ev.purse * avg(PURSE_SHARE) / 100) * 100, you: row.id === YOU};
 });
 const missed = everyone(ev).filter(id => ev.cut && !ev.cut.made.includes(id)).map(id => ({id, name: golferOf(ev, id).name, place: null, pos: 'MC', total: totals(ev, ev.cut.after)[id], points: 0, money: 0, you: id === YOU}));
 ev.results = [...out, ...missed];
 ev.done = true;
 return ev.results;
}

// Handicap strokes for a net event, everyone's (net.js): worked out once the
// course's holes are known.
export function setNetStrokes(ev, holes) {
 if (!ev.net) return;
 const ids = everyone(ev), players = ids.map(id => ({index: golferOf(ev, id).handicap, team: 'A'}));
 const s = roundStrokes({mode: ev.format, players, holes});
 ev.netStrokes = Object.fromEntries(ids.map((id, i) => [id, s.strokes[i]]));
}

// An event read back from a save: refused if it is not one this version
// reads; the roster ids it names that no longer exist are dropped.
export function readEvent(d) {
 if (!d || d.kind !== 'fairway-event' || d.v !== 1) throw Error('This is not a Fairway event this version can read.');
 const field = (d.field || []).filter(id => rosterGolfer(id));
 return {...d, field};
}
