# Prototipo Raw Input (Windows PowerShell 5.1): distingue gli eventi del macropad da quelli di tastiera/mouse del PC.
#
# PRIVACY E SICUREZZA (leggere prima di eseguire)
#   - È un monitor PASSIVO: registra la ricezione di Raw Input con RIDEV_INPUTSINK, non blocca né modifica nulla;
#     gli altri programmi ricevono gli eventi come sempre. Non installa hook né driver.
#   - Gli eventi di QUALUNQUE dispositivo che non sia il macropad (percorso senza "VID_1189" né il suo indirizzo BLE)
#     vengono SCARTATI SUBITO: si incrementa un contatore, il contenuto non viene letto né mostrato né salvato.
#   - Dura -Seconds (predefinito 45) e poi termina da solo. Nessun file scritto.
param(
  [int]$Seconds = 45,
  [switch]$CompileOnly,
  [string[]]$PadMarkers = @('VID_1189'),
  [string]$BleAddress = ''
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$src = @'
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

public static class RawPad
{
    public static readonly ConcurrentQueue<string> Lines = new ConcurrentQueue<string>();
    public static int PadEvents = 0, OtherEvents = 0;
    static string[] markers = new string[0];
    static Dictionary<IntPtr, string> names = new Dictionary<IntPtr, string>();
    static Dictionary<IntPtr, bool> isPad = new Dictionary<IntPtr, bool>();
    static Dictionary<string, int> padPaths = new Dictionary<string, int>();
    static readonly Stopwatch clock = Stopwatch.StartNew();   // alta risoluzione: DateTime.Now avanza a passi di ~15,6 ms

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

    class MsgWin : NativeWindow
    {
        public MsgWin()
        {
            CreateParams cp = new CreateParams();
            cp.Parent = new IntPtr(-3);            // HWND_MESSAGE: finestra invisibile solo per i messaggi
            CreateHandle(cp);
        }
        protected override void WndProc(ref Message m)
        {
            if (m.Msg == 0x00FF) RawPad.OnInput(m.LParam);   // WM_INPUT
            base.WndProc(ref m);
        }
    }

    static string DeviceName(IntPtr h)
    {
        string n;
        if (names.TryGetValue(h, out n)) return n;
        uint size = 0;
        GetRawInputDeviceInfo(h, 0x20000007, null, ref size);   // RIDI_DEVICENAME
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

    static string Short(string path)
    {
        string p = path.ToUpperInvariant();
        int i = p.IndexOf("MI_");
        if (i >= 0) return p.Substring(i, Math.Min(16, p.Length - i));
        i = p.IndexOf("COL");
        return i >= 0 ? p.Substring(i, Math.Min(5, p.Length - i)) : "?";
    }

    static void OnInput(IntPtr lParam)
    {
        uint size = 0, hdr = (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER));
        GetRawInputData(lParam, 0x10000003, IntPtr.Zero, ref size, hdr);     // RID_INPUT
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
            string where = Short(DeviceName(dev));
            if (!padPaths.ContainsKey(where)) padPaths[where] = 0;
            padPaths[where]++;
            int off = (int)hdr;
            string t = clock.Elapsed.TotalMilliseconds.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture).PadLeft(9) + " ms";
            if (type == 1)          // tastiera
            {
                ushort make = (ushort)Marshal.ReadInt16(buf, off + 0);
                ushort flags = (ushort)Marshal.ReadInt16(buf, off + 2);
                ushort vkey = (ushort)Marshal.ReadInt16(buf, off + 6);
                string name = Enum.IsDefined(typeof(Keys), (int)vkey) ? ((Keys)vkey).ToString() : "0x" + vkey.ToString("X2");
                Lines.Enqueue(t + "  TASTIERA  " + ((flags & 1) != 0 ? "rilascio" : "pressione") + "  " + name + "  (scancode 0x" + make.ToString("X2") + ")  [" + where + "]");
            }
            else if (type == 0)     // mouse
            {
                ushort bf = (ushort)Marshal.ReadInt16(buf, off + 4);
                short data = Marshal.ReadInt16(buf, off + 6);
                if ((bf & 0x0400) != 0) Lines.Enqueue(t + "  MOUSE     rotella " + (data > 0 ? "su" : "giu") + " (" + data + ")  [" + where + "]");
                else if (bf != 0) Lines.Enqueue(t + "  MOUSE     pulsanti 0x" + bf.ToString("X4") + "  [" + where + "]");
            }
            else                    // HID generico (es. consumer control)
            {
                uint szHid = (uint)Marshal.ReadInt32(buf, off + 0);
                uint cnt = (uint)Marshal.ReadInt32(buf, off + 4);
                int n = (int)Math.Min(szHid * cnt, 16);
                byte[] b = new byte[n];
                Marshal.Copy(IntPtr.Add(buf, off + 8), b, 0, n);
                Lines.Enqueue(t + "  HID       " + BitConverter.ToString(b).Replace('-', ' ') + "  [" + where + "]");
            }
        }
        finally { Marshal.FreeHGlobal(buf); }
    }

    public static string Summary()
    {
        StringBuilder sb = new StringBuilder();
        foreach (KeyValuePair<string, int> kv in padPaths) sb.Append("  " + kv.Key + ": " + kv.Value + " eventi\n");
        return sb.ToString();
    }

    public static void Run(int seconds, string[] padMarkers)
    {
        markers = padMarkers;
        DateTime end = DateTime.Now.AddSeconds(seconds);
        Thread t = new Thread(delegate ()
        {
            MsgWin w = new MsgWin();
            RAWINPUTDEVICE[] d = new RAWINPUTDEVICE[3];
            d[0].usUsagePage = 0x01; d[0].usUsage = 0x06; d[0].dwFlags = 0x100; d[0].hwndTarget = w.Handle;   // tastiere
            d[1].usUsagePage = 0x01; d[1].usUsage = 0x02; d[1].dwFlags = 0x100; d[1].hwndTarget = w.Handle;   // mouse
            d[2].usUsagePage = 0x0C; d[2].usUsage = 0x01; d[2].dwFlags = 0x100; d[2].hwndTarget = w.Handle;   // consumer
            if (!RegisterRawInputDevices(d, 3, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE))))
                Lines.Enqueue("ERRORE: RegisterRawInputDevices fallita, codice " + Marshal.GetLastWin32Error());
            while (DateTime.Now < end) { MsgWaitForMultipleObjects(0, null, false, 50, 0x04FF); Application.DoEvents(); }
            // si annulla la registrazione
            for (int i = 0; i < 3; i++) { d[i].dwFlags = 0x1; d[i].hwndTarget = IntPtr.Zero; }   // RIDEV_REMOVE
            RegisterRawInputDevices(d, 3, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)));
            w.DestroyHandle();
            Lines.Enqueue("__FINE__");
        });
        t.SetApartmentState(ApartmentState.STA);
        t.IsBackground = true;
        t.Start();
    }
}
'@

