// Drives two browser players through a real game and screenshots each screen.
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:5600';
const SHOTS = process.env.SHOT_DIR || '/tmp/tt-shots';
let failures = 0;
const errors = [];

function check(label, cond, detail) {
  if (!cond) failures++;
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label}${!cond && detail ? ' — ' + detail : ''}`);
}

const visible = (page, sel) => page.locator(sel).isVisible();

async function main() {
  require('fs').mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  const mk = async (label) => {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { errors.push(`${label}: ${e.message}`); });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`); });
    return page;
  };

  const host = await mk('host');
  const guest = await mk('guest');

  // ---- home ----
  await host.goto(BASE);
  await host.waitForTimeout(400);
  check('home screen visible', await visible(host, '#home'));
  await host.screenshot({ path: `${SHOTS}/1-home.png`, fullPage: true });

  // ---- create room ----
  await host.fill('#name', 'Zach');
  await host.click('#btnCreate');
  await host.waitForSelector('#lobby:not(.hide)', { timeout: 10000 });
  const code = (await host.textContent('#lobbyCode')).trim();
  check('room code shown', /^[A-Z0-9]{4}$/.test(code), code);

  // ---- guest joins via link ----
  await guest.goto(`${BASE}/?r=${code}`);
  await guest.waitForTimeout(300);
  await guest.fill('#name', 'Mia');
  await guest.click('#btnJoin');
  await guest.waitForSelector('#lobby:not(.hide)', { timeout: 10000 });

  await host.waitForTimeout(1800);
  const lobbyRows = await host.locator('#lobbyList .prow').count();
  check('both players in lobby', lobbyRows === 2, String(lobbyRows));
  check('host sees start button', await visible(host, '#btnStart'));
  check('guest sees waiting text', await visible(guest, '#waitHost'));
  check('guest has no start button', !(await visible(guest, '#btnStart')));
  await host.screenshot({ path: `${SHOTS}/2-lobby.png`, fullPage: true });

  // ---- play ----
  await host.click('#btnStart');
  await host.waitForSelector('#play:not(.hide)', { timeout: 10000 });
  await guest.waitForSelector('#play:not(.hide)', { timeout: 10000 });
  const brand = (await host.textContent('#pBrand')).trim();
  check('brand prompt rendered', brand.length > 1 && brand !== '—', brand);
  check('timer counting', /\d+s/.test(await host.textContent('#timePill')));

  await host.locator('#sH').fill('35');
  await host.locator('#sS').fill('88');
  await host.locator('#sB').fill('96');
  await host.waitForTimeout(150);
  const preview = await host.locator('#preview').evaluate((el) => getComputedStyle(el).backgroundColor);
  check('preview swatch follows sliders', preview.startsWith('rgb('), preview);
  const hueTrack = await host.locator('#sH').evaluate((el) => getComputedStyle(el).getPropertyValue('--track'));
  check('hue slider has gradient track', hueTrack.includes('gradient'), hueTrack.slice(0, 40));

  // The mark must be on stage and must re-tint as the sliders move.
  check('logo rendered on stage', (await host.locator('#stage svg.logo').count()) === 1);
  const fillsAt = async (p) =>
    p.locator('#stage svg.logo').evaluate((el) =>
      [...el.querySelectorAll('[fill]')].map((n) => n.getAttribute('fill')).join(',')
    );
  const beforeHue = await fillsAt(host);
  await host.locator('#sH').fill('300');
  await host.waitForTimeout(150);
  const afterHue = await fillsAt(host);
  check('logo re-tints when hue moves', beforeHue !== afterHue,
    `${beforeHue.slice(0, 24)} -> ${afterHue.slice(0, 24)}`);
  check('logo uses the live slider colour', afterHue.includes('rgb('), afterHue.slice(0, 40));
  await host.locator('#sH').fill('35');
  await host.waitForTimeout(150);
  await host.screenshot({ path: `${SHOTS}/3-play.png`, fullPage: true });

  await host.click('#btnLock');
  await host.waitForTimeout(1600);
  check('host locked in', await visible(host, '#lockedMsg'));
  check('lock button hidden after submit', !(await visible(host, '#btnLock')));
  check('guest still guessing', await visible(guest, '#play'));

  // ---- reveal ----
  await guest.locator('#sH').fill('190');
  await guest.locator('#sS').fill('60');
  await guest.locator('#sB').fill('70');
  await guest.click('#btnLock');
  await host.waitForSelector('#reveal:not(.hide)', { timeout: 12000 });
  await guest.waitForSelector('#reveal:not(.hide)', { timeout: 12000 });

  const scoreTxt = (await host.textContent('#rScore')).trim();
  check('score shown on reveal', /^\d+\.\d{2}$/.test(scoreTxt), scoreTxt);
  const targetBg = await host.locator('#rTarget').evaluate((el) => getComputedStyle(el).backgroundColor);
  check('true colour revealed', targetBg.startsWith('rgb('), targetBg);
  check('reveal shows the mark in both colours',
    (await host.locator('#rTargetLogo svg.logo').count()) === 1 &&
    (await host.locator('#rMineLogo svg.logo').count()) === 1);
  check('both guesses listed', (await host.locator('#revealList .prow').count()) === 2);
  check('leaderboard listed', (await host.locator('#revealBoard .prow').count()) === 2);
  await host.screenshot({ path: `${SHOTS}/4-reveal.png`, fullPage: true });

  // ---- fast-forward to the end ----
  for (let r = 2; r <= 5; r++) {
    await host.waitForSelector('#play:not(.hide)', { timeout: 20000 });
    await guest.waitForSelector('#play:not(.hide)', { timeout: 20000 });
    await host.locator('#sH').fill(String(20 * r));
    await host.click('#btnLock');
    await guest.locator('#sH').fill(String(20 * r + 40));
    await guest.click('#btnLock');
    await host.waitForTimeout(2500);
  }

  await host.waitForSelector('#final:not(.hide)', { timeout: 25000 });
  await guest.waitForSelector('#final:not(.hide)', { timeout: 25000 });
  check('final screen reached by both', (await visible(host, '#final')) && (await visible(guest, '#final')));
  check('podium has both players', (await host.locator('#podium .pod').count()) === 2);
  check('recap lists 5 rounds', (await host.locator('#recap .rrow').count()) === 5);
  check('host can play again', await visible(host, '#btnAgain'));
  check('guest waits for host', await visible(guest, '#waitAgain'));
  await host.screenshot({ path: `${SHOTS}/5-final.png`, fullPage: true });

  await host.click('#btnAgain');
  await host.waitForSelector('#play:not(.hide)', { timeout: 12000 });
  await guest.waitForSelector('#play:not(.hide)', { timeout: 12000 });
  check('rematch starts for everyone', true);

  // ---- running out of time locks you in, it doesn't score you as absent ----
  check('lock hint offered before locking', await visible(host, '#lockHint'));
  await host.locator('#sH').fill('142');
  await host.locator('#sS').fill('77');
  await host.locator('#sB').fill('64');
  const chosen = await host.locator('#preview').evaluate((el) => getComputedStyle(el).backgroundColor);

  // Nobody touches the button — sit the whole guess window out. The lock fires
  // just before the deadline, so the next screen either player sees is the
  // reveal; that reveal is the assertion.
  console.log('  … sitting out a 45s round to check the automatic lock-in');
  await host.waitForSelector('#reveal:not(.hide)', { timeout: 70000 });
  const autoScore = (await host.textContent('#rScore')).trim();
  check('the auto-locked colour was scored', /^\d+\.\d{2}$/.test(autoScore), autoScore);
  const autoMine = await host.locator('#rMine').evaluate((el) => getComputedStyle(el).backgroundColor);
  check('scored colour is the one left on the sliders', autoMine === chosen, `${autoMine} vs ${chosen}`);
  check('both sitting-out players were locked in, not skipped',
    (await host.locator('#revealList .prow .sc').allTextContents())
      .every((t) => /^\d+\.\d{2}$/.test(t.trim())));
  await host.screenshot({ path: `${SHOTS}/6-autolock.png`, fullPage: true });

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(`\n${failures === 0 ? 'UI CHECKS PASSED' : failures + ' UI CHECK(S) FAILED'}`);
  console.log('screenshots in ' + SHOTS);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => { console.error('UI TEST ERROR:', e); process.exitCode = 1; });
