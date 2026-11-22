use std::cell::{Cell, RefCell};
use std::ffi::c_void;
use std::mem::size_of;

use rp_speller_core::config::{Spot, Style};
use rp_speller_core::text::{char_index, chars_from_utf16, utf16_index};
use rp_speller_core::{apply, Edit};
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND, DWMWCP_ROUND};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, CreateRoundRectRgn, CreateSolidBrush, DeleteObject, EndPaint, GetDC, GetTextExtentPoint32W, InvalidateRect, ReleaseDC, ScreenToClient,
    SelectObject, SetBkColor, SetTextColor, SetWindowRgn, HDC, HFONT, HGDIOBJ, PAINTSTRUCT,
};
use windows::Win32::Foundation::SIZE;
use windows::Win32::UI::Controls::{EM_GETSEL, EM_POSFROMCHAR, EM_REPLACESEL, EM_SETLIMITTEXT, EM_SETMARGINS, EM_SETSEL};
use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, SetFocus};
use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, GetClientRect, GetWindowRect, IsWindowVisible, KillTimer, LoadCursorW, MoveWindow, PostMessageW,
    RegisterClassExW, SetLayeredWindowAttributes, SetTimer, SetWindowPos, ShowWindow, CS_DBLCLKS, EC_LEFTMARGIN, EC_RIGHTMARGIN, ES_AUTOHSCROLL,
    HMENU, HTCAPTION, HTCLIENT, HWND_TOPMOST, IDC_ARROW, LWA_ALPHA, SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER, SW_HIDE, SW_SHOW, WINDOW_EX_STYLE,
    WINDOW_STYLE, WM_ACTIVATE, WM_APP, WM_CHAR, WM_CTLCOLOREDIT, WM_DPICHANGED, WM_ENTERSIZEMOVE, WM_ERASEBKGND, WM_EXITSIZEMOVE, WM_KEYDOWN, WM_NCDESTROY,
    WM_NCHITTEST, WM_NCLBUTTONDBLCLK, WM_PAINT, WM_TIMER, WNDCLASSEXW, WS_CHILD, WS_CLIPCHILDREN, WS_EX_LAYERED, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
    WS_POPUP, WS_VISIBLE,
};

use crate::app::with_app;
use crate::bubble::Bubble;
use crate::gfx::Painter;
use crate::style::{self, bubble_kind, look, BubbleKind, Geo, Status};
use crate::win::{dpi_for_rect, hiword, line_height, loword, scale, send, set_font, ui_font, wide, window_text};
use crate::{game, log};

pub const OV_ENTER: u32 = WM_APP + 10;
pub const OV_ESCAPE: u32 = WM_APP + 11;
pub const T_FLUSH: usize = 1;
pub const T_STATUS: usize = 2;
pub const T_ENTER: usize = 3;
const CLASS: PCWSTR = w!("RPSpellerOverlay");
const MAX_LEN: usize = 400;

struct Ui {
    edit: HWND,
    dpi: u32,
    style: Style,
    font: HFONT,
    edit_line: i32,
    geo: Geo,
    status: Status,
    fix: Option<(usize, usize, String)>,
    dwm: bool,
    game: RECT,
    bubble: Option<Bubble>,
}

