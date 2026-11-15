use std::cell::{Cell, RefCell};
use std::ffi::c_void;
use std::mem::size_of;

use rp_speller_core::text::{char_index, chars_from_utf16, utf16_index};
use rp_speller_core::{apply, Edit};
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, CreatePen, CreateRoundRectRgn, CreateSolidBrush, DeleteDC, DeleteObject,
    DrawTextW, EndPaint, FillRect, GetStockObject, InvalidateRect, RoundRect, SelectObject, SetBkColor, SetBkMode, SetTextColor, SetWindowRgn,
    DT_END_ELLIPSIS, DT_NOPREFIX, DT_SINGLELINE, DT_VCENTER, HBRUSH, HDC, HFONT, HGDIOBJ, NULL_BRUSH, NULL_PEN, PAINTSTRUCT, PS_INSIDEFRAME,
    SRCCOPY, TRANSPARENT,
};
use windows::Win32::UI::Controls::{EM_GETSEL, EM_REPLACESEL, EM_SETLIMITTEXT, EM_SETMARGINS, EM_SETSEL};
use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, SetFocus};
use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, GetClientRect, IsWindowVisible, KillTimer, LoadCursorW, MoveWindow, PostMessageW, RegisterClassExW,
    SetTimer, SetWindowPos, ShowWindow, CS_HREDRAW, CS_VREDRAW,
    ES_AUTOHSCROLL, HMENU, HWND_TOPMOST, IDC_ARROW, SWP_NOACTIVATE, SW_HIDE, SW_SHOW, WINDOW_EX_STYLE, WINDOW_STYLE, WM_ACTIVATE, WM_APP,
    WM_CHAR, WM_CTLCOLOREDIT, WM_DPICHANGED, WM_ERASEBKGND, WM_KEYDOWN, WM_NCDESTROY, WM_PAINT, WM_TIMER, WNDCLASSEXW, WS_CHILD,
    WS_CLIPCHILDREN, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP, WS_VISIBLE,
};
use windows::Win32::UI::WindowsAndMessaging::{EC_LEFTMARGIN, EC_RIGHTMARGIN};

use crate::app::with_app;
use crate::win::{dpi_for_rect, has_glyphs, ui_font, dpi_of, hinstance, hiword, line_height, loword, rgb, scale, send, set_font, wide, window_text};
use crate::{game, log};

pub const OV_ENTER: u32 = WM_APP + 10;
pub const OV_ESCAPE: u32 = WM_APP + 11;
pub const T_FLUSH: usize = 1;
pub const T_STATUS: usize = 2;
pub const T_ENTER: usize = 3;

pub const HINT: &str = "Enter — отправить · Esc — отмена · Backspace сразу после исправления — вернуть";
pub const GREY: COLORREF = rgb(160, 166, 176);
pub const GREEN: COLORREF = rgb(143, 209, 138);
const BG: COLORREF = rgb(28, 30, 36);
const FIELD: COLORREF = rgb(40, 43, 51);
const WHITE: COLORREF = rgb(255, 255, 255);
const CLASS: PCWSTR = w!("RPSpellerOverlay");
const MAX_LEN: usize = 400;

const PAD_X: i32 = 14;
const PAD_TOP: i32 = 12;
const PAD_BOTTOM: i32 = 9;
const FIELD_PAD_X: i32 = 10;
const FIELD_PAD_Y: i32 = 7;
const GAP: i32 = 6;
const RADIUS: i32 = 16;
const FIELD_RADIUS: i32 = 12;

struct Ui {
    edit: HWND,
    dpi: u32,
    font_edit: HFONT,
    font_status: HFONT,
    bg: HBRUSH,
    field: HBRUSH,
    status: String,
    color: COLORREF,
    field_rect: RECT,
    status_rect: RECT,
    edit_line: i32,
    status_line: i32,
    dwm_round: bool,
    arrow: &'static str,
}

thread_local! {
    static UI: RefCell<Option<Ui>> = const { RefCell::new(None) };
    static FIELD_BRUSH: Cell<isize> = const { Cell::new(0) };
    static SWALLOW_BACK: Cell<bool> = const { Cell::new(false) };
}

fn ui<R>(f: impl FnOnce(&mut Ui) -> R) -> Option<R> {
    UI.with(|c| c.try_borrow_mut().ok().and_then(|mut g| g.as_mut().map(f)))
}

