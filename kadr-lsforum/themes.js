(function (g) {
  'use strict';

  var HOSTS = ['*://forum.ls-project.com/*'];

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
    { id: 'frost',  name: 'Frost',  bg: '#091016', s1: '#101a22', s2: '#16232d', s3: '#1e2e3a', acc: '#6dd3c8', ink: '#052522' },
    { id: 'monet-white', name: 'Monet White', short: 'White', group: 'Monet', scheme: 'light', bg: '#111318', s1: '#1e1f25', s2: '#282a2f', s3: '#33353a', acc: '#adc6ff', ink: '#102f60',
      tile: { bg: '#f9f9ff', s2: '#e2e2e9', s3: '#d9d9e0', acc: '#445e91', ink: '#ffffff' },
      light: { acc: '#445e91', ink: '#ffffff', page: '#f9f9ff', card: '#ffffff', low: '#f3f3fa', mid: '#ededf4', high: '#e8e7ee', top: '#e2e2e9',
        text: '#1a1b20', text2: '#44474f', outline: '#74777f', line: '#c4c6d0', inverse: '#2f3036', onInverse: '#f0f0f7', container: '#d8e2ff', onContainer: '#2b4678', selected: '#dbe2f9' } },
    { id: 'monet-dark', name: 'Monet Dark', short: 'Dark', group: 'Monet', scheme: 'dark', bg: '#111318', s1: '#1e1f25', s2: '#282a2f', s3: '#33353a', acc: '#adc6ff', ink: '#102f60',
      text: '#e2e2e9', text2: '#f0f0f7', muted: '#c4c6d0' },
    { id: 'monet-black', name: 'Monet Black', short: 'Black', group: 'Monet', scheme: 'dark', bg: '#000000', s1: '#111318', s2: '#1e1f25', s3: '#2f3036', acc: '#adc6ff', ink: '#102f60',
      text: '#e2e2e9', text2: '#f0f0f7', muted: '#c4c6d0' }
  ];
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
  function textOn(c, bg, min) {
    if (contrast(c, bg) >= min) return c;
    var h = toHsl(c), x = c, step = lum(bg) > 0.4 ? -0.02 : 0.02;
    for (var i = 0; i < 60 && contrast(x, bg) < min; i++) { h[2] = Math.max(0, Math.min(1, h[2] + step)); x = fromHsl(h[0], h[1], h[2]); }
    return x;
  }
  function liftColor(c, state, light) {
    var t = resolve(state);
    if (!t || !c) return null;
    var x = textOn(c, light ? [236, 236, 242] : palette(t).s2, 4.5);
    return x === c ? null : x;
  }
  function fromAccent(seed) {
    var acc = rgb(seed), hsl = toHsl(acc);
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
  function uiVars(state) {
    var p = palette(resolve(state) || NATIVE), out = {};
    Object.keys(p).forEach(function (k) { out['--' + kebab(k)] = p[k].join(' '); });
    return out;
  }

  function siteVars(t) {
    var p = palette(t), deep = mix(p.bg, BLACK, 0.35);
    var text = t.text ? rgb(t.text) : mix([216, 216, 216], p.acc, 0.04), dark = t.text2 ? rgb(t.text2) : mix([240, 240, 240], p.acc, 0.03);
    var light = t.muted ? rgb(t.muted) : mix([166, 166, 166], p.acc, 0.1);
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
      text_color: text, text_dark: dark, text_light: light, text_very_light: WHITE, timeline_color: p.s3,
      header_text: dark, main_nav_font: dark, main_nav_tab_font: text, widget_title_font: dark, section_title_font: dark,
      secondary_title_font: dark, footer_text: text,
      normal_button_font: WHITE, light_button_font: WHITE, very_light_button_font: WHITE, alternate_button_font: WHITE,
      comment_count_font: WHITE, tag_font: WHITE
    };
    for (var i = 1; i <= 10; i++) v['focus_bg_' + i + '_color'] = i === 1 ? p.s2 : i === 2 ? p.s1 : i === 3 ? p.s1b : p.bg2;
    var out = '';
    Object.keys(v).forEach(function (k) { out += '--theme-' + k + ':' + v[k].join(', ') + ';'; });
    var acc = 'rgb(' + p.acc.join(', ') + ')';
    out += '--toggle-active--background:' + acc + ';--editor-save--background:' + acc + ';--user-nav-cta--background:' + acc + ';' +
      '--user-nav-cta--color:rgb(' + p.ink.join(', ') + ');--focus-bg--color:rgb(' + p.bg.join(', ') + ');' +
      '--sectiontitle--box-shadow:inset 0 0 0 1px rgba(0, 0, 0, .14);';
    return out;
  }

  var LIGHT_NATIVE = {
    active_input_border: [108, 154, 100], alternate_button: [53, 53, 53], alternate_button_font: [255, 255, 255],
    area_background: [238, 239, 239], area_background_dark: [32, 32, 32], area_background_light: [247, 247, 247], area_background_reset: [255, 255, 255],
    brand_primary: [108, 154, 100], button_bar: [255, 255, 255], comment_count: [243, 243, 243], comment_count_font: [61, 69, 78],
    featured: [108, 154, 100], footer_text: [53, 60, 65], header: [32, 32, 32], header_text: [255, 255, 255],
    important_button: [108, 154, 100], important_button_font: [0, 0, 0], item_status: [61, 69, 78],
    light_button: [242, 242, 242], light_button_font: [51, 51, 51], link: [26, 32, 44], link_button: [143, 180, 134], link_hover: [13, 15, 19],
    main_nav: [0, 0, 0], main_nav_font: [255, 255, 255], main_nav_tab: [255, 255, 255], main_nav_tab_font: [255, 255, 255],
    mentions: [108, 154, 100], normal_button: [53, 53, 53], normal_button_font: [255, 255, 255], notification_bubble: [108, 154, 100],
    page_background: [255, 255, 255], pagination_active: [108, 154, 100], prefix: [61, 69, 78],
    primary_button: [108, 154, 100], primary_button_font: [0, 0, 0], profile_header: [61, 69, 78],
    secondary_title: [255, 255, 255], secondary_title_font: [34, 34, 34], section_title: [108, 154, 100], section_title_font: [255, 255, 255],
    selected: [235, 244, 249], selected_border: [108, 154, 100], tab_background: [61, 69, 78], tag: [255, 244, 223], tag_font: [0, 0, 0],
    text_color: [53, 60, 65], text_dark: [0, 0, 0], text_light: [153, 153, 153], text_very_light: [255, 255, 255], timeline_color: [61, 69, 78],
    very_light_button: [255, 255, 255], very_light_button_font: [32, 32, 32], widget_title_bar: [255, 255, 255], widget_title_font: [26, 32, 44]
  };
  function monetLight(t) {
    var m = {}, p = palette(t);
    Object.keys(t.light).forEach(function (k) { m[k] = rgb(t.light[k]); });
    var v = {
      active_input_border: m.acc, alternate_button: m.inverse, alternate_button_font: m.onInverse,
      area_background: m.mid, area_background_dark: m.inverse, area_background_light: m.low, area_background_reset: m.card,
      brand_primary: m.acc, button_bar: m.card, comment_count: m.high, comment_count_font: m.text2,
      featured: m.acc, footer_text: m.text2, header: m.inverse, header_text: WHITE,
      important_button: m.acc, important_button_font: m.ink, item_status: m.text2,
      light_button: m.high, light_button_font: m.text, link: m.text, link_button: m.acc, link_hover: m.acc,
      main_nav: m.inverse, main_nav_font: m.onInverse, main_nav_tab: m.card, main_nav_tab_font: m.card,
      mentions: m.acc, normal_button: m.inverse, normal_button_font: m.onInverse, notification_bubble: m.acc,
      page_background: m.page, pagination_active: m.acc, prefix: m.acc,
      primary_button: m.acc, primary_button_font: m.ink, profile_header: m.text2,
      secondary_title: m.card, secondary_title_font: m.text, section_title: m.container, section_title_font: m.onContainer,
      selected: m.selected, selected_border: m.acc, tab_background: m.text2, tag: m.container, tag_font: m.onContainer,
      text_color: m.text, text_dark: m.text, text_light: m.text2, text_very_light: WHITE, timeline_color: m.text2,
      very_light_button: m.card, very_light_button_font: m.text, widget_title_bar: m.card, widget_title_font: m.text
    };
    for (var i = 1; i <= 10; i++) v['focus_bg_' + i + '_color'] = i === 1 ? p.s2 : i === 2 ? p.s1 : i === 3 ? p.s1b : p.bg2;
    var out = '';
    Object.keys(v).forEach(function (k) { out += '--theme-' + k + ':' + v[k].join(', ') + ';'; });
    return out + '--focus-bg--color:rgb(' + m.page.join(', ') + ');--kd-acc-text:rgb(' + m.acc.join(', ') + ');' +
      '--sectiontitle--box-shadow:inset 0 0 0 1px rgba(0, 0, 0, .1);--positive-dark:#1e7b4f;--negative-dark:#b3261e;';
  }
  function lightFace(t) { return t.light ? { id: t.id, name: t.name, bg: t.bg, s1: t.s1, s2: t.s2, s3: t.s3, acc: t.light.acc, ink: t.light.ink } : t; }
  function siteVarsLight(t) {
    if (t.light) return monetLight(t);
    var p = palette(t), ah = toHsl(p.acc), hue = ah[0], sat = Math.min(0.3, ah[1] * 0.3);
    var accText = textOn(p.acc, WHITE, 4.5), v = {};
    Object.keys(LIGHT_NATIVE).forEach(function (k) {
      var c = LIGHT_NATIVE[k];
      v[k] = c[0] === 108 && c[1] === 154 && c[2] === 100 ? p.acc : fromHsl(hue, sat, toHsl(c)[2]);
    });
    v.page_background = fromHsl(hue, sat, 0.955);
    v.text_light = fromHsl(hue, sat * 0.5, 0.42);
    v.link_button = accText; v.link_hover = accText;
    v.primary_button_font = p.ink; v.important_button_font = p.ink; v.section_title_font = p.ink;
    v.prefix = p.acc; v.tag = mix(WHITE, p.acc, 0.16); v.selected = mix(WHITE, p.acc, 0.12);
    v.main_nav = p.bg; v.header = p.s1;
    for (var i = 1; i <= 10; i++) v['focus_bg_' + i + '_color'] = i === 1 ? p.s2 : i === 2 ? p.s1 : i === 3 ? p.s1b : p.bg2;
    var out = '';
    Object.keys(v).forEach(function (k) { out += '--theme-' + k + ':' + v[k].join(', ') + ';'; });
    return out + '--focus-bg--color:rgb(' + v.page_background.join(', ') + ');--kd-acc-text:rgb(' + accText.join(', ') + ');' +
      '--sectiontitle--box-shadow:inset 0 0 0 1px rgba(0, 0, 0, .1);';
  }
  function accentText(t, light) { var p = palette(light ? lightFace(t) : t); return light ? textOn(p.acc, WHITE, 4.5) : p.acc; }
  function forced(state) { var t = resolve(state); return t && t.scheme ? t.scheme : null; }

  function css(state) {
    var t0 = resolve(state);
    if (!t0) return '';
    var t = t0.scheme === 'light' ? lightFace(t0) : t0;
    var p = palette(t), p0 = palette(t0), a = p0.acc.join(', ');
    var darkBlock = siteVars(t0) + '--kd-acc-text:' + t0.acc + ';', lightBlock = siteVarsLight(t0);
    var out = t0.scheme === 'light' ? 'html:root:root,html:root:root[data-focus-scheme="light"]{' + lightBlock + '}'
      : t0.scheme === 'dark' ? 'html:root:root,html:root:root[data-focus-scheme="light"]{' + darkBlock + '}'
      : 'html:root:root{' + darkBlock + '}html:root:root[data-focus-scheme="light"]{' + lightBlock + '}';
    var D = 'html:not([data-focus-scheme="light"]) ';
    out += 'html:root:root{--kd-bar-acc:' + t0.acc + '}' + (t0.scheme === 'light' ? 'html #ipsLayout_footer #elCopyright{opacity:1}' : '') +
      'html:not(.kadr-rd) .ipsType_sectionTitle.ipsType_sectionTitle{background:rgb(var(--theme-light_button)) none !important}' +
      'html .lsp-server-widget.lsp-server-widget{--lsp-accent:' + t0.acc + '}' +
      'html .lsp-server-widget .lsp-join-button.lsp-join-button{background:rgba(' + a + ', .16) !important;border-color:rgba(' + a + ', .55) !important;color:' + hex(p0.accHi) + ' !important}' +
      'html .lsp-server-widget .lsp-join-button.lsp-join-button:hover{background:rgba(' + a + ', .28) !important;border-color:' + t0.acc + ' !important;color:' + hex(p0.acc50) + ' !important}' +
      'html .lsp-header-widget .fivem-logo.fivem-logo{background-color:' + t0.acc + ' !important}' +
      'html .lsp-header-widget .lsp-server-widget .icon.icon{color:' + t0.acc + ' !important}' +
      'html .lsp-header-widget .lsp-server-widget .progress-fill.progress-fill{background:' + t0.acc + ' !important}' +
      'html .ipsTag_prefix.ipsTag_prefix,html a[data-mentionid][data-mentionid]:not(.cContentMessage a){color:' + t.ink + ' !important}' +
      'html .ipsPagination .ipsPagination_page.ipsPagination_active a,html .ipsButtonBar .ipsPagination .ipsPagination_page.ipsPagination_active a,' +
      'html .ipsButtonRow li > a.ipsButtonRow_active,html .ipsButtonRow li > button.ipsButtonRow_active,html .ipsComment.ipsComment_popular .ipsComment_popularFlag,' +
      'html .ipsCustomInput input:checked + span,html .cContentItem_delete,html .ipsSelectTree [data-role="tokenList"] .cToken,html .ipsCommentCount_hot,' +
      'html .ipsApp .ipsNotificationCount,html .focus-mobile-footer__notification,html .ipsProgressBar_progress{color:' + t.ink + '}' +
      [D + '.ipsType_warning', D + '.ipsType_negative', D + '.ipsType_spammer', D + '.memberBlockedEmailWrap', D + '.ipsMenu_item.ipsType_negative a',
        D + '.ipsApp .ipsButton_link--negative', D + '.ipsApp .ipsButton_veryLight.ipsButton_veryLight--negative', D + '.ipsFieldRow_required.ipsFieldRow_required',
        D + '.ipsForm_horizontal .ipsFieldRow_required.ipsFieldRow_required::before'].join(',') + '{color:#f07070}' +
      D + '.ipsType_success,' + D + '.ipsType_positive{color:#5fd09b}' +
      D + '.ipsRepBadge_negative.ipsRepBadge_negative{color:#f07070 !important}' + D + '.ipsRepBadge_positive.ipsRepBadge_positive{color:#8bd05c !important}' +
      '::selection{background-color:' + t.acc + ';color:' + t.ink + '}';
    return out;
  }

  function siteLook(state, light) {
    var t = resolve(state);
    if (t && t.scheme) light = t.scheme === 'light';
    if (t && t.light) {
      var L = t.light;
      return { page: L.page, panel: L.card, raised: L.mid, line: L.line, acc: L.acc, ink: L.ink, text: L.text, text2: L.text2, muted: L.text2, dark: false };
    }
    if (light) {
      if (!t) return { page: '#ffffff', panel: '#ffffff', raised: '#f7f7f7', line: '#dfe1e2', acc: '#6c9a64', ink: '#000000', text: '#000000', text2: '#353c41', muted: '#6d7378', dark: false };
      var lp = palette(t), ah = toHsl(lp.acc), sat = Math.min(0.3, ah[1] * 0.3);
      return {
        page: hex(fromHsl(ah[0], sat, 0.955)), panel: '#ffffff', raised: hex(fromHsl(ah[0], sat, 0.97)), line: hex(fromHsl(ah[0], sat, 0.88)),
        acc: hex(lp.acc), ink: hex(lp.ink), text: hex(fromHsl(ah[0], sat, 0.08)), text2: hex(fromHsl(ah[0], sat, 0.23)), muted: hex(fromHsl(ah[0], sat * 0.5, 0.42)), dark: false
      };
    }
    var p = palette(t || NATIVE);
    return {
      page: hex(p.bg), panel: hex(t ? p.s1 : rgb('#262626')), raised: hex(p.s1b), line: hex(p.s3),
      acc: hex(p.acc), ink: hex(p.ink), text: t && t.text ? t.text : '#eeeeee', text2: t && t.muted ? t.muted : '#d5d5d5', muted: t && t.muted ? '#8e9099' : '#999999', dark: true
    };
  }

  g.KADR = {
    HOSTS: HOSTS, OFF: OFF, THEMES: THEMES, NATIVE: NATIVE,
    palette: palette, fromAccent: fromAccent, resolve: resolve, themeName: themeName, uiVars: uiVars,
    siteVars: siteVars, siteVarsLight: siteVarsLight, css: css, liftColor: liftColor, accentText: accentText, textOn: textOn, forced: forced,
    contrast: contrast, toHsl: toHsl, fromHsl: fromHsl, hex: hex, rgb: rgb, siteLook: siteLook
  };
})(typeof window !== 'undefined' ? window : globalThis);
