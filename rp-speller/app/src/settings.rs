use std::cell::RefCell;
use std::ffi::c_void;
use std::mem::size_of;

use rp_speller_core::config::{Config, InputMode, MAX_DELAY_MS};
use rp_speller_core::hotkey::{self, Hotkey, MOD_ALT, MOD_CONTROL, MOD_SHIFT};
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{DeleteObject, GetSysColor, GetSysColorBrush, SetBkColor, COLOR_WINDOW, HDC, HFONT, HGDIOBJ};
use windows::Win32::UI::Controls::{
    EM_SETLIMITTEXT, HKM_GETHOTKEY, HKM_SETHOTKEY, HOTKEYF_ALT, HOTKEYF_CONTROL, HOTKEYF_EXT, HOTKEYF_SHIFT, HOTKEY_CLASSW, NMHDR, NM_CLICK, NM_RETURN, UDACCEL,
    UDM_SETACCEL, UDM_SETBUDDY, UDM_SETPOS32, UDM_SETRANGE32, UDS_ALIGNRIGHT, UDS_ARROWKEYS, UDS_NOTHOUSANDS, UDS_SETBUDDYINT, UPDOWN_CLASSW,
    WC_LINK,
};
use windows::Win32::UI::HiDpi::AdjustWindowRectExForDpi;
use windows::Win32::UI::Input::KeyboardAndMouse::{GetFocus, SetFocus};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, GetWindowRect, IsChild, WM_ACTIVATE, LoadCursorW, RegisterClassExW, SetForegroundWindow, SetWindowPos,
    ShowWindow, BM_GETCHECK, BM_SETCHECK, BS_AUTOCHECKBOX, BS_DEFPUSHBUTTON, BS_PUSHBUTTON, CBS_DROPDOWNLIST, CB_ADDSTRING, CB_GETCURSEL,
    CB_SETCURSEL, ES_AUTOHSCROLL, ES_AUTOVSCROLL, ES_MULTILINE, ES_NUMBER, ES_UPPERCASE, ES_WANTRETURN, HICON, HMENU, IDC_ARROW, MB_ICONWARNING,
    MB_OK, SWP_NOACTIVATE, SWP_NOZORDER, SW_RESTORE, SW_SHOW, WINDOW_EX_STYLE, WINDOW_STYLE, WM_CLOSE, WM_COMMAND,
    WM_CTLCOLORSTATIC, WM_DESTROY, WM_DPICHANGED, WM_NOTIFY, WNDCLASSEXW, WS_CAPTION, WS_CHILD, WS_EX_CLIENTEDGE, WS_EX_CONTROLPARENT,
    WS_EX_DLGMODALFRAME, WS_SYSMENU, WS_TABSTOP, WS_VISIBLE, WS_VSCROLL,
};

use crate::app::with_app;
use crate::win::{dpi_of, hinstance, line_height, loword, message_box, message_font, primary_work_area, scale, send, set_font, shell_open, text_size, wide, window_string};

const CLASS: PCWSTR = w!("RPSpellerSettings");
const SS_NOPREFIX: u32 = 0x80;
const IDOK: i32 = 1;
const IDCANCEL: i32 = 2;
const DM_GETDEFID: u32 = 0x0400;
const DC_HASDEFID: isize = 0x534B;
pub const SPELLER_URL: &str = "http://api.yandex.ru/speller/";

const LABELS: [&str; 6] = [
    "Горячая клавиша",
    "Клавиша чата в игре",
    "Пауза после переключения в игру, мс",
    "Пауза после открытия чата, мс",
    "Пауза после вставки, мс",
    "Как вводить текст в игру",
];

struct Win {
    hwnd: HWND,
    font: HFONT,
    labels: Vec<HWND>,
    hotkey: HWND,
    chat: HWND,
    delays: [HWND; 3],
    spins: [HWND; 3],
    mode: HWND,
    submit: HWND,
    fix: HWND,
    words_label: HWND,
    words: HWND,
    link: HWND,
    ok: HWND,
    cancel: HWND,
    original_hotkey: String,
    initial_hotkey_value: usize,
    last_focus: HWND,
}

thread_local! {
    static WIN: RefCell<Option<Win>> = const { RefCell::new(None) };
}

