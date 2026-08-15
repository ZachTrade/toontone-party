// Shared helpers: Upstash Redis REST client, colour maths, scoring, round building.
const { BRANDS } = require('./_brands.js');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

/** True once both Upstash environment variables are present. */
function isConfigured() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

async function redisCall(body) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`redis ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

/** Run a single command, e.g. cmd('GET', 'key'). Returns the raw result. */
async function cmd(...args) {
  const json = await redisCall(args.map(String));
  if (json && json.error) throw new Error(`redis: ${json.error}`);
  return json ? json.result : null;
}

/** Run several commands in one round trip. Returns an array of results. */
async function pipeline(cmds) {
  if (!cmds.length) return [];
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmds.map((c) => c.map(String))),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`redis ${res.status}: ${JSON.stringify(json)}`);
  return json.map((r) => {
    if (r.error) throw new Error(`redis: ${r.error}`);
    return r.result;
  });
}

// ---------------------------------------------------------------- colour

function hexToHsb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return {
    h: Math.round(hue),
    s: Math.round(max === 0 ? 0 : (d / max) * 100),
    b: Math.round(max * 100),
  };
}

/**
 * Score a guess out of 10.
 *
 * Hue carries most of the weight and also scales the whole score, so landing
 * the wrong colour family can't be rescued by nailing saturation and
 * brightness. Near-grey and near-black targets are the exception: their hue is
 * close to meaningless, so it neither carries weight nor scales anything.
 */
function scoreGuess(target, guess) {
  let dh = Math.abs(target.h - guess.h) % 360;
  if (dh > 180) dh = 360 - dh;
  const ah = 1 - dh / 180;
  const as = 1 - Math.abs(target.s - guess.s) / 100;
  const ab = 1 - Math.abs(target.b - guess.b) / 100;

  const pow = (x, e) => Math.pow(Math.max(0, x), e);
  const hueIsMoot = target.s < 15 || target.b < 12;

  let raw;
  if (hueIsMoot) {
    raw = 0.15 * pow(ah, 2.2) + 0.85 * (0.45 * pow(as, 1.8) + 0.55 * pow(ab, 1.8));
  } else {
    const inner =
      0.55 * pow(ah, 2.2) + 0.45 * (0.55 * pow(as, 1.8) + 0.45 * pow(ab, 1.8));
    raw = inner * (0.55 + 0.45 * pow(ah, 0.9));
  }
  return Math.round(raw * 1000) / 100; // 0.00 – 10.00
}

// ---------------------------------------------------------------- rounds

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick `count` rounds with a spread of difficulty and no repeated brand. */
function buildRounds(count = 5) {
  const wanted = [1, 1, 2, 2, 3];
  while (wanted.length < count) wanted.push(2);
  const pools = { 1: shuffle(BRANDS.filter((x) => x.tier === 1)), 2: shuffle(BRANDS.filter((x) => x.tier === 2)), 3: shuffle(BRANDS.filter((x) => x.tier === 3)) };
  const usedBrands = new Set();
  const picked = [];

  for (const tier of wanted.slice(0, count)) {
    let choice = null;
    for (const t of [tier, 2, 1, 3]) {
      choice = pools[t].find((x) => !usedBrands.has(x.brand));
      if (choice) {
        pools[t] = pools[t].filter((x) => x !== choice);
        break;
      }
    }
    if (!choice) continue;
    usedBrands.add(choice.brand);
    const hsb = hexToHsb(choice.hex);
    picked.push({
      brand: choice.brand,
      element: choice.element,
      emoji: choice.emoji,
      hex: choice.hex,
      h: hsb.h,
      s: hsb.s,
      b: hsb.b,
    });
  }
  return shuffle(picked);
}

// ---------------------------------------------------------------- daily

// The day rolls over at midnight Malaysia time rather than UTC, so "today's
// logo" changes overnight for the people actually playing it instead of
// mid-morning. One number to change if that ever needs to move.
const DAY_OFFSET_MINUTES = 8 * 60;

/** The YYYY-MM-DD a moment belongs to, in the offset above. */
function dayKey(now) {
  const at = now == null ? Date.now() : now;
  return new Date(at + DAY_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fixed permutation of 0..n-1 — same seed, same order, on every machine. */
function seededOrder(n, seed) {
  const rnd = mulberry32(hashString(seed));
  const a = [];
  for (let i = 0; i < n; i++) a.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/**
 * Today's prompt, identical for everyone.
 *
 * Nothing random happens per request: the whole prompt list is shuffled once by
 * a fixed seed, and the day walks one step along it. So every player on a given
 * date gets the same logo, and no prompt comes back until every other one has
 * had its turn.
 */
function dailyPrompt(key) {
  const order = seededOrder(BRANDS.length, 'toontone-daily-v1');
  const dayNumber = Math.floor(Date.parse(key + 'T00:00:00Z') / 86400000);
  // JS % keeps the sign, and dates before 1970 would otherwise index backwards.
  const step = ((dayNumber % BRANDS.length) + BRANDS.length) % BRANDS.length;
  const pick = BRANDS[order[step]];
  const hsb = hexToHsb(pick.hex);
  return {
    day: key,
    brand: pick.brand,
    element: pick.element,
    emoji: pick.emoji,
    hex: pick.hex,
    h: hsb.h,
    s: hsb.s,
    b: hsb.b,
  };
}

// ---------------------------------------------------------------- misc

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
function randomCode(len = 4) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function randomId() {
  let out = '';
  for (let i = 0; i < 16; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

module.exports = {
  cmd,
  pipeline,
  isConfigured,
  hexToHsb,
  scoreGuess,
  buildRounds,
  randomCode,
  randomId,
  shuffle,
  dayKey,
  dailyPrompt,
};
