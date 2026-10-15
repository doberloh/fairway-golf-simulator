// XP AND LEVELS (Phase 4, 14 October 2026). One system for every golfer, on a
// launch monitor or the Swing Meter: XP comes from how a hole and a round are
// played, levels come from XP. Nothing here buys distance -- the bag is the
// distance -- and from level 50 on the levels go on for ever at a fixed price
// with nothing more to unlock (the owner's calls; the spec is a local report).
//
// Every amount is PLACED, from the agreed spec, and RESEARCH.md *XP and levels*
// says so. Pure: main.js decides when, this decides how much.

export const XP = {
 hole: 10,                                              // finishing a hole, any format
 par: 10, birdie: 30, eagle: 80, albatross: 250, ace: 300, // the score on it (an ace replaces the rest)
 fairway: 5, gir: 5,                                    // as the profile's own stats count them
 onNumber: 5,                                           // landing within 5% of the aim distance, once a hole
 chipIn: 25, longPutt: 25,                              // holed from off the green; a putt over 30 ft
 round9: 50, round18: 100, win: 50,                     // finishing a round; winning a match or a scramble
 best: 40,                                              // a new personal best
 daily: 100,                                            // the first round finished each day
 rangeNumber: 2, rangeDayCap: 50,                       // on the range: On the number only, capped a day
};
// By difficulty; a launch-monitor golfer is x1. Not applied to the daily bonus.
export const XP_MULT = {easy: .75, normal: 1, hard: 1.5, monitor: 1};
export const LONG_PUTT_FEET = 30, ON_NUMBER = .05;

// WHAT A LEVEL COSTS: 400 XP from level 1 to 2, 50 more for each level after,
// and from level 49 to 50 onward a flat 2,850 for ever.
export const LEVEL_CAP_COST = 2850;
export const levelCost = level => Math.min(400 + 50 * (level - 1), LEVEL_CAP_COST);
// XP needed to REACH level 50 from nothing: 49 levels of the rising cost.
const TO_FIFTY = Array.from({length: 49}, (_, i) => levelCost(i + 1)).reduce((a, b) => a + b, 0);
// The level a total of XP is, with how far into it and what the next costs.
export function levelOf(xp) {
 let left = Math.max(0, Math.floor(Number(xp) || 0));
 if (left >= TO_FIFTY) {
  left -= TO_FIFTY;
  return {level: 50 + Math.floor(left / LEVEL_CAP_COST), into: left % LEVEL_CAP_COST, need: LEVEL_CAP_COST};
 }
 let level = 1;
 while (left >= levelCost(level)) { left -= levelCost(level); level++; }
 return {level, into: left, need: levelCost(level)};
}

// A FINISHED HOLE: 10, plus the score's XP, plus a fairway and a green in
// regulation. Scores are named by the nearest whole stroke, as the profile's
// stats name a decimal-putting score.
export function holeXp({strokes, par, fairway = false, gir = false}) {
 if (!Number.isFinite(strokes) || !Number.isFinite(par)) return 0;
 const n = Math.round(strokes), d = n - par;
 const score = n === 1 ? XP.ace : d <= -3 ? XP.albatross : d === -2 ? XP.eagle : d === -1 ? XP.birdie : d === 0 ? XP.par : 0;
 return XP.hole + score + (fairway ? XP.fairway : 0) + (gir ? XP.gir : 0);
}
// ON THE NUMBER: the ball came down within 5% of the aim distance of the aim
// point. `landed` and `aimed` are points ({x, z}), `distance` the aim distance.
export function onTheNumber(landed, aimed, distance) {
 if (!landed || !aimed || !(distance > 0)) return false;
 return Math.hypot(landed.x - aimed.x, landed.z - aimed.z) <= ON_NUMBER * distance;
}
// What one shot is worth, before the multiplier: On the number (not a putt),
// a chip-in, a long putt holed, and each personal best it set.
export function shotXp({onNumber = false, putt = false, holed = false, fromGreen = false, teeShot = false, puttFeet = 0, bests = 0}) {
 let xp = 0;
 if (onNumber && !putt) xp += XP.onNumber;
 if (holed && !fromGreen && !teeShot) xp += XP.chipIn;
 if (holed && fromGreen && puttFeet > LONG_PUTT_FEET) xp += XP.longPutt;
 return xp + bests * XP.best;
}
export const roundXp = holes => holes === 18 ? XP.round18 : holes === 9 ? XP.round9 : 0;
export const withMult = (xp, mult = 1) => Math.round(xp * (Number.isFinite(mult) ? mult : 1));

// THE LEDGER. Each award is kept under a key that says what earned it (a round,
// a hole, a stroke), so the same thing can be awarded again without counting
// twice -- a hole is re-scored on every save -- and a mulligan can take back
// exactly the strokes it takes back. Only the newest few hundred entries are
// kept; anything older is long past being taken back. Returns the change.
export const LEDGER_SIZE = 400;
export function award(p, key, xp, {stroke} = {}) {
 p.xpLog ||= {};
 const old = p.xpLog[key]?.xp || 0, now = Math.max(0, Math.round(xp) || 0);
 if (now === old) return 0;
 p.xp = Math.max(0, (p.xp || 0) - old + now);
 if (now > 0) p.xpLog[key] = {xp: now, at: Date.now(), ...(Number.isInteger(stroke) ? {stroke} : {})};
 else delete p.xpLog[key];
 const keys = Object.keys(p.xpLog);
 if (keys.length > LEDGER_SIZE) for (const k of keys.sort((a, b) => p.xpLog[a].at - p.xpLog[b].at).slice(0, keys.length - LEDGER_SIZE)) delete p.xpLog[k];
 return now - old;
}
// A mulligan: every award under `prefix` from `fromStroke` on is taken back.
export function takeBack(p, prefix, fromStroke) {
 let change = 0;
 for (const [k, v] of Object.entries(p.xpLog || {})) if (k.startsWith(prefix) && Number.isInteger(v.stroke) && v.stroke >= fromStroke) change += award(p, k, 0);
 return change;
}
// Has this golfer already been given On the number on this hole, by another stroke?
export const hasOnNumber = (p, prefix, stroke) => Object.entries(p.xpLog || {}).some(([k, v]) => k.startsWith(prefix) && k.endsWith(':number') && v.stroke !== stroke);
// THE FIRST ROUND EACH DAY, by the device's own clock: once a calendar day.
export const dayOf = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function dailyXp(p, now = Date.now()) {
 const day = dayOf(now);
 if (p.xpDaily === day) return 0;
 p.xpDaily = day;p.xp = (p.xp || 0) + XP.daily;
 return XP.daily;
}
// THE RANGE: On the number only, a trickle, capped a day.
export function rangeXp(p, now = Date.now()) {
 const day = dayOf(now);
 if (p.xpRange?.day !== day) p.xpRange = {day, xp: 0};
 const give = Math.min(XP.rangeNumber, XP.rangeDayCap - p.xpRange.xp);
 if (give <= 0) return 0;
 p.xpRange.xp += give;p.xp = (p.xp || 0) + give;
 return give;
}
