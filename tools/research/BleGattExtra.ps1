# Letture AGGIUNTIVE in SOLA LETTURA sul servizio 0xAE40 del macropad (Windows PowerShell 5.1):
#   - elenca i descrittori delle caratteristiche AE41/AE42;
#   - legge SOLO i descrittori standard "Characteristic User Description" (0x2901) e "Presentation Format" (0x2904);
#   - legge la dimensione massima del PDU ATT negoziata (MTU).
# NON scrive, NON si iscrive, NON legge le caratteristiche AE41/AE42.
param([string]$Address = '')
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Devices.Bluetooth.BluetoothLEDevice, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
[void][Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
[void][Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicsResult, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
[void][Windows.Devices.Bluetooth.GenericAttributeProfile.GattDescriptorsResult, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
[void][Windows.Devices.Bluetooth.GenericAttributeProfile.GattReadResult, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
[void][Windows.Devices.Bluetooth.GenericAttributeProfile.GattSession, Windows.Devices.Bluetooth, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type, $ms = 30000) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); [void]$t.Wait($ms); if ($t.IsCompleted) { $t.Result } else { $null } }
function Bytes($buf) {
  $r = [Windows.Storage.Streams.DataReader].GetMethod('FromBuffer').Invoke($null, @($buf))
  $b = New-Object byte[] ([int]$r.UnconsumedBufferLength); $r.ReadBytes($b); $b
}

# Indirizzo BLE del pad: -Address, MACROPAD_BLE_ADDRESS oppure ricerca per nome (vedi lib\PadDevice.ps1).
. (Join-Path $PSScriptRoot '..\lib\PadDevice.ps1')
$Address = Resolve-PadBleAddress $Address
if (-not $Address) { Write-Output 'Indirizzo BLE non trovato: associa il pad a Windows (Bluetooth) oppure passa -Address con le 12 cifre esadecimali.'; return }
$addr = [uint64]::Parse($Address, [System.Globalization.NumberStyles]::HexNumber)
$dev = Await ([Windows.Devices.Bluetooth.BluetoothLEDevice]::FromBluetoothAddressAsync($addr)) ([Windows.Devices.Bluetooth.BluetoothLEDevice])
if (-not $dev) { Write-Output 'Dispositivo non ottenuto.'; return }

$sess = Await ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattSession]::FromDeviceIdAsync($dev.BluetoothDeviceId)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattSession])
if ($sess) { Write-Output ('MTU / MaxPduSize negoziato: {0} byte (payload di scrittura utile ≈ {1})' -f $sess.MaxPduSize, ($sess.MaxPduSize - 3)) }

$res = Await ($dev.GetGattServicesAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult])
foreach ($s in $res.Services) {
  if ($s.Uuid -ne [guid]'0000ae40-0000-1000-8000-00805f9b34fb') { continue }
  $cr = Await ($s.GetCharacteristicsAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicsResult])
  foreach ($c in $cr.Characteristics) {
    Write-Output ('CHAR {0}  handle 0x{1:X4}  proprietà: {2}  ProtectionLevel: {3}' -f $c.Uuid, $c.AttributeHandle, $c.CharacteristicProperties, $c.ProtectionLevel)
    $dr = Await ($c.GetDescriptorsAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattDescriptorsResult])
    if (-not $dr -or $dr.Status -ne 'Success') { Write-Output ('   descrittori: ' + $(if ($dr) { $dr.Status } else { 'timeout' })); continue }
    foreach ($d in $dr.Descriptors) {
      $line = '   DESC {0}  handle 0x{1:X4}' -f $d.Uuid, $d.AttributeHandle
      $u = $d.Uuid.ToString().ToLower()
      if ($u -eq '00002901-0000-1000-8000-00805f9b34fb' -or $u -eq '00002904-0000-1000-8000-00805f9b34fb') {
        $rr = Await ($d.ReadValueAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattReadResult])
        if ($rr -and $rr.Status -eq 'Success') {
          $b = Bytes $rr.Value
          $line += '  -> ' + (($b | ForEach-Object { $_.ToString('X2') }) -join ' ') + ' | "' + (($b | ForEach-Object { if ($_ -ge 32 -and $_ -lt 127) { [char]$_ } else { '.' } }) -join '') + '"'
        }
      }
      Write-Output $line
    }
  }
}
$dev.Dispose()
