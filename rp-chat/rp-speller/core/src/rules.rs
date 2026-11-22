use std::collections::HashSet;
use std::sync::LazyLock;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WordSpan {
    pub start: usize,
    pub end: usize,
    pub word: String,
}

impl WordSpan {
    pub fn len(&self) -> usize {
        self.end - self.start
    }

    pub fn is_empty(&self) -> bool {
        self.end == self.start
    }
}

pub const BOUNDARY_CHARS: &str = " \t\n.,!?;:)]»\"'…";
const BEFORE_STOP: &str = "/@#$%&*_=+<>\\|~`";

pub static SLANG: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    [
        "спс", "пасиб", "пасиба", "пж", "пжлст", "плз", "плиз", "лол", "кек", "кекв", "рофл", "кринж", "жиза", "изи", "хз", "мб",
        "крч", "кста", "имхо", "норм", "нормас", "ок", "окей", "оки", "окс", "лан", "ладн", "ладно", "чё", "че", "чо", "чет", "щас",
        "ща", "ваще", "всм", "тип", "типа", "бро", "брат", "братан", "братик", "братишка", "ору", "ахах", "ахаха", "хаха", "хахах",
        "хах", "аха", "пон", "понял", "поняла", "гг", "вп", "нуб", "нубас", "агр", "агрится", "тп", "телепорт", "тпшнуть", "админ",
        "админка", "модер", "саппорт", "рп", "нонрп", "оос", "ик", "дм", "дмщик", "гта", "мта", "лспд", "лсмс", "фиб", "сасд", "пд",
        "мэрия", "мерия", "гетто", "баллас", "вагос", "фэмили", "фемили", "грув", "вайнвуд", "вайнвуде", "палето", "сэнди", "тачка",
        "тачку", "тачки", "бизнес", "бизнесы", "спавн", "спавне", "респ", "респавн", "кд", "инвайт", "инвайтнуть", "варн", "варны",
        "мут", "мьют", "бан", "кик", "дс", "дискорд", "вк", "тг", "телега", "гугл", "ютуб", "твич", "стрим", "стример", "го", "гоу",
        "ку", "прив", "привки", "здарова", "здорова", "хай", "бб",
    ]
    .into_iter()
    .collect()
});

pub fn is_cyr(c: char) -> bool {
    matches!(c, 'А'..='я' | 'Ё' | 'ё')
}

fn is_word_char(c: char) -> bool {
    is_cyr(c) || c == '-'
}

pub fn is_boundary(c: char) -> bool {
    BOUNDARY_CHARS.contains(c)
}

pub fn is_cyr_word(word: &str) -> bool {
    !word.is_empty() && word.split('-').all(|p| !p.is_empty() && p.chars().all(is_cyr))
}

pub fn word_before(text: &[char], end: usize) -> WordSpan {
    let end = end.min(text.len());
    let mut start = end;
    while start > 0 && is_word_char(text[start - 1]) {
        start -= 1;
    }
    while start < end && text[start] == '-' {
        start += 1;
    }
    let mut stop = end;
    while stop > start && text[stop - 1] == '-' {
        stop -= 1;
    }
    WordSpan { start, end: stop, word: text[start..stop].iter().collect() }
}

fn strip_command(head: &[char]) -> &[char] {
    let mut i = 0;
    while i < head.len() && head[i].is_whitespace() {
        i += 1;
    }
    if i < head.len() && head[i] == '/' {
        let mut j = i + 1;
        while j < head.len() && !head[j].is_whitespace() {
            j += 1;
        }
        if j > i + 1 {
            while j < head.len() && head[j].is_whitespace() {
                j += 1;
            }
            return &head[j..];
        }
    }
    head
}

fn ends_sentence(s: &[char]) -> bool {
    let mut i = s.len();
    while i > 0 && s[i - 1].is_whitespace() {
        i -= 1;
    }
    i > 0 && matches!(s[i - 1], '.' | '!' | '?' | '…')
}

pub fn is_eligible(text: &[char], w: &WordSpan, min_length: usize, is_known_good: impl Fn(&str) -> bool) -> bool {
    if w.word.chars().count() < min_length || !is_cyr_word(&w.word) {
        return false;
    }
    let key = w.word.to_lowercase();
    if SLANG.contains(key.as_str()) || is_known_good(&key) {
        return false;
    }
    if w.start > text.len() {
        return false;
    }
    if w.start > 0 {
        let prev = text[w.start - 1];
        if BEFORE_STOP.contains(prev) || prev.is_ascii_alphanumeric() {
            return false;
        }
    }
    let head = &text[..w.start];
    let token_start = head.iter().rposition(|&c| c == ' ' || c == '\t' || c == '\n').map_or(0, |i| i + 1);
    if head[token_start..].iter().any(|&c| c == '/' || c == ':' || c == '.') {
        return false;
    }
    let before = strip_command(head);
    let sentence_start = before.iter().all(|c| c.is_whitespace()) || ends_sentence(before);
    sentence_start || !w.word.chars().next().is_some_and(char::is_uppercase)
}

pub fn match_case(orig: &str, fix: &str) -> String {
    if orig.chars().count() > 1 && orig == orig.to_uppercase() {
        return fix.to_uppercase();
    }
    if orig.chars().next().is_some_and(char::is_uppercase) {
        let mut rest = fix.chars();
        return match rest.next() {
            Some(first) => first.to_uppercase().chain(rest).collect(),
            None => String::new(),
        };
    }
    fix.to_string()
}

pub fn distance(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let (n, m) = (a.len(), b.len());
    let mut d = vec![vec![0usize; m + 1]; n + 1];
    for (i, row) in d.iter_mut().enumerate() {
        row[0] = i;
    }
    for (j, cell) in d[0].iter_mut().enumerate() {
        *cell = j;
    }
    for i in 1..=n {
        for j in 1..=m {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            d[i][j] = (d[i - 1][j] + 1).min(d[i][j - 1] + 1).min(d[i - 1][j - 1] + cost);
            if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                d[i][j] = d[i][j].min(d[i - 2][j - 2] + 1);
            }
        }
    }
    d[n][m]
}

pub fn words(text: &[char]) -> Vec<WordSpan> {
    let mut out = Vec::new();
    let n = text.len();
    let mut i = 0;
    while i < n {
        if !is_cyr(text[i]) {
            i += 1;
            continue;
        }
        let start = i;
        loop {
            while i < n && is_cyr(text[i]) {
                i += 1;
            }
            if i + 1 < n && text[i] == '-' && is_cyr(text[i + 1]) {
                i += 1;
            } else {
                break;
            }
        }
        out.push(WordSpan { start, end: i, word: text[start..i].iter().collect() });
    }
    out
}
