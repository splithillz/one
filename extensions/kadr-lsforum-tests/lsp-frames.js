const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const ext = path.resolve(process.argv[2]);
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const check = (n, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (info ? '  ' + info : '')); };
const SAMPLER = () => {
  window.__lf = [];
  const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return p.length > 3 ? p[3] : 1; };
  const tick = () => {
    const w = document.querySelector('.lsp-server-widget');
    if (w) {
      const cs = getComputedStyle(w);
      let shown = 0;
      for (const c of w.children) { if (c.classList.contains('kadr-lsp-toggle')) continue; const k = getComputedStyle(c); if (k.visibility !== 'hidden' && parseFloat(k.opacity) > 0.02 && c.getBoundingClientRect().height > 0) shown = Math.max(shown, parseFloat(k.opacity)); }
      window.__lf.push({ t: performance.now(), min: document.documentElement.getAttribute('data-kadr-lsp') === 'min', bg: alpha(cs.backgroundColor), bdf: cs.backdropFilter !== 'none', shown });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
(async () => {
  const runs = [['phone', 'light', 'off'], ['phone', 'light', 'rose'], ['phone', 'dark', 'mint'], ['desktop', 'light', 'off'], ['desktop', 'dark', 'cobalt'], ['phone', 'light', 'monet-white'], ['phone', 'dark', 'grape:glass'], ['phone', 'light', 'cobalt:material']];
  for (const [kind, scheme, themeArg] of runs) {
    const [theme, fx] = themeArg.split(':');
    const dev = kind === 'phone' ? { viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent } : { viewport: { width: 1366, height: 900 } };
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-lf-')), { channel: 'chromium', headless: true, ...dev, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
    const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
    const set = (s) => ctl.evaluate((s) => new Promise((r) => chrome.storage.local.clear(() => chrome.storage.local.set(s, r))), s);
    if (scheme === 'light') {
      await set({ theme: 'off', skin: false });
      const p = await ctx.newPage(); await p.goto('https://forum.ls-project.com/', { waitUntil: 'load', timeout: 60000 }); await sleep(1200);
      const sel = '[data-focus-toggle-theme]:not(.focus-editor-panel)'; const n = await p.locator(sel).count();
      for (let i = 0; i < n; i++) { const l = p.locator(sel).nth(i); if (await l.isVisible()) { await Promise.all([p.waitForLoadState('load').catch(() => {}), l.click()]); break; } }
      await sleep(2500); await p.close();
    }
    await set(fx ? { theme, skin: true, fx } : { theme, skin: true });
    const page = await ctx.newPage();
    await page.goto('https://forum.ls-project.com/', { waitUntil: 'load', timeout: 60000 }); await sleep(1800);
    const sc = await page.evaluate(() => document.documentElement.getAttribute('data-focus-scheme'));
    await page.evaluate(SAMPLER); await sleep(300);
    const tag = `${kind} ${sc} ${themeArg}`;
    for (const step of ['collapse', 'expand']) {
      const t0 = await page.evaluate(() => { window.__lf.length = 0; return performance.now(); });
      await page.locator('.kadr-lsp-toggle').click();
      await sleep(900);
      const fr = await page.evaluate(() => window.__lf.slice());
      const after = fr.filter((f) => step === 'collapse' ? f.min : !f.min);
      const bad = step === 'collapse' ? after.filter((f) => f.shown > 0 || f.bg > 0.001 || f.bdf) : after.filter((f) => f.shown < 0.999 || f.bg < 0.05);
      check(`${tag}: ${step} happens in one frame (no frame with text and no panel, or panel and no text)`, after.length > 20 && bad.length === 0, `${after.length} frames after the click, ${bad.length} mixed` + (bad.length ? ' e.g. ' + JSON.stringify(bad[0]) : ''));
    }
    await ctx.close();
  }
  console.log(fails ? fails + ' FAILED' : 'all passed');
})().catch((e) => { console.error(e); process.exit(2); });
