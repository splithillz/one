use rp_speller_core::config::{Spot, Style};
use windows::Win32::Foundation::RECT;

use crate::gfx::{hex, measure, Align, Painter, Rgba, BOLD, MEDIUM, NORMAL, SEMIBOLD};

#[derive(Clone, Debug, PartialEq)]
pub enum Status {
    Hint,
    Checking,
    Fixed { from: String, to: String, undoable: bool },
    Kept(String),
}

pub struct Geo {
    pub w: i32,
    pub h: i32,
    pub edit: RECT,
    pub radius: f32,
    pub alpha: u8,
    pub scale: f32,
}

pub struct Look {
    pub panel: Rgba,
    pub field: Rgba,
    pub text: Rgba,
    pub accent: Rgba,
}

pub fn look(style: Style) -> Look {
    match style {
        Style::Glass => Look { panel: hex(0x12141A, 1.0), field: hex(0x1F2229, 1.0), text: hex(0xFFFFFF, 1.0), accent: hex(0x8EF0AD, 1.0) },
        Style::Chat => Look { panel: hex(0x0A0A0C, 1.0), field: hex(0x0A0A0C, 1.0), text: hex(0xFFFFFF, 1.0), accent: hex(0xF3C74B, 1.0) },
        Style::Capsule => Look { panel: hex(0x121419, 1.0), field: hex(0x121419, 1.0), text: hex(0xFFFFFF, 1.0), accent: hex(0x8CAAFF, 1.0) },
    }
}

pub fn edit_font(style: Style) -> (f32, i32) {
    match style {
        Style::Glass => (14.0, 500),
        Style::Chat => (12.5, 600),
        Style::Capsule => (14.0, 500),
    }
}

const GREY: Rgba = hex(0x8B93A5, 1.0);
const HINT_SIZE: f32 = 12.5;
const KEY_SIZE: f32 = 11.0;

const CHAT_KEYS_RIGHT: f32 = 12.0;
const CAPSULE_KEYS_RIGHT: f32 = 20.0;
const HINTS: [(&str, &str); 2] = [("Esc", " отмена"), ("Enter", " отправить")];

fn hint_item_width(key: &str, text: &str, s: f32, labels: bool) -> f32 {
    let label = if labels { measure(text, HINT_SIZE * s, NORMAL) } else { 0.0 };
    label + Painter::keycap_width(key, KEY_SIZE * s) + 4.0 * s
}

fn hints_width(s: f32, labels: bool) -> f32 {
    HINTS.iter().map(|(k, t)| hint_item_width(k, t, s, labels)).sum::<f32>() + 10.0 * s * (HINTS.len() - 1) as f32
}

pub fn geometry(style: Style, dpi: u32, game_w: i32, edit_line: i32) -> Geo {
    let s = dpi as f32 / 96.0;
    let px = |v: f32| (v * s).round() as i32;
    let gw = game_w as f32;
    match style {
        Style::Glass => {
            let w = (gw - 40.0 * s).clamp(440.0 * s, 720.0 * s).min(gw.max(300.0 * s)) as i32;
            let pad = px(14.0);
            let field_h = px(50.0);
            let h = pad + field_h + px(10.0) + px(28.0) + px(12.0);
            let x = pad + px(16.0);
            let y = pad + (field_h - edit_line) / 2;
            Geo { w, h, edit: RECT { left: x, top: y, right: w - pad - px(16.0), bottom: y + edit_line }, radius: 14.0 * s, alpha: 238, scale: s }
        }
        Style::Chat => {
            let w = (gw * 0.42).clamp(380.0 * s, 600.0 * s).min(gw.max(300.0 * s)) as i32;
            let h = px(46.0);
            let x = px(14.0) + measure("ЧАТ", 13.0 * s, BOLD).ceil() as i32 + px(12.0);
            let right = w - (hints_width(s, false) + (CHAT_KEYS_RIGHT + 12.0) * s).ceil() as i32;
            let y = (h - edit_line) / 2;
            Geo { w, h, edit: RECT { left: x, top: y, right, bottom: y + edit_line }, radius: 0.0, alpha: 218, scale: s }
        }
        Style::Capsule => {
            let w = (gw - 40.0 * s).clamp(460.0 * s, 700.0 * s).min(gw.max(300.0 * s)) as i32;
            let h = px(58.0);
            let x = px(26.0);
            let right = w - (hints_width(s, false) + (CAPSULE_KEYS_RIGHT + 14.0) * s).ceil() as i32;
            let y = (h - edit_line) / 2 - px(1.0);
            Geo { w, h, edit: RECT { left: x, top: y, right, bottom: y + edit_line }, radius: h as f32 / 2.0, alpha: 244, scale: s }
        }
    }
}

