const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium } = require('playwright');
const ext = path.resolve(process.argv[2]);
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-ff-')), { channel: 'chromium', headless: true, viewport: { width: 1366, height: 900 }, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
  const set = (s) => ctl.evaluate((s) => new Promise((r) => chrome.storage.local.set(s, r)), s);
  await set({ theme: 'mint', skin: true });
  const page = await ctx.newPage();
  await page.goto('https://forum.ls-project.com/', { waitUntil: 'load', timeout: 60000 }); await sleep(2500);
  await page.evaluate(() => {
    const p = document.createElement('div'); p.id = 'probe'; p.textContent = 'Информационный раздел — Серверная информация';
    p.style.cssText = 'position:fixed;left:0;top:0;white-space:nowrap;font-size:40px;visibility:hidden';
    document.body.appendChild(p);
    window.__w = []; const loop = () => { window.__w.push(Math.round(p.getBoundingClientRect().width)); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  });
  for (const t of ['grape', 'cobalt', 'ember', 'mint', 'custom']) { await set(t === 'custom' ? { theme: 'custom', seed: '#ff5fa2' } : { theme: t }); await sleep(700); }
  const w = await page.evaluate(() => window.__w);
  const vals = [...new Set(w)];
  console.log(`frames ${w.length}, distinct widths ${JSON.stringify(vals.slice(0, 6))} -> ${vals.length === 1 ? 'NO FLASH' : 'FONT CHANGED ' + (w.filter((x) => x !== w[0]).length) + ' frames'}`);
  await ctx.close();
})().catch((e) => { console.error(e); process.exit(2); });
