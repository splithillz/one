use std::env;
use std::fs;
use std::io::{IsTerminal, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::relay::Relay;
use crate::ui::{self, Clip, VK_A, VK_BACK, VK_CONTROL, VK_DOWN, VK_ESCAPE, VK_F7, VK_F8, VK_LEFT, VK_RETURN, VK_RIGHT, VK_SPACE, VK_TAB};

const OVERLAY: &str = "RPSpellerOverlay";
const SETTINGS: &str = "RPSpellerSettings";
const MAIN: &str = "RPSpellerMain";
const GAME: &str = "grcWindow";
const MENU: &str = "#32768";

static REPORT: Mutex<String> = Mutex::new(String::new());

macro_rules! say {
    ($($arg:tt)*) => {{
        let line = format!($($arg)*);
        println!("{line}");
        if let Ok(mut r) = REPORT.lock() {
            r.push_str(&line);
            r.push_str("\r\n");
        }
    }};
}

struct T {
    pass: u32,
    fail: u32,
    failed: Vec<String>,
    app_exe: PathBuf,
    dir: PathBuf,
    out: PathBuf,
    appdir: PathBuf,
    gamelog: PathBuf,
    relay: Relay,
    clip: Clip,
    game: Option<Child>,
    app: Option<Child>,
}

fn read(p: &Path) -> String {
    fs::read(p).map(|b| String::from_utf8_lossy(&b).into_owned()).unwrap_or_default()
}

impl T {
    fn check(&mut self, name: &str, ok: bool) -> bool {
        say!("{}  {name}", if ok { "ОК    " } else { "ОШИБКА" });
        if ok {
            self.pass += 1;
        } else {
            self.fail += 1;
            self.failed.push(name.to_string());
            say!("        (окно в фокусе: {})", ui::foreground());
        }
        ok
    }

    fn wait(&self, ms: u64, mut f: impl FnMut() -> bool) -> bool {
        let end = Instant::now() + Duration::from_millis(ms);
        loop {
            if f() {
                return true;
            }
            if Instant::now() >= end {
                return false;
            }
            ui::sleep(100);
        }
    }

    fn applog(&self) -> String {
        read(&self.appdir.join("log.txt"))
    }

    fn config(&self) -> String {
        read(&self.appdir.join("config.json"))
    }

    fn app_count(&self, needle: &str) -> usize {
        self.applog().lines().filter(|l| l.contains(needle)).count()
    }

    fn game_count(&self, needle: &str) -> usize {
        read(&self.gamelog).lines().filter(|l| l.contains(needle)).count()
    }

    fn last_sent(&self) -> String {
        read(&self.gamelog)
            .lines()
            .rev()
            .find_map(|l| l.split_once(" sent: ").map(|(_, t)| t.to_string()))
            .unwrap_or_default()
    }

    fn wait_app(&self, needle: &str, ms: u64) -> bool {
        self.wait(ms, || self.applog().contains(needle))
    }

    fn wait_app_more(&self, needle: &str, before: usize, ms: u64) -> bool {
        self.wait(ms, || self.app_count(needle) > before)
    }

    fn wait_game_more(&self, needle: &str, before: usize, ms: u64) -> bool {
        self.wait(ms, || self.game_count(needle) > before)
    }

    fn wait_config(&self, needle: &str, ms: u64) -> bool {
        self.wait(ms, || self.config().contains(needle))
    }

    fn shot(&self, name: &str) {
        if let Err(e) = ui::screenshot(&self.out.join(format!("{name}.png"))) {
            say!("        снимок {name} не сохранился: {e}");
        }
    }

    fn start_game(&mut self) -> bool {
        let before = self.game_count(" start");
        self.game = Command::new(self.dir.join("fakegame.exe")).env("FAKEGAME_LOG", &self.gamelog).spawn().ok();
        self.wait(15000, || self.game_count(" start") > before) && self.wait(5000, || ui::visible(GAME))
    }

    fn start_app(&mut self, relay: bool) -> bool {
        let before = self.app_count("started");
        let mut cmd = Command::new(&self.app_exe);
        if relay {
            cmd.env("RPSPELLER_SPELLER_URL", format!("http://127.0.0.1:{}/check", self.relay.port));
        } else {
            cmd.env_remove("RPSPELLER_SPELLER_URL");
        }
        self.app = cmd.spawn().ok();
        self.wait(15000, || self.app_count("started") > before)
    }

    fn app_alive(&mut self) -> bool {
        self.app.as_mut().is_some_and(|c| matches!(c.try_wait(), Ok(None)))
    }

    fn close_app(&mut self) -> bool {
        self.poke(&["close"]);
        let ok = self.wait(6000, || self.applog().lines().last().is_some_and(|l| l.trim_end().ends_with(" exit")));
        let end = Instant::now() + Duration::from_secs(5);
        while let Some(c) = self.app.as_mut() {
            match c.try_wait() {
                Ok(Some(_)) | Err(_) => break,
                Ok(None) if Instant::now() >= end => {
                    let _ = c.kill();
                    break;
                }
                Ok(None) => ui::sleep(100),
            }
        }
        self.app = None;
        ok
    }

    fn open_settings(&self) -> bool {
        let _ = Command::new(&self.app_exe).spawn().map(|mut c| c.wait());
        self.wait(5000, || ui::visible(SETTINGS))
    }

    fn poke(&self, args: &[&str]) {
        let _ = Command::new(self.dir.join("poke.exe")).args(args).status();
    }

    fn focus_game(&self) -> bool {
        if let Some(g) = ui::find(GAME) {
            let r = ui::rect(g);
            ui::click((r.left + r.right) / 2, r.top + (r.bottom - r.top) / 4);
        }
        self.wait(2000, || ui::foreground() == GAME)
    }

    fn tabs(&self, n: usize) {
        for _ in 0..n {
            ui::tap(VK_TAB);
        }
    }

    fn overlay(&mut self, name: &str, key: u16) -> bool {
        ui::tap(key);
        let shown = self.wait(6000, || ui::visible(OVERLAY));
        let focused = shown && self.wait(3000, || ui::foreground() == OVERLAY);
        self.check(&format!("{name}: окно ввода появилось и получило фокус"), focused);
        if shown && !focused
            && let Some(o) = ui::find(OVERLAY)
        {
            let (x, y) = ui::center(o);
            ui::click(x, y - 8);
            say!("        кликнул в окно ввода, чтобы продолжить");
        }
        ui::sleep(400);
        shown
    }
}

fn game_running() -> bool {
    if ui::find(GAME).is_some() {
        return true;
    }
    let out = Command::new("tasklist").args(["/fo", "csv", "/nh"]).output();
    out.map(|o| {
        let s = String::from_utf8_lossy(&o.stdout).to_lowercase();
        s.lines().any(|l| {
            let name = l.trim_start_matches('"').split('"').next().unwrap_or("");
            let stem = name.trim_end_matches(".exe");
            stem == "gta5" || stem == "gta5_enhanced" || ((stem.starts_with("fivem") || stem.starts_with("cfx")) && stem.contains("gtaprocess"))
        })
    })
    .unwrap_or(false)
}

fn finish(code: i32, interactive: bool, out: &Path) -> i32 {
    if let Ok(r) = REPORT.lock() {
        let _ = fs::write(out.join("report.txt"), r.as_bytes());
    }
    if interactive {
        print!("\nНажми Enter, чтобы закрыть окно.");
        let _ = std::io::stdout().flush();
        let mut s = String::new();
        let _ = std::io::stdin().read_line(&mut s);
    }
    code
}

pub fn main() -> i32 {
    ui::set_dpi_aware();
    let interactive = std::io::stdin().is_terminal() && env::var_os("CI").is_none();
    let dir = env::current_exe().ok().and_then(|p| p.parent().map(PathBuf::from)).unwrap_or_default();
    let out = env::var("WINRUN_OUT").map(PathBuf::from).unwrap_or_else(|_| dir.join("selftest-report"));
    let _ = fs::remove_dir_all(&out);
    let _ = fs::create_dir_all(&out);
    let appdir = PathBuf::from(env::var("APPDATA").unwrap_or_default()).join("RPSpeller");

    say!("Самопроверка RP Speller {}", env!("CARGO_PKG_VERSION"));
    say!("{}", ui::windows_version());
    say!("{}", ui::session_info());

    let Some(app_exe) = [dir.join("RPSpeller.exe"), dir.join("..").join("RPSpeller.exe")].into_iter().find(|p| p.exists()) else {
        say!("\nНе нашёл RPSpeller.exe ни рядом, ни в папке выше. Распакуй архив целиком и запусти снова.");
        return finish(2, interactive, &out);
    };
    for need in ["fakegame.exe", "poke.exe"] {
        if !dir.join(need).exists() {
            say!("\nНе нашёл {need} рядом с самопроверкой. Распакуй архив целиком и запусти снова.");
            return finish(2, interactive, &out);
        }
    }
    if game_running() {
        say!("\nЗапущена GTA V или FiveM. Закрой игру и запусти самопроверку снова:");
        say!("тест печатает и отправляет сообщения, они не должны попасть в настоящий чат.");
        return finish(2, interactive, &out);
    }

    if interactive {
        say!("\nСейчас тест сам будет открывать окна, нажимать клавиши и печатать. Это займёт 4–5 минут.");
        say!("Не трогай клавиатуру и мышь, пока не появится итог. Закрыть это окно — прервать тест.");
        for i in (1..=10).rev() {
            print!("\rСтарт через {i:2} с ");
            let _ = std::io::stdout().flush();
            ui::sleep(1000);
        }
        println!();
    }

    let mut was_running = false;
    if ui::post_close(MAIN) {
        was_running = true;
        let gone = {
            let end = Instant::now() + Duration::from_secs(8);
            loop {
                if ui::find(MAIN).is_none() {
                    break true;
                }
                if Instant::now() >= end {
                    break false;
                }
                ui::sleep(100);
            }
        };
        say!("RP Speller был запущен — {}.", if gone { "закрыл его на время теста" } else { "закрыть не получилось" });
        if !gone {
            say!("Закрой RP Speller сам (правый клик по значку в трее → «Выход») и запусти самопроверку снова.");
            return finish(2, interactive, &out);
        }
    }
    let backup = appdir.with_file_name("RPSpeller.selftest-backup");
    let backed_up = appdir.exists() && {
        let _ = fs::remove_dir_all(&backup);
        fs::rename(&appdir, &backup).is_ok()
    };
    if appdir.exists() {
        let _ = fs::remove_dir_all(&appdir);
    }
    let clip = Clip::new();
    let saved_clip = clip.get();

    let relay = match Relay::start() {
        Ok(r) => r,
        Err(e) => {
            say!("Не смог запустить тестовый сервер: {e}");
            return finish(2, interactive, &out);
        }
    };
    let mut t = T {
        pass: 0,
        fail: 0,
        failed: Vec::new(),
        app_exe,
        gamelog: out.join("game.log"),
        dir,
        out: out.clone(),
        appdir: appdir.clone(),
        relay,
        clip,
        game: None,
        app: None,
    };

    run(&mut t);

    for f in ["log.txt", "config.json", "cache.json", "own.json"] {
        let _ = fs::copy(t.appdir.join(f), t.out.join(format!("app-{f}")));
    }
    if t.app.is_some() || ui::find(MAIN).is_some() {
        t.close_app();
    }
    if let Some(mut g) = t.game.take() {
        let _ = g.kill();
        let _ = g.wait();
    }
    ui::sleep(500);
    let _ = fs::remove_dir_all(&appdir);
    if backed_up && fs::rename(&backup, &appdir).is_err() {
        say!("Не получилось вернуть твои настройки: они лежат в {}", backup.display());
    }
    match &saved_clip {
        Some(text) => {
            t.clip.set(text);
        }
        None => {
            t.clip.set("");
        }
    }

    say!("\n==================================================");
    say!("Итог: прошло {} из {} проверок.", t.pass, t.pass + t.fail);
    if t.failed.is_empty() {
        say!("Всё работает.");
    } else {
        say!("Не прошли:");
        for f in &t.failed {
            say!("  • {f}");
        }
    }
    say!("Отчёт и снимки экрана: {}", t.out.display());
    say!("Пришли мне report.txt и картинки из этой папки.");
    if backed_up {
        say!("Твои настройки и словарь RP Speller возвращены на место.");
    }
    if was_running {
        say!("RP Speller был закрыт на время теста — запусти его снова.");
    }
    finish(i32::from(t.fail > 0), interactive, &t.out)
}

fn run(t: &mut T) {
    say!("\n== 1. Запуск");
    let ok = t.start_game();
    t.check("тестовое окно «игры» открылось", ok);
    let ok = t.start_app(true);
    t.check("RP Speller запустился", ok);
    ui::sleep(1500);
    let ok = !t.applog().contains("tray icon failed");
    t.check("значок в трее появился", ok);
    if t.applog().contains("RegisterHotKey(F7) failed") {
        t.check("клавиша F7 свободна", false);
        say!("\nF7 занята другой программой, и в игре она тоже не сработала бы.");
        say!("Закрой программу, которая её держит, или выбери в настройках RP Speller другую клавишу.");
        say!("Дальше тест без F7 бессмысленен, останавливаюсь.");
        return;
    }
    t.check("клавиша F7 свободна", true);
    t.shot("01-start");

    say!("\n== 2. F7 открывает чат игры и окно ввода");
    let ok = t.focus_game();
    t.check("окно «игры» на переднем плане после клика", ok);
    let before = t.game_count("chat open");
    t.overlay("F7", VK_F7);
    let ok = t.wait_game_more("chat open", before, 6000);
    t.check("программа нажала T в «игре»", ok);
    let ok = read(&t.gamelog).contains("vk=0x54 sc=0x14");
    t.check("«игра» увидела T как обычную клавишу", ok);
    t.shot("02-overlay");

    say!("\n== 3. Исправление после пробела и отмена через Backspace");
    ui::type_text("здраствуйте ");
    let ok = t.wait_app("fixed: здраствуйте → здравствуйте", 6000);
    t.check("опечатка исправлена", ok);
    ui::sleep(300);
    t.shot("03-fixed");
    ui::tap(VK_BACK);
    let ok = t.wait_app("kept: здраствуйте", 4000);
    t.check("Backspace вернул слово", ok);
    t.shot("04-kept");

    say!("\n== 4. Enter проверяет последнее слово и отправляет");
    let sent = t.game_count(" sent: ");
    ui::type_text("как дила харашо");
    ui::sleep(300);
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 8000);
    t.check("сообщение дошло до «игры»", ok);
    let ok = t.last_sent() == "здраствуйте как дела хорошо";
    t.check("отправлено с исправлениями, кроме возвращённого слова", ok);
    let ok = read(&t.gamelog).contains("paste: здраствуйте как дела хорошо");
    t.check("вставлено через Ctrl+V", ok);
    let ok = t.wait(3000, || ui::foreground() == GAME);
    t.check("после отправки «игра» снова в фокусе", ok);
    let ok = !t.relay.all_words().iter().any(|w| w.contains(' '));
    t.check("в Спеллер ушли отдельные слова, а не сообщение", ok);

    say!("\n== 5. Ctrl+Backspace и Ctrl+A");
    t.focus_game();
    let sent = t.game_count(" sent: ");
    t.overlay("Ctrl+Backspace", VK_F7);
    ui::type_text("один два");
    ui::chord(VK_CONTROL, VK_BACK);
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 8000) && t.last_sent() == "один";
    t.check("Ctrl+Backspace стирает слово", ok);
    t.focus_game();
    let sent = t.game_count(" sent: ");
    t.overlay("Ctrl+A", VK_F7);
    ui::type_text("старый");
    ui::chord(VK_CONTROL, VK_A);
    ui::type_text("новый");
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 8000) && t.last_sent() == "новый";
    t.check("Ctrl+A выделяет всё", ok);

    say!("\n== 6. Esc закрывает чат без отправки");
    t.focus_game();
    let sent = t.game_count(" sent: ");
    let closed = t.game_count("chat closed");
    t.overlay("Esc", VK_F7);
    ui::type_text("превет");
    ui::tap(VK_ESCAPE);
    let ok = t.wait_game_more("chat closed", closed, 6000);
    t.check("чат «игры» закрыт через Esc", ok);
    ui::sleep(800);
    let ok = t.game_count(" sent: ") == sent;
    t.check("ничего не отправлено", ok);

    say!("\n== 7. Медленный Спеллер: Enter не зависает");
    t.relay.set_mode("slow:4");
    t.focus_game();
    let sent = t.game_count(" sent: ");
    t.overlay("медленный Спеллер", VK_F7);
    ui::type_text("сигодня");
    ui::tap(VK_RETURN);
    let ok = t.wait_app("speller is slow", 5000);
    t.check("программа перестала ждать", ok);
    let ok = t.wait_game_more(" sent: ", sent, 6000) && t.last_sent() == "сигодня";
    t.check("сообщение ушло как набрано", ok);
    t.relay.set_mode("canned");
    ui::sleep(4000);

    say!("\n== 8. Сломанный Спеллер: набор не ломается");
    t.relay.set_mode("fail");
    t.focus_game();
    let sent = t.game_count(" sent: ");
    t.overlay("сломанный Спеллер", VK_F7);
    ui::type_text("пошол ");
    let ok = t.wait_app("speller failed: HTTP 500", 5000);
    t.check("ошибка записана в журнал", ok);
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 6000) && t.last_sent() == "пошол";
    t.check("сообщение ушло без изменений", ok);
    t.relay.set_mode("canned");

    say!("\n== 9. Буфер обмена возвращается после вставки");
    let ok = t.clip.set("старое");
    t.check("тест положил текст в буфер", ok);
    t.focus_game();
    let sent = t.game_count(" sent: ");
    t.overlay("буфер обмена", VK_F7);
    ui::type_text("харашо");
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 8000) && t.last_sent() == "хорошо";
    t.check("отправлено исправленным", ok);
    ui::sleep(2000);
    let got = t.clip.get();
    let ok = got.as_deref() == Some("старое");
    t.check("буфер обмена вернулся", ok);
    if !ok {
        say!("        в буфере: {got:?}");
    }

    say!("\n== 10. Настройки");
    let ok = t.open_settings();
    t.check("повторный запуск открыл настройки", ok);
    let ok = t.wait(3000, || ui::foreground() == SETTINGS);
    t.check("окно настроек на переднем плане", ok);
    ui::sleep(1000);
    t.shot("05-settings");
    ui::tap(VK_ESCAPE);
    let ok = t.wait(3000, || !ui::visible(SETTINGS));
    t.check("Esc закрывает настройки", ok);
    t.open_settings();
    t.tabs(1);
    ui::tap(VK_SPACE);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Autocorrect\": false", 4000);
    t.check("исправления выключены", ok);
    t.focus_game();
    let reqs = t.relay.count();
    t.overlay("исправления выключены", VK_F7);
    ui::type_text("харашо ");
    ui::sleep(1500);
    let ok = t.relay.count() == reqs;
    t.check("выключенные исправления не ходят в сеть", ok);
    ui::tap(VK_ESCAPE);
    ui::sleep(1000);
    t.open_settings();
    t.tabs(1);
    ui::tap(VK_SPACE);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Autocorrect\": true", 4000);
    t.check("исправления снова включены", ok);

    say!("\n== 11. Настройки: смена горячей клавиши");
    t.open_settings();
    t.tabs(2);
    ui::tap(VK_SPACE);
    ui::sleep(300);
    ui::tap(VK_F8);
    ui::sleep(300);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Hotkey\": \"F8\"", 4000);
    t.check("горячая клавиша сохранена как F8", ok);
    t.focus_game();
    let before = t.game_count("chat open");
    t.overlay("F8", VK_F8);
    let ok = t.wait_game_more("chat open", before, 6000);
    t.check("F8 открывает чат", ok);
    ui::tap(VK_ESCAPE);
    ui::sleep(1500);
    t.focus_game();
    let f7 = t.game_count("vk=0x76");
    ui::tap(VK_F7);
    ui::sleep(1500);
    let ok = t.game_count("vk=0x76") > f7 && !ui::visible(OVERLAY);
    t.check("F7 снова обычная клавиша", ok);
    t.open_settings();
    t.tabs(2);
    ui::tap(VK_SPACE);
    ui::sleep(300);
    ui::tap(VK_F7);
    ui::sleep(300);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Hotkey\": \"F7\"", 4000);
    t.check("горячая клавиша снова F7", ok);

    say!("\n== 12. Меню в трее");
    let (sw, sh) = ui::screen();
    let (mx, my) = (sw / 2, sh / 2);
    t.poke(&["tray-menu", &mx.to_string(), &my.to_string()]);
    let ok = t.wait(3000, || ui::visible(MENU));
    t.check("меню открывается", ok);
    ui::sleep(500);
    t.shot("06-menu");
    ui::tap(VK_DOWN);
    ui::tap(VK_DOWN);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Autocorrect\": false", 4000);
    t.check("меню работает с клавиатуры", ok);
    if ui::visible(MENU) {
        ui::tap(VK_ESCAPE);
    }
    t.poke(&["tray-menu", &mx.to_string(), &my.to_string()]);
    t.wait(3000, || ui::visible(MENU));
    ui::tap(VK_DOWN);
    ui::tap(VK_DOWN);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Autocorrect\": true", 4000);
    t.check("меню включает обратно", ok);
    if ui::visible(MENU) {
        ui::tap(VK_ESCAPE);
    }
    t.poke(&["tray-dblclick"]);
    let ok = t.wait(4000, || ui::visible(SETTINGS));
    t.check("двойной клик по значку открывает настройки", ok);
    let ok = t.wait(2000, || ui::foreground() == SETTINGS);
    t.check("и они на переднем плане", ok);
    ui::tap(VK_ESCAPE);
    t.wait(3000, || !ui::visible(SETTINGS));

    say!("\n== 13. Без игры текст уходит в буфер обмена");
    if let Some(mut g) = t.game.take() {
        let _ = g.kill();
        let _ = g.wait();
    }
    t.wait(3000, || !ui::visible(GAME));
    t.overlay("без игры", VK_F7);
    let ok = t.wait_app("hotkey: game window not found", 5000);
    t.check("программа заметила, что игры нет", ok);
    t.shot("07-no-game");
    ui::type_text("харашо");
    ui::tap(VK_RETURN);
    let ok = t.wait_app("send failed: окно игры не найдено", 6000);
    t.check("неудачная отправка записана в журнал", ok);
    ui::sleep(800);
    let got = t.clip.get();
    let ok = got.as_deref() == Some("хорошо");
    t.check("исправленный текст лежит в буфере", ok);

    say!("\n== 14. Печать по буквам");
    let ok = t.start_game();
    t.check("окно «игры» открылось снова", ok);
    t.open_settings();
    t.tabs(4);
    ui::tap(VK_RIGHT);
    ui::sleep(300);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"InputMode\": \"type\"", 4000);
    t.check("режим «печать по буквам» сохранён", ok);
    t.focus_game();
    let sent = t.game_count(" sent: ");
    let pastes = t.game_count("paste:");
    t.overlay("печать по буквам", VK_F7);
    ui::type_text("харашо");
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 8000) && t.last_sent() == "хорошо";
    t.check("текст дошёл по буквам", ok);
    let ok = t.game_count("paste:") == pastes;
    t.check("буфер обмена не использовался", ok);
    t.open_settings();
    t.tabs(4);
    ui::tap(VK_LEFT);
    ui::sleep(300);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"InputMode\": \"paste\"", 4000);
    t.check("режим вставки вернулся", ok);

    say!("\n== 15. Словарь переживает перезапуск");
    let ok = t.close_app();
    t.check("программа закрылась сама", ok);
    let ok = read(&t.appdir.join("cache.json")).contains("[\"харашо\",\"хорошо\"]");
    t.check("проверенные слова сохранены", ok);
    let ok = read(&t.appdir.join("own.json")).contains("здраствуйте");
    t.check("возвращённое слово сохранено", ok);
    let ok = t.start_app(true);
    t.check("программа запустилась снова", ok);
    let ok = t.applog().lines().rev().find(|l| l.contains("started")).is_some_and(|l| !l.contains("words in cache 0"));
    t.check("словарь загружен", ok);
    t.focus_game();
    let reqs = t.relay.count();
    let fixed = t.app_count("fixed: харашо → хорошо");
    t.overlay("после перезапуска", VK_F7);
    ui::type_text("здраствуйте харашо ");
    let ok = t.wait_app_more("fixed: харашо → хорошо", fixed, 4000);
    t.check("знакомое слово исправлено без сети", ok);
    ui::sleep(1000);
    let ok = t.relay.count() == reqs;
    t.check("возвращённое слово не тронуто, запросов нет", ok);
    ui::tap(VK_ESCAPE);
    ui::sleep(1000);

    say!("\n== 16. Стили окна ввода, перетаскивание и сброс места");
    for (name, word, fixed, shot) in [("chat", "сабака", "собака", "09-style-chat"), ("capsule", "малако", "молоко", "10-style-capsule")] {
        t.open_settings();
        ui::tap(VK_RIGHT);
        ui::sleep(300);
        ui::tap(VK_RETURN);
        let ok = t.wait_config(&format!("\"Style\": \"{name}\""), 4000);
        t.check(&format!("стиль {name} сохранён"), ok);
        t.focus_game();
        let before = t.app_count(&format!("style {name}"));
        t.overlay(&format!("стиль {name}"), VK_F7);
        let ok = t.wait_app_more(&format!("style {name}"), before, 3000);
        t.check(&format!("окно ввода открылось в стиле {name}"), ok);
        let needle = format!("fixed: {word} → {fixed}");
        let before = t.app_count(&needle);
        ui::type_text(&format!("{word} "));
        let ok = t.wait_app_more(&needle, before, 6000);
        t.check(&format!("{name}: опечатка исправлена"), ok);
        ui::sleep(600);
        t.shot(shot);
        ui::tap(VK_ESCAPE);
        ui::sleep(1000);
    }
    t.open_settings();
    ui::tap(VK_LEFT);
    ui::tap(VK_LEFT);
    ui::sleep(300);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Style\": \"glass\"", 4000);
    t.check("стиль «Стекло» сохранён", ok);
    t.focus_game();
    t.overlay("стекло", VK_F7);
    ui::sleep(600);
    match ui::find(OVERLAY).map(ui::rect) {
        Some(home) => {
            let (x, y) = (home.left + 24, home.bottom - 8);
            ui::drag(x, y, x + 60, y - 120);
            let ok = t.wait_config("\"Glass\": {", 4000);
            t.check("перетащенное место запомнилось", ok);
            let moved = ui::find(OVERLAY).map(ui::rect).unwrap_or_default();
            let ok = (moved.left - home.left, moved.top - home.top) == (60, -120);
            t.check("окно ввода едет за мышью", ok);
            if !ok {
                say!("        сдвиг: {} {}", moved.left - home.left, moved.top - home.top);
            }
            t.shot("11-dragged");
            let needle = "fixed: карова → корова";
            let before = t.app_count(needle);
            ui::type_text("карова ");
            let ok = t.wait_app_more(needle, before, 6000);
            t.check("после перетаскивания печать работает", ok);
            ui::tap(VK_ESCAPE);
            ui::sleep(1000);
            t.focus_game();
            t.overlay("на новом месте", VK_F7);
            ui::sleep(600);
            let again = ui::find(OVERLAY).map(ui::rect).unwrap_or_default();
            let ok = (again.left, again.top) == (moved.left, moved.top);
            t.check("окно ввода открылось там, куда его перетащили", ok);
            ui::double_click(again.left + 24, again.bottom - 8);
            let ok = t.wait_config("\"Glass\": null", 4000);
            t.check("двойной клик сбросил место", ok);
            let back = ui::find(OVERLAY).map(ui::rect).unwrap_or_default();
            let ok = (back.left, back.top) == (home.left, home.top);
            t.check("окно ввода вернулось на место", ok);
            ui::tap(VK_ESCAPE);
            ui::sleep(1000);
        }
        None => {
            t.check("окно ввода найдено", false);
        }
    }

    say!("\n== 17. Настоящий Яндекс.Спеллер по HTTPS");
    t.close_app();
    ui::sleep(1000);
    let ok = t.start_app(false);
    t.check("программа запустилась без тестового сервера", ok);
    t.focus_game();
    t.overlay("настоящий Спеллер", VK_F7);
    ui::type_text("сказл ");
    let ok = t.wait_app("fixed: сказл → сказал", 12000);
    t.check("настоящий Спеллер исправил слово", ok);
    t.shot("08-real-speller");
    if !ok {
        for l in t.applog().lines().filter(|l| l.contains("speller")) {
            say!("        {l}");
        }
    }
    ui::tap(VK_ESCAPE);
    ui::sleep(800);

    say!("\n== 18. Здоровье");
    let ok = t.app_alive();
    t.check("программа всё ещё работает", ok);
    let ok = !t.applog().contains("panic");
    t.check("без аварий", ok);
    let ok = t.relay.agents().iter().all(|a| a.starts_with("RPSpeller/"));
    t.check("программа представляется Спеллеру своим именем", ok);
}
