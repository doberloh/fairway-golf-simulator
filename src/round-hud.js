// WHAT THE 1.0 ROUND SCREEN SAYS (phase 1 of the 1.0 interface, 17 October
// 2026; docs/PROJECT_HANDOFF.md, *The 1.0 round screen*).
//
// The round screen is a handful of pieces pinned to the corners: the hole slab
// (top left), the conditions under it (wind, plays like, rise), the golfer
// cards (top right), the map (right, straight), the club (bottom left), the
// Swing Meter or the monitor's ball light (bottom middle) and a faint logo
// (bottom right). main.js reads the round and the course and fills them; this
// module decides what each one SAYS, so the wording is checked in Node rather
// than only by looking.
//
// Pure: no DOM, no three.js. Distances come in metres and leave as the words
// and numbers a player reads.

import {canvasFrame} from './ui-layout.js';

export const YARD = .9144, FOOT = .3048;

// The hole slab: the number in the coloured block, the course's name over
// "PAR 4 / 412 YDS". The range has no number and no par: "R", and the green
// being played to. An endless run has no total.
export function holeSlab({range = false, hole = 0, par = 4, yards = 0, course = '', pin = '', green = ''} = {}) {
 if (range) return {number: 'R', name: 'DRIVING RANGE', line: [green ? String(green).toUpperCase() : 'RANGE', `${Math.round(yards)} YDS`]};
 return {
  number: String(hole + 1),
  name: String(course).toUpperCase(),
  line: [`PAR ${par}`, `${Math.round(yards)} YDS`],
  pin: pin ? `PIN ${String(pin).toUpperCase()}` : '',
 };
}

// A distance as the round reads it: yards, or feet inside ten metres (the
// same switch the flag's label has always made).
export function distanceText(metres) {
 const m = Math.max(0, Number(metres) || 0);
 return m < 10 ? {value: (m / FOOT).toFixed(1), unit: 'FT'} : {value: String(Math.round(m / YARD)), unit: 'YDS'};
}

// The rise to the hole in feet, as the third condition: "+6 FT UP",
// "−4 FT DOWN", or "LEVEL" inside half a foot. The minus is a real minus.
export function riseText(metres) {
 const ft = (Number(metres) || 0) / FOOT;
 if (Math.abs(ft) < .5) return {value: 'LEVEL', unit: ''};
 return ft > 0 ? {value: `+${Math.round(ft)}`, unit: 'FT UP'} : {value: `−${Math.round(-ft)}`, unit: 'FT DOWN'};
}

// The conditions under the hole slab. Wind always; plays-like only when there
// is a flight to adjust (not a putt); the rise only off the green, where the
// map's slope picture says more than a number.
export function conditions({wind = 0, playsLike = null, rise = 0, putting = false} = {}) {
 const out = [{id: 'wind', value: String(Math.max(0, Math.round(Number(wind) || 0))), unit: 'MPH'}];
 if (!putting && Number.isFinite(playsLike)) out.push({id: 'plays', value: String(Math.round(playsLike)), unit: 'PLAYS'});
 if (!putting) out.push({id: 'rise', ...riseText(rise)});
 return out;
}

// The club panel: the code in the hot block, the club's own name, and what a
// full swing does with it.
export function clubPanel(club) {
 if (!club) return {code: '', name: '', line: ''};
 const putt = club.code === 'PT';
 return {
  code: String(club.code || '').toUpperCase(),
  name: String(club.label || '').toUpperCase(),
  line: putt ? `${Math.round(club.carry)} YD ROLL` : `${Math.round(club.carry)} CARRY`,
 };
}

// A score against par as a card shows it: "E", "+3", "−2" (a real minus), and
// whether it is under par -- the one red that is the same in every biome.
export function parScore(rel, played = true) {
 if (!played || !Number.isFinite(rel) || rel === 0) return {text: 'E', under: false};
 const n = Math.round(rel * 10) / 10, s = Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(1);
 return n < 0 ? {text: `−${s}`, under: true} : {text: `+${s}`, under: false};
}

// The golfer cards, top right, in seat order. The golfer up gets the big card:
// their title and level, how far into the level they are, and the score in
// large. Everyone else a short plate: name, level, score.
//   players  [{name, level, title, into, need, rel, played, note}]
export function golferCards(players, active) {
 return (players || []).map((p, i) => {
  const up = i === active, score = p.score ?? parScore(p.rel, p.played);
  const xp = p.need > 0 ? Math.max(0, Math.min(1, (p.into || 0) / p.need)) : 0;
  return {
   seat: i, up,
   name: String(p.name || 'Golfer').toUpperCase(),
   level: Number.isFinite(p.level) ? p.level : null,
   title: up && p.title ? String(p.title).toUpperCase() : '',
   xp: up ? xp : null,
   score: score.text, under: score.under,
   note: p.note ? String(p.note).toUpperCase() : '',
  };
 });
}

