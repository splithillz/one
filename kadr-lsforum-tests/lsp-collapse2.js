const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const argv = process.argv.slice(2);
const flag = (n) => { const a = argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const [extArg, out] = argv.filter((a) => !a.startsWith('--'));
const ext = path.resolve(extArg);
const LIGHT = argv.includes('--light'), REPLAY = flag('replay');
const RIDX = REPLAY ? JSON.parse(fs.readFileSync(path.join(REPLAY, 'index.json'), 'utf8')) : null;
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const check = (n, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + n + (info ? '  ' + info : '')); };
const DIFF = async (page, a, b, skip) => page.evaluate(async ([a, b, skip]) => {
  const load = async (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return createImageBitmap(new Blob([u], { type: 'image/png' })); };
  const A = await load(a), B = await load(b);
  const c = new OffscreenCanvas(A.width, A.height), x = c.getContext('2d');
  x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, A.width, A.height).data;
  x.clearRect(0, 0, A.width, A.height); x.drawImage(B, 0, 0); const db = x.getImageData(0, 0, A.width, A.height).data;
  let n = 0, maxd = 0; const s = A.width / skip.vw;
  for (let py = 0; py < A.height; py++) for (let px = 0; px < A.width; px++) {
    const cx = px / s, cy = py / s;
    if (cx >= skip.x - 2 && cx <= skip.x + skip.w + 2 && cy >= skip.y - 2 && cy <= skip.y + skip.h + 2) continue;
    const i = (py * A.width + px) * 4, d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
    if (d > 10) n++; if (d > maxd) maxd = d;
  }
  return { n, maxd };
}, [a, b, skip]);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const DEVS = [['phone', { viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent }],
    ['phone360', { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent }],
    ['tablet', { viewport: { width: 820, height: 1100 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }], ['desktop', { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 }]];
  const STATES = [['rose', { theme: 'rose', skin: true }], ['glass', { theme: 'grape', skin: true, fx: 'glass' }], ['material', { theme: 'cobalt', skin: true, fx: 'material' }],
    ['flat', { theme: 'mint', skin: true, shadows: false }], ['native', { theme: 'off', skin: true }], ['monet-white', { theme: 'monet-white', skin: true }], ['monet-black', { theme: 'monet-black', skin: true, icons: 'solar' }]];
  const looks = {};
  for (const [kind, dev] of DEVS) {
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-lc2-')), { channel: 'chromium', headless: true, ...dev, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
    if (REPLAY) { const html = fs.readFileSync(path.join(REPLAY, 'index.html'), 'utf8'); await ctx.route('**/*', (route) => { const req = route.request(), u = req.url(); if (u.startsWith('chrome-extension:')) return route.continue(); if (req.isNavigationRequest() && u === RIDX.index) return route.fulfill({ status: 200, contentType: 'text/html; charset=UTF-8', body: html }); if (['xhr', 'fetch', 'eventsource', 'websocket'].includes(req.resourceType())) return route.abort(); return route.continue(); }); }
    const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
    const set = (s) => ctl.evaluate((s) => new Promise((r) => chrome.storage.local.clear(() => chrome.storage.local.set(s, r))), s);
    const url = REPLAY ? RIDX.index : 'https://forum.ls-project.com/';
    if (LIGHT && !REPLAY) {
      await set({ theme: 'off', skin: false });
      const p = await ctx.newPage(); await p.goto(url, { waitUntil: 'load', timeout: 60000 }); await sleep(1200);
      const sel = '[data-focus-toggle-theme]:not(.focus-editor-panel)'; const n = await p.locator(sel).count();
      for (let i = 0; i < n; i++) { const l = p.locator(sel).nth(i); if (await l.isVisible()) { await Promise.all([p.waitForLoadState('load').catch(() => {}), l.click()]); break; } }
      await sleep(2500); await p.close();
    }
    for (const [sn, st] of STATES) {
      await set(st);
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'load', timeout: 60000 }); await page.evaluate(() => document.fonts.ready); await sleep(1700);
      const geo = () => page.evaluate(() => {
        const w = document.querySelector('.lsp-server-widget'), b = document.querySelector('.kadr-lsp-toggle'), hw = document.querySelector('.header-wrap') || document.querySelector('#ipsLayout_header');
        const cs = getComputedStyle(w), br = b.getBoundingClientRect(), hr = hw.getBoundingClientRect(), r = w.getBoundingClientRect();
        return { scheme: document.documentElement.getAttribute('data-focus-scheme'), header: +hr.height.toFixed(2), btn: { x: +br.left.toFixed(2), y: +br.top.toFixed(2), w: +br.width.toFixed(2), h: +br.height.toFixed(2) }, box: { x: r.left, y: r.top, w: r.width, h: Math.min(r.height, 300) },
          radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, bdf: cs.backdropFilter, border: cs.borderTopColor, shadow: cs.boxShadow.slice(0, 40), exp: b.getAttribute('aria-expanded') };
      });
      const a = await geo();
      const clip = { x: 0, y: 0, width: dev.viewport.width, height: Math.ceil(a.box.y + a.box.h + 24) };
      await page.screenshot({ path: path.join(out, `${kind}-${sn}-open.png`), clip });
      looks[kind + '/' + sn] = { radius: a.radius, bdf: a.bdf, bg: a.bg };
      await page.locator('.kadr-lsp-toggle').click(); await sleep(700);
      const b = await geo();
      const shotA = (await page.screenshot({ clip })).toString('base64');
      await page.addStyleTag({ content: '.lsp-server-widget, .lsp-server-widget * { visibility: hidden !important; transition: none !important; } .lsp-server-widget .kadr-lsp-toggle { visibility: visible !important; }' });
      await sleep(250);
      const shotB = (await page.screenshot({ clip })).toString('base64');
      fs.writeFileSync(path.join(out, `${kind}-${sn}-min.png`), Buffer.from(shotA, 'base64'));
      const d = await DIFF(page, shotA, shotB, { ...b.btn, vw: dev.viewport.width });
      await page.reload({ waitUntil: 'load' }); await sleep(1500);
      const c = await geo();
      const tag = `${REPLAY ? 'auth ' : ''}${LIGHT ? 'light ' : ''}${kind}/${sn}`;
      check(`${tag}: collapsed = only the button (pixels outside it identical to no widget)`, d.n === 0, `${d.n} px differ, max Δ ${d.maxd}`);
      check(`${tag}: header height kept`, a.header === b.header && a.header === c.header, `${a.header} → ${b.header} → reload ${c.header}`);
      check(`${tag}: button did not move`, a.btn.x === b.btn.x && a.btn.y === b.btn.y && c.btn.x === a.btn.x && c.btn.y === a.btn.y, JSON.stringify([a.btn.x, a.btn.y, b.btn.x, b.btn.y]));
      check(`${tag}: states and labels`, a.exp === 'true' && b.exp === 'false' && c.exp === 'false', `${a.exp} ${b.exp} ${c.exp}`);
      if (sn !== 'native' && sn !== 'material') check(`${tag}: expanded design (radius 18, blur 12 dark / 20 light)`, a.radius === '18px' && (a.scheme === 'light' ? /blur\(20px\)/ : /blur\(12px\)/).test(a.bdf), `${a.radius} ${a.bdf} ${a.bg}`);
      await page.close();
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, 'looks.json'), JSON.stringify(looks, null, 1));
  console.log(fails ? fails + ' FAILED' : 'all passed');
})().catch((e) => { console.error(e); process.exit(2); });
