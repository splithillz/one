mod common;

use common::chars;
use rp_speller_core::rules::{distance, is_eligible, match_case, word_before, words, WordSpan};
use rp_speller_core::speller::{pick_fix, SpellerError};

fn err(code: i32, pos: i64, len: i64, word: &str, s: &[&str]) -> SpellerError {
    SpellerError { code, pos, len, word: word.into(), s: s.iter().map(|x| x.to_string()).collect() }
}

#[test]
fn word_before_cases() {
    for (text, end, want) in [("привет мир", 6, "привет"), ("кто-нибуть", 10, "кто-нибуть"), ("слово-", 6, "слово")] {
        assert_eq!(word_before(&chars(text), end).word, want, "{text}");
    }
}

#[test]
fn eligible_cases() {
    let cases = [
        ("здраствуйте", 0, true),
        ("/me досал телефон", 4, true),
        ("привет Джонн", 7, false),
        ("Здраствуйте", 0, true),
        ("Ну. Здраствуйте", 4, true),
        ("спс", 0, false),
        ("лол", 0, false),
        ("okпривет", 2, false),
        ("сайт.ру", 5, false),
        ("@ник", 1, false),
    ];
    for (text, start, want) in cases {
        let t = chars(text);
        let found = words(&t).into_iter().find(|w| w.start == start).unwrap();
        let w = word_before(&t, found.end);
        assert_eq!(is_eligible(&t, &w, 4, |_| false), want, "{text}");
    }
}

#[test]
fn eligible_edge_cases() {
    let check = |text: &str, start: usize| {
        let t = chars(text);
        let w = words(&t).into_iter().find(|w| w.start == start).unwrap();
        is_eligible(&t, &w, 4, |_| false)
    };
    assert!(check("/do Джон смотрит здраствуйте", 17));
    assert!(check("/do Джон смотрит", 4));
    assert!(!check("/do Смотрит на Джона", 15));
    assert!(check("/me Здраствуйте", 4));
    assert!(!check("http://сайт.рф/страница", 7));
    assert!(!check("ник#привет", 4));
    assert!(check("Привет! Здраствуйте", 8));
    assert!(check("Что… Здраствуйте", 5));
    assert!(!check("а Здраствуйте", 2));
}

#[test]
fn known_good_words_are_skipped() {
    let t = chars("вайнвудский");
    let w = WordSpan { start: 0, end: 11, word: "вайнвудский".into() };
    assert!(!is_eligible(&t, &w, 4, |k| k == "вайнвудский"));
    assert!(is_eligible(&t, &w, 4, |_| false));
}

#[test]
fn match_case_cases() {
    for (orig, fix, want) in [
        ("здраствуйте", "здравствуйте", "здравствуйте"),
        ("Здраствуйте", "здравствуйте", "Здравствуйте"),
        ("СИГОДНЯ", "сегодня", "СЕГОДНЯ"),
        ("Вобщем", "в общем", "В общем"),
    ] {
        assert_eq!(match_case(orig, fix), want);
    }
}

#[test]
fn distance_cases() {
    for (a, b, d) in [("харашо", "хорошо", 2), ("здраствуйте", "здравствуйте", 1), ("тпо", "топ", 1), ("", "абв", 3), ("абв", "абв", 0)] {
        assert_eq!(distance(a, b), d, "{a} {b}");
    }
}

#[test]
fn pick_fix_rules() {
    assert_eq!(pick_fix("здраствуйте", &[err(1, 0, 11, "здраствуйте", &["здравствуйте"])]).as_deref(), Some("здравствуйте"));
    assert_eq!(pick_fix("собака", &[err(1, 0, 6, "собака", &["кошка"])]), None);
    assert_eq!(pick_fix("слово", &[err(3, 0, 5, "слово", &["Слово"])]), None);
    assert_eq!(pick_fix("кто-нибуть", &[err(1, 4, 6, "нибуть", &["нибудь"])]).as_deref(), Some("кто-нибудь"));
    assert_eq!(pick_fix("харашо", &[err(1, 0, 6, "харашо", &["хорошо"]), err(1, 0, 6, "харашо", &["хорошо"])]), None);
    assert_eq!(pick_fix("харашо", &[err(1, 0, 6, "харашо", &[])]), None);
    assert_eq!(pick_fix("харашо", &[err(1, 3, 9, "харашо", &["х"])]), None);
    assert_eq!(pick_fix("харашо", &[err(1, -1, 2, "ха", &["хо"])]), None);
    assert_eq!(pick_fix("досал", &[err(1, 0, 5, "ДОСАЛ", &["Достал"])]).as_deref(), Some("достал"));
}

#[test]
fn words_scanner() {
    let t = chars("кто-нибуть, а-б -слово- ok123 Ёлка ёж");
    let got: Vec<(usize, usize, String)> = words(&t).into_iter().map(|w| (w.start, w.end, w.word)).collect();
    assert_eq!(
        got,
        vec![
            (0, 10, "кто-нибуть".to_string()),
            (12, 15, "а-б".to_string()),
            (17, 22, "слово".to_string()),
            (30, 34, "Ёлка".to_string()),
            (35, 37, "ёж".to_string()),
        ]
    );
}
