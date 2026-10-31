# Funzioni condivise dagli strumenti PowerShell: indirizzo Bluetooth del macropad.
# Uso:  . (Join-Path $PSScriptRoot 'lib\PadDevice.ps1')      (dagli script in research\: '..\lib\PadDevice.ps1')

# Indirizzo BLE del pad (12 cifre esadecimali maiuscole) oppure $null. Ordine di ricerca: il parametro, la variabile
# d'ambiente MACROPAD_BLE_ADDRESS, poi il nome "MINI_KEYBOARD" fra i dispositivi già associati a Windows.
# Nessun altro dispositivo viene letto: il filtro per nome restituisce solo il macropad.
function Resolve-PadBleAddress {
  param([string]$Address)
  if (-not $Address) { $Address = $env:MACROPAD_BLE_ADDRESS }
  if (-not $Address) {
    $found = Get-PnpDevice -FriendlyName 'MINI_KEYBOARD' -ErrorAction SilentlyContinue |
      Where-Object { $_.InstanceId -match 'DEV_([0-9A-Fa-f]{12})' } | Select-Object -First 1
    if ($found -and $found.InstanceId -match 'DEV_([0-9A-Fa-f]{12})') { $Address = $Matches[1] }
  }
  $digits = $Address -replace '[^0-9A-Fa-f]', ''
  if ($digits.Length -eq 12) { return $digits.ToUpperInvariant() }
  return $null
}
