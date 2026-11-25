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

	function wormBody(c, R, sp, pts, t) {
		var col = sp.col, n = pts.length, i, p, f, r;
		for (i = n - 1; i >= 0; i--) {
			p = pts[i];
			f = i / (n - 1);
			r = (.19 - .1 * f) * (1 + .1 * Math.sin(i * .9 - t * 6));
			oval(c, p[0], p[1], r, r, R.C(i % 2 ? col.skin : col.ring));
			if (!R.mono && i > 3 && i < 8)
				oval(c, p[0], p[1], r * .92, r * .92, col.band);
		}
		if (R.mono)
			return;
		for (i = 0; i < n; i++) {
			p = pts[i];
			f = i / (n - 1);
			r = .19 - .1 * f;
			oval(c, p[0] - r * .32, p[1] - r * .38, r * .34, r * .2, white(.32));
			if ((i * 7) % 5 === 0)
				oval(c, p[0] + r * .45, p[1] + r * .15, .014, .014, col.dirt);
			if ((i * 3) % 7 === 1)
				oval(c, p[0] - r * .5, p[1] + r * .3, .011, .011, col.dirt);
		}
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
			id: 'noob', len: 40, walk: 44, speed: 30, meme: true, voxel: true, reach: 1.15,
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
			id: 'wolfworm', len: 40, walk: 46, speed: 17, meme: true, worm: true, reach: 2.5,
			head: [-.1, .1, .1], pro: [0, .1, .1], ely: [.4, .12, .9],
			legs: { y: [ 0, 0, 0 ], x: 0, f: 0, t: 0, w: 0, skip: 3 },
			col: { head: '#6b5a4a', skin: '#c27c80', ring: '#a9636a', band: '#d99a92', dirt: '#3a2a20', leg: '#000', ant: '#000' },
			side: { clear: .08, eh: .1, ph: .1, hh: .1 },
			face: { h: .62, aspect: 1.0078 },
			deco: function () {},
			top: function (c, sp, ph, R) {
				var pts = along(R.trail && R.trail.length > 1 ? R.trail : [ [ 0, 0 ], [ 0, 2.2 ] ], .09, 24), n = pts.length, wave = [];
				for (var i = 0; i < n; i++) {
					var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.sqrt(tx * tx + ty * ty) || 1;
					var o = Math.sin(i * .5 - (R.t + R.seed) * 4) * .09 * Math.min(1, i / 5);
					wave.push([ pts[i][0] - ty / l * o, pts[i][1] + tx / l * o ]);
				}
				wormBody(c, R, sp, wave, R.t + R.seed);
				memeHead(c, sp, R, 0, -.1, Math.sin(R.ang || 0) * .15 + (R.still ? Math.sin(R.t * 2 + R.seed) * .06 : 0));
			},
			sideView: function (c, sp, ph, R) {
				var base = -.08, pts = [ [ .11, base - .3 ], [ .1, base - .22 ], [ .07, base - .14 ] ];
				for (var i = 0; i < 17; i++)
					pts.push([ .03 - i * .085, base - .06 - Math.max(0, Math.sin(i * .55 - ph * 1.3)) * .1 ]);
				wormBody(c, R, sp, pts, R.t + R.seed);
				memeHead(c, sp, R, .13, base - .46, R.still ? Math.sin(R.t * 2 + R.seed) * .07 : Math.sin(ph) * .05);
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

	var state = { bugs: false, bugWalk: false, bugLook: 'color', bugMeme: false, bugCount: 'normal', bugSound: true };
	var SELF = D.currentScript && D.currentScript.src ? D.currentScript.src : '';
	var BUILD_KEY = 'kadr-luci-build', DAY = 864e5, metaLoading = false, kills = 0;
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
		var sp = force || pickSpecies(null, memeCount(crawlers) >= Math.round(4 * density())), b = {
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
		if (sp.worm) {
			var size = sp.len * b.scale * CRAWL_SCALE;
			b.step = size * .045;
			b.trail = [];
			for (var i = 0; i < 56; i++)
				b.trail.push([ b.x - Math.sin(b.a) * i * b.step, b.y + Math.cos(b.a) * i * b.step ]);
		}
		return b;
	}

	function kill(b) {
		if (b.dead || b.sp.meme)
			return false;
		kills++;
		b.dead = .001;
		b.leaving = true;
		b.v = 0;
		return true;
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
	}

	function metaWanted() {
		var p = buildProgress();
		return p >= 0 && (p < 1 || state.bugMeme);
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
			W: W, H: H, dpr: dpr, t: now / 1000, dt: dt, progress: p, armed: p >= 1 && state.bugMeme,
			look: state.bugLook, acc: theme.acc, light: theme.light, shadows: theme.shadows, sound: state.bugSound,
			crawlers: state.bugs ? crawlers : [], kill: kill, pointer: pointer
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
			return !(b.dead > 1.3) && !(b.leaving && out) && !(b.delay <= 0 && out && b.life < 15);
		});
	}

	function drawCrawlers() {
		crawlers.forEach(function (b) {
			if (b.delay > 0)
				return;
			var size = b.sp.len * b.scale * CRAWL_SCALE;
			if (!b.dead)
				return drawBug(ctx, b.sp, 'top', b.x, b.y, b.a, false, size, b.ph, b.still, b.seed, b.trail);
			var k = Math.min(1, b.dead / 1.3);
			ctx.save();
			ctx.globalAlpha = 1 - Math.max(0, (b.dead - .4) / .9);
			drawBug(ctx, b.sp, 'top', b.x, b.y, b.a + b.dead * 7, false, size * (1 - k * .35), b.ph + b.dead * 60, true, b.seed);
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
		var first = !booted, memeWas = state.bugMeme;
		booted = true;
		state = { bugs: !!s.bugs, bugWalk: !!s.bugWalk, bugLook: s.bugLook || 'color', bugMeme: !!s.bugMeme, bugCount: s.bugCount || 'normal', bugSound: s.bugSound !== false };
		if (state.bugMeme && (state.bugs || state.bugWalk))
			beginBuild();
		readTheme();
		if (!state.bugs)
			crawlers = [];
		if (!state.bugWalk)
			walkers = [];
		var go = function () {
			if (!first && state.bugMeme !== !!memeWas)
				memeSwitch(state.bugMeme);
			if (state.bugs || state.bugWalk || metaWanted())
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
		build: function () { return { start: buildStart(), progress: buildProgress() }; },
		count: function () {
			return {
				screen: crawlers.filter(function (b) { return !b.leaving && b.delay <= 0; }).length,
				buttons: walkers.filter(function (w) { return !w.leave && w.el && !w.lost; }).length,
				meme: crawlers.filter(function (b) { return b.sp.meme && !b.leaving; }).length + walkers.filter(function (w) { return w.sp.meme && !w.leave; }).length,
				dead: crawlers.filter(function (b) { return b.dead; }).length,
				kills: kills
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
