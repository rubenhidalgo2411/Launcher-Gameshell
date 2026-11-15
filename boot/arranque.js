'use strict';
// GameShell · boot/arranque.js — el «arranque seguro»
// Windows abre ESTE programa como shell (electron.exe boot) y él abre el launcher (electron.exe launcher) como un proceso aparte, y lo vigila.
// Es lo único que no se actualiza nunca, y por eso vale de red de seguridad: aunque una versión nueva del launcher esté rota, esto sigue funcionando.
//
// Qué hace:
//  · Normal: abre el launcher y espera. Cuando el launcher se cierra, se cierra él también (como cuando el launcher era la shell directamente).
//  · Actualización: el launcher descarga la versión nueva a launcher.nuevo/, deja aplicar.json y se cierra. Aquí, con el launcher ya parado, se cambia launcher/ por la nueva
//    (la de antes queda en launcher.previo/) y se abre en «prueba». La versión nueva enseña «Confirmar que deseo esta actualización» y tiene 30 s.
//  · Prueba que sale mal → se vuelve a la versión anterior y se abre esa. Cuenta como «mal»:
//      - confirmar a tiempo no se confirma («plazo»), o se pulsa «Volver a la anterior» («revertir»)
//      - la pantalla de confirmación no llega a salir en 30 s (pantalla negra, bloqueo… → «sin-pantalla»)
//      - el launcher se cierra o se cae antes de confirmar («cerro»)
//      - el PC se apaga o se reinicia sin confirmar (al volver a arrancar se ve que quedó una prueba a medias → «reinicio»)
//  · Si algo de aquí dentro fallara por un error inesperado, se abre el launcher directamente (como antes de existir esto): nunca se deja al PC sin nada.
// La carpeta de control es %APPDATA%\gameshell\actualizacion (la misma que ve el launcher). Todo lo que pasa se anota en arranque.log.

const { app } = require('electron');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const A = require('./actualizador');

const ROOT = path.resolve(__dirname, '..');
const CTL = path.join(app.getPath('appData'), 'gameshell', 'actualizacion');
const P = A.rutas(ROOT, CTL);
const CFG = A.config(__dirname);
const POLL = 250;          // cada cuánto se miran las señales del launcher (ms)
const MARGEN = 2;          // segundos de cortesía sobre los de la cuenta atrás que ve el usuario, para que pulsar en el último segundo valga

const LOGF = path.join(CTL, 'arranque.log');
const log = (...a) => {
  try {
    fs.mkdirSync(CTL, { recursive: true });
    try { if (fs.statSync(LOGF).size > 2e5) fs.renameSync(LOGF, LOGF + '.old'); } catch {}
    fs.appendFileSync(LOGF, new Date().toISOString() + ' ' + a.join(' ') + '\n');
  } catch {}
};
process.on('uncaughtException', e => log('error:', (e && e.stack) || e));
process.on('unhandledRejection', e => log('error:', (e && e.stack) || e));
try { app.disableHardwareAcceleration(); } catch {}      // no abre ninguna ventana: que no gaste nada

let vivo = false;          // ¿hay ahora un launcher abierto por nosotros?
const salir = code => { log('fin', code); app.exit(code || 0); };
const corto = v => (v && v.commit ? String(v.commit).slice(0, 7) : 'desconocida');

