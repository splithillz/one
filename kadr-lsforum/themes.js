// Kadr (Кадр) — темы для форума Los Santos Project (forum.ls-project.com).
// Палитры и формула те же, что в «Кадре» для kinoarc и kinohub: из шести цветов темы выводится вся палитра.
// Форум сделан на Invision Community с темой Focus, и все его цвета — CSS-переменные (--theme-*: «r, g, b»).
// Поэтому тема ложится просто: расширение подменяет значения этих переменных, сайт перекрашивается сам.
(function (g) {
  'use strict';

  var HOSTS = ['*://forum.ls-project.com/*'];

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
  // Родной вид форума в тех же шести цветах — для плитки «Родная» и интерфейса расширения, пока тема выключена.
  var NATIVE = { id: OFF, name: 'Родная', bg: '#141414', s1: '#242424', s2: '#2c2c2c', s3: '#383838', acc: '#6c9a64', ink: '#0b1409' };

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
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  // Цвет текста, который форум задал прямо в разметке (ник группы, цветной текст в сообщении), на тёмной теме:
  // если на светлейшей из поверхностей темы он читается хуже 4.5:1 — светлее ровно настолько, чтобы читался;
  // тон и насыщенность те же. null — менять не нужно (или темы нет).
  function liftColor(c, state) {
    var t = resolve(state);
    if (!t || !c) return null;
    var bg = palette(t).s2;
    if (contrast(c, bg) >= 4.5) return null;
    var h = toHsl(c), x = c;
    for (var i = 0; i < 60 && contrast(x, bg) < 4.5; i++) { h[2] = Math.min(1, h[2] + 0.02); x = fromHsl(h[0], h[1], h[2]); }
    return x;
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

  /* ===================== Тема → переменные форума ===================== */
  // Как переменные Invision Community (--theme-*) раскладываются по палитре. Устроено как у самого форума:
  // страница — самая тёмная, панели светлее её, кнопки ещё светлее, акцент — на выбранном и главных кнопках.
  // Текст — нейтрально-светлый с лёгким оттенком темы: тогда тема та же при любой схеме сайта (и светлой тоже).
  function siteVars(t) {
    var p = palette(t), deep = mix(p.bg, BLACK, 0.35);
    var text = mix([216, 216, 216], p.acc, 0.04), dark = mix([240, 240, 240], p.acc, 0.03), light = mix([166, 166, 166], p.acc, 0.1);
    var v = {
      page_background: p.bg, area_background: p.s1, area_background_reset: p.s1, area_background_light: p.s1b, area_background_dark: p.bg2,
      header: deep, main_nav: p.bg2, main_nav_tab: p.s1,
      secondary_title: p.s2, section_title: p.s1b, widget_title_bar: p.s1b, tab_background: p.s1b, profile_header: p.s1,
      button_bar: p.bg2, item_status: p.s1, selected: p.s3, tag: p.s2, comment_count: p.s2,
      normal_button: p.s2, light_button: p.s3, very_light_button: p.s3, alternate_button: p.s2,
      brand_primary: p.acc, featured: p.acc, mentions: p.acc, notification_bubble: p.acc, pagination_active: p.acc, prefix: p.acc,
      selected_border: p.acc, active_input_border: p.acc, primary_button: p.acc, important_button: p.acc,
      primary_button_font: p.ink, important_button_font: p.ink,
      link: text, link_hover: p.accHi, link_button: p.accHi,
      text_color: text, text_dark: dark, text_light: light, text_very_light: WHITE, timeline_color: p.s3, // по нему форум пишет белым
      header_text: dark, main_nav_font: dark, main_nav_tab_font: text, widget_title_font: dark, section_title_font: dark,
      secondary_title_font: dark, footer_text: text,
      normal_button_font: WHITE, light_button_font: WHITE, very_light_button_font: WHITE, alternate_button_font: WHITE,
      comment_count_font: WHITE, tag_font: WHITE
    };
    // фоны «сменить фон» темы Focus — в тон темы
    for (var i = 1; i <= 10; i++) v['focus_bg_' + i + '_color'] = i === 1 ? p.s2 : i === 2 ? p.s1 : i === 3 ? p.s1b : p.bg2;
    var out = '';
    Object.keys(v).forEach(function (k) { out += '--theme-' + k + ':' + v[k].join(', ') + ';'; });
    var acc = 'rgb(' + p.acc.join(', ') + ')';
    // и несколько цветов, которые тема Focus и сам форум задают не переменными --theme-*
    out += '--toggle-active--background:' + acc + ';--editor-save--background:' + acc + ';--user-nav-cta--background:' + acc + ';' +
      '--user-nav-cta--color:rgb(' + p.ink.join(', ') + ');--focus-bg--color:rgb(' + p.bg.join(', ') + ');';
    return out;
  }

  // Весь CSS темы — новые значения переменных форума. Селектор сильнее, чем :root и [data-focus-scheme],
  // в которых их задаёт сайт, — поэтому побеждает при любом порядке стилей. Без темы — пусто: форум в своих цветах
  // (новый дизайн берёт цвета из тех же переменных, ему отдельные не нужны).
  function css(state) {
    var t = resolve(state);
    if (!t) return '';
    var p = palette(t), a = p.acc.join(', ');
    var out = 'html:root:root{' + siteVars(t) + '}';
    // Места, где форум задал цвета не переменными, а прямо значениями (и часто с !important):
    // заголовки разделов (#353535) и зелёные акценты виджета сервера в шапке.
    out += 'html:not(.kadr-rd) .ipsType_sectionTitle.ipsType_sectionTitle{background:rgb(var(--theme-light_button)) none !important}' +
      'html .lsp-server-widget.lsp-server-widget{--lsp-accent:' + t.acc + '}' +
      'html .lsp-server-widget .lsp-join-button.lsp-join-button{background:rgba(' + a + ', .16) !important;border-color:rgba(' + a + ', .55) !important;color:' + hex(p.accHi) + ' !important}' +
      'html .lsp-server-widget .lsp-join-button.lsp-join-button:hover{background:rgba(' + a + ', .28) !important;border-color:' + t.acc + ' !important;color:' + hex(p.acc50) + ' !important}' +
      'html .lsp-header-widget .fivem-logo.fivem-logo{background-color:' + t.acc + ' !important}' +
      // У форума текст на фоне акцента — жёстко белый (#fff): на светлых акцентах тем он не читается (≤ 2.6:1).
      // Здесь он цвета «чернил» темы (≥ 5:1 на любом акценте, и на своём цвете тоже).
      'html .ipsTag_prefix.ipsTag_prefix,html a[data-mentionid][data-mentionid]:not(.cContentMessage a){color:' + t.ink + ' !important}' +
      'html .ipsPagination .ipsPagination_page.ipsPagination_active a,html .ipsButtonBar .ipsPagination .ipsPagination_page.ipsPagination_active a,' +
      'html .ipsButtonRow li > a.ipsButtonRow_active,html .ipsButtonRow li > button.ipsButtonRow_active,html .ipsComment.ipsComment_popular .ipsComment_popularFlag,' +
      'html .ipsCustomInput input:checked + span,html .cContentItem_delete,html .ipsSelectTree [data-role="tokenList"] .cToken,html .ipsCommentCount_hot,' +
      'html .ipsApp .ipsNotificationCount,html .focus-mobile-footer__notification,html .ipsProgressBar_progress{color:' + t.ink + '}' +
      // Красный и зелёный текст статусов (предупреждения, «обязательно», репутация) у форума рассчитан на светлый фон;
      // темы тёмные — здесь светлые варианты. Сами переменные --negative-dark и т. п. не трогаются: ими же залиты
      // кнопки и сообщения с белым текстом.
      'html .ipsType_warning,html .ipsType_negative,html .ipsType_spammer,html .memberBlockedEmailWrap,html .ipsMenu_item.ipsType_negative a,' +
      'html .ipsApp .ipsButton_link--negative,html .ipsApp .ipsButton_veryLight.ipsButton_veryLight--negative,html .ipsFieldRow_required.ipsFieldRow_required,' +
      'html .ipsForm_horizontal .ipsFieldRow_required.ipsFieldRow_required::before{color:#f07070}' +
      'html .ipsType_success,html .ipsType_positive{color:#5fd09b}' +
      'html .ipsRepBadge_negative.ipsRepBadge_negative{color:#f07070 !important}html .ipsRepBadge_positive.ipsRepBadge_positive{color:#8bd05c !important}' +
      '::selection{background-color:' + t.acc + ';color:' + t.ink + '}';
    return out;
  }

  // Ключевые цвета форума под темой — для превью в окне расширения. Без темы — родные.
  function siteLook(state) {
    var t = resolve(state) || NATIVE, p = palette(t);
    return {
      page: hex(p.bg), panel: hex(t === NATIVE ? rgb('#262626') : p.s1), raised: hex(p.s1b), line: hex(p.s3),
      acc: hex(p.acc), ink: hex(p.ink), text: '#eeeeee', text2: '#d5d5d5', muted: '#999999'
    };
  }

  g.KADR = {
    HOSTS: HOSTS, OFF: OFF, THEMES: THEMES, NATIVE: NATIVE,
    palette: palette, fromAccent: fromAccent, resolve: resolve, themeName: themeName, uiVars: uiVars,
    siteVars: siteVars, css: css, liftColor: liftColor, siteLook: siteLook
  };
})(typeof window !== 'undefined' ? window : globalThis);