fn with_win<R>(f: impl FnOnce(&mut Win) -> R) -> Option<R> {
    WIN.with(|c| c.try_borrow_mut().ok().and_then(|mut g| g.as_mut().map(f)))
}

pub fn hwnd() -> Option<HWND> {
    WIN.with(|c| c.try_borrow().ok().and_then(|g| g.as_ref().map(|w| w.hwnd)))
}

fn child(parent: HWND, class: PCWSTR, text: &str, style: u32, ex: WINDOW_EX_STYLE, id: i32) -> HWND {
    let t = wide(text);
    unsafe {
        CreateWindowExW(
            ex,
            class,
            PCWSTR(t.as_ptr()),
            WS_CHILD | WS_VISIBLE | WINDOW_STYLE(style),
            0,
            0,
            10,
            10,
            Some(parent),
            Some(HMENU(std::ptr::without_provenance_mut(id as isize as usize))),
            Some(hinstance()),
            None,
        )
        .unwrap_or_default()
    }
}

fn hk_mods_from(mods: u32) -> u32 {
    let mut f = 0;
    if mods & MOD_SHIFT != 0 {
        f |= HOTKEYF_SHIFT;
    }
    if mods & MOD_CONTROL != 0 {
        f |= HOTKEYF_CONTROL;
    }
    if mods & MOD_ALT != 0 {
        f |= HOTKEYF_ALT;
    }
    f
}

fn mods_from_hk(f: u32) -> u32 {
    let mut m = 0;
    if f & HOTKEYF_SHIFT != 0 {
        m |= MOD_SHIFT;
    }
    if f & HOTKEYF_CONTROL != 0 {
        m |= MOD_CONTROL;
    }
    if f & HOTKEYF_ALT != 0 {
        m |= MOD_ALT;
    }
    m
}

fn is_extended(vk: u32) -> bool {
    matches!(vk, 0x21..=0x28 | 0x2D | 0x2E | 0x6F | 0x90)
}

