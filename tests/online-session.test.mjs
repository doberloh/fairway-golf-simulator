import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Round, FORMATS} from '../src/game.js';
import {createLink} from '../src/online/link.js';
import {newRoomCode} from '../src/online/room-code.js';
import {HostSession, GuestSession, Follower, memberId, doorProblem} from '../src/online/session.js';
import {shotProblem, reliefProblem, pickProblem, pickerSeat, seatOwner, playsHere, seatsAtNextTee, canSeat} from '../src/online/referee.js';
import {readMessage, roundForGuests, PROTOCOL} from '../src/online/protocol.js';
import {startRelay} from '../relay/node-relay.mjs';

// ONLINE PLAY, END TO END WITHOUT A SCREEN (19 November 2026). A host and its
// guests over the relay's Node twin play whole rounds in every format: the
// host's Round is the referee, each guest flies every shot (here: waits a
// tick) and takes the host's round after it, and at the end every guest holds
// the host's card. A stand-in ball model moves each ball most of the way to
// the pin, with one ball in the water each round so relief travels too.
const random = n => new Uint8Array(randomBytes(n));
const GAME = 'test-1.0';
// FAIRWAY_TEST_RELAY=ws://127.0.0.1:8799 plays the rounds through another
// relay -- the Worker under `wrangler dev` -- instead of the Node twin; the
// tests that cut a socket at the relay need the twin and are skipped.
const EXTERNAL = process.env.FAIRWAY_TEST_RELAY || '';
const relayForTest = () => EXTERNAL ? {url: EXTERNAL, rooms: new Map(), close: async () => {}} : startRelay({port: 0});
const pinOf = hole => ({x: 0, z: 160 + hole * 15});
const TEES = {blue: {x: 0, z: 0}};
const until = async (f, ms = 8000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw Error('timed out'); await new Promise(r => setTimeout(r, 2)); } };
const CLUB = {kind: 'iron', code: '7I', label: '7 Iron'};

// The stand-in ball: deterministic by where it starts.
function landing(round, shot) {
 const pin = pinOf(round.hole), o = shot.origin;
 const d = Math.hypot(pin.x - o.x, pin.z - o.z);
 if (d < 4) return {end: {...pin}, holed: true};
 // The first tee shot of hole 2 by the second seat finds the water.
 if (round.hole === 1 && round.active === 1 && round.strokes[1] === 0 && round.mode !== 'scramble') return {end: {x: o.x + 30, z: o.z + 60}, hazard: 'Water', cross: {x: o.x + 25, z: o.z + 50}};
 const k = 0.75, side = ((Math.round(o.z) % 7) - 3) * 0.5;
 return {end: {x: o.x + (pin.x - o.x) * k + side, z: o.z + (pin.z - o.z) * k}};
}
const shotFrom = (round, seat) => ({origin: {...round.positions[seat]}, aim: 0, speed: 40, vla: 20, hla: 0, spin: 5000, spinAxis: 0});
const reliefSpots = r => [{id: 'line', label: 'Back on the line', spot: {...r.from}, penalty: 1}, {id: 'lateral', label: 'Lateral', spot: {x: r.cross.x - 2, z: r.cross.z}, penalty: 1}];