// The keys along the foot of the club panel. Escape is the way to everything
// the top bar used to hold, until the pause screen of phase 3 replaces it.
// On the range, R opens the range controls (the view bar's button, which the
// round screen does not show).
export function keyHints({putting = false, monitor = false, range = false} = {}) {
 const keys = [['Q E', 'CLUB'], ['TAB', 'NUMBERS'], ['C', 'CAMERA'], ['ESC', 'MENU']];
 if (range) keys.splice(3, 0, ['R', 'RANGE']);
 if (!monitor && !putting) keys.splice(1, 0, ['S W X', 'SHAPE']);
 return keys.map(([key, text]) => ({key, text}));
}

// The ball light's words, when a launch monitor is armed. The bridge reports
// one of four states (main.js MONITOR_WORDS); the light names it in one word.
export const LIGHT_WORDS = {green: 'READY', amber: 'FINDING BALL', red: 'NO MONITOR', off: 'NO MONITOR'};
export function ballLight(state, who) {
 const word = LIGHT_WORDS[state] || LIGHT_WORDS.off;
 return {word, sub: who ? `${String(who).toUpperCase()} · ${state === 'green' ? 'SWING AWAY' : 'WAIT'}` : ''};
}

// How large the pieces are drawn. The round screen's pieces are laid out for
// the 1280-wide canvas (ui-layout.js) and each is zoomed by the canvas's scale
// inside #app, so a 1920 x 1080 screen draws them half again larger and the
// Text size multiplies them (canvasFrame) -- but only as far as they still
// fit side by side. Along the foot the club panel (at most about 370 wide)
// and the Swing Meter (400, centred) need ROUND_MIN_WIDTH design pixels
// between them, and along the top the hole slab and the golfer cards about
// the same, so the pieces are never scaled past the screen's width over that.
// On a 16:9 screen the pieces already span it at 100%, so the Text size can
// add only about a tenth there (PLACED; the menus, which reflow, take all of
// it). A screen narrower than its canvas (an iPad held upright) is held by
// the same rule. Never below 0.75: a small window keeps them readable and
// lets them crowd rather than shrink to nothing (PLACED).
export const MIN_HUD_SCALE = .75, ROUND_MIN_WIDTH = 1160;
export function hudScale(width, height, zoom = 1) {
 const z = zoom > 0 ? zoom : 1, f = canvasFrame({width, height, zoom: z});
 const across = width > 0 ? width / ROUND_MIN_WIDTH / z : f.scale;
 return Math.max(MIN_HUD_SCALE / z, Math.min(f.scale, across));
}

// ROUND COMPLETE (phase 2). The standings: lowest total first, golfers on the
// same total sharing a place, the winner or winners flagged. A total that is
// not a number (a golfer who never finished a hole) goes last, unplaced.
//   entries  [{name, total, ...anything}]
export function standings(entries) {
 const done = (entries || []).filter(e => Number.isFinite(e.total)).sort((a, b) => a.total - b.total);
 const rest = (entries || []).filter(e => !Number.isFinite(e.total));
 return [...done.map(e => ({...e, place: 1 + done.findIndex(r => r.total === e.total), win: e.total === done[0].total})),
  ...rest.map(e => ({...e, place: null, win: false}))];
}
// The XP a golfer earned in one round: every ledger entry keyed to it.
export function xpThisRound(xpLog, uid) {
 if (!xpLog || !uid) return 0;
 const pre = `${uid}:`;
 return Object.entries(xpLog).reduce((n, [k, v]) => n + (k.startsWith(pre) ? Number(v?.xp) || 0 : 0), 0);
}
// The handicap line: "8.4 → 8.1", or the first number a golfer gets, or how
// many more rounds it needs.
export function handicapLine(before, after, needed = 0) {
 const f = v => (Number.isFinite(v) ? v.toFixed(1) : null);
 if (f(after) == null) return needed > 0 ? `${needed} MORE ROUND${needed === 1 ? '' : 'S'} FOR A HANDICAP` : '';
 if (f(before) == null) return `FIRST HANDICAP ${f(after)}`;
 return `${f(before)} → ${f(after)}`;
}
