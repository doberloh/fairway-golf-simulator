import test from 'node:test';
import assert from 'node:assert/strict';
import {REWARDS, KINDS, WEARABLE, DEFAULT_WORN, unlocksAt, isUnlocked, wornItem, rewardsOf, TRACERS, tracerStyle, summaryStyle, stopColour, MAX_UNLOCK_LEVEL} from '../src/rewards.js';
import {FINISH_IDS, finishColour, finishTexels, ballPixels, finishAverage, finishSurface} from '../src/ball-finishes.js';

// THE TABLE IS THE SPEC'S (7.1): its counts, nothing past 50, a starting look
// for each kind at level 1, and no id twice within a kind.
test('the reward table holds the spec\'s counts, all by level 50', () => {
 const count = k => rewardsOf(k).length;
 assert.equal(count('badge'), 11);
 // Phase 5's fifteen and sixteen, plus eight plain colours each from the start
 // (15 October 2026); frames a list of their own: the eleven badges', nine
 // plain colours and thirteen animated.
 // Plus one each for four of the five levels filled on 15 October 2026 (the
 // fifth is a title).
 assert.equal(count('tracer'), 24);
 assert.equal(count('ball'), 25);
 assert.equal(count('frame'), 34);
 assert.equal(rewardsOf('frame').filter(r => r.level === 1).length, 10);
 assert.equal(count('flourish'), 7);
 assert.equal(count('title'), 11);
 assert.equal(count('skin'), 11);
 assert.equal(count('challenge') - 2, 3, 'three challenges besides the course of the week and achievements');
 for (const r of REWARDS) {
  assert.ok(KINDS.includes(r.kind), r.kind);
  assert.ok(r.level >= 1 && r.level <= MAX_UNLOCK_LEVEL, `${r.id} at ${r.level}`);
 }
 for (const k of KINDS) {
  const ids = rewardsOf(k).map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, `${k} ids repeat`);
 }
 for (const k of ['badge', 'frame', 'tracer', 'ball', 'skin']) assert.ok(rewardsOf(k).some(r => r.level === 1), `${k} has no starting look`);
 assert.deepEqual(unlocksAt(51), []);
 assert.ok(unlocksAt(50).length >= 6, 'level 50 brings the rainbow set');
});

test('every tracer and every ball finish in the table has a look, and nothing else does', () => {
 assert.deepEqual(rewardsOf('tracer').map(r => r.id).sort(), Object.keys(TRACERS).sort());
 assert.deepEqual(rewardsOf('ball').map(r => r.id).sort(), [...FINISH_IDS].sort());
});

test('a golfer wears what they have earned, and the starting look otherwise', () => {
 assert.equal(isUnlocked('tracer', 'sky', 1), false);
 assert.equal(isUnlocked('tracer', 'sky', 2), true);
 assert.equal(wornItem({tracer: 'sky'}, 'tracer', 2), 'sky');
 // XP taken back by a mulligan: the choice is kept but not worn.
 assert.equal(wornItem({tracer: 'sky'}, 'tracer', 1), 'classic');
 assert.equal(wornItem({ball: 'nonsense'}, 'ball', 50), 'classic');
 assert.equal(wornItem({}, 'title', 50), '', 'no title unless one is chosen');
 assert.equal(wornItem({title: 'legend'}, 'title', 44), '');
 assert.equal(wornItem({title: 'legend'}, 'title', 45), 'legend');
 assert.deepEqual(WEARABLE, ['ball', 'tracer', 'title', 'frame', 'skin']);
});

