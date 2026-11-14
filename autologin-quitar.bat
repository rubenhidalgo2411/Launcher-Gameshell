@echo off
net session >nul 2>&1
if errorlevel 1 (echo Ejecuta este archivo como administrador: clic derecho, Ejecutar como administrador. & pause & exit /b)
set /p U=Usuario de juegos: 
if "%U%"=="" exit /b
set K=HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon
reg add "%K%" /v AutoAdminLogon /t REG_SZ /d 0 /f
reg delete "%K%" /v DefaultPassword /f
echo Ahora elige la nueva contrasena de esa cuenta:
net user "%U%" *
pause
