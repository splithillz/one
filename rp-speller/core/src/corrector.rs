use std::collections::HashSet;

use crate::rules::{is_boundary, is_eligible, match_case, word_before, words, WordSpan};
use crate::speller::{Fixes, Speller, BATCH};
use crate::store::WordStore;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Edit {
    pub start: usize,
    pub len: usize,
    pub text: String,
    pub from: String,
    pub undoable: bool,
}

impl Edit {
    pub fn text_len(&self) -> usize {
        self.text.chars().count()
    }
}

#[derive(Clone, Debug)]
struct Last {
    start: usize,
    original: String,
    fix: String,
    caret: usize,
}

#[derive(Debug)]
pub struct Corrector {
    pub store: WordStore,
    pub min_length: usize,
    pub enabled: bool,
    pending: Vec<(usize, String)>,
    queued: Vec<String>,
    inflight: HashSet<String>,
    last: Option<Last>,
}

impl Corrector {
    pub fn new(store: WordStore) -> Self {
        Self {
            store,
            min_length: 4,
            enabled: true,
            pending: Vec::new(),
            queued: Vec::new(),
            inflight: HashSet::new(),
            last: None,
        }
    }

    pub fn has_queue(&self) -> bool {
        !self.queued.is_empty()
    }

    pub fn busy(&self) -> bool {
        !self.queued.is_empty() || !self.inflight.is_empty()
    }

    pub fn reset(&mut self) {
        self.pending.clear();
        self.last = None;
    }

    fn enqueue(&mut self, key: String) {
        if !self.inflight.contains(&key) && !self.queued.contains(&key) {
            self.queued.push(key);
        }
    }

    fn eligible(&self, text: &[char], w: &WordSpan) -> bool {
        is_eligible(text, w, self.min_length, |k| self.store.is_known_good(k))
    }

    pub fn typed(&mut self, text: &[char], caret: usize, c: char) -> Option<Edit> {
        if !self.enabled {
            return None;
        }
        self.last = None;
        if !is_boundary(c) || caret < 1 || caret > text.len() {
            return None;
        }
        let w = word_before(text, caret - 1);
        if w.is_empty() || !self.eligible(text, &w) {
            return None;
        }
        let key = w.word.to_lowercase();
        match self.store.get(&key) {
            Some(Some(fix)) => {
                let fixed = match_case(&w.word, fix);
                Some(self.make(&w, fixed, caret))
            }
            Some(None) => None,
            None => {
                self.pending.push((w.start, w.word.clone()));
                self.enqueue(key);
                None
            }
        }
    }

    fn make(&mut self, w: &WordSpan, fix: String, caret: usize) -> Edit {
        let undoable = caret == w.end + 1;
        if undoable {
            self.last = Some(Last {
                start: w.start,
                original: w.word.clone(),
                caret: caret + fix.chars().count() - w.len(),
                fix: fix.clone(),
            });
        }
        Edit { start: w.start, len: w.len(), text: fix, from: w.word.clone(), undoable }
    }

    pub fn take_batch(&mut self) -> Vec<String> {
        let n = self.queued.len().min(BATCH);
        let batch: Vec<String> = self.queued.drain(..n).collect();
        self.inflight.extend(batch.iter().cloned());
        batch
    }

    pub fn complete_batch(&mut self, batch: &[String], result: Result<Fixes, String>) -> Result<(), String> {
        for k in batch {
            self.inflight.remove(k);
        }
        let mut fixes = result?;
        for k in batch {
            let fix = fixes.remove(k).flatten();
            self.store.remember(k.clone(), fix);
        }
        Ok(())
    }

    pub fn flush_with(&mut self, speller: &dyn Speller) -> Result<(), String> {
        while self.has_queue() {
            let batch = self.take_batch();
            let result = speller.check(&batch);
            self.complete_batch(&batch, result)?;
        }
        Ok(())
    }

    pub fn resolve(&mut self, text: &[char], caret: usize) -> Vec<Edit> {
        let mut edits = Vec::new();
        let mut keep = Vec::new();
        for (start, word) in std::mem::take(&mut self.pending) {
            let wl = word.chars().count();
            let end = start + wl;
            if end >= text.len() || text[start..end].iter().copied().ne(word.chars()) || !is_boundary(text[end]) {
                continue;
            }
            match self.store.get(&word.to_lowercase()) {
                None => keep.push((start, word)),
                Some(None) => {}
                Some(Some(fix)) => {
                    let text = match_case(&word, fix);
                    edits.push(Edit { start, len: wl, text, from: word, undoable: false });
                }
            }
        }
        self.pending = keep;
        edits.sort_by_key(|e| std::cmp::Reverse(e.start));
        if let Some(top) = edits.first() {
            if caret == top.start + top.len + 1 {
                let shift: isize = edits[1..].iter().map(|e| e.text_len() as isize - e.len as isize).sum();
                let delta = top.text_len() as isize - top.len as isize;
                self.last = Some(Last {
                    start: (top.start as isize + shift) as usize,
                    original: top.from.clone(),
                    fix: top.text.clone(),
                    caret: (caret as isize + delta + shift) as usize,
                });
                edits[0].undoable = true;
            } else {
                self.last = None;
            }
        }
        edits
    }

    pub fn backspace(&mut self, text: &[char], caret: usize) -> Option<Edit> {
        let last = self.last.take()?;
        let fl = last.fix.chars().count();
        if caret != last.caret || last.start + fl > text.len() || text[last.start..last.start + fl].iter().copied().ne(last.fix.chars()) {
            return None;
        }
        self.store.keep(last.original.to_lowercase());
        Some(Edit { start: last.start, len: fl, text: last.original, from: last.fix, undoable: false })
    }

    pub fn prepare_finish(&mut self, text: &[char]) {
        if !self.enabled {
            return;
        }
        for w in words(text) {
            if !self.eligible(text, &w) {
                continue;
            }
            let key = w.word.to_lowercase();
            if self.store.get(&key).is_none() {
                self.enqueue(key);
            }
        }
    }

    pub fn finish(&mut self, text: &[char]) -> Vec<Edit> {
        if !self.enabled {
            return Vec::new();
        }
        let mut edits: Vec<Edit> = words(text)
            .into_iter()
            .filter(|w| self.eligible(text, w))
            .filter_map(|w| {
                let fix = self.store.get(&w.word.to_lowercase())??;
                Some(Edit { start: w.start, len: w.len(), text: match_case(&w.word, fix), from: w.word, undoable: false })
            })
            .collect();
        edits.sort_by_key(|e| std::cmp::Reverse(e.start));
        self.pending.clear();
        self.last = None;
        edits
    }

    pub fn finish_with(&mut self, text: &[char], speller: &dyn Speller) -> Vec<Edit> {
        self.prepare_finish(text);
        let _ = self.flush_with(speller);
        self.finish(text)
    }
}

pub fn apply(text: &mut Vec<char>, caret: usize, e: &Edit) -> usize {
    if e.start + e.len > text.len() {
        return caret.min(text.len());
    }
    let new: Vec<char> = e.text.chars().collect();
    let tl = new.len();
    text.splice(e.start..e.start + e.len, new);
    if caret >= e.start + e.len {
        caret + tl - e.len
    } else if caret > e.start {
        e.start + tl
    } else {
        caret
    }
}
