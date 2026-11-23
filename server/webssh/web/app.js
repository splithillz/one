import { Terminal } from './vendor/xterm.mjs';
import { FitAddon } from './vendor/addon-fit.mjs';
import { WebLinksAddon } from './vendor/addon-web-links.mjs';
import { Unicode11Addon } from './vendor/addon-unicode11.mjs';

const $ = (id) => document.getElementById(id);
const ui = {
	login: $('login'), form: $('form'), user: $('user'), pass: $('pass'), submit: $('submit'), error: $('error'),
	host: $('host'), shell: $('shell'), state: $('state'), title: $('title'), term: $('term'),
	keys: $('keys'), keysBtn: $('keys-btn'), smaller: $('smaller'), bigger: $('bigger'), quit: $('quit'),
	overlay: $('overlay'), overlayTitle: $('overlay-title'), overlayText: $('overlay-text'),
	again: $('again'), relogin: $('relogin'), toast: $('toast'),
};

const store = {
	get(k) { try { return localStorage.getItem('webssh.' + k); } catch { return null; } },
	set(k, v) { try { localStorage.setItem('webssh.' + k, String(v)); } catch { /* приватный режим */ } },
};

const HIGH_WATER = 512 * 1024; // столько байт в очереди отрисовки — просим сервер подождать
const LOW_WATER = 128 * 1024;
const CHUNK = 32 * 1024;
const encoder = new TextEncoder();
const touch = matchMedia('(pointer: coarse)').matches;
const hostName = ui.host.textContent.trim();

const theme = {
	background: '#0b0c0d',
	foreground: '#e6e7e8',
	cursor: '#3fe0a1',
	cursorAccent: '#0b0c0d',
	selectionBackground: 'rgba(63, 224, 161, 0.30)',
	selectionInactiveBackground: 'rgba(255, 255, 255, 0.14)',
	scrollbarSliderBackground: 'rgba(255, 255, 255, 0.12)',
	scrollbarSliderHoverBackground: 'rgba(255, 255, 255, 0.20)',
	scrollbarSliderActiveBackground: 'rgba(255, 255, 255, 0.28)',
	black: '#1c1f21', red: '#ff7a66', green: '#46d37a', yellow: '#e8be5e',
	blue: '#6aa7ff', magenta: '#d58cff', cyan: '#4fd6c9', white: '#c4c7cb',
	brightBlack: '#6b7075', brightRed: '#ff9d8d', brightGreen: '#6fe39b', brightYellow: '#f3d389',
	brightBlue: '#93c1ff', brightMagenta: '#e3adff', brightCyan: '#7fe8de', brightWhite: '#f5f6f7',
};

const term = new Terminal({
	allowProposedApi: true, // нужен для term.unicode (ширина эмодзи и иероглифов)
	cursorBlink: true,
	cursorInactiveStyle: 'outline',
	fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--mono').trim() || 'monospace',
	fontSize: clampFont(Number(store.get('font')) || (touch ? 13 : 14)),
	lineHeight: 1.12,
	scrollback: 5000,
	macOptionIsMeta: true,
	theme,
});
const fit = new FitAddon();
term.loadAddon(fit);
term.loadAddon(new WebLinksAddon());
term.loadAddon(new Unicode11Addon());
term.unicode.activeVersion = '11';
term.open(ui.term);

let ws = null;         // текущий WebSocket
let live = false;      // оболочка открыта
let creds = null;      // логин и пароль живут только в памяти вкладки, для «Подключиться снова»
let sessions = 0;
const mods = { ctrl: false, alt: false };
const vv = window.visualViewport;
let frame = 0;

// ——— вход ———

ui.user.value = store.get('user') || 'root';
(ui.user.value ? ui.pass : ui.user).focus();

ui.form.addEventListener('submit', (e) => {
	e.preventDefault();
	const user = ui.user.value.trim();
	const password = ui.pass.value;
	if (!user || !password) {
		showError(user ? 'Введи пароль' : 'Введи пользователя');
		(user ? ui.pass : ui.user).focus();
		return;
	}
	creds = { user, password };
	store.set('user', user);
	connect();
});

function showError(msg) {
	ui.error.textContent = msg;
	ui.error.hidden = !msg;
}

function setBusy(busy) {
	ui.submit.disabled = busy;
	ui.submit.textContent = busy ? 'Подключаюсь…' : 'Войти';
}

function showLogin(msg) {
	live = false;
	creds = null;
	ui.pass.value = '';
	ui.overlay.hidden = true;
	ui.shell.classList.add('pre');
	ui.login.hidden = false;
	setBusy(false);
	showError(msg || '');
	document.title = `${hostName} · Web SSH`;
	ui.pass.focus();
}

// ——— соединение ———