pub struct Overlay {
    pub hwnd: HWND,
    pub edit: HWND,
}

impl Overlay {
    pub fn create() -> Result<Self, String> {
        unsafe {
            let wc = WNDCLASSEXW {
                cbSize: size_of::<WNDCLASSEXW>() as u32,
                style: CS_HREDRAW | CS_VREDRAW,
                lpfnWndProc: Some(overlay_proc),
                hInstance: hinstance(),
                hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
                lpszClassName: CLASS,
                ..Default::default()
            };
            RegisterClassExW(&wc);
            let hwnd = CreateWindowExW(
                WS_EX_TOPMOST | WS_EX_TOOLWINDOW,
                CLASS,
                w!("RP Speller"),
                WS_POPUP | WS_CLIPCHILDREN,
                0,
                0,
                640,
                80,
                None,
                None,
                Some(hinstance()),
                None,
            )
            .map_err(|e| e.to_string())?;
            let edit = CreateWindowExW(
                WINDOW_EX_STYLE(0),
                w!("EDIT"),
                w!(""),
                WS_CHILD | WS_VISIBLE | WINDOW_STYLE(ES_AUTOHSCROLL as u32),
                0,
                0,
                100,
                20,
                Some(hwnd),
                Some(HMENU(std::ptr::without_provenance_mut(1))),
                Some(hinstance()),
                None,
            )
            .map_err(|e| e.to_string())?;
            send(edit, EM_SETLIMITTEXT, MAX_LEN, 0);
            let _ = SetWindowSubclass(edit, Some(edit_proc), 1, 0);
            let pref = DWMWCP_ROUND;
            let dwm_round = DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &pref as *const _ as *const c_void, 4).is_ok();
            if dwm_round {
                let c = GREEN;
                let _ = DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, &c as *const _ as *const c_void, 4);
            }
            let field = CreateSolidBrush(FIELD);
            FIELD_BRUSH.set(field.0 as isize);
            UI.with(|c| {
                *c.borrow_mut() = Some(Ui {
                    edit,
                    dpi: 0,
                    font_edit: HFONT::default(),
                    font_status: HFONT::default(),
                    bg: CreateSolidBrush(BG),
                    field,
                    status: HINT.into(),
                    color: GREY,
                    field_rect: RECT::default(),
                    status_rect: RECT::default(),
                    edit_line: 20,
                    status_line: 14,
                    dwm_round,
                    arrow: "->",
                })
            });
            apply_dpi(hwnd, dpi_of(hwnd));
            Ok(Self { hwnd, edit })
        }
    }

    pub fn visible(&self) -> bool {
        unsafe { IsWindowVisible(self.hwnd).as_bool() }
    }

    pub fn show_over(&self, game_rect: RECT) {
        let dpi = dpi_for_rect(&game_rect);
        apply_dpi(self.hwnd, dpi);
        let height = ui(|u| height_for(u)).unwrap_or(80);
        let gw = game_rect.right - game_rect.left;
        let gh = game_rect.bottom - game_rect.top;
        let width = scale(640, dpi).min(scale(360, dpi).max(gw - scale(40, dpi)));
        let x = game_rect.left + (gw - width) / 2;
        let y = (game_rect.top + gh * 70 / 100).min(game_rect.bottom - height - scale(8, dpi)).max(game_rect.top);
        unsafe {
            let _ = SetWindowPos(self.hwnd, Some(HWND_TOPMOST), x, y, width, height, SWP_NOACTIVATE);
        }
        layout(self.hwnd);
        crate::win::set_window_text(self.edit, "");
        self.set_status(HINT, GREY);
        unsafe {
            let _ = ShowWindow(self.hwnd, SW_SHOW);
        }
        if !game::focus_own(self.hwnd, self.edit) {
            log::write("overlay could not take the focus — click into it");
        }
    }

    pub fn activate(&self) {
        game::focus_own(self.hwnd, self.edit);
    }

    pub fn hide(&self) {
        unsafe {
            for t in [T_FLUSH, T_STATUS, T_ENTER] {
                let _ = KillTimer(Some(self.hwnd), t);
            }
            let _ = ShowWindow(self.hwnd, SW_HIDE);
        }
    }

    pub fn timer(&self, id: usize, ms: u32) {
        unsafe {
            SetTimer(Some(self.hwnd), id, ms, None);
        }
    }

    pub fn kill_timer(&self, id: usize) {
        unsafe {
            let _ = KillTimer(Some(self.hwnd), id);
        }
    }

    fn selection(&self) -> (usize, usize) {
        let (mut s, mut e) = (0u32, 0u32);
        send(self.edit, EM_GETSEL, &mut s as *mut u32 as usize, &mut e as *mut u32 as isize);
        (s as usize, e as usize)
    }

    pub fn text(&self) -> (Vec<char>, usize) {
        let units = window_text(self.edit);
        let (_, end) = self.selection();
        let caret = char_index(&units, end);
        (chars_from_utf16(&units), caret)
    }

    pub fn has_selection(&self) -> bool {
        let (s, e) = self.selection();
        s != e
    }

    pub fn apply_edits(&self, edits: &[Edit]) {
        if edits.is_empty() {
            return;
        }
        let (mut chars, mut caret) = self.text();
        for e in edits {
            if e.start + e.len > chars.len() {
                continue;
            }
            let s16 = utf16_index(&chars, e.start);
            let e16 = utf16_index(&chars, e.start + e.len);
            let replacement = wide(&e.text);
            send(self.edit, EM_SETSEL, s16, e16 as isize);
            send(self.edit, EM_REPLACESEL, 0, replacement.as_ptr() as isize);
            caret = apply(&mut chars, caret, e);
        }
        let c16 = utf16_index(&chars, caret) as isize;
        send(self.edit, EM_SETSEL, c16 as usize, c16);
    }

    pub fn arrow(&self) -> &'static str {
        ui(|u| u.arrow).unwrap_or("->")
    }

    pub fn set_status(&self, text: &str, color: COLORREF) {
        ui(|u| {
            u.status = text.to_string();
            u.color = color;
        });
        unsafe {
            let _ = InvalidateRect(Some(self.hwnd), None, false);
        }
    }

    pub fn flash(&self, text: &str, color: COLORREF) {
        self.set_status(text, color);
        self.kill_timer(T_STATUS);
        self.timer(T_STATUS, 2400);
    }
}

