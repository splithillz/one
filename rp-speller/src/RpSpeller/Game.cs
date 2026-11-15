using System.Diagnostics;

namespace RpSpeller;

static class Game
{
    static readonly string[] Exes = { "gta5", "gta5_enhanced" };

    public static IntPtr Find()
    {
        IntPtr best = IntPtr.Zero;
        long bestArea = 0;
        Native.EnumWindows((h, _) =>
        {
            if (!Native.IsWindowVisible(h)) return true;
            if (!Native.GetWindowRect(h, out var r)) return true;
            long w = r.Right - r.Left, ht = r.Bottom - r.Top;
            if (w < 200 || ht < 200) return true;
            if (!IsGame(h)) return true;
            if (w * ht > bestArea) { bestArea = w * ht; best = h; }
            return true;
        }, IntPtr.Zero);
        return best;
    }

    static bool IsGame(IntPtr h)
    {
        if (Native.ClassOf(h) == "grcWindow") return true;
        Native.GetWindowThreadProcessId(h, out var pid);
        try
        {
            var name = Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant();
            return Exes.Contains(name) || (name.StartsWith("fivem") || name.StartsWith("cfx")) && name.Contains("gtaprocess");
        }
        catch { return false; }
    }

    public static Rectangle Bounds(IntPtr h)
    {
        if (h == IntPtr.Zero || !Native.GetWindowRect(h, out var r)) return Screen.PrimaryScreen?.Bounds ?? new Rectangle(0, 0, 1280, 720);
        return Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
    }

    public static async Task<bool> Focus(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero || !Native.IsWindow(hwnd)) return false;
        if (Native.IsIconic(hwnd)) Native.ShowWindow(hwnd, 9);
        for (var n = 0; n < 3; n++)
        {
            if (Native.GetForegroundWindow() == hwnd) return true;
            var me = Native.GetCurrentThreadId();
            var threads = new HashSet<uint>
            {
                Native.GetWindowThreadProcessId(Native.GetForegroundWindow(), out _),
                Native.GetWindowThreadProcessId(hwnd, out _)
            };
            threads.Remove(0);
            threads.Remove(me);
            var attached = threads.Where(t => Native.AttachThreadInput(me, t, true)).ToList();
            try
            {
                if (n > 0) Native.Send(Native.Key(Native.VK_MENU, false), Native.Key(Native.VK_MENU, true));
                Native.BringWindowToTop(hwnd);
                Native.SetForegroundWindow(hwnd);
            }
            finally
            {
                foreach (var t in attached) Native.AttachThreadInput(me, t, false);
            }
            await Task.Delay(80);
        }
        return Native.GetForegroundWindow() == hwnd;
    }

    public static async Task Tap(ushort vk)
    {
        Native.Send(Native.Key(vk, false));
        await Task.Delay(45);
        Native.Send(Native.Key(vk, true));
    }

    static async Task Paste()
    {
        Native.Send(Native.Key(Native.VK_CONTROL, false));
        await Task.Delay(40);
        await Tap(Native.VK_V);
        await Task.Delay(40);
        Native.Send(Native.Key(Native.VK_CONTROL, true));
    }

    static async Task TypeText(string text)
    {
        foreach (var c in text)
        {
            Native.Send(Native.Unicode(c, false), Native.Unicode(c, true));
            await Task.Delay(8);
        }
    }

    public static async Task<bool> OpenChat(Config cfg, IntPtr hwnd)
    {
        if (!await Focus(hwnd)) { Log.Write("could not focus the game to open the chat"); return false; }
        await Task.Delay(Math.Max(0, cfg.FocusDelayMs));
        await Tap(cfg.ChatVk());
        await Task.Delay(Math.Max(0, cfg.OpenDelayMs));
        return Native.GetForegroundWindow() == hwnd;
    }

    public static async Task CloseChat(Config cfg, IntPtr hwnd)
    {
        if (!await Focus(hwnd)) return;
        await Task.Delay(Math.Max(0, cfg.FocusDelayMs));
        await Tap(Native.VK_ESCAPE);
    }

    public static async Task<(bool Ok, string Error)> Send(Config cfg, IntPtr hwnd, string text)
    {
        if (hwnd == IntPtr.Zero || !Native.IsWindow(hwnd)) return (false, "окно игры не найдено");
        if (!await Focus(hwnd)) return (false, "не получилось переключиться в игру (она запущена от администратора?)");
        await Task.Delay(Math.Max(0, cfg.FocusDelayMs));
        if (cfg.InputMode == "type") await TypeText(text);
        else
        {
            string? previous = null;
            try { if (Clipboard.ContainsText()) previous = Clipboard.GetText(); } catch { }
            var copied = false;
            try { Clipboard.SetText(text); copied = true; } catch (Exception e) { Log.Write("clipboard: " + e.Message); }
            if (copied) { await Paste(); _ = RestoreClipboardLater(previous, text); }
            else await TypeText(text);
        }
        await Task.Delay(Math.Max(0, cfg.PasteDelayMs));
        if (cfg.Submit)
        {
            if (Native.GetForegroundWindow() != hwnd) return (false, "игра потеряла фокус во время ввода");
            await Tap(Native.VK_RETURN);
        }
        return (true, "");
    }

    static async Task RestoreClipboardLater(string? previous, string ours)
    {
        await Task.Delay(800);
        try
        {
            if (Clipboard.ContainsText() && Clipboard.GetText() == ours)
            {
                if (previous != null) Clipboard.SetText(previous); else Clipboard.Clear();
            }
        }
        catch { }
    }
}
