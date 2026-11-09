(function () {
  'use strict';
  var K = window.KADR;
  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- вкладки ---------- */
  function tab(id) {
    [].forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.toggle('on', t.dataset.tab === id); });
    $('p-theme').classList.toggle('on', id === 'theme');
    $('p-avatar').classList.toggle('on', id === 'avatar');
  }
  [].forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () { tab(t.dataset.tab); });
  });

  /* ---------- тема ---------- */
  var grid = $('grid'), custom = $('custom'), pick = $('pick');
  var cur = { theme: 'mint', seed: null };

  function paint(el, t) {
    el.style.setProperty('--bg', t.bg);
    el.style.setProperty('--s1', t.s1);
    el.style.setProperty('--acc', t.acc);
  }
  function markTheme() {
    [].forEach.call(document.querySelectorAll('[data-id]'), function (el) {
      el.classList.toggle('on', el.dataset.id === cur.theme);
    });
  }
  function saveTheme(theme, seed) {
    cur = { theme: theme, seed: seed || null };
    chrome.storage.local.set(cur);
    markTheme();
  }
  K.THEMES.forEach(function (t) {
    var b = document.createElement('button'), dot = document.createElement('span'), nm = document.createElement('span');
    b.type = 'button'; b.className = 'sw'; b.dataset.id = t.id;
    dot.className = 'dot'; nm.className = 'nm'; nm.textContent = t.name;
    b.append(dot, nm);
    paint(b, t);
    b.addEventListener('click', function () { saveTheme(t.id); });
    grid.appendChild(b);
  });
  paint(custom, K.fromAccent(pick.value));
  custom.addEventListener('click', function () { saveTheme('custom', pick.value); });
  pick.addEventListener('input', function () {
    paint(custom, K.fromAccent(pick.value));
    saveTheme('custom', pick.value);
  });

  /* ---------- аватар ---------- */
  var ava = { icon: null, color: '#CF8E7D' };
  var icons = null, order = [];

  function iconSvg(d) {
    var s = document.createElementNS(SVGNS, 'svg'), p = document.createElementNS(SVGNS, 'path');
    s.setAttribute('viewBox', '0 0 256 256');
    s.setAttribute('aria-hidden', 'true');
    p.setAttribute('fill', 'currentColor');
    p.setAttribute('d', d);
    s.appendChild(p);
    return s;
  }
  function renderAvatar() {
    var st = K.avatarStyle(ava.color), pv = $('avaPreview');
    pv.style.backgroundColor = st.background;
    pv.style.color = st.color;
    pv.textContent = '';
    var d = icons && ava.icon ? icons[ava.icon] : null;
    if (d) pv.appendChild(iconSvg(d));
    [].forEach.call($('avaColors').children, function (el) { el.classList.toggle('on', el.dataset.hex === ava.color); });
    [].forEach.call($('avaIcons').querySelectorAll('.ico'), function (el) {
      el.style.setProperty('--c', st.color);
      el.style.setProperty('--bgc', st.background);
      el.classList.toggle('on', el.dataset.icon === ava.icon);
    });
  }
  function commitAvatar() {
    if (!ava.icon || !icons || !icons[ava.icon]) { renderAvatar(); return; }
    chrome.storage.local.set({ avatar: { icon: ava.icon, color: ava.color, d: icons[ava.icon] } });
    renderAvatar();
  }

  K.AVATAR_COLORS.forEach(function (c) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'col'; b.title = c.name; b.dataset.hex = c.hex;
    b.style.backgroundColor = K.avatarStyle(c.hex).background;
    b.style.setProperty('--c', K.avatarStyle(c.hex).color);
    b.addEventListener('click', function () { ava.color = c.hex; commitAvatar(); });
    $('avaColors').appendChild(b);
  });

  function renderIcons() {
    var box = $('avaIcons');
    if (!icons) { $('avaHint').textContent = 'Не получилось достать иконки с kinoarc. Проверь, что сайт открывается, и открой попап ещё раз.'; return; }
    box.textContent = '';
    order.filter(function (n) { return icons[n]; }).forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ico'; b.dataset.icon = name; b.title = name.replace(/_/g, ' ');
      if (K.LOCKED_ICONS.indexOf(name) >= 0) b.classList.add('lk');
      b.appendChild(iconSvg(icons[name]));
      b.addEventListener('click', function () { ava.icon = name; commitAvatar(); });
      box.appendChild(b);
    });
    renderAvatar();
  }

  $('resetAva').addEventListener('click', function () {
    ava.icon = null;
    chrome.storage.local.remove('avatar');
    renderAvatar();
  });

  /* ---------- состояние ---------- */
  // прошлая версия хранила собранные иконки тут — больше не нужны
  chrome.storage.local.remove(['icons', 'curSigs']);
  chrome.storage.local.get(['theme', 'seed', 'avatar'], function (d) {
    d = d || {};
    if (d.theme) cur = { theme: d.theme, seed: d.seed || null };
    if (cur.theme === 'custom' && cur.seed) { pick.value = cur.seed; paint(custom, K.fromAccent(cur.seed)); }
    markTheme();
    var a = K.normAvatar(d.avatar);
    if (a) { ava.color = a.color; ava.icon = a.icon; }
    renderAvatar();
    K.loadIcons('https://kinoarc.net', null, function (ic, ord) { icons = ic; order = ord || []; renderIcons(); });
  });
})();
