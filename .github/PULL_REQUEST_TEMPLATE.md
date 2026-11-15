## What and why

<!-- One concern per pull request. Link the issue: "Closes #123". -->

## How it was checked

- [ ] `cd app && npm test` passes
- [ ] `cd app && npm run test:browser` passes (or the snapshot was refreshed on purpose and the diff reviewed)
- [ ] Tried on a real pad (say which model and what you saw) — or not applicable
- [ ] Hex packets included if the protocol changed

## Rules of the project

- [ ] No write to the device without an explicit user action; tools touch only `VID_1189`
- [ ] Protocol logic stays in `app/protocol.js` (no copies in modules); `core/` does not import `ui/`
- [ ] No machine-specific data (BLE address, serial number, local paths)
- [ ] Docs and `CHANGELOG.md` (`Unreleased`) updated if users would notice the change
