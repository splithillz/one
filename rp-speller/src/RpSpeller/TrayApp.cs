using System.Diagnostics;
using RpSpeller.Core;

namespace RpSpeller;

sealed class HotkeyWindow : NativeWindow, IDisposable
{
    public event Action? Pressed;
    bool registered;

    public HotkeyWindow() => CreateHandle(new CreateParams());

    public bool Register(string spec)
    {
        Unregister();
        if (!Config.TryParseHotkey(spec, out var mods, out var vk)) return false;
        registered = Native.RegisterHotKey(Handle, 1, mods | Native.MOD_NOREPEAT, vk);
        if (!registered) Log.Write($"RegisterHotKey({spec}) failed — the key is probably taken by another program");
        return registered;
    }

    public void Unregister()
    {
        if (registered) Native.UnregisterHotKey(Handle, 1);
        registered = false;
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == Native.WM_HOTKEY) Pressed?.Invoke();
        base.WndProc(ref m);
    }

    public void Dispose()
    {
        Unregister();
        DestroyHandle();
    }
}

sealed class TrayApp : ApplicationContext
{
    readonly Config cfg = Config.Load();
    readonly WordStore store = new(Config.Folder);
    readonly TypingCorrector corrector;
    readonly NotifyIcon tray = new();
    readonly HotkeyWindow hotkey = new();
    readonly OverlayForm overlay;
    readonly ToolStripMenuItem fixItem;
    IntPtr game;
    bool chatOpenedByUs;

    public TrayApp()
    {
        corrector = new TypingCorrector(store, new SpellerClient());
        ApplySettings();
        overlay = new OverlayForm(corrector);
        overlay.Submitted += SendAsync;
        overlay.Cancelled += CancelAsync;

        var menu = new ContextMenuStrip();
        menu.Items.Add("Открыть окно чата", null, (_, _) => OnHotkey());
        fixItem = new ToolStripMenuItem("Исправлять ошибки", null, (_, _) => { cfg.Autocorrect = !cfg.Autocorrect; cfg.Save(); ApplySettings(); }) { Checked = cfg.Autocorrect };
        menu.Items.Add(fixItem);
        menu.Items.Add("Настройки…", null, (_, _) => OpenSettings());
        menu.Items.Add("Папка с логами", null, (_, _) => { try { Directory.CreateDirectory(Config.Folder); Process.Start(new ProcessStartInfo(Config.Folder) { UseShellExecute = true }); } catch { } });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Проверка правописания: Яндекс.Спеллер", null, (_, _) => { try { Process.Start(new ProcessStartInfo("http://api.yandex.ru/speller/") { UseShellExecute = true }); } catch { } });
        menu.Items.Add("Выход", null, (_, _) => ExitThread());

        tray.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        tray.Text = "RP Speller";
        tray.ContextMenuStrip = menu;
        tray.Visible = true;
        tray.DoubleClick += (_, _) => OpenSettings();

        hotkey.Pressed += OnHotkey;
        if (hotkey.Register(cfg.Hotkey)) Balloon($"Работаю. {cfg.Hotkey} — открыть окно чата в игре.");
        else Balloon($"Клавиша {cfg.Hotkey} занята другой программой. Выбери другую в настройках.", ToolTipIcon.Warning);
        Log.Write($"started, version {Application.ProductVersion}, hotkey {cfg.Hotkey}, chat key {cfg.ChatKey}");
    }

    void ApplySettings()
    {
        corrector.Enabled = cfg.Autocorrect;
        store.SetExtra(cfg.Words);
        if (fixItem != null) fixItem.Checked = cfg.Autocorrect;
    }

    void Balloon(string text, ToolTipIcon icon = ToolTipIcon.Info)
    {
        tray.BalloonTipTitle = "RP Speller";
        tray.BalloonTipText = text;
        tray.BalloonTipIcon = icon;
        tray.ShowBalloonTip(3000);
    }

    void OpenSettings()
    {
        using var f = new SettingsForm(cfg);
        if (f.ShowDialog() != DialogResult.OK) return;
        ApplySettings();
        if (!hotkey.Register(cfg.Hotkey)) Balloon($"Клавиша {cfg.Hotkey} занята другой программой.", ToolTipIcon.Warning);
    }

    async void OnHotkey()
    {
        if (overlay.Visible) { overlay.Activate(); await Game.Focus(overlay.Handle); return; }
        game = Game.Find();
        chatOpenedByUs = false;
        if (game != IntPtr.Zero)
        {
            chatOpenedByUs = await Game.OpenChat(cfg, game);
            Log.Write($"hotkey: game found, chat opened: {chatOpenedByUs}");
        }
        else Log.Write("hotkey: game window not found");
        await overlay.ShowOverAsync(Game.Bounds(game));
    }

    async Task SendAsync(string text)
    {
        if (game == IntPtr.Zero) game = Game.Find();
        if (game != IntPtr.Zero && !chatOpenedByUs) chatOpenedByUs = await Game.OpenChat(cfg, game);
        var (ok, error) = await Game.Send(cfg, game, text);
        chatOpenedByUs = false;
        Log.Write(ok ? $"sent {text.Length} chars" : $"send failed: {error}");
        if (ok) return;
        try { Clipboard.SetText(text); } catch { }
        Balloon($"Не получилось отправить: {error}. Текст в буфере — вставь Ctrl+V.", ToolTipIcon.Warning);
    }

    async Task CancelAsync()
    {
        if (chatOpenedByUs && game != IntPtr.Zero) await Game.CloseChat(cfg, game);
        chatOpenedByUs = false;
    }

    protected override void ExitThreadCore()
    {
        store.Save();
        hotkey.Dispose();
        tray.Visible = false;
        tray.Dispose();
        overlay.Dispose();
        base.ExitThreadCore();
    }
}
