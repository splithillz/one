use std::cell::RefCell;
use std::collections::HashMap;
use std::mem::size_of;

use rp_speller_core::hotkey::{self, Hotkey, MOD_ALT, MOD_CONTROL, MOD_SHIFT, MOD_WIN};
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{BeginPaint, EndPaint, InvalidateRect, PAINTSTRUCT};
use windows::Win32::UI::Input::KeyboardAndMouse::{GetFocus, GetKeyState, ReleaseCapture, SetCapture, SetFocus, TrackMouseEvent, TME_LEAVE, TRACKMOUSEEVENT};
use windows::Win32::UI::Controls::WM_MOUSELEAVE;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, GetClientRect, GetParent, LoadCursorW, RegisterClassExW, SendMessageW, DLGC_WANTALLKEYS, DLGC_WANTARROWS,
    DLGC_WANTCHARS, HMENU, IDC_ARROW, IDC_HAND, WINDOW_EX_STYLE, WM_COMMAND, WM_ERASEBKGND, WM_GETDLGCODE, WM_KEYDOWN, WM_KILLFOCUS,
    WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MOUSEMOVE, WM_MOUSEWHEEL, WM_NCDESTROY, WM_PAINT, WM_SETCURSOR, WM_SETFOCUS, WM_SYSKEYDOWN,
    WNDCLASSEXW, WS_CHILD, WS_TABSTOP, WS_VISIBLE,
};

use crate::gfx::{hex, Align, Painter, Rgba, BOLD, NORMAL, SEMIBOLD};
use crate::win::{dpi_of, hiword, loword, shell_open};

const CLASS: PCWSTR = w!("RPSpellerCtl");
pub const CHANGED: u16 = 1;
const IDCANCEL: usize = 2;

pub const ACCENT: Rgba = hex(0x4CC47A, 1.0);
pub const INPUT_BG: Rgba = hex(0x1B1D22, 1.0);
pub const EDGE: Rgba = hex(0xFFFFFF, 0.13);
pub const TEXT: Rgba = hex(0xE8EAF0, 1.0);
pub const MUTED: Rgba = hex(0x8B93A5, 1.0);

pub enum Kind {
    Toggle { on: bool },
    Segmented { options: Vec<String>, selected: usize },
    Stepper { value: u32, min: u32, max: u32, step: u32, suffix: String },
    KeyCap { spec: String, capturing: bool, chat_only: bool },
    Link { text: String, url: String },
    Button { text: String, primary: bool },
}

struct Ctl {
    kind: Kind,
    bg: Rgba,
    hover: Option<i32>,
    pressed: bool,
}

thread_local! {
    static CTLS: RefCell<HashMap<isize, Ctl>> = RefCell::new(HashMap::new());
}

fn key(h: HWND) -> isize {
    h.0 as isize
}

fn with<R>(h: HWND, f: impl FnOnce(&mut Ctl) -> R) -> Option<R> {
    CTLS.with(|m| m.try_borrow_mut().ok().and_then(|mut g| g.get_mut(&key(h)).map(f)))
}

pub fn register() {
    unsafe {
        let wc = WNDCLASSEXW {
            cbSize: size_of::<WNDCLASSEXW>() as u32,
            lpfnWndProc: Some(ctl_proc),
            hInstance: crate::win::hinstance(),
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            lpszClassName: CLASS,
            ..Default::default()
        };
        RegisterClassExW(&wc);
    }
}

pub fn create(parent: HWND, id: i32, kind: Kind, bg: Rgba) -> HWND {
    let h = unsafe {
        CreateWindowExW(
            WINDOW_EX_STYLE(0),
            CLASS,
            w!(""),
            WS_CHILD | WS_VISIBLE | WS_TABSTOP,
            0,
            0,
            10,
            10,
            Some(parent),
            Some(HMENU(std::ptr::without_provenance_mut(id as isize as usize))),
            Some(crate::win::hinstance()),
            None,
        )
        .unwrap_or_default()
    };
    CTLS.with(|m| m.borrow_mut().insert(key(h), Ctl { kind, bg, hover: None, pressed: false }));
    h
}

pub fn toggle_value(h: HWND) -> bool {
    with(h, |c| matches!(c.kind, Kind::Toggle { on: true })).unwrap_or(false)
}

pub fn segment(h: HWND) -> usize {
    with(h, |c| if let Kind::Segmented { selected, .. } = c.kind { selected } else { 0 }).unwrap_or(0)
}

