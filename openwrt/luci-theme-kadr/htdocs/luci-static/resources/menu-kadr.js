'use strict';
'require baseclass';
'require fs';
'require ui';

const SWIPE_CLOSE = 90;
const UPDATE_KEY = 'kadr-luci-update';
const UPDATE_TOOL = '/usr/libexec/kadr-update';
const UPDATE_EVERY = 12 * 3600 * 1000;
const UPDATE_RETRY = 30 * 60 * 1000;
const UPDATE_LIMIT = 5 * 60 * 1000;
const FULL = document.documentElement.getAttribute('data-kadr-edition') !== 'lite';
const FULL_URL = 'https://github.com/splithillz/one/tree/main/openwrt/luci-theme-kadr#%D0%BF%D0%BE%D0%BB%D0%BD%D0%B0%D1%8F-%D0%B2%D0%B5%D1%80%D1%81%D0%B8%D1%8F';
const SYNC_FILE = '/etc/kadr-sync.json';
const SYNC_KEY = 'kadr-luci-sync';
const BUILD_KEY = 'kadr-luci-build';
const NOTES = {
	lite: 'Всё запоминается в этом браузере.',
	ok: 'Настройки хранятся на роутере и общие для всех устройств.',
	acl: 'Общие настройки заработают после повторного входа в LuCI. Пока всё запоминается в этом браузере.',
	off: 'Роутер не ответил, пока всё запоминается в этом браузере.'
};
const CHANGES_URL = 'https://github.com/splithillz/one/tree/main/openwrt/luci-theme-kadr#%D1%87%D1%82%D0%BE-%D0%BD%D0%BE%D0%B2%D0%BE%D0%B3%D0%BE';
const UPDATE_ERRORS = {
	net: 'Роутер не достучался до GitHub. Проверь, что на роутере есть интернет',
	bad: 'Список версий на GitHub битый, попробуй позже',
	download: 'Пакет не скачался, попробуй ещё раз',
	sum: 'Пакет скачался битым, попробуй ещё раз',
	install: 'Пакетный менеджер не смог поставить пакет',
	pm: 'На роутере нет ни apk, ни opkg',
	tmp: 'Не получилось записать временные файлы',
	died: 'Обновление прервалось, попробуй ещё раз',
	acl: 'Обновления заработают после повторного входа в LuCI',
	missing: 'Нет скрипта обновления. Поставь тему заново командой из README',
	rpc: 'Роутер не ответил, попробуй ещё раз'
};
const UPDATE_STEPS = {
	check: 'Готовлю обновление…',
	download: 'Скачиваю %s…',
	verify: 'Проверяю пакет…',
	install: 'Ставлю %s…'
};

function verParts(v) {
	const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)(?:-r(\d+))?/);
	return m ? [ +m[1], +m[2], +m[3], +(m[4] || 0) ] : [ 0, 0, 0, 0 ];
}

function isNewer(a, b) {
	const x = verParts(a);
	const y = verParts(b);

	for (let i = 0; i < 4; i++)
		if (x[i] !== y[i])
			return x[i] > y[i];

	return false;
}

function verLabel(v) {
	return String(v || '').replace(/-r\d+$/, '');
}

function parseLines(text) {
	const out = {};

	String(text || '').split('\n').forEach((line) => {
		const i = line.indexOf('=');
		if (i > 0)
			out[line.slice(0, i)] = line.slice(i + 1).trim();
	});

	return out;
}

function rpcError(err) {
	if (err && err.name === 'PermissionError')
		return 'acl';

	return err && err.name === 'NotFoundError' ? 'missing' : 'rpc';
}

function ago(t) {
	const min = Math.round((Date.now() - t) / 60000);

	if (min < 1)
		return 'только что';

	return min < 60 ? '%d мин назад'.format(min) : '%d ч назад'.format(Math.round(min / 60));
}