// THE HOST'S GAME: its own seats (no `online`) it plays itself; a guest's it
// waits for, and rules on.
// `between(round)`: called at each next tee, before the hole moves on (where
// main.js advanceHole seats those the host has seated: onlineSeatNow).
function hostGame(session, round, {between} = {}) {
 let busy = false, finished;
 const done = new Promise(r => finished = r);
 const send = shot => session.state(round.toJSON(), {shot});
 const strike = (seat, shot, typed = false) => {
  busy = true;
  session.flown({seat, hole: round.hole, stroke: round.stroke, club: CLUB, shot, typed});
  setTimeout(() => {
   const r = landing(round, shot);
   round.takeShot({...r, onGreen: false}, pinOf(round.hole));
   busy = false; send(true); next();
  }, 1);
 };
 const next = () => setTimeout(() => {
  if (busy) return;
  if (round.holeComplete) {
   if (round.finished) { session.finish(); finished(); return; }
   between?.(round);
   round.nextHole(); round.placeTee(TEES); send(false); return next();
  }
  if (round.relief) { if (!seatOwner(round, round.relief.player)) { round.takeRelief(reliefSpots(round.relief)[0], pinOf(round.hole)); send(false); next(); } return; }
  if (round.scrambleSelection) { const s = pickerSeat(round); if (!seatOwner(round, s)) { round.chooseScramble(0, pinOf(round.hole)); send(false); next(); } return; }
  if (!seatOwner(round, round.active)) strike(round.active, shotFrom(round, round.active));
 }, 1);
 const nopes = [];
 session.on('shot', (m, who) => {
  const why = shotProblem(round, m, {busy});
  if (why) { nopes.push(why); session.nope(who.member, why); return; }
  strike(m.seat, m.shot, m.typed);
 });
 session.on('relief', (m, who) => {
  if (reliefProblem(round, m)) return;
  const o = reliefSpots(round.relief).find(x => x.id === m.id);
  round.takeRelief(o, pinOf(round.hole)); send(false); next();
 });
 session.on('pick', (m, who) => {
  if (pickProblem(round, m)) return;
  round.chooseScramble(m.index, pinOf(round.hole)); send(false); next();
 });
 return {done, next, nopes, get busy() { return busy; }};
}

// A GUEST'S GAME: flies what the host flew, takes the host's round, and on
// its own turn plays.
function guestGame(session) {
 const g = {round: null, applied: 0, played: 0, own: 0};
 const act = () => {
  const r = g.round;
  if (!r || r.finished || r.holeComplete || follower.busy) return;
  if (r.relief) { if (playsHere(r, r.relief.player, session.member)) session.relief({seat: r.relief.player, hole: r.hole, id: 'lateral', back: 0}); return; }
  if (r.scrambleSelection) { const s = pickerSeat(r); if (playsHere(r, s, session.member)) session.pick({seat: s, hole: r.hole, index: r.candidates.length - 1}); return; }
  if (!playsHere(r, r.active, session.member)) return;
  const stroke = r.stroke;
  session.shot({seat: r.active, hole: r.hole, stroke, club: CLUB, shot: shotFrom(r, r.active), typed: false});
  g.own++;
  follower.ownStrike(`${r.hole}:${r.active}:${stroke}`);
  setTimeout(() => follower.landed(), 1);
 };
 const follower = new Follower({
  play: (f, done) => { g.played++; setTimeout(done, 1); },
  apply: s => { g.round = Round.restore(s.round, false); g.applied++; setTimeout(act, 1); },
 });
 session.on('start', m => { follower.restart(m.seq); g.round = Round.restore(m.record.round, false); setTimeout(act, 1); });
 session.on('flown', m => follower.heard(m));
 session.on('state', m => follower.heard(m));
 session.on('nope', () => follower.ownRefused());
 g.follower = follower;
 return g;
}

async function room(relay, names = ['Ann', 'Bo']) {
 const code = newRoomCode(random), hostMember = memberId(random);
 const host = new HostSession({link: createLink({relay: relay.url, code, random}), member: hostMember, name: 'Host', game: GAME});
 const knocks = [];
 host.on('knock', who => knocks.push(who));
 const guests = names.map(name => {
  const member = memberId(random);
  return new GuestSession({link: createLink({relay: relay.url, code, random}), member, golfer: {name, hand: 'RH', input: 'meter'}, game: GAME});
 });
 await until(() => knocks.length === names.length);
 for (const k of knocks) host.admit(k.member);
 await until(() => guests.every(g => g.state === 'in'));
 return {host, guests, code, close: () => { for (const g of guests) g.link.close(); host.link.close(); }};
}

