#![allow(dead_code)]

use std::cell::Cell;
use std::collections::HashMap;
use std::time::Duration;

use rp_speller_core::speller::{check_via, Fixes, Speller, API_URL};
use rp_speller_core::{apply, Corrector, Edit};

pub struct Real {
    agent: ureq::Agent,
}

impl Real {
    pub fn new() -> Self {
        let config = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(15)))
            .proxy(ureq::Proxy::try_from_env())
            .tls_config(ureq::tls::TlsConfig::builder().root_certs(ureq::tls::RootCerts::PlatformVerifier).build())
            .build();
        Self { agent: config.into() }
    }
}

impl Speller for Real {
    fn check(&self, words: &[String]) -> Result<Fixes, String> {
        check_via(words, |body| {
            let mut resp = self
                .agent
                .post(API_URL)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .send(body)
                .map_err(|e| e.to_string())?;
            resp.body_mut().read_to_string().map_err(|e| e.to_string())
        })
    }
}

pub fn form_decode(s: &str) -> Vec<(String, String)> {
    fn dec(p: &str) -> String {
        let b = p.as_bytes();
        let mut out = Vec::new();
        let mut i = 0;
        while i < b.len() {
            match b[i] {
                b'+' => out.push(b' '),
                b'%' => {
                    out.push(u8::from_str_radix(&p[i + 1..i + 3], 16).unwrap());
                    i += 2;
                }
                c => out.push(c),
            }
            i += 1;
        }
        String::from_utf8(out).unwrap()
    }
    s.split('&')
        .map(|kv| {
            let (k, v) = kv.split_once('=').unwrap();
            (dec(k), dec(v))
        })
        .collect()
}

pub struct Fake {
    pub fixes: HashMap<String, String>,
    pub calls: Cell<usize>,
    pub fail: Cell<bool>,
    pub seen: std::cell::RefCell<Vec<String>>,
}

impl Fake {
    pub fn new(pairs: &[(&str, &str)]) -> Self {
        Self {
            fixes: pairs.iter().map(|(a, b)| (a.to_string(), b.to_string())).collect(),
            calls: Cell::new(0),
            fail: Cell::new(false),
            seen: Default::default(),
        }
    }

    pub fn standard() -> Self {
        Self::new(&[
            ("здраствуйте", "здравствуйте"),
            ("харашо", "хорошо"),
            ("досал", "достал"),
            ("пошол", "пошел"),
            ("сказл", "сказал"),
            ("сигодня", "сегодня"),
            ("вобщем", "в общем"),
        ])
    }

    fn respond(&self, body: &str) -> Result<String, String> {
        self.calls.set(self.calls.get() + 1);
        if self.fail.get() {
            return Err("offline".into());
        }
        let form = form_decode(body);
        assert!(form.contains(&("lang".into(), "ru".into())));
        assert!(form.contains(&("options".into(), "6".into())));
        let arrays: Vec<String> = form
            .iter()
            .filter(|(k, _)| k == "text")
            .map(|(_, w)| {
                self.seen.borrow_mut().push(w.clone());
                match self.fixes.get(w) {
                    Some(fix) => format!(
                        r#"[{{"code":1,"pos":0,"row":0,"col":0,"len":{},"word":"{}","s":["{}"]}}]"#,
                        w.chars().count(),
                        w,
                        fix
                    ),
                    None => "[]".into(),
                }
            })
            .collect();
        Ok(format!("[{}]", arrays.join(",")))
    }
}

impl Speller for Fake {
    fn check(&self, words: &[String]) -> Result<Fixes, String> {
        check_via(words, |body| self.respond(body))
    }
}

#[derive(Default, Debug)]
pub struct TBox {
    pub text: Vec<char>,
    pub caret: usize,
}

impl TBox {
    pub fn s(&self) -> String {
        self.text.iter().collect()
    }
}

pub fn apply_all(b: &mut TBox, edits: &[Edit]) {
    for e in edits {
        b.caret = apply(&mut b.text, b.caret, e);
    }
}

pub fn type_str(c: &mut Corrector, sp: &dyn Speller, b: &mut TBox, input: &str, flush_each: bool) {
    for ch in input.chars() {
        b.text.insert(b.caret, ch);
        b.caret += 1;
        if let Some(e) = c.typed(&b.text, b.caret, ch) {
            apply_all(b, &[e]);
        }
        if flush_each && c.has_queue() {
            let _ = c.flush_with(sp);
            let edits = c.resolve(&b.text, b.caret);
            apply_all(b, &edits);
        }
    }
}

pub fn backspace(c: &mut Corrector, b: &mut TBox) {
    if let Some(e) = c.backspace(&b.text, b.caret) {
        apply_all(b, &[e]);
        return;
    }
    if b.caret > 0 {
        b.text.remove(b.caret - 1);
        b.caret -= 1;
    }
}

pub fn chars(s: &str) -> Vec<char> {
    s.chars().collect()
}
