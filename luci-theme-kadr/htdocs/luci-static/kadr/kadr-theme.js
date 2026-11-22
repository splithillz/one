(function (g) {
	'use strict';

	var KEY = 'kadr-luci-theme';
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

	function rgb(hex) {
		var h = String(hex).replace('#', '');
		if (!/^[0-9a-f]{6}$/i.test(h))
			h = '3fe0a1';
		var n = parseInt(h, 16);
		return [n >> 16 & 255, n >> 8 & 255, n & 255];
	}

	function hex(a) {
		return '#' + a.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
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

	function load() {
		try {
			var s = JSON.parse(g.localStorage.getItem(KEY) || 'null');
			if (s && typeof s.theme === 'string')
				return { theme: s.theme, seed: typeof s.seed === 'string' ? s.seed : '' };
		}
		catch (e) {}
		return { theme: 'mint', seed: '' };
	}

	function save(state) {
		try {
			g.localStorage.setItem(KEY, JSON.stringify(state));
		}
		catch (e) {}
	}

	function resolve(state) {
		if (state && state.theme === 'custom' && /^#[0-9a-f]{6}$/i.test(state.seed || ''))
			return fromAccent(state.seed);
		for (var i = 0; i < THEMES.length; i++)
			if (state && THEMES[i].id === state.theme)
				return THEMES[i];
		return THEMES[0];
	}

	function apply(state) {
		var t = resolve(state), root = g.document.documentElement;
		['bg', 's1', 's2', 's3', 'acc', 'ink'].forEach(function (k) {
			root.style.setProperty('--k-' + k, rgb(t[k]).join(' '));
		});
		root.setAttribute('data-kadr-theme', t.id);
		var meta = g.document.querySelector('meta[name="theme-color"]');
		if (meta)
			meta.setAttribute('content', t.bg);
		return t;
	}

	var state = load();

	g.KadrTheme = {
		themes: THEMES,
		fromAccent: fromAccent,
		resolve: resolve,
		get: function () { return state; },
		set: function (next) {
			state = { theme: next.theme, seed: next.seed || '' };
			save(state);
			return apply(state);
		}
	};

	apply(state);
})(window);
