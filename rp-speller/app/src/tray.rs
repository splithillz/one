use std::mem::size_of;

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Shell::{
    Shell_NotifyIconW, NIF_ICON, NIF_INFO, NIF_MESSAGE, NIF_SHOWTIP, NIF_TIP, NIIF_INFO, NIIF_RESPECT_QUIET_TIME, NIIF_WARNING, NIM_ADD,
    NIM_DELETE, NIM_MODIFY, NIM_SETVERSION, NOTIFYICONDATAW, NOTIFYICON_VERSION_4,
};
use windows::Win32::UI::WindowsAndMessaging::{HICON, WM_APP};

pub const WM_TRAY: u32 = WM_APP + 2;

fn copy(dst: &mut [u16], s: &str) {
    let max = dst.len() - 1;
    let units: Vec<u16> = s.encode_utf16().take(max).collect();
    dst[..units.len()].copy_from_slice(&units);
    dst[units.len()] = 0;
}

pub struct Tray {
    hwnd: HWND,
    icon: HICON,
    added: bool,
}

impl Tray {
    pub fn new(hwnd: HWND, icon: HICON) -> Self {
        Self { hwnd, icon, added: false }
    }

    fn data(&self) -> NOTIFYICONDATAW {
        NOTIFYICONDATAW { cbSize: size_of::<NOTIFYICONDATAW>() as u32, hWnd: self.hwnd, uID: 1, ..Default::default() }
    }

    pub fn add(&mut self, tip: &str) -> bool {
        let mut d = self.data();
        d.uFlags = NIF_ICON | NIF_TIP | NIF_MESSAGE | NIF_SHOWTIP;
        d.uCallbackMessage = WM_TRAY;
        d.hIcon = self.icon;
        copy(&mut d.szTip, tip);
        unsafe {
            self.added = Shell_NotifyIconW(NIM_ADD, &d).as_bool();
            if self.added {
                d.Anonymous.uVersion = NOTIFYICON_VERSION_4;
                let _ = Shell_NotifyIconW(NIM_SETVERSION, &d);
            }
        }
        self.added
    }

    pub fn balloon(&self, text: &str, warning: bool) {
        let mut d = self.data();
        d.uFlags = NIF_INFO;
        copy(&mut d.szInfoTitle, "RP Speller");
        copy(&mut d.szInfo, text);
        d.dwInfoFlags = (if warning { NIIF_WARNING } else { NIIF_INFO }) | NIIF_RESPECT_QUIET_TIME;
        unsafe {
            let _ = Shell_NotifyIconW(NIM_MODIFY, &d);
        }
    }

    pub fn remove(&mut self) {
        if self.added {
            unsafe {
                let _ = Shell_NotifyIconW(NIM_DELETE, &self.data());
            }
            self.added = false;
        }
    }
}
