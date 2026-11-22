const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const extDir = path.resolve(process.argv[2]);
const extId = crypto.createHash('sha256').update(extDir).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NATIVE = 'rgb(20, 20, 20)', MINT = 'rgb(11, 12, 13)';
(async () => {
  let bad = 0;
  for (const [name, dev] of [['phone', devices['Pixel 7']], ['desktop', { viewport: { width: 1366, height: 900 } }]]) {
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-ls-')), { channel: 'chromium', headless: true, ...dev, args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`] });
    const p0 = await ctx.newPage(); await p0.goto(`chrome-extension://${extId}/popup.html`);
    await p0.evaluate(() => new Promise((r) => chrome.storage.local.set({ theme: 'mint', skin: true }, r))); await p0.close();
    for (const url of ['https://forum.ls-project.com/', 'https://forum.ls-project.com/index.php?/topic/47-%D0%BB%D0%BE%D0%B3-%D0%BE%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B9/']) {
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__frames = [];
        const sample = () => { const b = document.body; window.__frames.push({ t: Math.round(performance.now()), bg: b ? getComputedStyle(b).backgroundColor : null, kids: b ? b.childElementCount : 0, rd: document.documentElement.classList.contains('kadr-rd'), th: !!document.getElementById('kadr-theme') }); };
        const loop = () => { const ch = new MessageChannel(); ch.port1.onmessage = sample; ch.port2.postMessage(0); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      });
      await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      await sleep(1000);
      const frames = await page.evaluate(() => window.__frames);
      const painted = frames.filter((f) => f.kids > 0);
      const nat = painted.filter((f) => f.bg !== MINT);
      const noRd = painted.filter((f) => !f.rd);
      console.log(`${name} ${url.length > 40 ? 'topic' : 'index'}: ${painted.length} frames with content, first at ${painted[0] && painted[0].t}ms bg=${painted[0] && painted[0].bg} theme-style=${painted[0] && painted[0].th}; ` +
        `frames not in theme colours: ${nat.length}${nat.length ? ' ' + JSON.stringify(nat.slice(0, 3)) : ''}; frames without redesign class: ${noRd.length}`);
      bad += nat.length + noRd.length;
      await page.close();
    }
    await ctx.close();
  }
  console.log(bad ? `\nPROBLEMS: ${bad}` : '\nno flash: every painted frame is already themed and redesigned');
})().catch((e) => { console.error(e); process.exit(2); });