function connect() {
	if (ws) {
		ws.onclose = null;
		ws.close();
	}
	setBusy(true);
	showError('');
	setState('wait');
	if (!ui.overlay.hidden) {
		ui.overlayTitle.textContent = 'Подключаюсь…';
		ui.overlayText.textContent = '';
		ui.again.disabled = true;
	}

	const url = new URL('ws', location.href);
	url.protocol = 'wss:';
	const sock = new WebSocket(url);
	sock.binaryType = 'arraybuffer';
	ws = sock;

	const flow = { pending: 0, paused: false };
	let ready = false;
	let failure = '';
	let exitCode = null;

	sock.onopen = () => {
		const size = fit.proposeDimensions() || { cols: 80, rows: 24 };
		sock.send(JSON.stringify({ type: 'auth', user: creds.user, password: creds.password, cols: size.cols, rows: size.rows }));
	};

	sock.onmessage = (e) => {
		if (typeof e.data !== 'string') {
			write(new Uint8Array(e.data), flow, sock);
			return;
		}
		let m;
		try { m = JSON.parse(e.data); } catch { return; }
		if (m.type === 'ready') {
			ready = true;
			onReady();
		} else if (m.type === 'error') {
			failure = m.message || 'Ошибка';
		} else if (m.type === 'exit') {
			exitCode = m.code;
		}
	};

	sock.onclose = () => {
		if (ws !== sock) return;
		ws = null;
		const wasLive = live;
		live = false;
		ui.again.disabled = false;
		if (!ready) {
			// не дошли до оболочки: неверный пароль, блокировка, sshd лежит, нет сети
			const msg = failure || 'Нет связи с сервером. Проверь интернет и что webssh запущен.';
			if (ui.login.hidden && !/парол|пользовател/i.test(msg)) {
				showOverlay('Не подключилось', msg, 'off');
			} else {
				showLogin(msg);
			}
			return;
		}
		if (!wasLive) return;
		if (exitCode !== null) {
			showOverlay('Сессия завершена', exitCode === 0 ? '' : `Код выхода ${exitCode}`, 'off');
		} else {
			showOverlay('Соединение потеряно', failure || 'Сеть пропала или вкладка долго спала.', 'off');
		}
	};
}

function onReady() {
	live = true;
	sessions += 1;
	setBusy(false);
	ui.pass.value = '';
	ui.login.hidden = true;
	ui.overlay.hidden = true;
	ui.shell.classList.remove('pre');
	setState('on');
	ui.title.textContent = `${creds.user}@${hostName}`;
	document.title = `${creds.user}@${hostName}`;
	if (sessions > 1) term.write('\r\n\x1b[2m— новая сессия —\x1b[0m\r\n');
	layout();
	sendResize();
	term.focus();
}

function showOverlay(title, text, state) {
	setState(state);
	ui.overlayTitle.textContent = title;
	ui.overlayText.textContent = text;
	ui.overlay.hidden = false;
	ui.again.focus();
}

function setState(s) {
	ui.state.className = 'state ' + s;
}

function write(bytes, flow, sock) {
	flow.pending += bytes.length;
	term.write(bytes, () => {
		flow.pending -= bytes.length;
		if (flow.paused && flow.pending < LOW_WATER) {
			flow.paused = false;
			control(sock, { type: 'resume' });
		}
	});
	if (!flow.paused && flow.pending > HIGH_WATER) {
		flow.paused = true;
		control(sock, { type: 'pause' });
	}
}

function control(sock, msg) {
	if (sock && sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(msg));
}

function send(text) {
	if (!text || !live || !ws || ws.readyState !== WebSocket.OPEN) return;
	const bytes = encoder.encode(text);
	for (let i = 0; i < bytes.length; i += CHUNK) ws.send(bytes.subarray(i, i + CHUNK));
}

function sendResize() {
	if (live) control(ws, { type: 'resize', cols: term.cols, rows: term.rows });
}

ui.again.addEventListener('click', () => {
	if (creds) connect();
	else showLogin();
});
ui.relogin.addEventListener('click', () => {
	if (ws) { ws.onclose = null; ws.close(); ws = null; }
	showLogin();
});
ui.quit.addEventListener('click', () => {
	if (ws) { ws.onclose = null; ws.close(); ws = null; }
	showLogin();
});

addEventListener('beforeunload', (e) => {
	// Ctrl+W в браузере закрывает вкладку раньше, чем терминал его увидит
	if (live) e.preventDefault();
});

// ——— ввод ———

term.onData((data) => send(applyMods(data)));
term.onBinary((data) => {
	if (!live || !ws || ws.readyState !== WebSocket.OPEN) return;
	ws.send(Uint8Array.from(data, (c) => c.charCodeAt(0) & 255));
});
term.onResize(sendResize);
term.onTitleChange((t) => { if (live) document.title = t || `${creds.user}@${hostName}`; });

term.attachCustomKeyEventHandler((e) => {
	if (e.type !== 'keydown') return true;
	const key = e.key.toLowerCase();
	const ctrl = e.ctrlKey && !e.altKey && !e.metaKey;
	if (ctrl && e.shiftKey && key === 'c') { copySelection(); return false; }
	if (ctrl && !e.shiftKey && key === 'c' && term.hasSelection()) {
		copySelection();
		term.clearSelection();
		return false;
	}
	// Ctrl+V и Ctrl+Shift+V — вставка браузером, а не ^V
	if (ctrl && key === 'v') return false;
	return true;
});

