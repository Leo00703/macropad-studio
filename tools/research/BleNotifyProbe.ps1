# Ascolto PASSIVO delle notifiche del servizio 0xAE40 / caratteristica 0xAE42 del macropad (Windows PowerShell 5.1).
#   - si iscrive alle notifiche (scrittura sul solo descrittore CCCD: volatile, standard BLE);
#   - NON scrive mai su AE41 (la caratteristica dei comandi);
#   - registra ogni notifica con l'ora; alla fine si disiscrive.
# Uso:  .\BleNotifyProbe.ps1 -Seconds 90        (durante l'ascolto: premi tasti, ruota manopole, premi "Layer")
#       .\BleNotifyProbe.ps1 -CompileOnly       (compila soltanto, non tocca il dispositivo)
param([int]$Seconds = 90, [switch]$CompileOnly, [string]$Address = '')
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$src = @'
using System;
using System.Collections.Concurrent;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Storage.Streams;

public static class BleNotifyProbe
{
    public static readonly ConcurrentQueue<string> Lines = new ConcurrentQueue<string>();
    static BluetoothLEDevice dev;
    static GattDeviceService svc;
    static GattCharacteristic ch;

    static object token;

    // attesa semplice sull'operazione WinRT (evita System.WindowsRuntimeSystemExtensions, che richiede il winmd "unione");
    // con timeout, così un blocco viene segnalato invece di restare appeso
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

    // PowerShell gira su un thread STA senza message pump: le operazioni WinRT vanno eseguite su un thread MTA
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

    public static string Start(ulong address, Guid service, Guid characteristic)
    {
        return RunMta(delegate () { return StartImpl(address, service, characteristic); });
    }

    public static string Stop()
    {
        return RunMta(delegate () { return StopImpl(); });
    }

    static string StartImpl(ulong address, Guid service, Guid characteristic)
    {
        dev = Wait(BluetoothLEDevice.FromBluetoothAddressAsync(address), "FromBluetoothAddress");
        if (dev == null) return "dispositivo non ottenuto (pad in modalita' Bluetooth e connesso?)";
        // stesso percorso dello script di enumerazione che funziona: tutti i servizi, poi si filtra per UUID
        GattDeviceServicesResult sr = Wait(dev.GetGattServicesAsync(BluetoothCacheMode.Uncached), "GetGattServices");
        if (sr.Status != GattCommunicationStatus.Success) return "servizi: " + sr.Status;
        foreach (GattDeviceService s in sr.Services) { if (s.Uuid == service) svc = s; }
        if (svc == null) return "servizio " + service + " non trovato";
        GattCharacteristicsResult cr = Wait(svc.GetCharacteristicsAsync(BluetoothCacheMode.Uncached), "GetCharacteristics");
        if (cr.Status != GattCommunicationStatus.Success) return "caratteristiche: " + cr.Status;
        foreach (GattCharacteristic c in cr.Characteristics) { if (c.Uuid == characteristic) ch = c; }
        if (ch == null) return "caratteristica " + characteristic + " non trovata";
        if ((ch.CharacteristicProperties & GattCharacteristicProperties.Notify) == 0) return "la caratteristica non supporta Notify";
        // gli eventi WinRT non sono sottoscrivibili con "+=" da questo compilatore: si chiama l'accessor via reflection
        Windows.Foundation.TypedEventHandler<GattCharacteristic, GattValueChangedEventArgs> handler =
            new Windows.Foundation.TypedEventHandler<GattCharacteristic, GattValueChangedEventArgs>(OnChanged);
        token = typeof(GattCharacteristic).GetMethod("add_ValueChanged").Invoke(ch, new object[] { handler });
        GattCommunicationStatus st = Wait(ch.WriteClientCharacteristicConfigurationDescriptorAsync(GattClientCharacteristicConfigurationDescriptorValue.Notify), "CCCD Notify");
        return "iscrizione alle notifiche: " + st;
    }

    static void OnChanged(GattCharacteristic sender, GattValueChangedEventArgs e)
    {
        DataReader r = DataReader.FromBuffer(e.CharacteristicValue);
        byte[] b = new byte[r.UnconsumedBufferLength];
        r.ReadBytes(b);
        Lines.Enqueue(DateTime.Now.ToString("HH:mm:ss.fff") + "  [" + b.Length + " B]  " + BitConverter.ToString(b).Replace('-', ' '));
    }

