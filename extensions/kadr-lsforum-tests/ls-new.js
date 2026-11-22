const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const extDir = path.resolve(process.argv[2]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`)); };
const extId = crypto.createHash('sha256').update(extDir).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-new-')), { channel: 'chromium', headless: true, ...devices['Pixel 7'], viewport: { width: 412, height: 860 }, args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`] });
  const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${extId}/popup.html`);
  const stored = () => ctl.evaluate(() => new Promise((r) => chrome.storage.local.get(null, r)));
  await ctl.evaluate(() => new Promise((r) => chrome.storage.local.set({ theme: 'mint', skin: true }, r)));
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('https://forum.ls-project.com/', { waitUntil: 'load', timeout: 60000 }); await sleep(2200);
  const cdp = await ctx.newCDPSession(page);
  const touchDrag = async (x, y, dx, dy) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12, id: 1 }] }); await sleep(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
  };
  const W = () => page.evaluate(() => { const w = document.querySelector('.lsp-server-widget'); const rows = [...w.children].filter((c) => getComputedStyle(c).display !== 'none' && getComputedStyle(c).visibility !== 'hidden' && !c.matches('[data-kadr-lsp-toggle]')); const r = w.getBoundingClientRect(); return { min: document.documentElement.getAttribute('data-kadr-lsp') === 'min', rows: rows.length, h: Math.round(r.height), right: Math.round(innerWidth - r.right), label: (document.querySelector('[data-kadr-lsp-toggle]') || {}).title }; });

  const w0 = await W();
  check('widget: toggle button present, expanded, «Свернуть»', [w0.min, w0.label], [false, 'Свернуть']);
  await page.locator('[data-kadr-lsp-toggle]').tap(); await sleep(500);
  const w1 = await W();
  check('widget: tap collapses it to the button alone, banner keeps its height', [w1.min, w1.rows, w1.label, w1.h === w0.h], [true, 0, 'Развернуть', true]);
  check('widget: collapsed state saved', (await stored()).lspMin, true);
  await page.reload({ waitUntil: 'load' }); await sleep(2000);
  check('widget: still collapsed after reload', (await W()).min, true);
  await page.locator('[data-kadr-lsp-toggle]').tap(); await sleep(500);
  const w2 = await W();
  check('widget: second tap expands it back', [w2.min, w2.rows >= 3], [false, true]);
  const rights = [];
  for (const vw of [360, 412, 600, 768, 900]) { await page.setViewportSize({ width: vw, height: 860 }); await sleep(450); rights.push((await W()).right); }
  await page.setViewportSize({ width: 412, height: 860 }); await sleep(300);
  check('widget: pinned at the same distance from the right edge at 360–900 px', rights.every((r) => r === rights[0]), true);
  console.log('     right offsets:', rights.join(', '));

  check('index: «Главная» breadcrumb hidden', await page.evaluate(() => getComputedStyle(document.querySelector('.ipsBreadcrumb_top')).display), 'none');

  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#elMobileNav [data-kadr-entry] a').tap(); await page.waitForSelector('kadr-sheet'); await sleep(1300);
  const frame = page.frames().find((f) => f.url().includes('popup.html'));
  await frame.locator('.th.custom').tap(); await sleep(400);
  check('custom: one tap selects «Свой» and opens the sliders', [await frame.evaluate(() => document.querySelector('.th.custom').getAttribute('aria-checked')), await frame.locator('#tune').isVisible()], ['true', true]);
  const acc0 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theme-brand_primary').trim());
  const hb = await frame.locator('#tuneH').boundingBox();
  await touchDrag(hb.x + hb.width * 0.15, hb.y + hb.height / 2, hb.width * 0.6, 0); await sleep(500);
  const st = await stored();
  const acc1 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theme-brand_primary').trim());
  check('custom: dragging the hue slider with a finger changes the colour on the forum', [st.theme, /^#[0-9a-f]{6}$/.test(st.seed || ''), acc1 !== acc0], ['custom', true, true]);
  console.log('     accent', acc0, '->', acc1, 'seed', st.seed);
  check('custom: the slider drag did not move the forum or close the sheet', [!!(await page.$('kadr-sheet')), await page.evaluate(() => Math.round(scrollY))], [true, 0]);

  const cls = () => page.evaluate(() => ['kadr-cke-tint', 'kadr-fx-glass', 'kadr-fx-material', 'kadr-noshadow'].filter((c) => document.documentElement.classList.contains(c)));
  check('settings: defaults — tinted editor icons, plain style, shadows on', await cls(), ['kadr-cke-tint']);
  await frame.locator('#fxSeg [data-fx="glass"]').tap(); await sleep(300);
  check('settings: «Стекло» applied at once', (await cls()).includes('kadr-fx-glass'), true);
  await frame.locator('#fxSeg [data-fx="material"]').tap(); await sleep(300);
  check('settings: «Material» replaces glass', [(await cls()).includes('kadr-fx-material'), (await cls()).includes('kadr-fx-glass')], [true, false]);
  await frame.locator('#shadowSwitch').tap(); await frame.locator('#ckeSwitch').tap(); await sleep(300);
  check('settings: shadows off, editor icons plain', [(await cls()).includes('kadr-noshadow'), (await cls()).includes('kadr-cke-tint')], [true, false]);
  await frame.locator('#skinSwitch').tap(); await sleep(300);
  check('settings: redesign off — none of the design classes left', [await cls(), await page.evaluate(() => document.documentElement.classList.contains('kadr-rd')), !!(await page.$('[data-kadr-lsp-toggle]'))], [[], false, false]);
  await frame.locator('#skinSwitch').tap(); await sleep(400);
  check('settings: redesign back — classes and widget button return', [(await cls()).includes('kadr-fx-material'), !!(await page.$('[data-kadr-lsp-toggle]'))], [true, true]);

  await page.keyboard.press('Escape'); await sleep(600);
  const tf = await page.evaluate(() => [...document.querySelectorAll('.ipsBox, .ipsDataList, .ipsDataItem, .cPost')].filter((e) => getComputedStyle(e).transform !== 'none').length);
  check('animations: no element keeps a transform after appearing', tf, 0);
  check('no page errors', errs.join(' | '), '');
  await ctx.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
