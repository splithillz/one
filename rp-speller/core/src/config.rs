use std::fs;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::store::write_atomic;

pub const MAX_DELAY_MS: u32 = 3000;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InputMode {
    Type,
    #[default]
    #[serde(other)]
    Paste,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Style {
    Chat,
    Capsule,
    #[default]
    #[serde(other)]
    Glass,
}

impl Style {
    pub const ALL: [Style; 3] = [Style::Glass, Style::Chat, Style::Capsule];

    pub fn title(self) -> &'static str {
        match self {
            Style::Glass => "Стекло",
            Style::Chat => "Как чат игры",
            Style::Capsule => "Капсула",
        }
    }

    pub fn index(self) -> usize {
        Style::ALL.iter().position(|s| *s == self).unwrap_or(0)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Spot {
    pub x: f32,
    pub y: f32,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase", default)]
pub struct Spots {
    pub glass: Option<Spot>,
    pub chat: Option<Spot>,
    pub capsule: Option<Spot>,
}

impl Spots {
    pub fn get(&self, style: Style) -> Option<Spot> {
        match style {
            Style::Glass => self.glass,
            Style::Chat => self.chat,
            Style::Capsule => self.capsule,
        }
    }

    pub fn set(&mut self, style: Style, spot: Option<Spot>) {
        let spot = spot.filter(|s| s.x.is_finite() && s.y.is_finite()).map(|s| Spot { x: s.x.clamp(-0.5, 1.5), y: s.y.clamp(-0.5, 1.5) });
        match style {
            Style::Glass => self.glass = spot,
            Style::Chat => self.chat = spot,
            Style::Capsule => self.capsule = spot,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase", default)]
pub struct Config {
    pub hotkey: String,
    pub chat_key: String,
    pub focus_delay_ms: u32,
    pub open_delay_ms: u32,
    pub paste_delay_ms: u32,
    pub input_mode: InputMode,
    pub submit: bool,
    pub autocorrect: bool,
    pub words: Vec<String>,
    pub style: Style,
    pub positions: Spots,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            hotkey: "F7".into(),
            chat_key: "T".into(),
            focus_delay_ms: 150,
            open_delay_ms: 300,
            paste_delay_ms: 150,
            input_mode: InputMode::Paste,
            submit: true,
            autocorrect: true,
            words: ["лспд", "сасд", "вайнвуд", "палето"].map(String::from).to_vec(),
            style: Style::Glass,
            positions: Spots::default(),
        }
    }
}

impl Config {
    pub fn load(path: &Path) -> Result<Self, String> {
        match fs::read_to_string(path) {
            Ok(text) => serde_json::from_str::<Config>(&text).map(Config::normalized).map_err(|e| e.to_string()),
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Config::default()),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn save(&self, path: &Path) -> io::Result<()> {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }
        write_atomic(path, &serde_json::to_string_pretty(self)?)
    }

    pub fn normalized(mut self) -> Self {
        self.focus_delay_ms = self.focus_delay_ms.min(MAX_DELAY_MS);
        self.open_delay_ms = self.open_delay_ms.min(MAX_DELAY_MS);
        self.paste_delay_ms = self.paste_delay_ms.min(MAX_DELAY_MS);
        let key = self.chat_key.trim().to_uppercase();
        self.chat_key = if key.is_empty() { "T".into() } else { key.chars().take(1).collect() };
        let mut seen = std::collections::HashSet::new();
        self.words = self
            .words
            .iter()
            .map(|w| w.trim().to_string())
            .filter(|w| !w.is_empty() && seen.insert(w.to_lowercase()))
            .collect();
        self
    }
}
