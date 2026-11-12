(function () {
  'use strict';
  var K = window.KADR;
  var store = chrome.storage.local;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  // Шторка внутри форума (iframe из content.js); режим вёрстки уже выставил env.js.
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
  // Свайпы по шторке не должны двигать форум под ней. Когда настройки стоят в самом верху и палец идёт вниз,
  // двигается сама шторка (её двигает страница форума — content.js, сюда приходят только касания) и закрывается.
  // Когда листать внутри нечего или некуда, жест гасится здесь, иначе браузер передал бы прокрутку странице.
  if (SHEET) (function () {
    var st = null;
    function say(m) { try { parent.postMessage(m, '*'); } catch (e) {} }
    document.addEventListener('touchstart', function (e) {
      st = null;
      if (e.touches.length !== 1) return;
      var t = e.touches[0], sc = document.scrollingElement;
      // screenY, а не clientY: шторка едет вместе с пальцем, и координаты внутри неё почти не меняются
      st = { x: t.screenX, y: t.screenY, at: e.timeStamp, top: !sc || sc.scrollTop <= 0, end: !sc || sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 1, on: false, block: false, dy: 0 };
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!st) return;
      var t = e.touches[0], dy = t.screenY - st.y, dx = t.screenX - st.x;
      if (st.block) { if (e.cancelable) e.preventDefault(); return; }
      if (!st.on) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { st = null; return; }  // вбок — не наше
        if (dy <= -8) {                                                             // палец вверх: листать вниз
          if (!st.end) { st = null; return; }                                       // есть куда — обычная прокрутка
          st.block = true;
          if (e.cancelable) e.preventDefault();
          return;
        }
        if (dy < 10) return;
        if (!st.top) { st = null; return; }                                          // палец вниз, но настройки не в начале — обычная прокрутка
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
  // «Родная» (форум как есть) и готовые палитры — одинаковые плитки.
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
    // пока тянешь ползунок — не чаще ~11 раз в секунду, вкладкам форума хватит
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
    // превью — форум под этой темой: те же цвета, что получит страница
    var L = K.siteLook(cur), hero = document.querySelector('.hero');
    hero.classList.toggle('skin', skinOn);
    hero.style.setProperty('--f-page', L.page);
    hero.style.setProperty('--f-panel', L.panel);
    hero.style.setProperty('--f-raised', L.raised);
    hero.style.setProperty('--f-line', L.line);
    hero.style.setProperty('--f-acc', L.acc);
    hero.style.setProperty('--f-ink', L.ink);
    $('heroName').textContent = K.themeName(cur);
  }

  /* ---------- новый дизайн ---------- */
  var skinOn = true;
  function renderSkin() { $('skinSwitch').setAttribute('aria-checked', String(skinOn)); }
  $('skinSwitch').addEventListener('click', function () {
    skinOn = !skinOn;
    store.set({ skin: skinOn });
    renderSkin();
    render();
  });

  /* ---------- кнопка в верхней панели форума (телефон) ---------- */
  var menuOn = true;
  function renderMenu() { $('menuSwitch').setAttribute('aria-checked', String(menuOn)); }
  $('menuSwitch').addEventListener('click', function () {
    menuOn = !menuOn;
    store.set({ menuEntry: menuOn });
    renderMenu();
  });

  /* ---------- доступ к сайту ---------- */
  // Firefox и Chrome с «доступом по клику» могут не дать расширению форум — тогда тема не применится.
  function checkPerm() {
    if (!chrome.permissions || !chrome.permissions.contains) return;
    chrome.permissions.contains({ origins: K.HOSTS }, function (ok) { $('perm').hidden = !!ok; });
  }
  $('permBtn').addEventListener('click', function () {
    chrome.permissions.request({ origins: K.HOSTS }, function (ok) { if (ok) $('perm').hidden = true; });
  });

  /* ---------- состояние ---------- */
  store.get(['theme', 'seed', 'skin', 'menuEntry'], function (d) {
    d = d || {};
    cur = { theme: d.theme || K.OFF, seed: d.seed || null };
    if (/^#[0-9a-f]{6}$/i.test(d.seed || '')) pick.value = d.seed.toLowerCase();
    menuOn = d.menuEntry !== false;
    skinOn = d.skin !== false;
    paintCustom();
    render();
    renderMenu();
    renderSkin();
    checkPerm();
  });
})();
