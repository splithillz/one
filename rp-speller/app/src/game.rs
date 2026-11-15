use std::path::Path;

use rp_speller_core::config::{Config, InputMode};
use rp_speller_core::hotkey::chat_vk;
use windows::core::PWSTR;
use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, RECT};
use windows::Win32::System::Threading::{
    AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Input::KeyboardAndMouse::SetFocus;
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, EnumWindows, GetClassNameW, GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId, IsIconic, IsWindow,
    IsWindowVisible, SetForegroundWindow, ShowWindow, SW_RESTORE,
};
use windows::core::BOOL;

use crate::input::{self, sleep, tap, VK_ESCAPE, VK_MENU, VK_RETURN};
use crate::{clipboard, log, win};

const EXES: [&str; 2] = ["gta5", "gta5_enhanced"];

pub fn is_game_process(stem: &str) -> bool {
    let name = stem.to_lowercase();
    EXES.contains(&name.as_str()) || ((name.starts_with("fivem") || name.starts_with("cfx")) && name.contains("gtaprocess"))
}

fn class_name(h: HWND) -> String {
    let mut buf = [0u16; 256];
    let n = unsafe { GetClassNameW(h, &mut buf) }.max(0) as usize;
    String::from_utf16_lossy(&buf[..n])
}

fn process_stem(pid: u32) -> Option<String> {
    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).is_ok();
        let _ = CloseHandle(h);
        if !ok {
            return None;
        }
        let path = String::from_utf16_lossy(&buf[..len as usize]);
        Path::new(&path).file_stem().map(|s| s.to_string_lossy().into_owned())
    }
}

fn is_game(h: HWND) -> bool {
    if class_name(h) == "grcWindow" {
        return true;
    }
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(h, Some(&mut pid)) };
    pid != 0 && process_stem(pid).is_some_and(|s| is_game_process(&s))
}

struct Search {
    best: Option<HWND>,
    area: i64,
}

unsafe extern "system" fn each_window(h: HWND, lp: LPARAM) -> BOOL {
    let search = unsafe { &mut *(lp.0 as *mut Search) };
    unsafe {
        if !IsWindowVisible(h).as_bool() {
            return BOOL(1);
        }
        let mut r = RECT::default();
        if GetWindowRect(h, &mut r).is_err() {
            return BOOL(1);
        }
        let (w, ht) = ((r.right - r.left) as i64, (r.bottom - r.top) as i64);
        if w < 200 || ht < 200 || !is_game(h) {
            return BOOL(1);
        }
        if w * ht > search.area {
            search.area = w * ht;
            search.best = Some(h);
        }
    }
    BOOL(1)
}

pub fn find() -> Option<HWND> {
    let mut search = Search { best: None, area: 0 };
    unsafe {
        let _ = EnumWindows(Some(each_window), LPARAM(&mut search as *mut Search as isize));
    }
    search.best
}

pub fn alive(h: Option<HWND>) -> Option<HWND> {
    h.filter(|&h| unsafe { IsWindow(Some(h)).as_bool() })
}

pub fn bounds(h: Option<HWND>) -> RECT {
    let mut r = RECT::default();
    match h {
        Some(h) if unsafe { GetWindowRect(h, &mut r) }.is_ok() && r.right > r.left => r,
        _ => win::primary_work_area(),
    }
}

fn thread_of(h: HWND) -> u32 {
    if h.0.is_null() { 0 } else { unsafe { GetWindowThreadProcessId(h, None) } }
}

pub fn focus(hwnd: HWND) -> bool {
    unsafe {
        if !IsWindow(Some(hwnd)).as_bool() {
            return false;
        }
        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }
        for n in 0..3 {
            if GetForegroundWindow() == hwnd {
                return true;
            }
            let me = GetCurrentThreadId();
            let mut threads = vec![thread_of(GetForegroundWindow()), thread_of(hwnd)];
            threads.sort_unstable();
            threads.dedup();
            threads.retain(|&t| t != 0 && t != me);
            let attached: Vec<u32> = threads.into_iter().filter(|&t| AttachThreadInput(me, t, true).as_bool()).collect();
            if n > 0 {
                input::send(&[input::key(VK_MENU, false), input::key(VK_MENU, true)]);
            }
            let _ = BringWindowToTop(hwnd);
            let _ = SetForegroundWindow(hwnd);
            for t in attached {
                let _ = AttachThreadInput(me, t, false);
            }
            sleep(80);
        }
        GetForegroundWindow() == hwnd
    }
}

pub fn focus_own(window: HWND, child: HWND) -> bool {
    let ok = focus(window);
    unsafe {
        let _ = SetFocus(Some(child));
    }
    ok
}

fn delay(ms: u32) {
    sleep(ms.min(rp_speller_core::config::MAX_DELAY_MS));
}

pub fn open_chat(cfg: &Config, hwnd: HWND) -> bool {
    if !focus(hwnd) {
        log::write("could not focus the game to open the chat");
        return false;
    }
    delay(cfg.focus_delay_ms);
    tap(chat_vk(&cfg.chat_key));
    delay(cfg.open_delay_ms);
    unsafe { GetForegroundWindow() == hwnd }
}

pub fn close_chat(cfg: &Config, hwnd: HWND) {
    if !focus(hwnd) {
        return;
    }
    delay(cfg.focus_delay_ms);
    tap(VK_ESCAPE);
}

pub struct Sent {
    pub restore: Option<Option<String>>,
}

pub fn send(cfg: &Config, hwnd: Option<HWND>, owner: HWND, text: &str) -> Result<Sent, String> {
    let Some(hwnd) = alive(hwnd) else {
        return Err("окно игры не найдено".into());
    };
    if !focus(hwnd) {
        return Err("не получилось переключиться в игру (она запущена от администратора?)".into());
    }
    delay(cfg.focus_delay_ms);
    let mut restore = None;
    if cfg.input_mode == InputMode::Type {
        input::type_text(text);
    } else {
        let previous = clipboard::get_text(owner);
        if clipboard::set_text(owner, text, true) {
            input::paste();
            restore = Some(previous);
        } else {
            log::write("clipboard is busy, typing instead");
            input::type_text(text);
        }
    }
    delay(cfg.paste_delay_ms);
    if cfg.submit {
        if unsafe { GetForegroundWindow() } != hwnd {
            return Err("игра потеряла фокус во время ввода".into());
        }
        tap(VK_RETURN);
    }
    Ok(Sent { restore })
}
