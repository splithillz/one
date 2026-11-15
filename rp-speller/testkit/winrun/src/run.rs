use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::time::{Duration, Instant};

use crate::relay::Relay;
use crate::ui::{self, Clip, VK_A, VK_BACK, VK_CONTROL, VK_DOWN, VK_ESCAPE, VK_F7, VK_F8, VK_RETURN, VK_SPACE, VK_TAB, VK_UP};

const OVERLAY: &str = "RPSpellerOverlay";
const SETTINGS: &str = "RPSpellerSettings";
const GAME: &str = "grcWindow";
const MENU: &str = "#32768";

struct T {
    pass: u32,
    fail: u32,
    dir: PathBuf,
    out: PathBuf,
    appdir: PathBuf,
    gamelog: PathBuf,
    relay: Relay,
    clip: Clip,
    game: Option<Child>,
    app: Option<Child>,
}

fn read(p: &PathBuf) -> String {
    fs::read(p).map(|b| String::from_utf8_lossy(&b).into_owned()).unwrap_or_default()
}

impl T {
    fn check(&mut self, name: &str, ok: bool) -> bool {
        println!("{}  {name}", if ok { "PASS" } else { "FAIL" });
        if ok {
            self.pass += 1;
        } else {
            self.fail += 1;
            println!("      foreground now: {}", ui::foreground());
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
        if let Err(e) = ui::screenshot(&self.out.join(format!("{name}.bmp"))) {
            println!("      screenshot {name} failed: {e}");
        }
    }

    fn start_game(&mut self) -> bool {
        let before = self.game_count(" start");
        self.game = Command::new(self.dir.join("fakegame.exe")).env("FAKEGAME_LOG", &self.gamelog).spawn().ok();
        self.wait(15000, || self.game_count(" start") > before) && self.wait(5000, || ui::visible(GAME))
    }

    fn start_app(&mut self, relay: bool) -> bool {
        let before = self.app_count("started");
        let mut cmd = Command::new(self.dir.join("RPSpeller.exe"));
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

    fn open_settings(&self) -> bool {
        let _ = Command::new(self.dir.join("RPSpeller.exe")).spawn().map(|mut c| c.wait());
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
        self.check(&format!("{name}: overlay is shown and has the focus"), focused);
        if shown && !focused
            && let Some(o) = ui::find(OVERLAY)
        {
            let (x, y) = ui::center(o);
            ui::click(x, y - 8);
            println!("      clicked into the overlay to carry on");
        }
        ui::sleep(400);
        shown
    }
}

pub fn main() -> i32 {
    let dir = env::current_exe().ok().and_then(|p| p.parent().map(PathBuf::from)).unwrap_or_default();
    let out = env::var("WINRUN_OUT").map(PathBuf::from).unwrap_or_else(|_| dir.join("winrun-out"));
    let _ = fs::create_dir_all(&out);
    let appdir = PathBuf::from(env::var("APPDATA").unwrap_or_default()).join("RPSpeller");
    let _ = fs::remove_dir_all(&appdir);
    println!("{}", ui::session_info());
    let relay = match Relay::start() {
        Ok(r) => r,
        Err(e) => {
            println!("relay failed: {e}");
            return 2;
        }
    };
    let mut t = T {
        pass: 0,
        fail: 0,
        gamelog: out.join("game.log"),
        dir,
        out,
        appdir,
        relay,
        clip: Clip::new(),
        game: None,
        app: None,
    };
    let _ = fs::remove_file(&t.gamelog);

    println!("\n== 1. start");
    let ok = t.start_game();
    t.check("game window starts", ok);
    let ok = t.start_app(true);
    t.check("app starts", ok);
    ui::sleep(1500);
    let ok = !t.applog().contains("tray icon failed");
    t.check("tray icon added", ok);
    t.shot("01-start");

    println!("\n== 2. hotkey opens the game chat and the overlay");
    let ok = t.focus_game();
    t.check("game is in front after a click", ok);
    let before = t.game_count("chat open");
    t.overlay("F7", VK_F7);
    let ok = t.wait_game_more("chat open", before, 6000);
    t.check("hotkey tapped T in the game", ok);
    let ok = read(&t.gamelog).contains("vk=0x54 sc=0x14");
    t.check("game saw T as a normal key (vk 0x54)", ok);
    t.shot("02-overlay");

    println!("\n== 3. typo fixed after space, Backspace returns it");
    ui::type_text("здраствуйте ");
    let ok = t.wait_app("fixed: здраствуйте → здравствуйте", 6000);
    t.check("typo fixed", ok);
    ui::sleep(300);
    t.shot("03-fixed");
    ui::tap(VK_BACK);
    let ok = t.wait_app("kept: здраствуйте", 4000);
    t.check("Backspace keeps the word", ok);
    t.shot("04-kept");

    println!("\n== 4. Enter checks the last word and sends");
    let sent = t.game_count(" sent: ");
    ui::type_text("как дила харашо");
    ui::sleep(300);
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 8000);
    t.check("message reached the game", ok);
    let ok = t.last_sent() == "здраствуйте как дела хорошо";
    t.check("sent text is fixed except the kept word", ok);
    let ok = read(&t.gamelog).contains("paste: здраствуйте как дела хорошо");
    t.check("pasted with Ctrl+V", ok);
    let ok = t.wait(3000, || ui::foreground() == GAME);
    t.check("game is in front again after sending", ok);
    let ok = !t.relay.all_words().iter().any(|w| w.contains(' '));
    t.check("only single words went to the speller", ok);

    println!("\n== 5. Ctrl+Backspace and Ctrl+A");
    t.focus_game();
    let sent = t.game_count(" sent: ");
    t.overlay("Ctrl+Backspace", VK_F7);
    ui::type_text("один два");
    ui::chord(VK_CONTROL, VK_BACK);
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 8000) && t.last_sent() == "один";
    t.check("Ctrl+Backspace deletes the last word", ok);
    t.focus_game();
    let sent = t.game_count(" sent: ");
    t.overlay("Ctrl+A", VK_F7);
    ui::type_text("старый");
    ui::chord(VK_CONTROL, VK_A);
    ui::type_text("новый");
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 8000) && t.last_sent() == "новый";
    t.check("Ctrl+A selects everything", ok);

    println!("\n== 6. Esc closes the chat without sending");
    t.focus_game();
    let sent = t.game_count(" sent: ");
    let closed = t.game_count("chat closed");
    t.overlay("Esc", VK_F7);
    ui::type_text("превет");
    ui::tap(VK_ESCAPE);
    let ok = t.wait_game_more("chat closed", closed, 6000);
    t.check("game chat closed with Esc", ok);
    ui::sleep(800);
    let ok = t.game_count(" sent: ") == sent;
    t.check("nothing sent", ok);

    println!("\n== 7. slow speller: Enter does not hang");
    t.relay.set_mode("slow:4");
    t.focus_game();
    let sent = t.game_count(" sent: ");
    t.overlay("slow", VK_F7);
    ui::type_text("сигодня");
    ui::tap(VK_RETURN);
    let ok = t.wait_app("speller is slow", 5000);
    t.check("app gives up waiting", ok);
    let ok = t.wait_game_more(" sent: ", sent, 6000) && t.last_sent() == "сигодня";
    t.check("message sent as typed", ok);
    t.relay.set_mode("canned");
    ui::sleep(4000);

    println!("\n== 8. broken speller: typing keeps working");
    t.relay.set_mode("fail");
    t.focus_game();
    let sent = t.game_count(" sent: ");
    t.overlay("broken", VK_F7);
    ui::type_text("пошол ");
    let ok = t.wait_app("speller failed: HTTP 500", 5000);
    t.check("error logged", ok);
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 6000) && t.last_sent() == "пошол";
    t.check("message sent unchanged", ok);
    t.relay.set_mode("canned");

    println!("\n== 9. clipboard comes back after the paste");
    let ok = t.clip.set("старое");
    t.check("test put text in the clipboard", ok);
    t.focus_game();
    let sent = t.game_count(" sent: ");
    t.overlay("clipboard", VK_F7);
    ui::type_text("харашо");
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 8000) && t.last_sent() == "хорошо";
    t.check("sent fixed", ok);
    ui::sleep(2000);
    let got = t.clip.get();
    let ok = got.as_deref() == Some("старое");
    t.check("clipboard restored", ok);
    if !ok {
        println!("      clipboard: {got:?}");
    }

    println!("\n== 10. settings");
    let ok = t.open_settings();
    t.check("second launch opens the settings", ok);
    let ok = t.wait(3000, || ui::foreground() == SETTINGS);
    t.check("settings window is in front", ok);
    t.shot("05-settings");
    ui::tap(VK_ESCAPE);
    let ok = t.wait(3000, || !ui::visible(SETTINGS));
    t.check("Esc closes the settings", ok);
    t.open_settings();
    t.tabs(7);
    ui::tap(VK_SPACE);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Autocorrect\": false", 4000);
    t.check("autocorrect switched off", ok);
    t.focus_game();
    let reqs = t.relay.count();
    t.overlay("autocorrect off", VK_F7);
    ui::type_text("харашо ");
    ui::sleep(1500);
    let ok = t.relay.count() == reqs;
    t.check("no requests while off", ok);
    ui::tap(VK_ESCAPE);
    ui::sleep(1000);
    t.open_settings();
    t.tabs(7);
    ui::tap(VK_SPACE);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Autocorrect\": true", 4000);
    t.check("autocorrect back on", ok);

    println!("\n== 11. settings: change the hotkey");
    t.open_settings();
    ui::tap(VK_F8);
    ui::sleep(300);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Hotkey\": \"F8\"", 4000);
    t.check("hotkey saved as F8", ok);
    t.focus_game();
    let before = t.game_count("chat open");
    t.overlay("F8", VK_F8);
    let ok = t.wait_game_more("chat open", before, 6000);
    t.check("F8 opens the chat", ok);
    ui::tap(VK_ESCAPE);
    ui::sleep(1500);
    t.focus_game();
    let f7 = t.game_count("vk=0x76");
    ui::tap(VK_F7);
    ui::sleep(1500);
    let ok = t.game_count("vk=0x76") > f7 && !ui::visible(OVERLAY);
    t.check("F7 is a normal key again", ok);
    t.open_settings();
    ui::tap(VK_F7);
    ui::sleep(300);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Hotkey\": \"F7\"", 4000);
    t.check("hotkey back to F7", ok);

    println!("\n== 12. tray menu");
    let (sw, sh) = ui::screen();
    let (mx, my) = (sw / 2, sh / 2);
    t.poke(&["tray-menu", &mx.to_string(), &my.to_string()]);
    let ok = t.wait(3000, || ui::visible(MENU));
    t.check("tray menu opens", ok);
    t.shot("06-menu");
    ui::tap(VK_DOWN);
    ui::tap(VK_DOWN);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Autocorrect\": false", 4000);
    t.check("menu works from the keyboard", ok);
    if ui::visible(MENU) {
        ui::tap(VK_ESCAPE);
    }
    t.poke(&["tray-menu", &mx.to_string(), &my.to_string()]);
    t.wait(3000, || ui::visible(MENU));
    ui::tap(VK_DOWN);
    ui::tap(VK_DOWN);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"Autocorrect\": true", 4000);
    t.check("menu toggles it back", ok);
    if ui::visible(MENU) {
        ui::tap(VK_ESCAPE);
    }
    t.poke(&["tray-dblclick"]);
    let ok = t.wait(4000, || ui::visible(SETTINGS));
    t.check("double click opens the settings", ok);
    let ok = t.wait(2000, || ui::foreground() == SETTINGS);
    t.check("and they are in front", ok);
    ui::tap(VK_ESCAPE);
    t.wait(3000, || !ui::visible(SETTINGS));

    println!("\n== 13. no game: text goes to the clipboard");
    if let Some(mut g) = t.game.take() {
        let _ = g.kill();
        let _ = g.wait();
    }
    t.wait(3000, || !ui::visible(GAME));
    t.overlay("no game", VK_F7);
    let ok = t.wait_app("hotkey: game window not found", 5000);
    t.check("missing game is logged", ok);
    t.shot("07-no-game");
    ui::type_text("харашо");
    ui::tap(VK_RETURN);
    let ok = t.wait_app("send failed: окно игры не найдено", 6000);
    t.check("send failure logged", ok);
    ui::sleep(800);
    let got = t.clip.get();
    let ok = got.as_deref() == Some("хорошо");
    t.check("fixed text is in the clipboard", ok);

    println!("\n== 14. typing mode (letter by letter)");
    let ok = t.start_game();
    t.check("game window restarts", ok);
    t.open_settings();
    t.tabs(5);
    ui::tap(VK_DOWN);
    ui::tap(VK_TAB);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"InputMode\": \"type\"", 4000);
    t.check("input mode saved", ok);
    t.focus_game();
    let sent = t.game_count(" sent: ");
    let pastes = t.game_count("paste:");
    t.overlay("typing mode", VK_F7);
    ui::type_text("харашо");
    ui::tap(VK_RETURN);
    let ok = t.wait_game_more(" sent: ", sent, 8000) && t.last_sent() == "хорошо";
    t.check("typed text arrived", ok);
    let ok = t.game_count("paste:") == pastes;
    t.check("no clipboard paste used", ok);
    t.open_settings();
    t.tabs(5);
    ui::tap(VK_UP);
    ui::tap(VK_TAB);
    ui::tap(VK_RETURN);
    let ok = t.wait_config("\"InputMode\": \"paste\"", 4000);
    t.check("input mode back to paste", ok);

    println!("\n== 15. words survive a restart");
    t.poke(&["close"]);
    let ok = t.wait(6000, || t.applog().lines().last().is_some_and(|l| l.trim_end().ends_with(" exit")));
    t.check("app exits cleanly", ok);
    let exited = {
        let app = &mut t.app;
        let end = Instant::now() + Duration::from_secs(5);
        loop {
            match app.as_mut().map(|c| c.try_wait()) {
                Some(Ok(Some(_))) | None => break true,
                _ if Instant::now() >= end => break false,
                _ => ui::sleep(100),
            }
        }
    };
    t.check("app process gone", exited);
    let ok = read(&t.appdir.join("cache.json")).contains("[\"харашо\",\"хорошо\"]");
    t.check("cache saved", ok);
    let ok = read(&t.appdir.join("own.json")).contains("здраствуйте");
    t.check("kept word saved", ok);
    let ok = t.start_app(true);
    t.check("app restarts", ok);
    let ok = t.applog().lines().rev().find(|l| l.contains("started")).is_some_and(|l| !l.contains("words in cache 0"));
    t.check("cache loaded", ok);
    t.focus_game();
    let reqs = t.relay.count();
    let fixed = t.app_count("fixed: харашо → хорошо");
    t.overlay("after restart", VK_F7);
    ui::type_text("здраствуйте харашо ");
    let ok = t.wait_app_more("fixed: харашо → хорошо", fixed, 4000);
    t.check("cached word fixed without the network", ok);
    ui::sleep(1000);
    let ok = t.relay.count() == reqs;
    t.check("kept word left alone, no requests", ok);
    ui::tap(VK_ESCAPE);
    ui::sleep(1000);

    println!("\n== 16. real Yandex Speller over HTTPS");
    t.poke(&["close"]);
    t.wait(6000, || t.applog().lines().last().is_some_and(|l| l.trim_end().ends_with(" exit")));
    ui::sleep(1000);
    let ok = t.start_app(false);
    t.check("app starts without the test relay", ok);
    t.focus_game();
    t.overlay("real speller", VK_F7);
    ui::type_text("сказл ");
    let ok = t.wait_app("fixed: сказл → сказал", 12000);
    t.check("real Speller fixed a word through WinHTTP", ok);
    t.shot("08-real-speller");
    if !ok {
        for l in t.applog().lines().filter(|l| l.contains("speller")) {
            println!("      {l}");
        }
    }
    ui::tap(VK_ESCAPE);
    ui::sleep(800);

    println!("\n== 17. health");
    let ok = t.app_alive();
    t.check("app still running", ok);
    let ok = !t.applog().contains("panic");
    t.check("no panics", ok);
    let ok = t.relay.agents().iter().all(|a| a.starts_with("RPSpeller/"));
    t.check("user agent names the app", ok);

    for f in ["log.txt", "config.json", "cache.json", "own.json"] {
        let _ = fs::copy(t.appdir.join(f), t.out.join(f));
    }
    println!("\n== app log\n{}", t.applog());
    t.poke(&["close"]);
    ui::sleep(1000);
    if let Some(mut g) = t.game.take() {
        let _ = g.kill();
    }
    println!("\n{} passed, {} failed", t.pass, t.fail);
    i32::from(t.fail > 0)
}