pub fn place(style: Style, game: RECT, w: i32, h: i32, spot: Option<Spot>) -> (i32, i32) {
    let gw = (game.right - game.left).max(1);
    let gh = (game.bottom - game.top).max(1);
    let (x, y) = match spot {
        Some(sp) => (game.left + (sp.x * gw as f32) as i32, game.top + (sp.y * gh as f32) as i32),
        None => match style {
            Style::Glass => (game.left + (gw - w) / 2, game.top + gh * 70 / 100),
            Style::Chat => (game.left + (gw / 64).max(16), game.top + gh * 22 / 100),
            Style::Capsule => (game.left + (gw - w) / 2, game.top + gh * 80 / 100),
        },
    };
    let x = x.clamp(game.left - w / 2, game.right - w / 2);
    let y = y.clamp(game.top, (game.bottom - h).max(game.top));
    (x, y)
}

pub fn spot_of(game: RECT, x: i32, y: i32) -> Spot {
    let gw = (game.right - game.left).max(1) as f32;
    let gh = (game.bottom - game.top).max(1) as f32;
    Spot { x: (x - game.left) as f32 / gw, y: (y - game.top) as f32 / gh }
}

pub struct Ink {
    pub text: Rgba,
    pub old: Rgba,
    pub new: Rgba,
    pub key_fg: Rgba,
    pub key_edge: Rgba,
    pub key_bg: Rgba,
}

pub fn fix_line(p: Option<&Painter>, x: f32, cy: f32, size: f32, ink: &Ink, status: &Status, prefix: &str, compact: bool) -> f32 {
    let h = size * 1.6;
    let y = cy - h / 2.0;
    let mut cx = x;
    let put = |s: &str, weight: u32, c: Rgba, strike: bool, cx: &mut f32| {
        let w = measure(s, size, weight);
        if let Some(p) = p {
            p.text(s, *cx, y, w + 2.0, h, size, weight, c, Align::Left);
            if strike {
                p.line(*cx, cy + 0.5, *cx + w, cy + 0.5, (size / 11.0).max(1.0), c);
            }
        }
        *cx += w;
    };
    match status {
        Status::Fixed { from, to, undoable } => {
            if !prefix.is_empty() {
                put(prefix, NORMAL, ink.text, false, &mut cx);
            }
            put(from, NORMAL, ink.old, true, &mut cx);
            let aw = size * 1.9;
            if let Some(p) = p {
                let (x1, x2) = (cx + size * 0.45, cx + aw - size * 0.45);
                let t = (size / 12.0).max(1.0);
                p.line(x1, cy + 0.5, x2, cy + 0.5, t, ink.text);
                p.line(x2 - size * 0.35, cy + 0.5 - size * 0.3, x2 + t * 0.3, cy + 0.5, t, ink.text);
                p.line(x2 - size * 0.35, cy + 0.5 + size * 0.3, x2 + t * 0.3, cy + 0.5, t, ink.text);
            }
            cx += aw;
            put(to, BOLD, ink.new, false, &mut cx);
            if *undoable && !compact {
                put("   ", NORMAL, ink.text, false, &mut cx);
                let k = size * 0.9;
                let kw = match p {
                    Some(p) => p.keycap("Backspace", cx, cy, k, ink.key_fg, ink.key_edge, ink.key_bg),
                    None => Painter::keycap_width("Backspace", k),
                };
                cx += kw;
                put(" вернуть", NORMAL, ink.text, false, &mut cx);
            }
        }
        Status::Kept(word) => put(&format!("Вернул «{word}» — больше не трогаю это слово"), NORMAL, ink.text, false, &mut cx),
        Status::Checking => put("Проверяю…", NORMAL, ink.text, false, &mut cx),
        Status::Hint => put("Ошибки исправятся после пробела", NORMAL, ink.text, false, &mut cx),
    }
    cx - x
}

