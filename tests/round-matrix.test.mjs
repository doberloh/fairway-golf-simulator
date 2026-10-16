import test from 'node:test';
import assert from 'node:assert/strict';
import {Round, FORMATS} from '../src/game.js';
import {awardedPutts} from '../src/putting.js';
import {skins, decidedHoles, skinsWinner} from '../src/skins.js';

// EVERY FORMAT, EVERY GROUP. The other round suites each pin one behaviour with
// a hand-written card; this one plays whole rounds of every format with every
// group size and every way of splitting a group into teams, and checks the
// round against a scorer of its own after every shot.
//
// The shots are made up from a seeded random number, so the same seed always
// plays the same round, and a failure names the format, the group and the seed
// that broke it. Along the way a round is saved and restored, a mulligan is
// taken and checked to put everything back, balls go in water and out of
// bounds, a ball is dropped, putts are awarded under every putting mode, and
// golfers join and leave between holes.
//
// The scorer below is written from the rules, not from game.js: it counts
// strokes, penalties and putts for each golfer (or each team, in a scramble),
// and decides honours, match holes and skins itself. The one thing it borrows
// is `awardedPutts` -- how many putts a ball that far away is given -- which
// play.test.mjs checks on its own; this suite checks that the round adds them
// up. Nothing here draws or loads a course: it is the rules only, and what
// main.js does with them is the smoke test's job (docs/TESTING.md).

const PIN = {x: 0, z: 320};
const TEES = {blue: {x: 0, z: 0}, white: {x: 0, z: 15}, red: {x: 0, z: 35}};
const NAMES = ['Alex', 'Bo', 'Cy', 'Di', 'Ed', 'Flo', 'Gus', 'Hal'];
const cent = v => Math.round(v * 100) / 100;
const far = p => Math.hypot(p.x - PIN.x, p.z - PIN.z);

function random(seed) {
 let a = seed >>> 0;
 return () => {
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
 };
}

// Every way to put n golfers on teams A and B.
function splits(n) {
 const out = [];
 for (let m = 0; m < 2 ** n; m++) out.push([...Array(n)].map((_, i) => (m >> i) & 1 ? 'B' : 'A'));
 return out;
}

// HOW THE SCORER PLAYS EACH FORMAT: whether teams change anything, and the
// fewest golfers it is for. A format game.js offers (`FORMATS`) that is not
// here fails the first test below, so a new format cannot be added without
// being played here: teach the scorer its rules -- whose turn it is, how a hole
// is scored and won, how the round is won, which groups it refuses -- then add
// it to this table and to `allowed`.
const PLAYED = {
 stroke: {teams: false, fewest: 1},
 match: {teams: true, fewest: 2},
 scramble: {teams: true, fewest: 1},
 skins: {teams: false, fewest: 2},
};
const PLAYED_FORMATS = Object.keys(PLAYED);

// Whether a group may play a format, by the rules of the round panel.
function allowed(mode, teams, endless) {
 if (teams.length < 1 || teams.length > 4) return false;
 if (mode === 'match' && new Set(teams).size !== 2) return false;
 if (mode === 'skins' && teams.length < 2) return false;
 if (mode === 'match' && endless) return false;
 return true;
}

// A made-up shot from where the ball lies. Long shots come up short of the
// pin, now and then into water or out of bounds; short ones are holed or left
// close. `puttStroke` marks a stroke played on the green.
function shotFrom(at, rand) {
 const d = far(at);
 const onGreenNow = d < 20;
 const result = {puttStroke: onGreenNow};
 if (d > 30 && rand() < .09) {
  result.hazard = rand() < .5 ? 'Water' : 'Out of bounds';
  result.cross = {x: at.x + 8, z: (at.z + PIN.z) / 2};
  return result;
 }
 if (d < 12 && rand() < .45) return {...result, end: {...PIN}, holed: true, onGreen: true};
 const left = d < 12 ? rand() * 3 : d * (.05 + rand() * .45);
 const angle = (rand() - .5) * 1.2;
 result.end = {x: PIN.x + Math.sin(angle) * left, z: PIN.z - Math.cos(angle) * left};
 result.onGreen = left < 25;
 return result;
}

// THE SCORER. Golfers are objects, so they keep their own card when the group
// changes and their seat number moves.
function scorer(round) {
 const golfers = round.players.map(p => ({name: p.name, team: p.team, card: [], putts: []}));
 return {golfers, order: golfers.slice(), match: {A: 0, B: 0}, teamCards: {A: [], B: []}};
}

