// RawInput.cs — ascolto passivo di Raw Input (Windows), condiviso da PadBridge.ps1 e RawInputPad.ps1.
// Gli script lo compilano insieme al proprio C# (il testo di questo file si accoda dopo i loro "using"), che deve quindi
// includere: System, System.Collections.Generic, System.Runtime.InteropServices, System.Text, System.Windows.Forms.
//
// PRIVACY: è un monitor PASSIVO (RIDEV_INPUTSINK): non blocca né modifica nulla, gli altri programmi ricevono gli eventi come sempre.
// L'evento di un dispositivo che non è il macropad (percorso senza uno dei marcatori) viene SCARTATO prima di leggerne il
// contenuto: si incrementa solo un contatore.

// chiamato per ogni evento del macropad; `buffer` vale solo durante la chiamata e il contenuto parte da `offset`
public delegate void PadInputHandler(uint type, IntPtr device, IntPtr buffer, int offset);

public static class RawInput
{
    public static int PadEvents = 0, OtherEvents = 0;
    public static string[] Markers = new string[0];        // frammenti (maiuscoli o no) che identificano il macropad nel percorso del dispositivo
    public static PadInputHandler OnPadInput;

    static readonly Dictionary<IntPtr, string> names = new Dictionary<IntPtr, string>();
    static readonly Dictionary<IntPtr, bool> isPad = new Dictionary<IntPtr, bool>();

    // costanti dell'API Raw Input
    const uint RIDEV_REMOVE = 0x00000001, RIDEV_INPUTSINK = 0x00000100;
    const uint RID_INPUT = 0x10000003, RIDI_DEVICENAME = 0x20000007;
    const int WM_INPUT = 0x00FF;
    const uint QS_ALLINPUT = 0x04FF;

    [StructLayout(LayoutKind.Sequential)]
    struct RAWINPUTDEVICE { public ushort usUsagePage; public ushort usUsage; public uint dwFlags; public IntPtr hwndTarget; }
    [StructLayout(LayoutKind.Sequential)]
    struct RAWINPUTHEADER { public uint dwType; public uint dwSize; public IntPtr hDevice; public IntPtr wParam; }
    [DllImport("user32.dll", SetLastError = true)]
    static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] p, uint n, uint size);
    [DllImport("user32.dll")]
    static extern uint GetRawInputData(IntPtr hRawInput, uint cmd, IntPtr data, ref uint size, uint hdrSize);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern uint GetRawInputDeviceInfo(IntPtr dev, uint cmd, StringBuilder data, ref uint size);
    [DllImport("user32.dll")]
    static extern uint MsgWaitForMultipleObjects(uint count, IntPtr[] handles, bool waitAll, uint ms, uint mask);

    // finestra invisibile (HWND_MESSAGE) che riceve WM_INPUT
    class MsgWin : NativeWindow
    {
        public MsgWin() { CreateParams cp = new CreateParams(); cp.Parent = new IntPtr(-3); CreateHandle(cp); }
        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_INPUT) RawInput.OnInput(m.LParam);
            base.WndProc(ref m);
        }
    }

    public static string DeviceName(IntPtr h)
    {
        string n;
        if (names.TryGetValue(h, out n)) return n;
        uint size = 0;
        GetRawInputDeviceInfo(h, RIDI_DEVICENAME, null, ref size);
        StringBuilder sb = new StringBuilder((int)Math.Max(size, 1));
        GetRawInputDeviceInfo(h, RIDI_DEVICENAME, sb, ref size);
        n = sb.ToString();
        names[h] = n;
        return n;
    }

    public static bool IsPad(IntPtr h)
    {
        bool r;
        if (isPad.TryGetValue(h, out r)) return r;
        string n = DeviceName(h).ToUpperInvariant();
        r = false;
        foreach (string m in Markers) { if (m.Length > 0 && n.Contains(m.ToUpperInvariant())) r = true; }
        isPad[h] = r;
        return r;
    }

    static void OnInput(IntPtr lParam)
    {
        uint size = 0, hdr = (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER));
        GetRawInputData(lParam, RID_INPUT, IntPtr.Zero, ref size, hdr);
        if (size == 0) return;
        IntPtr buf = Marshal.AllocHGlobal((int)size);
        try
        {
            if (GetRawInputData(lParam, RID_INPUT, buf, ref size, hdr) != size) return;
            uint type = (uint)Marshal.ReadInt32(buf, 0);
            IntPtr dev = Marshal.ReadIntPtr(buf, 8);
            // FILTRO DI PRIVACY: si decide prima di leggere qualsiasi contenuto
            if (!IsPad(dev)) { OtherEvents++; return; }
            PadEvents++;
            PadInputHandler handler = OnPadInput;
            if (handler != null) handler(type, dev, buf, (int)hdr);
        }
        finally { Marshal.FreeHGlobal(buf); }
    }

    // Registra tastiere, mouse e consumer control, elabora i messaggi finché shouldStop() non è vero, poi annulla la registrazione.
    // Va chiamato da un thread STA. Restituisce 0, oppure il codice di errore di Windows se la registrazione fallisce.
    public static int Listen(Func<bool> shouldStop)
    {
        MsgWin w = new MsgWin();
        RAWINPUTDEVICE[] d = new RAWINPUTDEVICE[3];
        d[0].usUsagePage = 0x01; d[0].usUsage = 0x06; d[0].dwFlags = RIDEV_INPUTSINK; d[0].hwndTarget = w.Handle;   // tastiere
        d[1].usUsagePage = 0x01; d[1].usUsage = 0x02; d[1].dwFlags = RIDEV_INPUTSINK; d[1].hwndTarget = w.Handle;   // mouse
        d[2].usUsagePage = 0x0C; d[2].usUsage = 0x01; d[2].dwFlags = RIDEV_INPUTSINK; d[2].hwndTarget = w.Handle;   // consumer
        uint structSize = (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE));
        int error = RegisterRawInputDevices(d, 3, structSize) ? 0 : Marshal.GetLastWin32Error();
        // attende un messaggio (WM_INPUT incluso) senza dormire: l'evento viene letto subito, non al "tick" successivo
        while (error == 0 && !shouldStop()) { MsgWaitForMultipleObjects(0, null, false, 50, QS_ALLINPUT); Application.DoEvents(); }
        for (int i = 0; i < 3; i++) { d[i].dwFlags = RIDEV_REMOVE; d[i].hwndTarget = IntPtr.Zero; }
        RegisterRawInputDevices(d, 3, structSize);
        w.DestroyHandle();
        return error;
    }
}