test('the summary keeps a tracer\'s colours and shape', () => {
 // The summary keeps the golfer's colours too (15 October 2026).
 assert.deepEqual(summaryStyle('dashed'), {colours: TRACERS.dashed.colours, dash: TRACERS.dashed.dash});
 assert.deepEqual(summaryStyle('lightning'), {colours: TRACERS.lightning.colours, jag: TRACERS.lightning.jag});
 assert.deepEqual(summaryStyle('sunset'), {colours: TRACERS.sunset.colours});
 for (const [id, st] of Object.entries(TRACERS)) assert.ok(Array.isArray(st.colours) && st.colours.length, id + ' has no colours of its own');
 assert.equal(tracerStyle('nonsense'), TRACERS.classic);
 assert.deepEqual(stopColour(['#000000', '#ffffff'], .5).map(v => +v.toFixed(3)), [.5, .5, .5]);
 // A one-colour tracer: numbers, not the hex string (it froze the game).
 assert.deepEqual(stopColour(['#ff0000'], .3), [1, 0, 0]);
 for (const [id, st] of Object.entries(TRACERS)) assert.ok(Array.isArray(stopColour(st.colours, .5)), id + ' gives no colour');
 assert.deepEqual(stopColour(['#ff0000', '#0000ff'], 2), [0, 0, 1]);
});

// ONE SOURCE: the texture the ball wears and the picture are drawn from the
// same rule, so the colour at the middle of the picture is the colour of the
// texel looking the same way.
test('a finish paints the texture and the picture from the same rule', () => {
 for (const id of FINISH_IDS) {
  const tex = finishTexels(id, 64, 32);
  assert.equal(tex.length, 64 * 32 * 4);
  // The texel on the equator that faces +z (three's sphere: phi = pi/2 ->
  // column w/4) against the finish's own colour there.
  const k = (16 * 64 + 16) * 4, c = finishColour(id, [-Math.cos((16.5 / 64) * 2 * Math.PI) * Math.sin((1 - 16.5 / 32) * Math.PI), Math.cos((1 - 16.5 / 32) * Math.PI), Math.sin((16.5 / 64) * 2 * Math.PI) * Math.sin((1 - 16.5 / 32) * Math.PI)]);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(tex[k + i] - Math.round(Math.min(1, Math.max(0, c[i])) * 255)) <= 1, `${id} texel and rule disagree`);
  const px = ballPixels(id, 40);
  assert.equal(px[3], 0, `${id}: the corner of the picture is not transparent`);
  assert.ok(px[(20 * 40 + 20) * 4 + 3] === 255, `${id}: the middle of the picture is not solid`);
  for (const v of finishAverage(id)) assert.ok(v >= 0 && v <= 1);
  assert.ok(finishSurface(id).rough > 0 && finishSurface(id).rough <= 1);
 }
});

test('the finishes look different from each other', () => {
 const avg = Object.fromEntries(FINISH_IDS.map(id => [id, finishAverage(id)]));
 const far = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
 assert.ok(far(avg.classic, avg.gold) > .3);
 assert.ok(far(avg.classic, avg['black-pearl']) > .5);
 assert.ok(far(avg.pumpkin, avg.galaxy) > .4);
 // A turned close-up shows a different side.
 const a = ballPixels('two-tone', 24, 0), b = ballPixels('two-tone', 24, .25);
 assert.notDeepEqual(a, b);
});

// PHASE 6 -----------------------------------------------------------------
import {FRAMES, highestBadge, badgeName, METER_SKINS, flourishFor, goldFlourishes, SECRET_FLOURISHES} from '../src/rewards.js';

test('every badge has a frame, the newest is worn unless one is chosen, and Master counts on', () => {
 assert.deepEqual(Object.keys(FRAMES).sort(), rewardsOf('frame').map(r => r.id).sort());
 for (const r of rewardsOf('badge')) assert.ok(rewardsOf('frame').some(q => q.id === r.id && q.level === r.level), r.id + ' brings no frame');
 assert.equal(highestBadge(1), 'rookie');
 assert.equal(highestBadge(14), 'club-regular');
 assert.equal(highestBadge(60), 'fairway-master');
 assert.equal(wornItem({}, 'frame', 22), 'scratch', 'unchosen: the newest');
 assert.equal(wornItem({frame: 'club-member'}, 'frame', 22), 'club-member');
 assert.equal(wornItem({frame: 'legend'}, 'frame', 22), 'scratch', 'not earned: the newest');
 assert.equal(badgeName(57), 'Master 57');
 assert.equal(badgeName(50), 'Fairway Master');
 assert.equal(badgeName(5), 'Club Member');
});