function beginHole(ref, hole) {
 // Honours: lowest score on the last hole first, ties keeping their order, a
 // golfer with no score there at the back.
 if (hole > 0) {
  const s = g => g.card[hole - 1];
  ref.order = ref.order.slice().sort((a, b) => {
   const fa = Number.isFinite(s(a)), fb = Number.isFinite(s(b));
   if (fa && fb) return s(a) - s(b);
   return fa === fb ? 0 : fa ? -1 : 1;
  });
 }
 for (const g of ref.golfers) Object.assign(g, {strokes: 0, holePutts: 0, done: false});
 ref.teams = {A: {strokes: 0, putts: 0, candidates: [], done: false}, B: {strokes: 0, putts: 0, candidates: [], done: false}};
}

const seatOf = (ref, g) => ref.golfers.indexOf(g);

function finishGolfer(ref, g, hole) {
 g.done = true;
 g.card[hole] = cent(g.strokes);
 g.putts[hole] = cent(g.holePutts);
}

function finishTeam(ref, team, hole) {
 const t = ref.teams[team];
 t.done = true;
 for (const g of ref.golfers.filter(x => x.team === team)) {
  g.done = true;
  g.card[hole] = cent(t.strokes);
  g.putts[hole] = cent(t.putts);
 }
 ref.teamCards[team][hole] = cent(t.strokes);
}

// What the round should look like between shots.
function checkTurn(r, ref, why, dropped) {
 const g = ref.golfers[r.active];
 assert.ok(g, `${why}: the golfer up is a real golfer`);
 assert.equal(r.done[r.active], false, `${why}: the golfer up has not holed out`);
 assert.equal(g.done, false, `${why}: the scorer agrees they have not holed out`);
 // A sim drop leaves the golfer who dropped up to play it, nearest or not.
 if (r.mode === 'match' && !dropped) {
  const out = ref.golfers.map((x, i) => x.done ? -1 : far(r.positions[i]));
  assert.ok(Math.abs(out[r.active] - Math.max(...out)) < 1e-9, `${why}: match play plays the ball farthest from the hole`);
 }
 if (r.mode === 'scramble') {
  assert.ok(!r.candidates.some(c => c.player === r.active), `${why}: a teammate plays once per team shot`);
  assert.equal(r.candidates.length, ref.teams[g.team].candidates.length, `${why}: every team shot is on the list`);
 }
 r.players.forEach((p, i) => {
  assert.equal(p.name, ref.golfers[i].name, `${why}: seat ${i} is still ${ref.golfers[i].name}`);
  if (r.mode !== 'scramble') assert.equal(r.strokes[i], cent(ref.golfers[i].strokes), `${why}: ${p.name}'s strokes on this hole`);
 });
 if (r.mode === 'scramble') for (const t of ['A', 'B']) assert.equal(r.scrambleShots[t], cent(ref.teams[t].strokes), `${why}: team ${t}'s strokes`);
}

// A hole nobody scored is a gap in memory and null in a save; either is "not played".
const asSaved = v => JSON.parse(JSON.stringify(v));
const stripped = round => {const {history, ...rest} = JSON.parse(JSON.stringify(round)); return rest;};

function saveAndRestore(r, why) {
 const copy = Round.restore(JSON.parse(JSON.stringify(r)));
 assert.deepEqual(stripped(copy), stripped(r), `${why}: a save comes back exactly as it was`);
 assert.equal(copy.history.length, r.history.length, `${why}: with its mulligans`);
 return copy;
}

