'use strict';
// GameShell · contador de FPS dentro de los juegos (solo eso: un número arriba a la derecha).
//
// Cómo mide: con PresentMon (Intel, licencia MIT, https://github.com/GameTechDev/PresentMon). PresentMon lee los eventos de «presentación de fotograma» que Windows
// ya genera (ETW), así que sirve para cualquier juego DirectX / OpenGL / Vulkan sin inyectar nada dentro del juego (por eso no da problemas con antitrampas).
//   · El .exe de PresentMon no viene dentro de GameShell: se descarga desde Opciones → Contador de FPS (o se deja en launcher\bin o en %APPDATA%\gameshell\bin).
//   · Windows solo deja leer esos eventos a administradores o a quien esté en el grupo «Usuarios del registro de rendimiento»: Opciones → Contador de FPS → «Dar permiso»
//     lo hace una vez (pide confirmación de administrador) y hay que cerrar sesión / reiniciar para que Windows lo aplique.
// El número se dibuja en una ventana transparente, siempre encima y que no recibe ratón ni teclado (fps.html). En un juego en pantalla completa «exclusiva» de verdad
// (muy raro hoy en día: casi todos usan «sin bordes») Windows no deja dibujar nada encima; en ese caso no se verá.
//
// Todo lo que decide qué número sale (leer el CSV de PresentMon, elegir el programa que toca) está en funciones puras al principio, para poder probarlas sin Windows.
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

