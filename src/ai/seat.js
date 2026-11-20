// A COMPUTER GOLFER IN A SEAT (the fairway-tour goal, 17 November 2026; SPEC
// section 2). Pure: what main.js asks about a computer seat -- who it is, how
// good, how much of its play to show, and what it says.
//
// A seat is a computer golfer when its player record has `input: 'cpu'` and
// a `cpu` record: {id (a roster golfer, or '' for one the player made),
// handicap, traits, ball, tracer, nation, level}. `level` is what was asked
// for -- a handicap, or 'matched' -- so the seat editor shows it again.
import {ROSTER, rosterGolfer} from './roster.js';
import {MIN_HANDICAP, MAX_HANDICAP} from './skill.js';
import {seeded} from '../challenges.js';

export const isComputer = p => p?.input === 'cpu' && !!p.cpu;

// The levels a seat offers (PLACED). 'matched' is set from the person in the
// group (SPEC 4): near their handicap.
export const LEVELS = [
 ['matched', 'Matched to you'], ['adaptive', 'Adaptive · keeps it close'], [-2, 'Tour pro'], [0, 'Scratch'], [5, '5 handicap'], [10, '10 handicap'],
 [15, '15 handicap'], [20, '20 handicap'], [25, '25 handicap'], [30, '30 handicap']];
export const levelName = level => (LEVELS.find(([v]) => v === level) || [null, `${level} handicap`])[1];

// MATCHED: the person's handicap, spread so the group is not three copies of
// them -- the first opponent a little better, the next a little worse, the
// third level (PLACED: -2, +2, 0 strokes). With no handicap, a 20 (PLACED:
// about the average golfer's).
export const MATCH_SPREAD = [-2, 2, 0];
export function matchedHandicap(personIndex, nth = 0) {
 const base = Number.isFinite(personIndex) ? personIndex : 20;
 return Math.min(MAX_HANDICAP, Math.max(MIN_HANDICAP, base + MATCH_SPREAD[nth % MATCH_SPREAD.length]));
}

// THE GOLFER FOR A SEAT: the roster golfer nearest the handicap that nobody
// in the group already is, chosen the same way for the same seat and group
// (a stable seed), and played AT the asked handicap (its traits and look
// are the roster golfer's; its handicap is the level's).
export function computerSeat({level = 'matched', personIndex = null, nth = 0, used = [], seed = 'seat'} = {}) {
 // Adaptive (adapt.js) starts where Matched would, and keeps that as its base.
 const handicap = level === 'matched' || level === 'adaptive' ? matchedHandicap(personIndex, nth) : Math.min(MAX_HANDICAP, Math.max(MIN_HANDICAP, Number(level)));
 const taken = new Set(used), rnd = seeded(`${seed}|${nth}`);
 const g = ROSTER.filter(r => !taken.has(r.id)).map(r => ({r, k: Math.abs(r.handicap - handicap) + rnd() * 3})).sort((a, b) => a.k - b.k)[0]?.r || ROSTER[0];
 const h = Math.round(handicap * 10) / 10;
 return {name: g.name, cpu: {id: g.id, handicap: h, traits: {...g.traits}, ball: g.ball, tracer: g.tracer, nation: g.nation, level, ...(level === 'adaptive' ? {base: h} : {})}};
}

// A cpu record read back from a save: only known fields, numbers bounded.
// Returns null for anything that is not one.
export function cleanCpu(c) {
 if (!c || typeof c !== 'object') return null;
 const handicap = Number(c.handicap);
 if (!Number.isFinite(handicap) || handicap < MIN_HANDICAP || handicap > MAX_HANDICAP) return null;
 const traits = {};
 if (c.traits && typeof c.traits === 'object') for (const [k, v] of Object.entries(c.traits)) {
  if (k === 'shape') { if (['draw', 'fade', 'straight'].includes(v)) traits.shape = v; }
  else if (Number.isFinite(v) && /^[a-zA-Z]{1,16}$/.test(k)) traits[k] = Math.min(1, Math.max(0, v));
 }
 const id = typeof c.id === 'string' && rosterGolfer(c.id) ? c.id : '';
 const level = c.level === 'matched' || c.level === 'adaptive' || Number.isFinite(c.level) ? c.level : handicap;
 const base = Number(c.base);
 return {id, handicap, traits, ball: typeof c.ball === 'string' ? c.ball.slice(0, 24) : 'classic', tracer: typeof c.tracer === 'string' ? c.tracer.slice(0, 24) : 'classic',
  nation: typeof c.nation === 'string' ? c.nation.slice(0, 3) : '', level,
  ...(level === 'adaptive' ? {base: Number.isFinite(base) && base >= MIN_HANDICAP && base <= MAX_HANDICAP ? base : handicap} : {})};
}

// HOW MUCH OF A COMPUTER GOLFER'S PLAY TO SHOW (SPEC 2, a setting per
// round): 'all' every shot flown in full; 'green' its long shots as a quick
// line and its approach and putts in full; 'results' the ball where it
// stopped, its line drawn. And how long its pre-shot moment lasts (PLACED,
// ms): long enough to read the card, short enough not to drag.
export const WATCH = [['all', 'Every shot'], ['green', 'Near the green'], ['results', 'Results only']];
export const DEFAULT_WATCH = 'green';
export const PRESHOT_MS = {all: 1600, green: 1100, results: 350};
// 'watch' fly it in full; 'quick' fly it at speed; 'skip' straight to rest.
export function showShot(watch, {putt = false, toPinMetres = Infinity} = {}) {
 if (watch === 'results') return 'skip';
 if (watch === 'all') return 'watch';
 return putt || toPinMetres <= 140 ? 'watch' : 'quick';
}

// A WORD NOW AND THEN (SPEC 2; PLACED, the owner may switch them off): only
// for shots worth one, seeded by the shot so a replay says the same. Nothing
// for an ordinary shot. `what` is {from, end, holed, hazard, putt, toPin
// before and after (m), par, strokes}.
const LINES = {
 holed: ['Yes!', 'In the hole!', 'Get in!'],
 close: ['Great shot.', 'That\'ll do.', 'Right at it.', 'Lovely.'],
 water: ['Oh no, wet.', 'Into the water.', 'That\'s found the water.'],
 out: ['Out of bounds.', 'That\'s gone.'],
 short: ['Left it short.', 'Needed more.'],
 lipped: ['So close!', 'Lipped out!'],
};
export function reaction(what, key = '') {
 const rnd = seeded(`say|${key}`), pick = k => LINES[k][Math.floor(rnd() * LINES[k].length)];
 if (what.holed && !what.putt) return pick('holed');
 if (what.holed && what.before > 4) return pick('holed');
 if (what.lipped) return pick('lipped');
 if (what.hazard === 'Water') return pick('water');
 if (what.hazard) return pick('out');
 if (!what.putt && what.before > 50 && what.after < 3) return pick('close');
 if (what.putt && what.before > 2 && what.after > .6 && what.short) return rnd() < .5 ? pick('short') : '';
 return '';
}
