use std::collections::{BTreeSet, HashMap, HashSet, VecDeque};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub const CAP: usize = 20_000;
const CACHE_FILE: &str = "cache.json";
const OWN_FILE: &str = "own.json";

#[derive(Default, Debug)]
pub struct WordStore {
    cache: HashMap<String, Option<String>>,
    order: VecDeque<String>,
    own: BTreeSet<String>,
    extra: HashSet<String>,
    folder: Option<PathBuf>,
    dirty: bool,
}

impl WordStore {
    pub fn in_memory() -> Self {
        Self::default()
    }

    pub fn open(folder: impl Into<PathBuf>) -> Self {
        let folder = folder.into();
        let mut store = Self { folder: Some(folder.clone()), ..Self::default() };
        if let Ok(text) = fs::read_to_string(folder.join(CACHE_FILE))
            && let Ok(pairs) = serde_json::from_str::<Vec<(Option<String>, Option<String>)>>(&text)
        {
            for (key, fix) in pairs {
                if let Some(key) = key
                    && !store.cache.contains_key(&key)
                {
                    store.order.push_back(key.clone());
                    store.cache.insert(key, fix);
                }
            }
            store.trim();
        }
        if let Ok(text) = fs::read_to_string(folder.join(OWN_FILE))
            && let Ok(words) = serde_json::from_str::<Vec<String>>(&text)
        {
            store.own.extend(words);
        }
        store
    }

    pub fn folder(&self) -> Option<&Path> {
        self.folder.as_deref()
    }

    pub fn set_extra<S: AsRef<str>>(&mut self, words: impl IntoIterator<Item = S>) {
        self.extra = words
            .into_iter()
            .map(|w| w.as_ref().trim().to_lowercase())
            .filter(|w| !w.is_empty())
            .collect();
    }

    pub fn is_known_good(&self, key: &str) -> bool {
        self.own.contains(key) || self.extra.contains(key)
    }

    pub fn get(&self, key: &str) -> Option<Option<&str>> {
        self.cache.get(key).map(Option::as_deref)
    }

    pub fn len(&self) -> usize {
        self.cache.len()
    }

    pub fn is_empty(&self) -> bool {
        self.cache.is_empty()
    }

    pub fn own_words(&self) -> impl Iterator<Item = &str> {
        self.own.iter().map(String::as_str)
    }

    pub fn remember(&mut self, key: String, fix: Option<String>) {
        if !self.cache.contains_key(&key) {
            self.order.push_back(key.clone());
        }
        self.cache.insert(key, fix);
        self.trim();
        self.dirty = true;
    }

    pub fn keep(&mut self, key: String) {
        if self.own.insert(key) {
            self.dirty = true;
        }
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    fn trim(&mut self) {
        while self.order.len() > CAP {
            if let Some(old) = self.order.pop_front() {
                self.cache.remove(&old);
            }
        }
    }

    pub fn save(&mut self) -> io::Result<()> {
        let Some(folder) = self.folder.clone() else {
            self.dirty = false;
            return Ok(());
        };
        fs::create_dir_all(&folder)?;
        let pairs: Vec<(&str, Option<&str>)> = self
            .order
            .iter()
            .map(|k| (k.as_str(), self.cache.get(k).and_then(Option::as_deref)))
            .collect();
        write_atomic(&folder.join(CACHE_FILE), &serde_json::to_string(&pairs)?)?;
        write_atomic(&folder.join(OWN_FILE), &serde_json::to_string(&self.own)?)?;
        self.dirty = false;
        Ok(())
    }
}

pub fn write_atomic(path: &Path, text: &str) -> io::Result<()> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, text)?;
    fs::rename(&tmp, path)
}
