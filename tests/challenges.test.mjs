// The challenge table, medals and records (challenges.js). How a play runs is
// challenge-play.test.mjs and challenge-matrix.test.mjs; where balls go is
// challenge-spots.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CHALLENGES, GROUPS, challenge, challengesIn, medalOf, medalTargets, better, recordChallenge, normaliseRecords, normaliseMedals,
 medalsFromRecords, recordScore, feetText, scoreText, targetText, isUpAndDown, MEDAL_TOTAL, challengeCourseSettings, CHALLENGE_SEED} from '../src/challenges.js';
import {rewardsOf} from '../src/rewards.js';

const ORDERS = ['turns', 'streak', 'spotOut', 'knockout', 'holes', 'round'], PLAYS = ['max', 'min', 'sum', 'mean', 'updown', 'knockout', 'points', 'round'];
const SHOWS = ['feet', 'yards', 'points', 'count', 'updown', 'percent', 'strokes', 'versus'];
const HOLES = ['par3', 'shortPar3', 'longest', 'longPar4', 'par4', 'spots', 'bigGreen', 'course'];

// THE PLAN'S 36, in seven tabs (16 October 2026): 27 in step 1, the four that
// go from hole to hole, three head-to-heads and two rounds in step 3.
test('36 challenges, each row complete, in seven tabs', () => {
 assert.equal(CHALLENGES.length, 36);
 assert.deepEqual(GROUPS.map(g => [g.id, challengesIn(g.id).length]), [['tee', 6], ['approach', 7], ['range', 6], ['short', 7], ['putting', 5], ['versus', 3], ['rounds', 2]]);
 assert.equal(new Set(CHALLENGES.map(c => c.id)).size, CHALLENGES.length, 'ids are unique');
 for (const c of CHALLENGES) {
  for (const k of ['id', 'name', 'group', 'how', 'where', 'balls', 'order', 'ball', 'play', 'better', 'show']) assert.ok(c[k] != null, `${c.id} has no ${k}`);
  assert.ok(GROUPS.some(g => g.id === c.group), c.id);
  assert.ok(['course', 'range', 'round'].includes(c.where), c.id);
  assert.ok(ORDERS.includes(c.order) && PLAYS.includes(c.play) && SHOWS.includes(c.show), c.id);
  assert.ok(['high', 'low'].includes(c.better), c.id);
  if (c.where === 'course') assert.ok(HOLES.includes(c.hole), `${c.id} needs a hole rule`);
  if (c.hole === 'course') assert.ok(c.spot?.kind, `${c.id} needs spots across holes`);
  if (c.where === 'range') assert.ok(!c.spot && !c.hole, `${c.id} plays from the mat`);
  if (c.where === 'round') assert.ok(['suddendeath', 'bogeyfree'].includes(c.goal), `${c.id} is a round with a goal`);
  if (c.targets) assert.equal(c.targets.length, c.balls, `${c.id}: a target for every ball`);
  if (c.order === 'spotOut') assert.ok(['updown', 'sum'].includes(c.play), c.id);
  // Head to head is won, not medalled, and needs a group.
  if (c.group === 'versus') { assert.equal(c.medals, null, c.id); assert.equal(c.who, 'group', c.id); assert.equal(medalOf(c, {won: true}), 0); continue; }
  assert.equal(c.medals.length, 3, c.id);
  // Bronze is the easiest.
  const t = medalTargets(c, {driver: 250, length: 160});
  for (let k = 1; k < 3; k++) assert.ok(c.better === 'low' ? t[k] < t[k - 1] : t[k] > t[k - 1], `${c.id}: medals in order ${t}`);
  if (c.show === 'points') assert.ok(c.better === 'high', c.id);
 }
 assert.equal(MEDAL_TOTAL, 99, 'three medals in each of the 33 that have them');
 // The putting ones hole out, whatever the group's putting setting.
 for (const c of challengesIn('putting')) assert.equal(c.putts, true, c.id);
});

