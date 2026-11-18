'use strict';
// GameShell · aspectos.js — Carrusel de aspectos (Apariencia → Carrusel de aspectos)
//
// Un «aspecto» guarda TODO lo que define cómo se ve y suena el launcher: estilo, fondo, barras, tipo de letra, tamaño de iconos, ampliación,
// color y altura de Brasas/Cosmos, textos de arriba, intro (con su foto, su texto y su sonido), sonido de los menús y la foto de la Precarga.
// NO entran los volúmenes ni los interruptores de sonido (son preferencias tuyas, no del aspecto) ni nada del navegador, el FPS o la resolución.
//
// El carrusel es la lista de aspectos guardados. Cambia:
//   · solo, al iniciar el launcher (así la intro, su sonido y la Precarga ya son los del aspecto nuevo) y/o cada cierto tiempo (solo si no estás usando nada),
//   · a mano con Ctrl+← / Ctrl+→ en el teclado, o L2 / R2 en el mando.
// Lo que no guardes en un aspecto se pierde al pasar a otro (la primera vez que lo intentas a mano, avisa).
// Los ajustes viven en ui.json → carousel (main.js los valida: cleanCarousel/cleanLook). Va ANTES de app.js en index.html.
const Look = (() => {
  let C = {};                                                   // lo que da app.js (ui, setUI, valid, sum, idle, menús…)
  const esc = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
  const KEYS = ['theme', 'bg', 'bar', 'top', 'font', 'play', 'tile', 'dock', 'emberY', 'emberHue', 'emberSat', 'cosmosY', 'tabText', 'webText',
    'menuSnd', 'intro', 'introBg', 'introText', 'introSndSrc', 'pswBg'];
  const MINS = [0, 5, 15, 30, 60, 180, 1440];                   // «Cambiar cada…» (minutos; 0 = nunca solo)
  const minTxt = m => !m ? 'Nunca' : m < 60 ? m + ' min' : m === 60 ? '1 hora' : m < 1440 ? m / 60 + ' horas' : 'Cada día';
  const started = Date.now();
  let warnAt = 0;                                               // última vez que se avisó de «cambios sin guardar»

  const car = () => C.ui().carousel || { boot: true, mins: 0, random: false, idx: -1, at: 0, items: [] };
  const snap = () => { const u = C.ui(), o = {}; for (const k of KEYS) if (u[k] !== undefined) o[k] = u[k]; return o; };
  const sig = l => JSON.stringify(KEYS.map(k => (l && l[k] !== undefined ? l[k] : null)));
  const norm = l => sig(C.valid({ ...snap(), ...l }));          // se compara lo que de verdad se aplicaría (si el aspecto nombra algo eliminado, ya se sustituyó)
  const curIdx = () => {                                        // posición del aspecto guardado que es igual al de ahora (−1: el de ahora no está guardado)
    const c = car(), s = sig(snap());
    if (c.items[c.idx] && norm(c.items[c.idx].look) === s) return c.idx;
    return c.items.findIndex(it => norm(it.look) === s);
  };
  const setC = patch => C.setUI({ carousel: { ...car(), ...patch } });
  const newId = () => Math.random().toString(36).slice(2, 10);

  function label() {                                            // lo que sale en la fila de Apariencia
    const c = car(), n = c.items.length;
    if (!n) return 'vacío';
    if (n === 1) return '1 guardado';
    const w = [c.boot ? 'al iniciar' : '', c.mins ? 'cada ' + minTxt(c.mins).toLowerCase() : ''].filter(Boolean).join(' y ');
    return `${n} guardados · ${w || 'solo a mano'}`;
  }

  // ── fundido corto al cambiar en directo (así no se ve el «salto» de estilo, fondo y letra) ──
  let fadeEl = null;
  const ov = () => { if (!fadeEl) { fadeEl = document.createElement('div'); fadeEl.id = 'lkfade'; document.body.appendChild(fadeEl); } return fadeEl; };
  const fade = async (to, ms) => {                              // (con tope de tiempo: si la ventana no pinta, el fundido no puede dejar el cambio a medias)
    try { const a = ov().animate([{ opacity: to ? 0 : 1 }, { opacity: to ? 1 : 0 }], { duration: ms, fill: 'forwards' }); await Promise.race([a.finished, new Promise(r => setTimeout(r, ms + 250))]); } catch {}
  };

  // ── aplicar ──
  async function apply(i, o = {}) {                             // o.fade: con fundido (cambios en directo) · o.quiet: sin aviso
    const c = car(), it = c.items[i]; if (!it) return false;
    const look = C.valid({ ...snap(), ...it.look });             // lo que ya no exista o esté eliminado se sustituye por lo normal
    if (o.fade) await fade(1, 200);
    await C.setUI({ ...look, carousel: { ...c, idx: i, at: Date.now() } });
    if (o.fade) fade(0, 480);
    if (!o.quiet) C.toast(`Aspecto ${i + 1}/${c.items.length} · ${it.name}`);
    return true;
  }
  // un cambio a la vez: si pulsas Ctrl+→ dos veces seguidas, avanza dos (se queda con el último destino y el fundido se hace una sola vez)
  let busy = false, queued = -1, tgt = -1;                      // tgt: el aspecto al que se va ahora mismo
  async function go(i) {
    tgt = i;
    if (busy) { queued = i; return true; }
    busy = true;
    try { let k = i; do { queued = -1; await apply(k, { fade: true }); k = queued; } while (k >= 0); }
    finally { busy = false; tgt = -1; }
    return true;
  }
  function nextIdx() {
    const c = car(), n = c.items.length, ci = curIdx(), cur = tgt >= 0 ? tgt : ci >= 0 ? ci : c.idx;
    if (c.random && n > 2) { let j; do { j = Math.floor(Math.random() * n); } while (j === cur); return j; }
    return ((cur >= 0 ? cur : -1) + 1) % n;
  }
  // a mano (Ctrl+←/→, L2/R2) o desde el menú
  async function step(d, manual) {
    const c = car(), n = c.items.length;
    if (n < 2) { if (manual) C.toast(n ? 'Solo hay un aspecto: guarda otro en Apariencia → Carrusel de aspectos' : 'No hay aspectos: Apariencia → Carrusel de aspectos'); return false; }
    if (manual && tgt < 0 && curIdx() < 0 && Date.now() - warnAt > 6000) {  // lo de ahora no está guardado: se avisa una vez antes de perderlo
      warnAt = Date.now(); C.toast('Este aspecto no está guardado y se perdería · vuelve a pulsar para cambiar'); C.Sound.ui('err'); return false;
    }
    warnAt = 0;
    const ci = curIdx(), base = tgt >= 0 ? tgt : ci >= 0 ? ci : c.idx >= 0 ? c.idx : (d > 0 ? -1 : 0), i = (((base + d) % n) + n) % n;
    C.Sound.ui('open');
    return go(i);
  }
  // al arrancar: se pasa al siguiente ANTES de la intro (no se repite si el launcher se recarga a los pocos segundos)
  async function boot() {
    const c = car(); if (!c.boot || c.items.length < 2 || Date.now() - (c.at || 0) < 20000) return;
    const i = nextIdx(), it = c.items[i], look = C.valid({ ...snap(), ...it.look });
    C.merge(await C.api.uiSet({ ...look, carousel: { ...c, idx: i, at: Date.now() } }));   // sin applyUI: el arranque lo hace justo después
  }
  // cada cierto tiempo, y solo si el launcher está a la vista y sin nada abierto
  function start() {
    setInterval(() => {
      const c = car(); if (!c.mins || c.items.length < 2) return;
      if (busy || Date.now() - Math.max(c.at || 0, started) < c.mins * 60000 || !C.idle()) return;
      go(nextIdx());
    }, 15000);
  }

  // ── menú ──
  async function add(pj) {
    const c = car(), ci = curIdx();
    if (ci >= 0) { C.toast(`Ya está guardado como «${c.items[ci].name}»`); return menu('add', pj); }
    if (c.items.length >= 24) { C.toast('Ya hay 24 aspectos: quita alguno para añadir más'); return menu('add', pj); }
    const v = await C.ask('Nombre del aspecto', { value: 'Aspecto ' + (c.items.length + 1), max: 40, ok: 'Guardar' });
    if (v === null) return menu('add', pj);
    const items = [...c.items, { id: newId(), name: v.trim() || 'Aspecto ' + (c.items.length + 1), look: snap() }];
    await setC({ items, idx: items.length - 1, at: Date.now() });
    C.toast(`Añadido al carrusel · ${items.length} ${items.length === 1 ? 'aspecto' : 'aspectos'}`); C.Sound.ui('ok');
    menu('i' + (items.length - 1), pj);
  }
  async function update(i, pj) {                                // el aspecto guardado pasa a ser el de ahora
    const c = car(); if (!c.items[i]) return menu(0, pj);
    const items = c.items.map((it, j) => j === i ? { ...it, look: snap() } : it);
    await setC({ items, idx: i, at: Date.now() });
    C.toast(`«${c.items[i].name}» actualizado`); C.Sound.ui('ok'); menu('i' + i, pj);
  }
  async function move(i, d, pj) {
    const c = car(), j = i + d; if (!c.items[i] || !c.items[j]) return;
    const items = [...c.items]; [items[i], items[j]] = [items[j], items[i]];
    const idx = c.idx === i ? j : c.idx === j ? i : c.idx;
    await setC({ items, idx }); one(j, pj);
  }
  function askRemove(i, pj) {
    const c = car(), it = c.items[i]; if (!it) return menu(0, pj);
    C.openMenu(`¿Quitar «${it.name}» del carrusel?`, [
      ['Quitar del carrusel', async () => {
        const items = c.items.filter((_, j) => j !== i), idx = i < c.idx ? c.idx - 1 : i === c.idx ? -1 : c.idx;
        await setC({ items, idx }); C.toast('Aspecto quitado del carrusel'); menu(0, pj);
      }],
      ['Cancelar', () => one(i, pj)]
    ], 1, { back: () => one(i, pj), help: 'El aspecto que ves ahora no cambia · solo se quita de la lista' });
  }
  function one(i, pj) {                                         // un aspecto guardado
    const c = car(), it = c.items[i]; if (!it) return menu(0, pj);
    const back = () => menu('i' + i, pj), n = c.items.length;
    const L = [
      ['Usar este aspecto ahora', async () => { await go(i); one(i, pj); }, '', null, 'use'],
      ['Actualizar con el aspecto de ahora<small>sustituye lo guardado</small>', () => update(i, pj), '', null, 'upd'],
      [`Cambiar nombre…<small>${esc(it.name)}</small>`, async () => {
        const v = await C.ask('Nombre del aspecto', { value: it.name, max: 40, ok: 'Guardar' });
        if (v !== null && v.trim()) { await setC({ items: car().items.map((x, j) => j === i ? { ...x, name: v.trim() } : x) }); C.toast('Nombre cambiado'); }
        one(i, pj);
      }, '', null, 'name']
    ];
    if (i > 0) L.push(['Subir en la lista', () => move(i, -1, pj), '', null, 'up']);
    if (i < n - 1) L.push(['Bajar en la lista', () => move(i, 1, pj), '', null, 'down']);
    L.push(['Quitar del carrusel', () => askRemove(i, pj), '', null, 'del'], ['Volver', back, '', null, 'back']);
    C.openMenu(it.name, L, 0, { back, help: esc(C.sum(it.look)) });
  }
  function menu(at = 0, pj = 0) {
    const c = car(), back = () => C.appearance('carousel', pj), ci = curIdx(), n = c.items.length, base = c.items[c.idx];
    const L = [[`Añadir el aspecto de ahora…<small>${ci >= 0 ? 'ya guardado: «' + esc(c.items[ci].name) + '»' : 'sin guardar'}</small>`, () => add(pj), '', null, 'add']];
    if (ci < 0 && base) L.push([`Guardar cambios en «${esc(base.name)}»<small>lo has modificado</small>`, () => update(c.idx, pj), '', null, 'save']);
    const sm = s => String(s).length > 44 ? String(s).slice(0, 43) + '…' : s;
    c.items.forEach((it, i) => L.push([`<span class="lb"><span class="ck">${i === ci ? '●' : ''}</span>${esc(it.name)}</span><small>${esc(sm(C.sum(it.look)))}</small>`, () => one(i, pj), 'sub', null, 'i' + i]));
    const cyc = (key, vals, get, put) => async dl => { const j = (vals.indexOf(get()) + (dl || 1) + vals.length) % vals.length; await put(vals[j]); menu(key, pj); };
    const tBoot = cyc('boot', [true, false], () => c.boot, v => setC({ boot: v }));
    const tMins = cyc('mins', MINS, () => c.mins, v => setC({ mins: v }));
    const tRand = cyc('random', [false, true], () => c.random, v => setC({ random: v }));
    L.push([`Cambiar al iniciar el launcher<small>‹ ${c.boot ? 'Sí' : 'No'} ›</small>`, () => tBoot(1), 'sep', dl => tBoot(dl), 'boot'],
      [`Cambiar cada…<small>‹ ${minTxt(c.mins)} ›</small>`, () => tMins(1), '', dl => tMins(dl), 'mins'],
      [`Orden<small>‹ ${c.random ? 'Al azar' : 'En secuencia'} ›</small>`, () => tRand(1), '', dl => tRand(dl), 'random']);
    if (n > 1) L.push(['Pasar al siguiente ahora<small>Ctrl + →</small>', async () => { await step(1, true); menu('next', pj); }, '', null, 'next']);
    L.push(['Volver', back, '', null, 'back']);
    C.openMenu('Carrusel de aspectos', L, at, { back, help: n ? 'Ctrl+← / Ctrl+→ (o L2 / R2) cambian de aspecto a mano · lo que no guardes se pierde al cambiar' : 'Ajusta el launcher a tu gusto y guarda aquí el aspecto · luego crea otro y guárdalo también' });
  }

  return {
    init(ctx) { C = ctx; },
    label, menu, step, boot, start,
    get count() { return car().items.length; }
  };
})();
