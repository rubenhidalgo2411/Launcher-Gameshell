'use strict';
// GameShell · boot/actualizador.js
// Todo lo que hace falta para cambiar la carpeta launcher/ por una versión nueva de GitHub, y para volver atrás:
//   · mirar cuál es el último commit de la rama (API de GitHub, o el feed Atom si la API ha puesto límite)
//   · descargar el zip de la rama, sacar SOLO launcher/ (sin git, sin PowerShell, sin 7-Zip), comprobar que no trae errores y dejarlo preparado
//   · cambiar launcher/ por la versión nueva y, si no se confirma, volver a la anterior
// Va en boot/, que NO se actualiza solo: así una versión mala del launcher no puede estropear la vuelta atrás.
// Solo usa módulos de Node (nada de Electron): lo cargan boot/arranque.js (cambia las carpetas) y launcher/actualizar.js (descarga).
//
// Carpetas (todas hermanas, en la raíz de GameShell, para que cambiarlas sea un simple «renombrar»):
//   launcher/          la versión que se está usando
//   launcher.nuevo/    la versión descargada y ya comprobada, esperando a que el launcher se cierre
//   launcher.previo/   la versión que había antes de la última actualización (a ella se vuelve)
//   launcher.fallido/  solo un momento: la versión que se está retirando
//   .gs-descarga/      zona de trabajo mientras se descarga

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const vm = require('vm');

const DEF = { repo: 'rubenhidalgo2411/Launcher-Gameshell', rama: 'main', segundos: 30,
  api: 'https://api.github.com', web: 'https://github.com', zip: 'https://codeload.github.com' };
const SHA = /^[0-9a-f]{40}$/;
const LOCAL = /^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/;   // http solo para probar con un servidor de la propia máquina

// ───────────────────────── configuración ─────────────────────────
// boot/actualizacion.json (opcional): { "repo": "usuario/repositorio", "rama": "main", "segundos": 30 }
function config(bootDir) {
  let u = {}; try { u = JSON.parse(fs.readFileSync(path.join(bootDir, 'actualizacion.json'), 'utf8')); } catch {}
  const c = { ...DEF };
  if (typeof u.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(u.repo)) c.repo = u.repo;
  if (typeof u.rama === 'string' && /^[\w./-]{1,100}$/.test(u.rama) && !u.rama.includes('..')) c.rama = u.rama;
  if (Number.isFinite(u.segundos)) c.segundos = Math.max(5, Math.min(300, Math.round(u.segundos)));
  for (const k of ['api', 'web', 'zip']) if (typeof u[k] === 'string' && LOCAL.test(u[k])) c[k] = u[k].replace(/\/+$/, '');
  return c;
}
function rutas(root, ctl) {
  return { root, ctl,
    launcher: path.join(root, 'launcher'), nuevo: path.join(root, 'launcher.nuevo'), previo: path.join(root, 'launcher.previo'),
    fallido: path.join(root, 'launcher.fallido'), tmp: path.join(root, '.gs-descarga'),
    pendiente: path.join(ctl, 'pendiente.json'), aplicar: path.join(ctl, 'aplicar.json'), estado: path.join(ctl, 'estado.json') };
}

// ───────────────────────── ficheros pequeños ─────────────────────────
const leerJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
function escribirJson(f, o) {   // atómico: se escribe aparte y se renombra, así no queda a medias si se va la luz
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(o, null, 1)); fs.renameSync(t, f);
}
const quitar = f => { try { fs.rmSync(f, { force: true }); } catch {} };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const version = dir => { const v = leerJson(path.join(dir, '.gs-version.json')); return v && SHA.test(v.commit) ? v : null; };   // qué commit es esa carpeta (null = no se sabe)

// Señales entre el launcher y el arranque seguro: ficheros vacíos en la carpeta de control. Uno por cosa, así dos avisos seguidos nunca se pisan.
const senal = (p, id, tipo) => path.join(p.ctl, 'senal-' + id + '.' + tipo);
const hayS = (p, id, tipo) => fs.existsSync(senal(p, id, tipo));
function ponerS(p, id, tipo) { fs.mkdirSync(p.ctl, { recursive: true }); fs.writeFileSync(senal(p, id, tipo), String(Date.now())); }
function limpiarSenales(p) { try { for (const f of fs.readdirSync(p.ctl)) if (/^senal-/.test(f)) quitar(path.join(p.ctl, f)); } catch {} }

