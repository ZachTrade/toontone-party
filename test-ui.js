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

/** Claim a name + PIN on the home screen; it becomes the name everywhere. */
async function signIn(page, name, pin) {
  await page.fill('#idName', name);
  await page.fill('#idPin', pin);
  await page.click('#btnIdentify');
  await page.waitForSelector('#idWho:not(.hide)', { timeout: 10000 });
}

async function main() {
  require('fs').mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  const mk = async (label) => {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { errors.push(`${label}: ${e.message}`); });
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // A 4xx from our own API is a handled outcome the UI reports itself —
      // a refused PIN, a dead room code. Chrome logs every failed fetch as a
      // console error regardless, so those would drown out real exceptions.
      if (/Failed to load resource/i.test(m.text())) return;
      errors.push(`${label} console: ${m.text()}`);
    });
    return page;
  };

  const host = await mk('host');
  const guest = await mk('guest');

  // ---- home ----
  await host.goto(BASE);
  await host.waitForTimeout(400);
  check('home screen visible', await visible(host, '#home'));
  // Home is three tabs, not one long scroll.
  check('home has the three tabs',
    (await visible(host, '#tabDaily')) && (await visible(host, '#tabPvp')) && (await visible(host, '#tabBoard')));
  check('the daily tab is the one you land on',
    (await visible(host, '#secDaily')) &&
    !(await visible(host, '#secPvp')) && !(await visible(host, '#secBoard')));
  check('home shows the daily date', /^\d{4}-\d{2}-\d{2}$/.test((await host.textContent('#homeDay')).trim()),
    (await host.textContent('#homeDay')).trim());

  await host.click('#tabPvp');
  await host.waitForTimeout(200);
  check('the pvp tab swaps the panes',
    (await visible(host, '#secPvp')) && !(await visible(host, '#secDaily')));
  await host.click('#tabBoard');
  await host.waitForTimeout(400);
  check('the leaderboard tab swaps the panes',
    (await visible(host, '#secBoard')) && !(await visible(host, '#secPvp')));
  await host.click('#tabDaily');
  await host.waitForTimeout(200);
  await host.screenshot({ path: `${SHOTS}/1-home.png`, fullPage: true });

  // ---- identity ----
  check('the claim form is shown when signed out', await visible(host, '#idCard'));
  check('nothing is playable until a name is claimed',
    (await host.locator('#btnCreate').isDisabled()) &&
    (await host.locator('#btnJoin').isDisabled()) &&
    (await host.locator('#btnDaily').isDisabled()));
  check('no name box on the create-room card',
    (await host.locator('#home input#name').count()) === 0);

  await host.fill('#idName', 'Zach');
  await host.fill('#idPin', '12');
  await host.click('#btnIdentify');
  await host.waitForTimeout(600);
  check('a short pin is refused', await visible(host, '#idErr'),
    (await host.textContent('#idErr')).trim());

  await signIn(host, 'Zach', '1234');
  check('the claim form gives way to who you are', !(await visible(host, '#idCard')));
  check('the name is shown back to you',
    (await host.textContent('#idWhoName')).trim() === 'Zach');
  check('claiming a name unlocks the game',
    !(await host.locator('#btnCreate').isDisabled()));
  await host.screenshot({ path: `${SHOTS}/0-identity.png`, fullPage: true });

  // A different browser must not be able to take a claimed name.
  const impostor = await mk('impostor');
  await impostor.goto(BASE);
  await impostor.waitForTimeout(300);
  await impostor.fill('#idName', 'Zach');
  await impostor.fill('#idPin', '0000');
  await impostor.click('#btnIdentify');
  await impostor.waitForTimeout(800);
  check('a claimed name cannot be taken with the wrong pin',
    (await visible(impostor, '#idErr')) && (await visible(impostor, '#idCard')),
    (await impostor.textContent('#idErr')).trim());
  await impostor.close();

  // The sign-in has to outlive a reload, or nobody stays signed in.
  await host.reload();
  await host.waitForTimeout(800);
  check('the name survives a reload',
    !(await visible(host, '#idCard')) && (await host.textContent('#idWhoName')).trim() === 'Zach');

  // ---- create room ----
  await host.click('#tabPvp');
  await host.waitForTimeout(200);
  await host.click('#btnCreate');
  await host.waitForSelector('#lobby:not(.hide)', { timeout: 10000 });
  const code = (await host.textContent('#lobbyCode')).trim();
  check('room code shown', /^[A-Z0-9]{4}$/.test(code), code);

  // ---- guest joins via link ----
  await guest.goto(`${BASE}/?r=${code}`);
  await guest.waitForTimeout(300);
  await signIn(guest, 'Mia', '4321');
  await guest.click('#tabPvp');
  await guest.waitForTimeout(200);
  await guest.click('#btnJoin');
  await guest.waitForSelector('#lobby:not(.hide)', { timeout: 10000 });

  await host.waitForTimeout(1800);
  const lobbyRows = await host.locator('#lobbyList .prow').count();
  check('both players in lobby', lobbyRows === 2, String(lobbyRows));
  // Names come from the claimed account, not from anything typed in the room.
  const lobbyNames = (await host.locator('#lobbyList .nm').allTextContents()).join(' ');
  check('the lobby uses the claimed names',
    /Zach/.test(lobbyNames) && /Mia/.test(lobbyNames), lobbyNames.replace(/\s+/g, ' ').trim());
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
  // H/S/B map straight onto the sliders, so the reveal must not print them —
  // otherwise a brand seen once can be dialled in exactly ever after.
  const revealNums = (await host.textContent('#rTargetHex')) + (await host.textContent('#rMineHex'));
  check('reveal hides the H/S/B numbers',
    !/\bH\s*\d|\bS\s*\d|\bB\s*\d/.test(revealNums), revealNums.trim());
  check('reveal still names the colour', /#[0-9A-F]{6}/i.test(revealNums), revealNums.trim());
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

  // ---- the finished game lands on the all-time board ----
  const podiumTags = (await host.locator('#podium .pod .tag').allTextContents()).join(' ');
  check('the podium shows what was earned', /\+\d+ pts/.test(podiumTags), podiumTags.trim());
  check('the winner gets a gold on the podium', /🥇/.test(podiumTags), podiumTags.trim());

  const spectator = await mk('spectator');
  await spectator.goto(BASE);
  await spectator.waitForTimeout(600);
  await spectator.click('#tabBoard');
  await spectator.waitForTimeout(400);
  check('the leaderboard has both sub-tabs',
    (await visible(spectator, '#tabToday')) && (await visible(spectator, '#tabAllTime')));
  check('today is the sub-tab you land on',
    (await visible(spectator, '#paneToday')) && !(await visible(spectator, '#paneAllTime')));

  await spectator.click('#tabBoard');
  await spectator.waitForTimeout(400);
  await spectator.click('#tabAllTime');
  await spectator.waitForTimeout(900);
  check('the all-time tab opens',
    (await visible(spectator, '#paneAllTime')) && !(await visible(spectator, '#paneToday')));
  const careerRows = await spectator.locator('#careerBoard .prow').count();
  check('the all-time board lists the players', careerRows === 2, String(careerRows));
  const careerText = (await spectator.locator('#careerBoard').textContent()).replace(/\s+/g, ' ');
  check('it shows games played', /1 game/.test(careerText), careerText.trim());
  check('it shows an accumulated gold medal', /🥇 1/.test(careerText), careerText.trim());
  // Two players means 2 points for the win and 1 for second.
  const careerPoints = (await spectator.locator('#careerBoard .sc').allTextContents())
    .map((t) => parseInt(t, 10));
  check('points scale with the room size', careerPoints[0] === 2 && careerPoints[1] === 1,
    careerPoints.join(', '));
  await spectator.screenshot({ path: `${SHOTS}/10-alltime.png`, fullPage: true });
  await spectator.close();

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

  // ---- daily challenge: same logo for everyone, one shot, shared board ----
  const solo = await mk('daily-1');
  const rival = await mk('daily-2');
  await solo.goto(BASE);
  await rival.goto(BASE);
  await solo.waitForTimeout(300);

  await signIn(solo, 'Sam', '5555');
  await signIn(rival, 'Ada', '6666');
  await solo.click('#btnDaily');
  await solo.waitForSelector('#daily:not(.hide)', { timeout: 10000 });
  const dayBrand = (await solo.textContent('#dBrand')).trim();
  check('daily screen opens with a brand', dayBrand.length > 1 && dayBrand !== '—', dayBrand);
  check('daily hides the answer until you play',
    !(await visible(solo, '#dResult')) && (await visible(solo, '#dPick')));
  check('daily logo is on the stage', (await solo.locator('#dStage svg.logo').count()) === 1);

  await rival.click('#btnDaily');
  await rival.waitForSelector('#daily:not(.hide)', { timeout: 10000 });
  check('everyone gets the same logo today',
    (await rival.textContent('#dBrand')).trim() === dayBrand,
    `${dayBrand} vs ${(await rival.textContent('#dBrand')).trim()}`);

  await solo.locator('#dH').fill('40');
  await solo.locator('#dS').fill('85');
  await solo.locator('#dB').fill('95');
  await solo.waitForTimeout(150);
  const dBefore = await solo.locator('#dStage svg.logo').evaluate((el) =>
    [...el.querySelectorAll('[fill]')].map((n) => n.getAttribute('fill')).join(','));
  await solo.locator('#dH').fill('300');
  await solo.waitForTimeout(150);
  const dAfter = await solo.locator('#dStage svg.logo').evaluate((el) =>
    [...el.querySelectorAll('[fill]')].map((n) => n.getAttribute('fill')).join(','));
  check('daily logo re-tints with the sliders', dBefore !== dAfter);

  // ---- the run: three logos, scores adding up ----
  const runBrands = [];
  const runScores = [];
  for (let i = 1; i <= 3; i++) {
    check(`run shows logo ${i} of 3`,
      (await solo.textContent('#dProgress')).trim() === `Logo ${i} of 3`,
      (await solo.textContent('#dProgress')).trim());
    runBrands.push((await solo.textContent('#dBrand')).trim());
    await solo.locator('#dH').fill(String(30 + i * 40));
    await solo.click('#btnDailyLock');
    await solo.waitForSelector('#dResult:not(.hide)', { timeout: 10000 });
    const s1 = (await solo.textContent('#dScore')).trim();
    check(`logo ${i} is scored`, /^\d+\.\d{2}$/.test(s1), s1);
    runScores.push(parseFloat(s1));

    // The reveal must not print numbers that map straight back onto sliders.
    const revealText = (await solo.textContent('#dTargetHex')) + (await solo.textContent('#dMineHex'));
    check(`logo ${i} reveal hides the H/S/B numbers`,
      !/\bH\s*\d|\bS\s*\d|\bB\s*\d/.test(revealText), revealText.trim());
    check(`logo ${i} reveal still names the colour`, /#[0-9A-F]{6}/i.test(revealText), revealText.trim());

    await solo.click('#btnDailyNext');
    await solo.waitForTimeout(300);
  }

  check('the three logos are all different', new Set(runBrands).size === 3, runBrands.join(', '));
  check('the run finishes after three', (await visible(solo, '#dDone')));
  check('no sliders once the run is done', !(await visible(solo, '#dPick')));
  const totalTxt = (await solo.textContent('#dTotal')).trim();
  const summed = runScores.reduce((a, b) => a + b, 0);
  check('total is the three scores added up', Math.abs(parseFloat(totalTxt) - summed) < 0.02,
    `${totalTxt} vs ${summed.toFixed(2)}`);
  check('the run recap lists all three', (await solo.locator('#dRunRecap .rrow').count()) === 3);
  check('you appear on the daily board', (await solo.locator('#dBoard .prow.me').count()) === 1);
  await solo.screenshot({ path: `${SHOTS}/7-daily.png`, fullPage: true });

  // Reload: the one-shot rule has to survive a fresh page, not just a hidden button.
  await solo.reload();
  await solo.waitForTimeout(400);
  await solo.click('#btnDaily');
  await solo.waitForSelector('#daily:not(.hide)', { timeout: 10000 });
  check('a reload cannot buy a second run',
    (await visible(solo, '#dDone')) && !(await visible(solo, '#dPick')));
  check('the total survives the reload', (await solo.textContent('#dTotal')).trim() === totalTxt);

  // A second player, deliberately worse, to prove the board accumulates and ranks.
  for (let i = 1; i <= 3; i++) {
    await rival.locator('#dH').fill('200');
    await rival.locator('#dS').fill('5');
    await rival.locator('#dB').fill('5');
    await rival.click('#btnDailyLock');
    await rival.waitForSelector('#dResult:not(.hide)', { timeout: 10000 });
    await rival.click('#btnDailyNext');
    await rival.waitForTimeout(300);
  }
  const rows = await rival.locator('#dBoard .prow').count();
  check('the board is shared between players', rows === 2, String(rows));
  const names = (await rival.locator('#dBoard .nm').allTextContents()).join(' ');
  check('both players are listed', /Sam/.test(names) && /Ada/.test(names), names);
  const scores = (await rival.locator('#dBoard .sc').allTextContents()).map((t) => parseFloat(t));
  check('the board ranks on accumulated score', scores[0] >= scores[1], scores.join(' > '));
  check('the board totals a whole run, not one logo',
    scores[0] === parseFloat(totalTxt), `${scores[0]} vs ${totalTxt}`);
  await rival.screenshot({ path: `${SHOTS}/8-daily-board.png`, fullPage: true });

  // Back on the home screen, the same standings should be waiting.
  await rival.click('#btnDailyHome');
  await rival.waitForSelector('#home:not(.hide)', { timeout: 10000 });
  await rival.click('#tabBoard');
  await rival.waitForTimeout(900);
  check('home board fills in after playing',
    (await rival.locator('#homeBoard .prow').count()) === 2,
    String(await rival.locator('#homeBoard .prow').count()));
  check('home board marks you', (await rival.locator('#homeBoard .prow.me').count()) === 1);
  check('home shows your standing', /#\d/.test(await rival.textContent('#homeRank')),
    (await rival.textContent('#homeRank')).trim());
  check('the daily button knows you have finished',
    /result/i.test(await rival.textContent('#btnDaily')),
    (await rival.textContent('#btnDaily')).trim());
  await rival.screenshot({ path: `${SHOTS}/9-home-board.png`, fullPage: true });

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(`\n${failures === 0 ? 'UI CHECKS PASSED' : failures + ' UI CHECK(S) FAILED'}`);
  console.log('screenshots in ' + SHOTS);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => { console.error('UI TEST ERROR:', e); process.exitCode = 1; });
