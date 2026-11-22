use std::ffi::c_void;
use std::mem::size_of;

use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, SIZE, WPARAM};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, SelectObject, AC_SRC_ALPHA, AC_SRC_OVER, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
    BLENDFUNCTION, DIB_RGB_COLORS, HGDIOBJ,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, RegisterClassExW, ShowWindow, UpdateLayeredWindow, SW_HIDE, SW_SHOWNOACTIVATE, ULW_ALPHA, WNDCLASSEXW,
    WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
};

use crate::gfx::{Painter, Rgba};
use crate::style::{bubble_size, paint_bubble, BubbleKind, Status};
use crate::win::hinstance;

const CLASS: PCWSTR = w!("RPSpellerBubble");

unsafe extern "system" fn bubble_proc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    unsafe { DefWindowProcW(hwnd, msg, wp, lp) }
}

pub struct Bubble {
    pub hwnd: HWND,
}

impl Bubble {
    pub fn create() -> Result<Self, String> {
        unsafe {
            let wc = WNDCLASSEXW {
                cbSize: size_of::<WNDCLASSEXW>() as u32,
                lpfnWndProc: Some(bubble_proc),
                hInstance: hinstance(),
                lpszClassName: CLASS,
                ..Default::default()
            };
            RegisterClassExW(&wc);
            let hwnd = CreateWindowExW(
                WS_EX_LAYERED | WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT,
                CLASS,
                w!(""),
                WS_POPUP,
                0,
                0,
                10,
                10,
                None,
                None,
                Some(hinstance()),
                None,
            )
            .map_err(|e| e.to_string())?;
            Ok(Self { hwnd })
        }
    }

    pub fn show(&self, kind: &BubbleKind, status: &Status, x: i32, bottom: i32, scale: f32, arrow_x: f32) {
        let (w, h) = bubble_size(kind, status, scale);
        let (x, y) = (x, bottom - h);
        unsafe {
            let mem = CreateCompatibleDC(None);
            let info = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: w,
                    biHeight: -h,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let mut bits: *mut c_void = std::ptr::null_mut();
            let Ok(bmp) = CreateDIBSection(Some(mem), &info, DIB_RGB_COLORS, &mut bits, None, 0) else {
                let _ = DeleteDC(mem);
                return;
            };
            let old = SelectObject(mem, HGDIOBJ(bmp.0));
            if let Some(p) = Painter::begin(mem, w, h, true) {
                p.clear(Rgba(0.0, 0.0, 0.0, 0.0));
                paint_bubble(&p, kind, status, w as f32, h as f32, scale, arrow_x);
                p.end();
            }
            let blend = BLENDFUNCTION { BlendOp: AC_SRC_OVER as u8, BlendFlags: 0, SourceConstantAlpha: 255, AlphaFormat: AC_SRC_ALPHA as u8 };
            let _ = UpdateLayeredWindow(
                self.hwnd,
                None,
                Some(&POINT { x, y }),
                Some(&SIZE { cx: w, cy: h }),
                Some(mem),
                Some(&POINT { x: 0, y: 0 }),
                windows::Win32::Foundation::COLORREF(0),
                Some(&blend),
                ULW_ALPHA,
            );
            SelectObject(mem, old);
            let _ = DeleteObject(HGDIOBJ(bmp.0));
            let _ = DeleteDC(mem);
            let _ = ShowWindow(self.hwnd, SW_SHOWNOACTIVATE);
        }
    }

    pub fn hide(&self) {
        unsafe {
            let _ = ShowWindow(self.hwnd, SW_HIDE);
        }
    }
}
