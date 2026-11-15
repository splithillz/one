namespace RpSpeller;

static class Program
{
    [STAThread]
    static void Main()
    {
        using var single = new Mutex(true, "RPSpeller-single-instance", out var first);
        if (!first)
        {
            MessageBox.Show("RP Speller уже запущен — значок в трее рядом с часами.", "RP Speller", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        Application.ThreadException += (_, e) => Log.Write("ui error: " + e.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, e) => Log.Write("fatal: " + e.ExceptionObject);
        ApplicationConfiguration.Initialize();
        Application.Run(new TrayApp());
    }
}
