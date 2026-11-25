(function (g) {
	'use strict';

	var D = g.document;
	var TAU = Math.PI * 2;
	var DAY = 864e5;
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
		sign: '#c8955c', signDk: '#7d5530', ink: '#3a2414', stripe: '#f2a51e', paint: '#d33b2c'
	};
	var MIN = { hammer: .09, stake: .09, trowel: .3, shovel: .5, brush: .4, wrench: .5, saw: 1.2, torch: 1.4, winch: 1, trolley: 1, clank: .3, thud: .15, shot: .1, hit: .05 };

	var sites = [ null, null ], carriers = [], parts = [], shots = [];
	var mono = null, monoKey = '', buf = null, bctx = null, gutW = -1, gut = 0, liftAt = -1e9, lift = 0, liftNow = -1;
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
		return mono;
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
		var x = !low && gut > span + 24 ? gut / 2 - span / 2 + 44 * k : 44 * k, y;
		if (low) {
			if (w.t - liftAt > 2) {
				liftAt = w.t;
				lift = actionsLift();
			}
			liftNow = liftNow < 0 ? lift : liftNow + (lift - liftNow) * Math.min(1, (w.dt || 0) * 3);
			y = Math.round(w.H - 76 * k - liftNow - 6);
		}
		else
			y = Math.round(w.H / 2 + 52 * k);
		return [ { i: 0, s: 1, x: x, y: y, k: k, low: low }, { i: 1, s: -1, x: w.W - x, y: y, k: k, low: low } ];
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

	function turret(c, P, S, st, k, aim, recoil, flash, t, building) {
		var x0 = S.x, y0 = S.y, s = S.s, padTop = y0 - PAD * k * st.pad, h = HT * k * st.wall, top = padTop - h;
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
			var a = aim === null ? (s > 0 ? .25 : Math.PI - .25) : aim, len = (42 * st.gun - recoil * 6) * k, pr = -Math.sin(a) * 4 * k, pc = Math.cos(a) * 4 * k;
			[ -1, 1 ].forEach(function (q) {
				line(c, 4.2 * k, P.steelDk, [ hx + q * pr, hy - 8 * k + q * pc, hx + q * pr + Math.cos(a) * len, hy - 8 * k + q * pc + Math.sin(a) * len ]);
				line(c, 1 * k, P.steelLt, [ hx + q * pr, hy - 9 * k + q * pc, hx + q * pr + Math.cos(a) * len * .9, hy - 9 * k + q * pc + Math.sin(a) * len * .9 ]);
			});
			oval(c, hx, hy - 8 * k, 7 * k, 6 * k, P.steelDk);
			if (st.gun >= 1)
				oval(c, hx, hy - 24 * k, 2.2 * k, 2.2 * k, cyc(t, 1.4) < .5 ? P.red : '#5a1512');
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

	function stepTurret(w, S, dt, head) {
		var T = S.state, k = S.k, best = null, bd = 1e9, cur = null, mine = function (o) { return S.s > 0 ? o.x > head.hx - 20 : o.x < head.hx + 20; };
		T.cd -= dt;
		T.flash = Math.max(0, T.flash - dt * 9);
		T.recoil = Math.max(0, T.recoil - dt * 4);
		if (T.a === null)
			T.a = S.s > 0 ? .25 : Math.PI - .25;
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
			var d = Math.sqrt((cur.x - head.hx) * (cur.x - head.hx) + (cur.y - head.hy) * (cur.y - head.hy)), lead = d / 560;
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
			var len = 46 * k;
			shots.push({ x: head.hx + Math.cos(T.a) * len, y: head.hy + Math.sin(T.a) * len, vx: Math.cos(T.a) * 560, vy: Math.sin(T.a) * 560, age: 0, site: S.i });
			play(w, 'shot', S.i);
		}
	}

	function stepShots(w, dt) {
		shots = shots.filter(function (s) {
			s.age += dt;
			s.x += s.vx * dt;
			s.y += s.vy * dt;
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

	function drawShots(c, P) {
		shots.forEach(function (s) {
			var l = .03;
			c.save();
			c.lineCap = 'round';
			line(c, 3, P.bolt, [ s.x - s.vx * l, s.y - s.vy * l, s.x, s.y ]);
			line(c, 1.2, P.white, [ s.x - s.vx * l * .5, s.y - s.vy * l * .5, s.x, s.y ]);
			c.restore();
		});
	}

	function scene(c, w, dt) {
		var P = palette(w), L = layout(w), p = w.progress, building = p < 1, st = stages(p), J = job(p), t = w.t;
		var elapsed = p * DAY, remain = (1 - p) * DAY, arrive = clamp(elapsed / 3e4), leave = building ? clamp(remain / 3e4) : 0;
		c.lineCap = 'round';
		c.lineJoin = 'round';
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
			var head = turret(c, P, S, st, k, building ? null : S.state.a, S.state.recoil, S.state.flash, t, building);
			if (!building && w.armed)
				stepTurret(w, S, dt, head);
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
			stepShots(w, dt);
			drawShots(c, P);
		}
		stepParts(dt);
		drawParts(c, P);
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
