// ONE PLAYER'S CONNECTION TO A ROOM (online play, 19 November 2026).
//
// Opens `<relay>/room/<roomId>`, seals everything sent and opens everything
// received with the room's key (seal.js), and drops what does not open. Each
// message carries, sealed, the sender's own tag `me` and count `n`: a box
// arriving from any other socket than `me` is dropped (someone passing on a
// copy), and so is a count not above the last one seen from that socket (the
// relay sending one again). Pings every 25 s keep the socket alive through
// proxies (Cloudflare closes a quiet socket after about 100 s), and one with
// no answer in 10 s ends the socket (DEAD_MS); a dropped socket is retried
// after 1, 2, 4 ... up to 15 s until `close()`, said 'unreachable' after
// four failed tries, and tried at once on `nudge()`.
//
// No game here: the session (session.js) decides what a message means. The
// socket, timers and randomness are passed in, so tests/online-link.test.mjs
// runs it in Node against the relay's Node twin.
import {seal, open} from './seal.js';
import {roomId, roomKey} from './room-code.js';

export const PING_MS = 25000;
export const RETRY_MS = [1000, 2000, 4000, 8000, 15000];
// A SOCKET THAT HAS GONE QUIET IS A DEAD ONE (20 November 2026, the owner's
// "how robust is our connection error handling and reconnection?"). A phone
// moving from Wi-Fi to mobile data, or a laptop that slept, can leave a
// socket the browser still calls open for minutes. Every ping wants an
// answer: nothing at all heard for DEAD_MS after one, and the socket is
// given up and a new one opened (PLACED: 10 s, so a dead link is found
// within about 35 s; the relay answers a ping at once).
export const DEAD_MS = 10000;
// After this many failed tries in a row the relay is said to be out of
// reach (status 'unreachable', still trying): the service down, or its
// daily allowance spent. PLACED: four, about 15 s of trying.
export const UNREACHABLE_TRIES = 4;
// PACED UNDER THE RELAY'S LIMIT (relay/core.js: 60 at once, 10 a second): a
// message the relay calls too fast is dropped there, so it is held here
// instead and sent in order as the allowance comes back. A little inside the
// relay's figures, for the clocks' disagreement.
export const PACE = {burst: 50, perSecond: 8};

export function relayRoomUrl(relay, code) {
 const base = String(relay || '').trim().replace(/\/+$/, '');
 return `${base}/room/${roomId(code)}`;
}

// `pingMs`, `deadMs`, `retryMs`: the timings above, smaller in the tests.
export function createLink({relay, code, random, WebSocketImpl = globalThis.WebSocket, setTimer = setTimeout, clearTimer = clearTimeout,
 pingMs = PING_MS, deadMs = DEAD_MS, retryMs = RETRY_MS}) {
 const room = roomId(code), key = roomKey(code), url = relayRoomUrl(relay, code);
 const handlers = new Map();
 const emit = (type, ...a) => { for (const f of handlers.get(type) ?? []) f(...a); };
 const last = new Map();
 let ws = null, you = null, peers = new Set(), count = 0, closed = false, tries = 0, pinger = null, retry = null, status = 'idle';
 let outbox = [], tokens = PACE.burst, filled = Date.now(), flushTimer = null, lastClose = null, drops = 0, deadline = null;
 const stopBeat = () => { if (pinger) clearTimer(pinger); if (deadline) clearTimer(deadline); pinger = deadline = null; };
 // A ping now, and the socket given up if nothing at all comes back in time.
 const ping = sock => {
  if (sock !== ws || sock.readyState !== 1) return;
  try { sock.send('ping'); } catch {}
  if (!deadline) deadline = setTimer(() => { deadline = null; lost(sock, {code: 'silent', reason: 'no answer from the relay'}); }, deadMs);
 };
 const beat = sock => { pinger = setTimer(() => { ping(sock); beat(sock); }, pingMs); };
 // The socket is done with, by its own close or because it went quiet.
 function lost(sock, {code = null, reason = '', clean = false} = {}) {
  if (sock !== ws) return;
  lastClose = {code, reason: String(reason).slice(0, 80), clean, at: Date.now(), open: !!you};
  drops++;
  stopBeat();
  sock.onopen = sock.onmessage = sock.onclose = sock.onerror = null;
  if (code === 'silent') try { sock.close(); } catch {}
  ws = null; you = null; peers = new Set();
  if (closed) { setStatus('closed'); return; }
  schedule();
 }
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
  setStatus(tries ? (tries >= UNREACHABLE_TRIES ? 'unreachable' : 'retrying') : 'connecting');
  let sock;
  try { sock = new WebSocketImpl(url); } catch (e) { emit('error', e); schedule(); return; }
  ws = sock;
  sock.onopen = () => {
   tries = 0;
   beat(sock);
  };
  sock.onmessage = e => {
   // Anything heard at all: the socket is alive.
   if (deadline) { clearTimer(deadline); deadline = null; }
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
  // Why, as the browser says it (smoke prints it: twice in a day a screen
  // lost the relay with no close seen at the relay's end).
  sock.onclose = e => {
   if (closed && sock === ws) { ws = null; you = null; stopBeat(); setStatus('closed'); return; }
   lost(sock, {code: e?.code ?? null, reason: e?.reason ?? '', clean: !!e?.wasClean});
  };
  sock.onerror = () => {};
 }
 function schedule() {
  tries++;
  setStatus(tries >= UNREACHABLE_TRIES ? 'unreachable' : 'retrying');
  const wait = retryMs[Math.min(tries - 1, retryMs.length - 1)];
  retry = setTimer(() => { retry = null; connect(); }, wait);
 }

 const link = {
  get you() { return you; },
  get peers() { return [...peers]; },
  get status() { return status; },
  get url() { return url; },
  // The last socket closed (code, reason, clean, when) and how many have.
  get lastClose() { return lastClose; },
  get drops() { return drops; },
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
  // THE NETWORK IS BACK, OR THE PAGE IS SHOWN AGAIN (main.js: the browser's
  // `online` and `visibilitychange`): a connection waiting to retry tries
  // now, and an open one is asked at once whether it is still alive.
  nudge() {
   if (closed) return;
   if (retry) { clearTimer(retry); retry = null; connect(); return; }
   if (ws && ws.readyState === 1) ping(ws);
  },
  close() {
   closed = true;
   if (retry) clearTimer(retry);
   if (flushTimer) clearTimer(flushTimer);
   outbox = [];
   stopBeat();
   if (ws) try { ws.close(1000, 'bye'); } catch {}
   if (!ws) setStatus('closed');
  },
 };
 connect();
 return link;
}
