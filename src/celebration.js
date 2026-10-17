// GOOD MOMENTS ARE BIG BUT BRIEF (phase 2 of the 1.0 interface, 17 October
// 2026; the approved design, *Big but brief*).
//
// A hole-out earns a banner. Under par -- a birdie or better, and any hole in
// one -- earns the full-width band in the course's colours with the name in
// huge letters; par and worse a quiet strip. Either way it never waits for a
// click and never holds the game: it sweeps in, holds, and slides off while
// the next golfer's turn begins. Two seconds at most, by test.
//
// Also the paper scorecard's marks, which are the same judgement on the card:
// a circle round a birdie, two round an eagle or better, a square round a
// bogey, two round anything worse.
//
// Pure: main.js shows the banner and writes the classes.

import {holeOutLabel} from './scoring.js';

// The band's timing, in milliseconds: in, hold, out. PLACED from the mockup's
// "0.2 s sweeps in, 1.5 s holds, 0.3 s slides off".
export const BAND = {in: 200, hold: 1500, out: 300};
export const QUIET = {in: 150, hold: 1300, out: 250};
export const MAX_BANNER_MS = 2000;
// When the next golfer's turn may be announced: as the banner starts to leave,
// not after it has gone.
export const turnAfter = t => t.in + t.hold;
export const bannerLength = t => t.in + t.hold + t.out;

// Which banner a finished hole earns.
//   big     the full-width band (birdie or better, or a hole in one)
//   name    what it says, in capitals, with an exclamation for the big ones
//   timing  in / hold / out
export function celebrationFor(score, par, {chipIn = false} = {}) {
 const label = holeOutLabel(score, par);
 if (!label) return null;
 const ace = score === 1, big = ace || label.rel <= -1;
 const name = String(label.name).toUpperCase() + (big ? '!' : '');
 return {big, name, rel: label.rel, side: label.side, chipIn: !!chipIn, timing: big ? BAND : QUIET};
}

// The paper card's mark for a score: '' for par (and for anything that is not
// a whole score), 'b' a birdie, 'e' an eagle or better, 'g' a bogey, 'd' a
// double bogey or worse.
export function paperMark(score, par) {
 if (!Number.isFinite(score) || !Number.isFinite(par)) return '';
 const d = Math.round((score - par) * 100) / 100;
 if (!Number.isInteger(d) || d === 0) return '';
 return d <= -2 ? 'e' : d === -1 ? 'b' : d === 1 ? 'g' : 'd';
}