function playHole(r, ref, rand, cfg, why) {
 const hole = r.hole;
 r.placeTee(TEES);
 beginHole(ref, hole);
 assert.deepEqual(r.order.map(id => ref.golfers[id]), ref.order, `${why}: honours decide the order`);
 assert.equal(ref.golfers[r.active], ref.order[0], `${why}: the first in the order tees off`);
 let guard = 0, dropped = false;
 while (!r.holeComplete) {
  assert.ok(++guard < 500, `${why}: the hole ends`);
  if (rand() < .04) r = saveAndRestore(r, `${why}, mid-hole`);
  if (r.scrambleSelection) {
   const g = ref.golfers[r.active], t = ref.teams[g.team];
   assert.equal(r.candidates.length, t.candidates.length, `${why}: every teammate's ball is offered`);
   const k = Math.floor(rand() * t.candidates.length), c = t.candidates[k];
   r.chooseScramble(k);
   t.strokes += 1 + c.penalty + c.putts;
   t.putts += (c.puttStroke ? 1 : 0) + c.putts;
   t.candidates = [];
   if (c.putts > 0) finishTeam(ref, g.team, hole);
   continue;
  }
  checkTurn(r, ref, `${why}, hole ${hole + 1} shot ${guard}`, dropped);
  if (rand() < .03 && !(r.mode === 'scramble' && r.candidates.length)) {
   const to = shotFrom(r.position, rand).end;
   if (to) { r.simDrop(to); dropped = true; continue; }
  }
  const i = r.active, g = ref.golfers[i], team = g.team, shot = shotFrom(r.position, rand);
  if (rand() < .05) {
   const before = stripped(r);
   r.takeShot(shot, PIN);
   assert.ok(r.canMulligan(), `${why}: a shot on this hole can be taken back`);
   assert.ok(r.mulligan(), `${why}: the mulligan is taken`);
   assert.deepEqual(stripped(r), before, `${why}: a mulligan puts everything back`);
   continue;
  }
  const res = r.takeShot(shot, PIN);
  dropped = false;
  assert.equal(res.player, i, `${why}: the shot is the golfer's who was up`);
  if (shot.hazard) {
   assert.ok(r.relief, `${why}: a ball in trouble waits for relief`);
   if (rand() < .3) r = saveAndRestore(r, `${why}, waiting for relief`);
   const twoStroke = shot.hazard === 'Out of bounds' && cfg.outOfBounds === 'e5' && rand() < .5;
   const penalty = twoStroke ? 2 : 1;
   const spot = twoStroke ? {x: shot.cross.x - 3, z: shot.cross.z} : {...r.relief.from};
   r.takeRelief({spot, penalty}, PIN);
   if (r.mode === 'scramble') ref.teams[team].candidates.push({penalty, putts: 0, puttStroke: shot.puttStroke});
   else { g.strokes += 1 + penalty; g.holePutts += shot.puttStroke ? 1 : 0; }
   continue;
  }
  const putts = shot.holed ? 0 : awardedPutts(far(shot.end), shot.onGreen === true, r.putting);
  if (r.mode === 'scramble') {
   const t = ref.teams[team];
   if (shot.holed) { t.strokes += 1; t.putts += shot.puttStroke ? 1 : 0; finishTeam(ref, team, hole); }
   else t.candidates.push({penalty: 0, putts, puttStroke: shot.puttStroke});
  } else {
   g.strokes += 1 + putts;
   g.holePutts += (shot.puttStroke ? 1 : 0) + putts;
   if (shot.holed || putts > 0) finishGolfer(ref, g, hole);
   else if (r.mode === 'stroke' || r.mode === 'skins') assert.equal(r.active, i, `${why}: stroke play keeps the golfer up until they hole out`);
  }
 }
 // The hole is over: every card as the scorer has it.
 ref.golfers.forEach((x, i) => {
  assert.ok(x.done, `${why}: ${x.name} finished hole ${hole + 1}`);
  assert.equal(r.cards[i][hole], x.card[hole], `${why}: ${x.name}'s score on hole ${hole + 1}`);
  assert.equal(r.puttCards[i][hole], x.putts[hole], `${why}: ${x.name}'s putts on hole ${hole + 1}`);
 });
 if (r.mode === 'match') {
  const best = t => Math.min(...ref.golfers.filter(x => x.team === t).map(x => x.card[hole]));
  const a = best('A'), b = best('B');
  ref.teamCards.A[hole] = a; ref.teamCards.B[hole] = b;
  if (a < b) ref.match.A++;
  if (b < a) ref.match.B++;
  assert.deepEqual(r.match, ref.match, `${why}: the match after hole ${hole + 1}`);
 }
 if (r.mode === 'match' || r.mode === 'scramble') for (const t of ['A', 'B']) {
  if (ref.golfers.some(x => x.team === t)) assert.equal(r.teamCards[t][hole], ref.teamCards[t][hole], `${why}: team ${t} on hole ${hole + 1}`);
 }
 const lead = Math.abs(ref.match.A - ref.match.B), left = r.holes - hole - 1;
 const over = !r.endless && (hole + 1 >= r.holes || (r.mode === 'match' && lead > left));
 assert.equal(r.finished, over, `${why}: the round ${over ? 'ends' : 'goes on'} after hole ${hole + 1}`);
 return r;
}