pub fn open(cfg: &Config, icon_small: HICON, icon_big: HICON) {
    if let Some(h) = hwnd() {
        unsafe {
            let _ = ShowWindow(h, SW_RESTORE);
            let _ = SetForegroundWindow(h);
        }
        return;
    }
    unsafe {
        let wc = WNDCLASSEXW {
            cbSize: size_of::<WNDCLASSEXW>() as u32,
            lpfnWndProc: Some(settings_proc),
            hInstance: hinstance(),
            hIcon: icon_big,
            hIconSm: icon_small,
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            hbrBackground: GetSysColorBrush(COLOR_WINDOW),
            lpszClassName: CLASS,
            ..Default::default()
        };
        RegisterClassExW(&wc);
        let Ok(h) = CreateWindowExW(
            WS_EX_DLGMODALFRAME | WS_EX_CONTROLPARENT,
            CLASS,
            w!("RP Speller — настройки"),
            WS_CAPTION | WS_SYSMENU,
            0,
            0,
            480,
            600,
            None,
            None,
            Some(hinstance()),
            None,
        ) else {
            return;
        };
        let none = WINDOW_EX_STYLE(0);
        let edge = WS_EX_CLIENTEDGE;
        let tab = WS_TABSTOP.0;
        let mut labels = Vec::new();
        let mut make_label = |text: &str| labels.push(child(h, w!("STATIC"), text, SS_NOPREFIX, none, -1));
        make_label(LABELS[0]);
        let hotkey = child(h, HOTKEY_CLASSW, "", tab, edge, 101);
        make_label(LABELS[1]);
        let chat = child(h, w!("EDIT"), &cfg.chat_key, tab | ES_UPPERCASE as u32 | ES_AUTOHSCROLL as u32, edge, 102);
        send(chat, EM_SETLIMITTEXT, 1, 0);
        let mut delays = [HWND::default(); 3];
        let mut spins = [HWND::default(); 3];
        let values = [cfg.focus_delay_ms, cfg.open_delay_ms, cfg.paste_delay_ms];
        for i in 0..3 {
            make_label(LABELS[2 + i]);
            delays[i] = child(h, w!("EDIT"), &values[i].to_string(), tab | ES_NUMBER as u32 | ES_AUTOHSCROLL as u32, edge, 103 + i as i32);
            spins[i] = child(h, UPDOWN_CLASSW, "", UDS_SETBUDDYINT | UDS_ALIGNRIGHT | UDS_ARROWKEYS | UDS_NOTHOUSANDS, none, 113 + i as i32);
            send(spins[i], UDM_SETBUDDY, delays[i].0 as usize, 0);
            send(spins[i], UDM_SETRANGE32, 0, MAX_DELAY_MS as isize);
            send(spins[i], UDM_SETPOS32, 0, values[i] as isize);
            let accel = UDACCEL { nSec: 0, nInc: 50 };
            send(spins[i], UDM_SETACCEL, 1, &accel as *const UDACCEL as isize);
        }
        make_label(LABELS[5]);
        let mode = child(h, w!("COMBOBOX"), "", tab | CBS_DROPDOWNLIST as u32 | WS_VSCROLL.0, none, 106);
        for item in ["Вставка (Ctrl+V)", "Печать по буквам"] {
            let t = wide(item);
            send(mode, CB_ADDSTRING, 0, t.as_ptr() as isize);
        }
        send(mode, CB_SETCURSEL, usize::from(cfg.input_mode == InputMode::Type), 0);
        let submit = child(h, w!("BUTTON"), "Сразу отправлять (нажимать Enter в игре)", tab | BS_AUTOCHECKBOX as u32, none, 107);
        send(submit, BM_SETCHECK, usize::from(cfg.submit), 0);
        let fix = child(h, w!("BUTTON"), "Исправлять ошибки", tab | BS_AUTOCHECKBOX as u32, none, 108);
        send(fix, BM_SETCHECK, usize::from(cfg.autocorrect), 0);
        let words_label = child(h, w!("STATIC"), "Свои слова — не исправлять (по одному в строке):", SS_NOPREFIX, none, -1);
        let words = child(
            h,
            w!("EDIT"),
            &cfg.words.join("\r\n"),
            tab | ES_MULTILINE as u32 | ES_AUTOVSCROLL as u32 | ES_WANTRETURN as u32 | WS_VSCROLL.0,
            edge,
            109,
        );
        let link = child(h, WC_LINK, &format!("Проверка правописания: <a href=\"{SPELLER_URL}\">Яндекс.Спеллер</a>"), tab, none, 110);
        let ok = child(h, w!("BUTTON"), "Сохранить", tab | BS_DEFPUSHBUTTON as u32, none, IDOK);
        let cancel = child(h, w!("BUTTON"), "Отмена", tab | BS_PUSHBUTTON as u32, none, IDCANCEL);
        let initial = match hotkey::parse(&cfg.hotkey) {
            Some(Hotkey { mods, vk }) => {
                let flags = hk_mods_from(mods) | if is_extended(vk) { HOTKEYF_EXT } else { 0 };
                (vk as usize & 0xFF) | ((flags as usize) << 8)
            }
            None => 0,
        };
        send(hotkey, HKM_SETHOTKEY, initial, 0);
        WIN.with(|c| {
            *c.borrow_mut() = Some(Win {
                hwnd: h,
                font: HFONT::default(),
                labels,
                hotkey,
                chat,
                delays,
                spins,
                mode,
                submit,
                fix,
                words_label,
                words,
                link,
                ok,
                cancel,
                original_hotkey: cfg.hotkey.clone(),
                initial_hotkey_value: send(hotkey, HKM_GETHOTKEY, 0, 0) as usize & 0xFFFF,
                last_focus: hotkey,
            })
        });
        layout(h, dpi_of(h), None);
        let _ = ShowWindow(h, SW_SHOW);
        let _ = SetForegroundWindow(h);
        let _ = SetFocus(Some(hotkey));
    }
}

pub fn close() {
    if let Some(h) = hwnd() {
        unsafe {
            let _ = DestroyWindow(h);
        }
    }
}

