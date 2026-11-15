# Documentation

> The in-depth documents are written in **Italian** (translation is tracked in [#7](https://github.com/Leo00703/macropad-studio/issues/7)).
> The READMEs and the [contributing guide](../CONTRIBUTING.md) are in English.

| Document | Read it to… |
|---|---|
| [`PROTOCOL.md`](PROTOCOL.md) | Know the exact configuration frame format and everything **verified on hardware**. This is the source of truth; anything marked **[DA VERIFICARE]** is a hypothesis |
| [`HARDWARE.md`](HARDWARE.md) | See what is on the board (`ANXIN-@9KEY_3KNOB`): MCU, power path, USB, LEDs. Backed by the photos in [`images/pcb/`](images/pcb/) |
| [`BLUETOOTH.md`](BLUETOOTH.md) | Understand why the pad cannot be programmed over Bluetooth, and what was tried |
| [`ANALYSIS.md`](ANALYSIS.md) | Get the overall reverse-engineering report in one page |
| [`DESIGN.md`](DESIGN.md) | Follow the visual language and the geometry of the drawn pad |
| [`DEVELOPMENT-LOG.md`](DEVELOPMENT-LOG.md) | Find *why* a decision was taken: measurements, dead ends, corrections |
| [`keycodes.tsv`](keycodes.tsv) | Look up the HID usage codes and the labels the app shows for them |

Related: [app guide](../app/README.md) · [tools guide](../tools/README.md) · [research helpers](../tools/research/README.md) ·
[changelog](../CHANGELOG.md)
