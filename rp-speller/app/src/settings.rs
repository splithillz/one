use std::cell::RefCell;
use std::ffi::c_void;
use std::mem::size_of;

use rp_speller_core::config::{Config, InputMode, Style, MAX_DELAY_MS};
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_USE_IMMERSIVE_DARK_MODE};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, CreateSolidBrush, DeleteObject, EndPaint, InvalidateRect, SetBkColor, SetTextColor, HBRUSH, HDC, HFONT, HGDIOBJ, PAINTSTRUCT,
};
use windows::Win32::UI::Controls::{SetWindowTheme, EM_SETMARGINS};
use windows::Win32::UI::HiDpi::AdjustWindowRectExForDpi;
use windows::Win32::UI::Input::KeyboardAndMouse::SetFocus;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, GetClientRect, GetWindowRect, LoadCursorW, RegisterClassExW, SetForegroundWindow,
    SetWindowPos, ShowWindow, EC_LEFTMARGIN, EC_RIGHTMARGIN, ES_AUTOVSCROLL, ES_MULTILINE, ES_WANTRETURN, HICON, HMENU, IDC_ARROW, SWP_NOACTIVATE,
    SWP_NOZORDER, SW_RESTORE, SW_SHOW, WINDOW_EX_STYLE, WINDOW_STYLE, WM_ACTIVATE, WM_CLOSE, WM_COMMAND, WM_CTLCOLOREDIT, WM_DESTROY,
    WM_DPICHANGED, WM_ERASEBKGND, WM_PAINT, WNDCLASSEXW, WS_CAPTION, WS_CHILD, WS_EX_CONTROLPARENT, WS_SYSMENU, WS_TABSTOP, WS_VISIBLE,
    WS_VSCROLL,
};

use crate::app::with_app;
use crate::controls::{self, Kind, EDGE, INPUT_BG, MUTED, TEXT};
use crate::gfx::{hex, measure, Align, Painter, Rgba, MEDIUM, NORMAL, SEMIBOLD};
use crate::style::{self, Status};
use crate::win::{dpi_of, hinstance, hiword, loword, primary_work_area, send, set_font, ui_font, window_string};

const CLASS: PCWSTR = w!("RPSpellerSettings");
const IDOK: i32 = 1;
const IDCANCEL: i32 = 2;
const ID_STYLE: i32 = 101;
const ID_HOTKEY: i32 = 102;
const ID_CHAT: i32 = 103;
const ID_METHOD: i32 = 104;
const ID_SUBMIT: i32 = 105;
const ID_DELAY: [i32; 3] = [106, 107, 108];
const ID_FIX: i32 = 109;
const ID_WORDS: i32 = 110;
const ID_LINK: i32 = 111;
const DM_GETDEFID: u32 = 0x0400;
const DC_HASDEFID: isize = 0x534B;
pub const SPELLER_URL: &str = "http://api.yandex.ru/speller/";

const BG: Rgba = hex(0x202228, 1.0);
const CARD: Rgba = hex(0x26282F, 1.0);
const FOOTER: Rgba = hex(0x1D1F25, 1.0);
const CLIENT_W: f32 = 960.0;

struct Label {
    text: &'static str,
    sub: Option<&'static str>,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
}

