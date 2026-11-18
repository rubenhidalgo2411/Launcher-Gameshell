// GameShell · actualizar.js (pantalla)
// Opciones → «Buscar actualizaciones» y la pantalla «Confirmar que deseo esta actualización», que sale cuando se abre una versión recién instalada.
// Lo de GitHub y el cambio de carpetas está en actualizar.js (proceso principal) y en boot/; esto es solo lo que se ve. Va ANTES de app.js en index.html.
// La pantalla de confirmación es independiente del estilo, de la intro y de los menús: va por encima de todo y se maneja con teclado, ratón o mando.
// Si la versión nueva está rota y esta pantalla no llega a salir (o nadie la confirma), el arranque seguro (boot/arranque.js) vuelve solo a la anterior.
const GSUpd = (() => {
  let C = {};                                            // lo que da app.js: toast, openMenu, closeMenu, opts, items, sel, Sound
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
  const gsx = () => window.gsx || null;
  const corto = c => String(c || '').slice(0, 7);
  const dia = f => { const d = new Date(f); return f && !isNaN(d) ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  const ver = v => v && v.commit ? corto(v.commit) + (dia(v.fecha) ? ' · ' + dia(v.fecha) : '') : 'no se sabe cuál';
  const recorta = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const MOTIVO = { plazo: 'no se confirmó a tiempo', 'sin-pantalla': 'la pantalla de confirmación no llegó a salir', cerro: 'el launcher se cerró antes de confirmarla',
    revertir: 'pediste volver a la anterior', reinicio: 'el PC se reinició sin confirmarla', 'no-arranca': 'no llegó a arrancar' };
  const ultimoTxt = u => u.resultado === 'confirmada' ? 'confirmada' : u.resultado === 'deshecha' ? 'se deshizo: ' + (MOTIVO[u.motivo] || u.motivo || '') : 'no se pudo: ' + recorta(u.motivo, 60);

  // ───────────────────────── Opciones → Buscar actualizaciones ─────────────────────────
  let last = null, busy = false, hooked = false;          // last: lo último que dijo GitHub en esta sesión
  async function menu(at = 'check') {
    const g = gsx(); if (!g || !g.updState) return C.toast('Las actualizaciones no están disponibles (falta preload-gs.js)');
    let st = {}; try { st = await g.updState(); } catch {}
    const back = () => C.system('upd');
    if (!st.supervised) {
      const why = st.dev ? 'En modo desarrollo (npm start) no se actualiza' : !st.hay ? 'Falta la carpeta boot: copia también esa carpeta' : 'Hay que abrir el launcher con el arranque seguro: ejecuta otra vez instalar-shell.bat y reinicia la sesión';
      return C.openMenu('Actualizaciones', [['Buscar actualizaciones<small>no disponible</small>', () => { C.Sound.ui('err'); C.toast('No disponible ahora mismo'); menu('check'); }, '', null, 'check'], ['Volver', back, '', null, 'back']], at, { back, help: esc(why) });
    }
    const hay = !!(last && last.ok && last.hay), u = st.ultimo;
    const L = [[`Buscar actualizaciones<small>${last ? (last.ok ? (last.hay ? 'hay una versión nueva' : 'estás al día') : 'no se pudo comprobar') : 'mira si hay una versión nueva'}</small>`, check, '', null, 'check']];
    if (hay) L.push([`Instalar y reiniciar<small>${esc(ver(last.remoto))}</small>`, install, '', null, 'install']);
    L.push([`Versión instalada<small>${esc(ver(st.actual))}</small>`, () => { C.Sound.ui('ok'); menu('ver'); }, '', null, 'ver']);
    if (u) L.push([`Última actualización<small>${esc(corto(u.commit))} · ${esc(ultimoTxt(u))}</small>`, () => { C.Sound.ui('ok'); menu('ult'); }, '', null, 'ult']);
    L.push(['Volver', back, '', null, 'back']);
    const help = hay ? (last.remoto.mensaje ? '«' + esc(recorta(last.remoto.mensaje, 70)) + '»' : 'Versión nueva en «' + esc(last.rama || st.rama) + '»') + (last.yaFallo ? ' · esa versión ya se probó y se deshizo' : '') + (!last.local ? ' · no sé qué versión tienes' : '')
      : last && !last.ok ? esc(recorta(last.msg, 90)) : 'Solo se actualiza la carpeta launcher · sigue la rama «' + esc(st.rama) + '» de ' + esc(st.repo);
    C.openMenu('Actualizaciones', L, at, { back, help });
  }
  async function check() {
    const g = gsx(); C.toast('Consultando GitHub…');
    const r = await g.updCheck().catch(e => ({ ok: false, msg: String(e && e.message || e) }));
    last = r;
    if (!r.ok) { C.Sound.ui('err'); C.toast(r.msg || 'No se pudo comprobar'); return menu('check'); }
    C.Sound.ui('ok'); C.toast(r.hay ? 'Hay una versión nueva' : 'Ya tienes la última versión');
    menu(r.hay ? 'install' : 'check');
  }
  async function install() {   // descarga → comprueba → el launcher se cierra y el arranque seguro pone la nueva y la abre; ahí sale la pantalla de confirmación
    const g = gsx(), ld = $('#ld'), box = ld && ld.firstElementChild, orig = box ? box.innerHTML : '';
    const say = t => { if (box) box.innerHTML = '<i></i>' + esc(t); };
    if (g.onUpdProgress && !hooked) { hooked = true; g.onUpdProgress(d => { if (busy) say((d.msg || 'Descargando…') + (d.pct < 100 ? ' ' + d.pct + ' %' : '')); }); }
    busy = true; say('Descargando…'); ld.classList.add('on');
    const r = await g.updInstall().catch(e => ({ ok: false, msg: String(e && e.message || e) }));
    if (r.ok) return say('Iniciando la actualización…');   // en un momento el launcher se cierra solo
    busy = false; ld.classList.remove('on'); if (box) box.innerHTML = orig;   // se deja el cartel de carga como estaba (app.js lo usa al abrir un juego)
    C.Sound.ui('err'); C.toast(r.msg || 'No se pudo instalar'); menu('check');
  }

  // ───────────────────────── «Confirmar que deseo esta actualización» ─────────────────────────
  // Sale encima de todo en cuanto la lista del launcher ha cargado bien. Cuenta atrás de 30 s: si no se confirma, el arranque seguro vuelve a la versión anterior.
  let open = false, fin = false, ocupado = false, foco = 'ok', ov = null, iv = 0, t0 = 0, secs = 30;
  const pon = k => { if (foco === k) return; foco = k; C.Sound.ui('move'); ov.querySelectorAll('.ubt').forEach(b => b.classList.toggle('s', b.dataset.a === k)); };
  const estado = t => { const e = $('#upe'); if (e) { e.textContent = t; e.hidden = !t; } };
  function cuenta() {
    const left = Math.max(0, secs - (performance.now() - t0) / 1000);
    $('#upn').textContent = Math.ceil(left); $('#upi').style.transform = 'scaleX(' + (left / secs) + ')';
    ov.classList.toggle('warn', left <= 10 && left > 5); ov.classList.toggle('late', left <= 5);
    if (left <= 0 && !fin) { fin = true; clearInterval(iv); ov.classList.add('done'); estado('Se acabó el tiempo: volviendo a la versión anterior…'); }
  }
  function cerrar() { open = false; clearInterval(iv); removeEventListener('keydown', tecla, true); if (ov) { ov.classList.add('out'); const o = ov; setTimeout(() => o.remove(), 300); } ov = null; }
  async function hacer(a) {
    if (!open || fin || ocupado) return;
    const g = gsx(); ocupado = true;
    if (a === 'ok') {
      estado('Confirmando…');
      let r = await g.updConfirm().catch(() => ({ ok: false }));
      if (!r.ok) { const st = await g.updState().catch(() => null); r = { ok: !!st && !st.pendiente }; }   // puede que el arranque seguro sí lo recibiera
      if (r.ok) { cerrar(); C.Sound.ui('ok'); C.toast('Actualización confirmada'); }
      else { ocupado = false; estado(''); C.Sound.ui('err'); C.toast('No se pudo confirmar: inténtalo otra vez'); }
    } else {
      clearInterval(iv); ov.classList.add('done'); estado('Volviendo a la versión anterior…');
      const r = await g.updRevert().catch(() => ({ ok: false }));
      if (!r.ok) { ocupado = false; ov.classList.remove('done'); iv = setInterval(cuenta, 200); estado(''); C.Sound.ui('err'); C.toast('No se pudo volver a la anterior'); }
    }
  }
  // teclado: todo lo que se pulse se queda aquí (que no salte la intro ni se mueva nada de debajo). Intro / Espacio eligen; flechas y Tab cambian de botón
  function tecla(e) {
    if (!open) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat || fin || ocupado) return;
    if (e.key === 'Enter' || e.key === ' ') hacer(foco);
    else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) pon(foco === 'ok' ? 'no' : 'ok');
  }
  // mando: app.js le pasa aquí los botones mientras la pantalla está abierta (✕ elige, la cruceta cambia de botón)
  function act(a) {
    if (!open || fin || ocupado) return;
    if (a === 'u' || a === 'd' || a === 'l' || a === 'r') pon(foco === 'ok' ? 'no' : 'ok');
    else if (a === 'ok') hacer(foco);
  }
  function mostrar(st) {
    const p = st.pendiente, h = p.hasta || {}, d = p.desde;
    secs = p.segundos || 30; open = true; fin = false; ocupado = false; foco = 'ok';
    ov = document.createElement('div'); ov.id = 'upd';
    ov.innerHTML = `<div class="uc" role="alertdialog" aria-modal="true" aria-labelledby="upt">
      <h2 id="upt">Actualización instalada</h2>
      <div class="uv"><b>${esc(ver(h))}</b>${h.mensaje ? '<span>«' + esc(recorta(h.mensaje, 80)) + '»</span>' : ''}</div>
      <div class="un"><b id="upn">${secs}</b><span>segundos para confirmarla</span></div>
      <div class="ub"><i id="upi"></i></div>
      <p class="uh">Si todo se ve bien, confírmala. Si no la confirmas a tiempo, el launcher vuelve solo a la versión anterior${d && d.commit ? ' (' + esc(corto(d.commit)) + ')' : ''}.</p>
      <p class="ue" id="upe" hidden></p>
      <button class="ubt s" data-a="ok">Confirmar que deseo esta actualización</button>
      <button class="ubt" data-a="no">Volver a la anterior ahora</button></div>`;
    document.body.appendChild(ov);
    ov.onclick = e => { const b = e.target.closest('.ubt'); if (b) hacer(b.dataset.a); };
    ov.onmousemove = e => { const b = e.target.closest('.ubt'); if (b && !ocupado && !fin) pon(b.dataset.a); };
    addEventListener('keydown', tecla, true);
    t0 = performance.now(); iv = setInterval(cuenta, 200); cuenta();
    gsx().updShown().catch(() => {});                      // ya se ve: ahora el arranque seguro cuenta los 30 s
    try { C.Sound.ui('open'); } catch {}
  }
  function aviso(texto) {   // cartel arriba (sin pedir nada) para contar cómo terminó la última actualización
    let b = $('#updaviso'); if (!b) { b = document.createElement('div'); b.id = 'updaviso'; document.body.appendChild(b); b.onclick = () => b.classList.remove('on'); }
    b.textContent = texto; b.classList.add('on'); clearTimeout(aviso.t); aviso.t = setTimeout(() => b.classList.remove('on'), 15000);
  }
  let hecho = false;
  async function ready() {   // app.js: la lista ya cargó bien. Si esto es una prueba, sale la pantalla de confirmación; si la última vez se deshizo algo, se avisa
    if (hecho) return; hecho = true;
    const g = gsx(); if (!g || !g.updState) return;
    let st; try { st = await g.updState(); } catch { return; }
    if (!st) return;
    if (st.pendiente) return mostrar(st);
    const u = st.ultimo;
    if (u && !u.visto && (u.resultado === 'deshecha' || u.resultado === 'fallo')) {
      aviso(u.resultado === 'deshecha' ? `La actualización ${corto(u.commit)} se ha deshecho (${MOTIVO[u.motivo] || u.motivo}). Sigues con la versión anterior.` : `No se pudo poner la actualización ${corto(u.commit)}: ${recorta(u.motivo, 120)}`);
      g.updSeen().catch(() => {});
    }
  }

  return { init(ctx) { C = ctx; }, get open() { return open; }, act, menu, ready };
})();
