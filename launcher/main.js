const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut, nativeImage, Menu, session, net, screen } = require('electron');
const { spawn, exec, execFile } = require('child_process');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Bloqueo = require('./bloqueo');
const Fps = require('./fps');            // contador de FPS dentro de los juegos
const Pantalla = require('./pantalla');  // cambiar la resolución sin salir a Windows
const Lanzar = require('./lanzar');      // cómo se abre cada tipo de archivo que se añade (.exe, .bat, .ps1, .py…)
const Buzz = require('./buzz');          // mandos Buzz!: BuzzActivar integrado, en segundo plano

const DEV = process.argv.includes('--dev');
let win, playing = false;
const DB = () => path.join(app.getPath('userData'), 'games.json');
const LOG = () => path.join(app.getPath('userData'), 'gameshell.log');
const log = (...a) => { try { fs.appendFileSync(LOG(), new Date().toISOString() + ' ' + a.join(' ') + '\n'); } catch {} };
process.on('uncaughtException', e => log('error', (e && e.stack) || e)); // un fallo suelto no debe tumbar la shell
// games.json: si se lee mal se usa la copia .bak (antes un fallo puntual de lectura dejaba la lista vacía)
const read = f => { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(j) ? j : null; } catch { return null; } };
const load = () => read(DB()) || read(DB() + '.bak') || [];
const save = g => {
  fs.mkdirSync(path.dirname(DB()), { recursive: true });
  const cur = read(DB());
  if (cur && cur.length) try { fs.copyFileSync(DB(), DB() + '.bak'); } catch {}
  fs.writeFileSync(DB() + '.tmp', JSON.stringify(g, null, 1)); fs.renameSync(DB() + '.tmp', DB());
};

const baseName = p => path.basename(p, path.extname(p)).replace(/[_.-]+/g, ' ').trim(); // el nombre que sale al añadir un .exe (el original, para poder volver a él)
const cache = new Map();
async function icon(p) {
  if (cache.has(p)) return cache.get(p);
  let d = '';
  try { d = (await nativeImage.createThumbnailFromPath(p, { width: 256, height: 256 })).toDataURL(); }
  catch { try { d = (await app.getFileIcon(p, { size: 'large' })).toDataURL(); } catch {} }
  cache.set(p, d);
  return d;
}

// ---- logo personalizado de cada juego (foto que sube el usuario) ----
const ICONS = () => path.join(app.getPath('userData'), 'iconos');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp', '.ico': 'image/x-icon' };
const LOGOS_B = () => path.join(app.getPath('userData'), 'logos'); // logos que se subieron con «actualizacion» (campo logo)
const ccache = new Map();
function custom(f, dir = ICONS()) {
  try {
    const p = path.join(dir, path.basename(f)), st = fs.statSync(p), key = p + '|' + st.mtimeMs;
    if (ccache.has(key)) return ccache.get(key);
    let out = '';
    const img = nativeImage.createFromPath(p);
    if (!img.isEmpty()) { // se reduce a 640 px como máximo; con transparencia se queda en PNG, sin ella en JPEG (mucho más ligero)
      const { width: w, height: h } = img.getSize(), k = Math.min(1, 960 / Math.max(w, h));
      const r = k < 1 ? img.resize({ width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)), quality: 'best' }) : img;
      const bm = r.toBitmap(); let alpha = false;
      for (let i = 3; i < bm.length; i += 4) if (bm[i] < 250) { alpha = true; break; }
      out = alpha ? r.toDataURL() : 'data:image/jpeg;base64,' + r.toJPEG(90).toString('base64');
    } else if (st.size < 6e6) out = 'data:' + (MIME[path.extname(p).toLowerCase()] || 'image/png') + ';base64,' + fs.readFileSync(p).toString('base64'); // webp/gif/bmp: el navegador los muestra tal cual
    ccache.set(key, out);
    return out;
  } catch (e) { log('logo personalizado:', e.message); return ''; }
}
// foto de la derecha de los estilos PS5: se copia a %APPDATA%\gameshell\carteles (reducida a 2560 px como mucho) y se muestra por su ruta de archivo, sin pasar por IPC
const CARTELES = () => path.join(app.getPath('userData'), 'carteles');
const heroUrl = x => { if (!x || !x.heroImg) return ''; try { const p = path.join(CARTELES(), path.basename(x.heroImg)); fs.statSync(p); return pathToFileURL(p).href; } catch { return ''; } };
const rmHero = x => { if (x && x.heroImg) try { fs.unlinkSync(path.join(CARTELES(), path.basename(x.heroImg))); } catch {} };
const rmIcon = x => { // borra el logo subido, sea del formato de «actualizado» (customIcon) o de «actualizacion» (logo)
  if (x && x.customIcon) try { fs.unlinkSync(path.join(ICONS(), path.basename(x.customIcon))); } catch {}
  if (x && x.logo) try { fs.unlinkSync(path.join(LOGOS_B(), path.basename(x.logo))); } catch {}
};

function home() {
  if (!win || win.isDestroyed()) return;
  playing = false; log('volver al launcher'); try { FPS.gameEnded(); } catch {}
  win.setAlwaysOnTop(true); win.restore(); win.show();
  if (!DEV) { // un juego puede dejar la ventana mal ajustada o sin repintar: se reajusta saliendo y volviendo a pantalla completa
    win.setFullScreen(false);
    setTimeout(() => { if (!win.isDestroyed()) { win.setFullScreen(true); win.setAlwaysOnTop(true); win.focus(); } }, 150);
  }
  win.focus(); win.webContents.invalidate(); win.webContents.send('home');
}
function away() { win.setAlwaysOnTop(false); win.minimize(); }