struct Win {
    hwnd: HWND,
    base: Config,
    style: HWND,
    hotkey: HWND,
    chat: HWND,
    method: HWND,
    submit: HWND,
    delays: [HWND; 3],
    fix: HWND,
    words: HWND,
    link: HWND,
    cancel: HWND,
    ok: HWND,
    words_font: HFONT,
    words_brush: HBRUSH,
    labels: Vec<Label>,
    sections: Vec<(&'static str, f32, f32)>,
    cards: Vec<(f32, f32, f32, f32)>,
    separators: Vec<(f32, f32, f32)>,
    preview: (f32, f32, f32, f32),
    note: (f32, f32),
    words_box: (f32, f32, f32, f32),
    footer_y: f32,
    attribution: (f32, f32),
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

pub fn close() {
    if let Some(h) = hwnd() {
        unsafe {
            let _ = DestroyWindow(h);
        }
    }
}

pub fn open(cfg: &Config, icon_small: HICON, icon_big: HICON) {
    if let Some(h) = hwnd() {
        unsafe {
            let _ = ShowWindow(h, SW_RESTORE);
            let _ = SetForegroundWindow(h);
        }
        return;
    }
    controls::register();
    unsafe {
        let wc = WNDCLASSEXW {
            cbSize: size_of::<WNDCLASSEXW>() as u32,
            lpfnWndProc: Some(settings_proc),
            hInstance: hinstance(),
            hIcon: icon_big,
            hIconSm: icon_small,
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            hbrBackground: CreateSolidBrush(BG.colorref()),
            lpszClassName: CLASS,
            ..Default::default()
        };
        RegisterClassExW(&wc);
        let Ok(h) = CreateWindowExW(
            WS_EX_CONTROLPARENT,
            CLASS,
            w!("RP Speller — настройки"),
            WS_CAPTION | WS_SYSMENU,
            0,
            0,
            960,
            700,
            None,
            None,
            Some(hinstance()),
            None,
        ) else {
            return;
        };
        let dark: i32 = 1;
        let _ = DwmSetWindowAttribute(h, DWMWA_USE_IMMERSIVE_DARK_MODE, &dark as *const _ as *const c_void, 4);
        let style = controls::create(h, ID_STYLE, Kind::Segmented { options: Style::ALL.iter().map(|s| s.title().to_string()).collect(), selected: cfg.style.index() }, CARD);
        let fix = controls::create(h, ID_FIX, Kind::Toggle { on: cfg.autocorrect }, CARD);
        let hotkey = controls::create(h, ID_HOTKEY, Kind::KeyCap { spec: cfg.hotkey.clone(), capturing: false, chat_only: false }, CARD);
        let chat = controls::create(h, ID_CHAT, Kind::KeyCap { spec: cfg.chat_key.clone(), capturing: false, chat_only: true }, CARD);
        let method = controls::create(
            h,
            ID_METHOD,
            Kind::Segmented { options: vec!["Вставка".into(), "По буквам".into()], selected: usize::from(cfg.input_mode == InputMode::Type) },
            CARD,
        );
        let submit = controls::create(h, ID_SUBMIT, Kind::Toggle { on: cfg.submit }, CARD);
        let values = [cfg.focus_delay_ms, cfg.open_delay_ms, cfg.paste_delay_ms];
        let delays = [0, 1, 2].map(|i| {
            controls::create(h, ID_DELAY[i], Kind::Stepper { value: values[i], min: 0, max: MAX_DELAY_MS, step: 50, suffix: "мс".into() }, CARD)
        });
        let text: Vec<u16> = cfg.words.join("\r\n").encode_utf16().chain(Some(0)).collect();
        let words = CreateWindowExW(
            WINDOW_EX_STYLE(0),
            w!("EDIT"),
            PCWSTR(text.as_ptr()),
            WS_CHILD | WS_VISIBLE | WS_TABSTOP | WS_VSCROLL | WINDOW_STYLE((ES_MULTILINE | ES_AUTOVSCROLL | ES_WANTRETURN) as u32),
            0,
            0,
            10,
            10,
            Some(h),
            Some(HMENU(std::ptr::without_provenance_mut(ID_WORDS as usize))),
            Some(hinstance()),
            None,
        )
        .unwrap_or_default();
        let _ = SetWindowTheme(words, w!("DarkMode_Explorer"), PCWSTR::null());
        let link = controls::create(h, ID_LINK, Kind::Link { text: "Яндекс.Спеллер".into(), url: SPELLER_URL.into() }, FOOTER);
        let cancel = controls::create(h, IDCANCEL, Kind::Button { text: "Отмена".into(), primary: false }, FOOTER);
        let ok = controls::create(h, IDOK, Kind::Button { text: "Сохранить".into(), primary: true }, FOOTER);
        WIN.with(|c| {
            *c.borrow_mut() = Some(Win {
                hwnd: h,
                base: cfg.clone(),
                style,
                hotkey,
                chat,
                method,
                submit,
                delays,
                fix,
                words,
                link,
                cancel,
                ok,
                words_font: HFONT::default(),
                words_brush: CreateSolidBrush(INPUT_BG.colorref()),
                labels: Vec::new(),
                sections: Vec::new(),
                cards: Vec::new(),
                separators: Vec::new(),
                preview: (0.0, 0.0, 0.0, 0.0),
                note: (0.0, 0.0),
                words_box: (0.0, 0.0, 0.0, 0.0),
                footer_y: 0.0,
                attribution: (0.0, 0.0),
                last_focus: style,
            })
        });
        layout(h, dpi_of(h), None);
        let _ = ShowWindow(h, SW_SHOW);
        let _ = SetForegroundWindow(h);
        let _ = SetFocus(Some(style));
    }
}

fn place(h: HWND, x: f32, y: f32, w: f32, ht: f32) {
    unsafe {
        let _ = SetWindowPos(h, None, x.round() as i32, y.round() as i32, w.round() as i32, ht.round() as i32, SWP_NOZORDER | SWP_NOACTIVATE);
    }
}

fn layout(h: HWND, dpi: u32, suggested: Option<RECT>) {
    let s = dpi as f32 / 96.0;
    let Some(ctl) = with_win(|w| (w.style, w.hotkey, w.chat, w.method, w.submit, w.delays, w.fix, w.words, w.link, w.cancel, w.ok, w.words_font)) else {
        return;
    };
    let (style, hotkey, chat, method, submit, delays, fix, words, link, cancel, ok, old_font) = ctl;
    let mut labels = Vec::new();
    let mut sections = Vec::new();
    let mut cards = Vec::new();
    let mut separators = Vec::new();
    let margin = 24.0 * s;
    let gutter = 24.0 * s;
    let col_w = (CLIENT_W * s - 2.0 * margin - gutter) / 2.0;
    let pad = 14.0 * s;
    let lx = margin;
    let rx = margin + col_w + gutter;

    let ctl_x = |x: f32, cw: f32| x + col_w - pad - cw;

    let mut y = 18.0 * s;
    sections.push(("ВВОД В ИГРУ", rx, y));
    y += 26.0 * s;
    let card_top = y;
    labels.push(Label { text: "Как вводить текст", sub: None, x: rx + pad, y, w: col_w - 2.0 * pad - 230.0 * s, h: 52.0 * s });
    place(method, ctl_x(rx, 220.0 * s), y + 9.0 * s, 220.0 * s, 34.0 * s);
    y += 52.0 * s;
    separators.push((rx, y, col_w));
    labels.push(Label { text: "Сразу отправлять", sub: Some("нажимать Enter в игре"), x: rx + pad, y, w: col_w - 2.0 * pad - 60.0 * s, h: 60.0 * s });
    place(submit, ctl_x(rx, 56.0 * s), y + 15.0 * s, 56.0 * s, 30.0 * s);
    y += 60.0 * s;
    let names = ["Пауза после переключения в игру", "Пауза после открытия чата", "Пауза после вставки"];
    for (i, name) in names.iter().enumerate() {
        separators.push((rx, y, col_w));
        labels.push(Label { text: name, sub: None, x: rx + pad, y, w: col_w - 2.0 * pad - 160.0 * s, h: 52.0 * s });
        place(delays[i], ctl_x(rx, 150.0 * s), y + 10.0 * s, 150.0 * s, 32.0 * s);
        y += 52.0 * s;
    }
    cards.push((rx, card_top, col_w, y - card_top));
    y += 18.0 * s;
    sections.push(("СВОИ СЛОВА", rx, y));
    y += 26.0 * s;
    let card_top = y;
    labels.push(Label { text: "Эти слова не исправлять", sub: Some("по одному в строке: ники, сленг, названия"), x: rx + pad, y, w: col_w - 2.0 * pad, h: 58.0 * s });
    let words_box = (rx + pad, y + 58.0 * s, col_w - 2.0 * pad, 104.0 * s);
    place(words, words_box.0 + 10.0 * s, words_box.1 + 8.0 * s, words_box.2 - 14.0 * s, words_box.3 - 14.0 * s);
    y += 58.0 * s + 104.0 * s + 14.0 * s;
    cards.push((rx, card_top, col_w, y - card_top));
    let right_bottom = y;

    let keys_h = (52.0 + 60.0 + 52.0) * s;
    let fixed = (18.0 + 26.0 + 56.0 + 12.0 + 46.0 + 18.0 + 26.0) * s + keys_h;
    let preview_h = (right_bottom - fixed).max(136.0 * s);
    let mut y = 18.0 * s;
    sections.push(("ОКНО ВВОДА", lx, y));
    y += 26.0 * s;
    let card_top = y;
    place(style, lx + pad, y + 11.0 * s, col_w - 2.0 * pad, 34.0 * s);
    y += 56.0 * s;
    let preview = (lx + pad, y, col_w - 2.0 * pad, preview_h);
    y += preview_h + 12.0 * s;
    let note = (lx + pad, y);
    y += 46.0 * s;
    cards.push((lx, card_top, col_w, y - card_top));
    y += 18.0 * s;
    sections.push(("ОСНОВНОЕ", lx, y));
    y += 26.0 * s;
    let card_top = y;
    labels.push(Label { text: "Исправлять ошибки", sub: None, x: lx + pad, y, w: col_w - 2.0 * pad - 60.0 * s, h: 52.0 * s });
    place(fix, ctl_x(lx, 56.0 * s), y + 11.0 * s, 56.0 * s, 30.0 * s);
    y += 52.0 * s;
    separators.push((lx, y, col_w));
    labels.push(Label { text: "Открыть окно ввода", sub: Some("нажми и введи сочетание"), x: lx + pad, y, w: col_w - 2.0 * pad - 130.0 * s, h: 60.0 * s });
    place(hotkey, ctl_x(lx, 120.0 * s), y + 13.0 * s, 120.0 * s, 34.0 * s);
    y += 60.0 * s;
    separators.push((lx, y, col_w));
    labels.push(Label { text: "Клавиша чата в игре", sub: None, x: lx + pad, y, w: col_w - 2.0 * pad - 130.0 * s, h: 52.0 * s });
    place(chat, ctl_x(lx, 120.0 * s), y + 9.0 * s, 120.0 * s, 34.0 * s);
    y += 52.0 * s;
    cards.push((lx, card_top, col_w, y - card_top));
    let left_bottom = y;

    let footer_y = left_bottom.max(right_bottom) + 22.0 * s;
    let attribution = (margin, footer_y);
    let prefix = "Проверка правописания: ";
    let link_x = margin + measure(prefix, 13.0 * s, NORMAL);
    place(link, link_x, footer_y + 20.0 * s, measure("Яндекс.Спеллер", 13.0 * s, NORMAL) + 4.0 * s, 24.0 * s);
    let bw_ok = 132.0 * s;
    let bw_cancel = 112.0 * s;
    place(ok, CLIENT_W * s - margin - bw_ok, footer_y + 14.0 * s, bw_ok, 36.0 * s);
    place(cancel, CLIENT_W * s - margin - bw_ok - 10.0 * s - bw_cancel, footer_y + 14.0 * s, bw_cancel, 36.0 * s);
    let client_h = footer_y + 64.0 * s;

    let font = ui_font(10.0, dpi, 400);
    set_font(words, font);
    let m = (4.0 * s) as isize;
    send(words, EM_SETMARGINS, (EC_LEFTMARGIN | EC_RIGHTMARGIN) as usize, m | (m << 16));
    if !old_font.is_invalid() {
        unsafe {
            let _ = DeleteObject(HGDIOBJ(old_font.0));
        }
    }
    with_win(|w| {
        w.words_font = font;
        w.labels = labels;
        w.sections = sections;
        w.cards = cards;
        w.separators = separators;
        w.preview = preview;
        w.note = note;
        w.words_box = words_box;
        w.footer_y = footer_y;
        w.attribution = attribution;
    });

    let style_flags = WS_CAPTION | WS_SYSMENU;
    let mut r = RECT { left: 0, top: 0, right: (CLIENT_W * s).round() as i32, bottom: client_h.round() as i32 };
    unsafe {
        let _ = AdjustWindowRectExForDpi(&mut r, style_flags, false, WS_EX_CONTROLPARENT, dpi);
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
                (wa.left + (wa.right - wa.left - ww) / 2, (wa.top + (wa.bottom - wa.top - wh) / 2).max(wa.top))
            } else {
                (cur.left, cur.top)
            }
        }
    };
    unsafe {
        let _ = SetWindowPos(h, None, x, y, ww, wh, SWP_NOZORDER | SWP_NOACTIVATE);
        let _ = InvalidateRect(Some(h), None, true);
    }
}

