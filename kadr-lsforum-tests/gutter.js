const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const ext = path.resolve(process.argv[2]); const AUTH = process.argv[3] === '--auth'; const REPLAY = AUTH ? null : (process.argv[3] || null);
const { login, logout } = require('./auth-login');
const { authPages } = require('./live-pages');
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const RIDX = REPLAY ? JSON.parse(fs.readFileSync(path.join(REPLAY, 'index.json'), 'utf8')) : null; const RBYURL = RIDX ? Object.fromEntries(Object.entries(RIDX).map(([n, u]) => [u, n])) : null;
const { PAGES } = require('./pages');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let pages = REPLAY ? Object.entries(RIDX).filter(([n]) => ['conv', 'messenger', 'me', 'index'].includes(n)) : PAGES.filter(([n]) => ['index', 'topic', 'topics', 'topic2', 'news', 'discover', 'online', 'staff', 'leaderboard', 'search'].includes(n));
  for (const st of [{ theme: 'off', skin: false }, { theme: 'rose', skin: true }]) for (const w of [360, 412, 600, 768, 900, 1024, 1366]) {
    const dev = w < 1000 ? { viewport: { width: w, height: 860 }, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent } : { viewport: { width: w, height: 900 } };
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-gt-')), { channel: 'chromium', headless: true, ...dev, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
    if (REPLAY) await ctx.route('**/*', (route) => { const req = route.request(), u = req.url(); if (u.startsWith('chrome-extension:')) return route.continue(); if (req.isNavigationRequest() && RBYURL[u]) return route.fulfill({ status: 200, contentType: 'text/html; charset=UTF-8', body: fs.readFileSync(path.join(REPLAY, RBYURL[u] + '.html'), 'utf8') }); if (req.isNavigationRequest()) return route.abort(); if (['xhr', 'fetch', 'eventsource', 'websocket'].includes(req.resourceType())) return route.abort(); return route.continue(); });
    const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
    await ctl.evaluate((s) => new Promise((r) => chrome.storage.local.clear(() => chrome.storage.local.set(s, r))), st);
    if (AUTH) { await login(ctx); pages = await authPages(ctx); }
    const row = [];
    for (const [pn, url] of pages) {
      const page = await ctx.newPage(); try { await page.goto(url, { waitUntil: 'load', timeout: 60000 }); await sleep(1300); } catch (e) { await page.close(); continue; }
      const g = await page.evaluate(() => {
        const vis = (e) => e && e.getBoundingClientRect().width > 0;
        const bc = [...document.querySelectorAll('nav.ipsBreadcrumb ul[data-role="breadcrumbList"] > li > a, nav.ipsBreadcrumb ul[data-role="breadcrumbList"] > li > span')].find(vis);
        const box = [...document.querySelectorAll('#ipsLayout_mainArea .ipsBox, #ipsLayout_mainArea .ipsPageHeader, #ipsLayout_mainArea .cForumList .ipsDataList, #ipsLayout_mainArea .ipsWidget')].find((e) => vis(e) && e.getBoundingClientRect().top > 0);
        const r = (e) => e ? Math.round(e.getBoundingClientRect().left * 10) / 10 : null;
        const rr = (e) => e ? Math.round(e.getBoundingClientRect().right * 10) / 10 : null;
        return { chip: r(bc), box: r(box), boxR: rr(box), vw: innerWidth };
      });
      row.push(`${pn}: chip ${g.chip} box ${g.box}…${g.boxR}`);
      await page.close();
    }
    console.log(`${st.skin ? 'skin' : 'off '} ${w}: ${row.join(' | ')}`);
    if (AUTH) await logout(ctx);
    await ctx.close();
  }
})().catch((e) => { console.error(e); process.exit(2); });