// Between holes, now and then, somebody leaves or somebody joins.
function changeGroup(r, ref, rand, why) {
 const kept = ref.golfers.map((g, seat) => ({g, seat}));
 let next;
 if (rand() < .5 && kept.length > 1) {
  const out = Math.floor(rand() * kept.length);
  next = kept.filter((_, k) => k !== out);
 } else if (kept.length < 4) {
  const name = NAMES.find(n => !ref.golfers.some(g => g.name === n));
  const g = {name, team: rand() < .5 ? 'A' : 'B', card: [], putts: []};
  next = [...kept, {g, seat: -1}];
 } else return;
 const teams = next.map(x => x.g.team);
 if (!allowed(r.mode, teams, r.endless)) {
  assert.throws(() => r.setPlayers(next.map(x => ({name: x.g.name, team: x.g.team, seat: x.seat})), TEES), `${why}: a group the format cannot take is refused`);
  return;
 }
 r.setPlayers(next.map(x => ({name: x.g.name, team: x.g.team, ...(x.seat >= 0 ? {seat: x.seat} : {})})), TEES);
 const left = ref.golfers.filter(g => !next.some(x => x.g === g));
 ref.golfers = next.map(x => x.g);
 ref.order = [...ref.order.filter(g => !left.includes(g)), ...ref.golfers.filter(g => !ref.order.includes(g))];
 ref.golfers.forEach((g, i) => assert.deepEqual(asSaved(r.cards[i]), asSaved(g.card), `${why}: ${g.name} keeps their own card through the change`));
}

// The skins every golfer has won, decided here from the cards.
function expectedSkins(golfers, decided) {
 const won = golfers.map(() => 0);
 let carry = 0;
 for (let h = 0; h < decided; h++) {
  const scores = golfers.map(g => g.card[h]).map(s => Number.isFinite(s) ? s : Infinity);
  const low = Math.min(...scores), at = scores.flatMap((s, i) => s === low ? [i] : []);
  if (at.length === 1 && low < Infinity) { won[at[0]] += carry + 1; carry = 0; }
  else carry += 1;
 }
 return won;
}

function playRound(cfg, seed) {
 const rand = random(seed);
 const players = cfg.teams.map((team, i) => ({name: NAMES[i], team}));
 let r = new Round({players, mode: cfg.mode, holes: cfg.holes, gimme: 0, putting: {mode: cfg.putting}, endless: cfg.endless, outOfBounds: cfg.outOfBounds});
 const ref = scorer(r);
 const why = `${cfg.mode}${cfg.endless ? ' (endless)' : ''}, ${cfg.teams.join('')}, ${cfg.holes} holes, ${cfg.putting} putting, seed ${seed}`;
 const holes = cfg.endless ? cfg.holes + 2 : cfg.holes;
 for (let h = 0; h < holes; h++) {
  r = playHole(r, ref, rand, cfg, why);
  if (r.mode === 'skins') {
   const got = skins(r.cards, decidedHoles(r)).won;
   assert.deepEqual(got, expectedSkins(ref.golfers, decidedHoles(r)), `${why}: skins after hole ${h + 1}`);
  }
  if (rand() < .1) r = saveAndRestore(r, `${why}, between holes`);
  if (r.finished) break;
  if (cfg.changes && rand() < .2) changeGroup(r, ref, rand, `${why}, before hole ${h + 2}`);
  assert.ok(r.nextHole(), `${why}: on to hole ${h + 2}`);
 }
 if (cfg.endless) {
  assert.equal(r.finished, false, `${why}: an endless run never finishes`);
  assert.ok(r.hole >= cfg.holes, `${why}: it goes past its nominal last hole`);
 } else {
  assert.ok(r.finished, `${why}: the round finishes`);
  assert.equal(r.nextHole(), false, `${why}: there is no hole after the last`);
  assert.throws(() => r.takeShot({end: {...PIN}, holed: true}, PIN), `${why}: nothing is hit after the round ends`);
  if (r.mode === 'skins') {
   const won = expectedSkins(ref.golfers, decidedHoles(r));
   assert.equal(skinsWinner(skins(r.cards, decidedHoles(r)).won), skinsWinner(won), `${why}: who won the skins`);
  }
 }
 return r;
}

function configs({holes = 3, changes = false} = {}) {
 const out = [];
 for (const mode of PLAYED_FORMATS)
  for (let n = 1; n <= 4; n++)
   // Teams only mean something in match play and scramble; the other formats
   // are played with everyone on A and with the group split, once each.
   for (const teams of PLAYED[mode].teams ? splits(n) : [Array(n).fill('A'), [...Array(n)].map((_, i) => i % 2 ? 'B' : 'A')].filter((t, k) => k === 0 || n > 1))
    for (const endless of [false, true])
     if (allowed(mode, teams, endless))
      for (const putting of ['holeout', 'dartboard', 'decimal'])
       out.push({mode, teams, endless, putting, holes, changes, outOfBounds: out.length % 2 ? 'e5' : 'stroke'});
 return out;
}

