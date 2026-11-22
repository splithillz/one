// Кадр для kinohub — тайминги прямо у плеера.
// На сайте тайминги (отметки «с такой-то по такую-то минуту — такая-то сцена») лежат во вкладке под описанием
// или открываются отдельным окном: во время просмотра их не видно. Здесь они показаны под плеером,
// по сериям, а часы рядом показывают, что идёт сейчас и сколько осталось до следующей сцены;
// перед сценой поверх плеера появляется предупреждение.
// ЧАСЫ. Плеер — чужой iframe. Время в нём читает скрипт расширения, который работает внутри самого плеера
// (frame.js): он находит там видео и сообщает сюда время, паузу и длину — так часы идут по любому плееру.
// Если такого сообщения нет (скрипт туда не попал), но плеер сам сообщает время странице — часы идут по нему.
// Если нет ни того ни другого — их запускают вручную кнопкой ▶ вместе с плеером.
// СЕРИЯ. Тот же скрипт (и сообщения самих плееров) говорит, какие сезон и серия сейчас играют; панель сама
// открывает отметки для этой серии. Выбор руками держится, пока в плеере не включат другую серию.
(function () {
  'use strict';
  var X = window.KADRX;
  if (!X || X.timings) return;
  var h = X.h, store = X.store;
  var LEAD = 5;            // за сколько секунд до сцены предупреждать
  var POINT = 3;           // сколько секунд «длится» отметка из одного времени

  var on = true, ready = false, fold = false;
  var movie = 0;           // id фильма, для которого всё построено
  var entries = null;      // разобранные тайминги: [{user, meta, groups: [{label, short, dur, clean, rows: [{a, b, text}], notes}]}]
  var sel = { e: 0, g: 0 };
  var keep = null;         // {m, e, g} — выбор для последнего фильма (из storage)
  var panel = null, pill = null, ticker = 0, ui = null, frameSrc = '';
  // часы: t — позиция в секундах на момент at; run — идут; auto — по плееру; rate — скорость воспроизведения
  var clk = { t: 0, at: 0, run: false, auto: false, last: 0, dur: 0, rate: 1 };
  var probe = { v: 0, at: 0, good: 0, scale: 1, locked: false };
  var vid = { win: null, at: 0, d: 0 };                       // фрейм плеера, откуда frame.js сообщает о видео
  var epi = { s: null, e: null, c: 0, at: 0, via: '' };       // серия, которая сейчас играет (если удалось узнать)
  var manual = false;                                         // серию выбрали руками — держим, пока в плеере не сменится
  var warned = {};
  var tries = 0;           // неудачные попытки загрузить тайминги

  /* ===================== разбор ===================== */
  var T = '(\\d{1,3}:\\d{2}(?::\\d{2})?)';
  var RANGE = new RegExp('^\\s*' + T + '\\s*(?:[-–—]+|до|\\.{2,3})\\s*' + T + '\\s*(?:[-–—>:.,]+\\s*)?(.*)$', 'i');
  var ONE = new RegExp('^\\s*' + T + '\\s*(?:[-–—>:.,]+\\s*)?(.*)$');
  var HEAD = /^\s*#+\s*(.+?)\s*$/;
  var BRACKET = new RegExp('\\[\\s*' + T + '\\s*\\]');
  // «2, 4-10» → [[2, 2], [4, 10]]
  function spans(text) {
    var out = [];
    String(text).split(/[,;]+/).forEach(function (part) {
      var m = /(\d{1,4})\s*[-–—]\s*(\d{1,4})/.exec(part) || /(\d{1,4})/.exec(part);
      if (!m) return;
      var a = +m[1], b = m[2] != null ? +m[2] : a;
      out.push(a <= b ? [a, b] : [b, a]);
    });
    return out.length ? out : null;
  }
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
  // season — номер сезона, eps — серии, к которым относится группа (null — не указано)
  function newGroup(label) {
    var g = { label: '', short: '', dur: 0, clean: false, rows: [], notes: [], season: null, eps: null };
    var m = BRACKET.exec(label || '');
    if (m) { g.dur = X.seconds(m[1]) || 0; label = label.replace(m[0], ''); }
    g.label = (label || '').replace(/\s+/g, ' ').trim();
    var w = bind(g.label);
    if (w) {
      g.season = w.s == null ? null : +w.s;
      g.eps = w.e == null ? null : spans(w.e);
      g.short = (w.s != null ? 'С' + w.s : '') + (w.s != null && w.e != null ? ' · ' : '') + (w.e != null ? 'Е' + w.e.replace(/\s*[–—-]\s*/g, '–').replace(/\s*,\s*/g, ', ').trim() : '');
    } else g.short = g.label.length > 26 ? g.label.slice(0, 25) + '…' : g.label;
    return g;
  }
  function addRow(g, a, b, text) {
    a = X.seconds(a); b = b == null ? NaN : X.seconds(b);
    if (!(a >= 0)) return false;
    if (!(b >= a)) b = a;
    g.rows.push({ a: a, b: b, text: String(text || '').trim() });
    return true;
  }
  function parseEntry(t) {
    var groups = [], g = null, i;
    function open(label) { g = newGroup(label); groups.push(g); return g; }
    if (Array.isArray(t.ranges) && t.ranges.length) {
      open((t.season ? 'Сезон ' + t.season + ' ' : '') + (t.episode ? 'Серия ' + t.episode : ''));
      g.dur = X.seconds(t.duration) || 0;
      for (i = 0; i < t.ranges.length; i++) { var r = t.ranges[i] || {}; addRow(g, r.start, r.end, r.comment); }
      g = null;
    }
    var lines = typeof t.comment === 'string' ? t.comment.split('\n') : [];
    for (i = 0; i < lines.length; i++) {
      var line = lines[i].trim(), m;
      if (!line) continue;
      if ((m = HEAD.exec(line))) { open(m[1]); continue; }
      if (!g) open('');
      if ((m = RANGE.exec(line)) && addRow(g, m[1], m[2], m[3])) continue;
      if ((m = ONE.exec(line)) && addRow(g, m[1], null, m[2])) continue;
      if (/^чисто[.!]?$/i.test(line)) { g.clean = true; continue; }
      g.notes.push(line);
    }
    groups = groups.filter(function (x) { return x.rows.length || x.clean || x.notes.length; });
    groups.forEach(function (x) { x.rows.sort(function (p, q) { return p.a - q.a; }); });
    return {
      user: String(t.username || ''), groups: groups,
      meta: [t.player, t.translation].filter(function (v) { return typeof v === 'string' && v; })
    };
  }
  function parse(list) {
    return (Array.isArray(list) ? list : []).map(function (t) { return t && typeof t === 'object' ? parseEntry(t) : null; })
      .filter(function (e) { return e && e.groups.length; });
  }
  X.timings = { parse: parse }; // для проверки

  /* ===================== часы ===================== */
  function now() { return clk.run ? clk.t + (performance.now() - clk.at) / 1000 * (clk.rate || 1) : clk.t; }
  function setClock(t, run) {
    clk.t = Math.max(0, t);
    clk.at = performance.now();
    if (run != null) clk.run = run;
  }
  // Другой плеер (или другой фильм): всё, что узнали о времени и серии, — заново.
  function resetProbe() {
    probe = { v: 0, at: 0, good: 0, scale: 1, locked: false };
    vid = { win: null, at: 0, d: 0 };
    epi = { s: null, e: null, c: 0, at: 0, via: '' };
    manual = false;
    clk.rate = 1;
    delete X.info.episode;
    if (clk.auto) { clk.auto = false; clk.run = false; }
  }

  // Время из сообщения плеера. Форматы у плееров разные, поэтому ищем по смыслу: число в поле с «временным»
  // именем, а часами признаём его только после проверки — оно должно идти примерно со скоростью секунды в секунду.
  var TKEYS = ['currentTime', 'current_time', 'time', 'position', 'currentPosition', 'seconds', 'playedSeconds', 'sec'];
  var DKEYS = ['duration', 'total', 'length'];
  var INNER = ['data', 'value', 'payload', 'detail', 'info', 'message'];
  function num(v) {
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? v : null;
    return typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? parseFloat(v) : null;
  }
  function timeIn(d, depth) {
    var i, v, r;
    for (i = 0; i < TKEYS.length; i++) if ((v = num(d[TKEYS[i]])) != null) {
      r = { t: v, d: null };
      for (i = 0; i < DKEYS.length; i++) if ((v = num(d[DKEYS[i]])) != null) { r.d = v; break; }
      return r;
    }
    var name = String(d.event || d.type || d.key || d.name || d.action || d.method || '');
    if (/time|position/i.test(name)) for (i = 0; i < INNER.length; i++) if ((v = num(d[INNER[i]])) != null) return { t: v, d: null };
    if (depth < 2) for (i = 0; i < INNER.length; i++) {
      v = d[INNER[i]];
      if (typeof v === 'string' && v.charAt(0) === '{') { try { v = JSON.parse(v); } catch (e) { v = null; } }
      if (v && typeof v === 'object' && !Array.isArray(v) && (r = timeIn(v, depth + 1))) return r;
    }
    return null;
  }
  // Для «снимка»: какие сообщения шлёт плеер. Имена полей, числа и короткие служебные слова — как есть,
  // любые другие строки — только длина (в них могут быть адреса и ключи плеера).
  var seen = {};
  function brief(v, depth) {
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'string') return /^[A-Za-z_.:\-]{1,32}$/.test(v) ? v : 'string(' + v.length + ')';
    if (Array.isArray(v)) return v.length ? ['x' + v.length, depth > 3 ? '...' : brief(v[0], depth + 1)] : [];
    if (typeof v !== 'object') return typeof v;
    if (depth > 3) return '{...}';
    var o = {};
    Object.keys(v).slice(0, 30).forEach(function (k) { o[k] = brief(v[k], depth + 1); });
    return o;
  }
  function sample(origin, d, raw) {
    var key = origin + '|' + Object.keys(d).sort().join(',') + '|' + String(d.event || d.type || d.key || d.name || d.action || '');
    if (seen[key] || X.msgs.length >= 40) return;
    seen[key] = 1;
    X.msgs.push({ origin: origin, json: raw, data: brief(d, 0) });
  }
  // Сообщение не в JSON: для «снимка» — только буквенное начало (название формата) и длина.
  function other(origin, text) {
    var head = (/^[A-Za-z_.:\-]{1,24}/.exec(text) || [''])[0], key = origin + '|str|' + head;
    if (seen[key] || X.msgs.length >= 40) return;
    seen[key] = 1;
    X.msgs.push({ origin: origin, text: head + '…string(' + text.length + ')' });
  }
  /* ----- какая серия играет ----- */
  function small(v, max) {
    if (typeof v === 'number') return v >= 0 && v <= max && v === Math.floor(v) ? v : null;
    return typeof v === 'string' && /^\d{1,4}$/.test(v.trim()) && +v <= max ? +v : null;
  }
  // Сезон и серия из сообщения плеера: поля с такими именами (season, episodeNumber, episode: {number: 3}…)
  // или подпись вида «2 сезон 5 серия». Номера-идентификаторы (episodeId) и списки серий не берём.
  function epIn(d, depth, out) {
    out = out || { s: null, e: null };
    Object.keys(d).slice(0, 40).forEach(function (k) {
      var v = d[k], key = k.toLowerCase();
      if (v == null || Array.isArray(v) || /id$|ids$|count|total|length|duration|time|seasons$|episodes$/.test(key)) return;
      var isS = /season|sezon/.test(key), isE = /episode|seria|serie/.test(key), n = null, m;
      if (isS || isE) {
        n = small(v, isS ? 99 : 1999);
        if (n == null && typeof v === 'object') {
          ['number', 'num', 'index', 'position', 'order', 'value'].some(function (f) { return (n = small(v[f], isS ? 99 : 1999)) != null; });
        }
        if (n != null) { if (isS && out.s == null) out.s = n; else if (isE && out.e == null) out.e = n; }
      }
      if (typeof v === 'string' && v.length < 200 && (isS || isE || /title|name|label|caption/.test(key))) {
        if ((m = bind(v))) {
          if (out.s == null && m.s != null) out.s = +m.s;
          if (out.e == null && m.e != null && /^\d+$/.test(m.e)) out.e = +m.e;
        }
      } else if (typeof v === 'object' && depth < 3) epIn(v, depth + 1, out);
    });
    return out.e == null ? null : out;
  }
  function covers(g, s, e) {
    if (!g.eps && g.season == null) return false;
    if (g.season != null && s != null && g.season !== s) return false;
    if (g.eps) return g.eps.some(function (r) { return e >= r[0] && e <= r[1]; });
    return s != null; // «Сезон 2» без номеров серий — весь сезон
  }
  // Открыть отметки для серии, которая играет: сначала у выбранного автора, потом у остальных.
  function follow() {
    if (manual || epi.e == null || !entries || !entries.length) return;
    var order = [sel.e], i, j, hit = null, spare = null, seasons = {}, bound = false;
    for (i = 0; i < entries.length; i++) if (i !== sel.e) order.push(i);
    for (i = 0; i < order.length && !hit; i++) {
      var gs = entries[order[i]].groups;
      for (j = 0; j < gs.length; j++) {
        if (gs[j].eps || gs[j].season != null) bound = true;
        if (!covers(gs[j], epi.s, epi.e)) continue;
        if (gs[j].season != null) seasons[gs[j].season] = 1;
        if (gs[j].rows.length) { hit = { e: order[i], g: j }; break; }
        if (!spare) spare = { e: order[i], g: j };
      }
    }
    if (!bound) return;                                                // отметки не привязаны к сериям (фильм) — выбирать нечего
    if (epi.s == null && Object.keys(seasons).length > 1) return;      // сезон неизвестен, а серия с таким номером есть в нескольких — не гадаем
    var next = hit || spare || { e: sel.e, g: -1 };                    // -1: для этой серии отметок нет
    if (next.e === sel.e && next.g === sel.g) return;
    sel = next;
    warned = {};
    paint();
  }
  // c — насколько признак надёжен (адрес фрейма и сообщение плеера — 5, выбранный пункт списка — 4, подпись — 2…)
  function setEpisode(s, e, c, via) {
    var t = performance.now();
    s = s == null ? null : +s; e = +e;
    if (!(e >= 0 && e < 2000) || (s != null && !(s >= 0 && s < 200))) return;
    var same = epi.e === e && epi.s === s;
    if (!same && c < epi.c && t - epi.at < 12000) return;            // слабый признак не перебивает свежий сильный
    epi = { s: s, e: e, c: same ? Math.max(c, epi.c) : c, at: t, via: same && c < epi.c ? epi.via : via };
    X.info.episode = (s == null ? '?' : s) + ':' + e + ' ' + epi.via;
    if (same) return;
    manual = false;
    follow();
    paint();
  }
  // Сообщения от frame.js — скрипта расширения внутри плеера.
  function fromFrame(e, d) {
    var t = performance.now();
    if (d.kadr === 'probe') {
      var key = String(d.host).slice(0, 60) + String(d.path).slice(0, 60);
      if (X.frames[key] || Object.keys(X.frames).length < 12) X.frames[key] = d;
      return;
    }
    if (d.kadr === 'ep') { if (d.e != null) setEpisode(d.s, d.e, +d.c || 1, String(d.via || 'player').slice(0, 12)); return; }
    if (d.kadr !== 'video' || !(d.t >= 0)) return;
    // О видео могут сообщать несколько фреймов (в одном реклама, в другом фильм). Держимся одного, пока он не замолчит,
    // и уступаем тому, где идёт видео заметно длиннее.
    if (vid.win && vid.win !== e.source && t - vid.at < 3000 && !(!d.p && d.d > vid.d + 60)) return;
    var fresh = !vid.win;
    vid.win = e.source; vid.at = t; vid.d = +d.d || 0;
    if (fresh) clk.auto = true;
    var grew = d.d > 0 && Math.abs(d.d - clk.dur) > 1;
    if (grew) clk.dur = +d.d;
    if (clk.auto) { clk.last = t; clk.rate = +d.r > 0 ? +d.r : 1; setClock(+d.t, !d.p); }
    if (fresh || grew) paint(); else if (clk.auto) tick();
  }
  window.addEventListener('message', function (e) {
    if (!on || e.source === window || e.origin === location.origin || !document.querySelector('.player_iframe')) return;
    var d = e.data, raw = false;
    if (d && typeof d === 'object' && typeof d.kadr === 'string') { fromFrame(e, d); return; }
    if (typeof d === 'string') {
      if (d.charAt(0) !== '{') { other(e.origin, d); return; }
      try { d = JSON.parse(d); raw = true; } catch (x) { other(e.origin, d); return; }
    }
    if (!d || typeof d !== 'object' || Array.isArray(d)) return;
    sample(e.origin, d, raw);
    var where = epIn(d, 0);
    if (where) setEpisode(where.s, where.e, 5, 'message');
    var r = timeIn(d, 0);
    if (!r) return;
    var t = performance.now();
    if (vid.win && t - vid.at < 3000) return; // время уже идёт от видео в плеере — оно точнее и знает про паузу
    // Скорость считаем на отрезках от 0,9 с: плееры шлют время и по четыре раза в секунду, и целыми секундами —
    // между соседними сообщениями оно то стоит, то прыгает.
    if (!probe.at) { probe.v = r.t; probe.at = t; }
    else if (t - probe.at >= 900) {
      var rate = (r.t - probe.v) / ((t - probe.at) / 1000);
      var unit = rate > 0.4 && rate < 3.2 ? 1 : rate > 400 && rate < 3200 ? 0.001 : 0;  // секунды или миллисекунды
      // и это должно быть место в фильме, а не время суток (отметки времени тоже идут «секунда в секунду»)
      if (unit && r.t * unit < 86400) { probe.good++; probe.scale = unit; }
      else if (rate !== 0 && !probe.locked) probe.good = 0;                          // стоит на месте — пауза, не повод сбрасывать
      probe.v = r.t; probe.at = t;
    }
    var fresh = !probe.locked && probe.good >= 2;
    if (fresh) { probe.locked = true; clk.auto = true; }
    if (!probe.locked) return;
    var dur = r.d ? r.d * probe.scale : 0, grew = dur > 0 && Math.abs(dur - clk.dur) > 1;
    if (grew) clk.dur = dur;
    if (clk.auto) { clk.last = t; setClock(r.t * probe.scale, true); }
    if (fresh || grew) paint(); else if (clk.auto) tick();
  });

  /* ===================== панель ===================== */
  function entry() { return entries && entries[sel.e] || null; }
  function group() { var e = entry(); return e && e.groups[sel.g] || null; }
  function duration() {
    var g = group(), m;
    if (clk.dur > 0) return clk.dur;
    if (g && g.dur) return g.dur;
    m = X.movie(movie);
    return m && m.type !== 'Series' && X.seconds(m.duration) || 0;
  }
  function choose(e, g) {
    sel = { e: e, g: g };
    manual = true; // держим этот выбор, пока в плеере не включат другую серию
    warned = {};
    keep = { m: movie, e: e, g: g };
    store.set({ tmSel: keep });
    paint();
  }
  function btn(icon, title, fn, cls) {
    return h('button', { type: 'button', class: 'tm-b' + (cls ? ' ' + cls : ''), title: title, 'aria-label': title, onclick: fn }, typeof icon === 'string' ? X.icon(icon) : icon);
  }
  function editTime() {
    if (!ui || clk.auto) return;
    var input = h('input', { class: 'tm-in', type: 'text', inputmode: 'numeric', value: X.clock(now()), 'aria-label': 'Время в плеере' });
    var closed = false;
    function done(save) {
      // один раз: перерисовка убирает поле, поле при этом теряет фокус и позвало бы done() ещё раз — уже изнутри перерисовки
      if (closed) return;
      closed = true;
      var v = input.value.trim(), s = /^\d+$/.test(v) ? +v * 60 : X.seconds(v);
      if (save && s >= 0) setClock(s);
      paint();
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') { e.stopPropagation(); done(false); } });
    input.addEventListener('blur', function () { done(true); });
    ui.time.replaceWith(input);
    input.focus();
    input.select();
  }
  var painting = false, shown = '';
  function paint() {
    if (!panel || painting) return;
    painting = true;
    // ряды кнопок перерисовываются целиком: прокрутку, которую человек сделал сам, сохраняем,
    // а если выбор сменился — показываем выбранную кнопку
    var keep = [].map.call(panel.querySelectorAll('.tm-chips'), function (r) { return r.scrollLeft; });
    try { draw(); } finally { painting = false; }
    var key = sel.e + ':' + sel.g, rows = panel.querySelectorAll('.tm-chips');
    [].forEach.call(rows, function (row, i) {
      var on = row.querySelector('.tm-chip.on');
      if (key !== shown && on) row.scrollLeft = Math.max(0, on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
      else if (keep[i] != null) row.scrollLeft = keep[i];
    });
    shown = key;
    tick();
  }
  function draw() {
    var e = entry(), g = group(), kids = [], dur = duration();
    var avail = !!vid.win || probe.locked; // время от плеера есть (видео в нём или его собственные сообщения)
    X.info.clock = clk.auto ? (vid.win ? 'video' : 'player') : avail ? 'manual (player available)' : 'manual';
    panel.setAttribute('data-clock', X.info.clock); // откуда идут часы: видео в плеере / сообщения плеера / вручную
    ui = { time: null, play: null, cur: null, line: null, rows: [], dur: dur };
    var count = e ? e.groups.reduce(function (n, x) { return n + x.rows.length; }, 0) : 0;
    var mode = h('button', {
      type: 'button', class: 'tm-mode' + (clk.auto ? ' auto' : ''), disabled: !avail,
      title: avail ? (clk.auto ? 'Часы идут по плееру. Нажми, чтобы вести вручную' : 'Вернуть время плеера') : 'Время из плеера получить не удалось — часы ведутся вручную',
      onclick: function () { clk.auto = !clk.auto; clk.rate = 1; if (!clk.auto) setClock(now(), false); paint(); }
    }, h('i'), h('span', { text: clk.auto ? 'по плееру' : 'вручную' }));
    var epName = epi.e == null ? '' : (epi.s != null ? 'С' + epi.s + ' · ' : '') + 'Е' + epi.e;
    kids.push(h('div', { class: 'tm-head' },
      h('button', { type: 'button', class: 'tm-fold', 'aria-expanded': String(!fold), title: fold ? 'Развернуть' : 'Свернуть', onclick: function () { fold = !fold; store.set({ tmFold: fold }); paint(); } },
        X.icon('clock'), h('b', { text: 'Тайминги' }), h('em', { text: String(count) }), X.icon('down', 'tm-chev')),
      epName ? h('span', { class: 'tm-ep', title: 'Серия, которая сейчас играет в плеере', text: epName }) : null,
      mode));
    panel.classList.toggle('fold', fold);
    if (!fold) {
      ui.time = h('button', { type: 'button', class: 'tm-time', title: clk.auto ? 'Время плеера' : 'Нажми, чтобы ввести время плеера', disabled: clk.auto, onclick: editTime, text: X.clock(now()) });
      ui.play = btn(clk.run ? 'pause' : 'play', clk.run ? 'Пауза' : 'Пуск — вместе с плеером', function () { setClock(now(), !clk.run); paint(); }, 'tm-play');
      kids.push(h('div', { class: 'tm-clock' + (clk.auto ? ' auto' : '') },
        clk.auto ? null : btn(h('span', { text: '−10' }), 'Назад на 10 секунд', function () { setClock(now() - 10); tick(); }),
        clk.auto ? null : ui.play,
        ui.time,
        dur ? h('span', { class: 'tm-dur', text: '/ ' + X.clock(dur) }) : null,
        clk.auto ? null : btn(h('span', { text: '+10' }), 'Вперёд на 10 секунд', function () { setClock(now() + 10); tick(); })));
      if (entries.length > 1) {
        kids.push(h('div', { class: 'tm-chips' }, entries.map(function (x, i) {
          return h('button', { type: 'button', class: 'tm-chip' + (i === sel.e ? ' on' : ''), 'aria-pressed': String(i === sel.e), title: x.meta.join(' · '), onclick: function () { choose(i, firstGroup(x)); } },
            X.icon('user'), h('span', { text: x.user || 'без имени' }));
        })));
      } else if (e && (e.user || e.meta.length)) kids.push(h('p', { class: 'tm-by', text: [e.user].concat(e.meta).filter(Boolean).join(' · ') }));
      if (e && e.groups.length > 1) {
        kids.push(h('div', { class: 'tm-chips tm-eps' }, e.groups.map(function (x, i) {
          return h('button', { type: 'button', class: 'tm-chip' + (i === sel.g ? ' on' : '') + (x.clean ? ' clean' : ''), 'aria-pressed': String(i === sel.g), title: x.label, onclick: function () { choose(sel.e, i); } },
            h('span', { text: x.short || 'Общее' }), x.clean && !x.rows.length ? X.icon('check') : x.rows.length ? h('i', { text: String(x.rows.length) }) : null);
        })));
      }
      if (g) {
        if (dur && g.rows.length) {
          ui.line = h('div', { class: 'tm-line', role: 'slider', 'aria-label': 'Положение в фильме', 'aria-valuemin': '0', 'aria-valuemax': String(Math.round(dur)) },
            g.rows.map(function (r) {
              return h('i', { style: 'left:' + Math.min(100, r.a / dur * 100).toFixed(3) + '%;width:' + Math.max(0, Math.min(100, (r.b - r.a) / dur * 100)).toFixed(3) + '%' });
            }), ui.cur = h('b'));
          scrub(ui.line);
          kids.push(ui.line);
        }
        if (g.rows.length) {
          kids.push(h('ol', { class: 'tm-list' }, g.rows.map(function (r, i) {
            var eta = h('em');
            var li = h('li', { class: 'tm-row' },
              h('span', { class: 'tm-at', text: X.clock(r.a) + (r.b > r.a ? ' – ' + X.clock(r.b) : '') }),
              h('span', { class: 'tm-tx', text: r.text || 'без описания' }), eta);
            ui.rows.push({ el: li, eta: eta, a: r.a, b: r.b > r.a ? r.b : r.a + POINT, text: r.text, i: i });
            return li;
          })));
        }
        if (g.clean && !g.rows.length) kids.push(h('p', { class: 'tm-clean' }, X.icon('check'), h('span', { text: 'Чисто — отмеченных сцен нет' })));
        g.notes.forEach(function (n) { kids.push(h('p', { class: 'tm-note', text: n })); });
      } else if (sel.g < 0 && epName) {
        kids.push(h('p', { class: 'tm-none', text: 'Для серии ' + epName + ' отметок нет' }));
      }
    }
    panel.replaceChildren.apply(panel, kids);
  }
  // Полоса: в ручном режиме по ней можно выставить время (как перемотка).
  function scrub(line) {
    var drag = false;
    function at(e) {
      var r = line.getBoundingClientRect();
      setClock(Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))) * ui.dur);
      tick();
    }
    line.addEventListener('pointerdown', function (e) { if (clk.auto) return; drag = true; try { line.setPointerCapture(e.pointerId); } catch (x) {} at(e); });
    line.addEventListener('pointermove', function (e) { if (drag) at(e); });
    ['pointerup', 'pointercancel'].forEach(function (n) { line.addEventListener(n, function () { drag = false; }); });
  }
  function firstGroup(e) {
    for (var i = 0; i < e.groups.length; i++) if (e.groups[i].rows.length) return i;
    return 0;
  }
  // Раз в полсекунды: время, полоса, строки, предупреждение поверх плеера.
  var beats = 0;
  function tick() {
    if (!panel || !ui) return;
    // «Привет» скрипту расширения внутри плеера: там, где фрейм не знает, что за страница наверху (Firefox),
    // он включается только после этого.
    if (beats++ % 4 === 0) {
      var fr = document.querySelector('.player_iframe_wrapper iframe');
      try { if (fr && fr.contentWindow) fr.contentWindow.postMessage({ kadr: 'hello' }, '*'); } catch (e) {}
    }
    // плеер замолчал — значит, пауза
    if (clk.auto && clk.run && performance.now() - clk.last > 2500) setClock(now(), false);
    var t = now(), i, hot = null, next = null;
    if (ui.dur && t > ui.dur && !clk.auto) setClock(t = ui.dur, false);
    if (ui.time && ui.time.isConnected) {
      var txt = X.clock(t);
      if (ui.time.textContent !== txt) ui.time.textContent = txt;
    }
    if (ui.play && !clk.auto && ui.play.classList.contains('run') !== clk.run) {
      ui.play.classList.toggle('run', clk.run);
      ui.play.replaceChildren(X.icon(clk.run ? 'pause' : 'play'));
      ui.play.title = clk.run ? 'Пауза' : 'Пуск — вместе с плеером';
    }
    if (ui.cur) ui.cur.style.left = Math.min(100, t / ui.dur * 100).toFixed(2) + '%';
    if (ui.line) ui.line.setAttribute('aria-valuenow', String(Math.round(t)));
    for (i = 0; i < ui.rows.length; i++) {
      var r = ui.rows[i], st = t > r.b ? 'past' : t >= r.a ? 'now' : t >= r.a - LEAD ? 'soon' : '';
      if (st === 'now' || st === 'soon') { if (!hot) hot = r; } else if (!st && !next) next = r;
      if (r.el.getAttribute('data-st') !== st) r.el.setAttribute('data-st', st);
      var eta = st === 'now' ? 'сейчас' : st === 'soon' ? 'через ' + Math.max(1, Math.ceil(r.a - t)) + ' с' : !st && r === next ? 'через ' + X.clock(r.a - t) : '';
      if (r.eta.textContent !== eta) r.eta.textContent = eta;
      if (st !== 'now' && st !== 'soon') delete warned[r.i];
    }
    // предупреждение поверх плеера — только когда часы идут
    var show = !!(hot && (clk.run || clk.auto)), inside = false, head = '';
    if (show) {
      inside = t >= hot.a;
      head = inside ? 'сейчас · ещё ' + Math.max(1, Math.ceil(hot.b - t)) + ' с' : 'через ' + Math.max(1, Math.ceil(hot.a - t)) + ' с';
      if (!warned[hot.i]) {
        warned[hot.i] = 1;
        try { if (navigator.vibrate) navigator.vibrate([90, 70, 90]); } catch (e) {}
      }
    }
    if (pill) {
      if (show) fill(pill, head, hot, inside);
      if (pill.hidden === show) pill.hidden = !show;
    }
    fullscreen(show, head, hot, inside);
  }
  function fill(el, head, hot, inside) {
    if (el._k !== head + hot.i) {
      el._k = head + hot.i;
      el.replaceChildren(X.icon('alert'), h('b', { text: head }), hot.text ? h('span', { text: hot.text }) : null);
    }
    el.setAttribute('data-st', inside ? 'now' : 'soon');
  }
  // Плеер развернули на весь экран. Тогда виден только он: предупреждение рядом с ним на странице скрыто.
  // Но всплывающий слой браузера (popover), открытый ПОСЛЕ разворота, рисуется поверх развёрнутого плеера —
  // туда и выводим. Поэтому при каждой смене полноэкранного режима слой закрывается и открывается заново.
  var fsPill = null;
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fsOpen() { try { return !!fsPill && fsPill.matches(':popover-open'); } catch (e) { return false; } }
  function fullscreen(show, head, hot, inside) {
    var can = show && !!fsElement() && typeof HTMLElement.prototype.showPopover === 'function';
    if (!can) { if (fsOpen()) try { fsPill.hidePopover(); } catch (e) {} return; }
    if (!fsPill) fsPill = h('div', { class: 'kadr-tm-pill kadr-tm-fs', popover: 'manual', 'data-kadr-ui': true, role: 'status' });
    if (fsPill.parentNode !== document.body) document.body.appendChild(fsPill);
    fill(fsPill, head, hot, inside);
    if (!fsOpen()) try { fsPill.showPopover(); } catch (e) {}
  }
  function onFullscreen() {
    if (fsOpen()) try { fsPill.hidePopover(); } catch (e) {}
    if (fsPill) fsPill._k = '';
    tick(); // откроет слой заново — уже поверх нового полноэкранного элемента
  }
  document.addEventListener('fullscreenchange', onFullscreen);
  document.addEventListener('webkitfullscreenchange', onFullscreen);

  /* ===================== включение ===================== */
  function teardown() {
    if (panel) panel.remove();
    if (pill) pill.remove();
    if (fsPill) { if (fsOpen()) try { fsPill.hidePopover(); } catch (e) {} fsPill.remove(); fsPill = null; }
    clearInterval(ticker);
    panel = pill = ui = null; ticker = 0; movie = 0; entries = null; frameSrc = ''; tries = 0;
    delete X.info.timings; delete X.info.clock;
    clk = { t: 0, at: 0, run: false, auto: false, last: 0, dur: 0, rate: 1 };
    resetProbe();
    warned = {};
  }
  function load(id) {
    X.pub('/timings?kinopoiskId=' + id).then(function (list) {
      if (movie !== id) return;
      if (list == null) {
        // сайт не ответил — пробуем ещё дважды
        X.info.timings = 'fail×' + (++tries);
        if (tries < 3) setTimeout(function () { if (movie === id && !entries) load(id); }, tries === 1 ? 4000 : 15000);
        return;
      }
      entries = parse(list);
      X.info.timings = entries.length;
      sel = { e: 0, g: 0 };
      if (entries.length) {
        if (keep && keep.m === id && entries[keep.e] && entries[keep.e].groups[keep.g]) sel = { e: keep.e, g: keep.g };
        else {
          // по умолчанию — автор с самой подробной разметкой
          var best = 0;
          entries.forEach(function (e, i) { if (e.groups.length > entries[best].groups.length) best = i; });
          sel = { e: best, g: firstGroup(entries[best]) };
        }
        follow(); // серия из плеера могла стать известна раньше, чем загрузились тайминги
      }
      sync();
    });
  }
  function sync() {
    if (!ready) return;
    var id = on ? X.movieId() : 0, wrap = id ? document.querySelector('.player_section .player_iframe_wrapper') : null;
    if (!wrap) { if (movie) teardown(); return; }
    if (id !== movie) { teardown(); movie = id; load(id); }
    var fr = wrap.querySelector('iframe'), src = fr ? fr.src : '';
    if (src !== frameSrc) { frameSrc = src; resetProbe(); if (panel) paint(); } // другой плеер — его время надо распознать заново
    if (!entries || !entries.length) return; // таймингов нет — ничего не показываем
    if (!panel) { panel = h('div', { class: 'kadr-tm', 'data-kadr-ui': true }); paint(); }
    if (panel.previousElementSibling !== wrap) wrap.after(panel);
    if (!pill) pill = h('div', { class: 'kadr-tm-pill', 'data-kadr-ui': true, hidden: true, role: 'status' });
    if (pill.parentNode !== wrap) wrap.appendChild(pill);
    if (!ticker) ticker = setInterval(tick, 500);
  }
  X.mods.push({ sync: sync });

  store.get(['timings', 'tmFold', 'tmSel'], function (d) {
    d = d || {};
    on = d.timings !== false;
    fold = !!d.tmFold;
    keep = d.tmSel && typeof d.tmSel === 'object' ? d.tmSel : null;
    ready = true;
    sync();
  });
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== 'local' || !ch.timings) return;
    on = ch.timings.newValue !== false;
    if (!on) teardown();
    sync();
  });
})();