fn hints(p: &Painter, right: f32, cy: f32, s: f32, labels: bool, fg: Rgba, edge: Rgba, bg: Rgba, label: Rgba) {
    let k = KEY_SIZE * s;
    let size = HINT_SIZE * s;
    let mut x = right;
    for (key, text) in HINTS {
        if labels {
            let tw = measure(text, size, NORMAL);
            x -= tw;
            p.text(text, x, cy - size, tw + 2.0, size * 2.0, size, NORMAL, label, Align::Left);
        }
        x -= Painter::keycap_width(key, k) + 4.0 * s;
        p.keycap(key, x, cy, k, fg, edge, bg);
        x -= 10.0 * s;
    }
}

pub fn paint(p: &Painter, style: Style, g: &Geo, status: &Status, preview: Option<&str>, square: bool, underline: Option<(f32, f32)>) {
    let s = g.scale;
    let (w, h) = (g.w as f32, g.h as f32);
    let lk = look(style);
    let preview_text = |p: &Painter, weight: u32| {
        if let Some(t) = preview {
            let (pt, _) = edit_font(style);
            let size = pt * 96.0 / 72.0 * s;
            let e = &g.edit;
            let (x, y, ew, eh) = (e.left as f32, e.top as f32, (e.right - e.left) as f32, (e.bottom - e.top) as f32);
            p.text(t, x, y, ew, eh, size, weight, lk.text, Align::Left);
            let cx = x + measure(t, size, weight) + 1.0;
            p.line(cx, y + eh * 0.18, cx, y + eh * 0.82, 1.5 * s, lk.accent);
        }
    };
    match style {
        Style::Glass => {
            let r = if square { 0.0 } else { g.radius };
            p.fill_round(0.0, 0.0, w, h, r, lk.panel);
            if !square {
                p.stroke_round(0.0, 0.0, w, h, r, 1.0, hex(0x2A2D36, 1.0));
            }
            let pad = 14.0 * s;
            p.fill_round(pad, pad, w - 2.0 * pad, 50.0 * s, 11.0 * s, lk.field);
            p.stroke_round(pad, pad, w - 2.0 * pad, 50.0 * s, 11.0 * s, 1.0, hex(0x2C3039, 1.0));
            preview_text(p, MEDIUM);
            let cy = pad + 50.0 * s + 10.0 * s + 14.0 * s;
            let room = w - 2.0 * pad;
            let labels = room > 560.0 * s;
            let hw = hints_width(s, labels);
            hints(p, w - pad, cy, s, labels, hex(0xFFFFFF, 0.92), hex(0xFFFFFF, 0.22), hex(0xFFFFFF, 0.05), GREY);
            match status {
                Status::Fixed { .. } => {
                    let ink = Ink {
                        text: hex(0xFFFFFF, 0.72),
                        old: hex(0xFFFFFF, 0.42),
                        new: lk.accent,
                        key_fg: hex(0xFFFFFF, 0.92),
                        key_edge: hex(0xFFFFFF, 0.22),
                        key_bg: hex(0xFFFFFF, 0.05),
                    };
                    let size = HINT_SIZE * s;
                    let ch = 26.0 * s;
                    let space = room - hw - 12.0 * s;
                    let full = fix_line(None, 0.0, 0.0, size, &ink, status, "", false) + 22.0 * s;
                    let compact = full > space;
                    let cw = if compact { fix_line(None, 0.0, 0.0, size, &ink, status, "", true) + 22.0 * s } else { full }.min(space);
                    p.fill_round(pad, cy - ch / 2.0, cw, ch, ch / 2.0, lk.accent.alpha(0.12));
                    p.stroke_round(pad, cy - ch / 2.0, cw, ch, ch / 2.0, 1.0, lk.accent.alpha(0.30));
                    p.clip(pad, cy - ch / 2.0, cw - 8.0 * s, ch);
                    fix_line(Some(p), pad + 11.0 * s, cy, size, &ink, status, "", compact);
                    p.unclip();
                }
                _ => {
                    let size = HINT_SIZE * s;
                    let label = match status {
                        Status::Checking => "Проверяю…".to_string(),
                        Status::Kept(word) => format!("Вернул «{word}» — больше не трогаю это слово"),
                        _ => "Ошибки исправятся после пробела".to_string(),
                    };
                    p.text(&label, pad + 4.0 * s, cy - size, room - hw - 16.0 * s, size * 2.0, size, NORMAL, GREY, Align::Left);
                }
            }
        }
        Style::Chat => {
            p.fill(0.0, 0.0, w, h, lk.panel);
            p.fill(0.0, 0.0, 4.0 * s, h, lk.accent);
            p.text("ЧАТ", 14.0 * s, 0.0, 60.0 * s, h, 13.0 * s, BOLD, lk.accent, Align::Left);
            preview_text(p, SEMIBOLD);
            hints(p, w - CHAT_KEYS_RIGHT * s, h / 2.0, s, false, hex(0xFFFFFF, 0.85), hex(0xFFFFFF, 0.18), hex(0xFFFFFF, 0.08), GREY);
        }
        Style::Capsule => {
            let r = if square { 0.0 } else { h / 2.0 };
            p.fill_round(0.0, 0.0, w, h, r, lk.panel);
            p.stroke_round(2.0 * s, 2.0 * s, w - 4.0 * s, h - 4.0 * s, (r - 2.0 * s).max(0.0), 3.0 * s, lk.accent.alpha(0.14));
            p.stroke_round(0.0, 0.0, w, h, r, 1.5 * s, lk.accent.alpha(0.85));
            preview_text(p, MEDIUM);
            hints(p, w - CAPSULE_KEYS_RIGHT * s, h / 2.0, s, false, hex(0xFFFFFF, 0.8), hex(0xFFFFFF, 0.18), hex(0xFFFFFF, 0.06), GREY);
            if let Some((x1, x2)) = underline {
                let y = g.edit.bottom as f32 + 2.5 * s;
                p.line(x1, y, x2, y, 2.0 * s, hex(0x7EE0A0, 1.0));
            }
        }
    }
}