const SEEDS = [1, 2, 3];

test('the matrix plays every format the game offers', () => {
 assert.deepEqual([...PLAYED_FORMATS].sort(), [...FORMATS].sort(),
  'game.js FORMATS and this file disagree: a format was added or removed. Teach the scorer above its rules and add it to PLAYED and allowed()');
});

for (const mode of PLAYED_FORMATS) {
 test(`${mode}: every group size and team split plays whole rounds, scored shot by shot`, () => {
  const list = configs().filter(c => c.mode === mode);
  assert.ok(list.length > 0);
  for (const cfg of list) for (const seed of SEEDS) playRound(cfg, seed);
 });
}

test('every format over 18 holes with four golfers, golfers joining and leaving between holes', () => {
 const list = configs({holes: 18, changes: true}).filter(c => c.teams.length === 4 && !c.endless && c.putting === 'decimal');
 assert.ok(list.length >= 4);
 for (const cfg of list) for (const seed of [7, 8]) playRound(cfg, seed);
});

test('golfers come and go between holes in every format and group size', () => {
 for (const cfg of configs({holes: 9, changes: true}).filter(c => c.putting === 'dartboard'))
  for (const seed of [11, 12]) playRound(cfg, seed);
});

test('the matrix reaches every format, every group size and both team splits', () => {
 const list = configs();
 for (const mode of PLAYED_FORMATS)
  for (let n = PLAYED[mode].fewest; n <= 4; n++)
   assert.ok(list.some(c => c.mode === mode && c.teams.length === n), `${mode} with ${n}`);
 assert.ok(list.some(c => c.mode === 'match' && c.teams.join('') === 'ABBB'), 'match play one against three');
 assert.ok(list.some(c => c.mode === 'scramble' && c.teams.join('') === 'AAAA'), 'a scramble of one team of four');
 assert.ok(list.some(c => c.endless && c.mode === 'skins'), 'skins run endlessly');
});

test('groups a format cannot take are refused at the start', () => {
 const make = (mode, teams, extra = {}) => () => new Round({mode, players: teams.map((team, i) => ({name: NAMES[i], team})), ...extra});
 assert.throws(make('match', ['A']), /both teams/);
 assert.throws(make('match', ['A', 'A', 'A']), /both teams/);
 assert.throws(make('skins', ['A']), /two to four/);
 assert.throws(make('match', ['A', 'B'], {endless: true}), /cannot run endlessly/);
 assert.throws(make('stroke', ['A', 'A', 'A', 'A', 'B']), /1–4/);
 assert.throws(make('stroke', []), /1–4/);
 for (const mode of ['stroke', 'scramble']) assert.doesNotThrow(make(mode, ['A']), `${mode} for one golfer`);
});

test('a round somebody joined mid-round saves, loads and takes a mulligan', () => {
 // Found by the matrix: a joined golfer's card has gaps for the holes they
 // missed, a save writes those gaps as null, and loading refused null -- so
 // Continue lost the round and the mulligan threw.
 for (const mode of ['stroke', 'scramble', 'skins', 'match']) {
  const r = new Round({mode, holes: 9, players: [{name: 'Alex', team: 'A'}, {name: 'Bo', team: 'B'}]});
  r.placeTee(TEES);
  for (let h = 0; h < 2; h++) {
   while (!r.holeComplete) {
    if (r.scrambleSelection) r.chooseScramble(0);
    else r.takeShot({end: {...PIN}, holed: true, onGreen: true}, PIN);
   }
   r.setPlayers([...r.players.map(p => ({name: p.name, team: p.team, seat: p.id})), ...(h === 0 ? [{name: 'Cy', team: 'B'}] : [])], TEES);
   r.nextHole();
   r.placeTee(TEES);
  }
  r.takeShot({end: {x: 0, z: 200}, onGreen: false}, PIN);
  const back = Round.restore(JSON.parse(JSON.stringify(r)));
  assert.deepEqual(asSaved(back.cards), asSaved(r.cards), `${mode}: the cards come back`);
  assert.equal(back.cards[2][0], undefined, `${mode}: a hole Cy never played is still not played`);
  assert.ok(Number.isFinite(back.cards[2][1]), `${mode}: and the hole Cy did play is scored`);
  assert.ok(back.mulligan(), `${mode}: the mulligan works after loading`);
  assert.ok(r.mulligan(), `${mode}: and without loading`);
 }
});
