(function (g) {
	'use strict';

	var D = g.document;
	var TAU = Math.PI * 2;
	var DAY = 864e5;
	var SELF = D.currentScript && D.currentScript.src ? D.currentScript.src : '';
	var MODELS = {"u":2.0,"m":{"tower-brick":[384,0,254,259,{"base":[127.3,229.3],"pivot":[127.3,19.9],"head":[127.3,106.3],"top":[127.3,0.3]}],"tower-concrete":[640,0,249,256,{"base":[122.0,229.3],"pivot":[122.0,19.9],"head":[122.0,106.3],"top":[122.0,0.3]}],"tower-gold":[127,0,255,273,{"base":[127.3,242.9],"pivot":[127.3,33.6],"head":[127.3,120.0],"top":[127.3,13.9]}],"ruin-brick":[0,914,251,112,{"base":[126.0,85.4],"head":[126.0,40.1],"top":[126.0,7.8]}],"ruin-concrete":[253,914,251,112,{"base":[126.7,85.4],"head":[126.7,40.1],"top":[126.7,7.8]}],"ruin-gold":[506,914,253,112,{"base":[126.0,85.4],"head":[126.0,40.1],"top":[126.0,7.8]}],"gun-steel":[1113,914,156,48,{"pivot":[25.0,29.0],"tip":[155.0,27.7]}],"gun-plasma":[0,1028,157,48,{"pivot":[34.5,27.0],"tip":[154.5,24.4]}],"gun-rocket":[868,914,105,56,{"pivot":[26.7,33.3],"tip":[101.3,29.4]}],"router-brick":[1066,0,199,134,{"base":[98.7,124.7],"portL":[33.7,111.2],"portR":[163.7,111.2],"top":[98.7,6.9],"body":[98.7,101.8],"led0":[65.3,115.0],"led1":[73.3,115.0],"led2":[81.3,115.0],"led3":[89.3,115.0]}],"router-rollton":[891,0,173,195,{"base":[86.7,176.1],"portL":[40.0,156.7],"portR":[133.3,156.7],"top":[86.7,-1.8],"steam":[86.7,66.1],"body":[86.7,131.8],"led0":[78.7,177.5],"led1":[86.7,177.5],"led2":[94.7,177.5]}],"drone":[975,914,136,51,{"center":[68.0,28.7],"rotorL":[21.3,30.7],"rotorR":[114.7,30.7]}],"bowl":[761,914,105,64,{"base":[52.0,54.7],"center":[52.0,36.1]}],"rocket":[159,1028,70,25,{"center":[29.3,12.0],"tail":[1.3,12.0]}],"noodle":[231,1028,73,20,{"center":[36.7,10.0]}],"mast":[0,0,125,912,{"base":[62.0,898.4],"top":[62.0,5.7],"lamp0":[62.0,6.5],"lamp1":[62.0,375.2],"lamp2":[62.0,633.9],"plaque":[62.0,610.9]}]}};
	var RX = 25, RY = 9.5, HT = 72, PAD = 7, MAST = 98, JIB = -170, STOCK = 70, REST = 30;
	var COL = {
		brick: '#b8562f', brickDk: '#7c3219', mortar: '#d8c8b2',
		concrete: '#a6a49e', concreteDk: '#6e6c67', pit: '#3b2a1c',
		steel: '#7a8792', steelDk: '#434c55', steelLt: '#c3cdd4',
		crane: '#f2b01e', craneDk: '#a8740b', glass: '#9fd8ff',
		wood: '#c9955b', woodDk: '#8b5a2b',
		hat: '#f2781a', hatDk: '#c4570f', hatLt: '#ffb066',
		bug: '#5e321a', bugDk: '#2c160a', apron: '#cdb48a', apronDk: '#97805b',
		black: '#161616', white: '#f6f2ea', red: '#e2413a', bolt: '#ffd76a', flame: '#7fd3ff',
		sign: '#c8955c', signDk: '#7d5530', ink: '#3a2414', stripe: '#f2a51e', paint: '#d33b2c',
		brickLt: '#d97a4c', brickDeep: '#4e1d0c', mortarDk: '#9c8b73', concreteLt: '#cfccc4', steelDeep: '#262c33', rivet: '#e3e9ee',
		visor: '#0f2230', visorHi: '#9fe6ff', neon: '#3fe6c0', neonLt: '#c9fff2', slab: '#8f969b', slabDk: '#4a5056', slabLt: '#c2c8cc',
		gold: '#d9a43a', goldLt: '#fff0b8', goldDk: '#8a6416', goldDeep: '#4d360a', gem: '#d8325a', gemLt: '#ff9ab4',
		plasma: '#7fe8ff', plasmaDk: '#1d5f7e', plasmaHull: '#3d4a66', plasmaHullDk: '#1e2638', plasmaHullLt: '#7d8db0',
		olive: '#69733f', oliveDk: '#3a4122', oliveLt: '#9aa665', warhead: '#d8442e', warheadLt: '#ff9a7a',
		plastic: '#23262c', plasticLt: '#4d535d', plasticDk: '#111317',
		cupRed: '#d6261c', cupRedDk: '#8e130d', cupYellow: '#f5b51e', cupYellowLt: '#ffe08a', cupWhite: '#fff6d8', noodle: '#f2cf6a', noodleDk: '#c08f2c',
		cable: '#2f86e6', cableDk: '#123a66', cableHi: '#b8dcff', cut: '#ff3b3b', cutDk: '#6a0d0d', led: '#5cff8a', ledOff: '#1d3a26', amber: '#ffb340',
		tent: '#4a2148', tentDk: '#22091f', tentLt: '#8a4f86', cream: '#e8d7b0', creamDk: '#9a8458', creamLt: '#fff4d6', sucker: '#f0c6dc'
	};
	var MIN = { hammer: .09, stake: .09, trowel: .3, shovel: .5, brush: .4, wrench: .5, saw: 1.2, torch: 1.4, winch: 1, trolley: 1, clank: .3, thud: .15, shot: .1, hit: .05 };

	var sites = [ null, null ], carriers = [], parts = [], shots = [];
	var MIMG = null, GIMG = null, MCACHE = {}, monoAcc = [ 200, 200, 200 ];
	var mono = null, monoKey = '', buf = null, bctx = null, gutW = -1, gut = 0, liftAt = -1e9, lift = 0, liftNow = -1, lastHeads = [], SKINS = {};
	var SKIN = {
		tower: { concrete: { brick: '#8f969b', brickDk: '#4a5056', mortar: '#3fe6c0' }, gold: { brick: '#d9a43a', brickDk: '#8a6416', mortar: '#fff1b8' } },
		gun: { plasma: { steel: '#4a5a7a', steelDk: '#263048', steelLt: '#7fe8ff' }, rocket: { steel: '#7a5240', steelDk: '#3a2418', steelLt: '#ffb070' } }
	};
	var A = null, wantSound = false;

	function clamp(v) {
		return v < 0 ? 0 : v > 1 ? 1 : v;
	}

	function rand(a, b) {
		return a + Math.random() * (b - a);
	}

	function lerp(a, b, k) {
		return a + (b - a) * k;
	}

	function ease(k) {
		k = clamp(k);
		return k * k * (3 - 2 * k);
	}

	function cyc(t, per) {
		return ((t % per) + per) % per / per;
	}

	function rgbOf(h) {
		var n = parseInt(h.slice(1), 16);
		return [ n >> 16 & 255, n >> 8 & 255, n & 255 ];
	}

	function palette(w) {
		if (w.look !== 'mono')
			return COL;
		var key = w.acc.join(',');
		if (key === monoKey)
			return mono;
		var dk = w.acc.map(function (v) { return v * .26; }), lt = w.acc.map(function (v) { return v + (255 - v) * .4; });
		mono = {};
		Object.keys(COL).forEach(function (k) {
			var c = rgbOf(COL[k]), l = (c[0] * .3 + c[1] * .59 + c[2] * .11) / 255;
			mono[k] = 'rgb(' + [ 0, 1, 2 ].map(function (i) { return Math.round(lerp(dk[i], lt[i], Math.pow(l, .75))); }).join(',') + ')';
		});
		monoKey = key;
		monoAcc = w.acc.slice();
		return mono;
	}

	function mload(file) {
		var src = SELF || ((D.querySelector('script[src*="kadr-bugs.js"]') || {}).src || ''), im = new Image();
		im.decoding = 'async';
		im.src = src.replace(/[^/]*$/, '') + 'raid/' + file + ((src.match(/\?v=[^&#]+/) || [ '' ])[0]);
		return im;
	}

	function atlas() {
		if (!MIMG)
			MIMG = mload('models.webp');
		return MIMG.complete && MIMG.naturalWidth ? MIMG : null;
	}

	function groundTex() {
		if (!GIMG)
			GIMG = mload('ground.webp');
		return GIMG.complete && GIMG.naturalWidth ? GIMG : null;
	}

	function recolor(cv, kind) {
		var x = cv.getContext('2d');
		if (kind === 'dark') {
			x.globalCompositeOperation = 'source-atop';
			x.fillStyle = 'rgba(16,10,8,.66)';
			x.fillRect(0, 0, cv.width, cv.height);
			x.globalCompositeOperation = 'source-over';
			return;
		}
		var d = x.getImageData(0, 0, cv.width, cv.height), px = d.data, dk = monoAcc.map(function (v) { return v * .26; }), lt = monoAcc.map(function (v) { return v + (255 - v) * .4; });
		for (var i = 0; i < px.length; i += 4) {
			if (!px[i + 3])
				continue;
			var l = Math.pow((px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11) / 255, .75);
			px[i] = dk[0] + (lt[0] - dk[0]) * l;
			px[i + 1] = dk[1] + (lt[1] - dk[1]) * l;
			px[i + 2] = dk[2] + (lt[2] - dk[2]) * l;
		}
		x.putImageData(d, 0, 0);
	}

	function variant(name, kind) {
		var id = name + '|' + kind + (kind === 'mono' ? monoKey : ''), e = MCACHE[id];
		if (e)
			return e;
		var im = name === 'ground' ? groundTex() : atlas(), m = name === 'ground' ? [ 0, 0, im && im.width, im && im.height ] : MODELS.m[name];
		if (!im || !m)
			return null;
		var cv = D.createElement('canvas');
		cv.width = m[2];
		cv.height = m[3];
		cv.getContext('2d').drawImage(im, m[0], m[1], m[2], m[3], 0, 0, m[2], m[3]);
		recolor(cv, kind);
		return (MCACHE[id] = cv);
	}

	function model(c, name, x, y, k, at, opt) {
		var im = atlas(), m = MODELS.m[name];
		if (!im || !m)
			return false;
		var a = m[4][at || 'base'] || [ 0, 0 ], s = k / MODELS.u, kind = opt && opt.mono ? 'mono' : opt && opt.dark ? 'dark' : '', src = kind ? variant(name, kind) : null;
		if (src)
			c.drawImage(src, x - a[0] * s, y - a[1] * s, m[2] * s, m[3] * s);
		else
			c.drawImage(im, m[0], m[1], m[2], m[3], x - a[0] * s, y - a[1] * s, m[2] * s, m[3] * s);
		return true;
	}

	function mpt(name, key, x, y, k, at) {
		var m = MODELS.m[name];
		if (!m)
			return [ x, y ];
		var a = m[4][at || 'base'] || [ 0, 0 ], b = m[4][key] || a, s = k / MODELS.u;
		return [ x + (b[0] - a[0]) * s, y + (b[1] - a[1]) * s ];
	}

	function ground(c, w, L) {
		var gi = groundTex();
		if (!gi)
			return;
		var k = L[0].k, top = L[0].y - 46 * k, h = Math.max(46 * k, w.H - top + 2), tw = gi.width * h / gi.height, src = w.look === 'mono' ? variant('ground', 'mono') || gi : gi;
		for (var x = 0; x < w.W; x += tw)
			c.drawImage(src, Math.floor(x), top, Math.ceil(tw) + 1, h);
	}

	function ell(c, x, y, rx, ry, a0, a1) {
		c.beginPath();
		c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, a0 || 0, a1 === undefined ? TAU : a1);
	}

	function oval(c, x, y, rx, ry, col) {
		ell(c, x, y, rx, ry);
		c.fillStyle = col;
		c.fill();
	}

	function line(c, w, col, pts) {
		c.beginPath();
		c.moveTo(pts[0], pts[1]);
		for (var i = 2; i < pts.length; i += 2)
			c.lineTo(pts[i], pts[i + 1]);
		c.lineWidth = w;
		c.strokeStyle = col;
		c.stroke();
	}

	function box(c, x, y, w, h, col) {
		c.fillStyle = col;
		c.fillRect(x, y, w, h);
	}

	function turretArt(c, P, S, k, aim, recoil, flash, t, tv, look) {
		if (!atlas())
			return null;
		var x0 = S.x, y0 = S.y, s = S.s, mn = look === 'mono', o = { mono: mn };
		var ts = mn || !tv ? 'brick' : tv.skin.tower || 'brick', gs = mn || !tv ? 'steel' : tv.skin.gun || 'steel';
		if (tv && tv.dead) {
			var rn = 'ruin-' + ts, rt = mpt(rn, 'top', x0, y0, k), rh = mpt(rn, 'head', x0, y0, k);
			model(c, rn, x0, y0, k, 'base', o);
			for (var i = 0; i < 3; i++) {
				var fz = (t * .5 + i / 3) % 1;
				oval(c, rt[0] + Math.sin(i * 2 + t) * 6 * k, rt[1] - fz * 40 * k, (6 + fz * 12) * k, (6 + fz * 12) * k, 'rgba(60,60,64,' + (.42 * (1 - fz)) + ')');
			}
			return { hx: rh[0], hy: rh[1], top: rt[1] };
		}
		var tn = 'tower-' + ts, gn = 'gun-' + gs, hd = mpt(tn, 'head', x0, y0, k), tp = mpt(tn, 'top', x0, y0, k), pv = mpt(tn, 'pivot', x0, y0, k);
		model(c, tn, x0, y0, k, 'base', o);
		var hp = tv ? tv.hp : 1;
		if (hp < .6) {
			c.save();
			c.lineCap = 'round';
			[ [ [ -15, -22 ], [ -7, -12 ], [ -12, -1 ], [ -5, 8 ] ], [ [ 10, -6 ], [ 17, 3 ], [ 13, 13 ] ], [ [ -2, 18 ], [ 4, 26 ], [ -1, 34 ] ] ].forEach(function (cr, j) {
				if (j === 2 && hp > .35)
					return;
				c.beginPath();
				cr.forEach(function (q, n) { c[n ? 'lineTo' : 'moveTo'](hd[0] + q[0] * k, hd[1] + q[1] * k); });
				c.lineWidth = 1.7 * k;
				c.strokeStyle = 'rgba(12,6,4,.92)';
				c.stroke();
				c.translate(.7 * k, .7 * k);
				c.lineWidth = .6 * k;
				c.strokeStyle = 'rgba(255,190,150,.35)';
				c.stroke();
				c.translate(-.7 * k, -.7 * k);
			});
			c.restore();
		}
		var off = tv && tv.off, a = off ? (s > 0 ? 1.05 : Math.PI - 1.05) : aim === null ? (s > 0 ? .25 : Math.PI - .25) : aim, back = recoil * 6;
		var gm = MODELS.m[gn], gp = gm[4].pivot, gt = gm[4].tip, us = k / MODELS.u, tipx = (gt[0] - gp[0]) * us - back * k, tipy = (gt[1] - gp[1]) * us;
		c.save();
		c.translate(pv[0], pv[1]);
		c.rotate(a);
		if (Math.cos(a) < 0)
			c.scale(1, -1);
		model(c, gn, -back * k, 0, k, 'pivot', o);
		if (gs === 'plasma' && !off && !mn) {
			var pu = .5 + .5 * Math.sin(t * 7), gr = c.createRadialGradient(tipx, tipy, 0, tipx, tipy, 9 * k);
			gr.addColorStop(0, 'rgba(230,253,255,' + (.75 + .25 * pu) + ')');
			gr.addColorStop(.4, 'rgba(127,232,255,' + (.35 + .25 * pu) + ')');
			gr.addColorStop(1, 'rgba(127,232,255,0)');
			c.fillStyle = gr;
			c.fillRect(tipx - 9 * k, tipy - 9 * k, 18 * k, 18 * k);
		}
		if (flash > 0) {
			var fr = (gs === 'rocket' ? 13 : 11) * k * (.6 + .6 * flash), fc = gs === 'plasma' ? '127,232,255' : gs === 'rocket' ? '255,150,60' : '255,215,106', fg = c.createRadialGradient(tipx + 3 * k, tipy, 0, tipx + 3 * k, tipy, fr);
			fg.addColorStop(0, 'rgba(255,255,255,' + flash + ')');
			fg.addColorStop(.35, 'rgba(' + fc + ',' + (.9 * flash) + ')');
			fg.addColorStop(1, 'rgba(' + fc + ',0)');
			c.fillStyle = fg;
			c.beginPath();
			c.arc(tipx + 3 * k, tipy, fr, 0, TAU);
			c.fill();
		}
		c.restore();
		var lx = x0 + s * 26 * k, ly = tp[1] + 34 * k, cutNow = tv && !tv.online, col = off ? '#2a0f0d' : cutNow ? P.cut : cyc(t, 1.6) < .55 ? P.led : P.ledOff;
		if (!off && (cutNow || cyc(t, 1.6) < .55)) {
			var lg2 = c.createRadialGradient(lx, ly, 0, lx, ly, 6 * k);
			lg2.addColorStop(0, cutNow ? 'rgba(255,59,59,.65)' : 'rgba(92,255,138,.55)');
			lg2.addColorStop(1, 'rgba(0,0,0,0)');
			c.fillStyle = lg2;
			c.fillRect(lx - 6 * k, ly - 6 * k, 12 * k, 12 * k);
		}
		oval(c, lx, ly, 1.9 * k, 1.9 * k, col);
		if (hp < .3)
			for (var sm = 0; sm < 3; sm++) {
				var fq = (t * .55 + sm / 3) % 1;
				oval(c, tp[0] + Math.sin(sm * 2 + t) * 6 * k, tp[1] - fq * 34 * k, (5 + fq * 10) * k, (5 + fq * 10) * k, 'rgba(70,70,74,' + (.38 * (1 - fq)) + ')');
			}
		return { hx: pv[0], hy: pv[1], top: tp[1], tl: Math.hypot(tipx + back * k, tipy) };
	}

	function actionsLift() {
		var out = 0;
		Array.prototype.forEach.call(D.querySelectorAll('.cbi-page-actions, .actions'), function (el) {
			var r = el.getBoundingClientRect();
			if (r.width > 0 && r.height > 0 && g.getComputedStyle(el).position === 'sticky')
				out = Math.max(out, r.height + 14);
		});
		return out;
	}

	function layout(w) {
		if (gutW !== w.W) {
			var mc = D.getElementById('maincontent');
			gut = mc ? Math.max(0, mc.getBoundingClientRect().left) : 0;
			gutW = w.W;
		}
		var k = Math.max(.62, Math.min(1, w.W / 1300)), span = 190 * k, low = w.W < 768 || w.H < 500;
		var x = !low && gut > span + 24 ? gut / 2 - span / 2 + 44 * k : 58 * k;
		if (w.t - liftAt > 2) {
			liftAt = w.t;
			lift = actionsLift();
		}
		liftNow = liftNow < 0 ? lift : liftNow + (lift - liftNow) * Math.min(1, (w.dt || 0) * 3);
		var y = Math.round(w.H - 24 * k - liftNow - 4);
		return [ { i: 0, s: 1, x: x, y: y, k: k, low: true }, { i: 1, s: -1, x: w.W - x, y: y, k: k, low: true } ];
	}

	function stages(p) {
		return {
			mark: clamp(p / .03), pit: clamp((p - .03) / .04), pad: clamp((p - .07) / .08),
			wall: clamp((p - .15) / .4), ring: clamp((p - .55) / .17), dome: clamp((p - .72) / .18),
			gun: clamp((p - .9) / .07), paint: clamp((p - .97) / .03)
		};
	}

	function job(p) {
		if (p < .07)
			return { load: 'planks', top: 'tape', top2: 'stake', ground: 'shovel' };
		if (p < .15)
			return { load: 'bucket', top: 'shovel', top2: 'trowel', ground: 'shovel' };
		if (p < .55)
			return { load: 'bricks', top: 'trowel', top2: 'hammer', ground: 'saw' };
		if (p < .72)
			return { load: 'beam', top: 'torch', top2: 'wrench', ground: 'saw' };
		if (p < .9)
			return { load: 'plate', top: 'wrench', top2: 'hammer', ground: 'torch' };
		if (p < .97)
			return { load: 'barrel', top: 'wrench', top2: 'torch', ground: 'hammer' };
		return { load: 'paint', top: 'brush', top2: 'brush', ground: 'brush' };
	}

	function topOf(st) {
		return -(PAD * st.pad + HT * st.wall);
	}

	function site(i) {
		if (!sites[i])
			sites[i] = {
				crane: { ph: 'rest', t: rand(.5, 3), x: STOCK + 8, d: REST, load: null },
				stock: 3, seed: rand(0, 100), a: null, cd: rand(1, 2.5), recoil: 0, flash: 0, sweep: rand(0, 6), tgt: null,
				w: [ { x: rand(-.7, -.25), dir: 1, wait: rand(2, 6), seed: rand(0, 9) }, { x: rand(.25, .7), dir: -1, wait: rand(2, 6), seed: rand(0, 9) }, { x: 0, dir: 1, wait: 0, seed: rand(0, 9) } ]
			};
		return sites[i];
	}

	function audioCtx() {
		var AC = g.AudioContext || g.webkitAudioContext;
		if (!AC)
			return null;
		var ctx = new AC(), out = ctx.createGain(), lp = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor();
		out.gain.value = .22;
		lp.type = 'lowpass';
		lp.frequency.value = 1500;
		lp.Q.value = .5;
		out.connect(lp);
		lp.connect(comp);
		comp.connect(ctx.destination);
		var pans = [ -.7, .7 ].map(function (v) {
			var p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
			if (p.pan)
				p.pan.value = v;
			p.connect(out);
			return p;
		});
		var noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = noise.getChannelData(0);
		for (var i = 0; i < d.length; i++)
			d[i] = Math.random() * 2 - 1;
		return { ctx: ctx, out: out, pans: pans, noise: noise, last: {}, armed: false };
	}

	function unlock() {
		if (!wantSound)
			return;
		if (!A)
			A = audioCtx();
		if (!A)
			return;
		A.armed = true;
		if (A.ctx.state === 'suspended')
			A.ctx.resume();
	}

	D.addEventListener('pointerdown', unlock, true);
	D.addEventListener('keydown', unlock, true);

	function sound(w) {
		wantSound = !!w.sound;
		if (!A)
			return null;
		if (!wantSound || D.hidden) {
			if (A.ctx.state === 'running')
				A.ctx.suspend();
			return null;
		}
		if (A.ctx.state === 'suspended' && A.armed)
			A.ctx.resume();
		return A.ctx.state === 'running' ? A : null;
	}

	function env(gn, t, attack, peak, dur) {
		gn.gain.setValueAtTime(.0001, t);
		gn.gain.exponentialRampToValueAtTime(peak, t + attack);
		gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
	}

	function tone(i, type, f0, f1, dur, peak, delay) {
		var c = A.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), gn = c.createGain();
		o.type = type;
		o.frequency.setValueAtTime(f0, t);
		if (f1 !== f0)
			o.frequency.exponentialRampToValueAtTime(f1, t + dur);
		env(gn, t, .005, peak, dur);
		o.connect(gn);
		gn.connect(A.pans[i]);
		o.start(t);
		o.stop(t + dur + .03);
	}

	function hiss(i, dur, freq, q, peak, delay, attack) {
		var c = A.ctx, t = c.currentTime + (delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain();
		s.buffer = A.noise;
		s.loop = true;
		f.type = 'bandpass';
		f.frequency.value = freq;
		f.Q.value = q;
		env(gn, t, attack || .004, peak, dur);
		s.connect(f);
		f.connect(gn);
		gn.connect(A.pans[i]);
		s.start(t, Math.random() * .8);
		s.stop(t + dur + .03);
	}

	function motor(i, dur, ratio, base) {
		var c = A.ctx, t = c.currentTime, o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), gn = c.createGain();
		o1.type = 'sawtooth';
		o2.type = 'square';
		o1.frequency.setValueAtTime(base, t);
		o1.frequency.linearRampToValueAtTime(base * ratio, t + dur);
		o2.frequency.setValueAtTime(base * 2.01, t);
		o2.frequency.linearRampToValueAtTime(base * 2.01 * ratio, t + dur);
		f.type = 'lowpass';
		f.frequency.value = 380;
		gn.gain.setValueAtTime(.0001, t);
		gn.gain.exponentialRampToValueAtTime(.1, t + .25);
		gn.gain.setValueAtTime(.1, t + Math.max(.3, dur - .3));
		gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
		o1.connect(f);
		o2.connect(f);
		f.connect(gn);
		gn.connect(A.pans[i]);
		o1.start(t);
		o2.start(t);
		o1.stop(t + dur + .05);
		o2.stop(t + dur + .05);
	}

	var SFX = {
		hammer: function (i) { tone(i, 'triangle', 220, 72, .11, .5); hiss(i, .035, 2400, 1.2, .3); },
		stake: function (i) { tone(i, 'sine', 150, 60, .13, .55); hiss(i, .03, 900, 1, .22); },
		trowel: function (i) { hiss(i, .22, 1400, .8, .07, 0, .05); },
		shovel: function (i) { hiss(i, .3, 650, .7, .13, 0, .03); tone(i, 'sine', 120, 90, .08, .1, .22); },
		brush: function (i) { hiss(i, .26, 1800, .6, .045, 0, .06); },
		wrench: function (i) { for (var k = 0; k < 6; k++) hiss(i, .008, 3600, 2, .2, k * .065); },
		saw: function (i) { for (var k = 0; k < 7; k++) hiss(i, .14, 2500 + (k % 2) * 450, 1.6, .14, k * .17, .04); },
		torch: function (i) { for (var k = 0; k < 24; k++) hiss(i, .012, 4200, 1.5, rand(.05, .18), rand(0, 1.4)); hiss(i, 1.4, 900, .5, .035, 0, .1); },
		winch: function (i, dur, up) { motor(i, dur, up ? 1.18 : .9, 52); },
		trolley: function (i, dur) { motor(i, dur, 1.05, 74); },
		clank: function (i) { tone(i, 'sine', 1240, 1180, .28, .1); tone(i, 'sine', 1870, 1800, .2, .05); tone(i, 'sine', 95, 70, .16, .3); },
		thud: function (i) { tone(i, 'sine', 85, 55, .18, .4); hiss(i, .08, 320, .8, .18); },
		shot: function (i) { tone(i, 'square', 900, 150, .17, .14); hiss(i, .06, 1300, .8, .35); tone(i, 'sine', 70, 40, .2, .45); },
		hit: function (i) { hiss(i, .06, 750, 1, .35); tone(i, 'sine', 320, 110, .1, .22); }
	};

	function play(w, name, i, a, b) {
		var x = sound(w);
		if (!x)
			return;
		var key = name + i, now = x.ctx.currentTime;
		if (x.last[key] && now - x.last[key] < MIN[name])
			return;
		x.last[key] = now;
		SFX[name](i, a, b);
	}

	function spark(x, y, n, col, speed) {
		for (var i = 0; i < n; i++) {
			var a = rand(0, TAU), v = rand(.3, 1) * speed;
			parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * .4, life: rand(.25, .6), age: 0, col: col, r: rand(.6, 1.3), grav: 1 });
		}
	}

	function dust(x, y, n, k) {
		for (var i = 0; i < n; i++)
			parts.push({ x: x + rand(-6, 6) * k, y: y + rand(-2, 2) * k, vx: rand(-12, 12), vy: rand(-14, -4), life: rand(.5, 1), age: 0, col: 'dust', r: rand(2, 4) * k, grav: 0 });
	}

	function stepParts(dt) {
		parts = parts.filter(function (p) {
			p.age += dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			if (p.grav)
				p.vy += 260 * dt;
			return p.age < p.life;
		});
	}

	function drawParts(c, P) {
		parts.forEach(function (p) {
			var k = 1 - p.age / p.life;
			c.globalAlpha = k;
			if (p.col === 'dust')
				oval(c, p.x, p.y, p.r * (1.6 - k * .6), p.r * (1.6 - k * .6), 'rgba(160,150,140,.45)');
			else
				oval(c, p.x, p.y, p.r, p.r, p.col === 'spark' ? P.bolt : p.col);
		});
		c.globalAlpha = 1;
	}

	function tool(c, P, u, name, t, seed, fx) {
		var ph, a, hx, hy;
		if (name === 'hammer' || name === 'stake') {
			ph = cyc(t + seed, .7);
			a = ph < .55 ? lerp(-1.9, .35, ease(ph / .55)) : lerp(.35, -1.9, (ph - .55) / .45);
			c.save();
			c.translate(.06 * u, -.6 * u);
			c.rotate(a);
			line(c, .06 * u, P.bugDk, [ 0, 0, .2 * u, 0 ]);
			line(c, .035 * u, P.woodDk, [ .14 * u, 0, .42 * u, 0 ]);
			box(c, .38 * u, -.07 * u, (name === 'stake' ? .12 : .08) * u, .14 * u, name === 'stake' ? P.woodDk : P.steel);
			c.restore();
			if (fx && ph >= .55 && ph < .62)
				fx('strike', .06 * u + Math.cos(.35) * .42 * u, -.6 * u + Math.sin(.35) * .42 * u);
			return;
		}
		if (name === 'trowel') {
			hx = .28 * u + Math.sin((t + seed) * 4.2) * .08 * u;
			hy = -.44 * u;
			line(c, .06 * u, P.bugDk, [ .06 * u, -.6 * u, hx, hy ]);
			c.beginPath();
			c.moveTo(hx, hy);
			c.lineTo(hx + .16 * u, hy + .04 * u);
			c.lineTo(hx + .05 * u, hy + .1 * u);
			c.closePath();
			c.fillStyle = P.steelLt;
			c.fill();
			if (fx && cyc(t + seed, 1.5) < .04)
				fx('trowel');
			return;
		}
		if (name === 'torch') {
			hx = .3 * u;
			hy = -.46 * u;
			line(c, .06 * u, P.bugDk, [ .06 * u, -.6 * u, hx, hy ]);
			line(c, .05 * u, P.steelDk, [ hx - .04 * u, hy - .02 * u, hx + .16 * u, hy + .1 * u ]);
			var on = cyc(t + seed, 4) < .62;
			if (on) {
				oval(c, hx + .19 * u, hy + .12 * u, .045 * u, .03 * u, P.flame);
				if (fx)
					fx('torch', hx + .2 * u, hy + .13 * u);
			}
			return;
		}
		if (name === 'wrench') {
			a = Math.sin((t + seed) * 5) * .5;
			hx = .3 * u;
			hy = -.5 * u;
			line(c, .06 * u, P.bugDk, [ .06 * u, -.6 * u, hx, hy ]);
			c.save();
			c.translate(hx, hy);
			c.rotate(a);
			line(c, .045 * u, P.steel, [ 0, 0, .2 * u, 0 ]);
			ell(c, .22 * u, 0, .05 * u, .05 * u);
			c.lineWidth = .03 * u;
			c.strokeStyle = P.steel;
			c.stroke();
			c.restore();
			if (fx && cyc(t + seed, 1.3) < .03)
				fx('wrench');
			return;
		}
		if (name === 'saw') {
			var sawing = cyc(t + seed, 3.6) < .66, sx = sawing ? Math.sin((t + seed) * TAU * 1.6) * .1 * u : 0;
			hx = .22 * u + sx;
			hy = -.4 * u;
			line(c, .06 * u, P.bugDk, [ .06 * u, -.6 * u, hx, hy ]);
			c.save();
			c.translate(hx, hy);
			c.rotate(.35);
			box(c, 0, -.03 * u, .36 * u, .07 * u, P.steelLt);
			box(c, -.06 * u, -.045 * u, .08 * u, .1 * u, P.wood);
			c.restore();
			box(c, .2 * u, -.3 * u, .5 * u, .06 * u, P.wood);
			line(c, .03 * u, P.woodDk, [ .25 * u, -.24 * u, .22 * u, 0, .6 * u, -.24 * u, .63 * u, 0 ]);
			if (fx && sawing && cyc(t + seed, 3.6) < .02)
				fx('saw');
			return;
		}
		if (name === 'shovel') {
			ph = cyc(t + seed, 1.7);
			a = lerp(.9, .4, Math.sin(ph * Math.PI));
			c.save();
			c.translate(.06 * u, -.56 * u);
			c.rotate(a);
			line(c, .06 * u, P.bugDk, [ 0, 0, .18 * u, 0 ]);
			line(c, .035 * u, P.woodDk, [ .04 * u, 0, .6 * u, 0 ]);
			c.beginPath();
			c.ellipse(.66 * u, 0, .09 * u, .06 * u, 0, 0, TAU);
			c.fillStyle = P.steel;
			c.fill();
			c.restore();
			if (fx && ph < .03)
				fx('shovel');
			return;
		}
		if (name === 'brush') {
			hx = .3 * u;
			hy = -.5 * u + Math.sin((t + seed) * 4.8) * .1 * u;
			line(c, .06 * u, P.bugDk, [ .06 * u, -.6 * u, hx, hy ]);
			line(c, .035 * u, P.woodDk, [ hx, hy, hx + .16 * u, hy - .05 * u ]);
			box(c, hx + .15 * u, hy - .1 * u, .06 * u, .1 * u, P.paint);
			if (fx && cyc(t + seed, 1.3) < .03)
				fx('brush');
			return;
		}
		if (name === 'tape') {
			line(c, .06 * u, P.bugDk, [ .06 * u, -.6 * u, .26 * u, -.5 * u ]);
			box(c, .24 * u, -.56 * u, .1 * u, .1 * u, P.crane);
			line(c, .02 * u, P.crane, [ .32 * u, -.5 * u, (.9 + Math.sin((t + seed) * .7) * .15) * u, 0 ]);
			return;
		}
		line(c, .06 * u, P.bugDk, [ .06 * u, -.6 * u, .16 * u, -.36 * u ]);
	}

	function worker(c, P, x, y, u, dir, name, t, seed, fx, walk) {
		c.save();
		c.translate(x, y);
		c.scale(dir, 1);
		oval(c, 0, 0, .3 * u, .07 * u, 'rgba(0,0,0,.22)');
		var sway = Math.sin(t * 2.2 + seed) * .015 * u, st = walk ? Math.sin(t * 11 + seed) * .07 * u : 0;
		line(c, .055 * u, P.bugDk, [ -.08 * u, -.34 * u, -.17 * u + st, -.17 * u, -.12 * u + st * 1.4, 0 ]);
		line(c, .055 * u, P.bugDk, [ .05 * u, -.34 * u, .13 * u - st, -.17 * u, .1 * u - st * 1.4, 0 ]);
		oval(c, -.05 * u, -.5 * u + sway, .2 * u, .27 * u, P.bug);
		oval(c, -.12 * u, -.58 * u + sway, .05 * u, .12 * u, 'rgba(255,255,255,.16)');
		c.beginPath();
		c.moveTo(0, -.67 * u + sway);
		c.lineTo(.17 * u, -.61 * u + sway);
		c.lineTo(.15 * u, -.3 * u + sway);
		c.lineTo(0, -.27 * u + sway);
		c.closePath();
		c.fillStyle = P.apron;
		c.fill();
		line(c, .02 * u, P.apronDk, [ .03 * u, -.43 * u + sway, .14 * u, -.43 * u + sway ]);
		line(c, .05 * u, P.bugDk, [ -.02 * u, -.6 * u + sway, -.06 * u, -.4 * u, -.02 * u, -.28 * u ]);
		var hx = .1 * u, hy = -.82 * u + sway;
		oval(c, hx, hy, .13 * u, .12 * u, P.bugDk);
		oval(c, hx + .06 * u, hy + .01 * u, .045 * u, .05 * u, P.white);
		oval(c, hx + .075 * u, hy + .015 * u, .022 * u, .028 * u, P.black);
		c.beginPath();
		c.moveTo(hx + .02 * u, hy - .06 * u);
		c.quadraticCurveTo(hx + .2 * u, hy - .3 * u, hx + .36 * u, hy - .18 * u + Math.sin(t * 3 + seed) * .03 * u);
		c.lineWidth = .016 * u;
		c.strokeStyle = P.bugDk;
		c.stroke();
		ell(c, hx - .01 * u, hy - .06 * u, .17 * u, .14 * u, Math.PI, TAU);
		c.fillStyle = P.hat;
		c.fill();
		line(c, .035 * u, P.hatDk, [ hx - .21 * u, hy - .06 * u, hx + .21 * u, hy - .06 * u ]);
		line(c, .02 * u, P.hatLt, [ hx - .01 * u, hy - .19 * u, hx - .01 * u, hy - .09 * u ]);
		if (name)
			tool(c, P, u, name, t, seed, fx && function (kind, lx, ly) { fx(kind, x + dir * (lx || 0), y + (ly || 0)); });
		c.restore();
	}

	function topBug(c, P, x, y, a, u, ph, load) {
		c.save();
		c.translate(x, y);
		c.rotate(a);
		c.lineCap = 'round';
		oval(c, 1.5, 2.5, .24 * u, .42 * u, 'rgba(0,0,0,.18)');
		for (var i = 0; i < 3; i++)
			for (var s = -1; s <= 1; s += 2) {
				var sw = Math.sin(ph + i * 2.1 + (s > 0 ? Math.PI : 0)) * .3, by = (-.12 + i * .14) * u;
				line(c, .045 * u, P.bugDk, [ s * .14 * u, by, s * (.32 * u), by + Math.sin(sw + (i - 1) * .7) * .16 * u ]);
			}
		if (load === 'barrow') {
			box(c, -.16 * u, -.95 * u, .32 * u, .4 * u, P.steel);
			box(c, -.12 * u, -.9 * u, .24 * u, .28 * u, P.brick);
			oval(c, 0, -1.02 * u, .07 * u, .05 * u, P.black);
			line(c, .04 * u, P.steelDk, [ -.12 * u, -.55 * u, -.1 * u, -.3 * u ]);
			line(c, .04 * u, P.steelDk, [ .12 * u, -.55 * u, .1 * u, -.3 * u ]);
		}
		oval(c, 0, .12 * u, .19 * u, .3 * u, P.bug);
		oval(c, 0, -.2 * u, .15 * u, .1 * u, P.bugDk);
		oval(c, 0, -.34 * u, .12 * u, .1 * u, P.hat);
		oval(c, -.03 * u, -.37 * u, .04 * u, .03 * u, P.hatLt);
		if (load === 'plank' || load === 'beam') {
			c.save();
			c.rotate(.12);
			box(c, -.09 * u, -.15 * u, .18 * u, .78 * u, load === 'beam' ? P.steel : P.wood);
			line(c, .02 * u, load === 'beam' ? P.steelDk : P.woodDk, [ 0, -.14 * u, 0, .62 * u ]);
			c.restore();
		}
		if (load === 'bricks') {
			box(c, -.13 * u, -.02 * u, .26 * u, .14 * u, P.brick);
			box(c, -.13 * u, .14 * u, .26 * u, .14 * u, P.brick);
			line(c, .015 * u, P.mortar, [ -.13 * u, .13 * u, .13 * u, .13 * u ]);
		}
		c.restore();
	}

	function loadShape(c, P, kind, x, y, k) {
		if (kind === 'bricks') {
			box(c, x - 12 * k, y + 8 * k, 24 * k, 3 * k, P.woodDk);
			for (var r = 0; r < 3; r++)
				for (var q = 0; q < 3; q++)
					box(c, x - 11 * k + q * 7.6 * k + (r % 2) * 1.5 * k, y + r * 2.6 * k, 6.8 * k, 2.3 * k, r % 2 ? P.brickDk : P.brick);
			return 11 * k;
		}
		if (kind === 'bucket') {
			c.beginPath();
			c.moveTo(x - 8 * k, y);
			c.lineTo(x + 8 * k, y);
			c.lineTo(x + 6 * k, y + 11 * k);
			c.lineTo(x - 6 * k, y + 11 * k);
			c.closePath();
			c.fillStyle = P.steelDk;
			c.fill();
			oval(c, x, y + 1 * k, 8 * k, 2 * k, P.concrete);
			return 11 * k;
		}
		if (kind === 'beam') {
			box(c, x - 16 * k, y, 32 * k, 1.6 * k, P.steel);
			box(c, x - 16 * k, y + 4.4 * k, 32 * k, 1.6 * k, P.steel);
			box(c, x - 16 * k, y + 1.6 * k, 32 * k, 2.8 * k, P.steelDk);
			return 6 * k;
		}
		if (kind === 'plate') {
			c.beginPath();
			c.ellipse(x, y + 9 * k, 15 * k, 9 * k, 0, Math.PI * 1.08, Math.PI * 1.92);
			c.ellipse(x, y + 11.5 * k, 13 * k, 7 * k, 0, Math.PI * 1.92, Math.PI * 1.08, true);
			c.closePath();
			c.fillStyle = P.steel;
			c.fill();
			line(c, .7 * k, P.steelLt, [ x - 9 * k, y + 2.4 * k, x + 9 * k, y + 2.4 * k ]);
			return 6 * k;
		}
		if (kind === 'barrel') {
			box(c, x - 17 * k, y + 1 * k, 34 * k, 4.5 * k, P.steelDk);
			box(c, x + 13 * k, y, 5 * k, 6.5 * k, P.black);
			line(c, .8 * k, P.steelLt, [ x - 15 * k, y + 2 * k, x + 11 * k, y + 2 * k ]);
			return 7 * k;
		}
		if (kind === 'paint') {
			box(c, x - 9 * k, y + 1 * k, 7 * k, 8 * k, P.steelLt);
			box(c, x + 2 * k, y + 1 * k, 7 * k, 8 * k, P.steelLt);
			box(c, x - 9 * k, y, 7 * k, 2 * k, P.paint);
			box(c, x + 2 * k, y, 7 * k, 2 * k, P.stripe);
			return 9 * k;
		}
		for (var p = 0; p < 4; p++)
			box(c, x - 13 * k, y + p * 2.4 * k, 26 * k, 2 * k, p % 2 ? P.woodDk : P.wood);
		return 9.6 * k;
	}

	function bricks(c, P, x0, b, h, k, upto) {
		var rx = RX * k, cw = 6 * k, courses = Math.ceil(h / cw);
		c.save();
		c.beginPath();
		c.rect(x0 - rx, b - h, rx * 2, h);
		c.ellipse(x0, b, rx, RY * k, 0, 0, Math.PI);
		c.clip();
		var gr = c.createLinearGradient(x0 - rx, 0, x0 + rx, 0);
		gr.addColorStop(0, P.brickDk);
		gr.addColorStop(.32, P.brick);
		gr.addColorStop(.5, P.brick);
		gr.addColorStop(1, P.brickDk);
		c.fillStyle = gr;
		c.fillRect(x0 - rx, b - h - cw, rx * 2, h + RY * k + cw);
		c.strokeStyle = P.mortar;
		c.lineWidth = Math.max(.6, .55 * k);
		for (var r = 0; r <= courses; r++) {
			var yy = b - r * cw;
			ell(c, x0, yy, rx, RY * k, 0, Math.PI);
			c.stroke();
			for (var q = 0; q < 8; q++) {
				var th = (q + (r % 2) * .5) / 8 * Math.PI, jx = x0 + Math.cos(th) * rx, jy = yy + Math.sin(th) * RY * k;
				line(c, Math.max(.6, .55 * k), P.mortar, [ jx, jy, jx, jy - cw ]);
			}
		}
		c.restore();
		if (upto < 1) {
			var n = Math.floor(upto * 8);
			for (var j = 0; j < n; j++) {
				var a = (j + .5) / 8 * Math.PI, bx = x0 + Math.cos(Math.PI - a) * rx, by = b - h + Math.sin(Math.PI - a) * RY * k;
				box(c, bx - 2.6 * k, by - cw, 5.2 * k, cw - .6 * k, P.brick);
			}
		}
	}

	function skinned(P, tv, w) {
		if (!tv || w.look === 'mono' || (tv.skin.tower === 'brick' && tv.skin.gun === 'steel'))
			return P;
		var id = monoKey + '|' + tv.skin.tower + '|' + tv.skin.gun;
		if (SKINS[id] && SKINS[id].base === P)
			return SKINS[id];
		var o = {};
		Object.keys(P).forEach(function (n) { o[n] = P[n]; });
		[ SKIN.tower[tv.skin.tower], SKIN.gun[tv.skin.gun] ].forEach(function (m) {
			Object.keys(m || {}).forEach(function (n) { o[n] = m[n]; });
		});
		Object.defineProperty(o, 'base', { value: P });
		return (SKINS[id] = o);
	}

	function rubble(c, P, x0, y0, k, t) {
		[ [ -22, 2, 14, 7 ], [ -8, -4, 16, 8 ], [ 8, 1, 15, 7 ], [ 18, -6, 11, 6 ], [ -14, -10, 12, 6 ], [ 2, -12, 13, 7 ] ].forEach(function (b, i) {
			c.save();
			c.translate(x0 + b[0] * k, y0 + b[1] * k);
			c.rotate((i % 3 - 1) * .35);
			box(c, -b[2] * k / 2, -b[3] * k / 2, b[2] * k, b[3] * k, i % 2 ? P.brick : P.brickDk);
			c.restore();
		});
		line(c, 4 * k, P.steelDk, [ x0 - 4 * k, y0 - 14 * k, x0 + 22 * k, y0 - 4 * k ]);
		for (var i = 0; i < 3; i++) {
			var f = (t * .5 + i / 3) % 1;
			oval(c, x0 + Math.sin(i * 2 + t) * 5 * k, y0 - 16 * k - f * 34 * k, (5 + f * 10) * k, (5 + f * 10) * k, 'rgba(70,70,74,' + (.4 * (1 - f)) + ')');
		}
	}

	function turret(c, P, S, st, k, aim, recoil, flash, t, building, tv) {
		var x0 = S.x, y0 = S.y, s = S.s, padTop = y0 - PAD * k * st.pad, h = HT * k * st.wall, top = padTop - h;
		if (tv && tv.dead && !building) {
			ell(c, x0, y0, 40 * k, 15 * k, 0, Math.PI);
			c.lineTo(x0 - 40 * k, padTop);
			c.ellipse(x0, padTop, 40 * k, 15 * k, 0, Math.PI, 0, true);
			c.closePath();
			c.fillStyle = P.concreteDk;
			c.fill();
			oval(c, x0, padTop, 40 * k, 15 * k, P.concrete);
			rubble(c, P, x0, padTop, k, t);
			return { hx: x0, hy: padTop - 14 * k, top: padTop - 20 * k };
		}
		if (st.mark > 0 && st.wall < .2) {
			c.save();
			c.globalAlpha = st.mark * (1 - clamp(st.wall * 5));
			c.setLineDash([ 3 * k, 3 * k ]);
			ell(c, x0, y0, 40 * k, 15 * k);
			c.lineWidth = .8 * k;
			c.strokeStyle = P.white;
			c.stroke();
			c.setLineDash([]);
			[ [ -40, 0 ], [ 40, 0 ], [ 0, -15 ], [ 0, 15 ] ].forEach(function (p) { line(c, 1.6 * k, P.woodDk, [ x0 + p[0] * k, y0 + p[1] * k, x0 + p[0] * k, y0 + p[1] * k - 7 * k ]); });
			c.restore();
		}
		if (st.pit > 0 && st.pad < 1)
			oval(c, x0, y0, 38 * k * st.pit, 14 * k * st.pit, 'rgba(40,28,18,' + (.6 * (1 - st.pad)) + ')');
		if (st.pad > 0) {
			c.save();
			c.globalAlpha = Math.min(1, .25 + st.pad);
			ell(c, x0, y0, 40 * k, 15 * k, 0, Math.PI);
			c.lineTo(x0 - 40 * k, padTop);
			c.ellipse(x0, padTop, 40 * k, 15 * k, 0, Math.PI, 0, true);
			c.closePath();
			c.fillStyle = P.concreteDk;
			c.fill();
			oval(c, x0, padTop, 40 * k, 15 * k, P.concrete);
			c.restore();
		}
		var scaffold = building && st.wall > 0 && st.paint < 1;
		if (scaffold) {
			[ -1, 1 ].forEach(function (q) { line(c, 1.3 * k, P.woodDk, [ x0 + q * (RX + 7) * k, padTop - 6 * k, x0 + q * (RX + 7) * k, top - 10 * k ]); });
		}
		if (st.wall > 0) {
			var courses = HT * st.wall / 6, frac = courses - Math.floor(courses);
			bricks(c, P, x0, padTop, h, k, st.wall < 1 ? frac : 1);
			if (st.ring < 1) {
				oval(c, x0, top, RX * k, RY * k, P.brickDk);
				oval(c, x0, top + .6 * k, (RX - 3.5) * k, (RY - 2.2) * k, '#1a120d');
			}
			if (tv && tv.hp < .6 && !building) {
				c.strokeStyle = 'rgba(22,12,8,.85)';
				c.lineWidth = 1.3 * k;
				c.beginPath();
				c.moveTo(x0 - 12 * k, top + h * .25);
				c.lineTo(x0 - 4 * k, top + h * .42);
				c.lineTo(x0 - 9 * k, top + h * .6);
				c.moveTo(x0 + 6 * k, top + h * .5);
				c.lineTo(x0 + 13 * k, top + h * .7);
				c.stroke();
			}
		}
		if (st.ring > 0) {
			c.save();
			ell(c, x0, top, (RX + 7) * k, (RY + 3) * k, Math.PI - .01, Math.PI + TAU * st.ring);
			c.lineWidth = 3.4 * k;
			c.strokeStyle = P.steel;
			c.stroke();
			if (st.ring >= 1) {
				oval(c, x0, top - .5 * k, (RX + 5.5) * k, (RY + 2) * k, P.steelDk);
				if (st.paint > 0)
					for (var q = 0; q < 14 * st.paint; q++) {
						var th = q / 14 * TAU;
						if (Math.sin(th) > -.2)
							line(c, 2.6 * k, q % 2 ? P.black : P.stripe, [ x0 + Math.cos(th) * (RX + 7) * k, top + Math.sin(th) * (RY + 3) * k, x0 + Math.cos(th + .2) * (RX + 7) * k, top + Math.sin(th + .2) * (RY + 3) * k ]);
					}
			}
			c.restore();
		}
		var hx = x0, hy = top - 4 * k;
		if (st.dome > 0) {
			c.save();
			c.beginPath();
			c.rect(x0 - 30 * k, hy - 30 * k, 60 * k * st.dome, 34 * k);
			c.clip();
			ell(c, hx, hy, 24 * k, 21 * k, Math.PI, TAU);
			c.closePath();
			var gr = c.createLinearGradient(hx - 24 * k, hy - 20 * k, hx + 18 * k, hy);
			gr.addColorStop(0, P.steelLt);
			gr.addColorStop(.5, P.steel);
			gr.addColorStop(1, P.steelDk);
			c.fillStyle = gr;
			c.fill();
			[ -12, 0, 12 ].forEach(function (dx) { line(c, .7 * k, P.steelDk, [ hx + dx * k, hy - Math.sqrt(Math.max(0, 1 - dx * dx / 576)) * 21 * k, hx + dx * k * 1.05, hy ]); });
			if (st.paint > 0)
				box(c, hx - 24 * k, hy - 5 * k, 48 * k * st.paint, 2.6 * k, P.stripe);
			c.restore();
		}
		if (st.gun > 0) {
			var off = tv && tv.off && !building, rocket = tv && tv.skin.gun === 'rocket', plasma = tv && tv.skin.gun === 'plasma';
			var a = off ? (s > 0 ? 1.05 : Math.PI - 1.05) : aim === null ? (s > 0 ? .25 : Math.PI - .25) : aim, len = (42 * st.gun - recoil * 6) * k * (rocket ? .82 : 1), pr = -Math.sin(a) * 4 * k, pc = Math.cos(a) * 4 * k;
			[ -1, 1 ].forEach(function (q) {
				line(c, (rocket ? 7 : 4.2) * k, P.steelDk, [ hx + q * pr, hy - 8 * k + q * pc, hx + q * pr + Math.cos(a) * len, hy - 8 * k + q * pc + Math.sin(a) * len ]);
				line(c, 1 * k, P.steelLt, [ hx + q * pr, hy - 9 * k + q * pc, hx + q * pr + Math.cos(a) * len * .9, hy - 9 * k + q * pc + Math.sin(a) * len * .9 ]);
				if (plasma && !off)
					oval(c, hx + q * pr + Math.cos(a) * len, hy - 8 * k + q * pc + Math.sin(a) * len, 2.6 * k, 2.6 * k, 'rgba(127,232,255,' + (.55 + .45 * Math.sin(t * 9 + q)) + ')');
				if (rocket)
					oval(c, hx + q * pr + Math.cos(a) * len, hy - 8 * k + q * pc + Math.sin(a) * len, 3 * k, 3 * k, '#d8442e');
			});
			oval(c, hx, hy - 8 * k, 7 * k, 6 * k, P.steelDk);
			if (st.gun >= 1)
				oval(c, hx, hy - 24 * k, 2.2 * k, 2.2 * k, off ? '#3a0c0a' : tv && !tv.online ? '#ff2020' : cyc(t, 1.4) < .5 ? P.red : '#5a1512');
			if (flash > 0) {
				var fx = hx + Math.cos(a) * (len + 4 * k), fy = hy - 8 * k + Math.sin(a) * (len + 4 * k);
				c.save();
				c.globalAlpha = flash;
				oval(c, fx, fy, 9 * k * flash, 9 * k * flash, P.bolt);
				oval(c, fx, fy, 4 * k, 4 * k, P.white);
				c.restore();
			}
		}
		if (scaffold) {
			[ -1, 1 ].forEach(function (q) { line(c, 1.5 * k, P.wood, [ x0 + q * (RX + 4) * k, padTop + 8 * k, x0 + q * (RX + 4) * k, top - 8 * k ]); });
			for (var yy = padTop - 14 * k; yy > top - 2 * k; yy -= 16 * k)
				line(c, 1.8 * k, P.wood, [ x0 - (RX + 6) * k, yy, x0 + (RX + 6) * k, yy ]);
			line(c, 2.2 * k, P.woodDk, [ x0 - (RX + 8) * k, top + RY * .7 * k, x0 + (RX + 8) * k, top + RY * .7 * k ]);
			var lx = x0 + s * (RX + 13) * k;
			line(c, 1.2 * k, P.woodDk, [ lx - 2.5 * k, y0 + 10 * k, lx - 2.5 * k + s * 3 * k, top + 4 * k ]);
			line(c, 1.2 * k, P.woodDk, [ lx + 2.5 * k, y0 + 10 * k, lx + 2.5 * k + s * 3 * k, top + 4 * k ]);
			for (var r = y0 + 4 * k; r > top + 8 * k; r -= 6 * k)
				line(c, 1 * k, P.wood, [ lx - 2.5 * k, r, lx + 2.5 * k, r ]);
		}
		if (tv && tv.hp < .3 && !building)
			for (var sm = 0; sm < 3; sm++) {
				var f = (t * .55 + sm / 3) % 1;
				oval(c, hx + Math.sin(sm * 2 + t) * 5 * k, hy - 26 * k - f * 30 * k, (4 + f * 9) * k, (4 + f * 9) * k, 'rgba(70,70,74,' + (.38 * (1 - f)) + ')');
			}
		return { hx: hx, hy: hy - 8 * k, top: top };
	}

	function crane(c, P, S, cr, k, top, alpha, mat) {
		var s = S.s, X = function (v) { return S.x + s * v * k; }, Y = function (v) { return S.y + v * k; };
		var lw = Math.max(1, 1.5 * k), half = 5;
		c.save();
		c.globalAlpha *= alpha;
		box(c, Math.min(X(MAST - 12), X(MAST + 12)), Y(2), 24 * k, 8 * k, P.concreteDk);
		line(c, lw, P.crane, [ X(MAST - half), Y(4), X(MAST - half), Y(JIB) ]);
		line(c, lw, P.crane, [ X(MAST + half), Y(4), X(MAST + half), Y(JIB) ]);
		for (var y = 4, f = 0; y > JIB; y -= 10, f++)
			line(c, lw * .7, P.craneDk, [ X(MAST + (f % 2 ? half : -half)), Y(y), X(MAST + (f % 2 ? -half : half)), Y(Math.max(JIB, y - 10)) ]);
		var tip = -24, back = MAST + 46;
		line(c, lw, P.crane, [ X(tip), Y(JIB - 4), X(back), Y(JIB - 4) ]);
		line(c, lw, P.crane, [ X(tip), Y(JIB + 3), X(back), Y(JIB + 3) ]);
		for (var x = tip, z = 0; x < back; x += 8, z++)
			line(c, lw * .7, P.craneDk, [ X(x), Y(z % 2 ? JIB - 4 : JIB + 3), X(Math.min(back, x + 8)), Y(z % 2 ? JIB + 3 : JIB - 4) ]);
		line(c, lw * .7, P.craneDk, [ X(MAST), Y(JIB - 24), X(tip), Y(JIB - 4) ]);
		line(c, lw * .7, P.craneDk, [ X(MAST), Y(JIB - 24), X(back), Y(JIB - 4) ]);
		line(c, lw, P.crane, [ X(MAST - half), Y(JIB - 4), X(MAST), Y(JIB - 24), X(MAST + half), Y(JIB - 4) ]);
		box(c, Math.min(X(MAST - 17), X(MAST - 5)), Y(JIB + 3), 12 * k, 10 * k, P.crane);
		box(c, Math.min(X(MAST - 15), X(MAST - 8)), Y(JIB + 5), 7 * k, 5 * k, P.glass);
		box(c, Math.min(X(back - 14), X(back)), Y(JIB + 3), 14 * k, 15 * k, P.concreteDk);
		line(c, .6 * k, P.concrete, [ X(back - 14), Y(JIB + 10), X(back), Y(JIB + 10) ]);
		var tx = X(cr.x), hy = Y(JIB + 3 + cr.d);
		box(c, tx - 4 * k, Y(JIB + 2), 8 * k, 4 * k, P.steelDk);
		line(c, Math.max(.6, .55 * k), P.black, [ tx - 1.5 * k, Y(JIB + 6), tx - 1.5 * k, hy - 3 * k ]);
		line(c, Math.max(.6, .55 * k), P.black, [ tx + 1.5 * k, Y(JIB + 6), tx + 1.5 * k, hy - 3 * k ]);
		box(c, tx - 3 * k, hy - 4 * k, 6 * k, 5 * k, P.crane);
		ell(c, tx, hy + 3 * k, 2.2 * k, 2.6 * k, 0, Math.PI * 1.4);
		c.lineWidth = Math.max(.8, 1 * k);
		c.strokeStyle = P.steelDk;
		c.stroke();
		if (cr.load) {
			line(c, Math.max(.5, .45 * k), P.black, [ tx, hy + 4 * k, tx - 9 * k, hy + 12 * k ]);
			line(c, Math.max(.5, .45 * k), P.black, [ tx, hy + 4 * k, tx + 9 * k, hy + 12 * k ]);
			loadShape(c, P, cr.load, tx, hy + 11 * k, k);
			var gy = lerp(Y(34), Y(0) - (top !== null ? 0 : 0), clamp(1 - cr.x / STOCK));
			oval(c, tx, gy, 12 * k, 4 * k, 'rgba(0,0,0,.2)');
		}
		c.restore();
	}

	function sign(c, P, S, k, p, w) {
		var x = S.x + S.s * 6 * k, y = S.y + 46 * k, bw = 74 * k, bh = 30 * k;
		line(c, 2.2 * k, P.signDk, [ x - bw * .3, y + bh * .2, x - bw * .3, y + bh * .2 + 22 * k ]);
		line(c, 2.2 * k, P.signDk, [ x + bw * .3, y + bh * .2, x + bw * .3, y + bh * .2 + 22 * k ]);
		box(c, x - bw / 2, y - bh / 2, bw, bh, P.sign);
		line(c, .8 * k, P.signDk, [ x - bw / 2, y - bh * .1, x + bw / 2, y - bh * .1 ]);
		c.fillStyle = P.ink;
		c.textAlign = 'center';
		c.textBaseline = 'middle';
		c.font = '800 ' + (6.6 * k).toFixed(1) + 'px Onest, system-ui, sans-serif';
		c.fillText('МУЖИКИ (ЖУКИ)', x, y - bh * .27);
		c.fillText('РАБОТАЮТ!', x, y + bh * .02);
		c.font = '700 ' + (6 * k).toFixed(1) + 'px Onest, system-ui, sans-serif';
		var left = (1 - p) * DAY, hrs = Math.floor(left / 36e5), min = Math.floor(left % 36e5 / 6e4);
		c.fillText(Math.floor(p * 100) + '% · ещё ' + hrs + ' ч ' + min + ' мин', x, y + bh * .31);
	}

	function stepCrane(w, S, st, dt, top, mat) {
		var cr = S.state.crane, i = S.i;
		cr.t -= dt;
		var stockD = 22 - JIB, topD = (top / S.k) - 12 - JIB, base = STOCK;
		if (cr.ph === 'rest') {
			cr.x += (base - cr.x) * Math.min(1, dt * 2);
			if (cr.t <= 0) {
				cr.ph = 'down';
				cr.t = 2.6;
				cr.from = cr.d;
				play(w, 'winch', i, 2.6, false);
			}
		}
		else if (cr.ph === 'down') {
			cr.x = base;
			cr.d = lerp(stockD, cr.from, ease(cr.t / 2.6));
			if (cr.t <= 0) {
				if (S.state.stock > 0) {
					cr.ph = 'attach';
					cr.t = 1.2;
				}
				else
					cr.t = .5;
			}
		}
		else if (cr.ph === 'attach') {
			if (cr.t <= 0) {
				S.state.stock--;
				cr.load = mat;
				cr.ph = 'lift';
				cr.t = 3.4;
				play(w, 'winch', i, 3.4, true);
			}
		}
		else if (cr.ph === 'lift') {
			cr.d = lerp(REST, stockD, ease(cr.t / 3.4));
			if (cr.t <= 0) {
				cr.ph = 'travel';
				cr.t = 3.2;
				play(w, 'trolley', i, 3.2);
			}
		}
		else if (cr.ph === 'travel') {
			cr.x = lerp(0, base, ease(cr.t / 3.2));
			if (cr.t <= 0) {
				cr.ph = 'lower';
				cr.t = 2.4;
				play(w, 'winch', i, 2.4, false);
			}
		}
		else if (cr.ph === 'lower') {
			cr.d = lerp(Math.max(REST, topD), REST, ease(cr.t / 2.4));
			if (cr.t <= 0) {
				cr.ph = 'release';
				cr.t = 1.4;
			}
		}
		else if (cr.ph === 'release') {
			if (cr.t <= 0) {
				if (cr.load) {
					play(w, 'clank', i);
					dust(S.x, S.y + top, 5, S.k);
				}
				cr.load = null;
				cr.ph = 'up';
				cr.t = 1.6;
				cr.from = cr.d;
				play(w, 'winch', i, 1.6, true);
			}
		}
		else if (cr.ph === 'up') {
			cr.d = lerp(REST, cr.from, ease(cr.t / 1.6));
			if (cr.t <= 0) {
				cr.ph = 'back';
				cr.t = 2.8;
				play(w, 'trolley', i, 2.8);
			}
		}
		else if (cr.ph === 'back') {
			cr.x = lerp(base, 0, ease(cr.t / 2.8));
			if (cr.t <= 0) {
				cr.ph = 'rest';
				cr.t = rand(.6, 3);
			}
		}
	}

	function stepCarriers(w, L, dt, mat) {
		var want = 2;
		L.forEach(function (S) {
			var mine = carriers.filter(function (b) { return b.site === S.i; });
			while (mine.length < want) {
				var b = { site: S.i, st: 'wait', t: rand(.3, 6) * (mine.length + 1), ph: rand(0, 6), seed: rand(0, 9) };
				carriers.push(b);
				mine.push(b);
			}
		});
		carriers.forEach(function (b) {
			var S = L[b.site], k = S.k, sx = S.x + S.s * (STOCK - 4) * k + (b.seed - 4.5) * 2 * k, sy = S.y + 46 * k;
			b.t -= dt;
			if (b.st === 'wait') {
				if (b.t > 0)
					return;
				var fromTop = Math.random() < .5;
				b.ex = S.x + S.s * rand(30, 120) * k;
				b.ey = fromTop ? -40 : w.H + 40;
				if (S.low && fromTop) {
					b.ex = S.s > 0 ? -40 : w.W + 40;
					b.ey = S.y + rand(-20, 30) * k;
				}
				b.x = b.ex;
				b.y = b.ey;
				b.st = 'in';
				var r = Math.random();
				b.load = mat === 'bricks' ? (r < .45 ? 'barrow' : 'bricks') : mat === 'beam' || mat === 'barrel' || mat === 'plate' ? 'beam' : mat === 'paint' ? 'bricks' : 'plank';
			}
			var tx = b.st === 'in' ? sx : b.ex, ty = b.st === 'in' ? sy : b.ey, dx = tx - b.x, dy = ty - b.y, dist = Math.sqrt(dx * dx + dy * dy);
			if (b.st === 'drop') {
				if (b.t <= 0) {
					b.st = 'out';
					b.load = null;
				}
				return;
			}
			var v = 36 * k;
			if (dist < v * dt + 1) {
				if (b.st === 'in') {
					b.st = 'drop';
					b.t = .9;
					S.state.stock = Math.min(7, S.state.stock + 1);
					play(w, 'thud', S.i);
					dust(sx, sy, 4, k);
				}
				else {
					b.st = 'wait';
					b.t = rand(4, 11);
				}
				return;
			}
			b.a = Math.atan2(dy, dx) + Math.PI / 2 + Math.sin(w.t * 2 + b.seed) * .08;
			b.x += dx / dist * v * dt;
			b.y += dy / dist * v * dt;
			b.ph += v * dt * .35;
		});
	}

	function stepTurret(w, S, dt, head, tv, R) {
		var T = S.state, k = S.k, best = null, bd = 1e9, cur = null, mine = function (o) { return S.s > 0 ? o.x > head.hx - 20 : o.x < head.hx + 20; };
		T.cd -= dt;
		T.flash = Math.max(0, T.flash - dt * 9);
		T.recoil = Math.max(0, T.recoil - dt * 4);
		if (T.a === null)
			T.a = S.s > 0 ? .25 : Math.PI - .25;
		if (tv && (tv.dead || tv.off)) {
			T.tgt = null;
			return;
		}
		if (R && tv && tv.fight) {
			var bt = tv.online ? R.aim() : null, wantB;
			if (bt) {
				var dB = Math.hypot(bt.x - head.hx, bt.y - head.hy), leadB = dB / 740;
				wantB = Math.atan2(bt.y + bt.vy * leadB - head.hy, bt.x + bt.vx * leadB - head.hx);
			}
			else {
				T.sweep += dt * .5;
				wantB = (S.s > 0 ? 0 : Math.PI) + Math.sin(T.sweep) * .7;
			}
			var dfB = Math.atan2(Math.sin(wantB - T.a), Math.cos(wantB - T.a));
			T.a += Math.max(-4 * dt, Math.min(4 * dt, dfB));
			if (bt && Math.abs(dfB) < .08 && T.cd <= 0) {
				T.cd = R.rate() * rand(.85, 1.15);
				T.recoil = 1;
				T.flash = 1;
				shots.push({ x: head.hx + Math.cos(T.a) * (head.tl || 46 * k), y: head.hy + Math.sin(T.a) * (head.tl || 46 * k), vx: Math.cos(T.a) * 740, vy: Math.sin(T.a) * 740, age: 0, site: S.i, boss: true, skin: tv.skin.shot });
			}
			return;
		}
		w.targets.forEach(function (o) {
			if (o.ref === T.tgt && !o.ref.dead && mine(o))
				cur = o;
		});
		if (!cur) {
			w.targets.forEach(function (o) {
				var d = Math.sqrt((o.x - head.hx) * (o.x - head.hx) + (o.y - head.hy) * (o.y - head.hy));
				if (!o.ref.dead && d < bd && mine(o)) {
					bd = d;
					best = o;
				}
			});
			cur = best;
			T.tgt = best ? best.ref : null;
		}
		var want;
		if (cur) {
			var d = Math.sqrt((cur.x - head.hx) * (cur.x - head.hx) + (cur.y - head.hy) * (cur.y - head.hy)), lead = d / 740;
			want = Math.atan2(cur.y + cur.vy * lead - head.hy, cur.x + cur.vx * lead - head.hx);
		}
		else {
			T.sweep += dt * .5;
			want = (S.s > 0 ? 0 : Math.PI) + Math.sin(T.sweep) * .7;
		}
		var diff = Math.atan2(Math.sin(want - T.a), Math.cos(want - T.a));
		T.a += Math.max(-3 * dt, Math.min(3 * dt, diff));
		if (cur && Math.abs(diff) < .06 && T.cd <= 0) {
			T.cd = rand(3, 6);
			T.recoil = 1;
			T.flash = 1;
			var len = head.tl || 46 * k;
			shots.push({ x: head.hx + Math.cos(T.a) * len, y: head.hy + Math.sin(T.a) * len, vx: Math.cos(T.a) * 740, vy: Math.sin(T.a) * 740, age: 0, site: S.i, skin: tv ? tv.skin.shot : 'bolt' });
			play(w, 'shot', S.i);
		}
	}

	function stepShots(w, dt, R) {
		shots = shots.filter(function (s) {
			s.age += dt;
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			if (s.boss) {
				if (R && R.shot(s.x, s.y, s.site)) {
					spark(s.x, s.y, 6, 'spark', 110);
					return false;
				}
				return s.age < 2.5 && s.x > -50 && s.x < w.W + 50 && s.y > -50 && s.y < w.H + 50;
			}
			var hit = null;
			w.targets.forEach(function (o) {
				if (hit || o.ref.dead)
					return;
				o.circles.forEach(function (q) {
					if (!hit && (q[0] - s.x) * (q[0] - s.x) + (q[1] - s.y) * (q[1] - s.y) < q[2] * q[2])
						hit = o;
				});
			});
			if (hit) {
				w.hurt(hit.ref, hit.meme ? 1.25 : 99, 'shot', s.x - s.vx * .05, s.y - s.vy * .05);
				spark(s.x, s.y, hit.meme ? 7 : 10, 'spark', 120);
				dust(s.x, s.y, 4, 1);
				play(w, 'hit', s.site);
				return false;
			}
			return s.age < 2.5 && s.x > -50 && s.x < w.W + 50 && s.y > -50 && s.y < w.H + 50;
		});
	}

	function drawShots(c, P, w) {
		shots.forEach(function (s) { drawShot(c, P, w.look, s); });
	}

	function drawShot(c, P, look, s) {
		(function () {
			var skin = look === 'mono' ? 'bolt' : s.skin || 'bolt', a = Math.atan2(s.vy, s.vx), sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp, gr;
			c.save();
			c.lineCap = 'round';
			if (skin === 'noodle' && atlas()) {
				c.translate(s.x, s.y);
				c.rotate(a + Math.sin(s.age * 26) * .18);
				model(c, 'noodle', 0, 0, .52, 'center');
			}
			else if (skin === 'noodle') {
				c.translate(s.x, s.y);
				c.rotate(a);
				[ [ 3.6, P.noodleDk ], [ 2.4, P.noodle ], [ .8, P.cupWhite ] ].forEach(function (st, n) {
					[ 0, 1 ].forEach(function (q) {
						c.beginPath();
						for (var i = 0; i <= 14; i++)
							c.lineTo(-i * 2.1, Math.sin(i * 1.25 + s.age * 28 + q * 2.2) * 2.6 + (q ? 1.6 : -1.2) - (n === 2 ? .6 : 0));
						c.lineWidth = st[0] * (q ? .8 : 1);
						c.strokeStyle = st[1];
						c.stroke();
					});
				});
			}
			else if (skin === 'plasma') {
				gr = c.createLinearGradient(s.x - ux * 22, s.y - uy * 22, s.x, s.y);
				gr.addColorStop(0, 'rgba(127,232,255,0)');
				gr.addColorStop(1, 'rgba(127,232,255,.65)');
				line(c, 4, gr, [ s.x - ux * 22, s.y - uy * 22, s.x, s.y ]);
				gr = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, 8);
				gr.addColorStop(0, 'rgba(255,255,255,1)');
				gr.addColorStop(.3, 'rgba(191,244,255,.95)');
				gr.addColorStop(.6, 'rgba(127,232,255,.45)');
				gr.addColorStop(1, 'rgba(127,232,255,0)');
				c.fillStyle = gr;
				c.fillRect(s.x - 8, s.y - 8, 16, 16);
				c.strokeStyle = 'rgba(220,250,255,.8)';
				c.lineWidth = .8;
				for (var q = 0; q < 2; q++) {
					var an = Math.random() * TAU, r1 = 4 + Math.random() * 2;
					c.beginPath();
					c.moveTo(s.x + Math.cos(an) * 3, s.y + Math.sin(an) * 3);
					c.lineTo(s.x + Math.cos(an + .4) * r1, s.y + Math.sin(an + .4) * r1);
					c.lineTo(s.x + Math.cos(an - .1) * (r1 + 2.5), s.y + Math.sin(an - .1) * (r1 + 2.5));
					c.stroke();
				}
			}
			else if (skin === 'rocket') {
				for (var p = 1; p <= 4; p++)
					oval(c, s.x - ux * (12 + p * 6) + (Math.random() - .5) * 2, s.y - uy * (12 + p * 6) + (Math.random() - .5) * 2, 2.2 + p * 1.1, 2.2 + p * 1.1, 'rgba(150,150,155,' + (.32 - p * .06) + ')');
				c.translate(s.x, s.y);
				c.rotate(a);
				var fl = 7 + Math.random() * 5;
				if (atlas()) {
					gr = c.createLinearGradient(-15 - fl, 0, -12, 0);
					gr.addColorStop(0, 'rgba(255,120,40,0)');
					gr.addColorStop(.6, 'rgba(255,170,60,.9)');
					gr.addColorStop(1, 'rgba(255,245,200,1)');
					c.fillStyle = gr;
					c.beginPath();
					c.moveTo(-12, -2.4);
					c.quadraticCurveTo(-15 - fl, 0, -12, 2.4);
					c.fill();
					model(c, 'rocket', 2, 0, .46, 'center');
					c.restore();
					return;
				}
				gr = c.createLinearGradient(-11 - fl, 0, -10, 0);
				gr.addColorStop(0, 'rgba(255,120,40,0)');
				gr.addColorStop(.6, 'rgba(255,170,60,.9)');
				gr.addColorStop(1, 'rgba(255,245,200,1)');
				c.fillStyle = gr;
				c.beginPath();
				c.moveTo(-10, -2.2);
				c.quadraticCurveTo(-11 - fl, 0, -10, 2.2);
				c.fill();
				c.fillStyle = P.warhead;
				c.beginPath();
				c.moveTo(-10, -2.2);
				c.lineTo(-13, -4.4);
				c.lineTo(-11.5, -2.2);
				c.moveTo(-10, 2.2);
				c.lineTo(-13, 4.4);
				c.lineTo(-11.5, 2.2);
				c.fill();
				gr = c.createLinearGradient(0, -2.4, 0, 2.4);
				gr.addColorStop(0, '#f2f4f6');
				gr.addColorStop(.5, '#c9cdd2');
				gr.addColorStop(1, '#7d838a');
				c.fillStyle = gr;
				c.fillRect(-10.5, -2.3, 10, 4.6);
				c.fillStyle = P.warhead;
				c.beginPath();
				c.moveTo(-.5, -2.3);
				c.quadraticCurveTo(4.5, 0, -.5, 2.3);
				c.fill();
				box(c, -6, -2.3, 1.2, 4.6, P.stripe);
			}
			else {
				var L = Math.min(26, sp * .045);
				gr = c.createLinearGradient(s.x - ux * L, s.y - uy * L, s.x, s.y);
				gr.addColorStop(0, 'rgba(255,215,106,0)');
				gr.addColorStop(1, P.bolt);
				line(c, 3.2, gr, [ s.x - ux * L, s.y - uy * L, s.x, s.y ]);
				line(c, 1.2, P.white, [ s.x - ux * L * .45, s.y - uy * L * .45, s.x, s.y ]);
				gr = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, 5);
				gr.addColorStop(0, 'rgba(255,250,220,.95)');
				gr.addColorStop(1, 'rgba(255,215,106,0)');
				c.fillStyle = gr;
				c.fillRect(s.x - 5, s.y - 5, 10, 10);
			}
			c.restore();
		})();
	}

	function scene(c, w, dt) {
		var P = palette(w), L = layout(w), p = w.progress, building = p < 1, st = stages(p), J = job(p), t = w.t;
		var elapsed = p * DAY, remain = (1 - p) * DAY, arrive = clamp(elapsed / 3e4), leave = building ? clamp(remain / 3e4) : 0;
		c.lineCap = 'round';
		c.lineJoin = 'round';
		var R = !building && g.KadrRaid && g.KadrRaid.active() ? g.KadrRaid : null, heads = [];
		ground(c, w, L);
		if (R)
			R.under(c, w, L, P, lastHeads);
		L.forEach(function (S) {
			S.state = site(S.i);
			var k = S.k, i = S.i;
			var fx = function (kind, x, y) {
				if (kind === 'strike') {
					play(w, J.load === 'planks' ? 'stake' : 'hammer', i);
					if (J.load !== 'planks' && J.load !== 'bucket')
						spark(x, y, 3, 'spark', 60);
				}
				else if (kind === 'torch') {
					if (Math.random() < dt * 30)
						spark(x, y, 1, 'spark', 90);
					play(w, 'torch', i);
				}
				else
					play(w, kind, i);
			};
			var top = topOf(st) * k;
			if (building)
				stepCrane(w, S, st, dt, top, J.load);
			var tv = R ? R.turret(S.i) : null;
			var head = (!building && turretArt(c, P, S, k, S.state.a, S.state.recoil, S.state.flash, t, tv, w.look)) || turret(c, skinned(P, tv, w), S, st, k, building ? null : S.state.a, S.state.recoil, S.state.flash, t, building, tv);
			heads[S.i] = head;
			if (!building && w.armed)
				stepTurret(w, S, dt, head, tv, R);
			if (!building)
				return;
			var ground = st.wall < .12, alpha = Math.min(arrive < 1 ? arrive * 3 : 1, leave);
			c.save();
			c.globalAlpha = alpha;
			for (var n = 0; n < S.state.stock; n++)
				loadShape(c, P, J.load, S.x + S.s * (STOCK - 6) * k + (n % 2) * 4 * k * S.s, S.y + (40 - n * 3.2) * k, k * .8);
			var wk = S.state.w;
			[ 0, 1 ].forEach(function (q) {
				var o = wk[q];
				o.wait -= dt;
				if (o.wait <= 0) {
					o.wait = rand(3, 8);
					o.goal = q ? rand(.2, .72) : rand(-.72, -.2);
				}
				if (o.goal !== undefined)
					o.x += Math.max(-dt * .25, Math.min(dt * .25, o.goal - o.x));
				var name = q ? J.top2 : J.top, wx = S.x + (ground ? (q ? 1 : -1) * (RX + 14) * k : o.x * RX * k), wy = ground ? S.y + 14 * k : S.y + top + RY * .55 * k;
				var ex = arrive < 1 ? lerp(S.x + S.s * 60 * k, wx, ease(arrive)) : wx, ey = arrive < 1 ? lerp(w.H + 30, wy, ease(arrive)) : wy;
				var dir = ground ? (q ? -1 : 1) : (o.goal !== undefined && Math.abs(o.goal - o.x) > .02 ? Math.sign(o.goal - o.x) : (q ? -1 : 1) * S.s);
				worker(c, P, ex, ey, 28 * k, dir, arrive < 1 ? null : name, t, o.seed, arrive >= 1 && fx, arrive < 1 || (o.goal !== undefined && Math.abs(o.goal - o.x) > .02));
			});
			var g3 = wk[2], gx = S.x + S.s * (STOCK - 34) * k, gy = S.y + 32 * k;
			var guiding = S.state.crane.ph === 'attach' || S.state.crane.ph === 'down';
			worker(c, P, arrive < 1 ? lerp(S.x + S.s * 90 * k, gx, ease(arrive)) : gx, arrive < 1 ? lerp(w.H + 30, gy, ease(arrive)) : gy, 28 * k, S.s, arrive < 1 ? null : guiding ? 'tape' : J.ground, t, g3.seed, arrive >= 1 && fx, arrive < 1);
			c.restore();
			crane(c, P, S, S.state.crane, k, top, Math.min(1, leave * 1.5), J.load);
			sign(c, P, S, k, p, w);
		});
		if (building) {
			stepCarriers(w, L, dt, J.load);
			c.save();
			c.globalAlpha = Math.min(1, leave);
			carriers.forEach(function (b) {
				if (b.st === 'wait')
					return;
				topBug(c, P, b.x, b.y, b.a || 0, 22 * L[0].k, b.ph, b.st === 'in' || b.st === 'drop' ? b.load : null);
			});
			c.restore();
		}
		else {
			carriers = [];
			stepShots(w, dt, R);
			drawShots(c, P, w);
		}
		stepParts(dt);
		drawParts(c, P);
		lastHeads = heads;
		if (R)
			R.over(c, w, L, P, dt, heads);
	}

	function frame(ctx, w) {
		var dt = Math.min(.05, Math.max(0, w.dt || 0));
		sound(w);
		if (w.look === 'pixel') {
			var bw = Math.ceil(w.W / 2), bh = Math.ceil(w.H / 2);
			if (!buf) {
				buf = D.createElement('canvas');
				bctx = buf.getContext('2d');
			}
			if (buf.width !== bw || buf.height !== bh) {
				buf.width = bw;
				buf.height = bh;
			}
			bctx.setTransform(1, 0, 0, 1, 0, 0);
			bctx.clearRect(0, 0, bw, bh);
			bctx.setTransform(.5, 0, 0, .5, 0, 0);
			scene(bctx, w, dt);
			ctx.save();
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(buf, 0, 0, bw, bh, 0, 0, bw * 2, bh * 2);
			ctx.restore();
		}
		else {
			ctx.save();
			scene(ctx, w, dt);
			ctx.restore();
		}
	}

	g.KadrMeta = {
		colors: COL,
		shot: function (c, skin, x, y, vx, vy, age) {
			drawShot(c, COL, 'color', { x: x, y: y, vx: vx, vy: vy, age: age || 0, skin: skin });
		},
		ready: function () { return !!atlas(); },
		model: function (c, name, x, y, k, at, opt) { return model(c, name, x, y, k, at, opt); },
		point: function (name, key, x, y, k, at) { return mpt(name, key, x, y, k, at); },
		size: function (name) { var m = MODELS.m[name]; return m ? [ m[2] / MODELS.u, m[3] / MODELS.u ] : null; },
		frame: frame,
		idle: function () {
			if (A && A.ctx.state === 'running')
				A.ctx.suspend();
			shots = [];
			parts = [];
		},
		audio: function () { return A ? { state: A.ctx.state, armed: A.armed } : null; }
	};
})(window);
