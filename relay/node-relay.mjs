// THE RELAY'S NODE TWIN (online play, 19 November 2026): the same rules as
// the Cloudflare Worker (relay/core.js), for the tests, the two-browser smoke
// journey, and anyone who would rather run their own on a machine of theirs
// (Oracle Cloud was the owner's fallback; RESEARCH, *Online play*).
//
//   node relay/node-relay.mjs [--port 8787] [--host 127.0.0.1]
//
// It serves `ws://host:port/room/<32 hex>`; a page on https needs `wss://`, so
// a public twin sits behind something that adds the certificate. Nothing is
// stored or logged but a count of rooms and sockets.
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {WebSocketServer} from 'ws';
import {join, leave, message, newTag, roomFromPath, LIMITS} from './core.js';

export function startRelay({port = 8787, host = '127.0.0.1', limits = LIMITS, log = () => {}} = {}) {
 const rooms = new Map(); // id -> Map(tag -> {tag, ws, bucket})
 const random = n => new Uint8Array(randomBytes(n));
 const server = createServer((req, res) => {
  res.writeHead(200, {'content-type': 'text/plain', 'access-control-allow-origin': '*'});
  res.end('Fairway relay\n');
 });
 const wss = new WebSocketServer({noServer: true, maxPayload: limits.maxBytes + 1024});
 server.on('upgrade', (req, socket, head) => {
  const id = roomFromPath(new URL(req.url, 'http://x').pathname);
  if (!id) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
   const room = rooms.get(id) ?? new Map();
   const tag = newTag(random);
   const said = join([...room.keys()], tag, limits);
   for (const m of said.toNew) ws.send(m);
   if (!said.accept) { ws.close(4001, 'full'); return; }
   for (const p of room.values()) for (const m of said.toOthers) p.ws.send(m);
   const peer = {tag, ws};
   room.set(tag, peer); rooms.set(id, room);
   log(`rooms ${rooms.size}, +1 socket`);
   ws.on('message', (data, binary) => {
    const r = message(peer, binary ? null : data.toString(), Date.now(), limits);
    if (r.toSender) ws.send(r.toSender);
    if (r.toOthers) for (const p of room.values()) if (p !== peer && p.ws.readyState === 1) p.ws.send(r.toOthers);
   });
   ws.on('close', () => {
    room.delete(tag);
    if (!room.size) rooms.delete(id);
    else for (const p of room.values()) if (p.ws.readyState === 1) p.ws.send(leave(tag));
    log(`rooms ${rooms.size}, -1 socket`);
   });
   ws.on('error', () => {});
  });
 });
 return new Promise(resolve => server.listen(port, host, () => resolve({
  port: server.address().port,
  url: `ws://${host}:${server.address().port}`,
  rooms,
  close: () => new Promise(done => { for (const c of wss.clients) c.terminate(); wss.close(); server.close(() => done()); }),
 })));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
 const arg = (n, d) => { const i = process.argv.indexOf(n); return i < 0 ? d : process.argv[i + 1]; };
 const r = await startRelay({port: Number(arg('--port', 8787)), host: arg('--host', '127.0.0.1'), log: s => console.log(s)});
 console.log(`Fairway relay on ${r.url}/room/<id>  (Ctrl+C to stop)`);
}
