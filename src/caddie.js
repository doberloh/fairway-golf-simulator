// A CADDIE'S CLUB SUGGESTION (the fairway-tour goal, 17 November 2026; the
// owner pulled it in from IDEAS.md, Q13). Pure.
//
// The computer golfer's own thinking (src/ai/golfer.js `plan`: where a
// golfer of this handicap's misses would finish with each club, and what
// each finish is worth), run with the person's own bag and handicap, and
// offered as a hint: the club, where to aim it, and why in a few words. It
// never picks the club for them.
import {computerGolfer, lieAt} from './ai/golfer.js';

const YARD = .9144;
// Words for a target: the pin, the middle of the green, or a lay-up.
function whereWords(hole, target) {
 const toPin = Math.hypot(hole.pin.x - target.x, hole.pin.z - target.z);
 if (toPin < 1) return 'at the flag';
 if (hole.green && Math.hypot(hole.green.x - target.x, hole.green.z - target.z) < 1) return 'at the middle of the green';
 return `to ${Math.round(toPin / YARD)} yd out`;
}
// {club: id, label, target {x, z}, line} or null (nothing to suggest: on
// the green the putter is the only club, and the game already hands it over).
export function suggest({hole, from, bag, handicap = 20, settings = {}}) {
 const lie = lieAt(hole, from.x, from.z);
 if (lie === 'green') return null;
 const g = computerGolfer({handicap: Number.isFinite(handicap) ? handicap : 20, bag, settings, seed: 'caddie'});
 const p = g.plan(hole, from, lie);
 const c = g.clubs[p.id];
 if (!c) return null;
 const yd = Math.round(Math.hypot(p.target.x - from.x, p.target.z - from.z) / YARD);
 return {club: p.id, label: c.label, target: {...p.target}, line: `${c.label} ${whereWords(hole, p.target)} · ${yd} yd`};
}