const slow = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(''), ms))]); // un icono lento no debe dejar la lista vacía
ipcMain.handle('games', async () => {
  const all = load(), folders = new Set(all.filter(x => x.folder).map(x => x.id));
  const out = await Promise.all(all.map(async x => {
    const c = (x.customIcon && custom(x.customIcon)) || (x.logo && custom(x.logo, LOGOS_B())) || '';
    if (x.folder) return { ...x, parent: undefined, orig: x.name, icon: c, cover: !!c, hero: '' };           // subconsola: no tiene programa, solo un logo si le pusiste uno
    const parent = x.parent && folders.has(x.parent) ? x.parent : undefined;                                  // si su subconsola ya no existe, el juego vuelve al inicio
    return { ...x, parent, orig: x.path ? baseName(x.path) : x.name, icon: c || await slow(icon(x.path), 5000), cover: !!c, hero: heroUrl(x) };
  }));
  log('lista:', out.filter(x => !x.folder).length, 'juegos' + (folders.size ? ' · ' + folders.size + ' subconsolas' : ''));
  return out;
});
ipcMain.handle('add', async (_, pw, parent) => {
  if (!auth(pw)) return false;
  const r = await dialog.showOpenDialog(win, { title: 'Añadir juego o script', properties: ['openFile', 'multiSelections'], filters: Lanzar.FILTERS });   // .exe, scripts (.bat .cmd .ps1 .py…), accesos directos… o cualquier archivo
  if (r.canceled) return true;
  const g = load(), into = typeof parent === 'string' && g.some(x => x.id === parent && x.folder) ? parent : '';   // parent: la subconsola a la que se añade (vacío = al inicio)
  for (const p of r.filePaths) {
    const ya = g.find(x => x.path === p);
    if (ya) { if (into && ya.parent !== into) ya.parent = into; continue; }                                    // ya estaba en la lista: si se añade desde una subconsola, pasa a ella
    g.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: baseName(p), path: p, ...(into ? { parent: into } : {}) });
  }
  save(g);
  return true;
});
ipcMain.handle('remove', (_, id) => {
  log('quitar de la lista', id); const g = load(), x = g.find(a => a.id === id); if (x) { rmIcon(x); rmHero(x); }
  save(g.filter(a => a.id !== id).map(a => { if (a.parent !== id) return a; const { parent, ...r } = a; return r; }));   // los juegos de una subconsola quitada no se pierden: vuelven al inicio
});
// renombrar: solo cambia el nombre que sale en el launcher (el .exe no se toca). Texto vacío = el icono se queda SIN nombre; null = vuelve al nombre original.
// Una subconsola sí necesita nombre (si se deja vacío se queda como «Subconsola»).
ipcMain.handle('rename', (_, id, name) => {
  const g = load(), x = g.find(a => a.id === id); if (!x) return false;
  if (name === null) x.name = x.folder ? 'Subconsola' : baseName(x.path);
  else if (typeof name === 'string') x.name = name.trim().slice(0, 60);
  if (x.folder && !x.name) x.name = 'Subconsola';
  save(g); log('renombrar', id, JSON.stringify(x.name)); return true;
});
// subconsolas (carpetas de juegos): una entrada más de games.json con folder:true; los juegos de dentro llevan parent = su id
ipcMain.handle('folder:new', (_, name) => {
  const g = load(), id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  g.push({ id, folder: true, name: (typeof name === 'string' ? name.trim().slice(0, 40) : '') || 'Subconsola' });
  save(g); log('subconsola nueva', id); return id;
});
ipcMain.handle('move:to', (_, id, parent) => {            // mete un juego en una subconsola (o lo saca si parent es null)
  const g = load(), x = g.find(a => a.id === id); if (!x || x.folder) return false;
  if (parent && !g.some(a => a.id === parent && a.folder)) return false;
  if (parent) x.parent = parent; else delete x.parent;
  save(g); log('mover', x.name, '→', parent || 'inicio'); return true;
});
// orden: recibe los ids en el orden nuevo y los recoloca en los mismos huecos de games.json (lo que no se menciona —ocultos, otras subconsolas— no se mueve)
ipcMain.handle('order', (_, ids) => {
  if (!Array.isArray(ids)) return false;
  const g = load(), by = new Map(g.map(x => [x.id, x])), want = [...new Set(ids)].filter(i => by.has(i));
  const slots = []; g.forEach((x, i) => { if (want.includes(x.id)) slots.push(i); });
  if (slots.length !== want.length) return false;
  const out = g.slice(); want.forEach((i, k) => { out[slots[k]] = by.get(i); });
  save(out); return true;
});
ipcMain.handle('auto', (_, id, on) => { log('arranque automático', id, !!on); save(load().map(g => g.id === id ? { ...g, auto: !!on } : g)); });
// abre un programa o script según su tipo (lanzar.js). onExit se llama cuando el proceso termina; con shell.openPath (accesos directos, .url…) no hay proceso que seguir
function spawnPlan(pl, p, onExit) {
  if (pl.via === 'open') { shell.openPath(p).then(err => { if (err) log('abrir con Windows:', p, err); }); return null; }
  let c = null;
  try { c = spawn(pl.file, pl.args, pl.options); }
  catch (e) { log('no arranca (' + e.message + '): se abre con Windows'); shell.openPath(p); return null; }
  c.on('error', e => { log('no arranca (' + e.message + '): se abre con Windows'); shell.openPath(p); });   // p. ej. un .exe que pide permisos de administrador
  if (onExit) c.on('exit', onExit);
  c.unref();
  return c;
}
ipcMain.handle('launch', (_, id) => {
  const g = load().find(x => x.id === id);
  if (!g || g.folder) return;                                    // una subconsola no se lanza: solo se abre la carpeta (en el launcher)
  lockDesktop('abrir un juego'); // con la contraseña puesta, un escritorio que se hubiera quedado abierto no puede quedar debajo del juego
  const t = Date.now(), pl = Lanzar.plan(g.path, { hide: false });
  playing = true; log('abrir', g.name, g.path, '(' + pl.kind + ')');
  win.setAlwaysOnTop(false);
  spawnPlan(pl, g.path, code => {
    const s = Math.round((Date.now() - t) / 1000); log('salió', g.name, 'código', code, s + 's');
    if (s > 15) home();                                    // si sale al instante es un lanzador intermedio: no robar el foco
  });
  try { FPS.gameStarted({ exe: pl.exe, name: g.name }); } catch (e) { log('FPS:', e.message); }   // exe vacío si es un script: el contador mide el juego que tenga el foco
});
// programas marcados con "Abrirlo solo": se abren ocultos al iniciar el launcher (si no están ya abiertos)
function autostart() {
  for (const g of load().filter(x => x.auto)) {
    const pl = Lanzar.plan(g.path, { hide: true });
    const go = () => { log('arranque automático:', g.name); spawnPlan(pl, g.path); };
    if (!pl.exe) { go(); continue; }   // un script o un acceso directo: no hay un .exe que buscar entre los procesos abiertos, así que se abre siempre
    execFile('tasklist', ['/FI', 'IMAGENAME eq ' + pl.exe, '/NH', '/FO', 'CSV'], { windowsHide: true }, (e, out) => {
      if (!e && String(out).toLowerCase().includes('"' + pl.exe.toLowerCase() + '"')) return log('ya estaba abierto', g.name);
      go();
    });
  }
  // el programa puede quedarse con el foco: se lo devolvemos al launcher
  [3000, 8000].forEach(ms => setTimeout(() => { if (!playing && win && !win.isDestroyed()) { win.setAlwaysOnTop(true); win.focus(); } }, ms));
}
// ocultar: la app sigue en la lista (y puede arrancar sola) pero el launcher no la muestra
ipcMain.handle('hide', (_, id, on) => { log('ocultar', id, !!on); save(load().map(g => g.id === id ? { ...g, hidden: !!on } : g)); });
// logo: se elige una imagen, se copia a la carpeta de datos (así no depende de dónde estaba) y se guarda su nombre en la lista
ipcMain.handle('icono', async (_, id) => {
  const g = load(), x = g.find(a => a.id === id);
  if (!x) return false;
  const r = await dialog.showOpenDialog(win, { title: 'Elegir logo', properties: ['openFile'], filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'ico'] }] });
  if (r.canceled || !r.filePaths[0]) return false;
  const src = r.filePaths[0];
  try {
    if (fs.statSync(src).size > 30e6) return 'grande';
    fs.mkdirSync(ICONS(), { recursive: true });
    rmIcon(x); delete x.logo;
    const name = id + path.extname(src).toLowerCase();
    fs.copyFileSync(src, path.join(ICONS(), name));
    x.customIcon = name; save(g); log('logo nuevo', x.name, name);
    return true;
  } catch (e) { log('logo:', e.message); return 'error'; }
});
ipcMain.handle('icono:quitar', (_, id) => { const g = load(), x = g.find(a => a.id === id); if (!x) return; rmIcon(x); delete x.customIcon; delete x.logo; save(g); });
ipcMain.handle('cartel', async (_, id) => {
  const g = load(), x = g.find(a => a.id === id);
  if (!x) return false;
  const r = await dialog.showOpenDialog(win, { title: 'Elegir la foto de la derecha (estilos PS5)', properties: ['openFile'], filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }] });
  if (r.canceled || !r.filePaths[0]) return false;
  const src = r.filePaths[0];
  try {
    if (fs.statSync(src).size > 60e6) return 'grande';
    fs.mkdirSync(CARTELES(), { recursive: true });
    const stamp = id + '-' + Date.now().toString(36);   // nombre nuevo cada vez: así la pantalla nunca enseña la foto anterior
    let name = '';
    const img = nativeImage.createFromPath(src);
    if (!img.isEmpty()) { // se reduce a 2560 px como máximo; con transparencia se queda en PNG, sin ella en JPEG
      const { width: w, height: h } = img.getSize(), k = Math.min(1, 2560 / Math.max(w, h));
      const rz = k < 1 ? img.resize({ width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)), quality: 'best' }) : img;
      const bm = rz.toBitmap(); let alpha = false;
      for (let i = 3; i < bm.length; i += 4) if (bm[i] < 250) { alpha = true; break; }
      name = stamp + (alpha ? '.png' : '.jpg'); fs.writeFileSync(path.join(CARTELES(), name), alpha ? rz.toPNG() : rz.toJPEG(92));
    } else { name = stamp + (path.extname(src).toLowerCase() || '.png'); fs.copyFileSync(src, path.join(CARTELES(), name)); } // webp/gif/bmp: se copia tal cual
    rmHero(x); x.heroImg = name; save(g); log('foto de la derecha', x.name, name);
    return true;
  } catch (e) { log('foto de la derecha:', e.message); return 'error'; }
});
ipcMain.handle('cartel:quitar', (_, id) => { const g = load(), x = g.find(a => a.id === id); if (!x) return; rmHero(x); delete x.heroImg; save(g); });
const SYS = { sleep: 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0', restart: 'shutdown /r /t 0', off: 'shutdown /s /t 0', logout: 'shutdown /l' };
ipcMain.handle('power', (_, k) => { if (SYS[k]) exec(SYS[k]); });

// contraseña para salir al escritorio (solo se guarda su hash en settings.json)
const CFG = () => path.join(app.getPath('userData'), 'settings.json');
const cfg = () => { try { return JSON.parse(fs.readFileSync(CFG(), 'utf8')); } catch { return {}; } };
const saveCfg = c => { fs.mkdirSync(path.dirname(CFG()), { recursive: true }); fs.writeFileSync(CFG(), JSON.stringify(c)); };
const hash = (p, salt) => crypto.scryptSync(String(p || ''), salt, 32);
let lastOk = 0;
const check = p => {
  const c = cfg();
  if (!c.pw) return true;
  let ok = false;
  try { ok = crypto.timingSafeEqual(hash(p, c.salt), Buffer.from(c.pw, 'hex')); } catch {}
  if (ok) lastOk = Date.now();
  return ok;
};
// bloqueado = hay contraseña y no estamos dentro del plazo desde la última vez que se escribió bien
let bypass = false; // modo oculto: dura mientras el launcher siga abierto (toda la sesión)
const locked = () => { const c = cfg(); return !bypass && !!c.pw && !(c.minutes > 0 && Date.now() - lastOk < c.minutes * 60000); };
ipcMain.handle('bypass', () => { bypass = true; });
ipcMain.handle('unbypass', () => { bypass = false; lastOk = 0; lockDesktop('Modo Juego'); }); // Modo Juego = bloqueado como al arrancar (también corta el plazo de la contraseña) y sin escritorio abierto
const auth = p => !locked() || check(p);
ipcMain.handle('cfg', () => { const c = cfg(); return { hasPw: !!c.pw, minutes: c.minutes || 0 }; });
ipcMain.handle('locked', () => locked());
ipcMain.handle('check', (_, p) => check(p));
ipcMain.handle('setpw', (_, cur, n) => {
  if (!auth(cur)) return false;
  const c = cfg();
  if (n) { c.salt = crypto.randomBytes(16).toString('hex'); c.pw = hash(n, c.salt).toString('hex'); }
  else { delete c.pw; delete c.salt; }
  saveCfg(c); return true;
});
ipcMain.handle('setmin', (_, cur, m) => { if (!auth(cur)) return false; const c = cfg(); c.minutes = +m || 0; saveCfg(c); return true; });
ipcMain.handle('desktop', (_, p) => {
  if (!auth(p)) return false;
  away(); spawn('explorer.exe', [], { detached: true, stdio: 'ignore' }).unref();
  return true;
});

// «Cerrar el escritorio de Windows» (Esc → Sistema, o Ctrl+Alt+Mayús+H desde el propio escritorio): deja todo como si nunca hubieras salido al escritorio.
// Solo cuando el launcher ES la shell de Windows: entonces explorer.exe es un visitante (Windows no lo reinicia solo) y cerrarlo es seguro.
// Si el launcher se abre de forma normal, explorer.exe es el escritorio de verdad y no se toca. No pide contraseña: cerrar el escritorio es el sentido seguro.
function closeDesktop(why) {
  return new Promise(res => {
    if (process.platform !== 'win32') return res({ ok: false, msg: 'Solo en Windows' });
    if (DEV || shellMode !== true) return res({ ok: false, msg: 'Solo se puede cuando GameShell es la shell de Windows (instalar-shell.bat)' });
    log('cerrar el escritorio de Windows (' + why + ')');
    execFile('taskkill', ['/F', '/IM', 'explorer.exe'], { windowsHide: true }, e => {
      const was = !(e && e.code === 128);                        // 128 = no estaba abierto
      if (e && e.code !== 128) log('taskkill explorer:', e.message);
      home(); res({ ok: !e || e.code === 128, was });
    });
  });
}
ipcMain.handle('desktop:close', () => closeDesktop('Sistema'));
ipcMain.handle('desktop:state', () => ({ shell: shellMode === true, dev: DEV }));

// ---- Bluetooth sin salir a Windows (Esc → Sistema → Bluetooth) ----
//  · «Ajustes de Bluetooth»: la página de Bluetooth de la app Configuración de Windows (ms-settings:bluetooth). No abre el escritorio ni hace falta explorer.exe.
//    Esa app llega a casi todo Windows, así que con contraseña puesta la pide igual que el escritorio.
//  · «Emparejar un dispositivo»: el asistente clásico «Agregar un dispositivo» (DevicePairingWizard.exe): una sola ventana, sin menús por los que escapar a Windows.
// El launcher se aparta mientras tanto y vuelve solo al cerrar la ventana; si no se pudiera saber, se vuelve con Alt+Tab o Ctrl+Mayús+H.
let btWatch = 0;
const btStop = () => { clearInterval(btWatch); btWatch = 0; };
function btFollow(image) {   // sigue el proceso de la ventana de Configuración y, cuando ya no está, de vuelta al launcher
  btStop(); let seen = false; const t0 = Date.now();
  btWatch = setInterval(() => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq ' + image, '/NH', '/FO', 'CSV'], { windowsHide: true }, (e, out) => {
      const up = !e && String(out).toLowerCase().includes(image.toLowerCase());
      if (up) seen = true;
      else if (seen) { btStop(); log('Bluetooth: se cerró la ventana, de vuelta al launcher'); home(); }
      else if (Date.now() - t0 > 15000) btStop();                // nunca llegó a abrirse: no se sigue
      if (Date.now() - t0 > 1800000) btStop();                    // y a la media hora tampoco
    });
  }, 2000);
}
ipcMain.handle('bt:open', async (_, kind, pw) => {
  if (process.platform !== 'win32') return { ok: false, msg: 'Solo en Windows' };
  try {
    if (kind === 'settings') {
      if (!auth(pw)) return { ok: false, pw: true, msg: 'Contraseña incorrecta' };
      away(); await shell.openExternal('ms-settings:bluetooth'); btFollow('SystemSettings.exe');
      log('Bluetooth: ajustes de Windows abiertos'); return { ok: true };
    }
    if (kind === 'pair') {
      const exe = path.join(process.env.windir || 'C:\\Windows', 'System32', 'DevicePairingWizard.exe');
      if (!fs.existsSync(exe)) return { ok: false, msg: 'Este Windows no trae el asistente de emparejamiento' };
      away(); const t0 = Date.now();
      const c = spawn(exe, [], { detached: true, stdio: 'ignore' });
      c.on('error', e => { log('Bluetooth:', e.message); home(); });
      c.on('exit', () => { if (Date.now() - t0 > 2000) { log('Bluetooth: se cerró el asistente, de vuelta al launcher'); home(); } else log('Bluetooth: el asistente terminó enseguida (no se vuelve solo)'); });
      c.unref(); log('Bluetooth: asistente de emparejamiento abierto'); return { ok: true };
    }
    return { ok: false, msg: 'Opción desconocida' };
  } catch (e) { log('Bluetooth:', e.message); home(); return { ok: false, msg: 'No se pudo abrir (' + e.message + ')' }; }
});

