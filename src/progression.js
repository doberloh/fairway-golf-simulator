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
 round9: 50, round18: 100, win: 50,                     // finishing a round; winning a match, a scramble or the skins
 skin: 30,                                              // each skin won, paid when the hole is decided (skins.js)
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
// The parts, each with what the player is told earned it (the XP popup).
export function holeXpParts({strokes, par, fairway = false, gir = false}) {
 if (!Number.isFinite(strokes) || !Number.isFinite(par)) return [];
 const n = Math.round(strokes), d = n - par;
 const [label, score] = n === 1 ? ['Hole in one', XP.ace] : d <= -3 ? ['Albatross', XP.albatross] : d === -2 ? ['Eagle', XP.eagle] : d === -1 ? ['Birdie', XP.birdie] : d === 0 ? ['Par', XP.par] : [null, 0];
 return [{label: 'Finished the hole', xp: XP.hole}, ...(score ? [{label, xp: score}] : []),
  ...(fairway ? [{label: 'Fairway hit', xp: XP.fairway}] : []), ...(gir ? [{label: 'Green in regulation', xp: XP.gir}] : [])];
}
export const sumParts = parts => parts.reduce((a, p) => a + p.xp, 0);
export const holeXp = facts => sumParts(holeXpParts(facts));
// ON THE NUMBER: the ball came down within 5% of the aim distance of the aim
// point. `landed` and `aimed` are points ({x, z}), `distance` the aim distance.
export function onTheNumber(landed, aimed, distance) {
 if (!landed || !aimed || !(distance > 0)) return false;
 return Math.hypot(landed.x - aimed.x, landed.z - aimed.z) <= ON_NUMBER * distance;
}
// What one shot is worth, before the multiplier: On the number (not a putt),
// a chip-in, a long putt holed, and each personal best it set.
export function shotXpParts({onNumber = false, putt = false, holed = false, fromGreen = false, teeShot = false, puttFeet = 0, bests = 0}) {
 const out = [];
 if (onNumber && !putt) out.push({label: 'On the number', xp: XP.onNumber});
 if (holed && !fromGreen && !teeShot) out.push({label: 'Chip-in', xp: XP.chipIn});
 if (holed && fromGreen && puttFeet > LONG_PUTT_FEET) out.push({label: 'Long putt holed', xp: XP.longPutt});
 if (bests > 0) out.push({label: bests > 1 ? `${bests} personal bests` : 'Personal best', xp: bests * XP.best});
 return out;
}
export const shotXp = facts => sumParts(shotXpParts(facts));
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
// CHALLENGES (16 October 2026; the owner's plan). Medals are what pays: the
// first bronze, silver and gold in each challenge, once each, ever (a long
// challenge twice as much). Finishing a play pays a little, by the best medal
// it reached, and only until the day's allowance is used -- that is what
// stops a challenge being farmed. A new best pays once a challenge a day.
// All PLACED (RESEARCH.md *Challenges and medals*).
export const CHALLENGE_PAY = {
 medal: [0, 25, 50, 100],      // first bronze, silver, gold; doubled when `long`
 play: [5, 10, 15, 25],        // a finished play: no medal, bronze, silver, gold
 playLong: [15, 25, 40, 60],
 best: 20,                      // a new best, once per challenge per day
 dayCap: 250,                   // repeat pay (finishing plays) a day, across all challenges
};
const MEDAL_LABEL = ['', 'bronze', 'silver', 'gold'];
// What a finished play pays one golfer, and the parts that earned it. Writes
// the medal and the day's allowance onto the profile; the caller awards the
// total through the ledger. `medal` 0-3 is the best this play reached, `best`
// whether it set a new record, `mult` the Swing Meter difficulty's.
export function challengePay(p, {id, medal = 0, best = false, long = false, mult = 1}, now = Date.now()) {
 const parts = [], day = dayOf(now), m = Number.isFinite(mult) ? mult : 1;
 if (p.xpChallenge?.day !== day) p.xpChallenge = {day, xp: 0, bests: []};
 const had = p.medals?.[id] || 0;
 if (medal > had) {
  for (let k = had + 1; k <= medal; k++) parts.push({label: `First ${MEDAL_LABEL[k]}`, xp: Math.round(CHALLENGE_PAY.medal[k] * (long ? 2 : 1) * m)});
  (p.medals ||= {})[id] = medal;
 }
 if (best && !p.xpChallenge.bests.includes(id)) { p.xpChallenge.bests.push(id);parts.push({label: 'New best', xp: Math.round(CHALLENGE_PAY.best * m)}); }
 const play = Math.min(Math.round((long ? CHALLENGE_PAY.playLong : CHALLENGE_PAY.play)[medal] * m), Math.max(0, CHALLENGE_PAY.dayCap - p.xpChallenge.xp));
 if (play > 0) { p.xpChallenge.xp += play;parts.push({label: medal ? `${MEDAL_LABEL[medal][0].toUpperCase() + MEDAL_LABEL[medal].slice(1)} play` : 'Challenge played', xp: play}); }
 return {parts, xp: sumParts(parts), capped: play < Math.round((long ? CHALLENGE_PAY.playLong : CHALLENGE_PAY.play)[medal] * m)};
}
export function normaliseChallengeDay(d) {
 if (!d || typeof d !== 'object' || typeof d.day !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d.day)) return null;
 return {day: d.day, xp: Number.isFinite(d.xp) && d.xp >= 0 ? Math.min(d.xp, 1e5) : 0, bests: Array.isArray(d.bests) ? d.bests.filter(b => typeof b === 'string' && b.length <= 30).slice(0, 100) : []};
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
