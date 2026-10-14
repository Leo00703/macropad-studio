@echo off
rem Macropad Studio launcher (Windows): event bridge (macropad events only) + local web server + live view in the browser.
rem Needs Python 3 (static file server) and Chrome or Edge (WebHID). Close the bridge window and this one to stop.
rem Keep the port at 5173: the browser remembers the WebHID permission and the saved profile per address.
cd /d "%~dp0"
set PORT=5173
echo.
echo   Macropad Studio  -^>  http://localhost:%PORT%/live.html
echo   Event bridge     -^>  http://127.0.0.1:5174  (macropad events only)
echo.
start "Macropad - event bridge" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\PadBridge.ps1"
start "" "http://localhost:%PORT%/live.html"
where python >nul 2>nul && (python -m http.server %PORT% --bind 127.0.0.1 --directory app) || (py -m http.server %PORT% --bind 127.0.0.1 --directory app)
echo.
echo   "Address already in use" means the server was already running: that is fine.
pause
