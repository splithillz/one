pub const MOD_ALT: u32 = 0x1;
pub const MOD_CONTROL: u32 = 0x2;
pub const MOD_SHIFT: u32 = 0x4;
pub const MOD_WIN: u32 = 0x8;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Hotkey {
    pub mods: u32,
    pub vk: u32,
}

const NAMES: &[(&str, u32)] = &[
    ("Space", 0x20),
    ("PageUp", 0x21),
    ("PageDown", 0x22),
    ("End", 0x23),
    ("Home", 0x24),
    ("Left", 0x25),
    ("Up", 0x26),
    ("Right", 0x27),
    ("Down", 0x28),
    ("Insert", 0x2D),
    ("Delete", 0x2E),
    ("Pause", 0x13),
    ("Scroll", 0x91),
    ("Multiply", 0x6A),
    ("Add", 0x6B),
    ("Subtract", 0x6D),
    ("Decimal", 0x6E),
    ("Divide", 0x6F),
    ("OemSemicolon", 0xBA),
    ("OemPlus", 0xBB),
    ("OemComma", 0xBC),
    ("OemMinus", 0xBD),
    ("OemPeriod", 0xBE),
    ("OemQuestion", 0xBF),
    ("OemTilde", 0xC0),
    ("OemOpenBrackets", 0xDB),
    ("OemPipe", 0xDC),
    ("OemCloseBrackets", 0xDD),
    ("OemQuotes", 0xDE),
    ("OemBackslash", 0xE2),
];

const ALIASES: &[(&str, u32)] = &[
    ("prior", 0x21),
    ("pgup", 0x21),
    ("next", 0x22),
    ("pgdn", 0x22),
    ("ins", 0x2D),
    ("del", 0x2E),
    ("scrolllock", 0x91),
    ("tilde", 0xC0),
    ("oemtilde", 0xC0),
    ("`", 0xC0),
];

pub fn vk_name(vk: u32) -> String {
    match vk {
        0x30..=0x39 | 0x41..=0x5A => char::from_u32(vk).map(String::from).unwrap_or_default(),
        0x60..=0x69 => format!("NumPad{}", vk - 0x60),
        0x70..=0x87 => format!("F{}", vk - 0x6F),
        _ => NAMES
            .iter()
            .find(|(_, v)| *v == vk)
            .map(|(n, _)| (*n).to_string())
            .unwrap_or_else(|| format!("0x{vk:02X}")),
    }
}

pub fn vk_from_name(name: &str) -> Option<u32> {
    let lower = name.trim().to_ascii_lowercase();
    if lower.is_empty() {
        return None;
    }
    let mut chars = lower.chars();
    if let (Some(c), None) = (chars.next(), chars.next())
        && c.is_ascii_alphanumeric()
    {
        return Some(c.to_ascii_uppercase() as u32);
    }
    if let Some(n) = lower.strip_prefix('f').and_then(|n| n.parse::<u32>().ok())
        && (1..=24).contains(&n)
    {
        return Some(0x6F + n);
    }
    if let Some(n) = lower.strip_prefix("numpad").and_then(|n| n.parse::<u32>().ok())
        && n <= 9
    {
        return Some(0x60 + n);
    }
    if let Some(hex) = lower.strip_prefix("0x") {
        return u32::from_str_radix(hex, 16).ok().filter(|v| (0x01..=0xFE).contains(v));
    }
    NAMES
        .iter()
        .find(|(n, _)| n.to_ascii_lowercase() == lower)
        .or_else(|| ALIASES.iter().find(|(n, _)| *n == lower))
        .map(|(_, v)| *v)
}

pub fn parse(spec: &str) -> Option<Hotkey> {
    let mut mods = 0;
    let mut vk = 0;
    if spec.trim().is_empty() {
        return None;
    }
    for part in spec.split('+') {
        match part.trim().to_ascii_lowercase().as_str() {
            "ctrl" | "control" => mods |= MOD_CONTROL,
            "alt" => mods |= MOD_ALT,
            "shift" => mods |= MOD_SHIFT,
            "win" => mods |= MOD_WIN,
            _ => vk = vk_from_name(part)?,
        }
    }
    (vk != 0).then_some(Hotkey { mods, vk })
}

pub fn format(h: Hotkey) -> String {
    let mut parts = Vec::new();
    if h.mods & MOD_CONTROL != 0 {
        parts.push("Ctrl".to_string());
    }
    if h.mods & MOD_ALT != 0 {
        parts.push("Alt".to_string());
    }
    if h.mods & MOD_SHIFT != 0 {
        parts.push("Shift".to_string());
    }
    if h.mods & MOD_WIN != 0 {
        parts.push("Win".to_string());
    }
    parts.push(vk_name(h.vk));
    parts.join("+")
}

pub fn chat_vk(key: &str) -> u16 {
    match key.trim().chars().next() {
        Some(c) if c.is_ascii_alphanumeric() => c.to_ascii_uppercase() as u16,
        _ => b'T' as u16,
    }
}
