const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const ext = path.resolve(process.argv[2]);
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, n = 0;
const check = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '\n       got  ' + JSON.stringify(got) + '\n       want ' + JSON.stringify(want))); };
const TOPIC = 'https://forum.ls-project.com/index.php?/topic/838-x/';
async function run(kind) {
  const dev = kind === 'phone' ? { viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent } : { viewport: { width: 1366, height: 900 } };
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-ts-')), { channel: 'chromium', headless: true, ...dev, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
  const set = (s) => ctl.evaluate((s) => new Promise((r) => chrome.storage.local.set(s, r)), s);
  await ctl.evaluate(() => new Promise((r) => chrome.storage.local.clear(r)));
  await set({ theme: 'mint', skin: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__errs = []; addEventListener('error', (e) => window.__errs.push(String(e.message))); });
  const k = kind + ': ';
  await page.goto(TOPIC, { waitUntil: 'load', timeout: 60000 }); await sleep(1500);
  await set({ theme: 'mint', skin: true }); await sleep(500);
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
  await pop.goto(`chrome-extension://${id}/popup.html`); await sleep(500);
  await pop.click('[data-fs="xl"]'); await sleep(300);
  check(k + 'попап: размер текста сохраняется', await ctl.evaluate(() => new Promise((r) => chrome.storage.local.get('postSize', (d) => r(d.postSize)))), 'xl');
  check(k + 'попап: отмечена выбранная кнопка', await pop.evaluate(() => [...document.querySelectorAll('#fsSeg [aria-checked="true"]')].map((b) => b.dataset.fs)), ['xl']);
  await pop.close();
  await ctx.close();
}
(async () => {
  await run('desktop');
  await run('phone');
  console.log(`text-size: ${n} checks, ${fails} failures`);
})().catch((e) => { console.error(e); process.exit(2); });
