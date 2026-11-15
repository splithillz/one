mod common;

use std::fs;

use common::{apply_all, backspace, chars, form_decode, type_str, Fake, TBox};
use rp_speller_core::config::{Config, InputMode};
use rp_speller_core::hotkey::{self, Hotkey, MOD_ALT, MOD_CONTROL, MOD_SHIFT};
use rp_speller_core::speller::{form_body, parse_response, Speller};
use rp_speller_core::store::CAP;
use rp_speller_core::text::{char_index, chars_from_utf16, to_utf16, utf16_index};
use rp_speller_core::{apply, Corrector, Edit, WordStore};

fn temp_dir(tag: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!("rps-{tag}-{}-{}", std::process::id(), rand_suffix()));
    let _ = fs::remove_dir_all(&d);
    d
}

fn rand_suffix() -> u128 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
}

#[test]
fn form_body_round_trip() {
    let words = vec!["здраствуйте".to_string(), "а б&c=d+".to_string()];
    let body = form_body(&words);
    assert!(body.starts_with("lang=ru&options=6&text=%D0%B7"));
    let form = form_decode(&body);
    assert_eq!(form[2], ("text".into(), "здраствуйте".into()));
    assert_eq!(form[3], ("text".into(), "а б&c=d+".into()));
}

#[test]
fn parse_response_short_and_bad() {
    let words = vec!["харашо".to_string(), "привет".to_string()];
    let r = parse_response(r#"[[{"code":1,"pos":0,"row":0,"col":0,"len":6,"word":"харашо","s":["хорошо","хорош"]}]]"#, &words).unwrap();
    assert_eq!(r.get("харашо").cloned().flatten().as_deref(), Some("хорошо"));
    assert!(!r.contains_key("привет"));
    assert!(parse_response("<html>", &words).is_err());
    assert!(parse_response("{}", &words).is_err());
}

#[test]
fn fake_typing_fix_and_undo() {
    let sp = Fake::standard();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "здраствуйте ", true);
    assert_eq!(b.s(), "здравствуйте ");
    backspace(&mut c, &mut b);
    assert_eq!(b.s(), "здраствуйте ");
    assert!(c.store.is_known_good("здраствуйте"));
    type_str(&mut c, &sp, &mut b, "харашо ", true);
    assert_eq!(b.s(), "здраствуйте хорошо ");
    let calls = sp.calls.get();
    type_str(&mut c, &sp, &mut b, "харашо ", true);
    assert_eq!(b.s(), "здраствуйте хорошо хорошо ");
    assert_eq!(sp.calls.get(), calls, "cached words must not hit the network");
    backspace(&mut c, &mut b);
    assert_eq!(b.s(), "здраствуйте хорошо харашо ");
}

#[test]
fn second_backspace_deletes_normally() {
    let sp = Fake::standard();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "харашо ", true);
    backspace(&mut c, &mut b);
    backspace(&mut c, &mut b);
    assert_eq!(b.s(), "харашо");
}

#[test]
fn undo_only_right_after_the_fix() {
    let sp = Fake::standard();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "харашо и", true);
    backspace(&mut c, &mut b);
    assert_eq!(b.s(), "хорошо ");
    assert!(!c.store.is_known_good("харашо"));
}

#[test]
fn batch_resolve_shifts_the_undo_target() {
    let sp = Fake::standard();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "я пошол домой и сказл ", false);
    assert!(c.has_queue());
    c.flush_with(&sp).unwrap();
    let edits = c.resolve(&b.text, b.caret);
    assert_eq!(edits.len(), 2);
    assert!(edits[0].undoable && !edits[1].undoable);
    apply_all(&mut b, &edits);
    assert_eq!(b.s(), "я пошел домой и сказал ");
    assert_eq!(b.caret, b.text.len());
    backspace(&mut c, &mut b);
    assert_eq!(b.s(), "я пошел домой и сказл ");
    assert_eq!(b.caret, b.text.len());
}

#[test]
fn stale_pending_words_are_dropped() {
    let sp = Fake::standard();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "харашо ", false);
    b.text = chars("совсем другое ");
    b.caret = b.text.len();
    c.flush_with(&sp).unwrap();
    assert!(c.resolve(&b.text, b.caret).is_empty());
}

