# The Fairway relay on Cloudflare

Online play needs one small relay on the internet so that games in different
houses can reach each other. This folder is that relay, written for
Cloudflare's free Workers plan (chosen 19 November 2026; RESEARCH.md, *Online
play: where the relay can live*).

**What it does:** it passes sealed messages between the players of one room.
It cannot open them: the key is made from the room code, which never leaves
the players. It stores nothing and keeps no logs of what passes through.

**What it costs:** nothing on the free plan. The plan allows 100,000 requests a
day; a round of golf uses a few hundred. Past the daily allowance, new
messages are refused until midnight UTC.

## Deploying it (once)

1. Make a free account at https://dash.cloudflare.com/sign-up.
2. In this folder, with Node 20 or newer:

   ```
   npx wrangler login
   npx wrangler deploy
   ```

   `login` opens the browser to let wrangler use your account. `deploy` prints
   the relay's address, something like `https://fairway-relay.<your-name>.workers.dev`.
3. In the game: Online -> Relay, paste that address with `wss://` in front of
   it in place of `https://`. Every player in a room uses the same relay
   address.

The address names your Cloudflare account, so it is kept out of this public
repository. Whether a release carries it built in is the owner's call
(`FAIRWAY_RELAY` at build time; INSTALLATION.md, *Online play*).

## Checking it

`https://<address>/` answers "Fairway relay". A room is
`wss://<address>/room/<32 hex characters>`; the game makes that number from the
room code.

## The same relay on your own machine

`node relay/node-relay.mjs --port 8787` runs the same rules (relay/core.js) on
any computer with Node. A page served over https needs `wss://`, so a public
copy needs a certificate in front of it (Caddy or nginx); on a home network,
`ws://` is enough.
