pub mod config;
pub mod corrector;
pub mod hotkey;
pub mod rules;
pub mod speller;
pub mod store;
pub mod text;

pub use config::{Config, InputMode};
pub use corrector::{apply, Corrector, Edit};
pub use speller::{check_via, Fixes, Speller, SpellerError};
pub use store::WordStore;
