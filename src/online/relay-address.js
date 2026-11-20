// THE RELAY EVERY COPY OF FAIRWAY USES (the owner, 20 November 2026: "Build
// the relay into the game. The only thing users should have to type in is
// the join code, they should not see the relay address in the game at all").
// The owner's Cloudflare Worker (relay/cloudflare/, docs/ONLINE_PLAY.md),
// made public by that decision: it is in every built page anyway. A build
// may point elsewhere with FAIRWAY_RELAY (vite.config.js); smoke points its
// pages at a relay on this machine with `lab.relay(url)`.
export const RELAY = 'wss://fairway-relay.fairwaygolfsim.workers.dev';
