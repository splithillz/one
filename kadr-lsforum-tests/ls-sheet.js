const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const extDir = path.resolve(process.argv[2]);
const AUTH = process.argv.includes('--auth');
const { login, logout } = require('./auth-login');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`)); };
const extId = crypto.createHash('sha256').update(extDir).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

async function run(vw, vh, shots) {
  console.log(`— viewport ${vw}x${vh}`);
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-ls-')), {
    channel: 'chromium', headless: true, ...devices['Pixel 7'], viewport: { width: vw, height: vh },
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`] });
  const p0 = await ctx.newPage(); await p0.goto(`chrome-extension://${extId}/popup.html`);
  await p0.evaluate(() => new Promise((r) => chrome.storage.local.set({ theme: 'mint', skin: true }, r))); await p0.close();
  if (AUTH) await login(ctx);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('https://forum.ls-project.com/', { waitUntil: 'load', timeout: 45000 });
  await sleep(2500);
  const cdp = await ctx.newCDPSession(page);
  const swipe = async (x, y, dy) => {
    await page.bringToFront();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    const n = 14;
    for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy * i / n, id: 1 }] }); await sleep(16); }
    for (let i = 0; i < 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy, id: 1 }] }); await sleep(30); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(450);
  };
  const scrollY = () => page.evaluate(() => Math.round(scrollY));
  const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theme-brand_primary').trim());

  const entry = await page.evaluate(() => {
    const nav = document.getElementById('elMobileNav'), li = nav && nav.querySelector(':scope > [data-kadr-entry]');
    if (!li) return null;
    const ic = li.querySelector('.kadr-ico');
    const next = li.nextElementSibling;
    return { beforeMenu: !!next && (next.getAttribute('data-ipsdrawer-drawerelem') === '#elMobileDrawer' || (next.hasAttribute('data-ipsdrawer') && !next.nextElementSibling)), drawers: nav.querySelectorAll(':scope > [data-ipsdrawer]').length, guest: document.documentElement.hasAttribute('data-focus-guest'), color: getComputedStyle(ic).backgroundColor, w: Math.round(li.getBoundingClientRect().width) };
  });
  console.log('     icon bar: ' + (entry ? entry.drawers : '?') + ' drawer buttons, ' + (entry && entry.guest ? 'guest' : 'logged in'));
  check('entry: «Тема» sits in the icon bar right before the main menu button (☰)', entry && entry.beforeMenu, true);
  check('entry: painted in the theme accent (Мята #3fe0a1)', entry && entry.color, 'rgb(63, 224, 161)');
  check('theme: forum accent var is the theme accent', await accent(), '63, 224, 161');

  await swipe(vw / 2, vh / 2, -300);
  const y0 = await scrollY();
  check('sanity: a swipe on the forum scrolls it', y0 > 150, true);
  check('sticky header: the icon bar stays visible after scrolling', await page.evaluate(() => { const r = document.getElementById('elMobileNav').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height > 30; }), true);
  if (shots) await page.screenshot({ path: path.join(shots, `scrolled-${vw}.png`) });

  await page.locator('#elMobileNav [data-kadr-entry] a').tap();
  await page.waitForSelector('kadr-sheet');
  await sleep(1300);
  const frame = page.frames().find((f) => f.url().includes('popup.html'));
  check('sheet: opened with the settings inside', !!frame, true);
  if (shots) await page.screenshot({ path: path.join(shots, `sheet-${vw}.png`) });
  const tiles = await frame.evaluate(() => document.querySelectorAll('#themes .th').length);
  check('sheet: 15 theme tiles (Родная, 10 themes, Свой, Monet White/Dark/Black)', tiles, 15);
  check('sheet: the page is locked', await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden');
  const inner = () => frame.evaluate(() => { const e = document.scrollingElement; return [Math.round(e.scrollTop), e.scrollHeight - e.clientHeight]; });
  const [, room] = await inner();
  console.log('     sheet: room to scroll inside =', room, 'px');
  await swipe(vw / 2, vh - 160, -260);
  await swipe(vw / 2, vh - 160, -260);
  const down = await inner();
  check('sheet: swiping up over it does not move the forum', (await scrollY()) - y0, 0);
  check('sheet: …and scrolls the settings to their end when they do not fit', down[0], room);
  if (room > 0) {
    await swipe(vw / 2, vh - 160, 300);
    if ((await inner())[0] > 0) await swipe(vw / 2, vh - 160, 300);
    check('sheet: swiping down scrolls the settings back up; sheet stays, forum stays', [(await inner())[0], !!(await page.$('kadr-sheet')), (await scrollY()) - y0], [0, true, 0]);
  }
  await swipe(vw / 2, vh - 160, 40);
  check('sheet: a short pull down — springs back, forum stays', [!!(await page.$('kadr-sheet')), (await scrollY()) - y0], [true, 0]);
  await swipe(vw / 2, 60, -200);
  check('sheet: swipe over the dimmed area — forum stays', (await scrollY()) - y0, 0);

  await frame.locator('#themes [data-id="cobalt"]').tap();
  await sleep(500);
  check('switch: Cobalt applied to the forum at once', await accent(), '94, 200, 255');
  check('switch: the «Тема» icon follows the accent', await page.evaluate(() => getComputedStyle(document.querySelector('[data-kadr-entry] .kadr-ico')).backgroundColor), 'rgb(94, 200, 255)');
  await frame.locator('#themes [data-id="off"]').tap();
  await sleep(500);
  check('switch: «Родная» returns the forum colours (no theme style rules)', await page.evaluate(() => { const s = document.getElementById('kadr-theme'); return [getComputedStyle(document.documentElement).getPropertyValue('--theme-brand_primary').trim(), !!s && /html:root:root\{\}/.test(s.textContent) || !s || !/--theme-/.test(s.textContent)]; }), ['108, 154, 100', true]);
  await frame.locator('#skinSwitch').tap();
  await sleep(500);
  check('switch: «Новый дизайн» off — redesign gone', await page.evaluate(() => document.documentElement.classList.contains('kadr-rd')), false);
  check('switch: Родная + no redesign — nothing of ours left on the page but the button', await page.evaluate(() => !document.getElementById('kadr-theme')), true);
  await frame.locator('#skinSwitch').tap();
  await frame.locator('#themes [data-id="mint"]').tap();
  await sleep(500);
  check('switch: back to Мята + redesign', [await page.evaluate(() => document.documentElement.classList.contains('kadr-rd')), await accent()], [true, '63, 224, 161']);

  await swipe(vw / 2, vh - 260, 280);
  await sleep(700);
  check('sheet: a long pull down closes it; forum did not move; lock released', [!!(await page.$('kadr-sheet')), (await scrollY()) - y0, await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)], [false, 0, 'visible']);
  await swipe(vw / 2, vh / 2, -200);
  check('sheet closed: the forum scrolls again', (await scrollY()) > y0 + 100, true);

  const p1 = await ctx.newPage(); await p1.goto(`chrome-extension://${extId}/popup.html`);
  await p1.evaluate(() => new Promise((r) => chrome.storage.local.set({ menuEntry: false }, r)));
  await sleep(400);
  check('menuEntry off: the button leaves the bar', await page.evaluate(() => !!document.querySelector('[data-kadr-entry]')), false);
  await p1.evaluate(() => new Promise((r) => chrome.storage.local.set({ menuEntry: true }, r))); await p1.close();
  await sleep(400);
  check('menuEntry on: the button is back', await page.evaluate(() => !!document.querySelector('#elMobileNav > [data-kadr-entry]')), true);
  check('no page errors', errs.join(' | '), '');
  if (AUTH) console.log('     logout: ' + JSON.stringify(await logout(ctx)));
  await ctx.close();
}
(async () => {
  const shots = process.argv.slice(3).find((a) => !a.startsWith('--')) || null;
  if (shots) fs.mkdirSync(shots, { recursive: true });
  if (!process.argv.includes("--one")) await run(491, 864, shots);
  await run(412, 640, shots);
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
