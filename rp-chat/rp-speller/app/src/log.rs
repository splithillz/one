use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::win::local_time;

static LOCK: Mutex<()> = Mutex::new(());
const MAX_LOG: u64 = 1_000_000;

pub fn folder() -> PathBuf {
    std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_else(std::env::temp_dir).join("RPSpeller")
}

pub fn write(line: impl AsRef<str>) {
    let _guard = LOCK.lock();
    let dir = folder();
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("log.txt");
    if fs::metadata(&path).is_ok_and(|m| m.len() > MAX_LOG) {
        let _ = fs::remove_file(&path);
    }
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = write!(f, "{} {}\r\n", local_time(), line.as_ref());
    }
}
