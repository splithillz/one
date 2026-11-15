#[cfg(not(windows))]
fn main() {
    eprintln!("poke is a Windows test program");
}

#[cfg(windows)]
fn main() {
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, PostMessageW, WM_APP, WM_CLOSE, WM_CONTEXTMENU, WM_LBUTTONDBLCLK};

    let args: Vec<String> = std::env::args().skip(1).collect();
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
            eprintln!("usage: poke tray-menu [x y] | tray-dblclick | close");
            std::process::exit(1);
        }
    };
    if unsafe { PostMessageW(Some(main), msg, WPARAM(wp), LPARAM(lp)) }.is_err() {
        std::process::exit(3);
    }
}
