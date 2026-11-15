use std::cell::RefCell;
use std::mem::size_of;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use rp_speller_core::config::Config;
use rp_speller_core::hotkey;
use rp_speller_core::{Corrector, Edit, WordStore};
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS, HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Threading::CreateMutexW;
use windows::Win32::UI::Controls::{InitCommonControlsEx, LoadIconMetric, ICC_HOTKEY_CLASS, ICC_LINK_CLASS, ICC_STANDARD_CLASSES, ICC_UPDOWN_CLASS, INITCOMMONCONTROLSEX, LIM_LARGE, LIM_SMALL};
use windows::Win32::UI::Input::KeyboardAndMouse::{RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS, MOD_NOREPEAT};
use windows::Win32::UI::WindowsAndMessaging::{
    AllowSetForegroundWindow, AppendMenuW, CreatePopupMenu, FindWindowW, GetWindowThreadProcessId, WM_APP, WM_CLOSE, CreateWindowExW, DefWindowProcW, DestroyMenu, DestroyWindow, DispatchMessageW, GetMessageW, IsChild,
    IsDialogMessageW, KillTimer, PostMessageW, PostQuitMessage, RegisterClassExW, RegisterWindowMessageW, SetForegroundWindow,
    SetMenuDefaultItem, SetTimer, TrackPopupMenu, TranslateMessage, HICON, MB_ICONINFORMATION, MB_OK, MF_CHECKED, MF_SEPARATOR, MF_STRING,
    MF_UNCHECKED, MSG, TPM_NONOTIFY, TPM_RETURNCMD, TPM_RIGHTBUTTON, WM_CONTEXTMENU, WM_DESTROY, WM_ENDSESSION, WM_HOTKEY,
    WM_LBUTTONDBLCLK, WM_NULL, WM_QUERYENDSESSION, WM_TIMER, WNDCLASSEXW, WS_EX_TOOLWINDOW, WS_POPUP,
};

use crate::net::{take_done, Done, Worker, WM_SPELLER};
use crate::overlay::{Overlay, GREEN, GREY, T_ENTER, T_FLUSH};
use crate::tray::{Tray, WM_TRAY};
use crate::win::{hinstance, hiword, loword, message_box, shell_open, wide};
use crate::{clipboard, game, log, settings};

const MAIN_CLASS: PCWSTR = w!("RPSpellerMain");
const HOTKEY_ID: i32 = 1;
const T_SAVE: usize = 10;
const ENTER_WAIT_MS: u32 = 2000;
const T_CLIP: usize = 11;
const ID_OPEN: usize = 201;
const ID_TOGGLE: usize = 202;
const ID_SETTINGS: usize = 203;
const ID_LOGS: usize = 204;
const ID_YANDEX: usize = 205;
const ID_EXIT: usize = 206;
const WM_SHOW_SETTINGS: u32 = WM_APP + 3;
const NIN_SELECT: u32 = 0x400;
const NIN_KEYSELECT: u32 = 0x401;

static TASKBAR_CREATED: AtomicU32 = AtomicU32::new(0);

thread_local! {
    static APP: RefCell<Option<App>> = const { RefCell::new(None) };
}

pub fn with_app<R>(f: impl FnOnce(&mut App) -> R) -> Option<R> {
    APP.with(|c| c.try_borrow_mut().ok().and_then(|mut g| g.as_mut().map(f)))
}

fn config_path() -> PathBuf {
    log::folder().join("config.json")
}

pub struct App {
    main: HWND,
    cfg: Config,
    corrector: Corrector,
    worker: Worker,
    tray: Tray,
    overlay: Overlay,
    icon_small: HICON,
    icon_big: HICON,
    hotkey_ok: bool,
    game: Option<HWND>,
    chat_opened: bool,
    sending: bool,
    waiting_enter: bool,
    flush_armed: bool,
    clip_restore: Option<(String, Option<String>)>,
}

impl App {
    fn apply_settings(&mut self) {
        self.corrector.enabled = self.cfg.autocorrect;
        self.corrector.store.set_extra(&self.cfg.words);
    }

