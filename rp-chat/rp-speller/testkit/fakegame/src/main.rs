#![cfg_attr(windows, windows_subsystem = "windows")]

#[cfg(not(windows))]
fn main() {
    eprintln!("fakegame is a Windows test program");
}

#[cfg(windows)]
fn main() {
    imp::run();
}

#[cfg(windows)]
mod imp {
    use std::cell::RefCell;
    use std::fs::OpenOptions;
    use std::io::Write;
    use std::mem::size_of;
    use std::slice;
    use std::time::Instant;

    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{HGLOBAL, HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows::Win32::Graphics::Gdi::{
        BeginPaint, DrawTextW, EndPaint, FillRect, GetStockObject, InvalidateRect, SetBkMode, SetTextColor, BLACK_BRUSH, DT_LEFT, DT_NOPREFIX,
        DT_WORDBREAK, HBRUSH, PAINTSTRUCT, TRANSPARENT,
    };
    use windows::Win32::Foundation::COLORREF;
    use windows::Win32::System::DataExchange::{CloseClipboard, GetClipboardData, OpenClipboard};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};
    use windows::Win32::System::Ole::CF_UNICODETEXT;
    use windows::Win32::UI::Input::KeyboardAndMouse::GetKeyState;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetClientRect, GetForegroundWindow, GetMessageW, PostQuitMessage, RegisterClassExW,
        TranslateMessage, MSG, WINDOW_EX_STYLE, WM_CHAR, WM_DESTROY, WM_KEYDOWN, WM_KEYUP, WM_KILLFOCUS, WM_PAINT, WM_SETFOCUS, WM_SYSKEYDOWN,
        WM_SYSKEYUP, WNDCLASSEXW, WS_OVERLAPPEDWINDOW, WS_VISIBLE,
    };

    struct State {
        start: Instant,
        log: String,
        chat: bool,
        skip_char: bool,
        buffer: String,
        last_sent: String,
        ctrl: bool,
    }

    thread_local! {
        static STATE: RefCell<Option<State>> = const { RefCell::new(None) };
    }

    fn log(line: &str) {
        STATE.with(|s| {
            if let Some(s) = s.borrow().as_ref()
                && let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&s.log)
            {
                let _ = writeln!(f, "{} {line}", s.start.elapsed().as_millis());
            }
        });
    }

    fn clipboard(hwnd: HWND) -> String {
        unsafe {
            if OpenClipboard(Some(hwnd)).is_err() {
                return "<clipboard busy>".into();
            }
            let mut out = String::new();
            if let Ok(h) = GetClipboardData(CF_UNICODETEXT.0 as u32) {
                let g = HGLOBAL(h.0);
                let p = GlobalLock(g) as *const u16;
                if !p.is_null() {
                    let max = GlobalSize(g) / 2;
                    let mut n = 0;
                    while n < max && *p.add(n) != 0 {
                        n += 1;
                    }
                    out = String::from_utf16_lossy(slice::from_raw_parts(p, n));
                    let _ = GlobalUnlock(g);
                }
            }
            let _ = CloseClipboard();
            out
        }
    }

    fn redraw(hwnd: HWND) {
        unsafe {
            let _ = InvalidateRect(Some(hwnd), None, true);
        }
    }

    fn on_key(hwnd: HWND, vk: u32, sc: u32) {
        let fg = unsafe { GetForegroundWindow() } == hwnd;
        log(&format!("key down vk=0x{vk:02X} sc=0x{sc:02X} foreground={fg}"));
        let ctrl_state = unsafe { GetKeyState(0x11) } < 0;
        STATE.with(|s| {
            let mut g = s.borrow_mut();
            let Some(st) = g.as_mut() else { return };
            if vk == 0x11 || sc == 0x1D {
                st.ctrl = true;
            }
            let ctrl = ctrl_state || st.ctrl;
            if !st.chat {
                if vk == 0x54 || sc == 0x14 {
                    st.chat = true;
                    st.skip_char = true;
                    st.buffer.clear();
                    drop(g);
                    log("chat open");
                }
                return;
            }
            if vk == 0x0D || sc == 0x1C {
                let text = std::mem::take(&mut st.buffer);
                st.chat = false;
                st.last_sent = text.clone();
                drop(g);
                log(&format!("sent: {text}"));
            } else if vk == 0x1B || sc == 0x01 {
                st.chat = false;
                st.buffer.clear();
                drop(g);
                log("chat closed");
            } else if (vk == 0x56 || sc == 0x2F) && ctrl {
                drop(g);
                let text = clipboard(hwnd);
                log(&format!("paste: {text}"));
                STATE.with(|s| {
                    if let Some(st) = s.borrow_mut().as_mut() {
                        st.buffer.push_str(&text);
                    }
                });
            }
        });
        redraw(hwnd);
    }

    fn on_char(hwnd: HWND, code: u32) {
        let Some(c) = char::from_u32(code) else { return };
        log(&format!("char U+{code:04X}"));
        STATE.with(|s| {
            if let Some(st) = s.borrow_mut().as_mut() {
                if std::mem::take(&mut st.skip_char) && matches!(c, 't' | 'T' | 'е' | 'Е') {
                    return;
                }
                if st.chat && !c.is_control() {
                    st.buffer.push(c);
                }
            }
        });
        redraw(hwnd);
    }

    fn paint(hwnd: HWND) {
        unsafe {
            let mut ps = PAINTSTRUCT::default();
            let dc = BeginPaint(hwnd, &mut ps);
            let mut rc = RECT::default();
            let _ = GetClientRect(hwnd, &mut rc);
            FillRect(dc, &rc, HBRUSH(GetStockObject(BLACK_BRUSH).0));
            SetBkMode(dc, TRANSPARENT);
            SetTextColor(dc, COLORREF(0x00FFFFFF));
            let text = STATE.with(|s| {
                s.borrow()
                    .as_ref()
                    .map(|st| {
                        format!(
                            "FAKE GTA V window (grcWindow)\r\nchat: {}\r\ninput: {}\r\nlast sent: {}",
                            if st.chat { "open" } else { "closed" },
                            st.buffer,
                            st.last_sent
                        )
                    })
                    .unwrap_or_default()
            });
            let mut units: Vec<u16> = text.encode_utf16().collect();
            let mut r = RECT { left: 20, top: rc.bottom - 140, right: rc.right - 20, bottom: rc.bottom - 10 };
            DrawTextW(dc, &mut units, &mut r, DT_LEFT | DT_WORDBREAK | DT_NOPREFIX);
            let _ = EndPaint(hwnd, &ps);
        }
    }

    unsafe extern "system" fn proc_(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
        let sc = ((lp.0 >> 16) & 0xFF) as u32;
        match msg {
            WM_KEYDOWN | WM_SYSKEYDOWN => {
                on_key(hwnd, wp.0 as u32, sc);
                LRESULT(0)
            }
            WM_KEYUP | WM_SYSKEYUP => {
                if wp.0 == 0x11 || sc == 0x1D {
                    STATE.with(|s| {
                        if let Some(st) = s.borrow_mut().as_mut() {
                            st.ctrl = false;
                        }
                    });
                }
                log(&format!("key up vk=0x{:02X} sc=0x{sc:02X}", wp.0));
                LRESULT(0)
            }
            WM_CHAR => {
                on_char(hwnd, wp.0 as u32);
                LRESULT(0)
            }
            WM_SETFOCUS => {
                log("focus in");
                LRESULT(0)
            }
            WM_KILLFOCUS => {
                log("focus out");
                LRESULT(0)
            }
            WM_PAINT => {
                paint(hwnd);
                LRESULT(0)
            }
            WM_DESTROY => {
                unsafe { PostQuitMessage(0) };
                LRESULT(0)
            }
            _ => unsafe { DefWindowProcW(hwnd, msg, wp, lp) },
        }
    }

    pub fn run() {
        let mut path = std::env::var("FAKEGAME_LOG").unwrap_or_else(|_| "fakegame.log".into());
        if path.starts_with('/') {
            path = format!("Z:{}", path.replace('/', "\\"));
        }
        STATE.with(|s| {
            *s.borrow_mut() =
                Some(State {
                start: Instant::now(),
                log: path,
                chat: false,
                skip_char: false,
                buffer: String::new(),
                last_sent: String::new(),
                ctrl: false,
            })
        });
        log("start");
        unsafe {
            let hinst = GetModuleHandleW(None).unwrap_or_default();
            let wc = WNDCLASSEXW {
                cbSize: size_of::<WNDCLASSEXW>() as u32,
                lpfnWndProc: Some(proc_),
                hInstance: hinst.into(),
                lpszClassName: w!("grcWindow"),
                ..Default::default()
            };
            RegisterClassExW(&wc);
            let _ = CreateWindowExW(
                WINDOW_EX_STYLE(0),
                w!("grcWindow"),
                w!("Grand Theft Auto V"),
                WS_OVERLAPPEDWINDOW | WS_VISIBLE,
                20,
                20,
                1100,
                650,
                None,
                None,
                Some(hinst.into()),
                None,
            );
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).0 > 0 {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }
        let _ = PCWSTR::null();
    }
}
