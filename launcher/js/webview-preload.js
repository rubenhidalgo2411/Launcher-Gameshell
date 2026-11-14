// GameShell · script que se carga en CADA página del navegador del launcher (<webview>, partición persist:web); main.js lo pone con will-attach-webview.
// Solo habla con el launcher por IPC y no le expone nada a la página (la página no puede llamarlo). Hace cuatro cosas, cada una con su interruptor
// en Opciones › Navegador:
//   1) teclado en pantalla: al tocar un campo de texto avisa al launcher, que abre SU teclado (el mismo de las contraseñas), y luego rellena el campo con lo escrito
//   2) oculta anuncios y avisos de cookies (CSS que le da main.js con lo que dicen las listas de bloqueo)
//   3) YouTube sin anuncios: salta o acelera los anuncios del vídeo y cierra los banners
//   4) SponsorBlock: salta las partes patrocinadas de los vídeos de YouTube (datos de sponsor.ajay.app, pedidos desde main.js)
// Todo va en try/catch: si algo fallara, la página sigue funcionando igual que sin esto.
'use strict';
const { ipcRenderer, webFrame } = require('electron');
const toHost = (c, ...a) => { try { ipcRenderer.sendToHost(c, ...a); } catch {} };
let C = {};
try { C = ipcRenderer.sendSync('web:cfg', location.href) || {}; } catch {}
const host = (location.hostname || '').toLowerCase();
const isYT = /(^|\.)youtube\.com$/.test(host);
const pend = []; // plan B: si insertCSS no pudiera (p. ej. antes de que exista el documento), se pone un <style> en cuanto haya página
const flush = () => { try { while (pend.length) { const s = document.createElement('style'); s.textContent = pend.shift(); (document.head || document.documentElement).appendChild(s); } } catch {} };
const css = t => { if (!t) return; try { webFrame.insertCSS(t); } catch { pend.push(t); if (document.documentElement) flush(); else document.addEventListener('DOMContentLoaded', flush, { once: true }); } };

// ───────── 2) anuncios y cookies: CSS ─────────
css(C.css);
if (C.gen && /^https?:$/.test(location.protocol)) { // reglas genéricas de las listas: solo las de clases/ids que de verdad hay en la página (como uBlock), en tandas
  const seenC = new Set(), seenI = new Set(); let timer = 0, runs = 0;
  const scan = () => {
    timer = 0; if (++runs > 40) return;
    const nc = [], ni = [];
    try {
      for (const el of document.querySelectorAll('[class],[id]')) {
        if (el.id && typeof el.id === 'string' && !seenI.has(el.id)) { seenI.add(el.id); ni.push(el.id); }
        const cl = el.classList; for (let i = 0; cl && i < cl.length; i++) { const c = cl[i]; if (!seenC.has(c)) { seenC.add(c); nc.push(c); } }
      }
    } catch {}
    if (nc.length || ni.length) ipcRenderer.invoke('web:generic', host, nc.slice(0, 5000), ni.slice(0, 5000)).then(css).catch(() => {});
  };
  const later = () => { if (!timer) timer = setTimeout(scan, 1500); };
  document.addEventListener('DOMContentLoaded', () => { scan(); try { new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true }); } catch {} });
}
// los avisos de cookies suelen bloquear el scroll de la página; si había uno oculto, se desbloquea
if (C.cookies) document.addEventListener('DOMContentLoaded', () => {
  let n = 0; const iv = setInterval(() => {
    if (++n > 12) return clearInterval(iv);
    try {
      const hidden = [...document.querySelectorAll('#onetrust-banner-sdk,#CybotCookiebotDialog,#didomi-host,#qc-cmp2-container,.fc-consent-root,#usercentrics-root,.cc-window,#cookie-law-info-bar,#cookiebanner,.cookie-banner,.cookie-consent')].some(e => getComputedStyle(e).display === 'none');
      if (hidden) css('html,body{overflow:auto!important;position:static!important}');
    } catch {}
  }, 800);
});