// ---- vigía de Windows (vigia.ps1, un PowerShell que corre mientras el launcher está abierto) ----
// Avisa de dos cosas:
//  · P1 / P0: hay / no hay un mando encendido. Windows lo ve en cuanto se conecta, pero el navegador (Chromium) no lo enseña a la página hasta que se pulsa un
//    botón: por eso la Precarga Post Intro pedía una pulsación más. Con esto pasa sola al encender el mando.
//  · F<proceso>|<clase>: quién tiene el foco. Con el Modo Juego puesto (contraseña), si lo tiene el escritorio de Windows se vuelve al launcher y se cierra ese escritorio.
let padOn = false, padKnown = false, fg = '', sentinel = null, shellMode = null, lastKick = 0;
function startSentinel() {
  if (process.platform !== 'win32' || sentinel) return;
  const ps1 = path.join(__dirname, 'vigia.ps1');
  if (!fs.existsSync(ps1)) return log('vigía: falta vigia.ps1');
  try {
    const c = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ps1, String(process.pid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    sentinel = c; let buf = '';
    c.stdout.setEncoding('utf8');
    c.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) onSentinel(l); } });
    c.on('error', e => { sentinel = null; log('vigía:', e.message); });
    c.on('exit', code => { sentinel = null; log('vigía terminado', code); });
  } catch (e) { log('vigía:', e.message); }
}
function onSentinel(l) {
  try {
    if (l[0] === 'P') {
      const on = l[1] === '1'; padKnown = true;
      if (on !== padOn) { padOn = on; log('mando', on ? 'encendido' : 'apagado'); if (win && !win.isDestroyed()) win.webContents.send('pad', on); }
    } else if (l[0] === 'F') { fg = l.slice(1); watchShell(); }
  } catch (e) { log('vigía:', e.message); }   // nada de esto puede dar un error en pantalla
}
ipcMain.handle('pad:state', () => ({ known: padKnown, on: padOn }));
// ¿el launcher ES la shell de Windows? (Winlogon\Shell apunta a este electron). Solo entonces explorer.exe es un «visitante» que se puede cerrar sin riesgo:
// si el launcher se abre de forma normal, explorer.exe es el escritorio de verdad y no se toca.
function detectShell() {
  shellMode = false;
  if (process.platform !== 'win32' || DEV) return;
  const me = path.basename(process.execPath).toLowerCase(), dir = path.basename(__dirname).toLowerCase();
  const q = hive => new Promise(r => execFile('reg', ['query', hive + '\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon', '/v', 'Shell'], { windowsHide: true }, (e, out) => r(e ? '' : String(out).toLowerCase())));
  Promise.all([q('HKCU'), q('HKLM')]).then(([a, b]) => {
    const own = t => t.includes(me) && (t.includes(dir) || /\\boot"?\s*$/m.test(t)), has = t => /\bshell\s+reg_sz\b/.test(t);   // electron.exe launcher  ·  o  electron.exe boot (el arranque seguro, que abre este launcher)
    shellMode = own(a) || (!has(a) && own(b));   // el valor de usuario manda sobre el de la máquina
    log('shell de Windows:', shellMode ? 'es el launcher' : 'no es el launcher (no se cierra el escritorio)');
  }).catch(() => {});
}
// con la contraseña puesta y el launcher bloqueado, el escritorio de Windows no puede quedarse abierto: se cierra (explorer.exe) y, si había uno abierto en la sesión
// de «modo oculto», ya no se puede llegar a él minimizando un juego. Cerrarlo es lo normal en esta shell: sin escritorio, minimizar un juego deja el launcher delante.
function lockDesktop(why) {
  try { // jamás debe impedir que se abra un juego
    if (DEV || !shellMode || !locked()) return;
    log('cerrar el escritorio de Windows (' + why + ')');
    execFile('taskkill', ['/F', '/IM', 'explorer.exe'], { windowsHide: true }, e => { if (e && e.code !== 128) log('taskkill explorer:', e.message); }); // 128 = no estaba abierto
  } catch (e) { log('cerrar el escritorio:', e.message); }
}
// el foco pasó a algo del escritorio de Windows (explorer, menú Inicio, búsqueda…) mientras había un juego abierto y el launcher bloqueado → de vuelta al launcher
const SHELL_PROCS = new Set(['explorer', 'startmenuexperiencehost', 'searchhost', 'searchapp', 'shellexperiencehost']);
function watchShell() {
  if (DEV || !shellMode || !playing || !SHELL_PROCS.has(fg.split('|')[0].toLowerCase()) || !locked()) return;
  const now = Date.now(); if (now - lastKick < 1500) return; lastKick = now;
  log('el escritorio de Windows se asomó con el launcher bloqueado: se vuelve al launcher (' + fg + ')');
  lockDesktop('vigía'); home();
}

// ---- navegador: bloqueador de anuncios, SponsorBlock y teclado en pantalla (bloqueo.js · js/webview-preload.js) ----
// Hace lo que uBlock Origin / AdBlock / SponsorBlock, pero integrado: Electron no soporta bien las extensiones de Chrome, así que el bloqueo va por dentro.
//  · red: session.webRequest cancela las peticiones que dicen las listas (EasyList, EasyPrivacy, uBlock filters… se bajan solas y se actualizan cada 5 días; hay una incorporada sin internet)
//  · visual: el script de cada página (js/webview-preload.js) pide aquí el CSS que oculta los anuncios de ese sitio
//  · YouTube: lo de saltar anuncios lo hace ese script; los segmentos de SponsorBlock se piden aquí (sin CORS) a sponsor.ajay.app con el prefijo del hash del vídeo, como hace la extensión
let blocker = null, webOn = false;
const WEBK = ['webAds', 'webYt', 'webSb', 'webCookies', 'webOsk'], webCfgNow = { webAds: true, webYt: true, webSb: true, webCookies: true, webOsk: true };
const syncWebCfg = c => { for (const k of WEBK) webCfgNow[k] = c[k] !== false; };
const blockedBy = new Map(); let countTimer = 0;
function pushCount() { // avisa al launcher (con retraso, para no saturarlo) de cuántas peticiones se bloquearon en cada pestaña
  if (countTimer) return;
  countTimer = setTimeout(() => { countTimer = 0; if (win && !win.isDestroyed()) for (const [id, n] of blockedBy) win.webContents.send('web:count', { id, n }); }, 400);
}
function webSetup() {
  if (webOn) return; webOn = true;
  try {
    syncWebCfg(uiGet());
    blocker = Bloqueo.create({ dir: path.join(app.getPath('userData'), 'bloqueo'), baseDir: path.join(__dirname, 'assets', 'bloqueo'), fetch: (u, o) => net.fetch(u, o), log });
    blocker.start().then(() => setTimeout(() => blocker.update(false).catch(() => {}), 12000)); // lista incorporada + las ya bajadas; luego baja las que falten o tengan más de 5 días
    session.fromPartition('persist:web').webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => {
      let cancel = false;
      try {
        if (d.resourceType === 'mainFrame') { if (d.webContentsId) blockedBy.set(d.webContentsId, 0); }   // página nueva: el contador empieza de cero
        else if (webCfgNow.webAds || webCfgNow.webCookies) {
          const page = (d.webContents && d.webContents.getURL && d.webContents.getURL()) || d.referrer || '';
          cancel = !!((webCfgNow.webAds && blocker.blocked('ads', d.url, d.resourceType, page)) || (webCfgNow.webCookies && blocker.blocked('cookies', d.url, d.resourceType, page)));
        }
      } catch { cancel = false; }
      if (cancel) { blocker.hit(); if (d.webContentsId) { blockedBy.set(d.webContentsId, (blockedBy.get(d.webContentsId) || 0) + 1); pushCount(); } }
      cb({ cancel });
    });
    log('navegador: bloqueador preparado');
  } catch (e) { log('navegador: no se pudo preparar el bloqueo:', e.message); }
}
// lo que necesita el script de cada página al cargarse (sincrónico para que el CSS esté puesto antes de pintar)
ipcMain.on('web:cfg', (e, url) => {
  const out = { osk: webCfgNow.webOsk, yt: webCfgNow.webYt, sb: webCfgNow.webSb, cookies: webCfgNow.webCookies, css: '', gen: false };
  try {
    const u = new URL(String(url)), h = u.hostname.toLowerCase();
    if (blocker && /^https?:$/.test(u.protocol) && h) {
      const p = [];
      if (webCfgNow.webAds) p.push(blocker.cosmetic('ads', h));
      if (webCfgNow.webCookies) p.push(blocker.cosmetic('cookies', h));
      out.css = p.filter(Boolean).join('\n'); out.gen = webCfgNow.webAds || webCfgNow.webCookies;
    }
  } catch {}
  e.returnValue = out;
});
ipcMain.handle('web:generic', (_, h, cls, ids) => {
  if (!blocker || typeof h !== 'string' || h.length > 200) return '';
  const ok = a => Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.length < 80).slice(0, 5000) : [], c = ok(cls), i = ok(ids), p = [];
  if (webCfgNow.webAds) p.push(blocker.generic('ads', h.toLowerCase(), c, i));
  if (webCfgNow.webCookies) p.push(blocker.generic('cookies', h.toLowerCase(), c, i));
  return p.filter(Boolean).join('\n');
});
const sbCache = new Map();
ipcMain.handle('web:sb', async (_, id) => {
  if (!webCfgNow.webSb || typeof id !== 'string' || !/^[\w-]{11}$/.test(id)) return [];
  if (sbCache.has(id)) return sbCache.get(id);
  try {
    const h = crypto.createHash('sha256').update(id).digest('hex').slice(0, 4);     // solo se envía el principio del hash: el servidor no sabe qué vídeo es
    const url = 'https://sponsor.ajay.app/api/skipSegments/' + h + '?categories=' + encodeURIComponent('["sponsor","selfpromo","interaction"]') + '&actionTypes=' + encodeURIComponent('["skip"]');
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
    let out = [];
    try {
      const r = await net.fetch(url, { signal: ctl.signal });
      if (r.ok) { const j = await r.json(), e = Array.isArray(j) ? j.find(x => x && x.videoID === id) : null;
        if (e && Array.isArray(e.segments)) out = e.segments.filter(s => Array.isArray(s.segment) && s.segment.length === 2 && isFinite(s.segment[0]) && isFinite(s.segment[1]) && s.segment[1] > s.segment[0]).map(s => [s.segment[0], s.segment[1], s.videoDuration || 0, s.category]); }
    } finally { clearTimeout(to); }
    if (sbCache.size > 200) sbCache.clear(); sbCache.set(id, out);
    return out;
  } catch { return []; }
});
ipcMain.handle('web:stats', () => ({ ...(blocker ? blocker.stats() : { rules: 0, cosm: 0, updated: 0, lists: 0 }), blocked: blocker ? blocker.count() : 0 }));
ipcMain.handle('web:update', async () => { webSetup(); if (!blocker) return { ok: 0, fail: 0 }; await blocker.start(); return blocker.update(true); });