// estado.json: cómo terminó la última actualización (para avisar en el launcher) y qué commits ya se probaron y se deshicieron
function anotar(p, resultado, extra = {}) {
  const s = leerJson(p.estado) || {};
  s.v = 1; s.ultimo = { resultado, t: Date.now(), visto: false, ...extra };
  const c = extra.commit, r = new Set(s.rechazadas || []);
  if (c) { if (resultado === 'deshecha') r.add(c); else if (resultado === 'confirmada') r.delete(c); }
  s.rechazadas = [...r].slice(-20);
  escribirJson(p.estado, s);
}

// ───────────────────────── red ─────────────────────────
function errorRed(e) {
  const x = new Error(); x.codigo = 'red';
  if (e && e.status === 404) x.message = 'No encuentro el repositorio o la rama en GitHub (¿es privado? ¿está bien escrito el nombre?)';
  else if (e && (e.status === 403 || e.status === 429)) x.message = 'GitHub ha limitado las consultas por ahora: prueba dentro de un rato';
  else if (e && e.status) x.message = 'GitHub ha respondido con un error (' + e.status + ')';
  else if (e && /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|tiempo agotado|conexión cortada/i.test(String(e.code || '') + ' ' + String(e.message || ''))) x.message = 'No hay conexión con GitHub';
  else x.message = 'No se pudo hablar con GitHub: ' + String((e && e.message) || e);
  return x;
}
// GET con redirecciones (GitHub redirige las descargas), tiempo máximo de espera, tope de tamaño y avance. Solo https (o http a la propia máquina, para probar).
function get(url, { headers = {}, timeout = 20000, limite = 600000, max = 400e6, onProgress, _n = 0 } = {}) {
  return new Promise((resolve, reject) => {
    let u; try { u = new URL(url); } catch (e) { return reject(e); }
    if (!LOCAL.test(u.href)) return reject(new Error('solo se permite https'));
    const mod = u.protocol === 'https:' ? https : http;
    let fin = false, total = 0;
    const ok = v => { if (fin) return; fin = true; clearTimeout(total); resolve(v); };
    const ko = e => { if (fin) return; fin = true; clearTimeout(total); reject(e); };
    const req = mod.get(u, { headers: { 'User-Agent': 'GameShell-actualizador', Accept: '*/*', ...headers } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (_n >= 5) return ko(new Error('demasiadas redirecciones'));
        let next; try { next = new URL(res.headers.location, u).href; } catch (e) { return ko(e); }
        clearTimeout(total); fin = true;
        return resolve(get(next, { headers, timeout, limite, max, onProgress, _n: _n + 1 }));
      }
      if (res.statusCode !== 200) { res.resume(); const e = new Error('HTTP ' + res.statusCode); e.status = res.statusCode; return ko(e); }
      const len = +res.headers['content-length'] || 0, trozos = []; let n = 0;
      res.on('data', d => { n += d.length; if (n > max) return req.destroy(new Error('archivo demasiado grande')); trozos.push(d); if (onProgress) try { onProgress(n, len); } catch {} });
      res.on('end', () => ok(Buffer.concat(trozos)));
      res.on('error', ko);
      res.on('close', () => { if (!res.complete) ko(new Error('conexión cortada')); });
    });
    req.setTimeout(timeout, () => req.destroy(new Error('tiempo agotado')));
    total = setTimeout(() => req.destroy(new Error('tiempo agotado (descarga demasiado lenta)')), limite);
    req.on('error', ko);
  });
}
const xml = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
const refUrl = rama => rama.split('/').map(encodeURIComponent).join('/');

