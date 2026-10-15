// REWARDS BY LEVEL (Phase 5, 14 October 2026; the agreed spec's table, 7.1).
//
// One table, level to unlock, for every kind of reward the levels pay: badges
// (each with its frame), tracers, ball finishes, flourishes, titles, meter skins
// and challenges. Everything that asks "what does level N give" or "can this
// golfer wear that" reads it, so the level-up banner, the look picker and the
// renderer cannot disagree about what is earned.
//
// Version one (Phase 5) makes tracers, ball finishes and titles wearable. The
// other kinds are listed so the table is whole and the level-up banner can name
// them, but nothing wears them until their phase lands (WEARABLE, below).
//
// Nothing unlocks after 50 (spec 7.2). Names are the spec's placeholders, kept.
// The tracers' and the finishes' looks live with what draws them: tracer styles
// in TRACERS here (data the renderer reads), ball finishes in ball-finishes.js.

export const MAX_UNLOCK_LEVEL = 50;

// [level, kind, id, name]. Level 1 holds the starting look of each kind.
const ROWS = [
 [1, 'badge', 'rookie', 'Rookie'], [1, 'tracer', 'classic', 'Classic'], [1, 'ball', 'classic', 'Classic white'],
 [1, 'skin', 'classic', 'Classic'], [1, 'challenge', 'course-of-the-week', 'Course of the week'], [1, 'challenge', 'achievements', 'Achievements'],
 [2, 'tracer', 'sky', 'Sky'],
 [3, 'ball', 'red-stripe', 'Red stripe'], [3, 'challenge', 'closest', 'Closest to the pin'],
 [4, 'title', 'weekend-golfer', 'Weekend Golfer'],
 [5, 'badge', 'club-member', 'Club Member'], [5, 'flourish', 'confetti-birdie', 'Confetti on a birdie'],
 [6, 'skin', 'wood', 'Wood'], [6, 'challenge', 'long-drive', 'Long drive'],
 [7, 'tracer', 'comet', 'Comet'],
 [8, 'ball', 'smiley', 'Smiley'],
 [9, 'title', 'range-rat', 'Range Rat'],
 [10, 'badge', 'club-regular', 'Club Regular'], [10, 'ball', 'two-tone', 'Two-tone'],
 [11, 'tracer', 'sunset', 'Sunset'],
 [12, 'skin', 'neon', 'Neon'], [12, 'challenge', 'up-and-down', 'Up and down'],
 [13, 'ball', 'polka-dot', 'Polka dot'],
 [14, 'flourish', 'fireworks-eagle', 'Fireworks on an eagle'],
 [15, 'badge', 'single-digit', 'Single Digit'], [15, 'title', 'flag-hunter', 'Flag Hunter'],
 [16, 'tracer', 'dashed', 'Dashed'],
 [17, 'ball', 'pumpkin', 'Pumpkin'],
 [18, 'skin', 'retro-pixel', 'Retro pixel'], [18, 'challenge', 'skins', 'Skins game'],
 [19, 'tracer', 'sparkle', 'Sparkle trail'],
 [20, 'badge', 'scratch', 'Scratch'], [20, 'title', 'low-ball', 'Low Ball'],
 [21, 'ball', 'glow', 'Glow'],
 [22, 'flourish', 'streamers-par-save', 'Streamers on a par save'],
 [23, 'tracer', 'ribbon', 'Ribbon'],
 [24, 'skin', 'chalkboard', 'Chalkboard'],
 [25, 'badge', 'tour-card', 'Tour Card'], [25, 'ball', 'chrome', 'Chrome'], [25, 'title', 'tour-rookie', 'Tour Rookie'],
 [26, 'tracer', 'ice', 'Ice'],
 [27, 'flourish', 'ring-chip-in', 'Golden ring burst on a chip-in'],
 [28, 'ball', 'camo', 'Camo'],
 [29, 'title', 'sharpshooter', 'Sharpshooter'],
 [30, 'badge', 'contender', 'Contender'], [30, 'tracer', 'fire', 'Fire'],
 [31, 'ball', 'galaxy', 'Galaxy'],
 [32, 'skin', 'blueprint', 'Blueprint'],
 [33, 'tracer', 'lightning', 'Lightning'],
 [34, 'title', 'iron-will', 'Iron Will'],
 [35, 'badge', 'major-winner', 'Major Winner'], [35, 'ball', 'tartan', 'Tartan'],
 [36, 'flourish', 'lantern-ace', 'Sky lantern on a hole in one'],
 [37, 'tracer', 'aurora', 'Aurora'],
 [38, 'skin', 'carbon', 'Carbon'],
 [39, 'ball', 'marble', 'Marble'],
 [40, 'badge', 'hall-of-fame', 'Hall of Fame'], [40, 'title', 'hall-of-famer', 'Hall of Famer'],
 [41, 'tracer', 'starfall', 'Starfall'],
 [42, 'ball', 'diamond-plate', 'Diamond plate'],
 [43, 'flourish', 'fireworks-birdie', 'Fireworks on any birdie'],
 [44, 'skin', 'gold-leaf', 'Gold leaf'],
 [45, 'badge', 'legend', 'Legend'], [45, 'tracer', 'ghost', 'Ghost'], [45, 'title', 'legend', 'Legend'],
 [46, 'ball', 'gold', 'Gold'],
 [47, 'tracer', 'comet-sparkle', 'Comet tail plus sparkle'],
 [48, 'skin', 'aurora', 'Aurora'],
 [49, 'ball', 'black-pearl', 'Black pearl'],
 [50, 'badge', 'fairway-master', 'Fairway Master'], [50, 'tracer', 'rainbow', 'Rainbow'], [50, 'ball', 'rainbow', 'Rainbow'],
 [50, 'flourish', 'gold-confetti', 'Gold confetti on every hole-out'], [50, 'title', 'fairway-master', 'Fairway Master'], [50, 'skin', 'champion', 'Champion'],
];
export const REWARDS = ROWS.map(([level, kind, id, name]) => ({level, kind, id, name}));
export const KINDS = ['badge', 'tracer', 'ball', 'flourish', 'title', 'skin', 'challenge'];
// What a golfer can choose and wear in this version. Titles may be none.
export const WEARABLE = ['ball', 'tracer', 'title'];
export const DEFAULT_WORN = {ball: 'classic', tracer: 'classic', title: ''};
// How each kind is named on its own, in the level-up banner's list.
export const KIND_NAMES = {badge: 'badge', tracer: 'tracer', ball: 'ball finish', flourish: 'flourish', title: 'title', skin: 'meter skin', challenge: 'challenge'};

