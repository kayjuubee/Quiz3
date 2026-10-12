@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js ist nicht installiert.
 echo Bitte https://nodejs.org herunterladen und installieren.
 pause
 exit /b 1
)
if not exist "node_modules\express" (
 echo Installiere Quiz-Abhaengigkeiten...
 call npm install
 if errorlevel 1 (
  echo Installation fehlgeschlagen. Bitte Internetverbindung pruefen.
  pause
  exit /b 1
 )
)
echo.
echo KayJuuBee Quiz startet...
echo Spielleitung: http://localhost:3000/host
echo Beamer:      http://localhost:3000/screen
echo.
start "" "http://localhost:3000/host"
node server.js
echo.
echo Server beendet. Fenster offen lassen fuer Fehlermeldungen.
pause