fn height_for(u: &Ui) -> i32 {
    let s = |v| scale(v, u.dpi);
    s(PAD_TOP) + u.edit_line + 2 * s(FIELD_PAD_Y) + s(GAP) + u.status_line + s(PAD_BOTTOM)
}

fn apply_dpi(hwnd: HWND, dpi: u32) {
    let Some((edit, old_edit, old_status, changed)) = ui(|u| {
        if u.dpi == dpi {
            return (u.edit, HFONT::default(), HFONT::default(), false);
        }
        let old = (u.font_edit, u.font_status);
        u.font_edit = ui_font(13.0, dpi, 400);
        u.font_status = ui_font(9.0, dpi, 400);
        u.dpi = dpi;
        (u.edit, old.0, old.1, true)
    }) else {
        return;
    };
    if !changed {
        return;
    }
    let (font_edit, font_status) = ui(|u| (u.font_edit, u.font_status)).unwrap_or_default();
    set_font(edit, font_edit);
    let margin = scale(4, dpi) as isize;
    send(edit, EM_SETMARGINS, (EC_LEFTMARGIN | EC_RIGHTMARGIN) as usize, margin | (margin << 16));
    let edit_line = line_height(hwnd, font_edit);
    let status_line = line_height(hwnd, font_status);
    let arrow = if has_glyphs(hwnd, font_status, "→") { "→" } else { "->" };
    ui(|u| {
        u.edit_line = edit_line;
        u.status_line = status_line;
        u.arrow = arrow;
    });
    unsafe {
        for f in [old_edit, old_status] {
            if !f.is_invalid() {
                let _ = DeleteObject(HGDIOBJ(f.0));
            }
        }
    }
}