// LEGIBLE IN EVERY SKIN (spec 7.6): the zone over the track, the perfect band
// and the target marker must stand apart by LIGHTNESS -- not by hue alone --
// for normal vision and simulated red-green colour blindness, so a player who
// cannot tell yellow from green still sees the band inside the zone.
const rgb = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const [r, g, b, a = 1] = m[1].split(',').map(Number); return {c: [r, g, b].map(v => v / 255), a}; } const n = parseInt(c.slice(1), 16); return {c: [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255], a: 1}; };
const lin = v => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
const over = (top, base) => top.c.map((v, i) => v * top.a + base.c[i] * (1 - top.a));
// Machado, Oliveira and Fernandes (2009), severity 1.0, applied in linear light.
const SIM = {none: null, deutan: [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.01182, .04294, .968881]], protan: [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]]};
const lum = (c, m) => { let l = c.map(lin); if (m) l = m.map(r => Math.max(0, r[0] * l[0] + r[1] * l[1] + r[2] * l[2])); return .2126 * l[0] + .7152 * l[1] + .0722 * l[2]; };
const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
test('every meter skin keeps the zone, the perfect band and the target apart, colour blind or not', () => {
 assert.equal(Object.keys(METER_SKINS).length, 11);
 assert.deepEqual(Object.keys(METER_SKINS).sort(), rewardsOf('skin').map(r => r.id).sort());
 for (const [id, s] of Object.entries(METER_SKINS)) for (const [vision, m] of Object.entries(SIM)) {
  const base = rgb(s.base), zone = over(rgb(s.zone), base), perfect = rgb(s.perfect).c, target = rgb(s.target).c;
  const Lt = lum(base.c, m), Lz = lum(zone, m), Lp = lum(perfect, m), Lg = lum(target, m);
  assert.ok(ratio(Lz, Lt) >= 1.5, `${id} (${vision}): the zone barely shows on the track (${ratio(Lz, Lt).toFixed(2)})`);
  assert.ok(ratio(Lp, Lz) >= 1.5, `${id} (${vision}): the perfect band is lost in the zone (${ratio(Lp, Lz).toFixed(2)})`);
  assert.ok(ratio(Lg, Lt) >= 3, `${id} (${vision}): the target marker is faint on the track (${ratio(Lg, Lt).toFixed(2)})`);
 }
});

// SIMPLE TO GRAND (the owner, 15 October 2026): a par first, then a birdie,
// an eagle, a chip-in, fireworks for every birdie; the ace's lantern from the
// start; level 50 turns them gold rather than outranking them.
test('a hole-out shows the rarest flourish the golfer has earned', () => {
 assert.equal(flourishFor({score: 1, par: 3}, 1), 'lantern-ace', 'the lantern is open from the start');
 assert.equal(flourishFor({score: 4, par: 4}, 1), null, 'nothing else at level 1');
 assert.equal(flourishFor({score: 4, par: 4}, 2), 'sparkle-par', 'a par is the first');
 assert.equal(flourishFor({score: 3, par: 4}, 4), null, 'no birdie flourish before level 5');
 assert.equal(flourishFor({score: 3, par: 4}, 5), 'confetti-birdie');
 assert.equal(flourishFor({score: 3, par: 5}, 11), 'confetti-birdie', 'an eagle before level 12 still gets the birdie confetti');
 assert.equal(flourishFor({score: 3, par: 5}, 12), 'fireworks-eagle');
 assert.equal(flourishFor({score: 3, par: 4, chipIn: true}, 20), 'ring-chip-in');
 assert.equal(flourishFor({score: 5, par: 4, chipIn: true}, 20), null, 'a chip-in for bogey is no celebration');
 assert.equal(flourishFor({score: 3, par: 4}, 30), 'fireworks-birdie');
 assert.equal(flourishFor({score: 6, par: 4}, 50), null, 'level 50 adds no flourish for a double bogey');
 assert.equal(flourishFor({score: 4, par: 4}, 50), 'sparkle-par', 'level 50 outranks nothing');
 assert.equal(goldFlourishes(49), false);
 assert.equal(goldFlourishes(50), true);
 assert.equal(rewardsOf('flourish').find(r => r.id === 'lantern-ace').level, 1);
 assert.ok(SECRET_FLOURISHES.has('lantern-ace'));
 // Unlocked in order: par, birdie, eagle.
 const at = id => rewardsOf('flourish').find(r => r.id === id).level;
 assert.ok(at('sparkle-par') < at('confetti-birdie') && at('confetti-birdie') < at('fireworks-eagle'));
});

