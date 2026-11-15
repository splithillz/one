namespace RpSpeller.Core;

public sealed record Edit(int Start, int Length, string Text, string From, bool Undoable);

public sealed class TypingCorrector
{
    readonly WordStore store;
    readonly ISpeller speller;
    readonly List<(int Start, string Word)> pending = new();
    readonly HashSet<string> queued = new();
    readonly HashSet<string> inflight = new();
    (int Start, string Original, string Fix, int Caret)? last;

    public int MinLength { get; set; } = 4;
    public bool Enabled { get; set; } = true;

    public TypingCorrector(WordStore store, ISpeller speller)
    {
        this.store = store;
        this.speller = speller;
    }

    public bool HasQueue => queued.Count > 0;

    public void Reset()
    {
        pending.Clear();
        last = null;
    }

    public Edit? Typed(string text, int caret, char c)
    {
        if (!Enabled) return null;
        last = null;
        if (!Rules.IsBoundary(c) || caret < 1) return null;
        var w = Rules.WordBefore(text, caret - 1);
        if (w.Word.Length == 0 || !Rules.IsEligible(text, w, MinLength, store.IsKnownGood)) return null;
        var key = w.Word.ToLowerInvariant();
        if (store.TryGet(key, out var fix)) return fix == null ? null : Make(w, Rules.MatchCase(w.Word, fix), caret);
        pending.Add((w.Start, w.Word));
        if (!inflight.Contains(key)) queued.Add(key);
        return null;
    }

    Edit Make(WordSpan w, string fix, int caret)
    {
        var undoable = caret == w.End + 1;
        if (undoable) last = (w.Start, w.Word, fix, caret + fix.Length - w.Word.Length);
        return new Edit(w.Start, w.Length, fix, w.Word, undoable);
    }

    public async Task FlushAsync(CancellationToken ct = default)
    {
        while (queued.Count > 0)
        {
            var batch = queued.Take(40).ToList();
            foreach (var k in batch) { queued.Remove(k); inflight.Add(k); }
            try
            {
                var res = await speller.CheckAsync(batch, ct);
                foreach (var k in batch) store.Remember(k, res.TryGetValue(k, out var f) ? f : null);
            }
            catch
            {
                return;
            }
            finally
            {
                foreach (var k in batch) inflight.Remove(k);
            }
        }
    }

    public List<Edit> Resolve(string text, int caret)
    {
        var edits = new List<Edit>();
        var keep = new List<(int Start, string Word)>();
        foreach (var p in pending)
        {
            var end = p.Start + p.Word.Length;
            if (end > text.Length || text.Substring(p.Start, p.Word.Length) != p.Word || end >= text.Length || !Rules.IsBoundary(text[end])) continue;
            if (!store.TryGet(p.Word.ToLowerInvariant(), out var fix)) { keep.Add(p); continue; }
            if (fix != null) edits.Add(new Edit(p.Start, p.Word.Length, Rules.MatchCase(p.Word, fix), p.Word, false));
        }
        pending.Clear();
        pending.AddRange(keep);
        edits.Sort((a, b) => b.Start.CompareTo(a.Start));
        if (edits.Count > 0)
        {
            var top = edits[0];
            if (caret == top.Start + top.Length + 1)
            {
                edits[0] = top with { Undoable = true };
                var shift = edits.Skip(1).Sum(e => e.Text.Length - e.Length);
                last = (top.Start + shift, top.From, top.Text, caret + top.Text.Length - top.Length + shift);
            }
            else last = null;
        }
        return edits;
    }

    public Edit? Backspace(string text, int caret)
    {
        if (last is not { } l || caret != l.Caret || l.Start + l.Fix.Length > text.Length || text.Substring(l.Start, l.Fix.Length) != l.Fix) { last = null; return null; }
        last = null;
        store.Keep(l.Original.ToLowerInvariant());
        return new Edit(l.Start, l.Fix.Length, l.Original, l.Fix, false);
    }

    public async Task<List<Edit>> FinishAsync(string text, TimeSpan wait, CancellationToken ct = default)
    {
        if (!Enabled) return new List<Edit>();
        var words = Rules.Words(text).Where(w => Rules.IsEligible(text, w, MinLength, store.IsKnownGood)).ToList();
        foreach (var w in words)
        {
            var k = w.Word.ToLowerInvariant();
            if (!store.TryGet(k, out _) && !inflight.Contains(k)) queued.Add(k);
        }
        if (queued.Count > 0)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(wait);
            try { await FlushAsync(cts.Token); } catch { }
        }
        var edits = new List<Edit>();
        foreach (var w in words)
            if (store.TryGet(w.Word.ToLowerInvariant(), out var fix) && fix != null)
                edits.Add(new Edit(w.Start, w.Length, Rules.MatchCase(w.Word, fix), w.Word, false));
        edits.Sort((a, b) => b.Start.CompareTo(a.Start));
        pending.Clear();
        last = null;
        return edits;
    }

    public static (string Text, int Caret) Apply(string text, int caret, Edit e)
    {
        var next = text.Substring(0, e.Start) + e.Text + text.Substring(e.Start + e.Length);
        var delta = e.Text.Length - e.Length;
        if (caret >= e.Start + e.Length) caret += delta;
        else if (caret > e.Start) caret = e.Start + e.Text.Length;
        return (next, caret);
    }
}
