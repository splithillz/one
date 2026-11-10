// Кадр — темы для kinohub (on.kinohub.vip, он же Kinobox.in).
// Палитры и формула те же, что в «Кадре» для kinoarc: из шести цветов темы выводится вся палитра.
// Отличие в том, как тема ложится на сайт: у kinohub нет CSS-переменных, цвета зашиты прямо в стили,
// поэтому здесь описано, какой цвет сайта во что превращается (профиль сайта), а content.js
// перекрашивает этим профилем его таблицы стилей.
(function (g) {
  'use strict';

  var HOSTS = ['*://on.kinohub.vip/*'];

  // «Родная» — тема выключена, сайт выглядит как есть.
  var OFF = 'off';
  var THEMES = [
    { id: 'mint',   name: 'Мята',   bg: '#0b0c0d', s1: '#141618', s2: '#1c1f21', s3: '#24282a', acc: '#3fe0a1', ink: '#06281b' },
    { id: 'noir',   name: 'Noir',   bg: '#060606', s1: '#111111', s2: '#191919', s3: '#242424', acc: '#e9e9e9', ink: '#111111' },
    { id: 'mocha',  name: 'Mocha',  bg: '#100d09', s1: '#1a1610', s2: '#231e17', s3: '#2e271e', acc: '#d9a15a', ink: '#2a1a05' },
    { id: 'forest', name: 'Forest', bg: '#090e0a', s1: '#111a12', s2: '#18231a', s3: '#202e22', acc: '#86c76f', ink: '#0f2408' },
    { id: 'cobalt', name: 'Cobalt', bg: '#080b12', s1: '#10151f', s2: '#161d2b', s3: '#1f2839', acc: '#5ec8ff', ink: '#04202e' },
    { id: 'ember',  name: 'Ember',  bg: '#100909', s1: '#1b1111', s2: '#251717', s3: '#311f1e', acc: '#ff7a66', ink: '#2e0a05' },
    { id: 'grape',  name: 'Grape',  bg: '#0d0911', s1: '#17111d', s2: '#201828', s3: '#2b2135', acc: '#c79bff', ink: '#220c3a' },
    { id: 'rose',   name: 'Rose',   bg: '#110a0e', s1: '#1c1218', s2: '#261a21', s3: '#32222b', acc: '#f394c4', ink: '#36091f' },
    { id: 'spark',  name: 'Spark',  bg: '#0e0c07', s1: '#1a170e', s2: '#231f14', s3: '#2e291b', acc: '#e8be5e', ink: '#2b1e05' },
    { id: 'frost',  name: 'Frost',  bg: '#091016', s1: '#101a22', s2: '#16232d', s3: '#1e2e3a', acc: '#6dd3c8', ink: '#052522' }
  ];
  // Родной вид kinohub в тех же шести цветах — для плитки «Родная» и интерфейса расширения, пока тема выключена.
  var NATIVE = { id: OFF, name: 'Родная', bg: '#232025', s1: '#2f2b32', s2: '#3a363d', s3: '#4b474d', acc: '#aa77bb', ink: '#faf8ed' };

  var BLACK = [0, 0, 0], WHITE = [255, 255, 255];

  function rgb(hex) {
    var h = String(hex).replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(h)) h = '3fe0a1';
    var n = parseInt(h, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function hex(a) { return '#' + a.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function mix(a, b, t) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }); }
  function kebab(s) { return s.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); }

  function palette(t) {
    var bg = rgb(t.bg), s1 = rgb(t.s1), s2 = rgb(t.s2), s3 = rgb(t.s3), acc = rgb(t.acc);
    return {
      bg: bg, bg2: mix(bg, s1, 0.3), s1: s1, s1b: mix(s1, s2, 0.5), s2: s2, s3: s3, s4: mix(s3, WHITE, 0.08),
      acc: acc, acc2: mix(acc, BLACK, 0.1), acc3: mix(acc, BLACK, 0.3), accHi: mix(acc, WHITE, 0.2),
      acc50: mix(acc, WHITE, 0.55), acc500: mix(acc, bg, 0.55), acc700: mix(acc, bg, 0.68),
      acc900: mix(acc, bg, 0.86), accLip: mix(acc, BLACK, 0.4), ink: rgb(t.ink)
    };
  }

  // --- Свой цвет: поверхности тонируются в оттенок акцента, как у готовых тем ---
  function lum(a) {
    var c = a.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function toHsl(a) {
    var r = a[0] / 255, gg = a[1] / 255, b = a[2] / 255;
    var max = Math.max(r, gg, b), min = Math.min(r, gg, b), d = max - min, l = (max + min) / 2, h = 0, s = 0;
    if (d) {
      s = Math.min(1, d / (1 - Math.abs(2 * l - 1)));
      h = max === r ? ((gg - b) / d) % 6 : max === gg ? (b - r) / d + 2 : (r - gg) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return [h, s, l];
  }
  function fromHsl(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    var p = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return p.map(function (v) { return Math.round((v + m) * 255); });
  }
  function fromAccent(seed) {
    var acc = rgb(seed), hsl = toHsl(acc);
    // Тёмный акцент осветляем по яркости, сохраняя оттенок и насыщенность, иначе он не читается на тёмном фоне.
    for (var i = 0; i < 12 && lum(acc) < 0.25; i++) {
      hsl[2] += (1 - hsl[2]) * 0.15;
      acc = fromHsl(hsl[0], hsl[1], hsl[2]);
    }
    var ss = hsl[1] * 0.32;
    function surf(l) { return hex(fromHsl(hsl[0], ss, l)); }
    return {
      id: 'custom', name: 'Свой цвет', bg: surf(0.05), s1: surf(0.086), s2: surf(0.12), s3: surf(0.16),
      acc: hex(acc), ink: hex(fromHsl(hsl[0], hsl[1] * 0.82, 0.095))
    };
  }

  // Состояние из storage → тема. null — тема выключена, сайт не трогаем.
  function resolve(state) {
    if (!state || !state.theme || state.theme === OFF) return null;
    if (state.theme === 'custom') return /^#[0-9a-f]{6}$/i.test(state.seed || '') ? fromAccent(state.seed) : null;
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === state.theme) return THEMES[i];
    return null;
  }
  function themeName(state) {
    var t = resolve(state);
    return t ? t.name : NATIVE.name;
  }
  // Палитра как CSS-переменные «r g b» — ими перекрашивается интерфейс самого расширения.
  function uiVars(state) {
    var p = palette(resolve(state) || NATIVE), out = {};
    Object.keys(p).forEach(function (k) { out['--' + kebab(k)] = p[k].join(' '); });
    return out;
  }

  /* ===================== Профиль сайта ===================== */
  // Нейтральные поверхности kinohub по возрастанию светлоты и слот темы для каждой.
  // У сайта панели темнее страницы — эту структуру сохраняем: страница = s1, панели = bg.
  var RAMP = [
    ['#1d1a1f', 'deep'],   // наведение на тёмные кнопки
    ['#232025', 'bg'],     // панели, рамка шапки, кнопки на постерах
    ['#2f2b32', 's1'],     // фон страницы
    ['#4b474d', 's4'],     // кнопки шапки
    ['#635e66', 's5'],     // их наведение, выбранный сегмент
    ['#6b6373', 's6']
  ];
  // Под новым дизайном структура как у kinoarc: страница — самая тёмная, панели и плашки светлее её.
  var RAMP_SKIN = [
    ['#1d1a1f', 's2'],     // наведение на панель
    ['#232025', 's1'],     // панели
    ['#2f2b32', 'bg'],     // фон страницы
    ['#4b474d', 's3'],
    ['#635e66', 's4'],
    ['#6b6373', 's5']
  ];
  // Акцент сайта (выбранное, наведение на закладку). Синие кнопки сайта считаем тем же акцентом.
  var ACCENT = '#aa77bb';
  var HUE_FROM = 215, HUE_TO = 305;
  // Зелёная плашка рейтинга «7 и выше» (#00942c) — единственное цветное пятно, которое сайт показывает
  // на карточках. Под темой это акцент темы; прочие зелёные и красные остаются как были.
  var ALSO_ACCENT = { '0,148,44': 1 };

  function slots(theme) {
    var p = palette(theme);
    return {
      deep: mix(p.bg, BLACK, 0.35), bg: p.bg, s1: p.s1, s2: p.s2, s3: p.s3, s4: p.s4,
      s5: mix(p.s3, WHITE, 0.2), s6: mix(p.s3, WHITE, 0.26), top: mix(p.s3, WHITE, 0.34),
      acc: p.acc, accHi: p.accHi, ink: p.ink
    };
  }
  function light(c) { return (Math.max(c[0], c[1], c[2]) + Math.min(c[0], c[1], c[2])) / 510; }
  // Что это за цвет на сайте:
  //   surface — тёмный нейтральный (поверхность): уходит в тон темы;
  //   accent  — фиолетово-синий акцент: становится акцентом темы;
  //   light   — светлый нейтральный (текст, значки): не трогаем;
  //   other   — зелёный рейтинг, красное удаление и т. п.: не трогаем.
  function kind(c) {
    if (ALSO_ACCENT[c[0] + ',' + c[1] + ',' + c[2]]) return 'accent';
    if (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) <= 30) return light(c) >= 0.5 ? 'light' : 'surface';
    var h = toHsl(c)[0];
    return h >= HUE_FROM && h <= HUE_TO ? 'accent' : 'other';
  }
  // Тема → функция «цвет сайта [r,g,b] → цвет темы [r,g,b]» (null — цвет остаётся как был).
  // skin — включён новый дизайн: поверхности раскладываются по-другому (см. RAMP_SKIN).
  function mapper(theme, skin) {
    var S = slots(theme), pts = [[0, BLACK]];
    (skin ? RAMP_SKIN : RAMP).forEach(function (r) { pts.push([light(rgb(r[0])), S[r[1]]]); });
    pts.push([0.5, S.top]);
    var a = toHsl(S.acc), ref = light(rgb(ACCENT));
    return function (c) {
      var k = kind(c), l = light(c);
      if (k === 'surface') {
        if (l <= 0) return null; // чёрный — тени и затемнения
        for (var i = 1; i < pts.length; i++) {
          if (l <= pts[i][0]) return mix(pts[i - 1][1], pts[i][1], (l - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
        }
        return null;
      }
      if (k === 'accent') {
        var d = l - ref;
        if (Math.abs(d) < 0.004 || ALSO_ACCENT[c[0] + ',' + c[1] + ',' + c[2]]) return S.acc;
        // светлее/темнее акцента сайта → настолько же светлее/темнее акцент темы (наведение, нажатие)
        return fromHsl(a[0], a[1], Math.min(0.94, Math.max(0.18, a[2] + d * 0.9)));
      }
      return null;
    };
  }

  /* ----- цвета в тексте CSS-значений ----- */
  // CSSOM отдаёт цвета как rgb()/rgba(); hex встречается в переменных и запасных значениях var().
  var TOKEN = /url\([^)]*\)|rgba?\(\s*[\d.]+%?(?:\s*,\s*|\s+)[\d.]+%?(?:\s*,\s*|\s+)[\d.]+%?(?:\s*[,\/]\s*[\d.]+%?)?\s*\)|#[0-9a-f]{3,8}\b/gi;
  function num(s, scale) { return s.charAt(s.length - 1) === '%' ? parseFloat(s) * scale / 100 : parseFloat(s); }
  // 'rgb(35, 32, 37)' | 'rgba(0, 0, 0, 0.53)' | '#232025' | '#a7b' | '#faf8ed88' → [r, g, b, a] или null
  function parseColor(tok) {
    var m, h, c;
    if (tok.charAt(0) === '#') {
      h = tok.slice(1);
      if (h.length === 3 || h.length === 4) h = h.replace(/./g, '$&$&');
      if (h.length !== 6 && h.length !== 8) return null;
      c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      c.push(h.length === 8 ? Math.round(parseInt(h.slice(6, 8), 16) / 255 * 1000) / 1000 : 1);
      return c;
    }
    m = tok.match(/[\d.]+%?/g);
    if (!m || m.length < 3) return null;
    c = [Math.round(num(m[0], 255)), Math.round(num(m[1], 255)), Math.round(num(m[2], 255))];
    c.push(m.length > 3 ? num(m[3], 1) : 1);
    for (var i = 0; i < 4; i++) if (!(c[i] >= 0)) return null;
    return c;
  }
  function cssColor(c, a) {
    return a < 1 ? 'rgba(' + c[0] + ', ' + c[1] + ', ' + c[2] + ', ' + a + ')' : 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')';
  }
  function hasColor(text) {
    TOKEN.lastIndex = 0;
    var m;
    while ((m = TOKEN.exec(text))) if (m[0].charAt(0) !== 'u') { TOKEN.lastIndex = 0; return true; }
    return false;
  }

  // Перекраска для темы: value() меняет все цвета в CSS-значении, kindOf() говорит, что за цвет в значении.
  function recolor(theme, skin) {
    var map = mapper(theme, skin), S = slots(theme), memo = {};
    function one(tok) {
      if (tok.charAt(0) === 'u' || tok.charAt(0) === 'U') return tok; // url(#id) — не цвет
      var key = tok.toLowerCase();
      if (memo.hasOwnProperty(key)) return memo[key] || tok;
      var c = parseColor(key), to = c ? map(c) : null;
      memo[key] = to ? cssColor(to, c[3]) : '';
      return memo[key] || tok;
    }
    return {
      ink: cssColor(S.ink, 1),
      page: cssColor(skin ? S.bg : S.s1, 1),
      value: function (text) { return text.indexOf('#') < 0 && text.indexOf('rgb') < 0 ? text : text.replace(TOKEN, one); },
      // значение целиком — один цвет? тогда его вид и непрозрачность
      kindOf: function (text) {
        var c = /^(?:rgba?\([^)]*\)|#[0-9a-f]{3,8})$/i.test(text) ? parseColor(text.toLowerCase()) : null;
        return c ? { k: kind(c), a: c[3] } : null;
      }
    };
  }

  // Сам сайт акцент почти не показывает (он серо-фиолетовый), поэтому под темой добавляем его точечно:
  // ссылки-плашки на странице фильма, наша кнопка в шапке и выделение текста.
  // Класс удвоен, чтобы сравняться по специфичности с правилом сайта (у того ещё [data-v-…]) и победить порядком.
  function touches(theme) {
    var S = slots(theme), acc = cssColor(S.acc, 1);
    return '.movie_info_item.movie_info_item a{color:' + acc + '}' +
      '.header_nav [data-kadr-entry][data-kadr-entry] i[class^=ico_]{background-color:' + acc + '}' + // сильнее :hover сайта: на телефоне наведение «залипает» после тапа
      '::selection{background-color:' + acc + ';color:' + cssColor(S.ink, 1) + '}';
  }

  // Цвета для нового дизайна (skin.css) — CSS-переменные --kd-*. Без темы — родные цвета сайта:
  // тогда панели остаются темнее страницы, как у него.
  function skinVars(state) {
    var t = resolve(state), S = t ? slots(t) : null;
    var v = t ? {
      bg: S.bg, s1: S.s1, s2: S.s2, s3: S.s3, s4: S.s4, acc: S.acc, 'acc-hi': S.accHi, ink: S.ink, link: S.acc, good: S.accHi
    } : {
      bg: rgb('#2f2b32'), s1: rgb('#232025'), s2: rgb('#1d1a1f'), s3: rgb('#4b474d'), s4: rgb('#635e66'),
      acc: rgb(ACCENT), 'acc-hi': rgb('#c79bd6'), ink: rgb('#faf8ed'), link: rgb('#faf8ed'), good: rgb('#46d37a')
    };
    var out = '';
    Object.keys(v).forEach(function (k) { out += '--kd-' + k + ':' + v[k].join(' ') + ';'; });
    return ':root{' + out + '}';
  }

  // Ключевые цвета сайта под темой — для превью в расширении. Без темы — родные.
  function siteLook(state, skin) {
    var t = resolve(state), map = t ? mapper(t, skin) : function () { return null; };
    function c(h) { var v = rgb(h); return hex(map(v) || v); }
    return {
      page: c('#2f2b32'), panel: c('#232025'), raised: c('#4b474d'), hover: c('#635e66'), badge: c('#596774'),
      rate: c('#00942c'), rateText: t ? t.ink : '#ffffff', link: t ? t.acc : '#faf8ed',
      me: t ? t.acc : skin ? ACCENT : '#c0bcb7', good: t ? hex(palette(t).accHi) : '#46d37a',
      text: '#faf8ed', text2: '#c0bcb7', muted: '#939095'
    };
  }

  g.KADR = {
    HOSTS: HOSTS, OFF: OFF, THEMES: THEMES, NATIVE: NATIVE,
    palette: palette, fromAccent: fromAccent, resolve: resolve, themeName: themeName, uiVars: uiVars,
    kind: kind, mapper: mapper, parseColor: parseColor, hasColor: hasColor, recolor: recolor, touches: touches,
    skinVars: skinVars, siteLook: siteLook
  };
})(typeof window !== 'undefined' ? window : globalThis);
