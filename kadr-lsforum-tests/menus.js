const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const { PAGES } = require('./pages');
const argv = process.argv.slice(2);
const flag = (n) => { const a = argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const [extArg] = argv.filter((a) => !a.startsWith('--'));
const ext = path.resolve(extArg);
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const REPLAY = flag('replay'), RIDX = REPLAY ? JSON.parse(fs.readFileSync(path.join(REPLAY, 'index.json'), 'utf8')) : null;
const RBYURL = RIDX ? Object.fromEntries(Object.entries(RIDX).map(([n, u]) => [u, n])) : null;
const SHOTS = flag('shots'), DIAG = argv.includes('--diag'), RM = argv.includes('--rm'), AUTH = argv.includes('--auth'), MAX = +(flag('max') || (AUTH ? 24 : 8));
const { login, logout, isGuest, guardReport } = require('./auth-login');
const { authPages } = require('./live-pages');
const KINDS = (flag('kinds') || 'phone,desktop').split(',');
const STATES = { off: { theme: 'off', skin: false }, rose: { theme: 'rose', skin: true }, glass: { theme: 'grape', skin: true, fx: 'glass' }, material: { theme: 'cobalt', skin: true, fx: 'material' },
  mwhite: { theme: 'monet-white', skin: true }, mblack: { theme: 'monet-black', skin: true, icons: 'solar' }, native: { theme: 'off', skin: true }, flat: { theme: 'mint', skin: true, shadows: false } };
const stateNames = (flag('states') || 'off,rose,glass,material,mwhite,mblack').split(',');
const allPages = REPLAY ? Object.entries(RIDX) : PAGES;
const pageFilter = flag('pages') ? flag('pages').split(',') : null;
const pages = allPages.filter(([n]) => !pageFilter || pageFilter.includes(n));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, checks = 0; const failList = [];
const check = (n, ok, info) => { checks++; if (!ok) { fails++; failList.push(n + '  ' + (info || '')); } if (!ok || DIAG) console.log((ok ? 'ok   ' : 'FAIL ') + n + (info ? '  ' + info : '')); };
const FIND = ([max, all]) => {
  const out = [], seen = new Set();
  for (const el of document.querySelectorAll('[data-ipsmenu]')) {
    if (!el.id || el.closest('.ipsMenu')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const mattr = el.getAttribute('data-ipsmenu-menuid');
    const m = (mattr && (document.getElementById(mattr) || document.getElementById(mattr + '_menu'))) || document.getElementById(el.id + '_menu');
    if (!m) continue;
    if (!all && /notif|inbox|elFullNotifications|elFullInbox|elFullReports/i.test(el.id)) continue;
    const key = el.id.replace(/\d+/g, '#'); if (seen.has(key)) continue; seen.add(key);
    out.push({ tid: el.id, mid: m.id, label: (el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 24) });
    if (out.length >= max) break;
  }
  return out;
};
const STATE = (mid) => {
  const m = document.getElementById(mid); if (!m) return { vis: false, gone: true };
  const cs = getComputedStyle(m), r = m.getBoundingClientRect();
  const vis = cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && r.height > 0 && r.width > 0;
  return { vis, op: +parseFloat(cs.opacity).toFixed(2), cls: m.className };
};
const INSPECT = (mid) => {
  const m = document.getElementById(mid), cs = getComputedStyle(m), r = m.getBoundingClientRect();
  const alpha = (c) => { const x = c.match(/rgba?\(([^)]+)\)/); if (!x) return 0; const p = x[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return p.length > 3 ? p[3] : 1; };
  const desc = (e) => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const c = typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter((x) => x && !/^kadr/.test(x)).slice(0, 2) : []; if (c.length) s += '.' + c.join('.'); return s; };
  let L = r.left, T = r.top, R = r.right, B = r.bottom; const clippers = [], ctxs = [];
  for (let e = m.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { const q = e.getBoundingClientRect(); const nl = Math.max(L, q.left), nt = Math.max(T, q.top), nr = Math.min(R, q.right), nb = Math.min(B, q.bottom); if (nl > L + 1 || nt > T + 1 || nr < R - 1 || nb < B - 1) clippers.push(desc(e) + ' overflow ' + s.overflowX + '/' + s.overflowY); L = nl; T = nt; R = nr; B = nb; }
    if (s.backdropFilter !== 'none' || s.filter !== 'none' || s.transform !== 'none' || parseFloat(s.opacity) < 1 || (s.zIndex !== 'auto' && s.position !== 'static') || s.isolation === 'isolate' || s.contain.includes('paint')) ctxs.push(desc(e) + (s.backdropFilter !== 'none' ? ' bdf' : '') + (s.transform !== 'none' ? ' tf' : '') + (s.zIndex !== 'auto' ? ' z' + s.zIndex : ''));
  }
  const vw = innerWidth, vh = innerHeight;
  const offscreen = r.left < -1 || r.right > vw + 1;
  const items = [...m.querySelectorAll('.ipsMenu_item > a, .ipsMenu_item > span, .ipsMenu_title, .ipsMenu_item label')].filter((e) => e.getBoundingClientRect().height > 4);
  const occluded = [];
  for (const it of items) {
    const q = it.getBoundingClientRect(), x = Math.min(Math.max(q.left + Math.min(q.width / 2, 40), 2), vw - 2), y = q.top + q.height / 2;
    if (y < 2 || y > vh - 2) continue;
    const top = document.elementFromPoint(x, y);
    if (top && !m.contains(top)) occluded.push((it.textContent || '').trim().slice(0, 14) + ' under ' + desc(top));
  }
  const path = []; for (let e = m.parentElement; e && path.length < 4; e = e.parentElement) path.push(desc(e));
  return { bg: cs.backgroundColor, alpha: alpha(cs.backgroundColor), bdf: cs.backdropFilter, z: cs.zIndex, pos: cs.position, clipped: clippers, ctxs: ctxs.slice(0, 4), offscreen, occluded: occluded.slice(0, 3), nItems: items.length, path: path.join(' < '), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] };
};
const PICK = ([mid, tid]) => {
  const m = document.getElementById(mid), t = document.getElementById(tid), mr = m.getBoundingClientRect();
  const fixedAnc = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  const interactive = (el) => !!el.closest('a, button, input, select, textarea, label, summary, [data-ipsmenu], [data-action], [role="button"], [contenteditable], iframe, video, img, [data-ipstooltip], [data-ipshover], [data-role]');
  for (let y = 110; y < innerHeight - 90; y += 13) for (let x = 30; x < innerWidth - 30; x += 17) {
    if (x > mr.left - 30 && x < mr.right + 30 && y > mr.top - 30 && y < mr.bottom + 30) continue;
    const el = document.elementFromPoint(x, y); if (!el || el === document.documentElement || el === document.body) continue;
    if (m.contains(el) || (t && t.contains(el)) || interactive(el) || fixedAnc(el)) continue;
    const clickable = (n) => !!n.closest('a[href], button, input, select, textarea, label, summary, [data-ipsmenu], [role="button"], [onclick], [data-action]');
    let near = false; for (const [dx, dy] of [[-28, 0], [28, 0], [0, -28], [0, 28], [-20, -20], [20, -20], [-20, 20], [20, 20]]) { const n = document.elementFromPoint(x + dx, y + dy); if (n && (clickable(n) || m.contains(n) || (t && t.contains(n)))) { near = true; break; } }
    if (near) continue;
    return { x, y };
  }
  return null;
};
(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  for (const kind of KINDS) {
    const dev = kind === 'phone' ? { viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent } : { viewport: { width: 1366, height: 900 } };
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-menus-')), { channel: 'chromium', headless: true, ...dev, reducedMotion: RM ? 'reduce' : 'no-preference', args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
    if (REPLAY) await ctx.route('**/*', (route) => { const req = route.request(), u = req.url(); if (u.startsWith('chrome-extension:')) return route.continue(); if (req.isNavigationRequest() && RBYURL[u]) return route.fulfill({ status: 200, contentType: 'text/html; charset=UTF-8', body: fs.readFileSync(path.join(REPLAY, RBYURL[u] + '.html'), 'utf8') }); if (req.isNavigationRequest() && req.frame().parentFrame() === null) return route.abort(); if (['xhr', 'fetch', 'eventsource', 'websocket'].includes(req.resourceType())) return route.abort(); return route.continue(); });
    const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
    let kpages = pages;
    if (AUTH) { await login(ctx); kpages = (await authPages(ctx)).filter(([n]) => !pageFilter || pageFilter.includes(n)); console.log('account pages:', kpages.map((x) => x[0]).join(' ')); }
    for (const sn of stateNames) {
      await ctl.evaluate((s) => new Promise((r) => chrome.storage.local.clear(() => chrome.storage.local.set(s, r))), STATES[sn]);
      for (const [pname, url] of kpages) {
        const page = await ctx.newPage();
        try { await page.goto(url, { waitUntil: 'load', timeout: 60000 }); } catch (e) { console.log('skip', pname, e.message.slice(0, 60)); await page.close(); continue; }
        await sleep(1500);
        if (DIAG) page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('  NAVIGATED to', f.url().slice(0, 120)); });
        if (AUTH && await isGuest(page)) { console.log('session lost — logging in again'); await login(ctx); await page.reload({ waitUntil: 'load' }); await sleep(1500); }
        const trig = await page.evaluate(FIND, [MAX, AUTH]);
        const tag = `${REPLAY ? 'auth ' : ''}${AUTH ? 'live ' : ''}${RM ? 'rm ' : ''}${kind}/${sn}/${pname}`;
        if (DIAG) console.log(`# ${tag}: ${trig.length} menus: ${trig.map((t) => t.tid + '«' + t.label + '»').join(', ')}`);
        for (const t of trig) {
          const T = page.locator('#' + CSS_ESC(t.tid)).filter({ visible: true }).first();
          let usable = false, lastErr = '';
          for (let attempt = 0; attempt < 2 && !usable; attempt++) {
            try {
              await T.evaluate((e) => e.scrollIntoView({ block: 'center' }), null, { timeout: 8000 }); await sleep(250);
              if (kind === 'phone') await T.tap({ timeout: 4000 }); else await T.click({ timeout: 4000 });
              usable = true;
            } catch (e) { lastErr = e.message.split('\n')[0].slice(0, 80); if (attempt === 0) { await page.reload({ waitUntil: 'load' }).catch(() => {}); await sleep(1500); } }
          }
          if (!usable) { check(`${tag} «${t.label || t.tid}»: trigger usable`, false, lastErr); continue; }
          await sleep(500);
          if (DIAG) console.log('  tapped', t.tid, '→ url', page.url().slice(-60));
          const s1 = await page.evaluate(STATE, t.mid);
          if (!s1.vis) { if (DIAG) console.log(`  ${t.tid}: did not open (${s1.cls})`); continue; }
          const ins = await page.evaluate(INSPECT, t.mid);
          if (DIAG) console.log(`  ${t.tid} → ${t.mid}: ${JSON.stringify(ins)}`);
          if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${tag.replace(/[\/ ]/g, '_')}_${t.tid}.png`) });
          const name = `${tag} «${t.label || t.tid}»`;
          if (sn !== 'off') {
            check(`${name}: opaque menu`, ins.alpha >= 0.9, `bg ${ins.bg}`);
            check(`${name}: not clipped by a parent`, ins.clipped.length === 0, ins.clipped.join('; '));
            check(`${name}: not covered by other boxes`, ins.occluded.length === 0, ins.occluded.join('; '));
            check(`${name}: inside the screen`, !ins.offscreen, JSON.stringify(ins.rect));
          }
          let p = await page.evaluate(PICK, [t.mid, t.tid]);
          for (const dy of [260, -520]) { if (p) break; await page.evaluate((dy) => window.scrollBy(0, dy), dy); await sleep(400); if (!(await page.evaluate(STATE, t.mid)).vis) break; p = await page.evaluate(PICK, [t.mid, t.tid]); }
          if (!(await page.evaluate(STATE, t.mid)).vis) { if (DIAG) console.log('  menu closed on scroll — skipping the outside tap'); }
          else if (!p) { check(`${name}: found a neutral place to tap`, false); continue; }
          if (p && (await page.evaluate(STATE, t.mid)).vis) {
          if (kind === 'phone') await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
          await sleep(800);
          const s2 = await page.evaluate(STATE, t.mid);
          check(`${name}: closes on a tap outside`, !s2.vis, `op ${s2.op} class "${s2.cls}" tap ${p.x},${p.y}`);
          }
          const s2 = await page.evaluate(STATE, t.mid);
          if (s2.vis) { await page.evaluate((mid) => { const m = document.getElementById(mid); m.style.display = 'none'; m.className = m.className.replace(/ipsAnim\S*/g, ''); }, t.mid); await sleep(200); }
          try { if (kind === 'phone') await T.tap({ timeout: 3000 }); else await T.click({ timeout: 3000 }); } catch (e) { continue; }
          await sleep(500);
          const s3 = await page.evaluate(STATE, t.mid);
          if (!s3.vis) { check(`${name}: opens again`, false, s3.cls); continue; }
          let covered = false;
          try { if (kind === 'phone') await T.tap({ timeout: 3000 }); else await T.click({ timeout: 3000 }); } catch (e) { covered = true; }
          await sleep(800);
          const s4 = await page.evaluate(STATE, t.mid);
          if (!covered) check(`${name}: closes on a second tap of its button`, !s4.vis, `op ${s4.op} class "${s4.cls}"`);
          else if (DIAG) console.log('  the open menu covers its own button — second tap not checked');
          if (s4.vis) { const q = await page.evaluate(PICK, [t.mid, t.tid]); if (q) { if (kind === 'phone') await page.touchscreen.tap(q.x, q.y); else await page.mouse.click(q.x, q.y); } else await page.keyboard.press('Escape').catch(() => {}); await sleep(700); }
          await page.evaluate((mid) => { const m = document.getElementById(mid); if (m && getComputedStyle(m).display !== 'none') { m.style.display = 'none'; } }, t.mid);
        }
        const ghosts = await page.evaluate(() => [...document.querySelectorAll('.ipsMenu')].filter((m) => { const cs = getComputedStyle(m), r = m.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && r.height > 0 && !m.style.display; }).map((m) => m.id));
        check(`${tag}: no leftover menus on the page`, ghosts.length === 0, ghosts.join(' '));
        await page.close();
      }
    }
    if (AUTH) { console.log('logout:', JSON.stringify(await logout(ctx))); console.log('blocked writes:', JSON.stringify(guardReport())); }
    await ctx.close();
  }
  console.log(`${checks} checks, ${fails ? fails + ' FAILED' : 'all passed'}`);
})().catch((e) => { console.error(e); process.exit(2); });
function CSS_ESC(s) { return s.replace(/([^\w-])/g, '\\$1'); }