    fn register_hotkey(&mut self, announce: bool) {
        unsafe {
            let _ = UnregisterHotKey(Some(self.main), HOTKEY_ID);
        }
        self.hotkey_ok = match hotkey::parse(&self.cfg.hotkey) {
            Some(h) => unsafe { RegisterHotKey(Some(self.main), HOTKEY_ID, HOT_KEY_MODIFIERS(h.mods) | MOD_NOREPEAT, h.vk) }.is_ok(),
            None => false,
        };
        if !self.hotkey_ok {
            log::write(format!("RegisterHotKey({}) failed — the key is probably taken by another program", self.cfg.hotkey));
            self.tray.balloon(&format!("Клавиша {} занята другой программой. Выбери другую в настройках.", self.cfg.hotkey), true);
        } else if announce {
            self.tray.balloon(&format!("Работаю. {} — открыть окно чата в игре.", self.cfg.hotkey), false);
        }
    }

    fn save_config(&self) {
        if let Err(e) = self.cfg.save(&config_path()) {
            log::write(format!("config save failed: {e}"));
        }
    }

    fn toggle_autocorrect(&mut self) {
        self.cfg.autocorrect = !self.cfg.autocorrect;
        self.save_config();
        self.apply_settings();
    }

    pub fn apply_form(&mut self, cfg: Config) {
        self.cfg = cfg;
        self.save_config();
        self.apply_settings();
        self.register_hotkey(false);
    }

    pub fn on_hotkey(&mut self) {
        if self.overlay.visible() {
            self.overlay.activate();
            return;
        }
        self.game = game::find();
        self.chat_opened = false;
        match self.game {
            Some(g) => {
                self.chat_opened = game::open_chat(&self.cfg, g);
                log::write(format!("hotkey: game found, chat opened: {}", self.chat_opened));
            }
            None => log::write("hotkey: game window not found"),
        }
        self.corrector.reset();
        self.sending = false;
        self.waiting_enter = false;
        self.flush_armed = false;
        self.overlay.show_over(game::bounds(self.game));
    }

    pub fn on_typed(&mut self, c: char) {
        if self.sending || !self.overlay.visible() {
            return;
        }
        let (text, caret) = self.overlay.text();
        if let Some(e) = self.corrector.typed(&text, caret, c) {
            self.apply(vec![e]);
        }
        if self.corrector.has_queue() && !self.flush_armed {
            self.flush_armed = true;
            self.overlay.timer(T_FLUSH, 120);
        }
    }

    fn apply(&mut self, edits: Vec<Edit>) {
        let Some(last) = edits.last() else { return };
        self.overlay.apply_edits(&edits);
        let shown = edits.iter().find(|e| e.undoable).unwrap_or(last);
        let tail = if shown.undoable { "   ·   Backspace — вернуть" } else { "" };
        let arrow = self.overlay.arrow();
        self.overlay.flash(&format!("{} {arrow} {}{tail}", shown.from, shown.text), GREEN);
        let list: Vec<String> = edits.iter().map(|e| format!("{} → {}", e.from, e.text)).collect();
        log::write(format!("fixed: {}", list.join(", ")));
    }

    pub fn on_backspace(&mut self) -> bool {
        if self.sending || !self.overlay.visible() || self.overlay.has_selection() {
            return false;
        }
        let (text, caret) = self.overlay.text();
        let Some(undo) = self.corrector.backspace(&text, caret) else { return false };
        self.overlay.apply_edits(std::slice::from_ref(&undo));
        self.overlay.flash(&format!("вернул «{}» — больше не трогаю это слово", undo.text), GREY);
        log::write(format!("kept: {}", undo.text));
        true
    }

    fn flush(&mut self) {
        while self.corrector.has_queue() {
            let batch = self.corrector.take_batch();
            if !self.worker.submit(batch.clone()) {
                let _ = self.corrector.complete_batch(&batch, Err("worker stopped".into()));
            }
        }
    }

    pub fn on_overlay_timer(&mut self, id: usize) {
        match id {
            T_FLUSH => {
                self.overlay.kill_timer(T_FLUSH);
                self.flush_armed = false;
                self.flush();
            }
            T_ENTER => {
                self.overlay.kill_timer(T_ENTER);
                if self.waiting_enter {
                    log::write("speller is slow, sending without waiting");
                    self.finish_and_send();
                }
            }
            _ => {}
        }
    }

