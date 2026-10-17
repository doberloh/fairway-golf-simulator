import test from 'node:test';
import assert from 'node:assert/strict';
import {ACHIEVEMENTS, achievement, sandSave, longestStreak, holeAchievements, roundAchievements, countedAchievements, earn, markOnce, blankProgress, normaliseProgress, normaliseEarned, progressOf} from '../src/achievements.js';
import {ACHIEVEMENT_TITLES, isUnlocked, wornItem, reward} from '../src/rewards.js';

// THE SPEC'S TABLE (8.3): thirteen, each with XP, the titles where named.
// Thirteen from the spec, and five for the challenges (16 October 2026).
test('eighteen achievements, each paying XP, eleven with a title', () => {
 assert.equal(ACHIEVEMENTS.length, 18);
 assert.equal(new Set(ACHIEVEMENTS.map(a => a.id)).size, 18);
 for (const a of ACHIEVEMENTS) assert.ok(a.xp > 0 && a.name && a.how, a.id);
 assert.equal(ACHIEVEMENTS.filter(a => a.title).length, 11);
 assert.equal(achievement('ace').xp, 200);
});

test('an up-and-down from sand is the hole finished within one stroke of the last sand shot', () => {
 assert.equal(sandSave([3], 4), true, 'out of the bunker, one putt');
 assert.equal(sandSave([3], 3), true, 'holed from the sand');
 assert.equal(sandSave([3], 5), false, 'two putts');
 assert.equal(sandSave([2, 3], 4), true, 'the last sand shot counts');
 assert.equal(sandSave([], 4), false);
 assert.equal(sandSave(undefined, 4), false);
});

test('a hole earns First birdie and Ace; a round its own', () => {
 assert.deepEqual(holeAchievements({score: 3, par: 4}), ['first-birdie']);
 assert.deepEqual(holeAchievements({score: 1, par: 3}), ['first-birdie', 'ace']);
 assert.deepEqual(holeAchievements({score: 4, par: 4}), []);
 const holes = Array.from({length: 18}, (_, i) => ({par: i % 6 === 0 ? 3 : 4, score: i % 6 === 0 ? 2 : 4, fairway: i % 6 !== 0}));
 const got = roundAchievements({holes, index: 2, floodlit: true, biome: 'redwood'});
 assert.ok(got.includes('fairway-finder'), 'fifteen fairways');
 assert.ok(got.includes('par3-sweep'), 'every par 3 a birdie');
 assert.ok(got.includes('beat-the-index'), 'three under against an index of 2');
 assert.ok(got.includes('night-owl') && got.includes('fog-walker'));
 assert.ok(!got.includes('ghost-hunter'));
 // A nine is held to half the index: one over against an index of 4 beats it.
 const nine = Array.from({length: 9}, (_, i) => ({par: 4, score: i ? 4 : 5}));
 assert.ok(roundAchievements({holes: nine, index: 4}).includes('beat-the-index'));
 assert.ok(!roundAchievements({holes: nine, index: 2}).includes('beat-the-index'));
 assert.ok(!roundAchievements({holes: nine, index: null}).includes('beat-the-index'), 'no index, no achievement');
});

test('counted achievements, streaks, and each earned only once', () => {
 assert.equal(longestStreak([3, 4, 5, 7, 8, 9, 10]), 4);
 assert.equal(longestStreak([]), 0);
 const prof = {counters: {sandSaves: 25, onNumber: 49}, progress: {...blankProgress(), rounds: 100, biomes: ['a', 'b'], weeks: [10, 11, 12, 13]}};
 assert.deepEqual(countedAchievements(prof).sort(), ['centurion', 'sandy', 'streak']);
 assert.deepEqual(progressOf(achievement('on-the-dot'), prof), [49, 50]);
 assert.deepEqual(progressOf(achievement('globetrotter'), prof), [2, 9]);
 assert.deepEqual(earn(prof, ['sandy', 'sandy', 'nonsense'], 5), ['sandy']);
 assert.deepEqual(earn(prof, ['sandy']), [], 'never twice');
 const p = blankProgress();
 assert.equal(markOnce(p, 'r1:done'), true);
 assert.equal(markOnce(p, 'r1:done'), false);
});

test('stored progress is cleaned on the way in', () => {
 assert.deepEqual(normaliseProgress({rounds: -1, biomes: ['pnw', 'pnw', 4], weeks: [3, 'x', 2], once: ['a', 5]}), {rounds: 0, biomes: ['pnw'], weeks: [2, 3], chalWeeks: [], once: ['a']});
 assert.deepEqual(normaliseProgress({chalWeeks: [9, 8, 8, 'x']}).chalWeeks, [8, 9]);
 assert.deepEqual(normaliseEarned({ace: 5, bogus: 1, sandy: 'x'}), {ace: 5});
});

// TITLES FROM ACHIEVEMENTS (spec 7.5): worn only once earned, whatever the level.
test('an achievement title is earned with its achievement, not by level', () => {
 assert.equal(ACHIEVEMENT_TITLES.length, 11);
 assert.equal(reward('title', 'ach-ace').name, 'Ace');
 assert.equal(isUnlocked('title', 'ach-ace', 50, {}), false);
 assert.equal(isUnlocked('title', 'ach-ace', 1, {ace: 1}), true);
 assert.equal(wornItem({title: 'ach-ace'}, 'title', 1, {ace: 1}), 'ach-ace');
 assert.equal(wornItem({title: 'ach-ace'}, 'title', 50, {}), '');
});

// THE CHALLENGE ACHIEVEMENTS (16 October 2026): counted from the profile's
// medals and the weeks the challenge of the week was played.
test('medals and weeks of the week\'s challenge earn their achievements', () => {
 const prof = {medals: {closest: 1}, progress: {...blankProgress(), chalWeeks: [140, 141, 142]}};
 assert.deepEqual(progressOf(achievement('first-medal'), prof), [1, 1]);
 assert.ok(countedAchievements(prof).includes('first-medal'));
 assert.ok(!countedAchievements(prof).includes('weekly-regular'), 'three weeks running is not four');
 prof.progress.chalWeeks.push(143);
 assert.ok(countedAchievements(prof).includes('weekly-regular'));
 const golds = {medals: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(k => [k, 3]))};
 assert.deepEqual(progressOf(achievement('gold-standard'), golds), [10, 10]);
 assert.equal(achievement('all-rounder').goal, 33, 'every challenge with medals');
 // Head of the Table: head-to-heads won, all of them together.
 const h = {challenges: {shootout: {won: 4, plays: 9}, knockout: {won: 3, plays: 5}, bbb: {won: 2, plays: 2}}};
 assert.deepEqual(progressOf(achievement('head-of-the-table'), h), [9, 10]);
 h.challenges.bbb.won = 3;
 assert.ok(countedAchievements(h).includes('head-of-the-table'));
 assert.ok(!countedAchievements({medals: {closest: 3}}).includes('all-rounder'));
});
