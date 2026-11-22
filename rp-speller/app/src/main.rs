#![cfg_attr(windows, windows_subsystem = "windows")]
#![allow(clippy::too_many_arguments)]

#[cfg(windows)]
mod app;
#[cfg(windows)]
mod bubble;
#[cfg(windows)]
mod clipboard;
#[cfg(windows)]
mod controls;
#[cfg(windows)]
mod game;
#[cfg(windows)]
mod gfx;
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
mod style;
#[cfg(windows)]
mod tray;
#[cfg(windows)]
mod win;

#[cfg(windows)]
fn main() {
    let code = app::run();
    gfx::shutdown();
    std::process::exit(code);
}

#[cfg(not(windows))]
fn main() {
    eprintln!("RP Speller works on Windows only. Build it with: cargo build -p rpspeller --release --target x86_64-pc-windows-gnu");
}