thread_local! {
    static UI: RefCell<Option<Ui>> = const { RefCell::new(None) };
    static FIELD_BRUSH: Cell<isize> = const { Cell::new(0) };
    static EDIT_FG: Cell<u32> = const { Cell::new(0xFFFFFF) };
    static EDIT_BG: Cell<u32> = const { Cell::new(0) };
    static SWALLOW_BACK: Cell<bool> = const { Cell::new(false) };
    static MOVE_FROM: Cell<(i32, i32)> = const { Cell::new((i32::MIN, i32::MIN)) };
    static PAINT_RETRY: Cell<u8> = const { Cell::new(0) };
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
                style: CS_DBLCLKS,
                lpfnWndProc: Some(overlay_proc),
                hInstance: crate::win::hinstance(),
                hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
                lpszClassName: CLASS,
                ..Default::default()
            };
            RegisterClassExW(&wc);
            let hwnd = CreateWindowExW(
                WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_LAYERED,
                CLASS,
                w!("RP Speller"),
                WS_POPUP | WS_CLIPCHILDREN,
                0,
                0,
                640,
                80,
                None,
                None,
                Some(crate::win::hinstance()),
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
                Some(crate::win::hinstance()),
                None,
            )
            .map_err(|e| e.to_string())?;
            send(edit, EM_SETLIMITTEXT, MAX_LEN, 0);
            let _ = SetWindowSubclass(edit, Some(edit_proc), 1, 0);
            let pref = DWMWCP_DONOTROUND;
            let dwm = DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &pref as *const _ as *const c_void, 4).is_ok();
            let bubble = Bubble::create().ok();
            UI.with(|c| {
                *c.borrow_mut() = Some(Ui {
                    edit,
                    dpi: 0,
                    style: Style::Glass,
                    font: HFONT::default(),
                    edit_line: 24,
                    geo: Geo { w: 640, h: 80, edit: RECT::default(), radius: 0.0, alpha: 255, scale: 1.0 },
                    status: Status::Hint,
                    fix: None,
                    dwm,
                    game: RECT::default(),
                    bubble,
                })
            });
            Ok(Self { hwnd, edit })
        }
    }

    pub fn visible(&self) -> bool {
        unsafe { IsWindowVisible(self.hwnd).as_bool() }
    }

    pub fn show_over(&self, game_rect: RECT, style: Style, spot: Option<Spot>) {
        let dpi = dpi_for_rect(&game_rect);
        prepare(self.hwnd, style, dpi);
        let Some((w, h)) = ui(|u| {
            u.game = game_rect;
            u.geo = style::geometry(style, dpi, game_rect.right - game_rect.left, u.edit_line);
            (u.geo.w, u.geo.h)
        }) else {
            return;
        };
        let (x, y) = style::place(style, game_rect, w, h, spot);
        unsafe {
            let _ = SetWindowPos(self.hwnd, Some(HWND_TOPMOST), x, y, w, h, SWP_NOACTIVATE);
        }
        shape(self.hwnd);
        crate::win::set_window_text(self.edit, "");
        self.set_status(Status::Hint);
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
        hide_bubble();
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
        (chars_from_utf16(&units), char_index(&units, end))
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

    pub fn set_status(&self, status: Status) {
        ui(|u| {
            u.status = status;
            u.fix = None;
        });
        hide_bubble();
        self.kill_timer(T_STATUS);
        unsafe {
            let _ = InvalidateRect(Some(self.hwnd), None, false);
        }
    }

    pub fn flash(&self, status: Status, fix: Option<(usize, usize, String)>) {
        ui(|u| {
            u.status = status;
            u.fix = fix;
        });
        unsafe {
            let _ = InvalidateRect(Some(self.hwnd), None, false);
        }
        show_bubble(self.hwnd);
        self.kill_timer(T_STATUS);
        self.timer(T_STATUS, 2600);
    }
}

fn prepare(hwnd: HWND, style: Style, dpi: u32) {
    let Some((edit, old, changed)) = ui(|u| {
        if u.dpi == dpi && u.style == style && !u.font.is_invalid() {
            return (u.edit, HFONT::default(), false);
        }
        let old = u.font;
        let (pt, weight) = style::edit_font(style);
        u.font = ui_font(pt, dpi, weight);
        u.dpi = dpi;
        u.style = style;
        (u.edit, old, true)
    }) else {
        return;
    };
    if !changed {
        return;
    }
    let lk = look(style);
    EDIT_FG.set(lk.text.colorref().0);
    EDIT_BG.set(lk.field.colorref().0);
    unsafe {
        let brush = CreateSolidBrush(lk.field.colorref());
        let prev = FIELD_BRUSH.replace(brush.0 as isize);
        if prev != 0 {
            let _ = DeleteObject(HGDIOBJ(prev as *mut c_void));
        }
    }
    let font = ui(|u| u.font).unwrap_or_default();
    set_font(edit, font);
    let margin = scale(2, dpi) as isize;
    send(edit, EM_SETMARGINS, (EC_LEFTMARGIN | EC_RIGHTMARGIN) as usize, margin | (margin << 16));
    let line = line_height(hwnd, font);
    ui(|u| u.edit_line = line);
    if !old.is_invalid() {
        unsafe {
            let _ = DeleteObject(HGDIOBJ(old.0));
        }
    }
}