// ───────── 1) teclado en pantalla ─────────
if (C.osk) try {
  const TXT = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', '']);
  const editable = el => {
    if (!el || el.nodeType !== 1) return null;
    if (el.tagName === 'INPUT') return !el.readOnly && !el.disabled && TXT.has((el.type || 'text').toLowerCase()) ? el : null;
    if (el.tagName === 'TEXTAREA') return !el.readOnly && !el.disabled ? el : null;
    if (el.isContentEditable) { let r = el; while (r.parentElement && r.parentElement.isContentEditable) r = r.parentElement; return r; }
    return null;
  };
  const isField = el => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  const label = el => {
    let l = el.getAttribute('aria-label') || el.placeholder || (el.labels && el.labels[0] && el.labels[0].innerText) || el.title || el.name || '';
    l = String(l).replace(/\s+/g, ' ').trim().slice(0, 50);
    return l || (el.type === 'password' ? 'Contraseña' : 'Escribe');
  };
  // ¿es un buscador / contraseña? Entonces al aceptar se envía (como el «Ir» de un teclado de móvil); en un campo cualquiera (usuario, correo…) solo se rellena
  const kind = el => {
    if (el.tagName !== 'INPUT') return '';
    const t = (el.type || 'text').toLowerCase(), h = (el.getAttribute('enterkeyhint') || '').toLowerCase();
    if (t === 'password') return 'pw';
    if (t === 'search' || h === 'search' || h === 'go' || h === 'send' || el.getAttribute('role') === 'searchbox' || (el.closest && el.closest('form[role=search],[role=search]'))) return 'go';
    return /\b(search|buscar|busca|query|find|q)\b/i.test(el.name + ' ' + el.id + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.placeholder || '')) ? 'go' : '';
  };
  const fill = (el, v) => {
    try { el.focus({ preventScroll: true }); } catch {}
    if (isField(el)) {
      // por el «setter» original, no por el de la página: así React / Vue / Angular se enteran del cambio
      const proto = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      try { el.setSelectionRange(v.length, v.length); } catch {}
    } else { // contenteditable (editores de texto de las webs)
      const s = getSelection(), r = document.createRange(); r.selectNodeContents(el); s.removeAllRanges(); s.addRange(r);
      if (!document.execCommand('insertText', false, v)) { el.textContent = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
    }
  };
  const enter = el => { // como pulsar Intro: si el campo es de un formulario se envía; si no, se simula la tecla
    const f = el.form;
    if (f && typeof f.requestSubmit === 'function') { try { f.requestSubmit(); return; } catch {} }
    for (const t of ['keydown', 'keypress', 'keyup']) el.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  };
  let busy = 0, cur = null, seq = 0, lastPtr = -1e9, quietEl = null, quietUntil = 0, mode = '';
  const open = el => {
    if (busy && performance.now() - busy < 120000) return;
    busy = performance.now(); cur = el; mode = kind(el);
    const mx = isField(el) && el.maxLength > 0 && el.maxLength < 100000 ? el.maxLength : 0;
    toHost('gs-osk', { id: ++seq, title: label(el), pw: mode === 'pw', go: mode, value: isField(el) ? el.value : String(el.innerText || '').replace(/\n$/, ''), max: mx });
  };
  ipcRenderer.on('gs-osk-set', (_, d) => { // lo escrito (o null si se canceló) vuelve del launcher
    busy = 0; const el = cur; cur = null;
    if (!el || !el.isConnected) return;
    quietEl = el; quietUntil = performance.now() + 1500;      // al devolverle el foco a la página, ese mismo campo no debe volver a abrir el teclado
    try {
      if (d && typeof d.v === 'string') { fill(el, d.v); if (mode && d.ok !== false) enter(el); }
      else el.focus({ preventScroll: true });
    } catch {}
  });
  const quiet = el => el === quietEl && performance.now() < quietUntil;
  // el teclado sale por un clic / toque (también si la página enfoca el campo justo después, p. ej. al tocar una lupa); con Tab o con un autofocus de la página no
  addEventListener('pointerdown', e => { lastPtr = performance.now(); const el = editable(e.target); if (el && el === document.activeElement && !quiet(el)) setTimeout(() => open(el), 0); }, true);
  document.addEventListener('focusin', e => { const el = editable(e.target); if (el && performance.now() - lastPtr < 1200 && !quiet(el)) open(el); }, true);
} catch {}

