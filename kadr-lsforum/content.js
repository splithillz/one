(function () {
  'use strict';
  if (window.__kadrLs) return;
  window.__kadrLs = true;

  var K = window.KADR;
  var store = chrome.storage.local;
  var root = document.documentElement;
  var ID = 'kadr-theme';
  var state = { theme: K.OFF, seed: null };
  var skin = true;
  root.classList.add('kadr-rd');
  var ready = false;
  var styleEl = null, fontEl = null;
  var prefs = { ckeTint: true, fx: 'plain', shadows: true, lspMin: false, icons: 'native' };
  var iconCss = '', iconVer = '', iconEl = null, iconLoading = '';
  var VER = '';
  try { VER = chrome.runtime.getManifest().version; } catch (e) {}
  function isLight() { return root.getAttribute('data-focus-scheme') === 'light'; }
  var SCHEME = 'data-focus-scheme';
  var native = root.getAttribute(SCHEME);
  function syncScheme() {
    var f = ready ? K.forced(state) : null, cur = root.getAttribute(SCHEME), want = f || native;
    if (want && cur !== want) root.setAttribute(SCHEME, want);
  }
  new MutationObserver(function () {
    var cur = root.getAttribute(SCHEME), f = ready ? K.forced(state) : null;
    if (f && cur === f) return;
    native = cur;
    if (f) syncScheme();
    if (ready) { apply(); noteScheme(); }
  }).observe(root, { attributes: true, attributeFilter: [SCHEME] });

  var FONT = '';
  try {
    FONT = '@font-face{font-family:Onest;font-style:normal;font-weight:400 800;font-display:swap;src:url("' +
      chrome.runtime.getURL('fonts/onest-cyrillic.woff2') + '") format("woff2");unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}' +
      '@font-face{font-family:Onest;font-style:normal;font-weight:400 800;font-display:swap;src:url("' +
      chrome.runtime.getURL('fonts/onest-latin.woff2') + '") format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,' +
      'U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}';
  } catch (e) {}

  function syncFont() {
    if (skin && FONT) {
      if (!fontEl) { fontEl = document.createElement('style'); fontEl.id = 'kadr-font'; fontEl.textContent = FONT; }
      if (!fontEl.isConnected) (document.head || root).appendChild(fontEl);
    } else if (fontEl && fontEl.isConnected) fontEl.remove();
  }
  function syncPrefs() {
    root.classList.toggle('kadr-cke-tint', skin && prefs.ckeTint);
    root.classList.toggle('kadr-fx-glass', skin && prefs.fx === 'glass');
    root.classList.toggle('kadr-fx-material', skin && prefs.fx === 'material');
    root.classList.toggle('kadr-noshadow', skin && !prefs.shadows);
    if (skin && prefs.lspMin) root.setAttribute('data-kadr-lsp', 'min'); else root.removeAttribute('data-kadr-lsp');
  }

  function place() {
    if (iconEl && iconEl.textContent && iconEl.parentNode !== root) root.appendChild(iconEl);
    if (styleEl && styleEl.textContent && (styleEl.parentNode !== root || root.lastElementChild !== styleEl)) root.appendChild(styleEl);
  }
  function syncIcons() {
    var name = skin ? prefs.icons : 'native', on = name !== 'native';
    if (on && (!iconCss || iconVer !== VER) && iconLoading !== name) {
      iconLoading = name;
      fetch(chrome.runtime.getURL('iconsets/' + name + '.css')).then(function (r) { return r.text(); }).then(function (css) {
        iconLoading = '';
        if (prefs.icons !== name) return;
        iconCss = css; iconVer = VER;
        store.set({ iconCss: css, iconVer: VER });
        syncIcons();
      }).catch(function () { iconLoading = ''; });
    }
    var use = on && !!iconCss;
    root.classList.toggle('kadr-ic', use);
    if (use) {
      if (!iconEl) { iconEl = document.createElement('style'); iconEl.id = 'kadr-icons'; }
      if (iconEl.textContent !== iconCss) iconEl.textContent = iconCss;
      if (iconEl.parentNode !== root) root.appendChild(iconEl);
    } else if (iconEl) { iconEl.remove(); iconEl.textContent = ''; }
  }
  function setMeta(color) {
    var m = document.querySelector('meta[name="theme-color"][data-kadr]');
    if (!color || !document.head) { if (m) m.remove(); return; }
    var site = document.querySelector('meta[name="theme-color"]:not([data-kadr])');
    if (site) { if (!site.hasAttribute('data-kadr-was')) site.setAttribute('data-kadr-was', site.content); site.content = color; return; }
    if (!m) {
      m = document.createElement('meta');
      m.name = 'theme-color';
      m.setAttribute('data-kadr', '');
      document.head.appendChild(m);
    }
    if (m.content !== color) m.content = color;
  }
  function restoreMeta() {
    var site = document.querySelector('meta[name="theme-color"][data-kadr-was]');
    if (site) { site.content = site.getAttribute('data-kadr-was'); site.removeAttribute('data-kadr-was'); }
    setMeta(null);
  }

  function apply() {
    if (!ready) return;
    syncScheme();
    root.classList.toggle('kadr-rd', skin);
    syncPrefs();
    syncFont();
    syncIcons();
    var theme = K.resolve(state);
    if (!theme) {
      if (styleEl) { styleEl.remove(); styleEl.textContent = ''; }
      restoreMeta();
    } else {
      var text = K.css(state);
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = ID; }
      if (styleEl.textContent !== text) styleEl.textContent = text;
      place();
      setMeta(isLight() ? null : theme.bg);
    }
    liftColors();
    syncLsp();
    markOwn();
  }

  var LIFT = 'data-kadr-color';
  function parseColor(v) {
    var m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v || '');
    if (m) return [+m[1], +m[2], +m[3]].map(Math.round);
    m = /^\s*#([0-9a-f]{3}|[0-9a-f]{6})\s*$/i.exec(v || '');
    if (!m) return null;
    var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1], n = parseInt(h, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function liftColors() {
    if (!ready || !document.body) return;
    var list = document.body.querySelectorAll('[style*="color"], [' + LIFT + ']');
    for (var i = 0; i < list.length; i++) {
      var el = list[i], orig = el.getAttribute(LIFT);
      if (orig === null) { orig = el.style.color; if (!orig) continue; }
      var x = K.liftColor(parseColor(orig), state, isLight() && !el.closest('#elProfileHeader, .ipsPageHead_special'));
      if (x) {
        var want = 'rgb(' + x.join(', ') + ')';
        if (el.getAttribute(LIFT) === null) el.setAttribute(LIFT, orig);
        if (el.style.getPropertyValue('color') !== want || !el.style.getPropertyPriority('color')) el.style.setProperty('color', want, 'important');
      } else if (el.getAttribute(LIFT) !== null) {
        el.style.setProperty('color', orig);
        el.removeAttribute(LIFT);
      }
    }
  }

  var LSPBTN = 'data-kadr-lsp-toggle';
  function lspLabel(b) {
    var t = prefs.lspMin ? 'Развернуть' : 'Свернуть';
    b.title = t; b.setAttribute('aria-label', t); b.setAttribute('aria-expanded', String(!prefs.lspMin));
  }
  function syncLsp() {
    var w = document.querySelector('.lsp-server-widget'), b = document.querySelector('[' + LSPBTN + ']');
    if (!ready || !skin || !w) { if (b) b.remove(); return; }
    if (b && b.parentNode === w) { lspLabel(b); return; }
    if (b) b.remove();
    b = document.createElement('button');
    b.type = 'button';
    b.className = 'kadr-lsp-toggle';
    b.setAttribute(LSPBTN, '');
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      prefs.lspMin = !prefs.lspMin;
      store.set({ lspMin: prefs.lspMin });
      syncPrefs(); lspLabel(b); measureSoon();
    });
    lspLabel(b);
    w.appendChild(b);
  }

  var me = null;
  function myId() {
    if (me) return me;
    var a = document.querySelector('#elUserLink_menu a[href*="/profile/"], #elMobileDrawer a[href*="/profile/"]');
    var m = a && /\/profile\/(\d+)-/.exec(a.href);
    if (m) me = m[1];
    return me;
  }
  function markOwn() {
    var v = document.getElementById('elMessageViewer');
    var marked = document.querySelectorAll('[data-kadr-own]');
    if (!v || !skin) { for (var j = 0; j < marked.length; j++) marked[j].removeAttribute('data-kadr-own'); return; }
    var uid = myId(), list = v.querySelectorAll('article.ipsComment');
    for (var i = 0; i < list.length; i++) {
      var d = list[i].querySelector('[data-quotedata]'), own = false;
      if (uid && d) { try { own = String(JSON.parse(d.getAttribute('data-quotedata')).userid) === uid; } catch (e) {} }
      list[i].toggleAttribute('data-kadr-own', own);
    }
  }

  var ENTRY = 'data-kadr-entry';
  var TOUCH = false;
  try { TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches; } catch (e) {}
  if (!TOUCH) TOUCH = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  var entryOn = true;
  var sheet = null;

  var ICON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' " +
    "stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 8.6V6.6A2.6 2.6 0 0 1 6.6 4h2M15.4 4h2A2.6 2.6 0 0 1 20 6.6v2" +
    "M20 15.4v2a2.6 2.6 0 0 1-2.6 2.6h-2M8.6 20h-2A2.6 2.6 0 0 1 4 17.4v-2'/%3E%3Ccircle cx='12' cy='12' r='3.4' fill='%23000' stroke='none'/%3E%3C/svg%3E\")";

  function syncEntry() {
    var old = document.querySelectorAll('[' + ENTRY + ']'), i;
    var nav = entryOn && TOUCH && ready ? document.getElementById('elMobileNav') : null;
    for (i = 0; i < old.length; i++) if (!nav || old[i].parentNode !== nav) old[i].remove();
    if (!nav || nav.querySelector(':scope > [' + ENTRY + ']')) return;
    var li = document.createElement('li');
    li.setAttribute(ENTRY, '');
    var a = document.createElement('a');
    a.href = '#';
    a.setAttribute('role', 'button');
    a.setAttribute('title', 'Тема оформления');
    a.setAttribute('aria-label', 'Тема оформления');
    a.setAttribute('aria-haspopup', 'dialog');
    var ic = document.createElement('i');
    ic.className = 'kadr-ico';
    ic.setAttribute('aria-hidden', 'true');
    ic.style.cssText = 'display:inline-block;width:1.15em;height:1.15em;vertical-align:-.2em;background-color:currentColor;' +
      '-webkit-mask:' + ICON + ' center/contain no-repeat;mask:' + ICON + ' center/contain no-repeat';
    a.appendChild(ic);
    a.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      openSheet(a);
    });
    li.appendChild(a);
    var drawers = nav.querySelectorAll(':scope > [data-ipsdrawer]');
    var menu = nav.querySelector(':scope > [data-ipsdrawer-drawerelem="#elMobileDrawer"]') || drawers[drawers.length - 1];
    nav.insertBefore(li, menu || null);
  }

  var SHEET_CSS =
    ':host{all:initial}' +
    '.wrap{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;' +
      'font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-tap-highlight-color:transparent}' +
    '.scrim{position:absolute;inset:0;background:rgb(0 0 0/.42);opacity:0;transition:opacity .3s ease;touch-action:none}' +
    '.panel{position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;height:72vh;height:min(72dvh,600px);' +
      'background:rgb(var(--kb,12 13 15));border-radius:26px 26px 0 0;overflow:hidden;' +
      'box-shadow:0 -18px 48px rgb(0 0 0/.5),inset 0 1px 0 rgb(255 255 255/.07);' +
      'transform:translateY(105%);transition:transform .46s cubic-bezier(.2,.9,.24,1),background-color .35s}' +
    '.open .scrim{opacity:1}.open .panel{transform:none}' +
    '.grab{flex:none;height:26px;display:grid;place-items:center;touch-action:none;cursor:grab}' +
    '.grab i{width:42px;height:5px;border-radius:9px;background:rgb(255 255 255/.24)}' +
    'iframe{flex:1;width:100%;min-height:0;border:0;display:block;background:transparent;color-scheme:dark;visibility:hidden}' +
    'iframe.ready{visibility:visible}' +
    '@media (min-width:600px){.panel{border-radius:26px;margin-bottom:16px}}' +
    '@media (prefers-reduced-motion:reduce){.scrim,.panel{transition:none}}';

  var lockWas = null;
  function lockPage(on) {
    var st = root.style;
    if (on && !lockWas) {
      lockWas = [st.getPropertyValue('overflow'), st.getPropertyPriority('overflow')];
      st.setProperty('overflow', 'hidden', 'important');
    } else if (!on && lockWas) {
      if (lockWas[0]) st.setProperty('overflow', lockWas[0], lockWas[1]); else st.removeProperty('overflow');
      lockWas = null;
    }
  }
  function tintSheet() { if (sheet) sheet.wrap.style.setProperty('--kb', K.uiVars(state)['--bg']); }
  function openSheet(from) {
    if (sheet) return;
    var url;
    try { url = chrome.runtime.getURL('popup.html') + '#sheet' + (isLight() ? '-light' : ''); } catch (e) { return; }
    var host = document.createElement('kadr-sheet');
    var shadow = host.attachShadow({ mode: 'closed' });
    var css = document.createElement('style');
    css.textContent = SHEET_CSS;
    var wrap = document.createElement('div'); wrap.className = 'wrap';
    var scrim = document.createElement('div'); scrim.className = 'scrim';
    var panel = document.createElement('div'); panel.className = 'panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Kadr — тема оформления');
    var grab = document.createElement('div'); grab.className = 'grab';
    grab.appendChild(document.createElement('i'));
    var frame = document.createElement('iframe');
    frame.title = 'Kadr — тема оформления';
    frame.addEventListener('load', function () { frame.classList.add('ready'); try { frame.focus(); } catch (e) {} });
    frame.src = url;
    panel.append(grab, frame);
    wrap.append(scrim, panel);
    shadow.append(css, wrap);
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483600';
    root.appendChild(host);
    lockPage(true);
    sheet = { host: host, wrap: wrap, panel: panel, frame: frame, from: from };
    tintSheet();
    place();
    void panel.offsetHeight;
    wrap.classList.add('open');

    scrim.addEventListener('click', closeSheet);
    var y0 = 0, dy = 0, t0 = 0, drag = false;
    grab.addEventListener('pointerdown', function (e) {
      drag = true; y0 = e.clientY; dy = 0; t0 = e.timeStamp;
      panel.style.transition = 'none';
      try { grab.setPointerCapture(e.pointerId); } catch (x) {}
    });
    grab.addEventListener('pointermove', function (e) {
      if (!drag) return;
      dy = Math.max(0, e.clientY - y0);
      panel.style.transform = 'translateY(' + dy + 'px)';
    });
    function end(e) {
      if (!drag) return;
      drag = false;
      panel.style.transition = '';
      var v = dy / Math.max(1, e.timeStamp - t0);
      if (dy > 110 || (dy > 24 && v > 0.55)) closeSheet(); else panel.style.transform = '';
    }
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
    window.addEventListener('keydown', onSheetKey, true);
    window.addEventListener('message', onSheetMsg);
  }
  function onSheetKey(e) {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    closeSheet();
  }
  function onSheetMsg(e) {
    if (!sheet || e.source !== sheet.frame.contentWindow) return;
    var d = e.data, p = sheet.panel;
    if (d === 'kadr:close') closeSheet();
    else if (d && d.kadr === 'drag' && d.dy >= 0) {
      p.style.transition = 'none';
      p.style.transform = 'translateY(' + Math.min(2000, +d.dy || 0) + 'px)';
    } else if (d && d.kadr === 'drop') {
      p.style.transition = '';
      if (d.dy > 110 || (d.dy > 24 && d.v > 0.55)) closeSheet(); else p.style.transform = '';
    }
  }
  function closeSheet() {
    if (!sheet) return;
    var s = sheet;
    sheet = null;
    lockPage(false);
    window.removeEventListener('keydown', onSheetKey, true);
    window.removeEventListener('message', onSheetMsg);
    s.panel.style.transform = '';
    s.wrap.classList.remove('open');
    setTimeout(function () { s.host.remove(); }, 480);
    if (s.from && s.from.isConnected) try { s.from.focus({ preventScroll: true }); } catch (e) {}
  }

  function measure() {
    if (!skin) return;
    var hero = document.querySelector('#ipsLayout_header .focus-header'), foot = document.querySelector('.focus-mobile-footer');
    var h = hero ? Math.round(hero.getBoundingClientRect().height) : 0;
    if (h > 0 && root.style.getPropertyValue('--kd-hero') !== h + 'px') root.style.setProperty('--kd-hero', h + 'px');
    var f = foot ? Math.round(foot.getBoundingClientRect().height) : 0;
    if (f > 0 && root.style.getPropertyValue('--kd-footer') !== f + 'px') root.style.setProperty('--kd-footer', f + 'px');
  }
  var measureTimer = 0;
  function measureSoon() { clearTimeout(measureTimer); measureTimer = setTimeout(measure, 60); }
  window.addEventListener('resize', measureSoon);

  function readPrefs(d) {
    if ('ckeTint' in d) prefs.ckeTint = d.ckeTint !== false;
    if ('fx' in d) prefs.fx = d.fx === 'glass' || d.fx === 'material' ? d.fx : 'plain';
    if ('shadows' in d) prefs.shadows = d.shadows !== false;
    if ('lspMin' in d) prefs.lspMin = d.lspMin === true;
    if ('icons' in d) prefs.icons = d.icons === 'solar' || d.icons === 'remix' ? d.icons : 'native';
    if ('iconCss' in d) iconCss = d.iconCss || '';
    if ('iconVer' in d) iconVer = d.iconVer || '';
  }
  var siteScheme = null;
  function noteScheme() {
    var sc = native === 'light' ? 'light' : 'dark';
    if (ready && native && siteScheme !== sc) { siteScheme = sc; store.set({ siteScheme: sc }); }
  }
  store.get(['theme', 'seed', 'skin', 'menuEntry', 'ckeTint', 'fx', 'shadows', 'lspMin', 'icons', 'iconCss', 'iconVer', 'siteScheme'], function (d) {
    d = d || {};
    state = { theme: d.theme || K.OFF, seed: d.seed || null };
    skin = d.skin !== false;
    entryOn = d.menuEntry !== false;
    readPrefs(d);
    siteScheme = d.siteScheme || null;
    ready = true;
    apply();
    syncEntry();
    measureSoon();
  });

  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== 'local') return;
    if (ch.theme || ch.seed || ch.skin) {
      if (ch.theme) state.theme = ch.theme.newValue || K.OFF;
      if (ch.seed) state.seed = ch.seed.newValue || null;
      if (ch.skin) skin = ch.skin.newValue !== false;
      apply();
      tintSheet();
      measureSoon();
    }
    if (ch.menuEntry) { entryOn = ch.menuEntry.newValue !== false; syncEntry(); }
    if (ch.ckeTint || ch.fx || ch.shadows || ch.lspMin || ch.icons || ch.iconCss || ch.iconVer) {
      var d = {};
      ['ckeTint', 'fx', 'shadows', 'lspMin', 'icons', 'iconCss', 'iconVer'].forEach(function (k) { if (ch[k]) d[k] = ch[k].newValue; });
      readPrefs(d);
      syncPrefs(); syncIcons(); syncLsp(); measureSoon();
    }
  });

  var settled = false;
  function tick() {
    place();
    if (!settled) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.addEventListener('load', function () { place(); syncEntry(); measure(); liftColors(); syncLsp(); markOwn(); noteScheme(); setTimeout(function () { settled = true; measure(); }, 1500); });
  document.addEventListener('DOMContentLoaded', function () { place(); syncEntry(); measure(); liftColors(); syncLsp(); markOwn(); noteScheme(); });

  var timer = 0;
  function later() {
    if (!timer) timer = setTimeout(function () { timer = 0; place(); syncEntry(); measure(); liftColors(); syncLsp(); markOwn(); }, 120);
  }
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i], j;
      if (r.target === styleEl) continue;
      for (j = 0; j < r.addedNodes.length; j++) if (r.addedNodes[j] !== styleEl && r.addedNodes[j].nodeType === 1) { later(); return; }
      for (j = 0; j < r.removedNodes.length; j++) if (r.removedNodes[j].nodeType === 1 && r.removedNodes[j] !== styleEl) { later(); return; }
    }
  }).observe(root, { childList: true, subtree: true });
})();