    fn on_speller(&mut self, done: Done) {
        let Done { words, result } = done;
        if let Err(e) = &result {
            log::write(format!("speller failed: {e}"));
        }
        let _ = self.corrector.complete_batch(&words, result);
        if !self.overlay.visible() {
            return;
        }
        if self.waiting_enter {
            if !self.corrector.busy() {
                self.finish_and_send();
            }
            return;
        }
        if self.sending {
            return;
        }
        let (text, caret) = self.overlay.text();
        let edits = self.corrector.resolve(&text, caret);
        self.apply(edits);
    }

    pub fn on_enter(&mut self) {
        if self.sending {
            return;
        }
        self.sending = true;
        self.overlay.kill_timer(T_FLUSH);
        self.flush_armed = false;
        self.overlay.set_status("проверяю…", GREY);
        let (text, _) = self.overlay.text();
        self.corrector.prepare_finish(&text);
        self.flush();
        if self.corrector.busy() {
            self.waiting_enter = true;
            self.overlay.timer(T_ENTER, ENTER_WAIT_MS);
        } else {
            self.finish_and_send();
        }
    }

    fn finish_and_send(&mut self) {
        self.waiting_enter = false;
        self.overlay.kill_timer(T_ENTER);
        let (text, _) = self.overlay.text();
        let edits = self.corrector.finish(&text);
        self.apply(edits);
        let (text, _) = self.overlay.text();
        let message = text.iter().collect::<String>().trim().to_string();
        self.overlay.hide();
        if message.is_empty() {
            self.cancel_chat();
        } else {
            self.submit(&message);
        }
        self.sending = false;
    }

    pub fn on_escape(&mut self) {
        self.waiting_enter = false;
        self.sending = false;
        self.flush_armed = false;
        self.overlay.hide();
        self.cancel_chat();
    }

    fn cancel_chat(&mut self) {
        if self.chat_opened
            && let Some(g) = game::alive(self.game)
        {
            game::close_chat(&self.cfg, g);
        }
        self.chat_opened = false;
    }

    fn submit(&mut self, text: &str) {
        if game::alive(self.game).is_none() {
            self.game = game::find();
        }
        if let Some(g) = self.game
            && !self.chat_opened
        {
            self.chat_opened = game::open_chat(&self.cfg, g);
        }
        let result = game::send(&self.cfg, self.game, self.main, text);
        self.chat_opened = false;
        match result {
            Ok(sent) => {
                log::write(format!("sent {} chars", text.chars().count()));
                if let Some(previous) = sent.restore {
                    self.clip_restore = Some((text.to_string(), previous));
                    unsafe {
                        SetTimer(Some(self.main), T_CLIP, 800, None);
                    }
                }
            }
            Err(e) => {
                log::write(format!("send failed: {e}"));
                clipboard::set_text(self.main, text, false);
                self.tray.balloon(&format!("Не получилось отправить: {e}. Текст в буфере — вставь Ctrl+V."), true);
            }
        }
    }

    fn restore_clipboard(&mut self) {
        unsafe {
            let _ = KillTimer(Some(self.main), T_CLIP);
        }
        let Some((ours, previous)) = self.clip_restore.take() else { return };
        if clipboard::get_text(self.main).as_deref() == Some(ours.as_str()) {
            match previous {
                Some(p) => {
                    clipboard::set_text(self.main, &p, true);
                }
                None => {
                    clipboard::clear(self.main);
                }
            }
        }
    }

    fn save_store(&mut self) {
        if self.corrector.store.is_dirty()
            && let Err(e) = self.corrector.store.save()
        {
            log::write(format!("cache save failed: {e}"));
        }
    }

    fn shutdown(&mut self) {
        self.restore_clipboard();
        self.save_store();
        unsafe {
            let _ = UnregisterHotKey(Some(self.main), HOTKEY_ID);
            let _ = KillTimer(Some(self.main), T_SAVE);
        }
        self.tray.remove();
        log::write("exit");
    }
}

fn open_settings() {
    if let Some((cfg, small, big)) = with_app(|a| (a.cfg.clone(), a.icon_small, a.icon_big)) {
        settings::open(&cfg, small, big);
    }
}

