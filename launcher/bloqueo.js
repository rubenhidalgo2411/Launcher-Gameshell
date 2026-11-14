// GameShell · bloqueador de anuncios y rastreadores del navegador (lo que hacen uBlock Origin / AdBlock), sin extensiones ni dependencias.
// Entiende el formato de las listas de uBlock / AdBlock Plus (EasyList, EasyPrivacy, «uBlock filters»…):
//   · reglas de red  → ||dominio^  |https://…  /ruta/  con *, ^, $third-party, $script, $domain=…, @@ (excepciones)…
//   · reglas visuales → dominio##.selector  ##.selector  dominio#@#.selector (excepciones)
// Lo que no entiende (scriptlets ##+js, filtros procedimentales :has-text, removeparam, csp, redirect…) se ignora; nunca rompe una página.
// main.js lo usa con session.webRequest (red) y el preload del webview (js/webview-preload.js) con el CSS que se genera aquí (visual).
'use strict';
const fs = require('fs'), path = require('path');

// ───────── utilidades ─────────
const TYPES = ['document', 'subdocument', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'];
const TBIT = Object.fromEntries(TYPES.map((t, i) => [t, 1 << i]));
const RT = { mainFrame: 'document', subFrame: 'subdocument', stylesheet: 'stylesheet', script: 'script', image: 'image', font: 'font', object: 'object', xhr: 'xmlhttprequest', ping: 'ping', cspReport: 'other', media: 'media', webSocket: 'websocket', other: 'other' }; // Electron → listas
const ALIAS = { css: 'stylesheet', xhr: 'xmlhttprequest', frame: 'subdocument', doc: 'document', beacon: 'ping', '3p': 'third-party', 'first-party': '~third-party', '1p': '~third-party', '~3p': '~third-party' };
const SLD = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'or', 'ne', 'go']);
const hostOf = u => { const m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^\/?#@]*@)?([^\/?#:]+)/i.exec(u || ''); return m ? m[1].toLowerCase() : ''; };
const etld1 = h => { const p = h.split('.'), n = p.length; if (n <= 2) return h; return (p[n - 1].length === 2 && SLD.has(p[n - 2]) ? p.slice(-3) : p.slice(-2)).join('.'); }; // «registrable domain» aproximado (sin la lista pública de sufijos)
const inDom = (h, d) => h === d || h.endsWith('.' + d);

// patrón de las listas → RegExp  (|| inicio de dominio · | inicio/fin · * cualquier cosa · ^ separador)
function toRegex(p) {
  let re = '', i = 0, end = p.length, tail = false;
  if (p.startsWith('||')) { re = '^[a-z][a-z0-9+.-]*:\\/\\/(?:[^\\/?#]*\\.)?'; i = 2; } else if (p[0] === '|') { re = '^'; i = 1; }
  if (end > i && p[end - 1] === '|') { tail = true; end--; }
  for (; i < end; i++) {
    const c = p[i];
    if (c === '*') re += '.*';
    else if (c === '^') re += '(?:[^\\w.%-]|$)';
    else re += /[.+?${}()|[\]\\\/]/.test(c) ? '\\' + c : c;
  }
  return new RegExp(re + (tail ? '$' : ''), 'i');
}
// la palabra más larga que obligatoriamente aparece entera en cualquier URL que case con el patrón (sirve de índice: así no se prueban miles de reglas por petición)
function pickToken(p) {
  const left = p[0] === '|', right = p[p.length - 1] === '|' || p[p.length - 1] === '^';
  const re = /[a-z0-9%]+/gi; let m, best = '';
  while ((m = re.exec(p))) {
    const s = m.index, e = s + m[0].length;
    const before = s === 0 ? (left ? '|' : '*') : p[s - 1], after = e === p.length ? (right ? '|' : '*') : p[e];
    if (before === '*' || after === '*') continue;     // podría ser un trozo de una palabra más larga de la URL
    if (m[0].length > best.length) best = m[0];
  }
  return best.length >= 3 ? best.toLowerCase() : '';
}
const NO_COSM = /:(?:style|has-text|-abp-|xpath|matches-|upward|remove|contains|others|watch-attr|if|if-not|min-text-length|nth-ancestor|-js-|not\(\s*:has-text)/i; // filtros procedimentales de uBlock: no son CSS

// ───────── el motor: un conjunto de reglas (por ejemplo «anuncios» o «cookies») ─────────
class Engine {
  constructor() {
    this.hostAll = new Map(); this.exHostAll = new Map();                 // ||host^ sin más: dominio → 1 (siempre) | 2 (solo de terceros) | 3
    this.hostMap = new Map(); this.exHostMap = new Map();                 // ||host/ruta…: dominio → [reglas]
    this.tok = new Map(); this.exTok = new Map(); this.gen = []; this.exGen = []; // el resto: por palabra de la URL, o sin índice
    this.docEx = new Set();                                                // @@||sitio^$document: sitio en lista blanca
    this.cosm = new Map(); this.cosmEx = new Map(); this.genCls = new Map(); this.genId = new Map(); this.genAny = [];
    this.n = 0; this.nc = 0; this._cc = new Map();
  }
  // ── lectura de una línea de la lista ──
  add(line, base) {
    line = line.trim();
    if (!line || line[0] === '!' || line[0] === '[') return;
    if (/#@?[?$%]#/.test(line)) return;                                          // filtros procedimentales / de scripts de uBlock: no se soportan
    if (line.includes('#') && /^[^#\s]*#(?:@#|#)/.test(line)) return this.addCosm(line, base);
    this.addNet(line);
  }
  addNet(line) {
    let ex = false;
    if (line.startsWith('@@')) { ex = true; line = line.slice(2); }
    let pat = line, opts = '';
    if (!(line[0] === '/' && line.endsWith('/') && line.length > 2)) {            // /regex/ completas: no se soportan
      const d = line.lastIndexOf('$');
      if (d >= 0 && /^~?[a-z0-9_-]+(?:=[^,]*)?(?:,~?[a-z0-9_-]+(?:=[^,]*)?)*$/i.test(line.slice(d + 1))) { pat = line.slice(0, d); opts = line.slice(d + 1); }
    } else return;
    pat = pat.trim().toLowerCase();
    const r = { tm: 0, tn: 0, third: 2, inc: null, exc: null, pat, re: null, all: false };
    if (opts) for (let o of opts.split(',')) {
      let neg = false, v = ''; if (o[0] === '~') { neg = true; o = o.slice(1); }
      const eq = o.indexOf('='); if (eq >= 0) { v = o.slice(eq + 1); o = o.slice(0, eq); }
      o = o.toLowerCase(); if (ALIAS[o]) { const a = ALIAS[o]; if (a[0] === '~') { neg = !neg; o = a.slice(1); } else o = a; }
      if (o === 'third-party') r.third = neg ? 0 : 1;
      else if (TBIT[o]) { if (neg) r.tn |= TBIT[o]; else r.tm |= TBIT[o]; }
      else if (o === 'domain') for (const d of v.toLowerCase().split('|')) { if (!d) continue; if (d[0] === '~') (r.exc = r.exc || []).push(d.slice(1)); else (r.inc = r.inc || []).push(d); }
      else if (o === 'important' || o === 'match-case' || o === 'all') { /* sin efecto aquí */ }
      else return;                                                               // opción que no entendemos (removeparam, csp, redirect, popup…): la regla se ignora entera
    }
    if (ex && r.tm === TBIT.document && !r.tn) { const m = /^\|\|([a-z0-9.-]+)(?:\^.*)?$/.exec(pat); if (m) this.docEx.add(m[1]); return; } // lista blanca de un sitio entero
    if (!pat || pat === '*') { if (!r.inc || !(r.tm || r.tn)) return; pat = '*'; r.all = true; } // «$script,domain=sitio»: todos los scripts de ese sitio
    const hm = /^\|\|((?:[a-z0-9-]+\.)*[a-z0-9-]+)([\^\/:?|].*)?$/.exec(pat);
    const A = ex ? this.exHostAll : this.hostAll, H = ex ? this.exHostMap : this.hostMap, T = ex ? this.exTok : this.tok, G = ex ? 'exGen' : 'gen';
    if (hm && (hm[2] === undefined || hm[2] === '^' || hm[2] === '/')) {        // ||dominio^  → solo hace falta el dominio (lo más común con diferencia)
      if (!r.tm && !r.tn && !r.inc && !r.exc && r.third !== 0) { A.set(hm[1], (A.get(hm[1]) || 0) | (r.third === 1 ? 2 : 1)); this.n++; return; }
      r.all = true; (H.get(hm[1]) || H.set(hm[1], []).get(hm[1])).push(r); this.n++; return;
    }
    if (hm) { (H.get(hm[1]) || H.set(hm[1], []).get(hm[1])).push(r); this.n++; return; } // ||dominio/ruta…: se mira primero el dominio y luego la ruta
    const t = pickToken(pat);
    if (t) (T.get(t) || T.set(t, []).get(t)).push(r); else this[G].push(r);
    this.n++;
  }
  addCosm(line, base) {
    const m = /^([^#]*)(#@#|##)(.+)$/.exec(line); if (!m) return;
    const ex = m[2] === '#@#'; let sel = m[3].trim();
    if (!sel || sel.startsWith('+js(') || NO_COSM.test(sel) || /[{};]/.test(sel)) return;
    const doms = m[1] ? m[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
    const inc = doms.filter(d => d[0] !== '~'), exc = doms.filter(d => d[0] === '~').map(d => d.slice(1));
    this.nc++;
    if (ex) { for (const d of inc.length ? inc : ['*']) (this.cosmEx.get(d) || this.cosmEx.set(d, new Set()).get(d)).add(sel); return; }
    if (inc.length) { for (const d of inc) (this.cosm.get(d) || this.cosm.set(d, []).get(d)).push(exc.length ? { s: sel, exc } : sel); return; }
    // genérica (sin dominio). La lista incorporada son pocas: se aplican siempre. Las de las listas descargadas son miles: se indexan por su clase o id
    // y solo se aplican si esa clase/id está en la página (como hace uBlock); las que no se pueden indexar (atributos…) se descartan
    if (base) { this.genAny.push(sel); return; }
    const g = /^[a-z0-9]*([.#])([\w-]+)/i.exec(sel);
    if (g && !exc.length) { const M = g[1] === '.' ? this.genCls : this.genId, k = g[2]; (M.get(k) || M.set(k, []).get(k)).push(sel); }
  }
  // ── ¿se bloquea esta petición? ──
  blocked(url, rtype, pageUrl) {
    const type = RT[rtype] || 'other'; if (type === 'document') return false;     // nunca se bloquea la página que se abre
    const host = hostOf(url); if (!host) return false;
    const ph = hostOf(pageUrl);
    if (ph) for (let h = ph; h; ) { if (this.docEx.has(h)) return false; const i = h.indexOf('.'); h = i < 0 ? '' : h.slice(i + 1); }
    const ctx = { u: String(url).slice(0, 2000).toLowerCase(), host, ph, tb: TBIT[type] || 0, third: ph ? etld1(host) !== etld1(ph) : true };
    return this._hit(this.hostAll, this.hostMap, this.tok, this.gen, ctx) && !this._hit(this.exHostAll, this.exHostMap, this.exTok, this.exGen, ctx);
  }
  _hit(all, hm, tk, gen, c) {
    for (let h = c.host; h; ) {
      const f = all.get(h); if (f && ((f & 1) || ((f & 2) && c.third))) return true;
      const L = hm.get(h); if (L) for (const r of L) if (this._ok(r, c)) return true;
      const i = h.indexOf('.'); h = i < 0 ? '' : h.slice(i + 1);
    }
    if (tk.size) { const seen = new Set(), ws = c.u.match(/[a-z0-9%]+/g) || []; let k = 0;
      for (const w of ws) { if (w.length < 3 || seen.has(w)) continue; seen.add(w); if (++k > 90) break; const L = tk.get(w); if (L) for (const r of L) if (this._ok(r, c)) return true; } }
    for (const r of gen) if (this._ok(r, c)) return true;
    return false;
  }
  _ok(r, c) {
    if (r.tm && !(r.tm & c.tb)) return false;
    if (r.tn & c.tb) return false;
    if (r.third === 1 && !c.third) return false;
    if (r.third === 0 && c.third) return false;
    if (r.inc && !(c.ph && r.inc.some(d => inDom(c.ph, d)))) return false;
    if (r.exc && c.ph && r.exc.some(d => inDom(c.ph, d))) return false;
    if (r.all) return true;
    return (r.re || (r.re = toRegex(r.pat))).test(c.u);
  }
  // ── CSS para ocultar anuncios en una página ──
  _exc(host) { const s = new Set(); for (let h = host; h; ) { const e = this.cosmEx.get(h); if (e) e.forEach(x => s.add(x)); const i = h.indexOf('.'); h = i < 0 ? '' : h.slice(i + 1); } const g = this.cosmEx.get('*'); if (g) g.forEach(x => s.add(x)); return s; }
  cosmetic(host) { // selectores propios de ese sitio (+ las genéricas incorporadas): una regla CSS por selector, así uno malo no estropea el resto
    if (this._cc.has(host)) return this._cc.get(host);
    const ex = this._exc(host), out = new Set();
    for (let h = host; h; ) {
      const L = this.cosm.get(h); if (L) for (const x of L) { const s = typeof x === 'string' ? x : (x.exc.some(d => inDom(host, d)) ? '' : x.s); if (s && !ex.has(s)) out.add(s); }
      const i = h.indexOf('.'); h = i < 0 ? '' : h.slice(i + 1);
    }
    for (const s of this.genAny) if (!ex.has(s)) out.add(s);
    const css = [...out].map(s => s + '{display:none!important}').join('\n');
    if (this._cc.size > 300) this._cc.clear(); this._cc.set(host, css);
    return css;
  }
  generic(host, classes, ids) { // selectores genéricos que valen para las clases / ids que hay en la página
    const ex = this._exc(host), out = new Set();
    for (const c of classes) { const L = this.genCls.get(c); if (L) for (const s of L) if (!ex.has(s)) out.add(s); }
    for (const i of ids) { const L = this.genId.get(i); if (L) for (const s of L) if (!ex.has(s)) out.add(s); }
    return [...out].map(s => s + '{display:none!important}').join('\n');
  }
}

// ───────── gestor: listas (incorporada + descargadas), actualización y estadísticas ─────────
// Cada lista tiene un grupo: «ads» (anuncios y rastreadores) o «cookies» (avisos de cookies); cada grupo es un Engine y se activa o no desde el launcher.
const LISTS = [
  { id: 'easylist', g: 'ads', url: 'https://easylist.to/easylist/easylist.txt' },
  { id: 'easyprivacy', g: 'ads', url: 'https://easylist.to/easylist/easyprivacy.txt' },
  { id: 'ubo-filters', g: 'ads', url: 'https://ublockorigin.github.io/uAssets/filters/filters.txt' },
  { id: 'ubo-unbreak', g: 'ads', url: 'https://ublockorigin.github.io/uAssets/filters/unbreak.txt' },
  { id: 'peter-lowe', g: 'ads', url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext' },
  { id: 'easylist-cookie', g: 'cookies', url: 'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt' },
  { id: 'ubo-cookies', g: 'cookies', url: 'https://ublockorigin.github.io/uAssets/filters/annoyances-cookies.txt' }
];
const DAY = 864e5, MAX_AGE = 5 * DAY, MAX_BYTES = 30e6;

function create({ dir, baseDir, fetch, log = () => {} }) {
  let E = { ads: new Engine(), cookies: new Engine() }, meta = {}, loading = null, count = 0;
  const metaF = path.join(dir, 'listas.json');
  try { meta = JSON.parse(fs.readFileSync(metaF, 'utf8')) || {}; } catch {}
  const yieldNow = () => new Promise(r => setImmediate(r));
  async function feed(eng, text, base) { // se lee por trozos para no congelar el launcher con listas de 100 000 líneas
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) { try { eng.add(lines[i], base); } catch {} if (i % 4000 === 3999) await yieldNow(); }
  }
  async function load() { // incorporadas (assets/bloqueo/*.txt) + las descargadas que haya en caché
    const n = { ads: new Engine(), cookies: new Engine() }, t0 = Date.now();
    for (const [g, f] of [['ads', 'base.txt'], ['cookies', 'cookies.txt']]) try { await feed(n[g], fs.readFileSync(path.join(baseDir, f), 'utf8'), true); } catch (e) { log('bloqueo: lista incorporada', f, e.message); }
    for (const l of LISTS) try { const p = path.join(dir, l.id + '.txt'); if (fs.existsSync(p)) await feed(n[l.g], fs.readFileSync(p, 'utf8'), false); } catch (e) { log('bloqueo: lista', l.id, e.message); }
    E = n; log('bloqueo: listas cargadas', n.ads.n + n.cookies.n, 'reglas de red,', n.ads.nc + n.cookies.nc, 'visuales,', (Date.now() - t0) + ' ms');
  }
  async function download(l) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 50000);
    let tt; const tope = new Promise((_, no) => { tt = setTimeout(() => no(new Error('tiempo agotado')), 60000); }); // por si fetch no respetara la cancelación
    try {
      const t = await Promise.race([(async () => { const r = await fetch(l.url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })(), tope]);
      if (t.length > MAX_BYTES || t.length < 200 || !/[|#!]/.test(t.slice(0, 4000))) throw new Error('lista rara (' + t.length + ' bytes)');
      fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, l.id + '.txt.tmp'), t); fs.renameSync(path.join(dir, l.id + '.txt.tmp'), path.join(dir, l.id + '.txt'));
      meta[l.id] = Date.now(); return true;
    } catch (e) { log('bloqueo: no se pudo bajar', l.id, e.message); return false; } finally { clearTimeout(to); clearTimeout(tt); }
  }
  async function update(force) { // baja las listas que falten o tengan más de 5 días; sin internet no pasa nada (se sigue con lo que hay)
    if (!fetch) return { ok: 0, fail: 0 };
    let ok = 0, fail = 0;
    for (const l of LISTS) if (force || !meta[l.id] || Date.now() - meta[l.id] > MAX_AGE) { (await download(l)) ? ok++ : fail++; }
    if (ok) { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(metaF, JSON.stringify(meta)); } catch {} await load(); }
    return { ok, fail };
  }
  const start = () => loading || (loading = load().catch(e => log('bloqueo:', e.message)));
  return {
    start, update, count: () => count, hit: () => ++count,
    blocked: (g, url, type, page) => E[g].blocked(url, type, page),
    cosmetic: (g, host) => E[g].cosmetic(host), generic: (g, host, cl, ids) => E[g].generic(host, cl, ids),
    stats: () => { const t = Object.values(meta).filter(Boolean); return { rules: E.ads.n + E.cookies.n, cosm: E.ads.nc + E.cookies.nc, updated: t.length ? Math.max(...t) : 0, lists: Object.keys(meta).length }; }
  };
}
module.exports = { create, Engine, toRegex, pickToken, hostOf, etld1, LISTS };
