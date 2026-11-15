using System.Text.Json;

namespace RpSpeller.Core;

public sealed class WordStore
{
    const int Cap = 20000;
    readonly Dictionary<string, string?> cache = new();
    readonly List<string> order = new();
    readonly HashSet<string> own = new();
    readonly HashSet<string> extra = new();
    readonly string? folder;
    Timer? saveTimer;
    readonly object gate = new();

    public WordStore(string? folder = null)
    {
        this.folder = folder;
        if (folder == null) return;
        try
        {
            var c = Path.Combine(folder, "cache.json");
            if (File.Exists(c))
                foreach (var pair in JsonSerializer.Deserialize<List<string?[]>>(File.ReadAllText(c)) ?? new())
                    if (pair.Length == 2 && pair[0] != null && !cache.ContainsKey(pair[0]!)) { cache[pair[0]!] = pair[1]; order.Add(pair[0]!); }
            var o = Path.Combine(folder, "own.json");
            if (File.Exists(o)) foreach (var w in JsonSerializer.Deserialize<List<string>>(File.ReadAllText(o)) ?? new()) own.Add(w);
        }
        catch { }
    }

    public void SetExtra(IEnumerable<string> words)
    {
        lock (gate) { extra.Clear(); foreach (var w in words) if (!string.IsNullOrWhiteSpace(w)) extra.Add(w.Trim().ToLowerInvariant()); }
    }

    public bool IsKnownGood(string key) { lock (gate) return own.Contains(key) || extra.Contains(key); }

    public bool TryGet(string key, out string? fix) { lock (gate) return cache.TryGetValue(key, out fix); }

    public int Count { get { lock (gate) return cache.Count; } }

    public void Remember(string key, string? fix)
    {
        lock (gate)
        {
            if (!cache.ContainsKey(key)) order.Add(key);
            cache[key] = fix;
            while (order.Count > Cap) { cache.Remove(order[0]); order.RemoveAt(0); }
        }
        ScheduleSave();
    }

    public void Keep(string key)
    {
        lock (gate) own.Add(key);
        ScheduleSave();
    }

    void ScheduleSave()
    {
        if (folder == null) return;
        saveTimer?.Dispose();
        saveTimer = new Timer(_ => Save(), null, 1500, Timeout.Infinite);
    }

    public void Save()
    {
        if (folder == null) return;
        try
        {
            Directory.CreateDirectory(folder);
            string c, o;
            lock (gate)
            {
                c = JsonSerializer.Serialize(order.Select(k => new[] { k, cache[k] }).ToList());
                o = JsonSerializer.Serialize(own.ToList());
            }
            File.WriteAllText(Path.Combine(folder, "cache.json"), c);
            File.WriteAllText(Path.Combine(folder, "own.json"), o);
        }
        catch { }
    }
}
