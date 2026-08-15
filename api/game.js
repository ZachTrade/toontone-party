// Room API for Toon Tone Party. One endpoint, `op` selects the action.
const {
  cmd,
  pipeline,
  isConfigured,
  scoreGuess,
  buildRounds,
  randomCode,
  randomId,
  dayKey,
  dailyPrompts,
  DAILY_LOGOS,
} = require('./_lib.js');

const GUESS_MS = 45000; // time to lock in a colour
const REVEAL_MS = 9000; // time spent on the reveal screen
const TTL = 7200; // rooms live 2 hours
const MAX_PLAYERS = 12;
const TOTAL_ROUNDS = 5;
const ACTIVE_MS = 25000; // a player counts as present if seen this recently

const DAILY_TTL = 3 * 24 * 3600; // today's board plus a couple of days of history
const DAILY_BOARD_MAX = 100; // how much of the board to send down

const kRoom = (c) => `tt:${c}`;
const kDaily = (d) => `tt:d:${d}`;
const kDailyPrompt = (d) => `tt:d:${d}:p`;
const kPlayers = (c) => `tt:${c}:p`;
const kRound = (c, g, n) => `tt:${c}:g${g}:r${n}`;
const kDone = (c, g, n) => `tt:${c}:g${g}:r${n}:done`;
const kAdv = (c, g, n) => `tt:${c}:g${g}:a${n}`;
const kTotals = (c, g) => `tt:${c}:g${g}:z`;

