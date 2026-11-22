const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const { login, logout, isGuest, guardReport, guardBodies, GUARD } = require('./auth-login');
const { authPages } = require('./live-pages');
const { PAGES } = require('./pages');
const argv = process.argv.slice(2);
const flag = (n) => { const a = argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const [extArg, OUT] = argv.filter((a) => !a.startsWith('--'));
const ext = path.resolve(extArg);
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const AUTH = argv.includes('--auth');
const KINDS = (flag('kinds') || 'phone,desktop').split(',');
const STATES = { off: { theme: 'off', skin: false }, rose: { theme: 'rose', skin: true }, glass: { theme: 'grape', skin: true, fx: 'glass' }, material: { theme: 'cobalt', skin: true, fx: 'material' },
  mwhite: { theme: 'monet-white', skin: true, icons: 'remix' }, mblack: { theme: 'monet-black', skin: true, icons: 'solar' }, flat: { theme: 'mint', skin: true, shadows: false } };
const stateNames = (flag('states') || 'off,rose,glass,mblack').split(',');
if (stateNames[0] !== 'off') stateNames.unshift('off');
const ONLY = flag('pages') ? flag('pages').split(',') : null;
const COLLECT = fs.readFileSync(path.join(__dirname, 'pp-collect.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const ref = {};
let checks = 0, fails = 0, same = 0, skips = 0; const failList = [];
function rec(kind, sn, pname, name, ok, info) {
  const key = `${kind}/${pname}/${name}`;
  if (sn === 'off') { ref[key] = ok; return; }
  checks++;
  if (ok) return;
  if (ref[key] === false) { same++; console.log(`same-as-forum ${kind}/${sn}/${pname}: ${name}  ${info || ''}`); return; }
  fails++; failList.push(`${kind}/${sn}/${pname}: ${name}  ${info || ''}`); console.log(`FAIL ${kind}/${sn}/${pname}: ${name}  ${info || ''}`);
}
const H = {
  vis: (e) => !!(e && e.getClientRects().length && e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && parseFloat(getComputedStyle(e).opacity) > 0.05),
};
const OUTSIDE = (sel) => {
  const vis = (e) => !!(e && e.getClientRects().length && e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && parseFloat(getComputedStyle(e).opacity) > 0.05);
  const els = [...document.querySelectorAll(sel)].filter(vis); const R = els.map((e) => e.getBoundingClientRect());
  const fixedAnc = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  const interactive = (el) => !!el.closest('a, button, input, select, textarea, label, summary, [data-ipsmenu], [data-action], [role="button"], [contenteditable], iframe, video, img, [data-ipstooltip], [data-ipshover], [data-role], .ipsMenu, .ipsDialog, .cke');
  for (let y = 120; y < innerHeight - 110; y += 19) for (let x = 40; x < innerWidth - 40; x += 23) {
    if (R.some((r) => x > r.left - 30 && x < r.right + 30 && y > r.top - 30 && y < r.bottom + 30)) continue;
    const el = document.elementFromPoint(x, y); if (!el || el === document.documentElement || el === document.body) continue;
    if (interactive(el) || fixedAnc(el) || els.some((m) => m.contains(el))) continue;
    let near = false; for (const [dx, dy] of [[-32, 0], [32, 0], [0, -32], [0, 32], [-23, -23], [23, -23], [-23, 23], [23, 23], [-16, 0], [16, 0], [0, -16], [0, 16]]) { const n = document.elementFromPoint(x + dx, y + dy); if (n && (interactive(n) || els.some((m) => m.contains(n)))) { near = true; break; } }
    if (near) continue;
    return { x, y };
  }
  return null;
};
const inPage = {
  mark: ([sel, max, extra]) => {
    const vis = (e) => !!(e && e.getClientRects().length && e.checkVisibility({ visibilityProperty: true, opacityProperty: true }));
    document.querySelectorAll('[data-kt]').forEach((e) => e.removeAttribute('data-kt'));
    const seen = new Set(), out = [];
    for (const e of document.querySelectorAll(sel)) {
      if (!vis(e) || e.closest('.ipsMenu, .ipsDialog, .cke, #elMobileDrawer, .ipsHovercard, kadr-sheet')) continue;
      const href = e.getAttribute('href') || '', durl = e.getAttribute('data-ipsdialog-url') || '';
      if (extra === 'dialog') {
        if (/csrfKey|[?&]do=(delete|hide|unhide|lock|unlock|pin|unpin|feature|unfeature|move|merge|split|mark\w*|react\w*|unreact\w*|approve|unapprove|ban|warn|logout|ignore)/i.test(href + ' ' + durl)) continue;
        if (/login|register|signin/i.test(href + durl)) continue;
      }
      const key = (e.getAttribute('data-ipsdialog-title') || e.getAttribute('data-action') || '') + '|' + (href + durl).replace(/\d+/g, '#').replace(/#.*$/, '').replace(/csrfKey=\w+/, '');
      if (seen.has(key)) continue; seen.add(key);
      e.setAttribute('data-kt', String(out.length));
      out.push({ i: out.length, label: (e.getAttribute('data-ipsdialog-title') || e.getAttribute('title') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), href: href.replace(/csrfKey=\w+/, '').slice(-60) });
      if (out.length >= max) break;
    }
    return out;
  },
  overflow: () => document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth : (() => { const vw = innerWidth; let n = 0; for (const el of document.body.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.width <= 0 || r.right <= vw + 1 || r.left >= vw || getComputedStyle(el).position === 'fixed') continue; let c = false; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(p).overflowX)) { c = true; break; } if (!c) n++; } return n; })(),
  boxInfo: (sel) => {
    const vis = (e) => !!(e && e.getClientRects().length && e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && parseFloat(getComputedStyle(e).opacity) > 0.05);
    const els = [...document.querySelectorAll(sel)].filter(vis); if (!els.length) return null;
    const e = els[els.length - 1], r = e.getBoundingClientRect();
    const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return p.length > 3 ? p[3] : 1; };
    let bgA = 0; for (let n = e; n && n !== document.body && bgA < 0.9; n = n.parentElement) { bgA = Math.max(bgA, alpha(getComputedStyle(n).backgroundColor)); if (n.querySelector && n !== e) break; }
    const inner = [...e.querySelectorAll('*')].slice(0, 400).reduce((m, k) => Math.max(m, alpha(getComputedStyle(k).backgroundColor) * (k.getBoundingClientRect().width > r.width * 0.8 ? 1 : 0)), 0);
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, bgA: Math.max(bgA, inner), in: r.left >= -1 && r.right <= innerWidth + 1 };
  },
  anyVisible: (sel) => { const vis = (e) => !!(e && e.getClientRects().length && e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && parseFloat(getComputedStyle(e).opacity) > 0.05); return [...document.querySelectorAll(sel)].some(vis); },
};
async function ppFails(page) {
  await page.evaluate(() => { (window.__mutes = window.__mutes || []).push([performance.now(), Infinity]); }).catch(() => {});
  const r = await page.evaluate(`(${COLLECT})({ tol: 1 })`).catch(() => null);
  await page.evaluate(() => { const m = window.__mutes[window.__mutes.length - 1]; m[1] = performance.now(); }).catch(() => {});
  if (!r) return new Set();
  return new Set([...r.text, ...r.rows].map((f) => (f.p || f.d || JSON.stringify(f)).slice(0, 160)));
}
const tapOrClick = async (kind, page, loc) => { if (kind === 'phone') await loc.tap({ timeout: 5000 }); else await loc.click({ timeout: 5000 }); };
async function waitFor(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch (e) { return false; } }
async function routines(kind, sn, pname, page, R) {
  const T = (name, ok, info) => R(name, ok, info);
  const vw = page.viewportSize().width;
  const sp = page.locator('.ipsSpoiler_header').filter({ visible: true }).first();
  if (await sp.count()) {
    await sp.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(300);
    await tapOrClick(kind, page, sp); await sleep(900);
    const open = await page.evaluate(() => { const s = document.querySelector('.ipsSpoiler'); const c = s && s.querySelector('.ipsSpoiler_contents'); if (!c) return null; const r = c.getBoundingClientRect(); const imgs = [...c.querySelectorAll('img')].map((i) => i.getBoundingClientRect()).filter((q) => q.width > 0); return { shown: r.height > 0 && getComputedStyle(c).display !== 'none', wide: imgs.filter((q) => q.right > r.right + 1).length }; });
    T('spoiler opens', !!(open && open.shown), JSON.stringify(open));
    T('spoiler images fit the post', !!(open && open.wide === 0), JSON.stringify(open));
    T('no sideways scroll with the spoiler open', !(await page.evaluate(inPage.overflow)));
    await tapOrClick(kind, page, sp); await sleep(900);
    T('spoiler closes', await page.evaluate(() => { const c = document.querySelector('.ipsSpoiler .ipsSpoiler_contents'); return !c || c.getBoundingClientRect().height === 0 || getComputedStyle(c).display === 'none'; }));
  }
  const tabs = await page.evaluate(inPage.mark, ['.ipsTabs [role="tab"]:not([aria-selected="true"]):not(.ipsTabs_activeItem), .ipsTabs .ipsTabs_item:not(.ipsTabs_activeItem)', 3]);
  for (const t of tabs) {
    const loc = page.locator(`[data-kt="${t.i}"]`); if (!(await loc.count())) continue;
    const before = page.url();
    await loc.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {}); await sleep(200);
    await Promise.all([page.waitForLoadState('load').catch(() => {}), tapOrClick(kind, page, loc).catch(() => {})]); await sleep(1500);
    const st = await page.evaluate((lab) => { const a = [...document.querySelectorAll('.ipsTabs [role="tab"], .ipsTabs .ipsTabs_item')].find((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) === lab); return a ? (a.getAttribute('aria-selected') === 'true' || a.classList.contains('ipsTabs_activeItem')) : null; }, t.label);
    T(`tab «${t.label}» becomes active`, st !== false, `url ${page.url() !== before ? 'changed' : 'same'}`);
    T(`no sideways scroll on tab «${t.label}»`, !(await page.evaluate(inPage.overflow)));
  }
  const dlg = await page.evaluate(inPage.mark, ['a[data-ipsdialog], button[data-ipsdialog]', 6, 'dialog']);
  for (const d of dlg) {
    const loc = page.locator(`[data-kt="${d.i}"]`); if (!(await loc.count())) continue;
    const pp0 = await ppFails(page);
    await loc.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {}); await sleep(250);
    try { await tapOrClick(kind, page, loc); } catch (e) { T(`dialog «${d.label}»: its button works`, false, e.message.split('\n')[0].slice(0, 80)); continue; }
    const opened = await waitFor(page, () => [...document.querySelectorAll('.ipsDialog')].some((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none' && parseFloat(getComputedStyle(e).opacity) > 0.9 && ![...e.querySelectorAll('.ipsDialog_loading')].some((l) => l.getClientRects().length && l.checkVisibility()) && (e.querySelector('.ipsDialog_content') || e).innerText.trim().length > 0), null, 12000);
    if (!opened) { T(`dialog «${d.label}» opens`, false); await page.keyboard.press('Escape').catch(() => {}); await sleep(600); continue; }
    await sleep(500);
    const bi = await page.evaluate(inPage.boxInfo, '.ipsDialog');
    T(`dialog «${d.label}»: fits the screen`, !!(bi && bi.in), JSON.stringify(bi));
    T(`dialog «${d.label}»: solid background`, !!(bi && bi.bgA >= 0.9), bi ? 'alpha ' + bi.bgA : '');
    T(`dialog «${d.label}»: has a visible close button`, await page.evaluate(() => [...document.querySelectorAll('.ipsDialog .ipsDialog_close')].some((e) => e.getClientRects().length && e.checkVisibility())));
    T(`dialog «${d.label}»: no sideways scroll`, !(await page.evaluate(inPage.overflow)));
    const pp1 = await ppFails(page); const fresh = [...pp1].filter((k) => !pp0.has(k) && /ipsDialog/.test(k));
    T(`dialog «${d.label}»: buttons and text inside are centred and in line`, fresh.length === 0, fresh.slice(0, 3).join(' ; '));
    if (process.env.SHOTS) await page.screenshot({ path: path.join(OUT, `${kind}-${sn}-${pname}-dialog-${d.i}.png`) }).catch(() => {});
    const x = page.locator('.ipsDialog .ipsDialog_close').filter({ visible: true }).last();
    if (await x.count()) { await tapOrClick(kind, page, x).catch(() => {}); }
    await sleep(1000);
    T(`dialog «${d.label}»: the close button closes it with its backdrop`, !(await page.evaluate(inPage.anyVisible, '.ipsDialog, .ipsModal')));
    try { await tapOrClick(kind, page, loc); } catch (e) { continue; }
    if (await waitFor(page, () => [...document.querySelectorAll('.ipsDialog')].some((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none' && parseFloat(getComputedStyle(e).opacity) > 0.9), null, 10000)) {
      await sleep(400);
      const b2 = await page.evaluate(inPage.boxInfo, '.ipsDialog');
      const pt = !b2 ? null : b2.y >= 60 ? { x: Math.round(b2.vw / 2), y: Math.round(b2.y / 2) } : b2.y + b2.h <= b2.vh - 60 ? { x: Math.round(b2.vw / 2), y: Math.round((b2.y + b2.h + b2.vh) / 2) } : b2.x >= 60 ? { x: Math.round(b2.x / 2), y: Math.round(b2.vh / 2) } : null;
      if (pt) {
        if (kind === 'phone') await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
        await sleep(1000);
        T(`dialog «${d.label}»: tapping the backdrop closes it`, !(await page.evaluate(inPage.anyVisible, '.ipsDialog, .ipsModal')), JSON.stringify(pt));
      }
      if (await page.evaluate(inPage.anyVisible, '.ipsDialog')) { await page.keyboard.press('Escape').catch(() => {}); await sleep(800); const xx = page.locator('.ipsDialog .ipsDialog_close').filter({ visible: true }).last(); if (await xx.count()) { await xx.click({ force: true }).catch(() => {}); await sleep(800); } }
    }
  }
  const dummy = page.locator('[data-role="replyArea"] .ipsComposeArea_dummy, .ipsComposeArea_dummy').filter({ visible: true }).first();
  const hasEditor = await page.evaluate(() => !!document.querySelector('[data-role="replyArea"], .ipsComposeArea'));
  if (hasEditor) {
    if (await dummy.count()) { await dummy.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(250); await tapOrClick(kind, page, dummy).catch(() => {}); }
    const ready = await waitFor(page, () => window.CKEDITOR && Object.values(CKEDITOR.instances).some((e) => e.status === 'ready'), null, 25000);
    T('reply editor opens', ready);
    if (ready) {
      await sleep(800);
      const ed = await page.evaluate(() => { const e = Object.values(CKEDITOR.instances).find((x) => x.status === 'ready'); const c = e.container && e.container.$; const r = c.getBoundingClientRect(); const btns = [...c.querySelectorAll('.cke_toolgroup > a.cke_button, .cke_toolbar a.cke_combo_button')].filter((b) => b.getClientRects().length && b.checkVisibility()).map((b) => { const q = b.getBoundingClientRect(); return [Math.round(q.top), Math.round(q.height)]; }); const rows = {}; for (const [t, h] of btns) { const k = Object.keys(rows).find((y) => Math.abs(y - t) <= 6); (rows[k || t] = rows[k || t] || []).push([t, h]); } const bad = Object.values(rows).filter((rw) => rw.length > 1 && (Math.max(...rw.map((x) => x[0])) - Math.min(...rw.map((x) => x[0])) > 1 || Math.max(...rw.map((x) => x[1])) - Math.min(...rw.map((x) => x[1])) > 1)).length; return { name: e.name, in: r.left >= -1 && r.right <= innerWidth + 1, w: Math.round(r.width), rows: Object.keys(rows).length, badRows: bad, btns: btns.length }; });
      T('reply editor fits the screen', ed.in, JSON.stringify(ed));
      T('editor toolbar buttons line up in each row', ed.badRows === 0, JSON.stringify(ed));
      T('no sideways scroll with the editor open', !(await page.evaluate(inPage.overflow)));
      const combo = page.locator('.cke a.cke_combo_button').filter({ visible: true }).first();
      if (await combo.count()) {
        await combo.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(200);
        await tapOrClick(kind, page, combo).catch(() => {}); await sleep(900);
        const pi = await page.evaluate(inPage.boxInfo, '.cke_panel');
        T('editor dropdown («Размер»/«Шрифт») opens on screen', !!(pi && pi.in), JSON.stringify(pi));
        await page.keyboard.press('Escape').catch(() => {}); await sleep(500);
        if (await page.evaluate(inPage.anyVisible, '.cke_panel')) { await tapOrClick(kind, page, combo).catch(() => {}); await sleep(600); }
        T('editor dropdown closes', !(await page.evaluate(inPage.anyVisible, '.cke_panel')));
      }
      const emo = page.locator('.cke a.cke_button__ipsemoticon').filter({ visible: true }).first();
      if (await emo.count()) {
        await tapOrClick(kind, page, emo).catch(() => {}); await sleep(1500);
        const ei = await page.evaluate(inPage.boxInfo, '.ipsMenu[id*="moticon"], .ipsMenu[data-editorid], .ipsMenu.ipsMenu_wide');
        T('emoji panel opens on screen with a solid background', !!(ei && ei.in && ei.bgA >= 0.9), JSON.stringify(ei));
        const pt = await page.evaluate(OUTSIDE, '.ipsMenu[id*="moticon"], .ipsMenu[data-editorid], .ipsMenu.ipsMenu_wide');
        if (ei && pt) {
          if (kind === 'phone') await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
          await sleep(900);
          T('emoji panel closes on a tap outside', !(await page.evaluate(inPage.anyVisible, '.ipsMenu[id*="moticon"], .ipsMenu[data-editorid], .ipsMenu.ipsMenu_wide')), JSON.stringify(pt));
        } else if (ei) { await tapOrClick(kind, page, emo).catch(() => {}); await sleep(700); }
      }
      await page.evaluate(() => { for (const e of Object.values(CKEDITOR.instances)) try { e.setData(''); } catch (x) {} });
    }
  }
  const qb = page.locator('article.cPost [data-action="quoteComment"]').filter({ visible: true }).first();
  if (await qb.count()) {
    await qb.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(250);
    await tapOrClick(kind, page, qb).catch(() => {});
    const got = await waitFor(page, () => window.CKEDITOR && Object.values(CKEDITOR.instances).some((e) => e.status === 'ready' && /ipsQuote|blockquote/.test(e.getData())), null, 20000);
    T('«Цитата» puts the quote into the reply editor', got);
    if (got) {
      const qi = await page.evaluate(() => { const q = [...document.querySelectorAll('.cke_editable blockquote, .cke blockquote')].find((e) => e.getClientRects().length); if (!q) return null; const r = q.getBoundingClientRect(); return { in: r.left >= -1 && r.right <= innerWidth + 1, w: Math.round(r.width) }; });
      T('the quote in the editor fits the screen', !qi || qi.in, JSON.stringify(qi));
      await page.evaluate(() => { for (const e of Object.values(CKEDITOR.instances)) try { e.setData(''); } catch (x) {} });
    }
  }
  const mq = page.locator('article.cPost [data-action="multiQuoteComment"]').filter({ visible: true }).first();
  if (await mq.count()) {
    const fixed0 = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length).length);
    await mq.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(250);
    await tapOrClick(kind, page, mq).catch(() => {}); await sleep(1200);
    const bar = await page.evaluate(() => { const els = [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length && e.checkVisibility() && /цитир/i.test(e.innerText || '')); const b = els.sort((a, z) => a.innerText.length - z.innerText.length)[0]; if (!b) return null; const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { in: r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, onTop: !!(top && b.contains(top)), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top) }; });
    T('multiquote «+» shows its bar', !!bar, JSON.stringify(bar));
    if (bar) { T('multiquote bar is on screen and not covered', bar.in && bar.onTop, JSON.stringify(bar)); }
    await tapOrClick(kind, page, mq).catch(() => {}); await sleep(1200);
    T('pressing «+» again removes the bar', !(await page.evaluate(() => [...document.querySelectorAll('body *')].some((e) => getComputedStyle(e).position === 'fixed' && e.getClientRects().length && e.checkVisibility() && /цитир/i.test(e.innerText || '') && e.innerText.length < 200))));
  }
  if (AUTH && pname === 'mytopic') {
    const target = await page.evaluate(() => { const meA = document.querySelector('#elUserLink_menu a[href*="/profile/"], #elMobileDrawer a[href*="/profile/"]'); const meId = meA ? (meA.href.match(/profile\/(\d+)/) || [])[1] : null; const arts = [...document.querySelectorAll('article.cPost')]; const mine = arts.filter((a, i) => i > 0 && meId && [...a.querySelectorAll('.cAuthorPane_author a[href*="/profile/"], .ipsComment_author a[href*="/profile/"], aside a[href*="/profile/"]')].some((l) => (l.href.match(/profile\/(\d+)/) || [])[1] === meId)); const a = mine[0]; if (!a) return null; a.setAttribute('data-kt-post', '1'); return { id: a.id, text: (a.querySelector('[data-role="commentContent"]') || a).innerText.slice(0, 40) }; });
    if (target) {
      const art = page.locator('[data-kt-post="1"]');
      let edit = art.locator('[data-action="editComment"]').filter({ visible: true }).first();
      if (!(await edit.count())) { const ell = art.locator('a[data-ipsmenu].ipsComment_ellipsis, .ipsComment_ellipsis').filter({ visible: true }).first(); if (await ell.count()) { await ell.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(200); await tapOrClick(kind, page, ell).catch(() => {}); await sleep(700); edit = page.locator('.ipsMenu [data-action="editComment"]').filter({ visible: true }).first(); } }
      if (await edit.count()) {
        await tapOrClick(kind, page, edit).catch(() => {});
        const ok = await waitFor(page, () => { const a = document.querySelector('[data-kt-post="1"]'); return a && window.CKEDITOR && Object.values(CKEDITOR.instances).some((e) => e.status === 'ready' && a.contains(e.container && e.container.$)); }, null, 20000);
        const blocked = GUARD.blocked.some((b) => /editComment/.test(b));
        T('«Редактировать» opens the editor inside the post', ok, blocked ? 'the edit form request was blocked by the write guard' : '');
        if (ok) {
          await sleep(800);
          const bt = await page.evaluate(() => { const a = document.querySelector('[data-kt-post="1"]'); const bs = [...a.querySelectorAll('button, a.ipsButton, input[type="submit"]')].filter((b) => b.getClientRects().length && b.checkVisibility() && /сохран|отмен|save|cancel/i.test(b.innerText || b.value || '')).map((b) => { const r = b.getBoundingClientRect(); return { t: (b.innerText || b.value).trim(), top: Math.round(r.top), h: Math.round(r.height), in: r.left >= -1 && r.right <= innerWidth + 1 }; }); return bs; });
          T('edit form: «Сохранить» and «Отмена» are on screen and in one line', bt.length >= 2 && bt.every((b) => b.in) && Math.max(...bt.map((b) => b.top)) - Math.min(...bt.map((b) => b.top)) <= 1 && Math.max(...bt.map((b) => b.h)) - Math.min(...bt.map((b) => b.h)) <= 1, JSON.stringify(bt));
          T('no sideways scroll while editing', !(await page.evaluate(inPage.overflow)));
          const cancel = art.locator('[data-action="cancelEditComment"], a:has-text("Отмена"), button:has-text("Отмена")').filter({ visible: true }).first();
          if (await cancel.count()) { await tapOrClick(kind, page, cancel).catch(() => {}); }
          await sleep(700);
          const yes = page.locator('.ipsAlert [data-action="ok"], .ipsAlert button:has-text("Да")').filter({ visible: true }).first();
          if (await yes.count()) { await tapOrClick(kind, page, yes).catch(() => {}); }
          await sleep(2500);
          const back = await page.evaluate((txt) => { const a = document.querySelector('[data-kt-post="1"]'); const ed = window.CKEDITOR && Object.values(CKEDITOR.instances).some((e) => a.contains(e.container && e.container.$) && e.container.$.getClientRects().length); return { editor: !!ed, text: a.innerText.includes(txt.slice(0, 20)) }; }, target.text);
          T('«Отмена» brings the post back unchanged', !back.editor && back.text, JSON.stringify(back));
        }
      } else T('own post has «Редактировать»', false, 'not found');
    }
  }
  if (kind === 'phone') {
    const dr = page.locator('[data-ipsdrawer-drawerelem="#elMobileDrawer"], #elMobileNav [data-ipsdrawer]').filter({ visible: true }).first();
    if (await dr.count()) {
      await tapOrClick(kind, page, dr).catch(() => {}); await sleep(1000);
      const di = await page.evaluate(inPage.boxInfo, '.ipsDrawer_menu');
      T('menu drawer «≡» opens on screen with a solid background', !!(di && di.in && di.bgA >= 0.9), JSON.stringify(di));
      const x = page.locator('.ipsDrawer .ipsDrawer_close').filter({ visible: true }).first();
      if (await x.count()) await tapOrClick(kind, page, x).catch(() => {});
      await sleep(1000);
      T('drawer closes with its × button', !(await page.evaluate(inPage.anyVisible, '.ipsDrawer_menu')));
      await tapOrClick(kind, page, dr).catch(() => {}); await sleep(1000);
      if (await page.evaluate(inPage.anyVisible, '.ipsDrawer_menu')) {
        const m = await page.evaluate(inPage.boxInfo, '.ipsDrawer_menu');
        if (m.x >= 60) {
          const pt = { x: Math.round(m.x / 2), y: Math.round(m.vh * 0.6) };
          await page.touchscreen.tap(pt.x, pt.y); await sleep(1000);
          T('drawer closes on a tap outside', !(await page.evaluate(inPage.anyVisible, '.ipsDrawer_menu')), JSON.stringify(pt));
        }
        if (await page.evaluate(inPage.anyVisible, '.ipsDrawer_menu')) { const xx = page.locator('.ipsDrawer .ipsDrawer_close').filter({ visible: true }).first(); if (await xx.count()) await xx.tap().catch(() => {}); await sleep(800); }
      }
    }
  }
  if (kind === 'desktop') {
    const hv = page.locator('a[data-ipshover]').filter({ visible: true }).first();
    if (await hv.count()) {
      await hv.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(300);
      await hv.hover().catch(() => {});
      const ok = await waitFor(page, () => [...document.querySelectorAll('.ipsHovercard')].some((e) => e.getClientRects().length && e.checkVisibility({ opacityProperty: true }) && parseFloat(getComputedStyle(e).opacity) > 0.9), null, 4000);
      if (ok) {
        await sleep(400);
        const hi = await page.evaluate(inPage.boxInfo, '.ipsHovercard');
        T('user card on hover is on screen with a solid background', !!(hi && hi.in && hi.bgA >= 0.9), JSON.stringify(hi));
        await page.mouse.move(3, 3); await sleep(1600);
        T('user card hides when the pointer leaves', !(await page.evaluate(inPage.anyVisible, '.ipsHovercard')));
      }
    }
    const tt = page.locator('[data-ipstooltip]').filter({ visible: true }).first();
    if (await tt.count()) {
      await tt.evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(300);
      await tt.hover().catch(() => {}); await sleep(900);
      const ti = await page.evaluate(inPage.boxInfo, '#ipsTooltip');
      if (ti) { T('tooltip is on screen and solid', ti.in && ti.bgA >= 0.9, JSON.stringify(ti)); await page.mouse.move(3, 3); await sleep(900); T('tooltip hides when the pointer leaves', !(await page.evaluate(inPage.anyVisible, '#ipsTooltip'))); }
    }
  }
  if (pname === 'topics' || pname === 'discover') {
    const nx = page.locator('.ipsPagination_next:not(.ipsPagination_inactive) a').filter({ visible: true }).first();
    if (await nx.count()) {
      const u0 = page.url();
      await Promise.all([page.waitForLoadState('load').catch(() => {}), tapOrClick(kind, page, nx).catch(() => {})]); await sleep(2000);
      T('pagination «next» opens the next page', page.url() !== u0 || await page.evaluate(() => /page[\/=]2/.test(location.href) || !!document.querySelector('.ipsPagination_active a[data-page="2"], .ipsPagination_active[data-page="2"]')), page.url().slice(-40));
      T('no sideways scroll on page 2', !(await page.evaluate(inPage.overflow)));
    }
  }
}
(async () => {
  for (const kind of KINDS) {
    const dev = kind === 'phone' ? { viewport: { width: 412, height: 860 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent } : { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 };
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-li-')), { channel: 'chromium', headless: true, ...dev, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
    try {
      const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
      let pages = PAGES.filter(([n]) => ['index', 'topics', 'topic', 'topic2', 'profile', 'discover', 'search', 'online', 'leaderboard', 'staff'].includes(n));
      if (AUTH) { await ctl.evaluate(() => new Promise((r) => chrome.storage.local.set({ theme: 'off', skin: false }, r))); await login(ctx); pages = await authPages(ctx); }
      if (ONLY) pages = pages.filter(([n]) => ONLY.includes(n));
      console.log(`# ${kind}${AUTH ? ' (account)' : ' (guest)'}: ${pages.map((p) => p[0]).join(' ')}`);
      for (const sn of stateNames) {
        await ctl.evaluate((s) => new Promise((r) => chrome.storage.local.clear(() => chrome.storage.local.set(s, r))), STATES[sn]);
        for (const [pname, url] of pages) {
          const page = await ctx.newPage(); const errs = [];
          page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
          await page.addInitScript(() => { window.__lt = []; window.__ltE = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt.push(Math.round(e.duration)); window.__ltE.push({ s: e.startTime, d: Math.round(e.duration) }); } }).observe({ type: 'longtask' }); } catch (e) {} });
          try { await page.goto(url, { waitUntil: 'load', timeout: 90000 }); } catch (e) { console.log('skip', kind, sn, pname, e.message.slice(0, 60)); await page.close(); continue; }
          await sleep(1800);
          if (AUTH && await isGuest(page)) { console.log('session lost — logging in again'); await login(ctx); await page.reload({ waitUntil: 'load' }); await sleep(1800); }
          const R = (name, ok, info) => rec(kind, sn, pname, name, ok, info);
          const navs = []; const u0 = page.url();
          page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs.push(f.url()); });
          await page.evaluate(() => { window.__lt = []; window.__ltE = []; window.__mutes = []; }).catch(() => {});
          try { await routines(kind, sn, pname, page, R); } catch (e) { R('interaction run finished without a script error', false, String(e).split('\n')[0].slice(0, 140)); }
          const odd = navs.filter((n) => !/\/page\/\d|[?&]page=|[?&]tab=|sortby|\/content\/|\/messenger\/\d|#/.test(n) && n.split('#')[0] !== u0.split('#')[0]);
          if (odd.length) console.log(`NAV ${kind}/${sn}/${pname}: ${odd.slice(0, 3).join(' | ')}`);
          R('the page did not navigate anywhere unexpected', odd.length === 0, odd.slice(0, 2).join(' | '));
          const lt = await page.evaluate(() => (window.__lt || []).filter((d) => true) && (window.__ltE || []).filter((e) => !(window.__mutes || []).some((m) => e.s >= m[0] - 5 && e.s <= m[1] + 5)).map((e) => e.d)).catch(() => []);
          R('no freezes longer than 0.5 s during the interactions', !lt.length || Math.max(...lt) < 500, `longest ${lt.length ? Math.max(...lt) : 0} ms`);
          R('no script errors on the page', errs.length === 0, errs.slice(0, 2).join(' | '));
          await page.close();
        }
        console.log(`# done ${kind}/${sn}`);
      }
    } finally {
      if (AUTH) { console.log('logout:', JSON.stringify(await logout(ctx).catch((e) => ({ err: String(e).split('\n')[0] })))); console.log('blocked writes:', JSON.stringify(guardReport())); for (const b of guardBodies()) console.log('  blocked:', b); }
      await ctx.close();
    }
  }
  console.log(`${checks} checks with the skin, ${fails} FAILED, ${same} the same as on the forum without the extension`);
  fs.writeFileSync(path.join(OUT, `summary${AUTH ? '-auth' : ''}.txt`), failList.join('\n') + `\n${checks} checks, ${fails} failed, ${same} same as forum\n`);
})().catch((e) => { console.error(e); process.exit(2); });
