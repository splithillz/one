const puppeteer = require('puppeteer');
const path = require('path');
const { B, UA_PHONE_FF } = require('./xb-common');
const FF = process.env.FF, EXT = path.resolve(process.argv[2]), OUT = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, n = 0;
const check = (name, ok, extra) => { n++; if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || !extra ? '' : ' — ' + extra)); };
async function launch(kind, st) {
  const prefs = { 'extensions.originControls.grantByDefault': true, 'ui.useOverlayScrollbars': 1, 'layout.css.prefers-color-scheme.content-override': 1 };
  if (kind === 'phone') Object.assign(prefs, { 'general.useragent.override': UA_PHONE_FF, 'dom.w3c_touch_events.enabled': 1 });
  const browser = await puppeteer.launch({ browser: 'firefox', executablePath: FF, headless: true, acceptInsecureCerts: true, extraPrefsFirefox: prefs });
  await browser.installExtension(EXT);
  const page = await browser.newPage();
  await page.setViewport(kind === 'phone' ? { width: 412, height: 860, isMobile: true, hasTouch: true } : { width: 1366, height: 900 });
  await page.goto(B + '/#kadrtest=' + encodeURIComponent(JSON.stringify(st)), { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await sleep(1500);
  return { browser, page };
}
const visMenus = (page) => page.evaluate(() => [...document.querySelectorAll('.ipsMenu')].filter((m) => { const s = getComputedStyle(m); return s.display !== 'none' && s.visibility !== 'hidden' && m.getBoundingClientRect().height > 10 && +s.opacity > 0.5; }).map((m) => m.id || m.className.slice(0, 30)));
async function menus(page, k, url) {
  await page.goto(B + url, { waitUntil: 'load', timeout: 60000 }).catch(() => {}); await sleep(1800);
  const triggers = await page.evaluate(() => [...document.querySelectorAll('[data-ipsmenu]')].filter((t) => { const b = t.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(t).visibility !== 'hidden'; }).slice(0, 6).map((t) => t.id).filter(Boolean));
  for (const id of triggers) {
    const pos = async () => page.evaluate((id) => { const t = document.getElementById(id); t.scrollIntoView({ block: 'center' }); const b = t.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, id);
    let p = await pos(); await page.mouse.click(p.x, p.y); await sleep(700);
    const open1 = (await visMenus(page)).length > 0;
    await page.mouse.click(5, 450); await sleep(1000);
    const closed = (await visMenus(page)).length === 0;
    p = await pos(); await page.mouse.click(p.x, p.y); await sleep(700);
    const open2 = (await visMenus(page)).length > 0;
    await sleep(1500);
    const still = (await visMenus(page)).length > 0;
    await page.mouse.click(5, 450); await sleep(900);
    check(`${k} ${url} меню #${id}: открылось ${open1}, закрылось тапом мимо ${closed}, открылось снова ${open2}, не пропало само ${still}`, open1 && closed && open2 && still);
  }
  return triggers.length;
}
(async () => {
  if (!process.env.PHONE_ONLY) {
    const { browser, page } = await launch('desktop', { theme: 'mint', skin: true });
    let total = 0;
    for (const u of ['/', '/index.php?/topic/838-x/', '/index.php?/forum/34-x/']) total += await menus(page, 'desktop', u);
    check('desktop: найдены меню для проверки', total > 0, 'triggers ' + total);
    await page.goto(B + '/', { waitUntil: 'load' }).catch(() => {}); await sleep(1500);
    const tip = await page.evaluate(() => { const t = [...document.querySelectorAll('[data-ipstooltip]')].find((e) => e.getBoundingClientRect().width > 0); if (!t) return null; t.scrollIntoView({ block: 'center' }); const b = t.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    if (tip) {
      await page.mouse.move(tip.x, tip.y); await sleep(1200);
      const tt = await page.evaluate(() => { const t = [...document.querySelectorAll('.ipsTooltip')].find((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0); return t ? getComputedStyle(t).backgroundColor : null; });
      check('desktop: подсказка показалась и у неё есть фон', !!tt && tt !== 'rgba(0, 0, 0, 0)' && tt !== 'transparent', String(tt));
    } else console.log('note desktop: no tooltip trigger on the index');
    await page.screenshot({ path: path.join(OUT, 'ffi-desktop-index.png') });
    await browser.close();
  }
  {
    const { browser, page } = await launch('phone', { theme: 'grape', skin: true, fx: 'glass' });
    await page.goto(B + '/', { waitUntil: 'load', timeout: 60000 }).catch(() => {}); await sleep(2000);
    const nav = await page.evaluate(() => { const t = [...document.querySelectorAll('[data-ipsdrawer-drawerelem="#elMobileDrawer"], #elMobileNav [data-ipsdrawer]')].find((e) => e.getBoundingClientRect().width > 0); if (!t) return null; const b = t.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    if (nav) {
      await page.touchscreen.tap(nav.x, nav.y); await sleep(1200);
      const open = await page.evaluate(() => [...document.querySelectorAll('.ipsDrawer_menu')].some((d) => { const b = d.getBoundingClientRect(); return getComputedStyle(d).display !== 'none' && b.width > 0 && b.right > 0 && b.left < innerWidth; }));
      const x = await page.evaluate(() => { const c = [...document.querySelectorAll('.ipsDrawer_close')].find((e) => e.getBoundingClientRect().width > 0); if (!c) return null; const b = c.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, vis: b.left >= 0 && b.right <= innerWidth }; });
      check('phone: боковое меню ≡ открылось', open);
      check('phone: крестик бокового меню виден целиком', !!x && x.vis && x.w > 20, JSON.stringify(x));
      await page.screenshot({ path: path.join(OUT, 'ffi-phone-drawer.png') });
      if (x) { await page.touchscreen.tap(x.x, x.y); await sleep(1200); }
      const closed = await page.evaluate(() => ![...document.querySelectorAll('.ipsDrawer_menu')].some((d) => { const b = d.getBoundingClientRect(); return getComputedStyle(d).display !== 'none' && getComputedStyle(d).visibility !== 'hidden' && b.width > 0 && b.right > 0 && b.left < innerWidth; }));
      check('phone: боковое меню закрылось крестиком', closed);
    } else check('phone: кнопка ≡ найдена', false);
    const entry = await page.evaluate(() => { const e = [...document.querySelectorAll('[data-kadr-entry]')].find((x) => x.getBoundingClientRect().width > 0); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    check('phone: кнопка «Тема» в панели форума', !!entry);
    if (entry) {
      await page.touchscreen.tap(entry.x, entry.y); await sleep(1500);
      check('phone: шторка открылась', await page.evaluate(() => !!document.querySelector('kadr-sheet')));
      await page.screenshot({ path: path.join(OUT, 'ffi-phone-sheet.png') });
      await page.touchscreen.tap(206, 60); await sleep(1200);
      check('phone: шторка закрылась тапом по затемнению', await page.evaluate(() => !document.querySelector('kadr-sheet')));
      await page.touchscreen.tap(entry.x, entry.y); await sleep(1500);
      check('phone: шторка открывается повторно', await page.evaluate(() => !!document.querySelector('kadr-sheet')));
    }
    await browser.close();
  }
  console.log(`ff-interact: ${n} checks, ${fails} failures`);
})().catch((e) => { console.error('ERR', e.message.slice(0, 300)); process.exit(2); });