fn paint_preview(p: &Painter, rect: (f32, f32, f32, f32), selected: Style, s: f32) {
    let (x, y, w, h) = rect;
    p.gradient(x, y, w, h, hex(0x1A1F36, 1.0), hex(0x2A1E2B, 1.0), 8.0 * s);
    let (pt, weight) = style::edit_font(selected);
    let line = (pt * 96.0 / 72.0 * 1.36 * s).round() as i32;
    let geo = style::geometry(selected, (96.0 * s) as u32, (480.0 * s) as i32, line);
    let status = Status::Fixed { from: "здраствуйте".into(), to: "здравствуйте".into(), undoable: true };
    let bubble = style::bubble_kind(selected);
    let room_top = if bubble.is_some() { 40.0 * s } else { 0.0 };
    let k = ((w - 16.0 * s) / geo.w as f32).min((h - 16.0 * s - room_top) / geo.h as f32).min(1.0);
    let ow = geo.w as f32 * k;
    let oh = geo.h as f32 * k;
    let dx = if selected == Style::Chat { x + 8.0 * s } else { x + (w - ow) / 2.0 };
    let dy = y + room_top + (h - room_top - oh) / 2.0;
    p.transform(k, dx, dy);
    let size = pt * 96.0 / 72.0 * s;
    let word_w = measure("здравствуйте", size, if weight >= 600 { SEMIBOLD } else { MEDIUM });
    let underline = (selected == Style::Capsule).then_some((geo.edit.left as f32, geo.edit.left as f32 + word_w));
    style::paint(p, selected, &geo, &status, Some("здравствуйте как дела"), false, underline);
    if let Some(kind) = bubble {
        let (bw, bh) = style::bubble_size(&kind, &status, s);
        let (bx, by, arrow) = match kind {
            style::BubbleKind::Toast => (0.0, -(bh as f32) - 6.0 * s, 0.0),
            style::BubbleKind::Tooltip => {
                let center = geo.edit.left as f32 + word_w / 2.0;
                (center - 24.0 * s, -(bh as f32) + 2.0 * s, 24.0 * s)
            }
        };
        p.transform(k, dx + bx * k, dy + by * k);
        style::paint_bubble(p, &kind, &status, bw as f32, bh as f32, s, arrow);
    }
    p.reset_transform();
}

