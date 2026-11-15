use std::mem::size_of;

use windows::Win32::Foundation::GetLastError;
use windows::Win32::System::Threading::Sleep;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    MapVirtualKeyW, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE,
    KEYEVENTF_UNICODE, MAPVK_VK_TO_VSC, VIRTUAL_KEY,
};

use crate::log;

pub const VK_RETURN: u16 = 0x0D;
pub const VK_ESCAPE: u16 = 0x1B;
pub const VK_CONTROL: u16 = 0x11;
pub const VK_MENU: u16 = 0x12;
pub const VK_V: u16 = 0x56;

pub fn sleep(ms: u32) {
    unsafe { Sleep(ms) }
}

fn keyboard(scan: u16, flags: KEYBD_EVENT_FLAGS) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: VIRTUAL_KEY(0), wScan: scan, dwFlags: flags, time: 0, dwExtraInfo: 0 } },
    }
}

fn up_flag(up: bool) -> KEYBD_EVENT_FLAGS {
    if up { KEYEVENTF_KEYUP } else { KEYBD_EVENT_FLAGS(0) }
}

pub fn key(vk: u16, up: bool) -> INPUT {
    let scan = unsafe { MapVirtualKeyW(vk as u32, MAPVK_VK_TO_VSC) } as u16;
    keyboard(scan, KEYEVENTF_SCANCODE | up_flag(up))
}

pub fn unicode(unit: u16, up: bool) -> INPUT {
    keyboard(unit, KEYEVENTF_UNICODE | up_flag(up))
}

pub fn send(inputs: &[INPUT]) {
    if inputs.is_empty() {
        return;
    }
    let sent = unsafe { SendInput(inputs, size_of::<INPUT>() as i32) };
    if sent as usize != inputs.len() {
        log::write(format!("SendInput sent {sent} of {}, error {}", inputs.len(), unsafe { GetLastError().0 }));
    }
}

pub fn tap(vk: u16) {
    send(&[key(vk, false)]);
    sleep(45);
    send(&[key(vk, true)]);
}

pub fn paste() {
    send(&[key(VK_CONTROL, false)]);
    sleep(40);
    tap(VK_V);
    sleep(40);
    send(&[key(VK_CONTROL, true)]);
}

pub fn type_text(text: &str) {
    for unit in text.encode_utf16() {
        send(&[unicode(unit, false), unicode(unit, true)]);
        sleep(8);
    }
}
