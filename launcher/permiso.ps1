# GameShell - permiso para el contador de FPS: mete a un usuario (por su SID) en el grupo "Usuarios del registro de rendimiento" (SID S-1-5-32-559).
# Lo ejecuta un PowerShell ELEVADO que lanza launcher/fps.js: lo manda por -EncodedCommand con $sid y $resFile ya definidos encima de este texto
# (se quitan los comentarios y las lineas en blanco antes de mandarlo, para que ocupe poco).
# Prueba varios metodos, uno detras de otro, hasta que uno funcione, y deja el resultado en $resFile:
#   RESULT=OK (anadido) | YA (ya estaba) | FALLO ; GROUP=nombre del grupo en este Windows ; USER=tu usuario ; y una linea por cada metodo probado.
# Solo ASCII (PowerShell 5.1). Salida: 0 si quedas en el grupo, 3 si ningun metodo lo consiguio.
$ErrorActionPreference = 'Continue'

# ---- lo que habla con Windows (las pruebas de Linux sustituyen esta parte por funciones falsas) ----
function GsGrupo { $n = (New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-559')).Translate([System.Security.Principal.NTAccount]).Value; return $n.Substring($n.IndexOf('\') + 1) }
function GsUsuario([string]$s) { return (New-Object System.Security.Principal.SecurityIdentifier($s)).Translate([System.Security.Principal.NTAccount]).Value }
function GsNet([string]$g, [string]$u) { $t = (& net.exe localgroup $g $u /add 2>&1 | ForEach-Object { "$_" }) -join ' '; return @{ Code = $LASTEXITCODE; Text = $t } }
function GsAdsi([string]$g, [string]$s) { $o = [ADSI]('WinNT://./' + $g + ',group'); $o.Add('WinNT://' + $s) }
function GsCmdlet([string]$s) { Add-LocalGroupMember -SID 'S-1-5-32-559' -Member $s -ErrorAction Stop }
#---- LOGICA ----
$log = New-Object System.Collections.Generic.List[string]
$estado = 'FALLO'; $grupo = ''; $usuario = ''
function GsMsg($er) { $e = $er.Exception; $m = [string]$e.Message; while ($e.InnerException) { $e = $e.InnerException; $m += ' / ' + $e.Message }; return ($m -replace '\s+', ' ').Trim() }
function GsYaEsta($er) { $e = $er.Exception; while ($e) { if (($e.HResult -band 65535) -eq 1378 -or $e.GetType().Name -like '*MemberExists*') { return $true }; $e = $e.InnerException }; return $false }

# (GROUP= y USER= ya dicen cuales son; en $log solo entra lo que falla)
try { $grupo = GsGrupo } catch { $log.Add('grupo: ' + (GsMsg $_)) }
try { $usuario = GsUsuario $sid } catch { $log.Add('usuario: ' + (GsMsg $_)) }

# 1) net localgroup: no necesita ningun modulo y es lo mas parecido a hacerlo a mano
if ($estado -eq 'FALLO' -and $grupo -and $usuario) {
  try {
    $r = GsNet $grupo $usuario
    if ($r.Code -eq 0) { $estado = 'OK'; $log.Add('net localgroup: anadido') }
    elseif ($r.Text -match '1378') { $estado = 'YA'; $log.Add('net localgroup: ya era miembro') }
    else { $log.Add('net localgroup: error ' + $r.Code + ' ' + $r.Text) }
  } catch { $log.Add('net localgroup: ' + (GsMsg $_)) }
}
# 2) ADSI con el SID (no depende del nombre de la cuenta: sirve con cuentas Microsoft, de Azure o de dominio)
if ($estado -eq 'FALLO' -and $grupo) {
  try { GsAdsi $grupo $sid; $estado = 'OK'; $log.Add('ADSI: anadido') }
  catch { if (GsYaEsta $_) { $estado = 'YA'; $log.Add('ADSI: ya era miembro') } else { $log.Add('ADSI: ' + (GsMsg $_)) } }
}
# 3) cmdlets de cuentas locales, con el SID del grupo y el tuyo (sin ningun nombre de por medio)
if ($estado -eq 'FALLO') {
  try { GsCmdlet $sid; $estado = 'OK'; $log.Add('Add-LocalGroupMember: anadido') }
  catch { if (GsYaEsta $_) { $estado = 'YA'; $log.Add('Add-LocalGroupMember: ya era miembro') } else { $log.Add('Add-LocalGroupMember: ' + (GsMsg $_)) } }
}

$txt = 'RESULT=' + $estado + "`n" + 'GROUP=' + $grupo + "`n" + 'USER=' + $usuario + "`n" + ($log -join "`n") + "`n"
try { [System.IO.File]::WriteAllText($resFile, $txt, (New-Object System.Text.UTF8Encoding($false))) } catch { }
if ($estado -eq 'FALLO') { exit 3 }
exit 0