fn layout(hwnd: HWND) {
    let mut rc = RECT::default();
    unsafe {
        let _ = GetClientRect(hwnd, &mut rc);
    }
    let w = rc.right;
    let Some((edit, er, h, dwm_round, dpi)) = ui(|u| {
        let s = |v| scale(v, u.dpi);
        let field = RECT { left: s(PAD_X), top: s(PAD_TOP), right: w - s(PAD_X), bottom: s(PAD_TOP) + u.edit_line + 2 * s(FIELD_PAD_Y) };
        let er = RECT {
            left: field.left + s(FIELD_PAD_X),
            top: field.top + s(FIELD_PAD_Y),
            right: field.right - s(FIELD_PAD_X),
            bottom: field.top + s(FIELD_PAD_Y) + u.edit_line,
        };
        u.status_rect = RECT { left: s(PAD_X) + s(4), top: field.bottom + s(GAP), right: w - s(PAD_X), bottom: field.bottom + s(GAP) + u.status_line };
        u.field_rect = field;
        (u.edit, er, height_for(u), u.dwm_round, u.dpi)
    }) else {
        return;
    };
    unsafe {
        let _ = MoveWindow(edit, er.left, er.top, er.right - er.left, er.bottom - er.top, true);
        if !dwm_round {
            let r = scale(RADIUS, dpi);
            SetWindowRgn(hwnd, Some(CreateRoundRectRgn(0, 0, w + 1, h.max(rc.bottom) + 1, r, r)), true);
        }
        let _ = InvalidateRect(Some(hwnd), None, false);
    }
}

fn draw(dc: HDC, w: i32, h: i32, u: &Ui) {
    let s = |v| scale(v, u.dpi);
    unsafe {
        FillRect(dc, &RECT { left: 0, top: 0, right: w, bottom: h }, u.bg);
        let old_brush = SelectObject(dc, HGDIOBJ(u.field.0));
        let old_pen = SelectObject(dc, GetStockObject(NULL_PEN));
        let f = u.field_rect;
        let _ = RoundRect(dc, f.left, f.top, f.right + 1, f.bottom + 1, s(FIELD_RADIUS), s(FIELD_RADIUS));
        SetBkMode(dc, TRANSPARENT);
        SetTextColor(dc, u.color);
        let old_font = SelectObject(dc, HGDIOBJ(u.font_status.0));
        let mut text: Vec<u16> = u.status.encode_utf16().collect();
        let mut sr = u.status_rect;
        DrawTextW(dc, &mut text, &mut sr, DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS | DT_NOPREFIX);
        let pen = CreatePen(PS_INSIDEFRAME, s(2).max(1), GREEN);
        SelectObject(dc, HGDIOBJ(pen.0));
        SelectObject(dc, GetStockObject(NULL_BRUSH));
        let _ = RoundRect(dc, 0, 0, w, h, s(RADIUS), s(RADIUS));
        SelectObject(dc, old_font);
        SelectObject(dc, old_pen);
        SelectObject(dc, old_brush);
        let _ = DeleteObject(HGDIOBJ(pen.0));
    }
}

fn paint(hwnd: HWND) {
    unsafe {
        let mut ps = PAINTSTRUCT::default();
        let hdc = BeginPaint(hwnd, &mut ps);
        let mut rc = RECT::default();
        let _ = GetClientRect(hwnd, &mut rc);
        let (w, h) = (rc.right.max(1), rc.bottom.max(1));
        let mem = CreateCompatibleDC(Some(hdc));
        let bmp = CreateCompatibleBitmap(hdc, w, h);
        let old = SelectObject(mem, HGDIOBJ(bmp.0));
        let drawn = UI.with(|c| match c.try_borrow() {
            Ok(g) => g.as_ref().map(|u| draw(mem, w, h, u)).is_some(),
            Err(_) => false,
        });
        if drawn {
            let _ = BitBlt(hdc, 0, 0, w, h, Some(mem), 0, 0, SRCCOPY);
        }
        SelectObject(mem, old);
        let _ = DeleteObject(HGDIOBJ(bmp.0));
        let _ = DeleteDC(mem);
        let _ = EndPaint(hwnd, &ps);
        if !drawn {
            let _ = InvalidateRect(Some(hwnd), None, false);
        }
    }
}

fn post(hwnd: HWND, msg: u32) {
    unsafe {
        let _ = PostMessageW(Some(hwnd), msg, WPARAM(0), LPARAM(0));
    }
}

fn parent_of(edit: HWND) -> Option<HWND> {
    unsafe { windows::Win32::UI::WindowsAndMessaging::GetParent(edit).ok() }
}

