# Enumerazione GATT del macropad in SOLA LETTURA (Windows PowerShell 5.1).
#   - interroga un solo indirizzo BLE (quello del macropad), mai altri dispositivi;
#   - elenca servizi e caratteristiche con le loro proprietà;
#   - legge solo caratteristiche standard innocue (Device Information, Battery);
#   - NON scrive, NON si iscrive alle notifiche, NON legge le caratteristiche dei servizi sconosciuti (es. 0xAE40).
# Prerequisito: pad in modalità Bluetooth (cavo USB scollegato, interruttore su ON) e già associato a Windows.
param([string]$Address = '')
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Devices.Bluetooth.BluetoothLEDevice, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
[void][Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
[void][Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicsResult, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
[void][Windows.Devices.Bluetooth.GenericAttributeProfile.GattReadResult, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime]

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type, $ms = 30000) {
  $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  [void]$t.Wait($ms)
  if ($t.IsCompleted) { $t.Result } else { $null }
}

$HID = [guid]'00001812-0000-1000-8000-00805f9b34fb'
$SAFE_READ = @{
  '00002a29-0000-1000-8000-00805f9b34fb' = 'Manufacturer Name'
  '00002a24-0000-1000-8000-00805f9b34fb' = 'Model Number'
  '00002a26-0000-1000-8000-00805f9b34fb' = 'Firmware Revision'
  '00002a27-0000-1000-8000-00805f9b34fb' = 'Hardware Revision'
  '00002a28-0000-1000-8000-00805f9b34fb' = 'Software Revision'
  '00002a50-0000-1000-8000-00805f9b34fb' = 'PnP ID'
  '00002a19-0000-1000-8000-00805f9b34fb' = 'Battery Level'
}

# Indirizzo BLE del pad: -Address, MACROPAD_BLE_ADDRESS oppure ricerca per nome (vedi lib\PadDevice.ps1).
. (Join-Path $PSScriptRoot '..\lib\PadDevice.ps1')
$Address = Resolve-PadBleAddress $Address
if (-not $Address) { Write-Output 'Indirizzo BLE non trovato: associa il pad a Windows (Bluetooth) oppure passa -Address con le 12 cifre esadecimali.'; return }
$addr = [uint64]::Parse($Address, [System.Globalization.NumberStyles]::HexNumber)
$dev = Await ([Windows.Devices.Bluetooth.BluetoothLEDevice]::FromBluetoothAddressAsync($addr)) ([Windows.Devices.Bluetooth.BluetoothLEDevice])
if (-not $dev) { Write-Output 'Dispositivo non ottenuto: il macropad deve essere in modalità Bluetooth e connesso.'; return }
Write-Output ('Nome: {0}   Connessione: {1}' -f $dev.Name, $dev.ConnectionStatus)

$res = Await ($dev.GetGattServicesAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult])
if (-not $res -or $res.Status -ne 'Success') { Write-Output ('Servizi GATT non ottenuti: ' + $(if ($res) { $res.Status } else { 'timeout' })); $dev.Dispose(); return }

foreach ($s in $res.Services) {
  Write-Output ('SERVICE {0}  (handle 0x{1:X4})' -f $s.Uuid, $s.AttributeHandle)
  if ($s.Uuid -eq $HID) { Write-Output '   (HID: Windows non consente l''accesso diretto)'; continue }
  $cr = Await ($s.GetCharacteristicsAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicsResult])
  if (-not $cr -or $cr.Status -ne 'Success') { Write-Output ('   caratteristiche: ' + $(if ($cr) { $cr.Status } else { 'timeout' })); continue }
  foreach ($c in $cr.Characteristics) {
    $line = '   CHAR {0}  handle 0x{1:X4}  proprietà: {2}' -f $c.Uuid, $c.AttributeHandle, $c.CharacteristicProperties
    $key = $c.Uuid.ToString().ToLower()
    if ($SAFE_READ.ContainsKey($key) -and ($c.CharacteristicProperties -band [Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties]::Read)) {
      $rr = Await ($c.ReadValueAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattReadResult])
      if ($rr -and $rr.Status -eq 'Success') {
        # la chiamata diretta FromBuffer($oggettoCOM) fallisce in PowerShell 5.1: si passa per reflection
        $reader = [Windows.Storage.Streams.DataReader].GetMethod('FromBuffer').Invoke($null, @($rr.Value))
        # .Length su un oggetto COM vale sempre 1 in PowerShell: la lunghezza vera è UnconsumedBufferLength
        $bytes = New-Object byte[] ([int]$reader.UnconsumedBufferLength)
        $reader.ReadBytes($bytes)
        $hex = ($bytes | ForEach-Object { $_.ToString('X2') }) -join ' '
        $txt = ($bytes | ForEach-Object { if ($_ -ge 32 -and $_ -lt 127) { [char]$_ } else { '.' } }) -join ''
        $line += ('   -> {0}: {1} | "{2}"' -f $SAFE_READ[$key], $hex, $txt)
      }
    }
    Write-Output $line
  }
}
$dev.Dispose()
