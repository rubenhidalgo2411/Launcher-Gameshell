'use strict';
// GameShell · mandos Buzz! integrados.
//
// El pincho de los Buzz! no empieza a «hablar» con los mandos hasta que el PC le manda un informe HID; BuzzActivar (launcher/buzz/BuzzActivar.py, el mismo programa que ya
// funcionaba suelto, sin tocar) lo hace solo cada vez que se enchufa el pincho. Aquí se arranca en segundo plano (sin ventana) cuando el launcher ya está listo y se para al cerrarse.
// Hace falta que lo arranque el launcher porque GameShell es la shell de Windows: sin Explorador no se ejecuta la carpeta de Inicio, así que «arranque automático» no serviría.
//
// Necesita Python 3 y la librería hidapi (lo mismo que BuzzActivar suelto). El programa que corre es launcher/buzz/buzz_gameshell.py, que importa BuzzActivar.py y le añade los avisos
// al launcher («@RECEPTOR 1», «@MANDO 2»…), el apagado ordenado y el no abrirse dos veces. Estados (st):
//   off · starting · waiting (activo, sin pincho) · ready (pincho conectado) · no-python · no-hidapi · other (hay otra copia abierta) · error · sin-archivos · unsupported (no es Windows)
//
// Todo lo del sistema (spawn, execFile, plataforma) se puede sustituir con env, para probar el comportamiento sin Windows.
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

const TAIL = 40;
const PY = [['py', ['-3']], ['python', []]];      // el mismo orden que usan los .bat de BuzzActivar (así es el Python donde se instaló hidapi)

