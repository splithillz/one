const puppeteer = require('puppeteer');
const fs = require('fs'), path = require('path');
const { B, STATES, PAGES, UA_PHONE_FF, probe } = require('./xb-common');
const FF = process.env.FF, EXT = path.resolve(process.argv[2]), OUT = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const res = {};
  for (const kind of (process.env.KINDS || 'phone,desktop').split(',')) {
    const prefs = { 'extensions.originControls.grantByDefault': true, 'layout.css.prefers-color-scheme.content-override': 1, 'ui.useOverlayScrollbars': 1 };
    if (kind === 'phone') Object.assign(prefs, { 'general.useragent.override': UA_PHONE_FF, 'dom.w3c_touch_events.enabled': 1 });
    const browser = await puppeteer.launch({ browser: 'firefox', executablePath: FF, headless: true, acceptInsecureCerts: true, extraPrefsFirefox: prefs });
    await browser.installExtension(EXT);
    const page = await browser.newPage();
    await page.setViewport(kind === 'phone' ? { width: 412, height: 860, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { width: 1366, height: 900, deviceScaleFactor: 1 });
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
        if (['index', 't34', 't838'].includes(pn) && ['mint', 'white', 'glass', 'material'].includes(sn)) await page.screenshot({ path: path.join(OUT, `ff-${kind}-${sn}-${pn}.png`) });
      }
      console.log(kind, sn, 'done');
    }
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, process.env.TAG ? 'ff-' + process.env.TAG + '.json' : 'ff.json'), JSON.stringify(res));
})().catch((e) => { console.error('ERR', e.message.slice(0, 300)); process.exit(2); });
