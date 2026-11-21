'use strict';
'require baseclass';
'require ui';

return baseclass.extend({
	__init__() {
		ui.menu.load().then((tree) => this.render(tree));
		this.bindBurger();
	},

	bindBurger() {
		const burger = document.querySelector('.slate-burger');

		if (!burger)
			return;

		const setOpen = (open) => {
			document.body.classList.toggle('slate-menu-open', open);
			burger.setAttribute('aria-expanded', open ? 'true' : 'false');
		};

		burger.addEventListener('click', (ev) => {
			ev.stopPropagation();
			setOpen(!document.body.classList.contains('slate-menu-open'));
		});

		document.addEventListener('keydown', (ev) => {
			if (ev.key === 'Escape')
				setOpen(false);
		});

		document.addEventListener('click', (ev) => {
			if (document.body.classList.contains('slate-menu-open') && !ev.target.closest('#topmenu'))
				setOpen(false);
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

		document.addEventListener('click', (ev) => {
			if (!ev.target.closest('#topmenu > li.dropdown'))
				document.querySelectorAll('#topmenu > li.open').forEach((li) => li.classList.remove('open'));
		});
	}
});