// El último commit de la rama. 1º la API (trae mensaje y fecha; sin cuenta deja 60 consultas por hora y por conexión) y, si falla, el feed Atom de commits, que no cuenta para ese límite.
async function ultima(cfg) {
  let fallo = null;
  try {
    const j = JSON.parse((await get(`${cfg.api}/repos/${cfg.repo}/commits/${refUrl(cfg.rama)}`, { headers: { Accept: 'application/vnd.github+json' }, timeout: 15000, max: 5e6 })).toString('utf8'));
    if (SHA.test(j.sha)) { const c = j.commit || {};
      return { commit: j.sha, fecha: (c.committer && c.committer.date) || (c.author && c.author.date) || '', mensaje: String(c.message || '').split('\n')[0].trim().slice(0, 200), via: 'api' }; }
  } catch (e) { fallo = e; }
  try {
    const x = (await get(`${cfg.web}/${cfg.repo}/commits/${refUrl(cfg.rama)}.atom`, { timeout: 15000, max: 5e6 })).toString('utf8');
    const m = /<entry>[\s\S]*?Grit::Commit\/([0-9a-f]{40})[\s\S]*?<title>\s*([\s\S]*?)\s*<\/title>[\s\S]*?<updated>([^<]+)<\/updated>/.exec(x);
    if (m) return { commit: m[1], fecha: m[3].trim(), mensaje: xml(m[2]).split('\n')[0].trim().slice(0, 200), via: 'atom' };
  } catch (e) { fallo = fallo || e; }
  throw errorRed(fallo);
}
// ¿hay algo nuevo? local = qué versión tengo (null si no se sabe)
async function buscar(cfg, p) {
  const remoto = await ultima(cfg), local = version(p.launcher), st = leerJson(p.estado) || {};
  return { remoto, local, hay: !local || local.commit !== remoto.commit, yaFallo: (st.rechazadas || []).includes(remoto.commit) };
}

