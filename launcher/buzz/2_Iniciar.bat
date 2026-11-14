@echo off
title BuzzActivar
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
%PY% BuzzActivar.py %*
if errorlevel 1 pause