// ---- apariencia: estilo, nombre, fondo e intro (ui.json, aparte de la contraseña para no perderlos al restablecerla) ----
const UIF = () => path.join(app.getPath('userData'), 'ui.json');
const UI_DEF = { theme: 'classic', name: 'GameShell', bg: '', intro: 'ps2-boot', introBg: '', sounds: true,
  introSnd: true, vol: 0.6, menuVol: 0.6, menuSnd: 'auto', introSndSrc: 'auto', bar: 'auto', top: 'auto', psWait: true, psReq: false, pswBg: '', alt: null, mode: '',
  introText: '', tile: 1, tabText: 'Juegos', webText: 'Web', webAds: true, webYt: true, webSb: true, webCookies: true, webOsk: true,
  play: 'auto', font: 'auto', dock: 0, emberY: 0, emberHue: 0, emberSat: 1, cosmosY: 0, fpsOn: false, fpsSize: 1, fpsWord: true, buzzOn: true, buzzBeep: true,
  carousel: { boot: true, mins: 0, random: false, idx: -1, at: 0, items: [] }, resPre: { m: { w: 1920, h: 1200, hz: 120, ok: false }, s: { w: 3840, h: 2160, hz: 120, ok: false } },
  hide: { theme: [], bg: [], intro: [], bar: [], top: [], font: [] }, gone: { theme: [], bg: [], intro: [], bar: [], top: [], font: [] }, v: 0 };   // play: «Intro para jugar» (auto|text|btn|cta|none) · font: tipo de letra · dock: ampliación con el ratón (0-3) · emberY/emberHue/emberSat: altura y color de Brasas · fpsOn/fpsSize: contador de FPS · carousel: carrusel de aspectos (cada aspecto guarda estilo, fondo, intro, letra, sonidos y Precarga) · resPre: los dos ajustes rápidos de resolución (teclas M y S; ok = ya confirmados una vez) · psReq: la Precarga Post Intro no se salta con teclado/ratón · pswBg: su foto · tile: tamaño de los iconos · tabText/webText: lo de arriba a la izquierda · web*: ajustes del navegador
   // hide: lo que se «elimina» desde el launcher (se puede restaurar) · gone: lo eliminado definitivamente · v: versión de los ajustes
