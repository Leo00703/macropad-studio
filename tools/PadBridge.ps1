# Ponte locale (Windows PowerShell 5.1): pubblica SOLO gli eventi del macropad su http://127.0.0.1:<porta>/events
# (Server-Sent Events), così la pagina dell'app può mostrare la vista in tempo reale anche in background.
#
# SICUREZZA E PRIVACY
#   - Ascolta solo su 127.0.0.1 (non raggiungibile da altri computer) e accetta solo l'origine della pagina dell'app
#     (http://localhost:5173 / http://127.0.0.1:5173) e solo richieste con Host locale.
#   - Raw Input in modalità PASSIVA (RIDEV_INPUTSINK): non blocca né modifica gli eventi, nessun hook, nessun driver.
#   - Lo stato del collegamento (USB / wireless) si ricava dall'elenco dei dispositivi di input di Windows: per ognuno si
#     controlla SOLO se il nome contiene i marcatori del macropad; il nome degli altri non viene conservato né inviato.
#   - Gli eventi di OGNI dispositivo che non sia il macropad (percorso senza "VID_1189" né il suo indirizzo BLE)
#     sono SCARTATI SUBITO, prima di leggerne il contenuto: nessuna digitazione della tua tastiera passa di qui.
#   - Nessun file scritto. Si ferma con Ctrl+C o chiudendo la finestra (oppure dopo -Seconds, se > 0).
#
# AZIONI ESEGUITE DAL PC (novità, versione 3)
#   Media e mouse non possono portare la firma F13–F21, quindi quando la stessa azione è su più controlli il pad invia
#   solo la firma e l'azione la esegue questo ponte. La mappa "firma → azione" arriva dalla pagina dell'app con
#   POST /hostmap, accettato SOLO con Origin http://localhost:5173 (o 127.0.0.1:5173), e resta in memoria.
#   Il controllo viene riconosciuto dalla firma F13–F21 (USB) oppure da un usage consumer riservato (USB e Bluetooth).
#   Il ponte può eseguire soltanto: un tasto multimediale/browser (VK 0xA6–0xB7: volume, muto, play/pausa, traccia,
#   calcolatrice…), un "tick" di rotella (±120, con Ctrl/Maiusc/Alt) o un clic del mouse. Nient'altro, e solo quando
#   la firma arriva da un evento del macropad. Per disattivare: togli "Media e mouse duplicati eseguiti dal PC" nel
#   configuratore, oppure avvia il ponte con -NoHost.
param(
  [int]$Port = 5174,
  [int]$Seconds = 0,
  [string[]]$PadMarkers = @('VID_1189'),
  [string]$BleAddress = '',
  [string[]]$AllowedOrigins = @('http://localhost:5173', 'http://127.0.0.1:5173'),
  [switch]$NoHost,
  [switch]$CompileOnly
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$src = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

public static class PadBridge
{
    public static volatile bool Stopped = false;
    public static int PadEvents = 0, OtherEvents = 0, ClientCount = 0;
    static string[] markers = new string[0];
    static string[] origins = new string[0];
    static HttpListener listener;
    static readonly List<HttpListenerResponse> clients = new List<HttpListenerResponse>();
    static readonly object gate = new object();
    static Dictionary<IntPtr, string> names = new Dictionary<IntPtr, string>();
    static Dictionary<IntPtr, bool> isPad = new Dictionary<IntPtr, bool>();
    static int lastUsage = 0;
    // azioni eseguite dal PC: mappa firma (due tasti F13–F21) → azione, ricevuta dalla pagina con POST /hostmap
    class HostEntry { public int s0, s1, u; public string k; public int vk, d, m, b, repD, repR; }
    static volatile HostEntry[] hostMap = new HostEntry[0];
    public static int HostEntries = 0, HostRuns = 0;
    public static bool HostEnabled = true;
    static volatile int repeatToken = 0;
    static int sigVk = 0;
    static double sigAt = 0;
    [DllImport("user32.dll")]
    static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll")]
    static extern void mouse_event(uint flags, uint dx, uint dy, int data, UIntPtr extra);
    // Orologio ad alta risoluzione (QueryPerformanceCounter): DateTime.UtcNow ha passi di ~15,6 ms e farebbe
    // sembrare "in istanti diversi" una rotazione che dura 2 ms. Serve per distinguere rotazione e pressione.
    static readonly Stopwatch clock = Stopwatch.StartNew();

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
    [StructLayout(LayoutKind.Sequential)]
    struct RAWINPUTDEVICELIST { public IntPtr hDevice; public uint dwType; }
    [DllImport("user32.dll")]
    static extern uint GetRawInputDeviceList(IntPtr list, ref uint num, uint size);
    public static int LinkUsb = -1, LinkBle = -1;          // -1 sconosciuto, 0 assente, 1 presente
    [DllImport("user32.dll")]
    static extern uint MsgWaitForMultipleObjects(uint count, IntPtr[] handles, bool waitAll, uint ms, uint mask);

    class MsgWin : NativeWindow
    {
        public MsgWin() { CreateParams cp = new CreateParams(); cp.Parent = new IntPtr(-3); CreateHandle(cp); }
        protected override void WndProc(ref Message m)
        {
            if (m.Msg == 0x00FF) PadBridge.OnInput(m.LParam);
            base.WndProc(ref m);
        }
    }

    // millisecondi dall'avvio del ponte, con decimali (solo le differenze hanno significato)
    static string Now() { return clock.Elapsed.TotalMilliseconds.ToString("0.00", CultureInfo.InvariantCulture); }

    static string DeviceName(IntPtr h)
    {
        string n;
        if (names.TryGetValue(h, out n)) return n;
        uint size = 0;
        GetRawInputDeviceInfo(h, 0x20000007, null, ref size);
        StringBuilder sb = new StringBuilder((int)Math.Max(size, 1));
        GetRawInputDeviceInfo(h, 0x20000007, sb, ref size);
        n = sb.ToString();
        names[h] = n;
        return n;
    }

    static bool IsPad(IntPtr h)
    {
        bool r;
        if (isPad.TryGetValue(h, out r)) return r;
        string n = DeviceName(h).ToUpperInvariant();
        r = false;
        foreach (string m in markers) { if (m.Length > 0 && n.Contains(m.ToUpperInvariant())) r = true; }
        isPad[h] = r;
        return r;
    }

    static string Dev(IntPtr h)
    {
        string p = DeviceName(h).ToUpperInvariant();
        int i = p.IndexOf("COL");
        return i >= 0 ? p.Substring(i, Math.Min(5, p.Length - i)) : "";
    }

    static void OnInput(IntPtr lParam)
    {
        uint size = 0, hdr = (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER));
        GetRawInputData(lParam, 0x10000003, IntPtr.Zero, ref size, hdr);
        if (size == 0) return;
        IntPtr buf = Marshal.AllocHGlobal((int)size);
        try
        {
            if (GetRawInputData(lParam, 0x10000003, buf, ref size, hdr) != size) return;
            uint type = (uint)Marshal.ReadInt32(buf, 0);
            IntPtr dev = Marshal.ReadIntPtr(buf, 8);
            // FILTRO DI PRIVACY: si decide prima di leggere qualsiasi contenuto
            if (!IsPad(dev)) { OtherEvents++; return; }
            PadEvents++;
            int off = (int)hdr;
            string d = Dev(dev);
            if (type == 1)
            {
                ushort make = (ushort)Marshal.ReadInt16(buf, off + 0);
                ushort flags = (ushort)Marshal.ReadInt16(buf, off + 2);
                ushort vkey = (ushort)Marshal.ReadInt16(buf, off + 6);
                bool kdown = (flags & 1) == 0;
                Send("{\"type\":\"key\",\"vk\":" + vkey + ",\"sc\":" + make + ",\"down\":" + (kdown ? "true" : "false") + ",\"dev\":\"" + d + "\",\"t\":" + Now() + "}");
                if (kdown) HostKey(vkey);
            }
            else if (type == 0)
            {
                ushort bf = (ushort)Marshal.ReadInt16(buf, off + 4);
                short data = Marshal.ReadInt16(buf, off + 6);
                string t = Now();
                if ((bf & 0x0400) != 0) Send("{\"type\":\"wheel\",\"delta\":" + data + ",\"dev\":\"" + d + "\",\"t\":" + t + "}");
                if ((bf & 0x0001) != 0) Send(Btn("left", true, d, t));
                if ((bf & 0x0002) != 0) Send(Btn("left", false, d, t));
                if ((bf & 0x0004) != 0) Send(Btn("right", true, d, t));
                if ((bf & 0x0008) != 0) Send(Btn("right", false, d, t));
                if ((bf & 0x0010) != 0) Send(Btn("middle", true, d, t));
                if ((bf & 0x0020) != 0) Send(Btn("middle", false, d, t));
            }
            else
            {
                uint szHid = (uint)Marshal.ReadInt32(buf, off + 0);
                uint cnt = (uint)Marshal.ReadInt32(buf, off + 4);
                int n = (int)Math.Min(szHid * cnt, 16);
                if (n >= 3)
                {
                    byte[] b = new byte[n];
                    Marshal.Copy(IntPtr.Add(buf, off + 8), b, 0, n);
                    int usage = b[1] | (b[2] << 8);       // consumer control: [ID, lo, hi]
                    bool down = usage != 0;
                    if (down) lastUsage = usage;
                    Send("{\"type\":\"media\",\"usage\":" + lastUsage + ",\"down\":" + (down ? "true" : "false") + ",\"dev\":\"" + d + "\",\"t\":" + Now() + "}");
                    if (down) HostUsage(usage); else StopRepeat();
                }
            }
        }
        finally { Marshal.FreeHGlobal(buf); }
    }

    // due tasti F13–F21 pressi in rapida successione = firma di un controllo; se è nella mappa si esegue l'azione
    static void HostKey(int vk)
    {
        if (!HostEnabled) return;
        if (vk < 124 || vk > 132) { sigVk = 0; return; }
        double now = clock.Elapsed.TotalMilliseconds;
        if (sigVk != 0 && now - sigAt <= 40)
        {
            int first = sigVk;
            sigVk = 0;
            HostEntry[] map = hostMap;
            for (int i = 0; i < map.Length; i++)
            {
                if (map[i].s0 == first && map[i].s1 == vk) { Execute(map[i]); break; }
            }
        }
        else { sigVk = vk; sigAt = now; }
    }

    // identità "sensore": un usage consumer riservato per controllo (arriva anche in Bluetooth, dove la firma F13–F21 no)
    static void HostUsage(int usage)
    {
        if (!HostEnabled) return;
        HostEntry[] map = hostMap;
        for (int i = 0; i < map.Length; i++)
        {
            if (map[i].u == usage && map[i].u != 0) { StopRepeat(); Execute(map[i]); StartRepeat(map[i]); break; }
        }
    }

    // ripetizione mentre il controllo è tenuto: parte dopo repD ms e ripete ogni repR ms finché arriva il rilascio
    // (usage 0), una nuova pressione o il ponte si ferma; tetto di sicurezza di 20 s se il rilascio andasse perso
    static void StopRepeat() { repeatToken++; }
    static void StartRepeat(HostEntry e)
    {
        if (e.repR <= 0) return;
        int tok = ++repeatToken;
        Thread t = new Thread(delegate ()
        {
            try
            {
                int waited = 0;
                while (waited < e.repD) { Thread.Sleep(10); waited += 10; if (tok != repeatToken || Stopped) return; }
                int total = 0;
                while (tok == repeatToken && !Stopped && total < 20000)
                {
                    Execute(e);
                    Thread.Sleep(e.repR);
                    total += e.repR;
                }
            }
            catch { }
        });
        t.IsBackground = true; t.Start();
    }

    static void Execute(HostEntry e)
    {
        HostRuns++;
        if (e.k == "key")
        {
            keybd_event((byte)e.vk, 0, 0x0001, UIntPtr.Zero);                 // KEYEVENTF_EXTENDEDKEY
            keybd_event((byte)e.vk, 0, 0x0003, UIntPtr.Zero);                 // + KEYEVENTF_KEYUP
        }
        else if (e.k == "wheel")
        {
            if ((e.m & 1) != 0) keybd_event(0x11, 0, 0, UIntPtr.Zero);
            if ((e.m & 2) != 0) keybd_event(0x10, 0, 0, UIntPtr.Zero);
            if ((e.m & 4) != 0) keybd_event(0x12, 0, 0, UIntPtr.Zero);
            mouse_event(0x0800, 0, 0, e.d, UIntPtr.Zero);                     // MOUSEEVENTF_WHEEL
            if ((e.m & 4) != 0) keybd_event(0x12, 0, 2, UIntPtr.Zero);
            if ((e.m & 2) != 0) keybd_event(0x10, 0, 2, UIntPtr.Zero);
            if ((e.m & 1) != 0) keybd_event(0x11, 0, 2, UIntPtr.Zero);
        }
        else if (e.k == "btn")
        {
            if ((e.b & 1) != 0) { mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero); mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero); }
            if ((e.b & 2) != 0) { mouse_event(0x0008, 0, 0, 0, UIntPtr.Zero); mouse_event(0x0010, 0, 0, 0, UIntPtr.Zero); }
            if ((e.b & 4) != 0) { mouse_event(0x0020, 0, 0, 0, UIntPtr.Zero); mouse_event(0x0040, 0, 0, 0, UIntPtr.Zero); }
        }
    }

    static int AsInt(object o) { return Convert.ToInt32(o, CultureInfo.InvariantCulture); }

    // valida e sostituisce la mappa; ogni voce fuori dalla lista bianca fa rifiutare l'intera mappa
    static string SetHostMap(string body)
    {
        if (!HostEnabled) return "{\"ok\":false,\"error\":\"disattivato\"}";
        try
        {
            JavaScriptSerializer ser = new JavaScriptSerializer();
            Dictionary<string, object> root = ser.DeserializeObject(body) as Dictionary<string, object>;
            System.Collections.IList arr = root != null && root.ContainsKey("entries") ? root["entries"] as System.Collections.IList : null;
            if (arr == null || arr.Count > 200) return "{\"ok\":false,\"error\":\"formato\"}";
            List<HostEntry> list = new List<HostEntry>();
            foreach (object o in arr)
            {
                Dictionary<string, object> d = o as Dictionary<string, object>;
                if (d == null) return "{\"ok\":false,\"error\":\"voce\"}";
                HostEntry e = new HostEntry();
                if (d.ContainsKey("u"))
                {
                    e.u = AsInt(d["u"]);                                   // usage consumer riservato (HUT: 0x07–0x1F, 0x49–0x5F, 0x67–0x7F)
                    bool okU = (e.u >= 0x07 && e.u <= 0x1F) || (e.u >= 0x49 && e.u <= 0x5F) || (e.u >= 0x67 && e.u <= 0x7F);
                    if (!okU) return "{\"ok\":false,\"error\":\"identita\"}";
                }
                else
                {
                    System.Collections.IList sg = d["s"] as System.Collections.IList;
                    if (sg == null || sg.Count != 2) return "{\"ok\":false,\"error\":\"firma\"}";
                    e.s0 = AsInt(sg[0]); e.s1 = AsInt(sg[1]);
                    if (e.s0 < 124 || e.s0 > 132 || e.s1 < 124 || e.s1 > 132) return "{\"ok\":false,\"error\":\"firma\"}";
                }
                e.k = d["k"] as string;
                if (e.k == "key") { e.vk = AsInt(d["vk"]); if (e.vk < 0xA6 || e.vk > 0xB7) return "{\"ok\":false,\"error\":\"tasto\"}"; }
                else if (e.k == "wheel")
                {
                    e.d = AsInt(d["d"]); e.m = AsInt(d["m"]);
                    if ((e.d != 120 && e.d != -120) || e.m < 0 || e.m > 7) return "{\"ok\":false,\"error\":\"rotella\"}";
                }
                else if (e.k == "btn") { e.b = AsInt(d["b"]); if (e.b < 1 || e.b > 7) return "{\"ok\":false,\"error\":\"pulsante\"}"; }
                else return "{\"ok\":false,\"error\":\"azione\"}";
                if (d.ContainsKey("rep"))
                {
                    Dictionary<string, object> rp = d["rep"] as Dictionary<string, object>;
                    if (rp == null || !rp.ContainsKey("d") || !rp.ContainsKey("r") || e.k == "btn") return "{\"ok\":false,\"error\":\"ripetizione\"}";
                    e.repD = AsInt(rp["d"]); e.repR = AsInt(rp["r"]);
                    if (e.repD < 100 || e.repD > 2000 || e.repR < 30 || e.repR > 500) return "{\"ok\":false,\"error\":\"ripetizione\"}";
                }
                list.Add(e);
            }
            hostMap = list.ToArray();
            HostEntries = list.Count;
            return "{\"ok\":true,\"entries\":" + list.Count + "}";
        }
        catch { return "{\"ok\":false,\"error\":\"json\"}"; }
    }

    // Il macropad è presente via USB (nome con VID_1189) e/o via Bluetooth (nome con il suo indirizzo)? Si guarda solo se il
    // nome contiene un marcatore: nessun nome viene salvato.
    static bool ScanLink()
    {
        uint n = 0, sz = (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICELIST));
        GetRawInputDeviceList(IntPtr.Zero, ref n, sz);
        int usb = 0, ble = 0;
        if (n > 0)
        {
            IntPtr buf = Marshal.AllocHGlobal((int)(n * sz));
            try
            {
                uint got = GetRawInputDeviceList(buf, ref n, sz);
                if (got != uint.MaxValue)
                {
                    for (int i = 0; i < (int)got; i++)
                    {
                        IntPtr h = Marshal.ReadIntPtr(buf, i * (int)sz);
                        uint size = 0;
                        GetRawInputDeviceInfo(h, 0x20000007, null, ref size);
                        if (size == 0) continue;
                        StringBuilder sb = new StringBuilder((int)size);
                        GetRawInputDeviceInfo(h, 0x20000007, sb, ref size);
                        string nm = sb.ToString().ToUpperInvariant();
                        if (markers.Length > 0 && markers[0].Length > 0 && nm.Contains(markers[0].ToUpperInvariant())) usb = 1;
                        for (int m = 1; m < markers.Length; m++) { if (markers[m].Length > 0 && nm.Contains(markers[m].ToUpperInvariant())) ble = 1; }
                    }
                }
            }
            finally { Marshal.FreeHGlobal(buf); }
        }
        bool changed = usb != LinkUsb || ble != LinkBle;
        LinkUsb = usb; LinkBle = ble;
        return changed;
    }
    static string LinkJson() { return "\"usb\":" + (LinkUsb == 1 ? "true" : "false") + ",\"ble\":" + (LinkBle == 1 ? "true" : "false"); }

    static string Btn(string b, bool down, string d, string t)
    {
        return "{\"type\":\"button\",\"button\":\"" + b + "\",\"down\":" + (down ? "true" : "false") + ",\"dev\":\"" + d + "\",\"t\":" + t + "}";
    }

    static void Write(HttpListenerResponse r, string text)
    {
        byte[] b = Encoding.UTF8.GetBytes(text);
        r.OutputStream.Write(b, 0, b.Length);
        r.OutputStream.Flush();
    }

    static void Send(string json)
    {
        string frame = "data: " + json + "\n\n";
        lock (gate)
        {
            for (int i = clients.Count - 1; i >= 0; i--)
            {
                try { Write(clients[i], frame); }
                catch { try { clients[i].Abort(); } catch { } clients.RemoveAt(i); }
            }
            ClientCount = clients.Count;
        }
    }

    static bool HostOk(HttpListenerRequest rq)
    {
        string h = (rq.Headers["Host"] ?? "").ToLowerInvariant();
        return h.StartsWith("127.0.0.1:") || h.StartsWith("localhost:");
    }

    static void Handle(HttpListenerContext ctx)
    {
        HttpListenerRequest rq = ctx.Request;
        HttpListenerResponse rs = ctx.Response;
        try
        {
            string origin = rq.Headers["Origin"];
            bool originOk = false;
            if (origin != null) foreach (string o in origins) { if (o == origin) originOk = true; }
            if (!HostOk(rq)) { rs.StatusCode = 403; rs.Close(); return; }
            if (originOk) rs.AddHeader("Access-Control-Allow-Origin", origin);
            rs.AddHeader("Cache-Control", "no-store");
            string path = rq.Url.AbsolutePath;
            if (path == "/health")
            {
                rs.ContentType = "application/json";
                byte[] b = Encoding.UTF8.GetBytes("{\"ok\":true,\"padEvents\":" + PadEvents + ",\"otherEventsDiscarded\":" + OtherEvents + ",\"clients\":" + ClientCount +
                    ",\"hostEntries\":" + HostEntries + ",\"hostRuns\":" + HostRuns + "," + LinkJson() + "}");
                rs.ContentLength64 = b.Length;
                rs.OutputStream.Write(b, 0, b.Length);
                rs.Close();
            }
            else if (path == "/hostmap" && rq.HttpMethod == "POST")
            {
                // solo la pagina dell'app (Origin verificato): accetta la mappa firma → azione da eseguire sul PC
                if (!originOk) { rs.StatusCode = 403; rs.Close(); return; }
                byte[] buf = new byte[65537];
                int n = 0, r;
                while (n < buf.Length && (r = rq.InputStream.Read(buf, n, buf.Length - n)) > 0) n += r;
                string res = n > 65536 ? "{\"ok\":false,\"error\":\"troppo grande\"}" : SetHostMap(Encoding.UTF8.GetString(buf, 0, n));
                rs.ContentType = "application/json";
                byte[] ob = Encoding.UTF8.GetBytes(res);
                rs.ContentLength64 = ob.Length;
                rs.OutputStream.Write(ob, 0, ob.Length);
                rs.Close();
            }
            else if (path == "/events")
            {
                if (origin != null && !originOk) { rs.StatusCode = 403; rs.Close(); return; }
                rs.ContentType = "text/event-stream";
                rs.SendChunked = true;
                rs.KeepAlive = true;
                Write(rs, "retry: 1500\n\nevent: hello\ndata: {\"bridge\":\"macropad-pad-bridge\",\"version\":3,\"precise\":true,\"link\":true,\"host\":" + (HostEnabled ? "true" : "false") + "," + LinkJson() + "}\n\n");
                lock (gate) { clients.Add(rs); ClientCount = clients.Count; }
                // la risposta resta aperta: la chiude il client o il battito di cuore se fallisce
            }
            else { rs.StatusCode = 404; rs.Close(); }
        }
        catch { try { rs.Abort(); } catch { } }
    }

    public static string Start(int port, int seconds, string[] padMarkers, string[] allowedOrigins)
    {
        markers = padMarkers;
        origins = allowedOrigins;
        try { ScanLink(); } catch { }
        listener = new HttpListener();
        listener.Prefixes.Add("http://127.0.0.1:" + port + "/");
        try { listener.Start(); }
        catch (Exception ex) { return "ERRORE: impossibile aprire la porta " + port + ": " + ex.Message; }

        Thread acceptor = new Thread(delegate ()
        {
            while (!Stopped)
            {
                try { HttpListenerContext c = listener.GetContext(); Handle(c); }
                catch { if (Stopped) break; }
            }
        });
        acceptor.IsBackground = true; acceptor.Start();

        Thread beat = new Thread(delegate ()
        {
            while (!Stopped) { Thread.Sleep(10000); Send2(": ping\n\n"); }
        });
        beat.IsBackground = true; beat.Start();

        Thread link = new Thread(delegate ()
        {
            while (!Stopped)
            {
                try { if (ScanLink()) Send("{\"type\":\"status\"," + LinkJson() + "}"); } catch { }
                Thread.Sleep(1500);
            }
        });
        link.IsBackground = true; link.Start();

        DateTime end = seconds > 0 ? DateTime.Now.AddSeconds(seconds) : DateTime.MaxValue;
        Thread raw = new Thread(delegate ()
        {
            MsgWin w = new MsgWin();
            RAWINPUTDEVICE[] d = new RAWINPUTDEVICE[3];
            d[0].usUsagePage = 0x01; d[0].usUsage = 0x06; d[0].dwFlags = 0x100; d[0].hwndTarget = w.Handle;
            d[1].usUsagePage = 0x01; d[1].usUsage = 0x02; d[1].dwFlags = 0x100; d[1].hwndTarget = w.Handle;
            d[2].usUsagePage = 0x0C; d[2].usUsage = 0x01; d[2].dwFlags = 0x100; d[2].hwndTarget = w.Handle;
            RegisterRawInputDevices(d, 3, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)));
            // attende un messaggio (WM_INPUT incluso) senza dormire: l'evento viene letto subito, non al "tick" successivo
            while (!Stopped && DateTime.Now < end) { MsgWaitForMultipleObjects(0, null, false, 50, 0x04FF); Application.DoEvents(); }
            for (int i = 0; i < 3; i++) { d[i].dwFlags = 0x1; d[i].hwndTarget = IntPtr.Zero; }
            RegisterRawInputDevices(d, 3, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)));
            w.DestroyHandle();
            Stopped = true;
            try { listener.Stop(); } catch { }
        });
        raw.SetApartmentState(ApartmentState.STA);
        raw.IsBackground = true; raw.Start();
        return "OK";
    }

    static void Send2(string text)
    {
        lock (gate)
        {
            for (int i = clients.Count - 1; i >= 0; i--)
            {
                try { Write(clients[i], text); }
                catch { try { clients[i].Abort(); } catch { } clients.RemoveAt(i); }
            }
            ClientCount = clients.Count;
        }
    }
}
'@

