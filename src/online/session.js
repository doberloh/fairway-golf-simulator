// A ROOM'S TWO SIDES (online play, 19 November 2026; PLAN.md).
//
// THE HOST IS THE REFEREE. Its game plays the round as it always has; a
// guest's golfer is a seat whose shots arrive as messages, the way a computer
// golfer's arrive from its plan. The host lets each guest in by name, checks
// every message, flies every shot, and sends the round as it stands after
// each one. A guest's game flies the same shot from the same launch numbers
// (the ball model has no randomness: RESEARCH, *Challenge a friend*), then
// takes the host's round in place of its own, so a ball that caught a lip on
// one machine and not the other still ends where the host says.
//
// No game here: main.js wires these to the round. tests/online-session.test.mjs
// plays whole matches through them over the relay's Node twin.
import {readMessage, PROTOCOL, MAX_GOLFERS, roundForGuests} from './protocol.js';

const emitter = () => {
 const handlers = new Map();
 return {
  on(type, f) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(f); },
  emit(type, ...a) { for (const f of handlers.get(type) ?? []) f(...a); },
 };
};

export const memberId = random => Array.from(random(6), b => (b % 36).toString(36)).join('') + Array.from(random(4), b => (b % 36).toString(36)).join('');

// Why a guest is turned away at the door, in the words they are shown.
export function doorProblem(hello, {game, members, maxGuests, playing}) {
 if (hello.v !== PROTOCOL || hello.game !== game) return `This room runs Fairway ${game}; you have ${hello.game}. Everyone needs the same version (different versions can grow different ground).`;
 const inRoom = [...members.values()].filter(m => m.state === 'in' || m.state === 'away').length;
 if (inRoom >= maxGuests) return 'This room is full.';
 if (playing) return 'This round has started. Ask the host to open a new room for the next one.';
 return '';
}

export class HostSession {
 // `game`: this build's version (diagnostic.js buildStamp). `maxGuests`: the
 // golfers besides the host's own (Round takes four in all).
 constructor({link, member, name, game, maxGuests = MAX_GOLFERS - 1}) {
  Object.assign(this, emitter());
  this.link = link; this.member = member; this.name = name; this.game = game; this.maxGuests = maxGuests;
  this.members = new Map(); // member -> {member, name, golfer, tag, state: 'knock'|'in'|'away'|'gone'}
  this.phase = 'lobby'; this.course = '';
  this.struck = 0; this.done = 0; this.seq = 0;
  this.record = null; this.round = null;
  link.on('message', (from, raw) => this.heard(from, raw));
  link.on('left', tag => this.lost(tag));
  link.on('open', () => this.sendRoom());
 }
 byTag(tag) { for (const m of this.members.values()) if (m.tag === tag) return m; return null; }
 send(msg) { return this.link.send(msg); }
 heard(from, raw) {
  const m = readMessage(raw);
  if (!m) return;
  if (m.t === 'hello') return this.hello(from, m);
  const who = this.members.get(m.member);
  // Only from the socket the member came in on, and only once let in.
  if (!who || who.tag !== from) return;
  if (m.t === 'bye') { who.state = 'gone'; who.tag = null; this.emit('away', who); this.sendRoom(); return; }
  if (who.state !== 'in') return;
  if (m.t === 'shot' || m.t === 'relief' || m.t === 'pick') this.emit(m.t, m, who);
 }
 hello(from, m) {
  const known = this.members.get(m.member);
  if (known && (known.state === 'in' || known.state === 'away')) {
   // Back after a dropped connection (or a reload): the same seat, a new socket.
   if (m.v !== PROTOCOL || m.game !== this.game) { this.send({t: 'refuse', member: m.member, why: doorProblem(m, {game: this.game, members: new Map(), maxGuests: 99})}); return; }
   known.tag = from; known.state = 'in';
   this.send({t: 'welcome', member: m.member, host: this.member});
   this.sendRoom();
   if (this.record) this.send({t: 'start', record: {...this.record, round: this.round ?? this.record.round}, shotNo: this.done, seq: ++this.seq});
   this.emit('back', known);
   return;
  }
  if (known?.state === 'knock') { known.tag = from; return; }
  if (known?.state === 'gone') this.members.delete(m.member);
  const why = doorProblem(m, {game: this.game, members: this.members, maxGuests: this.maxGuests, playing: this.phase !== 'lobby'});
  if (why) { this.send({t: 'refuse', member: m.member, why}); return; }
  const who = {member: m.member, name: m.golfer.name, golfer: m.golfer, tag: from, state: 'knock'};
  this.members.set(m.member, who);
  this.emit('knock', who);
 }
 lost(tag) {
  const who = this.byTag(tag);
  if (!who) return;
  who.tag = null;
  if (who.state === 'knock') { this.members.delete(who.member); this.emit('withdrawn', who); return; }
  if (who.state === 'in') { who.state = 'away'; this.emit('away', who); this.sendRoom(); }
 }
 admit(member) {
  const who = this.members.get(member);
  if (!who || who.state !== 'knock') return false;
  const inRoom = [...this.members.values()].filter(m => m.state === 'in' || m.state === 'away').length;
  if (inRoom >= this.maxGuests) { this.refuse(member, 'This room is full.'); return false; }
  who.state = 'in';
  this.send({t: 'welcome', member, host: this.member});
  this.sendRoom();
  this.emit('admitted', who);
  return true;
 }
 refuse(member, why = 'The host did not let you in.') {
  const who = this.members.get(member);
  this.send({t: 'refuse', member, why});
  if (who) { this.members.delete(member); this.emit('removed', who); this.sendRoom(); }
 }
 get guests() { return [...this.members.values()].filter(m => m.state === 'in' || m.state === 'away'); }
 roomMessage() {
  return {t: 'room', host: this.member, hostName: this.name, phase: this.phase, course: this.course,
   members: this.guests.map(m => ({member: m.member, name: m.name, state: m.state}))};
 }
 sendRoom() { this.send(this.roomMessage()); }
 // The round begins: `record` is what main.js saves (saveRecord), sent whole.
 start(record) {
  this.phase = 'playing';
  this.record = {...record, round: roundForGuests(record.round)};
  this.round = this.record.round;
  this.struck = this.done = 0;
  this.sendRoom();
  this.send({t: 'start', record: this.record, shotNo: 0, seq: ++this.seq});
 }
 // A ball struck, by anyone in the round: every guest flies it.
 // `club`: {kind, code, label} (protocol.js cleanClub).
 flown({seat, hole, stroke, club, shot, typed}) {
  const shotNo = ++this.struck;
  this.send({t: 'flown', shotNo, seat, hole, stroke, club, shot, typed: !!typed});
  return shotNo;
 }
 // The round as it stands. `shot`: this follows a ball coming to rest.
 state(roundJson, {shot = false, event = null} = {}) {
  if (shot) this.done = this.struck;
  this.round = roundForGuests(roundJson);
  this.send({t: 'state', round: this.round, shotNo: this.done, seq: ++this.seq, ...(event ? {event} : {})});
 }
 nope(member, why) { this.send({t: 'nope', member, why}); }
 finish() { this.phase = 'done'; this.sendRoom(); }
 close() { this.send({t: 'end'}); this.link.close(); }
}