fn layout(h: HWND, dpi: u32, suggested: Option<RECT>) {
    let font = message_font(dpi);
    let Some((old, controls)) = with_win(|w| {
        let old = w.font;
        w.font = font;
        let mut all = w.labels.clone();
        all.extend([w.hotkey, w.chat, w.mode, w.submit, w.fix, w.words_label, w.words, w.link, w.ok, w.cancel]);
        all.extend(w.delays);
        all.extend(w.spins);
        (old, all)
    }) else {
        return;
    };
    for c in &controls {
        set_font(*c, font);
    }
    if !old.is_invalid() {
        unsafe {
            let _ = DeleteObject(HGDIOBJ(old.0));
        }
    }
    let Some(w) = WIN.with(|c| c.borrow().as_ref().map(|w| (w.labels.clone(), w.hotkey, w.chat, w.delays, w.spins, w.mode, w.submit, w.fix, w.words_label, w.words, w.link, w.ok, w.cancel))) else {
        return;
    };
    let (labels, hotkey_c, chat, delays, spins, mode, submit, fix, words_label, words, link, ok, cancel) = w;
    let s = |v: i32| scale(v, dpi);
    let line = line_height(h, font);
    let margin = s(16);
    let row = (line + s(10)).max(s(26));
    let gap = s(8);
    let label_w = LABELS.iter().map(|t| text_size(h, font, t).cx).max().unwrap_or(0);
    let ctrl_x = margin + label_w + s(16);
    let widths = [s(170), s(48), s(96), s(96), s(96), s(210)];
    let check_w = ["Сразу отправлять (нажимать Enter в игре)", "Исправлять ошибки"]
        .iter()
        .map(|t| text_size(h, font, t).cx + s(28))
        .max()
        .unwrap_or(0);
    let content = (ctrl_x + widths.iter().copied().max().unwrap_or(0)).max(margin + check_w).max(s(440));
    let client_w = content + margin;
    let inner_w = client_w - 2 * margin;
    let place = |c: HWND, x: i32, y: i32, cw: i32, ch: i32| unsafe {
        let _ = SetWindowPos(c, None, x, y, cw, ch, SWP_NOZORDER | SWP_NOACTIVATE);
    };
    let mut y = margin;
    let row_controls = [hotkey_c, chat, delays[0], delays[1], delays[2], mode];
    for i in 0..6 {
        place(labels[i], margin, y + (row - line) / 2, label_w + s(4), line);
        let ch = if i == 5 { row + s(160) } else { row };
        place(row_controls[i], ctrl_x, y, widths[i], ch);
        if (2..5).contains(&i) {
            send(spins[i - 2], UDM_SETBUDDY, delays[i - 2].0 as usize, 0);
        }
        y += row + gap;
    }
    place(submit, margin, y, inner_w, row);
    y += row;
    place(fix, margin, y, inner_w, row);
    y += row + gap;
    place(words_label, margin, y, inner_w, line);
    y += line + s(6);
    let words_h = s(110);
    place(words, margin, y, inner_w, words_h);
    y += words_h + gap;
    place(link, margin, y, inner_w, line + s(4));
    y += line + s(4) + s(14);
    let btn_w = ["Сохранить", "Отмена"].iter().map(|t| text_size(h, font, t).cx + s(36)).max().unwrap_or(s(100)).max(s(96));
    let btn_h = row;
    place(cancel, client_w - margin - btn_w, y, btn_w, btn_h);
    place(ok, client_w - margin - 2 * btn_w - s(8), y, btn_w, btn_h);
    let client_h = y + btn_h + margin;
    let style = WS_CAPTION | WS_SYSMENU;
    let mut r = RECT { left: 0, top: 0, right: client_w, bottom: client_h };
    unsafe {
        let _ = AdjustWindowRectExForDpi(&mut r, style, false, WS_EX_DLGMODALFRAME | WS_EX_CONTROLPARENT, dpi);
    }
    let (ww, wh) = (r.right - r.left, r.bottom - r.top);
    let (x, y) = match suggested {
        Some(sr) => (sr.left, sr.top),
        None => {
            let mut cur = RECT::default();
            unsafe {
                let _ = GetWindowRect(h, &mut cur);
            }
            if cur.left == 0 && cur.top == 0 {
                let wa = primary_work_area();
                (wa.left + (wa.right - wa.left - ww) / 2, wa.top + (wa.bottom - wa.top - wh) / 2)
            } else {
                (cur.left, cur.top)
            }
        }
    };
    unsafe {
        let _ = SetWindowPos(h, None, x, y, ww, wh, SWP_NOZORDER | SWP_NOACTIVATE);
    }
}

