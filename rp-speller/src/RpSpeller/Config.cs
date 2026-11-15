using System.Text.Json;

namespace RpSpeller;

sealed class Config
{
    public string Hotkey { get; set; } = "F7";
    public string ChatKey { get; set; } = "T";
    public int FocusDelayMs { get; set; } = 150;
    public int OpenDelayMs { get; set; } = 300;
    public int PasteDelayMs { get; set; } = 150;
    public string InputMode { get; set; } = "paste";
    public bool Submit { get; set; } = true;
    public bool Autocorrect { get; set; } = true;
    public List<string> Words { get; set; } = new() { "лспд", "сасд", "вайнвуд", "палето" };

    public static string Folder => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "RPSpeller");
    static string FilePath => Path.Combine(Folder, "config.json");
    static readonly JsonSerializerOptions Json = new() { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static Config Load()
    {
        try
        {
            if (File.Exists(FilePath)) return JsonSerializer.Deserialize<Config>(File.ReadAllText(FilePath), Json) ?? new Config();
        }
        catch (Exception e) { Log.Write("config read failed: " + e.Message); }
        return new Config();
    }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(Folder);
            File.WriteAllText(FilePath, JsonSerializer.Serialize(this, Json));
        }
        catch (Exception e) { Log.Write("config save failed: " + e.Message); }
    }

    public ushort ChatVk()
    {
        var k = (ChatKey ?? "T").Trim().ToUpperInvariant();
        return k.Length > 0 && char.IsAsciiLetterOrDigit(k[0]) ? k[0] : (ushort)'T';
    }

    public static bool TryParseHotkey(string spec, out uint mods, out uint vk)
    {
        mods = 0;
        vk = 0;
        if (string.IsNullOrWhiteSpace(spec)) return false;
        foreach (var raw in spec.Split('+'))
        {
            var part = raw.Trim();
            switch (part.ToLowerInvariant())
            {
                case "ctrl": case "control": mods |= Native.MOD_CONTROL; continue;
                case "alt": mods |= Native.MOD_ALT; continue;
                case "shift": mods |= Native.MOD_SHIFT; continue;
                case "win": mods |= Native.MOD_WIN; continue;
            }
            if (part.Length == 1 && char.IsAsciiLetterOrDigit(part[0])) { vk = char.ToUpperInvariant(part[0]); continue; }
            if (Enum.TryParse<Keys>(part, true, out var key) && key != Keys.None) { vk = (uint)key; continue; }
            return false;
        }
        return vk != 0;
    }
}

static class Log
{
    static readonly object Gate = new();
    static string FilePath => Path.Combine(Config.Folder, "log.txt");

    public static void Write(string line)
    {
        try
        {
            lock (Gate)
            {
                Directory.CreateDirectory(Config.Folder);
                var f = new FileInfo(FilePath);
                if (f.Exists && f.Length > 1_000_000) f.Delete();
                File.AppendAllText(FilePath, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} {line}{Environment.NewLine}");
            }
        }
        catch { }
    }
}