export class GuestSession {
 constructor({link, member, golfer, game}) {
  Object.assign(this, emitter());
  this.link = link; this.member = member; this.golfer = golfer; this.game = game;
  this.hostTag = null; this.host = null; this.state = 'knocking'; this.room = null;
  link.on('open', () => { this.hostTag = null; this.hello(); });
  link.on('message', (from, raw) => this.heard(from, raw));
  link.on('left', tag => { if (tag === this.hostTag) { this.hostTag = null; this.emit('host-away'); } });
 }
 hello() { this.link.send({t: 'hello', v: PROTOCOL, game: this.game, member: this.member, golfer: this.golfer}); }
 heard(from, raw) {
  const m = readMessage(raw);
  if (!m) return;
  if (m.t === 'welcome' || m.t === 'refuse' || m.t === 'nope') { if (m.member !== this.member) return; }
  if (m.t === 'welcome') {
   // The host is whoever lets us in; a room message from a new socket of the
   // same host (it reconnected) moves it there.
   if (this.host && m.host !== this.host) return;
   this.hostTag = from; this.host = m.host;
   if (this.state !== 'in') { this.state = 'in'; this.emit('welcome', m); }
   return;
  }
  if (m.t === 'room' && this.host && m.host === this.host && from !== this.hostTag) { this.hostTag = from; this.emit('host-back'); }
  if (from !== this.hostTag && !(m.t === 'refuse' && this.state === 'knocking')) return;
  if (m.t === 'refuse') { this.state = 'refused'; this.emit('refused', m.why); this.link.close(); return; }
  if (m.t === 'room') { this.room = m; this.emit('room', m); return; }
  if (m.t === 'end') { this.state = 'ended'; this.emit('end'); this.link.close(); return; }
  if (['start', 'flown', 'state', 'nope'].includes(m.t)) this.emit(m.t, m);
 }
 shot(p) { return this.link.send({t: 'shot', member: this.member, ...p}); }
 relief(p) { return this.link.send({t: 'relief', member: this.member, ...p}); }
 pick(p) { return this.link.send({t: 'pick', member: this.member, ...p}); }
 leave() { this.link.send({t: 'bye', member: this.member}); this.state = 'left'; this.link.close(); }
}

// THE GUEST'S ORDER OF THINGS. Shots and states come from the host in the
// order they happened (one socket, in order). A shot is flown on screen
// (`play(flown, done)`), and the state after it is taken only once it has
// landed here (`apply(state, {afterShot})`), so a ball never jumps to its end
// while still in the air. A guest's own shot is flown the moment it is
// struck (`ownStrike`), and the host's copy of it is not flown twice. A
// start or a resync (`restart`) clears everything queued.
export class Follower {
 constructor({play, apply}) {
  this.play = play; this.apply = apply;
  this.queue = []; this.busy = false; this.own = null; this.seq = 0; this.flownKey = null; this.afterShot = false;
 }
 static key(f) { return `${f.hole}:${f.seat}:${f.stroke}`; }
 restart(seq) { this.queue = []; this.busy = false; this.own = null; this.seq = seq; this.afterShot = false; }
 heard(m) {
  if (m.t === 'state' && m.seq <= this.seq) return;
  this.queue.push(m);
  this.pump();
 }
 // The guest struck its own ball: it is in the air already.
 ownStrike(key) { this.own = key; this.busy = true; this.afterShot = true; }
 // The host would not take it (`nope`): the ball comes down, and the next
 // state puts things right.
 ownRefused() { this.own = null; this.busy = false; this.afterShot = false; this.pump(); }
 landed() { this.busy = false; this.pump(); }
 pump() {
  while (!this.busy && this.queue.length) {
   const m = this.queue.shift();
   if (m.t === 'flown') {
    if (this.own && Follower.key(m) === this.own) { this.own = null; continue; }
    this.busy = true; this.afterShot = true;
    this.play(m, () => this.landed());
   } else if (m.t === 'state') {
    if (m.seq <= this.seq) continue;
    // The state after one's own shot can come before its 'flown' echo only if
    // the host flew it first; either way it ends the shot.
    if (this.own) this.own = null;
    this.seq = m.seq;
    const afterShot = this.afterShot; this.afterShot = false;
    this.apply(m, {afterShot});
   }
  }
 }
}
