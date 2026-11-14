const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const { PAGES } = require('./pages');
const argv = process.argv.slice(2);
const flag = (n) => { const a = argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const ext = path.resolve(argv[0]);
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const REPLAY = flag('replay'), RIDX = REPLAY ? JSON.parse(fs.readFileSync(path.join(REPLAY, 'index.json'), 'utf8')) : null;
const RBYURL = RIDX ? Object.fromEntries(Object.entries(RIDX).map(([n, u]) => [u, n])) : null;
const AUTH = argv.includes('--auth');
const { login, logout } = require('./auth-login');
const { authPages } = require('./live-pages');
let pages = REPLAY ? Object.entries(RIDX) : PAGES;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SCAN = () => {
  const desc = (e) => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const c = typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter((x) => x && !/^kadr/.test(x)).slice(0, 3) : []; if (c.length) s += '.' + c.join('.'); return s; };
  const out = {};
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e); if (!/flex|grid/.test(cs.display)) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(e, ps);
      if (p.content === 'none' || p.content === 'normal' || p.display === 'none' || p.position === 'absolute' || p.position === 'fixed') continue;
      const k = desc(e) + ps;
      out[k] = { disp: cs.display, jc: cs.justifyContent, gap: cs.columnGap + '/' + cs.rowGap, content: p.content.slice(0, 12), pdisp: p.display, w: p.width };
    }
  }
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e); if (!/flex|grid/.test(cs.display)) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    let n = 0, wsum = 0;
    for (const t of e.childNodes) { if (t.nodeType !== 3 || !/[^\s]| /.test(t.textContent) || !/^[\s ]*$/.test(t.textContent)) continue; const rg = document.createRange(); rg.selectNodeContents(t); const w = rg.getBoundingClientRect().width; n++; wsum += w; }
    if (n) out[desc(e) + ' [nbsp text items]'] = { disp: cs.display, jc: cs.justifyContent, gap: cs.columnGap + '/' + cs.rowGap, content: n + ' items', pdisp: 'text', w: wsum.toFixed(1) + 'px' };
  }
  return out;
};
(async () => {
  const res = {};
  for (const kind of ['phone', 'desktop']) {
    const dev = kind === 'phone' ? { viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent } : { viewport: { width: 1366, height: 900 } };
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-fp-')), { channel: 'chromium', headless: true, ...dev, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
    if (REPLAY) await ctx.route('**/*', (route) => { const req = route.request(), u = req.url(); if (u.startsWith('chrome-extension:')) return route.continue(); if (req.isNavigationRequest() && RBYURL[u]) return route.fulfill({ status: 200, contentType: 'text/html; charset=UTF-8', body: fs.readFileSync(path.join(REPLAY, RBYURL[u] + '.html'), 'utf8') }); if (req.isNavigationRequest()) return route.abort(); if (['xhr', 'fetch', 'eventsource', 'websocket'].includes(req.resourceType())) return route.abort(); return route.continue(); });
    const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
    if (AUTH) { await login(ctx); pages = await authPages(ctx); }
    for (const [pn, url] of pages) {
      const got = {};
      for (const st of [{ theme: 'off', skin: false }, { theme: 'rose', skin: true }]) {
        await ctl.evaluate((s) => new Promise((r) => chrome.storage.local.clear(() => chrome.storage.local.set(s, r))), st);
        const page = await ctx.newPage();
        try { await page.goto(url, { waitUntil: 'load', timeout: 60000 }); await sleep(1500); got[st.skin ? 'on' : 'off'] = await page.evaluate(SCAN); } catch (e) { got[st.skin ? 'on' : 'off'] = null; }
        await page.close();
      }
      if (!got.on || !got.off) { console.log('skip', kind, pn); continue; }
      for (const [k, v] of Object.entries(got.on)) if (!got.off[k]) { (res[k] = res[k] || { ...v, where: [] }).where.push(kind + ':' + pn); }
    }
    if (AUTH) console.log('logout:', JSON.stringify(await logout(ctx)));
    await ctx.close();
  }
  for (const [k, v] of Object.entries(res)) console.log(`${k}  ${v.disp} jc=${v.jc} gap=${v.gap} pseudo ${v.pdisp} w=${v.w} content=${v.content}  @ ${v.where.slice(0, 6).join(' ')}${v.where.length > 6 ? ' +' + (v.where.length - 6) : ''}`);
  console.log(Object.keys(res).length, 'pseudo-element flex/grid items created by the skin');
})().catch((e) => { console.error(e); process.exit(2); });
