use std::collections::HashMap;

use serde::Deserialize;

use crate::rules::distance;

pub const API_HOST: &str = "speller.yandex.net";
pub const API_PATH: &str = "/services/spellservice.json/checkTexts";
pub const API_URL: &str = "https://speller.yandex.net/services/spellservice.json/checkTexts";
pub const OPTIONS: u32 = 6;
pub const LANG: &str = "ru";
pub const BATCH: usize = 40;

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
pub struct SpellerError {
    pub code: i32,
    pub pos: i64,
    pub len: i64,
    pub word: String,
    #[serde(default)]
    pub s: Vec<String>,
}

pub type Fixes = HashMap<String, Option<String>>;

pub trait Speller {
    fn check(&self, words: &[String]) -> Result<Fixes, String>;
}

pub fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'*' => out.push(b as char),
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

pub fn form_body(words: &[String]) -> String {
    let mut out = format!("lang={}&options={}", url_encode(LANG), OPTIONS);
    for w in words {
        out.push_str("&text=");
        out.push_str(&url_encode(w));
    }
    out
}

pub fn parse_response(json: &str, words: &[String]) -> Result<Fixes, String> {
    let all: Vec<Vec<SpellerError>> = serde_json::from_str(json).map_err(|e| format!("bad speller response: {e}"))?;
    Ok(words.iter().zip(all).map(|(w, errs)| (w.clone(), pick_fix(w, &errs))).collect())
}

pub fn check_via(words: &[String], post: impl FnOnce(&str) -> Result<String, String>) -> Result<Fixes, String> {
    if words.is_empty() {
        return Ok(Fixes::new());
    }
    let body = form_body(words);
    parse_response(&post(&body)?, words)
}

pub fn pick_fix(word: &str, errors: &[SpellerError]) -> Option<String> {
    let mut usable = errors.iter().filter(|e| e.code == 1 && !e.s.is_empty());
    let e = usable.next()?;
    if usable.next().is_some() || e.pos < 0 || e.len < 0 {
        return None;
    }
    let chars: Vec<char> = word.chars().collect();
    let (pos, len) = (e.pos as usize, e.len as usize);
    if pos + len > chars.len() {
        return None;
    }
    let part: String = chars[pos..pos + len].iter().collect();
    if part.to_lowercase() != e.word.to_lowercase() {
        return None;
    }
    let head: String = chars[..pos].iter().collect();
    let tail: String = chars[pos + len..].iter().collect();
    let cand = format!("{head}{}{tail}", e.s[0]).to_lowercase();
    let limit = if chars.len() >= 6 { 2 } else { 1 };
    if cand == word || cand.chars().count() < 2 || distance(word, &cand) > limit {
        return None;
    }
    Some(cand)
}
