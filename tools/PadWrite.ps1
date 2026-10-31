# Scrive sul macropad (via USB) i pacchetti di configurazione generati da tools/profile-frames.js.
# Equivale a "Invia layer" del configuratore: stessi pacchetti, stessa interfaccia vendor (pagina 0xFF00, report ID 3).
#
# SICUREZZA
#   - Senza -Write fa solo una PROVA A SECCO: elenca l'interfaccia trovata e i pacchetti, non scrive nulla.
#   - Con -Write serve anche -IUnderstand. Scrive solo configurazione (macro/LED) nella memoria del pad: non è un
#     aggiornamento del firmware e non può bloccarlo. La configurazione si riscrive in qualsiasi momento.
#   - Si apre SOLO il dispositivo VID_1189 PID_8833, interfaccia vendor 0xFF00.
param(
  [Parameter(Mandatory = $true)][string]$FramesFile,
  [switch]$Write,
  [switch]$IUnderstand,
  [ValidateRange(20, 5000)][int]$GapMs = 150,
  [int]$VendorId = 0x1189,
  [int]$ProductId = 0x8833
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$src = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32.SafeHandles;

public static class PadWrite
{
    [StructLayout(LayoutKind.Sequential)] struct SP_DEVICE_INTERFACE_DATA { public int cbSize; public Guid InterfaceClassGuid; public int Flags; public IntPtr Reserved; }
    [StructLayout(LayoutKind.Sequential)] struct HIDD_ATTRIBUTES { public int Size; public ushort VendorID; public ushort ProductID; public ushort VersionNumber; }
    [StructLayout(LayoutKind.Sequential)] struct HIDP_CAPS
    {
        public ushort Usage, UsagePage, InputReportByteLength, OutputReportByteLength, FeatureReportByteLength;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 17)] public ushort[] Reserved;
        public ushort NumberLinkCollectionNodes, NumberInputButtonCaps, NumberInputValueCaps, NumberInputDataIndices,
            NumberOutputButtonCaps, NumberOutputValueCaps, NumberOutputDataIndices, NumberFeatureButtonCaps,
            NumberFeatureValueCaps, NumberFeatureDataIndices;
    }

    [DllImport("hid.dll")] static extern void HidD_GetHidGuid(out Guid g);
    [DllImport("hid.dll")] static extern bool HidD_GetAttributes(SafeFileHandle h, ref HIDD_ATTRIBUTES a);
    [DllImport("hid.dll")] static extern bool HidD_GetPreparsedData(SafeFileHandle h, out IntPtr p);
    [DllImport("hid.dll")] static extern bool HidD_FreePreparsedData(IntPtr p);
    [DllImport("hid.dll")] static extern int HidP_GetCaps(IntPtr p, ref HIDP_CAPS c);
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode)] static extern IntPtr SetupDiGetClassDevs(ref Guid g, string enumerator, IntPtr hwnd, uint flags);
    [DllImport("setupapi.dll")] static extern bool SetupDiEnumDeviceInterfaces(IntPtr h, IntPtr devInfo, ref Guid g, uint idx, ref SP_DEVICE_INTERFACE_DATA d);
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode)] static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr h, ref SP_DEVICE_INTERFACE_DATA d, IntPtr detail, uint size, out uint req, IntPtr devInfo);
    [DllImport("setupapi.dll")] static extern bool SetupDiDestroyDeviceInfoList(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr tmpl);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool WriteFile(SafeFileHandle h, byte[] buf, uint n, out uint written, IntPtr ov);

    public class Iface { public string Path; public ushort UsagePage, Usage, OutLen, InLen; }

    public static List<Iface> Find(int vid, int pid)
    {
        List<Iface> res = new List<Iface>();
        Guid g; HidD_GetHidGuid(out g);
        IntPtr set = SetupDiGetClassDevs(ref g, null, IntPtr.Zero, 0x12);   // DIGCF_PRESENT | DIGCF_DEVICEINTERFACE
        if (set == (IntPtr)(-1)) return res;
        try
        {
            for (uint i = 0; ; i++)
            {
                SP_DEVICE_INTERFACE_DATA d = new SP_DEVICE_INTERFACE_DATA();
                d.cbSize = Marshal.SizeOf(typeof(SP_DEVICE_INTERFACE_DATA));
                if (!SetupDiEnumDeviceInterfaces(set, IntPtr.Zero, ref g, i, ref d)) break;
                uint req;
                SetupDiGetDeviceInterfaceDetail(set, ref d, IntPtr.Zero, 0, out req, IntPtr.Zero);
                IntPtr buf = Marshal.AllocHGlobal((int)req);
                try
                {
                    Marshal.WriteInt32(buf, IntPtr.Size == 8 ? 8 : 6);
                    if (!SetupDiGetDeviceInterfaceDetail(set, ref d, buf, req, out req, IntPtr.Zero)) continue;
                    string path = Marshal.PtrToStringUni(IntPtr.Add(buf, 4));
                    string low = path.ToLowerInvariant();
                    // filtro PRIMA di aprire qualsiasi cosa: solo il pad
                    if (low.IndexOf("vid_" + vid.ToString("x4")) < 0 || low.IndexOf("pid_" + pid.ToString("x4")) < 0) continue;
                    using (SafeFileHandle h = CreateFile(path, 0, 3, IntPtr.Zero, 3, 0, IntPtr.Zero))   // accesso 0: solo interrogazione
                    {
                        if (h.IsInvalid) continue;
                        IntPtr pp;
                        if (!HidD_GetPreparsedData(h, out pp)) continue;
                        HIDP_CAPS caps = new HIDP_CAPS();
                        HidP_GetCaps(pp, ref caps);
                        HidD_FreePreparsedData(pp);
                        res.Add(new Iface { Path = path, UsagePage = caps.UsagePage, Usage = caps.Usage, OutLen = caps.OutputReportByteLength, InLen = caps.InputReportByteLength });
                    }
                }
                finally { Marshal.FreeHGlobal(buf); }
            }
        }
        finally { SetupDiDestroyDeviceInfoList(set); }
        return res;
    }

    // frames: ogni elemento = 64 byte di payload; si antepone il report ID 3 (65 byte totali).
    public static string Send(string path, List<byte[]> frames, int gapMs, List<string> log)
    {
        using (SafeFileHandle h = CreateFile(path, 0xC0000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero))   // GENERIC_READ | GENERIC_WRITE
        {
            if (h.IsInvalid) return "apertura fallita (errore " + Marshal.GetLastWin32Error() + ")";
            int n = 0;
            foreach (byte[] p in frames)
            {
                byte[] buf = new byte[65];
                buf[0] = 3;
                Array.Copy(p, 0, buf, 1, 64);
                uint w;
                if (!WriteFile(h, buf, 65, out w, IntPtr.Zero)) return "scrittura fallita al pacchetto " + (n + 1) + " (errore " + Marshal.GetLastWin32Error() + ")";
                n++;
                log.Add("  " + n + "/" + frames.Count + " inviato (" + w + " byte)");
                Thread.Sleep(gapMs);
            }
            return "OK";
        }
    }
}
'@
Add-Type -TypeDefinition $src -ReferencedAssemblies System.dll
Write-Output 'Compilazione riuscita.'

