// Кадр для kinohub — актёры на странице фильма.
// У сайта актёры спрятаны во вкладке (закрыта, пока не нажмёшь) и показаны первые двенадцать из загруженных.
// Здесь это лента прямо под описанием: фото, под ним имя и кто это (роль — если сайт её отдаёт).
// Данные — тот же открытый запрос, что делает вкладка сайта. Лента — часть нового дизайна: без него сайт как был.
(function () {
  'use strict';
  var X = window.KADRX;
  if (!X || X.cast) return;
  X.cast = true;
  var h = X.h;
  var movie = 0, box = null, people = null;

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
  function draw() {
    if (!box) return;
    if (!people) {
      box.replaceChildren(h('h2', { class: 'kc-title', text: 'В ролях' }),
        h('div', { class: 'kc-track kc-wait' }, [0, 1, 2, 3, 4, 5].map(function () { return h('span', { class: 'kc-card' }, h('i'), h('b'), h('small')); })));
      return;
    }
    // одинаковая у всех подпись («актёр», «актёр», …) людей не различает — тогда её не показываем вовсе
    var jobs = people.map(who), same = people.length > 1 && jobs.every(function (j) { return j === jobs[0]; });
    var track = h('div', { class: 'kc-track', tabindex: '0', role: 'list', 'aria-label': 'Актёры' });
    people.forEach(function (p, i) {
      var name = str(p.name) || str(p.originalName), photo = X.img(p.photoUrl, '300x300');
      var a = h('a', { class: 'kc-card', role: 'listitem', href: '/person/' + p.id, title: name },
        h('span', { class: 'kc-photo' }, photo ? h('img', { src: photo, alt: '', loading: 'lazy', decoding: 'async' }) : X.icon('user')),
        h('b', { text: name }),
        jobs[i] && !same ? h('small', { text: jobs[i] }) : null);
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
    box.replaceChildren(h('div', { class: 'kc-head' }, h('h2', { class: 'kc-title', text: 'В ролях' }), h('em', { text: String(people.length) }), prev, next), track);
    requestAnimationFrame(edges);
  }
  function drop() {
    if (box) box.remove();
    box = null; people = null; movie = 0;
    hideTab(false);
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
      var m = X.movie(id);
      if (m && m.meta && m.meta.actorCount === 0) return; // сайт знает, что актёров нет
      box = h('section', { class: 'kadr-cast', 'data-kadr-ui': true });
      draw();
      X.pub('/movies/' + id + '/crew').then(function (res) {
        if (movie !== id) return;
        var items = res && res.data && res.data.items;
        items = Array.isArray(items) ? items.filter(function (p) { return p && p.id && (str(p.name) || str(p.originalName)); }) : [];
        if (!items.length) { if (box) box.remove(); box = null; hideTab(false); return; }
        people = items;
        draw();
        sync();
      });
    }
    if (!box) return;
    if (box.previousElementSibling !== sec) sec.after(box);
    hideTab(!!people);
  }
  X.mods.push({ sync: sync });
})();
