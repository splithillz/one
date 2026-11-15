use std::ffi::c_void;
use std::fs;
use std::mem::size_of;
use std::path::Path;
use std::ptr::copy_nonoverlapping;
use std::slice;
use std::thread;
use std::time::Duration;

use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{GlobalFree, HANDLE, HGLOBAL, HWND, RECT};
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits, ReleaseDC, SelectObject, BITMAPINFO,
    BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ, SRCCOPY,
};
use windows::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard, SetClipboardData};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE};
use windows::Win32::System::Ole::CF_UNICODETEXT;
use windows::Win32::System::RemoteDesktop::ProcessIdToSessionId;
use windows::Win32::System::StationsAndDesktops::{CloseDesktop, GetUserObjectInformationW, OpenInputDesktop, DESKTOP_CONTROL_FLAGS, DESKTOP_READOBJECTS, UOI_NAME};
use windows::Win32::System::Threading::GetCurrentProcessId;
use windows::Win32::UI::HiDpi::GetDpiForSystem;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    MapVirtualKeyW, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_EXTENDEDKEY,
    KEYEVENTF_KEYUP, KEYEVENTF_UNICODE, MAPVK_VK_TO_VSC, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEINPUT, VIRTUAL_KEY,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, FindWindowW, GetClassNameW, GetForegroundWindow, GetSystemMetrics, GetWindowRect, IsWindowVisible,
    RegisterClassExW, SetCursorPos, HWND_MESSAGE, SM_CXSCREEN, SM_CYSCREEN, WINDOW_EX_STYLE, WINDOW_STYLE, WNDCLASSEXW,
};

pub const VK_BACK: u16 = 0x08;
pub const VK_TAB: u16 = 0x09;
pub const VK_RETURN: u16 = 0x0D;
pub const VK_CONTROL: u16 = 0x11;
pub const VK_ESCAPE: u16 = 0x1B;
pub const VK_SPACE: u16 = 0x20;
pub const VK_UP: u16 = 0x26;
pub const VK_DOWN: u16 = 0x28;
pub const VK_A: u16 = 0x41;
pub const VK_F7: u16 = 0x76;
pub const VK_F8: u16 = 0x77;

pub fn sleep(ms: u64) {
    thread::sleep(Duration::from_millis(ms));
}

fn send(inputs: &[INPUT]) -> u32 {
    unsafe { SendInput(inputs, size_of::<INPUT>() as i32) }
}

fn kbd(vk: u16, scan: u16, flags: KEYBD_EVENT_FLAGS) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: VIRTUAL_KEY(vk), wScan: scan, dwFlags: flags, time: 0, dwExtraInfo: 0 } },
    }
}

fn key_event(vk: u16, up: bool) -> INPUT {
    let scan = unsafe { MapVirtualKeyW(vk as u32, MAPVK_VK_TO_VSC) } as u16;
    let mut flags = if up { KEYEVENTF_KEYUP } else { KEYBD_EVENT_FLAGS(0) };
    if matches!(vk, 0x21..=0x28 | 0x2D | 0x2E) {
        flags |= KEYEVENTF_EXTENDEDKEY;
    }
    kbd(vk, scan, flags)
}

pub fn tap(vk: u16) -> bool {
    let a = send(&[key_event(vk, false)]);
    sleep(30);
    let b = send(&[key_event(vk, true)]);
    sleep(60);
    a == 1 && b == 1
}

pub fn chord(modifier: u16, vk: u16) {
    send(&[key_event(modifier, false)]);
    sleep(30);
    tap(vk);
    send(&[key_event(modifier, true)]);
    sleep(60);
}

pub fn type_text(s: &str) {
    for unit in s.encode_utf16() {
        send(&[kbd(0, unit, KEYEVENTF_UNICODE), kbd(0, unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP)]);
        sleep(45);
    }
}

