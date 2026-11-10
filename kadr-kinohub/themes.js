// Кадр — темы для kinohub. Палитры и формула те же, что в «Кадре» для kinoarc:
// из шести цветов темы (фон, три поверхности, акцент, ink) выводится вся палитра.
(function (g) {
  'use strict';

  var HOSTS = ['*://on.kinohub.vip/*'];
  var SITE = 'https://on.kinohub.vip/';

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
  // Вид интерфейса расширения, пока тема выключена: нейтральный графит.
  var NEUTRAL = { id: OFF, name: 'Родная', bg: '#0c0d0f', s1: '#16181b', s2: '#1e2125', s3: '#272b30', acc: '#c9ced6', ink: '#14171a' };

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
    return t ? t.name : NEUTRAL.name;
  }
  // Палитра как CSS-переменные «r g b» — ими перекрашивается интерфейс самого расширения.
  function uiVars(state) {
    var p = palette(resolve(state) || NEUTRAL), out = {};
    Object.keys(p).forEach(function (k) { out['--' + kebab(k)] = p[k].join(' '); });
    return out;
  }

  g.KADR = {
    HOSTS: HOSTS, SITE: SITE, OFF: OFF, THEMES: THEMES, NEUTRAL: NEUTRAL,
    palette: palette, fromAccent: fromAccent, resolve: resolve, themeName: themeName, uiVars: uiVars
  };
})(window);
