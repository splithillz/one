// Кадр для форума Los Santos Project — контент-скрипт.
// ТЕМА. Форум (Invision Community + тема Focus) берёт все цвета из CSS-переменных. Тема — это один <style>
//   с новыми значениями этих переменных (themes.js → KADR.css). Он стоит последним в документе, а селектор у него
//   сильнее, чем у сайта, так что новые значения побеждают при любом порядке стилей.
// НОВЫЙ ДИЗАЙН. Правила — в skin.css (подключён манифестом) и работают при классе kadr-rd у <html>; здесь — его
//   выключатель и шрифт Onest (адрес файлов шрифта известен только здесь).
// ТЕЛЕФОН. В верхней панели форума появляется кнопка «Тема»: она открывает шторку с настройками расширения.
(function () {
  'use strict';
  if (window.__kadrLs) return; // защита от повторной инъекции
  window.__kadrLs = true;

  var K = window.KADR;
  var store = chrome.storage.local;
  var root = document.documentElement;
  var ID = 'kadr-theme';
  var state = { theme: K.OFF, seed: null };
  var skin = true;              // новый дизайн (storage.skin === false — выключен)
  root.classList.add('kadr-rd'); // сразу, до ответа storage: форум рисует себя позже, мигания не будет
  var ready = false;
  var styleEl = null;

  // Шрифт нового дизайна — Onest, как у kinoarc.
  var FONT = '';
  try {
    FONT = '@font-face{font-family:Onest;font-style:normal;font-weight:400 800;font-display:swap;src:url("' +
      chrome.runtime.getURL('fonts/onest-cyrillic.woff2') + '") format("woff2");unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}' +
      '@font-face{font-family:Onest;font-style:normal;font-weight:400 800;font-display:swap;src:url("' +
      chrome.runtime.getURL('fonts/onest-latin.woff2') + '") format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,' +
      'U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}';
  } catch (e) {}

  // Наш <style> — последним ребёнком <html> (после <body>): позже всего, что сайт добавит в <head> и <body>.
  function place() {
    if (styleEl && styleEl.textContent && (styleEl.parentNode !== root || root.lastElementChild !== styleEl)) root.appendChild(styleEl);
  }
  // Цвет панели браузера на телефоне — под фон страницы.
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
    root.classList.toggle('kadr-rd', skin);
    var theme = K.resolve(state);
    if (!theme && !skin) {
      // всё выключено — на странице не остаётся ничего своего
      if (styleEl) styleEl.remove();
      restoreMeta();
      return;
    }
    var text = (skin ? FONT : '') + K.css(state);
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = ID; }
    if (styleEl.textContent !== text) styleEl.textContent = text;
    place();
    if (theme) setMeta(theme.bg); else restoreMeta();
  }

  /* ===================== ТЕЛЕФОН: кнопка в верхней панели + шторка ===================== */
  var ENTRY = 'data-kadr-entry';
  var TOUCH = false;
  try { TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches; } catch (e) {}
  if (!TOUCH) TOUCH = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  var entryOn = true;   // storage.menuEntry === false — кнопка выключена
  var sheet = null;

  // Значок «кадр» маской: цвет берётся из currentColor, как у значков-шрифтов форума.
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
    // перед кнопкой меню (последняя в панели), чтобы меню оставалось с краю
    var menu = nav.querySelector(':scope > [data-ipsdrawer]');
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

  // Пока шторка открыта, страница под ней не должна ездить от свайпов. Место, до которого она прокручена,
  // при этом не меняется; после закрытия всё как было.
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
    try { url = chrome.runtime.getURL('popup.html') + '#sheet'; } catch (e) { return; } // расширение обновили — страница устарела
    var host = document.createElement('kadr-sheet');
    var shadow = host.attachShadow({ mode: 'closed' });
    var css = document.createElement('style');
    css.textContent = SHEET_CSS;
    var wrap = document.createElement('div'); wrap.className = 'wrap';
    var scrim = document.createElement('div'); scrim.className = 'scrim';
    var panel = document.createElement('div'); panel.className = 'panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Кадр — тема оформления');
    var grab = document.createElement('div'); grab.className = 'grab';
    grab.appendChild(document.createElement('i'));
    var frame = document.createElement('iframe');
    frame.title = 'Кадр — тема оформления';
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
    place(); // шторка встала в конец <html> — наш <style> должен остаться последним
    void panel.offsetHeight; // зафиксировать стартовую позицию, чтобы анимация сработала
    wrap.classList.add('open');

    scrim.addEventListener('click', closeSheet);
    // Смахнуть вниз за «ручку» — закрыть (мышью; пальцем — с любого места шторки, см. popup.js).
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
  // Сообщения от шторки (она в iframe, касания внутри неё сюда не доходят): закрыть; тянут вниз; отпустили.
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

  /* ===================== НОВЫЙ ДИЗАЙН: размеры шапки ===================== */
  // При прокрутке от шапки остаётся только строка навигации (на телефоне — панель значков): шапка «прилипает»
  // со сдвигом вверх ровно на высоту верхней части. Эту высоту CSS сам не знает — меряем.
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

  /* ===================== старт и слежение ===================== */
  store.get(['theme', 'seed', 'skin', 'menuEntry'], function (d) {
    d = d || {};
    state = { theme: d.theme || K.OFF, seed: d.seed || null };
    skin = d.skin !== false;
    entryOn = d.menuEntry !== false;
    ready = true;
    apply();
    syncEntry();
    measureSoon();
  });

  // Переключение из окна расширения или шторки — сразу во всех открытых вкладках форума.
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
  });

  // Пока страница грузится, держим свой <style> последним; потом — только по изменениям страницы.
  var settled = false;
  function tick() {
    place();
    if (!settled) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.addEventListener('load', function () { place(); syncEntry(); measure(); setTimeout(function () { settled = true; measure(); }, 1500); });
  document.addEventListener('DOMContentLoaded', function () { place(); syncEntry(); measure(); });

  var timer = 0;
  function later() {
    if (!timer) timer = setTimeout(function () { timer = 0; place(); syncEntry(); measure(); }, 120);
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