fn exit(main: HWND) {
    with_app(|a| a.shutdown());
    settings::close();
    unsafe {
        let _ = DestroyWindow(main);
    }
}

fn show_menu(main: HWND, x: i32, y: i32) {
    let autocorrect = with_app(|a| a.cfg.autocorrect).unwrap_or(true);
    let cmd = unsafe {
        let Ok(menu) = CreatePopupMenu() else { return };
        let check = if autocorrect { MF_CHECKED } else { MF_UNCHECKED };
        let _ = AppendMenuW(menu, MF_STRING, ID_OPEN, w!("Открыть окно чата"));
        let _ = AppendMenuW(menu, MF_STRING | check, ID_TOGGLE, w!("Исправлять ошибки"));
        let _ = AppendMenuW(menu, MF_STRING, ID_SETTINGS, w!("Настройки…"));
        let _ = AppendMenuW(menu, MF_STRING, ID_LOGS, w!("Папка с логами"));
        let _ = AppendMenuW(menu, MF_SEPARATOR, 0, PCWSTR::null());
        let _ = AppendMenuW(menu, MF_STRING, ID_YANDEX, w!("Проверка правописания: Яндекс.Спеллер"));
        let _ = AppendMenuW(menu, MF_STRING, ID_EXIT, w!("Выход"));
        let _ = SetMenuDefaultItem(menu, ID_SETTINGS as u32, 0);
        let _ = SetForegroundWindow(main);
        let cmd = TrackPopupMenu(menu, TPM_RETURNCMD | TPM_RIGHTBUTTON | TPM_NONOTIFY, x, y, None, main, None).0 as usize;
        let _ = PostMessageW(Some(main), WM_NULL, WPARAM(0), LPARAM(0));
        let _ = DestroyMenu(menu);
        cmd
    };
    match cmd {
        ID_OPEN => {
            with_app(|a| a.on_hotkey());
        }
        ID_TOGGLE => {
            with_app(|a| a.toggle_autocorrect());
        }
        ID_SETTINGS => open_settings(),
        ID_LOGS => {
            let dir = log::folder();
            let _ = std::fs::create_dir_all(&dir);
            shell_open(&dir.to_string_lossy());
        }
        ID_YANDEX => shell_open(settings::SPELLER_URL),
        ID_EXIT => exit(main),
        _ => {}
    }
}

unsafe extern "system" fn main_proc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_HOTKEY => {
                with_app(|a| a.on_hotkey());
                LRESULT(0)
            }
            WM_SPELLER => {
                if with_app(|a| a.on_speller(*take_done(lp))).is_none() {
                    let _ = PostMessageW(Some(hwnd), WM_SPELLER, wp, lp);
                }
                LRESULT(0)
            }
            WM_TRAY => {
                match loword(lp.0 as usize) as u32 {
                    WM_CONTEXTMENU => {
                        let x = loword(wp.0) as i16 as i32;
                        let y = hiword(wp.0) as i16 as i32;
                        show_menu(hwnd, x, y);
                    }
                    WM_LBUTTONDBLCLK => open_settings(),
                    NIN_SELECT | NIN_KEYSELECT => {}
                    _ => {}
                }
                LRESULT(0)
            }
            WM_TIMER => {
                match wp.0 {
                    T_SAVE => {
                        with_app(|a| a.save_store());
                    }
                    T_CLIP => {
                        with_app(|a| a.restore_clipboard());
                    }
                    _ => {}
                }
                LRESULT(0)
            }
            WM_SHOW_SETTINGS => {
                open_settings();
                LRESULT(0)
            }
            WM_CLOSE => {
                exit(hwnd);
                LRESULT(0)
            }
            WM_QUERYENDSESSION => LRESULT(1),
            WM_ENDSESSION => {
                if wp.0 != 0 {
                    with_app(|a| a.shutdown());
                }
                LRESULT(0)
            }
            WM_DESTROY => {
                PostQuitMessage(0);
                LRESULT(0)
            }
            m if m != 0 && m == TASKBAR_CREATED.load(Ordering::Relaxed) => {
                with_app(|a| a.tray.add("RP Speller"));
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wp, lp),
        }
    }
}

