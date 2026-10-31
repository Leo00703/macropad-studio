# Prototipo Raw Input (Windows PowerShell 5.1): distingue gli eventi del macropad da quelli di tastiera/mouse del PC.
#
# PRIVACY E SICUREZZA (leggere prima di eseguire)
#   - È un monitor PASSIVO: registra la ricezione di Raw Input con RIDEV_INPUTSINK, non blocca né modifica nulla;
#     gli altri programmi ricevono gli eventi come sempre. Non installa hook né driver.
#   - Gli eventi di QUALUNQUE dispositivo che non sia il macropad (percorso senza "VID_1189" né il suo indirizzo BLE)
#     vengono SCARTATI SUBITO: si incrementa un contatore, il contenuto non viene letto né mostrato né salvato.
#   - Dura -Seconds (predefinito 45) e poi termina da solo. Nessun file scritto.
param(
  [ValidateRange(1, 3600)][int]$Seconds = 45,
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
    static string[] markers = new string[0];
    static Dictionary<string, int> padPaths = new Dictionary<string, int>();
    static readonly Stopwatch clock = Stopwatch.StartNew();   // alta risoluzione: DateTime.Now avanza a passi di ~15,6 ms

    static string Short(string path)
    {
        string p = path.ToUpperInvariant();
        int i = p.IndexOf("MI_");
        if (i >= 0) return p.Substring(i, Math.Min(16, p.Length - i));
        i = p.IndexOf("COL");
        return i >= 0 ? p.Substring(i, Math.Min(5, p.Length - i)) : "?";
    }

    // evento del macropad già filtrato da RawInput (gli altri dispositivi sono stati scartati senza leggerne il contenuto)
    static void HandleInput(uint type, IntPtr dev, IntPtr buf, int off)
    {
        string where = Short(RawInput.DeviceName(dev));
        if (!padPaths.ContainsKey(where)) padPaths[where] = 0;
        padPaths[where]++;
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

    public static string Summary()
    {
        StringBuilder sb = new StringBuilder();
        foreach (KeyValuePair<string, int> kv in padPaths) sb.Append("  " + kv.Key + ": " + kv.Value + " eventi\n");
        return sb.ToString();
    }

    public static void Run(int seconds, string[] padMarkers)
    {
        RawInput.Markers = padMarkers;
        RawInput.OnPadInput = HandleInput;
        DateTime end = DateTime.Now.AddSeconds(seconds);
        Thread t = new Thread(delegate ()
        {
            int error = RawInput.Listen(() => DateTime.Now >= end);
            if (error != 0) Lines.Enqueue("ERRORE: RegisterRawInputDevices fallita, codice " + error);
            Lines.Enqueue("__FINE__");
        });
        t.SetApartmentState(ApartmentState.STA);
        t.IsBackground = true;
        t.Start();
    }
}
'@

$core = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'lib\RawInput.cs')
Add-Type -TypeDefinition ($src + "`n" + $core) -ReferencedAssemblies System.Windows.Forms, System.dll
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
Write-Output ('Eventi del macropad: {0}   ·   eventi di altri dispositivi (scartati, solo conteggio): {1}' -f [RawInput]::PadEvents, [RawInput]::OtherEvents)
Write-Output 'Interfacce del macropad viste:'
Write-Output ([RawPad]::Summary())
