// Кадр — контент-скрипт kinoarc. Три модуля:
// ТЕМА: та же механика, что у сайта (assets/applyTheme-*.js): каждая цветовая переменная
//   с «мятным» значением по умолчанию получает свой слот палитры темы.
// АВАТАР: подменяет значок и цвет ТВОЕГО аватара (компонент аватара сайта) только у тебя в браузере.
// ТЕЛЕФОН: пункт «Тема и аватар» в мобильном меню сайта открывает шторку с настройками расширения.
(function () {
  'use strict';
  if (window.__kadrBooted) return; // защита от повторной инъекции
  window.__kadrBooted = true;

  var K = window.KADR;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var store = chrome.storage.local;

  /* ===================== ТЕМА ===================== */
  var ID = 'kadr-theme';
  var state = null;
  var defaults = K.DEFAULT_VARS;
  var styleEl = null;

  function renderTheme() {
    var theme = K.resolve(state);
    if (!theme) { if (styleEl) styleEl.remove(); return; }
    if (!styleEl) { styleEl = document.getElementById(ID) || document.createElement('style'); styleEl.id = ID; }
    var text = K.css(theme, defaults);
    if (styleEl.textContent !== text) styleEl.textContent = text;
    if (!styleEl.isConnected) document.documentElement.appendChild(styleEl);
  }
  // Когда CSS сайта загрузился, берём живые значения :root (вдруг они что-то поменяли).
  function refreshDefaults() {
    var live = K.readDefaults(document);
    if (Object.keys(live).length) { defaults = live; renderTheme(); }
  }

  /* ===================== АВАТАР ===================== */
  // Ровно тот элемент, которым сайт рисует аватар (компонент Avatar): круг + svg 256×256 внутри.
  var CIRCLE = '.rounded-full.place-items-center[class*="transition-[background-color,color]"]';
  var MARK = 'data-kadr-ava';
  var OURS = 'data-kadr-path';
  // Где сайт рисует ЧУЖИЕ аватары: друзья в «Пригласить друга», пригласивший — на регистрации и в напоминании.
  var OTHERS = '.ref-fr, .inv-line, .inv-later';
  // Карточка приглашения (InviteCard) показывает аватар пригласившего в .ref-emb — как и твой в «Пригласить друга»,
  // отличается она своими блоками .inv-*.
  function isOthers(circle) {
    if (circle.closest(OTHERS)) return true;
    var dlg = circle.closest('.ref-dlg');
    return !!dlg && !!dlg.querySelector('.inv-head, .inv-cta');
  }
  // Окно редактирования аватара: там ты меняешь настоящий аватар, поэтому в нём показываем родной.
  // Узнаём его по сетке значков (кнопки role="radio" с иконками 256×256), а НЕ по тегу <dialog>:
  // мобильное меню сайта — тоже <dialog>, и в 1.2 из-за этого аватар в нём не подменялся.
  var EDITOR_GRID = '[role="radio"] svg[viewBox="0 0 256 256"]';

  var ava = null;      // {icon, color, d} — выбор из попапа
  var icons = null;    // name -> d, чтобы узнать СВОЙ аватар среди чужих
  var orig = new WeakMap();

  // Аккаунт, под которым ты вошёл, — сайт сам хранит его в localStorage (токен там пустой).
  function ownAccount() {
    try {
      var a = JSON.parse(localStorage.getItem('__MW::auth') || 'null');
      return a && a.state && a.state.account ? a.state.account : null;
    } catch (e) { return null; }
  }
  function sameColor(a, b) { return String(a).replace(/\s/g, '') === String(b).replace(/\s/g, ''); }
  function isCircle(el) {
    var c = el.getAttribute && el.getAttribute('class');
    return !!c && c.indexOf('transition-[background-color,color]') >= 0 && el.matches(CIRCLE);
  }

  // Это мой аватар, а не чужой с таким же цветом?
  function isMine(circle, svg, prof) {
    var want = K.avatarStyle(prof.colorA);
    if (!sameColor(circle.style.color, K.cssRgb(want.color))) return false;
    if (icons) {
      var d = icons[prof.icon] || icons[K.DEFAULT_ICON];
      var p = svg.querySelector('path');
      if (d && (!p || p.getAttribute('d') !== d)) return false;
    }
    return true;
  }
  function inEditor(circle) {
    var dlg = circle.closest('dialog, [role="dialog"]');
    return !!dlg && !!dlg.querySelector(EDITOR_GRID);
  }

  function setIfChanged(st, prop, val) {
    if (st.getPropertyValue(prop) !== val || st.getPropertyPriority(prop) !== 'important') st.setProperty(prop, val, 'important');
  }
  function apply(circle, svg) {
    var st = circle.style;
    circle.setAttribute(MARK, '');
    // Если сайт сам перерисовал круг (например, ты сменил аватар), запоминаем новые родные цвета.
    if (st.getPropertyPriority('color') !== 'important') {
      circle.setAttribute('data-kadr-bg', st.getPropertyValue('background-color'));
      circle.setAttribute('data-kadr-fg', st.getPropertyValue('color'));
    }
    var s = K.avatarStyle(ava.color);
    setIfChanged(st, 'background-color', K.cssRgb(s.background));
    setIfChanged(st, 'color', K.cssRgb(s.color));
    var first = svg.firstElementChild;
    var mine = !!first && first.hasAttribute(OURS);
    if (mine && svg.childElementCount === 1 && first.getAttribute('d') === ava.d) return;
    // Родную иконку запоминаем, только если в svg сейчас именно она, а не наша прошлая подмена.
    if (!mine) orig.set(svg, svg.innerHTML);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var np = document.createElementNS(SVGNS, 'path');
    np.setAttribute('fill', 'currentColor');
    np.setAttribute('d', ava.d);
    np.setAttribute(OURS, '');
    svg.appendChild(np);
  }
  function restore(circle, svg) {
    var st = circle.style;
    st.setProperty('background-color', circle.getAttribute('data-kadr-bg') || '');
    st.setProperty('color', circle.getAttribute('data-kadr-fg') || '');
    circle.removeAttribute(MARK); circle.removeAttribute('data-kadr-bg'); circle.removeAttribute('data-kadr-fg');
    if (svg && orig.has(svg)) { svg.innerHTML = orig.get(svg); orig.delete(svg); }
  }
  function sweepAvatars(acc) {
    var prof = ava && acc ? acc.profile || {} : null;
    var list = document.querySelectorAll(ava ? CIRCLE : '[' + MARK + ']');
    for (var i = 0; i < list.length; i++) {
      var c = list[i], svg = c.querySelector(':scope > svg');
      if (!svg) continue;
      var on = c.hasAttribute(MARK);
      if (!ava || inEditor(c) || isOthers(c)) { if (on) restore(c, svg); continue; }
      if (on || (prof && isMine(c, svg, prof))) apply(c, svg);
    }
  }

  // Родной аватар и ник — в storage расширения, чтобы попап показывал «как сейчас на сайте».
  var lastSite;
  function syncSite(acc) {
    var p = acc && acc.profile;
    var site = p ? { icon: p.icon || K.DEFAULT_ICON, color: K.normHex(p.colorA), name: String(acc.nickname || '').slice(0, 40) } : null;
    var key = JSON.stringify(site);
    if (key === lastSite) return;
    lastSite = key;
    store.set({ site: site });
  }

  /* ===================== ТЕЛЕФОН: пункт меню + шторка ===================== */
  var ENTRY = 'data-kadr-entry';
  var entryOn = true;   // storage.menuEntry === false — пункт выключен
  var sheet = null;

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  // Значок «кадр»: видоискатель с объективом. Линейный, как остальные значки меню.
  function entryIcon() {
    var s = svgEl('svg', { viewBox: '0 0 24 24', width: '1em', height: '1em', fill: 'none', stroke: 'currentColor',
      'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    s.appendChild(svgEl('path', { d: 'M4 8.5V6.5A2.5 2.5 0 0 1 6.5 4h2M15.5 4h2A2.5 2.5 0 0 1 20 6.5v2M20 15.5v2a2.5 2.5 0 0 1-2.5 2.5h-2M8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-2' }));
    s.appendChild(svgEl('circle', { cx: '12', cy: '12', r: '3.25' }));
    return s;
  }
  // Мобильное меню сайта: <dialog data-native-dialog> → <nav> «Сервис» → <a href="/settings">.
  function settingsItem() {
    var list = document.querySelectorAll('dialog nav > a[href="/settings"]');
    return list.length ? list[0] : null;
  }
  function updateEntry(item) {
    var meta = item.querySelector('[data-kadr-meta]');
    if (meta) meta.textContent = K.themeName(state);
  }
  function syncEntry() {
    var old = document.querySelectorAll('[' + ENTRY + ']');
    if (!entryOn) { for (var i = 0; i < old.length; i++) old[i].remove(); return; }
    var anchor = settingsItem();
    if (!anchor) return;
    var nav = anchor.parentNode, have = nav.querySelector(':scope > [' + ENTRY + ']');
    if (have) { updateEntry(have); return; }
    // Клонируем соседний пункт меню, чтобы выглядеть как родной (классы и анимация сайта).
    var tpl = null, kids = nav.children;
    for (var j = 0; j < kids.length && !tpl; j++) {
      var k = kids[j];
      if (k.localName === 'a' && !k.hasAttribute('aria-current') && k.firstElementChild && k.querySelector('.truncate')) tpl = k;
    }
    if (!tpl) return;
    var item = tpl.cloneNode(true);
    item.setAttribute(ENTRY, '');
    item.setAttribute('href', '#kadr');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-haspopup', 'dialog');
    item.removeAttribute('aria-current'); item.removeAttribute('target'); item.removeAttribute('rel');
    var dots = item.querySelectorAll('span.rounded-full');
    for (var d = 0; d < dots.length; d++) dots[d].remove();
    var box = item.firstElementChild;
    box.textContent = '';
    box.appendChild(entryIcon());
    item.querySelector('.truncate').textContent = 'Тема и аватар';
    var meta = item.querySelector('[class*="ml-auto"]');
    if (meta) meta.setAttribute('data-kadr-meta', '');
    updateEntry(item);
    item.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      openSheet(item);
    });
    nav.insertBefore(item, anchor.nextSibling);
  }

  var SHEET_CSS =
    ':host{all:initial}' +
    '.wrap{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;' +
      'font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-tap-highlight-color:transparent}' +
    '.scrim{position:absolute;inset:0;background:rgb(0 0 0/.42);opacity:0;transition:opacity .3s ease}' +
    '.panel{position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;height:76vh;height:min(76dvh,700px);' +
      'background:rgb(var(--kn-bg,11 12 13));border-radius:26px 26px 0 0;overflow:hidden;' +
      'box-shadow:0 -18px 48px rgb(0 0 0/.5),inset 0 1px 0 rgb(255 255 255/.07);' +
      'transform:translateY(105%);transition:transform .46s cubic-bezier(.2,.9,.24,1)}' +
    '.open .scrim{opacity:1}.open .panel{transform:none}' +
    '.grab{flex:none;height:26px;display:grid;place-items:center;touch-action:none;cursor:grab}' +
    '.grab i{width:42px;height:5px;border-radius:9px;background:rgb(255 255 255/.24)}' +
    'iframe{flex:1;width:100%;min-height:0;border:0;display:block;background:transparent;color-scheme:dark;visibility:hidden}' +
    'iframe.ready{visibility:visible}' +
    '@media (min-width:600px){.panel{border-radius:26px;margin-bottom:16px}}' +
    '@media (prefers-reduced-motion:reduce){.scrim,.panel{transition:none}}';

  function openSheet(from) {
    if (sheet) return;
    var url;
    try { url = chrome.runtime.getURL('popup.html') + '#sheet'; } catch (e) { return; } // расширение обновили — страница устарела
    var host = document.createElement('kadr-sheet');
    var root = host.attachShadow({ mode: 'closed' });
    var css = document.createElement('style');
    css.textContent = SHEET_CSS;
    var wrap = document.createElement('div'); wrap.className = 'wrap';
    var scrim = document.createElement('div'); scrim.className = 'scrim';
    var panel = document.createElement('div'); panel.className = 'panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Кадр — тема и аватар');
    var grab = document.createElement('div'); grab.className = 'grab';
    grab.appendChild(document.createElement('i'));
    var frame = document.createElement('iframe');
    frame.title = 'Кадр — тема и аватар';
    frame.addEventListener('load', function () { frame.classList.add('ready'); try { frame.focus(); } catch (e) {} });
    frame.src = url;
    panel.append(grab, frame);
    wrap.append(scrim, panel);
    root.append(css, wrap);
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483600';
    document.documentElement.appendChild(host);
    sheet = { host: host, wrap: wrap, panel: panel, frame: frame, from: from };
    void panel.offsetHeight; // зафиксировать стартовую позицию, чтобы анимация сработала
    wrap.classList.add('open');

    scrim.addEventListener('click', closeSheet);
    // Смахнуть вниз за «ручку» — закрыть.
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
    e.stopPropagation(); // иначе сайт заодно закроет своё меню
    closeSheet();
  }
  function onSheetMsg(e) {
    if (!sheet || e.source !== sheet.frame.contentWindow) return;
    if (e.data === 'kadr:close') closeSheet();
  }
  function closeSheet() {
    if (!sheet) return;
    var s = sheet;
    sheet = null;
    window.removeEventListener('keydown', onSheetKey, true);
    window.removeEventListener('message', onSheetMsg);
    s.panel.style.transform = '';
    s.wrap.classList.remove('open');
    setTimeout(function () { s.host.remove(); }, 480);
    if (s.from && s.from.isConnected) try { s.from.focus({ preventScroll: true }); } catch (e) {}
  }

  /* ===================== проход по странице ===================== */
  function sweep() {
    var acc = ownAccount();
    syncSite(acc);
    sweepAvatars(acc);
    syncEntry();
  }
  var timer = 0;
  function schedule() { if (!timer) timer = setTimeout(function () { timer = 0; sweep(); }, 120); }

  // Реагируем только на то, что может касаться аватара или меню: так телефон не греется во время видео,
  // где плеер десятки раз в секунду меняет style и текст субтитров.
  function relevant(records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i], t = r.target;
      if (r.type === 'attributes') {
        if (t.nodeType === 1 && (t.hasAttribute(MARK) || isCircle(t))) return true;
        continue;
      }
      // сайт сам сменил значок внутри уже подменённого круга
      if (t.localName === 'svg' && t.parentNode && t.parentNode.hasAttribute && t.parentNode.hasAttribute(MARK)) return true;
      var add = r.addedNodes;
      for (var j = 0; j < add.length; j++) {
        var n = add[j];
        if (n.nodeType !== 1) continue;
        if (n.localName === 'svg' || n.localName === 'dialog' || (n.firstElementChild && n.querySelector('svg'))) return true;
      }
    }
    return false;
  }

  /* ===================== старт ===================== */
  store.get(['theme', 'seed', 'avatar', 'iconsCache', 'menuEntry'], function (d) {
    d = d || {};
    state = { theme: d.theme, seed: d.seed };
    renderTheme();
    ava = K.normAvatar(d.avatar);
    entryOn = d.menuEntry !== false;
    if (d.iconsCache && d.iconsCache.icons) icons = d.iconsCache.icons;
    schedule();
  });

  // Переключение из попапа/шторки сразу во всех открытых вкладках kinoarc.
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== 'local') return;
    if (ch.theme || ch.seed) {
      state = state || {};
      if (ch.theme) state.theme = ch.theme.newValue;
      if (ch.seed) state.seed = ch.seed.newValue;
      renderTheme();
      var items = document.querySelectorAll('[' + ENTRY + ']');
      for (var i = 0; i < items.length; i++) updateEntry(items[i]);
    }
    if (ch.iconsCache) icons = ch.iconsCache.newValue ? ch.iconsCache.newValue.icons : null;
    if (ch.menuEntry) { entryOn = ch.menuEntry.newValue !== false; syncEntry(); }
    if (ch.avatar) { ava = K.normAvatar(ch.avatar.newValue); sweepAvatars(ownAccount()); }
  });

  document.addEventListener('DOMContentLoaded', function () {
    refreshDefaults();
    // Подтянуть иконки, если сайт выкатил новую сборку.
    var s = document.querySelector('script[type="module"][src*="/assets/index-"]') || document.querySelector('script[src*="/assets/index-"]');
    if (s) K.loadIcons(location.origin, s.src, function (ic) { if (ic) icons = ic; schedule(); });
    // Прибрать за прошлой версией: она писала свои иконки в localStorage сайта.
    try { localStorage.removeItem('kadr:icons'); } catch (e) {}
    schedule();
  });
  window.addEventListener('load', refreshDefaults);
  // Вошёл/вышел или сменил аватар в другой вкладке.
  window.addEventListener('storage', function (e) { if (e.key === '__MW::auth') schedule(); });

  new MutationObserver(function (records) {
    // наш <style> выкинули — возвращаем
    if (styleEl && !styleEl.isConnected && K.resolve(state)) renderTheme();
    if (relevant(records)) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
})();
