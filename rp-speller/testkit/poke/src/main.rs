#[cfg(not(windows))]
fn main() {
    eprintln!("poke is a Windows test program");
}

#[cfg(windows)]
fn main() {
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{LPARAM, RECT, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        AllowSetForegroundWindow, FindWindowW, GetWindowRect, GetWindowThreadProcessId, IsWindowVisible, PostMessageW, WM_APP, WM_CLOSE, WM_CONTEXTMENU,
        WM_LBUTTONDBLCLK,
    };

    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("overlay-rect") {
        let found = unsafe { FindWindowW(w!("RPSpellerOverlay"), PCWSTR::null()) };
        let Ok(o) = found else {
            eprintln!("overlay window not found");
            std::process::exit(2);
        };
        let mut r = RECT::default();
        unsafe {
            let _ = GetWindowRect(o, &mut r);
        }
        let shown = unsafe { IsWindowVisible(o).as_bool() };
        let line = format!("{} {} {} {} {}\n", r.left, r.top, r.right, r.bottom, u8::from(shown));
        match args.get(1) {
            Some(path) => {
                let tmp = format!("{path}.tmp");
                if std::fs::write(&tmp, &line).and_then(|()| std::fs::rename(&tmp, path)).is_err() {
                    std::process::exit(4);
                }
            }
            None => print!("{line}"),
        }
        return;
    }
    let main = unsafe { FindWindowW(w!("RPSpellerMain"), PCWSTR::null()) };
    let Ok(main) = main else {
        eprintln!("RP Speller is not running");
        std::process::exit(2);
    };
    let tray = WM_APP + 2;
    let (msg, wp, lp) = match args.first().map(String::as_str) {
        Some("tray-menu") => {
            let x: usize = args.get(1).and_then(|v| v.parse().ok()).unwrap_or(900);
            let y: usize = args.get(2).and_then(|v| v.parse().ok()).unwrap_or(700);
            (tray, x | (y << 16), (WM_CONTEXTMENU as isize) | (1 << 16))
        }
        Some("tray-dblclick") => (tray, 0, (WM_LBUTTONDBLCLK as isize) | (1 << 16)),
        Some("close") => (WM_CLOSE, 0, 0),
        _ => {
            eprintln!("usage: poke tray-menu [x y] | tray-dblclick | close | overlay-rect [file]");
            std::process::exit(1);
        }
    };
    let mut pid = 0u32;
    unsafe {
        GetWindowThreadProcessId(main, Some(&mut pid));
        let _ = AllowSetForegroundWindow(pid);
    }
    if unsafe { PostMessageW(Some(main), msg, WPARAM(wp), LPARAM(lp)) }.is_err() {
        std::process::exit(3);
    }
}
