@echo off
title BuzzActivar - Arranque automatico
set "AQUI=%~dp0"
set "ATAJO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\BuzzActivar.lnk"

if exist "%ATAJO%" goto quitar

powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%ATAJO%'); $s.TargetPath='%AQUI%2_Iniciar.bat'; $s.WorkingDirectory='%AQUI%'; $s.WindowStyle=7; $s.Save()"
if exist "%ATAJO%" goto creado
echo [!] No se pudo crear el acceso directo de arranque.
goto fin

:creado
echo [OK] Arranque automatico ACTIVADO.
echo      BuzzActivar se abrira solo (minimizado) cuando inicies sesion en Windows.
echo      Para desactivarlo, vuelve a ejecutar este archivo.
goto fin

:quitar
del "%ATAJO%"
echo [OK] Arranque automatico DESACTIVADO.

:fin
echo.
pause
