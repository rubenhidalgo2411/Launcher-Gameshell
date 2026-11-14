param([Parameter(Mandatory)][ValidateSet('instalar','quitar')][string]$Accion, [string]$Usuario)
$exe = Join-Path $PSScriptRoot 'node_modules\electron\dist\electron.exe'
$app = Join-Path $PSScriptRoot 'launcher'
$sub = 'Software\Microsoft\Windows NT\CurrentVersion\Winlogon'
$hive = $null
if ($Usuario) {
  $sid = (New-Object Security.Principal.NTAccount($Usuario)).Translate([Security.Principal.SecurityIdentifier]).Value
  if (Test-Path "Registry::HKEY_USERS\$sid") { $root = "Registry::HKEY_USERS\$sid" }
  else {
    $pp = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$sid").ProfileImagePath
    $hive = 'GS_TMP'; reg load "HKU\$hive" "$pp\NTUSER.DAT" | Out-Null; $root = "Registry::HKEY_USERS\$hive"
  }
} else { $root = 'HKCU:' }
$k = "$root\$sub"
if ($Accion -eq 'instalar') {
  if (-not (Test-Path $exe)) { Write-Host 'Falta electron.exe: ejecuta instalar-shell.bat en esta carpeta primero (instala y descarga Electron).'; exit 1 }
  if (-not (Test-Path (Join-Path $app 'main.js'))) { Write-Host ('Falta la carpeta del launcher: {0}' -f $app); exit 1 }
  New-Item $k -Force | Out-Null
  Set-ItemProperty $k Shell ('"{0}" "{1}"' -f $exe, $app)
  Write-Host 'Listo. Cierra sesion y vuelve a entrar: cargara GameShell en vez del escritorio.'
  Write-Host 'Este launcher unico sustituye a "actualizacion" y "actualizado" (los cambios de aspecto estan en Opciones > Apariencia).'
} else {
  Remove-ItemProperty $k Shell -ErrorAction SilentlyContinue
  Write-Host 'Restaurado: ese usuario volvera a usar el escritorio normal de Windows.'
}
if ($hive) { [gc]::Collect(); reg unload "HKU\$hive" | Out-Null }
