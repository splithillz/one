use std::ptr::copy_nonoverlapping;
use std::slice;

use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{GlobalFree, HANDLE, HGLOBAL, HWND};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
};
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE};
use windows::Win32::System::Ole::CF_UNICODETEXT;

use crate::input::sleep;

const TEXT: u32 = CF_UNICODETEXT.0 as u32;

fn open(owner: HWND) -> bool {
    for _ in 0..10 {
        if unsafe { OpenClipboard(Some(owner)) }.is_ok() {
            return true;
        }
        sleep(15);
    }
    false
}

fn close() {
    unsafe {
        let _ = CloseClipboard();
    }
}

pub fn get_text(owner: HWND) -> Option<String> {
    if !open(owner) {
        return None;
    }
    let text = unsafe {
        if IsClipboardFormatAvailable(TEXT).is_ok()
            && let Ok(h) = GetClipboardData(TEXT)
            && !h.is_invalid()
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
    close();
    text
}

fn alloc(bytes: &[u8]) -> Option<HGLOBAL> {
    unsafe {
        let g = GlobalAlloc(GMEM_MOVEABLE, bytes.len().max(1)).ok()?;
        let p = GlobalLock(g);
        if p.is_null() {
            let _ = GlobalFree(Some(g));
            return None;
        }
        copy_nonoverlapping(bytes.as_ptr(), p as *mut u8, bytes.len());
        let _ = GlobalUnlock(g);
        Some(g)
    }
}

fn put(format: u32, bytes: &[u8]) -> bool {
    let Some(g) = alloc(bytes) else { return false };
    unsafe {
        if SetClipboardData(format, Some(HANDLE(g.0))).is_ok() {
            true
        } else {
            let _ = GlobalFree(Some(g));
            false
        }
    }
}

fn put_named(name: PCWSTR, bytes: &[u8]) {
    let f = unsafe { RegisterClipboardFormatW(name) };
    if f != 0 {
        put(f, bytes);
    }
}

pub fn set_text(owner: HWND, text: &str, private: bool) -> bool {
    if !open(owner) {
        return false;
    }
    let units: Vec<u16> = text.encode_utf16().chain(Some(0)).collect();
    let bytes = unsafe { slice::from_raw_parts(units.as_ptr() as *const u8, units.len() * 2) };
    let ok = unsafe { EmptyClipboard() }.is_ok() && put(TEXT, bytes);
    if ok && private {
        put_named(w!("CanIncludeInClipboardHistory"), &0u32.to_le_bytes());
        put_named(w!("CanUploadToCloudClipboard"), &0u32.to_le_bytes());
        put_named(w!("ExcludeClipboardContentFromMonitorProcessing"), &[0]);
    }
    close();
    ok
}

pub fn clear(owner: HWND) -> bool {
    if !open(owner) {
        return false;
    }
    let ok = unsafe { EmptyClipboard() }.is_ok();
    close();
    ok
}