function create(env = {}) {
  const log = env.log || (() => {});
  const platform = env.platform || process.platform, win32 = platform === 'win32';
  const spawn = env.spawn || cp.spawn, execFile = env.execFile || cp.execFile;
  const dir = env.dir || path.join(__dirname, 'buzz'), script = path.join(dir, 'buzz_gameshell.py'), ppid = env.pid || process.pid;
  const childEnv = () => ({ ...(env.env || process.env), PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' });

  const cfg = { on: true, beep: true };
  let ready = false, child = null, st = 'off', receptor = false, mandos = new Set(), py = null, token = 0, pending = 0;
  let stopping = false, onStopped = null, restartTimer = 0, other = 0, crashes = [], tail = [];

  const tailOf = t => String(t || '').trim().split('\n').slice(-3).join(' | ').slice(-400);
  const killTree = pid => { try { if (win32) execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {}); else process.kill(pid); } catch {} };
  const schedule = ms => { clearTimeout(restartTimer); restartTimer = setTimeout(() => { restartTimer = 0; if (cfg.on && ready && !child) start(); }, ms); };

  // ¿hay Python 3? Se prueba «py -3» y luego «python». Se recuerda el que funcione (restart lo vuelve a buscar, por si lo acabas de instalar).
  function findPython(force) {
    if (py && !force) return Promise.resolve(py);
    return new Promise(resolve => {
      let i = 0;
      const next = () => {
        if (i >= PY.length) return resolve(null);
        const [cmd, a] = PY[i++]; let done = false;
        const fin = (e, out) => { if (done) return; done = true; if (!e && String(out).trim() === '3') { py = { cmd, args: a }; return resolve(py); } next(); };
        try { execFile(cmd, [...a, '-c', 'import sys;print(sys.version_info[0])'], { windowsHide: true, timeout: 10000, env: childEnv() }, fin); } catch (e) { fin(e); }
      };
      next();
    });
  }

  function start() {
    if (!win32) { st = 'unsupported'; return; }
    if (child || (pending && pending === token)) return;
    if (!fs.existsSync(script)) { st = 'sin-archivos'; log('Buzz: falta', script); return; }
    const my = pending = ++token; st = 'starting';
    findPython().then(p => {
      if (my !== token) return;                                  // mientras tanto se pidió otra cosa (parar, reiniciar…)
      pending = 0;
      if (!cfg.on) return;
      if (!p) { st = 'no-python'; log('Buzz: no hay Python 3 (ni «py -3» ni «python»)'); return; }
      launch(p);
    }).catch(e => { if (my === token) { pending = 0; st = 'error'; } log('Buzz:', e && e.message); });
  }

  function launch(p) {
    const args = [...p.args, '-X', 'utf8', '-u', script, '--padre', String(ppid)];
    if (cfg.beep) args.push('--pitido');
    let c;
    try { c = spawn(p.cmd, args, { cwd: dir, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: childEnv() }); }
    catch (e) { st = 'error'; log('Buzz: no arranca:', e.message); return; }
    child = c; receptor = false; mandos = new Set(); tail = []; st = 'starting'; stopping = false;
    log('Buzz: BuzzActivar en marcha (' + p.cmd + ', pid ' + c.pid + ')');
    let buf = '', eb = '';
    c.stdout.setEncoding('utf8'); c.stderr.setEncoding('utf8');
    c.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); if (l) line(l); } if (buf.length > 1e5) buf = ''; });
    c.stderr.on('data', d => { eb = (eb + d).slice(-3000); });
    c.stdin.on('error', () => {});                               // si el programa ya no está, escribirle no debe dar un error suelto
    c.on('error', e => {
      if (child !== c) return;
      child = null; receptor = false; log('Buzz: no se pudo arrancar:', e.message);
      st = e.code === 'ENOENT' ? 'no-python' : 'error'; if (e.code === 'ENOENT') py = null;
      const cb = onStopped; onStopped = null; stopping = false; if (cb) cb();
    });
    c.on('exit', (code, sig) => {
      if (child !== c) return;
      child = null; receptor = false; mandos = new Set();
      log('Buzz: BuzzActivar terminó (código ' + code + (sig ? ', ' + sig : '') + ')' + (eb.trim() ? ' · ' + tailOf(eb) : ''));
      const was = stopping, cb = onStopped; stopping = false; onStopped = null;
      if (was) { st = 'off'; if (cb) cb(); return; }
      if (code === 4) { st = 'no-hidapi'; return; }
      if (code === 5) { st = 'error'; return; }
      if (code === 3) { if (++other <= 3) { st = 'starting'; schedule(3500); } else st = 'other'; return; }   // otra copia (p. ej. la anterior, que aún se estaba apagando): se reintenta un poco después
      other = 0;
      const now = Date.now(); crashes = crashes.filter(t => now - t < 60000); crashes.push(now);
      if (crashes.length >= 4) { st = 'error'; log('Buzz: se para demasiado seguido: no se reintenta (Opciones → Mandos Buzz → Reiniciar)'); return; }
      st = 'starting'; schedule(2500);
    });
  }

  // una línea de lo que escribe buzz_gameshell.py: las que empiezan por «@» son avisos para el launcher; el resto es lo de BuzzActivar de siempre
  function line(l) {
    if (l[0] !== '@') {
      tail.push(l); if (tail.length > TAIL) tail.shift();
      if (/Receptor detectado/.test(l)) log('Buzz:', l.replace(/^\[[\d:]+\]\s*/, ''));
      return;
    }
    const sp = l.indexOf(' '), k = sp < 0 ? l.slice(1) : l.slice(1, sp), v = sp < 0 ? '' : l.slice(sp + 1);
    switch (k) {
      case 'LISTO': st = receptor ? 'ready' : 'waiting'; break;
      case 'RECEPTOR': receptor = v === '1'; if (!receptor) mandos = new Set(); st = receptor ? 'ready' : 'waiting'; log('Buzz: pincho', receptor ? 'conectado' : 'desconectado'); break;
      case 'MANDO': mandos.add(+v || 0); log('Buzz: mando', v, 'detectado'); break;
      case 'AVISO': log('Buzz:', v); break;
      case 'ERR': log('Buzz: error:', v); break;
      case 'OTRA': log('Buzz: ya hay otra copia de BuzzActivar abierta'); break;
    }
  }

  // parar con elegancia: se le pide «salir» (apaga las luces de los mandos) y, si en 2,5 s no lo hace, se mata él y todo lo que haya arrancado
  function stop() {
    token++; pending = 0; clearTimeout(restartTimer); restartTimer = 0;
    return new Promise(resolve => {
      const c = child;
      if (!c) { if (!cfg.on) st = win32 ? 'off' : 'unsupported'; return resolve(); }   // (sin proceso: si se está reiniciando, el estado ya lo pondrá start)
      stopping = true;
      const k = setTimeout(() => { if (child === c) killTree(c.pid); }, 2500);
      const z = setTimeout(() => { if (child === c) { child = null; stopping = false; onStopped = null; st = 'off'; resolve(); } }, 6000);   // por si nunca llegara el «exit»
      onStopped = () => { clearTimeout(k); clearTimeout(z); resolve(); };
      try { c.stdin.write('salir\n'); } catch { killTree(c.pid); }
    });
  }
  function restart() { return stop().then(() => { crashes = []; other = 0; py = null; if (cfg.on && ready) start(); }); }

  // al cerrar el launcher (no se puede esperar de forma asíncrona): se pide «salir» y se espera como mucho 1,2 s; si sigue vivo, se mata
  function quit() {
    token++; pending = 0; clearTimeout(restartTimer); restartTimer = 0;
    const c = child; if (!c) return;
    stopping = true;
    try { c.stdin.write('salir\n'); } catch {}
    const alive = () => { try { process.kill(c.pid, 0); return true; } catch (e) { return !!e && e.code === 'EPERM'; } };
    try { const w = new Int32Array(new SharedArrayBuffer(4)), t0 = Date.now(); while (Date.now() - t0 < 1200 && alive()) Atomics.wait(w, 0, 0, 100); } catch {}
    if (alive()) { try { if (win32) cp.execFileSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { windowsHide: true, timeout: 3000, stdio: 'ignore' }); else process.kill(c.pid); } catch {} }
  }

  // pip install hidapi (lo mismo que 1_Instalar.bat). Si no hay permiso en la carpeta de Python, se prueba con --user.
  async function install() {
    if (!win32) return { ok: false, msg: 'Solo en Windows' };
    const p = await findPython(true);
    if (!p) return { ok: false, msg: 'No encuentro Python 3. Instálalo desde python.org (marca «Add python.exe to PATH»)' };
    const pip = extra => new Promise(res => {
      try {
        execFile(p.cmd, [...p.args, '-m', 'pip', 'install', '--upgrade', '--retries', '1', '--timeout', '15', ...extra, 'hidapi'],
          { windowsHide: true, timeout: 240000, env: { ...childEnv(), PIP_DISABLE_PIP_VERSION_CHECK: '1' } }, (e, out, err) => res({ e, text: String(err || '') + '\n' + String(out || '') }));
      } catch (e) { res({ e, text: e.message }); }
    });
    let r = await pip([]);
    if (r.e) { log('Buzz: pip falló:', tailOf(r.text)); r = await pip(['--user']); }
    if (r.e) { log('Buzz: pip --user falló:', tailOf(r.text)); return { ok: false, msg: 'No se pudo instalar hidapi (¿hay internet?). Detalles en gameshell.log' }; }
    log('Buzz: hidapi instalado');
    restart().catch(() => {});
    return { ok: true, msg: 'hidapi instalado · activando los Buzz…' };
  }

  return {
    // se llama con los ajustes (ui.json) al arrancar y cada vez que cambian: buzzOn (activar solos) y buzzBeep (pitido al detectar el pincho)
    configure(ui) {
      const on = !(ui && ui.buzzOn === false), beep = !(ui && ui.buzzBeep === false), beepChanged = beep !== cfg.beep;
      cfg.on = on; cfg.beep = beep;
      if (!win32) { st = 'unsupported'; return; }
      if (!on) { if (child || pending) stop(); else st = 'off'; return; }
      if (!ready) { st = 'starting'; return; }
      if (child && beepChanged) { restart().catch(() => {}); return; }
      if (!child) start();
    },
    // el launcher ya terminó de arrancar (intro y Precarga Post Intro incluidas): ahora se activan los Buzz.
    // Se espera a este momento para que el pincho no pueda confundir a la Precarga Post Intro, que espera a que se encienda tu mando.
    markReady() { ready = true; if (cfg.on) start(); },
    restart, stop, quit, install,
    state() { return { platform, win32, st, on: cfg.on, beep: cfg.beep, receptor, mandos: [...mandos].sort((a, b) => a - b), python: py ? py.cmd : '', last: tail.slice(-3), dir }; },
    _line: line
  };
}

module.exports = { create };
