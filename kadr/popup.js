(function () {
  'use strict';
  var K = window.KADR;
  var store = chrome.storage.local;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  // Шторка внутри kinoarc (iframe из content.js); режим вёрстки уже выставил env.js.
  var SHEET = location.hash === '#sheet';

  /* ---------- значки интерфейса ---------- */
  var UI = {
    external: 'M8 16 16 8M9.5 8H16v6.5',
    close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
    check: 'M5.5 12.5l4 4 9-9.5',
    plus: 'M12 5.5v13M5.5 12h13',
    chev: 'M9.5 6l6 6-6 6',
    palette: 'M12 3.5a8.5 8.5 0 0 0 0 17c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2a1.7 1.7 0 0 1 1.3-2.9h2a4 4 0 0 0 4-4c0-4.1-3.8-7.2-8.5-7.2Z',
    user: 'M12 12.2a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8ZM4.8 19.8c.9-3.1 3.8-5.2 7.2-5.2s6.3 2.1 7.2 5.2'
  };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(viewBox) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', viewBox);
    s.setAttribute('aria-hidden', 'true');
    return s;
  }
  function path(s, d, attrs) {
    var p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d);
    for (var k in attrs) p.setAttribute(k, attrs[k]);
    s.appendChild(p);
    return s;
  }
  function ui(name) {
    var s = svg('0 0 24 24');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.9');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    path(s, UI[name]);
    if (name === 'palette') {
      [[8.2, 10.6], [11.6, 7.6], [15.4, 9.4]].forEach(function (c) {
        var d = document.createElementNS(SVGNS, 'circle');
        d.setAttribute('cx', c[0]); d.setAttribute('cy', c[1]); d.setAttribute('r', '1.15');
        d.setAttribute('fill', 'currentColor'); d.setAttribute('stroke', 'none');
        s.appendChild(d);
      });
    }
    return s;
  }
  function playIcon() {
    return path(svg('0 0 24 24'), 'M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.2-7.2c.6-.4.6-1.4 0-1.8L8.6 3.9C7.9 3.5 7 4 7 4.8Z', { fill: 'currentColor' });
  }
  // Значок аватара сайта: один path во viewBox 256×256.
  function avaIcon(d) { return path(svg('0 0 256 256'), d, { fill: 'currentColor' }); }

  $('openSite').appendChild(ui('external'));
  $('closeSheet').appendChild(ui('close'));
  $('heroPlay').prepend(playIcon());
  $('heroPlus').appendChild(ui('plus'));
  document.querySelector('.hero-chev').appendChild(ui('chev'));

  function closeSheet() { try { parent.postMessage('kadr:close', '*'); } catch (e) {} }
  $('closeSheet').addEventListener('click', closeSheet);
  if (SHEET) document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  /* ---------- радиогруппы: стрелки и один таб-стоп ---------- */
  function radios(group) { return [].slice.call(group.querySelectorAll('[role="radio"]')); }
  function rove(group) {
    var list = radios(group);
    var on = list.filter(function (r) { return r.getAttribute('aria-checked') === 'true'; })[0] || list[0];
    list.forEach(function (r) { r.tabIndex = r === on ? 0 : -1; });
  }
  function arrows(group) {
    group.addEventListener('keydown', function (e) {
      var k = e.key;
      var step = k === 'ArrowRight' || k === 'ArrowDown' ? 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      var list = radios(group), i = list.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      var next = list[(i + step + list.length) % list.length];
      next.focus();
      next.click();
    });
  }

  /* ---------- вкладки ---------- */
  var seg = document.querySelector('.seg');
  var tabs = [].slice.call(seg.querySelectorAll('[role="tab"]'));
  tabs[0].prepend(ui('palette'));
  tabs[1].prepend(ui('user'));
  function showTab(id, focus) {
    seg.setAttribute('data-tab', id);
    tabs.forEach(function (t) {
      var on = t.dataset.tab === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $('p-theme').hidden = id !== 'theme';
    $('p-avatar').hidden = id !== 'avatar';
    try { localStorage.setItem('kadr:tab', id); } catch (e) {}
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { showTab(t.dataset.tab); }); });
  seg.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    showTab(seg.getAttribute('data-tab') === 'theme' ? 'avatar' : 'theme', true);
  });
  var lastTab = 'theme';
  try { lastTab = localStorage.getItem('kadr:tab') || 'theme'; } catch (e) {}
  showTab(lastTab === 'avatar' ? 'avatar' : 'theme');

  /* ---------- тема ---------- */
  var cur = { theme: 'mint', seed: null };
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

  K.THEMES.forEach(function (t) {
    var b = el('button', 'th');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.id = t.id;
    var sw = el('span', 'th-sw');
    sw.appendChild(el('i'));
    var nm = el('span', 'th-nm');
    nm.append(el('span', 'th-tx', t.name), check());
    b.append(sw, nm);
    themeVars(b, t);
    b.addEventListener('click', function () { setTheme(t.id); });
    box.appendChild(b);
  });

  // «Свой цвет»: сам тайл — это нативный выбор цвета, поверх него прозрачный <input type="color">.
  var custom = el('label', 'th custom');
  var cSw = el('span', 'th-sw');
  cSw.appendChild(el('i'));
  var cNm = el('span', 'th-nm');
  var cHex = el('small');
  cNm.append(el('span', 'th-tx', 'Свой цвет'), cHex);
  var pick = document.createElement('input');
  pick.type = 'color';
  pick.value = '#5ec8ff';
  pick.setAttribute('aria-label', 'Свой цвет темы');
  custom.append(cSw, cNm, check(), pick);
  box.appendChild(custom);
  arrows(box);

  function paintCustom() {
    themeVars(custom, K.fromAccent(pick.value));
    cHex.textContent = pick.value.toUpperCase();
  }
  var pickTimer = 0;
  pick.addEventListener('click', function () { setTheme('custom', pick.value); });
  pick.addEventListener('input', function () {
    paintCustom();
    // пока тянешь ползунок — не чаще ~11 раз в секунду, вкладкам kinoarc хватит
    if (!pickTimer) pickTimer = setTimeout(function () { pickTimer = 0; setTheme('custom', pick.value); }, 90);
  });
  pick.addEventListener('change', function () { setTheme('custom', pick.value); });

  function setTheme(id, seed) {
    cur.theme = id;
    if (id === 'custom') {
      cur.seed = seed;
      store.set({ theme: 'custom', seed: seed });
    } else {
      store.set({ theme: id }); // свой цвет помним, даже когда выбрана другая тема
    }
    renderTheme();
  }
  function tint() {
    var v = K.uiVars(cur);
    for (var k in v) root.style.setProperty(k, v[k]);
    themeColor.content = 'rgb(' + v['--bg'].split(' ').join(',') + ')';
  }
  function renderTheme() {
    radios(box).forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.id === cur.theme)); });
    custom.toggleAttribute('data-on', cur.theme === 'custom');
    rove(box);
    tint();
    renderHero();
  }

  /* ---------- аватар ---------- */
  var site = null;                 // {icon, color, name} — как сейчас на сайте (пишет content.js)
  var icons = null, order = [];
  var ava = { icon: K.DEFAULT_ICON, color: '#3FE0A1', d: null, on: false };
  var FALLBACK = '#3FE0A1';

  // Что сейчас видно на сайте: свой выбор, если подмена включена, иначе родной аватар.
  function shown() {
    if (ava.on) return ava;
    return { icon: (site && site.icon) || K.DEFAULT_ICON, color: (site && site.color) || FALLBACK, d: null };
  }
  function pathOf(a) {
    if (icons && a.icon && icons[a.icon]) return icons[a.icon];
    if (a.d) return a.d;
    return icons ? icons[K.DEFAULT_ICON] || null : null;
  }
  function paintAva(node, a) {
    var st = K.avatarStyle(a.color);
    node.style.backgroundColor = st.background;
    node.style.color = st.color;
    node.textContent = '';
    var d = pathOf(a);
    if (d) node.appendChild(avaIcon(d));
  }

  K.AVATAR_COLORS.forEach(function (c) {
    var b = el('button', 'col');
    var st = K.avatarStyle(c.hex);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', c.name);
    b.title = c.name;
    b.dataset.hex = c.hex;
    b.style.setProperty('--c', st.color);
    b.style.setProperty('--cb', st.background);
    b.appendChild(el('i'));
    b.addEventListener('click', function () { ava.color = c.hex; ava.on = true; commitAvatar(); });
    $('colors').appendChild(b);
  });
  arrows($('colors'));
  arrows($('icons'));

  function renderIcons(phase) {
    var grid = $('icons');
    grid.textContent = '';
    if (!icons) {
      if (phase === 'loading') {
        for (var i = 0; i < 21; i++) grid.appendChild(el('span', 'ico sk'));
        grid.setAttribute('aria-busy', 'true');
        return;
      }
      grid.removeAttribute('aria-busy');
      var err = el('div', 'err');
      var retry = el('button', 'btn', 'Ещё раз');
      retry.type = 'button';
      retry.addEventListener('click', loadIcons);
      err.append(el('span', null, 'Не получилось достать значки с kinoarc.net. Проверь, что сайт открывается.'), retry);
      grid.appendChild(err);
      return;
    }
    grid.removeAttribute('aria-busy');
    (order.length ? order : Object.keys(icons)).forEach(function (name) {
      if (!icons[name]) return;
      var b = el('button', 'ico');
      var label = K.ICON_NAMES[name] || name.replace(/_/g, ' ');
      var locked = K.LOCKED_ICONS.indexOf(name) >= 0;
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', locked ? label + ' — на сайте закрыт' : label);
      b.title = label;
      b.dataset.icon = name;
      if (locked) b.classList.add('lk');
      b.appendChild(avaIcon(icons[name]));
      b.addEventListener('click', function () { ava.icon = name; ava.on = true; commitAvatar(); });
      grid.appendChild(b);
    });
    renderAvatar();
  }
  function loadIcons() {
    renderIcons('loading');
    K.loadIcons('https://kinoarc.net', null, function (ic, ord) {
      icons = ic || null;
      order = ord || [];
      renderIcons(icons ? 'ok' : 'error');
    });
  }

  function renderAvatar() {
    var a = shown(), st = K.avatarStyle(ava.color);
    paintAva($('avaBig'), a);
    paintAva($('heroAva'), a);
    $('avaSwitch').setAttribute('aria-checked', String(ava.on));
    $('avaTitle').textContent = site && site.name ? site.name : 'Твой аватар';
    $('avaSub').textContent = ava.on ? 'Свой — виден только тебе'
      : site ? 'Как на сайте. Выбери цвет или значок' : 'Зайди в аккаунт на kinoarc, чтобы подменить';
    [].forEach.call($('colors').children, function (b) {
      b.setAttribute('aria-checked', String(b.dataset.hex.toLowerCase() === String(ava.color).toLowerCase()));
    });
    radios($('icons')).forEach(function (b) {
      b.style.setProperty('--c', st.color);
      b.style.setProperty('--cb', st.background);
      b.setAttribute('aria-checked', String(b.dataset.icon === ava.icon));
    });
    rove($('colors'));
    rove($('icons'));
    renderHero();
  }
  function commitAvatar() {
    var d = (icons && ava.icon && icons[ava.icon]) || ava.d;
    if (!d && icons && icons[K.DEFAULT_ICON]) { ava.icon = K.DEFAULT_ICON; d = icons[K.DEFAULT_ICON]; }
    if (!d) { ava.on = false; renderAvatar(); return; } // значков с сайта нет — сохранить нечего
    ava.d = d;
    var v = { icon: ava.icon, color: ava.color, d: d };
    if (!ava.on) v.off = true; // выбор помним, просто не подменяем
    store.set({ avatar: v });
    renderAvatar();
  }
  $('avaSwitch').addEventListener('click', function () { ava.on = !ava.on; commitAvatar(); });

  function renderHero() {
    $('heroName').textContent = site && site.name ? site.name : 'Твой профиль';
    $('heroSub').querySelector('em').textContent = 'Тема ' + K.themeName(cur) + (ava.on ? ' · свой аватар' : '');
  }

  /* ---------- пункт в меню сайта (телефон) ---------- */
  var menuOn = true;
  function renderMenu() { $('menuSwitch').setAttribute('aria-checked', String(menuOn)); }
  $('menuSwitch').addEventListener('click', function () {
    menuOn = !menuOn;
    store.set({ menuEntry: menuOn });
    renderMenu();
  });

  /* ---------- доступ к kinoarc.net ---------- */
  // Firefox и Chrome с «доступом по клику» могут не дать расширению сайт — тогда ничего не применится.
  function checkPerm() {
    if (!chrome.permissions || !chrome.permissions.contains) return;
    chrome.permissions.contains({ origins: [K.HOSTS[0]] }, function (ok) { $('perm').hidden = !!ok; });
  }
  $('permBtn').addEventListener('click', function () {
    chrome.permissions.request({ origins: K.HOSTS }, function (ok) {
      if (!ok) return;
      $('perm').hidden = true;
      if (!icons) loadIcons();
    });
  });

  /* ---------- состояние ---------- */
  store.remove(['icons', 'curSigs']); // хвосты старых версий
  store.get(['theme', 'seed', 'avatar', 'site', 'menuEntry'], function (d) {
    d = d || {};
    cur = { theme: d.theme || 'mint', seed: d.seed || null };
    if (/^#[0-9a-f]{6}$/i.test(d.seed || '')) pick.value = d.seed.toLowerCase();
    site = d.site || null;
    var a = d.avatar, n = a ? K.normAvatar(Object.assign({}, a, { off: false })) : null;
    if (n) ava = { icon: n.icon, color: n.color, d: n.d, on: !a.off };
    else ava = { icon: (site && site.icon) || K.DEFAULT_ICON, color: (site && site.color) || FALLBACK, d: null, on: false };
    menuOn = d.menuEntry !== false;
    paintCustom();
    renderTheme();
    renderAvatar();
    renderMenu();
    loadIcons();
    checkPerm();
  });

  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== 'local') return;
    if (ch.site) {
      site = ch.site.newValue || null;
      // ещё ничего не выбирали — предлагаем начать с родного аватара
      if (!ava.on && !ava.d && site) { ava.icon = site.icon; ava.color = site.color; }
      renderAvatar();
    }
    if (ch.iconsCache && !icons && ch.iconsCache.newValue && ch.iconsCache.newValue.icons) {
      icons = ch.iconsCache.newValue.icons;
      order = ch.iconsCache.newValue.order || [];
      renderIcons('ok');
    }
  });
})();
