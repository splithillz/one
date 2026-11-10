(function () {
  'use strict';
  var K = window.KADR;
  var store = chrome.storage.local;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  // Шторка внутри сайта (iframe из content.js); режим вёрстки уже выставил env.js.
  var SHEET = location.hash === '#sheet';

  /* ---------- значки интерфейса ---------- */
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
  function svg(d, filled) {
    var s = document.createElementNS(SVGNS, 'svg'), p = document.createElementNS(SVGNS, 'path');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    if (filled) s.setAttribute('fill', 'currentColor');
    else {
      s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.9');
      s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    }
    p.setAttribute('d', d);
    s.appendChild(p);
    return s;
  }
  function ui(name) { return svg(UI[name]); }

  $('openSite').appendChild(ui('external'));
  $('closeSheet').appendChild(ui('close'));
  $('heroSave').prepend(svg('M7 3.5h10a1 1 0 0 1 1 1v15.2a.5.5 0 0 1-.8.4L12 16.4l-5.2 3.7a.5.5 0 0 1-.8-.4V4.5a1 1 0 0 1 1-1Z', true));

  function closeSheet() { try { parent.postMessage('kadr:close', '*'); } catch (e) {} }
  $('closeSheet').addEventListener('click', closeSheet);
  if (SHEET) document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  /* ---------- темы ---------- */
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
  // «Родная» (сайт как есть) и готовые палитры — одинаковые плитки.
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

  // «Свой»: сама плитка — нативный выбор цвета, поверх неё прозрачный <input type="color">.
  var custom = el('label', 'th custom');
  var cSw = el('span', 'th-sw');
  cSw.appendChild(el('i'));
  var pick = document.createElement('input');
  pick.type = 'color';
  pick.value = '#5ec8ff';
  pick.setAttribute('aria-label', 'Свой цвет темы');
  custom.append(cSw, el('span', 'th-nm', 'Свой'), check(), pick);
  box.appendChild(custom);

  function paintCustom() {
    themeVars(custom, K.fromAccent(pick.value));
    custom.title = pick.value.toUpperCase();
  }
  var pickTimer = 0;
  pick.addEventListener('click', function () { setTheme('custom', pick.value); });
  pick.addEventListener('input', function () {
    paintCustom();
    // пока тянешь ползунок — не чаще ~11 раз в секунду, вкладкам сайта хватит
    if (!pickTimer) pickTimer = setTimeout(function () { pickTimer = 0; setTheme('custom', pick.value); }, 90);
  });
  pick.addEventListener('change', function () { setTheme('custom', pick.value); });

  // Стрелки внутри группы, один таб-стоп.
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

  function setTheme(id, seed) {
    cur.theme = id;
    renderDiag();
    if (id === 'custom') {
      cur.seed = seed;
      store.set({ theme: 'custom', seed: seed });
    } else {
      store.set({ theme: id }); // свой цвет помним, даже когда выбрана другая тема
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
    custom.toggleAttribute('data-on', cur.theme === 'custom');
    var v = K.uiVars(cur);
    for (var k in v) root.style.setProperty(k, v[k]);
    themeColor.content = 'rgb(' + v['--bg'].split(' ').join(',') + ')';
    // превью — сайт под этой темой: те же цвета, что получит страница
    var L = K.siteLook(cur, skinOn), hero = document.querySelector('.hero');
    hero.classList.toggle('skin', skinOn);
    hero.style.setProperty('--k-good', L.good);
    hero.style.setProperty('--k-page', L.page);
    hero.style.setProperty('--k-panel', L.panel);
    hero.style.setProperty('--k-raised', L.raised);
    hero.style.setProperty('--k-badge', L.badge);
    hero.style.setProperty('--k-rate', L.rate);
    hero.style.setProperty('--k-rate-tx', L.rateText);
    hero.style.setProperty('--k-link', L.link);
    hero.style.setProperty('--k-me', L.me);
    $('heroName').textContent = K.themeName(cur);
  }

  /* ---------- новый дизайн сайта ---------- */
  var skinOn = true;
  function renderSkin() { $('skinSwitch').setAttribute('aria-checked', String(skinOn)); }
  $('skinSwitch').addEventListener('click', function () {
    skinOn = !skinOn;
    store.set({ skin: skinOn });
    renderSkin();
    render();
  });

  /* ---------- снимок сайта для доработки ---------- */
  // Сам снимок делает content.js в открытой вкладке сайта; здесь только кнопка и состояние.
  var snapTimer = 0;
  function renderSnap(v) {
    var t = '';
    if (v === 'work') t = 'Собираю…';
    else if (/^done:/.test(v)) t = 'Готово · ' + v.slice(5) + ' КБ';
    else if (/^error:/.test(v)) t = 'Ошибка';
    else if (v === 'none') t = 'Открой сайт';
    $('snapState').textContent = t;
    $('snapBtn').title = /^error:/.test(v) ? v.slice(6) : '';
  }
  $('snapBtn').addEventListener('click', function () {
    renderSnap('work');
    store.set({ snap: '', snapReq: Date.now() });
    clearTimeout(snapTimer);
    // ни одна вкладка сайта не откликнулась — значит, сайт не открыт или не на экране
    snapTimer = setTimeout(function () { store.get(['snap'], function (d) { if (!d || !d.snap) renderSnap('none'); }); }, 2500);
  });

  /* ---------- кнопка в шапке сайта (телефон) ---------- */
  var menuOn = true;
  function renderMenu() { $('menuSwitch').setAttribute('aria-checked', String(menuOn)); }
  $('menuSwitch').addEventListener('click', function () {
    menuOn = !menuOn;
    store.set({ menuEntry: menuOn });
    renderMenu();
  });

  /* ---------- доступ к сайту ---------- */
  // Firefox и Chrome с «доступом по клику» могут не дать расширению сайт — тогда тема не применится.
  function checkPerm() {
    if (!chrome.permissions || !chrome.permissions.contains) return;
    chrome.permissions.contains({ origins: K.HOSTS }, function (ok) { $('perm').hidden = !!ok; });
  }
  $('permBtn').addEventListener('click', function () {
    chrome.permissions.request({ origins: K.HOSTS }, function (ok) { if (ok) $('perm').hidden = true; });
  });

  /* ---------- тема не легла на сайт: причина от content.js ---------- */
  var WHY = {
    blocked: 'Браузер не даёт прочитать стили сайта: они лежат на другом домене.',
    csp: 'Сайт запрещает добавлять свои стили.'
  };
  var diag = '';
  function renderDiag() {
    var why = cur.theme !== K.OFF ? WHY[diag] : '';
    $('blocked').hidden = !why;
    $('blockedWhy').textContent = why || '';
  }

  /* ---------- состояние ---------- */
  store.get(['theme', 'seed', 'skin', 'menuEntry', 'diag'], function (d) {
    d = d || {};
    diag = d.diag || '';
    cur = { theme: d.theme || K.OFF, seed: d.seed || null };
    if (/^#[0-9a-f]{6}$/i.test(d.seed || '')) pick.value = d.seed.toLowerCase();
    menuOn = d.menuEntry !== false;
    skinOn = d.skin !== false;
    paintCustom();
    render();
    renderMenu();
    renderSkin();
    renderDiag();
    checkPerm();
  });
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== 'local') return;
    if (ch.diag) { diag = ch.diag.newValue || ''; renderDiag(); }
    if (ch.snap && ch.snap.newValue) { clearTimeout(snapTimer); renderSnap(ch.snap.newValue); }
  });
})();
