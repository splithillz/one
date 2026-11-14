const fs = require('fs'), os = require('os'), path = require('path');
const { chromium, devices } = require('playwright');
const { B, STATES, PAGES, probe } = require('./xb-common');
const EXT = path.resolve(process.argv[2]), OUT = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const res = {};
  for (const kind of (process.env.KINDS || 'phone,desktop').split(',')) {
    const dev = kind === 'phone' ? { viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent } : { viewport: { width: 1366, height: 900 } };
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-xb-')), { channel: 'chromium', headless: true, colorScheme: 'light', ...dev, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
    const page = await ctx.newPage();
    for (const [sn, st] of Object.entries(STATES).filter(([n]) => !process.env.ONLY || process.env.ONLY.split(',').includes(n))) {
      await page.goto(B + '/#kadrtest=' + encodeURIComponent(JSON.stringify(st)), { waitUntil: 'load', timeout: 60000 }).catch(() => {});
      await sleep(1500);
      for (const [pn, pu] of PAGES.filter(([n]) => !process.env.PAGES || process.env.PAGES.split(',').includes(n))) {
        await page.goto(B + encodeURI(pu), { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('goto', pn, e.message.slice(0, 60)));
        await sleep(1800);
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < Math.min(h, 20000); y += 800) { await page.evaluate((v) => scrollTo(0, v), y); await sleep(40); }
        await page.evaluate(() => scrollTo(0, 0)); await sleep(900);
        res[`${kind}|${sn}|${pn}`] = await page.evaluate(probe);
        if (['index', 't34', 't838'].includes(pn) && ['mint', 'white', 'glass', 'material'].includes(sn)) await page.screenshot({ path: path.join(OUT, `cr-${kind}-${sn}-${pn}.png`) });
      }
      console.log(kind, sn, 'done');
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, process.env.TAG ? 'cr-' + process.env.TAG + '.json' : 'cr.json'), JSON.stringify(res));
})().catch((e) => { console.error('ERR', e.message.slice(0, 300)); process.exit(2); });
