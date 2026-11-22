const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const { PAGES, BASE } = require('./pages');
const argv = process.argv.slice(2);
const flag = (n) => { const a = argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const [extArg, outDir] = argv.filter((a) => !a.startsWith('--'));
const KIND = flag('kind') || 'phone', LIGHT = argv.includes('--light'), AUTH = argv.includes('--auth'), ORIG = argv.includes('--orig');
const ONLY = flag('pages') ? flag('pages').split(',') : null;
const STATE = JSON.parse(flag('state') || '{"theme":"mint","skin":true}');
const STATES = flag('states') ? JSON.parse(flag('states')) : [STATE];
const slabel = (s) => [s.theme, s.fx, s.icons, s.shadows === false ? 'flat' : ''].filter(Boolean).join('+');
const { authPages } = require('./live-pages');
const TOL = +(flag('tol') || 1);
const EXTRA = flag('urls') ? JSON.parse(flag('urls')) : null;
const REPLAY = flag('replay');
const replay = async (page, name) => {
  const html = fs.readFileSync(path.join(REPLAY, name + '.html'), 'utf8');
  await page.route('**/*', (route) => {
    const req = route.request();
    if (req.url().startsWith('chrome-extension:')) return route.continue();
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) return route.fulfill({ status: 200, contentType: 'text/html; charset=UTF-8', body: html });
    if (['xhr', 'fetch', 'eventsource', 'websocket'].includes(req.resourceType())) return route.abort();
    return route.continue();
  });
};
const COLLECT = fs.readFileSync(path.join(__dirname, 'pp-collect.js'), 'utf8');
const EMPTY = path.join(__dirname, 'empty-ext');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ext = path.resolve(ORIG ? EMPTY : extArg);
const idOf = (p) => crypto.createHash('sha256').update(p).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const DEV = KIND === 'phone'
  ? { viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent }
  : KIND === 'tablet' ? { viewport: { width: 820, height: 1100 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent.replace('Mobile ', '') }
  : { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 };
const INK = async (page, boxes) => page.evaluate(async (boxes) => {
  const res = [];
  for (const b of boxes) {
    const bin = atob(b.png), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const blob = new Blob([u8], { type: 'image/png' });
    const bm = await createImageBitmap(blob);
    const W = bm.width, H = bm.height, s = W / b.rw;
    const c = new OffscreenCanvas(W, H), x = c.getContext('2d'); x.drawImage(bm, 0, 0);
    const d = x.getImageData(0, 0, W, H).data;
    const rad = Math.min(b.radius || 0, b.rw / 2, b.rh / 2) * s;
    const L = (b.bl + 1) * s, R = W - (b.br + 1) * s, T = (b.bt + 1) * s, B = H - (b.bb + 1) * s;
    const inside = (px, py) => { if (px < L || px >= R || py < T || py >= B) return false; const rr = Math.max(0, rad - Math.max(b.bl, b.bt) * s - s); if (rr <= 0) return true; const cx = px < L + rr ? L + rr : px > R - rr ? R - rr : px, cy = py < T + rr ? T + rr : py > B - rr ? B - rr : py; return (px - cx) ** 2 + (py - cy) ** 2 <= rr * rr; };
    const edge = [];
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { if (!inside(px, py)) continue; if (inside(px - 2 * s, py) && inside(px + 2 * s, py) && inside(px, py - 2 * s) && inside(px, py + 2 * s)) continue; const i = (py * W + px) * 4; edge.push([d[i], d[i + 1], d[i + 2]]); }
    if (edge.length < 4) { res.push(null); continue; }
    const med = [0, 1, 2].map((k) => edge.map((e) => e[k]).sort((a, z) => a - z)[edge.length >> 1]);
    let maxD = 0; const dist = new Float32Array(W * H);
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { if (!inside(px, py)) continue; const i = (py * W + px) * 4; const dd = Math.hypot(d[i] - med[0], d[i + 1] - med[1], d[i + 2] - med[2]); dist[py * W + px] = dd; if (dd > maxD) maxD = dd; }
    if (maxD < 40) { res.push({ none: true }); continue; }
    const th = maxD * 0.35;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sx = 0, sy = 0, sw = 0;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const v = dist[py * W + px]; if (v < th) continue; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); sx += px * v; sy += py * v; sw += v; }
    const icx = (x0 + x1 + 1) / 2 / s, icy = (y0 + y1 + 1) / 2 / s;
    const bcx = (b.bl + (b.rw - b.br)) / 2, bcy = (b.bt + (b.rh - b.bb)) / 2;
    res.push({ offX: +(icx - bcx).toFixed(2), offY: +(icy - bcy).toFixed(2), inkW: +((x1 - x0 + 1) / s).toFixed(1), inkH: +((y1 - y0 + 1) / s).toFixed(1) });
  }
  return res;
}, boxes);
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-pp-')), { channel: 'chromium', headless: true, ...DEV, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  let ctl = null;
  if (!ORIG) { ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${idOf(ext)}/popup.html`); }
  const { login, logout, isGuest } = require('./auth-login');
  if (AUTH) await login(ctx);
  if (LIGHT) {
    const p = await ctx.newPage(); await p.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 }); await sleep(1200);
    if (await p.evaluate(() => document.documentElement.dataset.focusScheme) !== 'light') {
      const sel = '[data-focus-toggle-theme]:not(.focus-editor-panel)'; const n = await p.locator(sel).count();
      for (let i = 0; i < n; i++) { const l = p.locator(sel).nth(i); if (await l.isVisible()) { await Promise.all([p.waitForLoadState('load').catch(() => {}), l.click()]); break; } }
      await sleep(2500);
    }
    await p.close();
  }
  let pages = REPLAY ? Object.entries(JSON.parse(fs.readFileSync(path.join(REPLAY, 'index.json'), 'utf8'))) : EXTRA ? Object.entries(EXTRA) : PAGES;
  if (AUTH && !EXTRA) pages = await authPages(ctx);
  if (ONLY) pages = pages.filter((p) => ONLY.includes(p[0]));
  const summary = [];
  for (const ST of STATES) {
  if (ctl) await ctl.evaluate((s) => new Promise((r) => chrome.storage.local.clear(() => chrome.storage.local.set(s, r))), ST);
  const SL = ORIG ? 'orig' : slabel(ST);
  for (const [name, url] of pages) {
    const page = await ctx.newPage();
    if (REPLAY) await replay(page, name);
    try { await page.goto(url, { waitUntil: 'load', timeout: 60000 }); } catch (e) { console.log('skip', name); await page.close(); continue; }
    await page.evaluate(() => document.fonts && document.fonts.ready); await sleep(1800);
    if (AUTH && await isGuest(page)) { console.log('session lost on', name, '— logging in again'); await login(ctx); await page.reload({ waitUntil: 'load' }); await sleep(1800); }
    const r = await page.evaluate(`(${COLLECT})({ tol: ${TOL} })`);
    const boxes = [];
    const shoot = async (list) => { for (const b of list) { if (b.rw > 120 || b.rh > 72) continue; const buf = await page.screenshot({ clip: { x: b.rx, y: b.ry, width: b.rw, height: b.rh }, fullPage: true }); boxes.push({ ...b, png: buf.toString('base64') }); } };
    await shoot(r.iconBoxes.filter((b) => b.inFixed));
    await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const p = getComputedStyle(el).position; if (p === 'fixed' || p === 'sticky') el.style.setProperty('visibility', 'hidden', 'important'); } });
    await shoot(r.iconBoxes.filter((b) => !b.inFixed));
    const ink = boxes.length ? await INK(page, boxes) : [];
    r.icons = [];
    boxes.forEach((b, i) => { const k = ink[i]; if (!k || k.none || k.inkW < 4 || k.inkH < 4 || /ipsButton_overlaid/.test(b.d)) return; const rec = { d: b.d, p: b.p, x: b.x, y: b.y, w: b.w, h: b.h, ...k }; if (Math.abs(k.offX) > 0.75 || Math.abs(k.offY) > 0.75) { r.icons.push(rec); if (process.env.PP_CROPS) { fs.mkdirSync(process.env.PP_CROPS, { recursive: true }); fs.writeFileSync(path.join(process.env.PP_CROPS, `${SL}-${name}-${i}.png`), Buffer.from(b.png, 'base64')); } } });
    r.iconChecked = ink.filter((k) => k && !k.none).length;
    delete r.iconBoxes;
    fs.writeFileSync(path.join(outDir, `${KIND}${LIGHT ? '-light' : ''}${AUTH || REPLAY ? '-auth' : ''}-${SL}-${name}.json`), JSON.stringify(r, null, 1));
    const line = `[${KIND}${LIGHT ? ' light' : ''}${AUTH || REPLAY ? ' auth' : ''}${ORIG ? ' ORIG' : ''}] ${SL.padEnd(18)} ${name.padEnd(11)} controls ${String(r.counts.leaf).padStart(4)} | text ${r.text.length} | rows ${r.rows.length} | icons ${r.icons.length}/${r.iconChecked}`;
    console.log(line); summary.push(line);
    await page.close();
  }
  }
  if (AUTH) { console.log('logout:', JSON.stringify(await logout(ctx))); console.log('blocked writes:', JSON.stringify(require('./auth-login').guardReport())); }
  fs.writeFileSync(path.join(outDir, `${KIND}${LIGHT ? '-light' : ''}${AUTH ? '-auth' : ''}-summary.txt`), summary.join('\n') + '\n');
  await ctx.close();
})().catch((e) => { console.error(e); process.exit(2); });
