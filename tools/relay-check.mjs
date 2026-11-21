// CHECK A RELAY (online play, 19 November 2026): the rules of relay/core.js
// asked of any running relay -- the Node twin, the Worker under `wrangler
// dev`, or the deployed one -- over real sockets.
//
//   node tools/relay-check.mjs ws://127.0.0.1:8787
//   node tools/relay-check.mjs wss://<your relay address>
//
// It opens a room of its own (a fresh random code), so it never touches a
// room anyone is playing in, and prints what passed. Nothing is stored.
import {randomBytes} from 'node:crypto';
import {createLink} from '../src/online/link.js';
import {newRoomCode, roomId} from '../src/online/room-code.js';
import {LIMITS} from '../relay/core.js';

const relay = process.argv[2];
if (!relay || !/^wss?:\/\//.test(relay)) { console.error('usage: node tools/relay-check.mjs ws(s)://address'); process.exit(2); }
const random = n => new Uint8Array(randomBytes(n));
const until = async (f, ms = 8000, what = 'it') => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw Error(`timed out waiting for ${what}`); await new Promise(r => setTimeout(r, 20)); } };
const raw = url => new Promise((resolve, reject) => {
 const ws = new WebSocket(url), inbox = [];
 ws.onmessage = e => inbox.push(String(e.data));
 ws.onerror = () => reject(Error(`could not open ${url}`));
 ws.onopen = () => resolve({ws, inbox});
});
let failed = 0;
const check = async (name, f) => { try { await f(); console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`); } };

console.log(`Relay at ${relay}`);
const base = relay.replace(/\/+$/, '').replace(/^ws/, 'http');
await check('it answers at its root', async () => {
 const r = await fetch(base + '/');
 const text = await r.text();
 if (!/Fairway relay/.test(text)) throw Error(`said ${JSON.stringify(text.slice(0, 60))}`);
});
const code = newRoomCode(random), url = `${relay.replace(/\/+$/, '')}/room/${roomId(code)}`;
const links = [];
await check('two players in a room hear each other, sealed both ways', async () => {
 const a = createLink({relay, code, random}), b = createLink({relay, code, random});
 links.push(a, b);
 const heard = [];
 b.on('message', (from, m) => heard.push({from, m}));
 await until(() => a.status === 'open' && b.status === 'open', 8000, 'both to connect');
 a.send({t: 'hello', x: 1});
 await until(() => heard.length === 1, 8000, 'the message');
 if (heard[0].from !== a.you || heard[0].m.x !== 1) throw Error(JSON.stringify(heard));
});
await check('a ping is answered', async () => {
 const s = await raw(url);
 await until(() => s.inbox.length, 5000, 'the welcome');
 s.ws.send('ping');
 await until(() => s.inbox.includes('pong'), 5000, 'pong');
 s.ws.close();
});
await check('a message over the size limit is refused', async () => {
 const s = await raw(url);
 await until(() => s.inbox.length, 5000, 'the welcome');
 s.ws.send('x'.repeat(LIMITS.maxBytes + 10));
 await until(() => s.inbox.some(m => m.includes('"big"')) || s.ws.readyState > 1, 5000, 'the refusal');
 s.ws.close();
});
await check('another room hears nothing', async () => {
 const other = await raw(`${relay.replace(/\/+$/, '')}/room/${roomId(newRoomCode(random))}`);
 await until(() => other.inbox.length, 5000, 'the welcome');
 links[0].send({t: 'secret'});
 await new Promise(r => setTimeout(r, 400));
 if (other.inbox.length !== 1) throw Error(`heard ${other.inbox.length - 1} messages`);
 other.ws.close();
});
await check(`a room holds ${LIMITS.maxPeers} sockets; the next is told it is full`, async () => {
 const extra = [];
 for (let i = links.length; i < LIMITS.maxPeers; i++) { const s = await raw(url); extra.push(s); }
 await until(() => extra.every(s => s.inbox.length), 5000, 'the welcomes');
 const last = await raw(url);
 await until(() => last.inbox.length, 5000, 'an answer');
 if (!last.inbox[0].includes('"full"')) throw Error(`said ${last.inbox[0]}`);
 for (const s of [...extra, last]) s.ws.close();
});
for (const l of links) l.close();
console.log(failed ? `${failed} failed` : 'all passed');
setTimeout(() => process.exit(failed ? 1 : 0), 300);