Add-Type -TypeDefinition $src -ReferencedAssemblies System.Windows.Forms, System.dll, System.Web.Extensions
Write-Output 'Compilazione riuscita.'
if ($CompileOnly) { return }

# Wireless: l'indirizzo BLE del pad arriva da -BleAddress, da MACROPAD_BLE_ADDRESS o dalla ricerca per nome (solo il dispositivo "MINI_KEYBOARD").
# Senza indirizzo il ponte lavora solo in USB (marcatore VID_1189).
if (-not $BleAddress) { $BleAddress = $env:MACROPAD_BLE_ADDRESS }
if (-not $BleAddress) {
  $found = Get-PnpDevice -FriendlyName 'MINI_KEYBOARD' -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -match 'DEV_([0-9A-Fa-f]{12})' } | Select-Object -First 1
  if ($found -and $found.InstanceId -match 'DEV_([0-9A-Fa-f]{12})') { $BleAddress = $Matches[1] }
}
$BleAddress = ($BleAddress -replace '[^0-9A-Fa-f]', '')
if ($BleAddress.Length -eq 12) { $PadMarkers = @($PadMarkers) + $BleAddress.ToUpperInvariant() }
else { Write-Output 'Wireless: indirizzo BLE non trovato, il ponte vede solo il collegamento USB (usa -BleAddress per indicarlo).' }

