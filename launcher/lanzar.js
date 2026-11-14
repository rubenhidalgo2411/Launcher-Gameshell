'use strict';
// GameShell · cómo se abre cada cosa que se añade al launcher («Añadir juego»).
//
//  · .exe                          → se ejecuta directamente (como siempre).
//  · .bat .cmd                     → con cmd.exe (Node ya no deja lanzar un .bat sin pasar por cmd).
//  · .ps1                          → con PowerShell, sin que la política de scripts de Windows lo bloquee.
//  · .py .pyw                      → con Python (el lanzador «py» si está; si no, python / pythonw).
//  · .vbs .vbe .wsf                → con Windows Script Host (wscript).
//  · .jar                          → con Java (javaw), si está instalado.
//  · todo lo demás (.lnk .url …)   → como si le dieras doble clic en el Explorador (shell.openPath): accesos directos, atajos de Steam / Epic (.url), etc.
// Si falta el intérprete (p. ej. no hay Python), también se cae a «abrir con lo que tenga Windows».
//
// Aquí solo se DECIDE qué ejecutar y con qué argumentos (plan); main.js lo ejecuta. Así se puede probar sin Windows.
const path = require('path');
const fs = require('fs');

// extensión → cómo se abre
const KINDS = { '.exe': 'exe', '.bat': 'cmd', '.cmd': 'cmd', '.ps1': 'ps1', '.py': 'py', '.pyw': 'pyw', '.vbs': 'wsh', '.vbe': 'wsh', '.wsf': 'wsh', '.jar': 'jar' };
const kindOf = p => KINDS[path.extname(String(p || '')).toLowerCase()] || 'open';

// filtros del cuadro de «Añadir juego»: el primero es el que sale de entrada
const FILTERS = [
  { name: 'Programas y scripts', extensions: ['exe', 'bat', 'cmd', 'ps1', 'py', 'pyw', 'vbs', 'jar', 'lnk', 'url'] },
  { name: 'Programas (.exe)', extensions: ['exe'] },
  { name: 'Scripts (.bat .cmd .ps1 .py .pyw .vbs)', extensions: ['bat', 'cmd', 'ps1', 'py', 'pyw', 'vbs'] },
  { name: 'Accesos directos (.lnk .url)', extensions: ['lnk', 'url'] },
  { name: 'Todos los archivos', extensions: ['*'] }
];

// busca un programa en el PATH (y en un par de sitios típicos de Windows). Devuelve su ruta o '' si no está.
function which(name, env = process.env, platform = process.platform, exists = fs.existsSync) {
  const win = platform === 'win32', P = win ? path.win32 : path;
  const dirs = String(env.PATH || env.Path || '').split(win ? ';' : ':').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
  const extra = win ? [env.SystemRoot, env.LOCALAPPDATA && P.join(env.LOCALAPPDATA, 'Programs', 'Python', 'Launcher')].filter(Boolean) : [];
  for (const d of [...dirs, ...extra]) { const f = P.join(d, name); try { if (exists(f)) return f; } catch {} }
  return '';
}

// plan(ruta, { platform, hide, env, which }) →
//   { via: 'spawn', kind, exe, file, args, options }   ejecutar file con args (options son los de child_process.spawn)
//   { via: 'open',  kind, exe: '' }                    abrirlo con shell.openPath(ruta)
// hide: sin ventana de consola (para lo que se abre solo al iniciar). exe: el nombre del .exe (solo si es un .exe: sirve para saber si ya está abierto y para el contador de FPS).
function plan(p, o = {}) {
  const platform = o.platform || process.platform, win = platform === 'win32', P = win ? path.win32 : path;
  const env = o.env || process.env, find = o.which || (n => which(n, env, platform)), hide = !!o.hide;
  const kind = kindOf(p), base = { cwd: P.dirname(p), detached: true, stdio: 'ignore', windowsHide: hide };
  const open = () => ({ via: 'open', kind, exe: '' });
  const run = (file, args, extra) => ({ via: 'spawn', kind, exe: '', file, args, options: { ...base, ...(extra || {}) } });
  if (kind === 'exe') return { ...run(p, []), exe: P.basename(p) };      // (fuera de Windows también se ejecuta tal cual, como antes)
  if (kind === 'open' || !win) return open();
  const q = s => '"' + s + '"', cmd = env.ComSpec || 'cmd.exe';
  // cmd /d /s /c "…": con /s cmd quita las comillas de fuera y deja lo de dentro tal cual; por eso va una pareja de comillas de más y los argumentos «verbatim»
  const viaCmd = line => run(cmd, ['/d', '/s', '/c', '"' + line + '"'], { windowsVerbatimArguments: true });
  switch (kind) {
    case 'cmd': return viaCmd(q(p));
    case 'ps1': return run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', p]);
    case 'wsh': return run('wscript.exe', [p]);
    case 'jar': { const j = find('javaw.exe'); return j ? run(j, ['-jar', p]) : open(); }
    case 'py': case 'pyw': {
      const gui = kind === 'pyw', lanzador = find(gui ? 'pyw.exe' : 'py.exe'), directo = find(gui ? 'pythonw.exe' : 'python.exe');
      const it = lanzador ? [lanzador, ['-3']] : directo ? [directo, []] : null;
      if (!it) return open();
      if (gui || hide) return run(it[0], [...it[1], p]);
      // con ventana de consola: si el script falla, la ventana espera una tecla (si no, se cerraría antes de poder leer el error)
      return viaCmd([q(it[0]), ...it[1], q(p)].join(' ') + ' & if errorlevel 1 pause');
    }
  }
  return open();
}

module.exports = { KINDS, FILTERS, kindOf, which, plan };