// ───────────────────────── zip (sin dependencias) ─────────────────────────
let CRC = null;
function crc32(b) {
  if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
  let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function leerZip(buf) {
  const min = Math.max(0, buf.length - 22 - 65535); let i = buf.length - 22;
  for (; i >= min; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  if (i < min) throw new Error('el zip no es válido (no tiene índice)');
  const total = buf.readUInt16LE(i + 10), cdSize = buf.readUInt32LE(i + 12), cdOff = buf.readUInt32LE(i + 16), cl = buf.readUInt16LE(i + 20);
  if (total === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) throw new Error('zip de más de 4 GB no soportado');
  const comentario = buf.toString('latin1', i + 22, i + 22 + cl).trim();   // GitHub escribe aquí el commit del que sale el zip
  const entries = []; let p = cdOff;
  for (let n = 0; n < total; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('el índice del zip está dañado');
    const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), kl = buf.readUInt16LE(p + 32);
    entries.push({ name: buf.toString('utf8', p + 46, p + 46 + nl), flags: buf.readUInt16LE(p + 8), method: buf.readUInt16LE(p + 10),
      crc: buf.readUInt32LE(p + 16), csize: buf.readUInt32LE(p + 20), usize: buf.readUInt32LE(p + 24), off: buf.readUInt32LE(p + 42) });
    p += 46 + nl + el + kl;
  }
  return { entries, comentario };
}
function datosZip(buf, e) {
  const p = e.off;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) throw new Error('entrada dañada: ' + e.name);
  if (e.flags & 1) throw new Error('el zip está cifrado');
  const ini = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28), raw = buf.subarray(ini, ini + e.csize);
  let d;
  if (e.method === 0) d = raw; else if (e.method === 8) d = zlib.inflateRawSync(raw); else throw new Error('compresión no soportada (' + e.method + ')');
  if (d.length !== e.usize || crc32(d) !== e.crc) throw new Error('entrada dañada (no coincide la suma de control): ' + e.name);
  return d;
}
// Nombres que Windows no admite o que sacarían un archivo de la carpeta (zip-slip): se rechaza el zip entero antes que escribir nada raro.
const RESERVADO = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
function nombreSeguro(rel) {
  if (!rel || rel.length > 240) return null;
  const seg = rel.split('/');
  for (const s of seg) if (!s || s === '.' || s === '..' || /[<>:"|?*\\\x00-\x1f]/.test(s) || /[. ]$/.test(s) || RESERVADO.test(s)) return null;
  return seg;
}
// Saca de «repo-rama/launcher/…» solo lo de launcher/ a la carpeta destino
function extraerLauncher(zip, destino) {
  const { entries, comentario } = leerZip(zip);
  const tops = new Set(entries.map(e => e.name.split('/')[0]));
  if (tops.size !== 1) throw new Error('el zip no tiene la forma que da GitHub');
  const pre = [...tops][0] + '/launcher/'; let n = 0, bytes = 0;
  fs.mkdirSync(destino, { recursive: true });
  for (const e of entries) {
    if (!e.name.startsWith(pre) || e.name === pre) continue;
    const rel = e.name.slice(pre.length), dir = rel.endsWith('/'), seg = nombreSeguro(dir ? rel.slice(0, -1) : rel);
    if (!seg) throw new Error('nombre no permitido dentro del zip: ' + rel);
    const dst = path.join(destino, ...seg);
    if (path.relative(destino, dst).startsWith('..')) throw new Error('ruta fuera de la carpeta: ' + rel);
    if (dir) { fs.mkdirSync(dst, { recursive: true }); continue; }
    const d = datosZip(zip, e); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, d); n++; bytes += d.length;
  }
  if (!n) throw new Error('el zip no trae la carpeta launcher');
  return { archivos: n, bytes, comentario };
}

// ───────────────────────── comprobar que la versión nueva no está rota ─────────────────────────
function listar(dir, rel = '') {
  let out = [];
  let l = []; try { l = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch {}
  for (const d of l) { const r = rel ? rel + '/' + d.name : d.name; if (d.isDirectory()) out = out.concat(listar(dir, r)); else out.push(r); }
  return out;
}
const NECESARIOS = ['main.js', 'preload.js', 'index.html', 'package.json', 'js/app.js'];
// Devuelve la lista de problemas (vacía = todo bien). Además de que estén los archivos clave, compila cada .js con el motor de JavaScript de esta misma instalación:
// así una errata de sintaxis (la causa más típica de una pantalla negra) se pilla ANTES de instalar, sin llegar a arrancarla.
function validar(dir) {
  const err = [];
  for (const f of NECESARIOS) if (!fs.existsSync(path.join(dir, f))) err.push('falta ' + f);
  try { const j = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); if (j.main !== 'main.js') err.push('package.json: «main» ya no es main.js'); }
  catch { err.push('package.json no se puede leer'); }
  for (const f of listar(dir)) {
    if (!/\.js$/.test(f) || /^(assets|node_modules)\//.test(f)) continue;
    try { new vm.Script('(function(exports,require,module,__filename,__dirname){' + fs.readFileSync(path.join(dir, f), 'utf8') + '\n})', { filename: f }); }
    catch (e) { err.push('error de sintaxis en ' + f + ': ' + e.message); }
  }
  return err;
}

// ───────────────────────── descargar y dejar preparada la versión nueva ─────────────────────────
const SIN_PERMISO = ['EACCES', 'EPERM', 'EROFS'];
function permiso(e, root) {   // el usuario con el que corre el launcher no puede escribir junto a launcher/: se dice qué hacer (y antes de bajar nada)
  const x = new Error('No hay permiso para escribir en la carpeta de GameShell (' + root + '). Dale permiso de «Modificar» a este usuario sobre esa carpeta (clic derecho → Propiedades → Seguridad) y vuelve a probar.');
  x.codigo = 'permiso'; x.detalle = [String((e && e.message) || e)]; return x;
}
async function borrar(d) {   // borra una carpeta aunque el antivirus la tenga cogida un momento
  for (let i = 0; i < 12; i++) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} if (!fs.existsSync(d)) return true; await dormir(500); }
  return false;
}
// Lo que hayas metido tú a mano en estas carpetas (fotos de fondo, sonidos, letras, el medidor de FPS) pasa a la versión nueva si esta no trae un archivo con ese nombre
const CONSERVAR = ['assets/fondos', 'assets/sonidos', 'assets/fuentes', 'bin'];
function conservarPropios(actual, nuevo) {
  let n = 0;
  for (const d of CONSERVAR) for (const f of listar(path.join(actual, ...d.split('/')))) {
    const src = path.join(actual, ...d.split('/'), ...f.split('/')), dst = path.join(nuevo, ...d.split('/'), ...f.split('/'));
    if (fs.existsSync(dst)) continue;
    try { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); n++; } catch {}
  }
  return n;
}
async function descargar(cfg, p, { onProgress, info } = {}) {
  const prog = (pct, msg) => { try { onProgress && onProgress({ pct, msg }); } catch {} };
  prog(2, 'Consultando GitHub…');
  const ult = info || await ultima(cfg);
  await borrar(p.tmp); await borrar(p.nuevo);
  try { fs.mkdirSync(p.tmp, { recursive: true }); const t = path.join(p.tmp, '.permiso'); fs.writeFileSync(t, '1'); fs.rmSync(t); }
  catch (e) { await borrar(p.tmp); throw SIN_PERMISO.includes(e.code) ? permiso(e, p.root) : e; }
  prog(5, 'Descargando…');
  const zip = await get(`${cfg.zip}/${cfg.repo}/zip/refs/heads/${refUrl(cfg.rama)}`, { timeout: 30000, onProgress: (n, len) => prog(len ? 5 + Math.round(n / len * 70) : 40, 'Descargando…') });
  prog(78, 'Descomprimiendo…');
  const out = path.join(p.tmp, 'launcher');
  try {
    const r = extraerLauncher(zip, out);
    prog(88, 'Comprobando que no trae errores…');
    const errores = validar(out);
    if (errores.length) { const e = new Error('La versión nueva no pasa las comprobaciones (' + errores.slice(0, 2).join('; ') + '). No se instala.'); e.codigo = 'invalida'; e.detalle = errores; throw e; }
    const propios = conservarPropios(p.launcher, out), mismo = SHA.test(r.comentario) ? r.comentario === ult.commit : true;
    const v = { commit: SHA.test(r.comentario) ? r.comentario : ult.commit, fecha: mismo ? ult.fecha : '', mensaje: mismo ? ult.mensaje : '',   // si salió otro commit mientras se descargaba, vale el del zip
      rama: cfg.rama, repo: cfg.repo, instalada: new Date().toISOString(), archivos: r.archivos, propios };
    fs.writeFileSync(path.join(out, '.gs-version.json'), JSON.stringify(v, null, 1));
    fs.renameSync(out, p.nuevo);   // de golpe: si existe launcher.nuevo, está completo
    prog(100, 'Lista');
    return v;
  } catch (e) { throw SIN_PERMISO.includes(e.code) ? permiso(e, p.root) : e;
  } finally { await borrar(p.tmp); }
}
const pedirAplicar = (p, v) => escribirJson(p.aplicar, { v: 1, commit: v.commit, t: Date.now() });   // «ya está preparada: cierra el launcher y cámbiala»

