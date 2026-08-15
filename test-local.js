// Local smoke test: runs the serverless handler over a real HTTP server and
// plays a full game with three players.
const http = require('http');
// See dev-server.js: an empty base URL would make the stand-in swallow the
// test's own HTTP calls too, so give it something specific to match on.
process.env.UPSTASH_REDIS_REST_URL ||= 'http://fake-redis.local';
process.env.UPSTASH_REDIS_REST_TOKEN ||= 'local-dev';
require('./fake-redis.js').install(process.env.UPSTASH_REDIS_REST_URL);
const handler = require('./api/game.js');
const { scoreGuess, hexToHsb, buildRounds } = require('./api/_lib.js');

const server = http.createServer((req, res) => {
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };
  res.status = (c) => { res.statusCode = c; return res; };
  handler(req, res);
});

const PORT = 5599;
const call = async (op, extra) => {
  const r = await fetch(`http://127.0.0.1:${PORT}/api/game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op, ...extra }),
  });
  return r.json();
};

let failures = 0;
function check(label, cond, detail) {
  const mark = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`  [${mark}] ${label}${detail && !cond ? ' — ' + detail : ''}`);
}

async function main() {
  console.log('\n== pure functions ==');
  const red = hexToHsb('#FF0000');
  check('hexToHsb(#FF0000) = H0 S100 B100', red.h === 0 && red.s === 100 && red.b === 100, JSON.stringify(red));
  const sb = hexToHsb('#00704A');
  check('hexToHsb(#00704A) plausible green', sb.h > 140 && sb.h < 175 && sb.s === 100, JSON.stringify(sb));
  check('perfect guess scores 10', scoreGuess({ h: 40, s: 80, b: 90 }, { h: 40, s: 80, b: 90 }) === 10);
  check('opposite hue scores low', scoreGuess({ h: 0, s: 100, b: 100 }, { h: 180, s: 0, b: 0 }) < 0.5);
  const near = scoreGuess({ h: 40, s: 80, b: 90 }, { h: 46, s: 74, b: 86 });
  check('near guess scores 8-10', near > 8 && near < 10, String(near));
  const rounds = buildRounds(5);
  check('5 rounds built', rounds.length === 5, String(rounds.length));
  check('no repeated brand', new Set(rounds.map((r) => r.brand)).size === 5);
  check('rounds carry hsb', rounds.every((r) => Number.isFinite(r.h) && Number.isFinite(r.s)));

  console.log('\n== logo marks ==');
  // logos.js attaches to `window` in the browser and to globalThis here.
  require('./logos.js');
  const { BRANDS } = require('./api/_brands.js');
  // Every brand on the list has to have real artwork — no stand-ins.
  const noMark = BRANDS.filter((b) => !ToonLogos.has(b.brand));
  check('every brand has real logo artwork', noMark.length === 0,
    noMark.map((b) => b.brand).join(', '));
  const SENTINEL = 'rgb(1,2,3)';
  const svg = ToonLogos.logoSvg('Spotify', SENTINEL);
  check('mark tints with the given colour', svg.includes(SENTINEL) && !svg.includes('CURRENT'));
  check('mark is a real outline, not an initials tile',
    svg.includes('<path') && !svg.includes('<text'));

  // Every shape has to follow the sliders. A mark that kept a colour of its own
  // — a leftover hex, a gradient reference — would sit there ignoring the
  // player, which is exactly what a bad SVG conversion leaves behind.
  const leaky = BRANDS.filter((b) => {
    const s = ToonLogos.logoSvg(b.brand, SENTINEL).split(SENTINEL).join('');
    return /#[0-9a-fA-F]{3,8}\b|url\(|rgb\(|hsl\(|\b(?:fill|stroke)="(?!none")[a-z]/i.test(s);
  });
  check('no mark keeps a colour of its own', leaky.length === 0,
    leaky.map((b) => b.brand).join(', '));
  check('no mark leaves an unsubstituted CURRENT',
    !BRANDS.some((b) => ToonLogos.logoSvg(b.brand, SENTINEL).includes('CURRENT')));

  // The SVG converter is what lets real artwork in, so check it strips the
  // things logos in the wild are full of. Skipped when the parser isn't
  // installed, since it's only needed to add marks, never to play.
  let convert = null;
  try { ({ convert } = require('./tools/svg-to-mark.js')); } catch { /* dev-only */ }
  if (!convert) {
    console.log('  [SKIP] svg converter (npm i -D @xmldom/xmldom to cover it)');
  } else {
    const messy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 20">
      <defs><linearGradient id="g"/></defs><style>.a{fill:#0f0}</style>
      <g transform="translate(2,2)">
        <path class="a" fill="url(#g)" fill-rule="evenodd" d="M0 0h9v9H0z"/>
        <circle cx="20" cy="8" r="5" style="fill:#123456"/>
      </g>
      <path d="M0 18h50" fill="none" stroke="#000" stroke-width="3"/>
      <text x="1" y="9">no</text></svg>`;
    const m = convert(messy, { name: 'messy.svg' });
    check('converter keeps the viewBox', m.viewBox === '0 0 50 20', m.viewBox);
    check('converter keeps every shape', m.shapes === 3, String(m.shapes));
    check('converter keeps group transforms', m.inner.includes('translate(2,2)'));
    check('converter keeps fill-rule, so holes survive', m.inner.includes('fill-rule="evenodd"'));
    check('converter keeps stroke-only shapes visible',
      m.inner.includes('stroke="CURRENT"') && m.inner.includes('stroke-width="3"'));
    check('converter strips gradients, classes and inline colours',
      !/#[0-9a-fA-F]{3,6}|url\(|class=/.test(m.inner), m.inner.slice(0, 90));
    check('converter reports what it had to drop',
      m.warnings.some((w) => /text/i.test(w)), m.warnings.join('; '));
  }

  console.log('\n== daily challenge ==');
  const { dayKey, dailyPrompts, DAILY_LOGOS } = require('./api/_lib.js');
  // Everyone has to get the same logos, so nothing here may depend on when or
  // where it runs.
  const d1 = dailyPrompts('2026-08-15');
  const d2 = dailyPrompts('2026-08-15');
  check('a day gives a run of logos', d1.length === DAILY_LOGOS, String(d1.length));
  check('same day gives the same run',
    d1.map((p) => p.brand + p.hex).join() === d2.map((p) => p.brand + p.hex).join(),
    d1.map((p) => p.brand).join(', '));
  check('no logo repeats inside a day',
    new Set(d1.map((p) => p.brand + '|' + p.element)).size === DAILY_LOGOS,
    d1.map((p) => p.brand).join(', '));
  const d3 = dailyPrompts('2026-08-16');
  check('the next day moves on',
    d3.map((p) => p.brand).join() !== d1.map((p) => p.brand).join(),
    d3.map((p) => p.brand).join(', '));
  check('every prompt carries a scoreable target',
    d1.every((p) => Number.isFinite(p.h) && Number.isFinite(p.s) && Number.isFinite(p.b) && /^#/.test(p.hex)));
  // Walking a fixed shuffle means no repeat until the list is exhausted.
  const seen = new Set();
  const days = Math.floor(BRANDS.length / DAILY_LOGOS);
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    for (const p of dailyPrompts(day)) seen.add(p.brand + '|' + p.element);
  }
  check('a full cycle never repeats a prompt', seen.size === days * DAILY_LOGOS,
    `${seen.size}/${days * DAILY_LOGOS}`);
  check('dayKey looks like a date', /^\d{4}-\d{2}-\d{2}$/.test(dayKey()), dayKey());
  // Malaysia is UTC+8, so 17:00 UTC is already tomorrow for players there.
  check('the day rolls over at midnight in Malaysia',
    dayKey(Date.UTC(2026, 7, 15, 17, 0)) === '2026-08-16',
    dayKey(Date.UTC(2026, 7, 15, 17, 0)));

  const dA = await call('daily', { pid: 'aaa' });
  check('daily state loads', dA.ok && !!dA.prompt.brand, JSON.stringify(dA.error || ''));
  check('run starts at the first logo', dA.index === 0 && dA.total === DAILY_LOGOS && !dA.finished);
  check('no answers leak before you play',
    dA.results.length === 0 && !dA.prompt.emoji && dA.myTotal === 0);
  check('board starts empty', dA.players === 0 && dA.board.length === 0);

  const first = await call('dailySubmit', { pid: 'aaa', name: 'Zach', h: 40, s: 80, b: 90 });
  check('first guess scored', typeof first.results[0].mine.score === 'number',
    JSON.stringify(first.error || ''));
  check('the run advances', first.index === 1 && !first.finished);
  check('only the played logo reveals its colour',
    first.results.length === 1 && !!first.results[0].target && !!first.results[0].emoji);
  check('the next logo arrives without its answer',
    !!first.prompt.brand && !first.prompt.emoji);

  const midRetry = await call('dailySubmit', { pid: 'aaa', name: 'Zach', h: 111, s: 11, b: 11 });
  check('a resubmit answers the next logo, never rewrites the last',
    midRetry.results[0].mine.h === 40 && midRetry.index === 2, JSON.stringify(midRetry.index));

  const done = await call('dailySubmit', { pid: 'aaa', name: 'Zach', h: 200, s: 60, b: 60 });
  check('three logos finishes the run', done.finished && done.index === DAILY_LOGOS);
  check('no further prompt once finished', !done.prompt);
  const summed = done.results.reduce((t, r) => t + r.mine.score, 0);
  check('total is the sum of the run', Math.abs(done.myTotal - summed) < 0.011,
    `${done.myTotal} vs ${summed}`);
  check('you land on the board with the run total',
    done.players === 1 && done.myRank === 1 && done.board[0].done === DAILY_LOGOS);

  const extra = await call('dailySubmit', { pid: 'aaa', name: 'Zach', h: 0, s: 0, b: 0 });
  check('a fourth guess is refused', extra.already === true && extra.myTotal === done.myTotal);

  // Deliberately awful guesses, so the ordering is unambiguous.
  for (let i = 0; i < DAILY_LOGOS; i++) {
    const t = done.results[i].target;
    await call('dailySubmit', { pid: 'bbb', name: 'Mia', h: (t.h + 180) % 360, s: 5, b: 5 });
  }
  const dBoard = await call('daily', { pid: 'bbb' });
  check('board ranks by accumulated score',
    dBoard.board[0].name === 'Zach' && dBoard.board[1].name === 'Mia',
    dBoard.board.map((r) => r.name + ':' + r.total).join(', '));
  check('board marks who you are',
    dBoard.board.find((r) => r.you).name === 'Mia' && dBoard.myRank === 2);
  check('board shows how far each player got',
    dBoard.board.every((r) => r.done === DAILY_LOGOS));
  check('a player with no guess is off the board',
    (await call('daily', { pid: 'ccc' })).myRank === null);

  // Half-finished runs still show, so the board reads honestly mid-day.
  await call('dailySubmit', { pid: 'ddd', name: 'Sam', h: 10, s: 50, b: 50 });
  const partial = await call('daily', { pid: 'ddd' });
  check('a partial run shows its progress',
    partial.board.find((r) => r.you).done === 1, JSON.stringify(partial.board));

  console.log('\n== room flow ==');
  const host = await call('create', { name: 'Zach' });
  check('room created', !!host.code && !!host.pid, JSON.stringify(host));
  const code = host.code;

  const p2 = await call('join', { code, name: 'Mia' });
  const p3 = await call('join', { code, name: 'Ken' });
  check('two friends joined', !!p2.pid && !!p3.pid, JSON.stringify([p2, p3]));

  const bad = await call('join', { code: 'ZZZZ', name: 'Nobody' });
  check('unknown code rejected', bad.error === 'no_room', JSON.stringify(bad));

  let st = await call('state', { code, pid: host.pid });
  check('lobby state', st.status === 'lobby' && st.players.length === 3, JSON.stringify(st.status));
  check('host recognised', st.actingHostId === host.pid);

  const notHost = await call('start', { code, pid: p3.pid });
  check('non-host cannot start', notHost.error === 'not_host', JSON.stringify(notHost));

  await call('start', { code, pid: host.pid });
  st = await call('state', { code, pid: host.pid });
  check('game started at round 1', st.status === 'playing' && st.round === 1, JSON.stringify([st.status, st.round]));
  check('prompt present', !!st.prompt && !!st.prompt.brand, JSON.stringify(st.prompt));
  check('target hidden during guessing', st.target === undefined, JSON.stringify(st.target));
  check('timer set', st.endsAt > Date.now(), String(st.endsAt - Date.now()));

  // Everyone answers; the round should cut short as soon as the last one is in.
  await call('submit', { code, pid: host.pid, h: 10, s: 90, b: 95 });
  st = await call('state', { code, pid: host.pid });
  check('still guessing after 1 of 3', st.phase === 'guess', st.phase);
  check('my submission echoed', !!st.mySubmission, JSON.stringify(st.mySubmission));

  const dupe = await call('submit', { code, pid: host.pid, h: 300, s: 10, b: 10 });
  check('second submit ignored', dupe.already === true, JSON.stringify(dupe));

  await call('submit', { code, pid: p2.pid, h: 200, s: 60, b: 60 });
  await call('submit', { code, pid: p3.pid, h: 40, s: 100, b: 100 });

  st = await call('state', { code, pid: host.pid });
  check('reveal starts once all are in', st.phase === 'reveal', st.phase);
  check('target revealed', !!st.target && !!st.target.hex, JSON.stringify(st.target));
  check('all guesses visible', st.players.every((p) => p.guess), JSON.stringify(st.players.map((p) => !!p.guess)));
  check('scores assigned', st.players.every((p) => typeof p.score === 'number'));
  check('totals accumulate', st.players.every((p) => p.total >= 0));

  const badGuess = await call('submit', { code, pid: host.pid, h: 'x', s: null, b: 5 });
  check('malformed guess rejected', badGuess.error === 'bad_guess', JSON.stringify(badGuess));

  console.log('  … waiting out the reveal window to check auto-advance (10s)');
  await new Promise((r) => setTimeout(r, 10000));
  st = await call('state', { code, pid: host.pid });
  check('advanced to round 2', st.round === 2 && st.phase === 'guess', JSON.stringify([st.round, st.phase]));
  check('round 2 scores reset per round', st.players.every((p) => !p.submitted));
  check('totals carried over', st.players.some((p) => p.total > 0), JSON.stringify(st.players.map((p) => p.total)));

  // Two pollers racing the same advance must not skip a round.
  const [a, b] = await Promise.all([
    call('state', { code, pid: p2.pid }),
    call('state', { code, pid: p3.pid }),
  ]);
  check('concurrent polls agree', a.round === b.round && a.round === 2, JSON.stringify([a.round, b.round]));

  // Fast-forward the rest of the game.
  for (let r = 2; r <= 5; r++) {
    await call('submit', { code, pid: host.pid, h: 20 * r, s: 80, b: 85 });
    await call('submit', { code, pid: p2.pid, h: 20 * r + 30, s: 70, b: 75 });
    await call('submit', { code, pid: p3.pid, h: 20 * r + 60, s: 60, b: 65 });
    await new Promise((res) => setTimeout(res, 10000));
    st = await call('state', { code, pid: host.pid });
    console.log(`    after round ${r}: round=${st.round} status=${st.status} phase=${st.phase}`);
  }

  check('game ended after 5 rounds', st.status === 'ended', JSON.stringify([st.status, st.round]));
  check('recap has 5 rounds', (st.recap || []).length === 5, String((st.recap || []).length));
  check('recap includes true colours', (st.recap || []).every((r) => r.hex && r.target));
  check('final totals sensible', st.players.every((p) => p.total > 0 && p.total <= 50),
    JSON.stringify(st.players.map((p) => [p.name, p.total])));

  const again = await call('again', { code, pid: host.pid });
  check('play again accepted', again.ok === true, JSON.stringify(again));
  st = await call('state', { code, pid: host.pid });
  check('new game round 1', st.status === 'playing' && st.round === 1 && st.gameId === 2,
    JSON.stringify([st.status, st.round, st.gameId]));
  check('totals reset for new game', st.players.every((p) => p.total === 0),
    JSON.stringify(st.players.map((p) => p.total)));

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

server.listen(PORT, async () => {
  try {
    await main();
  } catch (err) {
    console.error('TEST ERROR:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