// ALL OPEN FROM THE START (the owner, 15 and 16 October 2026): the reward table
// holds one row for the lot, at level 1, so no level-up banner announces one.
test('every challenge is open: one row in the reward table, at level 1', () => {
 const rows = rewardsOf('challenge').filter(r => !['course-of-the-week', 'achievements'].includes(r.id));
 assert.deepEqual(rows.map(r => [r.id, r.level]), [['challenges', 1]]);
 for (const c of CHALLENGES) assert.equal(c.level, undefined, `${c.id} carries no level`);
});

test('the Challenge Course is fixed: one seed, eighteen holes, the default settings otherwise', () => {
 const a = challengeCourseSettings(), b = challengeCourseSettings();
 assert.deepEqual(a, b);
 assert.equal(a.seed, CHALLENGE_SEED);
 assert.equal(a.holes, 18);
});

test('medals are scored against the golfer: their driver, or the hole\'s length', () => {
 const long = challenge('long'), straight = challenge('straight'), closest = challenge('closest');
 assert.deepEqual(medalTargets(long, {driver: 250}), [255, 270, 285]);
 assert.deepEqual(medalTargets(long, {driver: 200}), [205, 220, 235], 'a shorter hitter has a shorter gold');
 assert.equal(medalOf(long, 236, {driver: 200}), 3);
 assert.equal(medalOf(long, 236, {driver: 250}), 0);
 assert.deepEqual(medalTargets(straight, {driver: 200}), [150, 170, 190]);
 // 160 yards is 480 feet: 8%, 4% and 2%.
 assert.deepEqual(medalTargets(closest, {length: 160}), [38, 19, 10]);
 assert.equal(medalOf(closest, 9.5, {length: 160}), 3);
 assert.equal(medalOf(closest, 20, {length: 160}), 1);
 assert.equal(medalOf(closest, null, {length: 160}), 0, 'no ball on the green, no medal');
 const ud = challenge('updown');
 assert.equal(medalOf(ud, {made: 3, strokes: 13}), 2);
 assert.equal(medalOf(ud, {made: 1, strokes: 20}), 0);
 assert.equal(medalOf(challenge('lag'), 8, {}), 3, 'lower is better: 8 feet left is gold');
 assert.equal(medalOf(challenge('lag'), 26, {}), 0);
});

test('a better score is higher or lower, as the row says; up and down breaks ties on strokes', () => {
 assert.equal(better(challenge('closest'), 5, 7), true);
 assert.equal(better(challenge('long'), 5, 7), false);
 assert.equal(better(challenge('long'), 5, null), true);
 assert.equal(better(challenge('long'), null, 5), false);
 assert.equal(better(challenge('updown'), {made: 3, strokes: 12}, {made: 3, strokes: 13}), true);
 assert.equal(better(challenge('updown'), {made: 2, strokes: 9}, {made: 3, strokes: 13}), false);
});

test('scores are written the way the player reads them', () => {
 assert.equal(feetText(14.25), '14 ft 3 in');
 assert.equal(feetText(.5), '6 in');
 assert.equal(feetText(null), 'missed');
 assert.equal(isUpAndDown(2), true); assert.equal(isUpAndDown(3), false);
 assert.equal(scoreText(challenge('closest'), 14.25), '14 ft 3 in');
 assert.equal(scoreText(challenge('lag'), 21.4), '21 ft');
 assert.equal(scoreText(challenge('fairway'), 7), '7 fairways');
 assert.equal(scoreText(challenge('dartboard'), 1), '1 point');
 assert.equal(scoreText(challenge('updown'), {made: 3, strokes: 13}), '3 up and down, 13 strokes');
 assert.equal(targetText(challenge('closest'), 10), 'within 10 ft');
 assert.equal(targetText(challenge('number'), 3), '3 yd or less');
});

