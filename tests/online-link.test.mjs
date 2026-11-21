import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createLink, relayRoomUrl} from '../src/online/link.js';
import {newRoomCode, roomId} from '../src/online/room-code.js';
import {startRelay} from '../relay/node-relay.mjs';

// ONE PLAYER'S CONNECTION TO A ROOM (online play, 19 November 2026): sealed
// both ways through the relay's Node twin, replays dropped, a lost socket
// retried.
const random = n => new Uint8Array(randomBytes(n));
const until = async (f, ms = 2000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw Error('timed out'); await new Promise(r => setTimeout(r, 10)); } };

test('the relay address takes the room number, never the code', () => {
 const code = newRoomCode(random);
 assert.equal(relayRoomUrl('wss://relay.example/', code), `wss://relay.example/room/${roomId(code)}`);
 assert.ok(!relayRoomUrl('wss://x', code).includes(code));
});

test('two players in a room hear each other; a third with another code hears nothing', async () => {
 const relay = await startRelay({port: 0});
 const code = newRoomCode(random), links = [];
 try {
  const a = createLink({relay: relay.url, code, random}), b = createLink({relay: relay.url, code, random});
  links.push(a, b);
  const heardA = [], heardB = [];
  a.on('message', (from, m) => heardA.push({from, m}));
  b.on('message', (from, m) => heardB.push({from, m}));
  await until(() => a.status === 'open' && b.status === 'open');
  a.send({t: 'hello', name: 'Ann'});
  await until(() => heardB.length === 1);
  assert.equal(heardB[0].from, a.you);
  assert.equal(heardB[0].m.t, 'hello'); assert.equal(heardB[0].m.name, 'Ann');
  b.send({t: 'hi'});
  await until(() => heardA.length === 1);

  // Another code on the same room number cannot be made, but a socket on
  // the right room with the wrong key is what a stranger would be.
  const stranger = createLink({relay: relay.url, code: newRoomCode(random), random});
  links.push(stranger);
  await until(() => stranger.status === 'open');
  const raw = new WebSocket(relay.url + '/room/' + roomId(code));
  await new Promise(r => raw.onopen = r);
  raw.send('forged-box');
  a.send({t: 'after'});
  await until(() => heardB.length === 2);
  assert.deepEqual(heardB.map(h => h.m.t), ['hello', 'after'], 'the forged box opened to nothing');
  raw.close();
 } finally { for (const l of links) l.close(); await relay.close(); }
});

test('a box replayed by someone between is dropped', async () => {
 const relay = await startRelay({port: 0});
 const code = newRoomCode(random), links = [];
 try {
  const a = createLink({relay: relay.url, code, random}), b = createLink({relay: relay.url, code, random});
  links.push(a, b);
  const heard = [];
  b.on('message', (from, m) => heard.push(m.t));
  await until(() => a.status === 'open' && b.status === 'open');
  // Record what a sends by listening as a raw socket in the room.
  const spy = new WebSocket(relay.url + '/room/' + roomId(code)), seen = [];
  spy.onmessage = e => { const m = JSON.parse(e.data); if (m.data) seen.push(m.data); };
  await new Promise(r => spy.onopen = r);
  a.send({t: 'one'});
  await until(() => heard.length === 1 && seen.length === 1);
  spy.send(seen[0]);
  a.send({t: 'two'});
  await until(() => heard.length >= 2);
  await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(heard, ['one', 'two'], 'the copy came from the spy\'s socket, not the sender\'s');
  spy.close();
 } finally { for (const l of links) l.close(); await relay.close(); }
});

test('a lost connection is retried and the room carries on', async () => {
 let relay = await startRelay({port: 0});
 const port = relay.port, code = newRoomCode(random);
 const a = createLink({relay: relay.url, code, random});
 const statuses = [];
 a.on('status', s => statuses.push(s));
 try {
  await until(() => a.status === 'open');
  await relay.close();
  await until(() => a.status === 'retrying');
  relay = await startRelay({port});
  await until(() => a.status === 'open', 5000);
  assert.ok(statuses.includes('retrying') && statuses.at(-1) === 'open');
 } finally { a.close(); await relay.close(); }
});

// A SOCKET STAND-IN (20 November 2026, the owner's "how robust is our
// connection error handling and reconnection?"): opens, says welcome, and
// then answers a ping or not (`quiet`), or never opens at all (`refuse`).
function fakeSockets({quiet = () => false, refuse = () => false} = {}) {
 const made = [];
 class Fake {
  constructor(url) {
   this.url = url; this.readyState = 0; this.sent = []; made.push(this);
   setTimeout(() => {
    if (refuse(made.length)) { this.readyState = 3; this.onclose?.({code: 1006, reason: '', wasClean: false}); return; }
    this.readyState = 1; this.onopen?.();
    this.onmessage?.({data: JSON.stringify({relay: 'welcome', you: `t${made.length}`, peers: []})});
   }, 1);
  }
  send(text) { this.sent.push(text); if (text === 'ping' && !quiet(made.indexOf(this) + 1)) setTimeout(() => this.onmessage?.({data: 'pong'}), 1); }
  close() { this.readyState = 3; }
 }
 return {Fake, made};
}

test('a socket that goes quiet is given up and a new one opened (no close needed from the browser)', async () => {
 // The first socket never answers a ping; the second does.
 const {Fake, made} = fakeSockets({quiet: n => n === 1});
 const a = createLink({relay: 'ws://x', code: newRoomCode(random), random, WebSocketImpl: Fake, pingMs: 30, deadMs: 40, retryMs: [5]});
 try {
  await until(() => a.status === 'open');
  await until(() => made.length === 2 && a.status === 'open', 2000);
  assert.equal(a.lastClose.code, 'silent');
  assert.equal(a.drops, 1);
  // The answering socket stays.
  await new Promise(r => setTimeout(r, 200));
  assert.equal(made.length, 2);
 } finally { a.close(); }
});

test('a relay out of reach is said so after four failed tries, and a nudge tries at once', async () => {
 let up = false;
 const {Fake, made} = fakeSockets({refuse: () => !up});
 const statuses = [];
 const a = createLink({relay: 'ws://x', code: newRoomCode(random), random, WebSocketImpl: Fake, retryMs: [5, 5, 5, 60000]});
 a.on('status', s => statuses.push(s));
 try {
  await until(() => a.status === 'unreachable');
  assert.ok(statuses.indexOf('retrying') < statuses.indexOf('unreachable'), statuses.join(' '));
  // Now waiting a minute to try again: the network is back, and a nudge
  // (main.js: the browser's `online`, the page shown) tries at once.
  const n = made.length;
  up = true;
  a.nudge();
  await until(() => a.status === 'open');
  assert.equal(made.length, n + 1);
 } finally { a.close(); }
});

test('a nudge on an open socket asks it at once whether it is alive', async () => {
 const {Fake, made} = fakeSockets({quiet: () => true});
 const a = createLink({relay: 'ws://x', code: newRoomCode(random), random, WebSocketImpl: Fake, pingMs: 60000, deadMs: 30, retryMs: [5]});
 try {
  await until(() => a.status === 'open');
  a.nudge();
  assert.equal(made[0].sent.at(-1), 'ping');
  await until(() => made.length === 2, 1000);
  assert.equal(a.lastClose.code, 'silent');
 } finally { a.close(); }
});