fn read_form() -> Result<Config, String> {
    let w = WIN
        .with(|c| {
            c.borrow().as_ref().map(|w| {
                (w.hotkey, w.chat, w.delays, w.mode, w.submit, w.fix, w.words, w.original_hotkey.clone(), w.initial_hotkey_value)
            })
        })
        .ok_or("окно настроек закрыто")?;
    let (hk, chat, delays, mode, submit, fix, words, original, initial) = w;
    let value = send(hk, HKM_GETHOTKEY, 0, 0) as usize & 0xFFFF;
    let hotkey_spec = if value == initial && !original.trim().is_empty() {
        original
    } else {
        let vk = (value & 0xFF) as u32;
        if vk == 0 {
            return Err("Выбери горячую клавишу: нажми нужное сочетание в поле «Горячая клавиша».".into());
        }
        hotkey::format(Hotkey { mods: mods_from_hk(((value >> 8) & 0xFF) as u32), vk })
    };
    let delay = |h: HWND| window_string(h).trim().parse::<u32>().unwrap_or(0).min(MAX_DELAY_MS);
    let mut cfg = Config {
        hotkey: hotkey_spec,
        chat_key: window_string(chat),
        focus_delay_ms: delay(delays[0]),
        open_delay_ms: delay(delays[1]),
        paste_delay_ms: delay(delays[2]),
        input_mode: if send(mode, CB_GETCURSEL, 0, 0) == 1 { InputMode::Type } else { InputMode::Paste },
        submit: send(submit, BM_GETCHECK, 0, 0) == 1,
        autocorrect: send(fix, BM_GETCHECK, 0, 0) == 1,
        words: window_string(words).lines().map(str::to_string).collect(),
    };
    cfg = cfg.normalized();
    Ok(cfg)
}

fn save(h: HWND) {
    match read_form() {
        Ok(cfg) => {
            if with_app(|a| a.apply_form(cfg)).is_none() {
                return;
            }
            unsafe {
                let _ = DestroyWindow(h);
            }
        }
        Err(e) => message_box(Some(h), &e, MB_ICONWARNING | MB_OK),
    }
}

unsafe extern "system" fn settings_proc(h: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_COMMAND => {
                match loword(wp.0) as i32 {
                    IDOK => save(h),
                    IDCANCEL => {
                        let _ = DestroyWindow(h);
                    }
                    _ => {}
                }
                LRESULT(0)
            }
            DM_GETDEFID => LRESULT((DC_HASDEFID << 16) | IDOK as isize),
            WM_NOTIFY => {
                let hdr = &*(lp.0 as *const NMHDR);
                if (hdr.code == NM_CLICK || hdr.code == NM_RETURN) && hdr.idFrom == 110 {
                    shell_open(SPELLER_URL);
                }
                LRESULT(0)
            }
            WM_CTLCOLORSTATIC => {
                let dc = HDC(wp.0 as *mut c_void);
                SetBkColor(dc, windows::Win32::Foundation::COLORREF(GetSysColor(COLOR_WINDOW)));
                LRESULT(GetSysColorBrush(COLOR_WINDOW).0 as isize)
            }
            WM_DPICHANGED => {
                let suggested = *(lp.0 as *const RECT);
                layout(h, crate::win::hiword(wp.0) as u32, Some(suggested));
                LRESULT(0)
            }
            WM_ACTIVATE => {
                if loword(wp.0) == 0 {
                    let focused = GetFocus();
                    if !focused.0.is_null() && IsChild(h, focused).as_bool() {
                        with_win(|w| w.last_focus = focused);
                    }
                } else if let Some(target) = with_win(|w| w.last_focus) {
                    let _ = SetFocus(Some(target));
                }
                LRESULT(0)
            }
            WM_CLOSE => {
                let _ = DestroyWindow(h);
                LRESULT(0)
            }
            WM_DESTROY => {
                if let Some(old) = WIN.with(|c| c.try_borrow_mut().ok().and_then(|mut g| g.take()))
                    && !old.font.is_invalid()
                {
                    let _ = DeleteObject(HGDIOBJ(old.font.0));
                }
                LRESULT(0)
            }
            _ => DefWindowProcW(h, msg, wp, lp),
        }
    }
}