// la primera vez, si venías de «actualizacion» (prefs.json), se aprovechan sus ajustes: estilos y intros pasan a sus versiones b-*
const BTHEME = { classic: 'b-classic', ps5: 'b-ps5', ps3: 'b-ps3', ps2: 'b-ps2', neon: 'b-neon', glass: 'b-glass', oled: 'b-oled' };
const BINTRO = { ps2: 'b-ps2', ps5: 'b-ps5', ps3: 'b-ps3', photo: 'b-photo', text: 'b-text', none: 'none' };
function fromB() {
  try {
    const b = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'prefs.json'), 'utf8')), o = {};
    if (typeof b.name === 'string' && b.name.trim()) o.name = b.name.trim().slice(0, 24);
    if (BTHEME[b.theme]) { o.theme = BTHEME[b.theme]; o.mode = 'actualizacion'; }
    if (typeof b.bg === 'string') o.bg = b.bg.startsWith('a:') ? 'p:' + b.bg.slice(2) : b.bg;
    if (BINTRO[b.intro]) o.intro = BINTRO[b.intro];
    if (typeof b.snd === 'boolean') o.introSnd = b.snd;
    if (typeof b.vol === 'number') o.vol = b.vol;
    return o;
  } catch { return null; }
}
const PLAY_K = ['auto', 'text', 'btn', 'cta', 'none'], FONT_ID = /^(u:[^\\/:*?"<>|]{1,80}|[a-z0-9_-]{1,24})$/i;
const UI_VER = 3; // 3: se estrena la intro «PS2 · Arranque» (una sola vez; luego se cambia cuando quieras)
const HIDE_K = ['theme', 'bg', 'intro', 'bar', 'top', 'font'];
const uiGet = () => {
  let j = null; try { j = JSON.parse(fs.readFileSync(UIF(), 'utf8')); } catch {}
  if (!j) j = fromB() || {};
  const c = { ...UI_DEF, ...j };
  if (j.introSnd === undefined && typeof j.sounds === 'boolean') c.introSnd = j.sounds; // antes un solo interruptor valía para menús e intro
  const h = c.hide && typeof c.hide === 'object' ? c.hide : {}; c.hide = {};
  for (const k of HIDE_K) c.hide[k] = Array.isArray(h[k]) ? h[k].filter(x => typeof x === 'string' && x.length < 200).slice(0, 500) : [];
  const gn = c.gone && typeof c.gone === 'object' ? c.gone : {}; c.gone = {};
  for (const k of HIDE_K) c.gone[k] = Array.isArray(gn[k]) ? gn[k].filter(x => typeof x === 'string' && x.length < 200).slice(0, 2000) : [];
  for (const k of ['tabText', 'webText']) if (typeof c[k] !== 'string') c[k] = UI_DEF[k];
  if (typeof c.tile !== 'number' || !isFinite(c.tile)) c.tile = 1;
  if (!PLAY_K.includes(c.play)) c.play = 'auto';
  if (!(c.font === 'auto' || (typeof c.font === 'string' && FONT_ID.test(c.font)))) c.font = 'auto';
  if (!Number.isInteger(c.dock) || c.dock < 0 || c.dock > 3) c.dock = 0;
  for (const k of ['emberY', 'emberHue', 'emberSat', 'cosmosY', 'fpsSize']) if (typeof c[k] !== 'number' || !isFinite(c[k])) c[k] = UI_DEF[k];
  if (typeof c.fpsOn !== 'boolean') c.fpsOn = false;
  if (typeof c.fpsWord !== 'boolean') c.fpsWord = true;
  for (const k of ['buzzOn', 'buzzBeep']) if (typeof c[k] !== 'boolean') c[k] = true;   // mandos Buzz: activarlos solos / pitido al detectar el pincho
  c.carousel = cleanCarousel(c.carousel); c.resPre = cleanResPre(c.resPre);
  if ((j.v || 0) < UI_VER) { // primera vez con esta versión
    c.v = UI_VER; c.intro = 'ps2-boot';
    try { fs.mkdirSync(path.dirname(UIF()), { recursive: true }); fs.writeFileSync(UIF(), JSON.stringify(c, null, 1)); } catch (e) { log('ui.json:', e.message); }
  }
  return c;
};
const ID = /^[a-z0-9_-]{1,24}$/i, ISND = /^(wav:)?[a-z0-9_-]{1,24}$/i;
const idOrAuto = v => typeof v === 'string' && (v === 'auto' || ID.test(v));

// ---- carrusel de aspectos: cada «aspecto» guarda TODO lo que define cómo se ve y suena el launcher (estilo, fondo, barras, letra, intro, sonidos, Precarga…) ----
// (mismas reglas que uiSet para cada ajuste: lo que no valga se descarta)
function cleanLook(o) {
  const l = {}; if (!o || typeof o !== 'object') return l;
  for (const k of ['theme', 'intro']) if (typeof o[k] === 'string' && ID.test(o[k])) l[k] = o[k];
  for (const k of ['bg', 'introBg', 'pswBg']) if (typeof o[k] === 'string' && o[k].length < 200) l[k] = o[k];
  for (const k of ['menuSnd', 'bar', 'top']) if (idOrAuto(o[k])) l[k] = o[k];
  if (typeof o.introSndSrc === 'string' && (o.introSndSrc === 'auto' || ISND.test(o.introSndSrc))) l.introSndSrc = o.introSndSrc;
  if (PLAY_K.includes(o.play)) l.play = o.play;
  if (typeof o.font === 'string' && (o.font === 'auto' || FONT_ID.test(o.font))) l.font = o.font;
  if (Number.isInteger(o.dock) && o.dock >= 0 && o.dock <= 3) l.dock = o.dock;
  if (typeof o.tile === 'number' && isFinite(o.tile)) l.tile = Math.max(0.5, Math.min(1.6, Math.round(o.tile * 100) / 100));
  for (const k of ['emberY', 'cosmosY']) if (typeof o[k] === 'number' && isFinite(o[k])) l[k] = Math.max(-40, Math.min(40, Math.round(o[k])));
  if (typeof o.emberHue === 'number' && isFinite(o.emberHue)) l.emberHue = ((Math.round(o.emberHue) % 360) + 360) % 360;
  if (typeof o.emberSat === 'number' && isFinite(o.emberSat)) l.emberSat = Math.max(0, Math.min(2, Math.round(o.emberSat * 100) / 100));
  for (const k of ['tabText', 'webText']) if (typeof o[k] === 'string') l[k] = o[k].trim().slice(0, 24);
  if (typeof o.introText === 'string') l.introText = o.introText.trim().slice(0, 40);
  return l;
}
const CAR_MINS = [0, 1, 5, 10, 15, 30, 60, 180, 360, 720, 1440];   // «cambiar cada…» en minutos (0 = nunca solo; siempre se puede a mano con Ctrl+←/→)
function cleanCarousel(o) {
  const c = { boot: true, mins: 0, random: false, idx: -1, at: 0, items: [] };
  if (!o || typeof o !== 'object') return c;
  if (typeof o.boot === 'boolean') c.boot = o.boot;
  if (CAR_MINS.includes(o.mins)) c.mins = o.mins;
  if (typeof o.random === 'boolean') c.random = o.random;
  if (Array.isArray(o.items)) for (const it of o.items.slice(0, 24)) {
    if (!it || typeof it !== 'object') continue;
    const name = typeof it.name === 'string' ? it.name.trim().slice(0, 40) : '';
    const id = typeof it.id === 'string' && /^[a-z0-9]{1,16}$/i.test(it.id) ? it.id : Math.random().toString(36).slice(2, 10);
    c.items.push({ id, name: name || 'Aspecto ' + (c.items.length + 1), look: cleanLook(it.look) });
  }
  if (Number.isInteger(o.idx) && o.idx >= -1 && o.idx < c.items.length) c.idx = o.idx;
  if (typeof o.at === 'number' && isFinite(o.at) && o.at > 0) c.at = Math.round(o.at);
  return c;
}
// los dos ajustes rápidos de resolución: M (Moonlight) y S (2160p)
function cleanResPre(o) {
  const d = UI_DEF.resPre, r = {}, dim = n => Number.isInteger(n) && n >= 320 && n <= 16384;
  for (const k of ['m', 's']) {
    const s = o && typeof o === 'object' && o[k] && typeof o[k] === 'object' ? o[k] : {};
    r[k] = { w: dim(s.w) ? s.w : d[k].w, h: dim(s.h) ? s.h : d[k].h, hz: Number.isInteger(s.hz) && s.hz >= 20 && s.hz <= 1000 ? s.hz : d[k].hz, ok: s.ok === true };
  }
  return r;
}
function uiSet(p) {
  const c = uiGet();
  if (typeof p.theme === 'string' && ID.test(p.theme)) c.theme = p.theme;
  if (typeof p.intro === 'string' && ID.test(p.intro)) c.intro = p.intro;
  if (typeof p.name === 'string') c.name = p.name.trim().slice(0, 24) || UI_DEF.name;
  for (const k of ['bg', 'introBg', 'pswBg']) if (typeof p[k] === 'string' && p[k].length < 200) c[k] = p[k];   // bg: '' | foto («p:…», «u:…») | fondo animado («fx:ember»)
  for (const k of ['sounds', 'introSnd', 'psWait', 'psReq', 'webAds', 'webYt', 'webSb', 'webCookies', 'webOsk', 'buzzOn', 'buzzBeep']) if (typeof p[k] === 'boolean') c[k] = p[k];
  if (typeof p.tile === 'number' && isFinite(p.tile)) c.tile = Math.max(0.5, Math.min(1.6, Math.round(p.tile * 100) / 100)); // tamaño de los iconos (1 = el de siempre)
  for (const k of ['tabText', 'webText']) if (typeof p[k] === 'string') c[k] = p[k].trim().slice(0, 24);                  // «Juegos» y «Web» de arriba a la izquierda (vacío = no se muestra)
  for (const k of ['vol', 'menuVol']) if (typeof p[k] === 'number' && isFinite(p[k])) c[k] = Math.max(0, Math.min(1, p[k]));   // volumen de la intro y de los menús
  if (typeof p.introText === 'string') c.introText = p.introText.trim().slice(0, 40);
  if (p.hide && typeof p.hide === 'object') { // lo eliminado desde el launcher: ids que no salen en los selectores (se restauran desde Apariencia)
    const h = {}; for (const k of HIDE_K) h[k] = Array.isArray(p.hide[k]) ? [...new Set(p.hide[k].filter(x => typeof x === 'string' && x.length < 200))].slice(0, 500) : c.hide[k];
    c.hide = h;
  }
  if (p.gone && typeof p.gone === 'object') { // eliminado definitivamente: ya no sale ni en «Restaurar lo eliminado»
    const h = {}; for (const k of HIDE_K) h[k] = Array.isArray(p.gone[k]) ? [...new Set(p.gone[k].filter(x => typeof x === 'string' && x.length < 200))].slice(0, 2000) : c.gone[k];
    c.gone = h;
  }
  for (const k of ['menuSnd', 'bar', 'top']) if (idOrAuto(p[k])) c[k] = p[k];
  if (PLAY_K.includes(p.play)) c.play = p.play;                                                   // «Intro para jugar»: lo que sale bajo el nombre del programa
  if (typeof p.font === 'string' && (p.font === 'auto' || FONT_ID.test(p.font))) c.font = p.font; // tipo de letra (auto = el del estilo)
  if (Number.isInteger(p.dock) && p.dock >= 0 && p.dock <= 3) c.dock = p.dock;                    // ampliación de los iconos con el ratón (0 = apagada)
  if (typeof p.emberY === 'number' && isFinite(p.emberY)) c.emberY = Math.max(-40, Math.min(40, Math.round(p.emberY)));                         // Brasas: altura de los iconos (% de la pantalla; 0 = la de siempre)
  if (typeof p.cosmosY === 'number' && isFinite(p.cosmosY)) c.cosmosY = Math.max(-40, Math.min(40, Math.round(p.cosmosY)));                     // Cosmos: altura de los iconos (% de la pantalla; 0 = la de siempre)
  if (typeof p.emberHue === 'number' && isFinite(p.emberHue)) c.emberHue = ((Math.round(p.emberHue) % 360) + 360) % 360;                       // Brasas: tono (0 = el naranja de siempre)
  if (typeof p.emberSat === 'number' && isFinite(p.emberSat)) c.emberSat = Math.max(0, Math.min(2, Math.round(p.emberSat * 100) / 100));      // Brasas: intensidad del color
  if (typeof p.fpsOn === 'boolean') c.fpsOn = p.fpsOn;                                           // contador de FPS dentro de los juegos
  if (typeof p.fpsWord === 'boolean') c.fpsWord = p.fpsWord;                                     // con la palabra «FPS» junto al número o solo el número
  if (typeof p.fpsSize === 'number' && isFinite(p.fpsSize)) c.fpsSize = Math.max(.5, Math.min(3, Math.round(p.fpsSize * 100) / 100));
  if (typeof p.introSndSrc === 'string' && (p.introSndSrc === 'auto' || ISND.test(p.introSndSrc))) c.introSndSrc = p.introSndSrc;
  if (typeof p.mode === 'string' && (p.mode === '' || ID.test(p.mode))) c.mode = p.mode;
  if (p.carousel && typeof p.carousel === 'object') c.carousel = cleanCarousel({ ...c.carousel, ...p.carousel });   // el carrusel de aspectos (se manda entero)
  if (p.resPre && typeof p.resPre === 'object') c.resPre = cleanResPre({ ...c.resPre, ...p.resPre });             // los ajustes rápidos M y S
  if (p.alt === null) c.alt = null; // el otro aspecto para W×4
  else if (p.alt && typeof p.alt === 'object') {
    const a = {};
    if (typeof p.alt.theme === 'string' && ID.test(p.alt.theme)) a.theme = p.alt.theme;
    for (const k of ['bar', 'top', 'menuSnd']) if (idOrAuto(p.alt[k])) a[k] = p.alt[k];
    if (PLAY_K.includes(p.alt.play)) a.play = p.alt.play;
    if (typeof p.alt.font === 'string' && (p.alt.font === 'auto' || FONT_ID.test(p.alt.font))) a.font = p.alt.font;
    if (typeof p.alt.bg === 'string' && p.alt.bg.length < 200) a.bg = p.alt.bg;
    if (a.theme) c.alt = a;
  }
  fs.mkdirSync(path.dirname(UIF()), { recursive: true }); fs.writeFileSync(UIF(), JSON.stringify(c, null, 1));
  syncWebCfg(c);
  return c;
}
ipcMain.handle('ui', () => uiGet());
ipcMain.handle('ui:set', (_, p) => { const c = uiSet(p || {}); try { FPS.configure(c); } catch {} try { BUZZ.configure(c); } catch (e) { log('Buzz:', e.message); } return c; });
// fondos: los que vienen en assets/fondos (cualquier imagen que metas ahí sale sola) + las fotos que importe el usuario
const FONDOS_P = () => path.join(__dirname, 'assets', 'fondos');
const FONDOS_U = () => path.join(app.getPath('userData'), 'fondos');
const IMG = /\.(jpe?g|png|webp|bmp|gif)$/i;
const NOMBRES = { 'ps5-pro': 'PS5 Pro', 'ps5-bienvenida': 'PS5 Bienvenida', simbolos: 'Símbolos', 'neon-azul': 'Neón azul', 'neon-colores': 'Neón colores', 'neon-humo': 'Neón humo',
  'aurora-boreal': 'Aurora boreal', nebulosa: 'Nebulosa', 'amanecer-orbital': 'Amanecer orbital', 'seda-iridiscente': 'Seda iridiscente', 'bokeh-nocturno': 'Bokeh nocturno',
  'marmol-liquido': 'Mármol líquido', 'cumbres-niebla': 'Cumbres en la niebla', 'atardecer-mar': 'Atardecer en el mar' };
const NOMBRES_C = { neotokio: 'Neo-Tokio · lluvia', brasas: 'Brasas', sakura: 'Sakura · luna', cosmos: 'Cosmos · horizonte de sucesos', synthwave: 'Retro · sol y rejilla',
  cristal: 'Cristal · facetas', oled: 'OLED · anillo', abismo: 'Abismo · bioluminiscencia' };   // nombres de las pantallas de Precarga (assets/precargas); si falta, sale el del archivo
// miniatura (960 px) para el selector inferior: así no se decodifica una foto de 4K por cada tarjeta, y aun así se ve nítida en pantallas 4K
function miniatura(src, dst) {
  try {
    const img = nativeImage.createFromPath(src); if (img.isEmpty()) return false;
    const { width: w, height: h } = img.getSize(), k = Math.min(1, 960 / Math.max(w, h));
    const r = k < 1 ? img.resize({ width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)), quality: 'good' }) : img;
    fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, r.toJPEG(88)); return true;
  } catch (e) { log('miniatura:', e.message); return false; }
}
// pantallas de Precarga (Apariencia → Precarga Post Intro → Foto): imágenes pensadas para esa pantalla; no salen en la lista de fondos
const PRECARGAS_P = () => path.join(__dirname, 'assets', 'precargas');
function fondos() {
  const out = [], gone = new Set(((uiGet().gone || {}).bg) || []);   // lo eliminado definitivamente no se lista aunque la actualización haya traído de nuevo el archivo
  const scan = (dir, px, user, pre) => {
    let fl = []; try { fl = fs.readdirSync(dir).filter(f => IMG.test(f)).sort(); } catch {}
    for (const f of fl) {
      if (gone.has(px + f)) continue;
      const b = f.replace(/\.[^.]+$/, ''), th = path.join(dir, 'miniaturas', b + '.jpg');
      if (user && !fs.existsSync(th)) miniatura(path.join(dir, f), th); // fotos que ya estaban importadas antes de existir las miniaturas
      out.push({ id: px + f, name: user ? b : (pre ? NOMBRES_C[b] : NOMBRES[b]) || b.replace(/[-_]+/g, ' '), url: pathToFileURL(path.join(dir, f)).href, thumb: fs.existsSync(th) ? pathToFileURL(th).href : '', user, ...(pre ? { pre: true } : {}) });
    }
  };
  scan(FONDOS_P(), 'p:', false); scan(PRECARGAS_P(), 'c:', false, true); scan(FONDOS_U(), 'u:', true);
  return out;
}
// sonidos wav de las intros: los de assets/sonidos; si hay uno con el mismo nombre en %APPDATA%\gameshell\sonidos (wav, mp3 u ogg), manda ese
const SND = ['ps2', 'ps5', 'ps3', 'ps2boot', 'ps4-pulso', 'neotokio', 'cosmos-eco', 'brasas', 'sakura-koto', 'retro-8bits'], SND_EXT = ['wav', 'mp3', 'ogg'];
const SND_U = () => path.join(app.getPath('userData'), 'sonidos');
const sndOwn = n => { for (const e of SND_EXT) { const u = path.join(SND_U(), n + '.' + e); if (fs.existsSync(u)) return u; } return ''; };
const sndFile = n => sndOwn(n) || path.join(__dirname, 'assets', 'sonidos', n + '.wav');
function sonidos() { const o = {}; for (const n of SND) o[n] = pathToFileURL(sndFile(n)).href; return o; }
ipcMain.handle('sonido:datos', (_, n) => { if (!SND.includes(n)) return null; try { return fs.readFileSync(sndFile(n)); } catch (e) { log('sonido:', e.message); return null; } });
ipcMain.handle('sonido:propios', () => SND.filter(n => sndOwn(n)));
ipcMain.handle('sonido:importar', async (_, n) => { // «Cambiar el sonido…»: copia el archivo elegido como el sonido de esa intro
  if (!SND.includes(n)) return false;
  const r = await dialog.showOpenDialog(win, { title: 'Elegir sonido', properties: ['openFile'], filters: [{ name: 'Audio (wav, mp3, ogg)', extensions: SND_EXT }] });
  if (r.canceled || !r.filePaths[0]) return false;
  try {
    const src = r.filePaths[0], ext = path.extname(src).toLowerCase().slice(1);
    if (!SND_EXT.includes(ext) || fs.statSync(src).size > 40e6) return false;
    fs.mkdirSync(SND_U(), { recursive: true });
    for (const e of SND_EXT) try { fs.unlinkSync(path.join(SND_U(), n + '.' + e)); } catch {}
    fs.copyFileSync(src, path.join(SND_U(), n + '.' + ext)); log('sonido importado', n, ext); return true;
  } catch (e) { log('sonido:', e.message); return false; }
});
ipcMain.handle('sonido:quitar', (_, n) => { if (!SND.includes(n)) return false; for (const e of SND_EXT) try { fs.unlinkSync(path.join(SND_U(), n + '.' + e)); } catch {} return true; });
ipcMain.handle('sonidos', () => sonidos());
ipcMain.handle('fondos', () => fondos());
ipcMain.handle('fondo:add', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Elegir foto', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }] });
  if (r.canceled) return [];
  fs.mkdirSync(FONDOS_U(), { recursive: true });
  const ids = [];
  for (const src of r.filePaths) try {
    if (fs.statSync(src).size > 60e6) continue;
    const ext = path.extname(src).toLowerCase(), base = path.basename(src, ext).replace(/[^\wáéíóúñÁÉÍÓÚÑ .-]/g, '_').trim().slice(0, 40) || 'foto';
    let n = base + ext, k = 2;
    while (fs.existsSync(path.join(FONDOS_U(), n))) n = `${base}-${k++}${ext}`;
    fs.copyFileSync(src, path.join(FONDOS_U(), n)); ids.push('u:' + n); log('foto importada', n);
    miniatura(path.join(FONDOS_U(), n), path.join(FONDOS_U(), 'miniaturas', n.replace(/\.[^.]+$/, '') + '.jpg'));
  } catch (e) { log('foto:', e.message); }
  return ids;
});
ipcMain.handle('fondo:del', (_, id) => { // solo las fotos importadas se borran de verdad; las que trae el launcher se ocultan desde Apariencia
  if (typeof id !== 'string' || !id.startsWith('u:')) return false;
  const f = path.basename(id.slice(2)); if (!f || !IMG.test(f)) return false;
  try { fs.unlinkSync(path.join(FONDOS_U(), f)); } catch (e) { log('borrar foto:', e.message); return false; }
  try { fs.unlinkSync(path.join(FONDOS_U(), 'miniaturas', f.replace(/\.[^.]+$/, '') + '.jpg')); } catch {}
  log('foto borrada', f); return true;
});
// eliminar DEFINITIVAMENTE (Apariencia → Restaurar lo eliminado): borra del disco lo que tenga archivos (fotos de Fondo, imágenes de muestra de un estilo).
// El estilo, el fondo animado o la intro en sí viven en el código: el renderer los anota en «gone» y ya no salen en ningún sitio.
const ESTILOS_P = () => path.join(__dirname, 'assets', 'estilos');
// borra los ARCHIVOS de lo eliminado definitivamente (el id ya queda en ui.json → gone) · devuelve cuántos archivos borró (-1: id no válido)
const rmf = p => { try { fs.unlinkSync(p); return 1; } catch { return 0; } };
function purgeFiles(k, id) {
  if (typeof id !== 'string' || id.length > 200) return -1;
  let n = 0;
  if (k === 'bg' && /^[pc]:/.test(id)) {          // p: fondos del launcher · c: pantallas de Precarga
    const f = path.basename(id.slice(2)); if (!f || !IMG.test(f)) return -1;
    const dir = id[0] === 'p' ? FONDOS_P() : PRECARGAS_P();
    n += rmf(path.join(dir, f)) + rmf(path.join(dir, 'miniaturas', f.replace(/\.[^.]+$/, '') + '.jpg'));
  } else if (k === 'bg' && /^fx:[a-z0-9-]{1,24}$/.test(id)) n += rmf(path.join(FONDOS_P(), 'animados', id.slice(3) + '.jpg'));
  else if (k === 'theme' && ID.test(id)) n += rmf(path.join(ESTILOS_P(), id + '.jpg')) + rmf(path.join(ESTILOS_P(), 'miniaturas', id + '.jpg'));
  else if (k === 'font' && FONT_ID.test(id) && !id.startsWith('u:')) { // las fuentes que trae el launcher: se borran sus archivos
    try { for (const f of fs.readdirSync(FUENTES_P())) if (f.startsWith(id + '.') || f.startsWith(id + '-')) n += rmf(path.join(FUENTES_P(), f)); } catch {}
  }                                                 // intros y barras viven en el código: basta con la lista «gone»
  return n;
}
ipcMain.handle('purge', (_, k, id) => {
  try { const n = purgeFiles(k, id); if (n < 0) return false; log('eliminado definitivamente:', k, id, n ? '(' + n + ' archivos)' : ''); return true; }
  catch (e) { log('eliminar definitivamente:', e.message); return false; }
});
// «Eliminar definitivamente» tiene que seguir siéndolo DESPUÉS de actualizar: la actualización baja de GitHub la carpeta launcher/ entera
// y con ella vuelven los archivos que habías borrado (aunque la lista «gone» de ui.json los mantuviera fuera de los selectores).
// En cada arranque se vuelven a borrar los de esa lista, así no ocupan sitio ni pueden asomar por ningún lado.
function reapplyGone() {
  try {
    const g = uiGet().gone; let n = 0;
    for (const k of HIDE_K) for (const id of g[k] || []) { const r = purgeFiles(k, id); if (r > 0) n += r; }
    if (n) log('eliminado definitivamente: se han vuelto a borrar', n, 'archivos que la actualización había traído de nuevo');
  } catch (e) { log('eliminado definitivamente (arranque):', e.message); }
}
ipcMain.handle('fondo:clear', () => { try { fs.rmSync(FONDOS_U(), { recursive: true, force: true }); } catch (e) { log('quitar fotos:', e.message); } return true; });

