# Toon Tone Party

A multiplayer brand-colour guessing game. Each round names a famous brand and one
specific element of it — the golden arches, the siren green, AirAsia red — and
shows **the brand's actual logo**, drained of colour. Everyone rebuilds the shade from
memory on hue / saturation / brightness sliders, **and the logo repaints itself live as
you drag**, so you're judging the colour on the real mark rather than an abstract
swatch. Closest guess wins the round.

Five rounds, up to 12 players per room, live leaderboard, podium at the end — plus a
daily challenge everyone plays against the same logo.

## Deploying to Vercel

Already deployed: the Vercel project `toontone-party` is linked to this repo and deploys
`main` to production on every push. To set one up from scratch:

1. Import this repo in Vercel (**Add New → Project**).
2. No build settings needed — it's static files plus one serverless function, so let
   Vercel auto-detect (framework: Other). `api/game.js` becomes `/api/game` by
   convention, so **the `api/` directory has to stay intact** — flatten it and the game
   loads but every room action 404s.
3. Add the two environment variables below under **Settings → Environment Variables**,
   then redeploy.

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

## Daily challenge

One logo a day, the same one for everybody, on a global leaderboard. No room, no timer —
but **one attempt**, which is what makes the score worth anything.

- **Same logo for everyone.** Nothing random happens per request. The whole prompt list
  is shuffled once by a fixed seed and the day walks one step along it, so every player
  on a date gets the same brand and no prompt returns until all 94 have had a turn.
- **The target is pinned on first play.** `dailyPrompt` derives from the brand list, so
  a deploy that adds a brand would otherwise shift the answer mid-day and score people
  against different colours than their friends. The first request of the day writes the
  prompt to Redis with `SET NX`; everyone after reads that.
- **One shot.** The guess is stored with `HSETNX`, so a reload, a second tab or a
  re-submit can't fish for a better score. Enforced server-side, not by a disabled
  button.
- **The answer stays hidden** until you've played — including the emoji, which would
  otherwise give the colour away.
- **The day rolls over at midnight Malaysia time** (UTC+8), not UTC, so "today's logo"
  changes overnight for the people playing rather than mid-morning. It's one constant,
  `DAY_OFFSET_MINUTES` in `api/_lib.js`.

Identity is a random id in `localStorage`, so the board is per-browser and anyone can
put any name on it. That's the right trade for a party game; it is not cheat-proof and
isn't trying to be.

Boards are kept for three days.

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
| `logos.js` | 91 real brand marks as re-tintable inline SVG (see below) |
| `api/game.js` | The one API endpoint; `op` selects create / join / start / submit / state / daily / dailySubmit |
| `api/_lib.js` | Redis client, colour maths, scoring, round building |
| `api/_brands.js` | The brand list with official colours and difficulty tiers |
| `tools/add-logos.js` | Merges SVGs from `tools/logos-src/` into `logos.js` (`npm run logos`) |
| `tools/svg-to-mark.js` | Turns a real-world SVG into a flat, re-tintable mark |
| `tools/wanted.js` | Brands the game wants but has no artwork for yet |

Clients poll `/api/game` about once a second rather than using WebSockets, which keeps
the whole thing inside Vercel's serverless model with no persistent connections.

### About the logos

Every one of the 91 marks in `logos.js` is the brand's **actual logo** — exact vector
outlines, flattened so the whole mark re-tints as one piece when the sliders move. The
token `CURRENT` is swapped for the player's colour at render time, and nothing in a mark
keeps a colour of its own.

There are no approximations and no part-tinted marks: **a brand either has real artwork
or it isn't in the game.** `npm test` fails if a row in `api/_brands.js` has no mark, so
the two files can't drift apart.

Artwork comes from two places, inlined so the game ships no runtime dependency:

- [simple-icons](https://github.com/simple-icons/simple-icons) (CC0-1.0) for 82 of them.
  Newer releases have dropped a number of consumer brands, so 67 marks come from 16.x and
  the remaining 15 from 13.x, 11.x and 9.x.
- [theSVG](https://thesvg.org) (MIT) for the rest — brands simple-icons has never
  carried, found by searching all 241 Iconify collections.

The logos themselves remain trademarks of their respective owners; the game names each
brand out loud and uses its mark to ask you about that brand.

Not every logo survives being flattened to one colour. A mark whose identity is a white
wordmark on a solid field — LEGO, The Home Depot, Fanta, Costco — becomes a plain
rectangle once the whole shape takes a single colour, so those stay out until a version
turns up with the lettering cut out of the shape rather than painted on top.

A mark is either a bare path string — one outline on the 24×24 grid, which is how every
simple-icons mark arrives — or a `[viewBox, markup]` pair for artwork that needs several
shapes or a different grid. That second form is what logos from outside simple-icons
use.

### Adding a brand simple-icons doesn't carry

simple-icons covers 82 brands here and has never carried the rest. `tools/wanted.js` is
the standing list of what's still missing — Barbie, Oreo, Rolex, Petronas, Touch 'n Go
and two dozen others — with the colour and tier each one needs, and a note on the four
whose artwork exists but doesn't survive flattening.

Drop the logo into `tools/logos-src/<Brand Name>.svg` and run:

```bash
npm i -D @xmldom/xmldom     # once
npm run logos               # add --check to preview without writing
```

`tools/svg-to-mark.js` keeps the geometry and the transforms, throws away every paint,
and writes `CURRENT` where the player's colour goes — so gradients, CSS classes, inline
fills and stroke colours all collapse into one tintable shape. Anything it can't convert
honestly (embedded bitmaps, live text, `<use>` references) is **reported rather than
dropped in silence**, because a logo missing half its shapes still renders, just wrongly.
`npm run logos` only ever adds or replaces marks, so it can't wipe the simple-icons
table. It then prints the row to paste into `api/_brands.js` — a brand isn't in the game
until that row exists.

`tools/logos-src/README.md` covers what makes a good source file, and how to check
licensing on Wikimedia Commons.

Watch for name collisions when hunting for Malaysian brands: simple-icons' `KTM` is the
Austrian motorcycle firm, `Proton` is the Swiss email company, `Astro` is the JavaScript
framework and `Boost` is the US carrier — none of them the Malaysian brand of the same
name.

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
