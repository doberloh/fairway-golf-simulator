// THE RELAY'S RULES, shared by the Cloudflare Worker (relay/cloudflare/) and
// its Node twin (relay/node-relay.mjs), which the tests and the local smoke
// run against (online play, 19 November 2026; PLAN.md).
//
// The relay is trusted with nothing. It carries sealed boxes (src/online/
// seal.js) between the sockets of one room and cannot open them; it stores
// nothing and logs no contents. What it adds, in plain JSON, is only who is
// connected, by a random tag it gives each socket:
//   to a newcomer   {"relay":"welcome","you":tag,"peers":[tag...]}
//   to the others   {"relay":"joined","peer":tag} / {"relay":"left","peer":tag}
//   a box passed on {"from":tag,"data":box}
//   refusals        {"relay":"full"} (then closed), {"relay":"slow"} (dropped),
//                   {"relay":"big"} (dropped)
// The sender is the tag the relay saw, so one key holder cannot pose as
// another's socket. "ping" is answered "pong" and counts against nothing.
//
// Limits (PLACED): 8 sockets a room (four golfers and watchers, with room to
// rejoin), 48 KB a message (a built course goes in 32 KB pieces), and a
// bucket of 60 messages refilled at 10 a second per socket -- a round sends a
// few a minute; a course file's pieces are the burst it is sized for.
// Pure: the caller keeps the sockets and sends what these return.

export const LIMITS = {maxPeers: 8, maxBytes: 48 * 1024, burst: 60, perSecond: 10};
export const ROOM_ID = /^[0-9a-f]{32}$/;

export function newTag(random) {
 const b = random(6);
 return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

export const roomFromPath = path => {
 const m = /^\/room\/([0-9a-f]{32})\/?$/.exec(path || '');
 return m ? m[1] : null;
};

// A newcomer: `tags` are those already in the room.
export function join(tags, tag, limits = LIMITS) {
 if (tags.length >= limits.maxPeers) return {accept: false, toNew: [JSON.stringify({relay: 'full'})], toOthers: []};
 return {
  accept: true,
  toNew: [JSON.stringify({relay: 'welcome', you: tag, peers: [...tags]})],
  toOthers: [JSON.stringify({relay: 'joined', peer: tag})],
 };
}

export const leave = tag => JSON.stringify({relay: 'left', peer: tag});

// A message from `peer` ({tag, bucket?}); `now` in ms. Returns what to send
// back to the sender and what to pass to every other socket in the room.
export function message(peer, text, now, limits = LIMITS) {
 if (text === 'ping') return {toSender: 'pong', toOthers: null};
 if (typeof text !== 'string') return {toSender: JSON.stringify({relay: 'big'}), toOthers: null};
 if (text.length > limits.maxBytes) return {toSender: JSON.stringify({relay: 'big'}), toOthers: null};
 const b = peer.bucket ??= {left: limits.burst, at: now};
 b.left = Math.min(limits.burst, b.left + (now - b.at) / 1000 * limits.perSecond);
 b.at = now;
 if (b.left < 1) return {toSender: JSON.stringify({relay: 'slow'}), toOthers: null};
 b.left -= 1;
 return {toSender: null, toOthers: JSON.stringify({from: peer.tag, data: text})};
}