pub fn stepper_value(h: HWND) -> u32 {
    with(h, |c| if let Kind::Stepper { value, .. } = c.kind { value } else { 0 }).unwrap_or(0)
}

pub fn keycap_spec(h: HWND) -> String {
    with(h, |c| if let Kind::KeyCap { spec, .. } = &c.kind { spec.clone() } else { String::new() }).unwrap_or_default()
}

fn notify(h: HWND) {
    unsafe {
        if let Ok(parent) = GetParent(h) {
            let id = windows::Win32::UI::WindowsAndMessaging::GetDlgCtrlID(h) as usize & 0xFFFF;
            SendMessageW(parent, WM_COMMAND, Some(WPARAM(id | (CHANGED as usize) << 16)), Some(LPARAM(h.0 as isize)));
        }
    }
}

fn redraw(h: HWND) {
    unsafe {
        let _ = InvalidateRect(Some(h), None, false);
    }
}

fn size(h: HWND) -> (f32, f32) {
    let mut rc = RECT::default();
    unsafe {
        let _ = GetClientRect(h, &mut rc);
    }
    (rc.right as f32, rc.bottom as f32)
}

fn part_at(h: HWND, x: i32) -> i32 {
    let (w, _) = size(h);
    with(h, |c| match &c.kind {
        Kind::Segmented { options, .. } => ((x as f32 / (w / options.len().max(1) as f32)) as i32).clamp(0, options.len() as i32 - 1),
        Kind::Stepper { .. } => {
            let s = dpi_of(h) as f32 / 96.0;
            if (x as f32) < 32.0 * s {
                0
            } else if (x as f32) > w - 32.0 * s {
                2
            } else {
                1
            }
        }
        _ => 0,
    })
    .unwrap_or(0)
}

fn step(h: HWND, dir: i32, times: u32) {
    let changed = with(h, |c| {
        if let Kind::Stepper { value, min, max, step, .. } = &mut c.kind {
            let delta = (*step * times) as i64 * dir as i64;
            let next = (*value as i64 + delta).clamp(*min as i64, *max as i64) as u32;
            let changed = next != *value;
            *value = next;
            changed
        } else {
            false
        }
    })
    .unwrap_or(false);
    if changed {
        redraw(h);
        notify(h);
    }
}

fn activate(h: HWND) {
    let mut open: Option<String> = None;
    let mut click = false;
    let mut changed = false;
    with(h, |c| match &mut c.kind {
        Kind::Toggle { on } => {
            *on = !*on;
            changed = true;
        }
        Kind::KeyCap { capturing, .. } => *capturing = true,
        Kind::Link { url, .. } => open = Some(url.clone()),
        Kind::Button { .. } => click = true,
        _ => {}
    });
    redraw(h);
    if let Some(u) = open {
        shell_open(&u);
    }
    if changed || click {
        notify(h);
    }
}

fn capture_key(h: HWND, vk: u32) -> bool {
    let Some((capturing, chat_only)) = with(h, |c| if let Kind::KeyCap { capturing, chat_only, .. } = c.kind { Some((capturing, chat_only)) } else { None }).flatten() else {
        return false;
    };
    if !capturing {
        return false;
    }
    if matches!(vk, 0x10 | 0x11 | 0x12 | 0x5B | 0x5C | 0xA0..=0xA5) {
        return true;
    }
    if vk == 0x1B {
        with(h, |c| {
            if let Kind::KeyCap { capturing, .. } = &mut c.kind {
                *capturing = false;
            }
        });
        redraw(h);
        return true;
    }
    let down = |k: i32| unsafe { GetKeyState(k) } < 0;
    let spec = if chat_only {
        if !(matches!(vk, 0x30..=0x39 | 0x41..=0x5A)) {
            return true;
        }
        hotkey::vk_name(vk)
    } else {
        let mut mods = 0;
        if down(0x11) {
            mods |= MOD_CONTROL;
        }
        if down(0x12) {
            mods |= MOD_ALT;
        }
        if down(0x10) {
            mods |= MOD_SHIFT;
        }
        if down(0x5B) || down(0x5C) {
            mods |= MOD_WIN;
        }
        hotkey::format(Hotkey { mods, vk })
    };
    with(h, |c| {
        if let Kind::KeyCap { spec: s, capturing, .. } = &mut c.kind {
            *s = spec;
            *capturing = false;
        }
    });
    redraw(h);
    notify(h);
    true
}

