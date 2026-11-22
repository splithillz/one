const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const { PAGES, BASE } = require('./pages');
const argv = process.argv.slice(2);
const flag = (n) => { const a = argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const [extArg, outDir] = argv.filter((a) => !a.startsWith('--'));
const ext = path.resolve(extArg);
const KIND = flag('kind') || 'phone', LIGHT = argv.includes('--light');
const REPLAY = flag('replay'), RIDX = REPLAY ? JSON.parse(fs.readFileSync(path.join(REPLAY, 'index.json'), 'utf8')) : null;
const RBYURL = RIDX ? Object.fromEntries(Object.entries(RIDX).map(([n, u]) => [u, n])) : null;
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SCAN = (want) => {
  const parse = (c) => { const m = c && c.match(/^rgba?\(([^)]+)\)$/); if (!m) return null; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const desc = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((x) => x && !/^kadr/.test(x)).slice(0, 2) : []; if (c.length) s += '.' + c.join('.'); return s; };
  const skip = (el) => el.closest('#ipsLayout_header, .focus-header, .header-wrap, #elMobileNav, .focus-mobile-footer, .lsp-header-widget, .ipsCoverPhoto, .cProfileHeader, kadr-sheet, .focus-nav, .ipsNavBar_primary, nav.ipsBreadcrumb, footer, #ipsLayout_footer, .ipsUserPhoto, img, video, iframe, .ipsCoverPhoto_container, #elProfileHeader, #elProfileStats, .cProfileRepScore, .ipsSideMenu_itemActive, .ipsProgressBar_progress, .ipsLeaderboard_trophy, .cke_top, [class*="cShareLink"], .ipsBadge, .ipsItemStatus, .ipsTag_prefix, .ipsReact_reaction, a[data-mentionid], .ipsCommentCount, .ipsButton_important, .ipsButton_primary, .ipsPagination_active, .focus-mobile-search');
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 16) continue;
    if (!el.checkVisibility || !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    if (skip(el)) continue;
    const cs = getComputedStyle(el); const bg = parse(cs.backgroundColor);
    if (!bg || bg[3] < 0.6) continue;
    const L = lum(bg);
    if ((want === 'light' && L < 0.25) || (want === 'dark' && L > 0.35)) out.push(desc(el) + ' ' + cs.backgroundColor + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  return { scheme: document.documentElement.getAttribute('data-focus-scheme'), patches: out.slice(0, 12), n: out.length };
};
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const dev = KIND === 'phone' ? { viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent } : { viewport: { width: 1366, height: 900 } };
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-mc-')), { channel: 'chromium', headless: true, ...dev, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  if (REPLAY) await ctx.route('**/*', (route) => { const req = route.request(), u = req.url(); if (u.startsWith('chrome-extension:')) return route.continue(); if (req.isNavigationRequest() && RBYURL[u]) return route.fulfill({ status: 200, contentType: 'text/html; charset=UTF-8', body: fs.readFileSync(path.join(REPLAY, RBYURL[u] + '.html'), 'utf8') }); if (['xhr', 'fetch', 'eventsource', 'websocket'].includes(req.resourceType())) return route.abort(); return route.continue(); });
  const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
  const set = (s) => ctl.evaluate((s) => new Promise((r) => chrome.storage.local.clear(() => chrome.storage.local.set(s, r))), s);
  if (LIGHT && !REPLAY) {
    await set({ theme: 'off', skin: false });
    const p = await ctx.newPage(); await p.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 }); await sleep(1200);
    const sel = '[data-focus-toggle-theme]:not(.focus-editor-panel)'; const n = await p.locator(sel).count();
    for (let i = 0; i < n; i++) { const l = p.locator(sel).nth(i); if (await l.isVisible()) { await Promise.all([p.waitForLoadState('load').catch(() => {}), l.click()]); break; } }
    await sleep(2500); await p.close();
  }
  const pages = REPLAY ? Object.entries(RIDX) : PAGES;
  let fails = 0;
  for (const [theme, want] of [['monet-white', 'light'], ['monet-dark', 'dark'], ['monet-black', 'dark']]) {
    await set({ theme, skin: true });
    for (const [name, url] of pages) {
      const page = await ctx.newPage();
      try { await page.goto(url, { waitUntil: 'load', timeout: 60000 }); await sleep(1600); } catch (e) { await page.close(); continue; }
      const r = await page.evaluate(SCAN, want);
      const ok = r.scheme === want && r.n === 0;
      if (!ok) fails++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${KIND}${LIGHT ? ' light' : ''}${REPLAY ? ' auth' : ''} ${theme.padEnd(11)} ${name.padEnd(11)} scheme ${r.scheme}${r.n ? ' patches ' + r.n + ': ' + r.patches.join(' | ') : ''}`);
      if (!ok) await page.screenshot({ path: path.join(outDir, `${KIND}${LIGHT ? '-light' : ''}${REPLAY ? '-auth' : ''}-${theme}-${name}.png`), fullPage: false });
      await page.close();
    }
  }
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await ctx.close();
})().catch((e) => { console.error(e); process.exit(2); });