Add-Type -TypeDefinition $src -ReferencedAssemblies System.Windows.Forms, System.dll
Write-Output 'Compilazione riuscita.'
if ($CompileOnly) { return }

# Wireless: l'indirizzo BLE del pad arriva da -BleAddress, da MACROPAD_BLE_ADDRESS o dalla ricerca per nome (lib\PadDevice.ps1).
# Senza indirizzo si lavora solo in USB (marcatore VID_1189).
. (Join-Path $PSScriptRoot 'lib\PadDevice.ps1')
$BleAddress = Resolve-PadBleAddress $BleAddress
if ($BleAddress) { $PadMarkers = @($PadMarkers) + $BleAddress }
else { Write-Output 'Wireless: indirizzo BLE non trovato, il ponte vede solo il collegamento USB (usa -BleAddress per indicarlo).' }
Write-Output ("In ascolto per {0} s. Solo gli eventi del macropad (marcatori: {1}) vengono mostrati; gli altri sono solo contati." -f $Seconds, ($PadMarkers -join ', '))
[RawPad]::Run($Seconds, $PadMarkers)
$line = $null
$done = $false
while (-not $done) {
  while ([RawPad]::Lines.TryDequeue([ref]$line)) {
    if ($line -eq '__FINE__') { $done = $true; break }
    Write-Output $line
  }
  if (-not $done) { Start-Sleep -Milliseconds 50 }
}
Write-Output ''
Write-Output ('Eventi del macropad: {0}   ·   eventi di altri dispositivi (scartati, solo conteggio): {1}' -f [RawPad]::PadEvents, [RawPad]::OtherEvents)
Write-Output 'Interfacce del macropad viste:'
Write-Output ([RawPad]::Summary())
