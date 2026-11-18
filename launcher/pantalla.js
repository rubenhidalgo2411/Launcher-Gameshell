'use strict';
// GameShell · cambiar la resolución de la pantalla desde el launcher, sin salir a Windows.
// Hace el trabajo pantalla.ps1 (PowerShell + user32). Solo se ofrecen los modos que Windows dice que tu pantalla admite.
// El cambio se aplica «en caliente» y hay que confirmarlo: si en 15 s no se confirma (o el launcher se cierra) vuelve solo al modo guardado,
// así una resolución que la tele/monitor no enseñe bien no te deja sin imagen.
const path = require('path');
const { execFile } = require('child_process');

const WAIT = +process.env.GS_PANTALLA_WAIT || 15000;      // (la variable es solo para probar)

// «pantalla.ps1 list» escribe líneas  DEV nombre · CUR ancho alto hz bits · REG … · MODE ancho alto hz   (puro, para poder probarlo sin Windows)
function parseList(txt) {
  const out = { dev: '', cur: null, reg: null, modes: [] }, seen = new Set();
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const l = raw.trim().split(/\s+/), k = l[0];
    if (k === 'DEV') out.dev = l.slice(1).join(' ');
    else if (k === 'CUR' || k === 'REG' || k === 'MODE') {
      const w = +l[1], h = +l[2], hz = +l[3];
      if (!(w >= 320 && h >= 200 && hz >= 0 && w < 20000 && h < 20000)) continue;
      if (k === 'CUR') out.cur = { w, h, hz }; else if (k === 'REG') out.reg = { w, h, hz };
      else if (!seen.has(w + 'x' + h + '@' + hz)) { seen.add(w + 'x' + h + '@' + hz); out.modes.push({ w, h, hz }); }
    }
  }
  out.modes.sort((a, b) => b.w - a.w || b.h - a.h || b.hz - a.hz);
  return out;
}

