using System.Text.RegularExpressions;

namespace RpSpeller.Core;

public readonly record struct WordSpan(int Start, int End, string Word)
{
    public int Length => End - Start;
}

public static class Rules
{
    public const string BoundaryChars = " \t\n.,!?;:)]»\"'…";
    static readonly Regex CyrWord = new(@"^[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*$", RegexOptions.Compiled);
    static readonly Regex WordChar = new(@"[А-Яа-яЁё-]", RegexOptions.Compiled);
    static readonly Regex Command = new(@"^\s*/\S+\s*", RegexOptions.Compiled);

    public static readonly HashSet<string> Slang = new(StringComparer.Ordinal)
    {
        "спс", "пасиб", "пасиба", "пж", "пжлст", "плз", "плиз", "лол", "кек", "кекв", "рофл", "кринж", "жиза", "изи", "хз", "мб",
        "крч", "кста", "имхо", "норм", "нормас", "ок", "окей", "оки", "окс", "лан", "ладн", "ладно", "чё", "че", "чо", "чет", "щас",
        "ща", "ваще", "всм", "тип", "типа", "бро", "брат", "братан", "братик", "братишка", "ору", "ахах", "ахаха", "хаха", "хахах",
        "хах", "аха", "пон", "понял", "поняла", "гг", "вп", "нуб", "нубас", "агр", "агрится", "тп", "телепорт", "тпшнуть", "админ",
        "админка", "модер", "саппорт", "рп", "нонрп", "оос", "ик", "дм", "дмщик", "гта", "мта", "лспд", "лсмс", "фиб", "сасд", "пд",
        "мэрия", "мерия", "гетто", "баллас", "вагос", "фэмили", "фемили", "грув", "вайнвуд", "вайнвуде", "палето", "сэнди", "тачка",
        "тачку", "тачки", "бизнес", "бизнесы", "спавн", "спавне", "респ", "респавн", "кд", "инвайт", "инвайтнуть", "варн", "варны",
        "мут", "мьют", "бан", "кик", "дс", "дискорд", "вк", "тг", "телега", "гугл", "ютуб", "твич", "стрим", "стример", "го", "гоу",
        "ку", "прив", "привки", "здарова", "здорова", "хай", "бб"
    };

    public static bool IsBoundary(char c) => BoundaryChars.IndexOf(c) >= 0;

    public static WordSpan WordBefore(string text, int end)
    {
        var start = end;
        while (start > 0 && WordChar.IsMatch(text[start - 1].ToString())) start--;
        while (start < end && text[start] == '-') start++;
        var stop = end;
        while (stop > start && text[stop - 1] == '-') stop--;
        return new WordSpan(start, stop, text.Substring(start, stop - start));
    }

    public static bool IsEligible(string text, WordSpan w, int minLength, Func<string, bool> isKnownGood)
    {
        if (w.Word.Length < minLength || !CyrWord.IsMatch(w.Word)) return false;
        var key = w.Word.ToLowerInvariant();
        if (Slang.Contains(key) || isKnownGood(key)) return false;
        if (w.Start > 0 && "/@#$%&*_=+<>\\|~`".IndexOf(text[w.Start - 1]) >= 0) return false;
        if (w.Start > 0 && char.IsAsciiLetterOrDigit(text[w.Start - 1])) return false;
        var head = text.Substring(0, w.Start);
        var token = head.Split(' ', '\t', '\n').LastOrDefault() ?? "";
        if (token.IndexOfAny(new[] { '/', ':', '.' }) >= 0) return false;
        var before = Command.Replace(head, "", 1);
        var sentenceStart = string.IsNullOrWhiteSpace(before) || Regex.IsMatch(before, @"[.!?…]\s*$");
        if (!sentenceStart && char.IsUpper(w.Word[0])) return false;
        return true;
    }

    public static string MatchCase(string orig, string fix)
    {
        if (orig.Length > 1 && orig == orig.ToUpperInvariant()) return fix.ToUpperInvariant();
        if (char.IsUpper(orig[0])) return char.ToUpperInvariant(fix[0]) + fix.Substring(1);
        return fix;
    }

    public static int Distance(string a, string b)
    {
        var d = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) d[0, j] = j;
        for (var i = 1; i <= a.Length; i++)
        {
            for (var j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + cost);
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1]) d[i, j] = Math.Min(d[i, j], d[i - 2, j - 2] + 1);
            }
        }
        return d[a.Length, b.Length];
    }

    public static IEnumerable<WordSpan> Words(string text)
    {
        foreach (Match m in Regex.Matches(text, @"[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*"))
            yield return new WordSpan(m.Index, m.Index + m.Length, m.Value);
    }
}
