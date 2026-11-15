using RpSpeller.Core;

namespace RpSpeller;

sealed class OverlayForm : Form
{
    readonly TextBox box = new();
    readonly Label status = new();
    readonly TypingCorrector corrector;
    readonly System.Windows.Forms.Timer flushTimer = new() { Interval = 120 };
    readonly System.Windows.Forms.Timer statusTimer = new() { Interval = 2400 };
    bool busy;

    public event Func<string, Task>? Submitted;
    public event Func<Task>? Cancelled;

    const string Hint = "Enter — отправить · Esc — отмена · ⌫ сразу после исправления — вернуть";

    public OverlayForm(TypingCorrector corrector)
    {
        this.corrector = corrector;
        FormBorderStyle = FormBorderStyle.None;
        TopMost = true;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        BackColor = Color.FromArgb(28, 30, 36);
        Padding = new Padding(14, 10, 14, 8);
        Size = new Size(640, 78);
        KeyPreview = true;

        box.BorderStyle = BorderStyle.None;
        box.BackColor = Color.FromArgb(40, 43, 51);
        box.ForeColor = Color.White;
        box.Font = new Font("Segoe UI", 13f);
        box.Dock = DockStyle.Top;
        box.MaxLength = 400;

        status.Dock = DockStyle.Bottom;
        status.Height = 22;
        status.ForeColor = Color.FromArgb(160, 166, 176);
        status.Font = new Font("Segoe UI", 9f);
        status.Text = Hint;

        Controls.Add(box);
        Controls.Add(status);

        box.KeyPress += (_, e) => { var c = e.KeyChar; if (!char.IsControl(c)) BeginInvoke(() => OnTyped(c)); };
        box.KeyDown += OnKeyDown;
        flushTimer.Tick += async (_, _) => { flushTimer.Stop(); await FlushAndResolve(); };
        statusTimer.Tick += (_, _) => { statusTimer.Stop(); status.Text = Hint; status.ForeColor = Color.FromArgb(160, 166, 176); };
    }

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ExStyle |= 0x80;
            return cp;
        }
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        using var pen = new Pen(Color.FromArgb(143, 209, 138), 2);
        e.Graphics.DrawRectangle(pen, 1, 1, Width - 2, Height - 2);
    }

    public async Task ShowOverAsync(Rectangle game)
    {
        busy = false;
        corrector.Reset();
        box.Text = "";
        status.Text = Hint;
        var w = Math.Min(Width, Math.Max(360, game.Width - 40));
        Size = new Size(w, Height);
        Location = new Point(game.Left + (game.Width - w) / 2, game.Top + (int)(game.Height * 0.70));
        Show();
        Activate();
        if (!await Game.Focus(Handle)) Log.Write("overlay could not take the focus — click into it");
        Activate();
        box.Focus();
    }

    void OnTyped(char c)
    {
        if (busy) return;
        var edit = corrector.Typed(box.Text, box.SelectionStart, c);
        if (edit != null) Apply(new[] { edit });
        if (corrector.HasQueue) { flushTimer.Stop(); flushTimer.Start(); }
    }

    async Task FlushAndResolve()
    {
        await corrector.FlushAsync();
        if (!Visible) return;
        Apply(corrector.Resolve(box.Text, box.SelectionStart));
    }

    void Apply(IReadOnlyList<Edit> edits)
    {
        if (edits.Count == 0) return;
        var text = box.Text;
        var caret = box.SelectionStart;
        foreach (var e in edits) (text, caret) = TypingCorrector.Apply(text, caret, e);
        box.Text = text;
        box.SelectionStart = Math.Min(caret, text.Length);
        box.SelectionLength = 0;
        var shown = edits.FirstOrDefault(e => e.Undoable) ?? edits[^1];
        status.ForeColor = Color.FromArgb(143, 209, 138);
        status.Text = $"{shown.From} → {shown.Text}" + (shown.Undoable ? "    ⌫ — вернуть" : "");
        statusTimer.Stop();
        statusTimer.Start();
        Log.Write($"fixed: {string.Join(", ", edits.Select(e => e.From + " → " + e.Text))}");
    }

    async void OnKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.KeyCode == Keys.Back && box.SelectionLength == 0)
        {
            var undo = corrector.Backspace(box.Text, box.SelectionStart);
            if (undo != null)
            {
                e.SuppressKeyPress = true;
                e.Handled = true;
                var (text, caret) = TypingCorrector.Apply(box.Text, box.SelectionStart, undo);
                box.Text = text;
                box.SelectionStart = caret;
                status.ForeColor = Color.FromArgb(160, 166, 176);
                status.Text = $"вернул «{undo.Text}» — больше не трогаю это слово";
                statusTimer.Stop();
                statusTimer.Start();
            }
            return;
        }
        if (e.KeyCode == Keys.Escape)
        {
            e.SuppressKeyPress = true;
            Hide();
            if (Cancelled != null) await Cancelled.Invoke();
            return;
        }
        if (e.KeyCode != Keys.Enter) return;
        e.SuppressKeyPress = true;
        if (busy) return;
        busy = true;
        flushTimer.Stop();
        status.ForeColor = Color.FromArgb(160, 166, 176);
        status.Text = "проверяю…";
        Apply(await corrector.FinishAsync(box.Text, TimeSpan.FromMilliseconds(1500)));
        var text2 = box.Text.Trim();
        Hide();
        if (text2.Length == 0) { if (Cancelled != null) await Cancelled.Invoke(); }
        else if (Submitted != null) await Submitted.Invoke(text2);
        busy = false;
    }
}
