'use strict';
'require baseclass';
'require ui';

const SWIPE_CLOSE = 90;

return baseclass.extend({
	__init__() {
		ui.menu.load().then((tree) => this.render(tree));

		this.scrim = E('div', { 'class': 'kadr-scrim' });
		this.scrim.addEventListener('click', () => this.closeAll());
		document.body.appendChild(this.scrim);

		this.bindBurger();
		this.bindPalette();

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
			dividers: this.segment('kadr-div-label', 'dividers', [ [ 'none', 'Скрыть' ], [ 'line', 'Линия' ], [ 'segments', 'Сегменты' ] ]),
			bugLook: this.segment('kadr-look-label', 'bugLook', [ [ 'color', 'Цветные' ], [ 'pixel', 'Пиксели' ], [ 'mono', 'Силуэты' ] ])
		};

		this.switches = {
			shadows: this.switcher('kadr-shadow-label', 'shadows'),
			bugs: this.switcher('kadr-bugs-label', 'bugs'),
			bugWalk: this.switcher('kadr-walk-label', 'bugWalk'),
			bugMeme: this.switcher('kadr-meme-label', 'bugMeme')
		};

		this.memeRow = E('div', { 'class': 'kadr-opt', 'title': 'Таракан-прораб в каске с кирпичом и круглый жук с улыбкой во все зубы' }, [ E('span', { 'id': 'kadr-meme-label' }, [ 'Прораб и Улыбака' ]), this.switches.bugMeme ]);
		this.lookRow = E('div', { 'class': 'kadr-opt wide' }, [ E('span', { 'id': 'kadr-look-label' }, [ 'Вид жуков' ]), this.segs.bugLook ]);

		this.palette = E('div', { 'class': 'kadr-sheet kadr-palette', 'role': 'dialog', 'aria-label': _('Design') }, [
			E('div', { 'class': 'kadr-grip' }),
			E('div', { 'class': 'kadr-sheet-head' }, [
				E('strong', {}, [ _('Design') ]),
				E('button', { 'class': 'kadr-ibtn kadr-close', 'type': 'button', 'aria-label': _('Close'), 'click': () => this.setPalette(false) })
			]),
			E('div', { 'class': 'kadr-tiles', 'role': 'radiogroup' }, tiles),
			E('div', { 'class': 'kadr-opts' }, [
				E('div', { 'class': 'kadr-opt wide' }, [ E('span', { 'id': 'kadr-fx-label' }, [ 'Стиль' ]), this.segs.fx ]),
				E('div', { 'class': 'kadr-opt wide' }, [ E('span', { 'id': 'kadr-div-label' }, [ 'Разделители' ]), this.segs.dividers ]),
				E('div', { 'class': 'kadr-opt' }, [ E('span', { 'id': 'kadr-shadow-label' }, [ 'Тени' ]), this.switches.shadows ])
			]),
			E('span', { 'class': 'kadr-tiles-group kadr-opts-title' }, [ 'Жуки' ]),
			E('div', { 'class': 'kadr-opts' }, [
				E('div', { 'class': 'kadr-opt' }, [ E('span', { 'id': 'kadr-bugs-label' }, [ 'Бегают по экрану' ]), this.switches.bugs ]),
				E('div', { 'class': 'kadr-opt' }, [ E('span', { 'id': 'kadr-walk-label' }, [ 'Ходят по кнопкам' ]), this.switches.bugWalk ]),
				this.memeRow,
				this.lookRow
			]),
			E('p', { 'class': 'kadr-sheet-note' }, [ 'Всё запоминается в этом браузере.' ])
		]);

		this.syncOptions();
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

		this.lookRow.setAttribute('aria-disabled', state.bugs || state.bugWalk ? 'false' : 'true');
		this.memeRow.setAttribute('aria-disabled', state.bugs || state.bugWalk ? 'false' : 'true');
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