function applyMods(data) {
	if (!mods.ctrl && !mods.alt) return data;
	let out = data;
	if (mods.ctrl && data.length === 1) out = ctrlChar(data);
	if (mods.alt) out = '\x1b' + out;
	setMod('ctrl', false);
	setMod('alt', false);
	return out;
}

function ctrlChar(ch) {
	if (ch === ' ' || ch === '@') return '\x00';
	if (ch === '?') return '\x7f';
	const code = ch.toUpperCase().charCodeAt(0);
	return code >= 64 && code <= 95 ? String.fromCharCode(code - 64) : ch;
}

function setMod(name, on) {
	mods[name] = on;
	const b = ui.keys.querySelector(`[data-mod="${name}"]`);
	if (b) b.setAttribute('aria-pressed', String(on));
}

function specialKey(name) {
	const mod = 1 + (mods.alt ? 2 : 0) + (mods.ctrl ? 4 : 0);
	const app = term.modes.applicationCursorKeysMode;
	const cursor = (c) => (mod > 1 ? `\x1b[1;${mod}${c}` : app ? `\x1bO${c}` : `\x1b[${c}`);
	const tilde = (n) => (mod > 1 ? `\x1b[${n};${mod}~` : `\x1b[${n}~`);
	const alt = mods.alt ? '\x1b' : '';
	switch (name) {
		case 'esc': return alt + '\x1b';
		case 'tab': return alt + '\t';
		case 'up': return cursor('A');
		case 'down': return cursor('B');
		case 'right': return cursor('C');
		case 'left': return cursor('D');
		case 'home': return cursor('H');
		case 'end': return cursor('F');
		case 'pgup': return tilde(5);
		case 'pgdn': return tilde(6);
		case 'ctrl-c': return '\x03';
		default: return '';
	}
}

// Кнопки не забирают фокус у терминала, чтобы клавиатура телефона не пряталась.
let termHadFocus = false;
ui.keys.addEventListener('pointerdown', (e) => {
	if (!e.target.closest('button')) return;
	termHadFocus = document.activeElement === term.textarea;
	e.preventDefault();
});
ui.keys.addEventListener('mousedown', (e) => e.preventDefault());
ui.keys.addEventListener('click', (e) => {
	const b = e.target.closest('button');
	if (!b) return;
	if (b.dataset.mod) {
		setMod(b.dataset.mod, !mods[b.dataset.mod]);
	} else if (b.dataset.key === 'paste') {
		pasteClipboard();
	} else if (b.dataset.text) {
		send(applyMods(b.dataset.text));
	} else {
		const seq = specialKey(b.dataset.key);
		setMod('ctrl', false);
		setMod('alt', false);
		send(seq);
	}
	if (termHadFocus || !touch) term.focus();
});

function setKeysVisible(on) {
	ui.keys.hidden = !on;
	ui.keysBtn.setAttribute('aria-pressed', String(on));
	store.set('keys', on ? 1 : 0);
	layout();
}
ui.keysBtn.addEventListener('click', () => {
	setKeysVisible(ui.keys.hidden);
	if (!touch) term.focus();
});
const keysPref = store.get('keys');
setKeysVisible(keysPref === null ? touch : keysPref === '1');

// ——— буфер обмена ———

async function copySelection() {
	const text = term.getSelection();
	if (!text) return;
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		const ta = document.createElement('textarea');
		ta.value = text;
		ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
		document.body.append(ta);
		ta.select();
		try { document.execCommand('copy'); } catch { /* ничего не поделать */ }
		ta.remove();
		term.focus();
	}
	toast('Скопировано');
}

async function pasteClipboard() {
	try {
		const text = await navigator.clipboard.readText();
		if (text) term.paste(text);
	} catch {
		toast('Браузер не дал доступ к буферу. Вставь долгим нажатием на экран.');
	}
}

let toastTimer = 0;
function toast(msg) {
	ui.toast.textContent = msg;
	ui.toast.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1800);
}

// ——— размер шрифта и экрана ———

function clampFont(n) {
	return Math.min(28, Math.max(9, Math.round(n)));
}
function setFont(delta) {
	const size = clampFont(term.options.fontSize + delta);
	term.options.fontSize = size;
	store.set('font', size);
	layout();
}
ui.smaller.addEventListener('click', () => { setFont(-1); if (!touch) term.focus(); });
ui.bigger.addEventListener('click', () => { setFont(1); if (!touch) term.focus(); });

// Высота по видимой области: на телефоне клавиатура съедает низ экрана,
// и строка с курсором должна остаться над ней.
function layout() {
	cancelAnimationFrame(frame);
	frame = requestAnimationFrame(() => {
		if (vv) {
			document.documentElement.style.setProperty('--app-h', `${Math.round(vv.height)}px`);
			ui.shell.style.transform = vv.offsetTop ? `translateY(${Math.round(vv.offsetTop)}px)` : '';
		}
		try { fit.fit(); } catch { /* терминал ещё не виден */ }
	});
}
vv?.addEventListener('resize', layout);
vv?.addEventListener('scroll', layout);
addEventListener('resize', layout);
new ResizeObserver(layout).observe(ui.term);
document.fonts?.ready.then(layout);
layout();
