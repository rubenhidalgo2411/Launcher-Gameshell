@echo off
net session >nul 2>&1
if errorlevel 1 (echo Ejecuta este archivo como administrador: clic derecho, Ejecutar como administrador. & pause & exit /b)
set /p U=Usuario de juegos (nombre de su carpeta en C:\Users): 
if "%U%"=="" exit /b
net user "%U%" ""
if errorlevel 1 (echo No se pudo quitar la contrasena. Es una cuenta local? & pause & exit /b)
set K=HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon
reg add "%K%" /v AutoAdminLogon /t REG_SZ /d 1 /f
reg add "%K%" /v DefaultUserName /t REG_SZ /d "%U%" /f
reg add "%K%" /v DefaultPassword /t REG_SZ /d "" /f
reg add "%K%" /v DefaultDomainName /t REG_SZ /d "%COMPUTERNAME%" /f
echo Listo. Reinicia para probarlo.
pause
