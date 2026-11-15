using System.Net.Http;
using System.Text.Json;

namespace RpSpeller.Core;

public interface ISpeller
{
    Task<IReadOnlyDictionary<string, string?>> CheckAsync(IReadOnlyList<string> words, CancellationToken ct = default);
}

public sealed class SpellerClient : ISpeller
{
    const string Api = "https://speller.yandex.net/services/spellservice.json/checkTexts";
    readonly HttpClient http;
    readonly string lang;

    public SpellerClient(HttpClient? http = null, string lang = "ru")
    {
        this.http = http ?? new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
        this.lang = lang;
    }

    public async Task<IReadOnlyDictionary<string, string?>> CheckAsync(IReadOnlyList<string> words, CancellationToken ct = default)
    {
        var result = new Dictionary<string, string?>();
        if (words.Count == 0) return result;
        var form = new List<KeyValuePair<string, string>> { new("lang", lang), new("options", "6") };
        form.AddRange(words.Select(w => new KeyValuePair<string, string>("text", w)));
        using var resp = await http.PostAsync(Api, new FormUrlEncodedContent(form), ct).ConfigureAwait(false);
        resp.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false));
        var i = 0;
        foreach (var errs in doc.RootElement.EnumerateArray())
        {
            if (i >= words.Count) break;
            var w = words[i++];
            result[w] = PickFix(w, errs.EnumerateArray().Select(e => new SpellerError(
                e.GetProperty("code").GetInt32(),
                e.GetProperty("pos").GetInt32(),
                e.GetProperty("len").GetInt32(),
                e.GetProperty("word").GetString() ?? "",
                e.TryGetProperty("s", out var s) ? s.EnumerateArray().Select(x => x.GetString() ?? "").ToList() : new List<string>())).ToList());
        }
        return result;
    }

    public static string? PickFix(string word, IReadOnlyList<SpellerError> errors)
    {
        var usable = errors.Where(e => e.Code == 1 && e.Suggestions.Count > 0).ToList();
        if (usable.Count != 1) return null;
        var e = usable[0];
        if (e.Pos < 0 || e.Pos + e.Len > word.Length || !string.Equals(word.Substring(e.Pos, e.Len), e.Word, StringComparison.OrdinalIgnoreCase)) return null;
        var cand = (word.Substring(0, e.Pos) + e.Suggestions[0] + word.Substring(e.Pos + e.Len)).ToLowerInvariant();
        var limit = word.Length >= 6 ? 2 : 1;
        if (cand == word || cand.Length < 2 || Rules.Distance(word, cand) > limit) return null;
        return cand;
    }
}

public sealed record SpellerError(int Code, int Pos, int Len, string Word, IReadOnlyList<string> Suggestions);