// ───────────── lectura del CSV de PresentMon ─────────────
// La cabecera cambia según la versión (v1: msBetweenPresents · v2: MsBetweenPresents / FrameTime), así que se busca por nombre sin mirar mayúsculas.
function splitCsv(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const MS_COLS = ['msbetweenpresents', 'frametime'], T_COLS = ['timeinseconds', 'cpustarttime', 'timeinms'], T_MS = { timeinseconds: 1000, cpustarttime: 1, timeinms: 1 };   // el tiempo va en segundos (v1) o en ms (v2)
function parseHeader(cols) {
  const low = cols.map(c => c.trim().toLowerCase()), at = n => low.indexOf(n);
  const app = at('application'), pid = at('processid');
  if (app < 0 || pid < 0) return null;
  const ms = MS_COLS.map(at).find(i => i >= 0), t = T_COLS.map(at).find(i => i >= 0);
  if (ms === undefined && t === undefined) return null;
  const tn = T_COLS.find(n => at(n) >= 0);
  return { app, pid, chain: at('swapchainaddress'), ms: ms === undefined ? -1 : ms, t: t === undefined ? -1 : t, tScale: tn ? T_MS[tn] : 1 };
}

// Un «medidor» por cada ejecución de PresentMon: recibe líneas y, cuando se le pide, dice cuántos FPS lleva el programa elegido.
// Cada cadena de intercambio (swap chain) de cada proceso lleva su propia cuenta; lo que cuenta es la última medio segundo… un segundo de fotogramas.
const WIN_MS = 1000, MAX_FRAMES = 240, ALIVE_MS = 1800;
const EXCLUDE = new Set(['dwm.exe', 'explorer.exe', 'applicationframehost.exe', 'searchhost.exe', 'startmenuexperiencehost.exe', 'shellexperiencehost.exe', 'textinputhost.exe',
  'widgets.exe', 'msedgewebview2.exe', 'systemsettings.exe', 'lockapp.exe', 'taskmgr.exe', 'powershell.exe', 'conhost.exe', 'presentmon.exe']);
function createMeter(opts = {}) {
  const now = opts.now || Date.now, self = new Set((opts.self || []).map(s => String(s).toLowerCase()));
  let idx = null; const chains = new Map();
  const bad = name => { const n = String(name).toLowerCase(); return EXCLUDE.has(n) || self.has(n) || /^presentmon/.test(n); };
  return {
    feed(line) {
      line = String(line).replace(/\r$/, ''); if (!line) return false;
      const c = splitCsv(line);
      if (!idx) { idx = parseHeader(c); return false; }
      if (c.length <= Math.max(idx.app, idx.pid)) return false;
      const app = c[idx.app].trim(), pid = +c[idx.pid]; if (!app || !(pid > 0)) return false;
      const key = pid + '|' + (idx.chain >= 0 ? c[idx.chain] : ''), t = now();
      let e = chains.get(key); if (!e) chains.set(key, e = { app, pid, q: [], sum: 0, last: 0, lastT: NaN });
      let ms = idx.ms >= 0 ? parseFloat(c[idx.ms]) : NaN;
      if (!(ms > 0) && idx.t >= 0) { const tt = parseFloat(c[idx.t]) * idx.tScale; if (isFinite(tt) && isFinite(e.lastT)) ms = tt - e.lastT; e.lastT = tt; }   // sin columna de «ms entre fotogramas»: se saca de las horas
      else if (idx.t >= 0) e.lastT = parseFloat(c[idx.t]) * idx.tScale;
      e.last = t;
      if (!(ms > 0.05) || ms > 5000) return true;                                 // el primer fotograma de cada cadena no tiene anterior; más de 5 s no es un fotograma, es una pausa
      e.q.push(ms); e.sum += ms;
      while (e.q.length > MAX_FRAMES || (e.sum > WIN_MS && e.q.length > 2 && e.sum - e.q[0] >= WIN_MS)) e.sum -= e.q.shift();
      return true;
    },
    // fg = nombre del programa que tiene el foco (sin .exe, como lo da el vigía) · want = el .exe que lanzó GameShell · devuelve { app, pid, fps } o null
    pick(fg, want) {
      const t = now(), live = [...chains.values()].filter(e => t - e.last < ALIVE_MS && e.q.length >= 2 && !bad(e.app));
      for (const [k, e] of chains) if (t - e.last > 20000) chains.delete(k);       // cadenas que ya no existen
      if (!live.length) return null;
      const fps = e => e.q.length / (e.sum / 1000), base = s => String(s || '').toLowerCase().replace(/\.exe$/, '');
      const same = n => live.filter(e => base(e.app) === base(n));
      let c = fg ? same(fg) : []; if (!c.length && want) c = same(want); if (!c.length) c = live;
      const best = c.reduce((a, b) => fps(b) > fps(a) ? b : a);                    // si un juego tiene varias cadenas (overlays), manda la que más fotogramas da
      return { app: best.app, pid: best.pid, fps: fps(best) };
    },
    reset() { chains.clear(); }
  };
}

// ───────────── permiso de Windows: entrar en «Usuarios del registro de rendimiento» ─────────────
// PresentMon solo funciona con administrador o con ese grupo (SID S-1-5-32-559: su nombre cambia con el idioma de Windows, el SID no).
// Esto es lo que corre con permisos de administrador. Prueba tres caminos, de más a menos básico, y apunta en un informe (rep) qué pasó con cada uno, porque desde fuera no se ve nada de lo que hace:
//   1) «net localgroup» (lo más viejo y fiable de Windows) con el nombre del grupo sacado del SID, primero con DOMINIO\usuario y luego solo con el usuario;
//   2) los cmdlets de PowerShell (Add-LocalGroupMember) con el SID del grupo y el SID de tu usuario (vale también para cuentas Microsoft / Azure AD);
//   3) ADSI (WinNT://).
// Última línea del informe: «RESULTADO ok» (ya estabas en el grupo o te acaba de meter) o «RESULTADO fallo». Sale con 0 / 3.
const PERF_SID = 'S-1-5-32-559';
const psq = t => String(t).replace(/'/g, "''");                                   // dentro de comillas simples de PowerShell
const b64 = t => Buffer.from(t, 'utf16le').toString('base64');                    // -EncodedCommand: sin comillas que escapar en ningún nivel (acentos y espacios incluidos)
function permissionScripts({ user, sid, rep }) {
  const inner = [
    "$ErrorActionPreference = 'Continue'",
    `$rep = '${psq(rep)}'; $u = '${psq(user)}'; $sid = '${psq(sid || '')}'`,
    'function Nota($t) { try { Add-Content -LiteralPath $rep -Value $t -Encoding UTF8 } catch {} }',
    "$n = 'Performance Log Users'",
    `try { $n = (New-Object System.Security.Principal.SecurityIdentifier('${PERF_SID}')).Translate([System.Security.Principal.NTAccount]).Value.Split('\\')[-1] } catch { Nota ('grupo: ' + $_.Exception.Message) }`,
    "Nota ('grupo=' + $n + ' usuario=' + $u + ' sid=' + $sid)",
    '$ok = $false',
    "foreach ($m in @($u, $u.Split('\\')[-1])) {",
    '  if ($ok) { break }',
    '  try { $o = (& net.exe localgroup $n $m /add 2>&1 | Out-String); $c = $LASTEXITCODE } catch { $o = $_.Exception.Message; $c = -1 }',
    "  Nota ('net localgroup ' + $m + ' -> codigo ' + $c + ' ' + $o.Trim())",
    "  if ($c -eq 0 -or $o -match '1378') { $ok = $true; if ($c -ne 0) { Nota 'ya era miembro' } }",
    '}',
    'if (-not $ok -and $sid) {',
    `  try { Add-LocalGroupMember -SID '${PERF_SID}' -Member $sid -ErrorAction Stop; $ok = $true; Nota 'Add-LocalGroupMember: bien' }`,
    "  catch { if ($_.Exception.GetType().Name -like '*MemberExists*' -or $_.Exception.Message -match '1378') { $ok = $true; Nota 'ya era miembro' } else { Nota ('Add-LocalGroupMember: ' + $_.Exception.GetType().Name + ': ' + $_.Exception.Message) } }",
    '}',
    'if (-not $ok) {',
    "  try { ([ADSI]('WinNT://./' + $n + ',group')).Add('WinNT://' + $u.Replace('\\', '/')); $ok = $true; Nota 'ADSI: bien' }",
    "  catch { if ($_.Exception.Message -match '1378') { $ok = $true; Nota 'ya era miembro' } else { Nota ('ADSI: ' + $_.Exception.Message) } }",
    '}',
    "if ($ok) { Nota 'RESULTADO ok'; exit 0 } else { Nota 'RESULTADO fallo'; exit 3 }"
  ].join('\n');
  // 9 = no se llegó a elevar (p. ej. se canceló la ventana de administrador). El .ExitCode vacío no cuenta como «bien»: si no hay número, es 8.
  const outer = `$ErrorActionPreference = 'Stop'; try { $p = Start-Process -FilePath powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${b64(inner)}'; if ($p -and $p.ExitCode -ne $null) { exit $p.ExitCode } else { exit 8 } } catch { exit 9 }`;
  return { inner, outer };
}
// ¿qué pasó? code = código de salida del PowerShell de fuera · text = el informe que dejó el de dentro. Devuelve { ok, already, msg, why }
const NET_WHY = [[/^(1332|1387|2221)$/, 'Windows no encuentra tu usuario'], [/^(1376|2220)$/, 'Windows no encuentra el grupo'], [/^5$/, 'acceso denegado: ¿tu usuario es administrador?']];
function judgePermission(code, text) {
  const t = String(text || '');
  const done = /RESULTADO ok/.test(t), failed = /RESULTADO fallo/.test(t);
  if (done || (!failed && code === 0)) {
    const already = /ya era miembro/.test(t);
    return { ok: true, already, msg: (already ? 'Ya estabas en el grupo. ' : 'Hecho. ') + 'Cierra la sesión de Windows y vuelve a entrar (o reinicia) para que funcione' };
  }
  if (!failed && code === 9) return { ok: false, msg: 'No se pudo: ¿cancelaste la confirmación de administrador?' };
  let why = '';
  for (const m of t.matchAll(/(?:system error|error de sistema)\s+(\d+)/gi)) { const w = NET_WHY.find(([re]) => re.test(m[1])); if (w) { why = w[1]; break; } }
  return { ok: false, why, msg: failed || code === 3 ? 'Windows no dejó añadirte al grupo' + (why ? ' (' + why + ')' : '') + ' · detalles en gameshell.log' : 'No se pudo dar el permiso · detalles en gameshell.log' };
}

// ───────────── buscar, descargar y lanzar PresentMon ─────────────
const EXE_RE = /^presentmon.*\.exe$/i;
function findTool(dirs) {
  if (process.env.GS_FPS_TOOL && fs.existsSync(process.env.GS_FPS_TOOL)) return process.env.GS_FPS_TOOL;
  for (const d of dirs) {
    let l = []; try { l = fs.readdirSync(d).filter(f => EXE_RE.test(f)); } catch {}
    l.sort((a, b) => (a.toLowerCase() === 'presentmon.exe' ? -1 : b.toLowerCase() === 'presentmon.exe' ? 1 : b.localeCompare(a, undefined, { numeric: true })));
    if (l.length) return path.join(d, l[0]);
  }
  return '';
}

function create(env) {
  const { app, BrowserWindow, screen, net, shell, globalShortcut, log, getFg, getWin } = env;
  const win32 = process.platform === 'win32';
  const dirs = () => [path.join(app.getPath('userData'), 'bin'), path.join(__dirname, 'bin')];
  const tool = () => findTool(dirs());
  const selfNames = () => [path.basename(process.execPath), 'electron.exe', 'GameShell.exe'];
  const cfg = { on: false, size: 1, word: true };   // word: la palabra «FPS» junto al número
  const permFile = () => path.join(app.getPath('userData'), 'fps-permiso.json');
  let permBusy = false;
  // quién soy: el nombre sale del entorno (con acentos bien) y el SID de whoami (solo números y letras, sin problemas de codificación de la consola)
  const whoAmI = () => new Promise(res => {
    const user = (process.env.USERDOMAIN ? process.env.USERDOMAIN + '\\' : '') + os.userInfo().username;
    execFile('whoami', ['/user', '/fo', 'csv', '/nh'], { windowsHide: true, timeout: 8000 }, (e, out) => {
      let sid = ''; if (!e) { const c = splitCsv(String(out).trim().split(/\r?\n/)[0] || ''); if (/^S-1-\d+(-\d+){1,14}$/.test((c[1] || '').trim())) sid = c[1].trim(); }
      res({ user, sid });
    });
  });
  let proc = null, meter = null, ov = null, ovReady = false, timer = 0, game = null, hidden = false, err = '', started = 0, shown = false, testT = 0, lastTxt = '';

  // ---- la ventana del número ----
  const BASE_W = 230, BASE_H = 96, MARGIN = 14;
  function bounds() {
    // la ventana nunca es más pequeña que la de 100 %: con 50 % o 75 % el número se hace pequeño DENTRO (pegado arriba a la derecha), pero la ventana, que es transparente y no recibe ratón,
    // no se encoge: así no hay riesgo de que Windows la recorte o la desplace si impone un tamaño mínimo
    const d = screen.getPrimaryDisplay().bounds, s = Math.max(.5, Math.min(3, cfg.size || 1)), w = Math.max(BASE_W, Math.ceil(BASE_W * s)), h = Math.max(BASE_H, Math.ceil(BASE_H * s)), m = Math.round(MARGIN * s);
    return { x: d.x + d.width - w - m, y: d.y + m, width: w, height: h };
  }
  function overlay() {
    if (ov && !ov.isDestroyed()) return ov;
    ovReady = false;
    ov = new BrowserWindow({ ...bounds(), frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false, focusable: false,
      skipTaskbar: true, alwaysOnTop: true, hasShadow: false, show: false, backgroundColor: '#00000000', thickFrame: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, devTools: false } });
    ov.setIgnoreMouseEvents(true);                                    // el ratón «atraviesa» el contador
    try { ov.setAlwaysOnTop(true, 'screen-saver'); } catch {}         // por encima de los juegos en ventana sin bordes
    ov.webContents.once('did-finish-load', () => { ovReady = true; paint(); });
    ov.on('closed', () => { ov = null; ovReady = false; shown = false; });
    ov.loadFile(path.join(__dirname, 'fps.html'));
    return ov;
  }
  const js = code => { try { if (ov && !ov.isDestroyed() && ovReady) ov.webContents.executeJavaScript(code).catch(() => {}); } catch {} };
  function paint() { js(`window.__s(${JSON.stringify(+(cfg.size || 1).toFixed(2))},${JSON.stringify(lastTxt)},${cfg.word ? 'true' : 'false'})`); }
  function setText(t) { lastTxt = t; paint(); }
  function show(v) {
    if (v && !(ov && !ov.isDestroyed())) overlay();
    if (!ov || ov.isDestroyed()) return;
    if (v === shown) return;
    shown = v;
    if (v) { ov.setBounds(bounds()); ov.showInactive(); try { ov.setAlwaysOnTop(true, 'screen-saver'); } catch {} } else ov.hide();
  }
  const isLauncherFg = fg => { const n = String(fg || '').split('|')[0].toLowerCase(); return !!n && selfNames().some(s => path.basename(s, '.exe').toLowerCase() === n); };

  // ---- medir ----
  function tick() {
    if (testT) return;                                              // mientras se enseña la prueba no se toca
    if (!proc || !meter) return show(false);
    const fg = getFg() || '', r = meter.pick(fg.split('|')[0] || '', game && game.exe);
    if (hidden || !r || isLauncherFg(fg)) return show(false);        // con el launcher delante o sin datos, no se enseña
    setText(String(Math.round(r.fps)));
    show(true);
  }
  // Parámetros de PresentMon, del más ajustado al más básico: si esta versión no conoce alguno y se cierra al instante, se prueba el siguiente
  // (el último es el de PresentMon 1.x, que usa un solo guion). Con GS_FPS_TOOL (pruebas) no se pasa ninguno.
  const ARGS = [
    ['--output_stdout', '--no_console_stats', '--no_track_display', '--no_track_gpu', '--no_track_input', '--session_name', 'GameShellFPS', '--stop_existing_session'],
    ['--output_stdout', '--session_name', 'GameShellFPS', '--stop_existing_session'],
    ['-output_stdout', '-no_top', '-session_name', 'GameShellFPS', '-stop_existing_session']
  ];
  let lvOk = 0;                                                      // el último juego de parámetros que funcionó (se recuerda mientras el launcher siga abierto)
  function startMeter(lv = lvOk) {
    if (proc) return true;
    const exe = tool();
    if (!exe) { err = 'sin-medidor'; log('FPS: no hay PresentMon (launcher\\bin o %APPDATA%\\gameshell\\bin)'); return false; }
    if (!win32 && !process.env.GS_FPS_TOOL) { err = 'solo-windows'; return false; }
    err = ''; meter = createMeter({ self: selfNames() });
    // --no_track_*: no hace falta saber nada de la pantalla ni de la GPU, solo cuándo se presenta cada fotograma (así pesa mucho menos)
    let p; try { p = spawn(exe, process.env.GS_FPS_TOOL ? [] : ARGS[lv], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { err = 'fallo'; log('FPS: no arranca', e.message); return false; }
    proc = p; started = Date.now(); let buf = '', ebuf = '';
    const okT = setTimeout(() => { if (proc === p) lvOk = lv; }, 6500);
    p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { meter.feed(buf.slice(0, i)); buf = buf.slice(i + 1); } if (buf.length > 1e5) buf = ''; });
    p.stderr.on('data', d => { ebuf = (ebuf + d).slice(-2000); });
    p.on('error', e => { err = 'fallo'; log('FPS: error', e.message); if (proc === p) { proc = null; stopTimer(); } });
    p.on('exit', code => {
      clearTimeout(okT); const mine = proc === p;
      if (mine) { proc = null; stopTimer(); }
      const early = Date.now() - started < 6000 && code, denied = /access is denied|access denied|acceso denegado|Performance Log Users/i.test(ebuf);
      if (early) err = denied ? 'permiso' : 'fallo';
      log('FPS: PresentMon terminó', code, err || '', ebuf.trim().split('\n').slice(-2).join(' | '));
      if (mine && early && !denied && !process.env.GS_FPS_TOOL && lv + 1 < ARGS.length) { log('FPS: se prueba con otros parámetros de PresentMon'); return startMeter(lv + 1); }
      show(false);
    });
    timer = setInterval(tick, 500);
    log('FPS: medidor en marcha', exe);
    return true;
  }
  function stopTimer() { clearInterval(timer); timer = 0; }
  function stopMeter() {
    stopTimer();
    if (proc) { const p = proc; proc = null; try { p.kill(); } catch {} }
    meter = null; show(false);
  }

  const api = {
    // se llama con la ventana del launcher o con los ajustes (ui.json): tamaño y si debe arrancar solo con cada juego
    configure(ui) {
      const was = cfg.on;
      cfg.on = !!(ui && ui.fpsOn); cfg.size = ui && typeof ui.fpsSize === 'number' ? ui.fpsSize : 1; cfg.word = !(ui && ui.fpsWord === false);
      if (ov && !ov.isDestroyed()) { ov.setBounds(bounds()); paint(); }
      // «Mostrar en los juegos» cambia CON UN JUEGO YA ABIERTO (se vuelve al launcher con Alt+Tab y se cambia el ajuste): el efecto es inmediato.
      // Antes solo se miraba al abrir el juego, así que apagarlo o encenderlo no se notaba hasta cerrar el juego y abrirlo de nuevo.
      // Solo se actúa cuando el ajuste CAMBIA (cambiar el tamaño no apaga un contador que se encendió a mano con Ctrl+Mayús+F).
      if (cfg.on === was) return;
      if (cfg.on) { if (game && !proc) { hidden = false; startMeter(); } }
      else { hidden = false; stopMeter(); }
    },
    // un juego acaba de arrancar desde GameShell
    gameStarted(g) {
      game = g || null; hidden = false; err = '';
      if (cfg.on) startMeter();
    },
    gameEnded() { game = null; stopMeter(); },
    // Ctrl+Mayús+F dentro del juego: lo arranca si no estaba (aunque «arrancar solo» esté apagado) y, si ya estaba, lo muestra u oculta
    toggle() {
      if (!proc) { hidden = false; return startMeter(); }
      hidden = !hidden; tick(); return true;
    },
    // enseña el número unos segundos con el tamaño elegido, para ver cómo queda sin abrir ningún juego
    test(ms = 4000) {
      clearTimeout(testT); show(false);
      const was = lastTxt; lastTxt = '144';
      overlay(); paint();
      const go = () => { if (!ov || ov.isDestroyed()) return; ov.setBounds(bounds()); paint(); shown = false; show(true); };
      if (ovReady) go(); else ov.webContents.once('did-finish-load', () => setTimeout(go, 50));
      testT = setTimeout(() => { testT = 0; lastTxt = was; show(false); tick(); }, Math.max(800, Math.min(15000, +ms || 4000)));
      return true;
    },
    async state() {
      const t = tool();
      let perm = null;
      if (win32) perm = await new Promise(res => execFile('whoami', ['/groups', '/fo', 'csv', '/nh'], { windowsHide: true, timeout: 8000 }, (e, out) => res(e ? null : /S-1-5-32-559|S-1-16-12288|S-1-16-16384/.test(String(out)))));
      // pending: te añadió al grupo hace poco pero Windows aún no lo aplica (hace falta cerrar sesión): el permiso se anota en fps-permiso.json con la hora y, si es posterior a cuando arrancó el launcher, está pendiente
      let pending = false;
      if (perm === false) try { pending = +JSON.parse(fs.readFileSync(permFile(), 'utf8')).t > Date.now() - process.uptime() * 1000; } catch {}
      return { platform: process.platform, win32, tool: t, toolName: t ? path.basename(t) : '', perm, pending, running: !!proc, err, dir: dirs()[0] };
    },
    openDir() { const d = dirs()[0]; try { fs.mkdirSync(d, { recursive: true }); } catch {} return shell.openPath(d).then(r => !r); },
    // baja PresentMon (solo el .exe de consola, x64) de la última versión publicada en GitHub y comprueba que es un ejecutable de Windows (y su suma SHA-256 si GitHub la da)
    async download() {
      if (!win32) return { ok: false, msg: 'Solo en Windows' };
      try {
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 20000);
        const r = await net.fetch('https://api.github.com/repos/GameTechDev/PresentMon/releases/latest', { signal: ctl.signal, headers: { 'User-Agent': 'GameShell', Accept: 'application/vnd.github+json' } });
        clearTimeout(to); if (!r.ok) return { ok: false, msg: 'GitHub no responde (' + r.status + ')' };
        const j = await r.json(), a = (j.assets || []).find(x => /^PresentMon-[\d.]+-x64\.exe$/i.test(x.name)) || (j.assets || []).find(x => /x64\.exe$/i.test(x.name) && !/install|service|setup/i.test(x.name));
        if (!a || !/^https:\/\/github\.com\//.test(a.browser_download_url || '')) return { ok: false, msg: 'No encuentro el programa en la última versión' };
        const ctl2 = new AbortController(), to2 = setTimeout(() => ctl2.abort(), 120000);
        const f = await net.fetch(a.browser_download_url, { signal: ctl2.signal, headers: { 'User-Agent': 'GameShell' } });
        if (!f.ok) { clearTimeout(to2); return { ok: false, msg: 'No se pudo descargar (' + f.status + ')' }; }
        const buf = Buffer.from(await f.arrayBuffer()); clearTimeout(to2);
        if (buf.length < 100e3 || buf.length > 80e6 || buf[0] !== 0x4d || buf[1] !== 0x5a) return { ok: false, msg: 'Lo descargado no es un programa de Windows' };
        const dg = /^sha256:([0-9a-f]{64})$/i.exec(a.digest || '');
        if (dg && crypto.createHash('sha256').update(buf).digest('hex') !== dg[1].toLowerCase()) return { ok: false, msg: 'La descarga no coincide con la suma de comprobación de GitHub' };
        const d = dirs()[0]; fs.mkdirSync(d, { recursive: true });
        const dst = path.join(d, 'PresentMon.exe'); fs.writeFileSync(dst + '.tmp', buf); fs.renameSync(dst + '.tmp', dst);
        log('FPS: PresentMon descargado', a.name, buf.length, 'bytes', dg ? '(suma comprobada)' : '(sin suma que comprobar)');
        return { ok: true, msg: a.name.replace(/\.exe$/i, '') + ' instalado' };
      } catch (e) { log('FPS: descarga', e.message); return { ok: false, msg: 'No se pudo descargar: ' + (e.name === 'AbortError' ? 'tarda demasiado' : e.message) }; }
    },
    // mete a tu usuario en «Usuarios del registro de rendimiento» (permiso de una sola vez; Windows pide confirmar como administrador). Ver permissionScripts: prueba varios caminos
    // y deja un informe (%APPDATA%\\gameshell\\permiso-fps.txt) que se copia a gameshell.log, para saber el motivo exacto si algo falla.
    async permission() {
      if (!win32) return { ok: false, msg: 'Solo en Windows' };
      if (permBusy) return { ok: false, msg: 'Ya se está pidiendo el permiso: mira si hay una ventana de Windows esperando' };
      permBusy = true;
      try {
        const me = await whoAmI();
        if (!/^[\p{L}\p{N}_ .\\@$-]{1,100}$/u.test(me.user)) return { ok: false, msg: 'Nombre de usuario raro: hazlo a mano (léelo en LEEME.md)' };
        const rep = path.join(app.getPath('userData'), 'permiso-fps.txt');
        try { fs.mkdirSync(path.dirname(rep), { recursive: true }); fs.writeFileSync(rep, ''); } catch (e) { log('FPS: permiso, no se puede crear el informe', e.message); }
        const { outer } = permissionScripts({ user: me.user, sid: me.sid, rep });
        const code = await new Promise(res => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', b64(outer)], { windowsHide: true, timeout: 120000 }, e => res(e ? (typeof e.code === 'number' ? e.code : -1) : 0)));
        let text = ''; try { text = fs.readFileSync(rep, 'utf8').replace(/^\uFEFF/, ''); } catch {}
        log('FPS: permiso, PowerShell terminó con código', code);
        for (const l of text.split(/\r?\n/)) if (l.trim()) log('FPS: permiso ·', l.trim().slice(0, 300));
        const r = judgePermission(code, text);
        if (r.ok) { try { fs.writeFileSync(permFile(), JSON.stringify({ t: Date.now(), user: me.user })); } catch {} log('FPS: usuario en el grupo «Usuarios del registro de rendimiento»'); }
        return { ok: r.ok, msg: r.msg };
      } catch (e) { log('FPS: permiso', e.message); return { ok: false, msg: 'No se pudo dar el permiso · detalles en gameshell.log' }; }
      finally { permBusy = false; }
    },
    quit() { stopMeter(); clearTimeout(testT); try { if (ov && !ov.isDestroyed()) ov.destroy(); } catch {} },
    _meter: createMeter
  };
  return api;
}

module.exports = { create, createMeter, parseHeader, splitCsv, findTool, permissionScripts, judgePermission };
