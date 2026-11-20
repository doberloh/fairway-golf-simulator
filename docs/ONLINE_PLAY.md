# Online play

Live rounds with friends in other houses, each on their own screen, taking
turns and watching each other's shots fly. Built on the `online-play` branch
from 19 November 2026 (the owner: friends in other houses, no accounts,
private and safe rooms, a free relay). What a player sees is in PLAYING.md,
*Play online*; the research and the numbers behind it in RESEARCH.md,
*Online play*.

## How it works

- **A room is a code.** The host's game makes a random 16-character code
  (`K7Q2-M9XD-4RTP-8WNB`: 75 random bits and a check letter, Crockford's
  alphabet with no I, L, O or U). Friends type it in. From the code, one way
  each, come the relay's room number and the key every message is sealed with
  (`src/online/room-code.js`).
- **A relay carries the messages** between the machines of a room
  (`relay/`). It is trusted with nothing: it sees a room number and sealed
  boxes it cannot open, stores nothing, and holds 8 sockets a room.
- **The host's game is the referee.** It plays the round as any round; a
  guest's golfer is a seat (`online` on the seat, `src/game.js`) whose shots
  arrive as messages and go through the same `takeShot` a computer golfer's
  do, after `src/online/referee.js` has ruled on them (only your seat, on its
  turn, from where your ball lies). Every ball struck is sent to the guests;
  so is the round after every change.
- **A guest's game flies the same ball** from the same launch numbers (the
  ball model has no randomness), then takes the host's round in place of its
  own, so a ball that caught a lip on one machine and not the other still
  ends where the host says. Shots and states are taken in order
  (`src/online/session.js` `Follower`): a ball is never moved to its end while
  still in the air on screen.
- **Every way of running the game plays together**: the file from disk, the
  website's demo, and a phone that loaded the game from `run_fairway_server`
  over plain http with a launch monitor on that PC's bridge. Such a page has
  no browser encryption (`crypto.subtle`), so the sealing is the game's own
  code (`@noble/ciphers`, XChaCha20-Poly1305), the same on every copy.
- **No accounts.** A guest brings their golfer's name, hand, how they play,
  tee and handicap index when they knock; their profile, bag and history stay
  on their own device, and their own shots and holes count there.
- **Nothing connects until a room is opened.** The game makes no network
  connection of any kind until a player starts or joins a room.

## Privacy and safety

- The relay never sees the code; it cannot read a room or put a message in
  one that the players would accept. A message altered, forged, passed on
  from another socket, or sent again is dropped (`src/online/link.js`).
- The host lets each guest in by name, and can turn anyone away.
- Text from another machine carries no markup (`protocol.js` `safeText`);
  every message is checked before the game reads it (`readMessage`).
- **The code is the whole lock.** Anyone who has it can read the room's
  messages and knock. Only the host's yes lets them play, but someone holding
  the code could also, in principle, pose as the host to the guests while
  the real host's connection is down. Keep codes private, and open a new room
  if one gets out. Closing that gap needs a key per player (an exchange of
  public keys), which was weighed and left for later (RESEARCH, *Online
  play*).

## The relay on Cloudflare (the owner's step)

The owner chose Cloudflare's free Workers plan (RESEARCH, *Online play: where
the relay can live*). One Durable Object per room holds its sockets, with the
hibernation API so an idle room costs nothing; the rules are `relay/core.js`,
shared with the Node twin. The free plan allows 100,000 requests a day; a
round uses a few hundred.

1. Make a free account at https://dash.cloudflare.com/sign-up.
2. In `relay/cloudflare/`, with Node 20 or newer:

   ```
   npx wrangler login
   npx wrangler deploy
   ```

   `login` opens the browser to let wrangler use the account; `deploy`
   prints the relay's address, `https://fairway-relay.<account>.workers.dev`.
3. Check it: `node tools/relay-check.mjs wss://fairway-relay.<account>.workers.dev`.
4. In the game, Play online -> Relay: that address with `wss://` in place of
   `https://`. Everyone in a room uses the same relay.

**The address names the owner's Cloudflare account, so it is kept out of the
repository.** A build can carry it as the default (`FAIRWAY_RELAY=wss://...
npm run build`, read by vite.config.js as `__FAIRWAY_RELAY__`); whether a
release does is the owner's call.

**The same relay on any machine:** `node relay/node-relay.mjs --port 8787`
runs the same rules. A page served over https needs `wss://`, so a public
copy needs a certificate in front of it (Caddy or nginx); on a home network
`ws://` is enough. Oracle Cloud's free machine was the fallback (RESEARCH).

## What an online round does differently (PLACED)

- No mulligans, free drops or group changes once it starts.
- Not autosaved: a round of several machines cannot be carried on alone.
  Leaving offers to keep it, as any round; kept, it plays on alone.
- Played on a course (the week's, a saved one, Surprise me), not Endless or a
  friend's challenge. A course from the Course Builder only if every guest
  already has its file (they are told to ask for it).
- The host moves the group to the next tee; a guest's countdown waits for it.
- Relief is chosen on the machine of the golfer whose ball it is; a scramble's
  ball by the team's first golfer.
- A guest who leaves mid-round hands their ball to the host to play or take
  out; a host who leaves mid-round closes the room; after the last hole the
  room stays open for the next round.
- A computer golfer is the host's, and plays as it does offline.
- A host whose page is hidden (a tab in the background, a phone asleep) lands
  each flight at once rather than leaving the guests waiting; its computer
  golfers wait until it is visible again (they think in frames).
- A guest's own shot with no answer from the host in 10 seconds comes down
  and the turn is theirs again.

## Files

- `src/online/room-code.js` -- the code, the room number and the key.
- `src/online/seal.js` -- sealing and opening a message.
- `src/online/link.js` -- one machine's connection: sealed, paced under the
  relay's limit, replays dropped, pings, retries.
- `src/online/protocol.js` -- what each message may say; safe text.
- `src/online/session.js` -- `HostSession`, `GuestSession`, `Follower`.
- `src/online/referee.js` -- the host's rulings.
- `src/ui-online.js` -- the Play online sheet.
- `src/main.js`, *ONLINE PLAY* -- the wiring: `seatHere`, `onlineStruck`,
  `onlineHostShot`, `onlineApply`, `onlineGuestStart`, the knock bar and the
  round's chip.
- `relay/core.js`, `relay/node-relay.mjs`, `relay/cloudflare/` -- the relay.
- `tools/relay-check.mjs` -- asks any running relay its rules.

## Testing

TESTING.md, *Online play*: the Node suites (`tests/online-*.test.mjs`,
`tests/ui-online.test.mjs`), whole rounds of every format through the relay's
Node twin or (`FAIRWAY_TEST_RELAY`) the Worker under `wrangler dev`, and the
smoke journey `online`.
