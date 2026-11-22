// Кадр для kinohub — скрипт внутри плеера.
// Плеер на странице фильма — чужой iframe (часто с ещё одним внутри). Сам сайт заглянуть в него не может, а расширение
// может: этот скрипт запускается в каждом фрейме, находит там <video> и сообщает странице kinohub время, длину и паузу.
// Так часы таймингов идут по любому плееру, а не только по тем, что сами сообщают время. Заодно он пытается понять,
// какие сезон и серия сейчас включены (адрес фрейма, выбранные пункты в списках плеера, подписи).
//
// Скрипт подключён ко всем сайтам — адреса плееров заранее неизвестны и меняются. Но работает он только во фреймах
// на странице on.kinohub.vip: во всех остальных случаях выходит на первых строках. Наружу уходит только время, длина,
// пауза, скорость, номера сезона и серии и (для «снимка») подписи самого плеера — и только странице on.kinohub.vip.
(function () {
  'use strict';
  if (window === window.top || window.__kadrFrame) return;
  var HOME = /^https?:\/\/on\.kinohub\.vip$/, TOP = 'https://on.kinohub.vip';
  var anc = null, top = '';
  try { anc = location.ancestorOrigins; } catch (e) {} // есть в Chrome; последний — адрес верхней страницы
  if (anc && anc.length) top = anc[anc.length - 1];
  if (anc && HOME.test(top)) start(top);
  else if (anc && top !== 'null') return; // наверху другой сайт — нас здесь нет
  else {
    // Наверху неизвестно что: Firefox этого не говорит, а Chrome прячет адрес («null»), если фрейм встроен с запретом
    // передавать адрес страницы. Тогда ждём «привет» от родителя: его шлёт страница kinohub своему плееру,
    // а включившийся скрипт — вложенным фреймам. Сообщения в любом случае уходят только на адрес kinohub:
    // если наверху другой сайт, браузер их просто не доставит.
    window.addEventListener('message', function hello(e) {
      if (e.source !== window.parent || !e.data || e.data.kadr !== 'hello') return;
      window.removeEventListener('message', hello);
      start(TOP);
    });
  }

  function start(to) {
    if (window.__kadrFrame) return;
    window.__kadrFrame = 1;
    var MIN = 150;            // видео короче — реклама или заставка, а не фильм
    var EVENTS = ['timeupdate', 'play', 'playing', 'pause', 'seeking', 'seeked', 'ratechange', 'durationchange', 'loadedmetadata', 'ended', 'emptied'];
    var cur = null;           // видео, по которому идут часы
    var sentAt = 0, ep = null, epKey = '', epSent = 0, probeKey = '';

    function post(m) { try { window.top.postMessage(m, to); } catch (e) {} }
    function int(v, max) {
      if (v == null) return null;
      var s = String(v).trim();
      if (!/^\d{1,4}$/.test(s)) return null;
      var n = +s;
      return n <= (max || 999) ? n : null;
    }

    /* ---------- видео ---------- */
    // Видео бывает спрятано в shadow DOM. Открытый виден всем; закрытый расширению показывает сам браузер
    // (chrome.dom.openOrClosedShadowRoot в Chrome, openOrClosedShadowRoot в Firefox) — смотрим так только
    // в нестандартные элементы (<x-player>…): закрытые плееры делают на них, а спрашивать про каждый <div> дорого.
    function rootOf(el) {
      if (el.shadowRoot) return el.shadowRoot;
      if (el.localName.indexOf('-') < 0) return null;
      try { if (typeof chrome === 'object' && chrome.dom && chrome.dom.openOrClosedShadowRoot) return chrome.dom.openOrClosedShadowRoot(el) || null; } catch (e) {}
      try { return el.openOrClosedShadowRoot || null; } catch (e) { return null; }
    }
    function deep(node, out, budget) {
      var all = node.querySelectorAll('*'), i;
      for (i = 0; i < all.length && budget.n-- > 0; i++) {
        var sr = rootOf(all[i]);
        if (!sr) continue;
        [].push.apply(out, sr.querySelectorAll('video'));
        deep(sr, out, budget);
      }
    }
    function videos() {
      var list = [].slice.call(document.querySelectorAll('video'));
      if (!list.length) deep(document, list, { n: 3000 });
      return list;
    }
    // Фильм это или реклама: по длине. Пока длина неизвестна (видео ещё грузится), за фильм его не считаем —
    // разве что оно уже играет дольше, чем длится любая реклама.
    function fits(v) {
      var d = v.duration;
      return isFinite(d) && d > 0 ? d >= MIN : v.currentTime > MIN;
    }
    function score(v) {
      var r = v.getBoundingClientRect();
      return (v.paused || v.ended ? 0 : 1000) + (v.readyState >= 2 ? 100 : 0) + Math.min(99, Math.round(r.width * r.height / 20000));
    }
    function pick() {
      var list = videos(), best = null, top = -1, i;
      for (i = 0; i < list.length; i++) {
        if (!fits(list[i])) continue;
        var s = score(list[i]) + (list[i] === cur ? 1 : 0); // при равных — оставить текущее
        if (s > top) { top = s; best = list[i]; }
      }
      if (best === cur) return;
      if (cur) EVENTS.forEach(function (n) { cur.removeEventListener(n, onVideo); });
      cur = best;
      if (cur) EVENTS.forEach(function (n) { cur.addEventListener(n, onVideo); });
    }
    function send(force) {
      if (!cur) return;
      var now = Date.now();
      if (!force && now - sentAt < 240) return;
      sentAt = now;
      post({ kadr: 'video', t: +cur.currentTime || 0, d: isFinite(cur.duration) ? cur.duration : 0, p: !!(cur.paused || cur.ended), r: cur.playbackRate || 1 });
    }
    function onVideo(e) {
      if (e.target !== cur) return;
      if (!fits(cur)) { pick(); return; }
      send(e.type !== 'timeupdate');
    }
    // новое видео на странице (после рекламы, при смене серии): события медиа не всплывают, но ловятся на погружении
    ['play', 'playing', 'loadedmetadata', 'durationchange'].forEach(function (n) {
      document.addEventListener(n, function (e) { if (e.target !== cur && e.target && e.target.localName === 'video') { pick(); if (e.target === cur) send(true); } }, true);
    });

    /* ---------- какая серия ---------- */
    // Сезон и серии из подписи. Число бывает и после слова («Сезон 1 Серии 2, 4-10»), и перед ним («2 сезон 7 серия»),
    // поэтому каждое слово берёт число, стоящее вплотную перед ним, а если такого нет — идущее следом.
    // → {s: '2' | null, e: '7' | '2, 4-10' | null} или null
    function bind(text) {
      text = String(text == null ? '' : text).slice(0, 200);
      var m = /(?:^|[^a-z0-9])s(\d{1,3})\s*[:._\- ]?\s*e(\d{1,4})(?![a-z0-9])/i.exec(text);
      if (m) return { s: String(+m[1]), e: String(+m[2]) };
      var re = /(сезон[а-яё]*|season)|(сери[яйию]|эпизод[а-яё]*|episodes?|выпуск[а-яё]*)/gi, k, keys = [];
      while ((k = re.exec(text))) keys.push({ s: !!k[1], at: k.index, end: k.index + k[0].length });
      var out = { s: null, e: null }, used = 0, i;
      for (i = 0; i < keys.length; i++) {
        var key = keys[i], max = key.s ? 99 : 1999, val = null, mm;
        var before = text.slice(used, key.at), after = text.slice(key.end, i + 1 < keys.length ? keys[i + 1].at : text.length);
        if ((mm = /(\d{1,4})\s*[-–]?\s*(?:й|ый|ой|ий|я|ая|ья)?\s*$/.exec(before)) && +mm[1] <= max) { val = mm[1]; used = key.end; }
        else if ((mm = /^\s*[:#№]?\s*(\d[\d\s,\-–—]*)/.exec(after)) && parseInt(mm[1], 10) <= max) { val = mm[1].replace(/[\s,\-–—]+$/, ''); used = key.end + mm[0].length; }
        else used = key.end;
        if (val == null) continue;
        if (key.s) { if (out.s == null) out.s = String(parseInt(val, 10)); } else if (out.e == null) out.e = val;
      }
      return out.s == null && out.e == null ? null : out;
    }
    function fromText(t) {
      var w = bind(t);
      if (!w) return null;
      var e = w.e != null && /^\d{1,4}$/.test(w.e) ? +w.e : null; // «серии 2, 4-10» — это не то, что играет сейчас
      return w.s == null && e == null ? null : { s: w.s == null ? null : +w.s, e: e };
    }
    // адрес фрейма: ?season=2&episode=5, #s=2&e=5, /season/2/episode/5, /s02e05
    function fromUrl(u) {
      try {
        var x = new URL(u), p = {}, s = null, e = null, m;
        x.searchParams.forEach(function (v, k) { p[k.toLowerCase()] = v; });
        new URLSearchParams(x.hash.replace(/^#[\/!?]*/, '')).forEach(function (v, k) { k = k.toLowerCase(); if (!(k in p)) p[k] = v; });
        ['season', 'sezon', 'season_id', 'season_num'].some(function (k) { return (s = int(p[k], 99)) != null; });
        ['episode', 'seria', 'serie', 'series', 'episode_num', 'ep'].some(function (k) { return (e = int(p[k])) != null; });
        if (s == null && e == null && int(p.s, 99) != null && int(p.e) != null) { s = int(p.s, 99); e = int(p.e); } // короткие имена — только парой
        if (s == null && e == null && (m = /\/season[\/_-]?(\d{1,3})\/(?:episode|seria|e)[\/_-]?(\d{1,4})/i.exec(x.pathname) || /[\/_-]s(\d{1,3})[_-]?e(\d{1,4})(?:[\/._-]|$)/i.exec(x.pathname))) { s = +m[1]; e = +m[2]; }
        return s == null && e == null ? null : { s: s, e: e };
      } catch (err) { return null; }
    }
    // выбранные пункты в списках плеера
    function fromSelects(seen) {
      var s = null, e = null, list = document.querySelectorAll('select'), i;
      for (i = 0; i < list.length && i < 12; i++) {
        var sel = list[i], o = sel.selectedOptions && sel.selectedOptions[0];
        if (!o) continue;
        var text = (o.textContent || '').trim();
        if (seen && seen.length < 6) seen.push(text.slice(0, 30));
        var hint = (sel.name + ' ' + sel.id + ' ' + sel.className + ' ' + (sel.getAttribute('aria-label') || '') + ' ' + (sel.title || '')).toLowerCase();
        var t = fromText(text), n = int(text) != null ? int(text) : /\d/.test(text) ? null : int(o.value);
        if (t && t.s != null && s == null) s = t.s;
        if (t && t.e != null && e == null) e = t.e;
        if (n != null) {
          if (s == null && /season|sezon|сезон/.test(hint)) s = n;
          else if (e == null && /episode|seri|сери|эпизод/.test(hint)) e = n;
        }
      }
      return s == null && e == null ? null : { s: s, e: e };
    }
    // отмеченные («активные») кнопки сезона и серии
    var ACTIVE = /(^|[\s_-])(active|selected|current|checked|is-active|chosen|on)([\s_-]|$)/i;
    function fromActive(seen) {
      var s = null, e = null, i;
      var list = document.querySelectorAll('[class*="eason" i],[class*="ezon" i],[class*="pisode" i],[class*="eria" i],[class*="eries" i],[data-season],[data-episode]');
      for (i = 0; i < list.length && i < 400; i++) {
        var el = list[i], cls = String(el.getAttribute('class') || '');
        var on = ACTIVE.test(cls) || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true' || !!el.getAttribute('aria-current');
        if (!on) continue;
        var text = (el.textContent || '').trim().slice(0, 80);
        if (seen && seen.length < 6) seen.push(text.slice(0, 30));
        var t = fromText(text) || {}, n = int(text), ds = int(el.getAttribute('data-season'), 99), de = int(el.getAttribute('data-episode'));
        var isS = /eason|ezon/i.test(cls), isE = /pisode|eria|eries/i.test(cls);
        if (s == null) s = ds != null ? ds : t.s != null ? t.s : isS && !isE ? n : null;
        if (e == null) e = de != null ? de : t.e != null ? t.e : isE ? n : null;
      }
      return s == null && e == null ? null : { s: s, e: e };
    }
    // Подписи. Надёжнее всего та, где сразу и сезон, и серия («Сезон 2, серия 5», «S02E05») — обычно это название
    // того, что играет. Если такой нет, но на виду ровно один сезон и ровно одна серия (так выглядят «выпадашки»
    // плеера: выбранное значение показано, список скрыт) — берём их. Раскрытый список серий так не прочитать:
    // на виду сразу много номеров, тогда ничего не меняем.
    function fromLabels(seen) {
      var list = document.querySelectorAll('body *'), i, hit = null, ss = {}, es = {};
      for (i = 0; i < list.length && i < 2500; i++) {
        var el = list[i];
        if (el.childElementCount || el.localName === 'script' || el.localName === 'style' || el.localName === 'option') continue;
        var text = (el.textContent || '').trim();
        if (text.length < 3 || text.length > 80) continue;
        var t = fromText(text);
        if (!t || !el.getClientRects().length) continue;
        if (seen && seen.length < 8) seen.push(text.slice(0, 60));
        if (t.s != null && t.e != null) { if (!hit) hit = t; } else if (t.s != null) ss[t.s] = 1; else es[t.e] = 1;
      }
      if (hit) return hit;
      var sk = Object.keys(ss), ek = Object.keys(es);
      if (ek.length === 1 && sk.length <= 1) return { s: sk.length ? +sk[0] : null, e: +ek[0] };
      return null;
    }
    function fromMedia() {
      try {
        var m = navigator.mediaSession && navigator.mediaSession.metadata;
        return m ? fromText([m.title, m.artist, m.album].join(' ')) : null;
      } catch (e) { return null; }
    }
    // → {s, e, c: насколько это надёжно, via} или null
    var labelsAt = 0, labels = null;
    function episode(dbg) {
      var found = [], x;
      if ((x = fromUrl(location.href))) found.push([5, 'url', x]);
      if ((x = fromSelects(dbg && dbg.sel))) found.push([4, 'select', x]);
      if ((x = fromActive(dbg && dbg.act))) found.push([4, 'active', x]);
      if ((x = fromMedia())) found.push([3, 'media', x]);
      // по всем подписям ходим редко и только там, где есть видео: это самая дорогая проверка
      if (cur && (dbg || Date.now() - labelsAt > 5000)) { labelsAt = Date.now(); labels = fromLabels(dbg && dbg.txt); }
      if (cur && labels) found.push([2, 'label', labels]);
      if ((x = fromText(document.title)) && x.e != null) found.push([2, 'title', x]);
      if (cur && (x = fromUrl(cur.currentSrc || cur.src || '')) && x.e != null) found.push([1, 'src', x]);
      var best = null, i;
      for (i = 0; i < found.length; i++) if (found[i][2].e != null && (!best || found[i][0] > best[0])) best = found[i];
      if (!best) return null;
      var s = best[2].s;
      for (i = 0; s == null && i < found.length; i++) s = found[i][2].s; // серия нашлась без сезона — сезон берём у другого признака
      return { s: s == null ? null : s, e: best[2].e, c: best[0], via: best[1] };
    }
    // Что плеер показывает — для «снимка», чтобы было видно, откуда брать серию, если она не определилась.
    function probe() {
      var d = { sel: [], act: [], txt: [] }, found = episode(d), q = [];
      try { new URL(location.href).searchParams.forEach(function (v, k) { q.push(k); }); } catch (e) {}
      var m = { kadr: 'probe', host: location.host, path: location.pathname.replace(/\d{3,}/g, 'N').slice(0, 60), q: q.slice(0, 12), vids: videos().length,
        ep: found, sel: d.sel, act: d.act, txt: d.txt, title: (document.title || '').slice(0, 60) };
      var key = JSON.stringify(m);
      if (key === probeKey) return;
      probeKey = key;
      post(m);
    }

    /* ---------- раз в секунду ---------- */
    function relay() { // «привет» вложенным фреймам (нужно там, где фрейм не знает, что за страница наверху)
      var fr = document.querySelectorAll('iframe'), i;
      for (i = 0; i < fr.length && i < 20; i++) try { fr[i].contentWindow.postMessage({ kadr: 'hello' }, '*'); } catch (e) {}
    }
    var ticks = 0;
    setInterval(function () {
      ticks++;
      pick();
      send(false);
      if (ticks % 2 === 0) {
        var now = Date.now();
        ep = episode();
        var key = ep ? ep.s + ':' + ep.e + ':' + ep.c : '';
        if (key !== epKey || (ep && now - epSent > 5000)) {
          epKey = key; epSent = now;
          post({ kadr: 'ep', s: ep ? ep.s : null, e: ep ? ep.e : null, c: ep ? ep.c : 0, via: ep ? ep.via : '' });
        }
        relay();
      }
      if (ticks % 5 === 0 && (cur || document.querySelector('select'))) probe();
    }, 1000);
    pick();
    relay();
  }
})();
