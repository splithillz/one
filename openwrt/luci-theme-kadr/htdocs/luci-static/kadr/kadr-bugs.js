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

	function brick(c, R, x, y, w, h, col) {
		var k = R.mono ? R.dk : '#7c2f14';
		c.beginPath();
		c.rect(x - w / 2, y - h / 2, w, h);
		fill(c, R.C(col));
		c.lineWidth = .014;
		c.strokeStyle = k;
		c.stroke();
		if (R.mono)
			return;
		path(c, .016, 'rgba(255,214,180,.45)', [x - w * .42, y - h * .3, x + w * .42, y - h * .3]);
		[[-.28, .12], [.05, -.05], [.3, .2]].forEach(function (p) { oval(c, x + w * p[0], y + h * p[1], .018, .013, '#d8ccb8'); });
	}

	function bez(P, t) {
		var u = 1 - t;
		return [
			u * u * u * P[0] + 3 * u * u * t * P[2] + 3 * u * t * t * P[4] + t * t * t * P[6],
			u * u * u * P[1] + 3 * u * u * t * P[3] + 3 * u * t * t * P[5] + t * t * t * P[7]
		];
	}

	function feeler(c, R, col, P, h, club) {
		c.beginPath();
		c.moveTo(P[0], P[1]);
		c.bezierCurveTo(P[2], P[3], P[4], P[5], P[6], P[7]);
		c.lineWidth = .036 * h;
		c.strokeStyle = R.C(col.ant);
		c.stroke();
		var bead = R.mono ? R.dk : col.bead;
		for (var i = 1; i < 9; i++) {
			var p = bez(P, i / 9);
			oval(c, p[0], p[1], .021 * h, .021 * h, bead);
		}
		if (!club)
			return;
		c.save();
		c.translate(P[6], P[7]);
		c.rotate(Math.atan2(P[7] - P[5], P[6] - P[4]));
		oval(c, .035 * h, 0, .085 * h, .048 * h, R.C(col.club));
		if (!R.mono)
			oval(c, .05 * h, -.016 * h, .04 * h, .014 * h, white(.3));
		c.restore();
	}

	var MEME = [
		{
			id: 'builder', len: 44, walk: 46, speed: 32, meme: true, reach: 1.05,
			head: [-.2, .1, .09], pro: [-.06, .2, .11], ely: [.24, .19, .3],
			legs: { y: [-.1, .06, .2], x: .14, f: .2, t: .24, w: .042, skip: 1 },
			col: { head: '#2a1409', pro: '#c6ec3a', ely: '#5b2f18', leg: '#3a1d0e', ant: '#3d1c0c', bead: '#8a4a22', brick: '#bf5631' },
			side: { clear: .1, eh: .14, ph: .13, hh: .1 },
			gloss: 1.1,
			face: { h: .58, aspect: .8047, top: -.28, side: [.25, -.4], antL: [-.412, -.327], antR: [.409, -.245] },
			marks: function (c, R, v, G) {
				var k = 'rgba(0,0,0,.24)';
				if (v === 'top')
					[.12, .22, .32, .42].forEach(function (y) { bend(c, .016, k, -G.erx, y, 0, y + .035, G.erx, y); });
				else
					[.35, .62].forEach(function (h) { arc(c, .014, k, G.ex, G.base, G.er * .97, G.eh * h); });
			},
			proMarks: function (c, R, v, G) {
				var st = '#aeb6ba';
				c.save();
				if (v === 'top') {
					ell(c, 0, G.py, G.prx, G.pry);
					c.clip();
					both(function (s) { path(c, .03, st, [s * .1, G.py - .12, s * .1, G.py + .12]); });
					path(c, .024, st, [-.22, G.py + .04, .22, G.py + .04]);
				}
				else {
					c.beginPath();
					c.ellipse(G.px, G.base, G.pr, G.ph, 0, Math.PI, TAU);
					c.clip();
					path(c, .032, st, [G.px - G.pr, G.base - G.ph * .45, G.px + G.pr, G.base - G.ph * .45]);
					path(c, .028, st, [G.px + G.pr * .2, G.base - G.ph, G.px + G.pr * .2, G.base]);
				}
				c.restore();
			},
			deco: function (c, R, w, h, st) {
				var col = this.col, F = this.face;
				if (st === 'back') {
					var wig = Math.sin(R.t * (R.still ? 7 : 3.5) + R.seed) * h * (R.still ? .05 : .025);
					both(function (s) {
						var a = s < 0 ? F.antL : F.antR, x = a[0] * w, y = a[1] * h;
						feeler(c, R, col, [x, y, x + s * .12 * h, y - .12 * h, x + s * .27 * h, y - .15 * h, x + s * .4 * h, y - .05 * h + s * wig], h, false);
					});
					return;
				}
				c.save();
				c.translate(.02 * h, .7 * h);
				c.rotate(-.07);
				brick(c, R, 0, 0, .62 * h, .25 * h, col.brick);
				c.restore();
				var leg = R.C(col.leg);
				both(function (s) { path(c, .06 * h, leg, [s * .3 * h, .42 * h, s * .45 * h, .6 * h, s * .26 * h, .75 * h]); });
			}
		},
		{
			id: 'grinner', len: 40, walk: 44, speed: 22, meme: true, reach: 1.1,
			head: [-.16, .12, .1], pro: [-.06, .25, .1], ely: [.15, .3, .31],
			legs: { y: [-.12, .02, .16], x: .22, f: .17, t: .2, w: .05 },
			col: { head: '#5a2a12', pro: '#4e2312', ely: '#6a2c16', leg: '#4a1e0e', ant: '#5e2510', bead: '#a0522d', club: '#8a3c18' },
			side: { clear: .1, eh: .3, ph: .16, hh: .12 },
			gloss: 1,
			face: { h: .6, aspect: .8984, top: -.26, side: [.2, -.3], antL: [-.294, -.397], antR: [.265, -.391] },
			marks: function (c, R, v, G) {
				var k = 'rgba(40,10,4,.45)';
				if (v === 'top')
					[-.05, .07, .19, .3].forEach(function (y, i) {
						[.08, .19].forEach(function (x) { both(function (s) { oval(c, s * (x + (i % 2) * .03), y, .032, .022, k); }); });
					});
				else
					[[-.2, .55], [.02, .7], [.22, .5], [-.08, .3], [.14, .25]].forEach(function (p) { oval(c, G.ex + p[0], G.base - G.eh * p[1], .035, .022, k); });
			},
			deco: function (c, R, w, h, st) {
				if (st !== 'back')
					return;
				var col = this.col, F = this.face, wig = Math.sin(R.t * (R.still ? 6 : 3) + R.seed) * h * (R.still ? .05 : .025);
				both(function (s) {
					var a = s < 0 ? F.antL : F.antR, x = a[0] * w, y = a[1] * h;
					feeler(c, R, col, [x, y, x + s * .02 * h, y - .25 * h, x + s * .25 * h, y - .42 * h, x + s * .44 * h, y - .24 * h + wig], h, true);
				});
			}
		}
	];

	var PHOTO = {
		builder: 'data:image/webp;base64,UklGRiQTAABXRUJQVlA4WAoAAAAQAAAAZgAAfwAAQUxQSGoGAAAR8Mds+zo1/v9dVyYSyGwgAyHQdK3ekiqh68u679KwlTAv13V3d/fduqy7W93pukuNSjYUC80rMCEDYfIk9/UHMs95Ph/N69+ImAAElSSGJDE0SbiUBAAWlo2eUXNe3bz6ebPOPnHKEck4AZDOIAEmjjrpb3cv/+yr7fsOtLW3NTX+0vDh/JvnVI+IAyBdQACJ8bPuee/H1ky/hu+lm7585YYzj4gDZNgIRMpPvePTvRmTJBu2BvZ3/vbGFdVFABguRA6vm/9j2iSZmXI1M0n9BxseOLUEYHgIltetaOyTZCa/zSR1//BYTRHAcBA47JRnd2YlM+XXTMp8fceUOBgGIjL2hq8zkimAZlLnyj+XEwwckTjrtXbJFFAz9e99fEYUDBoqLvu6T2YKrknpj2cVgcHi+Ef/MJmCbfJ+vLIcgY7OfKlTpsCb7I/7RzMwROzUjzIyhdHUMb+SASFiZ63pkymcpvTyyQwGYmetzcoUVlN6+WQGInrm2qxM4TWll1UyADzu06xMYTZ1vTAKzBcrX+2RKdymjvvLwbwQRzzTJVPYTfuvLALzQBTf0CJT+M1+roshn7GLf5HJid7Kauaj6jNPbjRlnh8J+kSUP5mWuUGmpksK4Xfsz3tlcqXZlhPoDzHls36505R5phz0gSi6o1PmDpka50XhJ0/9Vianeu+MA3Miyp7pkVtNrZfFkTsv3C5zi2Qrp4A5EOUL++Ra08FrC8Dhgedtl7lGspWVORClT/c6yNR+SQw51Hwnk4PtnVHgMIjEHWknmfbNIYY1caXJxaa+Z0rAoRCpb5K5SKYvjxkGUfJsn9xs6rgkimFUNcjcJHkrKsDBEPlbq7NM350wBJF8ps9hHf+NYojKdTI5Ozu/FBwAXLjXYaZNkwch4jelnbavFgOJsmX9crcpfX18sMpNMndJ3uJScMDZu51mWjN+ACL/7nDcLzUgiMJ7exzXMo8AMeKVfrnclL61EEQ8tVPmMsk2nEhg5oZ+ub5n2eFI3JaWOc60/2KOekfON/Xef9i0TTLXSba4rKrhkLC84lBRfqiomLLhkLCw9IjXTK43Ze5IFFx1UOa8HecSle97sqGdYkMr/XgZED1zZbfc3rFkMgHEZz7csL+ldWB7jzss3TpoS+Oq68cSA5msqq1PpVKp+pt/c4e37pL6VCqVmnfupASGy4Gx1H6ZI0zbTuCgGC5JAMQRr3hypanrjgQIgBzGoCRrd8tcIWndlEFyJ5JP9jrE1PbvKHyq3iaTQ72XRoJ+IPrfdqeYfj7VF6JssSeXmjqvjYN+zNgmc4nUv6LCD3Bek2NMX1b7QBTenXFO0xzCh4pXTG41dd8aB3Or3CRzi+QtLvXj1O3OMX08Ojdg7gEHfVXlQ/Sy/zlo++k5EQV3dDvojzofEg/3Oqjtz0RORc9m5VrTwf9Gc0vO9xzUeeX/GVf4UPR01kEH/xXJLXF/r8w5rfXMLX5T2kF7LwRzACL/6nDQLzW5EbX7HbRlsh8n/OAc2TtH+DF2pXuyTxf7UbrQk1tNnVdFkTMRu75L5pjG88CcQJzX6Jx1k/wZv8ox6ns26U/Ro70yh5ha/x6Fr5yz3zFbqkA/iPGfmtxp6n066VfhrV0yh+ytI/wlTvraIep/cxToV/LxjMwRppZ/xeD/mT86Q/0fjgf9Ikoey8icYDrwzxjyedKXjlD2tVGgf0TihnaZA0zbayPIJzH+razCb+p6oATMBxC94EdZ6OR9PAVEXomiG1plITP9UhdFvomj5nfLQmU6cH0xmC+AM97rk4XI1Pn4SBABjJ66zpOFxtS9YiKIQMYvbPBkITFl3phBBLWgtsGThcKUeaOaCCpRULspKwuBKf1qdQTBJeJnfpyRBc1MHfOnEEEmotVL2iULlMka7x5FBJ2j79juyYJjUu+Wv5cijMk5H3dKFgwzWcuymgIwBER0yt0/9kpmeTOT0usuOYIgwkggedb83VnJLC8mKfPd/dUFCC/BEXVLtmckmZkvZiZZ19ePnloMMDwgEBlx3qNb2jxJsoFD2EBJ6t3/2a0nJAki3ASYrPr34i8P9Jhy99L71j0+d3wCABF6AoiWVafuf6Nhd3u617OBXk9ny28blt86q7KYAAknkgCYGDnlzNQ19zy5cPnyZfMfu+OKuadMKosTAAl3khjIeKK4tLyivKSoMEYMJBFQVlA4IJQMAACQMgCdASpnAIAAPlUkjkSjoiETuxecOAVEsQBiiRNtT0I/R+bvzH2z/G4pjtbnvzm/7f1b7dzzMebh6QP8X6QHUx+hL0tmAify/tu72/LAD3antDr0dGXiv03+Zn/fPSH/6POR9a+wT+sXW79ED9YnhnlvIsY7NPeH/fJ+OwlA44BirQ9/LfIaGuFInO3V/4IgYXzbx//5nxHiCAaY2TwUO7RBtXpEcWlPaKI2VB3UzmFF1k3qw5f18rw2yTXtM3Sa4VIXscC48+PGDnZ6kxqVMEE12vrCB7L5zOw9TLmkLjpSTF1rQhLWZJZdLTXJRCseUmS4IvW9CK2FvdzCYE/h2ibti7o7QSN/FLN6z9nAgKkOuuw95kxyfVMauAoYDKAElGSxu6jGK7ZzxwFFV1CVdUILX5iKUHr3MASb47MWavceFsbJSx7tqDSsd746C9Qj2nuOF1zwBaxMTQ+uEqwLyeSpoLGOTMUxj10PyVS9VDjBzE60diRcN/GB/raoPHkR9wDTgCD/FA+Nl/LJUu6rH4w7eN4em/rBi6G8AAD+/u6qlGuORJy6mwVBd/ShX1A5ndH/5p4v3lLurzTt8hi7KP7R2EQG6gSrHMEz5/fXCJkLVVnibRY8X+x8PL8BHfUjuIGdLl6F2XNIk0Ciq9r/osQwL+lY3eUeCgfXwH66CHWpsE/ly8mdBx03jwwbGTjuAtyFJ0DA84YoG1JP227I+dHlBg7PoeLGeBOHQHTHGdTjWvYy7se2UoGyP/eflT5V8yJJ07KwsCyF8yx3PBVZs0p8CyPFUPDC33fbp/4JQHxNdWWQZMN8+//S0ZU3D0uddTLJudIoSEYQw6akR6n1tT885YYGHNEvozIoKXPPDX38h5z1UKAwZFm85QSeZGkrzP+3A+Q+Amo2d4aAs/DhpLR5bSF1n4VZrNE+o5Ectnef0Cv84/NNu4ovHMtOcFrOWX6fgk+FP3HyyWH/uffaSlD+FZ+O0Ngq0l1j4hbdBeq/ZHaDdIfsEqQ+TzAr4wIDnq9zHav8kFrcFi8ayiQGj9nfAYCLnS+39iL0ZeQdqZKkSPLo9JcVvO2O8Br+4PNbspAI4lvjkq3ixd2e39s75bxN6zeDOBBbLLup5efTF9EtknDWdL1TEDoXcFmoE4W9p5nXBOGqq4u2TEMvTwGADTC2rf3xt8E9JY1m6HYRnq50Ia46QcEjgdA8mpHjubgS/a/ZYTi/oXsiVQnZheWfBgve66/iA8T2uq4Yyg7DLQwHl1+4I6VL4/B1PsFYx7qIi7DuQmCU+oZxS30ooW9ON9KtJvYj9BC7wkqB9QL7dj16CrcdM7xYTTCstG5bGZGCY1eW6eq7RiUvj89fF8Psa45HGRVASS8UpAbL/vuCJz2fcU9KjALPI/QEmmysoJq+57dJqyl1VM4DeC2uyeOq1+JVp0x+buoB4w25mSTVS8fg/mtGY8S6HZSVEsI/iNlhMLFjzvaVNOx528axcIHM6z0823K+RfVteG8wJat2scTwhD3kKYAhyxcoWqUkgEK9Y0wUDdnbOGXMfk0RHBv3RMzye6tEaHCCAWNfS+fNKUz1KOmqt8FAkACWu1NxRJ/ZIJsA0B6C9IfC9S9+qd2n3xU0XMQ8MZ1fJdcM3xBRNsSVtNDdQjRgS8jo+4Gwp/80a+sDWRPlMIbOjLZ6iG2OvP1pXjE00Vp7BdCcROVF/Pb+AWCP4G7tHRkdIg0w0ISr2Cv64ZDo5j0ifwEbZYKxDLt8bIHV62u+CF1F1KBzu5HFCCQlG/NBZBf3QIFKdqSXfbZuDy0VP1FJi+2Qk/RSNsxdNRJb9hR2GKfo8l81uTqFa6VU7rRW2xQj1HIw9l0oM5HY22KXcMYBuuwJlOeD9g8uyM9JUan5YamCK0rpNOeJ6hapeM1s9LWCARG8ySHVo7rdBTZso3l4hn5PTvmlEOH2DSQUWizkB11YrBNKf3NTQvS+oRbSF80fxJnjBTixGfikPZZ/7T1ZSNwU41k374YVL3ZVOxQjsVmiFgF6TqsZ4rMWJalS/wiBZCFp89XS9aBnhU5ReKAGOmfKE5H/waQsWNsnf7L9fQt/ehlg8R6BXtvVDmS4qavHqmB3kO/tULSSbVR+lmmoYWb8fXtUwaTV6CGDNHtfwR72+wFMYht4xnaagKVXebho3KXowRGve9148/l0jqabxH/EmGP/3p78IrrFo1qj5CxjV6NKfpHF4QMraIp+QzNKGbB5eEw97CgwIDRbtapFQOyilPcdyYW8y+NxyAd1/q1NZrFbahnslIy0sYoiP4JMZeF+1korAkSvX6NCp3Pj9T2LLpErg01gu0zj9b8wrsCOqg9Ko63v8exruY8PaCR8mS0RYGqRpYkITYMSFi9v+wWDKVZe+tDXnxocf/zkU0wvhR76t4XMPWX5Rrud+7L1BMH9SGjWl4Hr5vavj6Wo4fedBwynwS66bLzQUtJBY4iYDW3aULFpCnfHw3/w/yXzWqYEB86b5l+j2/k4UxKF2LPmBbbakrlbAbIKUMZjyXzduBIw0/l5Cd6dxp0O+vDQwuJf+xQAu0V6r0l8PBUHYnA4oBYudGSO9xW9WyjriN3IrIHU5HNNixxvG/8GGSQU7Fl2xOBzQUlHtlMcV2eFlyAtaN2nlirG0CiDXLwgnTJ55Ac5Su8gOth0pk6lW+P1v3NbcmV0hMXY+E+24t/NHUPOdBbXwePS9n8w4jcn4o6W/JvQnI/GHaBz08+U9nNW3/umuKD+9bUycIjArbw5W1wSEIsWw6/EPWPA/9xBZ4KtH6MzLx4w1ulZBIR77SIRSxDJUlvXwOPKVCAUaR7pa2F5CgIA4Y0IVVlPRw8dobzNJWu3PYU1st6Pnptz+mPCLBnfvTP6asHve6lmmYUVM9dU5g5sjZByy3ebywrsWKU3VsnUU3/ufdP2IeguxMFmJ+XY1QyMzO0vSk/XN/kYqhmxNqQdFpwl1FeU1K8rgVEJxNwfEMntPtGjn1Q7XznX9L817K3V3yJ/z4Ah61vL33LQHr9wo73xavub71BAngqmTIzmzuFQyezWMpfW0Y2v0Po7axfnibcPL/HW/KUYn7DaFSL87IN5eGtprHmsGxzLP9R0nffknIUYKKNHkIJuwH1yYDDkMOzOa5YaToOu4FnWSCkzcKPAks5w16kfDLgcpyGwn0xROYzFkPPolpVUIfwVw0KsxeQVAPYl64E9BwIHpGok1YJnD4lE/UJStB6+9oJ6lxsYPONomA0syr6kpBJ/JMJ1NJ3wqAT7XTujDSGowwO124E4vr/l00VzK5mfY1BB7//NpfLtBwzUCDtl1w0sryltIRfxSEp/g6aV7sHEczGP5c53d8K8fTiX+AtQnc3BBebi6cRTVdzKYWy/9hW2JPwYlJaZdbaj5DxUW7B9PfCT21+6jTSufHGPkJOSaJAvUWtm+G8RggwSSwwhEImzYV/aeAl4ro8uC0dyTFNq1FVUDYW8ndh93CEIhY/sIoocKD3GF5jXrN9sf9Pg7n9ymx3R1bxhxef/9K/ne/vlgtfWBREO0fRftkcqRuqGzIp/Z/6WCrIDBnBXaYJ5jNDw0k6L4AETs5s2jGYQu2rUQvbnPkgzfI2mci0kecjZw4pQ9QjH3YSl8w5U+OPMbS4u+V5I4qhBUofVnlDOsJ7RzhMM0DxdEgj7xU+X1sz8upJzkunnPbvarLQfSZ/LQFWkJYv6nSyUvGmrzhHQlX1NSAmWqP7GZndfPauUYUqMDFYOZHjr7lEDn8jB+x9J8VMwMo0dFbPt/KXpRZ3c4a/Xsy/hcbNwb72bU4wSugrnrN9upCCuOILRHiunbawyLfBNUCVzZXzHZ/E5peQLm9Wupk8R5x8XSIASOAnVtBN9269W+fIeq6eezV+lXE9OhYs6bFh5MQIfpCQXiNwnmteYR2gMBLp2Hnnphh74GALHmaWsCgD3y9iRocgoowIUYPCkSsa4cxaLQ+xbqo+Cc0IYFGUaG6XQg6nU3K08U2ho7mRv4ZlycMMQprd/clG8dBQUqtP1ziGDWja/KMUwdqd3Ez6dZO8VYi0e9njeox/Ec0tS4Y0BwbT2fBMNCe5gOuIIO4Sk+kJ6qRlEFR9a8U1HJo1hA1TQ2WjGsak77wgKrl5iX/btazIFnms2mVHdoD/kQEzcfkwL9Q+JCMdxYovVYbik24yAnoJVe6zZfviiTyNapenEmG1puokRQu2PH/tPv/+sE//q9l//1aySC6iF2c6oXTH5y8uiUinq2SDsEP5Ly/ydN48rT5UOwf7adHE0beG+A4AA',
		grinner: 'data:image/webp;base64,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'
	};
	var FACES = {}, TINT = {}, faceState = 0, faceWait = [];

	function faces(cb) {
		if (cb)
			faceWait.push(cb);
		if (faceState)
			return faceState === 2 && flush();
		faceState = 1;
		var left = MEME.length;
		g.setTimeout(flush, 2500);
		MEME.forEach(function (sp) {
			var img = new Image();
			img.onload = img.onerror = function (ev) {
				if (ev.type === 'load' && img.naturalWidth && sameOrigin(img))
					FACES[sp.id] = img;
				if (--left === 0) {
					faceState = 2;
					flush();
				}
			};
			img.src = PHOTO[sp.id];
		});
	}

	function flush() {
		var q = faceWait;
		faceWait = [];
		q.forEach(function (f) { f(); });
	}

	function sameOrigin(img) {
		try {
			var t = D.createElement('canvas').getContext('2d');
			t.drawImage(img, 0, 0, 1, 1);
			t.getImageData(0, 0, 1, 1);
			return true;
		}
		catch (e) {
			return false;
		}
	}

	function faceImg(sp, R) {
		var img = FACES[sp.id];
		if (!img || !R.mono)
			return img;
		var key = sp.id + theme.acc.join(',');
		if (TINT[key])
			return TINT[key];
		if (Object.keys(TINT).length > 6)
			TINT = {};
		var cv = D.createElement('canvas'), x = cv.getContext('2d', { willReadFrequently: true }), w = cv.width = img.naturalWidth, h = cv.height = img.naturalHeight;
		x.drawImage(img, 0, 0);
		var d = x.getImageData(0, 0, w, h), p = d.data, a = theme.acc;
		var lo = a.map(function (v) { return v * .2; }), hi = a.map(function (v) { return v + (255 - v) * .6; });
		for (var i = 0; i < p.length; i += 4) {
			var l = Math.max(0, Math.min(1, ((p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11) / 255 - .1) / .78));
			p[i] = lo[0] + (hi[0] - lo[0]) * l;
			p[i + 1] = lo[1] + (hi[1] - lo[1]) * l;
			p[i + 2] = lo[2] + (hi[2] - lo[2]) * l;
		}
		x.putImageData(d, 0, 0);
		return (TINT[key] = cv);
	}

	function memeHead(c, sp, R, x, y, lean) {
		var F = sp.face, img = faceImg(sp, R), h = F.h, w = h * F.aspect;
		c.save();
		c.translate(x, y);
		if (R.ang)
			c.rotate(-R.ang);
		if (R.flip)
			c.scale(-1, 1);
		c.rotate(lean);
		sp.deco(c, R, w, h, 'back');
		if (img) {
			c.save();
			c.imageSmoothingEnabled = true;
			c.imageSmoothingQuality = 'high';
			if (R.shadow) {
				c.shadowColor = 'rgba(0,0,0,.24)';
				c.shadowBlur = 3 * dpr;
				c.shadowOffsetY = 1.5 * dpr;
			}
			c.drawImage(img, -w / 2, -h / 2, w, h);
			c.restore();
		}
		else
			oval(c, 0, 0, w * .48, h * .48, R.C(sp.col.head));
		sp.deco(c, R, w, h, 'front');
		c.restore();
	}

	function legsTop(c, sp, ph, R) {
		var L = sp.legs, ang = [-.7, .1, .78], bnd = [-.5, .28, .5];
		c.lineWidth = L.w;
		c.strokeStyle = R.C(sp.col.leg);
		for (var i = L.skip || 0; i < 3; i++)
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
		R.ph = ph;
		legsTop(c, sp, ph, R);
		if (sp.ant)
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
		if (sp.face)
			memeHead(c, sp, R, 0, sp.face.top, Math.sin(R.ang || 0) * .2 + (R.still ? Math.sin(R.t * 2 + R.seed) * .06 : Math.sin(ph * 2) * .04));
	}

	function legsSide(c, sp, ph, R, far, base) {
		var L = sp.legs, reach = (L.f + L.t) * .8, dir = [.6, .05, -.7];
		var col = far ? R.far(sp.col.leg) : R.C(sp.col.leg);
		for (var i = L.skip || 0; i < 3; i++) {
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
		R.ph = ph;
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
		if (sp.ant)
			antSide(c, sp, R, G);
		if (sp.extra)
			sp.extra(c, R, 'side', 'post', G);
		if (R.rim) {
			c.lineWidth = R.px;
			c.strokeStyle = R.rim;
			ell(c, G.ex, G.base, G.er, G.eh, Math.PI, TAU);
			c.stroke();
		}
		if (sp.face)
			memeHead(c, sp, R, sp.face.side[0], G.base + sp.face.side[1] - Math.abs(Math.sin(ph)) * .015, R.still ? Math.sin(R.t * 2 + R.seed) * .07 : Math.sin(ph) * .05);
		legsSide(c, sp, ph, R, false, G.base);
	}

	var state = { bugs: false, bugWalk: false, bugLook: 'color', bugMeme: false, bugCount: 'normal' };
	var DENSITY = { few: .5, normal: 1, many: 2 };
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
			dk: 'rgb(' + theme.acc.map(function (v) { return Math.round(v * .42); }).join(',') + ')',
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
			return drawPixel(c, sp, view, x, y, angle, flip, size * (sp.meme ? 1.1 : view === 'top' ? PIX_SCALE : 1.15), ph, still, seed);
		var R = render(sp, still, seed, mono, false, size);
		R.ang = view === 'top' ? angle : 0;
		R.flip = view !== 'top' && flip;
		R.shadow = theme.light && theme.shadows && !mono;
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
		var unit = size / PIX, r = Math.ceil(unit * (sp.reach || REACH)) + 2, n = r * 2, qa = Math.round(angle / (TAU / 16)) * (TAU / 16);
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
			octx.rotate(qa);
		else if (flip)
			octx.scale(-1, 1);
		octx.scale(unit, unit);
		octx.lineCap = 'round';
		octx.lineJoin = 'round';
		var R = render(sp, still, seed, false, true, unit);
		R.ang = view === 'top' ? qa : 0;
		R.flip = view !== 'top' && flip;
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

	function memes() {
		return state.bugMeme ? MEME.filter(function (s) { return FACES[s.id]; }) : [];
	}

	function memeCount(list) {
		return list.filter(function (b) { return b.sp.meme && !b.leaving; }).length;
	}

	function pickSpecies(exclude, plain) {
		var m = plain ? [] : memes();
		var list = (m.length && Math.random() < .3 ? m : SPECIES).filter(function (s) { return s.id !== exclude; });
		return list[Math.floor(Math.random() * list.length)];
	}

	function walkerSize(sp) {
		return sp.walk ? sp.walk * rand(.95, 1.05) : Math.max(20, Math.min(32, sp.len * 1.4)) * rand(.92, 1.08);
	}

	function roomFor(w, el) {
		return !w.sp.meme || el.getBoundingClientRect().width >= w.size * 1.5;
	}

	function spawnCrawler(fromEdge, force) {
		var sp = force || pickSpecies(null, memeCount(crawlers) >= Math.round(3 * density())), b = {
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

	function density() {
		return DENSITY[state.bugCount] || 1;
	}

	function target() {
		var k = density();
		return Math.max(Math.round(3 * k), Math.min(Math.round(12 * k), Math.round(W * H / 130000 * k)));
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
					b.a = steer(b.a, tx + Math.PI / 2, (b.rush ? 4 : 1.2) * dt);
				}
				else if (b.x < m || b.x > W - m || b.y < m || b.y > H - m) {
					b.a = steer(b.a, Math.atan2(H / 2 - b.y, W / 2 - b.x) + Math.PI / 2, 3 * dt);
				}
				b.v += ((flee || b.rush ? b.vmax * 3 : b.vmax) - b.v) * Math.min(1, 4 * dt);
				if (!flee && !b.rush && Math.random() < .22 * dt)
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
			if (used.indexOf(el) > -1 || el.closest('.kadr-sheet, #modal_overlay, header, .cbi-dropdown, #topmenu'))
				return false;
			var r = el.getBoundingClientRect();
			return r.width >= 64 && r.height >= 26 && r.top > 70 && r.bottom < H && r.left >= 0 && r.right <= W;
		});
	}

	function assign(w, list) {
		var fit = list.filter(function (el) { return roomFor(w, el); });
		var el = fit[Math.floor(Math.random() * fit.length)];
		if (!el)
			return false;
		list.splice(list.indexOf(el), 1);
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
		var want = Math.round((W < 700 ? 2 : 4) * density());
		walkers.forEach(function (w, i) {
			if (i >= want)
				w.leave = true;
		});
		walkers = walkers.filter(function (w) { return !(w.leave && (!w.el || w.lost > 0 || w.fade < .02)); });
		if (now > scanAt) {
			scanAt = now + 2500;
			var list = candidates();
			walkers.forEach(function (w) {
				if (!w.leave && (!w.el || !w.el.isConnected || w.lost > 1.5))
					assign(w, list);
			});
			while (walkers.length < want && list.length) {
				var sp = pickSpecies('stag', memeCount(walkers) >= Math.max(1, Math.round(density()))), w = { sp: sp, size: walkerSize(sp), ph: rand(0, TAU), seed: rand(0, 100), pause: 0, lost: 0, v: 0, vmax: sp.speed * rand(.5, .8) };
				if (!assign(w, list)) {
					if (!sp.meme)
						break;
					swapWalker(w, pickSpecies('stag', true));
					if (!assign(w, list))
						break;
				}
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
			if (w.leave)
				w.hidden = true;
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
			canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:700';
			D.body.appendChild(canvas);
			ctx = canvas.getContext('2d');
			resize();
			g.addEventListener('resize', resize);
			D.addEventListener('pointermove', onPointer, { passive: true });
			D.addEventListener('pointerdown', onPointer, { passive: true });
		}
		if (inside && state.bugs && !crawlers.length) {
			for (var i = 0, n = target(); i < n; i++)
				crawlers.push(spawnCrawler(false));
			var m = memes();
			if (m.length && !memeCount(crawlers))
				crawlers[0] = spawnCrawler(false, m[Math.floor(Math.random() * m.length)]);
		}
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

	function swapWalker(w, sp) {
		w.sp = sp;
		w.size = walkerSize(sp);
		w.vmax = sp.speed * rand(.5, .8);
	}

	function memeSwitch(on) {
		if (on) {
			var m = memes(), sp = m[Math.floor(Math.random() * m.length)];
			if (state.bugs)
				m.forEach(function (sp) { crawlers.unshift(spawnCrawler(true, sp)); });
			var fit = sp ? walkers.filter(function (w) { return w.el && w.el.isConnected && roomFor({ sp: sp, size: sp.walk * 1.05 }, w.el); }) : [];
			if (fit.length)
				swapWalker(fit[Math.floor(Math.random() * fit.length)], sp);
		}
		else {
			crawlers.forEach(function (b) {
				if (b.sp.meme) {
					b.leaving = b.rush = true;
					b.pause = 0;
				}
			});
			walkers.forEach(function (w) { if (w.sp.meme) swapWalker(w, pickSpecies('stag', true)); });
		}
	}

	function update(s) {
		var first = !booted, memeWas = state.bugMeme;
		booted = true;
		state = { bugs: !!s.bugs, bugWalk: !!s.bugWalk, bugLook: s.bugLook || 'color', bugMeme: !!s.bugMeme, bugCount: s.bugCount || 'normal' };
		readTheme();
		if (!state.bugs)
			crawlers = [];
		if (!state.bugWalk)
			walkers = [];
		var go = function () {
			if (!first && state.bugMeme !== !!memeWas)
				memeSwitch(state.bugMeme);
			if (state.bugs || state.bugWalk)
				start(first);
			else
				stop();
		};
		if (state.bugMeme && (state.bugs || state.bugWalk))
			faces(go);
		else
			go();
	}

	g.KadrBugs = {
		update: update,
		species: SPECIES.map(function (s) { return s.id; }),
		meme: MEME.map(function (s) { return s.id; }),
		ready: function (cb) { faces(cb); },
		count: function () {
			return {
				screen: crawlers.filter(function (b) { return !b.leaving && b.delay <= 0; }).length,
				buttons: walkers.filter(function (w) { return !w.leave && w.el && !w.lost; }).length,
				meme: crawlers.filter(function (b) { return b.sp.meme && !b.leaving; }).length + walkers.filter(function (w) { return w.sp.meme && !w.leave; }).length
			};
		},
		draw: function (c, id, view, x, y, opts) {
			var sp = SPECIES.concat(MEME).filter(function (s) { return s.id === id; })[0];
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
