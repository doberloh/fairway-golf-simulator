// THE FAIRWAY RELAY ON CLOUDFLARE (online play; the owner chose Cloudflare's
// free plan on 19 November 2026 -- RESEARCH, *Online play: where the relay can
// live*). One Durable Object per room holds that room's sockets; the rules
// are relay/core.js, the same as the Node twin the tests run.
//
// It stores nothing. Sockets use the hibernation API, so an idle room costs
// no duration; each socket's tag rides on the socket itself
// (serializeAttachment), because a woken object has lost its memory. "ping"
// is answered by Cloudflare without waking the object.
//
// Deploying is the owner's step (docs/ONLINE_PLAY.md, *The relay on Cloudflare*).
import {join, leave, message, newTag, roomFromPath, LIMITS} from '../core.js';

const random = n => crypto.getRandomValues(new Uint8Array(n));

export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  const id = roomFromPath(url.pathname);
  if (!id) return new Response('Fairway relay\n', {headers: {'content-type': 'text/plain', 'access-control-allow-origin': '*'}});
  if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', {status: 426});
  return env.ROOMS.get(env.ROOMS.idFromName(id)).fetch(request);
 },
};

export class Room {
 constructor(ctx) {
  this.ctx = ctx;
  this.buckets = new Map();
  ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
 }

 peers() {
  return this.ctx.getWebSockets().map(ws => ({ws, tag: ws.deserializeAttachment()?.tag})).filter(p => p.tag);
 }

 async fetch() {
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  const tag = newTag(random);
  const others = this.peers();
  const said = join(others.map(p => p.tag), tag, LIMITS);
  this.ctx.acceptWebSocket(server);
  for (const m of said.toNew) server.send(m);
  if (!said.accept) { server.close(4001, 'full'); return new Response(null, {status: 101, webSocket: client}); }
  server.serializeAttachment({tag});
  for (const p of others) for (const m of said.toOthers) try { p.ws.send(m); } catch {}
  return new Response(null, {status: 101, webSocket: client});
 }

 webSocketMessage(ws, data) {
  const tag = ws.deserializeAttachment()?.tag;
  if (!tag) return;
  const peer = {tag, bucket: this.buckets.get(tag)};
  const r = message(peer, typeof data === 'string' ? data : null, Date.now(), LIMITS);
  this.buckets.set(tag, peer.bucket);
  if (r.toSender) ws.send(r.toSender);
  if (r.toOthers) for (const p of this.peers()) if (p.tag !== tag) try { p.ws.send(r.toOthers); } catch {}
 }

 webSocketClose(ws) { this.gone(ws); }
 webSocketError(ws) { this.gone(ws); }

 gone(ws) {
  const tag = ws.deserializeAttachment()?.tag;
  if (!tag) return;
  ws.serializeAttachment(null);
  this.buckets.delete(tag);
  for (const p of this.peers()) if (p.tag !== tag) try { p.ws.send(leave(tag)); } catch {}
  try { ws.close(1000, 'bye'); } catch {}
 }
}
