@echo off
rem GameShell: instala el launcher (carpeta "launcher") como shell de Windows para el usuario actual.
rem Vuelve a ejecutarlo si venias de la version doble (actualizacion / actualizado): cambia el arranque a este launcher unico.
cd /d "%~dp0"
echo.
echo  GameShell: launcher unico (todo lo de "actualizado" y "actualizacion" junto)
echo.
if exist "node_modules\electron\dist\electron.exe" goto registrar
where npm >nul 2>&1
if errorlevel 1 (
  echo Falta Node.js: instala Node.js LTS ^(64 bits^) y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
if not exist "node_modules\electron\package.json" (
  echo Instalando Electron ^(solo la primera vez, hace falta internet^)...
  call npm install
  if errorlevel 1 (
    echo npm install ha fallado. Revisa el mensaje de arriba.
    pause
    exit /b 1
  )
)
rem Electron 45 o mas nuevo: "npm install" deja el paquete pero ya no baja el programa ^(electron.exe^); hay que pedirlo aparte.
if not exist "node_modules\electron\dist\electron.exe" (
  echo Descargando el programa de Electron ^(hace falta internet^)...
  call node "node_modules\electron\install.js"
  if errorlevel 1 (
    echo No se pudo descargar Electron. Revisa el mensaje de arriba y vuelve a ejecutar este archivo.
    pause
    exit /b 1
  )
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo Sigue faltando node_modules\electron\dist\electron.exe. Borra la carpeta node_modules y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
:registrar
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0shell.ps1" -Accion instalar
pause
