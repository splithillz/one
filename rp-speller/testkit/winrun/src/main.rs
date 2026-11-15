#[cfg(windows)]
mod relay;
#[cfg(windows)]
mod run;
#[cfg(windows)]
mod ui;

#[cfg(windows)]
fn main() {
    std::process::exit(run::main());
}

#[cfg(not(windows))]
fn main() {
    eprintln!("winrun is a Windows test program");
}
