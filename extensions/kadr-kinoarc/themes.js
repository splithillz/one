// Кадр — темы для kinoarc.
// Палитры тем и формула взяты один в один из кода самого сайта
// (assets/palette-*.js и assets/applyTheme-*.js), поэтому темы выглядят так же, как родные.
(function (g) {
  'use strict';

  // Родные темы kinoarc: фон, три уровня поверхностей, акцент и ink (текст на акцентных кнопках).
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

  // Как у сайта: переменная получает слот палитры по своему значению по умолчанию.
  var SLOT_BY_DEFAULT = {
    '11 12 13': 'bg', '14 16 17': 'bg2', '20 22 24': 's1', '25 28 30': 's1b', '28 31 33': 's2',
    '36 40 42': 's3', '47 52 54': 's4', '63 224 161': 'acc', '54 204 146': 'acc2', '44 176 123': 'acc3',
    '99 233 181': 'accHi', '168 245 214': 'acc50', '26 110 78': 'acc500', '19 83 59': 'acc700',
    '7 38 26': 'acc900', '6 40 27': 'ink'
  };

  // Переменные --kn-*, которые CSS сайта использует напрямую (больше сотни мест).
  var KN_SLOTS = ['bg', 'bg2', 's1', 's1b', 's2', 's3', 's4', 'acc', 'acc2', 'acc3', 'accHi', 'accLip', 'ink'];

  // Снимок :root сайта от 09.11.2026: красим сразу, не дожидаясь их CSS.
  // Когда CSS загрузится, content.js перечитает живые значения.
  var DEFAULT_VARS = {
    '--colors-themePreview-primary': '14 16 17',
    '--colors-themePreview-secondary': '20 22 24',
    '--colors-pill-background': '20 22 24',
    '--colors-pill-backgroundHover': '25 28 30',
    '--colors-lightBar-light': '11 12 13',
    '--colors-buttons-toggle': '44 176 123',
    '--colors-buttons-toggleDisabled': '36 40 42',
    '--colors-buttons-secondary': '20 22 24',
    '--colors-buttons-secondaryHover': '28 31 33',
    '--colors-buttons-purple': '63 224 161',
    '--colors-buttons-purpleHover': '99 233 181',
    '--colors-buttons-cancel': '20 22 24',
    '--colors-buttons-cancelHover': '28 31 33',
    '--colors-background-main': '11 12 13',
    '--colors-background-secondary': '11 12 13',
    '--colors-background-secondaryHover': '11 12 13',
    '--colors-background-accentA': '11 12 13',
    '--colors-background-accentB': '11 12 13',
    '--colors-type-logo': '63 224 161',
    '--colors-type-link': '63 224 161',
    '--colors-type-linkHover': '168 245 214',
    '--colors-search-background': '20 22 24',
    '--colors-search-focused': '25 28 30',
    '--colors-mediaCard-hoverAccent': '47 52 54',
    '--colors-mediaCard-barFillColor': '63 224 161',
    '--colors-largeCard-background': '20 22 24',
    '--colors-largeCard-icon': '99 233 181',
    '--colors-dropdown-background': '20 22 24',
    '--colors-dropdown-altBackground': '14 16 17',
    '--colors-dropdown-hoverBackground': '28 31 33',
    '--colors-authentication-inputBg': '20 22 24',
    '--colors-authentication-inputBgHover': '28 31 33',
    '--colors-settings-sidebar-activeLink': '20 22 24',
    '--colors-settings-sidebar-type-icon': '36 40 42',
    '--colors-settings-sidebar-type-iconActivated': '54 204 146',
    '--colors-settings-sidebar-type-activated': '63 224 161',
    '--colors-settings-card-background': '20 22 24',
    '--colors-settings-card-altBackground': '20 22 24',
    '--colors-onboarding-barFilled': '44 176 123',
    '--colors-onboarding-good': '63 224 161',
    '--colors-onboarding-link': '63 224 161',
    '--colors-errors-card': '11 12 13',
    '--colors-about-circle': '20 22 24',
    '--colors-progress-filled': '54 204 146',
    '--colors-video-scraping-loading': '54 204 146',
    '--colors-video-scraping-noresult': '36 40 42',
    '--colors-video-audio-set': '54 204 146',
    '--colors-video-context-inputBg': '20 22 24',
    '--colors-video-context-slider': '36 40 42',
    '--colors-video-context-sliderFilled': '54 204 146',
    '--colors-video-context-type-accent': '54 204 146'
  };

  // Два места, где сайт вшил мяту прямо в CSS: у него самого они не перекрашиваются.
  var FIXES =
    '[class*="shadow-[inset_0_0_0_2px_#3FE0A1]"]{--tw-shadow:inset 0 0 0 2px rgb(var(--kn-acc)) !important}' +
    '[class*="focus-within:shadow-[inset_0_0_0_1px_#3FE0A1]"]:focus-within{--tw-shadow:inset 0 0 0 1px rgb(var(--kn-acc)) !important}';

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

  // Формула сайта: из шести цветов темы выводится вся палитра.
  function palette(t) {
    var bg = rgb(t.bg), s1 = rgb(t.s1), s2 = rgb(t.s2), s3 = rgb(t.s3), acc = rgb(t.acc);
    return {
      bg: bg, bg2: mix(bg, s1, 0.3), s1: s1, s1b: mix(s1, s2, 0.5), s2: s2, s3: s3, s4: mix(s3, WHITE, 0.08),
      acc: acc, acc2: mix(acc, BLACK, 0.1), acc3: mix(acc, BLACK, 0.3), accHi: mix(acc, WHITE, 0.2),
      acc50: mix(acc, WHITE, 0.55), acc500: mix(acc, bg, 0.55), acc700: mix(acc, bg, 0.68),
      acc900: mix(acc, bg, 0.86), accLip: mix(acc, BLACK, 0.4), ink: rgb(t.ink)
    };
  }

  // --- Свой цвет: поверхности тонируются в оттенок акцента, как у родных тем ---
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
      id: 'custom', name: 'Свой', bg: surf(0.05), s1: surf(0.086), s2: surf(0.12), s3: surf(0.16),
      acc: hex(acc), ink: hex(fromHsl(hsl[0], hsl[1] * 0.82, 0.095))
    };
  }

  // Состояние из storage → тема. Мята = родной вид сайта, ничего не переопределяем.
  function resolve(state) {
    if (!state || !state.theme || state.theme === 'mint') return null;
    if (state.theme === 'custom') return /^#[0-9a-f]{6}$/i.test(state.seed || '') ? fromAccent(state.seed) : null;
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === state.theme) return THEMES[i];
    return null;
  }

  function css(theme, defaults) {
    var p = palette(theme), out = [];
    Object.keys(defaults).forEach(function (name) {
      var slot = SLOT_BY_DEFAULT[String(defaults[name]).trim().replace(/\s+/g, ' ')];
      if (slot) out.push(name + ':' + p[slot].join(' ') + ' !important');
    });
    KN_SLOTS.forEach(function (s) { out.push('--kn-' + kebab(s) + ':' + p[s].join(' ') + ' !important'); });
    return 'html:root:root{' + out.join(';') + '}' + FIXES;
  }

  // Живые значения :root из CSS сайта — так же, как их читает сам сайт.
  function readDefaults(doc) {
    var out = {};
    for (var i = 0; i < doc.styleSheets.length; i++) {
      var rules;
      try { rules = doc.styleSheets[i].cssRules; } catch (e) { continue; }
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j];
        if (!r.style || r.selectorText !== ':root') continue;
        for (var k = 0; k < r.style.length; k++) {
          var n = r.style[k];
          if (n.indexOf('--colors-') === 0) out[n] = r.style.getPropertyValue(n).trim();
        }
      }
    }
    return out;
  }

  // ===================== Аватар =====================
  // Цвета аватара — ровно набор сайта.
  var AVATAR_COLORS = [
    { id: 'silver', name: 'Серебро', hex: '#C9CCCF' },
    { id: 'mint', name: 'Мята', hex: '#3FE0A1' },
    { id: 'sage', name: 'Шалфей', hex: '#9DB8A6' },
    { id: 'sand', name: 'Песок', hex: '#D6C4A3' },
    { id: 'steel', name: 'Сталь', hex: '#9DADC4' },
    { id: 'terracotta', name: 'Терракота', hex: '#CF8E7D' },
    { id: 'lavender', name: 'Лаванда', hex: '#B2A6D0' },
    { id: 'amber', name: 'Янтарь', hex: '#D8B46A' }
  ];
  // Иконки, которые на сайте закрыты наградой или рангом.
  var LOCKED_ICONS = ['armchair', 'film_reel', 'cassette'];
  // Названия значков — как в русской локали сайта (settings.account.profile.icons).
  var ICON_NAMES = {
    clapper_board: 'Хлопушка', ticket: 'Билет', videocamera: 'Камера', popcorn: 'Попкорн', masks: 'Маска',
    tv: 'Телевизор', couch: 'Диван', coffee: 'Кофе', headphones: 'Наушники', rising_star: 'Звезда',
    crown: 'Корона', moon: 'Ночь', saturn: 'Планета', dragon: 'НЛО', rocket: 'Ракета', ghost: 'Призрак',
    cat: 'Кот', fire: 'Огонь', weed: 'Лист', wand: 'Палочка', mobile: 'Телефон', user_group: 'Компания',
    cloud_arrow_up: 'Гроза', megaphone: 'Рупор', armchair: 'Кресло', film_reel: 'Бобина', cassette: 'Кассета'
  };
  var DEFAULT_ICON = 'clapper_board';
  var HOSTS = ['*://kinoarc.net/*', '*://*.kinoarc.net/*'];

  function normHex(c) {
    if (typeof c !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return '#3FE0A1';
    return c.length === 4 ? '#' + c.slice(1).split('').map(function (x) { return x + x; }).join('') : c;
  }
  // Формула сайта: тёмный цвет осветляется, подложка = 14% цвета поверх #141618.
  function avatarStyle(c) {
    var t = rgb(normHex(c));
    for (var i = 0; i < 8 && lum(t) < 0.25; i++) t = mix(t, WHITE, 0.2);
    return { background: hex(mix(rgb('#141618'), t, 0.14)), color: hex(t) };
  }
  function cssRgb(h) { return 'rgb(' + rgb(h).join(', ') + ')'; }

  // Иконки берём прямо из JS сайта: там все 27, включая закрытые. Каждая — один path.
  function extractIcons(src) {
    var i = src.indexOf("clapper_board:'<");
    if (i < 0) return null;
    var p = src.lastIndexOf('{', i) + 1, re = /\s*"?([a-z_]+)"?:'(<[^']*)',?/y, out = {}, n = 0, m;
    for (;;) {
      re.lastIndex = p;
      m = re.exec(src);
      if (!m) break;
      var d = (m[2].match(/\sd="([^"]+)"/) || [])[1];
      if (d) { out[m[1]] = d; n++; }
      p = re.lastIndex;
    }
    return n >= 10 ? out : null;
  }
  // Кэш в storage по адресу бандла: обновится сам, когда сайт выкатит новую сборку.
  function loadIcons(origin, bundleUrl, cb) {
    chrome.storage.local.get(['iconsCache'], function (d) {
      var c = d && d.iconsCache;
      if (c && c.icons && (!bundleUrl || c.src === bundleUrl)) { cb(c.icons, c.order || Object.keys(c.icons)); return; }
      var url = bundleUrl ? Promise.resolve(bundleUrl) :
        fetch(origin + '/', { credentials: 'omit' }).then(function (r) { return r.text(); }).then(function (html) {
          // Главный бандл — <script type="module" src="/assets/index-….js">; preload-списки маршрутов не трогаем.
          var m = html.match(/<script[^>]+src="(\/assets\/index-[\w-]+\.js)"/) || html.match(/(\/assets\/index-[\w-]+\.js)/);
          if (!m) throw new Error('bundle not found');
          return origin + m[1];
        });
      url.then(function (u) {
        return fetch(u, { credentials: 'omit' }).then(function (r) { return r.text(); }).then(function (txt) {
          var icons = extractIcons(txt);
          if (!icons) throw new Error('icons not found');
          // порядок как на сайте (storage сам сортирует ключи по алфавиту)
          var order = Object.keys(icons);
          chrome.storage.local.set({ iconsCache: { src: u, icons: icons, order: order } });
          cb(icons, order);
        });
      }).catch(function () { cb(c && c.icons ? c.icons : null, c && c.icons ? (c.order || Object.keys(c.icons)) : []); });
    });
  }
  // Выбор аватара из storage (понимает и формат прошлой версии с полем svg).
  function normAvatar(a) {
    if (!a || a.off) return null;
    var d = a.d || (String(a.svg || '').match(/\sd="([^"]+)"/) || [])[1];
    return d ? { icon: a.icon || null, color: normHex(a.color), d: d } : null;
  }

  // Название текущей темы — для пункта в меню сайта и превью в попапе.
  function themeName(state) {
    if (!state || !state.theme || state.theme === 'mint') return THEMES[0].name;
    if (state.theme === 'custom') return 'Свой цвет';
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === state.theme) return THEMES[i].name;
    return THEMES[0].name;
  }
  // Палитра темы как CSS-переменные «r g b» — ими перекрашивается интерфейс самого расширения.
  function uiVars(state) {
    var p = palette(resolve(state) || THEMES[0]), out = {};
    Object.keys(p).forEach(function (k) { out['--' + kebab(k)] = p[k].join(' '); });
    return out;
  }

  g.KADR = {
    THEMES: THEMES, DEFAULT_VARS: DEFAULT_VARS, palette: palette, fromAccent: fromAccent,
    resolve: resolve, css: css, readDefaults: readDefaults,
    AVATAR_COLORS: AVATAR_COLORS, LOCKED_ICONS: LOCKED_ICONS, ICON_NAMES: ICON_NAMES, DEFAULT_ICON: DEFAULT_ICON,
    HOSTS: HOSTS, normHex: normHex, avatarStyle: avatarStyle, cssRgb: cssRgb,
    extractIcons: extractIcons, loadIcons: loadIcons, normAvatar: normAvatar, themeName: themeName, uiVars: uiVars
  };
})(window);