export const rewardsOf = kind => REWARDS.filter(r => r.kind === kind);
export const reward = (kind, id) => REWARDS.find(r => r.kind === kind && r.id === id) || null;
// Everything a level brings, in the table's order.
export const unlocksAt = level => REWARDS.filter(r => r.level === level);
export const isUnlocked = (kind, id, level) => { const r = reward(kind, id); return !!r && r.level <= level; };
// What a golfer of this level has on: their choice when it is earned, the
// starting look when it is not -- a mulligan can take back the XP that earned
// it, and the choice is kept for when it is earned again.
export function wornItem(worn, kind, level) {
 const id = worn?.[kind];
 if (kind === 'title' && !id) return '';
 return id && isUnlocked(kind, id, level) ? id : DEFAULT_WORN[kind];
}

// TRACER STYLES (spec 7.4). Shape and effect belong to the style; colour too,
// while the golfer's own shot flies. In the end-of-hole summary every line goes
// back to its golfer's seat colour and keeps its shape (`summaryStyle`), so the
// summary still shows whose line is whose.
//
// colours: 'seat' (the golfer's tracer colour), or stops along the line from
//   the tee (0) to the ball (1); `shift` moves the stops along with time.
// width: the live line's width in pixels (the summary's is 3, as before).
// opacity, dash [on, off] in metres, head (a wider line over the last part:
//   `{share, width}`), core (a thin bright line inside a wide one: `{width,
//   colour}`), sparkle (glints behind the ball: `{count, colour, fall}`, fall in
//   metres a second), jag (a lightning zigzag, metres), flicker (0-1).
// All PLACED by eye, 14 October 2026.
export const TRACERS = {
 classic: {colours: 'seat', width: 4.5},
 sky: {colours: ['#9fdcff', '#5fb4ff'], width: 4.5},
 comet: {colours: 'seat', width: 3.5, head: {share: .14, width: 10}},
 sunset: {colours: ['#ffd36b', '#ff8a4c', '#e2557c', '#9b5bd6'], width: 4.5},
 dashed: {colours: 'seat', width: 4.5, dash: [2.4, 1.6]},
 sparkle: {colours: 'seat', width: 3.5, sparkle: {count: 36, colour: '#fff6c8', fall: 0}},
 ribbon: {colours: 'seat', width: 11, opacity: .42, core: {width: 2.5, colour: '#ffffff'}},
 ice: {colours: ['#ffffff', '#c9f3ff', '#7fd8f5'], width: 5, core: {width: 2, colour: '#ffffff'}},
 fire: {colours: ['#fff1a8', '#ffb23d', '#ff6a1f', '#c8261a'], width: 5.5, flicker: .25, head: {share: .1, width: 9}},
 lightning: {colours: ['#e9f4ff', '#a9ccff'], width: 3, jag: .9, flicker: .45, core: {width: 1.5, colour: '#ffffff'}},
 aurora: {colours: ['#5cf2b0', '#3fd6d6', '#7d7cf2', '#c46ef0'], width: 6, opacity: .8, shift: .12},
 starfall: {colours: 'seat', width: 3.5, sparkle: {count: 48, colour: '#fff9e0', fall: 1.6}},
 ghost: {colours: ['#e8fff4', '#bfe8d6'], width: 6, opacity: .38, flicker: .2},
 'comet-sparkle': {colours: 'seat', width: 3.5, head: {share: .14, width: 10}, sparkle: {count: 40, colour: '#fff6c8', fall: .6}},
 rainbow: {colours: ['#ff4d4d', '#ffa64d', '#ffe74d', '#5ee05e', '#4dc3ff', '#7a6cff', '#d36cff'], width: 5.5, shift: .25},
};
export const tracerStyle = id => TRACERS[id] || TRACERS.classic;
// The summary keeps the shape (dash, the lightning's zigzag) and drops the
// colour and everything that moves.
export function summaryStyle(id) {
 const s = tracerStyle(id);
 return {...(s.dash ? {dash: s.dash} : {}), ...(s.jag ? {jag: s.jag} : {})};
}
// A colour on a line of stops, t from 0 (the tee) to 1 (the ball); `shift`
// slides the stops along with time and wraps.
export function stopColour(stops, t) {
 if (stops.length === 1) return stops[0];
 const x = Math.min(1, Math.max(0, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
 const a = hexRgb(stops[i]), b = hexRgb(stops[i + 1]);
 return a.map((v, k) => v + (b[k] - v) * f);
}
export function hexRgb(h) {
 const n = parseInt(h.slice(1), 16);
 return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
