mod common;

use std::fs;

use common::{apply_all, backspace, type_str, Real, TBox};
use rp_speller_core::{Corrector, Speller, WordStore};

#[test]
fn real_speller_fixes_typical_typos() {
    let words: Vec<String> = ["здраствуйте", "харашо", "вобщем", "кто-нибуть", "привет", "досал"].map(String::from).to_vec();
    let r = Real::new().check(&words).unwrap();
    let get = |k: &str| r.get(k).cloned().flatten();
    assert_eq!(get("здраствуйте").as_deref(), Some("здравствуйте"));
    assert_eq!(get("харашо").as_deref(), Some("хорошо"));
    assert_eq!(get("вобщем").as_deref(), Some("в общем"));
    assert_eq!(get("кто-нибуть").as_deref(), Some("кто-нибудь"));
    assert_eq!(get("привет"), None);
    assert!(r.contains_key("привет"));
    assert_eq!(get("досал").as_deref(), Some("достал"));
}

#[test]
fn fixes_after_space_and_undoes_with_backspace() {
    let sp = Real::new();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "здраствуйте ", true);
    assert_eq!(b.s(), "здравствуйте ");
    backspace(&mut c, &mut b);
    assert_eq!(b.s(), "здраствуйте ");
    type_str(&mut c, &sp, &mut b, "и снова здраствуйте ", true);
    assert_eq!(b.s(), "здраствуйте и снова здраствуйте ");
    assert!(c.store.is_known_good("здраствуйте"));
}

#[test]
fn commands_names_latin_and_slang_stay() {
    let sp = Real::new();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "/me досал телефон, привет Джонн ok 123 лол спс ", true);
    assert_eq!(b.s(), "/me достал телефон, привет Джонн ok 123 лол спс ");
}

#[test]
fn fast_typing_fixes_every_word() {
    let sp = Real::new();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "я пошол домой и сказл привет ", false);
    c.flush_with(&sp).unwrap();
    let edits = c.resolve(&b.text, b.caret);
    apply_all(&mut b, &edits);
    assert!(["я пошел домой и сказал привет ", "я пошёл домой и сказал привет "].contains(&b.s().as_str()), "{}", b.s());
}

#[test]
fn enter_checks_the_whole_line_including_the_last_word() {
    let sp = Real::new();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "как дела харашо", false);
    let edits = c.finish_with(&b.text, &sp);
    apply_all(&mut b, &edits);
    assert_eq!(b.s(), "как дела хорошо");
}

#[test]
fn case_is_kept() {
    let sp = Real::new();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "СИГОДНЯ. Здраствуйте ", true);
    assert_eq!(b.s(), "СЕГОДНЯ. Здравствуйте ");
}

#[test]
fn store_survives_restart() {
    let dir = std::env::temp_dir().join(format!("rps-real-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    let sp = Real::new();
    let mut c = Corrector::new(WordStore::open(&dir));
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "харашо ", true);
    backspace(&mut c, &mut b);
    c.store.save().unwrap();
    let s2 = WordStore::open(&dir);
    assert_eq!(s2.get("харашо"), Some(Some("хорошо")));
    assert!(s2.is_known_good("харашо"));
    fs::remove_dir_all(&dir).unwrap();
}
