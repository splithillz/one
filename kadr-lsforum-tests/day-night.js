const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const ext = path.resolve(process.argv[2]);
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, n = 0;
const check = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '\n       got  ' + JSON.stringify(got) + '\n       want ' + JSON.stringify(want))); };
const WHITE = 'rgb(249, 249, 255)', MDARK = 'rgb(17, 19, 24)', BLACK = 'rgb(0, 0, 0)';
const TOPIC = 'https://forum.ls-project.com/index.php?/topic/838-x/';
async function run(kind) {
  const dev = kind === 'phone' ? { viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent } : { viewport: { width: 1366, height: 900 } };
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-dn-')), { channel: 'chromium', headless: true, ...dev, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
  const set = (s) => ctl.evaluate((s) => new Promise((r) => chrome.storage.local.set(s, r)), s);
  await ctl.evaluate(() => new Promise((r) => chrome.storage.local.clear(r)));
  await set({ theme: 'mint', skin: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__f = []; window.__errs = [];
    addEventListener('error', (e) => window.__errs.push(String(e.message)));
    const s = () => { const b = document.body; if (b && b.childElementCount) window.__f.push({ sc: document.documentElement.getAttribute('data-focus-scheme'), bg: getComputedStyle(b).backgroundColor }); };
    const loop = () => { s(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  });
  const look = () => page.evaluate(() => ({ sc: document.documentElement.getAttribute('data-focus-scheme'), bg: getComputedStyle(document.body).backgroundColor }));
  const acc = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theme-brand_primary').trim());
  const k = kind + ': ';
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(TOPIC, { waitUntil: 'load', timeout: 60000 }); await sleep(1500);
  check(k + 'Мята, «как на форуме», система светлая: схема форума (тёмная)', (await look()).sc, 'dark');
  const mintAcc = await acc();
  await set({ scheme: 'system' }); await sleep(700);
  check(k + '«как в системе» включено вживую: схема светлая', (await look()).sc, 'light');
  check(k + 'акцент остался мятным', await acc(), mintAcc);
  await page.emulateMedia({ colorScheme: 'dark' }); await sleep(700);
  check(k + 'система переключилась на тёмную: схема тёмная без перезагрузки', (await look()).sc, 'dark');
  await page.emulateMedia({ colorScheme: 'light' }); await sleep(700);
  check(k + 'и обратно на светлую', (await look()).sc, 'light');
  await page.evaluate(() => { window.__f = []; });
  await page.reload({ waitUntil: 'load' }); await sleep(1500);
  const fr = await page.evaluate(() => window.__f);
  check(k + 'перезагрузка при светлой системе: ни одного кадра в тёмной схеме', fr.filter((f) => f.sc !== 'light').length, 0);
  await set({ theme: 'monet-black' }); await sleep(700);
  check(k + 'Monet Black днём → Monet White', await look(), { sc: 'light', bg: WHITE });
  await page.emulateMedia({ colorScheme: 'dark' }); await sleep(700);
  check(k + 'Monet Black ночью → Monet Black', await look(), { sc: 'dark', bg: BLACK });
  await set({ theme: 'monet-white' }); await sleep(700);
  check(k + 'Monet White ночью → Monet Dark', await look(), { sc: 'dark', bg: MDARK });
  await page.emulateMedia({ colorScheme: 'light' }); await sleep(700);
  check(k + 'Monet White днём → Monet White', await look(), { sc: 'light', bg: WHITE });
  await set({ theme: 'off', skin: false }); await sleep(700);
  check(k + 'всё выключено: «как в системе» ничего не трогает', (await look()).sc, 'dark');
  await set({ skin: true }); await sleep(700);
  check(k + 'Родная + новый дизайн: схема по системе', (await look()).sc, 'light');
  await set({ theme: 'grape' }); await sleep(500);
  const sel = '[data-focus-toggle-theme]:not(.focus-editor-panel)'; const cnt = await page.locator(sel).count();
  let clicked = false;
  for (let i = 0; i < cnt && !clicked; i++) { const l = page.locator(sel).nth(i); if (await l.isVisible()) { await Promise.all([page.waitForLoadState('load').catch(() => {}), l.click()]); clicked = true; } }
  if (kind === 'desktop') {
    check(k + 'переключатель ◐ форума найден', clicked, true);
    await sleep(2500);
    check(k + 'после ◐ форума схема всё равно по системе', (await look()).sc, 'light');
    await set({ scheme: 'site' }); await sleep(700);
    check(k + '«как на форуме»: теперь схема форума (◐ сделал её светлой)', (await look()).sc, 'light');
    for (let i = 0; i < cnt; i++) { const l = page.locator(sel).nth(i); if (await l.isVisible()) { await Promise.all([page.waitForLoadState('load').catch(() => {}), l.click()]); break; } }
    await sleep(2500);
    check(k + 'форум обратно в тёмной', (await look()).sc, 'dark');
  } else {
    await set({ scheme: 'site' }); await sleep(700);
  }
  await set({ theme: 'mint', skin: true, scheme: 'site' }); await sleep(500);
  const fsz = () => page.evaluate(() => { const p = document.querySelector('article.cPost [data-role="commentContent"]'); return parseFloat(getComputedStyle(p).fontSize); });
  check(k + 'текст постов обычный: 15px', await fsz(), 15);
  await set({ postSize: 'l' }); await sleep(600);
  check(k + 'текст постов «крупнее»: 16.875px', await fsz(), 16.875);
  await set({ postSize: 'xl' }); await sleep(600);
  check(k + 'текст постов «ещё крупнее»: 18.75px', await fsz(), 18.75);
  for (const w of kind === 'phone' ? [360, 412] : [1024, 1366]) {
    await page.setViewportSize({ width: w, height: 860 }); await sleep(900);
    const r = await page.evaluate(() => {
      const out = { wide: document.documentElement.scrollWidth > innerWidth + 1 || (() => { const vw = innerWidth; let n = 0; for (const el of document.body.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.width <= 0 || r.right <= vw + 1 || r.left >= vw || getComputedStyle(el).position === 'fixed') continue; let c = false; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(p).overflowX)) { c = true; break; } if (!c) n++; } return n; })() > 0, past: 0 };
      for (const rt of document.querySelectorAll('.ipsType_richText')) { const b = rt.getBoundingClientRect(); for (const e of rt.querySelectorAll('*')) { const q = e.getBoundingClientRect(); if (q.width && q.right > b.right + 1) out.past++; } }
      return out;
    });
    check(k + `«ещё крупнее» на ${w}px: нет прокрутки вбок и ничего не вылезает из постов`, r, { wide: false, past: 0 });
  }
  await set({ skin: false }); await sleep(600);
  check(k + 'новый дизайн выключен: размер текста не трогается', await page.evaluate(() => document.documentElement.hasAttribute('data-kadr-fs')), false);
  await set({ skin: true, postSize: 'm' }); await sleep(600);
  check(k + 'обычный размер: атрибута нет', await page.evaluate(() => document.documentElement.hasAttribute('data-kadr-fs')), false);
  check(k + 'ошибок скриптов нет', await page.evaluate(() => window.__errs), []);
  const pop = await ctx.newPage(); await pop.setViewportSize({ width: 380, height: 860 });
  await pop.emulateMedia({ colorScheme: 'light' });
  await pop.goto(`chrome-extension://${id}/popup.html`); await sleep(500);
  await pop.click('[data-sc="system"]'); await sleep(300);
  check(k + 'попап: «как в системе» сохраняется', await ctl.evaluate(() => new Promise((r) => chrome.storage.local.get('scheme', (d) => r(d.scheme)))), 'system');
  check(k + 'попап: превью светлое при светлой системе', await pop.evaluate(() => document.querySelector('.hero').classList.contains('light')), true);
  await pop.click('[data-fs="xl"]'); await sleep(300);
  check(k + 'попап: размер текста сохраняется', await ctl.evaluate(() => new Promise((r) => chrome.storage.local.get('postSize', (d) => r(d.postSize)))), 'xl');
  check(k + 'попап: отмечены выбранные кнопки', await pop.evaluate(() => [...document.querySelectorAll('#scSeg [aria-checked="true"], #fsSeg [aria-checked="true"]')].map((b) => b.dataset.sc || b.dataset.fs)), ['system', 'xl']);
  await pop.close();
  await ctx.close();
}
(async () => {
  await run('desktop');
  await run('phone');
  console.log(`day-night: ${n} checks, ${fails} failures`);
})().catch((e) => { console.error(e); process.exit(2); });
