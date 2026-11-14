# GameShell - resolucion de la pantalla principal sin salir a Windows (user32: EnumDisplaySettingsEx / ChangeDisplaySettingsEx).
# Solo ASCII: PowerShell 5.1 lee mal los acentos de un .ps1 sin BOM (igual que vigia.ps1).
#   powershell -File pantalla.ps1 list                       -> lista los modos que admite la pantalla (CUR/REG/MODE)
#   powershell -File pantalla.ps1 set <ancho> <alto> <hz>    -> cambia "en caliente" (no se guarda: al reiniciar Windows vuelve al guardado)
#   powershell -File pantalla.ps1 save <ancho> <alto> <hz>   -> lo cambia y lo guarda (como hace Configuracion de Windows)
#   powershell -File pantalla.ps1 revert                     -> vuelve al modo guardado
param([Parameter(Position = 0)][string]$Action = 'list', [Parameter(Position = 1)][int]$W = 0, [Parameter(Position = 2)][int]$H = 0, [Parameter(Position = 3)][int]$Hz = 0)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class GsDisp {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public struct DEVMODE {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
    public short dmSpecVersion; public short dmDriverVersion; public short dmSize; public short dmDriverExtra; public int dmFields;
    public int dmPositionX; public int dmPositionY; public int dmDisplayOrientation; public int dmDisplayFixedOutput;
    public short dmColor; public short dmDuplex; public short dmYResolution; public short dmTTOption; public short dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
    public short dmLogPixels; public int dmBitsPerPel; public int dmPelsWidth; public int dmPelsHeight; public int dmDisplayFlags; public int dmDisplayFrequency;
    public int dmICMMethod; public int dmICMIntent; public int dmMediaType; public int dmDitherType; public int dmReserved1; public int dmReserved2; public int dmPanningWidth; public int dmPanningHeight;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public struct DISPLAY_DEVICE {
    public int cb;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
    public int StateFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
  }
  [DllImport("user32.dll", CharSet = CharSet.Ansi, EntryPoint = "EnumDisplaySettingsExA")] static extern bool EnumSettings(string dev, int mode, ref DEVMODE dm, int flags);
  [DllImport("user32.dll", CharSet = CharSet.Ansi, EntryPoint = "ChangeDisplaySettingsExA")] static extern int Change(string dev, ref DEVMODE dm, IntPtr hwnd, int flags, IntPtr lp);
  [DllImport("user32.dll", CharSet = CharSet.Ansi, EntryPoint = "ChangeDisplaySettingsExA")] static extern int ChangeNull(string dev, IntPtr dm, IntPtr hwnd, int flags, IntPtr lp);
  [DllImport("user32.dll", CharSet = CharSet.Ansi, EntryPoint = "EnumDisplayDevicesA")] static extern bool EnumDevices(string dev, int idx, ref DISPLAY_DEVICE dd, int flags);
  const int CUR = -1, REG = -2, CDS_UPDATEREGISTRY = 1, CDS_TEST = 2;
  static DEVMODE NewMode() { DEVMODE dm = new DEVMODE(); dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE)); return dm; }
  // la pantalla principal (la que tiene el launcher)
  public static string Primary() {
    DISPLAY_DEVICE dd = new DISPLAY_DEVICE(); dd.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
    string first = null;
    for (int i = 0; EnumDevices(null, i, ref dd, 0); i++) {
      if ((dd.StateFlags & 1) == 0) continue;            // DISPLAY_DEVICE_ATTACHED_TO_DESKTOP
      if (first == null) first = dd.DeviceName;
      if ((dd.StateFlags & 4) != 0) return dd.DeviceName; // DISPLAY_DEVICE_PRIMARY_DEVICE
    }
    return first;
  }
  static string Line(string tag, DEVMODE d) { return tag + " " + d.dmPelsWidth + " " + d.dmPelsHeight + " " + d.dmDisplayFrequency + " " + d.dmBitsPerPel; }
  public static List<string> List(string dev) {
    List<string> o = new List<string>(); o.Add("DEV " + dev);
    DEVMODE cur = NewMode(), reg = NewMode();
    if (!EnumSettings(dev, CUR, ref cur, 0)) throw new Exception("no se pudo leer el modo actual");
    o.Add(Line("CUR", cur));
    if (EnumSettings(dev, REG, ref reg, 0)) o.Add(Line("REG", reg));
    Dictionary<string, bool> seen = new Dictionary<string, bool>();   // Dictionary vive en mscorlib: Add-Type no necesita referencias extra
    for (int i = 0; ; i++) {
      DEVMODE m = NewMode();
      if (!EnumSettings(dev, i, ref m, 0)) break;
      if (m.dmBitsPerPel != 32 && cur.dmBitsPerPel == 32) continue;
      if (m.dmDisplayOrientation != cur.dmDisplayOrientation) continue;   // sin los modos girados
      if (m.dmPelsWidth < 640 || m.dmPelsHeight < 480) continue;
      string k = m.dmPelsWidth + " " + m.dmPelsHeight + " " + m.dmDisplayFrequency;
      if (!seen.ContainsKey(k)) { seen[k] = true; o.Add("MODE " + k); }
    }
    return o;
  }
  // 0 = bien. Otros: 1 reiniciar, -1 fallo, -2 modo no valido, -3 no actualizado, -4/-5 parametros, -6 pantallas duplicadas, -100 no se encontro el modo
  public static int Set(string dev, int w, int h, int hz, bool save) {
    DEVMODE want = NewMode(); bool found = false, cur0 = false;
    DEVMODE cur = NewMode(); cur0 = EnumSettings(dev, CUR, ref cur, 0);
    for (int i = 0; ; i++) {
      DEVMODE m = NewMode();
      if (!EnumSettings(dev, i, ref m, 0)) break;
      if (m.dmPelsWidth != w || m.dmPelsHeight != h) continue;
      if (hz > 0 && m.dmDisplayFrequency != hz) continue;
      if (cur0 && m.dmBitsPerPel != cur.dmBitsPerPel) continue;
      if (cur0 && m.dmDisplayOrientation != cur.dmDisplayOrientation) continue;
      want = m; found = true; break;
    }
    if (!found) return -100;
    int t = Change(dev, ref want, IntPtr.Zero, CDS_TEST, IntPtr.Zero);   // primero se comprueba sin tocar nada
    if (t != 0) return t;
    return Change(dev, ref want, IntPtr.Zero, save ? CDS_UPDATEREGISTRY : 0, IntPtr.Zero);
  }
  // NULL + 0 = "vuelve al modo guardado en el registro"
  public static int Revert(string dev) { return ChangeNull(dev, IntPtr.Zero, IntPtr.Zero, 0, IntPtr.Zero); }
}
"@
try {
  $dev = [GsDisp]::Primary()
  if (-not $dev) { Write-Output 'ERR no hay pantalla'; exit 2 }
  switch ($Action) {
    'list'   { [GsDisp]::List($dev) | ForEach-Object { Write-Output $_ } }
    'set'    { $r = [GsDisp]::Set($dev, $W, $H, $Hz, $false); Write-Output "RES $r"; if ($r -ne 0) { exit 3 } }
    'save'   { $r = [GsDisp]::Set($dev, $W, $H, $Hz, $true);  Write-Output "RES $r"; if ($r -ne 0) { exit 3 } }
    'revert' { $r = [GsDisp]::Revert($dev); Write-Output "RES $r"; if ($r -ne 0) { exit 3 } }
    default  { Write-Output 'ERR accion desconocida'; exit 2 }
  }
} catch { Write-Output ('ERR ' + $_.Exception.Message); exit 1 }