function create(env) {
  const { log, getWin, refit } = env, win32 = process.platform === 'win32';
  const ps1 = path.join(__dirname, 'pantalla.ps1');
  let timer = 0, pending = null, busy = false;

  // GS_PANTALLA_FAKE=1: una pantalla de mentira para probar los menús sin Windows (no se usa en el uso normal)
  const fake = { cur: [1920, 1080, 60], reg: [1920, 1080, 60], modes: [[3840, 2160, 120], [3840, 2160, 60], [2560, 1440, 144], [2560, 1440, 60], [1920, 1200, 120], [1920, 1080, 144], [1920, 1080, 60], [1920, 1080, 50], [1600, 900, 60], [1280, 720, 60], [800, 600, 60]] };
  const fakeRun = a => {
    if (a[0] === 'list') return { ok: true, out: ['DEV \\\\.\\DISPLAY1', 'CUR ' + fake.cur.join(' ') + ' 32', 'REG ' + fake.reg.join(' ') + ' 32', ...fake.modes.map(m => 'MODE ' + m.join(' '))].join('\n') };
    if (a[0] === 'set' || a[0] === 'save') { const m = [+a[1], +a[2], +a[3]]; if (!fake.modes.some(x => x.join() === m.join())) return { ok: false, code: -2, msg: why(-2), out: 'RES -2' }; fake.cur = m; if (a[0] === 'save') fake.reg = m; return { ok: true, out: 'RES 0' }; }
    if (a[0] === 'revert') { fake.cur = fake.reg.slice(); return { ok: true, out: 'RES 0' }; }
    return { ok: false, msg: 'accion desconocida' };
  };
  function run(args) {
    return new Promise(res => {
      if (process.env.GS_PANTALLA_FAKE) return res(fakeRun(args.map(String)));
      if (!win32) return res({ ok: false, msg: 'Solo en Windows' });
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ps1, ...args.map(String)],
        { windowsHide: true, timeout: 30000, maxBuffer: 1 << 20 }, (e, out) => {
          const t = String(out || '');
          if (e && !t) return res({ ok: false, msg: 'No se pudo ejecutar PowerShell (' + (e.message || e) + ')', out: '' });
          const err = /^ERR (.*)$/m.exec(t), r = /^RES (-?\d+)/m.exec(t);
          if (err) return res({ ok: false, msg: err[1], out: t });
          if (r && +r[1] !== 0) return res({ ok: false, code: +r[1], msg: why(+r[1]), out: t });
          res({ ok: !e || !!r, out: t });
        });
    });
  }
  function why(c) {
    return { 1: 'Windows pide reiniciar para usar ese modo', '-1': 'Windows no pudo cambiar a ese modo', '-2': 'La pantalla no admite ese modo', '-3': 'No se pudo escribir el ajuste',
      '-6': 'No vale con pantallas duplicadas', '-100': 'Ese modo ya no está en la lista de la pantalla' }[c] || 'Windows lo rechazó (' + c + ')';
  }
  const stop = () => { clearTimeout(timer); timer = 0; };
  const same = (a, b) => a && b && a.w === b.w && a.h === b.h && a.hz === b.hz;
  const tell = (ok, msg) => { try { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('pantalla:fin', { ok, msg }); } catch {} };

  const api = {
    // modos disponibles + el actual (cur) y el guardado (reg)
    async list() {
      const r = await run(['list']);
      if (!r.ok) return { ok: false, msg: r.msg };
      const d = parseList(r.out);
      if (!d.cur || !d.modes.length) return { ok: false, msg: 'Windows no dio la lista de modos' };
      return { ok: true, ...d, pending: pending ? { w: pending.w, h: pending.h, hz: pending.hz } : null };
    },
    // cambia a w×h@hz y arranca la cuenta atrás de 15 s; la pantalla del launcher debe enseñar «¿Mantener?»
    async set(w, h, hz) {
      w = Math.round(+w); h = Math.round(+h); hz = Math.round(+hz) || 0;
      if (!(w >= 320 && w <= 16384 && h >= 200 && h <= 16384 && hz >= 0 && hz <= 1000)) return { ok: false, msg: 'Modo no válido' };
      if (busy) return { ok: false, msg: 'Espera un momento…' };
      busy = true;
      try {
        const before = pending ? pending.before : (await api.list()).cur || null;   // a qué volver (si ya había un cambio sin confirmar, a lo de antes de ese)
        const r = await run(['set', w, h, hz]);
        if (!r.ok) { log('resolución: no se pudo cambiar a', w + 'x' + h + '@' + hz, '·', r.msg); return { ok: false, msg: r.msg }; }
        log('resolución: cambiada a', w + 'x' + h + '@' + hz, '(sin confirmar)');
        pending = { w, h, hz, before }; stop();
        timer = setTimeout(() => { api.revert('el tiempo se acabó').then(() => tell(true, 'Se volvió a la resolución anterior')); }, WAIT);
        refit();
        return { ok: true, wait: WAIT / 1000 };
      } finally { busy = false; }
    },
    // lo confirmado se guarda (así sigue al reiniciar)
    async keep() {
      if (!pending) return { ok: false, msg: 'Ya había vuelto a la resolución anterior' };   // p. ej. se acabó el tiempo justo antes de pulsar «Mantener»
      stop(); const p = pending;
      const r = await run(['save', p.w, p.h, p.hz]);
      if (!r.ok) { log('resolución: no se pudo guardar', r.msg); await api.revert('no se pudo guardar'); return { ok: false, msg: r.msg + ' (se volvió a la anterior)' }; }
      pending = null; log('resolución: confirmada y guardada', p.w + 'x' + p.h + '@' + p.hz); refit();
      return { ok: true };
    },
    // aplica w×h@hz y lo guarda al momento, SIN la cuenta atrás de 15 s: es lo que usan los dos ajustes rápidos (teclas M y S)
    // cuando ya los has confirmado una vez por el camino seguro (así una tele que no enseñe bien ese modo no te pilla desprevenido)
    async direct(w, h, hz) {
      w = Math.round(+w); h = Math.round(+h); hz = Math.round(+hz) || 0;
      if (!(w >= 320 && w <= 16384 && h >= 200 && h <= 16384 && hz >= 0 && hz <= 1000)) return { ok: false, msg: 'Modo no válido' };
      if (busy) return { ok: false, msg: 'Espera un momento…' };
      busy = true;
      try {
        stop(); pending = null;
        const r = await run(['save', w, h, hz]);
        if (!r.ok) { log('resolución: no se pudo cambiar a', w + 'x' + h + '@' + hz, '·', r.msg); return { ok: false, msg: r.msg }; }
        log('resolución: ajuste rápido aplicado y guardado', w + 'x' + h + '@' + hz); refit();
        return { ok: true };
      } finally { busy = false; }
    },
    async revert(why) {
      stop();
      if (!pending && !win32) return { ok: true };
      pending = null;
      const r = await run(['revert']);
      log('resolución: se vuelve al modo guardado' + (why ? ' (' + why + ')' : ''), r.ok ? '' : '· ' + r.msg);
      refit();
      return r.ok ? { ok: true } : { ok: false, msg: r.msg };
    },
    // si el launcher se cierra con un cambio sin confirmar, que no se quede esa resolución
    quit() { if (pending) { stop(); pending = null; try { require('child_process').spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ps1, 'revert'], { windowsHide: true, timeout: 15000 }); } catch {} } },
    isPending: () => !!pending,
    _same: same
  };
  return api;
}

module.exports = { create, parseList };
