# Security policy

## Supported versions

Only the latest commit on `main` (and the latest tagged release, once releases exist) receives fixes.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's private reporting: open the repository's **Security** tab and choose
[**Report a vulnerability**](https://github.com/Leo00703/macropad-studio/security/advisories/new). Include what you
found, how to reproduce it, and the impact you expect. You can expect an acknowledgement within about a week; this is a
volunteer project, so fixes follow as time allows. Reporters are credited in the advisory unless they prefer otherwise.

## What is in scope

Macropad Studio has two parts that can matter for security:

| Component | Exposure | Existing safeguards |
|---|---|---|
| `tools/PadBridge.ps1` (Windows bridge) | Local HTTP server on `127.0.0.1:5174` that streams pad events (SSE) and accepts a map of *host actions* that it runs on the PC | Binds to loopback only; accepts requests only from the app's own origin (`http://localhost:5173`); events from every device other than the pad (`VID_1189`) are dropped **before** their content is read; requests need a local `Host` header and the map is capped at 64 KiB; host actions are limited to media keys, mouse buttons and the wheel |
| Web app (`app/`) | Runs in the browser, talks to the pad over WebHID with explicit user permission | No third-party scripts, no network requests other than the local bridge, profile kept in the browser's local storage |

Examples of reports that are in scope: a way for another website or local process to make the bridge execute actions or read
keystrokes, bypass of the origin check, the bridge reading input from devices other than the pad, path or command
injection in the tools, or anything that makes the app write to the device without a user action.

Out of scope: the behaviour of the pad's own firmware, issues that require an already compromised machine, and
social-engineering of the user.

## Safe use

* The pad is **write-only**: a bad write overwrites a control's configuration, but nothing here implements a firmware update.
* Review `tools/` scripts before running them; they are short, commented and have no external dependencies.