#[test]
fn enter_waits_for_words_already_in_flight() {
    let sp = Fake::standard();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "как дела харашо ", false);
    let batch = c.take_batch();
    assert_eq!(batch, vec!["дела".to_string(), "харашо".to_string()]);
    c.prepare_finish(&b.text);
    assert!(!c.has_queue(), "a word in flight is not queued twice");
    assert!(c.busy(), "but enter must still wait for it");
    let result = sp.check(&batch);
    c.complete_batch(&batch, result).unwrap();
    assert!(!c.busy());
    let edits = c.finish(&b.text);
    apply_all(&mut b, &edits);
    assert_eq!(b.s(), "как дела хорошо ");
}

#[test]
fn speller_failure_keeps_text_and_retries_later() {
    let sp = Fake::standard();
    sp.fail.set(true);
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "харашо ", true);
    assert_eq!(b.s(), "харашо ");
    assert!(!c.busy());
    sp.fail.set(false);
    let edits = c.finish_with(&b.text, &sp);
    apply_all(&mut b, &edits);
    assert_eq!(b.s(), "хорошо ");
}

#[test]
fn finish_checks_the_last_word_and_keeps_case() {
    let sp = Fake::standard();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "СИГОДНЯ. Вобщем харашо", false);
    let edits = c.finish_with(&b.text, &sp);
    apply_all(&mut b, &edits);
    assert_eq!(b.s(), "СЕГОДНЯ. В общем хорошо");
}

#[test]
fn reset_forgets_pending_and_undo() {
    let sp = Fake::standard();
    let mut c = Corrector::new(WordStore::in_memory());
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "харашо ", true);
    c.reset();
    assert!(c.backspace(&b.text, b.caret).is_none());
    type_str(&mut c, &sp, &mut b, "досал ", false);
    c.reset();
    c.flush_with(&sp).unwrap();
    assert!(c.resolve(&b.text, b.caret).is_empty());
}

#[test]
fn disabled_does_nothing() {
    let sp = Fake::standard();
    let mut c = Corrector::new(WordStore::in_memory());
    c.enabled = false;
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "здраствуйте ", true);
    assert_eq!(b.s(), "здраствуйте ");
    assert!(c.finish_with(&chars("харашо"), &sp).is_empty());
    assert_eq!(sp.calls.get(), 0);
}

#[test]
fn own_and_extra_words_never_go_out() {
    let sp = Fake::standard();
    let mut store = WordStore::in_memory();
    store.set_extra(["  Харашо ", ""]);
    let mut c = Corrector::new(store);
    let mut b = TBox::default();
    type_str(&mut c, &sp, &mut b, "харашо досал ", true);
    assert_eq!(b.s(), "харашо достал ");
    assert_eq!(*sp.seen.borrow(), vec!["досал".to_string()]);
}

#[test]
fn apply_moves_the_caret() {
    let e = Edit { start: 2, len: 3, text: "абвгд".into(), from: "абв".into(), undoable: false };
    let mut t = chars("xxабвyy");
    assert_eq!(apply(&mut t, 7, &e), 9);
    assert_eq!(t.iter().collect::<String>(), "xxабвгдyy");
    let mut t = chars("xxабвyy");
    assert_eq!(apply(&mut t, 3, &e), 7);
    let mut t = chars("xxабвyy");
    assert_eq!(apply(&mut t, 1, &e), 1);
    let bad = Edit { start: 6, len: 5, text: "z".into(), from: "".into(), undoable: false };
    let mut t = chars("xxабвyy");
    assert_eq!(apply(&mut t, 7, &bad), 7);
    assert_eq!(t.iter().collect::<String>(), "xxабвyy");
}