fn paint(h: HWND) {
    unsafe {
        let mut ps = PAINTSTRUCT::default();
        let hdc = BeginPaint(h, &mut ps);
        let (w, ht) = size(h);
        let s = dpi_of(h) as f32 / 96.0;
        let focused = GetFocus() == h;
        CTLS.with(|m| {
            let Ok(g) = m.try_borrow() else { return };
            let Some(c) = g.get(&key(h)) else { return };
            let Some(p) = Painter::begin(hdc, w as i32, ht as i32, false) else { return };
            p.clear(c.bg);
            let ring = |p: &Painter, r: f32| {
                if focused {
                    p.stroke_round(0.0, 0.0, w, ht, r, 2.0 * s, hex(0x8FB4FF, 0.9));
                }
            };
            match &c.kind {
                Kind::Toggle { on } => {
                    let tw = 42.0 * s;
                    let th = 24.0 * s;
                    let x = w - tw - 2.0 * s;
                    let y = (ht - th) / 2.0;
                    p.fill_round(x, y, tw, th, th / 2.0, if *on { ACCENT } else { hex(0x3A3D46, 1.0) });
                    let kx = if *on { x + tw - th / 2.0 } else { x + th / 2.0 };
                    p.dot(kx, y + th / 2.0, th / 2.0 - 3.0 * s, hex(0xFFFFFF, 1.0));
                    if focused {
                        p.stroke_round(x - 3.0 * s, y - 3.0 * s, tw + 6.0 * s, th + 6.0 * s, th / 2.0 + 3.0 * s, 2.0 * s, hex(0x8FB4FF, 0.9));
                    }
                }
                Kind::Segmented { options, selected } => {
                    let r = 8.0 * s;
                    p.fill_round(0.0, 0.0, w, ht, r, INPUT_BG);
                    p.stroke_round(0.0, 0.0, w, ht, r, 1.0, EDGE);
                    let cw = w / options.len().max(1) as f32;
                    for (i, o) in options.iter().enumerate() {
                        let x = i as f32 * cw;
                        let sel = i == *selected;
                        if sel {
                            p.fill_round(x + 3.0 * s, 3.0 * s, cw - 6.0 * s, ht - 6.0 * s, r - 2.0 * s, hex(0x343843, 1.0));
                        } else if c.hover == Some(i as i32) {
                            p.fill_round(x + 3.0 * s, 3.0 * s, cw - 6.0 * s, ht - 6.0 * s, r - 2.0 * s, hex(0xFFFFFF, 0.04));
                        }
                        p.text(o, x, 0.0, cw, ht, 13.0 * s, if sel { SEMIBOLD } else { NORMAL }, if sel { TEXT } else { MUTED }, Align::Center);
                    }
                    ring(&p, r);
                }
                Kind::Stepper { value, suffix, .. } => {
                    let r = 8.0 * s;
                    p.fill_round(0.0, 0.0, w, ht, r, INPUT_BG);
                    p.stroke_round(0.0, 0.0, w, ht, r, 1.0, EDGE);
                    let side = 32.0 * s;
                    for (part, x) in [(0, 0.0), (2, w - side)] {
                        if c.hover == Some(part) {
                            p.fill_round(x + 2.0 * s, 2.0 * s, side - 4.0 * s, ht - 4.0 * s, r - 2.0 * s, hex(0xFFFFFF, 0.06));
                        }
                    }
                    p.line(side, 6.0 * s, side, ht - 6.0 * s, 1.0, EDGE);
                    p.line(w - side, 6.0 * s, w - side, ht - 6.0 * s, 1.0, EDGE);
                    p.text("−", 0.0, 0.0, side, ht, 15.0 * s, NORMAL, TEXT, Align::Center);
                    p.text("+", w - side, 0.0, side, ht, 15.0 * s, NORMAL, TEXT, Align::Center);
                    p.text(&format!("{value} {suffix}"), side, 0.0, w - 2.0 * side, ht, 13.0 * s, SEMIBOLD, TEXT, Align::Center);
                    ring(&p, r);
                }
                Kind::KeyCap { spec, capturing, .. } => {
                    let r = 8.0 * s;
                    p.fill_round(0.0, 0.0, w, ht, r, INPUT_BG);
                    let edge = if *capturing { ACCENT } else { hex(0xFFFFFF, 0.18) };
                    p.stroke_round(0.0, 0.0, w, ht, r, if *capturing { 1.5 * s } else { 1.0 }, edge);
                    p.line(5.0 * s, ht - 1.0, w - 5.0 * s, ht - 1.0, 1.5 * s, edge);
                    if *capturing {
                        p.text("Нажми клавишу…", 0.0, 0.0, w, ht, 12.0 * s, NORMAL, MUTED, Align::Center);
                    } else {
                        p.text(spec, 0.0, 0.0, w, ht, 14.0 * s, BOLD, TEXT, Align::Center);
                    }
                    if focused && !*capturing {
                        ring(&p, r);
                    }
                }
                Kind::Link { text, .. } => {
                    let tw = crate::gfx::measure(text, 13.0 * s, NORMAL);
                    let color = hex(0x8FB4FF, 1.0);
                    p.text(text, 0.0, 0.0, w, ht, 13.0 * s, NORMAL, color, Align::Left);
                    if c.hover.is_some() || focused {
                        p.line(0.0, ht * 0.5 + 9.0 * s, tw, ht * 0.5 + 9.0 * s, 1.0, color);
                    }
                }
                Kind::Button { text, primary } => {
                    let r = 8.0 * s;
                    let (mut bg, fg) = if *primary { (ACCENT, hex(0x0E1A12, 1.0)) } else { (hex(0x2C2F37, 1.0), TEXT) };
                    if c.pressed {
                        bg = Rgba(bg.0 * 0.85, bg.1 * 0.85, bg.2 * 0.85, 1.0);
                    } else if c.hover.is_some() {
                        bg = Rgba((bg.0 * 1.08).min(1.0), (bg.1 * 1.08).min(1.0), (bg.2 * 1.08).min(1.0), 1.0);
                    }
                    p.fill_round(0.0, 0.0, w, ht, r, bg);
                    p.text(text, 0.0, 0.0, w, ht, 13.5 * s, SEMIBOLD, fg, Align::Center);
                    if focused {
                        p.stroke_round(0.0, 0.0, w, ht, r, 2.0 * s, hex(0x8FB4FF, 0.9));
                    }
                }
            }
            p.end();
        });
        let _ = EndPaint(h, &ps);
    }
}

