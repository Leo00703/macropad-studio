# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) once tagged releases start (the app is pre-1.0: anything may change).

## [Unreleased]

### Added
- Community files: contributing guide, code of conduct (Contributor Covenant 2.1), security policy, issue forms
  (bug, feature, hardware report), pull request template, `CODEOWNERS`, `.editorconfig`.
- Dependabot for GitHub Actions; CI now also runs the headless-Chrome regression test and the protocol tests on Node 20, 22 and 24.
- Static demo published with GitHub Pages (`pages.yml`): the page can be tried and the pad programmed over WebHID without installing anything.
- `docs/README.md`, an index of the documentation.

### Changed
- CI hardening: least-privilege `GITHUB_TOKEN`, actions pinned to commit SHAs, concurrency groups, no persisted credentials.
- README restructured around a quick tour, a compatibility table and troubleshooting.

### Fixed
- A page served from a non-local origin (the hosted demo) no longer tries to reach the local bridge.

## [0.1.0] - 2026-10-31

First public version.

### Added
- Live view of the 9-key + 3-knob macropad (USB `1189:8833`) drawn to scale; active layer and LED colour follow the device.
- Configurator: keyboard macros (up to 18 key presses, pauses, typed text), media, mouse, none or disabled; three layers per control;
  LED colour and effect per layer; *repeat while held* or *once per press*.
- Automatic signing of ambiguous controls (invisible F13–F21 pair or a reserved consumer usage) so the layer is never mistaken.
- Host-executed actions: duplicated media/mouse actions are run by the bridge on the PC.
- Diff-based send flow over WebHID; profile import/export as JSON with exact hex packets.
- Windows bridge (`tools/PadBridge.ps1`): pad-only Raw Input → server-sent events on `127.0.0.1:5174`.
- CLI tools: `PadWrite.ps1` (dry run by default), `profile-frames.js`, passive capture, read-only research helpers.
- Documentation: protocol specification with hardware verifications, hardware analysis, Bluetooth findings, design notes, development log.
- Tests: protocol and pure-module tests (Node), headless-Chrome regression test; GitHub Actions CI.

### Changed
- Code health pass: app split into ES modules (`core/` pure, `ui/` DOM), one copy of the protocol logic, explicit error handling,
  one shared Raw Input implementation for the PowerShell tools.

[Unreleased]: https://github.com/Leo00703/macropad-studio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Leo00703/macropad-studio/releases/tag/v0.1.0
