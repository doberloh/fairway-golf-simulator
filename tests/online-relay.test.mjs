import test from 'node:test';
import assert from 'node:assert/strict';
import {join, message, roomFromPath, LIMITS} from '../relay/core.js';
import {startRelay} from '../relay/node-relay.mjs';

// THE RELAY CARRIES SEALED BOXES AND KNOWS ONLY WHO IS CONNECTED (online play,
// 19 November 2026). The rules are relay/core.js; the Node twin runs them as
// the Cloudflare Worker does.

test('a room takes eight sockets; the ninth is told it is full', () => {
 const tags = Array.from({length: 8}, (_, i) => 't' + i);
 assert.equal(join(tags.slice(0, 7), 'new').accept, true);
 const full = join(tags, 'new');
 assert.equal(full.accept, false);
 assert.deepEqual(JSON.parse(full.toNew[0]), {relay: 'full'});
 const ok = join(['a'], 'b');
 assert.deepEqual(JSON.parse(ok.toNew[0]), {relay: 'welcome', you: 'b', peers: ['a']});
 assert.deepEqual(JSON.parse(ok.toOthers[0]), {relay: 'joined', peer: 'b'});
});

test('only a room path of 32 hex characters is a room', () => {
 assert.equal(roomFromPath('/room/' + 'a'.repeat(32)), 'a'.repeat(32));
 assert.equal(roomFromPath('/room/' + 'A'.repeat(32)), null);
 assert.equal(roomFromPath('/room/abc'), null);
 assert.equal(roomFromPath('/'), null);
});

test('a burst is carried, a flood is slowed, and the bucket refills', () => {
 const peer = {tag: 'p'};
 let passed = 0, t = 0;
 for (let i = 0; i < 100; i++) if (message(peer, 'box', t).toOthers) passed++;
 assert.equal(passed, LIMITS.burst, 'the burst, then nothing');
 assert.deepEqual(JSON.parse(message(peer, 'box', t).toSender), {relay: 'slow'});
 t += 1000;
 passed = 0;
 for (let i = 0; i < 20; i++) if (message(peer, 'box', t).toOthers) passed++;
 assert.equal(passed, LIMITS.perSecond, 'a second later, a second\'s worth');
 assert.equal(message(peer, 'ping', t).toSender, 'pong', 'pings cost nothing');
 assert.deepEqual(JSON.parse(message({tag: 'q'}, 'x'.repeat(LIMITS.maxBytes + 1), 0).toSender), {relay: 'big'});
 assert.deepEqual(JSON.parse(message({tag: 'q'}, 'box', 0).toOthers), {from: 'q', data: 'box'});
});

// Over real sockets: the Node twin on a free port.
const connect = url => new Promise((resolve, reject) => {
 const ws = new WebSocket(url), inbox = [];
 const waiters = [];
 ws.onmessage = e => { inbox.push(e.data); const w = waiters.shift(); if (w) w(); };
 ws.onerror = reject;
 ws.onopen = () => resolve({
  ws, inbox,
  next: async () => { while (!inbox.length) await new Promise(r => waiters.push(r)); return inbox.shift(); },
 });
});

test('the Node twin passes boxes between a room\'s sockets and no further', async () => {
 const relay = await startRelay({port: 0});
 try {
  const room = relay.url + '/room/' + '1'.repeat(32), other = relay.url + '/room/' + '2'.repeat(32);
  const a = await connect(room);
  const wa = JSON.parse(await a.next());
  assert.equal(wa.relay, 'welcome'); assert.deepEqual(wa.peers, []);
  const b = await connect(room);
  const wb = JSON.parse(await b.next());
  assert.deepEqual(wb.peers, [wa.you]);
  assert.deepEqual(JSON.parse(await a.next()), {relay: 'joined', peer: wb.you});
  const c = await connect(other);
  await c.next();
  a.ws.send('sealed-box-1');
  assert.deepEqual(JSON.parse(await b.next()), {from: wa.you, data: 'sealed-box-1'});
  a.ws.send('ping');
  assert.equal(await a.next(), 'pong');
  await new Promise(r => setTimeout(r, 50));
  assert.equal(c.inbox.length, 0, 'another room hears nothing');
  b.ws.close();
  assert.deepEqual(JSON.parse(await a.next()), {relay: 'left', peer: wb.you});
  a.ws.close(); c.ws.close();
  await new Promise(r => setTimeout(r, 50));
  assert.equal(relay.rooms.size, 0, 'an empty room is gone');
 } finally { await relay.close(); }
});
