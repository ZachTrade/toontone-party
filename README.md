# Toon Tone Party

A multiplayer brand-colour guessing game. Each round names a famous brand and one
specific element of it — the golden arches, the siren green, AirAsia red — and
shows **the brand's actual logo**, drained of colour. Everyone rebuilds the shade from
memory on hue / saturation / brightness sliders, **and the logo repaints itself live as
you drag**, so you're judging the colour on the real mark rather than an abstract
swatch. Closest guess wins the round.

Five rounds, up to 12 players per room, live leaderboard, podium at the end. Room wins
bank points and gold medals on an all-time board, and a daily challenge gives everyone
the same three logos.

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

## Names

Everyone claims a name once, locked with a 4-digit PIN, and it becomes their name
everywhere — rooms and the daily board. Nothing asks you to type a name again, and
nobody else can play as you.

One form does both jobs: a free name is claimed with the PIN you give, a taken one has
to match it. Signing in returns a token that the browser keeps for six months, and
**names always come from that token, never from the request** — otherwise anyone could
put anyone's name on the board.

A 4-digit PIN is 10,000 possibilities, so:

- PINs are stored as a salted PBKDF2 hash (120k rounds), never in the clear. That
  doesn't make a 4-digit secret strong — it makes one leaked database expensive to
  unpick rather than instant.
- **A name locks for fifteen minutes after 8 wrong PINs**, which is the part that
  actually stops guessing.

This is a party game: it keeps friends from taking each other's names, and it isn't
trying to survive a determined attacker.

## How a game runs

1. Someone taps **Create a room** and gets a 4-character code plus a share link.
2. Friends open the link (or type the code) and appear in the lobby under their
   claimed name.
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

**Three logos a day, the same three for everybody, highest total wins.** No room and no
timer — but **one attempt per logo**, which is what makes the score worth anything. Best
possible day is 30.00.

- **Same logos for everyone.** Nothing random happens per request. The prompt list is
  shuffled once by a fixed seed and each day walks three steps along it, so every player
  on a date gets the same brands in the same order, no logo repeats inside a day, and
  none returns until all 94 have had a turn.
- **The targets are pinned on first play.** `dailyPrompts` derives from the brand list,
  so a deploy that adds a brand would otherwise shift the answers mid-day and score
  latecomers against different colours than their friends. The day's first request
  writes the run to Redis; everyone after reads that.
- **One shot per logo.** Answers are stored per player per index with `HSETNX`, so a
  reload, a second tab or a re-submit can't fish for a better score. Which logo a
  submission answers is counted server-side and never taken from the request, so a
  crafted index can't overwrite or skip one.
- **Unplayed answers never reach the client.** Only logos you've already done come back
  with their colour attached — an unplayed target in the JSON is the answer sitting in
  devtools. The emoji is withheld too, since a coloured one gives the game away.
- **The day rolls over at midnight Malaysia time** (UTC+8), not UTC, so today's set
  changes overnight for the people playing rather than mid-morning. It's one constant,
  `DAY_OFFSET_MINUTES` in `api/_lib.js`. `DAILY_LOGOS` sets how many.

The board ranks on the accumulated total and marks anyone still mid-run (`2/3`), so it
reads honestly through the day.

Boards key on the claimed name, so the same person on a phone and a laptop is one
player rather than two.

Boards are kept for three days.

## Home

Three tabs rather than one long scroll: **Daily challenge** (with today's standings
under it), **PVP** (create or join a room) and **Leaderboard**. The tab you were last on is remembered for the session, so
coming back from a game lands where you left off. The pitch at the top is onboarding
copy — once you've claimed a name it disappears, leaving the tabs at the top of the
screen.

## All-time board

The **Leaderboard** tab holds both boards, as sub-tabs: **Today** (the daily challenge)
and **All-time** — wins, points and games across finished room games. Today's board
deliberately appears in two places — under the daily challenge where it's immediately
relevant, and here so the leaderboard is one place to find every board. Both copies are
filled from a single render.

**Points scale with the room.** In an N-player game first takes N points, second N-1,
down to 1 for last. Winning a six-player room is worth more than winning a pair, and
turning up for a game you lose still beats not playing.

First place also takes a **🥇**, and the board shows how many each player has
accumulated. Ranking is points, then medals, then fewest games — so a good win rate
beats grinding the same total out of twice as many games.

Two guards on the numbers:

- **Solo games don't count.** Otherwise you could mint a gold every five rounds by
  playing alone. The final screen says so rather than looking broken.
- **A game is banked exactly once.** Crediting happens in the single place that ends a
  game — whoever wins the round-advance lock — behind its own `SET NX` key, so a dozen
  clients polling as the last round expires can't credit it a dozen times.

Only claimed names are banked, since a name is where a result gets stored. Ties share
the place and both tied winners take gold.

## What the reveal shows

The reveal gives you the real colour beside yours as a swatch, the same logo tinted both
ways, and each colour's **hex** — but not its H/S/B numbers. Those map one-to-one onto
the sliders, so printing them would let anyone note a brand down once and dial it in
exactly ever after. The hex still tells you the answer without handing over slider
positions. This applies to both the room game and the daily challenge.

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
| `api/game.js` | The one API endpoint; `op` selects identify / whoami / create / join / start / submit / state / career / daily / dailySubmit |
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

**Restart `npm run dev` before each `test:ui` run.** The stand-in Redis is in-memory and
the dev server is long-lived, so a second run against the same server finds its players
already claimed and their daily runs already finished.