fn paint(h: HWND) {
    unsafe {
        let mut ps = PAINTSTRUCT::default();
        let hdc = BeginPaint(h, &mut ps);
        let mut rc = RECT::default();
        let _ = GetClientRect(h, &mut rc);
        let s = dpi_of(h) as f32 / 96.0;
        let selected = WIN.with(|c| c.try_borrow().ok().and_then(|g| g.as_ref().map(|w| controls::segment(w.style)))).unwrap_or(0);
        WIN.with(|c| {
            let Ok(g) = c.try_borrow() else { return };
            let Some(win) = g.as_ref() else { return };
            let Some(p) = Painter::begin(hdc, rc.right.max(1), rc.bottom.max(1), false) else { return };
            let (w, ht) = (rc.right as f32, rc.bottom as f32);
            p.clear(BG);
            for (title, x, y) in &win.sections {
                p.text(title, *x + 2.0 * s, *y, 300.0 * s, 22.0 * s, 11.5 * s, SEMIBOLD, MUTED, Align::Left);
            }
            for (x, y, cw, ch) in &win.cards {
                p.fill_round(*x, *y, *cw, *ch, 10.0 * s, CARD);
                p.stroke_round(*x, *y, *cw, *ch, 10.0 * s, 1.0, hex(0xFFFFFF, 0.05));
            }
            for (x, y, cw) in &win.separators {
                p.line(*x + 1.0, *y, *x + *cw - 1.0, *y, 1.0, hex(0xFFFFFF, 0.05));
            }
            for l in &win.labels {
                match l.sub {
                    Some(sub) => {
                        p.text(l.text, l.x, l.y + 10.0 * s, l.w, 22.0 * s, 13.5 * s, NORMAL, TEXT, Align::Left);
                        p.text(sub, l.x, l.y + 31.0 * s, l.w, 18.0 * s, 11.5 * s, NORMAL, MUTED, Align::Left);
                    }
                    None => p.text(l.text, l.x, l.y, l.w, l.h, 13.5 * s, NORMAL, TEXT, Align::Left),
                }
            }
            paint_preview(&p, win.preview, Style::ALL[selected.min(2)], s);
            let (nx, ny) = win.note;
            p.text("В игре окно ввода можно перетащить мышью.", nx, ny, win.preview.2, 18.0 * s, 12.0 * s, NORMAL, MUTED, Align::Left);
            p.text("Двойной клик по его краю вернёт окно на место.", nx, ny + 19.0 * s, win.preview.2, 18.0 * s, 12.0 * s, NORMAL, MUTED, Align::Left);
            let (bx, by, bw, bh) = win.words_box;
            p.fill_round(bx, by, bw, bh, 8.0 * s, INPUT_BG);
            p.stroke_round(bx, by, bw, bh, 8.0 * s, 1.0, EDGE);
            p.fill(0.0, win.footer_y, w, ht - win.footer_y, FOOTER);
            p.line(0.0, win.footer_y, w, win.footer_y, 1.0, hex(0xFFFFFF, 0.06));
            let (ax, ay) = win.attribution;
            p.text("Проверка правописания: ", ax, ay + 20.0 * s, 300.0 * s, 24.0 * s, 13.0 * s, NORMAL, hex(0x9AA1B2, 1.0), Align::Left);
            p.end();
        });
        let _ = EndPaint(h, &ps);
    }
}

