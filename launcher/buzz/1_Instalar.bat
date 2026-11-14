@echo off
title BuzzActivar - Instalacion
cd /d "%~dp0"
echo ==================================================
echo   BuzzActivar - instalacion (solo hace falta 1 vez)
echo ==================================================
echo.
set "PY="
py -3 -c "import sys" >nul 2>nul
if not errorlevel 1 set "PY=py -3"
if defined PY goto instalar
python -c "import sys" >nul 2>nul
if not errorlevel 1 set "PY=python"
if defined PY goto instalar
echo [!] No encuentro Python en este PC.
echo.
echo     1) Descargalo de https://www.python.org/downloads/
echo     2) Al instalarlo, marca la casilla "Add python.exe to PATH"
echo     3) Cuando termine, vuelve a abrir este archivo.
echo.
pause
exit /b 1

:instalar
echo Usando Python: %PY%
echo.
%PY% -m pip install --upgrade hidapi
if errorlevel 1 goto fallo
echo.
echo [OK] Todo instalado. Ahora abre 2_Iniciar.bat
echo.
pause
exit /b 0

:fallo
echo.
echo [!] La instalacion ha fallado. Comprueba la conexion a Internet y vuelve a
echo     intentarlo. Si sigue igual, copia el mensaje de error de arriba.
echo.
pause
exit /b 1
