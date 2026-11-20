// ONE PLAYER'S CONNECTION TO A ROOM (online play, 19 November 2026).
//
// Opens `<relay>/room/<roomId>`, seals everything sent and opens everything
// received with the room's key (seal.js), and drops what does not open. Each
// message carries, sealed, the sender's own tag `me` and count `n`: a box
// arriving from any other socket than `me` is dropped (someone passing on a
// copy), and so is a count not above the last one seen from that socket (the
// relay sending one again). Pings every 25 s keep the socket alive through
// proxies (Cloudflare closes a quiet socket after about 100 s); a dropped
// socket is retried after 1, 2, 4 ... up to 15 s until `close()`.
//
// No game here: the session (session.js) decides what a message means. The
// socket, timers and randomness are passed in, so tests/online-link.test.mjs
// runs it in Node against the relay's Node twin.
import {seal, open} from './seal.js';
import {roomId, roomKey} from './room-code.js';

export const PING_MS = 25000;
export const RETRY_MS = [1000, 2000, 4000, 8000, 15000];
// PACED UNDER THE RELAY'S LIMIT (relay/core.js: 60 at once, 10 a second): a
// message the relay calls too fast is dropped there, so it is held here
// instead and sent in order as the allowance comes back. A little inside the
// relay's figures, for the clocks' disagreement.
export const PACE = {burst: 50, perSecond: 8};

export function relayRoomUrl(relay, code) {
 const base = String(relay || '').trim().replace(/\/+$/, '');
 return `${base}/room/${roomId(code)}`;
}

export function createLink({relay, code, random, WebSocketImpl = globalThis.WebSocket, setTimer = setTimeout, clearTimer = clearTimeout}) {
 const room = roomId(code), key = roomKey(code), url = relayRoomUrl(relay, code);
 const handlers = new Map();
 const emit = (type, ...a) => { for (const f of handlers.get(type) ?? []) f(...a); };
 const last = new Map();
 let ws = null, you = null, peers = new Set(), count = 0, closed = false, tries = 0, pinger = null, retry = null, status = 'idle';
 let outbox = [], tokens = PACE.burst, filled = Date.now(), flushTimer = null;
 function flush() {
  flushTimer = null;
  if (!ws || ws.readyState !== 1 || !you) { outbox = []; return; }
  const now = Date.now();
  tokens = Math.min(PACE.burst, tokens + (now - filled) / 1000 * PACE.perSecond); filled = now;
  while (outbox.length && tokens >= 1) { tokens -= 1; ws.send(seal(key, room, {...outbox.shift(), me: you, n: ++count}, random)); }
  if (outbox.length) flushTimer = setTimer(flush, Math.ceil((1 - tokens) / PACE.perSecond * 1000) + 5);
 }
 const setStatus = s => { if (s !== status) { status = s; emit('status', s); } };

 function connect() {
  if (closed) return;
  setStatus(tries ? 'retrying' : 'connecting');
  let sock;
  try { sock = new WebSocketImpl(url); } catch (e) { emit('error', e); schedule(); return; }
  ws = sock;
  sock.onopen = () => {
   tries = 0;
   pinger = setInterval(() => { if (sock.readyState === 1) sock.send('ping'); }, PING_MS);
  };
  sock.onmessage = e => {
   const text = typeof e.data === 'string' ? e.data : null;
   if (!text || text === 'pong') return;
   let m;
   try { m = JSON.parse(text); } catch { return; }
   if (m.relay === 'welcome') {
    you = m.you; peers = new Set(m.peers); last.clear();
    setStatus('open');
    emit('open', {you, peers: [...peers]});
   } else if (m.relay === 'joined') { peers.add(m.peer); emit('joined', m.peer); }
   else if (m.relay === 'left') { peers.delete(m.peer); last.delete(m.peer); emit('left', m.peer); }
   else if (m.relay) emit('refused', m.relay);
   else if (typeof m.from === 'string' && typeof m.data === 'string') {
    const msg = open(key, room, m.data);
    if (!msg || typeof msg !== 'object' || !Number.isFinite(msg.n)) return;
    // Sealed with the sender's own tag: a box passed on by any other socket is not theirs.
    if (msg.me !== m.from) return;
    if (msg.n <= (last.get(m.from) ?? 0)) return;
    last.set(m.from, msg.n);
    emit('message', m.from, msg);
   }
  };
  sock.onclose = () => {
   clearInterval(pinger); pinger = null;
   if (ws === sock) { ws = null; you = null; peers = new Set(); }
   if (closed) { setStatus('closed'); return; }
   schedule();
  };
  sock.onerror = () => {};
 }
 function schedule() {
  setStatus('retrying');
  const wait = RETRY_MS[Math.min(tries, RETRY_MS.length - 1)];
  tries++;
  retry = setTimer(() => { retry = null; connect(); }, wait);
 }

 const link = {
  get you() { return you; },
  get peers() { return [...peers]; },
  get status() { return status; },
  get url() { return url; },
  on(type, f) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(f); return link; },
  // Sealed and sent to every other socket in the room, in order and paced;
  // false if not connected (nothing is kept for a later connection: the host
  // sends the round whole to anyone who comes back).
  send(msg) {
   if (!ws || ws.readyState !== 1 || !you) return false;
   outbox.push(msg);
   if (!flushTimer) flush();
   return true;
  },
  // Messages still waiting for the relay's allowance.
  get waiting() { return outbox.length; },
  close() {
   closed = true;
   if (retry) clearTimer(retry);
   if (flushTimer) clearTimer(flushTimer);
   outbox = [];
   clearInterval(pinger);
   if (ws) try { ws.close(1000, 'bye'); } catch {}
   if (!ws) setStatus('closed');
  },
 };
 connect();
 return link;
}
