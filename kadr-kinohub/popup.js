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
    check: 'M5.5 12.5l4 4 9-9.5',
    plus: 'M12 5.5v13M5.5 12h13',
    find: 'M10.8 17.1a6.3 6.3 0 1 0 0-12.6 6.3 6.3 0 0 0 0 12.6ZM19.5 19.5l-4.2-4.2',
    undo: 'M5 9.5h9.2a4.8 4.8 0 0 1 0 9.6H9M5 9.5l4-4M5 9.5l4 4'
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
  $('heroFind').appendChild(ui('find'));
  $('heroPlay').prepend(svg('M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.2-7.2c.6-.4.6-1.4 0-1.8L8.6 3.9C7.9 3.5 7 4 7 4.8Z', true));
  $('heroPlus').appendChild(ui('plus'));

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
  function tile(t, cls) {
    var b = el('button', 'th' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.id = t.id;
    var sw = el('span', 'th-sw');
    sw.appendChild(cls === 'native' ? ui('undo') : el('i'));
    b.append(sw, el('span', 'th-nm', t.name), check());
    themeVars(b, t);
    b.addEventListener('click', function () { setTheme(t.id); });
    box.appendChild(b);
    return b;
  }
  tile(K.NEUTRAL, 'native');
  K.THEMES.forEach(function (t) { tile(t); });

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
    $('heroName').textContent = K.themeName(cur);
  }

  /* ---------- доступ к сайту ---------- */
  // Firefox и Chrome с «доступом по клику» могут не дать расширению сайт — тогда тема не применится.
  function checkPerm() {
    if (!chrome.permissions || !chrome.permissions.contains) return;
    chrome.permissions.contains({ origins: K.HOSTS }, function (ok) { $('perm').hidden = !!ok; });
  }
  $('permBtn').addEventListener('click', function () {
    chrome.permissions.request({ origins: K.HOSTS }, function (ok) { if (ok) $('perm').hidden = true; });
  });

  /* ---------- состояние ---------- */
  store.get(['theme', 'seed'], function (d) {
    d = d || {};
    cur = { theme: d.theme || K.OFF, seed: d.seed || null };
    if (/^#[0-9a-f]{6}$/i.test(d.seed || '')) pick.value = d.seed.toLowerCase();
    paintCustom();
    render();
    checkPerm();
  });
})();