// EVERY ITEM, ONE BY ONE (15 October 2026). The owner cannot reach most of
// these without weeks of play, so each is checked at its own level: shut one
// level early, open at its level, and worn only once it is open. A lock that
// lets go early fails here by name; a reward given the wrong level in the
// table is caught by the agreed list at the end of this file.
import {unlocksBetween, reward, ACHIEVEMENT_TITLES, DEFAULT_WORN as STARTING} from '../src/rewards.js';

test('every reward is shut one level early and open at its level', () => {
 for (const r of REWARDS) {
  assert.equal(isUnlocked(r.kind, r.id, r.level), true, `${r.kind} ${r.id} is shut at its level ${r.level}`);
  assert.equal(isUnlocked(r.kind, r.id, MAX_UNLOCK_LEVEL + 20), true, `${r.kind} ${r.id} shuts again past 50`);
  if (r.level > 1) assert.equal(isUnlocked(r.kind, r.id, r.level - 1), false, `${r.kind} ${r.id} opens before level ${r.level}`);
 }
});

test('every wearable item is worn from its level and not a level before', () => {
 for (const kind of WEARABLE) for (const r of rewardsOf(kind)) {
  assert.equal(wornItem({[kind]: r.id}, kind, r.level), r.id, `${kind} ${r.id} is not worn at level ${r.level}`);
  if (r.level > 1) {
   const early = wornItem({[kind]: r.id}, kind, r.level - 1);
   assert.notEqual(early, r.id, `${kind} ${r.id} is worn at level ${r.level - 1}`);
   // What is worn instead is the starting look (a frame: the newest badge's).
   if (kind === 'frame') assert.equal(early, highestBadge(r.level - 1));
   else assert.equal(early, STARTING[kind], `${kind} ${r.id} too early falls back to ${early}`);
  }
 }
});

test('an achievement title is worn only once the achievement is earned', () => {
 assert.ok(ACHIEVEMENT_TITLES.length > 0);
 for (const t of ACHIEVEMENT_TITLES) {
  assert.equal(isUnlocked('title', t.id, MAX_UNLOCK_LEVEL), false, `${t.id} is open without its achievement`);
  assert.equal(isUnlocked('title', t.id, 1, {[t.achievement]: 1}), true, `${t.id} stays shut with its achievement`);
  assert.equal(wornItem({title: t.id}, 'title', 50), '');
  assert.equal(wornItem({title: t.id}, 'title', 1, {[t.achievement]: 1}), t.id);
 }
});

test('the level-up banner lists what each level brought, every level crossed', () => {
 const badgeFrame = r => r.kind === 'frame' && !!reward('badge', r.id);
 for (let l = 2; l <= MAX_UNLOCK_LEVEL; l++)
  assert.deepEqual(unlocksBetween(l - 1, l), unlocksAt(l).filter(r => !badgeFrame(r)), `level ${l}`);
 // One gain across several levels lists them all, in order.
 assert.deepEqual(unlocksBetween(3, 6), [...unlocksBetween(3, 4), ...unlocksBetween(4, 5), ...unlocksBetween(5, 6)]);
 // Across the whole climb: everything past level 1 exactly once, badges
 // included, their own frames not.
 const all = unlocksBetween(1, MAX_UNLOCK_LEVEL);
 assert.deepEqual(new Set(all), new Set(REWARDS.filter(r => r.level > 1 && !badgeFrame(r))));
 assert.equal(all.length, new Set(all).size);
 assert.ok(all.some(r => r.kind === 'badge'));
 assert.ok(!all.some(badgeFrame));
 // Nothing for no change, and nothing past 50 (levels never stop, rewards do).
 assert.deepEqual(unlocksBetween(5, 5), []);
 assert.deepEqual(unlocksBetween(50, 60), []);
 // The banner can only list what a golfer can then put on.
 for (const r of all) assert.equal(isUnlocked(r.kind, r.id, r.level), true);
});

