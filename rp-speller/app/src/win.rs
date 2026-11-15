use std::ffi::c_void;
use std::mem::size_of;

use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{COLORREF, HINSTANCE, HWND, LPARAM, RECT, SIZE, WPARAM};
use windows::Win32::Graphics::Gdi::{
    CreateFontIndirectW, GetDC, GetGlyphIndicesW, GGI_MARK_NONEXISTING_GLYPHS, GetMonitorInfoW, GetTextExtentPoint32W, GetTextMetricsW, MonitorFromPoint, MonitorFromRect, ReleaseDC,
    SelectObject, CLEARTYPE_QUALITY, DEFAULT_CHARSET, HFONT, HGDIOBJ, MONITORINFO, MONITOR_DEFAULTTONEAREST, MONITOR_DEFAULTTOPRIMARY,
    TEXTMETRICW,
};
use windows::Win32::Foundation::POINT;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::SystemInformation::GetLocalTime;
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, GetDpiForWindow, SystemParametersInfoForDpi, MDT_EFFECTIVE_DPI};
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowTextLengthW, GetWindowTextW, MessageBoxW, SendMessageW, SetWindowTextW, MESSAGEBOX_STYLE, NONCLIENTMETRICSW,
    SPI_GETNONCLIENTMETRICS, SW_SHOWNORMAL, WM_SETFONT,
};
use windows::Win32::Graphics::Gdi::LOGFONTW;

pub fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(Some(0)).collect()
}

pub fn hinstance() -> HINSTANCE {
    unsafe { GetModuleHandleW(None).map(|m| HINSTANCE(m.0)).unwrap_or_default() }
}

pub const fn rgb(r: u8, g: u8, b: u8) -> COLORREF {
    COLORREF(r as u32 | (g as u32) << 8 | (b as u32) << 16)
}

pub fn scale(v: i32, dpi: u32) -> i32 {
    ((v as i64 * dpi as i64 + 48) / 96) as i32
}

pub fn hwnd_to_isize(h: HWND) -> isize {
    h.0 as isize
}

pub fn hwnd_from_isize(v: isize) -> HWND {
    HWND(v as *mut c_void)
}

pub fn send(hwnd: HWND, msg: u32, wparam: usize, lparam: isize) -> isize {
    unsafe { SendMessageW(hwnd, msg, Some(WPARAM(wparam)), Some(LPARAM(lparam))).0 }
}

pub fn loword(v: usize) -> u16 {
    (v & 0xFFFF) as u16
}

pub fn hiword(v: usize) -> u16 {
    ((v >> 16) & 0xFFFF) as u16
}

pub fn window_text(hwnd: HWND) -> Vec<u16> {
    unsafe {
        let len = GetWindowTextLengthW(hwnd).max(0) as usize;
        let mut buf = vec![0u16; len + 1];
        let n = GetWindowTextW(hwnd, &mut buf).max(0) as usize;
        buf.truncate(n);
        buf
    }
}

pub fn window_string(hwnd: HWND) -> String {
    String::from_utf16_lossy(&window_text(hwnd))
}

pub fn set_window_text(hwnd: HWND, s: &str) {
    let w = wide(s);
    unsafe {
        let _ = SetWindowTextW(hwnd, PCWSTR(w.as_ptr()));
    }
}

pub fn message_box(owner: Option<HWND>, text: &str, style: MESSAGEBOX_STYLE) {
    let w = wide(text);
    unsafe {
        MessageBoxW(owner, PCWSTR(w.as_ptr()), w!("RP Speller"), style);
    }
}

pub fn shell_open(target: &str) {
    let w = wide(target);
    unsafe {
        ShellExecuteW(None, w!("open"), PCWSTR(w.as_ptr()), PCWSTR::null(), PCWSTR::null(), SW_SHOWNORMAL);
    }
}

pub fn local_time() -> String {
    let t = unsafe { GetLocalTime() };
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03}",
        t.wYear, t.wMonth, t.wDay, t.wHour, t.wMinute, t.wSecond, t.wMilliseconds
    )
}

pub fn dpi_of(hwnd: HWND) -> u32 {
    match unsafe { GetDpiForWindow(hwnd) } {
        0 => 96,
        d => d,
    }
}

pub fn dpi_for_rect(r: &RECT) -> u32 {
    unsafe {
        let mon = MonitorFromRect(r, MONITOR_DEFAULTTONEAREST);
        let (mut x, mut y) = (0u32, 0u32);
        match GetDpiForMonitor(mon, MDT_EFFECTIVE_DPI, &mut x, &mut y) {
            Ok(()) if x > 0 => x,
            _ => 96,
        }
    }
}

