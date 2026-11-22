pub fn chars_from_utf16(units: &[u16]) -> Vec<char> {
    char::decode_utf16(units.iter().copied()).map(|r| r.unwrap_or(char::REPLACEMENT_CHARACTER)).collect()
}

pub fn to_utf16(chars: &[char]) -> Vec<u16> {
    let mut out = Vec::with_capacity(chars.len());
    let mut buf = [0u16; 2];
    for c in chars {
        out.extend_from_slice(c.encode_utf16(&mut buf));
    }
    out
}

pub fn char_index(units: &[u16], pos: usize) -> usize {
    let pos = pos.min(units.len());
    char::decode_utf16(units[..pos].iter().copied()).count()
}

pub fn utf16_index(chars: &[char], idx: usize) -> usize {
    chars[..idx.min(chars.len())].iter().map(|c| c.len_utf16()).sum()
}
