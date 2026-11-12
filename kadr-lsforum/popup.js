(function () {
  'use strict';
  var K = window.KADR;
  var store = chrome.storage.local;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  var SHEET = /^#sheet/.test(location.hash);
  var siteLight = /light/.test(location.hash);

  var UI = {
    external: 'M8 16 16 8M9.5 8H16v6.5',
    close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
    check: 'M5.5 12.5l4 4 9-9.5'
  };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function ui(name) {
    var s = document.createElementNS(SVGNS, 'svg'), p = document.createElementNS(SVGNS, 'path');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.9');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('d', UI[name]);
    s.appendChild(p);
    return s;
  }

  $('openSite').appendChild(ui('external'));
  $('closeSheet').appendChild(ui('close'));

  function closeSheet() { try { parent.postMessage('kadr:close', '*'); } catch (e) {} }
  $('closeSheet').addEventListener('click', closeSheet);
  if (SHEET) document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  if (SHEET) (function () {
    var st = null;
    function say(m) { try { parent.postMessage(m, '*'); } catch (e) {} }
    document.addEventListener('touchstart', function (e) {
      st = null;
      if (e.touches.length !== 1 || (e.target.closest && e.target.closest('input[type="range"]'))) return;
      var t = e.touches[0], sc = document.scrollingElement;
      st = { x: t.screenX, y: t.screenY, at: e.timeStamp, top: !sc || sc.scrollTop <= 0, end: !sc || sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 1, on: false, block: false, dy: 0 };
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!st) return;
      var t = e.touches[0], dy = t.screenY - st.y, dx = t.screenX - st.x;
      if (st.block) { if (e.cancelable) e.preventDefault(); return; }
      if (!st.on) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { st = null; return; }
        if (dy <= -8) {
          if (!st.end) { st = null; return; }
          st.block = true;
          if (e.cancelable) e.preventDefault();
          return;
        }
        if (dy < 10) return;
        if (!st.top) { st = null; return; }
        st.on = true;
      }
      if (e.cancelable) e.preventDefault();
      st.dy = Math.max(0, dy);
      say({ kadr: 'drag', dy: st.dy });
    }, { passive: false });
    function end(e) {
      var s0 = st;
      st = null;
      if (s0 && s0.on) say({ kadr: 'drop', dy: s0.dy, v: s0.dy / Math.max(1, e.timeStamp - s0.at) });
    }
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);
  })();

  var cur = { theme: K.OFF, seed: null };
  var box = $('themes');
  var themeColor = document.createElement('meta');
  themeColor.name = 'theme-color';
  document.head.appendChild(themeColor);

  function themeVars(node, t) {
    node.style.setProperty('--t-bg', t.bg);
    node.style.setProperty('--t-s2', t.s2);
    node.style.setProperty('--t-s3', t.s3);
    node.style.setProperty('--t-acc', t.acc);
    node.style.setProperty('--t-ink', t.ink);
  }
  function check() { var c = el('span', 'th-ck'); c.appendChild(ui('check')); return c; }
  [K.NATIVE].concat(K.THEMES).forEach(function (t) {
    var b = el('button', 'th');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.id = t.id;
    var sw = el('span', 'th-sw');
    sw.appendChild(el('i'));
    b.append(sw, el('span', 'th-nm', t.name), check());
    themeVars(b, t);
    b.addEventListener('click', function () { setTheme(t.id); });
    box.appendChild(b);
  });

  var seed = '#5ec8ff';
  var custom = el('button', 'th custom');
  custom.type = 'button';
  custom.setAttribute('role', 'radio');
  custom.dataset.id = 'custom';
  var cSw = el('span', 'th-sw');
  cSw.appendChild(el('i'));
  custom.append(cSw, el('span', 'th-nm', 'Свой'), check());
  box.appendChild(custom);
  var tune = $('tune'), tH = $('tuneH'), tS = $('tuneS'), tL = $('tuneL');

  function paintCustom() {
    themeVars(custom, K.fromAccent(seed));
    custom.title = seed.toUpperCase();
    var h = +tH.value, s = +tS.value, l = +tL.value;
    tS.style.setProperty('--track', 'linear-gradient(90deg, hsl(' + h + ' 15% ' + l + '%), hsl(' + h + ' 100% ' + l + '%))');
    tL.style.setProperty('--track', 'linear-gradient(90deg, hsl(' + h + ' ' + s + '% 30%), hsl(' + h + ' ' + s + '% 55%), hsl(' + h + ' ' + s + '% 85%))');
    tune.style.setProperty('--knob', seed);
  }
  function slidersFromSeed() {
    var hsl = K.toHsl(K.rgb(seed));
    tH.value = Math.round(hsl[0]);
    tS.value = Math.max(20, Math.round(hsl[1] * 100));
    tL.value = Math.min(80, Math.max(35, Math.round(hsl[2] * 100)));
  }
  var tuneTimer = 0;
  function onTune() {
    seed = K.hex(K.fromHsl(+tH.value, +tS.value / 100, +tL.value / 100));
    paintCustom();
    if (!tuneTimer) tuneTimer = setTimeout(function () { tuneTimer = 0; setTheme('custom', seed); }, 90);
  }
  [tH, tS, tL].forEach(function (r) {
    r.addEventListener('input', onTune);
    r.addEventListener('change', function () { clearTimeout(tuneTimer); tuneTimer = 0; setTheme('custom', seed); });
  });
  custom.addEventListener('click', function () {
    if (cur.theme === 'custom') tune.hidden = !tune.hidden;
    else { tune.hidden = false; setTheme('custom', seed); }
  });

  function radios() { return [].slice.call(box.querySelectorAll('[role="radio"]')); }
  box.addEventListener('keydown', function (e) {
    var k = e.key;
    var step = k === 'ArrowRight' || k === 'ArrowDown' ? 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 0;
    var list = radios(), i = list.indexOf(document.activeElement);
    if (!step || i < 0) return;
    e.preventDefault();
    var next = list[(i + step + list.length) % list.length];
    next.focus();
    next.click();
  });

  function setTheme(id, s) {
    cur.theme = id;
    if (id === 'custom') {
      cur.seed = s;
      store.set({ theme: 'custom', seed: s });
    } else {
      tune.hidden = true;
      store.set({ theme: id });
    }
    render();
  }
  function render() {
    var list = radios(), on = null;
    list.forEach(function (b) {
      var sel = b.dataset.id === cur.theme;
      b.setAttribute('aria-checked', String(sel));
      if (sel) on = b;
    });
    list.forEach(function (b) { b.tabIndex = b === (on || list[0]) ? 0 : -1; });
    var v = K.uiVars(cur);
    for (var k in v) root.style.setProperty(k, v[k]);
    themeColor.content = 'rgb(' + v['--bg'].split(' ').join(',') + ')';
    var L = K.siteLook(cur, siteLight), hero = document.querySelector('.hero');
    hero.classList.toggle('skin', prefs.skin);
    hero.classList.toggle('light', siteLight);
    [['--f-page', L.page], ['--f-panel', L.panel], ['--f-raised', L.raised], ['--f-line', L.line], ['--f-acc', L.acc], ['--f-ink', L.ink],
      ['--f-tx', L.text], ['--f-tx2', L.text2], ['--f-mut', L.muted]].forEach(function (x) { hero.style.setProperty(x[0], x[1]); });
    $('heroName').textContent = K.themeName(cur);
  }

  var prefs = { skin: true, menuEntry: true, ckeTint: true, shadows: true, fx: 'plain' };
  function renderOpts() {
    $('skinSwitch').setAttribute('aria-checked', String(prefs.skin));
    $('menuSwitch').setAttribute('aria-checked', String(prefs.menuEntry));
    $('ckeSwitch').setAttribute('aria-checked', String(prefs.ckeTint));
    $('shadowSwitch').setAttribute('aria-checked', String(prefs.shadows));
    [].forEach.call($('fxSeg').querySelectorAll('[data-fx]'), function (b) {
      var on = b.dataset.fx === prefs.fx;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    [].forEach.call(document.querySelectorAll('.opt.dep'), function (o) { o.setAttribute('aria-disabled', String(!prefs.skin)); });
  }
  function toggle(id, key) {
    $(id).addEventListener('click', function () {
      prefs[key] = !prefs[key];
      var d = {}; d[key] = prefs[key];
      store.set(d);
      renderOpts();
      render();
    });
  }
  toggle('skinSwitch', 'skin');
  toggle('menuSwitch', 'menuEntry');
  toggle('ckeSwitch', 'ckeTint');
  toggle('shadowSwitch', 'shadows');
  $('fxSeg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fx]');
    if (!b) return;
    prefs.fx = b.dataset.fx;
    store.set({ fx: prefs.fx });
    renderOpts();
  });
  $('fxSeg').addEventListener('keydown', function (e) {
    var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    var list = [].slice.call($('fxSeg').querySelectorAll('[data-fx]')), i = list.indexOf(document.activeElement);
    var next = list[(Math.max(0, i) + step + list.length) % list.length];
    next.focus();
    next.click();
  });

  function checkPerm() {
    if (!chrome.permissions || !chrome.permissions.contains) return;
    chrome.permissions.contains({ origins: K.HOSTS }, function (ok) { $('perm').hidden = !!ok; });
  }
  $('permBtn').addEventListener('click', function () {
    chrome.permissions.request({ origins: K.HOSTS }, function (ok) { if (ok) $('perm').hidden = true; });
  });

  store.get(['theme', 'seed', 'skin', 'menuEntry', 'ckeTint', 'shadows', 'fx', 'siteScheme'], function (d) {
    d = d || {};
    cur = { theme: d.theme || K.OFF, seed: d.seed || null };
    if (/^#[0-9a-f]{6}$/i.test(d.seed || '')) seed = d.seed.toLowerCase();
    prefs.skin = d.skin !== false;
    prefs.menuEntry = d.menuEntry !== false;
    prefs.ckeTint = d.ckeTint !== false;
    prefs.shadows = d.shadows !== false;
    prefs.fx = d.fx === 'glass' || d.fx === 'material' ? d.fx : 'plain';
    if (!SHEET && d.siteScheme === 'light') siteLight = true;
    slidersFromSeed();
    paintCustom();
    render();
    renderOpts();
    checkPerm();
  });
})();
