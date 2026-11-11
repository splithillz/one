// Кадр для kinohub — общее для «закладок», «таймингов» и «актёров»: значки, уведомления, адрес страницы
// и запросы к API сайта.
// ЗАПРОСЫ. Идут туда же, куда их шлёт сам сайт (api.kinobox.tv), и так же, как он: открытые данные — простым GET,
//   списки пользователя — с его ключом входа из localStorage сайта (kbat). Ключ никуда не сохраняется и никуда,
//   кроме API сайта, не отправляется. Продлевать вход (refresh) расширение не умеет и не пытается: это делает
//   только сам сайт. Если ключ устарел — см. siteRefresh() в lists.js.
(function () {
  'use strict';
  if (window.KADRX) return;
  var root = document.documentElement;
  var API = 'https://api.kinobox.tv/api';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var X = window.KADRX = {
    store: chrome.storage.local,
    mods: [],        // модули: {sync()} — вызывается из content.js при изменениях страницы
    skin: true,      // включён ли новый дизайн (ставит content.js)
    shapes: {},      // форма ответов API (типы и длины, без значений) — попадает в «снимок»
    msgs: []         // образцы сообщений от плеера (см. timings.js) — тоже для «снимка»
  };

  /* ---------- DOM ---------- */
  // h('button', {class: 'x', title: '…', onclick: fn}, 'текст', узел, …)
  X.h = function (tag, props) {
    var e = document.createElement(tag), k, i;
    if (props) for (k in props) {
      var v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.charCodeAt(0) === 111 && k.charCodeAt(1) === 110) e.addEventListener(k.slice(2), v); // on…
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x != null && x !== false) e.append(x); });
      else e.append(c);
    }
    return e;
  };
  // Значки: контур 24×24 (stroke), с «*» в начале — заливка.
  var ICONS = {
    bookmark: 'M7 3.8h10a1 1 0 0 1 1 1v15.1a.4.4 0 0 1-.64.32L12 16.4l-5.36 3.82A.4.4 0 0 1 6 19.9V4.8a1 1 0 0 1 1-1Z',
    bookmarkOn: '*M7 3h10a1.8 1.8 0 0 1 1.8 1.8v15.1a1.2 1.2 0 0 1-1.9.98L12 17.38l-4.9 3.5a1.2 1.2 0 0 1-1.9-.98V4.8A1.8 1.8 0 0 1 7 3Z',
    close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
    check: 'M5.5 12.5l4 4 9-9.5',
    plus: 'M12 5.5v13M5.5 12h13',
    bolt: '*M13.2 2.6 5.3 13.1a.6.6 0 0 0 .48.96h4.9l-1 7.1a.4.4 0 0 0 .72.3l7.9-10.5a.6.6 0 0 0-.48-.96h-4.9l1-7.1a.4.4 0 0 0-.72-.3Z',
    play: '*M8 5.4v13.2a.8.8 0 0 0 1.22.68l10.6-6.6a.8.8 0 0 0 0-1.36L9.22 4.72A.8.8 0 0 0 8 5.4Z',
    pause: '*M7.4 5h2.2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7.4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm7 0h2.2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2.2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
    alert: 'M12 4.2 2.9 19.4h18.2L12 4.2ZM12 10v4.4M12 17.2v.1',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.4V12l3.1 2',
    left: 'M14.5 6l-6 6 6 6',
    right: 'M9.5 6l6 6-6 6',
    down: 'M6 9.5l6 6 6-6',
    out: 'M8 16 16 8M9.5 8H16v6.5',
    user: 'M12 12.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.8 20c.6-3.4 3.5-5.4 7.2-5.4s6.6 2 7.2 5.4'
  };
  X.icon = function (name, cls) {
    var d = ICONS[name] || '', fill = d.charAt(0) === '*';
    var s = document.createElementNS(SVGNS, 'svg'), p = document.createElementNS(SVGNS, 'path');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'k-ic' + (cls ? ' ' + cls : ''));
    if (fill) s.setAttribute('fill', 'currentColor');
    else {
      s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
      s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    }
    p.setAttribute('d', fill ? d.slice(1) : d);
    s.appendChild(p);
    return s;
  };
  // Значок-маска в шапке сайта (как его собственные <i class="ico_…">): цвет берётся из background-color.
  X.mask = function (path) {
    return "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='" + path + "'/%3E%3C/svg%3E\")";
  };
  X.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------- время ---------- */
  // 754 → «12:34», 3894 → «1:04:54»
  X.clock = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };
  // «22:14» → 1334, «1:04:55» → 3895, «00:40:54» → 2454; не время → NaN
  X.seconds = function (text) {
    var m = /^\s*(\d{1,3})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?\s*$/.exec(String(text == null ? '' : text));
    if (!m) return NaN;
    return m[3] != null ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2];
  };

  /* ---------- страница ---------- */
  // id фильма, если открыта его страница
  X.movieId = function () {
    var m = /^\/(?:movie|film)\/(\d+)/.exec(location.pathname);
    return m ? +m[1] : 0;
  };
  // Переход внутри сайта без перезагрузки: запись в историю и popstate — роутер сайта подхватывает адрес сам.
  X.go = function (path) {
    try {
      history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    } catch (e) { location.href = path; }
  };
  // Адрес картинки нужного размера — так же, как его строит сайт.
  X.img = function (url, size) { return url ? String(url).replace('/orig', '/' + size) : ''; };

  /* ---------- запросы ---------- */
  function shape(v, depth) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return v.length ? ['x' + v.length, depth > 6 ? '...' : shape(v[0], depth + 1)] : [];
    if (typeof v === 'object') {
      if (depth > 6) return '{...}';
      var o = {};
      Object.keys(v).slice(0, 60).forEach(function (k) { o[k] = shape(v[k], depth + 1); });
      return o;
    }
    return typeof v === 'string' ? 'string(' + v.length + ')' : typeof v;
  }
  X.shape = shape;
  function token() { try { return localStorage.getItem('kbat') || ''; } catch (e) { return ''; } }
  X.token = token;
  // Вошёл ли пользователь — так же, как это проверяет сайт.
  X.authed = function () { try { return !!(localStorage.getItem('kbat') && localStorage.getItem('kbrt')); } catch (e) { return false; } };
  // В Firefox запрос «от имени страницы» — это content.fetch; в Chrome запросы контент-скрипта и так идут как запросы страницы.
  function pageFetch(url, init) {
    try { if (typeof content === 'object' && content && typeof content.fetch === 'function') return content.fetch(url, init); } catch (e) {}
    return fetch(url, init);
  }
  // → {ok, status, data}. Никогда не бросает.
  X.api = function (method, path, body, auth) {
    var init = { method: method, headers: {} };
    if (auth) {
      var t = token();
      if (!t) return Promise.resolve({ ok: false, status: 401, data: null });
      init.headers.Authorization = 'Bearer ' + t;
    }
    if (body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    return pageFetch(API + path, init).then(function (r) {
      return r.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) {}
        if (r.ok) X.shapes[method + ' ' + path.replace(/\d{2,}/g, ':id').replace(/\/watchlists\/(?!status\b)[^/?]+/, '/watchlists/:list')] = shape(data, 0);
        return { ok: r.ok, status: r.status, data: data };
      });
    }).catch(function () { return { ok: false, status: 0, data: null }; });
  };
  // Открытые данные (актёры, тайминги). Сначала — кэш самого сайта (sessionStorage, тот же ключ и срок, что у него),
  // потом своя память, потом сеть.
  var mem = {};
  X.pub = function (path) {
    var url = API + path;
    try {
      var c = JSON.parse(sessionStorage.getItem('cache_' + url) || 'null');
      if (c && Date.now() - c.timestamp < 72e5 && c.value != null) return Promise.resolve(c.value);
    } catch (e) {}
    if (mem[path] && Date.now() - mem[path].at < 6e5) return mem[path].p;
    var p = X.api('GET', path, null, false).then(function (r) {
      if (!r.ok) { delete mem[path]; return null; }
      return r.data;
    });
    mem[path] = { at: Date.now(), p: p };
    return p;
  };
  X.forget = function (path) { delete mem[path]; };
  // Данные фильма, которые сайт уже загрузил для этой страницы (из его же кэша); сеть не трогаем.
  X.movie = function (id) {
    try {
      var c = JSON.parse(sessionStorage.getItem('cache_' + API + '/movies/' + id) || 'null');
      return c && c.value && c.value.data && c.value.data.movie || null;
    } catch (e) { return null; }
  };

  /* ---------- уведомление внизу экрана ---------- */
  var toastEl = null, toastTimer = 0;
  // toast('Сохранено', 'Отменить', fn) — с кнопкой; toast('…') — просто текст
  X.toast = function (text, action, fn, ms) {
    if (toastEl) toastEl.remove();
    clearTimeout(toastTimer);
    var el = toastEl = X.h('kadr-toast', { 'data-kadr-ui': true, role: 'status' }, X.h('span', { text: text }));
    if (action) {
      el.append(X.h('button', { type: 'button', text: action, onclick: function () { hide(); fn(); } }));
    }
    function hide() {
      if (toastEl !== el) return;
      toastEl = null;
      el.classList.remove('on');
      setTimeout(function () { el.remove(); }, 300);
    }
    root.appendChild(el);
    void el.offsetHeight;
    el.classList.add('on');
    toastTimer = setTimeout(hide, ms || (action ? 5200 : 3000));
  };

  X.sync = function () { for (var i = 0; i < X.mods.length; i++) try { X.mods[i].sync(); } catch (e) {} };
})();