// Skins is a round format now; its rule is tested in skins.test.mjs. Its
// record is still kept here, with the challenges'.
test('records keep the best in the old shapes for the first three, and count plays', () => {
 const prof = {};
 assert.equal(recordChallenge(prof, 'closest', 12.3), true);
 assert.equal(recordChallenge(prof, 'closest', 15), false);
 assert.equal(recordChallenge(prof, 'closest', null), false);
 assert.equal(prof.challenges.closest.plays, 3, 'every play counts, even one with no score');
 assert.equal(recordChallenge(prof, 'long', 280), true);
 assert.equal(recordChallenge(prof, 'long', 279), false);
 assert.equal(recordChallenge(prof, 'updown', {made: 3, strokes: 14}), true);
 assert.equal(recordChallenge(prof, 'updown', {made: 3, strokes: 15}), false);
 assert.equal(recordChallenge(prof, 'updown', {made: 3, strokes: 13}), true, 'fewer strokes breaks a tie');
 assert.equal(recordChallenge(prof, 'lag', 30), true);
 assert.equal(recordChallenge(prof, 'lag', 22), true, 'lower is better');
 assert.equal(recordChallenge(prof, 'sand', {made: 2, strokes: 15}), true);
 assert.equal(recordChallenge(prof, 'nothing', 3), false);
 recordChallenge(prof, 'skins', 3); recordChallenge(prof, 'skins', 2);
 assert.deepEqual(prof.challenges.skins, {won: 5, games: 2});
 const back = normaliseRecords(JSON.parse(JSON.stringify(prof.challenges)));
 assert.equal(back.closest.feet, 12.3); assert.equal(back.closest.plays, 3); assert.equal(back.updown.strokes, 13);
 assert.equal(back.lag.best, 22); assert.deepEqual(back.sand.best, {made: 2, strokes: 15});
 assert.equal(recordScore('lag', back.lag), 22); assert.equal(recordScore('long', back.long), 280);
 assert.equal(back.skins.won, 5, 'the skins record survives a reload');
 assert.deepEqual(normaliseRecords({closest: {feet: -1}, long: 'x', lag: {best: 'far'}, ghost: {best: 3}}), {});
 assert.equal(challenge('skins'), null, 'skins is a round format, not a challenge');
});

// A RECORD FROM BEFORE MEDALS (0.8.1 kept {feet}, {yards}, {made, strokes})
// shows the medal it reaches, once, with no XP -- and is never re-measured.
test('old records become medals once, and only the first three', () => {
 const prof = {challenges: normaliseRecords({closest: {feet: 9, at: 1}, long: {yards: 290, at: 1}, updown: {made: 1, strokes: 20, at: 1}})};
 assert.equal(medalsFromRecords(prof, {driver: 250}), true);
 assert.deepEqual(prof.medals, {closest: 3, long: 3});
 assert.equal(medalsFromRecords(prof, {driver: 100}), false, 'done once');
 const none = {};
 medalsFromRecords(none);
 assert.deepEqual(none.medals, {}, 'a golfer with no records gets an empty set, which marks it done');
 assert.deepEqual(normaliseMedals({closest: 3, long: 4, ghost: 2, lag: 1}), {closest: 3, lag: 1});
});

// HEAD TO HEAD keeps games won and played, never a best.
test('a head-to-head records wins and games', () => {
 const prof = {};
 assert.equal(recordChallenge(prof, 'shootout', {won: true}), false);
 recordChallenge(prof, 'shootout', {won: false});
 assert.deepEqual(prof.challenges.shootout, {won: 1, plays: 2});
 assert.deepEqual(normaliseRecords({shootout: {won: 1, plays: 2}, bbb: {best: 3}}), {shootout: {won: 1, plays: 2}});
 assert.equal(scoreText(challenge('bbb'), {won: true}), 'Won');
 assert.equal(scoreText(challenge('par3s'), .0423), '4.2% of the length');
 recordChallenge(prof, 'par3s', .04234);
 assert.equal(prof.challenges.par3s.best, .042, 'a share keeps three places');
});
