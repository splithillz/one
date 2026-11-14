const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium } = require('playwright');
const ext = path.resolve(process.argv[2]);
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-off-')), { channel: 'chromium', headless: true, viewport: { width: 1366, height: 900 }, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
  const set = (s) => ctl.evaluate((s) => new Promise((r) => chrome.storage.local.set(s, r)), s);
  await set({ theme: 'mint', skin: true });
  const page = await ctx.newPage();
  await page.goto('https://forum.ls-project.com/', { waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(2000);
  const acc = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theme-brand_primary').trim());
  let bad = 0;
  for (const st of [{ theme: 'off', skin: true }, { theme: 'off', skin: false }]) {
    await set(st); await page.waitForTimeout(300);
    await page.evaluate(() => { for (let i = 0; i < 3; i++) document.body.appendChild(document.createElement('div')); });
    await page.waitForTimeout(700);
    const a = await acc(), styled = await page.evaluate(() => !!document.getElementById('kadr-theme'));
    const ok = a === '108, 154, 100' && !styled; if (!ok) bad++;
    console.log((ok ? 'ok   ' : 'FAIL ') + JSON.stringify(st) + ' accent ' + a + ' theme style in page: ' + styled);
  }
  await ctx.close();
  process.exit(bad ? 1 : 0);
})();