// ---- tipos de letra: los que trae el launcher (assets/fuentes, declarados en css/fuentes.css y catalogados en js/mejoras.js) + los que importes (%APPDATA%\gameshell\fuentes) ----
const FUENTES_P = () => path.join(__dirname, 'assets', 'fuentes');
const FUENTES_U = () => path.join(app.getPath('userData'), 'fuentes');
const FONT_EXT = /\.(ttf|otf|woff2?)$/i;
ipcMain.handle('fuentes', () => { // solo las importadas por el usuario: las del launcher las conoce el propio catálogo
  let fl = []; try { fl = fs.readdirSync(FUENTES_U()).filter(f => FONT_EXT.test(f)).sort(); } catch {}
  return fl.map(f => ({ id: 'u:' + f, name: f.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }));
});
ipcMain.handle('fuente:data', (_, id) => { // los bytes de una importada: el launcher las carga con FontFace, sin pasar por una dirección file://
  if (typeof id !== 'string' || !id.startsWith('u:')) return null;
  const f = path.basename(id.slice(2)); if (!f || !FONT_EXT.test(f)) return null;
  try { return fs.readFileSync(path.join(FUENTES_U(), f)); } catch { return null; }
});
ipcMain.handle('fuente:add', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Elegir tipo de letra', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Tipos de letra (ttf, otf, woff, woff2)', extensions: ['ttf', 'otf', 'woff', 'woff2'] }] });
  if (r.canceled) return [];
  fs.mkdirSync(FUENTES_U(), { recursive: true });
  const ids = [];
  for (const src of r.filePaths) try {
    if (fs.statSync(src).size > 25e6) continue;
    const ext = path.extname(src).toLowerCase(), base = path.basename(src, ext).replace(/[^\wáéíóúñÁÉÍÓÚÑ .-]/g, '_').trim().slice(0, 60) || 'fuente';
    let n = base + ext, k = 2;
    while (fs.existsSync(path.join(FUENTES_U(), n))) n = `${base}-${k++}${ext}`;
    fs.copyFileSync(src, path.join(FUENTES_U(), n)); ids.push('u:' + n); log('fuente importada', n);
  } catch (e) { log('fuente:', e.message); }
  return ids;
});
ipcMain.handle('fuente:del', (_, id) => { // solo las importadas se borran de verdad; las del launcher se ocultan desde Apariencia
  if (typeof id !== 'string' || !id.startsWith('u:')) return false;
  const f = path.basename(id.slice(2)); if (!f || !FONT_EXT.test(f)) return false;
  try { fs.unlinkSync(path.join(FUENTES_U(), f)); } catch (e) { log('borrar fuente:', e.message); return false; }
  log('fuente borrada', f); return true;
});

