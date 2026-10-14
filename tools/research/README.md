# Strumenti di analisi (ricerca)

Servono a capire il dispositivo e il suo protocollo: non servono per usare l'app. Tutti in **sola lettura**, tranne dove è
scritto diversamente: non eseguono il software del produttore e non scrivono sul macropad.
Pensati per Windows PowerShell 5.1 (`Add-Type` con compilatore C# 5) e Python 3.

| File | Cosa fa |
|---|---|
| `IlDump.cs` | Disassembla un assembly .NET in contesto *ReflectionOnly* (nessun codice caricato dall'assembly viene eseguito). |
| `il2pseudo.py` | Converte il dump IL in pseudo-codice simulando lo stack (assegnazioni `buf[i] = …`, `if … goto`). |
| `extract_keys.py` | Estrae la tabella nome → usage HID dal pseudo-codice di `BasicKeys`. |
| `HidValCaps.cs` | Legge Report ID, dimensioni e usage di un'interfaccia HID (handle con accesso 0). |
| `UsbProbe.cs` | Legge device/config/string descriptor **solo** dalla porta del dispositivo indicato. |
| `BleGattDump.ps1` | Enumera servizi/caratteristiche GATT del macropad in BLE, **sola lettura** (nessuna scrittura né notifiche). |
| `BleNotifyProbe.ps1` | Ascolto **passivo** delle notifiche del servizio `AE40`/`AE42` (iscrizione = scrittura del solo CCCD; mai scrive su `AE41`). `-CompileOnly` per verificare senza toccare il dispositivo. |
| `BleGattExtra.ps1` | Descrittori di `AE41/AE42` (legge solo User Description/Presentation Format) e MTU negoziato. **Sola lettura.** |
| `BleSendProbe.ps1` | **Scrive** un solo frame su `AE41` e ascolta `AE42`. Barriere: `-IUnderstand` obbligatorio, solo frame LED (salvo `-AllowNonLed`), max 61 B. `-CompileOnly` per verificare. Esito: scrittura accettata dallo stack, nessun effetto ([`../../docs/BLUETOOTH.md`](../../docs/BLUETOOTH.md) §6). |

Gli script BLE ricavano l'indirizzo del pad da `-Address`, da `MACROPAD_BLE_ADDRESS` o dal nome `MINI_KEYBOARD`
(vedi [`../README.md`](../README.md)).

## Uso tipico: dal programma del produttore alla tabella del protocollo

```powershell
# 1) disassembla (dalla cartella del software, perché risolve HidLibrary.dll accanto all'exe)
Add-Type -Path .\tools\research\IlDump.cs -ReferencedAssemblies System.dll
[IlDump]::Run("C:\percorso\MINI KeyBoard.exe", "$env:TEMP\exe_il.txt")

# 2) (opzionale) accorcia i nomi lunghi degli assembly, poi converti in pseudo-codice
$t = [IO.File]::ReadAllText("$env:TEMP\exe_il.txt")
$t = [regex]::Replace($t, ', Version=[\d\.]+, Culture=\w+, PublicKeyToken=\w+', '')
[IO.File]::WriteAllText("$env:TEMP\exe_il_clean.txt", $t)
python -I .\tools\research\il2pseudo.py "$env:TEMP\exe_il_clean.txt" 'FormMain$' 'Download_Click' "$env:TEMP\out.txt"
```

Il `.exe` del produttore va trattato come non attendibile: tienilo fuori dalla cartella degli script e non eseguirlo. Il repository
non lo include.