fn shape(hwnd: HWND) {
    let Some((edit, er, w, h, style, dwm, alpha, radius)) =
        ui(|u| (u.edit, u.geo.edit, u.geo.w, u.geo.h, u.style, u.dwm, u.geo.alpha, u.geo.radius))
    else {
        return;
    };
    unsafe {
        let _ = MoveWindow(edit, er.left, er.top, er.right - er.left, er.bottom - er.top, true);
        let _ = SetLayeredWindowAttributes(hwnd, COLORREF(0), alpha, LWA_ALPHA);
        let use_dwm = dwm && style == Style::Glass;
        if dwm {
            let pref = if use_dwm { DWMWCP_ROUND } else { DWMWCP_DONOTROUND };
            let _ = DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &pref as *const _ as *const c_void, 4);
            let border = crate::gfx::hex(0x2A2D36, 1.0).colorref();
            let _ = DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, &border as *const _ as *const c_void, 4);
        }
        let r = (radius * 2.0).round() as i32;
        if use_dwm || r == 0 {
            SetWindowRgn(hwnd, None, true);
        } else {
            SetWindowRgn(hwnd, Some(CreateRoundRectRgn(0, 0, w + 1, h + 1, r, r)), true);
        }
        let _ = InvalidateRect(Some(hwnd), None, false);
    }
}

fn underline(edit: HWND, er: &RECT, fix: &Option<(usize, usize, String)>) -> Option<(f32, f32)> {
    let (start, len, word) = fix.as_ref()?;
    let units = window_text(edit);
    let chars = chars_from_utf16(&units);
    if start + len > chars.len() || chars[*start..start + len].iter().collect::<String>() != *word {
        return None;
    }
    let pos = |i: usize| -> Option<i32> {
        let r = send(edit, EM_POSFROMCHAR, utf16_index(&chars, i), 0);
        (r != -1).then_some(loword(r as usize) as i16 as i32)
    };
    let x1 = pos(*start)?;
    let x2 = match pos(start + len) {
        Some(x) if start + len < chars.len() => x,
        _ => {
            let last = pos(start + len - 1)?;
            let units: Vec<u16> = chars[start + len - 1].to_string().encode_utf16().collect();
            let mut size = SIZE::default();
            unsafe {
                let dc = GetDC(Some(edit));
                let font = ui(|u| u.font).unwrap_or_default();
                let old = SelectObject(dc, HGDIOBJ(font.0));
                let _ = GetTextExtentPoint32W(dc, &units, &mut size);
                SelectObject(dc, old);
                ReleaseDC(Some(edit), dc);
            }
            last + size.cx
        }
    };
    let left = (er.left + x1).max(er.left) as f32;
    let right = (er.left + x2).min(er.right) as f32;
    (right > left).then_some((left, right))
}

fn hide_bubble() {
    UI.with(|c| {
        if let Ok(g) = c.try_borrow()
            && let Some(u) = g.as_ref()
            && let Some(b) = &u.bubble
        {
            b.hide();
        }
    });
}

fn show_bubble(hwnd: HWND) {
    let Some((style, status, fix, edit, er, s)) = ui(|u| (u.style, u.status.clone(), u.fix.clone(), u.edit, u.geo.edit, u.geo.scale)) else {
        return;
    };
    let Some(kind) = bubble_kind(style) else { return };
    if status == Status::Hint {
        hide_bubble();
        return;
    }
    let mut wr = RECT::default();
    unsafe {
        let _ = GetWindowRect(hwnd, &mut wr);
    }
    let (x, bottom, arrow) = match kind {
        BubbleKind::Toast => (wr.left, wr.top - (6.0 * s) as i32, 0.0),
        BubbleKind::Tooltip => {
            let anchor = underline(edit, &er, &fix).map(|(a, b)| (a + b) / 2.0).unwrap_or(er.left as f32 + 30.0 * s);
            let ax = wr.left + anchor as i32;
            let left = ax - (24.0 * s) as i32;
            (left, wr.top + (2.0 * s) as i32, 24.0 * s)
        }
    };
    UI.with(|c| {
        if let Ok(g) = c.try_borrow()
            && let Some(u) = g.as_ref()
            && let Some(b) = &u.bubble
        {
            b.show(&kind, &status, x, bottom, s, arrow);
        }
    });
}