// ───────────────────────── abrir el launcher y vigilarlo ─────────────────────────
function lanzar(prueba) {
  const env = { ...process.env, GS_SUPERVISOR: '1', GS_CTL: CTL };
  delete env.ELECTRON_RUN_AS_NODE; delete env.GS_PENDIENTE;
  if (prueba) env.GS_PENDIENTE = prueba.id;       // así el launcher sabe que es una prueba y enseña la pantalla de confirmación
  return spawn(process.execPath, [P.launcher], { env, stdio: 'ignore', windowsHide: false });
}
// Abre el launcher y devuelve cuando se cierra: { causa, code, prueba }. «prueba» sigue puesta solo si no llegó a confirmarse.
function correr(prueba) {
  return new Promise(resolve => {
    const t0 = Date.now(); let c, fin = false, causa = '', mostrado = 0, iv = 0, tk = 0, tf = 0;
    const terminar = (cz, code) => { if (fin) return; fin = true; vivo = false; clearInterval(iv); clearTimeout(tk); clearTimeout(tf); resolve({ causa: cz, code, prueba }); };
    try { c = lanzar(prueba); } catch (e) { log('no se pudo abrir el launcher:', e.message); return terminar('no-arranca', -1); }
    vivo = true; log('launcher abierto (pid ' + c.pid + ')' + (prueba ? ' en prueba ' + prueba.id + ': ' + corto(prueba.desde) + ' → ' + corto(prueba.hasta) : ''));
    c.on('error', e => { log('error del launcher:', e.message); terminar('no-arranca', -1); });
    c.on('exit', (code, sig) => { log('launcher cerrado (código ' + code + (sig ? ', ' + sig : '') + ')' + (causa ? ' por ' + causa : '')); terminar(causa || (prueba ? 'cerro' : 'salio'), code); });
    const matar = cz => {
      causa = cz; log('se cierra el launcher:', cz);
      try { c.kill(); } catch {}
      tk = setTimeout(() => execFile('taskkill', ['/PID', String(c.pid), '/F'], { windowsHide: true }, () => {}), 4000);   // si no se deja cerrar
      tf = setTimeout(() => terminar(cz, -1), 12000);                                                                     // y si ni así, se sigue adelante
    };
    iv = setInterval(() => {
      if (fin || causa || !prueba) return;
      const id = prueba.id;
      if (A.hayS(P, id, 'confirmado')) { confirmar(prueba); prueba = null; return; }
      if (A.hayS(P, id, 'revertir')) return matar('revertir');
      if (!mostrado && A.hayS(P, id, 'mostrado')) { mostrado = Date.now(); log('la pantalla de confirmación ya se ve: ' + CFG.segundos + ' s para confirmar'); }
      // los 30 s cuentan desde que se ve la pantalla de confirmación; si no llega a salir, desde que se abrió el launcher
      if (Date.now() > (mostrado || t0) + (CFG.segundos + MARGEN) * 1000) matar(mostrado ? 'plazo' : 'sin-pantalla');
    }, POLL);
  });
}

