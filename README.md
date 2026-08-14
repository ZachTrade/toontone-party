# Toon Tone Party

A multiplayer brand-colour guessing game. Each round names a famous brand and one
specific element of it — the golden arches, the siren green, Tiffany's box blue — and
shows **the brand's actual logo**, drained of colour. Everyone rebuilds the shade from
memory on hue / saturation / brightness sliders, **and the logo repaints itself live as
you drag**, so you're judging the colour on the real mark rather than an abstract
swatch. Closest guess wins the round.

Five rounds, up to 12 players per room, live leaderboard, podium at the end.

## Deploying to Vercel

1. Import this repo in Vercel (**Add New → Project**), pointing at the branch
   `claude/logo-color-guessing-game-zqrq0r`.
2. No build settings needed — it's static files plus one serverless function, so let
   Vercel auto-detect (framework: Other).
3. Add the two environment variables below under **Settings → Environment Variables**,
   then deploy.

### Environment variables (required)

Room state lives in [Upstash Redis](https://console.upstash.com/) (free tier is plenty).
Create a Redis database, open its **REST API** section, and copy:

| Variable | Where it comes from |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash database → REST API |

Without them the API returns `503 not_configured` and the site shows a message saying
the database isn't connected. **Environment variables only take effect on a new
deployment** — after adding them, redeploy.

## How a game runs

1. Someone taps **Create a room** and gets a 4-character code plus a share link.
2. Friends open the link (or type the code), pick a name, and appear in the lobby.
3. The host starts. Each round gives everyone 45 seconds; the round ends early once
   every present player has locked in. **You don't have to hit the button** — when the
   timer runs out, whatever colour your sliders are on is locked in for you, so sitting
   on a shade too long costs you accuracy rather than the whole round. Only a player
   who left the page entirely ends a round with no colour.
4. The reveal screen shows the logo in its true colour beside the same logo in your
   colour, your score out of 10, and the running leaderboard.
5. After five rounds: podium, a recap of every colour, and **Play again** to rematch in
   the same room.

Rooms expire two hours after creation.

## Scoring

Each round scores 0.00–10.00. Hue carries most of the weight and also scales the whole
score, so landing in the wrong colour family can't be rescued by nailing saturation and
brightness. Near-grey and near-black targets are the exception — their hue is close to
meaningless, so for those it neither carries weight nor scales anything. See
`scoreGuess` in `api/_lib.js`.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The whole client — every screen, the sliders, the timer, polling |
| `logos.js` | ~100 brand marks as re-tintable inline SVG (see below) |
| `api/game.js` | The one API endpoint; `op` selects create / join / start / submit / state |
| `api/_lib.js` | Redis client, colour maths, scoring, round building |
| `api/_brands.js` | The brand list with official colours and difficulty tiers |

Clients poll `/api/game` about once a second rather than using WebSockets, which keeps
the whole thing inside Vercel's serverless model with no persistent connections.

### About the logos

Every entry in `logos.js` stores SVG markup in which the token `CURRENT` is swapped for
the player's colour at render time; any other fill is static. There are three tiers,
checked in this order:

| Tier | What it is |
| --- | --- |
| `PARTIAL` | Keyed `"Brand\|element"`. Multi-part marks where only **one** part is the colour in play, so the rest has to stay neutral grey — Mastercard's left circle, a single letter of the Google logo. Has to beat `REAL`, or the prompt stops making sense. |
| `REAL` | The brand's actual logo artwork: exact vector outlines on a 24×24 grid, one path, so the whole mark re-tints as a single shape. **78 brands.** |
| `DRAWN` | Original approximations, kept only for the 23 brands with no real mark available (LEGO, Barbie, Tiffany & Co., Oreo, Costco, the Olympic rings…). |

Anything not covered falls back to a tinted tile of the brand's initials — `npm test`
asserts that no prompt actually lands there.

The real outlines come from [simple-icons](https://github.com/simple-icons/simple-icons)
(CC0-1.0), inlined at build time so the game ships no runtime dependency. Newer releases
of that project have dropped a number of consumer brands, so the generator falls back
through older releases to fill them in — 63 marks come from 16.x, the remaining 15 from
13.x, 11.x and 9.x. The logos themselves remain trademarks of their respective owners;
the game names each brand out loud and uses its mark to ask you about that brand.

To add a brand: add a row to `api/_brands.js`. If simple-icons carries it, add its path
to `REAL`; otherwise draw a mark into `DRAWN`, or into `PARTIAL` keyed `"Brand|element"`
when only one part should recolour.

## Local development

```bash
npm install                     # nothing to install yet, but keeps npm quiet
npm run dev                     # http://127.0.0.1:5600
```

`dev-server.js` serves the client and the API function together, backed by an in-memory
stand-in for Redis (`fake-redis.js`) so you don't need a real database to develop.

```bash
npm test                        # game logic, scoring, race conditions, logo marks
npm i -D playwright && npm run test:ui   # drives two real browsers through a full game
```

`test:ui` needs Chromium; it writes screenshots of every screen to `/tmp/tt-shots`
(override with `SHOT_DIR`). It plays a full game, then sits out a whole 45-second round
without touching the button to prove the timer locks a colour in — so allow it a couple
of minutes.
