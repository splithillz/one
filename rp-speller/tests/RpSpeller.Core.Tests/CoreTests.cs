using RpSpeller.Core;
using Xunit;

public class RulesTests
{
    static bool None(string _) => false;

    [Theory]
    [InlineData("привет мир", 6, "привет")]
    [InlineData("кто-нибуть", 10, "кто-нибуть")]
    [InlineData("слово-", 6, "слово")]
    public void WordBefore(string text, int end, string word) => Assert.Equal(word, Rules.WordBefore(text, end).Word);

    [Theory]
    [InlineData("здраствуйте", 0, true)]
    [InlineData("/me досал телефон", 4, true)]
    [InlineData("привет Джонн", 7, false)]
    [InlineData("Здраствуйте", 0, true)]
    [InlineData("Ну. Здраствуйте", 4, true)]
    [InlineData("спс", 0, false)]
    [InlineData("лол", 0, false)]
    [InlineData("okпривет", 2, false)]
    [InlineData("сайт.ру", 5, false)]
    [InlineData("@ник", 1, false)]
    public void Eligible(string text, int start, bool want)
    {
        var w = Rules.WordBefore(text, Rules.Words(text).First(x => x.Start == start).End);
        Assert.Equal(want, Rules.IsEligible(text, w, 4, None));
    }

    [Fact]
    public void KnownGoodWordsAreSkipped() => Assert.False(Rules.IsEligible("вайнвудский", new WordSpan(0, 11, "вайнвудский"), 4, k => k == "вайнвудский"));

    [Theory]
    [InlineData("здраствуйте", "здравствуйте", "здравствуйте")]
    [InlineData("Здраствуйте", "здравствуйте", "Здравствуйте")]
    [InlineData("СИГОДНЯ", "сегодня", "СЕГОДНЯ")]
    public void MatchCase(string orig, string fix, string want) => Assert.Equal(want, Rules.MatchCase(orig, fix));

    [Theory]
    [InlineData("харашо", "хорошо", 2)]
    [InlineData("здраствуйте", "здравствуйте", 1)]
    [InlineData("тпо", "топ", 1)]
    public void Distance(string a, string b, int d) => Assert.Equal(d, Rules.Distance(a, b));

    [Fact]
    public void PickFixRules()
    {
        Assert.Equal("здравствуйте", SpellerClient.PickFix("здраствуйте", new[] { new SpellerError(1, 0, 11, "здраствуйте", new[] { "здравствуйте" }) }));
        Assert.Null(SpellerClient.PickFix("собака", new[] { new SpellerError(1, 0, 6, "собака", new[] { "кошка" }) }));
        Assert.Null(SpellerClient.PickFix("слово", new[] { new SpellerError(3, 0, 5, "слово", new[] { "Слово" }) }));
        Assert.Equal("кто-нибудь", SpellerClient.PickFix("кто-нибуть", new[] { new SpellerError(1, 4, 6, "нибуть", new[] { "нибудь" }) }));
    }
}

public class SpellerTests
{
    [Fact]
    public async Task RealSpellerFixesTypicalTypos()
    {
        var s = new SpellerClient();
        var r = await s.CheckAsync(new[] { "здраствуйте", "харашо", "вобщем", "кто-нибуть", "привет", "досал" });
        Assert.Equal("здравствуйте", r["здраствуйте"]);
        Assert.Equal("хорошо", r["харашо"]);
        Assert.Equal("в общем", r["вобщем"]);
        Assert.Equal("кто-нибудь", r["кто-нибуть"]);
        Assert.Null(r["привет"]);
        Assert.Equal("достал", r["досал"]);
    }
}

public class TypingTests
{
    sealed class Box { public string Text = ""; public int Caret; }

    static void ApplyAll(Box b, IEnumerable<Edit> edits) { foreach (var e in edits) (b.Text, b.Caret) = TypingCorrector.Apply(b.Text, b.Caret, e); }