fn relayout(hwnd: HWND, dpi: u32) {
    let Some((style, game)) = ui(|u| (u.style, u.game)) else { return };
    prepare(hwnd, style, dpi);
    let Some((w, h)) = ui(|u| {
        u.geo = style::geometry(style, dpi, game.right - game.left, u.edit_line);
        (u.geo.w, u.geo.h)
    }) else {
        return;
    };
    unsafe {
        let mut wr = RECT::default();
        let _ = GetWindowRect(hwnd, &mut wr);
        let _ = SetWindowPos(hwnd, None, wr.left, wr.top, w, h, SWP_NOZORDER | SWP_NOACTIVATE);
    }
    shape(hwnd);
}

fn paint(hwnd: HWND) {
    let snapshot = ui(|u| (u.style, Geo { w: u.geo.w, h: u.geo.h, edit: u.geo.edit, radius: u.geo.radius, alpha: u.geo.alpha, scale: u.geo.scale }, u.status.clone(), u.fix.clone(), u.edit, u.dwm));
    unsafe {
        let mut ps = PAINTSTRUCT::default();
        let hdc = BeginPaint(hwnd, &mut ps);
        let mut rc = RECT::default();
        let _ = GetClientRect(hwnd, &mut rc);
        let mut ok = true;
        if let Some((style, geo, status, fix, edit, dwm)) = snapshot {
            let line = if style == Style::Capsule && matches!(status, Status::Fixed { .. }) { underline(edit, &geo.edit, &fix) } else { None };
            let square = dwm && style == Style::Glass;
            ok = match Painter::begin(hdc, rc.right.max(1), rc.bottom.max(1), false) {
                Some(p) => {
                    style::paint(&p, style, &geo, &status, None, square, line);
                    p.end()
                }
                None => false,
            };
        }
        let _ = EndPaint(hwnd, &ps);
        let tries = PAINT_RETRY.get();
        PAINT_RETRY.set(if ok { 0 } else { tries.saturating_add(1) });
        if !ok && tries < 2 {
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
                if let Some(p) = parent_of(hwnd) {
                    let _ = InvalidateRect(Some(p), None, false);
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
                SetTextColor(dc, COLORREF(EDIT_FG.get()));
                SetBkColor(dc, COLORREF(EDIT_BG.get()));
                LRESULT(FIELD_BRUSH.get())
            }
            WM_NCHITTEST => {
                let hit = DefWindowProcW(hwnd, msg, wp, lp);
                if hit.0 as u32 != HTCLIENT {
                    return hit;
                }
                let mut pt = POINT { x: loword(lp.0 as usize) as i16 as i32, y: hiword(lp.0 as usize) as i16 as i32 };
                let _ = ScreenToClient(hwnd, &mut pt);
                let er = ui(|u| u.geo.edit).unwrap_or_default();
                if pt.x >= er.left && pt.x < er.right && pt.y >= er.top && pt.y < er.bottom { hit } else { LRESULT(HTCAPTION as isize) }
            }
            WM_ENTERSIZEMOVE => {
                let mut wr = RECT::default();
                let _ = GetWindowRect(hwnd, &mut wr);
                MOVE_FROM.set((wr.left, wr.top));
                LRESULT(0)
            }
            WM_EXITSIZEMOVE => {
                let mut wr = RECT::default();
                let _ = GetWindowRect(hwnd, &mut wr);
                let moved = MOVE_FROM.replace((i32::MIN, i32::MIN)) != (wr.left, wr.top);
                if let Some((style, game, edit)) = ui(|u| (u.style, u.game, u.edit)) {
                    if moved {
                        let spot = style::spot_of(game, wr.left, wr.top);
                        with_app(|a| a.remember_spot(style, Some(spot)));
                    }
                    let _ = SetFocus(Some(edit));
                }
                hide_bubble();
                LRESULT(0)
            }
            WM_NCLBUTTONDBLCLK if wp.0 as u32 == HTCAPTION => {
                if let Some((style, game, w, h, edit)) = ui(|u| (u.style, u.game, u.geo.w, u.geo.h, u.edit)) {
                    with_app(|a| a.remember_spot(style, None));
                    let (x, y) = style::place(style, game, w, h, None);
                    let _ = SetWindowPos(hwnd, None, x, y, 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
                    let _ = SetFocus(Some(edit));
                }
                LRESULT(0)
            }
            WM_TIMER => {
                if wp.0 == T_STATUS {
                    let _ = KillTimer(Some(hwnd), T_STATUS);
                    ui(|u| {
                        u.status = Status::Hint;
                        u.fix = None;
                    });
                    hide_bubble();
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
                relayout(hwnd, hiword(wp.0) as u32);
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
