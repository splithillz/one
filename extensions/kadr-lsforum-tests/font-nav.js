const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const ext = path.resolve(process.argv[2]);
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = 'https://forum.ls-project.com/index.php?/topic/';
let fails = 0, n = 0;
const check = (name, ok, extra) => { n++; if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); };
async function run(kind, cpu) {
  const dev = kind === 'phone' ? { viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent } : { viewport: { width: 1366, height: 900 } };
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-fnav-')), { channel: 'chromium', headless: true, ...dev, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
  const set = (s) => ctl.evaluate((s) => new Promise((r) => chrome.storage.local.set(s, r)), s);
  await ctl.evaluate(() => new Promise((r) => chrome.storage.local.clear(r)));
  await set({ theme: 'mint', skin: true });
  const page = await ctx.newPage();
  if (cpu > 1) { const c = await ctx.newCDPSession(page); await c.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
  await page.addInitScript(() => {
    window.__fn = { frames: 0, bad: 0 };
    const loop = () => { const f = window.__fn; if (document.body && document.body.childElementCount) { f.frames++; if (!document.fonts.check('15px Onest', 'Яz')) f.bad++; else return; } if (f.frames < 600) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  const k = `${kind}${cpu > 1 ? ' CPU x' + cpu : ''}`;
  for (const t of ['838-x', '35-x', '610-x', '905-x', '49-x']) {
    await page.goto(B + t + '/', { waitUntil: 'load', timeout: 60000 }); await sleep(800);
    const r = await page.evaluate(() => ({ bad: window.__fn.bad, onest: getComputedStyle(document.body).fontFamily.split(',')[0].replace(/"/g, '').trim() }));
    check(`${k} → тема ${t}: шрифт готов к первой отрисовке`, r.bad === 0 && r.onest === 'Onest', `кадров без шрифта ${r.bad}, шрифт ${r.onest}`);
  }
  await set({ skin: false }); await sleep(600);
  await page.goto(B + '838-x/', { waitUntil: 'load', timeout: 60000 }); await sleep(800);
  check(`${k}: новый дизайн выключен — шрифт Kadr в странице не остаётся`, await page.evaluate(() => [...document.fonts].every((f) => f.family.replace(/"/g, '') !== 'Onest')));
  await ctx.close();
}
(async () => {
  await run('phone', 4);
  await run('desktop', 4);
  console.log(`font-nav: ${n} checks, ${fails} failures`);
})().catch((e) => { console.error(e); process.exit(2); });