fn delete_word(edit: HWND) {
    let units = window_text(edit);
    let chars = chars_from_utf16(&units);
    let (mut s, mut e) = (0u32, 0u32);
    send(edit, EM_GETSEL, &mut s as *mut u32 as usize, &mut e as *mut u32 as isize);
    if s != e {
        send(edit, EM_REPLACESEL, 0, wide("").as_ptr() as isize);
        return;
    }
    let caret = char_index(&units, e as usize);
    let mut i = caret;
    while i > 0 && chars[i - 1].is_whitespace() {
        i -= 1;
    }
    while i > 0 && !chars[i - 1].is_whitespace() {
        i -= 1;
    }
    send(edit, EM_SETSEL, utf16_index(&chars, i), utf16_index(&chars, caret) as isize);
    send(edit, EM_REPLACESEL, 0, wide("").as_ptr() as isize);
}

unsafe extern "system" fn edit_proc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM, _id: usize, _data: usize) -> LRESULT {
    unsafe {
        match msg {
            WM_KEYDOWN => {
                let ctrl = GetKeyState(0x11) < 0;
                match wp.0 as u16 {
                    0x0D => {
                        if let Some(p) = parent_of(hwnd) {
                            post(p, OV_ENTER);
                        }
                        return LRESULT(0);
                    }
                    0x1B => {
                        if let Some(p) = parent_of(hwnd) {
                            post(p, OV_ESCAPE);
                        }
                        return LRESULT(0);
                    }
                    0x08 if ctrl => {
                        delete_word(hwnd);
                        SWALLOW_BACK.set(true);
                        return LRESULT(0);
                    }
                    0x08 if with_app(|a| a.on_backspace()) == Some(true) => {
                        SWALLOW_BACK.set(true);
                        return LRESULT(0);
                    }
                    _ => {}
                }
                DefSubclassProc(hwnd, msg, wp, lp)
            }
            WM_CHAR => {
                let code = wp.0 as u32;
                match code {
                    0x08 | 0x7F if SWALLOW_BACK.replace(false) => return LRESULT(0),
                    0x09 | 0x0A | 0x0D | 0x1B => return LRESULT(0),
                    0x01 => {
                        send(hwnd, EM_SETSEL, 0, -1);
                        return LRESULT(0);
                    }
                    0x7F => {
                        delete_word(hwnd);
                        return LRESULT(0);
                    }
                    _ => {}
                }
                let r = DefSubclassProc(hwnd, msg, wp, lp);
                if code >= 0x20
                    && let Some(c) = char::from_u32(code)
                {
                    with_app(|a| a.on_typed(c));
                }
                r
            }
            WM_NCDESTROY => {
                let _ = RemoveWindowSubclass(hwnd, Some(edit_proc), 1);
                DefSubclassProc(hwnd, msg, wp, lp)
            }
            _ => DefSubclassProc(hwnd, msg, wp, lp),
        }
    }
}

unsafe extern "system" fn overlay_proc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_PAINT => {
                paint(hwnd);
                LRESULT(0)
            }
            WM_ERASEBKGND => LRESULT(1),
            WM_CTLCOLOREDIT => {
                let dc = HDC(wp.0 as *mut c_void);
                SetTextColor(dc, WHITE);
                SetBkColor(dc, FIELD);
                LRESULT(FIELD_BRUSH.get())
            }
            WM_TIMER => {
                if wp.0 == T_STATUS {
                    let _ = KillTimer(Some(hwnd), T_STATUS);
                    ui(|u| {
                        u.status = HINT.into();
                        u.color = GREY;
                    });
                    let _ = InvalidateRect(Some(hwnd), None, false);
                } else {
                    with_app(|a| a.on_overlay_timer(wp.0));
                }
                LRESULT(0)
            }
            OV_ENTER | OV_ESCAPE => {
                let handled = with_app(|a| if msg == OV_ENTER { a.on_enter() } else { a.on_escape() });
                if handled.is_none() {
                    post(hwnd, msg);
                }
                LRESULT(0)
            }
            WM_DPICHANGED => {
                apply_dpi(hwnd, hiword(wp.0) as u32);
                layout(hwnd);
                LRESULT(0)
            }
            WM_ACTIVATE => {
                if loword(wp.0) != 0
                    && let Some(edit) = ui(|u| u.edit)
                {
                    let _ = SetFocus(Some(edit));
                }
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wp, lp),
        }
    }
}