// ───────── 3) YouTube sin anuncios ─────────
if (isYT && C.yt) try {
  let was = null;
  setInterval(() => {
    const pl = document.querySelector('#movie_player, .html5-video-player'), v = document.querySelector('video.html5-main-video') || document.querySelector('#movie_player video');
    if (!pl || !v) return;
    if (pl.classList.contains('ad-showing') || pl.classList.contains('ad-interrupting')) {
      if (!was) was = { muted: v.muted, rate: v.playbackRate };
      v.muted = true;
      const b = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button'); if (b) b.click();
      if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.3) { v.playbackRate = 16; try { v.currentTime = v.duration - 0.1; } catch {} } // el anuncio se «lee» entero en un instante
    } else if (was) { v.muted = was.muted; v.playbackRate = was.rate; was = null; }
    const x = document.querySelector('.ytp-ad-overlay-close-button'); if (x) x.click();
  }, 250);
} catch {}

// ───────── 4) SponsorBlock ─────────
if (isYT && C.sb) try {
  let vid = '', segs = [], note = null, noteT = 0;
  const idNow = () => { try { const u = new URL(location.href); if (u.pathname === '/watch') return u.searchParams.get('v') || ''; const m = /^\/(?:shorts|live|embed)\/([\w-]{11})/.exec(u.pathname); return m ? m[1] : ''; } catch { return ''; } };
  const aviso = t => { // cartelito en la propia página (se ve también a pantalla completa)
    try {
      if (!note) { note = document.createElement('div'); note.style.cssText = 'position:fixed;top:18px;right:18px;z-index:2147483647;padding:10px 16px;border-radius:12px;background:rgba(10,14,28,.88);color:#fff;font:600 15px system-ui,sans-serif;box-shadow:0 4px 18px #0008;pointer-events:none;transition:opacity .3s'; (document.fullscreenElement || document.documentElement).appendChild(note); }
      else if (note.parentNode !== (document.fullscreenElement || document.documentElement)) (document.fullscreenElement || document.documentElement).appendChild(note);
      note.textContent = t; note.style.opacity = '1'; clearTimeout(noteT); noteT = setTimeout(() => { if (note) note.style.opacity = '0'; }, 3200);
    } catch {}
  };
  const NOM = { sponsor: 'patrocinador', selfpromo: 'autopromoción', interaction: 'petición de suscripción' };
  const load = async id => { vid = id; segs = []; if (!id) return; try { const r = await ipcRenderer.invoke('web:sb', id); if (vid === id && Array.isArray(r)) segs = r; } catch {} };
  setInterval(() => {
    const id = idNow(); if (id !== vid) load(id);
    if (!segs.length) return;
    const v = document.querySelector('video.html5-main-video') || document.querySelector('video'); if (!v || !isFinite(v.duration)) return;
    const t = v.currentTime;
    for (const s of segs) {
      if (s[2] && Math.abs(s[2] - v.duration) > 3) continue;           // el vídeo cambió desde que se anotó el segmento: no se fía
      if (t >= s[0] && t < s[1] - 0.2) { v.currentTime = Math.min(s[1], v.duration - 0.05); aviso('SponsorBlock · saltado ' + Math.round(s[1] - t) + ' s de ' + (NOM[s[3]] || 'patrocinio')); break; }
    }
  }, 150);
} catch {}
