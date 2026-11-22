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
  var styleEl = null;
  var prefs = { ckeTint: true, fx: 'plain', shadows: true, lspMin: false, icons: 'native', postSize: 'm' };
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

  var FACES = [];
  try {
    (window.KADR_FONTS || []).forEach(function (f) {
      var bin = atob(f.b64), buf = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      FACES.push(new FontFace('Onest', buf.buffer, { style: 'normal', weight: '400 800', display: 'swap', unicodeRange: f.range }));
    });
  } catch (e) {}
  function syncFont() {
    var on = skin && FACES.length > 0;
    for (var i = 0; i < FACES.length; i++) {
      try {
        if (on && !document.fonts.has(FACES[i])) document.fonts.add(FACES[i]);
        else if (!on && document.fonts.has(FACES[i])) document.fonts.delete(FACES[i]);
      } catch (e) {}
    }
  }
  syncFont();
  function syncPrefs() {
    root.classList.toggle('kadr-cke-tint', skin && prefs.ckeTint);
    root.classList.toggle('kadr-fx-glass', skin && prefs.fx === 'glass');
    root.classList.toggle('kadr-fx-material', skin && prefs.fx === 'material');
    root.classList.toggle('kadr-noshadow', skin && !prefs.shadows);
    if (skin && prefs.lspMin) root.setAttribute('data-kadr-lsp', 'min'); else root.removeAttribute('data-kadr-lsp');
    if (skin && prefs.postSize !== 'm') root.setAttribute('data-kadr-fs', prefs.postSize); else root.removeAttribute('data-kadr-fs');
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
    syncGroups();
    liftColors();
    syncLsp();
    markOwn();
    fitFull = true;
    fitSoon();
  }

  var liftEl = null, fitEl = null, fitPending = false, fitObs = null, fitSeen = null;
  function parseColor(v) {
    var m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v || '');
    if (m) return [+m[1], +m[2], +m[3]].map(Math.round);
    m = /^\s*#([0-9a-f]{3}|[0-9a-f]{6})\s*$/i.exec(v || '');
    if (!m) return null;
    var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1], n = parseInt(h, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function cssStr(s) {
    return '"' + s.replace(/[\\"]/g, '\\$&').replace(/[\0-\x1f\x7f]/g, function (c) { return '\\' + c.charCodeAt(0).toString(16) + ' '; }) + '"';
  }
  function putCss(el, id, css) {
    if (!el) { if (!css) return el; el = document.createElement('style'); el.id = id; }
    if (el.textContent !== css) el.textContent = css;
    if (css && el.parentNode !== root) root.appendChild(el);
    return el;
  }
  function liftColors() {
    if (!ready || !document.body) return;
    var light = isLight(), base = skin ? K.NATIVE : null, list = document.body.querySelectorAll('[style*="color"]'), by = Object.create(null), keys = [], css = '';
    for (var i = 0; i < list.length; i++) {
      var el = list[i], st = el.getAttribute('style'), orig = el.style.color;
      if (!st || !orig) continue;
      var e = by[st];
      if (!e) { e = by[st] = { orig: orig, body: false, head: false }; keys.push(st); }
      if (el.closest('#elProfileHeader, .ipsPageHead_special')) e.head = true; else e.body = true;
    }
    for (var k = 0; k < keys.length; k++) {
      var x = by[keys[k]], c = parseColor(x.orig), sel = '[style=' + cssStr(keys[k]) + ']';
      var b = x.body ? K.liftColor(c, state, light, base) : null;
      var h = x.head ? K.liftColor(c, state, false, base) : null;
      if (b) css += 'html ' + sel + '{color:rgb(' + b.join(',') + ')!important}';
      if (x.head && (h || b) && String(h) !== String(b)) css += 'html :is(#elProfileHeader,.ipsPageHead_special) ' + sel + '{color:' + (h ? 'rgb(' + h.join(',') + ')' : x.orig) + '!important}';
    }
    liftEl = putCss(liftEl, 'kadr-lift', css);
  }

  function clipOf(el, stop, cache) {
    var chain = [], p = el.parentElement, found = null;
    while (p && p !== stop) {
      if (cache.has(p)) { found = cache.get(p); break; }
      chain.push(p);
      if (getComputedStyle(p).overflowX !== 'visible') { found = p; break; }
      p = p.parentElement;
    }
    for (var i = 0; i < chain.length; i++) cache.set(chain[i], found);
    return found;
  }
  function pathOf(el) {
    var parts = [];
    for (var e = el; e && e !== root; e = e.parentElement) {
      if (e.id && document.getElementById(e.id) === e) { parts.unshift('#' + CSS.escape(e.id)); break; }
      for (var i = 1, s = e; (s = s.previousElementSibling); i++);
      parts.unshift(':nth-child(' + i + ')');
    }
    return parts.join('>');
  }
  var FIT = { img: ';height:auto!important', table: ';table-layout:fixed!important;width:100%!important', iframe: '', video: '', embed: '', object: '', svg: '', canvas: '' };
  var WRAP = { nowrap: ';white-space:normal!important;overflow-wrap:anywhere!important', pre: ';white-space:pre-wrap!important;overflow-wrap:anywhere!important' };
  var fitCss = '', fitDone = null, fitCount = -1, fitW = 0, fitFull = true;
  function fitScan(rts) {
    var add = '', cache = new Map();
    for (var i = 0; i < rts.length; i++) {
      var rt = rts[i];
      if (rt.isContentEditable || rt.closest('.cke, [contenteditable]')) continue;
      var box = rt.getBoundingClientRect(), all = rt.getElementsByTagName('*'), skip = null;
      if (!box.width) continue;
      for (var j = 0; j < all.length; j++) {
        var el = all[j];
        if (skip) { if (skip.contains(el)) continue; skip = null; }
        var b = el.getBoundingClientRect();
        if (!b.width || b.right <= box.right + 1 || fitDone.has(el)) continue;
        var clip = clipOf(el, rt, cache);
        if (clip) { skip = clip; continue; }
        skip = el;
        var cs = getComputedStyle(el);
        if (/^(absolute|fixed)$/.test(cs.position)) continue;
        fitDone.add(el);
        add += 'html.kadr-rd ' + pathOf(el) + '{max-width:100%!important;min-width:0!important;box-sizing:border-box!important' + (el.localName in FIT ? FIT[el.localName] : WRAP[cs.whiteSpace] || ';overflow-wrap:anywhere!important') + '}';
      }
    }
    return add;
  }
  function fit() {
    fitPending = false;
    if (!ready || !document.body) return;
    if (!skin) { fitCss = ''; fitFull = true; if (fitEl) fitEl.textContent = ''; return; }
    var rts = document.querySelectorAll('.ipsType_richText'), count = 0;
    if (window.ResizeObserver && window.WeakSet) {
      if (!fitObs) { fitObs = new ResizeObserver(function () { fitSoon(); }); fitSeen = new WeakSet(); }
      for (var o = 0; o < rts.length; o++) if (!fitSeen.has(rts[o])) { fitSeen.add(rts[o]); fitObs.observe(rts[o]); }
    }
    for (var c = 0; c < rts.length; c++) count += rts[c].getElementsByTagName('*').length + 1;
    if (count !== fitCount || innerWidth !== fitW) fitFull = true;
    fitCount = count;
    fitW = innerWidth;
    if (fitFull || !fitDone) {
      fitFull = false;
      fitDone = new WeakSet();
      if (fitCss) { fitCss = ''; fitEl.textContent = ''; }
    }
    for (var round = 0; round < 3; round++) {
      var add = fitScan(rts);
      if (!add) break;
      fitCss += add;
      fitEl = putCss(fitEl, 'kadr-fit', fitCss);
    }
  }
  function fitSoon() {
    if (fitPending) return;
    fitPending = true;
    requestAnimationFrame(fit);
  }
  function onMedia(e) { var t = e.target; if (t && /^(IMG|IFRAME|VIDEO|EMBED|OBJECT)$/.test(t.tagName) && t.closest('.ipsType_richText')) fitSoon(); }
  document.addEventListener('load', onMedia, true);
  document.addEventListener('error', onMedia, true);
  document.addEventListener('loadedmetadata', onMedia, true);
  window.addEventListener('resize', fitSoon);

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

  var GI = 'data-kadr-gi', STAFF = 'Команда проекта';
  var GROUPS = {
    'management': ['crown', 'Руководство проекта', 1],
    'lead administrator': ['a4', 'Администратор 4 уровня', 1],
    'administrator 3 lvl.': ['a3', 'Администратор 3 уровня', 1],
    'administrator 2 lvl.': ['a2', 'Администратор 2 уровня', 1],
    'administrator 1 lvl.': ['a1', 'Администратор 1 уровня', 1],
    'developer': ['wrench', 'Разработчик проекта', 1],
    'technical administrator': ['server', 'Технический администратор', 1],
    'game support': ['headset', 'Игровая поддержка', 1],
    'community manager': ['megaphone', 'Комьюнити-менеджер', 1],
    'head of staff': ['staff', 'Руководитель администрации', 1],
    'head of support': ['headset', 'Руководитель поддержки', 1],
    'head of technical': ['server', 'Руководитель технического отдела', 1],
    'head of faction': ['flag', 'Руководитель фракций', 1],
    'head of ifm': ['incognito', 'Руководитель IFM', 1],
    'head of lfm': ['case', 'Руководитель LFM', 1],
    'head of property': ['home', 'Руководитель отдела имущества', 1],
    'ifm administrator': ['incognito', 'Администратор IFM', 1],
    'lfm administrator': ['case', 'Администратор LFM', 1],
    'property administrator': ['home', 'Администратор имущества', 1],
    'лос сантос проджект': ['verified', 'Официальный аккаунт сервера', 0],
    'government': ['bank', 'Правительство штата', 0],
    'легенда': ['star', '', 0]
  };
  var tip = null, tipFor = null, tipMode = '';
  function giText(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function giInfo(group, badge, plaque) {
    var name = giText(group), key = name.toLowerCase(), g = Object.prototype.hasOwnProperty.call(GROUPS, key) ? GROUPS[key] : null;
    var staff = badge ? (badge.getAttribute('title') || badge.getAttribute('aria-label') || STAFF).trim() : '';
    if (g) return { icon: g[0], title: name, desc: g[1], staff: staff || (g[2] ? STAFF : '') };
    if (name && plaque) return { icon: 'medal', title: name, desc: '', staff: staff };
    if (staff) return { icon: 'shield', title: staff, desc: '', staff: '' };
    return null;
  }
  function giStyle(group) {
    var s = group && (group.matches('[style*="color"]') ? group : group.querySelector('[style*="color"]'));
    return s ? s.getAttribute('style') : '';
  }
  function giName(h) {
    for (var n = h.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) {
      var m = /\s+$/.exec(n.nodeValue);
      if (m) n.splitText(m.index);
      return n;
    }
    return null;
  }
  function giPut(anchor, info, style, keep) {
    if (!anchor || !anchor.parentNode || !info) return;
    var cur = anchor.nextSibling, sig = [info.icon, info.title, info.desc, info.staff, style].join('|');
    if (!(cur && cur.nodeType === 1 && cur.classList.contains('kadr-gi'))) cur = null;
    if (cur && cur.getAttribute('data-kadr-sig') === sig) { keep.add(cur); return; }
    if (cur) cur.remove();
    var el = document.createElement('span');
    el.className = 'kadr-gi';
    el.setAttribute(GI, info.icon);
    el.setAttribute('data-kadr-sig', sig);
    el.setAttribute('data-kadr-gt', info.title);
    if (info.desc) el.setAttribute('data-kadr-gd', info.desc);
    if (info.staff) el.setAttribute('data-kadr-gs', info.staff);
    el.setAttribute('role', 'img');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', [info.title, info.desc, info.staff].filter(Boolean).join('. '));
    if (style) el.setAttribute('style', style);
    anchor.parentNode.insertBefore(el, anchor.nextSibling);
    keep.add(el);
  }
  function syncGroups() {
    var keep = new Set(), i;
    if (ready && skin && document.body) {
      var panes = document.querySelectorAll('.cAuthorPane');
      for (i = 0; i < panes.length; i++) {
        var pane = panes[i], post = pane.closest('article, .ipsComment') || pane.parentElement;
        var group = pane.querySelector('[data-role="group"]'), style = giStyle(group);
        var info = giInfo(group, post.querySelector('.cAuthorPane_badge--moderator'), pane.querySelector('[data-role="group-icon"] img, img.cAuthorGroupIcon'));
        giPut(pane.querySelector('.cAuthorPane_author a'), info, style, keep);
        giPut(post.querySelector('.cAuthorPane_mobile .cAuthorPane_author a'), info, style, keep);
      }
      var head = document.querySelector('#elProfileHeader .cProfileHeader_name'), h1 = head && head.querySelector('h1');
      if (h1) {
        var hg = head.querySelector('span.ipsPageHead_barText');
        giPut(giName(h1), giInfo(hg, null, null), giStyle(hg), keep);
      }
      var cards = document.querySelectorAll('.cUserHovercard');
      for (i = 0; i < cards.length; i++) {
        var t = cards[i].querySelector('.cUserHovercard__title'), p = t && t.nextElementSibling;
        if (t) giPut(t.querySelector('a'), giInfo(p, null, null), giStyle(p), keep);
      }
    }
    var all = document.querySelectorAll('.kadr-gi');
    for (i = 0; i < all.length; i++) if (!keep.has(all[i])) all[i].remove();
    if (tipFor && !tipFor.isConnected) tipHide();
    if (!skin && tip) { tipHide(); tip.remove(); }
  }
  function tipHide() {
    if (tipFor) tipFor.removeAttribute('aria-describedby');
    tipFor = null;
    tipMode = '';
    if (tip) tip.classList.remove('on');
  }
  function tipPlace() {
    if (!tip || !tipFor) return;
    var r = tipFor.getBoundingClientRect(), vw = root.clientWidth || innerWidth, w = tip.offsetWidth, h = tip.offsetHeight, m = 8, gap = 10;
    var below = r.top - gap - h < m, cx = r.left + r.width / 2, left = Math.max(m, Math.min(vw - w - m, cx - w / 2));
    tip.setAttribute('data-side', below ? 'bottom' : 'top');
    left = Math.round(left);
    tip.style.left = left + 'px';
    tip.style.top = Math.round(below ? r.bottom + gap : r.top - gap - h) + 'px';
    tip.style.setProperty('--k-tip-x', Math.max(14, Math.min(w - 14, cx - left)).toFixed(2) + 'px');
  }
  function tipShow(ic, mode) {
    if (!ic.isConnected || !document.body) return;
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'kadr-gtip';
      tip.id = 'kadr-gtip';
      tip.setAttribute('role', 'tooltip');
    }
    if (tip.parentNode !== document.body) document.body.appendChild(tip);
    if (tipFor && tipFor !== ic) tipFor.removeAttribute('aria-describedby');
    tipFor = ic;
    tipMode = mode;
    var h = document.createElement('div'), i = document.createElement('i'), b = document.createElement('b');
    var c = parseColor(ic.style.color), x = c && K.liftColor(c, state, isLight(), K.NATIVE);
    h.className = 'kadr-gtip-h';
    i.setAttribute(GI, ic.getAttribute(GI));
    if (c) i.style.setProperty('--k-gic', 'rgb(' + (x || c).join(',') + ')');
    b.textContent = ic.getAttribute('data-kadr-gt') || '';
    h.append(i, b);
    tip.textContent = '';
    tip.appendChild(h);
    var d = ic.getAttribute('data-kadr-gd'), s = ic.getAttribute('data-kadr-gs');
    if (d) { var dl = document.createElement('div'); dl.className = 'kadr-gtip-d'; dl.textContent = d; tip.appendChild(dl); }
    if (s) { var sl = document.createElement('span'); sl.className = 'kadr-gtip-s'; sl.textContent = s; tip.appendChild(sl); }
    ic.setAttribute('aria-describedby', 'kadr-gtip');
    tipPlace();
    tip.classList.add('on');
  }
  function giOf(t) { return t && t.closest ? t.closest('.kadr-gi') : null; }
  document.addEventListener('pointerover', function (e) {
    var ic = e.pointerType === 'mouse' && giOf(e.target);
    if (ic && tipFor !== ic) tipShow(ic, 'hover');
  });
  document.addEventListener('pointerout', function (e) {
    var ic = giOf(e.target);
    if (ic && ic === tipFor && tipMode === 'hover' && !(e.relatedTarget && ic.contains(e.relatedTarget))) tipHide();
  });
  document.addEventListener('click', function (e) {
    var ic = giOf(e.target);
    if (!ic) return;
    if (tipFor === ic && tipMode === 'pin') tipHide(); else tipShow(ic, 'pin');
  });
  document.addEventListener('pointerdown', function (e) { if (tipFor && !giOf(e.target)) tipHide(); }, true);
  document.addEventListener('focusin', function (e) {
    var ic = giOf(e.target);
    if (ic && tipFor !== ic) tipShow(ic, 'focus');
  });
  document.addEventListener('focusout', function (e) { if (tipMode === 'focus' && e.target === tipFor) tipHide(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tipFor) tipHide(); });
  var tipRaf = 0;
  function tipFollow() {
    if (!tipFor || tipRaf) return;
    tipRaf = requestAnimationFrame(function () {
      tipRaf = 0;
      if (!tipFor) return;
      var r = tipFor.getBoundingClientRect();
      if (!tipFor.isConnected || !r.width || r.bottom < 0 || r.top > innerHeight) tipHide(); else tipPlace();
    });
  }
  window.addEventListener('scroll', tipFollow, { capture: true, passive: true });
  window.addEventListener('resize', tipFollow);

  var UPD_URL = '/index.php?/topic/924-x/', UPD = 'data-kadr-upd', updLatest = '', updAt = 0;
  function verNum(v) { var p = String(v || '').split('.'); return (+p[0] || 0) * 1e6 + (+p[1] || 0) * 1e3 + (+p[2] || 0); }
  function newer(v) { return !!v && verNum(v) > verNum(VER); }
  function zipVersion(doc) {
    var post = doc.querySelector('article [data-role="commentContent"]'), best = '', re = /kadr-themes-lsforum-v(\d+\.\d+\.\d+)\.zip/g, m;
    if (!post) return '';
    while ((m = re.exec(post.innerHTML))) if (verNum(m[1]) > verNum(best)) best = m[1];
    return best;
  }
  function checkUpdate() {
    if (!ready || !myId()) return;
    var now = Date.now();
    if (/[?&\/]topic\/924(-|\/|$)/.test(location.search + location.pathname)) {
      var v = zipVersion(document);
      if (v) store.set({ updLatest: v, updAt: now });
      return;
    }
    if (now - updAt < 864e5) return;
    updAt = now;
    store.set({ updAt: now });
    fetch(UPD_URL, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var v = t && zipVersion(new DOMParser().parseFromString(t, 'text/html'));
      if (v) store.set({ updLatest: v });
    }).catch(function () {});
  }
  function updSoon() { setTimeout(checkUpdate, 3000); }
  function syncUpd() {
    var list = document.querySelectorAll('[data-kadr-entry]');
    for (var i = 0; i < list.length; i++) list[i].toggleAttribute(UPD, newer(updLatest));
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
    syncUpd();
  }

  var SHEET_CSS =
    ':host{all:initial}' +
    '.wrap{position:fixed;left:0;right:0;bottom:0;height:100vh;height:100lvh;display:flex;align-items:flex-end;justify-content:center;' +
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
    try { url = chrome.runtime.getURL('popup.html') + '#sheet' + (native === 'light' ? '-light' : ''); } catch (e) { return; }
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
    host.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:100vh;height:100lvh;z-index:2147483600';
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
    else if (d && d.kadr === 'go' && typeof d.url === 'string' && d.url.indexOf(location.origin + '/') === 0) { closeSheet(); location.href = d.url; }
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
    if ('postSize' in d) prefs.postSize = d.postSize === 'l' || d.postSize === 'xl' ? d.postSize : 'm';
  }
  var siteScheme = null;
  function noteScheme() {
    var sc = native === 'light' ? 'light' : 'dark';
    if (ready && native && siteScheme !== sc) { siteScheme = sc; store.set({ siteScheme: sc }); }
  }
  store.get(['theme', 'seed', 'skin', 'menuEntry', 'ckeTint', 'fx', 'shadows', 'lspMin', 'icons', 'iconCss', 'iconVer', 'siteScheme', 'postSize', 'updLatest', 'updAt'], function (d) {
    d = d || {};
    state = { theme: d.theme || K.OFF, seed: d.seed || null };
    skin = d.skin !== false;
    entryOn = d.menuEntry !== false;
    readPrefs(d);
    siteScheme = d.siteScheme || null;
    updLatest = d.updLatest || '';
    updAt = +d.updAt || 0;
    ready = true;
    apply();
    syncEntry();
    measureSoon();
    if (document.readyState === 'complete') updSoon();
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
    if (ch.updLatest) { updLatest = ch.updLatest.newValue || ''; syncUpd(); }
    if (ch.updAt) updAt = +ch.updAt.newValue || 0;
    if (ch.ckeTint || ch.fx || ch.shadows || ch.lspMin || ch.icons || ch.iconCss || ch.iconVer || ch.postSize) {
      var d = {};
      ['ckeTint', 'fx', 'shadows', 'lspMin', 'icons', 'iconCss', 'iconVer', 'postSize'].forEach(function (k) { if (ch[k]) d[k] = ch[k].newValue; });
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
  window.addEventListener('load', function () { place(); syncEntry(); measure(); syncGroups(); liftColors(); syncLsp(); markOwn(); noteScheme(); fitSoon(); updSoon(); setTimeout(function () { settled = true; measure(); }, 1500); });
  document.addEventListener('DOMContentLoaded', function () { place(); syncEntry(); measure(); syncGroups(); liftColors(); syncLsp(); markOwn(); noteScheme(); fitSoon(); });
  function settle() { setTimeout(function () { root.classList.add('kadr-settled'); }, 1600); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle); else settle();

  var timer = 0;
  function mine(n) { return n === styleEl || n === liftEl || n === fitEl || (!!tip && n === tip) || !!(n.classList && n.classList.contains('kadr-gi')); }
  function later() {
    if (!timer) timer = setTimeout(function () { timer = 0; place(); syncEntry(); measure(); syncGroups(); liftColors(); syncLsp(); markOwn(); fitSoon(); }, 120);
  }
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i], j;
      if (mine(r.target)) continue;
      for (j = 0; j < r.addedNodes.length; j++) if (r.addedNodes[j].nodeType === 1 && !mine(r.addedNodes[j])) { later(); return; }
      for (j = 0; j < r.removedNodes.length; j++) if (r.removedNodes[j].nodeType === 1 && !mine(r.removedNodes[j])) { later(); return; }
    }
  }).observe(root, { childList: true, subtree: true });
})();
