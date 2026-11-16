// GameShell · subconsola.js
// Subconsolas: carpetas donde agrupar programas. Aquí está su vista (una cuadrícula de portadas con el nombre debajo) y el modo «mover de sitio»,
// que sirve para reordenar los iconos de la fila del inicio y los de dentro de una subconsola. app.js le pasa lo que necesita con Sub.init({...}).
// Va ANTES de app.js en index.html. Lo que usa de app.js (menús, avisos, lista de juegos…) solo se toca cuando ya está todo cargado.
//
// Cómo se guardan (games.json): una subconsola es una entrada más con folder:true; los juegos de dentro llevan parent = el id de la subconsola.
// El orden de la fila y el de dentro de cada subconsola es el orden de games.json (main.js: «order»).
const Sub = (() => {
  let C = {};                                            // contexto que da app.js
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
  const PLUS = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
  let st = null;                                         // subconsola abierta: { id, i (la tarjeta con el foco), list (tarjetas, la última es «Añadir juego»), add }
  let mv = null;                                         // modo «mover de sitio»: { id, where: 'dock' | 'sub', p (la última escritura en disco) }

  const movable = it => !!it && (it.t === 'game' || it.t === 'sub');
  const cur = () => (st && st.list ? st.list[st.i] : null);

  // ───────────── la cuadrícula ─────────────
  const card = (it, i) => it.t === 'add'
    ? `<div class="sc-c add" data-i="${i}"><div class="sc-p">${PLUS}</div><span class="sc-n">Añadir juego</span></div>`
    : `<div class="sc-c${it.cover ? ' cv' : ''}" style="--k:${it.k}" data-i="${i}"${it.auto ? ' data-a' : ''}${it.hidden ? ' data-h' : ''}><div class="sc-p">${it.icon ? `<img src="${it.icon}" alt="">` : ''}</div><span class="sc-n">${esc(it.name)}</span></div>`;

  function render() {
    const f = st && C.byId(st.id); if (!f) return close(true);
    const kids = C.kids(st.id);
    st.add = st.add || { t: 'add', name: 'Añadir juego', parent: st.id };
    st.list = [...kids, st.add];
    st.i = Math.max(0, Math.min(st.i, st.list.length - 1));
    $('#sct').textContent = f.name;
    $('#scn').textContent = kids.length === 1 ? '1 juego' : kids.length + ' juegos';
    $('#scm').style.display = kids.length ? 'none' : 'block';
    const g = $('#scg');
    g.innerHTML = st.list.map(card).join('');
    [...g.children].forEach((e, i) => { st.list[i].el = e; });
    paint(true);
  }
  function paint(scroll = true) {
    if (!st) return;
    st.list.forEach((it, i) => it.el && it.el.classList.toggle('s', i === st.i));
    const e = st.list[st.i] && st.list[st.i].el;
    if (e && scroll) e.scrollIntoView({ block: 'nearest' });
  }
  const cols = () => {                                   // cuántas tarjetas caben por fila (se mide: depende del ancho de la pantalla)
    const k = st ? [...$('#scg').children] : []; if (!k.length) return 1;
    let n = 0; for (const e of k) { if (e.offsetTop === k[0].offsetTop) n++; else break; }
    return Math.max(1, n);
  };

  function open(id) {
    if (!C.byId(id)) return;
    st = { id, i: 0, list: [], add: null };
    document.body.classList.add('sub-open');
    $('#sc').classList.add('on');
    C.setMode('sub');
    render();
    C.Sound.ui('open');
  }
  function close(silent) {
    if (!st) return;
    end(false);
    st = null;
    $('#sc').classList.remove('on'); document.body.classList.remove('sub-open');
    C.setMode('home');
    if (!silent) C.Sound.ui('back');
  }
  // app.js lo llama cada vez que recarga la lista: si hay una subconsola abierta se repinta con lo nuevo (o se cierra si ya no existe)
  function sync() {
    if (mv) end(false);
    if (st) render();
  }

  // ───────────── teclado y mando dentro de la cuadrícula ─────────────
  function act(a) {
    if (!st) return;
    if (mv) return moveAct(a);
    const n = st.list.length, c = cols(), i = st.i;
    const go = j => { j = Math.max(0, Math.min(n - 1, j)); if (j !== st.i) { st.i = j; C.Sound.ui('move'); paint(); } };
    if (a === 'l') go(i - 1);
    else if (a === 'r') go(i + 1);
    else if (a === 'u') { if (i - c >= 0) go(i - c); }
    else if (a === 'd') { if (i + c <= n - 1) go(i + c); else if (Math.floor(i / c) < Math.floor((n - 1) / c)) go(n - 1); }   // en la última fila, ↓ baja a la última tarjeta
    else if (a === 'first') go(0);
    else if (a === 'last') go(n - 1);
    else if (a === 'pu' || a === 'l1') go(i - c * 2);
    else if (a === 'pd' || a === 'r1') go(i + c * 2);
    else if (a === 'ok') { C.Sound.ui('ok'); C.openItem(st.list[i]); }                       // jugar (o «Añadir juego»)
    else if (a === 'opt') { C.Sound.ui('open'); C.opts(st.list[i]); }                        // las opciones de ese juego
    else if (a === 'sq') grab(st.list[i]);
    else if (a === 'back') close();
  }

  // ───────────── mover de sitio ─────────────
  // T / □ (o «Mover de sitio» en las opciones) coge el icono: ←/→ lo colocan (en una subconsola también ↑/↓), Intro / Esc / T lo sueltan. Cada paso se guarda al momento.
  function grab(it) {
    if (mv) return;
    if (!movable(it)) { C.toast('Eso no se puede mover de sitio'); C.Sound.ui('err'); return; }
    const where = st && it.parent === st.id ? 'sub' : 'dock';
    if (where === 'dock' && C.items().filter(movable).length < 2) { C.toast('Hace falta otro programa para poder cambiar el orden'); C.Sound.ui('err'); return; }
    mv = { id: it.id, where, p: Promise.resolve() };
    if (it.el) it.el.classList.add('mv');
    $('#mvt').textContent = it.name ? '«' + it.name + '»' : 'Mover';
    $('#mvbar').classList.add('on'); document.body.classList.add('moving');
    C.Sound.ui('open');
    C.toast(where === 'sub' ? 'Mueve con ← → ↑ ↓ · Intro para soltar' : 'Mueve con ← → · Intro para soltar');
  }
  function persist(ids) { mv.p = mv.p.then(() => C.order(ids)).catch(() => {}); }
  function step(d) {
    if (!mv || !d) return;
    if (mv.where === 'dock') {
      const its = C.items(), s = its.findIndex(x => x.id === mv.id), j = s + d;
      if (s < 0 || j < 1 || j >= its.length || !movable(its[j])) return C.Sound.ui('err');   // el Navegador y los iconos de «Añadir…» / «Crear…» no se mueven ni se pisan
      [its[s], its[j]] = [its[j], its[s]];
      C.setSel(j); C.show();                                                                   // los iconos conservan su elemento: se deslizan a su sitio nuevo
      persist(its.filter(movable).map(x => x.id));
    } else {
      if (!st) return;
      const L = st.list, s = L.findIndex(x => x.id === mv.id), j = s + d, last = L.length - 2;   // la última tarjeta es «Añadir juego»: no se mueve
      if (s < 0 || j < 0 || j > last) return C.Sound.ui('err');
      const a = L[s].el, b = L[j].el, ph = document.createComment('');
      a.replaceWith(ph); b.replaceWith(a); ph.replaceWith(b);                                   // se intercambian las dos tarjetas en la cuadrícula
      [L[s], L[j]] = [L[j], L[s]];
      L.forEach((it, i) => { if (it.el) it.el.dataset.i = i; });
      st.i = j; paint();
      persist(L.filter(x => x.t === 'game').map(x => x.id));
    }
    C.Sound.ui('move');
  }
  function moveAct(a) {
    if (a === 'l') step(-1);
    else if (a === 'r') step(1);
    else if (mv.where === 'sub' && a === 'u') step(-cols());
    else if (mv.where === 'sub' && a === 'd') step(cols());
    else if (a === 'ok' || a === 'back' || a === 'sq' || a === 'opt') end(true);
  }
  function end(saved) {
    if (!mv) return;
    const m = mv; mv = null;
    const e = m.where === 'sub' ? (st && st.list.find(x => x.id === m.id)) : C.items().find(x => x.id === m.id);
    if (e && e.el) e.el.classList.remove('mv');
    $('#mvbar').classList.remove('on'); document.body.classList.remove('moving');
    if (saved) { C.Sound.ui('ok'); C.toast('Orden guardado'); m.p.then(() => C.refresh()); }   // se vuelve a leer de disco: lo que se ve es exactamente lo que quedó guardado
  }

  // ───────────── ratón ─────────────
  // Dentro de la cuadrícula el foco sigue al puntero (aquí no hay nada que se desplace, así que no hay problema) y un clic abre.
  function wire() {
    const g = $('#scg');
    let lx = -1, ly = -1;   // solo cuenta el movimiento REAL del ratón: al navegar con teclado la cuadrícula se desplaza bajo un puntero parado y el foco no debe irse a lo que quede debajo
    g.addEventListener('mousemove', e => {
      if (e.clientX === lx && e.clientY === ly) return; lx = e.clientX; ly = e.clientY;   // mismas coordenadas = no hay movimiento real
      const c = e.target.closest('.sc-c'); if (!c || !st || mv) return; const i = +c.dataset.i; if (i !== st.i) { st.i = i; paint(false); }
    });
    g.addEventListener('click', e => { const c = e.target.closest('.sc-c'); if (!c || !st || mv) return; st.i = +c.dataset.i; paint(false); act('ok'); });
    g.addEventListener('contextmenu', e => { e.preventDefault(); const c = e.target.closest('.sc-c'); if (!c || !st || mv || C.menuOpen()) return; st.i = +c.dataset.i; paint(false); act('opt'); });
    $('#scb').addEventListener('click', () => { if (st && !mv && !C.menuOpen()) close(); });
    $('#mvbar').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !mv) return; if (b.dataset.d === '0') end(true); else step(+b.dataset.d); });
    $('#sch2').innerHTML = `<span>Intro/${GLYPH.x} Jugar</span><span>Esc/${GLYPH.o} Volver</span><span>Supr/<b class="st">START</b> Opciones</span><span>T/${GLYPH.q} Mover de sitio</span>`;
  }

  return {
    init(ctx) { C = ctx; wire(); },
    open, close, sync, act, grab, moveAct, cur,
    moving: () => !!mv,
    get isOpen() { return !!st; }
  };
})();