    static string StopImpl()
    {
        string res = "stop: nessuna caratteristica attiva";
        if (ch != null)
        {
            try
            {
                if (token != null) typeof(GattCharacteristic).GetMethod("remove_ValueChanged").Invoke(ch, new object[] { token });
                res = "disiscrizione: " + Wait(ch.WriteClientCharacteristicConfigurationDescriptorAsync(GattClientCharacteristicConfigurationDescriptorValue.None), "CCCD None");
            }
            catch (Exception ex) { res = "disiscrizione: errore " + ex.Message; }
        }
        if (svc != null) svc.Dispose();
        if (dev != null) dev.Dispose();
        return res;
    }
}
'@

# Add-Type non sa caricare i .winmd come riferimenti: si usa direttamente il compilatore C#.
$winmd  = Join-Path $env:WinDir 'System32\WinMetadata'
$facade = [System.Reflection.Assembly]::Load('System.Runtime, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a').Location
$wrt    = [System.Reflection.Assembly]::Load('System.Runtime.WindowsRuntime, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089').Location
$provider = New-Object Microsoft.CSharp.CSharpCodeProvider
$cp = New-Object System.CodeDom.Compiler.CompilerParameters
$cp.GenerateInMemory = $true
foreach ($r in @('mscorlib.dll', 'System.dll', $facade, $wrt, "$winmd\Windows.Foundation.winmd", "$winmd\Windows.Devices.winmd", "$winmd\Windows.Storage.winmd")) { [void]$cp.ReferencedAssemblies.Add($r) }
$out = $provider.CompileAssemblyFromSource($cp, $src)
if ($out.Errors.HasErrors) {
  $out.Errors | ForEach-Object { Write-Output ('ERRORE DI COMPILAZIONE: ' + $_.ToString()) }
  return
}
Write-Output 'Compilazione riuscita.'
if ($CompileOnly) { return }

$T     = $out.CompiledAssembly.GetType('BleNotifyProbe')
$lines = $T.GetField('Lines').GetValue($null)
# Indirizzo BLE del pad: -Address, variabile MACROPAD_BLE_ADDRESS oppure ricerca per nome ("MINI_KEYBOARD") fra i dispositivi già associati.
if (-not $Address) { $Address = $env:MACROPAD_BLE_ADDRESS }
if (-not $Address) {
  $found = Get-PnpDevice -FriendlyName 'MINI_KEYBOARD' -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -match 'DEV_([0-9A-Fa-f]{12})' } | Select-Object -First 1
  if ($found -and $found.InstanceId -match 'DEV_([0-9A-Fa-f]{12})') { $Address = $Matches[1] }
}
$Address = ($Address -replace '[^0-9A-Fa-f]', '')
if ($Address.Length -ne 12) { Write-Output 'Indirizzo BLE non trovato: associa il pad a Windows (Bluetooth) oppure passa -Address con le 12 cifre esadecimali.'; return }
$addr  = [uint64]::Parse($Address, [System.Globalization.NumberStyles]::HexNumber)
$svc   = [guid]'0000ae40-0000-1000-8000-00805f9b34fb'
$chr   = [guid]'0000ae42-0000-1000-8000-00805f9b34fb'
try { Write-Output ($T.GetMethod('Start').Invoke($null, @($addr, $svc, $chr))) }
catch { Write-Output ('ERRORE: ' + $_.Exception.InnerException.Message); [void]$T.GetMethod('Stop').Invoke($null, @()); return }
Write-Output ("In ascolto per {0} s: premi tasti, ruota le manopole, premi 'Layer'..." -f $Seconds)
$deadline = (Get-Date).AddSeconds($Seconds)
$n = 0
try {
  while ((Get-Date) -lt $deadline) {
    $line = $null
    while ($lines.TryDequeue([ref]$line)) { Write-Output $line; $n++ }
    Start-Sleep -Milliseconds 100
  }
} finally {
  Write-Output ($T.GetMethod('Stop').Invoke($null, @()))
}
Write-Output ("Notifiche ricevute: {0}" -f $n)
