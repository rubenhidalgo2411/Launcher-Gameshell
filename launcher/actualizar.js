'use strict';
// GameShell · actualizar.js — la parte del launcher de «Buscar actualizaciones».
// Hace de puente entre la pantalla (js/actualizar.js) y boot/ (actualizador.js: descarga y cambia carpetas · arranque.js: vigila y vuelve atrás).
// Con el arranque seguro habla por archivos en %APPDATA%\gameshell\actualizacion, nunca por memoria compartida: así no depende de que esta versión del launcher sea buena.
//   upd:state    qué versión hay, si esto es una «prueba» (recién actualizado y a la espera de confirmar) y cómo terminó la última actualización
//   upd:check    ¿hay una versión nueva en GitHub?
//   upd:install  descarga la versión nueva, comprueba que no tenga errores, la deja preparada y cierra el launcher; el arranque seguro la pone y la abre en prueba
//   upd:shown    la pantalla de confirmación ya se ve: desde ahora cuentan los 30 s
//   upd:confirm  «Confirmar que deseo esta actualización»
//   upd:revert   «Volver a la anterior ahora»
//   upd:seen     ya se avisó de cómo terminó la última actualización
// Solo funciona cuando el launcher lo abrió el arranque seguro (GS_SUPERVISOR=1): sin él no habría nadie que cambie la carpeta ni que vuelva atrás.
const path = require('path');

function create({ app, ipcMain, getWin, log, dev }) {
  const root = path.resolve(__dirname, '..');
  let A = null;
  try { A = require(path.join(root, 'boot', 'actualizador.js')); } catch (e) { log('actualizaciones: no se pudo cargar boot/actualizador.js (' + e.message + ')'); }
  const supervised = !!A && !dev && process.env.GS_SUPERVISOR === '1';
  const ctl = process.env.GS_CTL || path.join(app.getPath('userData'), 'actualizacion');
  const P = A ? A.rutas(root, ctl) : null, cfg = A ? A.config(path.join(root, 'boot')) : null;
  const pend = /^\d{10,16}$/.test(process.env.GS_PENDIENTE || '') ? process.env.GS_PENDIENTE : '';   // id de la prueba en curso (lo pone el arranque seguro)
  let busy = false;

  const noDisponible = () => dev ? 'En modo desarrollo (npm start) no se actualiza' : !A ? 'Falta la carpeta boot: copia también esa carpeta' : 'El launcher no se abrió con el arranque seguro: ejecuta otra vez instalar-shell.bat y reinicia la sesión';
  const resumen = () => supervised ? 'activas · rama «' + cfg.rama + '» de ' + cfg.repo + (pend ? ' · PRUEBA en curso (' + pend + ')' : '') : 'no disponibles (' + noDisponible() + ')';

  ipcMain.handle('upd:state', () => {
    const st = { supervised, dev: !!dev, hay: !!A, rama: cfg && cfg.rama, repo: cfg && cfg.repo, pendiente: null, actual: null, ultimo: null };
    if (!A) return st;
    st.actual = A.version(P.launcher);
    const e = A.leerJson(P.estado) || {}; st.ultimo = e.ultimo || null;
    if (pend) { const p = A.leerJson(P.pendiente); if (p && p.id === pend) st.pendiente = { id: p.id, segundos: p.segundos || 30, desde: p.desde || null, hasta: p.hasta || {} }; }
    return st;
  });
  ipcMain.handle('upd:check', async () => {
    if (!supervised) return { ok: false, msg: noDisponible() };
    try { return { ok: true, rama: cfg.rama, ...(await A.buscar(cfg, P)) }; }
    catch (e) { log('actualizaciones: comprobar:', e.message); return { ok: false, msg: e.message }; }
  });
  // cierra el launcher «con educación» (se ejecuta lo de will-quit de main.js: se paran el vigía, los Buzz…) para que el arranque seguro pueda cambiar la carpeta
  function cerrar() {
    const w = getWin(); try { if (w && !w.isDestroyed()) w.setClosable(true); } catch {}
    try { app.quit(); } catch {}
    setTimeout(() => app.exit(0), 6000);   // por si algo no deja cerrar
  }
  ipcMain.handle('upd:install', async () => {
    if (!supervised) return { ok: false, msg: noDisponible() };
    if (pend) return { ok: false, msg: 'Primero confirma o deshaz la actualización de ahora' };
    if (busy) return { ok: false, msg: 'Ya hay una actualización en marcha' };
    busy = true; let ult = 0;
    const prog = d => { const t = Date.now(); if (d.pct < 100 && t - ult < 150) return; ult = t; try { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('upd:progress', d); } catch {} };
    try {
      const v = await A.descargar(cfg, P, { onProgress: prog });
      A.pedirAplicar(P, v);
      log('actualizaciones: versión ' + v.commit.slice(0, 7) + ' lista (' + v.archivos + ' archivos); se cierra el launcher para ponerla');
      setTimeout(cerrar, 900);   // un momento para que se lea «Iniciando la actualización…»
      return { ok: true, version: v };
    } catch (e) { busy = false; log('actualizaciones: instalar:', e.message); return { ok: false, msg: e.message, invalida: e.codigo === 'invalida' }; }
  });
  const senal = tipo => {
    if (!supervised || !pend) return { ok: false, msg: 'No hay ninguna actualización a prueba' };
    try { A.ponerS(P, pend, tipo); return { ok: true }; } catch (e) { log('actualizaciones: señal ' + tipo + ':', e.message); return { ok: false, msg: e.message }; }
  };
  ipcMain.handle('upd:shown', () => senal('mostrado'));
  ipcMain.handle('upd:revert', () => senal('revertir'));
  ipcMain.handle('upd:confirm', async () => {   // «ok» solo cuando el arranque seguro ya lo ha recogido (borra pendiente.json): así lo que se ve en pantalla es lo que de verdad pasó
    const r = senal('confirmado'); if (!r.ok) return r;
    for (let i = 0; i < 24; i++) { await A.dormir(150); const p = A.leerJson(P.pendiente); if (!p || p.id !== pend) return { ok: true }; }
    return { ok: false, msg: 'El arranque seguro no ha respondido' };
  });
  ipcMain.handle('upd:seen', () => {
    if (!A) return false;
    try { const e = A.leerJson(P.estado); if (e && e.ultimo) { e.ultimo.visto = true; A.escribirJson(P.estado, e); } return true; } catch { return false; }
  });
  return { resumen, supervised, prueba: !!pend };
}
module.exports = { create };
