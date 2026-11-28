(function (g) {
	'use strict';

	if (g.KadrRaid)
		return;

	var D = g.document;
	var TAU = Math.PI * 2;
	var HOUR = 36e5, COOL = 12 * HOUR;
	var SELF = D.currentScript && D.currentScript.src ? D.currentScript.src : '';
	var DIR = SELF.replace(/kadr-raid\.js[^/]*$/, 'raid/'), VQ = (SELF.match(/\?v=[^&#]+/) || [ '' ])[0];
	var KEY = 'kadr-luci-raid', FKEY = 'kadr-luci-fight';
	var ART = {"heroes":{"ilkin":{"w":496,"h":440,"pivot":[292.9,188.1],"head":[242.7,91.3,100.5,98.1],"neck":[292.9,188.1],"eyes":[[291.1,133.6,3.7,6.7]],"mouth":[297.8,163.6,17.2,8.0],"lid":"#c4bebc"},"timur":{"w":397,"h":440,"pivot":[199.5,431.6],"eyes":[[298.9,105.3,27.4,23.2]],"pupils":[[286.8,111.6,6.3]],"brows":[[284.7,39.5,50.0,19.5],[157.4,48.4,19.5,26.3]],"prop":[0.0,21.1,160.0,147.4],"propPivot":[146.8,121.1],"white":"#e4d0db"},"wolf":{"w":424,"h":440,"pivot":[211.3,437.8],"eyes":[[175.3,88.0,10.1,9.7],[238.4,88.0,10.1,9.7]],"mouth":[213.1,140.3,50.5,22.4],"lid":"#5f4e47"},"artem":{"w":412,"h":440,"pivot":[215.8,228.9],"head":[96.2,-19.6,239.2,265.3],"neck":[215.8,228.9],"eyes":[],"mouth":[220.5,159.7,85.9,14.0],"glasses":[117.7,70.1,168.2,59.8]},"fox":{"atlas":{"body":[2,2,283,272],"h0":[287,2,135,150],"h1":[424,2,140,152],"h2":[566,2,132,150],"h3":[700,2,140,147],"h4":[842,2,141,156],"h5":[985,2,141,147]},"chin":[110,152],"headw":142}},"bosses":{"anus":{"front":[2,2,301,230],"left":[305,2,286,235],"right":[593,2,272,233],"side":[867,2,262,230],"back":[1131,2,312,229],"attack":[1445,2,323,263],"rage":[1770,2,222,221],"dead":[1994,2,180,98]},"rkn":{"front":[2,2,265,213],"point":[269,2,271,263],"shield":[542,2,321,254],"rage":[865,2,284,352],"intro":[1151,2,260,328],"side":[1413,2,339,240],"back":[1754,2,299,250]},"minion":{"m0":[2,2,68,64],"m1":[72,2,63,64],"m2":[137,2,63,64],"mf":[202,2,73,64]}}};
	var FR = { 'boss-anus': ART.bosses.anus, 'boss-rkn': ART.bosses.rkn, 'boss-minion': ART.bosses.minion, 'hero-fox': ART.heroes.fox.atlas };
	var BOSS = { anus: 'Анус', kumys: 'Кумысник', rkn: 'Командир РКН' };
	var WHO = { fox: [ 'Лис', '1' ], wolf: [ 'Волк', '2' ], timur: [ 'Тимурчик', '3' ], ilkin: [ 'Илькин', '4' ], artem: [ 'Артём', '' ] };
	var WAVES = [ 6, 8, 10, 12, 14, 16, 18, 20 ];
	var MAXDMG = 12;
	var SHOP = {
		tower: { title: 'Башни', items: [ [ 'brick', 'Кирпич', 0 ], [ 'concrete', 'Бетон с неоном', 14 ], [ 'gold', 'Золото Буффало', 30 ] ] },
		gun: { title: 'Стволы', items: [ [ 'steel', 'Сталь', 0 ], [ 'plasma', 'Плазма', 12 ], [ 'rocket', 'Ракетница', 22 ] ] },
		shot: { title: 'Снаряды', items: [ [ 'bolt', 'Болт', 0 ], [ 'noodle', 'Лапша Ролтон', 8 ], [ 'plasma', 'Плазма-шар', 14 ], [ 'rocket', 'Ракеты', 18 ] ] },
		router: { title: 'Ролтон', items: [ [ 'brick', 'Кирпич с антеннами', 0 ], [ 'rollton', 'Ролтон', 15 ] ] }
	};
	var POSES = {
		ilkin: [ { tilt: 0, lean: 0, mouth: [ 1, 1 ], eyes: 'open' }, { tilt: -7, lean: -2, mouth: [ 1.18, 1.25 ], eyes: 'wide', bounce: 1 }, { tilt: 6, lean: 2, mouth: [ 1.06, 1 ], eyes: 'squint' }, { tilt: -3, lean: 1, mouth: [ 1.22, 1.4 ], eyes: 'open', bounce: 1 }, { tilt: 4, lean: -1, mouth: [ 1.1, 1 ], eyes: 'wink' } ],
		timur: [ { lean: 0, look: [ 0, 0 ], brows: 0 }, { lean: -4, look: [ -.7, .1 ], brows: 1, bounce: 1 }, { lean: 3, look: [ .7, -.3 ], brows: -1 }, { lean: -2, look: [ 0, .5 ], brows: .6 }, { lean: 4, look: [ -.4, -.5 ], brows: 1, bounce: 1 } ],
		wolf: [ { lean: 0, mouth: [ 1, 1 ], eyes: 'open' }, { lean: -3, mouth: [ 1.08, 1.22 ], eyes: 'wide', bounce: 1 }, { lean: 3, mouth: [ 1.04, 1 ], eyes: 'squint' }, { lean: -1, mouth: [ 1.12, 1.32 ], eyes: 'open' }, { lean: 2, mouth: [ 1, 1 ], eyes: 'wink' } ],
		artem: [ { tilt: 0, lean: 0, mouth: [ 1, 1 ], glint: 1 }, { tilt: -6, lean: -2, mouth: [ 1.08, 1.5 ] }, { tilt: 5, lean: 2, mouth: [ 1.14, 1.2 ], glint: 1 }, { tilt: -2, lean: 1, mouth: [ 1.04, 1.7 ], bounce: 1 } ],
		fox: [ { tilt: 0, expr: 0 }, { tilt: -8, expr: 2, bounce: 1 }, { tilt: 6, expr: 3 }, { tilt: -4, expr: 1 }, { tilt: 5, expr: 4 }, { tilt: 0, expr: 5, bounce: 1 } ]
	};

	function E(tag, cls, kids, attrs) {
		var el = D.createElement(tag);
		if (cls)
			el.className = cls;
		Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
		(kids || []).forEach(function (k) {
			if (k !== null && k !== undefined && k !== '')
				el.appendChild(typeof k === 'string' ? D.createTextNode(k) : k);
		});
		return el;
	}

	function rand(a, b) {
		return a + Math.random() * (b - a);
	}

	function clamp(v, a, b) {
		return Math.max(a, Math.min(b, v));
	}

	function now() {
		return Date.now();
	}

	function fresh() {
		return {
			v: 1, heads: 0, dmg: 0, sw: false,
			skin: { tower: 'brick', gun: 'steel', shot: 'bolt', router: 'brick' },
			own: [ 'tower:brick', 'gun:steel', 'shot:bolt', 'router:brick' ],
			hp: { t0: 100, t1: 100, r: 100 }, off: { t0: false, t1: false },
			at: now(), next: 0, wins: 0, losses: 0, buff: 0, seen: {}, fight: null, last: null
		};
	}

	function clean(r) {
		var f = fresh(), o = { v: 1 };
		if (!r || typeof r !== 'object')
			return f;
		o.heads = Math.max(0, Math.floor(+r.heads || 0));
		o.dmg = clamp(Math.floor(+r.dmg || 0), 0, MAXDMG);
		o.sw = !!r.sw;
		o.own = Array.isArray(r.own) ? r.own.filter(function (s) { return typeof s === 'string' && /^[a-z]+:[a-z]+$/.test(s); }) : [];
		f.own.forEach(function (s) {
			if (o.own.indexOf(s) < 0)
				o.own.push(s);
		});
		o.skin = {};
		Object.keys(SHOP).forEach(function (k) {
			var v = r.skin && r.skin[k];
			o.skin[k] = typeof v === 'string' && o.own.indexOf(k + ':' + v) > -1 ? v : f.skin[k];
		});
		o.hp = {};
		[ 't0', 't1', 'r' ].forEach(function (k) {
			var v = r.hp ? +r.hp[k] : NaN;
			o.hp[k] = isFinite(v) ? clamp(v, 0, 100) : 100;
		});
		o.off = { t0: !!(r.off && r.off.t0), t1: !!(r.off && r.off.t1) };
		o.at = +r.at || now();
		o.next = +r.next || 0;
		o.wins = Math.max(0, Math.floor(+r.wins || 0));
		o.losses = Math.max(0, Math.floor(+r.losses || 0));
		o.buff = clamp(Math.floor(+r.buff || 0), 0, 3);
		o.seen = {};
		Object.keys(r.seen && typeof r.seen === 'object' ? r.seen : {}).forEach(function (k) { o.seen[k] = !!r.seen[k]; });
		o.fight = r.fight && +r.fight.at ? { at: +r.fight.at, id: String(r.fight.id || '') } : null;
		o.last = r.last && typeof r.last === 'object' ? { boss: String(r.last.boss || ''), win: !!r.last.win, heads: +r.last.heads || 0, at: +r.last.at || 0 } : null;
		return o;
	}

	function load() {
		try {
			return clean(JSON.parse(g.localStorage.getItem(KEY)));
		}
		catch (e) {
			return fresh();
		}
	}

	var raid = load(), settings = {}, F = null, fid = Math.random().toString(36).slice(2, 10);

	function save(push) {
		try {
			g.localStorage.setItem(KEY, JSON.stringify(raid));
		}
		catch (e) {}
		if (push && g.KadrSync && g.KadrSync.raidChanged)
			g.KadrSync.raidChanged();
	}

	function regen() {
		var t = now(), h = (t - raid.at) / HOUR;
		if (F || h <= 0) {
			raid.at = t;
			return;
		}
		[ 't0', 't1', 'r' ].forEach(function (k) { raid.hp[k] = Math.min(100, raid.hp[k] + h * 8); });
		raid.at = t;
	}

	var BAL = {
		lvl: function () { return Math.max(0, raid.wins - Math.floor(raid.losses / 2)); },
		threat: function (l) { return Math.max(0, l - 2 * raid.dmg); },
		hp: function (type, l) { return Math.round((240 + 45 * l) * (type === 'kumys' ? .85 : type === 'rkn' ? .8 : 1)); },
		turret: function () { return 1 + .35 * raid.dmg; },
		tentacle: function (g) { return Math.min(26, 6 + g); },
		ram: function (g) { return Math.min(34, 10 + 1.2 * g); },
		bite: function (g) { return Math.min(4, 1 + .15 * g); },
		gnaw: function (g) { return Math.min(3, 1 + .1 * g); },
		reward: function (type, l, intact) { return 2 + Math.floor(l / 3) + (intact ? 1 : 0) + (type === 'rkn' ? 1 : 0); },
		penalty: function (l) { return raid.heads > 0 ? Math.max(1, Math.round(raid.heads * Math.min(.35, .2 + l * .01))) : 0; },
		dmgCost: function (n) { return Math.round(3 * Math.pow(1.45, n)); },
		repairCost: function () { return Math.ceil((300 - raid.hp.t0 - raid.hp.t1 - raid.hp.r) / 60); },
		switchCost: 6
	};

	var IMG = {}, WAIT = {};

	function img(name) {
		if (IMG[name])
			return IMG[name];
		if (!WAIT[name])
			WAIT[name] = fetch(DIR + name + '.webp' + VQ, { credentials: 'same-origin' }).then(function (r) {
				if (!r.ok)
					throw new Error(String(r.status));
				return r.blob();
			}).then(function (b) {
				return new Promise(function (res, rej) {
					var im = new Image();
					im.onload = function () {
						IMG[name] = im;
						res(im);
					};
					im.onerror = rej;
					im.src = URL.createObjectURL(new Blob([ b ], { type: 'image/webp' }));
				});
			}).catch(function () {
				g.setTimeout(function () { delete WAIT[name]; }, 15000);
				return null;
			});
		return null;
	}

	function need(names) {
		names.forEach(img);
		return Promise.all(names.map(function (n) { return WAIT[n]; }));
	}

	function accent() {
		var v = g.getComputedStyle(D.documentElement).getPropertyValue('--k-acc').trim().split(/\s+/).map(Number);
		return v.length === 3 && v.every(function (n) { return n >= 0; }) ? v : [ 63, 224, 161 ];
	}

	var TINT = {};

	function sprite(name, key, variant) {
		var im = IMG[name] || img(name), r = FR[name] && FR[name][key];
		if (!im || !r)
			return null;
		if (!variant)
			return { src: im, x: r[0], y: r[1], w: r[2], h: r[3] };
		var a = variant === 'mono' ? accent() : null, id = name + ':' + key + ':' + variant + (a ? a.join(',') : '');
		if (TINT[id])
			return TINT[id];
		if (Object.keys(TINT).length > 60)
			TINT = {};
		var cv = D.createElement('canvas'), c = cv.getContext('2d', { willReadFrequently: true });
		cv.width = r[2];
		cv.height = r[3];
		c.drawImage(im, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
		var d = c.getImageData(0, 0, r[2], r[3]), p = d.data, i, l;
		for (i = 0; i < p.length; i += 4) {
			if (!p[i + 3])
				continue;
			l = (p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11) / 255;
			if (variant === 'mono') {
				var lo = a.map(function (v) { return v * .22; }), hi = a.map(function (v) { return v + (255 - v) * .55; });
				p[i] = lo[0] + (hi[0] - lo[0]) * l;
				p[i + 1] = lo[1] + (hi[1] - lo[1]) * l;
				p[i + 2] = lo[2] + (hi[2] - lo[2]) * l;
			}
			else if (variant === 'kumys') {
				if (l > .45) {
					p[i] = Math.min(255, p[i] * .78 + 66);
					p[i + 1] = Math.min(255, p[i + 1] * .74 + 58);
					p[i + 2] = Math.min(255, p[i + 2] * .55 + 28);
				}
				else {
					p[i] = p[i] * .9 + 22;
					p[i + 1] = p[i + 1] * .8 + 8;
					p[i + 2] = p[i + 2] * .5;
				}
			}
			else if (variant === 'hit') {
				p[i] = p[i] + (255 - p[i]) * .65;
				p[i + 1] = p[i + 1] + (255 - p[i + 1]) * .65;
				p[i + 2] = p[i + 2] + (255 - p[i + 2]) * .65;
			}
		}
		c.putImageData(d, 0, 0);
		return (TINT[id] = { src: cv, x: 0, y: 0, w: r[2], h: r[3] });
	}

	function blit(c, s, x, y, h, flip, alpha) {
		if (!s)
			return;
		var w = s.w * h / s.h;
		c.save();
		if (alpha !== undefined)
			c.globalAlpha *= alpha;
		c.translate(x, y);
		if (flip)
			c.scale(-1, 1);
		c.drawImage(s.src, s.x, s.y, s.w, s.h, -w / 2, -h, w, h);
		c.restore();
	}

	var RIG = {};

	function rig(id) {
		if (RIG[id])
			return RIG[id];
		var im = IMG['hero-' + id], m = ART.heroes[id];
		if (!im || !m)
			return null;
		var o = { m: m, im: im, w: m.w, h: m.h, body: im, head: null };
		if (m.head) {
			var hb = m.head, body = D.createElement('canvas'), bc = body.getContext('2d'), head = D.createElement('canvas'), hc = head.getContext('2d');
			body.width = head.width = m.w;
			body.height = head.height = m.h;
			bc.drawImage(im, 0, 0);
			bc.save();
			bc.globalCompositeOperation = 'destination-out';
			bc.beginPath();
			bc.ellipse(hb[0] + hb[2] / 2, hb[1] + hb[3] * .46, hb[2] * .4, hb[3] * .4, 0, 0, TAU);
			bc.fill();
			bc.restore();
			hc.save();
			hc.beginPath();
			hc.ellipse(hb[0] + hb[2] / 2, hb[1] + hb[3] / 2, hb[2] * .56, hb[3] * .56, 0, 0, TAU);
			hc.clip();
			hc.drawImage(im, 0, 0);
			hc.restore();
			o.body = body;
			o.head = head;
		}
		if (m.brows) {
			var t = D.createElement('canvas').getContext('2d', { willReadFrequently: true });
			t.canvas.width = m.w;
			t.canvas.height = m.h;
			t.drawImage(im, 0, 0);
			o.skin = m.brows.map(function (b) {
				var d = t.getImageData(Math.round(b[0] + b[2] / 2), Math.round(b[1] + b[3] + 6), 1, 1).data;
				return 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
			});
		}
		return (RIG[id] = o);
	}

	function lerp(a, b, k) {
		return a + (b - a) * k;
	}

	function mixPose(a, b, k) {
		var o = {};
		[ 'tilt', 'lean', 'bounce', 'brows', 'glint' ].forEach(function (n) { o[n] = lerp(a[n] || 0, b[n] || 0, k); });
		o.mouth = [ lerp((a.mouth || [ 1, 1 ])[0], (b.mouth || [ 1, 1 ])[0], k), lerp((a.mouth || [ 1, 1 ])[1], (b.mouth || [ 1, 1 ])[1], k) ];
		o.look = [ lerp((a.look || [ 0, 0 ])[0], (b.look || [ 0, 0 ])[0], k), lerp((a.look || [ 0, 0 ])[1], (b.look || [ 0, 0 ])[1], k) ];
		o.eyes = k < .5 ? a.eyes : b.eyes;
		o.expr = k < .5 ? a.expr : b.expr;
		return o;
	}

	function lids(c, m, pose, blink) {
		var mode = blink ? 'blink' : pose.eyes;
		if (!m.eyes || !m.lid || !mode || mode === 'open')
			return;
		m.eyes.forEach(function (e, i) {
			var cover = mode === 'blink' ? 1 : mode === 'squint' ? .55 : mode === 'wink' ? (i === m.eyes.length - 1 ? 1 : 0) : 0;
			if (mode === 'wide') {
				c.drawImage(c.__src, e[0] - e[2] * 1.4, e[1] - e[3] * 1.4, e[2] * 2.8, e[3] * 2.8, e[0] - e[2] * 1.75, e[1] - e[3] * 1.75, e[2] * 3.5, e[3] * 3.5);
				return;
			}
			if (!cover)
				return;
			c.save();
			c.beginPath();
			c.ellipse(e[0], e[1], e[2] * 1.35, e[3] * 1.35, 0, 0, TAU);
			c.clip();
			c.fillStyle = m.lid;
			c.fillRect(e[0] - e[2] * 1.5, e[1] - e[3] * 1.5, e[2] * 3, e[3] * 2.7 * cover + e[3] * .05);
			c.strokeStyle = 'rgba(20,14,12,.85)';
			c.lineWidth = Math.max(1, e[3] * .22);
			c.beginPath();
			c.moveTo(e[0] - e[2] * 1.3, e[1] - e[3] * 1.4 + e[3] * 2.7 * cover);
			c.quadraticCurveTo(e[0], e[1] - e[3] * 1.15 + e[3] * 2.7 * cover, e[0] + e[2] * 1.3, e[1] - e[3] * 1.4 + e[3] * 2.7 * cover);
			c.stroke();
			c.restore();
		});
	}

	function face(c, o, pose, t, talk, blink) {
		var m = o.m;
		c.__src = o.im;
		if (m.mouth) {
			var mo = m.mouth, sx = pose.mouth[0], sy = pose.mouth[1] + (talk ? .32 * Math.abs(Math.sin(t * 15)) : 0);
			if (sx > 1.005 || sy > 1.005) {
				var w = mo[2] * 2.3, h = mo[3] * 3.2;
				c.drawImage(o.im, mo[0] - w / 2, mo[1] - h / 2, w, h, mo[0] - w * sx / 2, mo[1] - h * .45 * sy, w * sx, h * sy);
			}
		}
		lids(c, m, pose, blink);
		if (m.pupils)
			m.pupils.forEach(function (p, i) {
				var e = m.eyes[i] || m.eyes[0], dx = pose.look[0] * e[2] * .45, dy = pose.look[1] * e[3] * .4;
				c.fillStyle = m.white;
				c.beginPath();
				c.arc(p[0], p[1], p[2] * 1.25, 0, TAU);
				c.fill();
				c.fillStyle = '#141414';
				c.beginPath();
				c.arc(p[0] + dx, p[1] + dy, p[2], 0, TAU);
				c.fill();
				c.fillStyle = 'rgba(255,255,255,.9)';
				c.beginPath();
				c.arc(p[0] + dx - p[2] * .35, p[1] + dy - p[2] * .35, p[2] * .3, 0, TAU);
				c.fill();
				if (blink) {
					c.fillStyle = o.skin ? o.skin[0] : '#7fc63c';
					c.beginPath();
					c.ellipse(e[0], e[1], e[2] * 1.05, e[3] * 1.05, 0, 0, TAU);
					c.fill();
				}
			});
		if (m.brows && o.skin) {
			var lift = (pose.brows || 0) * 5, rot = pose.brows < 0 ? pose.brows * .22 : 0;
			m.brows.forEach(function (b, i) {
				c.fillStyle = o.skin[i];
				c.beginPath();
				c.ellipse(b[0] + b[2] / 2, b[1] + b[3] / 2, b[2] * .62, b[3] * .75, 0, 0, TAU);
				c.fill();
				c.save();
				c.translate(b[0] + b[2] / 2, b[1] + b[3] / 2 - lift);
				c.rotate(i ? -rot : rot);
				c.drawImage(o.im, b[0], b[1], b[2], b[3], -b[2] / 2, -b[3] / 2, b[2], b[3]);
				c.restore();
			});
		}
		if (m.glasses && pose.glint > .2) {
			var gl = m.glasses, k = (t * .7) % 1.8;
			c.save();
			c.beginPath();
			c.rect(gl[0], gl[1], gl[2], gl[3]);
			c.clip();
			var x = gl[0] - gl[2] * .3 + k * gl[2], gr = c.createLinearGradient(x - 18, gl[1], x + 18, gl[1] + gl[3]);
			gr.addColorStop(0, 'rgba(255,255,255,0)');
			gr.addColorStop(.5, 'rgba(255,255,255,' + (.55 * pose.glint) + ')');
			gr.addColorStop(1, 'rgba(255,255,255,0)');
			c.fillStyle = gr;
			c.fillRect(gl[0], gl[1], gl[2], gl[3]);
			c.restore();
		}
	}

	function drawHero(c, id, cw, ch, pose, t, talk, blink) {
		if (id === 'fox') {
			var fox = IMG['hero-fox'];
			if (!fox)
				return;
			var A = ART.heroes.fox, b = A.atlas.body, hd = A.atlas['h' + (pose.expr || 0)], sc = Math.min(cw / 300, ch / 300) * .98;
			c.save();
			c.translate(cw / 2, ch - 4 - (pose.bounce || 0) * 4 * Math.abs(Math.sin(t * 6)));
			c.scale(sc, sc);
			c.rotate((pose.lean || 0) * Math.PI / 180);
			c.drawImage(fox, b[0], b[1], b[2], b[3], -b[2] / 2, -b[3], b[2], b[3]);
			c.translate(A.chin[0] - b[2] / 2, A.chin[1] - b[3]);
			c.rotate((pose.tilt || 0) * Math.PI / 180 + Math.sin(t * 1.7) * .02);
			c.drawImage(fox, hd[0], hd[1], hd[2], hd[3], -hd[2] / 2, -hd[3] + 8, hd[2], hd[3]);
			c.restore();
			return;
		}
		var o = rig(id);
		if (!o)
			return;
		var m = o.m, k = Math.min(cw / o.w, ch / o.h) * .98, bob = Math.sin(t * 2.2) * 1.2 + (pose.bounce || 0) * 5 * Math.abs(Math.sin(t * 5.5));
		c.save();
		c.translate(cw / 2, ch - 2);
		c.scale(k, k);
		c.translate(0, -bob);
		c.rotate(((pose.lean || 0) + (o.head ? 0 : (pose.tilt || 0))) * Math.PI / 180);
		c.translate(-o.w / 2, -o.h);
		c.drawImage(o.body, 0, 0);
		if (o.head) {
			c.save();
			c.translate(m.neck[0], m.neck[1]);
			c.rotate((pose.tilt || 0) * Math.PI / 180 + Math.sin(t * 1.6) * .015);
			c.translate(-m.neck[0], -m.neck[1]);
			c.drawImage(o.head, 0, 0);
			face(c, { m: m, im: o.head, skin: o.skin }, pose, t, talk, blink);
			c.restore();
		}
		else
			face(c, o, pose, t, talk, blink);
		c.restore();
	}

	var CSS = ".kadr-dlg{position:fixed;left:0;right:0;bottom:0;z-index:980;display:flex;justify-content:center;padding:0 16px max(16px,env(safe-area-inset-bottom));pointer-events:none}\n.kadr-dlg.k-top{top:76px;bottom:auto;padding-bottom:0}\n.kadr-dlg.k-top.k-under{top:calc(84px + var(--kadr-hud-h,92px))}\n.kadr-dlg.k-under .kadr-dlg-card{width:min(520px,100%);pointer-events:none}\n.kadr-dlg.k-under .kadr-dlg-hero{width:120px;height:136px}\n.kadr-dlg.k-under .kadr-dlg-next{pointer-events:auto}\n.kadr-dlg.k-under .kadr-dlg-text{min-height:0}\n.kadr-dlg button,.kadr-shop button,.kadr-vpn button{word-break:normal;overflow-wrap:normal}\n@media (min-width:601px){.kadr-dlg.k-modal .kadr-dlg-card{width:min(760px,100%)}.kadr-dlg.k-modal .kadr-dlg-hero{width:290px;height:320px}}\n.kadr-dlg.k-modal{top:0;align-items:flex-end;pointer-events:auto}\n.kadr-dlg-back{position:absolute;inset:0;background:rgb(0 0 0/.55) center/cover no-repeat;opacity:0;transition:opacity .25s}\n.kadr-dlg-back::after{content:\"\";position:absolute;inset:0;background:linear-gradient(to top,rgb(var(--k-bg)/.96) 8%,rgb(var(--k-bg)/.35))}\n.kadr-dlg.k-on .kadr-dlg-back{opacity:1}\n.kadr-dlg.k-out .kadr-dlg-back{opacity:0}\n.kadr-dlg-card{position:relative;display:flex;align-items:flex-end;gap:6px;width:min(660px,100%);pointer-events:auto;opacity:0;transform:translateY(16px);transition:opacity .2s,transform .35s var(--k-spring)}\n.kadr-dlg.k-on .kadr-dlg-card{opacity:1;transform:none}\n.kadr-dlg.k-out .kadr-dlg-card{opacity:0;transform:translateY(10px)}\n.kadr-dlg-hero{flex:none;width:210px;height:236px;margin-bottom:-2px;filter:drop-shadow(0 10px 18px rgb(0 0 0/.35))}\n.kadr-dlg-box{flex:1;min-width:0;margin-bottom:10px;padding:14px 16px 12px;border-radius:20px;background:rgb(var(--k-s1));box-shadow:var(--k-pop);color:rgb(var(--k-tx));cursor:pointer}\n.kadr-dlg-name{margin-bottom:4px;color:rgb(var(--k-acc));font-size:14px;font-weight:800}\n.kadr-dlg-name i{color:rgb(var(--k-mut));font-style:normal;font-weight:600}\n.kadr-dlg-text{min-height:4.35em;font-size:15px;line-height:1.45}\n.kadr-dlg-acts{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:10px}\n.kadr-dlg-next,.kadr-dlg-skip{height:34px;padding:0 16px;border:0;border-radius:11px;background:rgb(var(--k-acc));color:rgb(var(--k-ink));font:inherit;font-size:13px;font-weight:700;cursor:pointer}\n.kadr-dlg-skip{background:rgb(var(--k-ov)/.08);color:rgb(var(--k-tx))}\n.kadr-dlg-choice{display:grid;align-content:start;gap:3px;flex:1 1 210px;padding:10px 12px;border:0;border-radius:14px;background:rgb(var(--k-ov)/.06);box-shadow:var(--k-line);color:rgb(var(--k-tx));font:inherit;text-align:left;cursor:pointer;transition:transform .3s var(--k-spring)}\n.kadr-dlg-choice:active{transform:scale(.97)}\n.kadr-dlg-choice.primary{background:rgb(var(--k-acc)/.15);box-shadow:inset 0 0 0 1.5px rgb(var(--k-acc))}\n.kadr-dlg-choice strong{font-size:14px}\n.kadr-dlg-choice small{color:rgb(var(--k-tx2));font-size:12px;line-height:1.35}\n.kadr-raid-hud{position:fixed;top:76px;left:50%;z-index:760;width:min(430px,calc(100vw - 32px));padding:8px 12px 10px;border-radius:16px;background:rgb(var(--k-s1)/.94);box-shadow:var(--k-pop);color:rgb(var(--k-tx));opacity:0;transform:translate(-50%,-12px);transition:opacity .25s,transform .35s var(--k-spring);pointer-events:none}\n.kadr-raid-hud.k-on{opacity:1;transform:translate(-50%,0)}\n.kadr-raid-row{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800}\n.kadr-raid-lvl{flex:1;color:rgb(var(--k-mut));font-size:12px;font-weight:600}\n.kadr-raid-mute{width:28px;height:28px;border:0;border-radius:9px;background:rgb(var(--k-ov)/.08);color:rgb(var(--k-tx));cursor:pointer;pointer-events:auto;position:relative}\n.kadr-raid-mute::before{content:\"\";position:absolute;inset:6px;background:currentColor;-webkit-mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9v6h4l5 4V5L8 9Z'/%3E%3Cpath d='M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12'/%3E%3C/svg%3E\") center/contain no-repeat;mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9v6h4l5 4V5L8 9Z'/%3E%3Cpath d='M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12'/%3E%3C/svg%3E\") center/contain no-repeat}\n.kadr-raid-mute.k-off::before{-webkit-mask-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9v6h4l5 4V5L8 9Z'/%3E%3Cpath d='m16 9 5 6M21 9l-5 6'/%3E%3C/svg%3E\");mask-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9v6h4l5 4V5L8 9Z'/%3E%3Cpath d='m16 9 5 6M21 9l-5 6'/%3E%3C/svg%3E\")}\n.kadr-raid-bar{position:relative;height:13px;margin-top:6px;border-radius:7px;background:rgb(var(--k-ov)/.1);overflow:hidden}\n.kadr-raid-bar i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#d8312b,#ff8a3a);transition:width .15s}\n.kadr-raid-bar b{position:relative;display:block;color:#fff;font-size:10px;font-weight:800;line-height:13px;text-align:center;text-shadow:0 1px 2px rgb(0 0 0/.6)}\n.kadr-raid-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}\n.kadr-raid-chips:empty{display:none}\n.kadr-raid-chips span{padding:3px 8px;border-radius:8px;background:rgb(var(--k-ov)/.08);font-size:11.5px;font-weight:700}\n.kadr-raid-chips .cut{background:#d8312b;color:#fff}\n.kadr-raid-chips .shield{background:#2a6fb8;color:#fff}\n.kadr-raid-chips .inv,.kadr-raid-chips .hits{background:#efe0b4;color:#3a2a10}\n.kadr-raid-chips .lock{background:#7a3ab8;color:#fff}\n.kadr-vpn{position:fixed;inset:0;z-index:990;display:grid;place-items:center;padding:20px;background:rgb(0 0 0/.35)}\n.kadr-vpn-card{width:min(370px,100%);overflow:hidden;border-radius:6px;background:#f4f4f2;color:#1a1a1a;box-shadow:0 22px 60px rgb(0 0 0/.5);font:14px/1.45 Arial,Helvetica,sans-serif;animation:kadr-vpn-in .25s ease}\n.kadr-vpn-head{padding:10px 14px;background:#0f3b7a;color:#fff;font-weight:900;letter-spacing:.08em}\n.kadr-vpn-card p{margin:14px;color:#2a2a2a;font:14px/1.45 Arial,Helvetica,sans-serif}\n.kadr-vpn-btn{display:block;height:32px;margin:0 14px 14px auto;padding:0 16px;border:1px solid #888;border-radius:3px;background:#e2e2e2;color:#1a1a1a;font:13px Arial,Helvetica,sans-serif;cursor:pointer}\n.kadr-vpn-btn[disabled]{opacity:.5;cursor:default}\n@keyframes kadr-vpn-in{from{opacity:0;transform:scale(.92)}}\nhtml.kadr-mud #maincontent{filter:blur(2.6px) saturate(1.5) hue-rotate(18deg);animation:kadr-mud 2.2s ease-in-out infinite;transition:filter .4s}\nhtml.kadr-mud header{filter:blur(2px) saturate(1.4)}\n@keyframes kadr-mud{0%,100%{transform:none}50%{transform:translate(2px,-2px) rotate(.25deg)}}\n.kadr-raid-btn.k-ready::after{content:\"\";position:absolute;top:7px;right:7px;width:8px;height:8px;border-radius:50%;background:#ff5a3a;box-shadow:0 0 0 2px rgb(var(--k-s1));animation:kadr-ready 1.4s ease-in-out infinite}\n@keyframes kadr-ready{50%{transform:scale(1.35)}}\n.kadr-shop-open .kadr-raid-btn{background:rgb(var(--k-ov)/.08);color:rgb(var(--k-tx))}\n.kadr-raid-scrim{position:fixed;inset:0;z-index:940;visibility:hidden;opacity:0;background:transparent;transition:opacity .25s,visibility 0s .25s}\n.kadr-shop-open .kadr-raid-scrim{visibility:visible;opacity:1;transition:opacity .25s,visibility 0s}\n.kadr-shop{top:78px;right:max(16px,calc((100vw - var(--k-wide))/2 + 16px));width:400px;max-width:calc(100vw - 32px);max-height:calc(100vh - 100px);overflow-y:auto;visibility:hidden;opacity:0;transform:translateY(-8px) scale(.97);transform-origin:top right;transition:opacity .2s ease,transform .35s var(--k-spring),visibility 0s .35s}\n.kadr-shop-open .kadr-shop{visibility:visible;opacity:1;transform:none;transition:opacity .2s ease,transform .35s var(--k-spring),visibility 0s}\n.kadr-shop.k-busy .kadr-shop-body button{pointer-events:none;opacity:.6;transition:opacity .15s}\n.kadr-shop-hero{display:flex;align-items:flex-end;gap:10px;margin:4px 0 12px}\n.kadr-shop-cv{flex:none;width:112px;height:124px}\n.kadr-shop-say{flex:1;margin-bottom:12px;padding:10px 12px;border-radius:14px 14px 14px 4px;background:rgb(var(--k-ov)/.06);box-shadow:var(--k-line);font-size:13px;line-height:1.4}\n.kadr-shop-say b{display:block;margin-bottom:2px;color:rgb(var(--k-acc));font-size:12.5px}\n.kadr-shop-say i{color:rgb(var(--k-mut));font-style:normal}\n.kadr-shop-wallet{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:10px 12px;border-radius:15px;background:rgb(var(--k-acc)/.1)}\n.kadr-shop-wallet strong{font-size:24px;font-weight:800;line-height:1}\n.kadr-shop-wallet small{color:rgb(var(--k-tx2));font-size:13px;font-weight:600}\n.kadr-shop-coin{width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f6eef0,#cdb6bf 55%,#7d5b69 80%),#cdb6bf;box-shadow:inset 0 -7px 0 -2px #2a1530}\n.kadr-shop-state{flex-basis:100%;color:rgb(var(--k-mut));font-size:12.5px;font-weight:500}\n.kadr-shop-row>span{display:grid;gap:2px}\n.kadr-shop-hp{display:grid;gap:4px;margin-top:6px}\n.kadr-shop-hpi{display:grid;grid-template-columns:70px 1fr 38px;align-items:center;gap:8px;font-size:12px;font-weight:600}\n.kadr-shop-hpi em{color:rgb(var(--k-tx2));font-style:normal}\n.kadr-shop-hpi b{text-align:right}\n.kadr-shop-hpb{height:6px;overflow:hidden;border-radius:3px;background:rgb(var(--k-ov)/.1)}\n.kadr-shop-hpb i{display:block;height:100%}\n.kadr-shop-hpb .ok{background:#5bd36b}\n.kadr-shop-hpb .mid{background:#f2c14e}\n.kadr-shop-hpb .low{background:#f0544a}\n.kadr-shop-skins{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}\n.kadr-shop-skin{display:grid;justify-items:center;gap:4px;padding:10px 6px;border:0;border-radius:14px;background:rgb(var(--k-ov)/.045);box-shadow:var(--k-line);color:rgb(var(--k-tx));font:inherit;cursor:pointer;transition:transform .3s var(--k-spring)}\n.kadr-shop-skin:active{transform:scale(.95)}\n.kadr-shop-skin.k-on{background:rgb(var(--k-acc)/.1);box-shadow:inset 0 0 0 1.5px rgb(var(--k-acc))}\n.kadr-shop-skin strong{font-size:12.5px;text-align:center}\n.kadr-shop-skin small{color:rgb(var(--k-mut));font-size:11.5px}\n.kadr-shop-sw{width:44px;height:36px;border-radius:10px;box-shadow:inset 0 0 0 1px rgb(0 0 0/.25)}\n.sw-tower-brick{background:repeating-linear-gradient(0deg,#b8562f 0 6px,#d8c8b2 6px 7px)}\n.sw-tower-concrete{background:repeating-linear-gradient(0deg,#8f969b 0 6px,#3fe6c0 6px 7px)}\n.sw-tower-gold{background:repeating-linear-gradient(0deg,#d9a43a 0 6px,#fff1b8 6px 7px)}\n.sw-gun-steel{background:linear-gradient(#c3cdd4,#434c55)}\n.sw-gun-plasma{background:radial-gradient(circle at 70% 50%,#bff4ff 0 4px,transparent 6px),linear-gradient(#4a5a7a,#263048)}\n.sw-gun-rocket{background:radial-gradient(circle at 75% 50%,#d8442e 0 5px,transparent 6px),linear-gradient(#a07050,#3a2418)}\n.sw-shot-bolt{background:linear-gradient(100deg,transparent 30%,#ffd76a 30% 70%,#fff 70% 74%,transparent 74%),#1c1f24}\n.sw-shot-noodle{background:radial-gradient(circle at 50% 100%,transparent 6px,#f2cf6a 6px 8px,transparent 8px) 0 0/12px 10px,#5a2a12}\n.sw-shot-plasma{background:radial-gradient(circle,#ffffff 0 4px,#7fe8ff 5px 9px,transparent 12px),#152030}\n.sw-shot-rocket{background:linear-gradient(90deg,#ffaa3c 0 22%,#d9d9d9 22% 78%,#d8442e 78%),#1c1f24}\n.sw-router-brick{background:linear-gradient(#b6513f,#7a2e22)}\n.sw-router-rollton{background:linear-gradient(90deg,#d6261c,#f5b51e 50%,#d6261c)}\n@media screen and (max-width:920px){.kadr-shop{top:auto;left:0;right:0;bottom:0;width:auto;max-width:none;max-height:86vh;padding:10px 16px max(18px,env(safe-area-inset-bottom));border-radius:24px 24px 0 0;box-shadow:var(--k-sheet);opacity:1;transform:translateY(105%);transform-origin:center bottom;transition:transform .45s var(--k-soft),visibility 0s .45s}.kadr-shop-open .kadr-shop{transform:none;transition:transform .45s var(--k-spring),visibility 0s}.kadr-shop .kadr-grip{display:block}.kadr-raid-scrim{background:var(--k-scrim)}}\n@media (max-width:600px){.kadr-dlg-hero{width:116px;height:138px}.kadr-dlg-box{padding:12px 14px 10px}.kadr-dlg-text{font-size:14px}.kadr-dlg-choice{flex-basis:100%}.kadr-dlg.k-top{top:70px}.kadr-dlg.k-top.k-under{top:calc(78px + var(--kadr-hud-h,92px))}.kadr-dlg.k-under .kadr-dlg-hero{width:96px;height:112px}.kadr-raid-hud{top:70px}}";

	(function () {
		if (D.getElementById('kadr-raid-css'))
			return;
		var st = D.createElement('style');
		st.id = 'kadr-raid-css';
		st.textContent = CSS;
		(D.head || D.documentElement).appendChild(st);
	})();

	var dlg = null, dlgQueue = [], poseIdx = {};

	function chunks(text) {
		var out = [], s = String(text).trim();
		while (s.length > 150) {
			var cut = s.lastIndexOf('. ', 150);
			if (cut < 60)
				cut = s.lastIndexOf(', ', 150);
			if (cut < 60)
				cut = s.lastIndexOf(' ', 150);
			out.push(s.slice(0, cut + 1).trim());
			s = s.slice(cut + 1).trim();
		}
		if (s)
			out.push(s);
		return out;
	}

	function nextPose(id, want) {
		var list = POSES[id] || [ {} ];
		if (want !== undefined)
			return list[want % list.length];
		poseIdx[id] = ((poseIdx[id] === undefined ? -1 : poseIdx[id]) + 1) % list.length;
		return list[poseIdx[id]];
	}

	function say(hero, lines, opt) {
		opt = opt || {};
		var steps = [];
		lines.forEach(function (l) {
			var o = typeof l === 'string' ? { t: l } : l, parts = chunks(o.t);
			parts.forEach(function (t, i) {
				steps.push({ t: t, hero: o.hero || hero, pose: i ? undefined : o.pose, choices: i === parts.length - 1 ? o.choices : null });
			});
		});
		return new Promise(function (resolve) {
			if (dlg)
				dlgQueue.push([ steps, opt, resolve ]);
			else
				openDlg(steps, opt, resolve);
		});
	}

	function openDlg(steps, opt, resolve) {
		dlg = { pending: true };
		var heroes = steps.map(function (s) { return s.hero === 'fox' ? 'hero-fox' : 'hero-' + s.hero; }).concat(opt.hq ? [ 'hq' ] : []);
		need(heroes.filter(function (v, i, a) { return a.indexOf(v) === i; })).then(function () { buildDlg(steps, opt, resolve); });
	}

	function buildDlg(steps, opt, resolve) {
		var cv = E('canvas', 'kadr-dlg-hero'), name = E('div', 'kadr-dlg-name'), text = E('div', 'kadr-dlg-text'), acts = E('div', 'kadr-dlg-acts');
		var card = E('div', 'kadr-dlg-card', [ cv, E('div', 'kadr-dlg-box', [ name, text, acts ]) ], { role: 'dialog', 'aria-live': 'polite' });
		var root = E('div', 'kadr-dlg' + (opt.modal ? ' k-modal' : '') + (opt.top ? ' k-top' : '') + (opt.top && hud ? ' k-under' : ''), [ opt.modal ? E('div', 'kadr-dlg-back') : null, card ]);
		if (opt.hq && IMG.hq)
			root.firstChild.style.backgroundImage = 'url("' + IMG.hq.src + '")';
		D.body.appendChild(root);
		var st = { root: root, cv: cv, steps: steps, i: -1, opt: opt, resolve: resolve, from: {}, to: {}, mixT: 1, shown: 0, full: '', t0: g.performance.now(), blinkAt: 0, blinkEnd: 0, raf: 0, auto: 0 };
		dlg = st;
		var finish = function (value) {
			g.cancelAnimationFrame(st.raf);
			g.clearTimeout(st.auto);
			D.removeEventListener('keydown', onKey, true);
			root.classList.add('k-out');
			g.setTimeout(function () { root.remove(); }, 220);
			dlg = null;
			resolve(value);
			var q = dlgQueue.shift();
			if (q)
				openDlg(q[0], q[1], q[2]);
		};
		var advance = function () {
			if (st.shown < st.full.length) {
				st.shown = st.full.length;
				return;
			}
			if (st.steps[st.i] && st.steps[st.i].choices)
				return;
			show(st.i + 1);
		};
		var show = function (i) {
			if (i >= st.steps.length)
				return finish(undefined);
			var s = st.steps[i], who = WHO[s.hero] || [ s.hero, '' ];
			st.i = i;
			st.full = s.t;
			st.shown = 0;
			st.from = st.cur || {};
			st.to = s.pose !== undefined ? (typeof s.pose === 'number' ? nextPose(s.hero, s.pose) : s.pose) : nextPose(s.hero);
			st.mixT = 0;
			st.hero = s.hero;
			name.textContent = who[0];
			if (who[1])
				name.appendChild(E('i', null, [ ' (' + who[1] + ')' ]));
			text.textContent = '';
			acts.textContent = '';
			if (s.choices) {
				s.choices.forEach(function (ch) {
					var b = E('button', 'kadr-dlg-choice' + (ch.primary ? ' primary' : ''), [ E('strong', null, [ ch.label ]), ch.sub ? E('small', null, [ ch.sub ]) : null ], { type: 'button' });
					b.addEventListener('click', function (ev) {
						ev.stopPropagation();
						finish(ch.value);
					});
					acts.appendChild(b);
				});
				if (opt.cancel) {
					var c = E('button', 'kadr-dlg-skip', [ 'Не сейчас' ], { type: 'button' });
					c.addEventListener('click', function (ev) {
						ev.stopPropagation();
						finish(null);
					});
					acts.appendChild(c);
				}
			}
			else {
				var nb = E('button', 'kadr-dlg-next', [ i === st.steps.length - 1 ? 'Понятно' : 'Дальше' ], { type: 'button' });
				nb.addEventListener('click', function (ev) {
					ev.stopPropagation();
					advance();
				});
				acts.appendChild(nb);
			}
			g.clearTimeout(st.auto);
			if (opt.auto && !s.choices)
				st.auto = g.setTimeout(function () {
					if (dlg === st && st.i === i)
						show(i + 1);
				}, opt.auto + s.t.length * 45);
		};
		var onKey = function (ev) {
			if (dlg !== st)
				return;
			if ((ev.key === 'Enter' || ev.key === ' ') && !(st.steps[st.i] || {}).choices) {
				ev.preventDefault();
				advance();
			}
			else if (ev.key === 'Escape' && opt.cancel) {
				ev.preventDefault();
				finish(null);
			}
		};
		D.addEventListener('keydown', onKey, true);
		card.addEventListener('click', function (ev) {
			if (ev.target.closest('button'))
				return;
			ev.stopPropagation();
			advance();
		});
		var dpr = Math.min(2, g.devicePixelRatio || 1), cx = cv.getContext('2d');
		var loop = function (ts) {
			st.raf = g.requestAnimationFrame(loop);
			var w = cv.clientWidth, h = cv.clientHeight, t = (ts - st.t0) / 1000;
			if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
				cv.width = Math.round(w * dpr);
				cv.height = Math.round(h * dpr);
			}
			if (st.shown < st.full.length) {
				st.shown = Math.min(st.full.length, st.shown + 1.2);
				text.textContent = st.full.slice(0, Math.floor(st.shown));
			}
			st.mixT = Math.min(1, st.mixT + .07);
			var k = 1 - Math.pow(1 - st.mixT, 3);
			st.cur = mixPose(st.from, st.to, k);
			if (ts > st.blinkAt) {
				st.blinkEnd = ts + 130;
				st.blinkAt = ts + rand(2200, 5200);
			}
			cx.setTransform(dpr, 0, 0, dpr, 0, 0);
			cx.clearRect(0, 0, w, h);
			drawHero(cx, st.hero, w, h, st.cur, t, st.shown < st.full.length, ts < st.blinkEnd);
		};
		st.raf = g.requestAnimationFrame(loop);
		show(0);
		g.requestAnimationFrame(function () { root.classList.add('k-on'); });
	}

	function hint(key, hero, lines, opt) {
		if (raid.seen[key])
			return Promise.resolve();
		raid.seen[key] = true;
		save(true);
		return say(hero, lines, opt);
	}

	function choose(pre) {
		return need([ 'hero-ilkin', 'hq' ]).then(function () {
			if (pre === 'hard')
				return say('ilkin', [
					'Хардкор — режим повышенного взаимодействия. Во время боёв будут временные неудобства: муть на экране, отключения связи, окна-предупреждения.',
					{ t: 'Зато рейд-боссы, магазин прокачки и головы боссов в копилку. Для полного погружения рекомендую.', choices: [ { label: 'Включить хардкор', value: 'hard', primary: true }, { label: 'Остаться на нормальной', value: 'normal' } ] }
				], { modal: true, hq: true, cancel: true });
			return say('ilkin', [
				'Здорово! Я Илькин, карась-маслач. Добро пожаловать в штаб Буффало.',
				'Жуки лезут из метавселенной, а мы держим оборону. Турели уже ждут стройки.',
				{ t: 'Выбирай сложность. Хардкор — режим повышенного взаимодействия: во время боёв будут временные неудобства. Для полного погружения рекомендую его.', choices: [
					{ label: 'Нормальная', sub: 'Остаются турели и жуки', value: 'normal' },
					{ label: 'Хардкор', sub: 'Добавляет рейд-боссов: они приходят фазой атаки и с небольшим шансом бьют турели, которые по ним стреляют', value: 'hard', primary: true }
				] }
			], { modal: true, hq: true, cancel: true }).then(function (v) {
				if (!v)
					return null;
				raid.seen.hello = true;
				save(true);
				return say('ilkin', [ v === 'hard' ? 'Вот это по-нашему! Магазин прокачки — кнопка штаба в шапке. Тимурчик там всё покажет.' : 'Принято. Заскучаешь — хардкор включается в панели, в строке «Сложность».' ], { modal: true, hq: true }).then(function () { return v; });
			});
		});
	}

	function offer() {
		if (raid.seen.hello || raid.seen.offer)
			return Promise.resolve(null);
		raid.seen.offer = true;
		save(true);
		return choose();
	}

	var AUD = null, audWait = null, muted = false, hud = null, vpn = null, liftAt = -1e9, lift = 0, progress = -1, look = 'color';

	try {
		muted = g.localStorage.getItem('kadr-luci-raid-mute') === '1';
	}
	catch (e) {}

	function active() {
		return !!(settings.bugVerse && settings.bugMode === 'hard');
	}

	function built() {
		return active() && progress >= 1;
	}

	var rpcQ = Promise.resolve(null);

	function rpc(args) {
		if (!g.L || typeof g.L.require !== 'function')
			return Promise.resolve(null);
		rpcQ = rpcQ.then(function () {
			return g.L.require('fs').then(function (fs) { return fs.exec('/usr/libexec/kadr-raid', args); }).catch(function () { return null; });
		});
		return rpcQ;
	}

	function music(on) {
		if (on && !muted) {
			if (!AUD && !audWait)
				audWait = fetch(DIR + 'boss.mp3' + VQ, { credentials: 'same-origin' }).then(function (r) { return r.blob(); }).then(function (b) {
					AUD = new Audio(URL.createObjectURL(new Blob([ b ], { type: 'audio/mpeg' })));
					AUD.loop = true;
					AUD.volume = 0;
					return AUD;
				}).catch(function () { audWait = null; return null; });
			(AUD ? Promise.resolve(AUD) : audWait).then(function (a) {
				if (!a || !F)
					return;
				var p = a.play();
				if (p && p.catch)
					p.catch(function () {});
				fade(a, .5);
			});
		}
		else if (AUD)
			fade(AUD, 0, function () { AUD.pause(); });
	}

	function fade(a, to, done) {
		g.clearInterval(a.__fade);
		a.__fade = g.setInterval(function () {
			var v = a.volume + (to > a.volume ? .05 : -.05);
			if ((to > a.volume && v >= to) || (to <= a.volume && v <= to)) {
				a.volume = to;
				g.clearInterval(a.__fade);
				if (done)
					done();
				return;
			}
			a.volume = clamp(v, 0, 1);
		}, 60);
	}

	function geo(w, L, heads) {
		var k = L[0].k, low = L[0].low;
		if (w.t - liftAt > 2) {
			liftAt = w.t;
			lift = 0;
			Array.prototype.forEach.call(D.querySelectorAll('.cbi-page-actions, .actions'), function (el) {
				var r = el.getBoundingClientRect();
				if (r.width > 0 && r.height > 0 && g.getComputedStyle(el).position === 'sticky')
					lift = Math.max(lift, r.height + 14);
			});
		}
		var r = low ? { x: w.W / 2, y: L[0].y + 30 * k } : { x: w.W / 2, y: w.H - 52 * k - lift };
		return { W: w.W, H: w.H, k: k, low: low, sites: L, heads: heads || [], router: r };
	}

	function hp(key) {
		return F ? F.s[key] : raid.hp[key];
	}

	function targetPos(G, key) {
		if (key === 'r')
			return { x: G.router.x, y: G.router.y - 14 * G.k };
		var i = +key.slice(1), h = G.heads[i], S = G.sites[i];
		return h ? { x: h.hx, y: (h.hy + S.y) / 2 } : { x: S.x, y: S.y - 40 * G.k };
	}

	function pickTarget() {
		var list = [];
		if (F.s.t0 > 0)
			list.push('t0', 't0');
		if (F.s.t1 > 0)
			list.push('t1', 't1');
		if (F.s.r > 0)
			list.push('r');
		return list.length ? list[Math.floor(Math.random() * list.length)] : null;
	}

	function damage(key, v, G, x, y) {
		if (!F || F.s[key] <= 0)
			return;
		F.s[key] = Math.max(0, F.s[key] - v);
		var p = targetPos(G, key);
		burst(x === undefined ? p.x : x, y === undefined ? p.y : y, 8, key === 'r' ? '#7fd3ff' : '#ffb24a', 140);
		if (F.s[key] <= 0)
			burst(p.x, p.y, 26, '#ff6a3a', 220);
	}

	function burst(x, y, n, col, sp) {
		for (var i = 0; i < n; i++) {
			var a = rand(0, TAU), v = rand(.3, 1) * sp;
			F.fx.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * .25, t: 0, life: rand(.35, .8), r: rand(1.2, 3), col: col, g: 380 });
		}
	}

	function blood(x, y, n) {
		for (var i = 0; i < n; i++) {
			var a = rand(0, TAU), v = rand(40, 170);
			F.fx.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, life: rand(.5, 1), r: rand(1.8, 4), col: '#f4f1ea', g: 420 });
		}
	}

	function bossBox(b) {
		return { x: b.x, y: b.y - b.h * .48, r: b.h * .44 };
	}

	function pick() {
		var list = [ 'anus', 'kumys', 'rkn' ];
		return list[Math.floor(Math.random() * list.length)];
	}

	function canFight() {
		return built() && !F && raid.next <= now() && !(raid.fight && raid.fight.id !== fid && now() - raid.fight.at < 6e5) && D.visibilityState === 'visible';
	}

	function begin(type, saved) {
		regen();
		type = type || (saved && saved.type) || pick();
		var lvl = saved ? saved.lvl : BAL.lvl(), max = saved ? saved.max : BAL.hp(type, lvl), gap = saved && isFinite(+saved.g) ? +saved.g : BAL.threat(lvl);
		F = {
			type: type, lvl: lvl, g: gap, max: max, hp: saved ? saved.hp : max, t: 0, start: saved ? saved.start : now(),
			s: saved ? saved.s : { t0: raid.hp.t0, t1: raid.hp.t1, r: raid.hp.r },
			boss: { x: 0, y: -999, h: 140, state: 'enter', st: 0, vx: 0, vy: 0, tx: 0, ty: 0, flip: false, hold: null, holdT: 0, hitT: 0, inv: 0, hits3: 0, shield: 0, wob: rand(0, 9) },
			tent: [], mins: [], swarm: [], fx: [], k: saved ? saved.k : 0, cut: 0, cutLen: 0, mud: 0, pause: false,
			atk: 2.5, phase: rand(18, 24), shieldT: rand(8, 12), dodge: rand(4, 7), retarget: 0, saveT: 0, drones: [ rand(0, TAU), rand(0, TAU) + Math.PI ]
		};
		raid.fight = { at: now(), id: fid };
		save(true);
		closeShop();
		hudOn();
		music(true);
		if (!saved)
			say('fox', [ 'Тревога! К ролтону ползёт ' + BOSS[type] + '!' ], { top: true, auto: 1600 });
		var key = type === 'rkn' ? 'boss-rkn' : 'boss-anus';
		need([ key, 'boss-minion' ]);
		if (type === 'anus' && !raid.seen.anus) {
			F.pause = true;
			hint('anus', 'wolf', [ 'Это Анус. Стреляет щупальцами из-за рта, кровь у него белая. Не спрашивай.', 'Тапай по щупальцам, пока они не долетели до турелей и ролтона. И по нему самому тапай.' ], { modal: true }).then(function () { if (F) F.pause = false; });
		}
		else if (type === 'kumys' && !raid.seen.kumys) {
			F.pause = true;
			hint('kumys', 'wolf', [ 'Кумысник — родня Ануса. Пьёт кумыс, и от этого мутит весь экран.', 'Когда хлебнёт — три секунды неуязвим и носится как бешеный. Потом попади по нему три раза, и он успокоится.' ], { modal: true }).then(function () { if (F) F.pause = false; });
		}
	}

	function finish(win) {
		var f = F, delta = 0;
		F = null;
		music(false);
		hudOff();
		mud(false);
		vpnOff();
		if (f.cut)
			rpc([ 'restore' ]);
		raid.hp = { t0: f.s.t0, t1: f.s.t1, r: f.s.r };
		raid.at = now();
		raid.next = now() + COOL;
		raid.fight = null;
		if (win) {
			delta = BAL.reward(f.type, f.lvl, f.s.t0 > 0 && f.s.t1 > 0 && f.s.r > 0);
			raid.heads += delta;
			raid.wins++;
		}
		else {
			delta = -BAL.penalty(f.lvl);
			raid.heads = Math.max(0, raid.heads + delta);
			raid.losses++;
		}
		var buff = win && raid.buff < 3 && Math.random() < .25;
		if (buff)
			raid.buff++;
		raid.last = { boss: f.type, win: win, heads: delta, at: now() };
		save(true);
		try {
			g.localStorage.removeItem(FKEY);
		}
		catch (e) {}
		say('fox', [ win ? BOSS[f.type] + ' лёг! +' + delta + ' ' + plural(delta, 'голова', 'головы', 'голов') + ' в копилку. Следующий босс через 12 часов.' : 'Ролтон сломан. Минус ' + (-delta) + ' ' + plural(-delta, 'голова', 'головы', 'голов') + '. Почини башни в штабе и готовься: через 12 часов новый босс.' ], { top: true, auto: 2600 }).then(function () {
			if (buff)
				return say('artem', [ 'Чистая работа. Держи VPN-щит: следующее отключение связи его не пробьёт.' ], { top: true, auto: 2400 });
		});
		refresh();
	}

	function plural(n, a, b, c) {
		n = Math.abs(n) % 100;
		var d = n % 10;
		return n > 10 && n < 20 ? c : d === 1 ? a : d > 1 && d < 5 ? b : c;
	}

	function persist() {
		try {
			g.localStorage.setItem(FKEY, JSON.stringify({ type: F.type, lvl: F.lvl, g: F.g, hp: F.hp, max: F.max, s: F.s, k: F.k, start: F.start, at: now() }));
		}
		catch (e) {}
	}

	function resume() {
		var f;
		try {
			f = JSON.parse(g.localStorage.getItem(FKEY));
		}
		catch (e) {
			f = null;
		}
		if (!f || !f.type)
			return;
		if (now() - f.at > 6e5) {
			try {
				g.localStorage.removeItem(FKEY);
			}
			catch (e) {}
			raid.hp = { t0: +f.s.t0 || 0, t1: +f.s.t1 || 0, r: +f.s.r || 0 };
			raid.next = Math.max(raid.next, f.at + COOL);
			raid.fight = null;
			save(true);
			return;
		}
		if (built() && !F)
			begin(f.type, f);
	}

	function cutWave(G) {
		var dur = WAVES[Math.min(F.k, WAVES.length - 1)];
		F.k++;
		F.boss.hold = 'rage';
		F.boss.holdT = 2;
		var n = Math.min(28, 8 + F.g);
		for (var i = 0; i < n; i++)
			F.swarm.push(spawnSwarm(G, i * .06));
		if (raid.buff > 0) {
			raid.buff--;
			save(true);
			say('artem', [ 'VPN-щит держит! Связь на месте, турели работают.' ], { top: true, auto: 1400 });
			return;
		}
		var go = function () {
			if (!F)
				return;
			F.cut = now() + dur * 1000;
			F.cutLen = dur;
			rpc([ 'cut', String(dur) ]);
			vpnOn();
		};
		if (raid.seen.rkn)
			return go();
		F.pause = true;
		hint('rkn', 'timur', [ 'Это командир РКН. Его коронка — отключать интернет. Сейчас он вырубит тебе VPN.', 'Пока нет связи, турели по нему не стреляют: провода горят красным. Дави рой жуков, пока они не сгрызли башни.', 'Отключения идут волнами, и каждая длиннее прошлой. Чем дольше бой, тем больнее.' ], { modal: true }).then(function () {
			if (!F)
				return;
			F.pause = false;
			go();
		});
	}

	function spawnTent(G, key, delay) {
		var p = targetPos(G, key);
		return { key: key, tx: p.x + rand(-8, 8) * G.k, ty: p.y + rand(-8, 8) * G.k, t: -(delay || 0), dur: Math.max(1.5, 2.4 - F.g * .03), dead: 0, seed: rand(0, 9) };
	}

	function spawnMin(G, key, b) {
		var p = targetPos(G, key);
		return { key: key, x: b.x + rand(-20, 20) * G.k, y: b.y - rand(0, 10) * G.k, tx: p.x + rand(-16, 16) * G.k, ty: (key === 'r' ? G.router.y + 4 * G.k : G.sites[+key.slice(1)].y + 4 * G.k) + rand(-4, 4) * G.k, sp: rand(30, 42) * G.k, bite: 0, ph: rand(0, 3), dead: 0 };
	}

	function spawnSwarm(G, delay) {
		var key = pickTarget() || 'r', p = targetPos(G, key), side = Math.floor(rand(0, 4));
		var x = side === 0 ? -20 : side === 1 ? G.W + 20 : rand(0, G.W), y = side === 2 ? -20 : side === 3 ? G.H + 20 : rand(0, G.H);
		return { key: key, x: x, y: y, tx: p.x + rand(-14, 14) * G.k, ty: (key === 'r' ? G.router.y : G.sites[+key.slice(1)].y) + rand(-6, 6) * G.k, sp: rand(60, 95), bite: 0, t: -(delay || 0), ph: rand(0, 3), dead: 0 };
	}

	function step(dt, G) {
		var b = F.boss, k = G.k, lvl = F.g, i;
		F.t += dt;
		b.h = clamp(G.H * .2, 110, 178);
		var minY = Math.max(G.H * .22, 70) + b.h, maxY = Math.max(minY + 10, G.H * (G.low ? .58 : .52));
		if (b.state === 'enter') {
			if (b.y < -900) {
				b.x = G.W / 2;
				b.y = -10;
				b.tx = G.W / 2;
				b.ty = (minY + maxY) / 2;
			}
			b.y += (b.ty - b.y) * Math.min(1, dt * 1.8);
			if (Math.abs(b.y - b.ty) < 4)
				b.state = 'idle';
		}
		else if (b.state === 'dead') {
			b.st += dt;
			if (b.st > 1.6)
				return finish(true);
		}
		else {
			if (b.state === 'drink') {
				b.st += dt;
				if (b.st > 1.2) {
					b.state = 'rage';
					b.st = 0;
					b.inv = 3;
					b.hits3 = 0;
					F.ram = .4;
					mud(true);
				}
			}
			else if (b.state === 'rage') {
				b.st += dt;
				b.inv = Math.max(0, b.inv - dt);
				F.ram -= dt;
				if (F.ram <= 0) {
					F.ram = 1.6;
					var tk = F.s.t0 > 0 || F.s.t1 > 0 ? (F.s.t0 > 0 && (F.s.t1 <= 0 || Math.random() < .5) ? 't0' : 't1') : 'r', tp = targetPos(G, tk);
					b.tx = tp.x;
					b.ty = Math.min(maxY + 60 * k, tp.y + b.h * .3);
					b.rammed = tk;
				}
				if (b.rammed) {
					var rp = targetPos(G, b.rammed);
					if (Math.hypot(b.x - rp.x, b.y - b.h * .4 - rp.y) < b.h * .55) {
						damage(b.rammed, BAL.ram(lvl), G);
						b.rammed = null;
						b.tx = rand(G.W * .3, G.W * .7);
						b.ty = rand(minY, maxY);
					}
				}
				if (b.st > 12 || (b.inv <= 0 && b.hits3 >= 3)) {
					b.state = 'stun';
					b.st = 0;
					mud(false);
				}
			}
			else if (b.state === 'stun') {
				b.st += dt;
				if (b.st > 1)
					b.state = 'idle';
			}
			var turretsDown = F.s.t0 <= 0 && F.s.t1 <= 0;
			if (turretsDown && b.state !== 'rage') {
				b.tx = G.router.x;
				b.ty = G.router.y - 10 * k;
				if (Math.hypot(b.x - G.router.x, b.y - G.router.y) < b.h * .7) {
					F.melee = (F.melee || 0) - dt;
					if (F.melee <= 0) {
						F.melee = 1.4;
						damage('r', BAL.ram(lvl), G);
					}
				}
			}
			else {
				F.retarget -= dt;
				F.dodge -= dt;
				if (F.retarget <= 0 || Math.hypot(b.x - b.tx, b.y - b.ty) < 6) {
					F.retarget = rand(2.5, 4.5);
					if (b.state !== 'rage') {
						b.tx = rand(G.W * .28, G.W * .72);
						b.ty = rand(minY, maxY);
					}
				}
				if (F.dodge <= 0 && b.state === 'idle') {
					F.dodge = rand(4, 7);
					b.tx = clamp(b.x + rand(-1, 1) * G.W * .25, G.W * .22, G.W * .78);
					b.ty = rand(minY, maxY);
					b.dash = .5;
				}
			}
			var sp = (34 + Math.min(lvl, 20) * 1.5) * (F.type === 'kumys' ? 1.35 : F.type === 'rkn' ? .85 : 1) * (b.state === 'rage' ? 3.2 : b.dash > 0 ? 3 : b.state === 'stun' || b.state === 'drink' ? 0 : 1) * Math.max(.7, k);
			b.dash = Math.max(0, (b.dash || 0) - dt);
			var dx = b.tx - b.x, dy = b.ty - b.y, dd = Math.hypot(dx, dy);
			if (dd > 1) {
				b.vx = dx / dd * Math.min(sp, dd / Math.max(dt, .001));
				b.vy = dy / dd * Math.min(sp, dd / Math.max(dt, .001));
				b.x += b.vx * dt;
				b.y += b.vy * dt;
			}
			else
				b.vx = b.vy = 0;
			if (b.state === 'idle') {
				F.atk -= dt;
				F.phase -= dt;
				if (F.atk <= 0) {
					if (F.type === 'rkn') {
						F.atk = Math.max(3.6, 5.6 - lvl * .06);
						var n = Math.min(6, 1 + Math.floor(lvl / 3));
						for (i = 0; i < n; i++) {
							var key = pickTarget();
							if (key)
								F.mins.push(spawnMin(G, key, b));
						}
						b.hold = 'point';
						b.holdT = .9;
					}
					else {
						F.atk = Math.max(2.2, 3.6 - lvl * .05) * (F.type === 'kumys' ? .85 : 1);
						var m = Math.min(3, 1 + Math.floor(lvl / 6));
						for (i = 0; i < m; i++) {
							var kk = pickTarget();
							if (kk)
								F.tent.push(spawnTent(G, kk, i * .25));
						}
						b.hold = 'attack';
						b.holdT = .6;
					}
				}
				if (F.phase <= 0) {
					F.phase = rand(26, 32);
					if (F.type === 'kumys') {
						b.state = 'drink';
						b.st = 0;
					}
					else if (F.type === 'rkn')
						cutWave(G);
					else {
						var storm = Math.min(9, 4 + Math.floor(lvl / 3));
						for (i = 0; i < storm; i++) {
							var ks = pickTarget();
							if (ks)
								F.tent.push(spawnTent(G, ks, i * .28));
						}
						b.hold = 'rage';
						b.holdT = 3;
					}
				}
				if (F.type === 'rkn') {
					F.shieldT -= dt;
					if (F.shieldT <= 0) {
						F.shieldT = rand(10, 14);
						b.shield = 3;
					}
				}
			}
			b.shield = Math.max(0, b.shield - dt);
		}
		b.holdT = Math.max(0, b.holdT - dt);
		b.hitT = Math.max(0, b.hitT - dt);
		if (F.cut && now() > F.cut) {
			F.cut = 0;
			vpnOff();
		}
		F.tent = F.tent.filter(function (t) {
			if (t.dead)
				return (t.dead += dt) < .45;
			t.t += dt;
			if (t.t >= t.dur) {
				damage(t.key, BAL.tentacle(lvl), G, t.tx, t.ty);
				t.dead = .001;
				t.hit = true;
			}
			return true;
		});
		var gnaw = function (m, dmg, every) {
			var d = Math.hypot(m.tx - m.x, m.ty - m.y);
			if (F.s[m.key] <= 0) {
				m.key = pickTarget();
				if (!m.key)
					return;
				var p = targetPos(G, m.key);
				m.tx = p.x + rand(-14, 14) * k;
				m.ty = (m.key === 'r' ? G.router.y : G.sites[+m.key.slice(1)].y) + rand(-6, 6) * k;
				return;
			}
			if (d > 3) {
				var v = Math.min(m.sp * dt, d);
				m.x += (m.tx - m.x) / d * v;
				m.y += (m.ty - m.y) / d * v;
				m.ph += dt * 9;
				m.flip = m.tx > m.x;
			}
			else {
				m.bite -= dt;
				if (m.bite <= 0) {
					m.bite = every;
					damage(m.key, dmg, G, m.x, m.y - 6 * k);
				}
			}
		};
		F.mins = F.mins.filter(function (m) {
			if (m.dead)
				return (m.dead += dt) < .5;
			gnaw(m, BAL.bite(lvl), 1);
			return true;
		});
		F.swarm = F.swarm.filter(function (m) {
			if (m.dead)
				return (m.dead += dt) < .4;
			if (m.t < 0) {
				m.t += dt;
				return true;
			}
			gnaw(m, BAL.gnaw(lvl), 1.2);
			return true;
		});
		F.fx = F.fx.filter(function (p) {
			p.t += dt;
			p.vy += p.g * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			return p.t < p.life;
		});
		if (F.hp <= 0 && b.state !== 'dead') {
			b.state = 'dead';
			b.st = 0;
			mud(false);
			if (F.type === 'rkn')
				burst(b.x, b.y - b.h * .5, 40, '#ff4a3a', 260);
			else
				blood(b.x, b.y - b.h * .5, 60);
		}
		if (b.state !== 'dead' && F.s.t0 <= 0 && F.s.t1 <= 0 && F.s.r <= 0)
			return finish(false);
		F.saveT -= dt;
		if (F.saveT <= 0) {
			F.saveT = 1;
			persist();
		}
		hudSet();
	}

	function hitBoss(v, x, y, site, tap) {
		if (!F || F.boss.state === 'dead' || F.boss.state === 'enter')
			return false;
		var b = F.boss;
		if (b.inv > 0) {
			burst(x, y, 4, '#ffffff', 90);
			return false;
		}
		if (tap && b.shield > 0) {
			burst(x, y, 5, '#9fd8ff', 110);
			return false;
		}
		F.hp = Math.max(0, F.hp - v);
		b.hitT = .12;
		if (F.type === 'rkn')
			burst(x, y, 4, '#ff6a4a', 120);
		else
			blood(x, y, tap ? 5 : 3);
		if (b.state === 'rage' && tap)
			b.hits3++;
		if (site !== undefined && !tap && Math.random() < .07) {
			var G = F.lastG, key = 't' + site;
			if (G && F.s[key] > 0) {
				if (F.type === 'rkn') {
					F.mins.push(spawnMin(G, key, b));
					F.mins.push(spawnMin(G, key, b));
				}
				else
					F.tent.push(spawnTent(G, key, 0));
			}
		}
		return true;
	}

	function mouth(b) {
		return { x: b.x, y: b.y - b.h * (F.type === 'rkn' ? .4 : .34) };
	}

	function drawTent(c, t, b, G, cream) {
		var m = mouth(b), u = clamp(t.t / t.dur, 0, 1), e = 1 - Math.pow(1 - u, 2), k = G.k;
		var tx = m.x + (t.tx - m.x) * e, ty = m.y + (t.ty - m.y) * e;
		if (t.dead) {
			var r = 1 - t.dead / .45;
			tx = m.x + (tx - m.x) * r;
			ty = m.y + (ty - m.y) * r;
		}
		var nx = -(ty - m.y), ny = tx - m.x, nl = Math.hypot(nx, ny) || 1, wig = Math.sin(F.t * 7 + t.seed) * 26 * k;
		nx /= nl;
		ny /= nl;
		var cx1 = m.x + (tx - m.x) * .35 + nx * wig, cy1 = m.y + (ty - m.y) * .35 + ny * wig, cx2 = m.x + (tx - m.x) * .7 - nx * wig * .7, cy2 = m.y + (ty - m.y) * .7 - ny * wig * .7;
		var col = cream ? '#e8d7b0' : '#3b1d3c', dk = cream ? '#9a8458' : '#1d0c1f';
		for (var s = 0; s < 3; s++) {
			c.beginPath();
			c.moveTo(m.x, m.y);
			c.bezierCurveTo(cx1, cy1, cx2, cy2, tx, ty);
			c.lineWidth = (9 - s * 3) * k;
			c.lineCap = 'round';
			c.strokeStyle = s === 0 ? dk : s === 1 ? col : 'rgba(255,255,255,.18)';
			c.stroke();
		}
		for (var q = 1; q < 6; q++) {
			var f = q / 6, px = Math.pow(1 - f, 3) * m.x + 3 * Math.pow(1 - f, 2) * f * cx1 + 3 * (1 - f) * f * f * cx2 + f * f * f * tx, py = Math.pow(1 - f, 3) * m.y + 3 * Math.pow(1 - f, 2) * f * cy1 + 3 * (1 - f) * f * f * cy2 + f * f * f * ty;
			c.beginPath();
			c.moveTo(px, py);
			c.lineTo(px + Math.sin(q * 2.3 + F.t * 5) * 6 * k, py + Math.cos(q * 1.7 + F.t * 4) * 6 * k);
			c.lineWidth = 1.2 * k;
			c.strokeStyle = dk;
			c.stroke();
		}
		if (!t.dead) {
			c.beginPath();
			c.arc(tx, ty, 6.5 * k, 0, TAU);
			c.fillStyle = cream ? '#f5e8c8' : '#5a2a5c';
			c.fill();
			c.lineWidth = 1.5 * k;
			c.strokeStyle = 'rgba(255,90,90,' + (.5 + .4 * Math.sin(F.t * 12)) + ')';
			c.stroke();
		}
		t.px = tx;
		t.py = ty;
	}

	function drawBug(c, m, G, h) {
		var key = m.bite > 0 && Math.hypot(m.tx - m.x, m.ty - m.y) <= 3 ? 'mf' : 'm' + (Math.floor(m.ph) % 3);
		var s = sprite('boss-minion', key, look === 'mono' ? 'mono' : null);
		if (m.dead) {
			blit(c, s, m.x, m.y, h * (1 - m.dead), m.flip, 1 - m.dead * 2);
			return;
		}
		blit(c, s, m.x, m.y, h, m.flip);
	}

	function drawBoss(c, G) {
		var b = F.boss, k = G.k, key, flip = false, rk = F.type === 'rkn';
		if (b.state === 'dead')
			key = rk ? 'back' : 'dead';
		else if (b.state === 'enter')
			key = rk ? 'intro' : 'front';
		else if (rk && b.shield > 0)
			key = 'shield';
		else if (b.holdT > 0 && b.hold)
			key = b.hold;
		else if (b.state === 'rage' || b.state === 'drink')
			key = rk ? 'rage' : 'rage';
		else if (Math.abs(b.vx) > 20)
			key = rk ? 'side' : (b.vx > 0 ? 'right' : 'left');
		else
			key = 'front';
		if (rk && key === 'side')
			flip = b.vx > 0;
		var name = rk ? 'boss-rkn' : 'boss-anus', variant = look === 'mono' ? 'mono' : b.hitT > 0 ? 'hit' : F.type === 'kumys' ? 'kumys' : null;
		var s = sprite(name, key, variant), h = b.h * (key === 'dead' ? .55 : key === 'rage' && rk ? 1.3 : 1);
		c.save();
		if (b.state === 'dead')
			c.globalAlpha = 1 - clamp((b.st - .6) / 1, 0, 1);
		if (b.inv > 0)
			c.globalAlpha *= .55 + .45 * Math.abs(Math.sin(F.t * 18));
		c.fillStyle = 'rgba(0,0,0,.22)';
		c.beginPath();
		c.ellipse(b.x, b.y + 2, b.h * .42, b.h * .08, 0, 0, TAU);
		c.fill();
		var wob = b.state === 'rage' ? Math.sin(F.t * 30) * 3 * k : Math.sin(F.t * 3 + b.wob) * 1.5 * k;
		blit(c, s, b.x + wob, b.y, h, flip);
		if (F.type === 'kumys' && b.state !== 'dead')
			bowl(c, b, k);
		c.restore();
		if (rk && b.state !== 'dead')
			drones(c, b, k);
		if (b.shield > 0 && b.state !== 'dead') {
			c.save();
			c.globalAlpha = .35 + .2 * Math.sin(F.t * 9);
			c.strokeStyle = '#9fd8ff';
			c.lineWidth = 3 * k;
			c.beginPath();
			c.ellipse(b.x, b.y - b.h * .5, b.h * .62, b.h * .6, 0, 0, TAU);
			c.stroke();
			c.restore();
			c.save();
			c.font = '800 ' + Math.round(11 * Math.max(.8, k)) + 'px Onest, system-ui, sans-serif';
			c.textAlign = 'center';
			c.fillStyle = '#d8efff';
			c.fillText('«Суверенный интернет»', b.x, b.y - b.h * 1.14);
			c.restore();
		}
	}

	function bowl(c, b, k) {
		var drink = b.state === 'drink', m = mouth(b), sway = Math.sin(F.t * 2.4) * 6 * k;
		var bx = drink ? m.x + 6 * k : b.x + b.h * .46 + sway, by = drink ? m.y - 6 * k : b.y - b.h * .62;
		c.beginPath();
		c.moveTo(m.x + b.h * .1, m.y);
		c.quadraticCurveTo(b.x + b.h * .5, b.y - b.h * .2, bx, by + 8 * k);
		c.lineWidth = 6 * k;
		c.strokeStyle = '#9a8458';
		c.lineCap = 'round';
		c.stroke();
		c.save();
		c.translate(bx, by);
		c.rotate(drink ? -.9 : .15);
		c.beginPath();
		c.ellipse(0, 0, 14 * k, 5 * k, 0, 0, Math.PI);
		c.lineTo(-14 * k, 0);
		c.fillStyle = '#8b5a2b';
		c.fill();
		c.beginPath();
		c.ellipse(0, 0, 14 * k, 4 * k, 0, 0, TAU);
		c.fillStyle = '#fbf7ec';
		c.fill();
		c.restore();
		c.fillStyle = 'rgba(255,255,255,.85)';
		for (var i = 0; i < 4; i++) {
			c.beginPath();
			c.arc(m.x - 14 * k + i * 9 * k, m.y + 4 * k + (i % 2) * 3 * k, 2.6 * k, 0, TAU);
			c.fill();
		}
	}

	function drones(c, b, k) {
		F.drones.forEach(function (a0, i) {
			var a = a0 + F.t * (1.1 + i * .25), x = b.x + Math.cos(a) * b.h * .85, y = b.y - b.h * .9 + Math.sin(a * 2) * 10 * k;
			c.save();
			c.translate(x, y);
			c.fillStyle = '#222';
			c.fillRect(-9 * k, -2 * k, 18 * k, 4 * k);
			[ -1, 1 ].forEach(function (s) {
				c.beginPath();
				c.ellipse(s * 10 * k, -3 * k, 7 * k, 1.6 * k, 0, 0, TAU);
				c.fillStyle = 'rgba(200,200,200,.55)';
				c.fill();
			});
			c.beginPath();
			c.arc(0, 2.5 * k, 1.8 * k, 0, TAU);
			c.fillStyle = Math.sin(F.t * 10 + i) > 0 ? '#ff3030' : '#5a1010';
			c.fill();
			c.restore();
		});
	}

	function tower(c, G) {
		var k = G.k, x = G.W * (G.low ? .5 : .5) + (G.low ? 0 : G.W * .2), base = G.low ? G.H * .5 : G.H * .62, h = G.H * (G.low ? .32 : .5), w = 34 * k;
		c.save();
		c.globalAlpha = .55;
		c.strokeStyle = '#5a6068';
		c.lineWidth = 1.6 * k;
		c.beginPath();
		c.moveTo(x - w, base);
		c.lineTo(x, base - h);
		c.lineTo(x + w, base);
		c.stroke();
		for (var i = 1; i < 9; i++) {
			var y = base - h * i / 9, ww = w * (1 - i / 9);
			c.beginPath();
			c.moveTo(x - ww, y);
			c.lineTo(x + ww, y);
			c.moveTo(x - ww, y);
			c.lineTo(x + w * (1 - (i - 1) / 9), y + h / 9);
			c.moveTo(x + ww, y);
			c.lineTo(x - w * (1 - (i - 1) / 9), y + h / 9);
			c.stroke();
		}
		c.fillStyle = '#1c1c1c';
		c.fillRect(x - 24 * k, base - h * .66, 48 * k, 18 * k);
		c.fillStyle = '#e8e8e8';
		c.font = '800 ' + Math.round(10 * Math.max(.8, k)) + 'px Onest, system-ui, sans-serif';
		c.textAlign = 'center';
		c.textBaseline = 'middle';
		c.fillText('РКН', x, base - h * .66 + 9 * k);
		c.globalAlpha = 1;
		c.beginPath();
		c.arc(x, base - h - 3 * k, 3.5 * k, 0, TAU);
		c.fillStyle = Math.sin(F.t * 4) > 0 ? '#ff2a2a' : '#4a0d0d';
		c.fill();
		c.restore();
	}

	function routerArt(c, G, skin, hpv, k) {
		var r = G.router, x = r.x, y = r.y, broken = hpv <= 0;
		c.save();
		c.fillStyle = 'rgba(0,0,0,.25)';
		c.beginPath();
		c.ellipse(x, y + 2 * k, 30 * k, 6 * k, 0, 0, TAU);
		c.fill();
		if (skin === 'rollton') {
			c.beginPath();
			c.moveTo(x - 20 * k, y - 32 * k);
			c.lineTo(x + 20 * k, y - 32 * k);
			c.lineTo(x + 15 * k, y);
			c.lineTo(x - 15 * k, y);
			c.closePath();
			var gr = c.createLinearGradient(x - 20 * k, 0, x + 20 * k, 0);
			gr.addColorStop(0, '#d6261c');
			gr.addColorStop(.5, '#f5b51e');
			gr.addColorStop(1, '#d6261c');
			c.fillStyle = gr;
			c.fill();
			c.fillStyle = '#fff6d8';
			c.font = '900 ' + Math.round(8.5 * Math.max(.8, k)) + 'px Onest, system-ui, sans-serif';
			c.textAlign = 'center';
			c.textBaseline = 'middle';
			c.fillText('РОЛТОН', x, y - 17 * k);
			c.beginPath();
			c.ellipse(x, y - 32 * k, 21 * k, 5 * k, 0, 0, TAU);
			c.fillStyle = broken ? '#7a6a4a' : '#e9d9a8';
			c.fill();
			if (!broken)
				[ -1, 1 ].forEach(function (s) {
					c.beginPath();
					c.moveTo(x + s * 6 * k, y - 34 * k);
					c.lineTo(x + s * 11 * k, y - 58 * k);
					c.lineWidth = 2.4 * k;
					c.strokeStyle = '#d9b46a';
					c.stroke();
				});
		}
		else {
			var w = 46 * k, h = 22 * k;
			c.fillStyle = broken ? '#5a2a20' : '#b6513f';
			c.beginPath();
			c.rect(x - w / 2, y - h, w, h);
			c.fill();
			c.fillStyle = 'rgba(0,0,0,.35)';
			[ -1, 1 ].forEach(function (s) {
				c.beginPath();
				c.ellipse(x + s * 9 * k, y - h / 2, 4.5 * k, 4 * k, 0, 0, TAU);
				c.fill();
			});
			c.fillStyle = 'rgba(255,220,200,.25)';
			c.fillRect(x - w / 2, y - h, w, 2.5 * k);
			[ -1, 1 ].forEach(function (s) {
				c.beginPath();
				c.moveTo(x + s * 15 * k - 2.5 * k, y - h);
				c.lineTo(x + s * (broken ? 26 : 17) * k, y - h - (broken ? 8 : 26) * k);
				c.lineTo(x + s * 15 * k + 2.5 * k, y - h);
				c.closePath();
				c.fillStyle = '#1b1b1b';
				c.fill();
			});
		}
		if (!broken)
			for (var i = 0; i < 3; i++) {
				c.beginPath();
				c.arc(x - 8 * k + i * 8 * k, y - 4 * k, 1.6 * k, 0, TAU);
				c.fillStyle = F && F.cut ? (i === 1 ? '#ff3030' : '#4a1010') : (Math.sin(Date.now() / 160 + i * 2) > 0 ? '#5cff8a' : '#1f6a35');
				c.fill();
			}
		if (hpv < 60)
			crack(c, x, y - 14 * k, k);
		if (hpv < 30)
			smoke(c, x, y - 30 * k, k);
		c.restore();
	}

	function crack(c, x, y, k) {
		c.strokeStyle = 'rgba(20,12,8,.8)';
		c.lineWidth = 1.2 * k;
		c.beginPath();
		c.moveTo(x - 10 * k, y - 6 * k);
		c.lineTo(x - 3 * k, y);
		c.lineTo(x - 6 * k, y + 5 * k);
		c.moveTo(x + 4 * k, y - 7 * k);
		c.lineTo(x + 9 * k, y + 2 * k);
		c.stroke();
	}

	function smoke(c, x, y, k) {
		var t = Date.now() / 1000;
		for (var i = 0; i < 4; i++) {
			var f = (t * .6 + i / 4) % 1;
			c.beginPath();
			c.arc(x + Math.sin(i * 2 + t) * 6 * k, y - f * 30 * k, (5 + f * 9) * k, 0, TAU);
			c.fillStyle = 'rgba(70,70,74,' + (.45 * (1 - f)) + ')';
			c.fill();
		}
	}

	function cables(c, G) {
		var r = G.router, k = G.k, red = F && F.cut, t = Date.now() / 1000;
		G.sites.forEach(function (S) {
			var key = 't' + S.i, dead = hp(key) <= 0 || raid.off[key], x0 = r.x + (S.s > 0 ? -1 : 1) * 14 * k, y0 = r.y - 6 * k, x1 = S.x + S.s * 6 * k, y1 = S.y + 10 * k;
			var c1x = x0 + (x1 - x0) * .2, c1y = Math.max(y0, y1) + 30 * k, c2x = x1, c2y = y1 + 40 * k;
			var col = dead ? 'rgba(90,96,104,.7)' : red ? '#ff3b3b' : '#3aa6ff';
			c.save();
			c.lineCap = 'round';
			if (!dead) {
				c.shadowColor = col;
				c.shadowBlur = 8 * k;
			}
			c.beginPath();
			c.moveTo(x0, y0);
			c.bezierCurveTo(c1x, c1y, c2x, c2y, x1, y1);
			c.lineWidth = 3 * k;
			c.strokeStyle = col;
			c.stroke();
			c.shadowBlur = 0;
			if (!dead && !red) {
				c.setLineDash([ 2 * k, 14 * k ]);
				c.lineDashOffset = -t * 40 * k;
				c.lineWidth = 2 * k;
				c.strokeStyle = 'rgba(220,240,255,.9)';
				c.stroke();
				c.setLineDash([]);
			}
			c.restore();
		});
	}

	function bars(c, G) {
		var k = G.k, fighting = !!F;
		var one = function (x, y, v) {
			if (!fighting && v >= 100)
				return;
			var w = 44 * k, h = 5 * k;
			c.fillStyle = 'rgba(10,10,12,.7)';
			c.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
			c.fillStyle = v > 60 ? '#5bd36b' : v > 30 ? '#f2c14e' : '#f0544a';
			c.fillRect(x - w / 2, y, w * clamp(v / 100, 0, 1), h);
		};
		G.sites.forEach(function (S, i) {
			var h = G.heads[i];
			one(S.x, (h ? h.top : S.y - 90 * k) - 30 * k, hp('t' + i));
		});
		one(G.router.x, G.router.y - (raid.skin.router === 'rollton' ? 66 : 54) * k, hp('r'));
	}

	function switches(c, G) {
		if (!raid.sw)
			return;
		var k = G.k;
		G.sites.forEach(function (S) {
			var key = 't' + S.i, x = S.x + S.s * 40 * k, y = S.y + 22 * k, on = !raid.off[key];
			c.beginPath();
			c.arc(x, y, 9 * k, 0, TAU);
			c.fillStyle = 'rgba(14,16,18,.85)';
			c.fill();
			c.lineWidth = 1.6 * k;
			c.strokeStyle = on ? '#5bd36b' : '#f0544a';
			c.beginPath();
			c.arc(x, y, 4.6 * k, -Math.PI * .3, Math.PI * 1.3);
			c.stroke();
			c.beginPath();
			c.moveTo(x, y - 6 * k);
			c.lineTo(x, y - 1 * k);
			c.stroke();
			S.sw = { x: x, y: y, r: 12 * k };
		});
	}

	function mud(on) {
		D.documentElement.classList.toggle('kadr-mud', !!on);
		if (F)
			F.mud = on ? 1 : 0;
	}

	function milk(c, G) {
		var t = F.t;
		c.save();
		for (var i = 0; i < 7; i++) {
			var x = (Math.sin(t * .35 + i * 1.7) * .5 + .5) * G.W, y = (Math.cos(t * .27 + i * 2.3) * .5 + .5) * G.H, r = (120 + 60 * Math.sin(t + i)) * Math.max(.7, G.k);
			var gr = c.createRadialGradient(x, y, 0, x, y, r);
			gr.addColorStop(0, 'rgba(250,246,232,.28)');
			gr.addColorStop(1, 'rgba(250,246,232,0)');
			c.fillStyle = gr;
			c.fillRect(x - r, y - r, r * 2, r * 2);
		}
		c.restore();
	}

	function hudOn() {
		if (hud)
			return;
		var mute = E('button', 'kadr-raid-mute', [], { type: 'button', 'aria-label': 'Музыка' });
		mute.addEventListener('click', function (ev) {
			ev.stopPropagation();
			muted = !muted;
			try {
				g.localStorage.setItem('kadr-luci-raid-mute', muted ? '1' : '0');
			}
			catch (e) {}
			mute.classList.toggle('k-off', muted);
			music(!muted);
		});
		mute.classList.toggle('k-off', muted);
		hud = { el: E('div', 'kadr-raid-hud', [ E('div', 'kadr-raid-row', [ E('strong'), E('span', 'kadr-raid-lvl'), mute ]), E('div', 'kadr-raid-bar', [ E('i'), E('b') ]), E('div', 'kadr-raid-chips') ]) };
		D.body.appendChild(hud.el);
		hudSet();
		g.requestAnimationFrame(function () { if (hud) hud.el.classList.add('k-on'); });
	}

	function hudSet() {
		if (!hud || !F)
			return;
		var el = hud.el, chips = [];
		el.querySelector('strong').textContent = BOSS[F.type];
		el.querySelector('.kadr-raid-lvl').textContent = 'ур. ' + (F.lvl + 1);
		el.querySelector('.kadr-raid-bar i').style.width = (100 * F.hp / F.max).toFixed(1) + '%';
		el.querySelector('.kadr-raid-bar b').textContent = Math.ceil(F.hp) + ' / ' + F.max;
		if (F.cut)
			chips.push([ 'cut', 'Нет связи · турели молчат · ' + Math.ceil((F.cut - now()) / 1000) + ' с' ]);
		if (F.boss.shield > 0)
			chips.push([ 'shield', 'Щит «Суверенный интернет»' ]);
		if (F.boss.inv > 0)
			chips.push([ 'inv', 'Неуязвим' ]);
		if (F.boss.state === 'rage' && F.boss.inv <= 0 && F.type === 'kumys')
			chips.push([ 'hits', 'Попади ещё ' + Math.max(0, 3 - F.boss.hits3) ]);
		if (AC.lockUntil > g.performance.now())
			chips.push([ 'lock', 'Тапы не считаются: кликер' ]);
		var html = chips.map(function (c) { return '<span class="' + c[0] + '">' + c[1] + '</span>'; }).join('');
		var box = el.querySelector('.kadr-raid-chips');
		if (box.__h !== html) {
			box.innerHTML = html;
			box.__h = html;
		}
		var hh = el.offsetHeight;
		if (hh && hh !== hud.h) {
			hud.h = hh;
			D.documentElement.style.setProperty('--kadr-hud-h', hh + 'px');
		}
	}

	function hudOff() {
		if (!hud)
			return;
		var el = hud.el;
		hud = null;
		el.classList.remove('k-on');
		g.setTimeout(function () { el.remove(); }, 300);
	}

	function vpnOn() {
		if (vpn)
			return;
		var btn = E('button', 'kadr-vpn-btn', [ 'Понятно (3)' ], { type: 'button', disabled: '' }), left = 3;
		vpn = E('div', 'kadr-vpn', [ E('div', 'kadr-vpn-card', [ E('div', 'kadr-vpn-head', [ 'РОСКОМНАДЗОР' ]), E('p', null, [ 'Обнаружено использование средств обхода блокировок. Доступ к сети ограничен до устранения нарушения.' ]), btn ], { role: 'alertdialog' }) ]);
		var tick = g.setInterval(function () {
			left--;
			if (left > 0)
				btn.textContent = 'Понятно (' + left + ')';
			else {
				g.clearInterval(tick);
				btn.textContent = 'Понятно';
				btn.removeAttribute('disabled');
			}
		}, 1000);
		btn.addEventListener('click', function (ev) {
			ev.stopPropagation();
			g.clearInterval(tick);
			vpnOff();
		});
		D.body.appendChild(vpn);
	}

	function vpnOff() {
		if (vpn) {
			vpn.remove();
			vpn = null;
		}
	}

	var AC = { taps: [], moves: 0, lockUntil: 0, warned: false, tok: 25, tokT: 0 };

	D.addEventListener('pointermove', function (ev) {
		if (ev.isTrusted)
			AC.moves++;
	}, { passive: true });

	function lock() {
		AC.lockUntil = g.performance.now() + 5000;
		if (!AC.warned) {
			AC.warned = true;
			say('ilkin', [ 'Э, кликер не катит. Пять секунд тапы не считаются, тапай сам.' ], { top: true, auto: 1600 });
		}
	}

	function note(ev, b) {
		var t = g.performance.now(), ts = ev.timeStamp > 0 && Math.abs(ev.timeStamp - t) < 1000 ? ev.timeStamp : t, moved = AC.moves > 0;
		AC.moves = 0;
		AC.taps.push({ t: t, ts: ts, x: ev.clientX, y: ev.clientY, moved: moved, mouse: ev.pointerType === 'mouse', bx: b.x, by: b.y, ok: false });
		AC.taps = AC.taps.filter(function (p) { return t - p.t < 8000; });
		if (t < AC.lockUntil)
			return;
		var tp = AC.taps.slice(-16);
		if (tp.length === 16) {
			var iv = [];
			for (var i = 1; i < tp.length; i++)
				iv.push(tp[i].ts - tp[i - 1].ts);
			var mean = iv.reduce(function (a, v) { return a + v; }, 0) / iv.length, sd = Math.sqrt(iv.reduce(function (a, v) { return a + (v - mean) * (v - mean); }, 0) / iv.length);
			if (mean < 260 && sd / mean < .05)
				return lock();
		}
		var win = AC.taps.filter(function (p) { return t - p.t < 3000; });
		if (win.length < 8)
			return;
		var xs = win.map(function (p) { return p.x; }), ys = win.map(function (p) { return p.y; }), r = bossBox(b).r;
		var travel = Math.max.apply(null, win.map(function (p) { return Math.hypot(p.bx - win[0].bx, p.by - win[0].by); }));
		if (travel < r)
			return;
		if (Math.max.apply(null, xs) - Math.min.apply(null, xs) < 3 && Math.max.apply(null, ys) - Math.min.apply(null, ys) < 3)
			return lock();
		if (win.every(function (p) { return p.mouse && !p.moved; }))
			return lock();
	}

	function allow() {
		var t = g.performance.now(), cur = AC.taps[AC.taps.length - 1];
		if (!cur || t < AC.lockUntil || t - cur.t > 50)
			return false;
		AC.tok = Math.min(25, AC.tok + (t - AC.tokT) / 1000 * 5);
		AC.tokT = t;
		if (AC.tok < 1 || AC.taps.filter(function (p) { return p.ok && t - p.t < 1000; }).length >= 7)
			return false;
		AC.tok--;
		cur.ok = true;
		return true;
	}

	function press(x, y, ev, covered) {
		if (covered || !active())
			return false;
		if (F && AUD && AUD.paused && !muted) {
			var p = AUD.play();
			if (p && p.catch)
				p.catch(function () {});
		}
		var G = F ? F.lastG : lastG;
		if (raid.sw && G)
			for (var i = 0; i < G.sites.length; i++) {
				var S = G.sites[i];
				if (S.sw && Math.hypot(x - S.sw.x, y - S.sw.y) < S.sw.r + 4) {
					var key = 't' + S.i;
					raid.off[key] = !raid.off[key];
					save(true);
					return true;
				}
			}
		if (!F) {
			if (canFight())
				begin();
			return false;
		}
		if (F.pause || !G)
			return false;
		if (ev.isTrusted)
			note(ev, F.boss);
		var slop = ev.pointerType === 'mouse' ? 4 : 10, best = null, bd = 1e9;
		var test = function (list, r, kind) {
			list.forEach(function (m) {
				if (m.dead || (m.t !== undefined && m.t < 0 && kind !== 'tent'))
					return;
				var px = kind === 'tent' ? m.px : m.x, py = kind === 'tent' ? m.py : m.y - r * .6, d = Math.hypot(x - px, y - py);
				if (px !== undefined && d < r + slop && d < bd) {
					bd = d;
					best = [ m, kind ];
				}
			});
		};
		test(F.tent, 16 * G.k, 'tent');
		test(F.mins, 15 * G.k, 'min');
		test(F.swarm, 11 * G.k, 'swarm');
		if (best) {
			if (ev.isTrusted && allow()) {
				best[0].dead = .001;
				if (best[1] === 'tent')
					blood(best[0].px, best[0].py, 5);
				else
					burst(best[0].x, best[0].y - 6, 5, '#7d8c2e', 90);
			}
			return true;
		}
		var bb = bossBox(F.boss);
		if (F.boss.state !== 'dead' && Math.hypot(x - bb.x, y - bb.y) < bb.r + slop) {
			if (ev.isTrusted && allow())
				hitBoss(1, x, y, undefined, true);
			return true;
		}
		return false;
	}

	var lastG = null;

	function under(c, w, L, P, heads) {
		progress = w.progress;
		look = w.look;
		if (!built())
			return;
		var G = geo(w, L, heads);
		lastG = G;
		if (F) {
			F.lastG = G;
			if (F.type === 'rkn')
				tower(c, G);
		}
		cables(c, G);
		routerArt(c, G, raid.skin.router, hp('r'), G.k);
	}

	function over(c, w, L, P, dt, heads) {
		if (!built())
			return;
		var G = geo(w, L, heads);
		lastG = G;
		if (F) {
			F.lastG = G;
			if (!F.pause)
				step(Math.min(dt, .05), G);
			else
				hudSet();
		}
		if (F) {
			var cream = F.type === 'kumys', mh = 30 * Math.max(.75, G.k);
			F.mins.forEach(function (m) { drawBug(c, m, G, mh); });
			F.swarm.forEach(function (m) {
				if (m.t >= 0)
					drawBug(c, m, G, mh * .48);
			});
			F.tent.forEach(function (t) {
				if (t.t >= 0)
					drawTent(c, t, F.boss, G, cream);
			});
			drawBoss(c, G);
			F.fx.forEach(function (p) {
				c.globalAlpha = 1 - p.t / p.life;
				c.fillStyle = p.col;
				c.beginPath();
				c.arc(p.x, p.y, p.r, 0, TAU);
				c.fill();
			});
			c.globalAlpha = 1;
			if (F.mud)
				milk(c, G);
		}
		bars(c, G);
		switches(c, G);
	}

	function turretView(i) {
		var key = 't' + i, v = hp(key);
		return { hp: v / 100, dead: v <= 0, off: !!raid.off[key], online: !(F && F.cut), skin: raid.skin, fight: !!F && F.boss.state !== 'enter' && F.boss.state !== 'dead' && !F.pause };
	}

	function aim() {
		if (!F || F.pause || F.boss.state === 'enter' || F.boss.state === 'dead')
			return null;
		var bb = bossBox(F.boss);
		return { x: bb.x, y: bb.y, vx: F.boss.vx, vy: F.boss.vy, r: bb.r };
	}

	function shot(x, y, site) {
		if (!F)
			return false;
		var bb = bossBox(F.boss);
		if (Math.hypot(x - bb.x, y - bb.y) > bb.r)
			return false;
		hitBoss(BAL.turret(), x, y, site, false);
		return true;
	}

	var shop = null, hbtn = null, scrim = null, booted = false;
	var TIPS = [
		'Урон качается по уровням. Каждый следующий дороже, зато турели бьют сильнее, а боссы — слабее.',
		'Башни и ролтон сами чинятся, восемь единиц в час. Ремонт за головы — сразу до целого.',
		'Кнопка на турелях выключает их. Выключенная турель не злит босса, но и не стреляет.',
		'Лапша Ролтон вместо снарядов урона не прибавляет. Зато красиво.',
		'Проиграешь — заберут часть голов. Не копи их без дела, вкладывай в урон.',
		'Босс приходит раз в двенадцать часов. Бой начнётся с первого клика по странице.'
	];

	function headerButton() {
		var want = active();
		if (want && !hbtn) {
			var pal = D.querySelector('.kadr-palette-btn');
			if (!pal)
				return;
			hbtn = E('button', 'kadr-ibtn kadr-raid-btn', [], { type: 'button', title: 'Штаб Буффало', 'aria-label': 'Штаб Буффало', 'aria-haspopup': 'dialog' });
			hbtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5c.2 3 2 4.6 4.6 4.6M20.5 5.5c-.2 3-2 4.6-4.6 4.6"/><path d="M8 9.5h8c.9 0 1.5.7 1.5 1.5v2.3c0 3.4-2.5 6.2-5.5 6.2s-5.5-2.8-5.5-6.2V11c0-.8.6-1.5 1.5-1.5Z"/><path d="M10 16.6h4"/><circle cx="9.7" cy="13" r=".9"/><circle cx="14.3" cy="13" r=".9"/></svg>';
			hbtn.addEventListener('click', function (ev) {
				ev.stopPropagation();
				if (shop && shop.open)
					closeShop();
				else
					openShop();
			});
			pal.parentNode.insertBefore(hbtn, pal);
		}
		else if (!want && hbtn) {
			closeShop();
			hbtn.remove();
			hbtn = null;
		}
		if (hbtn)
			hbtn.classList.toggle('k-ready', built() && !F && raid.next <= now());
	}

	function buildShop() {
		var cv = E('canvas', 'kadr-shop-cv'), tip = E('span', 'kadr-shop-tip'), body = E('div', 'kadr-shop-body');
		var close = E('button', 'kadr-ibtn kadr-close', [], { type: 'button', 'aria-label': 'Закрыть' });
		var el = E('div', 'kadr-sheet kadr-shop', [
			E('div', 'kadr-grip'),
			E('div', 'kadr-sheet-head', [ E('strong', null, [ 'Штаб Буффало' ]), close ]),
			E('div', 'kadr-shop-hero', [ cv, E('div', 'kadr-shop-say', [ E('b', null, [ 'Тимурчик', E('i', null, [ ' (3)' ]) ]), tip ]) ]),
			body
		], { role: 'dialog', 'aria-label': 'Штаб Буффало' });
		close.addEventListener('click', function (ev) {
			ev.stopPropagation();
			closeShop();
		});
		scrim = E('div', 'kadr-raid-scrim');
		scrim.addEventListener('click', closeShop);
		D.body.appendChild(scrim);
		D.body.appendChild(el);
		shop = { el: el, cv: cv, tip: tip, body: body, open: false, raf: 0, tipAt: 0, tipI: Math.floor(rand(0, TIPS.length)), pose: POSES.timur[0], from: POSES.timur[0], mixT: 1, blinkAt: 0, blinkEnd: 0, t0: g.performance.now() };
		el.addEventListener('click', function (ev) { ev.stopPropagation(); });
		D.addEventListener('keydown', function (ev) {
			if (ev.key === 'Escape' && shop && shop.open && !dlg)
				closeShop();
		});
	}

	function setTip(text) {
		if (!shop)
			return;
		shop.tip.textContent = text;
		shop.from = shop.cur || shop.pose;
		shop.pose = nextPose('timur');
		shop.mixT = 0;
		shop.tipAt = g.performance.now() + 9000;
	}

	function shopLoop(ts) {
		if (!shop || !shop.open)
			return;
		shop.raf = g.requestAnimationFrame(shopLoop);
		var cv = shop.cv, w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, g.devicePixelRatio || 1), c = cv.getContext('2d');
		if (!w || !h)
			return;
		if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
			cv.width = Math.round(w * dpr);
			cv.height = Math.round(h * dpr);
		}
		if (ts > shop.tipAt) {
			shop.tipI = (shop.tipI + 1) % TIPS.length;
			setTip(TIPS[shop.tipI]);
		}
		if (ts > shop.blinkAt) {
			shop.blinkEnd = ts + 130;
			shop.blinkAt = ts + rand(2400, 5600);
		}
		shop.mixT = Math.min(1, shop.mixT + .06);
		shop.cur = mixPose(shop.from, shop.pose, 1 - Math.pow(1 - shop.mixT, 3));
		c.setTransform(dpr, 0, 0, dpr, 0, 0);
		c.clearRect(0, 0, w, h);
		drawHero(c, 'timur', w, h, shop.cur, (ts - shop.t0) / 1000, false, ts < shop.blinkEnd);
	}

	function openShop() {
		if (!active())
			return;
		need([ 'hero-timur', 'boss-anus' ]);
		if (!shop)
			buildShop();
		regen();
		renderShop();
		shop.open = true;
		D.body.classList.add('kadr-shop-open');
		D.body.classList.remove('kadr-palette-open', 'kadr-menu-open');
		setTip(TIPS[shop.tipI]);
		g.cancelAnimationFrame(shop.raf);
		shop.raf = g.requestAnimationFrame(shopLoop);
		if (!raid.seen.shop)
			need([ 'hero-timur' ]).then(function () {
				hint('shop', 'timur', [
					'Здарова, я Тимурчик. Чиню ролтоны, иногда ломаю. Валюта тут одна — головы боссов.',
					'Урон турелей качается по уровням: каждый дороже прошлого, но турели бьют сильнее, а боссы — слабее. Не качаешься — догонят.',
					'Ремонт латает башни и ролтон после боссов. Сами они тоже чинятся, но медленно: восемь единиц в час.',
					'Кнопка на турелях даёт их выключать. Скины башен, стволов, снарядов и ролтона — для красоты, а лапша Ролтон — для души.'
				], { modal: true });
			});
	}

	function closeShop() {
		if (!shop || !shop.open)
			return;
		shop.open = false;
		g.cancelAnimationFrame(shop.raf);
		D.body.classList.remove('kadr-shop-open');
	}

	function money(n) {
		return n + ' ' + plural(n, 'голова', 'головы', 'голов');
	}

	function left(ms) {
		var m = Math.max(0, Math.ceil(ms / 6e4));
		return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин';
	}

	var buying = false;

	function buy(price, fn, line) {
		if (buying)
			return;
		buying = true;
		if (shop)
			shop.el.classList.add('k-busy');
		var go = function () {
			buying = false;
			if (shop)
				shop.el.classList.remove('k-busy');
			var cost = typeof price === 'function' ? price() : price;
			if (cost === null)
				return renderShop();
			if (F && fn.peace)
				return renderShop();
			if (raid.heads < cost) {
				renderShop();
				return setTip('Не хватает голов. Нужно ' + money(cost) + ', а у тебя ' + money(raid.heads) + '.');
			}
			raid.heads -= cost;
			fn();
			save(true);
			renderShop();
			if (line)
				setTip(line);
		};
		(g.KadrSync && g.KadrSync.pull ? g.KadrSync.pull() : Promise.resolve()).then(go, go);
	}

	function peace(fn) {
		fn.peace = true;
		return fn;
	}

	function row(title, sub, btnText, onClick, disabled, extra) {
		var b = E('button', 'kadr-upd-btn' + (disabled ? '' : ' primary'), [ btnText ], { type: 'button' });
		if (disabled)
			b.setAttribute('disabled', '');
		else
			b.addEventListener('click', function (ev) {
				ev.stopPropagation();
				onClick();
			});
		return E('div', 'kadr-opt kadr-shop-row', [ E('span', null, [ E('span', null, [ title ]), sub ? E('small', 'kadr-opt-sub', [ sub ]) : null, extra || null ]), b ]);
	}

	function renderShop() {
		if (!shop)
			return;
		var b = shop.body, fighting = !!F, lvl = BAL.lvl();
		b.textContent = '';
		var state = !built() ? 'Боссы придут, когда достроятся турели' : fighting ? 'Идёт бой с боссом ' + BOSS[F.type] : raid.next <= now() ? 'Босс рядом: бой начнётся с первого клика по странице' : 'Следующий босс через ' + left(raid.next - now());
		b.appendChild(E('div', 'kadr-shop-wallet', [ E('span', 'kadr-shop-coin'), E('strong', null, [ String(raid.heads) ]), E('small', null, [ plural(raid.heads, 'голова', 'головы', 'голов') + ' боссов' ]), E('span', 'kadr-shop-state', [ state ]) ]));
		var hpBox = E('span', 'kadr-shop-hp');
		[ [ 't0', 'Турель Л' ], [ 't1', 'Турель П' ], [ 'r', 'Ролтон' ] ].forEach(function (p) {
			var v = Math.round(hp(p[0]));
			hpBox.appendChild(E('span', 'kadr-shop-hpi', [ E('em', null, [ p[1] ]), E('span', 'kadr-shop-hpb', [ E('i', v > 60 ? 'ok' : v > 30 ? 'mid' : 'low', [], { style: 'width:' + v + '%' }) ]), E('b', null, [ v + '%' ]) ]));
		});
		var rc = BAL.repairCost();
		b.appendChild(E('span', 'kadr-tiles-group kadr-opts-title', [ 'Оборона' ]));
		b.appendChild(E('div', 'kadr-opts', [
			row('Ремонт', fighting ? 'Во время боя чинить нельзя' : rc ? 'Всё до целого за ' + money(rc) : 'Всё целое', rc ? 'Починить · ' + rc : 'Целое', function () {
				buy(function () {
					regen();
					return BAL.repairCost() || null;
				}, peace(function () {
					raid.hp = { t0: 100, t1: 100, r: 100 };
					raid.at = now();
				}), 'Как новенькие. Даже кнопку не нажимал.');
			}, fighting || !rc || raid.heads < rc, hpBox),
			raid.dmg < MAXDMG ? row('Урон турелей · ур. ' + raid.dmg, 'Следующий уровень: урон ×' + (1 + .35 * (raid.dmg + 1)).toFixed(2).replace(/\.?0+$/, '') + ' вместо ×' + (1 + .35 * raid.dmg).toFixed(2).replace(/\.?0+$/, ''), 'Качнуть · ' + BAL.dmgCost(raid.dmg), function () {
				buy(function () { return raid.dmg < MAXDMG ? BAL.dmgCost(raid.dmg) : null; }, peace(function () { raid.dmg++; }), 'Стволы подтянул. Теперь больнее.');
			}, fighting || raid.heads < BAL.dmgCost(raid.dmg)) : row('Урон турелей · максимум', 'Сильнее уже некуда', 'Максимум', null, true),
			raid.sw ? row('Кнопка на турелях', 'Есть: кружок у основания каждой турели', 'Куплено', null, true) : row('Кнопка на турелях', 'Выключать и включать каждую турель', 'Купить · ' + BAL.switchCost, function () {
				buy(function () { return raid.sw ? null : BAL.switchCost; }, function () { raid.sw = true; }, 'Поставил кнопки. Только не жми их во время боя без нужды.');
			}, raid.heads < BAL.switchCost)
		]));
		Object.keys(SHOP).forEach(function (kind) {
			b.appendChild(E('span', 'kadr-tiles-group kadr-opts-title', [ SHOP[kind].title ]));
			var grid = E('div', 'kadr-shop-skins');
			SHOP[kind].items.forEach(function (it) {
				var id = kind + ':' + it[0], own = raid.own.indexOf(id) > -1, on = raid.skin[kind] === it[0];
				var tile = E('button', 'kadr-shop-skin' + (on ? ' k-on' : ''), [ E('span', 'kadr-shop-sw sw-' + kind + '-' + it[0]), E('strong', null, [ it[1] ]), E('small', null, [ on ? 'Стоит' : own ? 'Поставить' : money(it[2]) ]) ], { type: 'button', 'aria-pressed': on ? 'true' : 'false' });
				tile.addEventListener('click', function (ev) {
					ev.stopPropagation();
					if (on)
						return;
					if (own) {
						raid.skin[kind] = it[0];
						save(true);
						renderShop();
						setTip(it[0] === 'rollton' ? 'Ролтон на месте. Главное — не заваривать.' : 'Поставил. Смотрится!');
						return;
					}
					buy(function () { return raid.own.indexOf(id) > -1 ? null : it[2]; }, function () {
						raid.own.push(id);
						raid.skin[kind] = it[0];
					}, 'Купил и сразу поставил. Носи на здоровье.');
				});
				grid.appendChild(tile);
			});
			b.appendChild(grid);
		});
		b.appendChild(E('p', 'kadr-sheet-note', [ 'Побед ' + raid.wins + ' · поражений ' + raid.losses + ' · боссы ур. ' + (lvl + 1) + (raid.buff ? ' · VPN-щиты Артёма: ' + raid.buff : '') ]));
	}

	function refresh() {
		headerButton();
		if (shop && shop.open)
			renderShop();
	}

	function abort() {
		if (!F)
			return;
		var f = F;
		F = null;
		music(false);
		hudOff();
		mud(false);
		vpnOff();
		if (f.cut)
			rpc([ 'restore' ]);
		raid.hp = { t0: f.s.t0, t1: f.s.t1, r: f.s.r };
		raid.fight = null;
		raid.next = Math.max(raid.next, now() + COOL);
		save(true);
		try {
			g.localStorage.removeItem(FKEY);
		}
		catch (e) {}
	}

	function sync(s) {
		settings = s || {};
		if (!active())
			abort();
		headerButton();
		if (!booted && active()) {
			booted = true;
			regen();
			save(false);
			rpc([ 'heal' ]);
		}
	}

	g.addEventListener('kadr-raid-sync', function () {
		var f = raid.fight;
		raid = load();
		if (F)
			raid.fight = f;
		refresh();
	});

	g.setInterval(function () {
		if (!F && built()) {
			resume();
			refresh();
		}
	}, 5000);

	g.KadrRaid = {
		choose: choose,
		offer: offer,
		say: say,
		sync: sync,
		press: press,
		under: under,
		over: over,
		turret: turretView,
		aim: aim,
		shot: shot,
		rate: function () { return 1.5; },
		fighting: function () { return !!(F && !F.pause && F.boss.state !== 'enter' && F.boss.state !== 'dead'); },
		active: active,
		openShop: openShop,
		state: function () { return raid; },
		debug: {
			begin: function (type) {
				raid.next = 0;
				raid.fight = null;
				if (F)
					abort();
				raid.next = 0;
				begin(type);
			},
			fight: function () { return F; },
			geo: function () { return lastG ? { k: lastG.k, low: lastG.low, router: lastG.router, sites: lastG.sites.map(function (S) { return { i: S.i, x: S.x, y: S.y, sw: S.sw || null }; }) } : null; },
			dlg: function () { return dlg && dlg.steps ? { i: dlg.i, n: dlg.steps.length, hero: dlg.hero, text: dlg.full, typing: dlg.shown < dlg.full.length, choices: !!(dlg.steps[dlg.i] || {}).choices, queue: dlgQueue.length } : dlg ? { pending: true, queue: dlgQueue.length } : null; },
			set: function (o) {
				Object.keys(o).forEach(function (k) { raid[k] = o[k]; });
				save(true);
				refresh();
			},
			finish: function (win) {
				if (F)
					finish(win);
			},
			ac: AC,
			bal: BAL
		}
	};
})(window);
