# GameShell - vigia. Lo arranca main.js (powershell -File vigia.ps1 <pid del launcher>) y escribe en la salida estandar, UNA LINEA POR CAMBIO:
#   P1 / P0                       hay / no hay un mando encendido. Windows lo ve en cuanto se conecta; el navegador del launcher (Chromium) no se lo ensena a la
#                                 pagina hasta que se pulsa un boton, y por eso la Precarga Post Intro pedia una pulsacion mas.
#                                 Los Buzz (el "pincho" USB de PS2/PS3: Sony 054C:1000 y 054C:0002, o cualquier dispositivo con "buzz" en el nombre) NO cuentan
#                                 como mando: Windows los ve como un mando mas y la Precarga se saltaba sola con el pincho enchufado.
#   F<proceso>|<clase de ventana> quien tiene el foco ahora (con el Modo Juego puesto, main.js vuelve al launcher si es el escritorio de Windows).
# Termina solo cuando se cierra el launcher. Solo ASCII: Windows PowerShell 5.1 lee mal los acentos de un .ps1 sin BOM.
# Diario: %APPDATA%\gameshell\vigia.log. Una linea la primera vez que se ve cada joystick de Windows, y dice si lo ha contado como mando o como Buzz.
param([int]$ParentPid = 0)
$ErrorActionPreference = 'SilentlyContinue'
# prioridad baja: ni la compilacion de abajo ni el bucle compiten con la intro o con un juego (y csc.exe, que lanza Add-Type, hereda esta prioridad)
try { [System.Diagnostics.Process]::GetCurrentProcess().PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal } catch { }
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

# C# 5 (es lo que compila Add-Type en Windows PowerShell 5.1): nada de $"", ?. ni expresiones con =>. Solo tipos de mscorlib (sin HashSet ni LINQ)
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;
public static class GSV {
  [StructLayout(LayoutKind.Sequential)]
  public struct JOYINFOEX { public uint dwSize, dwFlags, dwXpos, dwYpos, dwZpos, dwRpos, dwUpos, dwVpos, dwButtons, dwButtonNumber, dwPOV, dwReserved1, dwReserved2; }
  [DllImport("winmm.dll")] static extern uint joyGetPosEx(uint id, ref JOYINFOEX info);
  // JOYCAPSW son 728 bytes: wMid (2) y wPid (2) en el 0, szPname (32 WCHAR) en el 4, 19 UINT, szRegKey (32 WCHAR) en el 144 y szOEMVxD (260 WCHAR)
  [DllImport("winmm.dll", ExactSpelling = true)] static extern uint joyGetDevCapsW(UIntPtr id, [Out] byte[] caps, uint size);
  [DllImport("xinput1_4.dll")] static extern uint XInputGetState(uint idx, byte[] state);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder sb, int max);

  // lo que se ha visto de cada joystick (para el diario): una vez por cada texto distinto
  static readonly Dictionary<string, bool> vistos = new Dictionary<string, bool>();
  static readonly List<string> notas = new List<string>();
  static void Nota(string t) { if (!vistos.ContainsKey(t)) { vistos[t] = true; notas.Add(t); } }
  public static string Notas() {
    if (notas.Count == 0) return "";
    string s = string.Join("\n", notas.ToArray());
    notas.Clear();
    return s;
  }

  // texto de un campo WCHAR[] de JOYCAPSW (hasta el primer cero)
  static string Txt(byte[] b, int off, int len) {
    string s = Encoding.Unicode.GetString(b, off, len);
    int z = s.IndexOf('\0');
    return z >= 0 ? s.Substring(0, z) : s;
  }

  // true si los datos de un joystick (JOYCAPSW) son de un Buzz: Sony 054C:1000 (receptor inalambrico) o 054C:0002 (con cable), o "buzz" en el nombre
  static bool Decide(uint id, byte[] c) {
    int mid = BitConverter.ToUInt16(c, 0), pid = BitConverter.ToUInt16(c, 2);
    string nom = Txt(c, 4, 64), clave = Txt(c, 144, 64);
    string todo = (nom + " " + clave).ToUpperInvariant();
    bool buzz = todo.Contains("BUZZ") || todo.Contains("VID_054C&PID_1000") || todo.Contains("VID_054C&PID_0002")
             || (mid == 0x054C && (pid == 0x1000 || pid == 0x0002));
    Nota("winmm #" + id + ": vid=" + mid.ToString("X4") + " pid=" + pid.ToString("X4") + " nombre='" + nom + "' clave='" + clave + "' -> " + (buzz ? "Buzz, NO cuenta como mando" : "cuenta como mando"));
    return buzz;
  }

  // Si no se puede saber quien es, false: cuenta como mando, igual que antes de este cambio
  static bool EsBuzz(uint id) {
    try {
      byte[] c = new byte[728];
      uint r = joyGetDevCapsW(new UIntPtr(id), c, 728);
      if (r != 0) { Nota("winmm #" + id + ": no se pudo leer el nombre (error " + r + "), cuenta como mando"); return false; }
      return Decide(id, c);
    } catch (Exception) { return false; }
  }

  // true si Windows ve algun mando conectado (que no sea un Buzz): DualShock / DualSense / genericos (winmm) o de Xbox (XInput)
  public static bool Pad() {
    try {
      for (uint i = 0; i < 16; i++) {
        JOYINFOEX j = new JOYINFOEX(); j.dwSize = 52; j.dwFlags = 0xFF;
        if (joyGetPosEx(i, ref j) != 0) continue;
        if (EsBuzz(i)) continue;
        return true;
      }
    } catch (Exception) { }
    try {
      byte[] b = new byte[16];
      for (uint i = 0; i < 4; i++) { if (XInputGetState(i, b) == 0) return true; }
    } catch (Exception) { }
    return false;
  }

  // "proceso|clase" de la ventana que tiene el foco ("" si no hay ninguna)
  public static string Fg() {
    try {
      IntPtr h = GetForegroundWindow();
      if (h == IntPtr.Zero) return "";
      uint pid; GetWindowThreadProcessId(h, out pid);
      StringBuilder sb = new StringBuilder(256); GetClassName(h, sb, 256);
      string name = "";
      try { name = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch (Exception) { }
      return name + "|" + sb.ToString();
    } catch (Exception) { return ""; }
  }
}
'@
if (-not ('GSV' -as [type])) { exit 2 }

