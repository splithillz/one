(function (root) {
  'use strict';

  var API = 'https://speller.yandex.net/services/spellservice.json/checkTexts';
  var WORD_CHAR = /[А-Яа-яЁё-]/;
  var BOUNDARY = /[\s.,!?;:)\]»"'…]/;
  var CYR_WORD = /^[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*$/;
  var STORE = 'ls-autocorrect-cache-v1', CAP = 20000, OWN = 'ls-autocorrect-own-v1';
  var SLANG = ('спс пасиб пасиба пж пжлст плз плиз лол кек кекв рофл кринж жиза изи хз мб крч кста имхо норм нормас ок окей оки окс ' +
    'лан ладн ладно чё че чо чет щас ща ваще всм тип типа бро брат братан братик братишка ору ахах ахаха хаха хахах хах аха ' +
    'пон понял поняла гг вп нуб нубас агр агрится тп телепорт тпшнуть админ админка модер саппорт рп нонрп оос ик дм дмщик ' +
    'гта мта лспд лсмс фиб сасд пд мэрия мерия гетто баллас вагос фэмили фемили грув вайнвуд вайнвуде палето сэнди ' +
    'тачка тачку тачки бизнес бизнесы спавн спавне респ респавн кд инвайт инвайтнуть варн варны мут мьют бан кик ' +
    'дс дискорд вк тг телега гугл ютуб твич стрим стример го гоу ку прив привки здарова здорова хай бб ').split(' ');


  function distance(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[m][n];
  }

  function matchCase(orig, fix) {
    if (orig.length > 1 && orig === orig.toUpperCase()) return fix.toUpperCase();
    if (orig[0] === orig[0].toUpperCase() && orig[0] !== orig[0].toLowerCase()) return fix[0].toUpperCase() + fix.slice(1);
    return fix;
  }

  function setValue(el, value) {
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
  }

  function Autocorrect(el, opts) {
    opts = opts || {};
    this.el = el;
    this.lang = opts.lang || 'ru';
    this.minLength = opts.minLength || 4;
    this.whitelist = {};
    this.ignored = {};
    this.cache = {};
    this.pending = {};
    this.queue = [];
    this.timer = 0;
    this.busy = false;
    this.last = null;
    this.muted = false;
    this.onFix = opts.onFix || null;
    this.hint = opts.hint !== false;
    this.hintEl = null;
    var self = this;
    SLANG.forEach(function (w) { if (w) self.whitelist[w] = true; });
    (opts.whitelist || []).forEach(function (w) { self.whitelist[String(w).toLowerCase()] = true; });
    this.waits = [];
    this.pauseTimer = 0;
    this.saveTimer = 0;
    this.keys = [];
    this.persist = opts.persist !== false;
    if (this.persist) this.load();
    this._onInput = function (e) { self.handleInput(e); };
    this._onKey = function (e) { if (e.target === self.el) self.handleKey(e); };
    el.addEventListener('input', this._onInput);
    window.addEventListener('keydown', this._onKey, true);
  }

  Autocorrect.prototype.destroy = function () {
    this.el.removeEventListener('input', this._onInput);
    window.removeEventListener('keydown', this._onKey, true);
    if (this.hintEl) this.hintEl.remove();
  };

  Autocorrect.prototype.load = function () {
    try {
      var list = JSON.parse(localStorage.getItem(STORE) || '[]');
      for (var i = 0; i < list.length; i++) if (!(list[i][0] in this.cache)) { this.cache[list[i][0]] = list[i][1] || null; this.keys.push(list[i][0]); }
      var own = JSON.parse(localStorage.getItem(OWN) || '[]');
      for (var j = 0; j < own.length; j++) this.ignored[own[j]] = true;
    } catch (e) {}
  };

  Autocorrect.prototype.keep = function (word) {
    this.ignored[word] = true;
    if (!this.persist) return;
    try { localStorage.setItem(OWN, JSON.stringify(Object.keys(this.ignored).slice(-2000))); } catch (e) {}
  };

  Autocorrect.prototype.remember = function (word, fix) {
    if (!(word in this.cache)) this.keys.push(word);
    this.cache[word] = fix;
    if (!this.persist) return;
    var self = this;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(function () {
      try {
        while (self.keys.length > CAP) delete self.cache[self.keys.shift()];
        localStorage.setItem(STORE, JSON.stringify(self.keys.map(function (k) { return [k, self.cache[k] || 0]; })));
      } catch (e) {}
    }, 1500);
  };

  Autocorrect.prototype.addWords = function (words) {
    var self = this;
    (words || []).forEach(function (w) { self.whitelist[String(w).toLowerCase()] = true; });
  };

  Autocorrect.prototype.wordBefore = function (text, end) {
    var start = end;
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
    while (start < end && text[start] === '-') start++;
    var stop = end;
    while (stop > start && text[stop - 1] === '-') stop--;
    return { start: start, end: stop, word: text.slice(start, stop) };
  };

  Autocorrect.prototype.eligible = function (text, w) {
    if (w.word.length < this.minLength || !CYR_WORD.test(w.word)) return false;
    var key = w.word.toLowerCase();
    if (this.whitelist[key] || this.ignored[key]) return false;
    var prev = text[w.start - 1];
    if (prev && /[\/@#$%&*_=+<>\\|~`0-9A-Za-z]/.test(prev)) return false;
    var token = text.slice(0, w.start).split(/\s/).pop();
    if (/[\/:.]/.test(token)) return false;
    var before = text.slice(0, w.start).replace(/^\s*\/\S+\s*/, '');
    var sentenceStart = /^\s*$/.test(before) || /[.!?…]\s*$/.test(before);
    if (!sentenceStart && w.word[0] !== w.word[0].toLowerCase()) return false;
    return true;
  };

  Autocorrect.prototype.verdict = function (word) {
    var key = word.toLowerCase();
    if (!(key in this.cache)) return undefined;
    var fix = this.cache[key];
    if (!fix) return null;
    return matchCase(word, fix);
  };

  Autocorrect.prototype.request = function (word) {
    var key = word.toLowerCase();
    if (key in this.cache || this.pending[key]) return;
    this.pending[key] = true;
    this.queue.push(key);
    var self = this;
    clearTimeout(this.timer);
    this.timer = setTimeout(function () { self.flush(); }, 120);
  };

  Autocorrect.prototype.flush = function () {
    if (this.busy || !this.queue.length) return;
    var batch = this.queue.splice(0, 40), self = this;
    this.busy = true;
    var body = 'lang=' + encodeURIComponent(this.lang) + '&options=6&' + batch.map(function (w) { return 'text=' + encodeURIComponent(w); }).join('&');
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (res) {
        batch.forEach(function (w, i) {
          var errs = (res[i] || []).filter(function (e) { return e.code === 1 && e.s && e.s.length; }), fix = null;
          if (errs.length === 1) {
            var e = errs[0], part = String(e.s[0]).toLowerCase(), pos = e.pos, len = e.len;
            if (w.substr(pos, len) === e.word.toLowerCase()) {
              var cand = w.slice(0, pos) + part + w.slice(pos + len);
              var limit = w.length >= 6 ? 2 : 1;
              if (cand !== w && cand.length > 1 && distance(w, cand) <= limit) fix = cand;
            }
          }
          self.remember(w, fix);
          delete self.pending[w];
        });
        self.applyPendingBoundary();
      })
      .catch(function () { batch.forEach(function (w) { delete self.pending[w]; }); })
      .then(function () { self.busy = false; if (self.queue.length) self.flush(); });
  };

  Autocorrect.prototype.handleInput = function (e) {
    if (this.muted) return;
    var el = this.el, text = el.value, pos = el.selectionStart, self = this;
    if (e.isComposing || pos !== el.selectionEnd) return;
    clearTimeout(this.pauseTimer);
    if (e.inputType === 'insertText' && e.data && BOUNDARY.test(e.data.slice(-1))) {
      this.last = null;
      var w = this.wordBefore(text, pos - e.data.length);
      if (w.word && this.eligible(text, w)) {
        var v = this.verdict(w.word);
        if (v) this.replace(w, v, true);
        else if (v === undefined) { this.waits.push({ start: w.start, word: w.word }); this.request(w.word); }
      }
      return;
    }
    if (e.inputType && e.inputType.indexOf('delete') !== 0) this.last = null;
    this.pauseTimer = setTimeout(function () {
      var t = el.value, cur = self.wordBefore(t, el.selectionStart);
      if (cur.word && self.eligible(t, cur)) self.request(cur.word);
    }, 350);
  };

  Autocorrect.prototype.applyPendingBoundary = function () {
    if (!this.waits.length) return;
    var el = this.el, keep = [], ready = [];
    for (var i = 0; i < this.waits.length; i++) {
      var p = this.waits[i], text = el.value;
      if (text.substr(p.start, p.word.length) !== p.word || !BOUNDARY.test(text[p.start + p.word.length] || '')) continue;
      var v = this.verdict(p.word);
      if (v === undefined) keep.push(p); else if (v) ready.push({ start: p.start, word: p.word, fix: v });
    }
    this.waits = keep;
    if (!ready.length || document.activeElement !== el) return;
    ready.sort(function (a, b) { return b.start - a.start; });
    var caret = el.selectionStart;
    for (var j = 0; j < ready.length; j++) {
      var r = ready[j], end = r.start + r.word.length;
      var tail = el.value.slice(end, caret);
      var undoable = j === 0 && /^[\s.,!?;:)\]»"'…]$/.test(tail);
      this.replace({ start: r.start, end: end, word: r.word }, r.fix, undoable);
      if (caret >= end) caret += r.fix.length - r.word.length;
      for (var k = 0; k < this.waits.length; k++) if (this.waits[k].start > r.start) this.waits[k].start += r.fix.length - r.word.length;
    }
  };

  Autocorrect.prototype.replace = function (w, fix, undoable) {
    var el = this.el, text = el.value, pos = el.selectionStart, delta = fix.length - w.word.length;
    var next = text.slice(0, w.start) + fix + text.slice(w.end);
    this.muted = true;
    setValue(el, next);
    var caret = pos >= w.end ? pos + delta : pos;
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    this.muted = false;
    if (undoable) this.last = { start: w.start, original: w.word, fix: fix, caret: caret };
    else if (this.last && w.start < this.last.start) { this.last.start += delta; this.last.caret += delta; }
    else this.last = null;
    if (this.onFix) try { this.onFix(w.word, fix); } catch (x) {}
    if (this.hint && undoable) this.showHint(w.word, fix);
  };

  Autocorrect.prototype.handleKey = function (e) {
    var el = this.el;
    if (e.key === 'Backspace' && this.last && el.selectionStart === el.selectionEnd && el.selectionStart === this.last.caret) {
      var l = this.last, text = el.value;
      if (text.substr(l.start, l.fix.length) === l.fix) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.keep(l.original.toLowerCase());
        this.muted = true;
        setValue(el, text.slice(0, l.start) + l.original + text.slice(l.start + l.fix.length));
        var caret = l.caret - l.fix.length + l.original.length;
        el.setSelectionRange(caret, caret);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        this.muted = false;
        this.last = null;
        this.hideHint();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      var t = el.value, end = t.length;
      while (end > 0 && /\s/.test(t[end - 1])) end--;
      var w = this.wordBefore(t, end);
      if (w.word && w.end === end && this.eligible(t, w)) {
        var v = this.verdict(w.word);
        if (v) this.replace(w, v, false);
      }
      this.last = null;
    }
  };

  Autocorrect.prototype.showHint = function (from, to) {
    if (!this.hintEl) {
      var h = document.createElement('div');
      h.className = 'ls-autocorrect-hint';
      h.style.cssText = 'position:fixed;z-index:2147483000;pointer-events:none;padding:4px 9px;border-radius:8px;font:600 12px/1.4 system-ui,sans-serif;' +
        'background:rgba(20,20,24,.92);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.35);opacity:0;transition:opacity .15s;white-space:nowrap';
      document.body.appendChild(h);
      this.hintEl = h;
    }
    var r = this.el.getBoundingClientRect(), hint = this.hintEl;
    hint.textContent = from + ' → ' + to + '   ⌫ отменить';
    hint.style.left = Math.max(4, r.left) + 'px';
    hint.style.top = Math.max(4, r.top - 30) + 'px';
    hint.style.opacity = '1';
    clearTimeout(this.hintTimer);
    var self = this;
    this.hintTimer = setTimeout(function () { self.hideHint(); }, 2200);
  };

  Autocorrect.prototype.hideHint = function () { if (this.hintEl) this.hintEl.style.opacity = '0'; };

  root.LSAutocorrect = {
    attach: function (el, opts) { return new Autocorrect(el, opts); }
  };
})(window);