function clean(str, max) {
  return String(str == null ? '' : str)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

function num(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

async function loadRoom(code) {
  const raw = await cmd('GET', kRoom(code));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function saveRoom(room) {
  await cmd('SET', kRoom(room.code), JSON.stringify(room), 'EX', TTL);
}

function parsePlayers(hash) {
  // Upstash returns a flat [field, value, ...] array for HGETALL.
  const out = {};
  if (!hash) return out;
  if (Array.isArray(hash)) {
    for (let i = 0; i < hash.length; i += 2) {
      try {
        out[hash[i]] = JSON.parse(hash[i + 1]);
      } catch {
        /* ignore malformed entry */
      }
    }
  } else if (typeof hash === 'object') {
    for (const [k, v] of Object.entries(hash)) {
      try {
        out[k] = typeof v === 'string' ? JSON.parse(v) : v;
      } catch {
        /* ignore */
      }
    }
  }
  return out;
}

function parseZset(list) {
  const out = {};
  if (!Array.isArray(list)) return out;
  for (let i = 0; i < list.length; i += 2) {
    out[list[i]] = Number(list[i + 1]) / 100;
  }
  return out;
}

// ------------------------------------------------------------------ state

/**
 * Load everything a client needs, advancing the round clock when it has run
 * out. Advancing is guarded by a Redis NX lock so concurrent pollers can't
 * skip a round between them.
 */
async function getState(code, pid, touch) {
  let room = await loadRoom(code);
  if (!room) return { error: 'no_room' };

  const now = Date.now();
  if (touch && pid) {
    const players = parsePlayers(await cmd('HGETALL', kPlayers(code)));
    if (players[pid]) {
      players[pid].seen = now;
      await pipeline([
        ['HSET', kPlayers(code), pid, JSON.stringify(players[pid])],
        ['EXPIRE', kPlayers(code), String(TTL)],
      ]);
    }
  }

  // Resolve the phase, advancing up to TOTAL_ROUNDS times if a client has been
  // away long enough for several rounds to have elapsed.
  let phase = 'lobby';
  let endsAt = null;
  let doneAt = null;

  for (let guard = 0; guard <= TOTAL_ROUNDS + 1; guard++) {
    if (room.status !== 'playing') {
      phase = room.status === 'ended' ? 'ended' : 'lobby';
      break;
    }
    const n = room.round;
    const g = room.gameId;
    const doneRaw = await cmd('GET', kDone(code, g, n));
    const guessEndsAt = room.roundStartedAt + GUESS_MS;
    let revealStart = null;
    if (doneRaw) revealStart = Math.min(Number(doneRaw), guessEndsAt);
    else if (Date.now() >= guessEndsAt) revealStart = guessEndsAt;

    if (revealStart == null) {
      phase = 'guess';
      endsAt = guessEndsAt;
      break;
    }

    const revealEndsAt = revealStart + REVEAL_MS;
    if (Date.now() < revealEndsAt) {
      phase = 'reveal';
      endsAt = revealEndsAt;
      doneAt = revealStart;
      break;
    }

    // Round is over — try to be the one that moves the room forward.
    const got = await cmd('SET', kAdv(code, g, n), '1', 'NX', 'EX', '120');
    if (got) {
      if (n < (room.totalRounds || TOTAL_ROUNDS)) {
        room.round = n + 1;
        room.roundStartedAt = Date.now();
      } else {
        room.status = 'ended';
        room.endedAt = Date.now();
      }
      await saveRoom(room);
    } else {
      const fresh = await loadRoom(code);
      if (!fresh) return { error: 'no_room' };
      if (fresh.round === room.round && fresh.status === room.status) {
        // Lock holder hasn't written yet; show the reveal a moment longer.
        phase = 'reveal';
        endsAt = revealEndsAt;
        doneAt = revealStart;
        break;
      }
      room = fresh;
    }
  }

  const players = parsePlayers(await cmd('HGETALL', kPlayers(code)));
  const gameId = room.gameId;
  const totals = parseZset(
    await cmd('ZRANGE', kTotals(code, gameId), '0', '-1', 'REV', 'WITHSCORES')
  );

  const out = {
    ok: true,
    now: Date.now(),
    code: room.code,
    status: room.status,
    phase,
    endsAt,
    round: room.round,
    totalRounds: room.totalRounds || TOTAL_ROUNDS,
    gameId,
    hostId: room.hostId,
    guessMs: GUESS_MS,
  };

  // Whoever joined first and is still around can start the game, so a room
  // isn't stranded when the original host closes their tab.
  const order = Object.entries(players).sort(
    (a, b) => (a[1].joined || 0) - (b[1].joined || 0)
  );
  const active = order.filter(([, p]) => now - (p.seen || 0) < ACTIVE_MS);
  out.actingHostId = players[room.hostId] && now - (players[room.hostId].seen || 0) < ACTIVE_MS
    ? room.hostId
    : (active[0] || order[0] || [null])[0];

  let submissions = {};
  if (room.status === 'playing') {
    submissions = parsePlayers(await cmd('HGETALL', kRound(code, gameId, room.round)));
  }

  out.players = order.map(([id, p]) => {
    const sub = submissions[id];
    const entry = {
      pid: id,
      name: p.name,
      active: now - (p.seen || 0) < ACTIVE_MS,
      total: Math.round((totals[id] || 0) * 100) / 100,
      submitted: !!sub,
    };
    if (sub && phase !== 'guess') {
      entry.guess = { h: sub.h, s: sub.s, b: sub.b };
      entry.score = sub.score;
    }
    return entry;
  });

  if (room.status === 'playing') {
    const r = room.rounds[room.round - 1];
    out.prompt = { brand: r.brand, element: r.element, emoji: r.emoji };
    out.mySubmission = submissions[pid]
      ? { h: submissions[pid].h, s: submissions[pid].s, b: submissions[pid].b }
      : null;
    if (phase === 'reveal') {
      out.target = { h: r.h, s: r.s, b: r.b, hex: r.hex };
    }
  }

  if (room.status === 'ended') {
    const cmds = [];
    for (let n = 1; n <= (room.totalRounds || TOTAL_ROUNDS); n++) {
      cmds.push(['HGETALL', kRound(code, gameId, n)]);
    }
    const all = await pipeline(cmds);
    out.recap = room.rounds.map((r, i) => {
      const subs = parsePlayers(all[i]);
      return {
        brand: r.brand,
        element: r.element,
        emoji: r.emoji,
        hex: r.hex,
        target: { h: r.h, s: r.s, b: r.b },
        results: Object.entries(subs).map(([id, s]) => ({
          pid: id,
          score: s.score,
          guess: { h: s.h, s: s.s, b: s.b },
        })),
      };
    });
  }

  return out;
}

// ------------------------------------------------------------------ ops

async function opCreate(body) {
  const name = clean(body.name, 16) || 'Player';
  let code = null;
  for (let i = 0; i < 6; i++) {
    const candidate = randomCode(4);
    const got = await cmd('SET', kRoom(candidate), '{}', 'NX', 'EX', String(TTL));
    if (got) {
      code = candidate;
      break;
    }
  }
  if (!code) return { error: 'no_code' };

  const pid = randomId();
  const now = Date.now();
  const room = {
    code,
    hostId: pid,
    status: 'lobby',
    gameId: 1,
    round: 0,
    roundStartedAt: 0,
    rounds: [],
    totalRounds: TOTAL_ROUNDS,
    createdAt: now,
  };
  await pipeline([
    ['SET', kRoom(code), JSON.stringify(room), 'EX', String(TTL)],
    ['HSET', kPlayers(code), pid, JSON.stringify({ name, joined: now, seen: now })],
    ['EXPIRE', kPlayers(code), String(TTL)],
  ]);
  return { ok: true, code, pid, name };
}

async function opJoin(body) {
  const code = clean(body.code, 8).toUpperCase();
  const name = clean(body.name, 16) || 'Player';
  const room = await loadRoom(code);
  if (!room || !room.code) return { error: 'no_room' };

  const players = parsePlayers(await cmd('HGETALL', kPlayers(code)));
  const existing = body.pid && players[clean(body.pid, 32)];
  const now = Date.now();

  if (existing) {
    const pid = clean(body.pid, 32);
    existing.name = name;
    existing.seen = now;
    await cmd('HSET', kPlayers(code), pid, JSON.stringify(existing));
    return { ok: true, code, pid, name };
  }

  if (Object.keys(players).length >= MAX_PLAYERS) return { error: 'full' };

  const pid = randomId();
  await pipeline([
    ['HSET', kPlayers(code), pid, JSON.stringify({ name, joined: now, seen: now })],
    ['EXPIRE', kPlayers(code), String(TTL)],
  ]);
  return { ok: true, code, pid, name };
}

async function opStart(body, { again }) {
  const code = clean(body.code, 8).toUpperCase();
  const pid = clean(body.pid, 32);
  const room = await loadRoom(code);
  if (!room || !room.code) return { error: 'no_room' };

  const state = await getState(code, pid, false);
  if (state.actingHostId && state.actingHostId !== pid) return { error: 'not_host' };
  if (!again && room.status === 'playing') return { ok: true };

  const fresh = await loadRoom(code);
  if (again) fresh.gameId = (fresh.gameId || 1) + 1;
  fresh.rounds = buildRounds(TOTAL_ROUNDS);
  fresh.totalRounds = fresh.rounds.length;
  fresh.status = 'playing';
  fresh.round = 1;
  fresh.roundStartedAt = Date.now();
  await saveRoom(fresh);
  return { ok: true };
}

async function opSubmit(body) {
  const code = clean(body.code, 8).toUpperCase();
  const pid = clean(body.pid, 32);
  const h = num(body.h, 0, 359);
  const s = num(body.s, 0, 100);
  const b = num(body.b, 0, 100);
  if (h == null || s == null || b == null) return { error: 'bad_guess' };

  const room = await loadRoom(code);
  if (!room || !room.code) return { error: 'no_room' };
  if (room.status !== 'playing') return { error: 'not_playing' };

  const n = room.round;
  const g = room.gameId;
  if (Date.now() > room.roundStartedAt + GUESS_MS + 1500) return { error: 'too_late' };

  const target = room.rounds[n - 1];
  const score = scoreGuess(target, { h, s, b });
  const entry = JSON.stringify({ h, s, b, score, at: Date.now() });

  // HSETNX keeps the first answer, so a double tap can't re-score a round.
  const first = await cmd('HSETNX', kRound(code, g, n), pid, entry);
  if (!first) return { ok: true, already: true };

  await pipeline([
    ['EXPIRE', kRound(code, g, n), String(TTL)],
    ['ZINCRBY', kTotals(code, g), String(Math.round(score * 100)), pid],
    ['EXPIRE', kTotals(code, g), String(TTL)],
  ]);

  // If everyone still present has answered, cut the timer short.
  const now = Date.now();
  const players = parsePlayers(await cmd('HGETALL', kPlayers(code)));
  const activeCount = Object.values(players).filter(
    (p) => now - (p.seen || 0) < ACTIVE_MS
  ).length;
  const answered = Number(await cmd('HLEN', kRound(code, g, n))) || 0;
  if (answered >= Math.max(1, activeCount)) {
    await cmd('SET', kDone(code, g, n), String(Date.now()), 'NX', 'EX', String(TTL));
  }
  return { ok: true, score };
}

// ------------------------------------------------------------------ daily

/**
 * A day's prompts, pinned in Redis the first time anyone asks for them.
 *
 * `dailyPrompts` is already deterministic, but it derives from the brand list —
 * so a deploy that adds a brand would shift the answers for everyone who hasn't
 * played yet, scoring them against different colours than their friends.
 * Pinning means the day's targets are fixed by whoever plays first.
 */
async function loadDailyPrompts(day) {
  const parse = (raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw);
  const existing = await cmd('GET', kDailyPrompt(day));
  // A day pinned before the run grew to three logos would come back as one
  // object rather than a list; treat anything unexpected as unpinned.
  const usable = (v) => Array.isArray(v) && v.length === DAILY_LOGOS;
  if (existing) {
    const parsed = parse(existing);
    if (usable(parsed)) return parsed;
  }

  const fresh = dailyPrompts(day);
  await cmd('SET', kDailyPrompt(day), JSON.stringify(fresh), 'EX', String(DAILY_TTL));
  // Re-read rather than trusting our own write: if two players arrived at once,
  // the loser has to use the winner's prompts, not its own.
  const settled = await cmd('GET', kDailyPrompt(day));
  const parsed = settled ? parse(settled) : null;
  return usable(parsed) ? parsed : fresh;
}

/** Field name for one player's answer to one logo. */
const dailyField = (pid, i) => `${pid}#${i}`;

/** Roll the flat "<pid>#<i>" hash up into one row per player. */
function dailyBoard(entries, pid) {
  const byPlayer = new Map();
  for (const [field, e] of Object.entries(entries)) {
    const id = field.slice(0, field.lastIndexOf('#'));
    if (!id) continue;
    const row = byPlayer.get(id) || { pid: id, name: e.name, total: 0, done: 0, at: 0 };
    row.total += e.score || 0;
    row.done += 1;
    row.name = e.name || row.name;
    row.at = Math.max(row.at, e.at || 0);
    byPlayer.set(id, row);
  }

  const rows = [...byPlayer.values()]
    .map((r) => ({ ...r, total: Math.round(r.total * 100) / 100 }))
    // Ties break towards whoever finished first.
    .sort((a, b) => b.total - a.total || a.at - b.at);

  const rank = rows.findIndex((r) => r.pid === pid);
  return {
    board: rows.slice(0, DAILY_BOARD_MAX).map((r, i) => ({
      rank: i + 1,
      name: r.name,
      total: r.total,
      done: r.done,
      you: r.pid === pid,
    })),
    myRank: rank === -1 ? null : rank + 1,
    players: rows.length,
  };
}

async function opDaily(body) {
  const pid = clean(body.pid, 32);
  const day = dayKey();
  const prompts = await loadDailyPrompts(day);
  const entries = parsePlayers(await cmd('HGETALL', kDaily(day)));

  // Answers are one-per-index, so how many exist is how far along they are.
  const answers = [];
  for (let i = 0; i < prompts.length; i++) {
    const e = pid ? entries[dailyField(pid, i)] : null;
    if (!e) break;
    answers.push(e);
  }
  const index = answers.length;
  const finished = index >= prompts.length;

  const out = {
    ok: true,
    now: Date.now(),
    day,
    total: prompts.length,
    index,
    finished,
    // Only the answered logos come back with their colour attached — an
    // unplayed target sent to the client is the answer sitting in devtools.
    results: answers.map((e, i) => ({
      brand: prompts[i].brand,
      element: prompts[i].element,
      emoji: prompts[i].emoji,
      target: { h: prompts[i].h, s: prompts[i].s, b: prompts[i].b, hex: prompts[i].hex },
      mine: { h: e.h, s: e.s, b: e.b, score: e.score },
    })),
    myTotal: Math.round(answers.reduce((sum, e) => sum + (e.score || 0), 0) * 100) / 100,
    ...dailyBoard(entries, pid),
  };
  // The emoji hints at the colour, so the current logo ships without one.
  if (!finished) {
    out.prompt = { brand: prompts[index].brand, element: prompts[index].element, index };
  }
  return out;
}

async function opDailySubmit(body) {
  const pid = clean(body.pid, 32);
  const name = clean(body.name, 16) || 'Player';
  const h = num(body.h, 0, 359);
  const s = num(body.s, 0, 100);
  const b = num(body.b, 0, 100);
  if (!pid) return { error: 'bad_player' };
  if (h == null || s == null || b == null) return { error: 'bad_guess' };

  const day = dayKey();
  const prompts = await loadDailyPrompts(day);
  const entries = parsePlayers(await cmd('HGETALL', kDaily(day)));

  // Which logo this answers is counted server-side, never taken from the
  // request — otherwise a crafted index could overwrite or skip a logo.
  let index = 0;
  while (index < prompts.length && entries[dailyField(pid, index)]) index++;
  if (index >= prompts.length) {
    const done = await opDaily({ pid });
    return { ...done, already: true };
  }

  const prompt = prompts[index];
  const score = scoreGuess(prompt, { h, s, b });
  const entry = JSON.stringify({ name, h, s, b, score, at: Date.now() });

  // One shot per logo: HSETNX keeps the first answer, so a reload or a second
  // tab can't be used to fish for a better score.
  const first = await cmd('HSETNX', kDaily(day), dailyField(pid, index), entry);
  if (first) await cmd('EXPIRE', kDaily(day), String(DAILY_TTL));

  const state = await opDaily({ pid });
  return { ...state, already: !first };
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isConfigured()) {
    return res.status(503).json({ error: 'not_configured' });
  }
  try {
    const url = new URL(req.url, 'http://x');
    const query = Object.fromEntries(url.searchParams.entries());
    const body = req.method === 'POST' ? { ...query, ...(await readBody(req)) } : query;
    const op = clean(body.op, 16);

    let result;
    switch (op) {
      case 'create':
        result = await opCreate(body);
        break;
      case 'join':
        result = await opJoin(body);
        break;
      case 'start':
        result = await opStart(body, { again: false });
        break;
      case 'again':
        result = await opStart(body, { again: true });
        break;
      case 'submit':
        result = await opSubmit(body);
        break;
      case 'daily':
        result = await opDaily(body);
        break;
      case 'dailySubmit':
        result = await opDailySubmit(body);
        break;
      case 'state':
        result = await getState(
          clean(body.code, 8).toUpperCase(),
          clean(body.pid, 32),
          true
        );
        break;
      default:
        result = { error: 'bad_op' };
    }

    res.status(result && result.error ? 400 : 200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'server', detail: String(err && err.message) });
  }
};
