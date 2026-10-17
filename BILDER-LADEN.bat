@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Bitte zuerst Node.js installieren.
 pause
 exit /b 1
)
echo Bilder werden einmalig heruntergeladen und lokal gespeichert.
node bilder-laden.js
echo.
echo Bitte pruefe die heruntergeladenen Fotos im Ordner quiz-bilder.
pause
