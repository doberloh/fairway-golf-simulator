import test from 'node:test';
import assert from 'node:assert/strict';
import {holeSlab, distanceText, riseText, conditions, clubPanel, parScore, golferCards, keyHints, ballLight, hudScale, MIN_HUD_SCALE, ROUND_MIN_WIDTH, YARD, FOOT} from '../src/round-hud.js';
import {CLUBS} from '../src/clubs.js';

const MINUS = '−';

test('the hole slab: number, course, par and yards; the range says R and its green', () => {
 assert.deepEqual(holeSlab({hole: 6, par: 4, yards: 412.4, course: 'Hemlock Head', pin: 'front'}),
  {number: '7', name: 'HEMLOCK HEAD', line: ['PAR 4', '412 YDS'], pin: 'PIN FRONT'});
 assert.deepEqual(holeSlab({range: true, yards: 152, green: 'Green 3'}), {number: 'R', name: 'DRIVING RANGE', line: ['GREEN 3', '152 YDS']});
 assert.equal(holeSlab({hole: 0, course: 'x'}).pin, '');
});

test('distances read in yards, and in feet inside ten metres', () => {
 assert.deepEqual(distanceText(412 * YARD), {value: '412', unit: 'YDS'});
 assert.deepEqual(distanceText(3), {value: (3 / FOOT).toFixed(1), unit: 'FT'});
 assert.deepEqual(distanceText(-1), {value: '0.0', unit: 'FT'});
});

test('the rise to the hole: up, down with a real minus, or level', () => {
 assert.deepEqual(riseText(6 * FOOT), {value: '+6', unit: 'FT UP'});
 assert.deepEqual(riseText(-4 * FOOT), {value: `${MINUS}4`, unit: 'FT DOWN'});
 assert.deepEqual(riseText(.1), {value: 'LEVEL', unit: ''});
});

test('the conditions: wind always, plays-like and rise only off the green', () => {
 assert.deepEqual(conditions({wind: 9, playsLike: 421, rise: 6 * FOOT}).map(c => c.id), ['wind', 'plays', 'rise']);
 assert.deepEqual(conditions({wind: 9, playsLike: null, rise: 0}).map(c => c.id), ['wind', 'rise']);
 assert.deepEqual(conditions({wind: 3.6, playsLike: 30, putting: true}), [{id: 'wind', value: '4', unit: 'MPH'}]);
});

test('the club panel: code, name, and a full swing\'s carry or a putter\'s roll', () => {
 assert.deepEqual(clubPanel(CLUBS.driver), {code: 'DR', name: 'DRIVER', line: '250 CARRY'});
 assert.deepEqual(clubPanel(CLUBS.putter), {code: 'PT', name: 'PUTTER', line: '30 YD ROLL'});
 assert.deepEqual(clubPanel({label: 'Old faithful', code: '7I', carry: 151.6}), {code: '7I', name: 'OLD FAITHFUL', line: '152 CARRY'});
 assert.deepEqual(clubPanel(null), {code: '', name: '', line: ''});
});

test('a score against par: E, plus, a real minus, and only under par is red', () => {
 assert.deepEqual(parScore(0), {text: 'E', under: false});
 assert.deepEqual(parScore(3), {text: '+3', under: false});
 assert.deepEqual(parScore(-2), {text: `${MINUS}2`, under: true});
 assert.deepEqual(parScore(-1.5), {text: `${MINUS}1.5`, under: true});
 assert.deepEqual(parScore(-2, false), {text: 'E', under: false});
});

test('golfer cards: one big card for the golfer up, a plate for everyone else', () => {
 const cards = golferCards([
  {name: 'Ann', level: 23, title: 'Single digit', into: 1240, need: 1800, rel: -2, played: true},
  {name: 'Ben', level: 12, title: 'Climber', into: 50, need: 100, rel: 0, played: true},
  {name: 'Cal', level: 4, rel: 1, played: true, note: 'In'},
 ], 1);
 assert.deepEqual(cards.map(c => c.up), [false, true, false]);
 assert.equal(cards[1].title, 'CLIMBER');
 assert.equal(cards[1].xp, .5);
 assert.equal(cards[0].title, '', 'only the golfer up shows a title');
 assert.equal(cards[0].xp, null);
 assert.deepEqual([cards[0].score, cards[0].under], [`${MINUS}2`, true]);
 assert.equal(cards[2].note, 'IN');
 // A score handed in already worded (the range's shot count) is kept as it is.
 assert.equal(golferCards([{name: 'x', score: {text: 'SHOT 4', under: false}}], 0)[0].score, 'SHOT 4');
 assert.equal(golferCards([{name: 'x', into: 5, need: 0}], 0)[0].xp, 0);
});

test('the keys: shape keys only while a Swing Meter shot can be shaped; Escape always', () => {
 const keys = o => keyHints(o).map(k => k.key);
 assert.deepEqual(keys({}), ['Q E', 'S W X', 'TAB', 'C', 'ESC']);
 assert.deepEqual(keys({putting: true}), ['Q E', 'TAB', 'C', 'ESC']);
 assert.deepEqual(keys({monitor: true}), ['Q E', 'TAB', 'C', 'ESC']);
 assert.deepEqual(keys({range: true}), ['Q E', 'S W X', 'TAB', 'C', 'R', 'ESC']);
});

test('the ball light names the monitor\'s state in one word', () => {
 assert.deepEqual(ballLight('green', 'Ben'), {word: 'READY', sub: 'BEN · SWING AWAY'});
 assert.equal(ballLight('amber').word, 'FINDING BALL');
 assert.equal(ballLight('red').word, 'NO MONITOR');
 assert.equal(ballLight('nonsense').word, 'NO MONITOR');
});

test('the pieces scale with the screen and the Text size, never below the floor', () => {
 assert.equal(hudScale(1280, 720), 1);
 assert.equal(hudScale(1920, 1080), 1.5);
 // Text size 125% on 16:9: the pieces already span the screen, so they grow
 // only as far as they still fit (1920 / 1160 on screen, of which #app's own
 // zoom already gives 1.25).
 const drawn = hudScale(1920, 1080, 1.25) * 1.25;
 assert.ok(Math.abs(drawn - 1920 / ROUND_MIN_WIDTH) < 1e-9, `drawn ${drawn}`);
 assert.ok(drawn > 1.5 && drawn < 1.7);
 // A small window: the pieces stay readable.
 assert.equal(hudScale(800, 600), MIN_HUD_SCALE);
 // 4:3 and wider than 16:9 fill by height, as the canvas does.
 assert.equal(hudScale(1024, 768), .8);
 assert.ok(Math.abs(hudScale(2560, 1080) - 1.5) < .001);
 // An iPad held upright is held by its width (here at the floor).
 assert.equal(hudScale(820, 1180), MIN_HUD_SCALE);
 assert.ok(hudScale(1180, 820) > .9 && hudScale(1180, 820) < .93);
 // Along the foot, the club panel (about 370) and the centred meter (400)
 // never meet, at any tested size or Text size; along the top the slab
 // (about 400) and the cards (340) neither.
 for (const [w, h] of [[1920, 1080], [1536, 864], [1440, 900], [1366, 768], [1280, 720], [1180, 820], [2560, 1440]])
  for (const z of [1, 1.25, 1.5, 2]) {
   const s = hudScale(w, h, z) * z, room = w / s;
   assert.ok(370 + 8 <= room / 2 - 200, `${w}x${h} at ${z}: club and meter meet (room ${room.toFixed(0)})`);
   assert.ok(30 + 400 + 24 + 340 + 30 <= room, `${w}x${h} at ${z}: slab and cards meet`);
  }
});