return baseclass.extend({
	__init__() {
		ui.menu.load().then((tree) => this.render(tree));

		this.scrim = E('div', { 'class': 'kadr-scrim' });
		this.scrim.addEventListener('click', () => this.closeAll());
		document.body.appendChild(this.scrim);

		this.bindBurger();
		this.bindPalette();
		this.initUpdate();

		if (FULL)
			this.initSync();

		document.addEventListener('keydown', (ev) => {
			if (ev.key === 'Escape')
				this.closeAll();
		});

		document.addEventListener('click', (ev) => {
			if (!ev.target.closest('#topmenu > li.dropdown'))
				document.querySelectorAll('#topmenu > li.open').forEach((li) => li.classList.remove('open'));

			if (document.body.classList.contains('kadr-palette-open') &&
			    !ev.target.closest('.kadr-palette') && !ev.target.closest('.kadr-palette-btn'))
				this.setPalette(false);

			if (document.body.classList.contains('kadr-menu-open') &&
			    !ev.target.closest('#topmenu') && !ev.target.closest('.kadr-burger'))
				this.setMenu(false);
		});
	},

	closeAll() {
		this.setMenu(false);
		this.setPalette(false);
	},

	syncScrim() {
		const menu = document.body.classList.contains('kadr-menu-open');
		const palette = document.body.classList.contains('kadr-palette-open');

		this.scrim.classList.toggle('on', menu || palette);
		this.scrim.classList.toggle('top', palette);
		document.documentElement.classList.toggle('kadr-lock', menu || palette);
	},

	setMenu(open) {
		const burger = document.querySelector('.kadr-burger');

		document.body.classList.toggle('kadr-menu-open', open);

		if (burger)
			burger.setAttribute('aria-expanded', open ? 'true' : 'false');

		if (open)
			document.body.classList.remove('kadr-palette-open');

		this.syncScrim();
	},

	setPalette(open) {
		if (open && !this.palette)
			this.buildPalette();

		if (open && this.memeSub) {
			this.syncMeta();
			window.clearInterval(this.metaTimer);
			this.metaTimer = window.setInterval(() => this.syncMeta(), 30000);
		}
		else if (!open)
			window.clearInterval(this.metaTimer);

		if (open && this.updBox) {
			if (!document.body.classList.contains('kadr-palette-open'))
				this.placeUpdate(this.hasUpdate() || this.updBusy);

			if (!this.updBusy && L.env.sessionid && (!this.upd.t || Date.now() - this.upd.t > UPDATE_EVERY))
				this.checkUpdate(true);
			else
				this.renderUpdate();
		}

		document.body.classList.toggle('kadr-palette-open', open);

		if (open)
			document.body.classList.remove('kadr-menu-open');

		this.syncScrim();
	},

	bindBurger() {
		const burger = document.querySelector('.kadr-burger');
		const menu = document.querySelector('#topmenu');

		if (burger)
			burger.addEventListener('click', (ev) => {
				ev.stopPropagation();
				this.setMenu(!document.body.classList.contains('kadr-menu-open'));
			});

		if (menu)
			this.swipeToClose(menu, () => this.setMenu(false), () => document.body.classList.contains('kadr-menu-open'));
	},

	bindPalette() {
		const btn = document.querySelector('.kadr-palette-btn');

		if (!btn || !window.KadrTheme) {
			if (btn)
				btn.style.display = 'none';
			return;
		}

		btn.addEventListener('click', (ev) => {
			ev.stopPropagation();
			this.setPalette(!document.body.classList.contains('kadr-palette-open'));
		});
	},

	buildPalette() {
		const K = window.KadrTheme;
		const state = K.get();
		const tile = (t) => this.tile(t, state.theme === t.id, () => this.pick({ theme: t.id }));
		const tiles = K.themes.filter((t) => !t.group).map(tile);

		const custom = K.resolve(state.theme === 'custom' ? state : { theme: 'custom', seed: '#3fe0a1' });
		const picker = E('input', { 'type': 'color', 'value': state.theme === 'custom' && state.seed ? state.seed : '#3fe0a1', 'aria-label': 'Свой цвет' });
		const customTile = this.tile({ id: 'custom', name: 'Свой цвет', bg: custom.bg, s2: custom.s2, s3: custom.s3, acc: custom.acc, ink: custom.ink }, state.theme === 'custom', null, picker);

		picker.addEventListener('input', () => this.pick({ theme: 'custom', seed: picker.value }));
		tiles.push(customTile);

		const groups = {};
		K.themes.filter((t) => t.group).forEach((t) => (groups[t.group] = groups[t.group] || []).push(t));
		Object.keys(groups).forEach((name) => {
			tiles.push(E('span', { 'class': 'kadr-tiles-group' }, [ name ]));
			groups[name].forEach((t) => tiles.push(tile(t)));
		});

		this.segs = {
			fx: this.segment('kadr-fx-label', 'fx', [ [ 'plain', 'Обычный' ], [ 'glass', 'Стекло' ], [ 'material', 'Material' ] ]),
			dividers: this.segment('kadr-div-label', 'dividers', [ [ 'none', 'Скрыть' ], [ 'line', 'Линия' ], [ 'segments', 'Сегменты' ] ])
		};

		this.switches = {
			shadows: this.switcher('kadr-shadow-label', 'shadows')
		};

		this.updBox = E('div', { 'class': 'kadr-opt kadr-upd', 'aria-live': 'polite' });
		this.updTop = E('div', { 'class': 'kadr-upd-top' });
		this.updBottom = E('div', { 'class': 'kadr-upd-bottom' }, [
			E('span', { 'class': 'kadr-tiles-group kadr-opts-title' }, [ 'Обновление' ]),
			E('div', { 'class': 'kadr-opts' }, [ this.updBox ])
		]);
		this.note = E('p', { 'class': 'kadr-sheet-note' }, [ NOTES[FULL && L.env.sessionid ? this.syncState || 'ok' : 'lite'] ]);

		const parts = [
			E('div', { 'class': 'kadr-grip' }),
			E('div', { 'class': 'kadr-sheet-head' }, [
				E('strong', {}, [ _('Design') ]),
				E('button', { 'class': 'kadr-ibtn kadr-close', 'type': 'button', 'aria-label': _('Close'), 'click': () => this.setPalette(false) })
			]),
			this.updTop,
			E('div', { 'class': 'kadr-tiles', 'role': 'radiogroup' }, tiles),
			E('div', { 'class': 'kadr-opts' }, [
				E('div', { 'class': 'kadr-opt wide' }, [ E('span', { 'id': 'kadr-fx-label' }, [ 'Стиль' ]), this.segs.fx ]),
				E('div', { 'class': 'kadr-opt wide' }, [ E('span', { 'id': 'kadr-div-label' }, [ 'Разделители' ]), this.segs.dividers ]),
				E('div', { 'class': 'kadr-opt' }, [ E('span', { 'id': 'kadr-shadow-label' }, [ 'Тени' ]), this.switches.shadows ])
			])
		];

		if (FULL) {
			this.segs.bugLook = this.segment('kadr-look-label', 'bugLook', [ [ 'color', 'Цветные' ], [ 'pixel', 'Пиксели' ], [ 'mono', 'Силуэты' ] ]);
			this.segs.bugCount = this.segment('kadr-count-label', 'bugCount', [ [ 'few', 'Мало' ], [ 'normal', 'Средне' ], [ 'many', 'Много' ] ]);
			Object.assign(this.switches, {
				bugs: this.switcher('kadr-bugs-label', 'bugs'),
				bugWalk: this.switcher('kadr-walk-label', 'bugWalk'),
				bugVerse: this.switcher('kadr-meme-label', 'bugVerse'),
				bugSound: this.switcher('kadr-sound-label', 'bugSound')
			});
			this.switches.bugVerse.setAttribute('aria-describedby', 'kadr-meme-sub');
			this.memeSub = E('small', { 'class': 'kadr-opt-sub', 'id': 'kadr-meme-sub' });
			this.memeRow = E('div', { 'class': 'kadr-opt', 'title': 'Прораб, Улыбака, Нубик и Волкочервь. При первом включении начинается стройка турелей ровно на сутки' }, [ E('span', {}, [ E('span', { 'id': 'kadr-meme-label' }, [ 'Метавселенная жуков' ]), this.memeSub ]), this.switches.bugVerse ]);
			this.soundRow = E('div', { 'class': 'kadr-opt' }, [ E('span', { 'id': 'kadr-sound-label' }, [ 'Звуки стройки' ]), this.switches.bugSound ]);
			this.lookRow = E('div', { 'class': 'kadr-opt wide' }, [ E('span', { 'id': 'kadr-look-label' }, [ 'Вид жуков' ]), this.segs.bugLook ]);
			this.countRow = E('div', { 'class': 'kadr-opt wide' }, [ E('span', { 'id': 'kadr-count-label' }, [ 'Сколько жуков' ]), this.segs.bugCount ]);
			parts.push(
				E('span', { 'class': 'kadr-tiles-group kadr-opts-title' }, [ 'Жуки' ]),
				E('div', { 'class': 'kadr-opts' }, [
					E('div', { 'class': 'kadr-opt' }, [ E('span', { 'id': 'kadr-bugs-label' }, [ 'Бегают по экрану' ]), this.switches.bugs ]),
					E('div', { 'class': 'kadr-opt' }, [ E('span', { 'id': 'kadr-walk-label' }, [ 'Ходят по кнопкам' ]), this.switches.bugWalk ]),
					this.memeRow,
					this.soundRow,
					this.countRow,
					this.lookRow
				])
			);
		}
		else if (state.bugs || state.bugWalk) {
			parts.push(E('p', { 'class': 'kadr-sheet-note kadr-moved' }, [ 'Жуки и метавселенная теперь в полной версии темы. ', E('a', { 'href': FULL_URL, 'target': '_blank', 'rel': 'noopener' }, [ 'Как поставить' ]) ]));
		}

		parts.push(this.updBottom, this.note);
		this.palette = E('div', { 'class': 'kadr-sheet kadr-palette', 'role': 'dialog', 'aria-label': _('Design') }, parts);

		this.syncOptions();
		this.placeUpdate(this.hasUpdate() || this.updBusy);
		this.renderUpdate();
		document.body.appendChild(this.palette);
		this.swipeToClose(this.palette, () => this.setPalette(false), () => true);
	},

	tile(t, checked, onPick, input) {
		const attrs = {
			'class': 'kadr-tile' + (t.id === 'custom' ? ' custom' : ''),
			'data-theme': t.id,
			'role': 'radio',
			'aria-checked': checked ? 'true' : 'false',
			'style': '--t-bg:%s;--t-s2:%s;--t-s3:%s;--t-acc:%s;--t-ink:%s'.format(t.bg, t.s2, t.s3, t.acc, t.ink)
		};

		if (t.short) {
			attrs.title = t.name;
			attrs['aria-label'] = t.name;
		}

		if (onPick) {
			attrs.type = 'button';
			attrs.click = onPick;
		}

		return E(input ? 'label' : 'button', attrs, [
			E('span', { 'class': 'kadr-tile-sw' }, [ E('i') ]),
			E('span', { 'class': 'kadr-tile-nm' }, [ t.short || t.name ]),
			E('span', { 'class': 'kadr-tile-ck' }),
			input || ''
		]);
	},

	pick(state) {
		const t = window.KadrTheme.set(state);

		this.markDirty();

		this.palette.querySelectorAll('.kadr-tile').forEach((el) => {
			el.setAttribute('aria-checked', el.getAttribute('data-theme') === t.id ? 'true' : 'false');
		});

		if (t.id === 'custom') {
			const el = this.palette.querySelector('.kadr-tile.custom');
			el.style.setProperty('--t-acc', t.acc);
			el.style.setProperty('--t-bg', t.bg);
		}
	},

	setOption(change) {
		window.KadrTheme.set(change);
		this.markDirty();
		this.syncOptions();
	},

	segment(labelId, key, items) {
		const seg = E('div', { 'class': 'kadr-seg', 'role': 'radiogroup', 'aria-labelledby': labelId },
			items.map(([ id, label ]) => E('button', { 'type': 'button', 'role': 'radio', 'data-value': id, 'click': () => this.setOption({ [key]: id }) }, [ label ])));

		seg.addEventListener('keydown', (ev) => {
			const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
			if (!step)
				return;
			const buttons = Array.from(seg.querySelectorAll('button'));
			const next = buttons[(buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true') + step + buttons.length) % buttons.length];
			ev.preventDefault();
			this.setOption({ [key]: next.getAttribute('data-value') });
			next.focus();
		});

		return seg;
	},

	switcher(labelId, key) {
		return E('button', { 'class': 'kadr-switch', 'type': 'button', 'role': 'switch', 'aria-labelledby': labelId,
			'click': () => this.setOption({ [key]: !window.KadrTheme.get()[key] }) });
	},

	syncOptions() {
		const state = window.KadrTheme.get();

		Object.keys(this.segs).forEach((key) => {
			this.segs[key].querySelectorAll('button').forEach((b) => {
				const on = b.getAttribute('data-value') === state[key];
				b.setAttribute('aria-checked', on ? 'true' : 'false');
				b.tabIndex = on ? 0 : -1;
			});
		});

		Object.keys(this.switches).forEach((key) => {
			this.switches[key].setAttribute('aria-checked', state[key] ? 'true' : 'false');
		});

		if (!FULL)
			return;

		this.lookRow.setAttribute('aria-disabled', state.bugs || state.bugWalk ? 'false' : 'true');
		this.memeRow.setAttribute('aria-disabled', state.bugs || state.bugWalk ? 'false' : 'true');
		this.countRow.setAttribute('aria-disabled', state.bugs || state.bugWalk ? 'false' : 'true');
		this.syncMeta();
	},

	buildStart() {
		try {
			const s = +(JSON.parse(window.localStorage.getItem(BUILD_KEY)) || {}).start;
			return s > 0 ? s : 0;
		}
		catch (e) {
			return 0;
		}
	},

	saveBuild(start) {
		try {
			if (start)
				window.localStorage.setItem(BUILD_KEY, JSON.stringify({ start: start }));
			else
				window.localStorage.removeItem(BUILD_KEY);
		}
		catch (e) {}
	},

	initSync() {
		if (!L.env.sessionid)
			return;

		window.addEventListener('kadr-build', () => this.syncSoon());
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden)
				this.syncNow();
		});
		window.setInterval(() => {
			if (!document.hidden)
				this.syncNow();
		}, 60000);
		this.syncNow();
	},

	syncSoon() {
		window.clearTimeout(this.syncTimer);
		this.syncTimer = window.setTimeout(() => this.syncNow(), 500);
	},

	syncInfo() {
		try {
			const m = JSON.parse(window.localStorage.getItem(SYNC_KEY)) || {};
			return { rev: +m.rev || 0, dirty: !!m.dirty };
		}
		catch (e) {
			return { rev: 0, dirty: false };
		}
	},

	saveSyncInfo(info) {
		try {
			window.localStorage.setItem(SYNC_KEY, JSON.stringify(info));
		}
		catch (e) {}
	},

	markDirty() {
		if (!FULL || !L.env.sessionid)
			return;

		this.saveSyncInfo({ rev: this.syncInfo().rev, dirty: true });
		this.syncSoon();
	},

	syncNow() {
		if (this.syncBusy) {
			this.syncAgain = true;
			return;
		}

		const K = window.KadrTheme;

		this.syncBusy = true;
		fs.read(SYNC_FILE).then((text) => {
			try {
				const r = JSON.parse(text);
				return r && typeof r === 'object' ? r : null;
			}
			catch (e) {
				return null;
			}
		}, (err) => {
			if (err && err.name === 'NotFoundError')
				return null;
			throw err;
		}).then((remote) => {
			const info = this.syncInfo();
			const lb = this.buildStart();
			const rb = remote && +remote.build > 0 ? +remote.build : 0;
			const build = lb && rb ? Math.min(lb, rb) : (lb || rb);
			const rrev = remote ? +remote.rev || 0 : 0;
			let write = !remote || build !== rb, adopt = false, rev;

			if (remote && remote.settings && typeof remote.settings === 'object' && !info.dirty) {
				adopt = rrev !== info.rev;
				rev = rrev;
			}
			else {
				rev = Math.max(info.rev, rrev) + 1;
				write = true;
			}

			if (build !== lb)
				this.saveBuild(build);

			if (adopt)
				K.set(remote.settings);
			else if (build !== lb)
				K.set({});

			if (adopt || build !== lb)
				this.refreshPalette();

			const done = () => {
				this.saveSyncInfo({ rev: rev, dirty: false });
				this.setNote('ok');
			};

			if (!write)
				return done();

			return fs.write(SYNC_FILE, JSON.stringify({ v: 1, rev: rev, settings: K.get(), build: build }) + '\n').then(done);
		}).catch((err) => {
			this.setNote(err && err.name === 'PermissionError' ? 'acl' : 'off');
		}).finally(() => {
			this.syncBusy = false;

			if (this.syncAgain) {
				this.syncAgain = false;
				this.syncNow();
			}
		});
	},

	setNote(code) {
		this.syncState = code;

		if (this.note)
			this.note.textContent = NOTES[code];
	},

	refreshPalette() {
		if (!this.palette)
			return;

		const K = window.KadrTheme;
		const state = K.get();
		const t = K.resolve(state);

		this.palette.querySelectorAll('.kadr-tile').forEach((el) => {
			el.setAttribute('aria-checked', el.getAttribute('data-theme') === t.id ? 'true' : 'false');
		});

		if (t.id === 'custom') {
			const el = this.palette.querySelector('.kadr-tile.custom');
			el.style.setProperty('--t-acc', t.acc);
			el.style.setProperty('--t-bg', t.bg);
		}

		this.syncOptions();
	},

	syncMeta() {
		if (!this.memeSub)
			return;

		const state = window.KadrTheme.get();
		const start = this.buildStart();
		const p = start ? Math.min(1, (Date.now() - start) / 864e5) : -1;
		let text = 'Включишь — начнётся стройка турелей ровно на сутки, её не остановить';

		if (p >= 0 && p < 1) {
			const left = 864e5 - (Date.now() - start);
			text = 'Стройка турелей: %d%% · ещё %d ч %d мин'.format(Math.floor(p * 100), Math.floor(left / 36e5), Math.floor(left % 36e5 / 6e4));
			if (!state.bugVerse)
				text += ' · её не остановить';
		}
		else if (p >= 1) {
			text = state.bugVerse ? 'Турели построены и стреляют по жукам' : 'Турели построены и выключены';
		}

		this.memeSub.textContent = text;
		this.soundRow.hidden = !(p >= 0 && p < 1);
	},

	loadUpdate() {
		try {
			return JSON.parse(window.localStorage.getItem(UPDATE_KEY)) || {};
		}
		catch (e) {
			return {};
		}
	},

	saveUpdate(info) {
		this.upd = info;

		try {
			window.localStorage.setItem(UPDATE_KEY, JSON.stringify(info));
		}
		catch (e) {}
	},

	initUpdate() {
		this.upd = this.loadUpdate();
		this.markUpdate();

		if (!L.env.sessionid || !document.querySelector('.kadr-palette-btn'))
			return;

		const u = this.upd;
		const wait = u.error ? (u.error === 'acl' && u.sid !== L.env.sessionid ? 0 : UPDATE_RETRY) : UPDATE_EVERY;

		if (u.started && Date.now() - u.started < UPDATE_LIMIT) {
			this.updBusy = true;
			this.updView = { mode: 'updating', step: 'check', version: u.latest };
			window.setTimeout(() => this.pollUpdate(false, 0, u.started), 1500);
		}
		else if (!u.t || Date.now() - u.t > wait) {
			window.setTimeout(() => this.checkUpdate(false), 4000);
		}
	},

	pageVersion() {
		return document.documentElement.getAttribute('data-kadr-version') || '';
	},

	currentVersion() {
		const page = this.pageVersion();
		return isNewer(this.upd.installed, page) ? this.upd.installed : page;
	},

	hasUpdate() {
		return !this.upd.error && !!this.upd.latest && isNewer(this.upd.latest, this.currentVersion());
	},

	markUpdate() {
		const btn = document.querySelector('.kadr-palette-btn');

		if (!btn)
			return;

		const on = this.hasUpdate();
		const label = on ? '%s · вышло обновление'.format(_('Design')) : _('Design');

		btn.classList.toggle('kadr-has-update', on);
		btn.setAttribute('title', label);
		btn.setAttribute('aria-label', label);
	},

	checkUpdate(shown) {
		if (this.updBusy)
			return;

		this.updBusy = true;

		if (shown)
			this.renderUpdate({ mode: 'checking' });

		fs.exec(UPDATE_TOOL, [ 'check' ]).then((res) => {
			const r = parseLines(res.stdout);
			this.saveUpdate(r.error ? { t: Date.now(), error: r.error } : { t: Date.now(), installed: r.installed, latest: r.latest });
		}, (err) => {
			this.saveUpdate({ t: Date.now(), error: rpcError(err), sid: L.env.sessionid });
		}).then(() => {
			this.updBusy = false;
			this.markUpdate();
			this.renderUpdate(null);
		});
	},

	startUpdate() {
		if (this.updBusy)
			return;

		const since = Date.now();

		this.updBusy = true;
		this.saveUpdate(Object.assign({}, this.upd, { started: since }));
		this.renderUpdate({ mode: 'updating', step: 'check', version: this.upd.latest });

		fs.exec(UPDATE_TOOL, [ 'start' ]).then((res) => {
			const r = parseLines(res.stdout);

			if (r.error)
				this.finishUpdate({ state: 'error', error: r.error }, true);
			else
				this.pollUpdate(true, 0, since);
		}, (err) => this.finishUpdate({ state: 'error', error: rpcError(err) }, true));
	},

	pollUpdate(shown, misses, since) {
		window.setTimeout(() => {
			const slow = new Promise((resolve, reject) => window.setTimeout(() => reject(new Error('slow')), 4000));

			Promise.race([ fs.exec(UPDATE_TOOL, [ 'status' ]), slow ]).then((res) => {
				const r = parseLines(res.stdout);

				if (r.state === 'running' && !r.dead && Date.now() - since < UPDATE_LIMIT) {
					this.renderUpdate({ mode: 'updating', step: r.step, version: r.version || this.upd.latest });
					this.pollUpdate(shown, 0, since);
					return;
				}

				if (r.state !== 'done' && r.state !== 'error')
					r.error = 'died';

				this.finishUpdate(r, shown);
			}, () => {
				if (misses < 10)
					this.pollUpdate(shown, misses + 1, since);
				else
					this.finishUpdate({ state: 'error', error: 'rpc' }, shown);
			});
		}, 1000);
	},

	finishUpdate(r, shown) {
		this.updBusy = false;

		if (r.state === 'done') {
			this.saveUpdate({ t: Date.now(), installed: r.version, latest: r.version });
			this.markUpdate();

			if (shown && !r.same) {
				this.renderUpdate({ mode: 'done' });
				window.setTimeout(() => window.location.reload(), 1500);
				return;
			}

			this.renderUpdate(null);
			return;
		}

		this.saveUpdate(Object.assign({}, this.upd, { started: 0 }));
		this.markUpdate();
		this.renderUpdate({ mode: 'error', error: r.error || 'died', retry: 'update' });
	},

	placeUpdate(top) {
		if (top)
			this.updTop.appendChild(this.updBox);
		else
			this.updBottom.lastElementChild.appendChild(this.updBox);

		this.updBottom.hidden = !!top;
	},

	updButton(label, action, primary) {
		const attrs = { 'type': 'button', 'class': 'kadr-upd-btn' + (primary ? ' primary' : '') };

		if (action)
			attrs.click = (ev) => {
				ev.stopPropagation();
				action();
			};
		else
			attrs.disabled = '';

		return E('button', attrs, [ label ]);
	},

	renderUpdate(view) {
		if (view !== undefined)
			this.updView = view;

		if (!this.updBox)
			return;

		const u = this.upd;
		const v = this.updView || {};
		const cur = verLabel(this.currentVersion());
		const mode = v.mode || (u.error ? 'error' : this.hasUpdate() ? 'available' : u.latest ? 'latest' : 'idle');
		const code = v.error || u.error;
		let title = cur ? 'Кадр %s'.format(cur) : 'Кадр';
		let sub = [ 'Проверяю раз в 12 часов' ];
		let btn = this.updButton('Проверить', () => this.checkUpdate(true));

		if (mode === 'checking') {
			sub = [ 'Проверяю обновления…' ];
			btn = this.updButton('Проверить');
		}
		else if (mode === 'latest') {
			sub = [ 'Последняя версия · проверено %s'.format(ago(u.t)) ];
		}
		else if (mode === 'available') {
			title = 'Вышла версия %s'.format(verLabel(u.latest));
			sub = [ 'Сейчас стоит %s · '.format(cur), E('a', { 'href': CHANGES_URL, 'target': '_blank', 'rel': 'noreferrer', 'click': (ev) => ev.stopPropagation() }, [ 'Что нового' ]) ];
			btn = this.updButton('Обновить', () => this.startUpdate(), true);
		}
		else if (mode === 'updating') {
			title = 'Обновляю до %s'.format(verLabel(v.version || u.latest));
			sub = [ (UPDATE_STEPS[v.step] || UPDATE_STEPS.check).format(verLabel(v.version || u.latest)) ];
			btn = this.updButton('Обновляю', null, true);
		}
		else if (mode === 'done') {
			title = 'Кадр обновлён';
			sub = [ 'Перезагружаю страницу…' ];
			btn = '';
		}
		else if (mode === 'error') {
			sub = [ UPDATE_ERRORS[code] || UPDATE_ERRORS.rpc ];
			btn = code === 'acl'
				? E('a', { 'class': 'kadr-upd-btn', 'href': L.url('admin/logout') }, [ 'Выйти' ])
				: this.updButton('Ещё раз', () => (v.retry === 'update' ? this.startUpdate() : this.checkUpdate(true)));
		}

		this.updBox.setAttribute('data-state', mode);
		L.dom.content(this.updBox, [
			E('span', { 'class': 'kadr-upd-ic', 'aria-hidden': 'true' }),
			E('span', { 'class': 'kadr-upd-tx' }, [ E('strong', {}, [ title ]), E('small', {}, sub) ]),
			btn
		]);
	},

	swipeToClose(el, close, active) {
		let y0 = null;
		let dy = 0;

		el.addEventListener('touchstart', (ev) => {
			if (!active() || el.scrollTop > 0 || ev.target.closest('input'))
				return;

			y0 = ev.touches[0].clientY;
			dy = 0;
		}, { passive: true });

		el.addEventListener('touchmove', (ev) => {
			if (y0 === null)
				return;

			dy = Math.max(0, ev.touches[0].clientY - y0);

			if (dy > 4) {
				el.style.transition = 'none';
				el.style.transform = 'translateY(%dpx)'.format(dy);
			}
		}, { passive: true });

		el.addEventListener('touchend', () => {
			if (y0 === null)
				return;

			el.style.transition = '';
			el.style.transform = '';

			if (dy > SWIPE_CLOSE)
				close();

			y0 = null;
			dy = 0;
		});
	},

	render(tree) {
		let node = tree;
		let url = '';

		this.renderModeMenu(tree);

		if (L.env.dispatchpath.length >= 3) {
			for (let i = 0; i < 3 && node; i++) {
				node = node.children[L.env.dispatchpath[i]];
				url = url + (url ? '/' : '') + L.env.dispatchpath[i];
			}

			if (node)
				this.renderTabMenu(node, url);
		}
	},

	renderTabMenu(tree, url, level) {
		const container = document.querySelector('#tabmenu');
		const ul = E('ul', { 'class': 'tabs' });
		const children = ui.menu.getChildren(tree);
		let activeNode = null;

		children.forEach((child) => {
			const isActive = (L.env.dispatchpath[3 + (level || 0)] == child.name);
			const className = 'tabmenu-item-%s %s'.format(child.name, isActive ? 'active' : '');

			ul.appendChild(E('li', { 'class': className }, [
				E('a', { 'href': L.url(url, child.name) }, [ _(child.title) ])
			]));

			if (isActive)
				activeNode = child;
		});

		if (ul.children.length == 0)
			return E([]);

		container.appendChild(ul);
		container.style.display = '';

		if (activeNode)
			this.renderTabMenu(activeNode, url + '/' + activeNode.name, (level || 0) + 1);

		return ul;
	},

	renderMainMenu(tree, url, level) {
		const ul = level ? E('ul', { 'class': 'dropdown-menu' }) : document.querySelector('#topmenu');
		const children = ui.menu.getChildren(tree);

		if (children.length == 0 || level > 1)
			return E([]);

		children.forEach((child) => {
			const submenu = this.renderMainMenu(child, url + '/' + child.name, (level || 0) + 1);
			const hasSub = !level && submenu.firstElementChild;
			const depth = (level || 0) + 1;
			const isActive = L.env.dispatchpath[depth] == child.name &&
				L.env.dispatchpath.slice(0, depth).join('/') == url;
			const classes = [];

			if (hasSub)
				classes.push('dropdown');

			if (isActive)
				classes.push('active');

			const link = { 'class': hasSub ? 'menu' : '', 'href': hasSub ? '#' : L.url(url, child.name) };

			if (hasSub) {
				link.click = (ev) => {
					ev.preventDefault();
					const open = li.classList.contains('open');
					li.parentNode.querySelectorAll(':scope > li.open').forEach((other) => other.classList.remove('open'));
					li.classList.toggle('open', !open);
				};
			}

			const li = E('li', { 'class': classes.join(' ') }, [ E('a', link, [ _(child.title) ]), submenu ]);

			ul.appendChild(li);
		});

		ul.style.display = '';

		return ul;
	},

	renderModeMenu(tree) {
		const ul = document.querySelector('#modemenu');
		const children = ui.menu.getChildren(tree);

		children.forEach((child, index) => {
			const isActive = L.env.requestpath.length
				? child.name === L.env.requestpath[0]
				: index === 0;

			ul.appendChild(E('li', { 'class': isActive ? 'active' : '' }, [
				E('a', { 'href': L.url(child.name) }, [ _(child.title) ])
			]));

			if (isActive)
				this.renderMainMenu(child, child.name);
		});

		if (ul.children.length > 1)
			ul.style.display = '';
	}
});