pub fn click(x: i32, y: i32) {
    unsafe {
        let _ = SetCursorPos(x, y);
    }
    sleep(50);
    let m = |flags| INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 { mi: MOUSEINPUT { dx: 0, dy: 0, mouseData: 0, dwFlags: flags, time: 0, dwExtraInfo: 0 } },
    };
    send(&[m(MOUSEEVENTF_LEFTDOWN)]);
    sleep(40);
    send(&[m(MOUSEEVENTF_LEFTUP)]);
    sleep(150);
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(Some(0)).collect()
}

pub fn find(class: &str) -> Option<HWND> {
    let c = wide(class);
    unsafe { FindWindowW(PCWSTR(c.as_ptr()), PCWSTR::null()).ok().filter(|h| !h.0.is_null()) }
}

pub fn visible(class: &str) -> bool {
    find(class).is_some_and(|h| unsafe { IsWindowVisible(h).as_bool() })
}

pub fn class_of(h: HWND) -> String {
    let mut buf = [0u16; 256];
    let n = unsafe { GetClassNameW(h, &mut buf) }.max(0) as usize;
    String::from_utf16_lossy(&buf[..n])
}

pub fn foreground() -> String {
    let h = unsafe { GetForegroundWindow() };
    if h.0.is_null() { "<none>".into() } else { class_of(h) }
}

pub fn rect(h: HWND) -> RECT {
    let mut r = RECT::default();
    unsafe {
        let _ = GetWindowRect(h, &mut r);
    }
    r
}

pub fn center(h: HWND) -> (i32, i32) {
    let r = rect(h);
    ((r.left + r.right) / 2, (r.top + r.bottom) / 2)
}

pub fn screen() -> (i32, i32) {
    unsafe { (GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN)) }
}

pub fn session_info() -> String {
    unsafe {
        let mut session = 0u32;
        let _ = ProcessIdToSessionId(GetCurrentProcessId(), &mut session);
        let desk = match OpenInputDesktop(DESKTOP_CONTROL_FLAGS(0), false, DESKTOP_READOBJECTS) {
            Ok(d) => {
                let mut buf = [0u16; 128];
                let mut need = 0u32;
                let _ = GetUserObjectInformationW(HANDLE(d.0), UOI_NAME, Some(buf.as_mut_ptr() as *mut c_void), 256, Some(&mut need));
                let _ = CloseDesktop(d);
                String::from_utf16_lossy(&buf[..buf.iter().position(|&c| c == 0).unwrap_or(0)])
            }
            Err(e) => format!("<no input desktop: {e}>"),
        };
        let (w, h) = screen();
        format!("session {session}, input desktop {desk}, screen {w}x{h}, dpi {}, foreground {}", GetDpiForSystem(), foreground())
    }
}

unsafe extern "system" fn clip_proc(h: HWND, m: u32, wp: windows::Win32::Foundation::WPARAM, lp: windows::Win32::Foundation::LPARAM) -> windows::Win32::Foundation::LRESULT {
    unsafe { DefWindowProcW(h, m, wp, lp) }
}

pub struct Clip {
    owner: HWND,
}

impl Clip {
    pub fn new() -> Self {
        unsafe {
            let hinst = GetModuleHandleW(None).unwrap_or_default();
            let wc = WNDCLASSEXW {
                cbSize: size_of::<WNDCLASSEXW>() as u32,
                lpfnWndProc: Some(clip_proc),
                hInstance: hinst.into(),
                lpszClassName: w!("WinrunClip"),
                ..Default::default()
            };
            RegisterClassExW(&wc);
            let owner = CreateWindowExW(
                WINDOW_EX_STYLE(0),
                w!("WinrunClip"),
                w!(""),
                WINDOW_STYLE(0),
                0,
                0,
                0,
                0,
                Some(HWND_MESSAGE),
                None,
                Some(hinst.into()),
                None,
            )
            .unwrap_or_default();
            Self { owner }
        }
    }