// ───────────────────────── cambiar carpetas (lo hace el arranque seguro, con el launcher parado) ─────────────────────────
async function renombrar(a, b, intentos = 24, espera = 500) {   // Windows no deja renombrar una carpeta si algo la tiene abierta un instante: se reintenta unos segundos
  for (let i = 0; ; i++) {
    try { fs.renameSync(a, b); return; }
    catch (e) { if (i >= intentos || !['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY', 'EEXIST'].includes(e.code)) throw e; await dormir(espera); }
  }
}
const hayLauncher = d => fs.existsSync(path.join(d, 'main.js'));
async function aplicar(p) {   // nuevo → launcher, y la de antes queda como «previo»
  if (!hayLauncher(p.nuevo)) throw new Error('no hay una versión preparada');
  if (!(await borrar(p.previo))) throw new Error('no se pudo borrar la copia anterior (' + p.previo + ')');
  await renombrar(p.launcher, p.previo);
  try { await renombrar(p.nuevo, p.launcher); }
  catch (e) { try { await renombrar(p.previo, p.launcher); } catch {} throw e; }   // si falla, todo queda como estaba
}
async function deshacer(p) {   // previo → launcher; la que no sirvió se borra
  if (!hayLauncher(p.previo)) throw new Error('no hay una versión anterior guardada');
  await borrar(p.fallido);
  await renombrar(p.launcher, p.fallido);
  try { await renombrar(p.previo, p.launcher); }
  catch (e) { try { await renombrar(p.fallido, p.launcher); } catch {} throw e; }
  borrar(p.fallido);
}
// Al arrancar: si se fue la luz en medio de un cambio de carpetas, deja launcher/ en un estado que funcione
async function recuperar(p) {
  if (hayLauncher(p.launcher)) return 'ok';
  for (const alt of [p.previo, p.nuevo, p.fallido]) if (hayLauncher(alt)) { await borrar(p.launcher); await renombrar(alt, p.launcher); return 'restaurado'; }
  return 'sin-launcher';
}

module.exports = { DEF, config, rutas, leerJson, escribirJson, quitar, dormir, version, senal, hayS, ponerS, limpiarSenales, anotar,
  get, ultima, buscar, leerZip, extraerLauncher, crc32, nombreSeguro, validar, listar, conservarPropios, descargar, pedirAplicar,
  borrar, renombrar, aplicar, deshacer, recuperar, hayLauncher };