pub fn primary_work_area() -> RECT {
    unsafe {
        let mon = MonitorFromPoint(POINT { x: 0, y: 0 }, MONITOR_DEFAULTTOPRIMARY);
        let mut mi = MONITORINFO { cbSize: size_of::<MONITORINFO>() as u32, ..Default::default() };
        if GetMonitorInfoW(mon, &mut mi).as_bool() { mi.rcWork } else { RECT { left: 0, top: 0, right: 1280, bottom: 720 } }
    }
}

pub fn create_font(face: &str, points: f32, dpi: u32, weight: i32) -> HFONT {
    let mut lf = LOGFONTW {
        lfHeight: -((points * dpi as f32 / 72.0).round() as i32),
        lfWeight: weight,
        lfCharSet: DEFAULT_CHARSET,
        lfQuality: CLEARTYPE_QUALITY,
        ..Default::default()
    };
    for (dst, src) in lf.lfFaceName.iter_mut().zip(face.encode_utf16().take(31)) {
        *dst = src;
    }
    unsafe { CreateFontIndirectW(&lf) }
}

fn system_message_font(dpi: u32) -> Option<LOGFONTW> {
    let mut ncm = NONCLIENTMETRICSW { cbSize: size_of::<NONCLIENTMETRICSW>() as u32, ..Default::default() };
    let ok = unsafe {
        SystemParametersInfoForDpi(SPI_GETNONCLIENTMETRICS.0, ncm.cbSize, Some(&mut ncm as *mut _ as *mut c_void), 0, dpi).is_ok()
    };
    (ok && ncm.lfMessageFont.lfHeight != 0 && ncm.lfMessageFont.lfFaceName[0] != 0).then_some(ncm.lfMessageFont)
}

pub fn message_font(dpi: u32) -> HFONT {
    match system_message_font(dpi) {
        Some(lf) => unsafe { CreateFontIndirectW(&lf) },
        None => create_font("Segoe UI", 9.0, dpi, 400),
    }
}

pub fn ui_font(points: f32, dpi: u32, weight: i32) -> HFONT {
    match system_message_font(dpi) {
        Some(mut lf) => {
            lf.lfHeight = -((points * dpi as f32 / 72.0).round() as i32);
            lf.lfWidth = 0;
            lf.lfWeight = weight;
            lf.lfItalic = 0;
            lf.lfUnderline = 0;
            lf.lfStrikeOut = 0;
            lf.lfQuality = CLEARTYPE_QUALITY;
            unsafe { CreateFontIndirectW(&lf) }
        }
        None => create_font("Segoe UI", points, dpi, weight),
    }
}

pub fn set_font(hwnd: HWND, font: HFONT) {
    send(hwnd, WM_SETFONT, font.0 as usize, 1);
}

pub fn text_size(hwnd: HWND, font: HFONT, s: &str) -> SIZE {
    let units: Vec<u16> = s.encode_utf16().collect();
    let mut size = SIZE::default();
    unsafe {
        let dc = GetDC(Some(hwnd));
        let old = SelectObject(dc, HGDIOBJ(font.0));
        let _ = GetTextExtentPoint32W(dc, &units, &mut size);
        SelectObject(dc, old);
        ReleaseDC(Some(hwnd), dc);
    }
    size
}

pub fn has_glyphs(hwnd: HWND, font: HFONT, s: &str) -> bool {
    let units: Vec<u16> = s.encode_utf16().collect();
    let mut idx = vec![0u16; units.len()];
    unsafe {
        let dc = GetDC(Some(hwnd));
        let old = SelectObject(dc, HGDIOBJ(font.0));
        let n = GetGlyphIndicesW(dc, PCWSTR(units.as_ptr()), units.len() as i32, idx.as_mut_ptr(), GGI_MARK_NONEXISTING_GLYPHS);
        SelectObject(dc, old);
        ReleaseDC(Some(hwnd), dc);
        n as usize == units.len() && idx.iter().all(|&g| g != 0xFFFF)
    }
}

pub fn line_height(hwnd: HWND, font: HFONT) -> i32 {
    let mut tm = TEXTMETRICW::default();
    unsafe {
        let dc = GetDC(Some(hwnd));
        let old = SelectObject(dc, HGDIOBJ(font.0));
        let _ = GetTextMetricsW(dc, &mut tm);
        SelectObject(dc, old);
        ReleaseDC(Some(hwnd), dc);
    }
    tm.tmHeight
}