// ---- contador de FPS (fps.js) y resolución de pantalla (pantalla.js) ----
const FPS = Fps.create({ app, BrowserWindow, screen, net, shell, globalShortcut, log, getFg: () => fg, getWin: () => win });
function refit() { // tras cambiar la resolución, la ventana del launcher se vuelve a ajustar a la pantalla (igual que al volver de un juego)
  if (!win || win.isDestroyed() || DEV) return;
  try { win.setFullScreen(false); } catch {}
  setTimeout(() => { if (win && !win.isDestroyed()) { win.setFullScreen(true); win.setAlwaysOnTop(true); win.focus(); win.webContents.invalidate(); } }, 300);
}
const PANT = Pantalla.create({ log, getWin: () => win, refit });
const BUZZ = Buzz.create({ log });   // BuzzActivar en segundo plano (buzz.js). No arranca hasta que el launcher avisa de que ya está listo (boot:done)
// «Buscar actualizaciones» (Opciones): descarga la versión nueva de GitHub y, si no se confirma a tiempo, el arranque seguro (boot/) vuelve a la anterior. Ver actualizar.js
let ACT = null;
try { ACT = require('./actualizar').create({ app, ipcMain, getWin: () => win, log, dev: DEV }); } catch (e) { log('actualizaciones: no se pudieron preparar:', e.message); }
ipcMain.handle('fps:state', () => FPS.state());
ipcMain.handle('fps:download', () => FPS.download());
ipcMain.handle('fps:permiso', () => FPS.permission());
ipcMain.handle('fps:test', (_, ms) => FPS.test(ms));
ipcMain.handle('fps:carpeta', () => FPS.openDir());
ipcMain.handle('buzz:state', () => BUZZ.state());
ipcMain.handle('buzz:restart', async () => { await BUZZ.restart(); return BUZZ.state(); });
ipcMain.handle('buzz:install', () => BUZZ.install());
ipcMain.on('boot:done', () => { try { BUZZ.markReady(); } catch (e) { log('Buzz:', e.message); } });   // la intro y la Precarga Post Intro ya pasaron: ahora se activan los Buzz
ipcMain.handle('gs:log', (_, t) => { if (typeof t === 'string') log(t.slice(0, 300)); });            // el launcher anota cosas en gameshell.log (qué mandos ve)
ipcMain.handle('pantalla:lista', () => PANT.list());
ipcMain.handle('pantalla:cambiar', (_, w, h, hz) => PANT.set(w, h, hz));
ipcMain.handle('pantalla:mantener', () => PANT.keep());
ipcMain.handle('pantalla:directa', (_, w, h, hz) => PANT.direct(w, h, hz));   // los ajustes rápidos M y S (ya confirmados una vez): se aplican y guardan sin cuenta atrás
ipcMain.handle('pantalla:revertir', () => PANT.revert('lo pediste'));