$ifs = [PadWrite]::Find($VendorId, $ProductId)
if ($ifs.Count -eq 0) { Write-Output ('ERRORE: nessuna interfaccia HID trovata per VID_{0:X4} PID_{1:X4}. Il macropad è collegato via USB?' -f $VendorId, $ProductId); exit 1 }
Write-Output ('Interfacce HID del pad: {0}' -f $ifs.Count)
foreach ($i in $ifs) { Write-Output ('  pagina 0x{0:X4} uso 0x{1:X4}  out {2} B  in {3} B   {4}' -f $i.UsagePage, $i.Usage, $i.OutLen, $i.InLen, $i.Path) }
$cfg = $ifs | Where-Object { $_.UsagePage -eq 0xFF00 -and $_.OutLen -eq 65 } | Select-Object -First 1
if (-not $cfg) { Write-Output 'ERRORE: interfaccia di configurazione (pagina 0xFF00, report 64 B) non trovata.'; exit 1 }
Write-Output ('Interfaccia di configurazione: {0}' -f $cfg.Path)

$json = Get-Content -Raw -Encoding UTF8 -LiteralPath $FramesFile | ConvertFrom-Json
$frames = New-Object 'System.Collections.Generic.List[byte[]]'
if (-not $json.frames -or @($json.frames).Count -eq 0) { Write-Output 'ERRORE: il file non contiene pacchetti (campo "frames").'; exit 1 }
foreach ($f in $json.frames) {
  if ($f.hex -notmatch '^([0-9A-Fa-f]{2} ?)+$') { Write-Output ('ERRORE: pacchetto "{0}" con esadecimale non valido' -f $f.label); exit 1 }
  $b = [byte[]]($f.hex -split ' ' | ForEach-Object { [Convert]::ToByte($_, 16) })
  if ($b.Length -ne 64) { Write-Output ('ERRORE: pacchetto "{0}" lungo {1} byte, attesi 64' -f $f.label, $b.Length); exit 1 }
  if ($b[0] -ne 0xFE) { Write-Output ('ERRORE: pacchetto "{0}" non inizia con 0xFE' -f $f.label); exit 1 }
  $frames.Add($b)
}
Write-Output ('Pacchetti da inviare: {0}   (opzioni: firma={1})' -f $frames.Count, $json.options.signature)
if (-not $Write) {
  Write-Output 'PROVA A SECCO: nessuna scrittura. Elenco:'
  foreach ($f in $json.frames) { Write-Output ('  {0}   {1} …' -f $f.label, ($f.hex.Substring(0, 35))) }
  Write-Output 'Per scrivere davvero: aggiungi -Write -IUnderstand.'
  exit 0
}
if (-not $IUnderstand) { Write-Output 'Con -Write serve anche -IUnderstand (scrive la configurazione nella memoria del pad).'; exit 1 }
$log = New-Object 'System.Collections.Generic.List[string]'
$r = [PadWrite]::Send($cfg.Path, $frames, $GapMs, $log)
foreach ($l in $log) { Write-Output $l }
Write-Output ('Esito: {0}' -f $r)
if ($r -ne 'OK') { exit 1 }
