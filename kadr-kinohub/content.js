// Кадр для kinohub — контент-скрипт. Два модуля.
// ТЕМА. У сайта нет CSS-переменных: цвета зашиты прямо в стили. Поэтому читаем его таблицы стилей (CSSOM),
//   для каждого правила, которое задаёт цвет, строим «зеркало» — то же правило с цветами темы — и кладём
//   все зеркала одним <style> в самый конец документа. Селекторы и порядок те же, значит каскад не меняется:
//   при равной специфичности побеждает более позднее правило, то есть зеркало. !important сами не добавляем,
//   чтобы инлайновые стили сайта работали как раньше.
//   Читаем живые стили, а не список из расширения, поэтому новые страницы и обновления сайта подхватываются сами.
// ТЕЛЕФОН. Кнопка «Тема» в шапке сайта открывает шторку с настройками расширения.
(function () {
  'use strict';
  if (window.__kadrHub) return; // защита от повторной инъекции
  window.__kadrHub = true;

  var K = window.KADR;
  var store = chrome.storage.local;
  var root = document.documentElement;

  /* ===================== ТЕМА ===================== */
  var ID = 'kadr-theme';
  var state = { theme: K.OFF, seed: null };
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
  function apply() {
    if (!ready) return;
    var theme = K.resolve(state);
    if (!theme) {
      active = false;
      if (styleEl) styleEl.remove();
      setMeta(null);
      return;
    }
    var R = K.recolor(theme);
    var fresh = ir && ir.length ? renderList(ir, R, false) + K.touches(theme) : '';
    var text = fresh || cached;
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = ID; }
    if (styleEl.textContent !== text) styleEl.textContent = text;
    active = true;
    place();
    setMeta(R.page);
    if (fresh && fresh !== cached) {
      cached = fresh;
      // не на каждое движение ползунка «своего цвета»: пишем, когда тема устоялась
      clearTimeout(cacheTimer);
      cacheTimer = setTimeout(function () { store.set({ cache: { theme: state.theme, seed: state.seed, css: cached } }); }, 400);
    }
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
    var tpl = nav.querySelector(':scope > button');
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
    nav.insertBefore(b, tpl.nextSibling);
  }

  var SHEET_CSS =
    ':host{all:initial}' +
    '.wrap{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;' +
      'font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-tap-highlight-color:transparent}' +
    '.scrim{position:absolute;inset:0;background:rgb(0 0 0/.42);opacity:0;transition:opacity .3s ease}' +
    '.panel{position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;height:62vh;height:min(62dvh,560px);' +
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
  function onSheetMsg(e) {
    if (sheet && e.source === sheet.frame.contentWindow && e.data === 'kadr:close') closeSheet();
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

  /* ===================== старт и слежение ===================== */
  store.get(['theme', 'seed', 'cache', 'menuEntry'], function (d) {
    d = d || {};
    state = { theme: d.theme || K.OFF, seed: d.seed || null };
    entryOn = d.menuEntry !== false;
    var c = d.cache;
    if (c && c.css && c.theme === state.theme && (c.seed || null) === state.seed) cached = c.css;
    ready = true;
    apply();
    syncEntry();
  });

  // Переключение из попапа или шторки — сразу во всех открытых вкладках сайта.
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== 'local') return;
    if (ch.theme || ch.seed) {
      if (ch.theme) state.theme = ch.theme.newValue || K.OFF;
      if (ch.seed) state.seed = ch.seed.newValue || null;
      cached = '';
      apply();
      tintSheet();
    }
    if (ch.menuEntry) { entryOn = ch.menuEntry.newValue !== false; syncEntry(); }
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
    syncEntry();
    setTimeout(function () { settled = true; }, 1500);
  });
  document.addEventListener('DOMContentLoaded', function () { refresh(); syncEntry(); });
  // Догрузилась таблица стилей (события load у <link> не всплывают, ловим на погружении).
  document.addEventListener('load', function (e) { if (e.target && e.target.localName === 'link') refresh(); }, true);

  var timer = 0;
  function later() {
    if (!timer) timer = setTimeout(function () { timer = 0; refresh(); syncEntry(); }, 80);
  }
  new MutationObserver(function (records) {
    place();
    for (var i = 0; i < records.length; i++) {
      var r = records[i], t = r.target, j;
      if (t === styleEl || t.parentNode === styleEl) continue;
      // сайт переписал текст своего <style> — правила изменились
      if (t.localName === 'style' || (r.type === 'characterData' && t.parentNode && t.parentNode.localName === 'style')) { later(); return; }
      if (r.type !== 'childList') continue;
      for (j = 0; j < r.addedNodes.length; j++) if (r.addedNodes[j].nodeType === 1 && r.addedNodes[j] !== styleEl) { later(); return; }
      // сайт убрал нашу кнопку вместе с шапкой или её частью
      for (j = 0; j < r.removedNodes.length; j++) if (r.removedNodes[j].nodeType === 1 && r.removedNodes[j] !== styleEl) { later(); return; }
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
})();