// ───────────────────────── poner una versión nueva, confirmarla o deshacerla ─────────────────────────
function confirmar(prueba) {
  log('actualización CONFIRMADA:', corto(prueba.hasta));
  A.quitar(P.pendiente); A.limpiarSenales(P);
  try { A.anotar(P, 'confirmada', { commit: prueba.hasta && prueba.hasta.commit }); } catch (e) { log('estado.json:', e.message); }
}
async function deshacerPrueba(prueba, motivo) {
  log('la actualización ' + corto(prueba.hasta) + ' no se confirmó (' + motivo + '): se vuelve a la versión anterior');
  try {
    await A.deshacer(P);
    log('hecho: launcher = ' + corto(A.version(P.launcher)));
    A.anotar(P, 'deshecha', { commit: prueba.hasta && prueba.hasta.commit, motivo });
  } catch (e) {
    log('NO SE PUDO VOLVER A LA ANTERIOR:', e.message);
    try { A.anotar(P, 'fallo', { commit: prueba.hasta && prueba.hasta.commit, motivo: 'No se pudo volver a la versión anterior: ' + e.message }); } catch {}
  }
  A.quitar(P.pendiente); A.limpiarSenales(P);
}
// El launcher ha dejado aplicar.json y ya está cerrado: se cambia la carpeta. Devuelve la prueba que empieza, o null si no se pudo (entonces queda la versión de siempre).
async function ponerNueva() {
  const req = A.leerJson(P.aplicar); A.quitar(P.aplicar);
  if (!req || !A.hayLauncher(P.nuevo)) { log('petición de actualización sin versión preparada: se ignora'); return null; }
  const hasta = A.version(P.nuevo) || { commit: req.commit }, desde = A.version(P.launcher);
  const prueba = { v: 1, id: String(Date.now()), t0: Date.now(), segundos: CFG.segundos, desde, hasta };
  A.limpiarSenales(P);
  try {
    A.escribirJson(P.pendiente, prueba);      // primero se apunta y luego se cambia: si se va la luz en medio, al volver se sabe qué hacer
    await A.aplicar(P);
    log('actualización puesta: ' + corto(desde) + ' → ' + corto(hasta) + ' (a prueba ' + CFG.segundos + ' s)');
    return prueba;
  } catch (e) {
    log('no se pudo poner la actualización:', e.message);
    A.quitar(P.pendiente);
    try { A.anotar(P, 'fallo', { commit: hasta.commit, motivo: 'No se pudo cambiar la carpeta launcher (¿algo la tiene abierta, o falta permiso de escritura en la carpeta de GameShell?): ' + e.message }); } catch {}
    return null;
  }
}
// Al abrirse el arranque seguro: arregla lo que haya quedado a medias (apagón, cuelgue…)
async function alEmpezar() {
  const r = await A.recuperar(P);
  if (r === 'restaurado') log('faltaba launcher/ (se cortó un cambio de carpetas): se ha vuelto a poner una versión que funciona');
  if (r === 'sin-launcher') {   // no hay nada que abrir: que al menos quede el escritorio de Windows
    log('ERROR GRAVE: no existe la carpeta launcher. Se abre el escritorio de Windows');
    try { spawn('explorer.exe', [], { detached: true, stdio: 'ignore' }).unref(); } catch {}
    return false;
  }
  const pend = A.leerJson(P.pendiente);
  if (pend) {   // quedó una prueba sin confirmar (el PC se apagó o se reinició): no se confirmó, así que se deshace
    const ahora = A.version(P.launcher);
    if (ahora && pend.hasta && ahora.commit === pend.hasta.commit) await deshacerPrueba(pend, 'reinicio');
    else { log('quedó anotada una actualización que no llegó a ponerse: se descarta'); A.quitar(P.pendiente); }
  }
  A.limpiarSenales(P);
  for (const d of [P.fallido, P.tmp]) if (fs.existsSync(d)) await A.borrar(d);
  return true;
}

// ───────────────────────── el bucle principal ─────────────────────────
async function principal() {
  log('arranque seguro v1 · Electron ' + process.versions.electron + ' · rama «' + CFG.rama + '» de ' + CFG.repo + ' · launcher ' + corto(A.version(P.launcher)));
  if (!(await alEmpezar())) return salir(2);
  let prueba = null;
  for (;;) {
    if (fs.existsSync(P.aplicar)) prueba = await ponerNueva();      // con el launcher parado, ahora sí se puede cambiar su carpeta
    const r = await correr(prueba);
    if (r.prueba) {                                                  // la prueba no llegó a confirmarse
      await deshacerPrueba(r.prueba, r.causa); prueba = null;
      if (r.causa === 'cerro' && r.code === 0) { log('el launcher se cerró a propósito: no se vuelve a abrir'); return salir(0); }
      continue;                                                      // se abre la versión de antes
    }
    prueba = null;
    if (r.causa === 'salio' && fs.existsSync(P.aplicar)) continue;  // se cerró para actualizarse: arriba se cambia y se vuelve a abrir
    return salir(r.code);
  }
}
// Último recurso: si el arranque seguro falla por dentro, el launcher se abre solo, como antes (sin vuelta atrás, pero sin dejar el PC en negro)
function directo(motivo) {
  log('FALLO INTERNO (' + motivo + '): se abre el launcher directamente, sin vuelta atrás');
  if (vivo) return;
  try { const c = spawn(process.execPath, [P.launcher], { stdio: 'ignore' }); c.on('exit', code => salir(code)); c.on('error', () => salir(1)); } catch { salir(1); }
}
app.whenReady().then(() => principal().catch(e => directo((e && e.stack) || e)), e => directo(e));