// los popups del navegador se abren en la misma vista
app.on('web-contents-created', (_, wc) => wc.setWindowOpenHandler(({ url }) => { wc.loadURL(url); return { action: 'deny' }; }));
app.on('will-quit', () => { globalShortcut.unregisterAll(); try { sentinel && sentinel.kill(); } catch {} try { FPS.quit(); } catch {} try { PANT.quit(); } catch {} try { BUZZ.quit(); } catch {} });

if (!app.requestSingleInstanceLock()) app.exit(0);
else app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  reapplyGone();   // «Eliminar definitivamente» sigue siéndolo tras actualizar (ver reapplyGone)
  { // preload extra (window.gsx: fuentes propias, FPS, resolución): va aparte para no tocar tu preload.js
    const pre = { type: 'frame', filePath: path.join(__dirname, 'preload-gs.js') };
    try { session.defaultSession.registerPreloadScript(pre); } catch (e) { try { session.defaultSession.setPreloads([pre.filePath]); } catch (e2) { log('preload-gs:', e2.message); } }
  }
  win = new BrowserWindow({
    fullscreen: !DEV, frame: DEV, closable: DEV, alwaysOnTop: !DEV, width: 1280, height: 720,
    backgroundColor: '#000000', show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), webviewTag: true, autoplayPolicy: 'no-user-gesture-required' } // el sonido de la intro suena sin pulsar nada
  });
  win.webContents.on('will-attach-webview', (_e, prefs) => { // el navegador (webview): se le pone el script que da teclado en pantalla, bloqueo de anuncios, etc.
    prefs.preload = path.join(__dirname, 'js', 'webview-preload.js'); prefs.nodeIntegration = false; prefs.contextIsolation = true;
    webSetup();
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => { win.show(); win.focus(); autostart(); });
  win.on('focus', () => { playing = false; btStop(); });
  win.webContents.on('render-process-gone', (_, d) => { log('se cayó la página:', d && d.reason); win.reload(); });
  app.on('child-process-gone', (_, d) => log('proceso de Electron caído:', d && d.type, d && d.reason));
  try { if (fs.statSync(LOG()).size > 2e5) fs.writeFileSync(LOG(), ''); } catch {}
  log('inicio', DEV ? '(dev)' : '(shell)');
  if (ACT) log('actualizaciones:', ACT.resumen());
  globalShortcut.register('Control+Shift+H', home);
  globalShortcut.register('Control+Alt+Shift+H', () => { closeDesktop('atajo Ctrl+Alt+Mayús+H').then(r => { if (!r.ok) home(); }); });   // desde el escritorio de Windows: lo cierra y vuelve al launcher (si no es la shell, solo vuelve)
  globalShortcut.register('Control+Shift+F', () => { try { FPS.toggle(); } catch (e) { log('FPS:', e.message); } }); // contador de FPS: arrancarlo / ocultarlo dentro de un juego
  try { FPS.configure(uiGet()); } catch (e) { log('FPS:', e.message); }
  try { BUZZ.configure(uiGet()); } catch (e) { log('Buzz:', e.message); }
  setTimeout(() => { try { BUZZ.markReady(); } catch {} }, 120000);   // por si el launcher no llegara a avisar de que terminó de arrancar
  detectShell(); setTimeout(startSentinel, 1500); // el vigía arranca un poco después, para no competir con la carga de la intro
  setTimeout(webSetup, 45000);
});