test('protocol: a message that does not check is dropped whole', () => {
 assert.equal(readMessage(null), null);
 assert.equal(readMessage({t: 'nonsense'}), null);
 assert.equal(readMessage({t: 'shot', member: 'abcdef', seat: 0, hole: 0, stroke: 1, club: CLUB, shot: {origin: {x: 0, z: 0}, aim: 0, speed: Infinity, vla: 1, hla: 0, spin: 0}}), null, 'an infinite speed');
 assert.equal(readMessage({t: 'shot', member: 'abcdef', seat: 9, hole: 0, stroke: 1, club: CLUB, shot: shotFrom({positions: [{x: 0, z: 0}]}, 0)}), null, 'a seat no round has');
 const ok = readMessage({t: 'shot', member: 'abcdef', seat: 0, hole: 0, stroke: 1, club: CLUB, shot: {...shotFrom({positions: [{x: 0, z: 0}]}, 0), junk: 'x', lie: {surface: 'rough', factor: 0.9, measured: true}}});
 assert.ok(ok && !('junk' in ok.shot) && ok.shot.lie.measured === true);
 assert.equal(readMessage({t: 'hello', v: PROTOCOL, game: GAME, member: 'abcdef', golfer: {name: '   '}}), null, 'a golfer needs a name');
 const g = readMessage({t: 'hello', v: PROTOCOL, game: GAME, member: 'abcdef', golfer: {name: 'A very long name that goes on and on', hand: 'XX', input: 'cpu', index: 12.34}});
 assert.equal(g.golfer.name.length, 24); assert.equal(g.golfer.hand, 'RH'); assert.equal(g.golfer.input, 'monitor'); assert.equal(g.golfer.index, 12.3);
 const json = new Round({players: [{name: 'A', team: 'A', profile: 'p1'}, {name: 'B', team: 'B', online: 'abcdefgh'}]}).toJSON();
 const sent = roundForGuests(json);
 assert.ok(!('history' in sent) && sent.players.every(p => !('profile' in p)) && sent.players[1].online === 'abcdefgh');
});