# diario (solo si existe la carpeta de datos del launcher; nunca la crea). Se vacia si pasa de 200 KB
$logf = Join-Path $env:APPDATA 'gameshell\vigia.log'
function Anota([string]$t) {
  try {
    if (-not (Test-Path -LiteralPath (Split-Path $logf))) { return }
    if ((Test-Path -LiteralPath $logf) -and ((Get-Item -LiteralPath $logf).Length -gt 200000)) { Remove-Item -LiteralPath $logf -Force }
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $txt = ''
    foreach ($l in ($t -split "`n")) { if ($l) { $txt += ($ts + ' vigia: ' + $l + "`r`n") } }
    [System.IO.File]::AppendAllText($logf, $txt, (New-Object System.Text.UTF8Encoding($false)))
  } catch { }
}

$pad = ''; $foco = $null; $vuelta = 0
while ($true) {
  if ($ParentPid -gt 0) { try { [void][System.Diagnostics.Process]::GetProcessById($ParentPid) } catch { exit 0 } }   # el launcher ya no esta: fin
  if (($vuelta % 3) -eq 0) {                      # el mando se mira cada ~1 s (basta y es mas barato); el foco, cada ~0,3 s
    $n = if ([GSV]::Pad()) { 'P1' } else { 'P0' }
    $t = [GSV]::Notas()
    if ($t) { Anota $t }
    if ($n -ne $pad) { $pad = $n; [Console]::Out.WriteLine($n); [Console]::Out.Flush() }
  }
  $g = 'F' + [GSV]::Fg()
  if ($g -ne $foco) { $foco = $g; [Console]::Out.WriteLine($g); [Console]::Out.Flush() }
  $vuelta++
  Start-Sleep -Milliseconds 300
}