unsafe extern "system" fn ctl_proc(h: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_PAINT => {
                paint(h);
                LRESULT(0)
            }
            WM_ERASEBKGND => LRESULT(1),
            WM_GETDLGCODE => {
                let code = with(h, |c| match &c.kind {
                    Kind::KeyCap { capturing: true, .. } | Kind::Button { .. } => DLGC_WANTALLKEYS,
                    Kind::Segmented { .. } | Kind::Stepper { .. } => DLGC_WANTARROWS | DLGC_WANTCHARS,
                    _ => DLGC_WANTCHARS,
                })
                .unwrap_or(0);
                LRESULT(code as isize)
            }
            WM_SETFOCUS => {
                redraw(h);
                LRESULT(0)
            }
            WM_KILLFOCUS => {
                with(h, |c| {
                    if let Kind::KeyCap { capturing, .. } = &mut c.kind {
                        *capturing = false;
                    }
                });
                redraw(h);
                LRESULT(0)
            }
            WM_SETCURSOR => {
                let hand = with(h, |c| matches!(c.kind, Kind::Link { .. } | Kind::Button { .. } | Kind::Toggle { .. } | Kind::Segmented { .. })).unwrap_or(false);
                let cur = if hand { IDC_HAND } else { IDC_ARROW };
                if let Ok(c) = LoadCursorW(None, cur) {
                    windows::Win32::UI::WindowsAndMessaging::SetCursor(Some(c));
                }
                LRESULT(1)
            }
            WM_MOUSEMOVE => {
                let part = part_at(h, loword(lp.0 as usize) as i16 as i32);
                let changed = with(h, |c| {
                    let before = c.hover;
                    c.hover = Some(part);
                    before != c.hover
                })
                .unwrap_or(false);
                if changed {
                    let mut t = TRACKMOUSEEVENT { cbSize: size_of::<TRACKMOUSEEVENT>() as u32, dwFlags: TME_LEAVE, hwndTrack: h, dwHoverTime: 0 };
                    let _ = TrackMouseEvent(&mut t);
                    redraw(h);
                }
                LRESULT(0)
            }
            WM_MOUSELEAVE => {
                with(h, |c| {
                    c.hover = None;
                    c.pressed = false;
                });
                redraw(h);
                LRESULT(0)
            }
            WM_LBUTTONDOWN => {
                let _ = SetFocus(Some(h));
                SetCapture(h);
                let part = part_at(h, loword(lp.0 as usize) as i16 as i32);
                let segment_changed = with(h, |c| {
                    c.pressed = true;
                    if let Kind::Segmented { selected, .. } = &mut c.kind {
                        let changed = *selected != part as usize;
                        *selected = part as usize;
                        changed
                    } else {
                        false
                    }
                })
                .unwrap_or(false);
                if segment_changed {
                    notify(h);
                }
                if with(h, |c| matches!(c.kind, Kind::Stepper { .. })).unwrap_or(false) {
                    match part {
                        0 => step(h, -1, 1),
                        2 => step(h, 1, 1),
                        _ => {}
                    }
                }
                redraw(h);
                LRESULT(0)
            }
            WM_LBUTTONUP => {
                let _ = ReleaseCapture();
                let was = with(h, |c| std::mem::replace(&mut c.pressed, false)).unwrap_or(false);
                let x = loword(lp.0 as usize) as i16 as i32;
                let y = hiword(lp.0 as usize) as i16 as i32;
                let (w, ht) = size(h);
                let inside = x >= 0 && y >= 0 && (x as f32) < w && (y as f32) < ht;
                if was && inside && with(h, |c| matches!(c.kind, Kind::Toggle { .. } | Kind::KeyCap { .. } | Kind::Link { .. } | Kind::Button { .. })).unwrap_or(false) {
                    activate(h);
                }
                redraw(h);
                LRESULT(0)
            }
            WM_MOUSEWHEEL => {
                let delta = hiword(wp.0) as i16;
                if with(h, |c| matches!(c.kind, Kind::Stepper { .. })).unwrap_or(false) {
                    step(h, if delta > 0 { 1 } else { -1 }, 1);
                }
                LRESULT(0)
            }
            WM_KEYDOWN | WM_SYSKEYDOWN => {
                let vk = wp.0 as u32;
                if capture_key(h, vk) {
                    return LRESULT(0);
                }
                if msg == WM_SYSKEYDOWN {
                    return DefWindowProcW(h, msg, wp, lp);
                }
                let kind = with(h, |c| match c.kind {
                    Kind::Toggle { .. } => 0,
                    Kind::Segmented { .. } => 1,
                    Kind::Stepper { .. } => 2,
                    Kind::KeyCap { .. } => 3,
                    Kind::Link { .. } => 4,
                    Kind::Button { .. } => 5,
                })
                .unwrap_or(-1);
                match (kind, vk) {
                    (0, 0x20) | (3, 0x20) | (3, 0x0D) | (4, 0x20) | (4, 0x0D) | (5, 0x20) | (5, 0x0D) => activate(h),
                    (5, 0x1B) => {
                        if let Ok(parent) = GetParent(h) {
                            SendMessageW(parent, WM_COMMAND, Some(WPARAM(IDCANCEL)), Some(LPARAM(0)));
                        }
                    }
                    (1, 0x25) | (1, 0x27) => {
                        let changed = with(h, |c| {
                            if let Kind::Segmented { options, selected } = &mut c.kind {
                                let next = if vk == 0x25 { selected.saturating_sub(1) } else { (*selected + 1).min(options.len() - 1) };
                                let changed = next != *selected;
                                *selected = next;
                                changed
                            } else {
                                false
                            }
                        })
                        .unwrap_or(false);
                        if changed {
                            redraw(h);
                            notify(h);
                        }
                    }
                    (2, 0x26) | (2, 0x27) | (2, 0x6B) | (2, 0xBB) => step(h, 1, 1),
                    (2, 0x28) | (2, 0x25) | (2, 0x6D) | (2, 0xBD) => step(h, -1, 1),
                    (2, 0x21) => step(h, 1, 10),
                    (2, 0x22) => step(h, -1, 10),
                    _ => return DefWindowProcW(h, msg, wp, lp),
                }
                LRESULT(0)
            }
            WM_NCDESTROY => {
                CTLS.with(|m| {
                    if let Ok(mut g) = m.try_borrow_mut() {
                        g.remove(&key(h));
                    }
                });
                DefWindowProcW(h, msg, wp, lp)
            }
            _ => DefWindowProcW(h, msg, wp, lp),
        }
    }
}
