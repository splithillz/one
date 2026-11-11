// Кадр для kinohub — контент-скрипт. Два модуля.
// ТЕМА. У сайта нет CSS-переменных: цвета зашиты прямо в стили. Поэтому читаем его таблицы стилей (CSSOM),
//   для каждого правила, которое задаёт цвет, строим «зеркало» — то же правило с цветами темы — и кладём
//   все зеркала одним <style> в самый конец документа. Селекторы и порядок те же, значит каскад не меняется:
//   при равной специфичности побеждает более позднее правило, то есть зеркало. !important сами не добавляем,
//   чтобы инлайновые стили сайта работали как раньше.
//   Читаем живые стили, а не список из расширения, поэтому новые страницы и обновления сайта подхватываются сами.
// НОВЫЙ ДИЗАЙН. Сами правила — в skin.css (подключён манифестом); здесь его выключатель (класс kadr-rd у <html>),
//   цвета, шрифт и две мелочи, которые CSS сам не умеет: подсветка текущего раздела в шапке и свечение от постера.
// ТЕЛЕФОН. Кнопка «Тема» в шапке сайта открывает шторку с настройками расширения.
// СНИМОК. По кнопке в окне расширения собирает разметку, стили и скрипты сайта в файл — для доработки.
// Закладки, тайминги и актёры — отдельные файлы (lists.js, timings.js, cast.js); общее для них — kit.js.
// Отсюда им только сообщается, что страница изменилась (X.sync) и включён ли новый дизайн (X.skin).
(function () {
  'use strict';
  if (window.__kadrHub) return; // защита от повторной инъекции
  window.__kadrHub = true;

  var K = window.KADR;
  var X = window.KADRX;
  var store = chrome.storage.local;
  var root = document.documentElement;

  /* ===================== ТЕМА ===================== */
  var ID = 'kadr-theme';
  var state = { theme: K.OFF, seed: null };
  var skin = true;       // новый дизайн (storage.skin === false — выключен)
  root.classList.add('kadr-rd'); // сразу, до ответа storage: сайт рисует себя позже, мигания не будет
  var ready = false;     // состояние из storage прочитано
  var styleEl = null;
  var active = false;    // тема включена и наш <style> должен быть в документе
  var ir = null;         // разобранные правила сайта: [{sel, d: [[свойство, значение, important]], kids} | {pre, kids}]
  var sig = '';          // отпечаток таблиц стилей сайта — чтобы не разбирать их заново без причины
  var cached = '';       // готовый CSS с прошлого визита: красим сразу, не дожидаясь загрузки стилей сайта

  // Свойства, в которых бывают цвета (лонгхенды — так их отдаёт CSSOM, цвета уже в виде rgb()).
  // Зеркалим каждое объявление этих свойств, даже без цвета (transparent, none, var()): иначе зеркало
  // более раннего правила перебило бы более позднее правило сайта с той же специфичностью.
  var PROPS = {};
  ('color background-color background-image border-top-color border-right-color border-bottom-color border-left-color ' +
    'border-block-start-color border-block-end-color border-inline-start-color border-inline-end-color outline-color ' +
    'box-shadow text-shadow fill stroke caret-color text-decoration-color column-rule-color accent-color scrollbar-color ' +
    '-webkit-text-fill-color -webkit-text-stroke-color -webkit-tap-highlight-color stop-color flood-color lighting-color')
    .split(' ').forEach(function (p) { PROPS[p] = 1; });
  // Шортхенд с var() CSSOM на лонгхенды не раскладывает (они пустые) — тогда берём сам шортхенд.
  var SHORT = {
    'background-color': ['background'], 'background-image': ['background'],
    'border-top-color': ['border-top', 'border-color', 'border'], 'border-right-color': ['border-right', 'border-color', 'border'],
    'border-bottom-color': ['border-bottom', 'border-color', 'border'], 'border-left-color': ['border-left', 'border-color', 'border'],
    'border-block-start-color': ['border-block-start', 'border-block-color', 'border-block'],
    'border-block-end-color': ['border-block-end', 'border-block-color', 'border-block'],
    'border-inline-start-color': ['border-inline-start', 'border-inline-color', 'border-inline'],
    'border-inline-end-color': ['border-inline-end', 'border-inline-color', 'border-inline'],
    'outline-color': ['outline'], 'text-decoration-color': ['text-decoration'], 'column-rule-color': ['column-rule'],
    '-webkit-text-stroke-color': ['-webkit-text-stroke']
  };

  function readDecls(style) {
    var out = [], seen = {};
    for (var i = 0; i < style.length; i++) {
      var p = style[i], v;
      if (p.charCodeAt(0) === 45 && p.charCodeAt(1) === 45) { // --переменная: только если в ней цвет
        v = style.getPropertyValue(p).trim();
        if (K.hasColor(v)) out.push([p, v, style.getPropertyPriority(p) ? 1 : 0]);
        continue;
      }
      if (!PROPS[p]) continue;
      v = style.getPropertyValue(p);
      if (v) { out.push([p, v, style.getPropertyPriority(p) ? 1 : 0]); continue; }
      var sh = SHORT[p];
      for (var j = 0; sh && j < sh.length; j++) {
        var sv = style.getPropertyValue(sh[j]);
        if (!sv) continue;
        if (!seen[sh[j]]) { seen[sh[j]] = 1; out.push([sh[j], sv, style.getPropertyPriority(sh[j]) ? 1 : 0]); }
        break;
      }
    }
    return out;
  }
  function scan(rules, out) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i], kids = [];
      if (r.selectorText != null && r.style && r.type !== 6) {          // обычное правило (6 — @page)
        if (r.cssRules && r.cssRules.length) scan(r.cssRules, kids);    // вложенные правила
        var d = readDecls(r.style);
        if (d.length || kids.length) out.push({ sel: r.selectorText, d: d, kids: kids });
      } else if (r.styleSheet) {                                        // @import
        try { scan(r.styleSheet.cssRules, kids); } catch (e) {}
        if (kids.length) out.push({ pre: r.media && r.media.mediaText ? '@media ' + r.media.mediaText : '', kids: kids });
      } else if (r.cssRules && typeof r.findRule !== 'function') {      // @media, @supports, @layer, @container… (не @keyframes)
        scan(r.cssRules, kids);
        if (kids.length) { var t = r.cssText; out.push({ pre: t.slice(0, t.indexOf('{')).trim(), kids: kids }); }
      }
    }
  }
  function sheets() {
    var out = [], all = document.styleSheets;
    for (var i = 0; i < all.length; i++) if (all[i].ownerNode !== styleEl && !all[i].disabled) out.push(all[i]);
    return out;
  }
  function signature() {
    return sheets().map(function (sh) {
      var n = sh.ownerNode, len = -1;
      try { len = sh.cssRules.length; } catch (e) {} // ещё грузится или чужой домен без CORS
      return (sh.href || (n && n.localName) || '?') + ':' + len + ':' + (n && n.firstChild && n.firstChild.length || 0);
    }).join('|');
  }
  var blocked = 0;       // таблицы стилей, которые браузер не дал прочитать
  function build() {
    var out = [];
    blocked = 0;
    sheets().forEach(function (sh) {
      var kids = [], m = sh.media && sh.media.mediaText;
      try { scan(sh.cssRules, kids); } catch (e) { blocked++; return; }
      if (kids.length) out.push({ pre: m && m !== 'all' ? '@media ' + m : '', kids: kids });
    });
    return out;
  }
  // Тема молча не легла бы в двух случаях: стили сайта лежат на чужом домене без CORS (их нельзя прочитать)
  // или сайт запрещает вставлять <style>. Говорим об этом попапу, чтобы он показал причину.
  var diag = null;
  function report() {
    if (!ready || document.readyState !== 'complete') return;
    var d = '';
    if (active && styleEl.textContent && styleEl.isConnected && !styleEl.sheet) d = 'csp';
    else if (blocked && !(ir && ir.length)) d = 'blocked';
    if (d !== diag) { diag = d; store.set({ diag: d }); }
  }

  // Селектор значков сайта (<i class="ico_…"> — маска, цвет задаёт background-color) внутри sel.
  function iconSelector(sel) {
    var parts = [], depth = 0, start = 0, q = '';
    for (var i = 0; i <= sel.length; i++) {
      var ch = sel.charAt(i);
      if (q) { if (ch === q) q = ''; continue; }
      if (ch === '"' || ch === "'") q = ch;
      else if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if ((ch === ',' && !depth) || i === sel.length) {
        var s = sel.slice(start, i).trim();
        start = i + 1;
        if (s && !/::|:(?:before|after)\b/.test(s)) parts.push(s + ' i[class^=ico_]');
      }
    }
    return parts.join(',');
  }
  function renderList(nodes, R, nested) {
    var s = '';
    for (var i = 0; i < nodes.length; i++) s += renderNode(nodes[i], R, nested);
    return s;
  }
  function renderNode(n, R, nested) {
    var body, i, d, k;
    if (n.sel == null) {
      body = renderList(n.kids, R, nested);
      return body && n.pre ? n.pre + '{' + body + '}' : body;
    }
    // Фон правила — акцент? Тогда текст и значки на нём должны стать тёмными (ink):
    // у сайта на акценте светлый текст, а акценты тем яркие.
    var onAccent = false, hasColor = false, parts = [];
    for (i = 0; i < n.d.length; i++) {
      d = n.d[i];
      if (d[0] === 'background-color' && (k = R.kindOf(d[1])) && k.k === 'accent' && k.a >= 0.6) onAccent = true;
    }
    for (i = 0; i < n.d.length; i++) {
      d = n.d[i];
      var v = R.value(d[1]);
      if (onAccent && (d[0] === 'color' || d[0] === 'fill')) {
        if (d[0] === 'color') hasColor = true;
        if ((k = R.kindOf(d[1])) && k.k === 'light') v = R.ink;
      }
      parts.push(d[0] + ':' + v + (d[2] ? '!important' : ''));
    }
    if (onAccent && !hasColor) parts.push('color:' + R.ink);
    body = parts.join(';') + (n.kids.length ? ';' + renderList(n.kids, R, true) : '');
    if (!body) return '';
    body = n.sel + '{' + body + '}';
    if (onAccent && !nested && (k = iconSelector(n.sel))) body += k + '{background-color:' + R.ink + '}';
    return body;
  }

  // Наш <style> должен стоять после всех стилей сайта, иначе при равной специфичности победит сайт.
  // Последний ребёнок <html> (после <body>) позже всего, что сайт добавит в <head> и <body>.
  function place() {
    if (active && styleEl.textContent && (styleEl.parentNode !== root || root.lastElementChild !== styleEl)) root.appendChild(styleEl);
  }
  // Цвет панели браузера на телефоне — под фон страницы (если сайт не задал свой).
  function setMeta(color) {
    var m = document.querySelector('meta[name="theme-color"][data-kadr]');
    if (!color || !document.head || document.querySelector('meta[name="theme-color"]:not([data-kadr])')) { if (m) m.remove(); return; }
    if (!m) {
      m = document.createElement('meta');
      m.name = 'theme-color';
      m.setAttribute('data-kadr', '');
      document.head.appendChild(m);
    }
    if (m.content !== color) m.content = color;
  }
  // Шрифт нового дизайна — Onest, как у kinoarc. Файлы лежат в расширении, поэтому адрес известен только здесь.
  var FONT = '';
  try {
    FONT = '@font-face{font-family:Onest;font-style:normal;font-weight:400 800;font-display:swap;src:url("' +
      chrome.runtime.getURL('fonts/onest-cyrillic.woff2') + '") format("woff2");unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}' +
      '@font-face{font-family:Onest;font-style:normal;font-weight:400 800;font-display:swap;src:url("' +
      chrome.runtime.getURL('fonts/onest-latin.woff2') + '") format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,' +
      'U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}';
  } catch (e) {}

  function apply() {
    if (!ready) return;
    root.classList.toggle('kadr-rd', skin);
    var theme = K.resolve(state);
    if (!theme && !skin) {
      // ничего своего на странице: панели расширения (списки, тайминги) берут родные цвета сайта из ui.css
      active = false;
      if (styleEl) styleEl.remove();
      setMeta(null);
      return;
    }
    // Цвета --kd-*: ими красятся новый дизайн, панель списков, тайминги и актёры (без темы — родные цвета сайта).
    var text = (skin ? FONT : '') + K.skinVars(state, skin), R = null;
    if (theme) {
      R = K.recolor(theme, skin);
      var fresh = ir && ir.length ? renderList(ir, R, false) + K.touches(theme) : '';
      text += fresh || cached;
      if (fresh && fresh !== cached) {
        cached = fresh;
        // не на каждое движение ползунка «своего цвета»: пишем, когда тема устоялась
        clearTimeout(cacheTimer);
        cacheTimer = setTimeout(function () { store.set({ cache: { theme: state.theme, seed: state.seed, skin: skin, css: cached } }); }, 400);
      }
    }
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = ID; }
    if (styleEl.textContent !== text) styleEl.textContent = text;
    active = true;
    place();
    setMeta(R && R.page);
  }
  var cacheTimer = 0;
  // Стили сайта изменились (догрузились, добавились) — разобрать заново.
  function refresh() {
    var s = signature();
    if (s !== sig) {
      sig = s;
      ir = build();
      apply();
    }
    report();
  }

  /* ===================== ТЕЛЕФОН: кнопка в шапке + шторка ===================== */
  var ENTRY = 'data-kadr-entry';
  var TOUCH = false;
  try { TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches; } catch (e) {}
  if (!TOUCH) TOUCH = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  var entryOn = true;   // storage.menuEntry === false — кнопка выключена
  var sheet = null;

  // Значок «кадр» маской, как остальные значки сайта: цвет берётся из background-color.
  var ICON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' " +
    "stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 8.6V6.6A2.6 2.6 0 0 1 6.6 4h2M15.4 4h2A2.6 2.6 0 0 1 20 6.6v2" +
    "M20 15.4v2a2.6 2.6 0 0 1-2.6 2.6h-2M8.6 20h-2A2.6 2.6 0 0 1 4 17.4v-2'/%3E%3Ccircle cx='12' cy='12' r='3.4' fill='%23000' stroke='none'/%3E%3C/svg%3E\")";

  function syncEntry() {
    var old = document.querySelectorAll('[' + ENTRY + ']'), i;
    var nav = entryOn && TOUCH ? document.querySelector('nav.header_nav') : null;
    for (i = 0; i < old.length; i++) if (!nav || old[i].parentNode !== nav) old[i].remove();
    if (!nav || nav.querySelector(':scope > [' + ENTRY + ']')) return;
    // Клонируем кнопку «Поиск»: те же классы и data-v-атрибуты, значит выглядит как родная.
    var tpl = nav.querySelector(':scope > button:not([data-kadr-lists])');
    if (!tpl) return;
    var b = tpl.cloneNode(true);
    b.removeAttribute('id');
    b.setAttribute(ENTRY, '');
    b.setAttribute('type', 'button');
    b.setAttribute('title', 'Тема оформления');
    b.setAttribute('aria-label', 'Тема оформления');
    b.setAttribute('aria-haspopup', 'dialog');
    var ic = b.querySelector('i'), tx = b.querySelector('.nav_text');
    if (ic) {
      ic.className = 'ico_kadr';
      ic.style.setProperty('-webkit-mask', ICON + ' center / contain no-repeat');
      ic.style.setProperty('mask', ICON + ' center / contain no-repeat');
    }
    if (tx) tx.textContent = 'Тема';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      openSheet(b);
    });
    // порядок в шапке: «Поиск», «Списки» (lists.js), «Тема»
    var after = nav.querySelector(':scope > [data-kadr-lists]') || tpl;
    nav.insertBefore(b, after.nextSibling);
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
    X.lock('sheet', true); // сайт под шторкой не должен ездить от свайпов
    sheet = { host: host, wrap: wrap, panel: panel, frame: frame, from: from };
    tintSheet();
    place(); // шторка встала в конец <html> — наш <style> должен остаться последним
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
    X.lock('sheet', false);
    window.removeEventListener('keydown', onSheetKey, true);
    window.removeEventListener('message', onSheetMsg);
    s.panel.style.transform = '';
    s.wrap.classList.remove('open');
    setTimeout(function () { s.host.remove(); }, 480);
    if (s.from && s.from.isConnected) try { s.from.focus({ preventScroll: true }); } catch (e) {}
  }

  /* ===================== НОВЫЙ ДИЗАЙН: то, что CSS сам не умеет ===================== */
  // Текущий раздел в шапке: сайт его никак не отмечает, отмечаем атрибутом (красит skin.css).
  function markNav() {
    var links = document.querySelectorAll('nav.header_nav > a[href]'), path = location.pathname;
    for (var i = 0; i < links.length; i++) {
      var p = '';
      try { p = new URL(links[i].href).pathname; } catch (e) {}
      var on = skin && !!p && (p === path || (p !== '/' && path.indexOf(p + '/') === 0));
      if (links[i].hasAttribute('data-kadr-on') !== on) links[i].toggleAttribute('data-kadr-on', on);
    }
  }
  // Свечение за шапкой страницы фильма — размытый постер. Адрес картинки отдаём в CSS-переменную.
  function markPoster() {
    var img = document.querySelector('img.movie_image'), sec = img && img.closest('.movie_section');
    if (!sec) return;
    var src = skin ? img.currentSrc || img.src : '';
    var v = src ? 'url("' + src.replace(/["\\\n]/g, '') + '")' : '';
    if (sec.style.getPropertyValue('--kd-poster') !== v) {
      if (v) sec.style.setProperty('--kd-poster', v); else sec.style.removeProperty('--kd-poster');
    }
  }
  function syncPage() {
    syncEntry();
    markNav();
    markPoster();
    X.skin = skin;
    X.sync();
  }

  /* ===================== СНИМОК ДЛЯ ДОРАБОТКИ ===================== */
  // Сайт не открывается с сервера разработки, поэтому всё, чего не видно на сохранённых страницах (вкладки,
  // списки, тайминги), можно получить только из браузера владельца. По кнопке в окне расширения собираем в один
  // файл: разметку страницы и её вкладок, стили и скрипты сайта, список адресов, к которым он обращался.
  // НЕ берём: куки, токены и содержимое хранилищ — только названия ключей и форму данных (типы и длины).
  var snapBusy = false;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var shape = X.shape; // форма данных: имена полей, типы и длины — без самих значений
  function storageShape(st) {
    var o = {};
    try {
      for (var i = 0; i < st.length; i++) {
        var k = st.key(i), raw = st.getItem(k) || '';
        try { o[k] = shape(JSON.parse(raw), 0); } catch (e) { o[k] = 'string(' + raw.length + ')'; }
      }
    } catch (e) {}
    return o;
  }
  function markup(el) {
    if (!el) return '';
    var c = el.cloneNode(true), list = c.querySelectorAll('#' + ID + ', kadr-sheet, script, noscript, [' + ENTRY + '], [data-kadr-ui], [data-kadr-lists]'), i;
    for (i = 0; i < list.length; i++) list[i].remove();
    // и пометки расширения на узлах сайта: атрибуты data-kadr-* (в подписи закладки — название твоего списка),
    // класс нового дизайна, адрес постера в стиле
    list = [c].concat([].slice.call(c.querySelectorAll('*')));
    for (i = 0; i < list.length; i++) {
      var n = list[i], at = n.attributes, j;
      for (j = at.length - 1; j >= 0; j--) if (at[j].name.indexOf('data-kadr') === 0) n.removeAttribute(at[j].name);
      if (n.style && n.style.getPropertyValue('--kd-poster')) { n.style.removeProperty('--kd-poster'); if (!n.getAttribute('style')) n.removeAttribute('style'); }
    }
    if (c.classList) { c.classList.remove('kadr-rd'); if (!c.getAttribute('class')) c.removeAttribute('class'); }
    list = c.querySelectorAll('[srcdoc]');
    for (i = 0; i < list.length; i++) list[i].setAttribute('srcdoc', '');
    return c.outerHTML.replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/=]{200,}/g, 'data:,');
  }
  function noQuery(u) {
    try {
      var x = new URL(u, location.href), keys = [];
      x.searchParams.forEach(function (v, k) { keys.push(k); });
      return x.origin + x.pathname + (keys.length ? '?' + keys.join('&') : '');
    } catch (e) { return ''; }
  }
  function getText(url) {
    return fetch(url, { credentials: 'omit', cache: 'force-cache' }).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; });
  }
  // Пройтись по состояниям страницы, которые только показывают данные: вкладки фильма, меню профиля, поиск.
  // Кнопки, которые что-то меняют в аккаунте («Сохранить») или открывают новые окна, не трогаем.
  async function tour(out) {
    var i, el;
    var tabs = document.querySelectorAll('.tabs_header button:not(:disabled)');
    for (i = 0; i < tabs.length; i++) {
      tabs[i].click();
      await wait(1500);
      out.push({ name: 'tab: ' + tabs[i].textContent.trim(), html: markup(tabs[i].closest('section') || document.getElementById('main')) });
    }
    el = document.querySelector('.user_dropdown .dropdown_trigger');
    if (el) {
      el.click();
      await wait(700);
      out.push({ name: 'profile menu', html: markup(document.querySelector('header.header') || document.body) });
      el.click();
      await wait(300);
    }
    el = document.getElementById('show_search');
    if (el) {
      el.click();
      await wait(900);
      var dlg = document.querySelector('dialog[open]');
      out.push({ name: 'search', html: markup(dlg) });
      if (dlg && dlg.close) dlg.close();
    }
  }
  async function snapshot() {
    if (snapBusy) return;
    snapBusy = true;
    store.set({ snap: 'work' });
    try {
      var data = {
        kadr: chrome.runtime.getManifest().version, when: new Date().toISOString(),
        url: location.origin + location.pathname, ua: navigator.userAgent,
        viewport: [innerWidth, innerHeight, devicePixelRatio], theme: state.theme, skin: skin,
        html: markup(root), states: [], css: [], scripts: [], resources: [],
        // что ответил API сайта на запросы расширения (только форма), что не удалось, что сейчас показано
        // и какие сообщения шлёт плеер
        api: X.shapes, fails: X.fails, info: X.info, player: X.msgs,
        storage: { local: storageShape(localStorage), session: storageShape(sessionStorage) },
        cookieNames: document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); }).filter(Boolean)
      };
      sheets().forEach(function (sh) {
        var text = '';
        try { for (var i = 0; i < sh.cssRules.length; i++) text += sh.cssRules[i].cssText + '\n'; } catch (e) { text = '/* unreadable */'; }
        data.css.push({ href: sh.href || '', text: text });
      });
      // скрипты сайта: подключённые на странице и все части приложения, на которые ссылается главный файл.
      // Само приложение у сайта лежит на отдельном домене, поэтому берём и с доменов подключённых скриптов
      // (но не со сторонних: счётчики и плеер сюда не попадают).
      var urls = {}, hosts = {}, queue = [], total = 0, n;
      hosts[location.origin] = 1;
      function add(u, listed) {
        try { u = new URL(u, location.href); } catch (e) { return; }
        if (!/^https?:$/.test(u.protocol) || !/\.m?js$/.test(u.pathname) || urls[u.href]) return;
        if (listed) hosts[u.origin] = 1; else if (!hosts[u.origin]) return;
        urls[u.href] = 1;
        queue.push(u.href);
      }
      [].forEach.call(document.querySelectorAll('script[src], link[rel="modulepreload"][href]'), function (x) { add(x.src || x.href, true); });
      performance.getEntriesByType('resource').forEach(function (e) {
        add(e.name, false);
        data.resources.push({ type: e.initiatorType, url: noQuery(e.name) });
      });
      for (n = 0; n < queue.length && n < 120 && total < 9e6; n++) {
        var text = await getText(queue[n]);
        if (!text) continue; // адрес из текста скрипта, по которому ничего нет
        total += text.length;
        data.scripts.push({ src: queue[n], text: text });
        var base = queue[n], m, re = /["'`]((?:\.{0,2}\/)?(?:assets\/)?[\w.@-]+\.m?js)["'`]/g;
        while ((m = re.exec(text))) add(new URL(m[1], m[1].charAt(0) === '.' ? base : new URL('/', base).href).href, false);
      }
      try { await tour(data.states); } catch (e) { data.tourError = String(e && e.message || e); }
      var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kadr-kinohub-snapshot-' + data.when.slice(0, 16).replace(/[:T]/g, '-') + '.json';
      root.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
      store.set({ snap: 'done:' + Math.round(blob.size / 1024) });
    } catch (e) {
      store.set({ snap: 'error:' + String(e && e.message || e).slice(0, 140) });
    }
    snapBusy = false;
  }

  /* ===================== старт и слежение ===================== */
  store.get(['theme', 'seed', 'skin', 'cache', 'menuEntry'], function (d) {
    d = d || {};
    state = { theme: d.theme || K.OFF, seed: d.seed || null };
    skin = d.skin !== false;
    entryOn = d.menuEntry !== false;
    var c = d.cache;
    if (c && c.css && c.theme === state.theme && (c.seed || null) === state.seed && (c.skin !== false) === skin) cached = c.css;
    ready = true;
    apply();
    syncPage();
  });

  // Переключение из попапа или шторки — сразу во всех открытых вкладках сайта.
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== 'local') return;
    if (ch.theme || ch.seed || ch.skin) {
      if (ch.theme) state.theme = ch.theme.newValue || K.OFF;
      if (ch.seed) state.seed = ch.seed.newValue || null;
      if (ch.skin) skin = ch.skin.newValue !== false;
      cached = '';
      apply();
      tintSheet();
      if (ch.skin) syncPage();
    }
    if (ch.menuEntry) { entryOn = ch.menuEntry.newValue !== false; syncEntry(); }
    if (ch.snapReq && ch.snapReq.newValue && document.visibilityState === 'visible') snapshot();
  });

  // Пока страница грузится — проверяем стили перед каждым кадром: зеркало готово раньше первой отрисовки.
  var settled = false;
  function tick() {
    refresh();
    place();
    if (!settled) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.addEventListener('load', function () {
    refresh();
    syncPage();
    setTimeout(function () { settled = true; }, 1500);
  });
  document.addEventListener('DOMContentLoaded', function () { refresh(); syncPage(); });
  window.addEventListener('popstate', function () { later(); });
  // Догрузилась таблица стилей (события load у <link> не всплывают, ловим на погружении).
  document.addEventListener('load', function (e) { if (e.target && e.target.localName === 'link') refresh(); }, true);

  var timer = 0;
  function later() {
    if (!timer) timer = setTimeout(function () { timer = 0; refresh(); syncPage(); }, 80);
  }
  new MutationObserver(function (records) {
    place();
    for (var i = 0; i < records.length; i++) {
      var r = records[i], t = r.target, j;
      if (t === styleEl || t.parentNode === styleEl) continue;
      // свои панели (списки, тайминги, актёры) перерисовываются сами — это не изменение страницы
      var own = t.nodeType === 1 ? t : t.parentNode;
      if (own && own.closest && own.closest('[data-kadr-ui]')) continue;
      // сайт переписал текст своего <style> — правила изменились
      if (t.localName === 'style' || (r.type === 'characterData' && t.parentNode && t.parentNode.localName === 'style')) { later(); return; }
      // сайт подставил другой постер в тот же <img> (переход на другой фильм)
      if (r.type === 'attributes') { if (t.classList && t.classList.contains('movie_image')) { later(); return; } continue; }
      if (r.type !== 'childList') continue;
      for (j = 0; j < r.addedNodes.length; j++) if (r.addedNodes[j].nodeType === 1 && r.addedNodes[j] !== styleEl) { later(); return; }
      // сайт убрал нашу кнопку вместе с шапкой или её частью
      for (j = 0; j < r.removedNodes.length; j++) if (r.removedNodes[j].nodeType === 1 && r.removedNodes[j] !== styleEl) { later(); return; }
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['src'] });
})();
