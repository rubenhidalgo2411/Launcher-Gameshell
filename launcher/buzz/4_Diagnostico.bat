@echo off
title BuzzActivar - Diagnostico
cd /d "%~dp0"
set "PY="
py -3 -c "import sys" >nul 2>nul
if not errorlevel 1 set "PY=py -3"
if defined PY goto lanzar
python -c "import sys" >nul 2>nul
if not errorlevel 1 set "PY=python"
if defined PY goto lanzar
echo [!] No encuentro Python. Ejecuta primero 1_Instalar.bat
pause
exit /b 1

:lanzar
echo Dispositivos HID que ve Windows. El receptor Buzz sale marcado con "<== Buzz"
echo (normalmente 054C:1000). Si no sale, desenchufa y vuelve a enchufar el pincho.
echo.
%PY% BuzzActivar.py --lista
echo.
pause