fn read_form() -> Option<Config> {
    with_win(|w| {
        let mut cfg = w.base.clone();
        cfg.style = Style::ALL[controls::segment(w.style).min(2)];
        cfg.hotkey = controls::keycap_spec(w.hotkey);
        cfg.chat_key = controls::keycap_spec(w.chat);
        cfg.input_mode = if controls::segment(w.method) == 1 { InputMode::Type } else { InputMode::Paste };
        cfg.submit = controls::toggle_value(w.submit);
        cfg.focus_delay_ms = controls::stepper_value(w.delays[0]);
        cfg.open_delay_ms = controls::stepper_value(w.delays[1]);
        cfg.paste_delay_ms = controls::stepper_value(w.delays[2]);
        cfg.autocorrect = controls::toggle_value(w.fix);
        cfg.words = window_string(w.words).lines().map(str::to_string).collect();
        cfg.normalized()
    })
}

fn save(h: HWND) {
    let Some(cfg) = read_form() else { return };
    if with_app(|a| a.apply_form(cfg)).is_none() {
        return;
    }
    unsafe {
        let _ = DestroyWindow(h);
    }
}

unsafe extern "system" fn settings_proc(h: HWND, msg: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_PAINT => {
                paint(h);
                LRESULT(0)
            }
            WM_ERASEBKGND => LRESULT(1),
            WM_COMMAND => {
                let id = loword(wp.0) as i32;
                match id {
                    IDOK => save(h),
                    IDCANCEL => {
                        let _ = DestroyWindow(h);
                    }
                    ID_STYLE => {
                        if let Some((x, y, pw, ph)) = with_win(|w| w.preview) {
                            let r = RECT { left: x as i32 - 2, top: y as i32 - 60, right: (x + pw) as i32 + 2, bottom: (y + ph) as i32 + 2 };
                            let _ = InvalidateRect(Some(h), Some(&r), false);
                        }
                    }
                    _ => {}
                }
                LRESULT(0)
            }
            DM_GETDEFID => LRESULT((DC_HASDEFID << 16) | IDOK as isize),
            WM_CTLCOLOREDIT => {
                let dc = HDC(wp.0 as *mut c_void);
                SetTextColor(dc, hex(0xD6D9E0, 1.0).colorref());
                SetBkColor(dc, INPUT_BG.colorref());
                LRESULT(with_win(|w| w.words_brush.0 as isize).unwrap_or(0))
            }
            WM_ACTIVATE => {
                if loword(wp.0) == 0 {
                    let focused = windows::Win32::UI::Input::KeyboardAndMouse::GetFocus();
                    if !focused.0.is_null() && windows::Win32::UI::WindowsAndMessaging::IsChild(h, focused).as_bool() {
                        with_win(|w| w.last_focus = focused);
                    }
                } else if let Some(target) = with_win(|w| w.last_focus) {
                    let _ = SetFocus(Some(target));
                }
                LRESULT(0)
            }
            WM_DPICHANGED => {
                let suggested = *(lp.0 as *const RECT);
                layout(h, hiword(wp.0) as u32, Some(suggested));
                LRESULT(0)
            }
            WM_CLOSE => {
                let _ = DestroyWindow(h);
                LRESULT(0)
            }
            WM_DESTROY => {
                if let Some(old) = WIN.with(|c| c.try_borrow_mut().ok().and_then(|mut g| g.take())) {
                    if !old.words_font.is_invalid() {
                        let _ = DeleteObject(HGDIOBJ(old.words_font.0));
                    }
                    let _ = DeleteObject(HGDIOBJ(old.words_brush.0));
                }
                with_app(|a| a.resume_hotkey());
                LRESULT(0)
            }
            _ => DefWindowProcW(h, msg, wp, lp),
        }
    }
}