pub enum BubbleKind {
    Toast,
    Tooltip,
}

pub fn bubble_kind(style: Style) -> Option<BubbleKind> {
    match style {
        Style::Glass => None,
        Style::Chat => Some(BubbleKind::Toast),
        Style::Capsule => Some(BubbleKind::Tooltip),
    }
}

pub fn bubble_size(kind: &BubbleKind, status: &Status, s: f32) -> (i32, i32) {
    let size = 13.0 * s;
    let ink = bubble_ink(kind);
    let prefix = match (kind, status) {
        (BubbleKind::Tooltip, Status::Fixed { .. }) => "было ",
        _ => "",
    };
    let text_w = fix_line(None, 0.0, 0.0, size, &ink, status, prefix, false);
    match kind {
        BubbleKind::Toast => ((text_w + 36.0 * s).ceil() as i32, (32.0 * s).ceil() as i32),
        BubbleKind::Tooltip => ((text_w + 28.0 * s).ceil() as i32, (44.0 * s).ceil() as i32),
    }
}

fn bubble_ink(kind: &BubbleKind) -> Ink {
    match kind {
        BubbleKind::Toast => Ink {
            text: hex(0xFFFFFF, 0.78),
            old: hex(0xFFFFFF, 0.5),
            new: hex(0xF3C74B, 1.0),
            key_fg: hex(0xFFFFFF, 1.0),
            key_edge: hex(0xFFFFFF, 0.2),
            key_bg: hex(0xFFFFFF, 0.14),
        },
        BubbleKind::Tooltip => Ink {
            text: hex(0x1A1D24, 1.0),
            old: hex(0x8A8F98, 1.0),
            new: hex(0x1F9D55, 1.0),
            key_fg: hex(0x1A1D24, 1.0),
            key_edge: hex(0xC9CED8, 1.0),
            key_bg: hex(0xFFFFFF, 1.0),
        },
    }
}

pub fn paint_bubble(p: &Painter, kind: &BubbleKind, status: &Status, w: f32, h: f32, s: f32, arrow_x: f32) {
    let size = 13.0 * s;
    let ink = bubble_ink(kind);
    match kind {
        BubbleKind::Toast => {
            p.fill_round(0.0, 0.0, w, h, 6.0 * s, hex(0x000000, 0.80));
            p.dot(14.0 * s, h / 2.0, 4.0 * s, hex(0xF3C74B, 1.0));
            fix_line(Some(p), 26.0 * s, h / 2.0, size, &ink, status, "", false);
        }
        BubbleKind::Tooltip => {
            let body = h - 8.0 * s;
            p.fill_round(0.0, 0.0, w, body, 10.0 * s, hex(0xF2F4F8, 1.0));
            p.diamond(arrow_x.clamp(18.0 * s, w - 18.0 * s), body - 1.0 * s, 11.0 * s, hex(0xF2F4F8, 1.0));
            let prefix = if matches!(status, Status::Fixed { .. }) { "было " } else { "" };
            fix_line(Some(p), 14.0 * s, body / 2.0, size, &ink, status, prefix, false);
        }
    }
}