[PadBridge]::HostEnabled = -not $NoHost
$r = [PadBridge]::Start($Port, $Seconds, $PadMarkers, $AllowedOrigins)
if ($r -ne 'OK') { Write-Output $r; return }
Write-Output ("Ponte attivo: http://127.0.0.1:{0}/events   (solo eventi con marcatori: {1})" -f $Port, ($PadMarkers -join ', '))
Write-Output 'Lascia questa finestra aperta mentre usi la vista live. Ctrl+C per fermare.'
$lastClients = -1
$lastHost = -1
if ([PadBridge]::HostEnabled) { Write-Output 'Azioni dal PC: attive (il ponte esegue solo tasti media/browser, rotella e clic della mappa ricevuta dalla pagina).' }
else { Write-Output 'Azioni dal PC: disattivate (-NoHost).' }
while (-not [PadBridge]::Stopped) {
  Start-Sleep -Milliseconds 500
  if ([PadBridge]::HostEntries -ne $lastHost) {
    $lastHost = [PadBridge]::HostEntries
    Write-Output ('[{0}] mappa azioni dal PC: {1} voci' -f (Get-Date -Format 'HH:mm:ss'), $lastHost)
  }
  if ([PadBridge]::ClientCount -ne $lastClients) {
    $lastClients = [PadBridge]::ClientCount
    Write-Output ('[{0}] pagine collegate: {1}' -f (Get-Date -Format 'HH:mm:ss'), $lastClients)
  }
}
Write-Output ('Terminato. Eventi del macropad inoltrati: {0}; eventi di altri dispositivi scartati: {1}; azioni dal PC eseguite: {2}' -f [PadBridge]::PadEvents, [PadBridge]::OtherEvents, [PadBridge]::HostRuns)
