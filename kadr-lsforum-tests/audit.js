const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const { chromium, devices } = require('playwright');
const { PAGES, BASE } = require('./pages');
const argv = process.argv.slice(2);
const flag = (n) => { const a = argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
const [extArg, outDir] = argv.filter((a) => !a.startsWith('--'));
const KIND = flag('kind') || 'phone', AUTH = argv.includes('--auth');
const LIGHT = argv.includes('--light');
const ONLY = flag('pages') ? flag('pages').split(',') : null;
const REPLAY = flag('replay');
const RIDX = REPLAY ? JSON.parse(fs.readFileSync(path.join(REPLAY, 'index.json'), 'utf8')) : null;
const RBYURL = RIDX ? Object.fromEntries(Object.entries(RIDX).map(([n, u]) => [u, n])) : null;
const replayRoute = async (ctx) => { if (!REPLAY) return; await ctx.route('**/*', (route) => { const req = route.request(), u = req.url(); if (u.startsWith('chrome-extension:')) return route.continue(); if (req.isNavigationRequest() && RBYURL[u]) return route.fulfill({ status: 200, contentType: 'text/html; charset=UTF-8', body: fs.readFileSync(path.join(REPLAY, RBYURL[u] + '.html'), 'utf8') }); if (['xhr', 'fetch', 'eventsource', 'websocket'].includes(req.resourceType())) return route.abort(); return route.continue(); }); };
const COLLECT = fs.readFileSync(path.join(__dirname, 'collect.js'), 'utf8');
const EMPTY = path.join(__dirname, 'empty-ext');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ext = path.resolve(extArg);
const idOf = (p) => crypto.createHash('sha256').update(p).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

const sandbox = { window: {} }; vm.createContext(sandbox); vm.runInContext(fs.readFileSync(path.join(ext, 'themes.js'), 'utf8'), sandbox);
const K = sandbox.window.KADR;
const THEMES = ['off'].concat(K.THEMES.map((t) => t.id), ['custom']);
const STATES = [];
THEMES.forEach((th) => [true, false].forEach((skin) => STATES.push(th === 'custom' ? { theme: th, seed: '#ff5fa2', skin } : { theme: th, skin })));
STATES.push({ theme: 'mint', skin: true, fx: 'glass' }, { theme: 'grape', skin: true, fx: 'glass' }, { theme: 'cobalt', skin: true, fx: 'material' }, { theme: 'ember', skin: true, fx: 'material', shadows: false }, { theme: 'off', skin: true, fx: 'glass', lspMin: true }, { theme: 'noir', skin: true, ckeTint: false, shadows: false });
const label = (s) => s.theme + (s.skin ? '+skin' : '') + (s.fx ? '+' + s.fx : '') + (s.shadows === false ? '+flat' : '') + (s.lspMin ? '+min' : '');
if (flag('states') && flag('states') !== 'glass-all') { const want = flag('states'); const keep = STATES.filter((s) => label(s).includes(want)); STATES.length = 0; STATES.push(...keep); }
if (flag('states') === 'glass-all') { STATES.length = 0; THEMES.forEach((th) => STATES.push(th === 'custom' ? { theme: th, seed: '#ff5fa2', skin: true, fx: 'glass' } : { theme: th, skin: true, fx: 'glass' })); }
const expectAcc = (s) => { const m = K.css(s).match(/--theme-brand_primary:([^;]+);/); return m ? m[1].trim() : null; };
const MAPPED = new Set((K.css({ theme: 'mint' }).match(/--theme-[\w-]+(?=:)/g) || []));

const DEV = KIND === 'phone'
  ? { viewport: { width: 412, height: 860 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent }
  : { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 };
const WIDTHS = KIND === 'phone' ? [360, 412, 491] : [768, 1024, 1366, 1920];
const W0 = DEV.viewport.width, H = DEV.viewport.height;

async function launch(dir) {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kadr-audit-')), {
    channel: 'chromium', headless: true, ...DEV, args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`] });
  return ctx;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const B = await launch(ext);
  const A = AUTH ? B : await launch(EMPTY);
  await replayRoute(B); if (A !== B) await replayRoute(A);
  const ctl = await B.newPage();
  await ctl.goto(`chrome-extension://${idOf(ext)}/popup.html`);
  const setState = (s) => ctl.evaluate((s) => new Promise((r) => chrome.storage.local.clear(() => chrome.storage.local.set(s, r))), s);
  const OFF_ALL = { theme: 'off', skin: false, menuEntry: false };
  const { login, isGuest } = require('./auth-login');
  if (AUTH) { await setState(OFF_ALL); await login(B); }
  async function toLight(ctx) {
    const p = await ctx.newPage();
    await p.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 }); await sleep(1200);
    if (await p.evaluate(() => document.documentElement.dataset.focusScheme) !== 'light') {
      const sel = '[data-focus-toggle-theme]:not(.focus-editor-panel)';
      const n = await p.locator(sel).count();
      for (let i = 0; i < n; i++) { const l = p.locator(sel).nth(i); if (await l.isVisible()) { await Promise.all([p.waitForLoadState('load').catch(() => {}), l.click()]); break; } }
      await sleep(2500);
    }
    const sc = await p.evaluate(() => document.documentElement.dataset.focusScheme);
    await p.close();
    if (sc !== 'light') throw new Error('could not switch the forum to its light scheme');
  }
  if (LIGHT && !REPLAY) { await setState(OFF_ALL); await toLight(B); if (A !== B) await toLight(A); }

  let pages = REPLAY ? Object.entries(RIDX) : PAGES;
  if (AUTH) {
    const p = await A.newPage();
    await p.goto(BASE + '/', { waitUntil: 'load', timeout: 45000 });
    const me = await p.evaluate(() => { const a = document.querySelector('#elUserLink_menu a[href*="/profile/"]'); return { guest: document.documentElement.hasAttribute('data-focus-guest'), profile: a ? a.href : null }; });
    await p.close();
    if (me.guest) { console.log('NOT LOGGED IN — session expired'); process.exit(5); }
    pages = await require('./live-pages').authPages(A);
  }
  if (ONLY) pages = pages.filter((p) => ONLY.includes(p[0]));

  const summary = [];
  for (const [name, url] of pages) {
    const rep = { page: name, kind: KIND, auth: AUTH };
    if (AUTH) await setState(OFF_ALL);
    const pa = await A.newPage(); const errA = []; pa.on('pageerror', (e) => errA.push(e.message.slice(0, 140)));
    await pa.goto(url, { waitUntil: 'load', timeout: 60000 }); await sleep(1800);
    rep.finalUrl = pa.url().replace(BASE, '');
    if (AUTH && await isGuest(pa)) { console.log('session lost on ' + name + ' — logging in again'); await login(B); await pa.reload({ waitUntil: 'load' }); await sleep(1800); }
    const a = await pa.evaluate(`(${COLLECT})({ palette: true, vars: true })`);
    rep.overflowA = {};
    for (const w of WIDTHS) { await pa.setViewportSize({ width: w, height: H }); await sleep(450); const v = await pa.evaluate(() => [innerWidth, document.documentElement.scrollWidth]); rep.overflowA[w] = v[1] > v[0] + 1 ? v[1] : 0; }
    await pa.setViewportSize({ width: W0, height: H }); await sleep(450);
    const aStyles = (await pa.evaluate(`(${COLLECT})({ styles: true })`)).styles;
    await pa.close();
    rep.unmappedVars = Object.keys(a.vars).filter((n) => !MAPPED.has(n)).map((n) => n + '=' + a.vars[n]);

    await setState({ theme: 'mint', skin: true });
    const pb = await B.newPage(); const errB = []; pb.on('pageerror', (e) => errB.push(e.message.slice(0, 140)));
    await pb.goto(url, { waitUntil: 'load', timeout: 60000 }); await sleep(1800);
    const aMap = new Map(), aMap2 = new Map();
    a.texts.forEach((t) => { aMap.set(t.k, t); const o = aMap2.get(t.k2); if (!o || t.r < o.r) aMap2.set(t.k2, t); });
    const hard = new Map(), soft = new Map();
    rep.varFail = []; rep.leftovers = {}; rep.skippedText = [a.skipped, 0];
    for (const st of STATES) {
      await setState(st); await sleep(450);
      const wantPal = st.theme === 'cobalt' || st.theme === 'ember';
      const b = await pb.evaluate(`(${COLLECT})({ palette: ${wantPal}, vars: true })`);
      rep.skippedText[1] = Math.max(rep.skippedText[1], b.skipped);
      const acc = b.vars['--theme-brand_primary'], want = st.theme === 'off' ? a.vars['--theme-brand_primary'] : expectAcc(st);
      if (acc !== want) rep.varFail.push(label(st) + ': ' + acc + ' != ' + want);
      for (const t of b.texts) {
        const o = aMap.get(t.k) || aMap2.get(t.k2);
        const key = t.d + ' «' + t.t + '»';
        if (t.r < 3 && !(o && o.r < 3)) { const h = hard.get(key) || { min: 99, orig: o ? o.r : null, states: [] }; h.min = Math.min(h.min, t.r); h.states.push(label(st) + ':' + t.r); hard.set(key, h); }
        else if (t.r < 4.5 && o && o.r >= 4.5) { const h = soft.get(key) || { min: 99, orig: o.r, states: [], ex: null }; h.min = Math.min(h.min, t.r); h.states.push(label(st)); if (!h.ex) h.ex = { fg: t.fg, bg: t.bg, par: t.par, origFg: o.fg, origBg: o.bg, origPar: o.par }; soft.set(key, h); }
      }
      if (wantPal) {
        const left = [];
        for (const kind of ['bg', 'border', 'text']) for (const [c, v] of Object.entries(b.palette[kind])) {
          if (!a.palette[kind][c]) continue;
          if (/^(255,255,255|0,0,0)(\/|$)/.test(c)) continue;
          left.push(kind + ' ' + c + ' ×' + v.n + ' e.g. ' + v.ex);
        }
        rep.leftovers[label(st)] = left;
      }
    }
    rep.contrastHard = [...hard.entries()].map(([k, v]) => ({ el: k, min: v.min, orig: v.orig, n: v.states.length, states: v.states.slice(0, 6) }));
    rep.contrastSoft = [...soft.entries()].map(([k, v]) => ({ el: k, min: v.min, orig: v.orig, n: v.states.length, states: v.states.slice(0, 8), ex: v.ex }));
    await setState({ theme: 'mint', skin: true }); await sleep(450);
    rep.overflowB = {}; rep.wideB = {};
    for (const w of WIDTHS) {
      await pb.setViewportSize({ width: w, height: H }); await sleep(550);
      const v = await pb.evaluate(`(${COLLECT})({})`);
      rep.overflowB[w] = v.sw > v.vw + 1 ? v.sw : v.wide.length ? 'wide ' + v.wide.length : 0;
      if (v.wide.length) rep.wideB[w] = v.wide;
      if (KIND === 'desktop' && (w === 768 || w === 1024)) await pb.screenshot({ path: path.join(outDir, `${AUTH ? 'auth-' : ''}${LIGHT ? 'light-' : ''}${name}-${w}.png`) });
    }
    if (KIND === 'phone') { await pb.setViewportSize({ width: 412, height: H }); await sleep(400); await pb.screenshot({ path: path.join(outDir, `${AUTH ? 'auth-' : ''}${LIGHT ? 'light-' : ''}${name}-412.png`) }); }
    else { await pb.setViewportSize({ width: 1366, height: H }); await sleep(400); await pb.screenshot({ path: path.join(outDir, `${AUTH ? 'auth-' : ''}${LIGHT ? 'light-' : ''}${name}-1366.png`) }); }
    await pb.close();
    rep.errorsOnlyB = errB.filter((e) => !errA.includes(e));

    if (AUTH) { rep.offIdentity = { same: -1, diffs: [], leftovers: {} }; }
    else {
    await setState({ theme: 'off', skin: false });
    const pc = await B.newPage();
    await pc.goto(url, { waitUntil: 'load', timeout: 60000 }); await sleep(1800);
    const c = await pc.evaluate(`(${COLLECT})({ styles: true })`);
    const ours = await pc.evaluate(() => ({ cls: document.documentElement.classList.contains('kadr-rd'), style: !!document.getElementById('kadr-theme') }));
    await pc.close();
    let same = 0; const diffs = [];
    for (const [k, v] of Object.entries(c.styles)) { const o = aStyles[k]; if (!o) continue; if (o[1] === v[1]) same++; else if (diffs.length < 6) { const pa2 = o[1].split(' ; '), pb2 = v[1].split(' ; '); const i = pa2.findIndex((x, j) => x !== pb2[j]); diffs.push(v[0] + ' prop#' + i + ': ' + (pa2[i] || '').slice(0, 40) + ' -> ' + (pb2[i] || '').slice(0, 40)); } }
    rep.offIdentity = { same, diffs, leftovers: ours };
    }

    fs.writeFileSync(path.join(outDir, `${AUTH || REPLAY ? 'auth-' : ''}${LIGHT ? 'light-' : ''}${KIND}-${name}.json`), JSON.stringify(rep, null, 1));
    const ov = (o) => Object.entries(o).filter(([, v]) => v).map(([w, v]) => w + '→' + v).join(' ') || 'none';
    const line = `[${KIND}${AUTH || REPLAY ? ' auth' : ''}${LIGHT ? ' light' : ''}] ${name.padEnd(10)} overflow A:${ov(rep.overflowA)} B:${ov(rep.overflowB)} | contrast hard ${rep.contrastHard.length} soft ${rep.contrastSoft.length} | var fails ${rep.varFail.length} | leftovers cobalt+skin ${(rep.leftovers['cobalt+skin'] || []).length} cobalt ${(rep.leftovers.cobalt || []).length} | off: ${rep.offIdentity.diffs.length ? 'DIFF ' : 'same '}${rep.offIdentity.same}${rep.offIdentity.leftovers.cls || rep.offIdentity.leftovers.style ? ' RESIDUE' : ''} | errors+ ${rep.errorsOnlyB.length}`;
    console.log(line);
    summary.push(line);
  }
  fs.writeFileSync(path.join(outDir, `${AUTH ? 'auth-' : ''}${LIGHT ? 'light-' : ''}${KIND}-summary.txt`), summary.join('\n') + '\n');
  if (A !== B) await A.close();
  if (AUTH) { const { logout, guardReport } = require('./auth-login'); console.log('logout:', JSON.stringify(await logout(B))); console.log('blocked writes:', JSON.stringify(guardReport())); }
  await B.close();
})().catch((e) => { console.error(e); process.exit(2); });
