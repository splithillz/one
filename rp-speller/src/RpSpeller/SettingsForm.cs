using System.Diagnostics;

namespace RpSpeller;

sealed class SettingsForm : Form
{
    readonly TextBox hotkey = new() { Width = 140 };
    readonly TextBox chatKey = new() { Width = 60, MaxLength = 1 };
    readonly NumericUpDown focusDelay = new() { Maximum = 3000, Increment = 50, Width = 90 };
    readonly NumericUpDown openDelay = new() { Maximum = 3000, Increment = 50, Width = 90 };
    readonly NumericUpDown pasteDelay = new() { Maximum = 3000, Increment = 50, Width = 90 };
    readonly ComboBox mode = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 200 };
    readonly CheckBox submit = new() { Text = "Сразу отправлять (нажимать Enter в игре)", AutoSize = true };
    readonly CheckBox autocorrect = new() { Text = "Исправлять ошибки", AutoSize = true };
    readonly TextBox words = new() { Multiline = true, ScrollBars = ScrollBars.Vertical, Width = 360, Height = 110 };
    readonly Config cfg;

    public SettingsForm(Config cfg)
    {
        this.cfg = cfg;
        Text = "RP Speller — настройки";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        AutoSize = true;
        AutoSizeMode = AutoSizeMode.GrowAndShrink;
        Font = new Font("Segoe UI", 9.5f);
        Padding = new Padding(12);

        mode.Items.AddRange(new object[] { "Вставка (Ctrl+V)", "Печать по буквам" });

        var t = new TableLayoutPanel { ColumnCount = 2, AutoSize = true, Dock = DockStyle.Fill };
        void Row(string label, Control c) { t.Controls.Add(new Label { Text = label, AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 6, 12, 6) }); t.Controls.Add(c); }
        Row("Горячая клавиша (например F7, Ctrl+Alt+K)", hotkey);
        Row("Клавиша чата в игре", chatKey);
        Row("Пауза после переключения в игру, мс", focusDelay);
        Row("Пауза после открытия чата, мс", openDelay);
        Row("Пауза после вставки, мс", pasteDelay);
        Row("Как вводить текст в игру", mode);
        t.Controls.Add(submit); t.SetColumnSpan(submit, 2);
        t.Controls.Add(autocorrect); t.SetColumnSpan(autocorrect, 2);
        var wl = new Label { Text = "Свои слова — не исправлять (по одному в строке):", AutoSize = true, Margin = new Padding(0, 10, 0, 4) };
        t.Controls.Add(wl); t.SetColumnSpan(wl, 2);
        t.Controls.Add(words); t.SetColumnSpan(words, 2);

        var credit = new LinkLabel { Text = "Проверка правописания: Яндекс.Спеллер", AutoSize = true, Margin = new Padding(0, 12, 0, 4) };
        credit.LinkClicked += (_, _) => { try { Process.Start(new ProcessStartInfo("http://api.yandex.ru/speller/") { UseShellExecute = true }); } catch { } };
        t.Controls.Add(credit); t.SetColumnSpan(credit, 2);

        var ok = new Button { Text = "Сохранить", AutoSize = true, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Отмена", AutoSize = true, DialogResult = DialogResult.Cancel };
        var buttons = new FlowLayoutPanel { FlowDirection = FlowDirection.RightToLeft, AutoSize = true, Dock = DockStyle.Fill, Margin = new Padding(0, 10, 0, 0) };
        buttons.Controls.Add(cancel);
        buttons.Controls.Add(ok);
        t.Controls.Add(buttons); t.SetColumnSpan(buttons, 2);
        Controls.Add(t);
        AcceptButton = ok;
        CancelButton = cancel;

        hotkey.Text = cfg.Hotkey;
        chatKey.Text = cfg.ChatKey;
        focusDelay.Value = Math.Clamp(cfg.FocusDelayMs, 0, 3000);
        openDelay.Value = Math.Clamp(cfg.OpenDelayMs, 0, 3000);
        pasteDelay.Value = Math.Clamp(cfg.PasteDelayMs, 0, 3000);
        mode.SelectedIndex = cfg.InputMode == "type" ? 1 : 0;
        submit.Checked = cfg.Submit;
        autocorrect.Checked = cfg.Autocorrect;
        words.Text = string.Join(Environment.NewLine, cfg.Words);

        FormClosing += (sender, e) =>
        {
            if (DialogResult != DialogResult.OK) return;
            if (!Config.TryParseHotkey(hotkey.Text, out _, out _))
            {
                MessageBox.Show(this, "Не понял горячую клавишу. Примеры: F7, Ctrl+Alt+K, Shift+F2.", Text, MessageBoxButtons.OK, MessageBoxIcon.Warning);
                e.Cancel = true;
                return;
            }
            cfg.Hotkey = hotkey.Text.Trim();
            cfg.ChatKey = string.IsNullOrWhiteSpace(chatKey.Text) ? "T" : chatKey.Text.Trim().ToUpperInvariant();
            cfg.FocusDelayMs = (int)focusDelay.Value;
            cfg.OpenDelayMs = (int)openDelay.Value;
            cfg.PasteDelayMs = (int)pasteDelay.Value;
            cfg.InputMode = mode.SelectedIndex == 1 ? "type" : "paste";
            cfg.Submit = submit.Checked;
            cfg.Autocorrect = autocorrect.Checked;
            cfg.Words = words.Lines.Select(x => x.Trim()).Where(x => x.Length > 0).Distinct().ToList();
            cfg.Save();
        };
    }
}