    fn open(&self) -> bool {
        for _ in 0..20 {
            if unsafe { OpenClipboard(Some(self.owner)) }.is_ok() {
                return true;
            }
            sleep(25);
        }
        false
    }

    pub fn get(&self) -> Option<String> {
        if !self.open() {
            return None;
        }
        let out = unsafe {
            if IsClipboardFormatAvailable(CF_UNICODETEXT.0 as u32).is_ok()
                && let Ok(h) = GetClipboardData(CF_UNICODETEXT.0 as u32)
            {
                let g = HGLOBAL(h.0);
                let p = GlobalLock(g) as *const u16;
                if p.is_null() {
                    None
                } else {
                    let max = GlobalSize(g) / 2;
                    let mut n = 0;
                    while n < max && *p.add(n) != 0 {
                        n += 1;
                    }
                    let s = String::from_utf16_lossy(slice::from_raw_parts(p, n));
                    let _ = GlobalUnlock(g);
                    Some(s)
                }
            } else {
                None
            }
        };
        unsafe {
            let _ = CloseClipboard();
        }
        out
    }

    pub fn set(&self, s: &str) -> bool {
        if !self.open() {
            return false;
        }
        let units: Vec<u16> = s.encode_utf16().chain(Some(0)).collect();
        let ok = unsafe {
            let _ = EmptyClipboard();
            match GlobalAlloc(GMEM_MOVEABLE, units.len() * 2) {
                Ok(g) => {
                    let p = GlobalLock(g);
                    copy_nonoverlapping(units.as_ptr() as *const u8, p as *mut u8, units.len() * 2);
                    let _ = GlobalUnlock(g);
                    if SetClipboardData(CF_UNICODETEXT.0 as u32, Some(HANDLE(g.0))).is_ok() {
                        true
                    } else {
                        let _ = GlobalFree(Some(g));
                        false
                    }
                }
                Err(_) => false,
            }
        };
        unsafe {
            let _ = CloseClipboard();
        }
        ok
    }
}

pub fn screenshot(path: &Path) -> std::io::Result<()> {
    let (w, h) = screen();
    let mut pixels = vec![0u8; (w * h * 4) as usize];
    unsafe {
        let screen_dc = GetDC(None);
        let mem = CreateCompatibleDC(Some(screen_dc));
        let bmp = CreateCompatibleBitmap(screen_dc, w, h);
        let old = SelectObject(mem, HGDIOBJ(bmp.0));
        let _ = BitBlt(mem, 0, 0, w, h, Some(screen_dc), 0, 0, SRCCOPY);
        let mut info = BITMAPINFO {
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
        GetDIBits(mem, bmp, 0, h as u32, Some(pixels.as_mut_ptr() as *mut c_void), &mut info, DIB_RGB_COLORS);
        SelectObject(mem, old);
        let _ = DeleteObject(HGDIOBJ(bmp.0));
        let _ = DeleteDC(mem);
        ReleaseDC(None, screen_dc);
    }
    let row = (w * 3 + 3) / 4 * 4;
    let size = 54 + row * h;
    let mut out = Vec::with_capacity(size as usize);
    out.extend_from_slice(b"BM");
    out.extend_from_slice(&(size as u32).to_le_bytes());
    out.extend_from_slice(&[0, 0, 0, 0]);
    out.extend_from_slice(&54u32.to_le_bytes());
    out.extend_from_slice(&40u32.to_le_bytes());
    out.extend_from_slice(&w.to_le_bytes());
    out.extend_from_slice(&h.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&24u16.to_le_bytes());
    out.extend_from_slice(&[0u8; 24]);
    for y in (0..h).rev() {
        let start = out.len();
        for x in 0..w {
            let i = ((y * w + x) * 4) as usize;
            out.extend_from_slice(&pixels[i..i + 3]);
        }
        out.resize(start + row as usize, 0);
    }
    fs::write(path, out)
}
