// REWARDS BY LEVEL (Phase 5, 14 October 2026; the agreed spec's table, 7.1).
//
// One table, level to unlock, for every kind of reward the levels pay: badges
// (each with its frame), tracers, ball finishes, flourishes, titles, meter skins
// and challenges. Everything that asks "what does level N give" or "can this
// golfer wear that" reads it, so the level-up banner, the look picker and the
// renderer cannot disagree about what is earned.
//
// Phase 5 made tracers, ball finishes and titles wearable; Phase 6 adds the
// badges' frames and the meter skins (WEARABLE, below), and the flourishes,
// which play by themselves once earned (`flourishFor`). Challenges are opened
// here and played from challenges.js.
//
// Nothing unlocks after 50 (spec 7.2). Names are the spec's placeholders, kept.
// The tracers' and the finishes' looks live with what draws them: tracer styles
// in TRACERS here (data the renderer reads), ball finishes in ball-finishes.js.

import {ACHIEVEMENTS} from './achievements.js';

export const MAX_UNLOCK_LEVEL = 50;

// [level, kind, id, name]. Level 1 holds the starting look of each kind.
const ROWS = [
 [1, 'badge', 'rookie', 'Rookie'], [1, 'tracer', 'classic', 'Classic'], [1, 'ball', 'classic', 'Classic white'],
 [1, 'skin', 'classic', 'Classic'], [1, 'challenge', 'course-of-the-week', 'Course of the week'], [1, 'challenge', 'achievements', 'Achievements'],
 // THE OWNER'S ROUND OF 15 OCTOBER 2026: plain colours from the start -- eight
 // balls, eight tracers, nine frames -- and frames a list of their own, with
 // animated ones higher up (below the table).
 ...['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'black'].map(c => [1, 'ball', 'solid-' + c, c[0].toUpperCase() + c.slice(1)]),
 ...['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white'].map(c => [1, 'tracer', c, c[0].toUpperCase() + c.slice(1)]),
 ...['white', 'black', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'].map(c => [1, 'frame', 'plain-' + c, c[0].toUpperCase() + c.slice(1)]),
 // THE FLOURISHES, SIMPLE TO GRAND (the owner, 15 October 2026): a par first,
 // then a birdie, an eagle, a chip-in, fireworks for every birdie; the hole in
 // one's lantern open from the start but kept secret until it happens; and at
 // 50 not one more flourish that would outrank the rest, but every one in gold.
 [1, 'flourish', 'lantern-ace', 'Sky lantern on a hole in one'], [2, 'flourish', 'sparkle-par', 'Sparkles on a par'],
 [5, 'flourish', 'confetti-birdie', 'Confetti on a birdie'], [12, 'flourish', 'fireworks-eagle', 'Fireworks on an eagle'],
 [20, 'flourish', 'ring-chip-in', 'Golden ring on a chip-in'], [30, 'flourish', 'fireworks-birdie', 'Fireworks on every birdie'],
 [50, 'flourish', 'gold-flourishes', 'Everything in gold'],
 // Every challenge open from the start (the owner, 15 October 2026); the spec
 // had them at levels 3, 6, 12 and 18.
 [1, 'challenge', 'closest', 'Closest to the pin'], [1, 'challenge', 'long-drive', 'Long drive'], [1, 'challenge', 'up-and-down', 'Up and down'], [1, 'challenge', 'skins', 'Skins game'],
 [2, 'tracer', 'sky', 'Sky'],
 [3, 'ball', 'red-stripe', 'Red stripe'],
 [4, 'title', 'weekend-golfer', 'Weekend Golfer'],
 [5, 'badge', 'club-member', 'Club Member'],
 [6, 'skin', 'wood', 'Wood'],
 [7, 'tracer', 'comet', 'Comet'],
 [8, 'ball', 'smiley', 'Smiley'],
 [9, 'title', 'range-rat', 'Range Rat'],
 [10, 'badge', 'club-regular', 'Club Regular'], [10, 'ball', 'two-tone', 'Two-tone'],
 [11, 'tracer', 'sunset', 'Sunset'],
 [12, 'skin', 'neon', 'Neon'],
 [13, 'ball', 'polka-dot', 'Polka dot'],
  [15, 'badge', 'single-digit', 'Single Digit'], [15, 'title', 'flag-hunter', 'Flag Hunter'],
 [16, 'tracer', 'dashed', 'Dashed'],
 [17, 'ball', 'pumpkin', 'Pumpkin'],
 [18, 'skin', 'retro-pixel', 'Retro pixel'],
 [19, 'tracer', 'sparkle', 'Sparkle trail'],
 [20, 'badge', 'scratch', 'Scratch'], [20, 'title', 'low-ball', 'Low Ball'],
 [21, 'ball', 'glow', 'Glow'],
  [23, 'tracer', 'ribbon', 'Ribbon'],
 [24, 'skin', 'chalkboard', 'Chalkboard'],
 [25, 'badge', 'tour-card', 'Tour Card'], [25, 'ball', 'chrome', 'Chrome'], [25, 'title', 'tour-rookie', 'Tour Rookie'],
 [26, 'tracer', 'ice', 'Ice'],
  [28, 'ball', 'camo', 'Camo'],
 [29, 'title', 'sharpshooter', 'Sharpshooter'],
 [30, 'badge', 'contender', 'Contender'], [30, 'tracer', 'fire', 'Fire'],
 [31, 'ball', 'galaxy', 'Galaxy'],
 [32, 'skin', 'blueprint', 'Blueprint'],
 [33, 'tracer', 'lightning', 'Lightning'],
 [34, 'title', 'iron-will', 'Iron Will'],
 [35, 'badge', 'major-winner', 'Major Winner'], [35, 'ball', 'tartan', 'Tartan'],
  [37, 'tracer', 'aurora', 'Aurora'],
 [38, 'skin', 'carbon', 'Carbon'],
 [39, 'ball', 'marble', 'Marble'],
 [40, 'badge', 'hall-of-fame', 'Hall of Fame'], [40, 'title', 'hall-of-famer', 'Hall of Famer'],
 [41, 'tracer', 'starfall', 'Starfall'],
 [42, 'ball', 'diamond-plate', 'Diamond plate'],
  [44, 'skin', 'gold-leaf', 'Gold leaf'],
 [45, 'badge', 'legend', 'Legend'], [45, 'tracer', 'ghost', 'Ghost'], [45, 'title', 'legend', 'Legend'],
 [46, 'ball', 'gold', 'Gold'],
 [47, 'tracer', 'comet-sparkle', 'Comet tail plus sparkle'],
 [48, 'skin', 'aurora', 'Aurora'],
 [49, 'ball', 'black-pearl', 'Black pearl'],
 [50, 'badge', 'fairway-master', 'Fairway Master'], [50, 'tracer', 'rainbow', 'Rainbow'], [50, 'ball', 'rainbow', 'Rainbow'],
 [50, 'title', 'fairway-master', 'Fairway Master'], [50, 'skin', 'champion', 'Champion'],
];
// ANIMATED FRAMES (the owner, 15 October 2026: "different color flames and
// sparkles, water, leaves"), spread over the higher levels. PLACED.
const ANIMATED_FRAMES = [
 [7, 'sparkle-silver', 'Silver sparkle'], [9, 'water', 'Water'], [13, 'leaves', 'Spring leaves'],
 [16, 'flames', 'Flames'], [19, 'sparkle-gold', 'Gold sparkle'], [21, 'leaves-autumn', 'Autumn leaves'],
 [24, 'flames-blue', 'Blue flames'], [26, 'ice', 'Ice'], [29, 'flames-green', 'Green flames'],
 [32, 'deep-water', 'Deep water'], [38, 'flames-purple', 'Purple flames'], [42, 'aurora', 'Aurora'], [47, 'galaxy', 'Galaxy'],
];
// Each badge still brings its frame, as a frame of the same id at its level.
const BADGE_FRAMES = ROWS.filter(r => r[1] === 'badge').map(([level, , id, name]) => [level, 'frame', id, name]);
export const REWARDS = [...ROWS, ...BADGE_FRAMES, ...ANIMATED_FRAMES.map(([level, id, name]) => [level, 'frame', id, name])]
 .sort((a, b) => a[0] - b[0]).map(([level, kind, id, name]) => ({level, kind, id, name}));
export const KINDS = ['badge', 'frame', 'tracer', 'ball', 'flourish', 'title', 'skin', 'challenge'];
// What a golfer can choose and wear in this version. Titles may be none.
export const WEARABLE = ['ball', 'tracer', 'title', 'frame', 'skin'];
// A frame is its own reward (15 October 2026; it was a badge's until then).
// An empty frame is "my newest badge's".
export const DEFAULT_WORN = {ball: 'classic', tracer: 'classic', title: '', frame: '', skin: 'classic'};
// How each kind is named on its own, in the level-up banner's list.
export const KIND_NAMES = {badge: 'badge', frame: 'frame', tracer: 'tracer', ball: 'ball finish', flourish: 'flourish', title: 'title', skin: 'meter skin', challenge: 'challenge'};

export const rewardsOf = kind => REWARDS.filter(r => r.kind === kind);
// TITLES FROM ACHIEVEMENTS (Phase 7, spec 7.5 and 8.3): earned with the
// achievement, not by level. Their ids start `ach-` so they never meet a level
// title's.
export const ACHIEVEMENT_TITLES = ACHIEVEMENTS.filter(a => a.title).map(a => ({level: null, kind: 'title', id: 'ach-' + a.id, name: a.title, achievement: a.id}));
export const reward = (kind, id) => REWARDS.find(r => r.kind === kind && r.id === id) || (kind === 'title' && ACHIEVEMENT_TITLES.find(r => r.id === id)) || null;
// Everything a level brings, in the table's order.
export const unlocksAt = level => REWARDS.filter(r => r.level === level);
// `earned` is the golfer's achievements, for the titles they bring.
export const isUnlocked = (kind, id, level, earned = {}) => { const r = reward(kind, id); return !!r && (r.achievement ? !!earned?.[r.achievement] : r.level <= level); };
// What a golfer of this level has on: their choice when it is earned, the
// starting look when it is not -- a mulligan can take back the XP that earned
// it, and the choice is kept for when it is earned again.
export function wornItem(worn, kind, level, earned = {}) {
 const id = worn?.[kind];
 if (kind === 'title' && !id) return '';
 if (kind === 'frame') return id && isUnlocked('frame', id, level) ? id : highestBadge(level);
 return id && isUnlocked(kind, id, level, earned) ? id : DEFAULT_WORN[kind];
}

// TRACER STYLES (spec 7.4). Shape and effect belong to the style; colour too,
// while the golfer's own shot flies. In the end-of-hole summary every line goes
// back to its golfer's seat colour and keeps its shape (`summaryStyle`), so the
// summary still shows whose line is whose.
//
// colours: stops along the line from the tee (0) to the ball (1); `shift`
//   moves the stops along with time. The golfer's own choice everywhere -- the
//   seat colour no longer stands in for it, live or in the summary (the
//   owner, 15 October 2026).
// width: the live line's width in pixels (the summary's is 3, as before).
// opacity, dash [on, off] in metres, head (a wider line over the last part:
//   `{share, width}`), core (a thin bright line inside a wide one: `{width,
//   colour}`), sparkle (glints behind the ball: `{count, colour, fall}`, fall in
//   metres a second), jag (a lightning zigzag, metres), flicker (0-1).
// All PLACED by eye, 14 October 2026.
export const TRACERS = {
 classic: {colours: ['#ffe9a2'], width: 4.5},
 red: {colours: ['#ff5a5a'], width: 4.5}, orange: {colours: ['#ff9f43'], width: 4.5}, yellow: {colours: ['#ffe14d'], width: 4.5},
 green: {colours: ['#5ee07a'], width: 4.5}, blue: {colours: ['#4dabff'], width: 4.5}, purple: {colours: ['#a77bff'], width: 4.5},
 pink: {colours: ['#ff7ac8'], width: 4.5}, white: {colours: ['#ffffff'], width: 4.5},
 sky: {colours: ['#9fdcff', '#5fb4ff'], width: 4.5},
 comet: {colours: ['#ffd36b'], width: 3.5, head: {share: .14, width: 10}},
 sunset: {colours: ['#ffd36b', '#ff8a4c', '#e2557c', '#9b5bd6'], width: 4.5},
 dashed: {colours: ['#ffffff'], width: 4.5, dash: [2.4, 1.6]},
 sparkle: {colours: ['#ffe9a2'], width: 3.5, sparkle: {count: 36, colour: '#fff6c8', fall: 0}},
 ribbon: {colours: ['#9fe0ff'], width: 11, opacity: .42, core: {width: 2.5, colour: '#ffffff'}},
 ice: {colours: ['#ffffff', '#c9f3ff', '#7fd8f5'], width: 5, core: {width: 2, colour: '#ffffff'}},
 fire: {colours: ['#fff1a8', '#ffb23d', '#ff6a1f', '#c8261a'], width: 5.5, flicker: .25, head: {share: .1, width: 9}},
 lightning: {colours: ['#e9f4ff', '#a9ccff'], width: 3, jag: .9, flicker: .45, core: {width: 1.5, colour: '#ffffff'}},
 aurora: {colours: ['#5cf2b0', '#3fd6d6', '#7d7cf2', '#c46ef0'], width: 6, opacity: .8, shift: .12},
 starfall: {colours: ['#e6e0ff'], width: 3.5, sparkle: {count: 48, colour: '#fff9e0', fall: 1.6}},
 ghost: {colours: ['#e8fff4', '#bfe8d6'], width: 6, opacity: .38, flicker: .2},
 'comet-sparkle': {colours: ['#ffd36b'], width: 3.5, head: {share: .14, width: 10}, sparkle: {count: 40, colour: '#fff6c8', fall: .6}},
 rainbow: {colours: ['#ff4d4d', '#ffa64d', '#ffe74d', '#5ee05e', '#4dc3ff', '#7a6cff', '#d36cff'], width: 5.5, shift: .25},
};
export const tracerStyle = id => TRACERS[id] || TRACERS.classic;
// The summary keeps the colours and the shape (dash, the lightning's zigzag)
// and drops everything that moves.
export function summaryStyle(id) {
 const s = tracerStyle(id);
 return {colours: s.colours, ...(s.dash ? {dash: s.dash} : {}), ...(s.jag ? {jag: s.jag} : {})};
}
// A colour on a line of stops, t from 0 (the tee) to 1 (the ball); `shift`
// slides the stops along with time and wraps.
export function stopColour(stops, t) {
 // One stop is one colour -- as numbers, like every other answer. Returned as
 // the hex string it was, a one-colour tracer threw on every frame of its
 // flight and froze the game after one shot (15 October 2026).
 if (stops.length === 1) return hexRgb(stops[0]);
 const x = Math.min(1, Math.max(0, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
 const a = hexRgb(stops[i]), b = hexRgb(stops[i + 1]);
 return a.map((v, k) => v + (b[k] - v) * f);
}
export function hexRgb(h) {
 const n = parseInt(h.slice(1), 16);
 return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

// BADGES AND THEIR FRAMES (Phase 6, spec 7.1 and 7.5): the metal or colour of
// each, as two stops; the frame is a ring of it round the ball picture, and the
// level chip is filled with the highest badge earned. Fairway Master's runs
// through the rainbow and moves. PLACED by eye.
export const FRAMES = {
 rookie: {from: '#b98a55', to: '#e8c999', ink: '#2a1c0e'},
 'club-member': {from: '#8c5a2b', to: '#e2a46a', ink: '#24150a'},
 'club-regular': {from: '#8d969e', to: '#eef2f5', ink: '#1d2328'},
 'single-digit': {from: '#b8901e', to: '#ffe58a', ink: '#2a2008'},
 scratch: {from: '#1f7a4a', to: '#86e8ae', ink: '#0b2416'},
 'tour-card': {from: '#a9b6bd', to: '#fbfdff', ink: '#1a2227'},
 contender: {from: '#1b3f9c', to: '#7aa5ff', ink: '#ffffff'},
 'major-winner': {from: '#8e0f25', to: '#ff6177', ink: '#ffffff'},
 'hall-of-fame': {from: '#086b45', to: '#46e6a8', ink: '#05291b'},
 legend: {from: '#121218', to: '#64647c', ink: '#ffffff'},
 'fairway-master': {from: '#ff4d4d', to: '#4dc3ff', ink: '#1b1b1b', rainbow: true},
 // Plain colours (15 October 2026): one colour all round.
 'plain-white': {solid: '#f4f6f2'}, 'plain-black': {solid: '#1a1c1e'}, 'plain-red': {solid: '#e5484d'},
 'plain-orange': {solid: '#f08c2e'}, 'plain-yellow': {solid: '#f5d13b'}, 'plain-green': {solid: '#3fbf63'},
 'plain-blue': {solid: '#3b8fe8'}, 'plain-purple': {solid: '#8e63e8'}, 'plain-pink': {solid: '#ec6fb7'},
 // Animated (15 October 2026): `anim` names the movement (style.css), three
 // colours feed it.
 'sparkle-silver': {anim: 'sparkle', colours: ['#9aa4ad', '#e6ebef', '#ffffff']},
 water: {anim: 'water', colours: ['#1e6fb5', '#5fc3ff', '#d8f6ff']},
 leaves: {anim: 'leaves', colours: ['#2f7a2a', '#7cc94a', '#d8f08a']},
 flames: {anim: 'flames', colours: ['#c8261a', '#ff7a1f', '#ffe066']},
 'sparkle-gold': {anim: 'sparkle', colours: ['#b8901e', '#ffd86b', '#fff6c8']},
 'leaves-autumn': {anim: 'leaves', colours: ['#9c3b14', '#e0782a', '#f2c14e']},
 'flames-blue': {anim: 'flames', colours: ['#1a3fd1', '#3fa0ff', '#d6f4ff']},
 ice: {anim: 'sparkle', colours: ['#7fc8e8', '#cfefff', '#ffffff']},
 'flames-green': {anim: 'flames', colours: ['#137a2b', '#3fe06a', '#e2ffb0']},
 'deep-water': {anim: 'water', colours: ['#0b2a5c', '#1f5fb0', '#63c2ff']},
 'flames-purple': {anim: 'flames', colours: ['#4b138e', '#a14dff', '#f0c6ff']},
 aurora: {anim: 'spin', colours: ['#3ff2a8', '#3fb7d6', '#a46ef0']},
 galaxy: {anim: 'sparkle', colours: ['#1a0f3d', '#4b2a8e', '#c6b8ff']},
};
// The highest badge a level has earned.
export function highestBadge(level) {
 let best = 'rookie';
 for (const r of rewardsOf('badge')) if (r.level <= level) best = r.id;
 return best;
}
// The badge's name as shown: Fairway Master carries the level from 50 on
// (spec 7.2, "Master 57").
export const badgeName = level => { const id = highestBadge(level), r = reward('badge', id); return id === 'fairway-master' && level > 50 ? `Master ${level}` : r.name; };

// METER SKINS (Phase 6, spec 7.6): the meter's look only -- its track, edge,
// the marker and the strike flash. The strike zone stays yellow, the perfect
// band green and the target marker blue in every skin (the owner's colours,
// 14 October 2026), and tests/rewards.test.mjs holds each skin's zone, band,
// target and track apart in lightness, in normal colour vision and simulated
// red-green colour blindness, so they never depend on hue alone. `base` is the
// track's average colour, which the test composites the zone over. PLACED.
export const METER_SKINS = {
 classic: {track: 'linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.14))', base: '#33443a', edge: 'rgba(236,243,230,.3)', zone: 'rgba(240,198,116,.4)', perfect: '#6ed687', marker: '#ffffff', target: '#8fd3ff', flash: '#7ee39a'},
 wood: {track: 'repeating-linear-gradient(90deg,#5b3a1e 0 6px,#6e4825 6px 9px,#64401f 9px 15px)', base: '#634121', edge: '#a8784a', zone: 'rgba(246,206,110,.5)', perfect: '#7fe08f', marker: '#fff4dc', target: '#8fd3ff', flash: '#9cf0a6'},
 neon: {track: 'linear-gradient(90deg,#0d0b1f,#160f2e)', base: '#120d27', edge: '#ff4fd8', zone: 'rgba(255,224,77,.42)', perfect: '#39ff88', marker: '#ffffff', target: '#5fd6ff', flash: '#39ff88'},
 'retro-pixel': {track: 'repeating-linear-gradient(90deg,#1b1f3a 0 8px,#232849 8px 16px)', base: '#1f2441', edge: '#8a8fc9', zone: 'rgba(252,216,72,.48)', perfect: '#58d65c', marker: '#f8f8f8', target: '#6cc3ff', flash: '#7af07c'},
 chalkboard: {track: 'linear-gradient(90deg,#20382c,#284434)', base: '#243e30', edge: '#e8efe6', zone: 'rgba(250,220,130,.42)', perfect: '#9be7a8', marker: '#f4f6f2', target: '#9fd8ff', flash: '#b8f5c2'},
 blueprint: {track: 'linear-gradient(90deg,#173a6b,#1d4680),repeating-linear-gradient(90deg,transparent 0 11px,rgba(255,255,255,.12) 11px 12px)', base: '#1a4075', edge: '#cfe3ff', zone: 'rgba(255,214,102,.48)', perfect: '#78e39a', marker: '#ffffff', target: '#a8e4ff', flash: '#9ef0b6'},
 carbon: {track: 'repeating-linear-gradient(45deg,#1b1d20 0 3px,#24272b 3px 6px)', base: '#202326', edge: '#6b7178', zone: 'rgba(245,205,105,.45)', perfect: '#64d98a', marker: '#ffffff', target: '#7fd0ff', flash: '#7ef0a0'},
 'gold-leaf': {track: 'linear-gradient(90deg,#3a2c10,#4d3a14)', base: '#433312', edge: '#e2bf5c', zone: 'rgba(255,226,120,.45)', perfect: '#7ee39a', marker: '#fff8e0', target: '#8fd3ff', flash: '#ffe58a'},
 aurora: {track: 'linear-gradient(90deg,#0f2433,#16243f,#20193d)', base: '#16223a', edge: '#7ff2c8', zone: 'rgba(250,214,110,.45)', perfect: '#5cf2a0', marker: '#ffffff', target: '#86d4ff', flash: '#a6ffd0'},
 champion: {track: 'linear-gradient(90deg,#2a2208,#3b2e0b)', base: '#33280a', edge: '#ffd86b', zone: 'rgba(255,220,110,.48)', perfect: '#6ee08e', marker: '#ffffff', target: '#8fd3ff', flash: '#ffe58a', rainbow: true},
};
export const meterSkin = id => METER_SKINS[id] || METER_SKINS.classic;

// FLOURISHES (Phase 6, spec 7.4; redone 15 October 2026): visual only, no
// sound. Which one a hole-out shows, of those the golfer has earned, the
// rarest first: a hole in one, a chip-in (par or better), an eagle or better,
// a birdie, a par. Bogeys and worse get none. Null when none applies.
export function flourishFor({score, par, chipIn = false}, level) {
 const has = id => isUnlocked('flourish', id, level);
 if (!Number.isFinite(score) || !Number.isFinite(par)) return null;
 if (score === 1 && has('lantern-ace')) return 'lantern-ace';
 if (chipIn && score <= par && has('ring-chip-in')) return 'ring-chip-in';
 if (score <= par - 2 && has('fireworks-eagle')) return 'fireworks-eagle';
 if (score <= par - 1 && has('fireworks-birdie')) return 'fireworks-birdie';
 if (score <= par - 1 && has('confetti-birdie')) return 'confetti-birdie';
 if (score === par && has('sparkle-par')) return 'sparkle-par';
 return null;
}
// Level 50's reward: every flourish in gold.
export const goldFlourishes = level => isUnlocked('flourish', 'gold-flourishes', level);
// Kept off the Flourishes tab until it has happened (the hole in one's).
export const SECRET_FLOURISHES = new Set(['lantern-ace']);
