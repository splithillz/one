#![cfg_attr(windows, windows_subsystem = "windows")]

#[cfg(windows)]
mod app;
#[cfg(windows)]
mod clipboard;
#[cfg(windows)]
mod game;
#[cfg(windows)]
mod input;
#[cfg(windows)]
mod log;
#[cfg(windows)]
mod net;
#[cfg(windows)]
mod overlay;
#[cfg(windows)]
mod settings;
#[cfg(windows)]
mod tray;
#[cfg(windows)]
mod win;

#[cfg(windows)]
fn main() {
    std::process::exit(app::run());
}

#[cfg(not(windows))]
fn main() {
    eprintln!("RP Speller works on Windows only. Build it with: cargo build -p rpspeller --release --target x86_64-pc-windows-gnu");
}