#[test]
fn store_survives_restart_in_the_old_format() {
    let dir = temp_dir("store");
    let mut s1 = WordStore::open(&dir);
    s1.remember("харашо".into(), Some("хорошо".into()));
    s1.remember("привет".into(), None);
    s1.keep("лсмс".into());
    assert!(s1.is_dirty());
    s1.save().unwrap();
    assert!(!s1.is_dirty());
    let cache = fs::read_to_string(dir.join("cache.json")).unwrap();
    assert_eq!(cache, r#"[["харашо","хорошо"],["привет",null]]"#);
    assert_eq!(fs::read_to_string(dir.join("own.json")).unwrap(), r#"["лсмс"]"#);
    let s2 = WordStore::open(&dir);
    assert_eq!(s2.get("харашо"), Some(Some("хорошо")));
    assert_eq!(s2.get("привет"), Some(None));
    assert_eq!(s2.get("пока"), None);
    assert!(s2.is_known_good("лсмс"));
    fs::write(dir.join("cache.json"), "not json").unwrap();
    let s3 = WordStore::open(&dir);
    assert!(s3.is_empty());
    assert!(s3.is_known_good("лсмс"));
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn store_caps_the_cache() {
    let mut s = WordStore::in_memory();
    for i in 0..CAP + 5 {
        s.remember(format!("слово{i}"), None);
    }
    assert_eq!(s.len(), CAP);
    assert_eq!(s.get("слово0"), None);
    assert_eq!(s.get("слово4"), None);
    assert_eq!(s.get("слово5"), Some(None));
    s.remember("слово5".into(), Some("x".into()));
    assert_eq!(s.len(), CAP);
}

#[test]
fn hotkeys_parse_and_format() {
    assert_eq!(hotkey::parse("F7"), Some(Hotkey { mods: 0, vk: 0x76 }));
    assert_eq!(hotkey::parse("ctrl + alt + k"), Some(Hotkey { mods: MOD_CONTROL | MOD_ALT, vk: 0x4B }));
    assert_eq!(hotkey::parse("Shift+F2"), Some(Hotkey { mods: MOD_SHIFT, vk: 0x71 }));
    assert_eq!(hotkey::parse("Control+NumPad5"), Some(Hotkey { mods: MOD_CONTROL, vk: 0x65 }));
    assert_eq!(hotkey::parse("0x91"), Some(Hotkey { mods: 0, vk: 0x91 }));
    assert_eq!(hotkey::parse("Insert").map(|h| h.vk), Some(0x2D));
    assert_eq!(hotkey::parse("`").map(|h| h.vk), Some(0xC0));
    for bad in ["", "Ctrl", "Ctrl+", "Ctrl+Foo", "F25", "0x00", "Alt+Shift"] {
        assert_eq!(hotkey::parse(bad), None, "{bad}");
    }
    for spec in ["F7", "Ctrl+Alt+K", "Shift+F2", "Ctrl+NumPad5", "Scroll", "Alt+OemTilde", "Ctrl+Shift+Win+0", "0x07"] {
        assert_eq!(hotkey::format(hotkey::parse(spec).unwrap()), spec);
    }
    assert_eq!(hotkey::chat_vk("y"), b'Y' as u16);
    assert_eq!(hotkey::chat_vk(" "), b'T' as u16);
    assert_eq!(hotkey::chat_vk("ё"), b'T' as u16);
}

#[test]
fn config_defaults_partial_and_round_trip() {
    let dir = temp_dir("cfg");
    let path = dir.join("config.json");
    assert_eq!(Config::load(&path).unwrap(), Config::default());
    fs::create_dir_all(&dir).unwrap();
    fs::write(&path, r#"{"Hotkey":"Ctrl+K","OpenDelayMs":99999,"InputMode":"weird","ChatKey":" y","Words":["Лсмс","лсмс"," "]}"#).unwrap();
    let c = Config::load(&path).unwrap();
    assert_eq!(c.hotkey, "Ctrl+K");
    assert_eq!(c.open_delay_ms, 3000);
    assert_eq!(c.focus_delay_ms, 150);
    assert_eq!(c.input_mode, InputMode::Paste);
    assert_eq!(c.chat_key, "Y");
    assert_eq!(c.words, vec!["Лсмс".to_string()]);
    assert!(c.submit && c.autocorrect);
    let mut c2 = c.clone();
    c2.input_mode = InputMode::Type;
    c2.save(&path).unwrap();
    let text = fs::read_to_string(&path).unwrap();
    assert!(text.contains("\"InputMode\": \"type\"") && text.contains("Лсмс"), "{text}");
    assert_eq!(Config::load(&path).unwrap(), c2);
    fs::write(&path, "{broken").unwrap();
    assert!(Config::load(&path).is_err());
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn utf16_indices_with_emoji() {
    let s = "а😀б";
    let units: Vec<u16> = s.encode_utf16().collect();
    let cs = chars_from_utf16(&units);
    assert_eq!(cs, chars(s));
    assert_eq!(to_utf16(&cs), units);
    assert_eq!(char_index(&units, 3), 2);
    assert_eq!(char_index(&units, 99), 3);
    assert_eq!(utf16_index(&cs, 2), 3);
    assert_eq!(utf16_index(&cs, 3), 4);
}