// THE LEVELS ARE THE AGREED ONES, pinned (15 October 2026). The tests above
// read each reward's level from the table, so they prove the locks follow the
// table -- not that the table is right. This list is the table as agreed with
// the owner (spec section 7, the 15 October changes); moving a reward means
// changing it here too, on purpose.
const AGREED = {
 badge: 'rookie:1 club-member:5 club-regular:10 single-digit:15 scratch:20 tour-card:25 contender:30 major-winner:35 hall-of-fame:40 legend:45 fairway-master:50',
 frame: 'plain-white:1 plain-black:1 plain-red:1 plain-orange:1 plain-yellow:1 plain-green:1 plain-blue:1 plain-purple:1 plain-pink:1 rookie:1 club-member:5 sparkle-silver:7 water:9 club-regular:10 leaves:13 single-digit:15 flames:16 sparkle-gold:19 scratch:20 leaves-autumn:21 flames-blue:24 tour-card:25 ice:26 flames-green:29 contender:30 deep-water:32 major-winner:35 lightning:36 flames-purple:38 hall-of-fame:40 aurora:42 legend:45 galaxy:47 fairway-master:50',
 tracer: 'classic:1 red:1 orange:1 yellow:1 green:1 blue:1 purple:1 pink:1 white:1 sky:2 comet:7 sunset:11 smoke:14 dashed:16 sparkle:19 ribbon:23 ice:26 fire:30 lightning:33 aurora:37 starfall:41 ghost:45 comet-sparkle:47 rainbow:50',
 ball: 'classic:1 solid-red:1 solid-orange:1 solid-yellow:1 solid-green:1 solid-blue:1 solid-purple:1 solid-pink:1 solid-black:1 red-stripe:3 smiley:8 two-tone:10 polka-dot:13 pumpkin:17 glow:21 chrome:25 camo:28 galaxy:31 tartan:35 marble:39 diamond-plate:42 lava:43 gold:46 black-pearl:49 rainbow:50',
 flourish: 'lantern-ace:1 sparkle-par:2 confetti-birdie:5 fireworks-eagle:12 ring-chip-in:20 fireworks-birdie:30 gold-flourishes:50',
 title: 'weekend-golfer:4 range-rat:9 flag-hunter:15 low-ball:20 grinder:22 tour-rookie:25 sharpshooter:29 iron-will:34 hall-of-famer:40 legend:45 fairway-master:50',
 skin: 'classic:1 wood:6 neon:12 retro-pixel:18 chalkboard:24 sunset:27 blueprint:32 carbon:38 gold-leaf:44 aurora:48 champion:50',
 challenge: 'course-of-the-week:1 achievements:1 closest:1 long-drive:1 up-and-down:1',
};
test('every reward unlocks at the level agreed with the owner', () => {
 for (const kind of KINDS) {
  const want = Object.fromEntries(AGREED[kind].split(' ').map(p => { const [id, l] = p.split(':'); return [id, Number(l)]; }));
  const have = Object.fromEntries(rewardsOf(kind).map(r => [r.id, r.level]));
  assert.deepEqual(have, want, `${kind}: the table's levels differ from the agreed ones`);
 }
});

// EVERY LEVEL BRINGS SOMETHING (the owner, 15 October 2026, filling 14, 22,
// 27, 36 and 43), and every animated frame has its two rules in the
// stylesheet -- the ring and the effect outside it -- or it shows as a plain
// still ring with nothing said.
test('every level from 2 to 50 brings something', () => {
 for (let l = 2; l <= MAX_UNLOCK_LEVEL; l++) assert.ok(unlocksBetween(l - 1, l).length > 0, 'level ' + l + ' brings nothing');
});
test('every animated frame is drawn by the stylesheet, ring and effect', async () => {
 const fs = await import('node:fs');
 const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
 const anims = new Set(Object.values(FRAMES).filter(f => f.anim).map(f => f.anim));
 assert.ok(anims.has('lightning'));
 for (const a of anims) {
  assert.ok(css.includes('.ball-avatar.framed[data-anim=' + a + ']'), a + ': no ring rule');
  assert.ok(css.includes('.frame-fx[data-fx=' + a + ']'), a + ': no effect rule');
 }
});
