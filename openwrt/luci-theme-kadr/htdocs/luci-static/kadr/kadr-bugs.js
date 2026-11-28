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

	function blocks(c, col, tip, P, h, n, z) {
		c.fillStyle = col;
		for (var i = 0; i < n; i++) {
			var p = bez(P, i / n);
			c.fillRect(p[0] - z * h / 2, p[1] - z * h / 2, z * h, z * h);
		}
		var e = bez(P, 1), q = z * h * 1.9;
		c.fillStyle = tip;
		c.fillRect(e[0] - q / 2, e[1] - q / 2, q, q);
	}

	function along(trail, ds, count) {
		var out = [ [ trail[0][0], trail[0][1] ] ], acc = 0, i = 1, px = trail[0][0], py = trail[0][1];
		while (out.length < count && i < trail.length) {
			var qx = trail[i][0], qy = trail[i][1], seg = Math.sqrt((qx - px) * (qx - px) + (qy - py) * (qy - py));
			if (seg > 1e-6 && acc + seg >= ds) {
				var k = (ds - acc) / seg;
				px += (qx - px) * k;
				py += (qy - py) * k;
				out.push([ px, py ]);
				acc = 0;
			}
			else {
				acc += seg;
				px = qx;
				py = qy;
				i++;
			}
		}
		while (out.length < 3)
			out.push([ out[out.length - 1][0], out[out.length - 1][1] + ds ]);
		return out;
	}

	var WORM = { edge: '#3b2117', base: '#774734', lit: '#9a6851', spec: 'rgba(255,240,232,.5)', groove: 'rgba(40,18,10,.42)', ridge: 'rgba(255,222,206,.2)', dirt: [ '#24160d', '#3a2718', '#5a4431' ] };

	function hash(n) {
		var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
		return x - Math.floor(x);
	}

	function normals(P) {
		var n = P.length, N = [];
		for (var i = 0; i < n; i++) {
			var a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
			N.push([ -dy / l, dx / l ]);
		}
		return N;
	}

	function lengths(P) {
		var S = [ 0 ];
		for (var i = 1; i < P.length; i++)
			S.push(S[i - 1] + Math.sqrt((P[i][0] - P[i - 1][0]) * (P[i][0] - P[i - 1][0]) + (P[i][1] - P[i - 1][1]) * (P[i][1] - P[i - 1][1])));
		return S;
	}

	function outline(c, P, N, rad) {
		var n = P.length, e = P[n - 1], ea = Math.atan2(N[n - 1][1], N[n - 1][0]), i;
		c.beginPath();
		for (i = 0; i < n; i++)
			c.lineTo(P[i][0] + N[i][0] * rad[i], P[i][1] + N[i][1] * rad[i]);
		c.arc(e[0], e[1], rad[n - 1], ea, ea - Math.PI, true);
		for (i = n - 1; i >= 0; i--)
			c.lineTo(P[i][0] - N[i][0] * rad[i], P[i][1] - N[i][1] * rad[i]);
		c.closePath();
	}

	function tube(c, R, P, rad, L, t, seed) {
		var n = P.length, N = normals(P), S = lengths(P), i, total = S[n - 1];
		outline(c, P, N, rad);
		if (R.rim) {
			c.lineWidth = R.px * 2;
			c.strokeStyle = R.rim;
			c.stroke();
		}
		if (R.mono) {
			fill(c, R.C());
		}
		else {
			fill(c, WORM.base);
			for (i = n - 2; i >= 0; i--) {
				var p = P[i], q = P[i + 1], a = N[i], b = N[i + 1], r0 = rad[i], r1 = rad[i + 1];
				var qx = q[0] + (q[0] - p[0]) * .2, qy = q[1] + (q[1] - p[1]) * .2;
				var o = a[0] * L[0] + a[1] * L[1], h = Math.max(.24, Math.min(.76, .5 - o * .3));
				var gr = c.createLinearGradient(p[0] + a[0] * r0, p[1] + a[1] * r0, p[0] - a[0] * r0, p[1] - a[1] * r0);
				gr.addColorStop(0, WORM.edge);
				gr.addColorStop(h - .22, WORM.base);
				gr.addColorStop(h, WORM.lit);
				gr.addColorStop(h + .22, WORM.base);
				gr.addColorStop(1, WORM.edge);
				c.beginPath();
				c.moveTo(p[0] + a[0] * r0, p[1] + a[1] * r0);
				c.lineTo(qx + b[0] * r1, qy + b[1] * r1);
				c.lineTo(qx - b[0] * r1, qy - b[1] * r1);
				c.lineTo(p[0] - a[0] * r0, p[1] - a[1] * r0);
				c.closePath();
				fill(c, gr);
			}
		}
		var step = .052, s = step * .7, k = 0, spots = [];
		while (s < total - step * .4) {
			var j = 1;
			while (j < n - 1 && S[j] < s)
				j++;
			var f = Math.max(0, Math.min(1, (s - S[j - 1]) / ((S[j] - S[j - 1]) || 1)));
			var x = P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f, y = P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f;
			var nx = N[j - 1][0] + (N[j][0] - N[j - 1][0]) * f, ny = N[j - 1][1] + (N[j][1] - N[j - 1][1]) * f, nl = Math.sqrt(nx * nx + ny * ny) || 1;
			var rr = (rad[j - 1] + (rad[j] - rad[j - 1]) * f) * .9, tx = -ny / nl, ty = nx / nl;
			nx /= nl;
			ny /= nl;
			c.beginPath();
			c.moveTo(x + nx * rr, y + ny * rr);
			c.quadraticCurveTo(x + tx * rr * .14, y + ty * rr * .14, x - nx * rr, y - ny * rr);
			c.lineWidth = rr * .1;
			c.strokeStyle = R.mono ? R.dk : WORM.groove;
			c.globalAlpha *= R.mono ? .45 : 1;
			c.stroke();
			c.globalAlpha /= R.mono ? .45 : 1;
			if (!R.mono) {
				c.beginPath();
				c.moveTo(x + nx * rr * .8 - tx * rr * .12, y + ny * rr * .8 - ty * rr * .12);
				c.quadraticCurveTo(x - tx * rr * .02, y - ty * rr * .02, x - nx * rr * .8 - tx * rr * .12, y - ny * rr * .8 - ty * rr * .12);
				c.lineWidth = rr * .07;
				c.strokeStyle = WORM.ridge;
				c.stroke();
				var u = (nx * L[0] + ny * L[1]) * .55, hw = .1 + .12 * hash(k * 5.3 + seed), hx = x + tx * step * .45, hy = y + ty * step * .45;
				c.beginPath();
				c.moveTo(hx + nx * rr * (u - hw), hy + ny * rr * (u - hw));
				c.lineTo(hx + nx * rr * (u + hw), hy + ny * rr * (u + hw));
				c.lineWidth = rr * .07;
				c.strokeStyle = WORM.spec;
				c.stroke();
				if (hash(k + seed) < .5)
					spots.push([ x + nx * rr * (hash(k * 3.1 + seed) * 1.6 - .8) + tx * rr * .25, y + ny * rr * (hash(k * 3.1 + seed) * 1.6 - .8) + ty * rr * .25, rr * (.05 + .06 * hash(k * 7.7 + seed)), WORM.dirt[k % 3] ]);
			}
			s += step * (1 + .35 * Math.sin(s / step * .55 - t * 6));
			k++;
		}
		spots.forEach(function (d) { oval(c, d[0], d[1], d[2], d[2], d[3]); });
	}

	function wormRad(r0, S, t, from) {
		var total = S[S.length - 1] || 1;
		return S.map(function (s) {
			var f = (s + from) / (total + from), taper = f < .6 ? 1 : 1 - .66 * Math.pow((f - .6) / .4, 1.25);
			return r0 * taper * (1 - .07 * Math.sin((s + from) / .052 * .55 - t * 6));
		});
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
		},
		{
			id: 'noob', len: 40, walk: 44, speed: 30, meme: true, voxel: true, reach: 1.15, goo: '#4a505e',
			head: [-.2, .1, .08], pro: [-.05, .19, .1], ely: [.2, .23, .3],
			legs: { y: [-.08, .07, .21], x: .17, f: .17, t: .19, w: .07, tip: .075 },
			col: { head: '#2a2d36', pro: '#30333d', ely: '#2b2e38', leg: '#353843', claw: '#f1f1f1', band: '#1d6fd6', ant: '#2a2d35', tip: '#f4f4f4' },
			side: { clear: .1, eh: .24, ph: .13, hh: .1 },
			gloss: 1.2,
			face: { h: .5, aspect: 1.2188, top: -.25, side: [.22, -.34], antL: [-.242, -.358], antR: [.075, -.393] },
			marks: function (c, R, v, G) {
				c.fillStyle = this.col.band;
				if (v === 'top')
					c.fillRect(-G.erx, G.ey - .03, G.erx * 2, .15);
				else
					c.fillRect(G.ex - .07, G.base - G.eh * 1.05, .15, G.eh * 1.1);
			},
			proMarks: function (c, R, v, G) {
				c.fillStyle = this.col.band;
				if (v === 'top')
					c.fillRect(-G.prx, G.py + .02, G.prx * 2, .05);
			},
			deco: function (c, R, w, h, st) {
				if (st !== 'back')
					return;
				var F = this.face, ant = R.C(this.col.ant), tip = R.mono ? R.dk : this.col.tip;
				var wig = Math.sin(R.t * (R.still ? 6 : 3) + R.seed) * h * (R.still ? .05 : .025);
				var l = [ F.antL[0] * w, F.antL[1] * h ], r = [ F.antR[0] * w, F.antR[1] * h ];
				blocks(c, ant, tip, [ l[0], l[1], l[0] - .05 * h, l[1] - .45 * h, l[0] - .3 * h, l[1] - .62 * h, l[0] - .46 * h, l[1] - .42 * h + wig ], h, 9, .085);
				blocks(c, ant, tip, [ r[0], r[1], r[0] + .05 * h, r[1] - .42 * h, r[0] + .28 * h, r[1] - .58 * h, r[0] + .43 * h, r[1] - .38 * h - wig ], h, 9, .085);
			}
		},
		{
			id: 'wolfworm', len: 40, walk: 36, speed: 17, meme: true, worm: true, reach: 2.6, room: 2.3,
			head: [-.1, .1, .1], pro: [0, .1, .1], ely: [.4, .12, .9],
			legs: { y: [ 0, 0, 0 ], x: 0, f: 0, t: 0, w: 0, skip: 3 },
			col: { head: '#6b5a4a', leg: '#000', ant: '#000' },
			side: { clear: .08, eh: .1, ph: .1, hh: .1 },
			face: { h: .8, aspect: .8133, neck: [ .0654, .443 ], neckR: .3018 },
			goo: '#6e2b1d',
			deco: function () {},
			lift: .3,
			top: function (c, sp, ph, R) {
				var F = sp.face, r0 = F.neckR * F.h * F.aspect, t = R.t + R.seed, a = R.ang || 0, i;
				var P = along(R.trail && R.trail.length > 1 ? R.trail : [ [ 0, 0 ], [ 0, 2.4 ] ], .075, 21), S = lengths(P);
				var rad = wormRad(r0, S, t, .3), up = [ -Math.sin(a), -Math.cos(a) ], L = [ -.6 * Math.cos(a) - .8 * Math.sin(a), .6 * Math.sin(a) - .8 * Math.cos(a) ];
				var fx = P[0][0] - P[1][0], fy = P[0][1] - P[1][1], fl = Math.sqrt(fx * fx + fy * fy) || 1;
				fx /= fl;
				fy /= fl;
				var bob = R.still ? Math.sin(t * 2) * .012 : Math.sin(ph * 2) * .016, sway = Math.sin(t * 1.3) * .03;
				var J = [ up[0] * (sp.lift + bob) - up[1] * sway, up[1] * (sp.lift + bob) + up[0] * sway ];
				if (R.shadow) {
					var ox = (1.5 * Math.cos(a) + 2.5 * Math.sin(a)) * R.px, oy = (2.5 * Math.cos(a) - 1.5 * Math.sin(a)) * R.px;
					c.save();
					c.translate(ox, oy);
					outline(c, P, normals(P), rad);
					fill(c, 'rgba(0,0,0,.13)');
					c.restore();
				}
				var spine = [], sr = [];
				spine.push([ J[0] + up[0] * .09, J[1] + up[1] * .09 ]);
				sr.push(r0);
				for (i = 0; i < 6; i++) {
					spine.push(bez([ J[0], J[1], J[0] - up[0] * .16, J[1] - up[1] * .16, fx * .13, fy * .13, 0, 0 ], i / 6));
					sr.push(r0 * (1 - .06 * Math.sin(i * .9 - t * 6)));
				}
				tube(c, R, spine.concat(P), sr.concat(rad), L, t, R.seed);
				memeHead(c, sp, R, J[0], J[1], (R.still ? Math.sin(t * 1.7) * .07 : Math.sin(ph) * .05) + sway * .8);
			},
			sideView: function (c, sp, ph, R) {
				var F = sp.face, r0 = F.neckR * F.h * F.aspect, t = R.t + R.seed, i;
				var bob = R.still ? Math.sin(t * 2) * .01 : Math.sin(ph * 2) * .014, J = [ .42 + Math.sin(t * 1.3) * .015, -.5 + bob ], front = .12, back = -.9;
				var P = [ [ J[0], J[1] - .09 ] ], rad = [ r0 ];
				if (R.shadow)
					oval(c, (front + back) / 2 + .12, 0, (front - back) / 2 + .22, .045, 'rgba(0,0,0,.14)');
				for (i = 0; i <= 6; i++) {
					P.push(bez([ J[0], J[1], J[0] - .01, J[1] + .26, front + .26, -r0, front, -r0 ], i / 6));
					rad.push(r0 * (1 - .05 * Math.sin(i * .9 - t * 6)));
				}
				var body = [];
				for (i = 1; i <= 15; i++)
					body.push([ front + (back - front) * i / 15, 0 ]);
				var S = lengths([ [ front, 0 ] ].concat(body)), br = wormRad(r0, S, t, .45);
				body.forEach(function (p, k) {
					p[1] = -br[k + 1];
					P.push(p);
					rad.push(br[k + 1]);
				});
				tube(c, R, P, rad, [ R.flip ? .6 : -.6, -.8 ], t, R.seed);
				memeHead(c, sp, R, J[0], J[1], R.still ? Math.sin(t * 2) * .06 : Math.sin(ph) * .04);
			}
		}
	];

	var PHOTO = {
		builder: 'data:image/webp;base64,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',
		grinner: 'data:image/webp;base64,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',
		noob: 'data:image/webp;base64,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',
		wolfworm: 'data:image/webp;base64,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'
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
		var F = sp.face, img = faceImg(sp, R), h = F.h, w = h * F.aspect, ax = F.neck ? F.neck[0] * w : 0, ay = F.neck ? F.neck[1] * h : 0;
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
			c.drawImage(img, -w / 2 - ax, -h / 2 - ay, w, h);
			c.restore();
		}
		else
			oval(c, -ax, -ay, w * .48, h * .48, R.C(sp.col.head));
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
				if (L.tip) {
					c.fillStyle = R.mono ? R.dk : sp.col.claw;
					c.fillRect(kx + s * Math.cos(a2) * L.t - L.tip / 2, ky + Math.sin(a2) * L.t - L.tip / 2, L.tip, L.tip);
				}
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
		if (sp.top)
			return sp.top(c, sp, ph, R);
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
			if (L.tip) {
				c.fillStyle = R.mono ? R.dk : far ? shade(sp.col.claw, .7) : sp.col.claw;
				c.fillRect(fx - L.tip / 2, -lift - L.tip, L.tip, L.tip);
			}
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
		if (sp.sideView)
			return sp.sideView(c, sp, ph, R);
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

	var state = { bugs: false, bugWalk: false, bugLook: 'color', bugVerse: false, bugMode: '', bugCount: 'normal', bugSound: true };
	var SELF = D.currentScript && D.currentScript.src ? D.currentScript.src : '';
	var BUILD_KEY = 'kadr-luci-build', DAY = 864e5, metaLoading = false, raidLoading = false, kills = 0, squashed = 0;
	var DENSITY = { few: .5, normal: 1, many: 2 };
	var theme = { acc: [63, 224, 161], light: false, shadows: true };
	var canvas = null, ctx = null, off = null, octx = null;
	var raf = 0, last = 0, now = 0, dpr = 1, W = 0, H = 0;
	var crawlers = [], walkers = [], splats = [], drops = [], booted = false, scanAt = 0, swallow = null;
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

	function localTrail(trail, x, y, size, angle) {
		if (!trail)
			return null;
		var ca = Math.cos(-angle), sa = Math.sin(-angle);
		return trail.map(function (p) {
			var dx = (p[0] - x) / size, dy = (p[1] - y) / size;
			return [ dx * ca - dy * sa, dx * sa + dy * ca ];
		});
	}

	function drawBug(c, sp, view, x, y, angle, flip, size, ph, still, seed, trail) {
		var look = state.bugLook, mono = look === 'mono', pixel = look === 'pixel';
		if (pixel || sp.voxel)
			return drawPixel(c, sp, view, x, y, angle, flip, size * (!pixel ? 1 : sp.meme ? 1.1 : view === 'top' ? PIX_SCALE : 1.15), ph, still, seed, trail, mono);
		var R = render(sp, still, seed, mono, false, size);
		R.ang = view === 'top' ? angle : 0;
		R.trail = view === 'top' ? localTrail(trail, x, y, size, angle) : null;
		R.flip = view !== 'top' && flip;
		R.shadow = theme.light && theme.shadows && !mono;
		c.save();
		if (theme.light && theme.shadows && !mono && !sp.worm) {
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

	function drawPixel(c, sp, view, x, y, angle, flip, size, ph, still, seed, trail, mono) {
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
		var R = render(sp, still, seed, !!mono, true, unit);
		R.ang = view === 'top' ? qa : 0;
		R.trail = view === 'top' ? localTrail(trail, x, y, size, qa) : null;
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
		return state.bugVerse ? MEME.filter(function (s) { return FACES[s.id]; }) : [];
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
		return !w.sp.meme || el.getBoundingClientRect().width >= w.size * (w.sp.room || 1.5);
	}

	function spawnCrawler(fromEdge, force) {
		var sp = force || pickSpecies(null, memeCount(crawlers) >= Math.round(4 * density())), b = {
			sp: sp, scale: rand(.9, 1.12), v: 0, turn: 0, ph: rand(0, TAU), seed: rand(0, 100),
			pause: 0, life: rand(25, 70), leaving: false, delay: 0, hp: hpOf(sp), hpMax: hpOf(sp), hurtAt: -1e9, squish: 0, boost: 0
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
		if (sp.worm) {
			var size = sp.len * b.scale * CRAWL_SCALE;
			b.step = size * .045;
			b.trail = [];
			for (var i = 0; i < 56; i++)
				b.trail.push([ b.x - Math.sin(b.a) * i * b.step, b.y + Math.cos(b.a) * i * b.step ]);
		}
		return b;
	}

	function hpOf(sp) {
		return sp.meme ? 5 : sp.len <= 16 ? 1 : sp.len <= 25 ? 2 : 3;
	}

	function crawlSize(b) {
		var size = b.sp.len * b.scale * CRAWL_SCALE;
		return state.bugLook === 'pixel' ? size * (b.sp.meme ? 1.1 : PIX_SCALE) : size;
	}

	function walkSize(w) {
		return state.bugLook === 'pixel' ? w.size * (w.sp.meme ? 1.1 : 1.15) : w.size;
	}

	function walkerAt(w) {
		return [ w.rect.left + w.inset + w.x, w.rect.top + .5 ];
	}

	function shown(w) {
		return !!(w.el && w.rect && !w.lost && !w.dead && !w.leave && w.fade > .5);
	}

	function circles(o) {
		var sp = o.sp, F = sp.face, out, i;
		if (o.walker) {
			var p = walkerAt(o), z = walkSize(o), s = o.dir < 0 ? -1 : 1;
			if (sp.worm)
				return [ [ p[0] + s * .38 * z, p[1] - .86 * z, .3 * z ], [ p[0] + s * .3 * z, p[1] - .4 * z, .18 * z ], [ p[0], p[1] - .18 * z, .2 * z ], [ p[0] - s * .4 * z, p[1] - .16 * z, .19 * z ], [ p[0] - s * .75 * z, p[1] - .12 * z, .15 * z ] ];
			out = [ [ p[0], p[1] - z * .16, z * .34 ] ];
			if (F)
				out.push([ p[0] + s * F.side[0] * z, p[1] + (F.side[1] - sp.side.clear) * z, F.h * z * .45 ]);
			return out;
		}
		var size = crawlSize(o);
		if (sp.worm) {
			var h = F.h * size, w = h * F.aspect;
			out = [ [ o.x - F.neck[0] * w, o.y - sp.lift * size - F.neck[1] * h, w * .45 ] ];
			for (i = 0; i < Math.min(34, o.trail.length); i += 5)
				out.push([ o.trail[i][0], o.trail[i][1], size * .21 ]);
			return out;
		}
		out = [ [ o.x, o.y, size * .36 ] ];
		if (F)
			out.push([ o.x - Math.sin(o.a) * F.top * size, o.y + Math.cos(o.a) * F.top * size, F.h * size * .45 ]);
		return out;
	}

	function gooCol(sp) {
		return state.bugLook === 'mono' ? 'rgba(' + theme.acc.join(',') + ',.55)' : sp.goo || '#7d8c2e';
	}

	function hurt(o, dmg, kind, fx, fy) {
		if (o.dead || !(o.hp > 0))
			return false;
		o.hp = Math.max(0, o.hp - dmg);
		o.hurtAt = now;
		o.squish = 1;
		var c0 = circles(o)[0];
		if (kind === 'squash')
			for (var i = 0; i < 5; i++) {
				var a = rand(0, TAU), v = rand(40, 110);
				drops.push({ x: c0[0], y: c0[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.walker ? 70 : 0), g: o.walker ? 420 : 0, t: 0, life: rand(.3, .55), r: rand(1.2, 2.4), col: gooCol(o.sp) });
			}
		if (o.hp > .001) {
			o.boost = 1.6;
			o.pause = 0;
			if (o.walker)
				o.dir = fx === undefined ? -o.dir : fx < walkerAt(o)[0] ? 1 : -1;
			else if (fx !== undefined)
				o.a = Math.atan2(o.y - fy, o.x - fx) + Math.PI / 2;
			return false;
		}
		kills++;
		if (kind === 'squash')
			squashed++;
		o.dead = .001;
		o.death = kind;
		o.leaving = true;
		o.v = 0;
		if (kind === 'squash')
			splat(o);
		return true;
	}

	function splat(o) {
		var at = o.walker ? walkerAt(o) : [ o.x, o.y ], z = o.walker ? walkSize(o) : crawlSize(o);
		var s = { x: at[0], y: at[1], r: z * (o.walker ? .3 : o.sp.worm ? .26 : .34), col: o.sp.goo || '#7d8c2e', t: now, rot: o.walker ? 0 : rand(0, TAU), flat: !!o.walker, el: o.walker ? o.el : null, seed: rand(0, 99), img: null, look: '' };
		if (s.el) {
			s.ox = at[0] - o.rect.left;
			s.oy = at[1] - o.rect.top;
		}
		splats.push(s);
		if (splats.length > 24)
			splats.shift();
	}

	function splatImg(s) {
		var key = state.bugLook + theme.acc.join(',');
		if (s.img && s.look === key)
			return s.img;
		var k = state.bugLook === 'pixel' ? .5 : dpr, R = s.r, sy = s.flat ? .3 : .8, n = Math.ceil(R * 4.6 * k) + 2, cv = D.createElement('canvas'), c = cv.getContext('2d');
		var col = state.bugLook === 'mono' ? 'rgba(' + theme.acc.join(',') + ',.5)' : s.col;
		cv.width = cv.height = n;
		c.translate(n / 2, n / 2);
		c.scale(k, k);
		oval(c, 0, 0, R, R * sy, col);
		for (var i = 0; i < 8; i++) {
			var a = hash(s.seed + i) * TAU, d = R * (.9 + .9 * hash(s.seed + i * 2.3)), rr = R * (.08 + .16 * hash(s.seed + i * 4.1));
			oval(c, Math.cos(a) * d, Math.sin(a) * d * sy, rr, rr * (s.flat ? .6 : 1), col);
		}
		if (state.bugLook !== 'mono')
			oval(c, R * .1, -R * .06 * sy, R * .5, R * .36 * sy, 'rgba(0,0,0,.2)');
		s.img = cv;
		s.look = key;
		s.half = n / k / 2;
		return cv;
	}

	function drawSplats() {
		splats = splats.filter(function (s) { return now - s.t < 9000 && (!s.el || s.el.isConnected); });
		splats.forEach(function (s) {
			var age = (now - s.t) / 1000, x = s.x, y = s.y;
			if (s.el) {
				var r = s.el.getBoundingClientRect();
				x = r.left + s.ox;
				y = r.top + s.oy;
			}
			var img = splatImg(s);
			ctx.save();
			ctx.globalAlpha = Math.min(1, age * 8) * (age < 6 ? .8 : .8 * (1 - (age - 6) / 3));
			ctx.translate(x, y);
			ctx.rotate(s.rot);
			ctx.imageSmoothingEnabled = state.bugLook !== 'pixel';
			ctx.drawImage(img, -s.half, -s.half, s.half * 2, s.half * 2);
			ctx.restore();
		});
	}

	function stepDrops(dt) {
		drops = drops.filter(function (d) {
			var f = 1 - Math.min(1, dt * (d.g ? .5 : 5));
			d.t += dt;
			d.vx *= f;
			d.vy = d.vy * f + d.g * dt;
			d.x += d.vx * dt;
			d.y += d.vy * dt;
			return d.t < d.life;
		});
		drops.forEach(function (d) {
			ctx.globalAlpha = 1 - d.t / d.life;
			if (state.bugLook === 'pixel') {
				ctx.fillStyle = d.col;
				ctx.fillRect(Math.round(d.x / PIX) * PIX - PIX, Math.round(d.y / PIX) * PIX - PIX, PIX * 2, PIX * 2);
			}
			else
				oval(ctx, d.x, d.y, d.r, d.r, d.col);
		});
		ctx.globalAlpha = 1;
	}

	function bar(x, y, o, a) {
		var n = o.hpMax, sw = 6, gap = 1.5, w = n * sw + (n - 1) * gap, h = 4, f = o.hp / o.hpMax, i;
		var col = state.bugLook === 'mono' ? 'rgb(' + theme.acc.join(',') + ')' : f > .6 ? '#5bd36b' : f > .3 ? '#f2c14e' : '#f0544a';
		var x0 = Math.round(x - w / 2), y0 = Math.round(y - h);
		ctx.globalAlpha = a;
		ctx.fillStyle = 'rgba(12,12,14,.66)';
		ctx.fillRect(x0 - 1.5, y0 - 1.5, w + 3, h + 3);
		for (i = 0; i < n; i++) {
			var part = Math.max(0, Math.min(1, o.hp - i));
			ctx.fillStyle = 'rgba(255,255,255,.16)';
			ctx.fillRect(x0 + i * (sw + gap), y0, sw, h);
			if (part > 0) {
				ctx.fillStyle = col;
				ctx.fillRect(x0 + i * (sw + gap), y0, sw * part, h);
			}
		}
		ctx.globalAlpha = 1;
	}

	function drawBars() {
		var mark = function (o) {
			var age = now - o.hurtAt;
			if (o.dead || o.hpMax < 2 || o.hp >= o.hpMax || age > 2600)
				return;
			var q = circles(o).reduce(function (b, c) { return c[1] - c[2] < b[1] - b[2] ? c : b; });
			bar(q[0], q[1] - q[2] - 5, o, Math.min(1, (2600 - age) / 400));
		};
		if (state.bugs)
			crawlers.forEach(function (b) { if (b.delay <= 0) mark(b); });
		if (state.bugWalk)
			walkers.forEach(function (w) { if (shown(w)) mark(w); });
	}

	function targets() {
		var out = [];
		if (state.bugs)
			crawlers.forEach(function (b) {
				if (!b.dead && b.delay <= 0)
					out.push({ ref: b, x: b.x, y: b.y, vx: Math.sin(b.a) * b.v, vy: -Math.cos(b.a) * b.v, meme: !!b.sp.meme, circles: circles(b) });
			});
		if (state.bugWalk)
			walkers.forEach(function (w) {
				if (!shown(w))
					return;
				var p = walkerAt(w);
				out.push({ ref: w, x: p[0], y: p[1] - walkSize(w) * .2, vx: w.dir * w.v, vy: 0, meme: !!w.sp.meme, circles: circles(w) });
			});
		return out;
	}

	function covered(x, y) {
		for (var el = D.elementFromPoint(x, y); el && el !== D.body && el !== D.documentElement; el = el.parentElement) {
			var cs = g.getComputedStyle(el);
			if (cs.position !== 'static' && cs.zIndex !== 'auto' && +cs.zIndex > 700)
				return true;
		}
		return false;
	}

	function pick(x, y, slop) {
		var best = null, bd = 0;
		var test = function (o) {
			circles(o).forEach(function (q) {
				var d = Math.sqrt((q[0] - x) * (q[0] - x) + (q[1] - y) * (q[1] - y)) - q[2] - slop;
				if (d < bd) {
					bd = d;
					best = o;
				}
			});
		};
		if (state.bugs)
			crawlers.forEach(function (b) { if (!b.dead && b.delay <= 0) test(b); });
		if (state.bugWalk)
			walkers.forEach(function (w) { if (shown(w)) test(w); });
		return best;
	}

	function onPress(ev) {
		if (ev.button > 0 || ev.isPrimary === false || !canvas)
			return;
		var x = ev.clientX, y = ev.clientY, cov = covered(x, y);
		pointer.x = x;
		pointer.y = y;
		pointer.t = now;
		if (g.KadrRaid && g.KadrRaid.press(x, y, ev, cov)) {
			ev.preventDefault();
			ev.stopPropagation();
			swallow = { x: x, y: y, t: g.performance.now() };
			return;
		}
		var o = cov ? null : pick(x, y, ev.pointerType === 'mouse' ? 1 : 6);
		if (!o)
			return;
		ev.preventDefault();
		ev.stopPropagation();
		swallow = { x: x, y: y, t: g.performance.now() };
		hurt(o, 1, 'squash', x, y);
	}

	function onClick(ev) {
		var q = swallow;
		swallow = null;
		if (q && g.performance.now() - q.t < 900 && Math.abs(ev.clientX - q.x) < 32 && Math.abs(ev.clientY - q.y) < 32) {
			ev.preventDefault();
			ev.stopPropagation();
		}
	}

	function buildStart() {
		try {
			var s = +(JSON.parse(g.localStorage.getItem(BUILD_KEY)) || {}).start;
			return s > 0 ? s : 0;
		}
		catch (e) {
			return 0;
		}
	}

	function buildProgress() {
		var s = buildStart();
		return s ? Math.min(1, Math.max(0, (Date.now() - s) / DAY)) : -1;
	}

	function beginBuild() {
		if (buildStart())
			return;
		try {
			g.localStorage.setItem(BUILD_KEY, JSON.stringify({ start: Date.now() }));
		}
		catch (e) {}
		g.dispatchEvent(new Event('kadr-build'));
	}

	function metaWanted() {
		var p = buildProgress();
		return p >= 0 && (p < 1 || state.bugVerse);
	}

	function loadRaid() {
		if (g.KadrRaid || raidLoading || !SELF)
			return;
		raidLoading = true;
		var s = D.createElement('script');
		s.src = SELF.replace(/kadr-bugs\.js/, 'kadr-raid.js');
		s.async = true;
		s.onload = function () {
			if (g.KadrRaid)
				g.KadrRaid.sync(state);
		};
		s.onerror = function () { raidLoading = false; };
		D.head.appendChild(s);
	}

	function loadMeta() {
		if (g.KadrMeta || metaLoading || !SELF)
			return;
		metaLoading = true;
		var s = D.createElement('script');
		s.src = SELF.replace(/kadr-bugs\.js/, 'kadr-meta.js');
		s.async = true;
		s.onerror = function () { metaLoading = false; };
		D.head.appendChild(s);
	}

	function world(dt) {
		var p = buildProgress();
		return {
			W: W, H: H, dpr: dpr, t: now / 1000, dt: dt, progress: p, armed: p >= 1 && state.bugVerse,
			look: state.bugLook, acc: theme.acc, light: theme.light, shadows: theme.shadows, sound: state.bugSound && p >= 0 && p < 1,
			targets: targets(), hurt: hurt, pointer: pointer
		};
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
			if (b.dead) {
				b.dead += dt;
				return;
			}
			b.squish = Math.max(0, b.squish - dt * 6);
			b.boost = Math.max(0, b.boost - dt);
			if (idx >= want)
				b.leaving = true;
			b.life -= dt;
			if (b.life <= 0)
				b.leaving = true;
			var size = b.sp.len * b.scale * CRAWL_SCALE, m = 46;
			var dx = b.x - pointer.x, dy = b.y - pointer.y, flee = fresh && dx * dx + dy * dy < 100 * 100, fast = b.boost > 0 || b.rush ? 3 : flee ? 2.2 : 1;
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
				b.v += (b.vmax * fast - b.v) * Math.min(1, 4 * dt);
				if (fast === 1 && Math.random() < .22 * dt)
					b.pause = rand(.4, 2.4);
			}
			b.x += Math.sin(b.a) * b.v * dt;
			b.y -= Math.cos(b.a) * b.v * dt;
			b.ph += b.v * dt / (size * .2);
			b.still = b.v < 3;
			if (b.trail) {
				var t0 = b.trail[0];
				if ((b.x - t0[0]) * (b.x - t0[0]) + (b.y - t0[1]) * (b.y - t0[1]) >= b.step * b.step) {
					b.trail.unshift([ b.x, b.y ]);
					b.trail.length = 56;
				}
				else {
					t0[0] = b.x;
					t0[1] = b.y;
				}
			}
		});
		crawlers = crawlers.filter(function (b) {
			var out = b.x < -140 || b.x > W + 140 || b.y < -140 || b.y > H + 140;
			return !(b.dead > (b.death === 'squash' ? .55 : 1.3)) && !(b.leaving && out) && !(b.delay <= 0 && out && b.life < 15);
		});
	}

	function drawCrawlers() {
		crawlers.forEach(function (b) {
			if (b.delay > 0)
				return;
			var size = b.sp.len * b.scale * CRAWL_SCALE;
			if (!b.dead)
				return drawBug(ctx, b.sp, 'top', b.x, b.y, b.a, false, size * (1 - .14 * b.squish), b.ph, b.still, b.seed, b.trail);
			ctx.save();
			if (b.death === 'squash') {
				var q = Math.min(1, b.dead / .55);
				ctx.globalAlpha = 1 - q;
				drawBug(ctx, b.sp, 'top', b.x, b.y, b.a, false, size * (1.04 + .16 * q), b.ph, true, b.seed, b.trail);
			}
			else {
				var k = Math.min(1, b.dead / 1.3);
				ctx.globalAlpha = 1 - Math.max(0, (b.dead - .4) / .9);
				drawBug(ctx, b.sp, 'top', b.x, b.y, b.a + b.dead * 7, false, size * (1 - k * .35), b.ph + b.dead * 60, true, b.seed);
			}
			ctx.restore();
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
		walkers = walkers.filter(function (w) { return !(w.leave && (!w.el || w.lost > 0 || w.fade < .02)) && !(w.dead > (w.death === 'squash' ? .8 : 1.2)); });
		if (now > scanAt) {
			scanAt = now + 2500;
			var list = candidates();
			walkers.forEach(function (w) {
				if (!w.leave && (!w.el || !w.el.isConnected || w.lost > 1.5))
					assign(w, list);
			});
			while (walkers.length < want && list.length) {
				var sp = pickSpecies('stag', memeCount(walkers) >= Math.max(1, Math.round(density()))), w = { walker: true, sp: sp, size: walkerSize(sp), ph: rand(0, TAU), seed: rand(0, 100), pause: 0, lost: 0, v: 0, vmax: sp.speed * rand(.5, .8), hp: hpOf(sp), hpMax: hpOf(sp), hurtAt: -1e9, squish: 0, boost: 0 };
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
			if (w.dead) {
				w.dead += dt;
				return;
			}
			w.squish = Math.max(0, w.squish - dt * 6);
			w.boost = Math.max(0, w.boost - dt);
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
				var rush = near || w.boost > 0;
				w.v += ((rush ? w.vmax * 3 : w.vmax) - w.v) * Math.min(1, 4 * dt);
				if (!rush && Math.random() < .2 * dt)
					w.pause = rand(.5, 2.5);
				else if (!rush && Math.random() < .06 * dt)
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
			var p = walkerAt(w);
			if (!w.dead) {
				ctx.globalAlpha = w.fade;
				drawBug(ctx, w.sp, 'side', p[0], p[1], 0, w.dir < 0, w.size * (1 - .14 * w.squish), w.ph, w.still, w.seed);
				ctx.globalAlpha = 1;
				return;
			}
			ctx.save();
			ctx.translate(p[0], p[1]);
			if (w.death === 'squash') {
				var q = Math.min(1, w.dead / .12);
				ctx.globalAlpha = 1 - Math.max(0, (w.dead - .3) / .5);
				ctx.scale(1 + .3 * q, 1 - .72 * q);
			}
			else {
				ctx.globalAlpha = 1 - Math.min(1, w.dead / 1.2);
				ctx.translate(0, -w.size * .2 + 110 * w.dead * w.dead);
				ctx.rotate((w.dir < 0 ? -1 : 1) * Math.min(Math.PI, w.dead * 7));
				ctx.translate(0, w.size * .2);
			}
			drawBug(ctx, w.sp, 'side', 0, 0, 0, w.dir < 0, w.size, w.ph, true, w.seed);
			ctx.restore();
		});
	}

	function frame(t) {
		raf = g.requestAnimationFrame(frame);
		var dt = Math.min(.05, Math.max(0, (t - last) / 1000));
		last = t;
		now = t;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		drawSplats();
		if (state.bugs) {
			updateCrawlers(dt);
			drawCrawlers();
		}
		if (state.bugWalk) {
			updateWalkers(dt);
			drawWalkers();
		}
		stepDrops(dt);
		drawBars();
		if (metaWanted()) {
			if (g.KadrMeta)
				g.KadrMeta.frame(ctx, world(dt));
			else
				loadMeta();
		}
		else if (g.KadrMeta) {
			g.KadrMeta.idle();
			if (!state.bugs && !state.bugWalk)
				stop();
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
			g.addEventListener('pointerdown', onPress, true);
			g.addEventListener('click', onClick, true);
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
		if (g.KadrMeta)
			g.KadrMeta.idle();
		if (raf)
			g.cancelAnimationFrame(raf);
		raf = 0;
		crawlers = [];
		walkers = [];
		splats = [];
		drops = [];
		if (canvas) {
			canvas.remove();
			canvas = ctx = null;
			g.removeEventListener('resize', resize);
			D.removeEventListener('pointermove', onPointer);
			D.removeEventListener('pointerdown', onPointer);
			g.removeEventListener('pointerdown', onPress, true);
			g.removeEventListener('click', onClick, true);
		}
	}

	function swapWalker(w, sp) {
		w.sp = sp;
		w.size = walkerSize(sp);
		w.vmax = sp.speed * rand(.5, .8);
		w.hp = w.hpMax = hpOf(sp);
	}

	function memeSwitch(on) {
		if (on) {
			var m = memes(), sp = m[Math.floor(Math.random() * m.length)];
			if (state.bugs)
				m.slice().sort(function () { return Math.random() - .5; }).slice(0, Math.max(1, Math.round(4 * density()))).forEach(function (sp) { crawlers.unshift(spawnCrawler(true, sp)); });
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
		var first = !booted, memeWas = state.bugVerse;
		booted = true;
		state = { bugs: !!s.bugs, bugWalk: !!s.bugWalk, bugLook: s.bugLook || 'color', bugVerse: !!s.bugVerse, bugMode: s.bugMode || '', bugCount: s.bugCount || 'normal', bugSound: s.bugSound !== false };
		if (state.bugVerse && state.bugMode === 'hard')
			loadRaid();
		if (g.KadrRaid)
			g.KadrRaid.sync(state);
		if (state.bugVerse && (state.bugs || state.bugWalk))
			beginBuild();
		readTheme();
		if (!state.bugs)
			crawlers = [];
		if (!state.bugWalk)
			walkers = [];
		var go = function () {
			if (!first && state.bugVerse !== !!memeWas)
				memeSwitch(state.bugVerse);
			if (state.bugs || state.bugWalk || metaWanted())
				start(first);
			else
				stop();
		};
		if (state.bugVerse && (state.bugs || state.bugWalk))
			faces(go);
		else
			go();
	}

	g.KadrBugs = {
		update: update,
		species: SPECIES.map(function (s) { return s.id; }),
		meme: MEME.map(function (s) { return s.id; }),
		ready: function (cb) { faces(cb); },
		build: function () { return { start: buildStart(), progress: buildProgress() }; },
		where: function () {
			return crawlers.filter(function (b) { return !b.dead && b.delay <= 0; }).map(function (b) { return { id: b.sp.id, place: 'screen', x: b.x, y: b.y, hp: b.hp, hpMax: b.hpMax, hits: circles(b) }; })
				.concat(walkers.filter(shown).map(function (w) { var p = walkerAt(w); return { id: w.sp.id, place: 'button', x: p[0], y: p[1], hp: w.hp, hpMax: w.hpMax, hits: circles(w) }; }));
		},
		count: function () {
			return {
				screen: crawlers.filter(function (b) { return !b.leaving && b.delay <= 0; }).length,
				buttons: walkers.filter(function (w) { return !w.leave && w.el && !w.lost; }).length,
				meme: crawlers.filter(function (b) { return b.sp.meme && !b.leaving; }).length + walkers.filter(function (w) { return w.sp.meme && !w.leave; }).length,
				dead: crawlers.filter(function (b) { return b.dead; }).length,
				kills: kills,
				squashed: squashed
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
			drawBug(c, sp, view, x, y, opts.angle || 0, !!opts.flip, (opts.size || sp.len), opts.phase || 0, !!opts.still, opts.seed || 1, opts.trail);
			state.bugLook = prev;
		}
	};
})(window);
