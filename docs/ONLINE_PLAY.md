# Online play

Live rounds with friends in other houses, each on their own screen, taking
turns and watching each other's shots fly. Built on the `online-play` branch
from 19 November 2026 (the owner: friends in other houses, no accounts,
private and safe rooms, a free relay). **It is marked BETA** (the owner, 20
November 2026, "like we did with the AI stuff"): the menu tile, the Play
online screen and an online golfer's seat say so. What a player sees is in PLAYING.md,
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
  boxes it cannot open, stores nothing, and holds 8 sockets a room (the host,
  up to three more golfers, and watchers).
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

## The relay on Cloudflare

The owner chose Cloudflare's free Workers plan (RESEARCH, *Online play: where
the relay can live*). One Durable Object per room holds its sockets, with the
hibernation API so an idle room costs nothing; the rules are `relay/core.js`,
shared with the Node twin. The free plan allows 100,000 requests a day; a
round uses a few hundred.

**It is deployed, and built into the game** (the owner, 20 November 2026:
"Build the relay into the game. The only thing users should have to type in
is the join code, they should not see the relay address in the game at
all"). The address is `wss://fairway-relay.fairwaygolfsim.workers.dev`, in
`src/online/relay-address.js`; the owner renamed the account's `workers.dev`
subdomain to `fairwaygolfsim` the same day so it names the game, not them,
and made it public by building it in. Nothing in the game shows it, and
there is no box to type one (the address a player could type before then,
kept in their browser, is forgotten on the next load).

Deploying again after a change to `relay/` (the owner's step: it is their
account), in `relay/cloudflare/` with Node 20 or newer:

```
npx wrangler login
npx wrangler deploy
```

then `node tools/relay-check.mjs wss://fairway-relay.fairwaygolfsim.workers.dev`.
A change to the relay's rules that an older copy of the game cannot follow
breaks every copy already out, so `relay/core.js` changes only with care.

**Kept on `workers.dev`** (the owner, 20 November 2026): the domain the
website uses is not moved to Cloudflare for the relay (RESEARCH, *The relay
on the owner's own domain*, says what moving it would take).

**Another relay:** a build can name one (`FAIRWAY_RELAY=wss://... npm run
build`, read by vite.config.js as `__FAIRWAY_RELAY__`), for a relay on any
machine -- `node relay/node-relay.mjs --port 8787` runs the same rules (a page
served over https needs `wss://`, so a public copy needs a certificate in
front of it; on a home network `ws://` is enough). Every player in a room
needs a copy built with the same one. Smoke points its pages at a relay on
this machine with `lab.relay(url)`, a console hook no player reaches.

## What an online round does differently (PLACED)

- No mulligans, free drops or group changes once it starts -- except
  dropping in, below.
- Not autosaved: a round of several machines cannot be carried on alone.
  Leaving offers to keep it, as any round; kept, it plays on alone. **A
  guest whose host leaves mid-round is not asked** (the owner, 20 November
  2026: "when the host leaves it asks joined players to save the round too
  ... need to tell joined players that the host left"): they are taken to
  the menu and a box says *Sam has left* -- the room is closed, the round
  over, and their own holes, shots and XP are kept on their profile
  (`onlineEnded`, `returnToMenu({ask: false})`). PLACED: no *play on alone*
  for them, since the others' golfers would be theirs to play.
- **The room code is shown only in the pause list** in a round (the owner,
  20 November 2026: "the join code should only show in the pause menu"):
  its *Online room* row carries the code; the host's opens the room sheet,
  a guest's copies the code. The ONLINE chip on the round screen says only
  ONLINE, RECONNECTING…, who is lost, or who is watching.
- **A computer golfer's ball is shown as each screen's own Shot views say**
  (Golfers & rules: every shot, near the green, results only): a guest who
  chose *Results only* sees the host's computer golfers' balls land without
  flying (`onlineWatch`, seat.js `showShot`), as the host's own screen does.
  Before 20 November only the host's setting was followed, and only there.
- Played on a course (the week's, a saved one, Surprise me), not Endless or a
  friend's challenge. A course from the Course Builder only if every guest
  already has its file (they are told to ask for it).
- The host moves the group to the next tee, and **waits until everyone has
  seen the hole's card** (the owner, 20 November 2026): each guest's screen
  says when its card has opened (after its own XP pop-ups), and the host's
  8-second countdown starts only when every guest still connected has said
  so (*Waiting for Sam to see the card*). A guest whose connection is lost is
  not waited for (PLACED: they are put on the next tee when they come back).
  *Stay on scorecard* and *Next hole now* work on the host as offline; a
  guest's card says the host moves everyone on, with neither button.
- Relief is chosen on the machine of the golfer whose ball it is; a scramble's
  ball by the team's first golfer.
- A guest who leaves mid-round hands their ball to the host to play; a host
  who leaves mid-round closes the room; after the last hole the room stays
  open for the next round.
- A guest whose connection is lost (a closed tab, a phone that died) keeps
  their turn waiting; after 20 seconds the host is offered *Play on without
  them* or *Wait*. Played on without, their ball is the host's, and they are
  out of the room until they knock again.
- **Dropping in, dropping out, and watching** (the owner, 20 November 2026,
  asked whether a player can drop in and out, whether someone who did not
  start the round can, and whether a spectator can become a player at the
  host's say: "Yes, build both"). A room holds eight screens, four golfers
  and the rest watching. **Anyone let in mid-round watches**: the knock bar
  offers *Let in to play* (when there is a seat, or their own golfer is
  waiting for them) and *Let in to watch*. A watcher sees every shot and card
  but swings for nobody, and their profile counts nothing; their chip says
  WATCHING. The pause list's *Online room* opens the room for the host, where each guest is
  PLAYING, WATCHING or FROM THE NEXT TEE, and *Seat from the next tee* /
  *Keep watching* change it. **Every seat change happens at the next tee**
  (PLACED: a hole is played by the group that started it, and nobody's ball
  is taken over mid-shot; `onlineSeatNow` from `advanceHole`). A newcomer
  takes a new seat on the smaller team, with nothing on the holes before it
  -- the card counts the holes they played, as a golfer added offline
  (Round.setPlayers), so in stroke play a late joiner's total is over fewer
  holes. **Someone who left the round and comes back gets their own golfer,
  card and all** -- matched by the member id their tab kept, or else by the
  golfer's name -- after the host played their ball while they were away.
  A watcher who loses their connection holds nothing up, and is not named on
  the chip. Rules: online/referee.js `seatsAtNextTee`, `canSeat`.
- Someone let in or back mid-round is sent the round alone (`start` with
  `to`); nobody else's screen starts over.
- A seat is an online guest's only while that guest is in the room open now:
  a group remembered from an earlier room (Play again) seats ordinary golfers.
- A computer golfer is the host's, and plays as it does offline.
- A host whose page is hidden (a tab in the background, a phone asleep) lands
  each flight at once rather than leaving the guests waiting; its computer
  golfers wait until it is visible again (they think in frames).
- A guest's own shot with no answer from the host in 10 seconds comes down
  and the turn is theirs again.

## Files

- `src/online/relay-address.js` -- the relay every copy uses.
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
Node twin or (`FAIRWAY_TEST_RELAY`) another relay -- the Worker under
`wrangler dev`, and on 20 November 2026 the deployed one, every format to one
card -- and the smoke journey `online`.
