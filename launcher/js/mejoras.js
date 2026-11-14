// GameShell · mejoras.js
// Lo nuevo de esta versión, aparte para no mezclarlo con app.js: tipos de letra (por su cuenta, sin atarlos al estilo), ampliación al pasar el ratón (como el Dock de macOS),
// color y altura de Brasas, contador de FPS, cambio de resolución y mandos Buzz. app.js le pasa lo que necesita con Mej.init({...}) y lo llama desde los sitios que tocan.
// Va ANTES de app.js en index.html. Lo que usa de app.js (menús, avisos…) solo se toca cuando ya está todo cargado.
const Mej = (() => {
  let C = {};                                          // contexto que da app.js
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
  const gsx = () => window.gsx || null;                // preload-gs.js: fuentes propias, FPS, resolución y Buzz (solo en la ventana del launcher)
  const num = (v, a, b, d) => { v = +v; return isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };

  // ───────────────────────── tipos de letra ─────────────────────────
  // «La del estilo» (auto) deja el tipo de letra que ya tenía cada estilo. Los demás se eligen aparte y valen para cualquier estilo:
  // los que ya trae Windows, los que van en assets/fuentes (css/fuentes.css) y los que importes tú (.ttf .otf .woff .woff2 → %APPDATA%\gameshell\fuentes).
  const FALLBACK = ',"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif';
  const SYS = [
    ['segoe', 'Segoe UI', '"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif', 'La de siempre en Windows'],
    ['bahnschrift', 'Bahnschrift', 'Bahnschrift' + FALLBACK, 'Técnica y compacta (Windows 10/11)'],
    ['consolas', 'Consolas', 'Consolas,"Cascadia Mono","Courier New",monospace', 'De máquina de escribir, tipo código'],
    ['georgia', 'Georgia', 'Georgia,"Times New Roman",serif', 'Con serifas, clásica'],
    ['impact', 'Impact', 'Impact,"Arial Narrow",sans-serif', 'Gruesa y estrecha'],
    ['trebuchet', 'Trebuchet MS', '"Trebuchet MS","Segoe UI",sans-serif', 'Humanista y amable']
  ].map(([id, name, css, desc]) => ({ id, name, css, desc, org: 'Windows' }));
  const PACK = [
    ['orbitron', 'Orbitron', 'Futurista y ancha'], ['exo2', 'Exo 2', 'Deportiva, de videojuego', 'Exo 2'], ['oxanium', 'Oxanium', 'Angulosa, de ciencia ficción'],
    ['space-grotesk', 'Space Grotesk', 'Moderna con carácter'], ['montserrat', 'Montserrat', 'Geométrica y limpia'], ['inter', 'Inter', 'Neutra y muy legible'],
    ['nunito', 'Nunito', 'Redondeada y suave'], ['quicksand', 'Quicksand', 'Redondeada y ligera'], ['comfortaa', 'Comfortaa', 'Redonda y amable'],
    ['cinzel', 'Cinzel', 'Mayúsculas romanas, clásica'], ['playfair', 'Playfair Display', 'Elegante, con serifas', 'Playfair Display'], ['rajdhani', 'Rajdhani', 'Estrecha, tipo HUD'],
    ['chakra-petch', 'Chakra Petch', 'Técnica, de esquinas cortadas', 'Chakra Petch'], ['audiowide', 'Audiowide', 'Retrofuturista'], ['michroma', 'Michroma', 'Ancha y extendida'],
    ['press-start', 'Press Start 2P', 'Píxeles de recreativa', 'Press Start 2P'], ['share-tech', 'Share Tech Mono', 'Monoespaciada, técnica', 'Share Tech Mono'], ['bebas', 'Bebas Neue', 'Solo mayúsculas, estrecha', 'Bebas Neue']
  ].map(([id, name, desc, fam]) => ({ id, name, desc, css: '"' + (fam || name) + '"' + FALLBACK, org: 'Incluida', fam: fam || name }));
  let USER = [];                                       // las que has importado: { id: 'u:archivo.ttf', name }
  const famU = id => 'GSU ' + String(id).slice(2).replace(/["\\]/g, '_');
  const userFont = u => ({ id: u.id, name: u.name, desc: 'Tuya · ' + String(u.id).slice(2), css: '"' + famU(u.id) + '"' + FALLBACK, org: 'Mía', user: true, fam: famU(u.id) });
  const allFonts = () => [...SYS, ...PACK, ...USER.map(userFont)];
  const fontOf = id => allFonts().find(f => f.id === id) || null;
  const fontName = id => id === 'auto' || !fontOf(id) ? 'La del estilo' : fontOf(id).name;
  async function loadUserFonts() {                     // registra las importadas para poder usarlas en CSS
    const g = gsx(); if (!g) return;
    try { USER = await g.fonts(); } catch { USER = []; }
    if (!document.fonts) return;
    for (const f of [...document.fonts]) if (/^GSU /.test(f.family) && !USER.some(u => famU(u.id) === f.family)) document.fonts.delete(f);   // las que ya no están
    for (const u of USER) {
      if ([...document.fonts].some(f => f.family === famU(u.id))) continue;
      // se carga desde los bytes (no desde una dirección file://, que el navegador trata como otro origen)
      try { const buf = await g.fontData(u.id); if (!buf) continue; const ff = new FontFace(famU(u.id), buf); await ff.load(); document.fonts.add(ff); } catch (e) { console.warn('fuente', u.id, e); }
    }
  }
  function applyFont(id) {
    const f = id && id !== 'auto' ? fontOf(id) : null, b = document.body;
    b.classList.toggle('ff', !!f);
    if (f) b.style.setProperty('--ff', f.css); else b.style.removeProperty('--ff');
    const done = () => C.afterFont && C.afterFont();   // otro tipo de letra cambia el alto de los textos: lo que se coloca midiéndolos se recoloca
    if (f && f.fam && document.fonts) Promise.all(['400', '600', '700'].map(w => document.fonts.load(w + ' 20px "' + f.fam + '"'))).then(done, done); else done();
  }

  // ───────────────────────── «Intro para jugar» ─────────────────────────
  // Lo que sale bajo el nombre del programa seleccionado. Cada estilo tenía el suyo (texto, botón «Jugar» de PS5, pastilla blanca de PS5 actualización o nada);
  // ahora se puede poner el de cualquier otro. «auto» = el del estilo.
  const PLAYS = {
    text: { name: 'Texto «Intro para jugar»', desc: 'La frase bajo el nombre (la de casi todos los estilos)' },
    btn: { name: 'Botón «Jugar»', desc: 'El botón con «···» del PS5' },
    cta: { name: 'Pastilla blanca ▶', desc: 'La pastilla blanca del PS5 (actualización)' },
    none: { name: 'Nada', desc: 'Sin nada bajo el nombre (como PS3 y PS4)' }
  };

  // ───────────────────────── ampliación al pasar el ratón (como el Dock de macOS) ─────────────────────────
  // Cada icono crece según lo cerca que esté el puntero (curva de coseno) y la fila se abre alrededor del puntero: el desplazamiento es la integral de esa misma curva,
  // así todo es continuo y los iconos nunca se pisan. Crecen hacia arriba (el borde de abajo no se mueve) para no tapar el nombre.
  const DOCK = [['No', 'Sin ampliación'], ['Suave', 'Crecen un poco'], ['Media', 'Se nota bien'], ['Fuerte', 'Como en el Dock de macOS']];
  const DOCK_A = [0, .22, .42, .68];
  const dk = { lvl: 0, x: 0, y: 0, sx: 0, act: 0, want: false, raf: 0, box: null, t: 0 };
  const bell = d => d >= 1 ? 0 : (1 + Math.cos(Math.PI * d)) / 2;
  const bellInt = u => u >= 1 ? .5 : u / 2 + Math.sin(Math.PI * u) / (2 * Math.PI);          // ∫₀ᵘ bell
  // G: [{cx, cy, k}] (centro y escala de cada icono, antes de pintar) · b: tamaño base en px. Cambia G y dice si hay ampliación.
  function dockApply(G, b) {
    const A = DOCK_A[dk.lvl] || 0;
    if (!A || !G.length) return false;
    let L = 1e9, R = -1e9, T = 1e9, B = -1e9;
    for (const c of G) { const h = b * c.k / 2; L = Math.min(L, c.cx - h); R = Math.max(R, c.cx + h); T = Math.min(T, c.cy - h); B = Math.max(B, c.cy + h); }
    dk.box = { L, R, T, B, b };
    if (dk.act <= 0) return false;
    const a = A * dk.act, px = dk.sx, w0 = G.reduce((s, c) => s + b * c.k, 0) / G.length, Rd = w0 * 2.1;
    for (const c of G) {
      const d = c.cx - px, u = Math.abs(d) / Rd, s = 1 + a * bell(u), grow = b * c.k * (s - 1);
      c.cx += Math.sign(d) * a * Rd * bellInt(Math.min(u, 1));        // posición: la integral de la ampliación entre el puntero y el icono
      c.cy -= grow / 2; c.k *= s;
    }
    return true;
  }
  // el puntero tiene que estar sobre la fila (o muy cerca) y no puede haber menús, bandeja ni intro delante
  const zone = () => { const x = dk.box; return !!(x && C.canDock && C.canDock() && dk.x >= x.L - x.b * .35 && dk.x <= x.R + x.b * .35 && dk.y >= x.T - x.b * .45 && dk.y <= x.B + x.b * .3); };
  const ease = (k60, dt) => 1 - Math.pow(1 - k60, dt / 16.667);          // la suavidad es por tiempo, no por fotograma: igual a 30, 60 o 144 fps
  function dockTick(now) {
    dk.raf = 0;
    if (!dk.lvl && dk.act <= 0) { dk.t = 0; return; }
    const dt = dk.t && now > dk.t ? Math.min(100, now - dk.t) : 16.667; dk.t = now;
    dk.want = zone();
    const tgt = dk.want && dk.lvl ? 1 : 0;
    if (dk.act === 0 && tgt) dk.sx = dk.x;                              // al entrar, el punto de partida es el puntero (sin barrido)
    dk.act += (tgt - dk.act) * ease(.24, dt); if (Math.abs(tgt - dk.act) < .004) dk.act = tgt;
    dk.sx += (dk.x - dk.sx) * ease(.42, dt); if (Math.abs(dk.x - dk.sx) < .4) dk.sx = dk.x;
    C.layout && C.layout();
    const row = $('#row'); if (row) row.classList.toggle('dk', dk.act > 0);
    if (dk.act !== tgt || (tgt && dk.sx !== dk.x)) dk.raf = requestAnimationFrame(dockTick); else dk.t = 0;
  }
  const dockKick = () => { if (!dk.raf && (dk.lvl || dk.act > 0)) dk.raf = requestAnimationFrame(dockTick); };
  addEventListener('mousemove', e => {
    if (!dk.lvl && dk.act <= 0) return;
    dk.x = e.clientX; dk.y = e.clientY;
    const x = dk.box;
    if (dk.act <= 0 && x && (dk.x < x.L - x.b * .35 || dk.x > x.R + x.b * .35 || dk.y < x.T - x.b * .45 || dk.y > x.B + x.b * .3)) return;   // lejos de la fila y sin ampliación: nada que hacer
    dockKick();
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { dk.x = dk.y = -1e5; dockKick(); });
  addEventListener('blur', () => { dk.x = dk.y = -1e5; dockKick(); });
  const dockSet = n => { dk.lvl = Math.max(0, Math.min(3, n | 0)); if (!dk.lvl) dk.want = false; C.layout && C.layout(); dockKick(); };

  // ───────────────────────── Brasas: altura y color ─────────────────────────
  // EMB lo comparte el fondo (FXC.embers lo mira en cada fotograma) y la colocación del estilo (geom). Los colores del CSS salen de --eh (giro de tono) y --es (saturación).
  const EMB = { hue: 0, sat: 1, y: 0 };
  const EMBER_C = [
    ['Fuego', 0, 1, 'Naranja y rojo, como siempre'], ['Carmesí', -26, 1.05, 'Rojo intenso'], ['Oro', 24, .95, 'Amarillo dorado'], ['Lima', 66, .95, 'Verde lima'],
    ['Esmeralda', 118, .95, 'Verde bosque'], ['Turquesa', 152, 1, 'Verde azulado'], ['Hielo', 184, .85, 'Azul claro, frío'], ['Azul', 204, 1, 'Azul eléctrico'],
    ['Violeta', 246, 1, 'Morado'], ['Magenta', 290, 1, 'Rosa fuerte'], ['Rosa', 318, .9, 'Rosa suave'], ['Plata', 190, .08, 'Casi sin color: blanco y gris']
  ].map(([name, hue, sat, desc]) => ({ name, hue, sat, desc }));
  const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  function applyEmber(o) {
    if (o) { if ('hue' in o) EMB.hue = num(o.hue, -360, 360, 0); if ('sat' in o) EMB.sat = num(o.sat, 0, 2, 1); if ('y' in o) EMB.y = num(o.y, -40, 40, 0); }
    const r = document.documentElement.style;
    r.setProperty('--eh', EMB.hue); r.setProperty('--es', EMB.sat); r.setProperty('--ey', (-EMB.y) + 'vh');   // +altura = más arriba
  }

  // ───────────────────────── selector inferior: tarjetas de lo nuevo ─────────────────────────
  const TAB_LABEL = { font: 'Tipo de letra', play: 'Intro para jugar', dock: 'Ampliación', emberc: 'Brasas · color', embery: 'Brasas · altura' };
  const EY = [30, 25, 20, 15, 10, 5, 0, -5, -10, -15, -20, -25, -30];
  const styleFont = () => (C.theme && C.theme() === 'cyber') ? 'Bahnschrift' : 'Segoe UI';
  const playNow = () => C.playId ? C.playId('auto') : 'text';
  function cards(tab) {
    const u = C.ui();
    if (tab === 'font') {
      const L = [{ id: 'auto', name: 'La del estilo', desc: 'Ahora: ' + styleFont() + ' (el que trae cada estilo)', cls: 'txt auto' }];
      for (const f of allFonts()) if (!C.hid('font', f.id) || f.id === u.font) L.push({ id: f.id, name: f.name, desc: f.desc, org: f.org, cat: true, cls: 'txt', ff: f.css });   // cat: la etiqueta (Incluida · Windows · Mía) es una categoría, no el paquete de donde viene
      if (gsx()) L.push({ id: '@addfont', name: 'Añadir tipo de letra…', desc: 'Un .ttf, .otf, .woff o .woff2 de tu PC', cls: 'txt add', plus: true });
      return { now: u.font || 'auto', list: L };
    }
    if (tab === 'play') {
      const L = [{ id: 'auto', name: 'Mismo del estilo', desc: 'Ahora: ' + PLAYS[playNow()].name, cls: 'txt auto' }];
      for (const id in PLAYS) L.push({ id, name: PLAYS[id].name, desc: PLAYS[id].desc, cls: 'txt' });
      return { now: u.play || 'auto', list: L };
    }
    if (tab === 'dock') return { now: String(u.dock || 0), list: DOCK.map(([name, desc], i) => ({ id: String(i), name, desc: desc + (i ? ' · mueve el ratón sobre los iconos' : ''), cls: 'txt' })) };
    if (tab === 'emberc') return { now: String(EMBER_C.findIndex(c => c.hue === (u.emberHue || 0) && c.sat === (u.emberSat === undefined ? 1 : u.emberSat))),
      list: EMBER_C.map((c, i) => ({ id: String(i), name: c.name, desc: c.desc, cls: 'txt sw', bg: `radial-gradient(120% 90% at 50% 112%,${hsl(20 + c.hue, c.sat, .55)} 0%,${hsl(14 + c.hue, c.sat * .9, .26)} 38%,transparent 72%),linear-gradient(180deg,${hsl(14 + c.hue, c.sat * .6, .04)},${hsl(14 + c.hue, c.sat * .8, .12)})` })) };
    if (tab === 'embery') return { now: String(u.emberY || 0), list: EY.map(v => ({ id: String(v), name: (v > 0 ? '+' : '') + v + ' %', desc: v === 0 ? 'La altura de siempre' : v > 0 ? 'Más arriba' : 'Más abajo', cls: 'txt' })) };
    return null;
  }
  // se ve en directo mientras se desliza (nada se guarda hasta elegir)
  function preview(tab, c) {
    if (tab === 'font') applyFont(c.id[0] === '@' ? C.ui().font : c.id);
    else if (tab === 'play') C.previewPlay && C.previewPlay(c.id);
    else if (tab === 'dock') dockSet(+c.id);
    else if (tab === 'emberc') { const e = EMBER_C[+c.id]; if (e) applyEmber({ hue: e.hue, sat: e.sat }); }
    else if (tab === 'embery') { applyEmber({ y: +c.id }); C.layout && C.layout(); }
  }
  // lo que se guarda al elegir
  function patch(tab, c) {
    if (tab === 'font') return { font: c.id };
    if (tab === 'play') return { play: c.id };
    if (tab === 'dock') return { dock: +c.id };
    if (tab === 'emberc') { const e = EMBER_C[+c.id]; return { emberHue: e.hue, emberSat: e.sat }; }
    if (tab === 'embery') return { emberY: +c.id };
    return {};
  }
  const label = {
    font: () => fontName(C.ui().font), play: () => { const p = C.ui().play; return !p || p === 'auto' ? 'Mismo del estilo' : PLAYS[p].name; },
    dock: () => DOCK[C.ui().dock || 0][0],
    emberc: () => { const u = C.ui(), c = EMBER_C.find(c => c.hue === (u.emberHue || 0) && c.sat === (u.emberSat === undefined ? 1 : u.emberSat)); return c ? c.name : 'Personalizado'; },
    embery: () => { const y = C.ui().emberY || 0; return y ? (y > 0 ? '+' : '') + y + ' %' : 'La de siempre'; }
  };
  // lo guardado vuelve a pantalla (al cancelar el selector o cambiar de apartado)
  function restore() { const u = C.ui(); applyFont(u.font); dockSet(u.dock || 0); applyEmber({ hue: u.emberHue || 0, sat: u.emberSat === undefined ? 1 : u.emberSat, y: u.emberY || 0 }); }

  // ───────────────────────── contador de FPS (Opciones) ─────────────────────────
  // El número lo pinta una ventana aparte (fps.html) y lo mide PresentMon (fps.js). Aquí solo se manejan los ajustes y las dos cosas que Windows exige una vez:
  // tener el medidor (se descarga) y el permiso de leer los eventos de gráficos.
  const FPS_SZ = [.5, .75, 1, 1.25, 1.5, 2, 2.5, 3];
  async function fpsMenu(at = 'on', st0) {
    const g = gsx(); if (!g) return C.toast('El contador de FPS no está disponible (falta preload-gs.js)');
    let st = st0 || null; if (!st) { try { st = await g.fpsState(); } catch {} }
    st = st || {};
    const u = C.ui(), back = () => C.opts(C.items()[C.sel()], 'fps'), on = !!u.fpsOn, size = FPS_SZ.reduce((a, b) => Math.abs(b - (u.fpsSize || 1)) < Math.abs(a - (u.fpsSize || 1)) ? b : a, 1);
    const reopen = k => fpsMenu(k, st), refetch = k => fpsMenu(k);
    const toggle = async () => { await C.setUI({ fpsOn: !on }); C.Sound.ui('ok'); if (!on && st.win32 && !st.tool) C.toast('Falta el medidor: descárgalo en la fila de abajo'); reopen('on'); };
    const step = d => async () => {
      const i = FPS_SZ.indexOf(size), n = FPS_SZ[(i + d + FPS_SZ.length) % FPS_SZ.length];
      await C.setUI({ fpsSize: n }); g.fpsTest(2500).catch(() => {}); reopen('size');
    };
    const L = [
      [`Mostrar en los juegos<small>${on ? 'Sí · se enciende solo con cada juego' : 'No'}</small>`, toggle, '', toggle, 'on'],
      [`Tamaño<small>‹ ${Math.round(size * 100)} % ›</small>`, step(1), '', d => step(d)(), 'size'],
      ['Probar<small>se ve 4 s arriba a la derecha</small>', async () => { await g.fpsTest(4000).catch(() => {}); reopen('test'); }, '', null, 'test']
    ];
    if (st.win32) {
      L.push([`Medidor (PresentMon)<small>${st.tool ? 'instalado' : 'sin instalar · descargar'}</small>`, async () => {
        if (st.tool) { await g.fpsFolder().catch(() => {}); return reopen('tool'); }
        C.toast('Descargando PresentMon… (necesita internet)');
        const r = await g.fpsDownload().catch(e => ({ ok: false, msg: String(e && e.message || e) }));
        C.toast(r.msg || (r.ok ? 'Listo' : 'No se pudo')); C.Sound.ui(r.ok ? 'ok' : 'err'); refetch('tool'); }, '', null, 'tool']);
      L.push([`Permiso de Windows<small>${st.perm === true ? 'concedido' : st.pending ? 'añadido · falta cerrar sesión' : st.perm === false ? 'falta · pedirlo' : 'sin comprobar · pedirlo'}</small>`, async () => {
        if (st.perm === true) { C.toast('Ya tienes el permiso'); return reopen('perm'); }
        if (st.pending) { C.toast('Ya estás añadido al grupo: cierra la sesión de Windows y vuelve a entrar (o reinicia) para que valga'); return reopen('perm'); }
        C.toast('Windows te pedirá confirmar como administrador…');
        const r = await g.fpsPermission().catch(e => ({ ok: false, msg: String(e && e.message || e) }));
        C.toast(r.msg || (r.ok ? 'Hecho' : 'No se pudo')); C.Sound.ui(r.ok ? 'ok' : 'err'); refetch('perm'); }, '', null, 'perm']);
    } else L.push([`Medidor<small>solo funciona en Windows</small>`, () => reopen('on'), '', null, 'tool']);
    L.push(['Volver', back, '', null, 'back']);
    openFpsMenu(L, at, back, st);
  }
  function openFpsMenu(L, at, back, st) {
    C.openMenu('Contador de FPS', L, at, { back, help: `Tamaño con ←/→: ${FPS_SZ.map(v => Math.round(v * 100)).join(' · ')} % · En el juego, Ctrl+Mayús+F lo enciende, lo oculta o lo muestra${st.err === 'permiso' ? ' · FALTA EL PERMISO' : st.err === 'sin-medidor' ? ' · FALTA EL MEDIDOR' : ''}` });
  }

  // ───────────────────────── mandos Buzz! (Opciones) ─────────────────────────
  // BuzzActivar va integrado: main.js (buzz.js) lo arranca en segundo plano cuando el launcher ya está listo y lo para al cerrarse. Aquí solo se ve cómo va y se ajusta.
  // En el launcher los Buzz no mandan nunca (app.js los ignora): solo valen dentro de los juegos (PCSX2…).
  const BUZZ_TXT = { off: 'apagado', starting: 'arrancando…', waiting: 'activo · enchufa el pincho', ready: 'pincho conectado', 'no-python': 'falta Python', 'no-hidapi': 'falta hidapi · instalar',
    other: 'ya hay otro BuzzActivar abierto (vale)', error: 'se ha parado · Reiniciar', 'sin-archivos': 'faltan archivos en launcher\\buzz', unsupported: 'solo funciona en Windows' };
  const BUZZ_HELP = { 'no-python': 'Falta Python 3: instálalo desde python.org (marca «Add python.exe to PATH» y, mejor, «para todos los usuarios») y pulsa Reiniciar',
    'no-hidapi': 'Falta la librería hidapi: pulsa «Instalar hidapi» (necesita internet)', error: 'Se paró varias veces seguidas: mira gameshell.log y pulsa Reiniciar',
    'sin-archivos': 'Falta la carpeta launcher\\buzz: copia otra vez el parche' };
  const buzzText = st => (BUZZ_TXT[st.st] || '…') + (st.st === 'ready' && st.mandos && st.mandos.length ? ' · mandos ' + st.mandos.join(', ') : '');
  async function buzzMenu(at = 'on', st0) {
    const g = gsx(); if (!g || !g.buzzState) return C.toast('Los mandos Buzz no están disponibles (falta preload-gs.js)');
    let st = st0 || null; if (!st) { try { st = await g.buzzState(); } catch {} }
    st = st || {};
    const u = C.ui(), on = u.buzzOn !== false, beep = u.buzzBeep !== false;
    const back = () => C.opts(C.items()[C.sel()], 'buzz'), refetch = k => buzzMenu(k);
    const here = () => { const h = $('#mn h2'); return !!h && h.textContent === 'Mandos Buzz' && $('#ov').classList.contains('on'); };
    const later = (k, ms) => setTimeout(() => { if (here()) buzzMenu(k); }, ms);          // el estado cambia solo un momento después (arrancar, enlazar…): se vuelve a leer si el menú sigue abierto
    const toggle = async () => { await C.setUI({ buzzOn: !on }); C.Sound.ui('ok'); C.toast(!on ? 'Mandos Buzz activados' : 'Mandos Buzz apagados'); refetch('on'); later('on', 2500); };
    const tbeep = async () => { await C.setUI({ buzzBeep: !beep }); C.Sound.ui('ok'); refetch('beep'); later('beep', 2500); };
    const L = [[`Activar los Buzz<small>${on ? 'Sí · se activan solos con el launcher' : 'No'}</small>`, toggle, '', toggle, 'on'],
      [`Estado<small>${buzzText(st)}</small>`, () => { C.Sound.ui('ok'); refetch('state'); }, '', null, 'state']];
    if (st.st === 'no-hidapi') L.push([`Instalar hidapi<small>necesita internet</small>`, async () => {
      C.toast('Instalando hidapi… (necesita internet; puede tardar un minuto)');
      const r = await g.buzzInstall().catch(e => ({ ok: false, msg: String(e && e.message || e) }));
      C.toast(r.msg || (r.ok ? 'Listo' : 'No se pudo')); C.Sound.ui(r.ok ? 'ok' : 'err'); refetch('state'); later('state', 3000); }, '', null, 'install']);
    L.push([`Pitido al detectar el pincho<small>${beep ? 'Sí' : 'No'}</small>`, tbeep, '', tbeep, 'beep'],
      [`Reiniciar<small>si no detecta el pincho</small>`, async () => {
        C.toast('Reiniciando los Buzz…');
        const s = await g.buzzRestart().catch(() => null); C.Sound.ui('ok'); buzzMenu('restart', s || undefined); later('restart', 2500); }, '', null, 'restart'],
      ['Volver', back, '', null, 'back']);
    C.openMenu('Mandos Buzz', L, at, { back, help: BUZZ_HELP[st.st] || 'Los Buzz solo valen dentro de los juegos: en el launcher manda siempre tu mando' });
  }

  // ───────────────────────── resolución de pantalla (Opciones) ─────────────────────────
  // La lista sale de Windows (solo los modos que tu pantalla admite). Se aplica «en caliente» y hay 15 s para confirmarla: si no, vuelve sola a la anterior.
  const mode = m => `${m.w} × ${m.h}`;
  async function screenMenu(at = 'res', keep, quiet) {          // quiet: al volver de un cambio no se tapa el aviso («Resolución guardada»…) con el de «leyendo»
    const g = gsx(); if (!g) return C.toast('El cambio de resolución no está disponible (falta preload-gs.js)');
    if (!quiet) C.toast('Leyendo las resoluciones de tu pantalla…');
    const d = await g.screenList().catch(e => ({ ok: false, msg: String(e && e.message || e) }));
    if (!d || !d.ok) { C.toast((d && d.msg) || 'No se pudo leer la pantalla'); return C.opts(C.items()[C.sel()], 'res'); }
    if (d.pending) return confirmMenu(d.pending, null);   // un cambio sin confirmar (p. ej. tras recargar): se vuelve a preguntar
    const sizes = []; for (const m of d.modes) if (!sizes.some(s => s.w === m.w && s.h === m.h)) sizes.push({ w: m.w, h: m.h, hz: d.modes.filter(x => x.w === m.w && x.h === m.h).map(x => x.hz).sort((a, b) => b - a) });
    let si = Math.max(0, sizes.findIndex(s => s.w === (keep || d.cur).w && s.h === (keep || d.cur).h)), hi = Math.max(0, sizes[si].hz.indexOf((keep || d.cur).hz));
    const back = () => C.opts(C.items()[C.sel()], 'res');
    const hzTxt = () => sizes[si].hz[hi] ? sizes[si].hz[hi] + ' Hz' : 'automática';
    const same = () => sizes[si].w === d.cur.w && sizes[si].h === d.cur.h && sizes[si].hz[hi] === d.cur.hz;
    const lines = () => ({ res: `Resolución<small>‹ ${mode(sizes[si])} ›</small>`, hz: `Frecuencia<small>‹ ${hzTxt()} ›</small>` });
    const move = (which, dlt) => {
      if (which === 'res') { si = (si + dlt + sizes.length) % sizes.length; const want = d.cur.hz; const j = sizes[si].hz.indexOf(want); hi = j >= 0 ? j : 0; }
      else hi = (hi + dlt + sizes[si].hz.length) % sizes[si].hz.length;
      const t = lines(); C.rowHtml(0, t.res); C.rowHtml(1, t.hz); C.rowHtml(2, `Aplicar<small>${same() ? 'es la que ya tienes' : mode(sizes[si]) + ' · ' + hzTxt()}</small>`);
    };
    const apply = async () => {
      if (same()) return C.toast('Esa ya es la resolución actual');
      const m = { w: sizes[si].w, h: sizes[si].h, hz: sizes[si].hz[hi] || 0 };
      const r = await g.screenSet(m.w, m.h, m.hz).catch(e => ({ ok: false, msg: String(e && e.message || e) }));
      if (!r || !r.ok) { C.toast((r && r.msg) || 'No se pudo cambiar'); C.Sound.ui('err'); return screenMenu('apply', m, true); }
      confirmMenu(m, d.cur, r.wait || 15);
    };
    const t = lines();
    C.openMenu('Resolución de pantalla', [
      [t.res, apply, '', dl => move('res', dl), 'res'], [t.hz, apply, '', dl => move('hz', dl), 'hz'],
      [`Aplicar<small>${same() ? 'es la que ya tienes' : mode(sizes[si]) + ' · ' + hzTxt()}</small>`, apply, '', null, 'apply'],
      ['Volver', back, '', null, 'back']
    ], at, { back, help: `Ahora: ${mode(d.cur)} · ${d.cur.hz} Hz${d.reg && (d.reg.w !== d.cur.w || d.reg.h !== d.cur.h || d.reg.hz !== d.cur.hz) ? ' · guardada en Windows: ' + mode(d.reg) : ''}` });
  }
  let cd = 0, onEnd = false;
  function confirmMenu(m, before, wait = 15) {
    const g = gsx(); let left = wait, done = false;
    const end = async (keepIt) => {
      if (done) return; done = true;                       // dos pulsaciones seguidas no repiten nada
      clearInterval(cd); cd = 0;
      const r = await (keepIt ? g.screenKeep() : g.screenRevert()).catch(e => ({ ok: false, msg: String(e && e.message || e) }));
      C.toast(keepIt ? (r.ok ? 'Resolución guardada' : (r.msg || 'No se pudo guardar')) : (r.ok ? 'Se volvió a la resolución anterior' : (r.msg || 'No se pudo volver')));
      screenMenu('res', null, true);
    };
    if (!onEnd) { onEnd = true; g.onScreenEnd(d => { if (!cd) return; clearInterval(cd); cd = 0; C.closeMenu(); C.toast((d && d.msg) || 'Se volvió a la resolución anterior'); C.Sound.ui('back'); screenMenu('res', null, true); }); }
    const help = () => `${mode(m)} · ${m.hz} Hz · si no confirmas, vuelve sola a la anterior en ${left} s`;
    C.openMenu('¿Mantener esta resolución?', [['Mantener esta resolución', () => end(true), '', null, 'keep'], [`Volver a la anterior<small>${before ? mode(before) : ''}</small>`, () => end(false), '', null, 'revert']], 'revert',
      { back: () => end(false), help: help() });
    clearInterval(cd);
    cd = setInterval(() => { left--; const h = document.querySelector('#mn .mh'); if (h) h.textContent = help(); if (left <= 0) { clearInterval(cd); } }, 1000);
  }

  return {
    init(ctx) { C = ctx; applyEmber(); },
    EMB, PLAYS, DOCK, TAB_LABEL,
    fonts: { all: allFonts, name: fontName, apply: applyFont, load: loadUserFonts, hasUser: () => USER.length > 0, can: () => !!gsx(),
      add: async () => { const g = gsx(); if (!g) return []; const ids = await g.fontAdd().catch(() => []); if (ids.length) await loadUserFonts(); return ids; },
      del: async id => { const g = gsx(); if (!g) return false; const ok = await g.fontDel(id).catch(() => false); if (ok) await loadUserFonts(); return ok; } },
    dock: { apply: dockApply, set: dockSet, kick: dockKick, active: () => dk.act > 0 },
    ember: { apply: applyEmber },
    tab: { cards, preview, patch, label, restore },
    fpsMenu, screenMenu, buzzMenu
  };
})();
