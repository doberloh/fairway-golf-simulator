// STROKES GAINED (the fairway-tour goal, 17 November 2026; the owner pulled
// it in from IDEAS.md, Q13; RESEARCH *How a golfer of each handicap
// misses*). Pure.
//
// Each shot is worth the strokes it saved against a scratch golfer: the
// scratch golfer's strokes to hole out from where it was played, less those
// from where it finished, less the one it took (and any penalty) --
// Broadie's "shot value" (2008), measured against scratch as his Golfmetrics
// did for amateurs (src/ai/strokes.js `scratchStrokes`). Summed in four
// parts: off the tee (a par 4 or 5's first shot), approach (every other shot
// from 100 yd or more), around the green (under 100 yd, off the green, sand
// included), putting (from the green).
import {scratchStrokes, lieClass} from './ai/strokes.js';

const YARD = .9144;
export const PARTS = ['tee', 'approach', 'short', 'putting'];
export const PART_NAMES = {tee: 'Off the tee', approach: 'Approach', short: 'Around the green', putting: 'Putting'};

// Which part a shot is.
export function partOf({surface, metres, first = false, par = 4}) {
 if (lieClass(surface) === 'green') return 'putting';
 if (first && par >= 4) return 'tee';
 return metres >= 100 * YARD ? 'approach' : 'short';
}
// One shot: `from` {surface, metres}; `to` {surface, metres} or null when
// holed; `penalty` strokes added after it (a drop).
export function shotValue({from, to = null, penalty = 0}) {
 const before = scratchStrokes(from.surface, from.metres), after = to ? scratchStrokes(to.surface, to.metres) : 0;
 return before - after - 1 - penalty;
}
// A hole's shots, in order: [{from, to, penalty}]; the first off the tee.
// Returns {tee, approach, short, putting, total}.
export function holeGained(shots, par = 4) {
 const out = Object.fromEntries(PARTS.map(k => [k, 0]));
 shots.forEach((s, i) => { out[partOf({...s.from, first: i === 0, par})] += shotValue(s); });
 out.total = PARTS.reduce((t, k) => t + out[k], 0);
 return out;
}
// Holes added up (a round, a season).
export function addGained(list) {
 const out = Object.fromEntries([...PARTS, 'total'].map(k => [k, 0]));
 for (const h of list) if (h) for (const k of Object.keys(out)) out[k] += h[k] || 0;
 return out;
}
// "+1.2" / "-0.8", one decimal.
export const gainedText = v => `${v >= 0 ? '+' : ''}${(Math.round(v * 10) / 10).toFixed(1)}`;
