// Кадр для kinohub — закладки под рукой.
// У сайта сохранить фильм — это три шага (закладка → окно → список), а сами списки спрятаны в меню профиля
// и открываются отдельной страницей. Здесь:
//   • нажатие на закладку сразу кладёт фильм в «быстрый» список (и убирает оттуда повторным нажатием);
//     долгое нажатие или правая кнопка — выбор списков;
//   • на карточках видно, что фильм уже сохранён;
//   • кнопка «Списки» в шапке открывает панель со всеми списками — без перехода на другую страницу.
// Всё это — те же запросы, что делает сам сайт (см. kit.js). Если запрос не прошёл, нажатие отдаётся сайту:
// откроется его собственное окно, как без расширения.
(function () {
  'use strict';
  var X = window.KADRX;
  if (!X || X.lists) return;
  var h = X.h, store = X.store, root = document.documentElement;
  var SAVED = 'data-kadr-saved', ENTRY = 'data-kadr-lists';
  var BTN = 'button.watchlist_button';
  var PAGE = 30;            // фильмов на странице списка (как у сайта)
  var MAX_PAGES = 20;       // больше страниц одного списка за раз не читаем

  var on = true;            // storage.lists !== false
  var ready = false;
  var quick = null;         // {id, sid, name} — быстрый список
  var quickOff = false;     // быстрый список выключили сами (storage.quick === false): закладка каждый раз спрашивает
  var lists = null;         // [{sid, name, count, at, pub, ids: [id…] | null, dirty}] — что известно о списках
  var where = {};           // id фильма → сколько списков его содержат
  var local = {};           // id фильма → {v, at}: состояние сразу после нажатия (пока списки не сверены)
  var mine = {};            // 'фильм:список' → {has, at}: что сделали мы сами — на случай, если сервер ответит устаревшим
  var pages = {};           // sid → {items, next, done} — загруженные страницы списка (для панели)
  var cur = '';             // список, открытый в панели в прошлый раз
  var busy = {};
  var pass = false;         // следующее нажатие на закладку отдать сайту
  var swallow = false;      // нажатие после долгого удержания — не считать
  var syncing = null, syncedAt = 0, retries = 0;

  /* ===================== кто вошёл ===================== */
  // Кэш списков привязан к аккаунту. Сам ключ входа не храним: берём из него только отпечаток пользователя.
  function hash(s) {
    var x = 2166136261;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return (x >>> 0).toString(36);
  }
  var keyOf = null, keyIs = '';
  function userKey() {
    var t = X.token();
    if (t === keyOf) return keyIs;
    keyOf = t; keyIs = '';
    try {
      var p = t.split('.')[1];
      if (p) {
        var j = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
        ['exp', 'iat', 'nbf', 'jti'].forEach(function (k) { delete j[k]; }); // это меняется при каждом продлении входа
        keyIs = hash(JSON.stringify(j));
      }
    } catch (e) {}
    return keyIs;
  }
  // Кто сейчас вошёл ('' — никто). Если ключ входа не разобрать, людей не различаем, но и кэш тогда не храним.
  function who() { return X.authed() ? userKey() || '?' : ''; }
  var user = '';

  /* ===================== запросы ===================== */
  // Ключ входа живёт недолго. Продлить его может только сайт; чтобы он это сделал, просим его открыть собственное
  // окно «Добавить в список» (он при этом сам обращается к API и продлевает вход), прячем это окно и закрываем.
  var refreshing = null;
  function siteRefresh() {
    if (refreshing) return refreshing;
    refreshing = (async function () {
      var before = X.token(), btn = document.querySelector(BTN);
      if (!btn || !before) return false;
      root.setAttribute('data-kadr-quiet', '');
      try {
        pass = true;
        btn.click();
        pass = false;
        var t0 = Date.now();
        while (Date.now() - t0 < 8000) {
          await X.wait(100);
          if (X.token() !== before) break;
          var box = document.querySelector('.modal_overlay');
          if (box && box.querySelector('.watchlist_item, .modal-body p')) break;
        }
        var x = document.querySelector('.modal_overlay .modal_close');
        if (x) x.click();
        t0 = Date.now();
        while (document.querySelector('.modal_overlay') && Date.now() - t0 < 1500) await X.wait(60);
      } finally {
        pass = false;
        root.removeAttribute('data-kadr-quiet');
      }
      return !!X.token() && X.token() !== before;
    })();
    var done = function () { refreshing = null; };
    refreshing.then(done, done);
    return refreshing;
  }
  async function call(method, path, body) {
    var t = X.token();
    var r = await X.api(method, path, body, true);
    if (r.status !== 401) return r;
    if (X.token() && X.token() !== t) return X.api(method, path, body, true); // сайт успел продлить вход сам
    if (await siteRefresh()) return X.api(method, path, body, true);
    return r;
  }
  function enc(v) { return encodeURIComponent(String(v)); }

  /* ===================== что где сохранено ===================== */
  function index() {
    where = {};
    (lists || []).forEach(function (l) {
      (l.ids || []).forEach(function (id) { where[id] = (where[id] || 0) + 1; });
    });
  }
  function isSaved(id) { return local[id] ? local[id].v : !!where[id]; }
  function persist() {
    if (!lists) return;
    var u = userKey();
    if (!u) return;
    store.set({ saved: { u: u, lists: lists.map(function (l) { return { sid: l.sid, id: l.id, name: l.name, count: l.count, at: l.at, pub: l.pub, ids: l.ids, dirty: l.dirty ? 1 : 0 }; }) } });
  }
  function compact(m) {
    return {
      id: m.id, title: m.title && (m.title.russian || m.title.original) || '', poster: X.img(m.gallery && m.gallery.posterUrl, '300x450'),
      year: m.year || '', series: m.type === 'Series', rate: m.rating && m.rating.kinopoisk && m.rating.kinopoisk.value || 0
    };
  }
  // Одна страница списка → {items, total} или null
  async function readPage(sid, n) {
    var r = await call('GET', '/watchlists/' + enc(sid) + '?page=' + n);
    var mv = r.ok && r.data && r.data.movies;
    if (!Array.isArray(mv)) return null;
    return { items: mv.filter(function (m) { return m && m.id; }).map(compact), total: r.data.watchlist && r.data.watchlist.movieCount || 0 };
  }
  // Сверка со списками на сервере. Обычно это один запрос: состав перечитывается только у изменившихся списков.
  function syncLists(force) {
    if (!on || !X.authed()) return Promise.resolve();
    if (syncing) return syncing;
    if (!force && lists && Date.now() - syncedAt < 60000) return Promise.resolve();
    var started = Date.now();
    syncing = (async function () {
      var r = await call('GET', '/watchlists');
      if (!r.ok || !Array.isArray(r.data)) {
        // при загрузке страницы сайт мог ещё не продлить вход — попробуем чуть позже
        if (r.status === 401 && retries++ < 2) setTimeout(function () { syncLists(true); }, 4000);
        return;
      }
      retries = 0;
      var prev = {};
      (lists || []).forEach(function (l) { prev[l.sid] = l; });
      lists = r.data.filter(function (w) { return w && w.sid != null; }).map(function (w) {
        var p = prev[String(w.sid)], count = w.movieCount || 0, at = String(w.updatedAt || '');
        var same = p && p.ids && p.count === count && (p.at === at || p.dirty);
        if (!same) delete pages[String(w.sid)];
        return { sid: String(w.sid), id: w.id != null ? String(w.id) : '', name: String(w.name || ''), count: count, at: at, pub: !!w.isPublic, ids: same ? p.ids : count ? null : [], dirty: false };
      });
      X.info.lists = lists.length;
      index(); mark(); paint();
      for (var i = 0; i < lists.length; i++) {
        var l = lists[i];
        if (l.ids) continue;
        var ids = [], items = [], n, done = false;
        for (n = 1; n <= Math.min(Math.ceil(l.count / PAGE), MAX_PAGES); n++) {
          var pg = await readPage(l.sid, n);
          if (!pg) break;
          pg.items.forEach(function (m) { ids.push(m.id); items.push(m); });
          if (pg.items.length < PAGE) { done = true; break; }
          await X.wait(150);
        }
        if (lists.indexOf(l) < 0) continue;
        l.ids = ids;
        pages[l.sid] = { items: items, next: n + 1, done: done || ids.length >= l.count };
        index(); mark(); paint();
      }
      Object.keys(local).forEach(function (id) { if (local[id].at < started) delete local[id]; });
      syncedAt = Date.now();
      persist(); mark(); paint();
    })();
    var end = function () { syncing = null; };
    syncing.then(end, end);
    return syncing;
  }
  var adoptTimer = 0;
  function resyncSoon() { clearTimeout(adoptTimer); adoptTimer = setTimeout(function () { syncLists(true); }, 2500); }

  // Строка из ответа «в каких списках фильм» ↔ список. У списка на сайте два номера: числовой id и строковый sid
  // (в адресе страницы списка — sid, в записи фильма в список — id). В ответе «в каких списках» приходит id.
  // Сверяем по id, потом по sid, потом по имени (если оно одно такое) — на случай, если сайт это поменяет.
  function pickOne(arr, tests) {
    for (var i = 0; i < tests.length; i++) {
      var r = arr.filter(tests[i]);
      if (r.length === 1) return r[0];
    }
    return null;
  }
  function rowOf(l, rows) {
    return pickOne(rows, [
      function (x) { return !!l.id && String(x.id) === l.id; },
      function (x) { return String(x.id) === l.sid; },
      function (x) { return x.name === l.name; }
    ]);
  }
  function listOf(row) {
    var id = String(row.id);
    return lists ? pickOne(lists, [
      function (l) { return l.id === id; },
      function (l) { return l.sid === id; },
      function (l) { return l.name === row.name; }
    ]) : null;
  }
  function quickRow(rows) {
    if (!quick) return quickOff ? null : rows.length === 1 ? rows[0] : null;
    return pickOne(rows, [
      function (x) { return quick.id != null && quick.id !== '' && String(x.id) === String(quick.id); },
      function (x) { return !!quick.sid && String(x.id) === String(quick.sid); },
      function (x) { return x.name === quick.name; }
    ]);
  }
  function isQuick(l) {
    if (!quick) return false;
    if (quick.sid) return quick.sid === l.sid;
    if (quick.id != null && quick.id !== '' && l.id) return String(quick.id) === l.id;
    return quick.name === l.name;
  }
  function setQuick(row, l) {
    if (row && !l) l = listOf(row);
    quick = { id: row ? row.id : l.id || null, sid: l ? l.sid : '', name: row ? row.name : l.name };
    quickOff = false;
    store.set({ quick: quick });
  }
  // Выключить быстрый список: закладка будет каждый раз спрашивать, куда сохранить, пока его не включат снова (⚡).
  function clearQuick() {
    quick = null;
    quickOff = true;
    store.set({ quick: false });
    X.toast('Быстрый список выключен — закладка будет спрашивать, куда сохранить');
  }
  // Ответ «в каких списках фильм» сервер может отдать устаревшим (из своего кэша) — тогда второе нажатие сохранило бы
  // фильм ещё раз вместо того, чтобы убрать. Несколько минут после своего нажатия верим ему, а не такому ответу.
  var TRUST = 300000;
  function rowsOf(data, movie) {
    var out = data.filter(function (x) { return x && x.id != null; }), now = Date.now();
    out.forEach(function (x) {
      var m = mine[movie + ':' + x.id];
      if (m && now - m.at < TRUST) x.hasMovie = m.has;
    });
    return out;
  }
  // Состояние фильма в списках после записи — в память и на экран.
  function applied(row, id, add, rows) {
    row.hasMovie = add;
    mine[id + ':' + row.id] = { has: add, at: Date.now() };
    local[id] = { v: rows.some(function (x) { return x.hasMovie; }), at: Date.now() };
    var l = listOf(row);
    if (l) {
      if (l.ids) {
        var i = l.ids.indexOf(id);
        if (add && i < 0) { l.ids.unshift(id); l.count++; }
        if (!add && i >= 0) { l.ids.splice(i, 1); l.count = Math.max(0, l.count - 1); }
      } else l.count = Math.max(0, l.count + (add ? 1 : -1));
      l.dirty = true;
      var pg = pages[l.sid];
      if (pg) {
        if (add) delete pages[l.sid];
        else pg.items = pg.items.filter(function (m) { return m.id !== id; });
      }
      index(); persist();
    }
    mark(); paint(); resyncSoon();
  }
  function write(add, listId, movieId) { return call(add ? 'PUT' : 'DELETE', '/watchlists/' + enc(listId) + '/movies/' + movieId); }

  /* ===================== закладка на карточке и на странице фильма ===================== */
  function movieOf(btn) {
    var card = btn.closest('article.card');
    if (card) {
      var a = card.querySelector('a[href*="/movie/"], a[href*="/film/"]');
      var m = a && /\/(?:movie|film)\/(\d+)/.exec(a.getAttribute('href') || '');
      return m ? +m[1] : 0;
    }
    return btn.closest('.movie_section') ? X.movieId() : 0;
  }
  function titleOf(btn) {
    var card = btn.closest('article.card'), t = card ? card.querySelector('.title') : document.querySelector('.movie_title_russian');
    return t ? t.textContent.trim() : '';
  }
  function mark() {
    var list = document.querySelectorAll(BTN), act = on && ready && X.authed();
    if (root.hasAttribute('data-kadr-bm') !== act) root.toggleAttribute('data-kadr-bm', act);
    for (var i = 0; i < list.length; i++) {
      var b = list[i], id = act ? movieOf(b) : 0, want = id && isSaved(id) ? '' : null;
      if (b.getAttribute(SAVED) !== want) { if (want === null) b.removeAttribute(SAVED); else b.setAttribute(SAVED, ''); }
      // на странице фильма подпись кнопки — где он лежит
      if (b.closest('.movie_favorites')) {
        var label = null;
        if (want !== null) {
          var names = (lists || []).filter(function (l) { return l.ids && l.ids.indexOf(id) >= 0; }).map(function (l) { return l.name; });
          label = names.length === 1 ? 'В списке «' + names[0] + '»' : names.length > 1 ? 'В ' + names.length + ' списках' : 'Сохранено';
        }
        if (b.getAttribute('data-kadr-label') !== label) { if (label === null) b.removeAttribute('data-kadr-label'); else b.setAttribute('data-kadr-label', label); }
      }
    }
  }
  function native(btn) {
    if (!btn || !btn.isConnected) return;
    pass = true;
    btn.click();
    pass = false;
  }
  // Одно нажатие: в быстрый список / из него.
  async function toggle(id, btn) {
    if (busy[id]) return;
    busy[id] = 1;
    btn.setAttribute('data-kadr-busy', '');
    try {
      var st = await call('GET', '/watchlists/status/' + id);
      if (!st.ok || !Array.isArray(st.data)) { native(btn); return; }
      var rows = rowsOf(st.data, id);
      if (!rows.length) { openPanel({ mode: 'pick', movie: id, title: titleOf(btn), rows: rows, from: btn }); return; }
      var q = quickRow(rows);
      var other = rows.some(function (x) { return x.hasMovie && x !== q; });
      // быстрый список не выбран, или фильм лежит в других списках — спросить, а не гадать
      if (!q || (other && !q.hasMovie)) { openPanel({ mode: 'pick', movie: id, title: titleOf(btn), rows: rows, from: btn }); return; }
      if (!quick) setQuick(q, null);
      var add = !q.hasMovie;
      var r = await write(add, q.id, id);
      if (!r.ok) { X.toast('Не получилось. Открываю окно сайта'); native(btn); return; }
      applied(q, id, add, rows);
      X.toast(add ? 'Сохранено в «' + q.name + '»' : 'Убрано из «' + q.name + '»', 'Отменить', async function () {
        var u = await write(!add, q.id, id);
        if (u.ok) applied(q, id, !add, rows); else X.toast('Не получилось отменить');
      });
    } finally {
      delete busy[id];
      btn.removeAttribute('data-kadr-busy');
    }
  }
  // Выбор списков для фильма (долгое нажатие, правая кнопка).
  async function pick(id, btn) {
    openPanel({ mode: 'pick', movie: id, title: titleOf(btn), rows: null, from: btn });
    var st = await call('GET', '/watchlists/status/' + id);
    if (!panel || panel.movie !== id) return;
    if (!st.ok || !Array.isArray(st.data)) { closePanel(); native(btn); return; }
    panel.rows = rowsOf(st.data, id);
    paint();
  }
  function target(e) {
    if (!on || !ready) return null;
    var t = e.target, btn = t && t.closest ? t.closest(BTN) : null;
    if (!btn || btn.closest('[data-kadr-ui]') || !X.authed()) return null;
    return movieOf(btn) ? btn : null;
  }
  window.addEventListener('click', function (e) {
    if (pass || e.altKey) return;
    var btn = target(e);
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (swallow) { swallow = false; return; }
    toggle(movieOf(btn), btn);
  }, true);
  // Долгое нажатие — выбор списков.
  var hold = 0, hx = 0, hy = 0;
  window.addEventListener('pointerdown', function (e) {
    swallow = false;
    clearTimeout(hold);
    var btn = e.button ? null : target(e);
    if (!btn) return;
    hx = e.clientX; hy = e.clientY;
    hold = setTimeout(function () {
      swallow = true;
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (x) {}
      pick(movieOf(btn), btn);
    }, 480);
  }, true);
  window.addEventListener('pointermove', function (e) { if (hold && Math.abs(e.clientX - hx) + Math.abs(e.clientY - hy) > 12) { clearTimeout(hold); hold = 0; } }, true);
  ['pointerup', 'pointercancel'].forEach(function (n) { window.addEventListener(n, function () { clearTimeout(hold); hold = 0; }, true); });
  window.addEventListener('contextmenu', function (e) {
    var btn = target(e);
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    clearTimeout(hold); hold = 0;
    if (!panel) pick(movieOf(btn), btn);
  }, true);

  /* ===================== кнопка «Списки» в шапке ===================== */
  var ICON = X.mask('M7 3h10a1.8 1.8 0 0 1 1.8 1.8v15.1a1.2 1.2 0 0 1-1.9.98L12 17.38l-4.9 3.5a1.2 1.2 0 0 1-1.9-.98V4.8A1.8 1.8 0 0 1 7 3Z');
  function syncEntry() {
    var old = document.querySelectorAll('[' + ENTRY + ']'), i;
    var nav = on && ready && X.authed() ? document.querySelector('nav.header_nav') : null;
    for (i = 0; i < old.length; i++) if (!nav || old[i].parentNode !== nav) old[i].remove();
    if (!nav || nav.querySelector(':scope > [' + ENTRY + ']')) return;
    var tpl = nav.querySelector(':scope > button:not([data-kadr-entry])'); // «Поиск»: клон выглядит как родная кнопка
    if (!tpl) return;
    var b = tpl.cloneNode(true);
    b.removeAttribute('id');
    b.setAttribute(ENTRY, '');
    b.setAttribute('type', 'button');
    b.setAttribute('title', 'Мои списки');
    b.setAttribute('aria-label', 'Мои списки');
    b.setAttribute('aria-haspopup', 'dialog');
    var ic = b.querySelector('i'), tx = b.querySelector('.nav_text');
    if (ic) {
      ic.className = 'ico_kadr';
      ic.style.setProperty('-webkit-mask', ICON + ' center / contain no-repeat');
      ic.style.setProperty('mask', ICON + ' center / contain no-repeat');
    }
    if (tx) tx.textContent = 'Списки';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      openPanel({ mode: 'browse', from: b });
    });
    nav.insertBefore(b, tpl.nextSibling);
  }

  /* ===================== панель: списки и выбор списка ===================== */
  var panel = null; // {host, box, mode, movie, title, rows, from, form}
  function openPanel(o) {
    closePanel(true);
    var host = h('kadr-lists', { 'data-kadr-ui': true });
    var scrim = h('div', { class: 'kl-scrim', onclick: function () { closePanel(); } });
    var box = h('div', { class: 'kl-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.mode === 'pick' ? 'Сохранить в список' : 'Мои списки', tabindex: '-1' });
    host.append(scrim, box);
    host.setAttribute('data-mode', o.mode);
    root.appendChild(host);
    X.lock('lists', true);
    pull(box);
    panel = { host: host, box: box, mode: o.mode, movie: o.movie || 0, title: o.title || '', rows: o.rows || null, from: o.from || null, form: false, formEl: null, fresh: true };
    paint();
    void box.offsetHeight;
    host.classList.add('open');
    try { box.focus({ preventScroll: true }); } catch (e) {}
    window.addEventListener('keydown', onKey, true);
    if (o.mode === 'browse') syncLists(!lists).then(function () { if (panel && panel.mode === 'browse') { paint(); loadMore(false); } });
  }
  function onKey(e) {
    if (e.key !== 'Escape' || !panel) return;
    e.stopPropagation();
    closePanel();
  }
  function closePanel(now) {
    if (!panel) return;
    var p = panel;
    panel = null;
    X.lock('lists', false);
    window.removeEventListener('keydown', onKey, true);
    p.host.classList.remove('open');
    if (now) p.host.remove(); else setTimeout(function () { p.host.remove(); }, 420);
    if (!now && p.from && p.from.isConnected) try { p.from.focus({ preventScroll: true }); } catch (e) {}
  }
  function iconBtn(name, title, fn, cls) {
    return h('button', { type: 'button', class: 'kl-ib' + (cls ? ' ' + cls : ''), title: title, 'aria-label': title, onclick: fn }, X.icon(name));
  }
  // Смахнуть панель вниз (на телефоне): за «ручку», за шапку — или за сам список, когда он стоит в самом верху.
  function pull(box) {
    var st = null;
    function sheet() { return !matchMedia('(min-width: 760px)').matches; } // на широком экране панель сбоку, тянуть её вниз незачем
    box.addEventListener('touchstart', function (e) {
      st = null;
      if (e.touches.length !== 1 || !sheet()) return;
      var sc = box.querySelector('.kl-scroll'), t = e.touches[0];
      if (e.target.closest && e.target.closest('input')) return;
      st = { x: t.clientX, y: t.clientY, at: e.timeStamp, top: !sc || !sc.contains(e.target) || sc.scrollTop <= 0, on: false, dy: 0 };
    }, { passive: true });
    box.addEventListener('touchmove', function (e) {
      if (!st || !st.top) return;
      var t = e.touches[0], dy = t.clientY - st.y, dx = t.clientX - st.x;
      if (!st.on) {
        if (dy < -8 || (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy))) { st = null; return; } // вверх или вбок — обычная прокрутка
        if (dy < 10) return;
        st.on = true;
        box.style.transition = 'none';
      }
      if (e.cancelable) e.preventDefault();
      st.dy = Math.max(0, dy);
      box.style.transform = 'translateY(' + st.dy + 'px)';
    }, { passive: false });
    function end(e) {
      var s0 = st;
      st = null;
      if (!s0 || !s0.on) return;
      box.style.transition = '';
      box.style.transform = '';
      if (s0.dy > 110 || (s0.dy > 24 && s0.dy / Math.max(1, e.timeStamp - s0.at) > 0.55)) closePanel();
    }
    box.addEventListener('touchend', end);
    box.addEventListener('touchcancel', end);
  }
  // «Ручка» сверху; мышью её тоже можно потянуть (пальцем — см. pull()).
  function grab() {
    var g = h('div', { class: 'kl-grab' }, h('i')), y0 = 0, dy = 0, t0 = 0, drag = false;
    g.addEventListener('pointerdown', function (e) {
      if (!panel || e.pointerType === 'touch') return;
      drag = true; y0 = e.clientY; dy = 0; t0 = e.timeStamp;
      panel.box.style.transition = 'none';
      try { g.setPointerCapture(e.pointerId); } catch (x) {}
    });
    g.addEventListener('pointermove', function (e) {
      if (!drag || !panel) return;
      dy = Math.max(0, e.clientY - y0);
      panel.box.style.transform = 'translateY(' + dy + 'px)';
    });
    function end(e) {
      if (!drag) return;
      drag = false;
      if (!panel) return;
      panel.box.style.transition = '';
      panel.box.style.transform = '';
      if (dy > 110 || (dy > 24 && dy / Math.max(1, e.timeStamp - t0) > 0.55)) closePanel();
    }
    g.addEventListener('pointerup', end);
    g.addEventListener('pointercancel', end);
    return g;
  }
  // Форма «новый список». Одна и та же на всё время, пока открыта: панель перерисовывается (в том числе сама,
  // когда догружаются списки), а набранное название пропасть не должно.
  function createForm(after) {
    if (panel.formEl) return panel.formEl;
    var input = h('input', { class: 'kl-input', type: 'text', maxlength: '50', placeholder: 'Название списка', autocomplete: 'off', 'aria-label': 'Название нового списка' });
    var ok = h('button', { type: 'submit', class: 'kl-btn', text: 'Создать' });
    var form = panel.formEl = h('form', { class: 'kl-form' }, input, ok, iconBtn('close', 'Отмена', function () { panel.form = false; paint(); }));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var name = input.value.trim();
      if (!name || ok.disabled) { input.focus(); return; }
      ok.disabled = true;
      var r = await call('POST', '/watchlists', { name: name, isPublic: false });
      if (!panel) return;
      if (!r.ok) { ok.disabled = false; X.toast(r.status === 401 ? 'Нужно войти в аккаунт' : 'Список не создан'); return; }
      panel.form = false;
      await syncLists(true);
      after(name, r.data);
    });
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
    return form;
  }
  function paint() {
    if (!panel) return;
    var p = panel, box = p.box, keep = box.querySelector('.kl-scroll'), top = keep ? keep.scrollTop : 0;
    var chips = box.querySelector('.kl-chips'), left = chips ? chips.scrollLeft : 0;
    if (!p.form) p.formEl = null;
    var typing = p.formEl && p.formEl.contains(document.activeElement) ? document.activeElement : null;
    var nodes = p.mode === 'pick' ? paintPick(p) : paintBrowse(p);
    box.replaceChildren.apply(box, [grab()].concat(nodes));
    var sc = box.querySelector('.kl-scroll');
    if (sc && top) sc.scrollTop = top;
    chips = box.querySelector('.kl-chips');
    if (chips && left) chips.scrollLeft = left;
    if (typing && typing.isConnected) try { typing.focus({ preventScroll: true }); } catch (e) {}
    p.fresh = false;
  }

  /* ----- выбор списков для фильма ----- */
  function paintPick(p) {
    var head = h('header', { class: 'kl-head' },
      h('div', { class: 'kl-ttl' }, h('b', { text: 'Сохранить в список' }), p.title ? h('span', { text: p.title }) : null),
      iconBtn('close', 'Закрыть', function () { closePanel(); }));
    var body = h('div', { class: 'kl-scroll' });
    if (!p.rows) body.append(h('div', { class: 'kl-wait' }, h('i'), h('i'), h('i')));
    else {
      var q = quickRow(p.rows);
      if (!quick) q = null;
      p.rows.forEach(function (row) {
        var isQ = row === q;
        var b = h('button', { type: 'button', class: 'kl-row' + (row.hasMovie ? ' on' : ''), 'aria-pressed': String(!!row.hasMovie) },
          h('span', { class: 'kl-ck' }, X.icon('check')),
          h('span', { class: 'kl-nm', text: row.name }));
        b.addEventListener('click', async function () {
          if (b.disabled) return;
          b.disabled = true;
          var add = !row.hasMovie, r = await write(add, row.id, p.movie);
          if (r.ok) {
            // быстрого списка ещё нет (или его удалили) — им становится выбранный; выключенный сам не включается
            if (add && !quickOff && (!quick || !quickRow(p.rows))) setQuick(row, null);
            applied(row, p.movie, add, p.rows);
          } else { X.toast('Не получилось'); paint(); }
        });
        var tip = isQ ? 'Быстрый список. Нажми, чтобы выключить' : 'Сделать быстрым';
        var star = h('button', { type: 'button', class: 'kl-q' + (isQ ? ' on' : ''), title: tip, 'aria-label': tip, 'aria-pressed': String(isQ) }, X.icon('bolt'));
        // ⚡ — переключатель: на быстром списке выключает его, на другом — делает быстрым
        star.addEventListener('click', function () {
          if (isQ) clearQuick();
          else { setQuick(row, null); X.toast('Быстрый список — «' + row.name + '»'); }
          paint();
        });
        body.append(h('div', { class: 'kl-line' }, b, star));
      });
      if (!p.rows.length && !p.form) body.append(h('p', { class: 'kl-empty', text: 'Списков пока нет. Создай первый — и закладка будет сохранять в него одним нажатием.' }));
      if (p.form) body.append(createForm(async function () {
        var st = await call('GET', '/watchlists/status/' + p.movie);
        if (!panel || panel !== p) return;
        if (st.ok && Array.isArray(st.data)) p.rows = rowsOf(st.data, p.movie);
        paint();
      }));
      else body.append(h('button', { type: 'button', class: 'kl-new', onclick: function () { p.form = true; paint(); } }, X.icon('plus'), h('span', { text: 'Новый список' })));
      body.append(h('p', { class: 'kl-hint' }, X.icon('bolt'), h('span', {
        text: quickOff ? 'Быстрый список выключен: закладка каждый раз спрашивает. ⚡ у списка — включить.'
          : q ? 'Быстрый список: в него закладка сохраняет одним нажатием. Нажми ⚡ ещё раз, чтобы выключить.'
          : 'Быстрый список: в него закладка сохраняет одним нажатием.'
      })));
    }
    return [head, body];
  }

  /* ----- все списки ----- */
  function current() {
    if (!lists || !lists.length) return null;
    var l = lists.filter(function (x) { return x.sid === cur; })[0];
    if (!l && quick) l = lists.filter(isQuick)[0];
    return l || lists[0];
  }
  async function loadMore(next) {
    var l = current();
    if (!l || !panel) return;
    var pg = pages[l.sid] || (pages[l.sid] = { items: [], next: 1, done: !l.count });
    if (pg.done || pg.loading || (!next && pg.items.length)) return;
    pg.loading = true;
    paint();
    var res = await readPage(l.sid, pg.next);
    pg.loading = false;
    if (!res) { pg.failed = true; paint(); return; }
    pg.failed = false;
    var have = {};
    if (!pg.items.length) pg.fresh = true;
    pg.items.forEach(function (m) { have[m.id] = 1; });
    res.items.forEach(function (m) { if (!have[m.id]) pg.items.push(m); });
    pg.next++;
    pg.done = res.items.length < PAGE || pg.items.length >= (res.total || l.count);
    paint();
  }
  async function removeFrom(l, m) {
    var st = await call('GET', '/watchlists/status/' + m.id);
    var rows = st.ok && Array.isArray(st.data) ? rowsOf(st.data, m.id) : null;
    var row = rows && rowOf(l, rows);
    if (!row) { X.toast('Не получилось убрать'); return; }
    var r = await write(false, row.id, m.id);
    if (!r.ok) { X.toast('Не получилось убрать'); return; }
    applied(row, m.id, false, rows);
    X.toast('Убрано из «' + l.name + '»', 'Вернуть', async function () {
      var u = await write(true, row.id, m.id);
      if (u.ok) { applied(row, m.id, true, rows); if (panel && panel.mode === 'browse') loadMore(false); } else X.toast('Не получилось вернуть');
    });
  }
  function paintBrowse(p) {
    var head = h('header', { class: 'kl-head' },
      h('div', { class: 'kl-ttl' }, h('b', { text: 'Мои списки' })),
      iconBtn('close', 'Закрыть', function () { closePanel(); }));
    if (!lists) {
      var failed = !syncing;
      return [head, h('div', { class: 'kl-scroll' }, failed
        ? h('div', { class: 'kl-empty' }, h('p', { text: 'Списки не загрузились.' }), h('button', { type: 'button', class: 'kl-btn', text: 'Повторить', onclick: function () { syncLists(true).then(paint); paint(); } }))
        : h('div', { class: 'kl-wait' }, h('i'), h('i'), h('i')))];
    }
    var l = current();
    var chips = h('div', { class: 'kl-chips', role: 'tablist' });
    lists.forEach(function (x) {
      chips.append(h('button', {
        type: 'button', class: 'kl-chip' + (x === l ? ' on' : ''), role: 'tab', 'aria-selected': String(x === l),
        onclick: function () { cur = x.sid; store.set({ listCur: cur }); p.form = false; p.fresh = true; paint(); loadMore(false); }
      }, isQuick(x) ? X.icon('bolt') : null, h('span', { text: x.name }), h('i', { text: String(x.count) })));
    });
    chips.append(h('button', { type: 'button', class: 'kl-chip kl-add', title: 'Новый список', 'aria-label': 'Новый список', onclick: function () { p.form = !p.form; paint(); } }, X.icon('plus')));
    var body = h('div', { class: 'kl-scroll' });
    if (p.form) body.append(createForm(function (name) {
      var made = (lists || []).filter(function (x) { return x.name === name; })[0];
      if (made) { cur = made.sid; store.set({ listCur: cur }); }
      paint(); loadMore(false);
    }));
    if (!l) {
      if (!p.form) body.append(h('div', { class: 'kl-empty' }, h('p', { text: 'Списков пока нет.' }), h('button', { type: 'button', class: 'kl-btn', text: 'Создать список', onclick: function () { p.form = true; paint(); } })));
      return [head, chips, body];
    }
    var q = isQuick(l);
    var bar = h('div', { class: 'kl-bar' },
      h('button', {
        type: 'button', class: 'kl-pill' + (q ? ' on' : ''), 'aria-pressed': String(q), title: q ? 'Нажми, чтобы выключить быстрый список' : '',
        onclick: function () {
          if (q) clearQuick();
          else { setQuick(null, l); X.toast('Закладка теперь сохраняет в «' + l.name + '»'); }
          paint();
        }
      }, X.icon('bolt'), h('span', { text: q ? 'Быстрый список' : 'Сделать быстрым' })),
      h('a', { class: 'kl-pill', href: '/watchlist/' + enc(l.sid), onclick: function (e) { e.preventDefault(); closePanel(); X.go('/watchlist/' + enc(l.sid)); } }, h('span', { text: 'Страницей' }), X.icon('out')),
      h('a', { class: 'kl-pill', href: '/watchlists', onclick: function (e) { e.preventDefault(); closePanel(); X.go('/watchlists'); } }, h('span', { text: 'Все списки' })));
    var pg = pages[l.sid] || (l.count ? null : { items: [], done: true }); // пустой список загружать незачем
    var grid = h('div', { class: 'kl-grid' + (p.fresh || (pg && pg.fresh) ? ' in' : '') });
    if (pg) pg.fresh = false;
    (pg ? pg.items : []).forEach(function (m) {
      var a = h('a', { class: 'kl-card', href: '/movie/' + m.id, title: m.title, onclick: function (e) { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); closePanel(); X.go('/movie/' + m.id); } },
        h('span', { class: 'kl-poster' }, m.poster ? h('img', { src: m.poster, alt: '', loading: 'lazy', decoding: 'async' }) : null, m.rate ? h('em', { text: m.rate.toFixed(1), class: m.rate >= 7 ? 'hi' : '' }) : null),
        h('b', { text: m.title }),
        h('small', { text: [m.year, m.series ? 'сериал' : ''].filter(Boolean).join(' · ') }));
      var rm = h('button', { type: 'button', class: 'kl-rm', title: 'Убрать из списка', 'aria-label': 'Убрать из списка «' + l.name + '»: ' + m.title }, X.icon('close'));
      rm.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (rm.disabled) return;
        rm.disabled = true;
        removeFrom(l, m).then(function () { rm.disabled = false; });
      });
      grid.append(h('div', { class: 'kl-cell' }, a, rm));
    });
    body.append(bar);
    if (pg && pg.items.length) body.append(grid);
    if (!pg || pg.loading) body.append(h('div', { class: 'kl-wait' }, h('i'), h('i'), h('i')));
    else if (pg.failed) body.append(h('div', { class: 'kl-empty' }, h('p', { text: 'Не загрузилось.' }), h('button', { type: 'button', class: 'kl-btn', text: 'Повторить', onclick: function () { loadMore(true); } })));
    else if (!pg.items.length) body.append(h('p', { class: 'kl-empty', text: 'Здесь пока пусто. Нажми на закладку у любого фильма — он появится в быстром списке.' }));
    else if (!pg.done) body.append(h('button', { type: 'button', class: 'kl-btn kl-more', text: 'Показать ещё', onclick: function () { loadMore(true); } }));
    return [head, chips, body];
  }

  /* ===================== включение ===================== */
  function restore(saved) {
    if (!saved || !Array.isArray(saved.lists) || saved.u !== userKey() || !saved.u) return;
    lists = saved.lists.map(function (l) {
      return { sid: String(l.sid), id: l.id != null ? String(l.id) : '', name: String(l.name || ''), count: l.count || 0, at: String(l.at || ''), pub: !!l.pub, ids: Array.isArray(l.ids) ? l.ids : null, dirty: !!l.dirty };
    });
    index();
  }
  var started = false;
  function sync() {
    if (!ready) return;
    var u = on ? who() : '';
    if (u !== user) {
      // вошёл другой человек или вышел: всё, что знали о списках, — не про него
      user = u;
      lists = null; where = {}; local = {}; mine = {}; pages = {}; started = false; syncedAt = 0; retries = 0;
      closePanel(true);
    }
    syncEntry();
    mark();
    // первая сверка — когда сайт уже нарисовал страницу (к этому времени он сам проверил вход)
    if (on && !started && X.authed() && document.querySelector('nav.header_nav')) {
      started = true;
      setTimeout(function () { syncLists(false); }, 1200);
    }
  }
  X.mods.push({ sync: sync });
  X.lists = { open: function () { openPanel({ mode: 'browse' }); } };

  store.get(['lists', 'quick', 'saved', 'listCur'], function (d) {
    d = d || {};
    on = d.lists !== false;
    quick = d.quick && typeof d.quick === 'object' && d.quick.name ? d.quick : null;
    quickOff = d.quick === false;
    cur = typeof d.listCur === 'string' ? d.listCur : '';
    user = on ? who() : '';
    if (on) restore(d.saved);
    ready = true;
    sync();
  });
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== 'local') return;
    if (ch.lists) {
      on = ch.lists.newValue !== false;
      sync(); // выключили — sync() сам всё забудет и уберёт кнопку; включили — начнёт сверку
    }
    if (ch.quick) {
      var v = ch.quick.newValue;
      quick = v && typeof v === 'object' && v.name ? v : null;
      quickOff = v === false;
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && on && started && Date.now() - syncedAt > 3e5) syncLists(true);
  });
})();
