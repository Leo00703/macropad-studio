# INVIO di UN frame di prova alla caratteristica AE41 del macropad e ascolto di AE42 (Windows PowerShell 5.1).
# ATTENZIONE: questo è l'unico script del progetto che SCRIVE sul dispositivo via Bluetooth.
# Barriere di sicurezza:
#   - richiede -IUnderstand (esplicito);
#   - per impostazione predefinita accetta SOLO frame LED (ID 0xB0, tipo 0x08), reversibili e senza effetti sulle macro;
#   - massimo 61 byte (payload ATT con MTU 64);
#   - un solo frame per esecuzione; poi ascolta le notifiche per -ListenSeconds e si disiscrive.
# Esempio (LED layer 1, viola=7, modo 1) senza prefisso:  -Frame 'FE B0 01 08 00 00 00 00 00 01 01 71' -IUnderstand
param(
  [Parameter(Mandatory = $true)][string]$Frame,
  [int]$ListenSeconds = 4,
  [switch]$IUnderstand,
  [switch]$AllowNonLed,
  [switch]$CompileOnly,
  [string]$Address = ''
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$bytes = @($Frame -split '[\s,-]+' | Where-Object { $_ } | ForEach-Object { [Convert]::ToByte($_, 16) })
$led = $false
for ($o = 0; $o -le 1 -and $o -lt $bytes.Count; $o++) { if ($bytes.Count -ge ($o + 4) -and $bytes[$o] -eq 0xFE -and $bytes[$o + 1] -eq 0xB0 -and $bytes[$o + 3] -eq 0x08) { $led = $true } }
if ($bytes.Count -lt 1 -or $bytes.Count -gt 61) { Write-Output ('RIFIUTATO: lunghezza {0} fuori da 1..61 byte' -f $bytes.Count); return }
if (-not $CompileOnly) {
  if (-not $IUnderstand) { Write-Output 'RIFIUTATO: manca -IUnderstand (questo script scrive sul dispositivo).'; return }
  if (-not $led -and -not $AllowNonLed) { Write-Output 'RIFIUTATO: il frame non è un frame LED (FE B0 <layer> 08 ...). Usa -AllowNonLed solo di proposito.'; return }
}

$src = @'
using System;
using System.Collections.Concurrent;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Storage.Streams;

public static class BleSendProbe
{
    public static readonly ConcurrentQueue<string> Lines = new ConcurrentQueue<string>();
    static BluetoothLEDevice dev;
    static GattDeviceService svc;
    static GattCharacteristic wch, nch;
    static object token;

    static T Wait<T>(Windows.Foundation.IAsyncOperation<T> op, string step)
    {
        DateTime limit = DateTime.Now.AddSeconds(20);
        while (op.Status == Windows.Foundation.AsyncStatus.Started)
        {
            if (DateTime.Now > limit) throw new TimeoutException("timeout (20 s) al passo: " + step);
            System.Threading.Thread.Sleep(20);
        }
        if (op.Status != Windows.Foundation.AsyncStatus.Completed) throw new InvalidOperationException("passo '" + step + "' terminato con stato " + op.Status);
        return op.GetResults();
    }

    static string RunMta(Func<string> f)
    {
        string result = null;
        Exception err = null;
        System.Threading.Thread t = new System.Threading.Thread(delegate () { try { result = f(); } catch (Exception ex) { err = ex; } });
        t.SetApartmentState(System.Threading.ApartmentState.MTA);
        t.Start();
        t.Join();
        if (err != null) throw new InvalidOperationException(err.Message);
        return result;
    }

    public static string Start(ulong address)
    {
        return RunMta(delegate ()
        {
            Guid service = new Guid("0000ae40-0000-1000-8000-00805f9b34fb");
            Guid cw = new Guid("0000ae41-0000-1000-8000-00805f9b34fb");
            Guid cn = new Guid("0000ae42-0000-1000-8000-00805f9b34fb");
            dev = Wait(BluetoothLEDevice.FromBluetoothAddressAsync(address), "FromBluetoothAddress");
            if (dev == null) return "dispositivo non ottenuto";
            GattDeviceServicesResult sr = Wait(dev.GetGattServicesAsync(BluetoothCacheMode.Uncached), "GetGattServices");
            if (sr.Status != GattCommunicationStatus.Success) return "servizi: " + sr.Status;
            foreach (GattDeviceService s in sr.Services) { if (s.Uuid == service) svc = s; }
            if (svc == null) return "servizio AE40 non trovato";
            GattCharacteristicsResult cr = Wait(svc.GetCharacteristicsAsync(BluetoothCacheMode.Uncached), "GetCharacteristics");
            if (cr.Status != GattCommunicationStatus.Success) return "caratteristiche: " + cr.Status;
            foreach (GattCharacteristic c in cr.Characteristics) { if (c.Uuid == cw) wch = c; if (c.Uuid == cn) nch = c; }
            if (wch == null || nch == null) return "AE41/AE42 non trovate";
            Windows.Foundation.TypedEventHandler<GattCharacteristic, GattValueChangedEventArgs> handler =
                new Windows.Foundation.TypedEventHandler<GattCharacteristic, GattValueChangedEventArgs>(OnChanged);
            token = typeof(GattCharacteristic).GetMethod("add_ValueChanged").Invoke(nch, new object[] { handler });
            GattCommunicationStatus st = Wait(nch.WriteClientCharacteristicConfigurationDescriptorAsync(GattClientCharacteristicConfigurationDescriptorValue.Notify), "CCCD Notify");
            return "iscrizione a AE42: " + st;
        });
    }

    static void OnChanged(GattCharacteristic sender, GattValueChangedEventArgs e)
    {
        DataReader r = DataReader.FromBuffer(e.CharacteristicValue);
        byte[] b = new byte[r.UnconsumedBufferLength];
        r.ReadBytes(b);
        Lines.Enqueue(DateTime.Now.ToString("HH:mm:ss.fff") + "  [" + b.Length + " B]  " + BitConverter.ToString(b).Replace('-', ' '));
    }

    public static string Send(byte[] data)
    {
        return RunMta(delegate ()
        {
            DataWriter w = new DataWriter();
            w.WriteBytes(data);
            GattCommunicationStatus st = Wait(wch.WriteValueAsync(w.DetachBuffer(), GattWriteOption.WriteWithoutResponse), "Write AE41");
            return "scrittura su AE41 (" + data.Length + " B): " + st;
        });
    }

    public static string Stop()
    {
        return RunMta(delegate ()
        {
            string res = "stop: nessuna caratteristica attiva";
            if (nch != null)
            {
                try
                {
                    if (token != null) typeof(GattCharacteristic).GetMethod("remove_ValueChanged").Invoke(nch, new object[] { token });
                    res = "disiscrizione: " + Wait(nch.WriteClientCharacteristicConfigurationDescriptorAsync(GattClientCharacteristicConfigurationDescriptorValue.None), "CCCD None");
                }
                catch (Exception ex) { res = "disiscrizione: errore " + ex.Message; }
            }
            if (svc != null) svc.Dispose();
            if (dev != null) dev.Dispose();
            return res;
        });
    }
}
'@

$winmd  = Join-Path $env:WinDir 'System32\WinMetadata'
$facade = [System.Reflection.Assembly]::Load('System.Runtime, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a').Location
$wrt    = [System.Reflection.Assembly]::Load('System.Runtime.WindowsRuntime, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089').Location
$provider = New-Object Microsoft.CSharp.CSharpCodeProvider
$cp = New-Object System.CodeDom.Compiler.CompilerParameters
$cp.GenerateInMemory = $true
foreach ($r in @('mscorlib.dll', 'System.dll', $facade, $wrt, "$winmd\Windows.Foundation.winmd", "$winmd\Windows.Devices.winmd", "$winmd\Windows.Storage.winmd")) { [void]$cp.ReferencedAssemblies.Add($r) }
$out = $provider.CompileAssemblyFromSource($cp, $src)
if ($out.Errors.HasErrors) { $out.Errors | ForEach-Object { Write-Output ('ERRORE DI COMPILAZIONE: ' + $_.ToString()) }; return }
Write-Output 'Compilazione riuscita.'
if ($CompileOnly) { return }

$T = $out.CompiledAssembly.GetType('BleSendProbe')
$lines = $T.GetField('Lines').GetValue($null)
# Indirizzo BLE del pad: -Address, variabile MACROPAD_BLE_ADDRESS oppure ricerca per nome ("MINI_KEYBOARD") fra i dispositivi già associati.
if (-not $Address) { $Address = $env:MACROPAD_BLE_ADDRESS }
if (-not $Address) {
  $found = Get-PnpDevice -FriendlyName 'MINI_KEYBOARD' -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -match 'DEV_([0-9A-Fa-f]{12})' } | Select-Object -First 1
  if ($found -and $found.InstanceId -match 'DEV_([0-9A-Fa-f]{12})') { $Address = $Matches[1] }
}
$Address = ($Address -replace '[^0-9A-Fa-f]', '')
if ($Address.Length -ne 12) { Write-Output 'Indirizzo BLE non trovato: associa il pad a Windows (Bluetooth) oppure passa -Address con le 12 cifre esadecimali.'; return }
$addr = [uint64]::Parse($Address, [System.Globalization.NumberStyles]::HexNumber)
try { Write-Output ($T.GetMethod('Start').Invoke($null, @($addr))) }
catch { Write-Output ('ERRORE: ' + $_.Exception.InnerException.Message); [void]$T.GetMethod('Stop').Invoke($null, @()); return }
try {
  Write-Output ('Invio: ' + (($bytes | ForEach-Object { $_.ToString('X2') }) -join ' '))
  Write-Output ($T.GetMethod('Send').Invoke($null, @(, [byte[]]$bytes)))
  $deadline = (Get-Date).AddSeconds($ListenSeconds)
  $n = 0
  while ((Get-Date) -lt $deadline) {
    $line = $null
    while ($lines.TryDequeue([ref]$line)) { Write-Output ('  <- ' + $line); $n++ }
    Start-Sleep -Milliseconds 50
  }
  Write-Output ('Notifiche ricevute dopo l''invio: {0}' -f $n)
} finally {
  Write-Output ($T.GetMethod('Stop').Invoke($null, @()))
}