test('protocol: text from another machine carries no markup', () => {
 const evil = '<img src=x onerror=alert(1)>';
 const h = readMessage({t: 'hello', v: PROTOCOL, game: GAME, member: 'abcdef', golfer: {name: evil}});
 assert.ok(!/[<>"]/.test(h.golfer.name), h.golfer.name);
 const s = readMessage({t: 'shot', member: 'abcdef', seat: 0, hole: 0, stroke: 1, club: {kind: 'iron', code: '7I', label: evil + '7 Iron'}, shot: {...shotFrom({positions: [{x: 0, z: 0}]}, 0), extra: {club: evil, speed: 90}}});
 assert.ok(!/[<>"]/.test(s.club.label)); assert.deepEqual(s.shot.extra, {speed: 90}, 'only numbers ride in a monitor\'s extras');
 assert.equal(readMessage({t: 'shot', member: 'abcdef', seat: 0, hole: 0, stroke: 1, club: {kind: 'iron', code: '<b>', label: '7'}, shot: shotFrom({positions: [{x: 0, z: 0}]}, 0)}), null, 'a club code is letters and numbers');
 const json = new Round({players: [{name: 'A', team: 'A'}, {name: 'B', team: 'B'}]}).toJSON();
 json.players[1].name = evil;
 const st = readMessage({t: 'state', round: json, shotNo: 1, seq: 2, event: {holed: true, score: 3, player: 1, html: evil}});
 assert.ok(!/[<>"]/.test(st.round.players[1].name));
 assert.deepEqual(Object.keys(st.event).sort(), ['complete', 'holed', 'penalty', 'player', 'puttingTotal', 'putts', 'relief', 'score']);
 const start = readMessage({t: 'start', record: {settings: {courseName: evil + 'Pines'}, round: json}, shotNo: 0, seq: 1});
 assert.equal(start.record.settings.courseName, 'img src=x onerror=alert(1)Pines');
 const room = readMessage({t: 'room', host: 'abcdef', hostName: evil, phase: 'lobby', members: [{member: 'ghijkl', name: evil, state: 'in'}]});
 assert.ok(!/[<>"]/.test(room.hostName + room.members[0].name));
});

test('a guest takes the state that ends a shot by its number, not whichever comes next', () => {
 const played = [], applied = [];
 let land = null;
 const f = new Follower({play: (m, done) => { played.push(m.shotNo); land = done; }, apply: (s, o) => applied.push({seq: s.seq, no: s.shotNo, after: o.afterShot})});
 f.restart(1);
 f.heard({t: 'flown', shotNo: 1, hole: 0, seat: 0, stroke: 1});
 // The host saved something while the ball was in the air: a state from before it landed.
 f.heard({t: 'state', seq: 2, shotNo: 0});
 f.heard({t: 'state', seq: 3, shotNo: 1});
 land();
 assert.deepEqual(played, [1]);
 assert.deepEqual(applied, [{seq: 3, no: 1, after: true}], 'the stray state passed over, the landing taken as the landing');
 // The guest's own ball: its number comes with the host's copy.
 f.ownStrike('0:1:1');
 f.heard({t: 'state', seq: 4, shotNo: 1});
 f.heard({t: 'flown', shotNo: 2, hole: 0, seat: 1, stroke: 1});
 f.heard({t: 'state', seq: 5, shotNo: 2});
 f.landed();
 assert.deepEqual(played, [1], 'one\'s own ball is not flown twice');
 assert.deepEqual(applied.at(-1), {seq: 5, no: 2, after: true});
 assert.equal(applied.length, 2);
 // A state with nothing in the air is taken as it is.
 f.heard({t: 'state', seq: 6, shotNo: 2});
 assert.deepEqual(applied.at(-1), {seq: 6, no: 2, after: false});
});

test('the door: another version and a full room are refused; a round under way is not', () => {
 const members = new Map([['a', {state: 'in'}], ['b', {state: 'in'}], ['c', {state: 'away'}]]);
 assert.match(doorProblem({v: PROTOCOL, game: 'other'}, {game: GAME, members: new Map(), maxGuests: 3}), /same version/);
 assert.equal(doorProblem({v: PROTOCOL, game: GAME}, {game: GAME, members, maxGuests: 3}), 'This room is full.');
 // 20 November 2026: someone let in mid-round watches (referee.js seatsAtNextTee).
 assert.equal(doorProblem({v: PROTOCOL, game: GAME}, {game: GAME, members: new Map(), maxGuests: 3, playing: true}), '');
 // Eight screens a room: the host and seven.
 const seven = new Map(Array.from({length: 7}, (_, i) => [`m${i}`, {state: 'in'}]));
 assert.equal(new HostSession({link: {on() {}}, member: 'host01', name: 'H', game: GAME}).maxGuests, 7);
 assert.equal(doorProblem({v: PROTOCOL, game: GAME}, {game: GAME, members: seven, maxGuests: 7}), 'This room is full.');
});

test('seats from the next tee: a newcomer at the back, a leaver back in their own golfer, four at most', () => {
 const members = new Map([['cy0001', {state: 'in', name: 'Cy', golfer: {name: 'Cy', hand: 'LH', input: 'monitor', tee: 'red'}}], ['dee001', {state: 'in', name: 'Dee', golfer: {name: 'Dee'}}],
  ['ann001', {state: 'in', name: 'Ann', golfer: {name: 'Ann'}}], ['eve001', {state: 'away', name: 'Eve', golfer: {name: 'Eve'}}], ['fay001', {state: 'in', name: 'Fay', golfer: {name: 'Fay'}}]]);
 // Ann left her golfer this round; the host played it on.
 const players = [{name: 'Host', team: 'A'}, {name: 'Ann', team: 'B'}, {name: 'Bot', team: 'A', input: 'cpu', cpu: {id: 'g001', handicap: 12}}];
 const former = new Map([['ann001', 'Ann']]);
 assert.ok(canSeat(players, [], 'cy0001', {former}), 'one seat free');
 assert.ok(!canSeat(players, ['cy0001'], 'dee001', {former}), 'and Cy has it');
 assert.ok(canSeat(players, ['cy0001'], 'ann001', {former}), 'Ann\'s own golfer waits for her');
 assert.ok(!canSeat(players, ['cy0001'], 'cy0001', {former}), 'already seated');
 const {players: next, left} = seatsAtNextTee(players, ['ann001', 'cy0001', 'dee001', 'eve001'], {members, former});
 assert.deepEqual(next.map(p => [p.name, p.online ?? null, p.seat ?? null]), [['Host', null, 0], ['Ann', 'ann001', 1], ['Bot', null, 2], ['Cy', 'cy0001', null]]);
 assert.equal(next[3].team, 'B', 'the smaller side');
 assert.equal(next[3].hand, 'LH'); assert.equal(next[3].input, 'monitor'); assert.equal(next[3].tee, 'red');
 assert.deepEqual(left, ['dee001'], 'no fifth golfer; Eve, away, is passed over');
 // Round takes the group as an offline change: Cy's earlier holes empty.
 const r = new Round({players: players.map(({input, cpu, ...p}) => p), mode: 'stroke', holes: 3});
 r.placeTee(TEES); r.cards = [[4], [5], [6]];
 r.setPlayers(next, TEES);
 assert.deepEqual(r.cards.map(c => c.length), [1, 1, 1, 0]);
 assert.equal(r.players[1].online, 'ann001');
});

test('the referee: only your seat, on its turn, from your ball', () => {
 const r = new Round({players: [{name: 'H', team: 'A'}, {name: 'G', team: 'B', online: 'guest01'}], mode: 'stroke'});
 r.placeTee(TEES);
 const m = {member: 'guest01', seat: 1, hole: 0, stroke: 1, shot: shotFrom(r, 1)};
 assert.equal(shotProblem(r, m), 'It is not your turn.');
 r.active = 1;
 assert.equal(shotProblem(r, m), '');
 assert.equal(shotProblem(r, {...m, member: 'guest02'}), 'That is not your golfer.');
 assert.equal(shotProblem(r, {...m, stroke: 2}), 'That shot is out of step with the round.');
 assert.match(shotProblem(r, {...m, shot: {...m.shot, origin: {x: 5, z: 0}}}), /where your ball lies/);
 assert.equal(shotProblem(r, m, {busy: true}), 'A ball is still in the air.');
 assert.equal(seatOwner(r, 0), null); assert.ok(playsHere(r, 0, null)); assert.ok(playsHere(r, 1, 'guest01')); assert.ok(!playsHere(r, 1, null));
});

test('a guest knocks, the host lets one in and turns one away', async () => {
 const relay = await relayForTest();
 const code = newRoomCode(random), links = [];
 try {
  const mk = () => { const l = createLink({relay: relay.url, code, random}); links.push(l); return l; };
  const host = new HostSession({link: mk(), member: memberId(random), name: 'Host', game: GAME});
  const knocks = [];
  host.on('knock', w => knocks.push(w));
  const ann = new GuestSession({link: mk(), member: memberId(random), golfer: {name: 'Ann'}, game: GAME});
  const bo = new GuestSession({link: mk(), member: memberId(random), golfer: {name: 'Bo'}, game: GAME});
  const old = new GuestSession({link: mk(), member: memberId(random), golfer: {name: 'Cy'}, game: 'older'});
  let refusedOld = '', refusedBo = '';
  old.on('refused', why => refusedOld = why);
  bo.on('refused', why => refusedBo = why);
  await until(() => knocks.length === 2 && refusedOld);
  assert.match(refusedOld, /same version/);
  assert.deepEqual(knocks.map(k => k.name).sort(), ['Ann', 'Bo']);
  host.admit(knocks.find(k => k.name === 'Ann').member);
  host.refuse(knocks.find(k => k.name === 'Bo').member);
  await until(() => ann.state === 'in' && refusedBo && ann.room?.members.length === 1);
  assert.equal(ann.room.members[0].name, 'Ann');
  assert.equal(bo.state, 'refused');
 } finally { for (const l of links) l.close(); await relay.close(); }
});

for (const mode of FORMATS) {
 test(`a whole ${mode} round between a host and two guests ends with one card`, async () => {
  const relay = await relayForTest();
  const {host, guests, close} = await room(relay);
  try {
   const team = i => mode === 'stroke' || mode === 'skins' || mode === 'stableford' ? 'A' : ['A', 'B', 'A'][i];
   const players = [{name: 'Host', team: team(0)}, ...guests.map((g, i) => ({name: g.golfer.name, team: team(i + 1), online: g.member}))];
   const round = new Round({players, mode, holes: 3});
   round.placeTee(TEES);
   const hg = hostGame(host, round);
   const gg = guests.map(g => guestGame(g));
   host.start({version: 2, settings: {}, round: round.toJSON()});
   hg.next();
   await hg.done;
   await until(() => gg.every(g => g.round && JSON.stringify(roundForGuests(g.round.toJSON())) === JSON.stringify(roundForGuests(round.toJSON()))));
   assert.ok(round.finished);
   assert.equal(hg.nopes.length, 0, 'no guest ever shot out of turn: ' + hg.nopes.join('; '));
   for (const g of gg) {
    assert.ok(g.own > 0, 'every guest played their own shots');
    assert.ok(g.played > 0, 'and watched the others');
    assert.deepEqual(g.round.cards, round.cards);
   }
  } finally { close(); await relay.close(); }
 });
}

test('a guest whose connection drops comes back to the same seat and the round as it stands', {skip: !!EXTERNAL}, async () => {
 const relay = await relayForTest();
 const {host, guests, close} = await room(relay, ['Ann']);
 try {
  const ann = guests[0];
  const round = new Round({players: [{name: 'Host', team: 'A'}, {name: 'Ann', team: 'A', online: ann.member}], mode: 'stroke', holes: 3});
  round.placeTee(TEES);
  const hg = hostGame(host, round), g = guestGame(ann);
  let away = 0, back = 0;
  host.on('away', () => away++);
  host.on('back', () => back++);
  host.start({version: 2, settings: {}, round: round.toJSON()});
  // Cut Ann's socket from the relay's side once, mid-round.
  hg.next();
  await until(() => g.applied >= 3);
  for (const room of relay.rooms.values()) for (const p of room.values()) if (p.tag === ann.link.you) p.ws.terminate();
  await until(() => away === 1 && back === 1, 10000);
  await hg.done;
  await until(() => g.round && JSON.stringify(g.round.cards) === JSON.stringify(round.cards));
  assert.ok(round.finished);
 } finally { close(); await relay.close(); }
});

test('the host\'s own connection drops mid-round: back on the relay, it sends everyone the round whole', {skip: !!EXTERNAL}, async () => {
 const relay = await relayForTest();
 const {host, guests, close} = await room(relay, ['Ann']);
 try {
  const ann = guests[0];
  const round = new Round({players: [{name: 'Host', team: 'A'}, {name: 'Ann', team: 'A', online: ann.member}], mode: 'stroke', holes: 3});
  round.placeTee(TEES);
  const hg = hostGame(host, round), g = guestGame(ann);
  let starts = 0;
  ann.on('start', () => starts++);
  host.start({version: 2, settings: {}, round: round.toJSON()});
  hg.next();
  await until(() => g.applied >= 3);
  for (const r of relay.rooms.values()) for (const p of r.values()) if (p.tag === host.link.you) p.ws.terminate();
  await until(() => starts >= 2, 10000);
  await hg.done;
  await until(() => g.round && JSON.stringify(g.round.cards) === JSON.stringify(round.cards));
  assert.ok(round.finished);
 } finally { close(); await relay.close(); }
});

test('a move the host cannot read is answered, not left hanging', async () => {
 const relay = await relayForTest();
 const {host, guests, close} = await room(relay, ['Ann']);
 try {
  let nope = '';
  guests[0].on('nope', m => nope = m.why);
  guests[0].link.send({t: 'shot', member: guests[0].member, seat: 1, hole: 0, stroke: 1, club: CLUB, shot: {origin: {x: 0, z: 0}, aim: 'left'}});
  await until(() => nope);
  assert.match(nope, /could not read/);
 } finally { close(); await relay.close(); }
});

// The owner, 20 November 2026: the host waits until everyone has seen their
// card. `unseen(hole)` is who the host's countdown still waits for.
test('the host waits for every connected guest\'s card, not a lost one\'s', async () => {
 const relay = await relayForTest();
 const {host, guests, close} = await room(relay, ['Ann', 'Bo']);
 try {
  host.start({settings: {}, round: {players: []}});
  const names = h => host.unseen(h).map(m => m.name).sort();
  assert.deepEqual(names(0), ['Ann', 'Bo']);
  let heard = 0;
  host.on('seen', () => heard++);
  guests[0].seen(0);
  await until(() => heard === 1);
  assert.deepEqual(names(0), ['Bo']);
  assert.deepEqual(names(1), ['Ann', 'Bo'], 'each hole its own card');
  // A card shown before anyone has joined counts for nothing: only a member
  // let in, from its own socket, is heard.
  assert.equal(readMessage({t: 'seen', member: guests[1].member, hole: -1}), null);
  // Bo's connection lost: not waited for.
  guests[1].link.close();
  await until(() => host.unseen(0).length === 0);
  // A new round starts a new count (Bo still lost, so not counted).
  host.start({settings: {}, round: {players: []}});
  assert.deepEqual(names(0), ['Ann']);
 } finally { close(); await relay.close(); }
});

// DROPPING IN AND OUT (the owner, 20 November 2026: "Yes, build both").
// Seats change at the next tee, as main.js advanceHole does (onlineSeatNow).
const seatAtNextTee = (host, queue, former) => r => {
 if (!queue.length) return;
 const {players} = seatsAtNextTee(r.players, queue.splice(0), {members: host.members, former});
 r.setPlayers(players, TEES);
};

test('drop in: a friend let in mid-round is sent the round alone, watches, and plays from the next tee', async () => {
 const relay = await relayForTest();
 const {host, guests, code, close} = await room(relay, ['Ann']);
 let cyLink = null;
 try {
  // Cy knocks before the round, and is let in once it is under way.
  cyLink = createLink({relay: relay.url, code, random});
  const cy = new GuestSession({link: cyLink, member: memberId(random), golfer: {name: 'Cy', hand: 'LH', input: 'meter'}, game: GAME});
  await until(() => host.members.get(cy.member)?.state === 'knock');
  const round = new Round({players: [{name: 'Host', team: 'A'}, {name: 'Ann', team: 'A', online: guests[0].member}], mode: 'stroke', holes: 3});
  round.placeTee(TEES);
  const queue = [], former = new Map();
  const hg = hostGame(host, round, {between: seatAtNextTee(host, queue, former)});
  let annStarts = 0, cyStart = null;
  guests[0].on('start', () => annStarts++);
  cy.on('start', m => cyStart = m);
  const ga = guestGame(guests[0]), gc = guestGame(cy);
  host.start({version: 2, settings: {}, round: round.toJSON()});
  hg.next();
  await until(() => annStarts === 1);
  host.admit(cy.member);
  assert.ok(canSeat(round.players, queue, cy.member, {former}));
  queue.push(cy.member);
  await until(() => cyStart);
  assert.equal(cyStart.to, cy.member, 'the round is sent to Cy alone');
  await hg.done;
  await until(() => [ga, gc].every(g => g.round?.finished && JSON.stringify(g.round.cards) === JSON.stringify(round.cards)));
  assert.equal(annStarts, 1, 'Ann\'s screen was not sent the round again');
  assert.equal(round.players.length, 3);
  assert.equal(round.players[2].online, cy.member);
  assert.equal(round.players[2].hand, 'LH');
  assert.ok(!Number.isFinite(round.cards[2][0]), 'nothing on the hole Cy watched');
  assert.ok(Number.isFinite(round.cards[2][1]) && Number.isFinite(round.cards[2][2]), 'the holes Cy played');
  assert.ok(gc.own > 0, 'Cy played their own shots');
  assert.equal(hg.nopes.length, 0, hg.nopes.join('; '));
 } finally { cyLink?.close(); close(); await relay.close(); }
});

test('drop out and back: a golfer who leaves mid-round has their own golfer and card back from the next tee', async () => {
 const relay = await relayForTest();
 const {host, guests, code, close} = await room(relay, ['Ann']);
 let back = null;
 try {
  const ann = guests[0], annMember = ann.member;
  const round = new Round({players: [{name: 'Host', team: 'A'}, {name: 'Ann', team: 'A', online: annMember}], mode: 'stroke', holes: 3});
  round.placeTee(TEES);
  const queue = [], former = new Map();
  const hg = hostGame(host, round, {between: seatAtNextTee(host, queue, former)});
  // As main.js onlineGuestGone: the host plays her ball until she is back.
  host.on('away', w => {
   if (w.state !== 'gone') return;
   for (const p of round.players) if (p.online === w.member) { former.set(w.member, p.name); delete p.online; }
   host.state(round.toJSON()); if (!hg.busy) hg.next();
  });
  guestGame(ann);
  host.start({version: 2, settings: {}, round: round.toJSON()});
  hg.next();
  ann.leave();
  await until(() => former.has(annMember));
  // Back, the same member (the same tab), knocking again: let in, seated.
  back = new GuestSession({link: createLink({relay: relay.url, code, random}), member: annMember, golfer: {name: 'Ann'}, game: GAME});
  const gb = guestGame(back);
  await until(() => host.members.get(annMember)?.state === 'knock');
  host.admit(annMember);
  assert.ok(canSeat(round.players, queue, annMember, {former}));
  queue.push(annMember);
  await hg.done;
  await until(() => gb.round?.finished && JSON.stringify(gb.round.cards) === JSON.stringify(round.cards));
  assert.equal(round.players.length, 2, 'her own golfer, not a new one');
  assert.equal(round.players[1].online, annMember);
  assert.ok(round.cards[1].every(Number.isFinite), 'her card whole: the host played her ball while she was out');
  assert.ok(gb.own > 0, 'and she played again');
 } finally { back?.link.close(); close(); await relay.close(); }
});

test('a shot out of turn is refused and nothing moves', async () => {
 const relay = await relayForTest();
 const {host, guests, close} = await room(relay, ['Ann']);
 try {
  const ann = guests[0];
  const round = new Round({players: [{name: 'Host', team: 'A'}, {name: 'Ann', team: 'A', online: ann.member}], mode: 'stroke', holes: 3});
  round.placeTee(TEES);
  const hg = hostGame(host, round);
  let nope = '';
  ann.on('nope', m => nope = m.why);
  host.start({version: 2, settings: {}, round: round.toJSON()});
  ann.shot({seat: 1, hole: 0, stroke: 1, club: CLUB, shot: shotFrom(round, 1)});
  await until(() => nope);
  assert.equal(nope, 'It is not your turn.');
  assert.deepEqual(round.strokes, [0, 0]);
  assert.deepEqual(hg.nopes, ['It is not your turn.']);
 } finally { close(); await relay.close(); }
});
