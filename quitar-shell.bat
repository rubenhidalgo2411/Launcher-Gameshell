@echo off
set /p U=Usuario de juegos (nombre de su carpeta en C:\Users; vacio = el usuario actual): 
if "%U%"=="" (powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0shell.ps1" -Accion quitar) else (powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0shell.ps1" -Accion quitar -Usuario "%U%")
pause
