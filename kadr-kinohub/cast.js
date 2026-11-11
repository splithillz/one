// Кадр для kinohub — актёры на странице фильма.
// У сайта актёры спрятаны во вкладке (закрыта, пока не нажмёшь) и показаны первые двенадцать из загруженных.
// Здесь это лента прямо под описанием: фото, под ним имя и кто это.
// Актёры — тот же открытый запрос, что делает вкладка сайта. Режиссёр и сценаристы — из данных фильма, которые сайт
// уже загрузил для страницы (там они с фото и профессией), поэтому лента не пустеет, даже если актёров сайт не отдал.
// Лента — часть нового дизайна: без него сайт как был.
(function () {
  'use strict';
  var X = window.KADRX;
  if (!X || X.cast) return;
  X.cast = true;
  var h = X.h;
  var movie = 0, box = null, people = null;
  var tries = 0, retryAt = 0, loading = false, done = false;
  function path(id) { return '/movies/' + id + '/crew'; }

  // Профессии приходят у сайта английскими словами (как в описании фильма: Director, Writer).
  var JOBS = {
    actor: 'актёр', actress: 'актриса', director: 'режиссёр', writer: 'сценарист', producer: 'продюсер', composer: 'композитор',
    operator: 'оператор', editor: 'монтажёр', design: 'художник', designer: 'художник', voice: 'озвучка', voice_director: 'режиссёр дубляжа'
  };
  function str(v) { return typeof v === 'string' ? v.trim() : ''; }
  // Кто это: сначала роль (персонаж), потом профессия. Поля сайта заранее неизвестны — берём те, что есть.
  function who(p) {
    var role = str(p.description) || str(p.character) || str(p.characterName) || str(p.roleName) || str(p.hero);
    if (role) return role;
    var job = str(p.professionText) || str(p.profession) || str(p.position) || str(p.role) || str(p.job);
    if (!job) return '';
    return JOBS[job.toLowerCase().replace(/[\s-]+/g, '_')] || (/^[A-Za-z_]+$/.test(job) ? '' : job.toLowerCase());
  }
  // Создатели фильма из его данных в кэше сайта: [{id, name, photoUrl, sub: профессия}]
  function makers(id) {
    var m = X.movie(id), list = m && Array.isArray(m.crew) ? m.crew : [], out = [], seen = {};
    list.forEach(function (c) {
      var p = c && c.person, name = p && (str(p.name) || str(p.originalName));
      if (!p || !p.id || !name || seen[p.id]) return;
      seen[p.id] = 1;
      out.push({ id: p.id, name: name, photoUrl: p.photoUrl, sub: JOBS[str(c.role).toLowerCase().replace(/[\s-]+/g, '_')] || '' });
    });
    return out;
  }
  // Все карточки ленты: сначала актёры, потом создатели (кого ещё не было).
  function cards() {
    var actors = people || [], out = [], seen = {};
    // одинаковая у всех актёров подпись («актёр», «актёр», …) их не различает — тогда её не показываем вовсе
    var subs = actors.map(who), same = actors.length > 1 && subs.every(function (j) { return j === subs[0]; });
    actors.forEach(function (p, i) {
      seen[p.id] = 1;
      out.push({ id: p.id, name: str(p.name) || str(p.originalName), photoUrl: p.photoUrl, sub: same ? '' : subs[i] });
    });
    makers(movie).forEach(function (m) { if (!seen[m.id]) out.push(m); });
    return out;
  }
  function draw() {
    if (!box) return;
    if (loading && !people) {
      box.replaceChildren(h('h2', { class: 'kc-title', text: 'В ролях' }),
        h('div', { class: 'kc-track kc-wait' }, [0, 1, 2, 3, 4, 5].map(function () { return h('span', { class: 'kc-card' }, h('i'), h('b'), h('small')); })));
      return;
    }
    var list = cards(), title = people && people.length ? 'В ролях' : 'Создатели';
    var track = h('div', { class: 'kc-track', tabindex: '0', role: 'list', 'aria-label': title });
    list.forEach(function (p) {
      var photo = X.img(p.photoUrl, '300x300');
      var a = h('a', { class: 'kc-card', role: 'listitem', href: '/person/' + p.id, title: p.name },
        h('span', { class: 'kc-photo' }, photo ? h('img', { src: photo, alt: '', loading: 'lazy', decoding: 'async' }) : X.icon('user')),
        h('b', { text: p.name }),
        p.sub ? h('small', { text: p.sub }) : null);
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault();
        X.go('/person/' + p.id);
      });
      var img = a.querySelector('img');
      if (img) img.addEventListener('error', function () { img.replaceWith(X.icon('user')); });
      track.append(a);
    });
    function step(dir) { track.scrollBy({ left: dir * Math.max(240, track.clientWidth * 0.8), behavior: 'smooth' }); }
    var prev = h('button', { type: 'button', class: 'kc-nav', title: 'Назад', 'aria-label': 'Назад', onclick: function () { step(-1); } }, X.icon('left'));
    var next = h('button', { type: 'button', class: 'kc-nav', title: 'Дальше', 'aria-label': 'Дальше', onclick: function () { step(1); } }, X.icon('right'));
    function edges() {
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 4;
    }
    track.addEventListener('scroll', edges, { passive: true });
    box.replaceChildren(h('div', { class: 'kc-head' }, h('h2', { class: 'kc-title', text: title }), h('em', { text: String(list.length) }), prev, next), track);
    requestAnimationFrame(edges);
  }
  // Показать, что есть: ленту (актёры и/или создатели) — или ничего, если показать некого.
  function show() {
    if (!people && !loading && !makers(movie).length) { if (box) { box.remove(); box = null; } return; }
    if (!box) box = h('section', { class: 'kadr-cast', 'data-kadr-ui': true });
    draw();
  }
  function drop() {
    if (box) box.remove();
    box = null; people = null; movie = 0; tries = 0; retryAt = 0; done = false;
    delete X.info.cast; delete X.info.makers;
    hideTab(false);
  }
  function load(id) {
    if (loading) return;
    loading = true;
    X.pub(path(id)).then(function (res) {
      loading = false;
      if (movie !== id) return;
      var items = res && res.data && res.data.items;
      if (!Array.isArray(items)) {
        // Не получилось (сайт не ответил или ответил не тем). Заглушка не висит: остаются создатели (если они есть)
        // и родная вкладка «Актёры». Пробуем ещё дважды; а если сайт сам загрузит актёров (вкладку открыли) —
        // возьмём их из его кэша.
        tries++;
        if (tries > 5) done = true; // и из кэша сайта пришло не то — больше не пытаемся
        X.info.cast = 'fail×' + tries;
        retryAt = tries < 3 ? Date.now() + (tries === 1 ? 4000 : 15000) : Infinity;
        if (tries < 3) setTimeout(sync, tries === 1 ? 4100 : 15100);
        show();
        sync();
        return;
      }
      items = items.filter(function (p) { return p && p.id && (str(p.name) || str(p.originalName)); });
      X.info.cast = items.length;
      done = true;
      people = items.length ? items : null;
      show();
      sync();
    });
  }
  // Родная вкладка «Актёры» с лентой дублируется — прячем её кнопку (если вкладка не открыта прямо сейчас).
  function hideTab(yes) {
    var tabs = document.querySelectorAll('.tabs_header button');
    for (var i = 0; i < tabs.length; i++) {
      var hide = yes && tabs[i].textContent.trim() === 'Актёры' && !tabs[i].classList.contains('active');
      if (tabs[i].hasAttribute('data-kadr-dup') !== hide) tabs[i].toggleAttribute('data-kadr-dup', hide);
    }
  }
  function sync() {
    var id = X.skin ? X.movieId() : 0, sec = id ? document.querySelector('.movie_section') : null;
    // ждём, пока сайт нарисует сам фильм: лента идёт сразу за его блоком
    if (!sec || !sec.querySelector('.movie_body')) { if (movie) drop(); return; }
    if (id !== movie) {
      drop();
      movie = id;
      X.info.makers = makers(id).length;
      var m = X.movie(id);
      if (m && m.meta && m.meta.actorCount === 0) { done = true; show(); } // сайт знает, что актёров нет — только создатели
      else { load(id); show(); }
    } else if (!people && !done && !loading && tries && (X.cached(path(id)) || Date.now() >= retryAt)) { load(id); }
    if (!box) return;
    if (box.previousElementSibling !== sec) sec.after(box);
    hideTab(!!people);
  }
  X.mods.push({ sync: sync });
})();
