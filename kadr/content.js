// Два модуля.
// ТЕМА: та же механика, что у сайта — каждая цветовая переменная с «мятным» значением
// по умолчанию получает свой слот палитры темы.
// АВАТАР: подменяет значок и цвет ТВОЕГО аватара (компонент аватара сайта), только у тебя в браузере.
(function () {
  'use strict';
  var K = window.KADR;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ===================== ТЕМА ===================== */
  var ID = 'kadr-theme';
  var state = null;
  var defaults = K.DEFAULT_VARS;

  function renderTheme() {
    var theme = K.resolve(state);
    var el = document.getElementById(ID);
    if (!theme) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('style'); el.id = ID; }
    var text = K.css(theme, defaults);
    if (el.textContent !== text) el.textContent = text;
    if (!el.isConnected) document.documentElement.appendChild(el);
  }
  // Когда CSS сайта загрузился, берём живые значения :root (вдруг они что-то поменяли).
  function refreshDefaults() {
    var live = K.readDefaults(document);
    if (Object.keys(live).length) { defaults = live; renderTheme(); }
  }

  /* ===================== АВАТАР ===================== */
  // Ровно тот элемент, которым сайт рисует аватар: круг + svg 256×256 внутри.
  var CIRCLE = '.rounded-full.place-items-center[class*="transition-[background-color,color]"]';
  var MARK = 'data-kadr-ava';
  var ava = null;      // {icon, color, d}
  var icons = null;    // name -> d, чтобы узнать СВОЙ аватар среди чужих
  var marked = 0;
  var orig = new WeakMap();

  // Профиль вошедшего аккаунта — сайт сам хранит его в localStorage (без токена).
  function ownProfile() {
    try {
      var a = JSON.parse(localStorage.getItem('__MW::auth') || 'null');
      return a && a.state && a.state.account ? (a.state.account.profile || {}) : null;
    } catch (e) { return null; }
  }
  function sameColor(a, b) { return String(a).replace(/\s/g, '') === String(b).replace(/\s/g, ''); }

  // Это мой аватар, а не чужой (например, аватар пригласившего)?
  function isMine(circle, svg, prof) {
    var want = K.avatarStyle(prof.colorA);
    if (!sameColor(circle.style.color, K.cssRgb(want.color))) return false;
    if (icons) {
      var d = icons[prof.icon] || icons.clapper_board;
      var p = svg.querySelector('path');
      if (d && (!p || p.getAttribute('d') !== d)) return false;
    }
    return true;
  }

  function setIfChanged(st, prop, val) {
    if (st.getPropertyValue(prop) !== val || st.getPropertyPriority(prop) !== 'important') st.setProperty(prop, val, 'important');
  }
  function apply(circle, svg) {
    var st = circle.style;
    if (!circle.hasAttribute(MARK)) { circle.setAttribute(MARK, ''); marked++; }
    // Если сайт сам перерисовал круг (например, ты сменил аватар), запоминаем новые родные цвета.
    if (st.getPropertyPriority('color') !== 'important') {
      circle.setAttribute('data-kadr-bg', st.getPropertyValue('background-color'));
      circle.setAttribute('data-kadr-fg', st.getPropertyValue('color'));
    }
    var s = K.avatarStyle(ava.color);
    setIfChanged(st, 'background-color', K.cssRgb(s.background));
    setIfChanged(st, 'color', K.cssRgb(s.color));
    var p = svg.querySelector('path');
    if (svg.children.length === 1 && p && p.getAttribute('d') === ava.d) return;
    orig.set(svg, svg.innerHTML); // родная иконка, вернём при сбросе
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var np = document.createElementNS(SVGNS, 'path');
    np.setAttribute('fill', 'currentColor');
    np.setAttribute('d', ava.d);
    svg.appendChild(np);
  }
  function restore(circle) {
    var st = circle.style;
    st.setProperty('background-color', circle.getAttribute('data-kadr-bg') || '');
    st.setProperty('color', circle.getAttribute('data-kadr-fg') || '');
    circle.removeAttribute(MARK); circle.removeAttribute('data-kadr-bg'); circle.removeAttribute('data-kadr-fg');
    marked = Math.max(0, marked - 1);
    var svg = circle.querySelector(':scope > svg');
    if (svg && orig.has(svg)) { svg.innerHTML = orig.get(svg); orig.delete(svg); }
  }
  function sweepAvatar() {
    var prof = ava ? ownProfile() : null;
    var list = document.querySelectorAll(CIRCLE);
    for (var i = 0; i < list.length; i++) {
      var c = list[i], svg = c.querySelector(':scope > svg');
      if (!svg) continue;
      var isMarked = c.hasAttribute(MARK);
      // В диалоге выбора аватара показываем родной — там ты его и редактируешь.
      if (!ava || c.closest('[role="dialog"], dialog')) { if (isMarked) restore(c); continue; }
      if (isMarked || (prof && isMine(c, svg, prof))) apply(c, svg);
    }
  }
  var timer = 0;
  function schedule() { if (!timer) timer = setTimeout(function () { timer = 0; sweepAvatar(); }, 120); }

  /* ===================== старт ===================== */
  chrome.storage.local.get(['theme', 'seed', 'avatar', 'iconsCache'], function (d) {
    d = d || {};
    state = { theme: d.theme, seed: d.seed };
    renderTheme();
    ava = K.normAvatar(d.avatar);
    if (d.iconsCache && d.iconsCache.icons) icons = d.iconsCache.icons;
    if (ava) schedule();
  });

  // Переключение из попапа сразу во всех открытых вкладках kinoarc.
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== 'local') return;
    if (ch.theme || ch.seed) {
      state = state || {};
      if (ch.theme) state.theme = ch.theme.newValue;
      if (ch.seed) state.seed = ch.seed.newValue;
      renderTheme();
    }
    if (ch.iconsCache) icons = ch.iconsCache.newValue ? ch.iconsCache.newValue.icons : null;
    if (ch.avatar) { ava = K.normAvatar(ch.avatar.newValue); sweepAvatar(); }
  });

  document.addEventListener('DOMContentLoaded', function () {
    refreshDefaults();
    // Подтянуть иконки, если сайт выкатил новую сборку.
    var s = document.querySelector('script[src*="/assets/index-"]');
    if (s) K.loadIcons(location.origin, s.src, function (ic) { if (ic) icons = ic; if (ava) schedule(); });
    // Прибрать за прошлой версией: она писала свои иконки в localStorage сайта.
    try { localStorage.removeItem('kadr:icons'); } catch (e) {}
  });
  window.addEventListener('load', refreshDefaults);

  new MutationObserver(function (records) {
    // наш <style> выкинули — возвращаем
    if (K.resolve(state) && !document.getElementById(ID)) renderTheme();
    // аватары появились или сайт их перерисовал — пройтись (не чаще раза в 120 мс)
    if (ava || marked) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
})();
