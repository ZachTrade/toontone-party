// Local smoke test: runs the serverless handler over a real HTTP server and
// plays a full game with three players.
const http = require('http');
require('./fake-redis.js').install(process.env.UPSTASH_REDIS_REST_URL || '');
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
