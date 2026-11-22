(function (g) {
	'use strict';

	var D = g.document;
	var TAU = Math.PI * 2;
	var PIX = 2;
	var PIX_SCALE = 1.45;
	var CRAWL_SCALE = 1.3;
	var REACH = .9;

	function ell(c, x, y, rx, ry, a0, a1) {
		c.beginPath();
		c.ellipse(x, y, rx, ry, 0, a0 || 0, a1 === undefined ? TAU : a1);
	}

	function fill(c, col) {
		c.fillStyle = col;
		c.fill();
	}

	function oval(c, x, y, rx, ry, col) {
		ell(c, x, y, rx, ry);
		fill(c, col);
	}

	function path(c, w, col, pts) {
		c.beginPath();
		c.moveTo(pts[0], pts[1]);
		for (var i = 2; i < pts.length; i += 2)
			c.lineTo(pts[i], pts[i + 1]);
		c.lineWidth = w;
		c.strokeStyle = col;
		c.stroke();
	}

	function bend(c, w, col, x0, y0, cx, cy, x1, y1) {
		c.beginPath();
		c.moveTo(x0, y0);
		c.quadraticCurveTo(cx, cy, x1, y1);
		c.lineWidth = w;
		c.strokeStyle = col;
		c.stroke();
	}

	function arc(c, w, col, x, y, rx, ry) {
		ell(c, x, y, rx, ry, Math.PI, TAU);
		c.lineWidth = w;
		c.strokeStyle = col;
		c.stroke();
	}

	function white(a) {
		return 'rgba(255,255,255,' + a + ')';
	}

	function shade(hex, k) {
		var n = parseInt(hex.slice(1), 16);
		return 'rgb(' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { return Math.round(v * k); }).join(',') + ')';
	}

	function both(fn) {
		fn(1);
		fn(-1);
	}

	var SPECIES = [
		{
			id: 'ladybug', len: 13, speed: 26,
			head: [-.37, .15, .08], pro: [-.26, .27, .1], ely: [.1, .42, .38],
			legs: { y: [-.24, -.12, 0], x: .14, f: .16, t: .17, w: .05 },
			ant: { type: 'club', x: .07, y: -.42, len: .16, w: .03 },
			col: { head: '#121212', pro: '#141414', ely: '#d42a1f', leg: '#141414', ant: '#141414' },
			side: { clear: .1, eh: .38, ph: .17, hh: .1 },
			gloss: 1,
			marks: function (c, R, v, G) {
				var k = '#111';
				if (v === 'top') {
					oval(c, 0, -.12, .075, .075, k);
					[[.2, -.02, .075], [.27, .18, .07], [.13, .33, .06]].forEach(function (s) {
						oval(c, s[0], s[1], s[2], s[2], k);
						oval(c, -s[0], s[1], s[2], s[2], k);
					});
				}
				else {
					oval(c, G.ex + .2, G.base - G.eh * .6, .06, .055, k);
					oval(c, G.ex - .02, G.base - G.eh * .8, .065, .06, k);
					oval(c, G.ex - .24, G.base - G.eh * .45, .055, .05, k);
					oval(c, G.ex + .03, G.base - G.eh * .3, .05, .045, k);
				}
			},
			proMarks: function (c, R, v, G) {
				if (v === 'top')
					both(function (s) { oval(c, s * .17, G.py - .01, .06, .045, '#f1ede2'); });
				else
					oval(c, G.px + G.pr * .5, G.base - G.ph * .45, .05, .04, '#f1ede2');
			}
		},
		{
			id: 'stag', len: 32, speed: 22,
			head: [-.2, .16, .075], pro: [-.08, .17, .07], ely: [.21, .19, .27],
			legs: { y: [-.09, .03, .15], x: .12, f: .18, t: .21, w: .04 },
			ant: { type: 'elbow', x: .12, y: -.24, len: .14, w: .025 },
			col: { head: '#2b170c', pro: '#2a160c', ely: '#4a2614', leg: '#1d110a', ant: '#1d110a', mand: '#7a2f16' },
			side: { clear: .08, eh: .16, ph: .1, hh: .07 },
			gloss: 1.2,
			extra: function (c, R, v, st, G) {
				if (st !== 'pre')
					return;
				var m = R.C(this.col.mand), w = .045;
				if (v === 'top') {
					both(function (s) {
						bend(c, w, m, s * .07, -.26, s * .21, -.36, s * .06, -.49);
						path(c, w * .8, m, [s * .15, -.38, s * .09, -.4]);
					});
				}
				else {
					var hx = G.hx + G.hr * .8;
					bend(c, w, R.far(this.col.mand), hx - .03, G.base - G.hh * .9, hx + .1, G.base - .2, hx + .22, G.base - .13);
					bend(c, w, m, hx, G.base - G.hh * .6, hx + .13, G.base - .17, hx + .25, G.base - .08);
					path(c, w * .7, m, [hx + .13, G.base - .13, hx + .15, G.base - .19]);
				}
			}
		},
		{
			id: 'cockchafer', len: 22, speed: 30,
			head: [-.39, .1, .065], pro: [-.28, .17, .085], ely: [.05, .22, .3],
			legs: { y: [-.27, -.17, -.05], x: .12, f: .15, t: .17, w: .042 },
			ant: { type: 'fan', x: .06, y: -.43, len: .13, w: .025 },
			col: { head: '#22160e', pro: '#24170f', ely: '#9b6230', leg: '#5a3a1e', ant: '#3b2614', tip: '#6a4426' },
			side: { clear: .1, eh: .24, ph: .15, hh: .08 },
			gloss: .5,
			marks: function (c, R, v, G) {
				var r = 'rgba(214,160,100,.55)';
				if (v === 'top') {
					[.06, .13].forEach(function (x) {
						both(function (s) { path(c, .018, r, [s * x, G.ey - G.ery * .7, s * x * .9, G.ey + G.ery * .9]); });
					});
				}
				else {
					arc(c, .018, r, G.ex, G.base, G.er * .97, G.eh * .45);
					arc(c, .018, r, G.ex, G.base, G.er * .97, G.eh * .75);
				}
			},
			extra: function (c, R, v, st, G) {
				if (st !== 'pre')
					return;
				var tip = R.C(this.col.tip);
				if (v === 'top') {
					c.beginPath();
					c.moveTo(-.09, .3);
					c.lineTo(.09, .3);
					c.lineTo(0, .49);
					c.closePath();
					fill(c, tip);
					if (!R.mono)
						[0, .12, .24].forEach(function (y) {
							both(function (s) {
								c.beginPath();
								c.moveTo(s * .2, y - .035);
								c.lineTo(s * .255, y);
								c.lineTo(s * .2, y + .035);
								fill(c, '#f4efe4');
							});
						});
				}
				else {
					var rx = G.ex - G.er;
					c.beginPath();
					c.moveTo(rx + .06, G.base - .03);
					c.lineTo(rx - .07, G.base + .05);
					c.lineTo(rx + .08, G.base + .03);
					c.closePath();
					fill(c, tip);
				}
			}
		},
		{
			id: 'colorado', len: 16, speed: 24,
			head: [-.38, .1, .07], pro: [-.27, .2, .085], ely: [.1, .3, .35],
			legs: { y: [-.26, -.14, -.02], x: .14, f: .13, t: .14, w: .045 },
			ant: { type: 'club', x: .06, y: -.43, len: .14, w: .025 },
			col: { head: '#cf7a28', pro: '#d98832', ely: '#ead27c', leg: '#b66a2a', ant: '#2a1a10' },
			side: { clear: .1, eh: .32, ph: .15, hh: .09 },
			gloss: .6,
			marks: function (c, R, v, G) {
				var k = '#161310';
				if (v === 'top') {
					[.05, .1, .155, .205, .255].forEach(function (x, i) {
						both(function (s) {
							bend(c, .032, k, s * x, G.ey - G.ery * .8, s * (x + .012 * (i - 1)), G.ey, s * x * .72, G.ey + G.ery * (.95 - i * .06));
						});
					});
				}
				else {
					[.3, .55, .8].forEach(function (h) { arc(c, .032, k, G.ex, G.base, G.er * .98, G.eh * h); });
				}
			},
			proMarks: function (c, R, v, G) {
				if (v !== 'top')
					return;
				oval(c, 0, G.py, .022, .03, '#161310');
				both(function (s) {
					oval(c, s * .075, G.py - .02, .018, .022, '#161310');
					oval(c, s * .13, G.py + .015, .016, .02, '#161310');
				});
			}
		},
		{
			id: 'bronze', len: 19, speed: 34,
			head: [-.38, .09, .07], pro: [-.25, .21, .1], ely: [.1, .24, .32],
			legs: { y: [-.24, -.13, -.01], x: .14, f: .14, t: .16, w: .045 },
			ant: { type: 'club', x: .05, y: -.43, len: .12, w: .025 },
			col: { head: '#2a7c37', pro: '#2f8a3d', ely: '#2c8a3c', leg: '#23402a', ant: '#23402a' },
			metal: ['#a8f27f', '#2c8a3c', '#124d22'],
			side: { clear: .09, eh: .24, ph: .16, hh: .08 },
			gloss: 1.4,
			marks: function (c, R, v, G) {
				var w = white(.75);
				if (v === 'top')
					[[.1, .22], [.15, .31], [.06, .35], [.17, .12]].forEach(function (p) {
						both(function (s) { oval(c, s * p[0], p[1], .018, .012, w); });
					});
				else
					[[-.12, .35], [.05, .3], [-.25, .2]].forEach(function (p) { oval(c, G.ex + p[0], G.base - G.eh * p[1], .02, .012, w); });
			}
		},
		{
			id: 'rhino', len: 30, speed: 20,
			head: [-.3, .12, .075], pro: [-.15, .24, .12], ely: [.18, .24, .28],
			legs: { y: [-.15, -.03, .1], x: .16, f: .16, t: .17, w: .05 },
			ant: { type: 'fan', x: .08, y: -.33, len: .1, w: .025 },
			col: { head: '#43210f', pro: '#5a2c12', ely: '#63320f', leg: '#331a0b', ant: '#331a0b', horn: '#3a1d0d' },
			side: { clear: .1, eh: .22, ph: .2, hh: .08 },
			gloss: 1.3,
			extra: function (c, R, v, st, G) {
				if (st !== 'post')
					return;
				var h = R.C(this.col.horn);
				c.beginPath();
				if (v === 'top') {
					c.moveTo(-.035, -.32);
					c.quadraticCurveTo(-.012, -.45, 0, -.5);
					c.quadraticCurveTo(.012, -.45, .035, -.32);
				}
				else {
					var hx = G.hx + G.hr * .5;
					c.moveTo(hx - .05, G.base - G.hh * 1.3);
					c.quadraticCurveTo(hx + .09, G.base - .3, hx - .03, G.base - .43);
					c.quadraticCurveTo(hx + .03, G.base - .28, hx + .06, G.base - G.hh * .8);
				}
				c.closePath();
				fill(c, h);
			}
		},
		{
			id: 'weevil', len: 12, speed: 18,
			head: [-.23, .08, .06], pro: [-.12, .13, .09], ely: [.17, .2, .26],
			legs: { y: [-.14, -.03, .08], x: .1, f: .13, t: .14, w: .045 },
			ant: { type: 'elbow', x: .03, y: -.37, len: .16, w: .022 },
			col: { head: '#5e4b39', pro: '#6a5642', ely: '#776350', leg: '#5a4a3a', ant: '#5a4a3a', snout: '#5e4b39' },
			side: { clear: .1, eh: .28, ph: .18, hh: .07 },
			gloss: .4,
			marks: function (c, R, v, G) {
				var k = '#ad9a82';
				if (v === 'top')
					[[.06, -.02], [.13, .08], [.05, .2], [.14, .26], [.08, .35]].forEach(function (p) {
						both(function (s) { oval(c, s * p[0], p[1], .025, .025, k); });
					});
				else
					[[-.15, .5], [.05, .7], [-.05, .3], [.15, .4], [-.25, .25]].forEach(function (p) { oval(c, G.ex + p[0], G.base - G.eh * p[1], .025, .025, k); });
			},
			extra: function (c, R, v, st, G) {
				if (st !== 'pre')
					return;
				var s = R.C(this.col.snout);
				if (v === 'top')
					path(c, .07, s, [0, -.27, 0, -.48]);
				else
					bend(c, .065, s, G.hx + G.hr * .5, G.base - G.hh * .5, G.hx + .2, G.base - .02, G.hx + .27, G.base + .05);
			}
		},
		{
			id: 'firefly', len: 15, speed: 30, headUnder: true,
			head: [-.36, .07, .05], pro: [-.3, .17, .13], ely: [.08, .17, .3],
			legs: { y: [-.22, -.1, .02], x: .1, f: .12, t: .13, w: .04 },
			ant: { type: 'thread', x: .04, y: -.42, len: .25, w: .02 },
			col: { head: '#2e251b', pro: '#c9a54d', ely: '#3a3026', leg: '#3a3026', ant: '#3a3026', glow: '#e9ff63' },
			side: { clear: .09, eh: .16, ph: .1, hh: .06 },
			gloss: .3,
			proMarks: function (c, R, v, G) {
				if (v === 'top')
					oval(c, 0, G.py + .01, .07, .06, '#3b2f22');
				else
					oval(c, G.px - .02, G.base - G.ph * .7, .06, .04, '#3b2f22');
			},
			extra: function (c, R, v, st, G) {
				if (st !== 'pre')
					return;
				var x = 0, y = .4, pulse = .55 + .45 * Math.sin(R.t * 3 + R.seed);
				if (v === 'side') {
					x = G.ex - G.er * .75;
					y = G.base + .01;
				}
				if (!R.flat) {
					var gr = c.createRadialGradient(x, y, 0, x, y, .36);
					gr.addColorStop(0, R.mono ? R.accA(.45 * pulse) : 'rgba(225,255,90,' + (.55 * pulse) + ')');
					gr.addColorStop(1, 'rgba(225,255,90,0)');
					oval(c, x, y, .36, .36, gr);
				}
				oval(c, x, y, v === 'top' ? .11 : .12, v === 'top' ? .08 : .05, R.C(this.col.glow));
			}
		},
		{
			id: 'carabus', len: 24, speed: 70,
			head: [-.38, .085, .07], pro: [-.25, .15, .09], ely: [.12, .21, .33],
			legs: { y: [-.25, -.12, 0], x: .1, f: .2, t: .25, w: .035 },
			ant: { type: 'thread', x: .05, y: -.43, len: .3, w: .02 },
			col: { head: '#121214', pro: '#16111c', ely: '#18121f', leg: '#0f0f12', ant: '#111114', rim: 'rgba(123,82,216,.8)' },
			side: { clear: .14, eh: .17, ph: .12, hh: .07 },
			gloss: .8,
			marks: function (c, R, v, G) {
				var r = this.col.rim, p = 'rgba(160,130,230,.45)';
				if (v === 'top') {
					ell(c, 0, G.ey, G.erx, G.ery);
					c.lineWidth = .032;
					c.strokeStyle = r;
					c.stroke();
					[.06, .12].forEach(function (x) {
						for (var y = -.12; y < .4; y += .07)
							both(function (s) { oval(c, s * x, y, .012, .012, p); });
					});
				}
				else {
					ell(c, G.ex, G.base, G.er, G.eh * .3, 0, Math.PI);
					c.lineWidth = .06;
					c.strokeStyle = r;
					c.stroke();
					arc(c, .015, p, G.ex, G.base, G.er * .95, G.eh * .6);
				}
			},
			extra: function (c, R, v, st, G) {
				if (st !== 'pre')
					return;
				var m = R.C(this.col.head);
				if (v === 'top')
					both(function (s) { bend(c, .03, m, s * .03, -.42, s * .07, -.48, s * .01, -.5); });
				else
					bend(c, .03, m, G.hx + G.hr * .6, G.base - G.hh * .4, G.hx + .13, G.base - G.hh * .5, G.hx + .14, G.base - .01);
			}
		},
		{
			id: 'scarab', len: 22, speed: 28,
			head: [-.33, .2, .1], pro: [-.15, .25, .12], ely: [.18, .24, .26],
			legs: { y: [-.18, -.04, .1], x: .16, f: .15, t: .18, w: .05 },
			ant: { type: 'fan', x: .1, y: -.37, len: .1, w: .025 },
			col: { head: '#161616', pro: '#1a1a1a', ely: '#1d1d1d', leg: '#101010', ant: '#7a4422' },
			side: { clear: .1, eh: .22, ph: .17, hh: .06 },
			gloss: .9,
			marks: function (c, R, v, G) {
				var k = 'rgba(255,255,255,.07)';
				if (v === 'top')
					[.05, .1, .15, .2].forEach(function (x) {
						both(function (s) { path(c, .014, k, [s * x, G.ey - G.ery * .8, s * x * .85, G.ey + G.ery * .9]); });
					});
				else
					[.4, .7].forEach(function (h) { arc(c, .014, k, G.ex, G.base, G.er * .96, G.eh * h); });
			},
			extra: function (c, R, v, st, G) {
				if (st !== 'post')
					return;
				var t = R.C(this.col.head);
				if (v === 'top') {
					for (var i = -2.5; i <= 2.5; i++) {
						var a = -Math.PI / 2 + i * .32, x = Math.cos(a) * .2, y = -.33 + Math.sin(a) * .1;
						c.beginPath();
						c.moveTo(x - .025, y + .01);
						c.lineTo(x + Math.cos(a) * .045, y + Math.sin(a) * .045);
						c.lineTo(x + .025, y + .01);
						fill(c, t);
					}
				}
				else {
					var hx = G.hx + G.hr;
					c.beginPath();
					c.moveTo(hx - .03, G.base - G.hh * .9);
					c.lineTo(hx + .05, G.base - G.hh * .3);
					c.lineTo(hx - .03, G.base);
					fill(c, t);
				}
			}
		}
	];

	function legsTop(c, sp, ph, R) {
		var L = sp.legs, ang = [-.7, .1, .78], bnd = [-.5, .28, .5];
		c.lineWidth = L.w;
		c.strokeStyle = R.C(sp.col.leg);
		for (var i = 0; i < 3; i++)
			for (var s = -1; s <= 1; s += 2) {
				var grp = (i % 2 === 0) === (s > 0) ? 0 : Math.PI;
				var a = ang[i] + Math.sin(ph + grp) * .32;
				var bx = s * L.x, by = L.y[i];
				var kx = bx + s * Math.cos(a) * L.f, ky = by + Math.sin(a) * L.f;
				var a2 = a + bnd[i];
				c.beginPath();
				c.moveTo(bx, by);
				c.lineTo(kx, ky);
				c.lineTo(kx + s * Math.cos(a2) * L.t, ky + Math.sin(a2) * L.t);
				c.stroke();
			}
	}

	function antTop(c, sp, R) {
		var A = sp.ant, col = R.C(sp.col.ant), w = Math.sin(R.t * (R.still ? 9 : 4) + R.seed) * (R.still ? .07 : .03);
		both(function (s) {
			var bx = s * A.x, by = A.y, l = A.len;
			if (A.type === 'thread') {
				bend(c, A.w, col, bx, by, s * (A.x + l * .2), by - l * .6, s * (A.x + l * .55 + w), by - l * .95);
			}
			else if (A.type === 'club') {
				path(c, A.w, col, [bx, by, s * (A.x + l * .4 + w), by - l * .85]);
				oval(c, s * (A.x + l * .4 + w), by - l * .85, A.w * 1.6, A.w * 1.6, col);
			}
			else if (A.type === 'fan') {
				var ex = s * (A.x + l * .35 + w), ey = by - l * .6;
				path(c, A.w, col, [bx, by, ex, ey]);
				for (var k = -1; k <= 1; k++)
					path(c, A.w * .9, col, [ex, ey, ex + s * (.04 + k * .02), ey - .05 + Math.abs(k) * .015]);
			}
			else {
				var mx = s * (A.x + l * .1), my = by - l * .55;
				path(c, A.w, col, [bx, by, mx, my, s * (A.x + l * .65 + w), by - l * .8]);
				oval(c, s * (A.x + l * .65 + w), by - l * .8, A.w * 1.3, A.w * 1.3, col);
			}
		});
	}

	function body(c, sp, R, G) {
		var e = sp.ely, col = R.C(sp.col.ely);
		if (sp.metal && !R.mono) {
			col = c.createLinearGradient(-e[1], e[0] - e[2], e[1], e[0] + e[2]);
			col.addColorStop(0, sp.metal[0]);
			col.addColorStop(.45, sp.metal[1]);
			col.addColorStop(1, sp.metal[2]);
		}
		oval(c, 0, e[0], e[1], e[2], col);
		if (R.mono)
			return;
		if (sp.marks) {
			c.save();
			ell(c, 0, e[0], e[1], e[2]);
			c.clip();
			sp.marks(c, R, 'top', G);
			c.restore();
		}
		path(c, R.px * 1.1, 'rgba(0,0,0,.4)', [0, e[0] - e[2] * .78, 0, e[0] + e[2] * .98]);
		if (sp.gloss) {
			oval(c, -e[1] * .42, e[0] - e[2] * .28, e[1] * .15, e[2] * .3, white(.26 * sp.gloss));
			oval(c, e[1] * .46, e[0] - e[2] * .32, e[1] * .08, e[2] * .18, white(.14 * sp.gloss));
		}
	}

	function drawTop(c, sp, ph, R) {
		var e = sp.ely, p = sp.pro, h = sp.head;
		var G = { ey: e[0], erx: e[1], ery: e[2], py: p[0], prx: p[1], pry: p[2], hy: h[0], hrx: h[1], hry: h[2] };
		legsTop(c, sp, ph, R);
		antTop(c, sp, R);
		if (sp.extra)
			sp.extra(c, R, 'top', 'pre', G);
		body(c, sp, R, G);
		if (sp.headUnder)
			oval(c, 0, h[0], h[1], h[2], R.C(sp.col.head));
		var pc = R.C(sp.col.pro);
		if (sp.metal && !R.mono) {
			pc = c.createLinearGradient(-p[1], p[0] - p[2], p[1], p[0] + p[2]);
			pc.addColorStop(0, sp.metal[0]);
			pc.addColorStop(1, sp.metal[2]);
		}
		oval(c, 0, p[0], p[1], p[2], pc);
		if (!R.mono) {
			if (sp.proMarks)
				sp.proMarks(c, R, 'top', G);
			if (sp.gloss)
				oval(c, -p[1] * .35, p[0] - p[2] * .3, p[1] * .2, p[2] * .25, white(.18 * sp.gloss));
		}
		if (!sp.headUnder)
			oval(c, 0, h[0], h[1], h[2], R.C(sp.col.head));
		if (sp.extra)
			sp.extra(c, R, 'top', 'post', G);
		if (R.rim) {
			c.lineWidth = R.px;
			c.strokeStyle = R.rim;
			ell(c, 0, e[0], e[1], e[2]);
			c.stroke();
			ell(c, 0, p[0], p[1], p[2]);
			c.stroke();
		}
	}

	function legsSide(c, sp, ph, R, far, base) {
		var L = sp.legs, reach = (L.f + L.t) * .8, dir = [.6, .05, -.7];
		var col = far ? R.far(sp.col.leg) : R.C(sp.col.leg);
		for (var i = 0; i < 3; i++) {
			var phase = ph + (far ? Math.PI : 0) + (i % 2) * Math.PI;
			var step = Math.sin(phase) * .06, lift = Math.max(0, Math.cos(phase)) * .045;
			var ax = -L.y[i] - (far ? .02 : 0);
			var fx = ax + dir[i] * reach * .55 + step;
			var kx = ax + dir[i] * reach * .32 + step * .4 + (i === 0 ? .03 : i === 2 ? -.03 : 0);
			path(c, L.w, col, [ax, base + .01, kx, base - .045 - lift * .3, fx, -lift]);
		}
	}

	function antSide(c, sp, R, G) {
		var A = sp.ant, col = R.C(sp.col.ant), l = A.len, w = Math.sin(R.t * (R.still ? 9 : 4) + R.seed) * (R.still ? .05 : .02);
		var bx = G.hx + G.hr * .55, by = G.base - G.hh * .95;
		if (A.type === 'thread') {
			bend(c, A.w, col, bx, by, bx + l * .4, by - l * .55, bx + l * .85, by - l * .55 + w);
		}
		else if (A.type === 'club') {
			path(c, A.w, col, [bx, by, bx + l * .6, by - l * .55 + w]);
			oval(c, bx + l * .6, by - l * .55 + w, A.w * 1.6, A.w * 1.6, col);
		}
		else if (A.type === 'fan') {
			var ex = bx + l * .45, ey = by - l * .35 + w;
			path(c, A.w, col, [bx, by, ex, ey]);
			for (var k = -1; k <= 1; k++)
				path(c, A.w * .9, col, [ex, ey, ex + .05, ey - .02 + k * .025]);
		}
		else {
			path(c, A.w, col, [bx, by, bx + l * .35, by - l * .5, bx + l * .8, by - l * .4 + w]);
			oval(c, bx + l * .8, by - l * .4 + w, A.w * 1.3, A.w * 1.3, col);
		}
	}

	function drawSide(c, sp, ph, R) {
		var s = sp.side, e = sp.ely, p = sp.pro, h = sp.head;
		var G = { base: -s.clear, ex: -e[0], er: e[2], eh: s.eh, px: -p[0], pr: p[2] * 1.15, ph: s.ph, hx: -h[0], hr: h[2] * 1.25, hh: s.hh };
		legsSide(c, sp, ph, R, true, G.base);
		if (sp.extra)
			sp.extra(c, R, 'side', 'pre', G);
		var ec = R.C(sp.col.ely);
		if (sp.metal && !R.mono) {
			ec = c.createLinearGradient(0, G.base - G.eh, 0, G.base);
			ec.addColorStop(0, sp.metal[0]);
			ec.addColorStop(.5, sp.metal[1]);
			ec.addColorStop(1, sp.metal[2]);
		}
		oval(c, G.hx, G.base - G.hh * .35, G.hr, G.hh, R.C(sp.col.head));
		var pc = R.C(sp.col.pro);
		c.beginPath();
		c.ellipse(G.px, G.base, G.pr, G.ph, 0, Math.PI, TAU);
		c.ellipse(G.px, G.base, G.pr, G.ph * .3, 0, 0, Math.PI);
		fill(c, pc);
		if (!R.mono && sp.proMarks)
			sp.proMarks(c, R, 'side', G);
		c.beginPath();
		c.ellipse(G.ex, G.base, G.er, G.eh, 0, Math.PI, TAU);
		c.ellipse(G.ex, G.base, G.er, G.eh * .28, 0, 0, Math.PI);
		fill(c, ec);
		if (!R.mono) {
			if (sp.marks) {
				c.save();
				c.beginPath();
				c.ellipse(G.ex, G.base, G.er, G.eh, 0, Math.PI, TAU);
				c.ellipse(G.ex, G.base, G.er, G.eh * .28, 0, 0, Math.PI);
				c.clip();
				sp.marks(c, R, 'side', G);
				c.restore();
			}
			if (sp.gloss)
				oval(c, G.ex + G.er * .12, G.base - G.eh * .78, G.er * .42, G.eh * .11, white(.25 * sp.gloss));
		}
		antSide(c, sp, R, G);
		if (sp.extra)
			sp.extra(c, R, 'side', 'post', G);
		if (R.rim) {
			c.lineWidth = R.px;
			c.strokeStyle = R.rim;
			ell(c, G.ex, G.base, G.er, G.eh, Math.PI, TAU);
			c.stroke();
		}
		legsSide(c, sp, ph, R, false, G.base);
	}

	var state = { bugs: false, bugWalk: false, bugLook: 'color' };
	var theme = { acc: [63, 224, 161], light: false, shadows: true };
	var canvas = null, ctx = null, off = null, octx = null;
	var raf = 0, last = 0, now = 0, dpr = 1, W = 0, H = 0;
	var crawlers = [], walkers = [], booted = false, scanAt = 0;
	var pointer = { x: -1e4, y: -1e4, t: -1e4 };

	function rand(a, b) {
		return a + Math.random() * (b - a);
	}

	function wrap(a) {
		while (a > Math.PI) a -= TAU;
		while (a < -Math.PI) a += TAU;
		return a;
	}

	function steer(a, target, k) {
		return a + wrap(target - a) * Math.min(1, k);
	}

	function render(sp, still, seed, mono, pixel, unit) {
		var acc = theme.acc.join(',');
		return {
			mono: mono,
			flat: pixel,
			t: now / 1000,
			seed: seed,
			still: still,
			px: 1 / unit,
			rim: !mono && !pixel && !theme.light ? 'rgba(255,255,255,.16)' : null,
			C: mono ? function () { return 'rgb(' + acc + ')'; } : function (col) { return col; },
			far: mono ? function () { return 'rgba(' + acc + ',.5)'; } : function (col) { return shade(col, .55); },
			accA: function (a) { return 'rgba(' + acc + ',' + a + ')'; }
		};
	}

	function drawBug(c, sp, view, x, y, angle, flip, size, ph, still, seed) {
		var look = state.bugLook, mono = look === 'mono', pixel = look === 'pixel';
		if (pixel)
			return drawPixel(c, sp, view, x, y, angle, flip, size * (view === 'top' ? PIX_SCALE : 1.15), ph, still, seed);
		var R = render(sp, still, seed, mono, false, size);
		c.save();
		if (theme.light && theme.shadows && !mono) {
			c.save();
			if (view === 'top') {
				c.translate(x + 1.5, y + 2.5);
				c.rotate(angle);
				c.scale(size, size);
				oval(c, 0, .08, sp.ely[1] * .9, .4, 'rgba(0,0,0,.13)');
			}
			else {
				c.translate(x, y);
				c.scale(size, size);
				oval(c, -sp.ely[0] * .5, 0, .42, .045, 'rgba(0,0,0,.16)');
			}
			c.restore();
		}
		c.translate(x, y);
		if (view === 'top')
			c.rotate(angle);
		else if (flip)
			c.scale(-1, 1);
		c.scale(size, size);
		c.lineCap = 'round';
		c.lineJoin = 'round';
		if (mono)
			c.globalAlpha *= .92;
		(view === 'top' ? drawTop : drawSide)(c, sp, ph, R);
		c.restore();
	}

	function drawPixel(c, sp, view, x, y, angle, flip, size, ph, still, seed) {
		var unit = size / PIX, r = Math.ceil(unit * REACH) + 2, n = r * 2;
		if (!off) {
			off = D.createElement('canvas');
			octx = off.getContext('2d', { willReadFrequently: true });
		}
		if (off.width < n || off.height < n) {
			off.width = Math.max(off.width, n);
			off.height = Math.max(off.height, n);
		}
		octx.setTransform(1, 0, 0, 1, 0, 0);
		octx.clearRect(0, 0, n, n);
		octx.translate(r, view === 'top' ? r : r + unit * .25);
		if (view === 'top')
			octx.rotate(Math.round(angle / (TAU / 16)) * (TAU / 16));
		else if (flip)
			octx.scale(-1, 1);
		octx.scale(unit, unit);
		octx.lineCap = 'round';
		octx.lineJoin = 'round';
		var R = render(sp, still, seed, false, true, unit);
		(view === 'top' ? drawTop : drawSide)(octx, sp, Math.round(ph / (Math.PI / 2)) * (Math.PI / 2), R);
		var img = octx.getImageData(0, 0, n, n), d = img.data, mask = new Uint8Array(n * n), i, k;
		for (i = 0; i < n * n; i++) {
			k = i * 4;
			if (d[k + 3] < 110) {
				d[k + 3] = 0;
			}
			else {
				mask[i] = 1;
				d[k + 3] = 255;
				d[k] = Math.min(255, Math.round(d[k] / 24) * 24);
				d[k + 1] = Math.min(255, Math.round(d[k + 1] / 24) * 24);
				d[k + 2] = Math.min(255, Math.round(d[k + 2] / 24) * 24);
			}
		}
		var ol = theme.light ? [24, 18, 14, 255] : [255, 255, 255, 84];
		for (i = 0; i < n * n; i++) {
			if (mask[i])
				continue;
			var px = i % n;
			if ((px > 0 && mask[i - 1]) || (px < n - 1 && mask[i + 1]) || (i >= n && mask[i - n]) || (i < n * n - n && mask[i + n])) {
				k = i * 4;
				d[k] = ol[0];
				d[k + 1] = ol[1];
				d[k + 2] = ol[2];
				d[k + 3] = ol[3];
			}
		}
		octx.putImageData(img, 0, 0);
		var oy = view === 'top' ? r : r + unit * .25;
		c.imageSmoothingEnabled = false;
		c.drawImage(off, 0, 0, n, n, Math.round(x / PIX) * PIX - r * PIX, Math.round(y / PIX) * PIX - oy * PIX, n * PIX, n * PIX);
	}

	function pickSpecies(exclude) {
		var list = SPECIES.filter(function (s) { return s.id !== exclude; });
		return list[Math.floor(Math.random() * list.length)];
	}

	function spawnCrawler(fromEdge) {
		var sp = pickSpecies(), b = {
			sp: sp, scale: rand(.9, 1.12), v: 0, turn: 0, ph: rand(0, TAU), seed: rand(0, 100),
			pause: 0, life: rand(25, 70), leaving: false, delay: 0
		};
		b.vmax = sp.speed * rand(.8, 1.2);
		if (fromEdge) {
			var side = Math.floor(Math.random() * 4), m = 40;
			b.x = side === 1 ? W + m : side === 3 ? -m : rand(m, W - m);
			b.y = side === 0 ? -m : side === 2 ? H + m : rand(m, H - m);
			b.a = Math.atan2(H / 2 - b.y + rand(-H, H) * .25, W / 2 - b.x + rand(-W, W) * .25) + Math.PI / 2;
			b.delay = rand(0, 1.6);
		}
		else {
			b.x = rand(40, W - 40);
			b.y = rand(60, H - 40);
			b.a = rand(-Math.PI, Math.PI);
		}
		return b;
	}

	function target() {
		return Math.max(3, Math.min(12, Math.round(W * H / 130000)));
	}

	function updateCrawlers(dt) {
		var want = target(), fresh = now - pointer.t < 1200;
		while (crawlers.length < want)
			crawlers.push(spawnCrawler(true));
		crawlers.forEach(function (b, idx) {
			if (b.delay > 0) {
				b.delay -= dt;
				return;
			}
			if (idx >= want)
				b.leaving = true;
			b.life -= dt;
			if (b.life <= 0)
				b.leaving = true;
			var size = b.sp.len * b.scale * CRAWL_SCALE, m = 46;
			var dx = b.x - pointer.x, dy = b.y - pointer.y, flee = fresh && dx * dx + dy * dy < 130 * 130;
			if (flee) {
				b.pause = 0;
				b.a = steer(b.a, Math.atan2(dy, dx) + Math.PI / 2, 9 * dt);
			}
			if (b.pause > 0) {
				b.pause -= dt;
				b.v += (0 - b.v) * Math.min(1, 10 * dt);
			}
			else {
				b.turn = Math.max(-2.4, Math.min(2.4, b.turn * (1 - 1.2 * dt) + (Math.random() - .5) * 9 * dt));
				b.a += b.turn * dt;
				if (b.leaving) {
					var ex = b.x < W / 2 ? -1 : 1, ey = b.y < H / 2 ? -1 : 1;
					var tx = Math.min(b.x, W - b.x) < Math.min(b.y, H - b.y) ? Math.atan2(0, ex) : Math.atan2(ey, 0);
					b.a = steer(b.a, tx + Math.PI / 2, 1.2 * dt);
				}
				else if (b.x < m || b.x > W - m || b.y < m || b.y > H - m) {
					b.a = steer(b.a, Math.atan2(H / 2 - b.y, W / 2 - b.x) + Math.PI / 2, 3 * dt);
				}
				b.v += ((flee ? b.vmax * 3 : b.vmax) - b.v) * Math.min(1, 4 * dt);
				if (!flee && Math.random() < .22 * dt)
					b.pause = rand(.4, 2.4);
			}
			b.x += Math.sin(b.a) * b.v * dt;
			b.y -= Math.cos(b.a) * b.v * dt;
			b.ph += b.v * dt / (size * .2);
			b.still = b.v < 3;
		});
		crawlers = crawlers.filter(function (b) {
			var out = b.x < -80 || b.x > W + 80 || b.y < -80 || b.y > H + 80;
			return !(b.leaving && out) && !(b.delay <= 0 && out && b.life < 15);
		});
	}

	function drawCrawlers() {
		crawlers.forEach(function (b) {
			if (b.delay > 0)
				return;
			drawBug(ctx, b.sp, 'top', b.x, b.y, b.a, false, b.sp.len * b.scale * CRAWL_SCALE, b.ph, b.still, b.seed);
		});
	}

	function candidates() {
		var used = walkers.map(function (w) { return w.el; });
		return Array.prototype.filter.call(D.querySelectorAll('.btn, .cbi-button'), function (el) {
			if (used.indexOf(el) > -1 || el.closest('.kadr-palette'))
				return false;
			var r = el.getBoundingClientRect();
			return r.width >= 64 && r.height >= 26 && r.top > 70 && r.bottom < H && r.left >= 0 && r.right <= W;
		});
	}

	function assign(w, list) {
		var el = list.splice(Math.floor(Math.random() * list.length), 1)[0];
		if (!el)
			return false;
		var r = el.getBoundingClientRect(), rad = parseFloat(g.getComputedStyle(el).borderTopLeftRadius) || 0;
		w.el = el;
		w.inset = Math.min(rad, r.height / 2) * .85 + 4;
		w.x = rand(0, Math.max(0, r.width - w.inset * 2));
		w.dir = Math.random() < .5 ? -1 : 1;
		w.hidden = false;
		w.check = 0;
		w.fade = 0;
		return true;
	}

	function updateWalkers(dt) {
		var want = W < 700 ? 2 : 4;
		if (now > scanAt) {
			scanAt = now + 2500;
			var list = candidates();
			walkers.forEach(function (w) {
				if (!w.el || !w.el.isConnected || w.lost > 1.5)
					assign(w, list);
			});
			while (walkers.length < want && list.length) {
				var sp = pickSpecies('stag'), w = { sp: sp, size: Math.max(20, Math.min(32, sp.len * 1.4)) * rand(.92, 1.08), ph: rand(0, TAU), seed: rand(0, 100), pause: 0, lost: 0, v: 0, vmax: sp.speed * rand(.5, .8) };
				if (assign(w, list))
					walkers.push(w);
			}
		}
		walkers.forEach(function (w) {
			if (!w.el)
				return;
			var r = w.el.getBoundingClientRect(), range = r.width - w.inset * 2;
			var gone = !w.el.isConnected || r.width < 40 || r.bottom < 0 || r.top > H || range < 8;
			w.lost = gone ? w.lost + dt : 0;
			w.rect = r;
			if (gone)
				return;
			w.check -= dt;
			if (w.check <= 0) {
				w.check = .45;
				var hx = r.left + w.inset + Math.min(range, Math.max(0, w.x)), hit = D.elementFromPoint(hx, r.top + 3);
				w.hidden = !hit || !(hit === w.el || w.el.contains(hit));
			}
			w.fade += ((w.hidden ? 0 : 1) - w.fade) * Math.min(1, 6 * dt);
			var px = r.left + w.inset + w.x, near = now - pointer.t < 1200 && Math.abs(pointer.x - px) < 60 && Math.abs(pointer.y - r.top) < 50;
			if (near) {
				w.dir = pointer.x < px ? 1 : -1;
				w.pause = 0;
			}
			if (w.pause > 0) {
				w.pause -= dt;
				w.v += (0 - w.v) * Math.min(1, 10 * dt);
			}
			else {
				w.v += ((near ? w.vmax * 3 : w.vmax) - w.v) * Math.min(1, 4 * dt);
				if (!near && Math.random() < .2 * dt)
					w.pause = rand(.5, 2.5);
				else if (!near && Math.random() < .06 * dt)
					w.dir = -w.dir;
			}
			w.x += w.dir * w.v * dt;
			if (w.x < 0 || w.x > range) {
				w.x = Math.max(0, Math.min(range, w.x));
				w.dir = -w.dir;
				w.pause = rand(.2, .9);
			}
			w.ph += w.v * dt / (w.size * .16);
			w.still = w.v < 3;
		});
	}

	function drawWalkers() {
		walkers.forEach(function (w) {
			if (!w.el || !w.rect || w.lost > 0 || w.fade < .02)
				return;
			ctx.globalAlpha = w.fade;
			drawBug(ctx, w.sp, 'side', w.rect.left + w.inset + w.x, w.rect.top + .5, 0, w.dir < 0, w.size, w.ph, w.still, w.seed);
			ctx.globalAlpha = 1;
		});
	}

	function frame(t) {
		raf = g.requestAnimationFrame(frame);
		var dt = Math.min(.05, Math.max(0, (t - last) / 1000));
		last = t;
		now = t;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		if (state.bugs) {
			updateCrawlers(dt);
			drawCrawlers();
		}
		if (state.bugWalk) {
			updateWalkers(dt);
			drawWalkers();
		}
	}

	function resize() {
		W = g.innerWidth;
		H = g.innerHeight;
		dpr = Math.min(g.devicePixelRatio || 1, 2);
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		scanAt = 0;
	}

	function onPointer(ev) {
		pointer.x = ev.clientX;
		pointer.y = ev.clientY;
		pointer.t = now;
	}

	function readTheme() {
		var root = D.documentElement, v = g.getComputedStyle(root).getPropertyValue('--k-acc').trim().split(/\s+/).map(Number);
		if (v.length === 3 && v.every(function (n) { return n >= 0; }))
			theme.acc = v;
		theme.light = root.getAttribute('data-kadr-scheme') === 'light';
		theme.shadows = root.getAttribute('data-kadr-shadows') !== 'off';
	}

	function start(inside) {
		if (!D.body) {
			D.addEventListener('DOMContentLoaded', function () { start(inside); }, { once: true });
			return;
		}
		if (!canvas) {
			canvas = D.createElement('canvas');
			canvas.className = 'kadr-bugs';
			canvas.setAttribute('aria-hidden', 'true');
			canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:990';
			D.body.appendChild(canvas);
			ctx = canvas.getContext('2d');
			resize();
			g.addEventListener('resize', resize);
			D.addEventListener('pointermove', onPointer, { passive: true });
			D.addEventListener('pointerdown', onPointer, { passive: true });
		}
		if (inside && state.bugs && !crawlers.length)
			for (var i = 0, n = target(); i < n; i++)
				crawlers.push(spawnCrawler(false));
		if (!raf) {
			last = g.performance.now();
			raf = g.requestAnimationFrame(frame);
		}
	}

	function stop() {
		if (raf)
			g.cancelAnimationFrame(raf);
		raf = 0;
		crawlers = [];
		walkers = [];
		if (canvas) {
			canvas.remove();
			canvas = ctx = null;
			g.removeEventListener('resize', resize);
			D.removeEventListener('pointermove', onPointer);
			D.removeEventListener('pointerdown', onPointer);
		}
	}

	function update(s) {
		var first = !booted;
		booted = true;
		state = { bugs: !!s.bugs, bugWalk: !!s.bugWalk, bugLook: s.bugLook || 'color' };
		readTheme();
		if (!state.bugs)
			crawlers = [];
		if (!state.bugWalk)
			walkers = [];
		if (state.bugs || state.bugWalk)
			start(first);
		else
			stop();
	}

	g.KadrBugs = {
		update: update,
		species: SPECIES.map(function (s) { return s.id; }),
		draw: function (c, id, view, x, y, opts) {
			var sp = SPECIES.filter(function (s) { return s.id === id; })[0];
			if (!sp)
				return;
			var prev = state.bugLook;
			opts = opts || {};
			state.bugLook = opts.look || prev;
			if (opts.acc)
				theme.acc = opts.acc;
			if ('light' in opts)
				theme.light = opts.light;
			now = opts.t || 0;
			drawBug(c, sp, view, x, y, opts.angle || 0, !!opts.flip, (opts.size || sp.len), opts.phase || 0, !!opts.still, 1);
			state.bugLook = prev;
		}
	};
})(window);
