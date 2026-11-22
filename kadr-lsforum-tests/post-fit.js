const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { chromium, devices } = require('playwright');
const ext = path.resolve(process.argv[2]);
const id = crypto.createHash('sha256').update(ext).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = 'https://forum.ls-project.com/index.php?/topic/';
const TOPICS = ['34', '35', '47', '49', '343', '610', '838', '905'];
const STATES = { off: { theme: 'off', skin: false }, white: { theme: 'monet-white', skin: true }, glass: { theme: 'grape', skin: true, fx: 'glass' }, mint: { theme: 'mint', skin: true } };
const KINDS = { phone: { viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent }, small: { viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent }, desktop: { viewport: { width: 1440, height: 900 } } };
const WIDE = [
  '<table><tbody><tr><td><img class="ipsImage" src="IMG" width="1500" height="844"></td><td>текст справа от картинки</td></tr></tbody></table>',
  '<table style="width: 900px"><tbody><tr><td>длинный текст в первой ячейке таблицы с фиксированной шириной</td><td>вторая</td><td>третья</td></tr></tbody></table>',
  '<div style="width: 1100px; padding: 10px"><p><img class="ipsImage" src="IMG" alt=""></p></div>',
  '<p><iframe width="1000" height="300" src="about:blank"></iframe></p>',
  '<p><img src="IMG" style="width: 1200px; max-width: none;"></p>'
];
let fails = 0, checks = 0;
const fail = (m) => { fails++; console.log('FAIL ' + m); };
async function open(kind, st) {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-pf-')), { channel: 'chromium', headless: true, ...KINDS[kind], args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const ctl = await ctx.newPage(); await ctl.goto(`chrome-extension://${id}/popup.html`);
  await ctl.evaluate((s) => new Promise((r) => chrome.storage.local.clear(() => chrome.storage.local.set(s, r))), st);
  await ctl.close();
  return ctx;
}
async function load(ctx, t) {
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__errs = []; addEventListener('error', (e) => window.__errs.push(String(e.message))); });
  await page.goto(B + t + '-x/', { waitUntil: 'load', timeout: 60000 });
  await sleep(800);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(h, 40000); y += 700) { await page.evaluate((v) => scrollTo(0, v), y); await sleep(50); }
  await page.evaluate(() => scrollTo(0, 0));
  await sleep(1500);
  return page;
}
const overflow = (page) => page.evaluate(() => {
  const out = [];
  for (const rt of document.querySelectorAll('.ipsType_richText')) {
    const box = rt.getBoundingClientRect(); if (!box.width) continue;
    for (const el of rt.querySelectorAll('*')) {
      const b = el.getBoundingClientRect(); if (!b.width || b.right <= box.right + 1) continue;
      let clip = false; for (let p = el.parentElement; p && p !== rt; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') { clip = true; break; }
      if (clip || /^(absolute|fixed)$/.test(getComputedStyle(el).position)) continue;
      out.push(`${el.localName}.${String(el.className || '').split(' ')[0]} +${Math.round(b.right - box.right)}px`);
    }
  }
  return out;
});
const sizes = (page) => page.evaluate(() => [...document.querySelectorAll('.ipsType_richText')].flatMap((rt, i) => [...rt.querySelectorAll('*')].map((el, j) => { const b = el.getBoundingClientRect(); return `${i}/${j} ${el.localName} ${Math.round(b.width)}x${Math.round(b.height)}`; })));
const quotes = (page) => page.evaluate(() => [...document.querySelectorAll('[data-role="commentContent"]')].map((c) => {
  const k = c.cloneNode(true);
  k.querySelectorAll('[data-lightbox-group], [data-ipslightbox-group]').forEach((e) => { e.removeAttribute('data-lightbox-group'); e.removeAttribute('data-ipslightbox-group'); });
  k.querySelectorAll('[id^="ips_uid_"]').forEach((e) => e.removeAttribute('id'));
  k.querySelectorAll('.leaflet-container').forEach((e) => { e.innerHTML = ''; e.removeAttribute('style'); });
  k.querySelectorAll('*').forEach((e) => { if ([...e.attributes].some((a) => /truncat/i.test(a.name))) e.removeAttribute('style'); });
  k.querySelectorAll('img').forEach((e) => { e.removeAttribute('src'); e.removeAttribute('srcset'); e.removeAttribute('data-loaded'); });
  return k.innerHTML;
}));
(async () => {
  const ref = {};
  const off = await open('phone', STATES.off);
  for (const t of TOPICS) { const p = await load(off, t); ref[t] = await quotes(p); await p.close(); }
  await off.close();
  for (const kind of ['phone', 'small', 'desktop']) for (const sn of ['white', 'glass', 'mint']) {
    if (kind !== 'phone' && sn === 'mint') continue;
    const ctx = await open(kind, STATES[sn]);
    const img = 'https://forum.ls-project.com/uploads/monthly_2026_10/20261030140200_1.jpg.0f11e089627c1531b41323b286eb0c19.jpg';
    for (const t of TOPICS) {
      const page = await load(ctx, t);
      checks++; const ov = await overflow(page); if (ov.length) fail(`${kind}/${sn}/t${t}: post content past the card: ${ov.slice(0, 4).join(', ')}`);
      checks++; const withFit = await sizes(page);
      await page.evaluate(() => { const f = document.getElementById('kadr-fit'); if (f) f.media = 'not all'; });
      const noFit = await sizes(page); const bad = await overflow(page);
      await page.evaluate(() => { const f = document.getElementById('kadr-fit'); if (f) f.removeAttribute('media'); });
      const changed = withFit.filter((s, i) => s !== noFit[i]);
      if (changed.length && !bad.length) fail(`${kind}/${sn}/t${t}: fitting changed ${changed.length} elements although nothing overflowed: ${changed.slice(0, 3).join(', ')}`);
      if (kind === 'phone' && sn !== 'mint') { checks++; const q = await quotes(page); const same = q.length === ref[t].length && q.every((x, i) => x === ref[t][i]); if (!same) { const i = q.findIndex((x, n) => x !== ref[t][n]); const a = q[i] || '', b = ref[t][i] || ''; let j = 0; while (j < a.length && a[j] === b[j]) j++; fail(`${kind}/${sn}/t${t}: post HTML differs from the forum without the extension (post ${i}): ${a.slice(Math.max(0, j - 60), j + 80)}`); } }
      checks++; const errs = await page.evaluate(() => window.__errs); if (errs.length) fail(`${kind}/${sn}/t${t}: script errors: ${errs.join(' | ').slice(0, 200)}`);
      await page.close();
    }
    if (kind !== 'desktop') {
      const page = await load(ctx, '838');
      await page.evaluate(([html]) => { const c = document.querySelector('[data-role="commentContent"]'); c.insertAdjacentHTML('beforeend', '<div data-pf>' + html + '</div>'); }, [WIDE.join('').replace(/IMG/g, img)]);
      await sleep(2500);
      checks++; const ov = await overflow(page); if (ov.length) fail(`${kind}/${sn}: wide content added to a post stays past the card: ${ov.slice(0, 4).join(', ')}`);
      checks++; const ratio = await page.evaluate(() => [...document.querySelectorAll('[data-pf] img')].filter((i) => i.naturalWidth).map((i) => { const b = i.getBoundingClientRect(); return Math.abs(b.width / b.height - i.naturalWidth / i.naturalHeight); }));
      if (ratio.some((d) => d > 0.02)) fail(`${kind}/${sn}: a fitted image is distorted (${ratio.map((d) => d.toFixed(3)).join(', ')})`);
      await page.close();
      const rot = await load(ctx, '34');
      for (const [w, h, tag] of [[KINDS[kind].viewport.height, KINDS[kind].viewport.width, 'landscape'], [KINDS[kind].viewport.width, KINDS[kind].viewport.height, 'portrait again'], [KINDS[kind].viewport.width, KINDS[kind].viewport.height - 120, 'toolbar shown']]) {
        await rot.setViewportSize({ width: w, height: h }); await sleep(1200);
        checks++; const ov2 = await overflow(rot); if (ov2.length) fail(`${kind}/${sn}/t34 ${tag}: past the card: ${ov2.slice(0, 3).join(', ')}`);
        checks++; const hero = await rot.evaluate(() => { const i = document.querySelector('.rules-hero img'); return i ? Math.round(i.getBoundingClientRect().width) : -1; });
        if (tag === 'landscape' && hero !== 420) fail(`${kind}/${sn}/t34 landscape: the rules logo should keep the author's 420px, got ${hero}`);
      }
      await rot.close();
    }
    await ctx.close();
    console.log(`${kind}/${sn}: done`);
  }
  console.log(`post-fit: ${checks} checks, ${fails} failures`);
})().catch((e) => { console.error(e); process.exit(2); });