fn load_icon(size: windows::Win32::UI::Controls::_LI_METRIC) -> HICON {
    unsafe { LoadIconMetric(Some(hinstance()), PCWSTR(std::ptr::without_provenance(1)), size).unwrap_or_default() }
}

pub fn run() -> i32 {
    std::panic::set_hook(Box::new(|info| log::write(format!("panic: {info}"))));
    unsafe {
        let _mutex = CreateMutexW(None, true, w!("RPSpeller-single-instance"));
        if GetLastError() == ERROR_ALREADY_EXISTS {
            match FindWindowW(MAIN_CLASS, PCWSTR::null()) {
                Ok(other) if !other.0.is_null() => {
                    let mut pid = 0u32;
                    GetWindowThreadProcessId(other, Some(&mut pid));
                    let _ = AllowSetForegroundWindow(pid);
                    let _ = PostMessageW(Some(other), WM_SHOW_SETTINGS, WPARAM(0), LPARAM(0));
                }
                _ => message_box(None, "RP Speller уже запущен — значок в трее рядом с часами.", MB_ICONINFORMATION | MB_OK),
            }
            return 0;
        }
        let icc = INITCOMMONCONTROLSEX {
            dwSize: size_of::<INITCOMMONCONTROLSEX>() as u32,
            dwICC: ICC_STANDARD_CLASSES | ICC_HOTKEY_CLASS | ICC_UPDOWN_CLASS | ICC_LINK_CLASS,
        };
        let _ = InitCommonControlsEx(&icc);
        TASKBAR_CREATED.store(RegisterWindowMessageW(w!("TaskbarCreated")), Ordering::Relaxed);
        let cfg = match Config::load(&config_path()) {
            Ok(c) => c,
            Err(e) => {
                log::write(format!("config read failed: {e}"));
                Config::default()
            }
        };
        let icon_small = load_icon(LIM_SMALL);
        let icon_big = load_icon(LIM_LARGE);
        let wc = WNDCLASSEXW {
            cbSize: size_of::<WNDCLASSEXW>() as u32,
            lpfnWndProc: Some(main_proc),
            hInstance: hinstance(),
            hIcon: icon_big,
            hIconSm: icon_small,
            lpszClassName: MAIN_CLASS,
            ..Default::default()
        };
        RegisterClassExW(&wc);
        let main = match CreateWindowExW(WS_EX_TOOLWINDOW, MAIN_CLASS, w!("RP Speller"), WS_POPUP, 0, 0, 0, 0, None, None, Some(hinstance()), None) {
            Ok(h) => h,
            Err(e) => {
                log::write(format!("main window failed: {e}"));
                return 1;
            }
        };
        let overlay = match Overlay::create() {
            Ok(o) => o,
            Err(e) => {
                log::write(format!("overlay window failed: {e}"));
                return 1;
            }
        };
        let mut tray = Tray::new(main, icon_small);
        if !tray.add("RP Speller") {
            log::write("tray icon failed");
        }
        let app = App {
            main,
            cfg,
            corrector: Corrector::new(WordStore::open(log::folder())),
            worker: Worker::start(main),
            tray,
            overlay,
            icon_small,
            icon_big,
            hotkey_ok: false,
            game: None,
            chat_opened: false,
            sending: false,
            waiting_enter: false,
            flush_armed: false,
            clip_restore: None,
        };
        APP.with(|c| *c.borrow_mut() = Some(app));
        with_app(|a| {
            a.apply_settings();
            a.register_hotkey(true);
            log::write(format!(
                "started, version {}, hotkey {}, chat key {}, words in cache {}",
                env!("CARGO_PKG_VERSION"),
                a.cfg.hotkey,
                a.cfg.chat_key,
                a.corrector.store.len()
            ));
        });
        SetTimer(Some(main), T_SAVE, 5000, None);
        let mut msg = MSG::default();
        loop {
            let r = GetMessageW(&mut msg, None, 0, 0).0;
            if r == 0 || r == -1 {
                break;
            }
            if let Some(s) = settings::hwnd()
                && (msg.hwnd == s || IsChild(s, msg.hwnd).as_bool())
                && IsDialogMessageW(s, &msg).as_bool()
            {
                continue;
            }
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        APP.with(|c| c.borrow_mut().take());
        let _ = wide("");
        0
    }
}