    static async Task Type(TypingCorrector c, Box b, string s, bool flushEach = true)
    {
        foreach (var ch in s)
        {
            b.Text = b.Text.Insert(b.Caret, ch.ToString());
            b.Caret++;
            var e = c.Typed(b.Text, b.Caret, ch);
            if (e != null) ApplyAll(b, new[] { e });
            if (flushEach && c.HasQueue) { await c.FlushAsync(); ApplyAll(b, c.Resolve(b.Text, b.Caret)); }
        }
    }

    static void Backspace(TypingCorrector c, Box b)
    {
        var e = c.Backspace(b.Text, b.Caret);
        if (e != null) { ApplyAll(b, new[] { e }); return; }
        if (b.Caret > 0) { b.Text = b.Text.Remove(b.Caret - 1, 1); b.Caret--; }
    }

    static TypingCorrector Make(out WordStore store)
    {
        store = new WordStore();
        return new TypingCorrector(store, new SpellerClient());
    }

    [Fact]
    public async Task FixesAfterSpaceAndUndoesWithBackspace()
    {
        var c = Make(out var store);
        var b = new Box();
        await Type(c, b, "здраствуйте ");
        Assert.Equal("здравствуйте ", b.Text);
        Backspace(c, b);
        Assert.Equal("здраствуйте ", b.Text);
        await Type(c, b, "и снова здраствуйте ");
        Assert.Equal("здраствуйте и снова здраствуйте ", b.Text);
        Assert.True(store.IsKnownGood("здраствуйте"));
    }

    [Fact]
    public async Task CommandsNamesLatinAndSlangStay()
    {
        var c = Make(out _);
        var b = new Box();
        await Type(c, b, "/me досал телефон, привет Джонн ok 123 лол спс ");
        Assert.Equal("/me достал телефон, привет Джонн ok 123 лол спс ", b.Text);
    }

    [Fact]
    public async Task FastTypingFixesEveryWord()
    {
        var c = Make(out _);
        var b = new Box();
        await Type(c, b, "я пошол домой и сказл привет ", flushEach: false);
        await c.FlushAsync();
        ApplyAll(b, c.Resolve(b.Text, b.Caret));
        Assert.Contains(b.Text, new[] { "я пошел домой и сказал привет ", "я пошёл домой и сказал привет " });
    }

    [Fact]
    public async Task EnterChecksTheWholeLineIncludingTheLastWord()
    {
        var c = Make(out _);
        var b = new Box();
        await Type(c, b, "как дела харашо", flushEach: false);
        var edits = await c.FinishAsync(b.Text, TimeSpan.FromSeconds(5));
        ApplyAll(b, edits);
        Assert.Equal("как дела хорошо", b.Text);
    }

    [Fact]
    public async Task CaseIsKept()
    {
        var c = Make(out _);
        var b = new Box();
        await Type(c, b, "СИГОДНЯ. Здраствуйте ");
        Assert.Equal("СЕГОДНЯ. Здравствуйте ", b.Text);
    }

    [Fact]
    public async Task DisabledDoesNothing()
    {
        var c = Make(out _);
        c.Enabled = false;
        var b = new Box();
        await Type(c, b, "здраствуйте ");
        Assert.Equal("здраствуйте ", b.Text);
        Assert.Empty(await c.FinishAsync("харашо", TimeSpan.FromSeconds(2)));
    }

    [Fact]
    public async Task StoreSurvivesRestart()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rps-" + Guid.NewGuid().ToString("N"));
        var s1 = new WordStore(dir);
        var c = new TypingCorrector(s1, new SpellerClient());
        var b = new Box();
        await Type(c, b, "харашо ");
        Backspace(c, b);
        s1.Save();
        var s2 = new WordStore(dir);
        Assert.True(s2.TryGet("харашо", out var fix) && fix == "хорошо");
        Assert.True(s2.IsKnownGood("харашо"));
        Directory.Delete(dir, true);
    }
}
