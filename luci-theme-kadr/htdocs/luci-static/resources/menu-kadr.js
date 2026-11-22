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
		const tiles = K.themes.map((t) => this.tile(t, state.theme === t.id, () => this.pick({ theme: t.id })));

		const custom = K.resolve(state.theme === 'custom' ? state : { theme: 'custom', seed: '#3fe0a1' });
		const picker = E('input', { 'type': 'color', 'value': state.theme === 'custom' && state.seed ? state.seed : '#3fe0a1', 'aria-label': 'Свой цвет' });
		const customTile = this.tile({ id: 'custom', name: 'Свой цвет', bg: custom.bg, s2: custom.s2, s3: custom.s3, acc: custom.acc, ink: custom.ink }, state.theme === 'custom', null, picker);

		picker.addEventListener('input', () => this.pick({ theme: 'custom', seed: picker.value }));
		tiles.push(customTile);

		this.palette = E('div', { 'class': 'kadr-sheet kadr-palette', 'role': 'dialog', 'aria-label': _('Design') }, [
			E('div', { 'class': 'kadr-grip' }),
			E('div', { 'class': 'kadr-sheet-head' }, [
				E('strong', {}, [ _('Design') ]),
				E('span', { 'class': 'kadr-chip' }, [ 'Кадр' ]),
				E('button', { 'class': 'kadr-ibtn kadr-close', 'type': 'button', 'aria-label': _('Close'), 'click': () => this.setPalette(false) })
			]),
			E('div', { 'class': 'kadr-tiles', 'role': 'radiogroup' }, tiles),
			E('p', { 'class': 'kadr-sheet-note' }, [ 'Тема запоминается в этом браузере.' ])
		]);

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

		if (onPick) {
			attrs.type = 'button';
			attrs.click = onPick;
		}

		return E(input ? 'label' : 'button', attrs, [
			E('span', { 'class': 'kadr-tile-sw' }, [ E('i') ]),
			E('span', { 'class': 'kadr-tile-nm' }, [ t.name ]),
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
