// GameShell · interfaz del launcher
// Fusión de «actualizado» (base) y «actualizacion». Todo lo de los dos está aquí: 14 estilos, 5 barras inferiores, 6 barras superiores,
// 7 timbres de menú, 12 intros y 12 fondos. Todo se cambia en Opciones (Supr / START) > Apariencia.
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
const GLOBE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>';
// símbolos de la barra inferior de «actualizacion» (teclas + botones redondos)
const SV = {
  x: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  o: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5"/></svg>',
  q: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.2"/></svg>',
  tri: '<svg viewBox="0 0 24 24"><path d="M12 5.2l7 12.1H5z"/></svg>',
  opt: '<svg viewBox="0 0 24 24"><path d="M6.5 9h11M6.5 12h11M6.5 15h11"/></svg>'
};
const pb = c => `<span class="pb ${c}">${SV[c]}</span>`;
const kbd = t => `<kbd>${t}</kbd>`;

// apariencia guardada (main.js: ui.json). «auto» = el que le toca al estilo
let UI = { theme: 'classic', name: 'GameShell', bg: '', intro: 'ps2-boot', introBg: '', sounds: true, introSnd: true, vol: .6, menuVol: .6,
  menuSnd: 'auto', introSndSrc: 'auto', bar: 'auto', top: 'auto', psWait: true, psReq: false, pswBg: '', alt: null, mode: '', introText: '',
  tile: 1, tabText: 'Juegos', webText: 'Web', webAds: true, webYt: true, webSb: true, webCookies: true, webOsk: true,
  play: 'auto', font: 'auto', dock: 0, emberY: 0, emberHue: 0, emberSat: 1, fpsOn: false, fpsSize: 1, buzzOn: true, buzzBeep: true,   // «Intro para jugar», tipo de letra, ampliación, altura/color de Brasas, contador de FPS, mandos Buzz (se activan solos / pitido)
  hide: { theme: [], bg: [], intro: [], bar: [], top: [], font: [] }, gone: { theme: [], bg: [], intro: [], bar: [], top: [], font: [] } };
let F = [], FALL = [];                        // F: fondos que salen en los selectores (los de assets/fondos + las fotos importadas, menos los eliminados) · FALL: todos
let items = [], sel = 0, mode = 'home', menu = null, wv, gameOn = false, pmode = false, theme = '', stopFx = null, cur = '', tray = null, fxbMode = '', fxId = '', curBg = '', tileS = 1;
const live = () => !gameOn || document.hasFocus(); // con un juego abierto y el launcher sin foco, se ignora el mando y el teclado
// lo «eliminado» desde el launcher (estilos, fondos e intros): no sale en los selectores, pero no se borra del disco y se puede restaurar
const hid = (k, id) => ((UI.hide || {})[k] || []).includes(id) || ((UI.gone || {})[k] || []).includes(id);   // gone = eliminado definitivamente
const HK = ['theme', 'bg', 'intro', 'bar', 'top', 'font'];   // todo esto se puede eliminar (y restaurar)
const hideLists = () => { const h = UI.hide || {}; return Object.fromEntries(HK.map(k => [k, [...(h[k] || [])]])); };
const goneLists = () => { const g = UI.gone || {}; return Object.fromEntries(HK.map(k => [k, [...(g[k] || [])]])); };
const shownThemes = () => Object.keys(THEMES).filter(id => !hid('theme', id));
const shownIntros = () => Object.keys(INTROS).filter(id => !hid('intro', id));

// ───────────────────────── estilos ─────────────────────────
// geom(i, seleccionado, ancho, alto, u) → dónde va cada icono. u = alto/1080 (los estilos de «actualizado» escalan con la pantalla; el clásico y los de «actualizacion» no).
// Los estilos se dibujan con css/themes.css (los de «actualizado») y css/themes-b.css (los de «actualizacion», ids b-*);
// aquí solo está el reparto de los iconos y sus decorados. top / bar / snd = barra superior, barra inferior y timbre de menú que le tocan a cada estilo.
// «actualizacion» colocaba los iconos con una fila flex desplazada: T = tamaño, G = hueco, M = hueco extra a cada lado del seleccionado,
// S = escala del seleccionado, A = dónde queda ('c' = centro, número = px, '24%' = % del ancho). Misma fórmula, calculada icono a icono:
const geomB = (T, G, M, S, A, top) => (i, s, W, H) => {
  const a = A === 'c' ? W / 2 - T / 2 - M : (typeof A === 'string' ? W * parseFloat(A) / 100 : A) + (S - 1) * T / 2 - M;
  const left = a + (i - s) * (T + G) + (i > s ? 2 * M : 0) + (i === s ? M : 0);
  return { cx: left + T / 2, cy: top(H) + T / 2, k: i === s ? S : 1 };
};
const A_ = 'actualizado', B_ = 'actualizacion', N_ = 'nuevo';
const THEMES = {
  // ── de «actualizado» ──
  classic: { name: 'Clásico', desc: 'El de siempre', origin: A_, top: 'a-classic', bar: 'a-classic', snd: 'classic', b: 220, fixed: true,
    geom: (i, s, W, H) => ({ cx: W / 2 + (i - s) * 256, cy: H * .36 + 110, k: i === s ? 1.22 : 1 }) },
  ps5: { name: 'PS5', desc: 'Como el menú de PlayStation 5', origin: A_, top: 'a-ps5', bar: 'a-ps5', snd: 'ps5', b: 104, hero: true, plain: true, play: 'btn', anc: 'lt', tn: (S, u) => [180 * u * (S - 1), 120 * u * (S - 1)],
    geom: (i, s, W, H, u) => { // el seleccionado se queda fijo a la izquierda y la fila se desplaza por debajo
      const b = 104 * u, L = 180 * u, g = 18 * u, x0 = 93 * u, y = 118 * u;
      if (i === s) return { x: x0, y, k: L / b };
      if (i < s) return { x: x0 - (s - i) * (b + g), y, k: 1 };
      return { x: x0 + L + g + (i - s - 1) * (b + g), y, k: 1 };
    } },
  ps3: { name: 'PS3', desc: 'Barra de iconos con ondas de seda', origin: A_, top: 'a-ps3', bar: 'a-ps3', snd: 'ps3', b: 120, plain: true,
    geom: (i, s, W, H, u) => { const d = i - s; return { cx: W * .3 + d * 150 * u + Math.sign(d) * 56 * u, cy: H * .40, k: d ? .74 : 1.4, o: d ? Math.max(.16, .8 - Math.abs(d) * .09) : 1 }; } },
  ps2: { name: 'PS2', desc: 'Torres azules en la oscuridad', origin: A_, top: 'a-ps2', bar: 'a-ps2', snd: 'ps2', b: 168, anc: 'cc',
    geom: (i, s, W, H, u) => ({ cx: W / 2 + (i - s) * 236 * u, cy: H * .55, k: i === s ? 1.2 : .88, o: i === s ? 1 : .72 }) },
  neon: { name: 'Neón', desc: 'Símbolos brillantes sobre negro', origin: A_, top: 'a-classic', bar: 'a-classic', snd: 'neon', b: 196,
    geom: (i, s, W, H, u) => ({ cx: W / 2 + (i - s) * 250 * u, cy: H * .42, k: i === s ? 1.2 : .9, o: i === s ? 1 : .85 }) },
  aurora: { name: 'Aurora', desc: 'Cristal esmerilado y luces suaves', origin: A_, top: 'a-classic', bar: 'a-classic', snd: 'aurora', b: 206,
    geom: (i, s, W, H, u) => ({ cx: W / 2 + (i - s) * 252 * u, cy: H * .40, k: i === s ? 1.16 : .94, o: i === s ? 1 : .9 }) },
  synth: { name: 'Synthwave', desc: 'Atardecer retro con rejilla', origin: A_, top: 'a-synth', bar: 'a-classic', snd: 'synth', b: 188, anc: 'ct',
    geom: (i, s, W, H, u) => ({ cx: W / 2 + (i - s) * 240 * u, cy: H * .40, k: i === s ? 1.2 : .92, o: i === s ? 1 : .86 }) },
  // ── de «actualizacion» (medidas en px fijos, como allí) ──
  'b-classic': { name: 'Clásico (actualización)', desc: 'El clásico con sus barras de abajo y arriba', origin: B_, top: 'b', bar: 'b', snd: 'classic', b: 220, fixed: true,
    geom: geomB(220, 36, 0, 1.22, 'c', H => H * .36) },
  'b-ps5': { name: 'PS5 (actualización)', desc: 'Fila arriba, marco blanco y cartel a la derecha', origin: B_, top: 'b', bar: 'b', snd: 'ps5', b: 100, fixed: true, bhero: true, anc: 'lt', play: 'cta',
    geom: geomB(100, 20, 22, 1.38, 64, () => 118) },
  'b-ps3': { name: 'PS3 · Onda XMB', desc: 'Iconos sin fondo sobre ondas de seda', origin: B_, top: 'b', bar: 'b', snd: 'ps3', b: 84, fixed: true,
    geom: (i, s, W, H) => ({ ...geomB(84, 46, 24, 1.5, '24%', H => H * .27)(i, s, W, H), o: i === s ? 1 : .62 }) },
  'b-ps2': { name: 'PS2 · Torres', desc: 'Torres de luz sobre cristal oscuro', origin: B_, top: 'b', bar: 'b', snd: 'ps2', b: 190, fixed: true,
    geom: geomB(190, 34, 0, 1.2, 'c', H => H * .36) },
  'b-neon': { name: 'Neón (actualización)', desc: 'Rejilla synthwave y marcos que brillan', origin: B_, top: 'b', bar: 'b', snd: 'synth', b: 200, fixed: true,
    geom: geomB(200, 40, 0, 1.22, 'c', H => H * .36) },
  'b-glass': { name: 'Cristal', desc: 'Manchas de color y vidrio esmerilado', origin: B_, top: 'b', bar: 'b', snd: 'aurora', b: 200, fixed: true,
    geom: geomB(200, 34, 0, 1.18, 'c', H => H * .36) },
  'b-oled': { name: 'OLED minimal', desc: 'Negro puro y líneas finas', origin: B_, top: 'b', bar: 'b', snd: 'classic', b: 150, fixed: true,
    geom: geomB(150, 30, 0, 1.2, 'c', H => H * .36) },
  // ── nuevos (css/themes-c.css · js/fxc.js) ──
  ps4: { name: 'PS4 · Dinámico', desc: 'Azul profundo, polvo de luz y marco blanco brillante', origin: N_, top: 'a-ps5', bar: 'a-classic', snd: 'ps4', b: 158, plain: true, anc: 'lb',
    geom: (i, s, W, H, u) => { // el seleccionado se queda a la izquierda, grande; la fila sigue a su derecha
      const b = 158 * u, L = 1.34, g = 26 * u, cy = H * .35, x0 = 120 * u, SW = b * L;
      if (i === s) return { cx: x0 + SW / 2, cy, k: L };
      if (i < s) return { cx: x0 - g - (s - i - 1) * (b + g) - b / 2, cy, k: 1, o: .9 };
      return { cx: x0 + SW + g + (i - s - 1) * (b + g) + b / 2, cy, k: 1 };
    } },
  cyber: { name: 'Cyberpunk · Neo-Tokio', desc: 'Ciudad bajo la lluvia, neón y marcos de mira', origin: N_, top: 'b', bar: 'b', snd: 'cyber', b: 176,
    geom: (i, s, W, H, u) => ({ cx: W / 2 + (i - s) * 236 * u + Math.sign(i - s) * 22 * u, cy: H * .34, k: i === s ? 1.22 : 1, o: i === s ? 1 : .92 }) },
  cosmos: { name: 'Cosmos', desc: 'Nebulosa, estrellas y un planeta; los iconos orbitan en arco', origin: N_, top: 'a-classic', bar: 'a-classic', snd: 'cosmos', b: 168,
    geom: (i, s, W, H, u) => { // los iconos siguen un arco, girados según su posición
      const d = i - s, R = 1500 * u, th = d ? Math.sign(d) * (.145 + (Math.abs(d) - 1) * .108) : 0;
      return { cx: W / 2 + R * Math.sin(th), cy: H * .35 + R * (1 - Math.cos(th)), k: d ? .86 : 1.28, o: d ? Math.max(.28, 1 - Math.abs(d) * .17) : 1, r: th * 57.2958 };
    } },
  ember: { name: 'Brasas', desc: 'Chispas que suben desde un fuego en la oscuridad', origin: N_, top: 'a-classic', bar: 'a-classic', snd: 'ember', b: 192,
    geom: (i, s, W, H, u) => ({ cx: W / 2 + (i - s) * 250 * u, cy: H * (.38 - Mej.EMB.y / 100), k: i === s ? 1.2 : .92, o: i === s ? 1 : .84 }) },   // Mej.EMB.y = altura elegida (% de la pantalla, + = más arriba)
  sakura: { name: 'Sakura', desc: 'Atardecer con cerezo en flor y pétalos al viento', origin: N_, top: 'a-classic', bar: 'a-classic', snd: 'sakura', b: 196,
    geom: (i, s, W, H, u) => { const d = Math.abs(i - s); return { cx: W / 2 + (i - s) * 252 * u, cy: H * .5 + Math.min(d, 4) * 11 * u, k: i === s ? 1.18 : .94, o: i === s ? 1 : Math.max(.55, .92 - d * .05) }; } }
};
// ───────────────────────── fondos animados (independientes del estilo) ─────────────────────────
// Un fondo animado es lo que se ve DETRÁS: el degradado de #bg, los decorados de #fx y el canvas de #fxb. No tiene nada que ver con dónde se colocan los iconos (eso es el «estilo»).
// Cada estilo trae el suyo («Del estilo»), pero en Fondo se puede poner el de cualquier otro: las reglas del fondo cuelgan de body[data-fx=…] (css/themes*.css) y las de la colocación de body[data-theme=…].
// fx() → html que va dentro de #fx · start() → arranca los canvas y devuelve la función que los para · fxb = 'wave' | 'towers' (canvas de «actualizacion») · fijo = no se mueve
const cosmosStart = () => { // nebulosa + estrellas + destellos (los usan «Cosmos» y «Cosmos sin planeta»)
  const n = $('#fxn'); n.width = 480; n.height = 270; n.getContext('2d').drawImage(FXC.nebula(), 0, 0); FXC.stars($('#fxs'));
  const stop = FXC.twinkle($('#fxc')), rs = () => FXC.stars($('#fxs')); addEventListener('resize', rs); return () => { stop(); removeEventListener('resize', rs); };
};
const COSMOS_FX = '<canvas id="fxn" class="nb"></canvas><canvas id="fxs"></canvas><canvas id="fxc"></canvas>';
const FX = {
  // ── de «actualizado» ──
  classic: { name: 'Clásico', desc: 'Degradado suave que respira con el color del icono', origin: A_ },
  ps5: { name: 'PS5 oscuro', desc: 'Azul casi negro, liso', origin: A_, fijo: true },
  ps3: { name: 'PS3 · Ondas', desc: 'Ondas de seda sobre azul', origin: A_, fx: () => '<canvas id="wv"></canvas>', start: () => Waves.start($('#wv'), 205) },
  ps2: { name: 'PS2 · Torres azules', desc: 'Torres azules en la oscuridad', origin: A_, fx: () => '<div class="tws">' + Towers.html(30) + '</div><div class="mist"></div>' },
  neon: { name: 'Neón · Símbolos', desc: 'Símbolos brillantes flotando', origin: A_, fx: () => Symbols.bg() },
  aurora: { name: 'Aurora', desc: 'Luces suaves de colores', origin: A_, fx: () => '<i class="ab a1"></i><i class="ab a2"></i><i class="ab a3"></i><i class="ab a4"></i>' },
  synth: { name: 'Synthwave', desc: 'Sol retro y rejilla en movimiento', origin: A_, fx: () => '<div class="sun"></div><div class="floor"><div class="grid"></div></div>' },
  // ── de «actualizacion» (el clásico de allí usa el mismo fondo que el de aquí) ──
  'b-ps5': { name: 'PS5 azul y violeta', desc: 'Azules y violetas suaves', origin: B_, fijo: true },
  'b-ps3': { name: 'PS3 · Onda XMB', desc: 'Cintas de seda que cambian con el mes y la hora', origin: B_, fxb: 'wave' },
  'b-ps2': { name: 'PS2 · Torres de luz', desc: 'Torres de luz que suben y se mueven', origin: B_, fxb: 'towers' },
  'b-neon': { name: 'Neón · Rejilla', desc: 'Sol y rejilla synthwave en movimiento', origin: B_ },
  'b-glass': { name: 'Cristal', desc: 'Manchas de color que flotan', origin: B_ },
  'b-oled': { name: 'OLED negro', desc: 'Negro puro', origin: B_, fijo: true },
  // ── nuevos ──
  ps4: { name: 'PS4 · Polvo de luz', desc: 'Azul profundo con polvo de luz flotando', origin: N_,
    fx: () => '<i class="p4a"></i><i class="p4b"></i><i class="p4c"></i><canvas id="fxc"></canvas>', start: () => FXC.dust($('#fxc'), { n: 150, hue: 208 }) },
  cyber: { name: 'Cyberpunk · Ciudad', desc: 'Ciudad de noche con lluvia y neón', origin: N_, fx: () => '<canvas id="fxs"></canvas><canvas id="fxc"></canvas>',
    start: () => { FXC.skyline($('#fxs')); const stop = FXC.rain($('#fxc')), rs = () => FXC.skyline($('#fxs')); addEventListener('resize', rs); return () => { stop(); removeEventListener('resize', rs); }; } },
  cosmos: { name: 'Cosmos', desc: 'Nebulosa, estrellas y un planeta abajo a la derecha', origin: N_, fx: () => COSMOS_FX + '<i class="pl"><i class="pm"></i></i>', start: cosmosStart },
  'cosmos-np': { name: 'Cosmos sin planeta', desc: 'El mismo fondo de Cosmos pero sin el planeta de abajo a la derecha', origin: N_, fx: () => COSMOS_FX, start: cosmosStart },
  ember: { name: 'Brasas', desc: 'Chispas que suben desde un fuego', origin: N_, fx: () => '<canvas id="fxc"></canvas>', start: () => FXC.embers($('#fxc'), Mej.EMB) },
  sakura: { name: 'Sakura', desc: 'Atardecer con cerezo en flor y pétalos', origin: N_,
    fx: () => '<i class="mo"></i><i class="h2"></i><i class="h1"></i><i class="ms"></i>' + FXC.branch(1920, 1080) + '<canvas id="fxc"></canvas>', start: () => FXC.petals($('#fxc')) }
};
const FX_ID = 'fx:';
const fxName = id => (FX[id] || {}).name || 'Del estilo';
// qué fondo animado se ve: el elegido en Fondo («fx:ember») o, si no hay ninguno (''), el del propio estilo. Con una foto de fondo no se ve ninguno (se oculta), pero se deja el del estilo
const fxIdFor = (bg, th) => { const m = typeof bg === 'string' && bg.startsWith(FX_ID) && FX[bg.slice(FX_ID.length)]; return m ? bg.slice(FX_ID.length) : (th === 'b-classic' ? 'classic' : th); };
// intros: [nombre, de cuál viene]. photo = la foto elegida en «Foto de la intro»; b-photo = el fondo que tengas puesto
const INTROS = {
  'ps2-boot': ['PS2 · Arranque', N_],
  classic: ['Clásica', A_], ps2: ['PS2', A_], ps3: ['PS3', A_], ps5: ['PS5', A_], neon: ['Neón', A_], photo: ['Foto', A_],
  'b-ps2': ['PS2 · Torres', B_], 'b-ps5': ['PS5 · Símbolos', B_], 'b-ps3': ['PS3 · Onda', B_], 'b-photo': ['Foto de fondo', B_], 'b-text': ['Solo el nombre', B_],
  none: ['Sin intro', '']
};
// timbres de los menús (los de «actualizado»; «actualizacion» no tenía sonidos de menú) y sonidos de intro (sintetizados o wav)
const FLAVORS = { classic: 'Clásico', ps5: 'PS5', ps3: 'PS3', ps2: 'PS2', neon: 'Neón', aurora: 'Aurora', synth: 'Synthwave', ps4: 'PS4', cyber: 'Cyberpunk', cosmos: 'Cosmos', ember: 'Brasas', sakura: 'Sakura' };
const FL_NEW = new Set(['ps4', 'cyber', 'cosmos', 'ember', 'sakura']); // timbres nuevos
const ISRC = { 'wav:ps2boot': ['PS2 · Arranque', N_], classic: ['Clásica', A_], ps2: ['PS2', A_], ps3: ['PS3', A_], ps5: ['PS5', A_], neon: ['Neón', A_],
  'wav:ps2': ['PS2 · Torres', B_], 'wav:ps3': ['PS3 · Onda', B_], 'wav:ps5': ['PS5 · Símbolos', B_] };
const ORG = { [A_]: 'actualizado', [B_]: 'actualización', [N_]: 'nuevo', '': '' };

// barras. Cada una es una variante de css/bars.css. «auto» = la que le toca al estilo (THEMES[...].bar / .top)
const BARS = {
  'a-classic': { name: 'Clásica', desc: 'Abajo a la izquierda · Intro/✕ OK, Esc/○ Sistema, Supr/START opciones', origin: A_,
    html: () => `<span>Intro/${GLYPH.x} OK</span><span>Esc/${GLYPH.o} Sistema</span><span>Supr/<b class="st">START</b> opciones</span>` },
  'a-ps5': { name: 'PS5', desc: 'Grande y alineada con el título', origin: A_, html: () => BARS['a-classic'].html() },
  'a-ps3': { name: 'PS3', desc: 'Abajo a la derecha', origin: A_, html: () => BARS['a-classic'].html() },
  'a-ps2': { name: 'PS2', desc: 'Centrada abajo', origin: A_, html: () => BARS['a-classic'].html() },
  b: { name: 'Teclas y botones', desc: '[Intro] (✕) OK, [Esc] (○) Sistema, [Supr] (≡) Opciones', origin: B_,
    html: () => [[kbd('Intro') + '<i>/</i>' + pb('x'), 'OK'], [kbd('Esc') + '<i>/</i>' + pb('o'), 'Sistema'], [kbd('Supr') + '<i>/</i>' + pb('opt'), 'Opciones']]
      .map(([k, t]) => `<span>${k}<em>${t}</em></span>`).join('') }
};
const TOPS = {
  'a-classic': { name: 'Con ajustes', desc: 'Juegos · reloj · ⚙ ajustes · apagar', origin: A_ },
  'a-ps5': { name: 'PS5', desc: 'Juegos y Web, ajustes, apagar, perfil y reloj', origin: A_ },
  'a-ps3': { name: 'PS3', desc: 'Fecha, reloj, ajustes y apagar a la derecha', origin: A_ },
  'a-ps2': { name: 'PS2', desc: 'JUEGOS en letra fina', origin: A_ },
  'a-synth': { name: 'Synthwave', desc: 'La clásica con brillo rosa', origin: A_ },
  b: { name: 'Reloj y apagar', desc: 'Juegos · reloj · apagar (sin ⚙)', origin: B_ }
};
BARS.none = { name: 'Nada', desc: 'No se ve ninguna barra de abajo', origin: '', html: () => '' };
TOPS.none = { name: 'Nada', desc: 'No se ve ninguna barra de arriba (el teclado y el mando siguen igual)', origin: '' };
const T = () => THEMES[theme] || THEMES.classic;
const barId = v => (v && v !== 'auto' && BARS[v]) ? v : T().bar;
const topId = v => (v && v !== 'auto' && TOPS[v]) ? v : T().top;
const drawBar = v => { const id = barId(v), h = $('#hint'); h.className = 'hb-' + id; h.innerHTML = BARS[id].html(); };
const drawTop = v => { $('#top').className = 'tb-' + topId(v); };
const applyBars = () => { drawBar(UI.bar); drawTop(UI.top); };

function scale() {
  const u = innerHeight / 1080, t = T();
  document.documentElement.style.setProperty('--u', u + 'px');
  document.documentElement.style.setProperty('--b', t.b * (t.fixed ? 1 : u) + 'px');
}
function syncFxb() { // el canvas de torres/ondas de «actualizacion» solo corre si el estilo lo usa y no hay foto de fondo
  const want = document.body.classList.contains('hasbg') ? '' : ((FX[fxId] || {}).fxb || '');
  if (want !== fxbMode) { fxbMode = want; FXB.set(want); }
}
function applyTheme(id) { // solo se dibuja; lo que queda guardado lo decide setUI
  if (!THEMES[id]) id = 'classic';
  if (id === theme) return;
  theme = id; const t = THEMES[id];
  document.body.dataset.theme = id;
  applyFx(fxIdFor(curBg, id));            // el fondo animado: el del estilo salvo que en Fondo se haya elegido otro
  Sound.flavor(t.snd); scale(); applyBars(); applyPlay();
  const row = $('#row'); row.classList.add('nt'); // un fotograma sin animar para que no se vea el salto entre estilos
  if (items.length) show();
  requestAnimationFrame(() => requestAnimationFrame(() => row.classList.remove('nt')));
}
function applyFx(id) { // pinta el fondo animado (independiente del estilo) y arranca sus efectos
  if (id === fxId) return;
  fxId = id; document.body.dataset.fx = id;
  if (stopFx) { stopFx(); stopFx = null; }
  const f = FX[id] || {};
  $('#fx').innerHTML = f.fx ? f.fx() : '';
  if (f.start) stopFx = f.start();
  syncFxb();
}
function applyBg(id) {
  curBg = id || '';
  const f = id && FALL.find(x => x.id === id);
  document.body.classList.toggle('hasbg', !!f);
  if (f) document.body.style.setProperty('--bgurl', 'url("' + f.url + '")');
  applyFx(fxIdFor(curBg, theme));
}
function applyUI() {
  document.title = UI.name; $('#av').textContent = [...UI.name][0] || 'G';
  Sound.enable(UI.sounds); Sound.introEnable(UI.introSnd); Sound.volume(UI.vol); Sound.menuVolume(UI.menuVol); Sound.use(UI.menuSnd === 'auto' ? '' : UI.menuSnd);
  refreshF(); curBg = UI.bg || ''; tileS = UI.tile || 1; applyTheme(UI.theme); applyBg(UI.bg); applyBars();
  Mej.tab.restore(); applyPlay();                // tipo de letra, ampliación con el ratón y Brasas (altura y color)
  applyTabs(); if (items.length) show();
}
// «Intro para jugar»: lo que sale bajo el nombre (texto, botón «Jugar», pastilla blanca o nada). Cada estilo trae el suyo y se puede poner el de otro.
// El del estilo de siempre se dibuja con su propio CSS; los demás se colocan aquí midiendo dónde quedó el nombre (clase .pplay, ver css/mejoras.css).
let playPrev = null;                             // en el selector inferior: el modo que se está probando
const playId = v => { const m = v === undefined ? UI.play : v; return m && m !== 'auto' && Mej.PLAYS[m] ? m : (T().play || (T().plain ? 'none' : 'text')); };
const playNow = () => playPrev || playId();
function applyPlay() {
  const m = playNow(), b = document.body;
  b.dataset.play = m;
  const native = (m === 'btn' && theme === 'ps5') || (m === 'cta' && theme.startsWith('b-'));   // los de siempre de PS5 y de los estilos «actualización»
  b.classList.toggle('pplay', (m === 'btn' || m === 'cta') && !native);
  placePlay();
}
function placePlay() {
  const b = document.body; if (!b.classList.contains('pplay')) return;
  const t = $('#title'), s = $('#sub'), has = !!s.textContent.trim(), a = has ? s : t, r = a.getBoundingClientRect(), u = innerHeight / 1080;
  const left = /^(left|start)$/.test(getComputedStyle(t).textAlign), y = (has ? r.bottom : r.bottom + 4 * u) + 22 * u;
  b.style.setProperty('--ppx', (left ? r.left : r.left + r.width / 2) + 'px'); b.style.setProperty('--ppt', left ? '0%' : '-50%'); b.style.setProperty('--ppy', y + 'px');
}
// «Juegos» y «Web» de arriba a la izquierda: se pueden cambiar por otra palabra o dejar vacíos (Apariencia → Texto de arriba a la izquierda)
function applyTabs() {
  const b = $('#tabs b'), w = $('#tweb'), a = typeof UI.tabText === 'string' ? UI.tabText : 'Juegos', c = typeof UI.webText === 'string' ? UI.webText : 'Web';
  b.textContent = a; b.style.display = a ? '' : 'none'; w.textContent = c; w.style.display = c ? '' : 'none';
}
async function setUI(p) { try { UI = { ...UI, ...(await api.uiSet(p)) }; } catch {} applyUI(); } // se mezcla con lo que ya hay, así nunca falta un ajuste
const refreshF = () => { F = FALL.filter(f => !hid('bg', f.id)); };
async function loadFondos() { try { FALL = await api.fondos(); } catch { FALL = []; } refreshF(); }
async function loadSounds(quick) { // quick: en el arranque solo se espera al sonido que necesita la intro; el resto se decodifica en segundo plano
  try { Sound.wav(await api.sounds()); } catch {}
  // los wav se decodifican una vez: suenan por WebAudio (volumen real y limitador). Si alguno falla, suena con <audio> como siempre
  const names = ['ps2boot', 'ps2', 'ps3', 'ps5'], dec = async n => { try { const d = await api.soundData(n); if (d) await Sound.decode(n, d); } catch {} };
  const src = UI.introSndSrc !== 'auto' && ISRC[UI.introSndSrc] ? UI.introSndSrc : (Intro.snd(UI.intro) || ''), want = /^wav:/.test(src) ? src.slice(4) : '';
  const first = names.includes(want) ? dec(want) : Promise.resolve(), rest = Promise.all(names.filter(n => n !== want).map(dec));
  await first;
  if (!quick) await rest;
}

// ───────────────────────── lista de juegos ─────────────────────────
// color medio del icono -> tinta del tile y del fondo
function dom(src) {
  return new Promise(res => {
    const def = '#3b82f6';
    setTimeout(() => res(def), 2000); // si la imagen no responde, no bloquea la lista
    if (!src) return res(def);
    const i = new Image();
    i.onerror = () => res(def);
    i.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 16;
        const x = c.getContext('2d'); x.drawImage(i, 0, 0, 16, 16);
        const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0, n = 0;
        for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 200) { r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
        res(n ? `rgb(${r / n | 0},${g / n | 0},${b / n | 0})` : def);
      } catch { res(def); }
    };
    i.src = src;
  });
}

const tileInner = it => it.t === 'web' ? GLOBE : it.t === 'add' ? PLUS : it.icon ? `<img src="${it.icon}"${it.cover ? ' class="cv"' : ''}>` : '';
async function refresh() {
  let g;
  try { g = await api.games(); } catch { setTimeout(refresh, 2000); if (items.length) return; g = []; } // si falla, se mantiene lo que había y se reintenta
  const keep = items[sel] && items[sel].id;
  g = g.filter(x => pmode || !x.hidden);          // las ocultas existen (y pueden arrancar solas) pero no salen
  const cs = await Promise.all(g.map(x => dom(x.icon)));
  items = [
    { t: 'web', name: 'Navegador', sub: 'Internet', sub2: 'Internet', k: '#2563eb' },
    ...g.map((x, i) => ({ ...x, t: 'game', k: cs[i],
      sub: x.auto ? 'Intro para abrir. Se abre solo al iniciar el launcher' : 'Intro para jugar',
      sub2: x.auto ? 'Se abre solo al iniciar el launcher' : '' })),
    { t: 'add', name: 'Añadir juego', sub: 'Elige un programa o script de tu PC', sub2: 'Elige un programa o script de tu PC', k: '#475569' }
  ];
  if (keep) { const j = items.findIndex(x => x.id === keep); if (j >= 0) sel = j; }
  sel = Math.max(0, Math.min(sel, items.length - 1));
  // <u class="ba|bh"> son las etiquetas «Arranca solo» / «Oculta» de los estilos de «actualizacion» (los demás las dibujan con ::before/::after)
  $('#row').innerHTML = items.map((it, i) =>
    `<div class="t${it.cover ? ' cv' : ''}" style="--k:${it.k}" data-i="${i}" data-n="${esc(it.name)}"${it.auto ? ' data-a' : ''}${it.hidden ? ' data-h' : ''}>${tileInner(it)}<u class="ba">Arranca solo</u><u class="bh">Oculta</u></div>`).join('');
  show();
}

// Tamaño de los iconos (Apariencia → Tamaño de iconos): toda la fila se agranda o se encoge igual (tamaño, huecos y posiciones) tomando como punto fijo un borde del icono
// seleccionado, el que toca al título (t.anc: 1.ª letra c|l = centro|izquierda, 2.ª b|t|c = abajo|arriba|centro). Así el título y el subtítulo nunca se pegan ni se separan.
const TILE_MIN = .5, TILE_MAX = 1.6;
function layout() {
  const t = T(), u = t.fixed ? 1 : innerHeight / 1080, b = t.b * u, els = $('#row').children, S = Math.max(TILE_MIN, Math.min(TILE_MAX, tileS || 1)), G = [];
  for (let i = 0; i < els.length; i++) {
    const g = t.geom(i, sel, innerWidth, innerHeight, u), k = g.k || 1;
    G.push({ g, k, cx: g.x !== undefined ? g.x + b * k / 2 : g.cx, cy: g.y !== undefined ? g.y + b * k / 2 : g.cy });
  }
  let ax = 0, ay = 0;
  if (S !== 1 && G[sel]) {
    const c = G[sel], h = b * c.k / 2, an = t.anc || 'cb';
    ax = an[0] === 'l' ? c.cx - h : c.cx; ay = an[1] === 'b' ? c.cy + h : an[1] === 't' ? c.cy - h : c.cy;
    for (const c of G) { c.cx = ax + (c.cx - ax) * S; c.cy = ay + (c.cy - ay) * S; c.k *= S; }
  }
  Mej.dock.apply(G, b);                         // ampliación al pasar el ratón (Apariencia → Ampliación)
  for (let i = 0; i < els.length; i++) {
    const { g, k, cx, cy } = G[i], e = els[i];
    e.style.transform = g.r !== undefined ? `translate(${cx}px,${cy}px) rotate(${g.r}deg) scale(${k}) translate(${-b / 2}px,${-b / 2}px)` : `translate(${cx - b * k / 2}px,${cy - b * k / 2}px) scale(${k})`;
    e.style.opacity = g.o === undefined ? 1 : g.o;
    e.style.zIndex = i === sel ? 3 : 1;
    e.classList.toggle('s', i === sel);
  }
  const tn = t.tn ? t.tn(S, u) : [0, 0];   // el nombre que PS5 pone junto al icono grande se mueve con él
  document.documentElement.style.setProperty('--tnx', tn[0] + 'px'); document.documentElement.style.setProperty('--tny', tn[1] + 'px');
}
// Fondo grande del PS5 de «actualizado» y cartel del PS5 de «actualizacion». Con pulsaciones seguidas NUNCA se reinicia una animación a medias (eso era el «retroceso» que se veía
// al dar dos veces seguidas a un lado): cada cambio pone una capa nueva que se funde por encima de la anterior, y si la selección sigue moviéndose se espera a que se asiente.
const HERO_GAP = 150;                       // ms: si llegan más cambios seguidos, el fondo/cartel espera a que la selección se asiente
let heroAt = 0, heroT = 0, heroC = 0, bhAt = 0, bhT = 0, bhEnter = 0, bhKey = '';
function setHero(it) {
  clearTimeout(heroT);
  const host = $('#hero'), now = performance.now();
  if (host.firstElementChild && now - heroAt < HERO_GAP) { heroT = setTimeout(() => { const c = items[sel]; if (c && T().hero) heroSwap(c); }, HERO_GAP); return; }
  heroSwap(it);
}
function heroSwap(it) {
  const host = $('#hero'), pic = it.hero || it.icon, cv = !!(it.hero || it.cover), sig = [it.id || it.t, pic || '', it.k, cv].join('|'), last = host.lastElementChild;
  if (last && last.dataset.sig === sig) return;                  // ya es este: no se vuelve a fundir
  const h = document.createElement('div'), img = document.createElement('img'), g = document.createElement('i');
  h.className = 'h' + (cv ? ' cv' : '') + (pic ? '' : ' ni'); h.dataset.sig = sig; h.dataset.t = String(heroAt = performance.now());
  h.style.setProperty('--hc', it.k);
  img.alt = ''; if (pic) img.src = pic;
  g.className = 'g'; g.innerHTML = it.t === 'web' ? GLOBE : it.t === 'add' ? PLUS : '';
  h.append(img, g);
  if (!last) h.classList.add('on');                              // la primera capa sale ya puesta
  host.append(h);
  if (last) { void h.offsetWidth; h.classList.add('on'); }
  // las capas de debajo se quitan cuando alguna ya está del todo opaca (el fundido dura .7 s) y nunca se acumulan más de 6
  const opaque = [...host.children].reverse().find(e => e !== h && heroAt - +e.dataset.t > 740);
  if (opaque) while (host.firstElementChild !== opaque) host.firstElementChild.remove();
  while (host.children.length > 6) host.firstElementChild.remove();
  clearTimeout(heroC); heroC = setTimeout(() => { const l = host.lastElementChild; while (host.firstElementChild !== l) host.firstElementChild.remove(); }, 800);
}
const bhContent = it => { const pic = it.hero || it.icon; return it.t === 'game' ? (pic ? `<img src="${esc(pic)}">` : '') : it.t === 'web' ? GLOBE : PLUS; };
function setBHero(it) {
  clearTimeout(bhT);
  const h = $('#bhero'), key = it.id || it.t, last = h.lastElementChild;
  if (last && key === bhKey) { last.className = 'bk' + (it.hero || it.cover ? ' cv' : ''); last.innerHTML = bhContent(it); return; }   // el mismo programa (p. ej. tras cambiar su foto): se actualiza sin animar
  if (last && performance.now() - bhAt < HERO_GAP) { bhT = setTimeout(() => { const c = items[sel]; if (c && T().bhero) bhSwap(c); }, HERO_GAP); return; }
  bhSwap(it);
}
function bhSwap(it) {
  const h = $('#bhero'), now = performance.now(), n = document.createElement('div');
  bhKey = it.id || it.t; bhAt = now;
  n.className = 'bk' + (it.hero || it.cover ? ' cv' : ''); n.innerHTML = bhContent(it);
  const old = [...h.children];
  h.append(n);
  const fresh = !old.length || now - bhEnter >= 450;              // la entrada completa (desde la derecha) solo si el cartel ya estaba quieto
  if (fresh) {
    old.forEach(e => e.remove());
    if (old.length && h.animate) { bhEnter = now; h.animate([{ opacity: 0, transform: 'translateX(40px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
  } else if (n.animate) {                                         // todavía está llegando: sigue su camino y solo se funde el contenido
    const a = n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    const done = () => { while (n.previousElementSibling) n.previousElementSibling.remove(); };
    a.onfinish = done; a.oncancel = done;
  } else old.forEach(e => e.remove());
}
function show() {
  layout();
  const it = items[sel]; if (!it) return;
  const t = T(), lab = it.t === 'game' ? 'Jugar' : it.t === 'web' ? 'Abrir' : 'Añadir';
  $('#title').textContent = $('#tname').textContent = it.name; $('#sub').textContent = playNow() === 'text' ? it.sub : it.sub2;
  $('#play').textContent = lab; $('#cta').innerHTML = PLAY + lab;
  document.body.style.setProperty('--c', it.k);
  if (t.hero) setHero(it);
  if (t.bhero) setBHero(it);
  placePlay();
}

// ───────────────────────── menús ─────────────────────────
// list: [texto html, función, clase opcional, función ←/→ opcional, clave opcional (para volver a esa fila)]; una fila con .quiet no suena al moverla con ←/→ (lo hace su función).
// o: { onMove(i), onOpt(i): Supr/△ sobre una fila, help: línea de ayuda al pie, back(), mute: sin el sonido de mover (lo pone onMove) }. i0 puede ser un número o una clave.
function openMenu(title, list, i0 = 0, o = {}) {
  if (typeof i0 === 'string') i0 = Math.max(0, list.findIndex(l => l[4] === i0));
  menu = { list, i: Math.max(0, Math.min(i0, list.length - 1)), o };
  $('#mn').innerHTML = `<h2>${esc(title)}</h2>` + list.map((l, i) => `<p class="${l[2] || ''}" data-i="${i}">${l[0]}</p>`).join('') + (o.help ? `<div class="mh">${o.help}</div>` : '');
  $('#ov').classList.add('on'); fitMenu(); mark(); Mej.dock.kick();
}
// las listas largas se compactan solas para que quepan en pantalla (dn → dn2); si aun así no caben, el título avisa de que hay filas ocultas
function fitMenu() {
  const m = $('#mn'); m.classList.remove('dn', 'dn2'); m.classList.toggle('hp', !!(menu && menu.o.help)); m.scrollTop = 0;
  const over = () => m.scrollHeight > m.clientHeight + 2;
  if (over()) { m.classList.add('dn'); if (over()) { m.classList.remove('dn'); m.classList.add('dn2'); } }
}
const rowHtml = (i, html) => { if (!menu || !menu.list[i]) return; menu.list[i][0] = html; const p = $('#mn').querySelector(`p[data-i="${i}"]`); if (p) p.innerHTML = html; }; // cambia una fila sin reabrir el menú
const mark = () => { [...$('#mn').querySelectorAll('p')].forEach((p, i) => { const on = i === menu.i; p.classList.toggle('s', on); if (on) p.scrollIntoView({ block: 'nearest' }); }); };
const closeMenu = () => { menu = null; $('#ov').classList.remove('on'); };
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2500); };

async function openItem(it) {
  if (it.t === 'web') return setMode('web');
  if (it.t === 'add') { await guarded('Contraseña para añadir juegos', p => api.add(p))(); return refresh(); }
  $('#ld b').textContent = it.name; $('#ld').classList.add('on');
  setTimeout(() => $('#ld').classList.remove('on'), 9000);
  gameOn = true; api.launch(it.id);
}

// Opciones (Supr / START): lo del programa seleccionado + apariencia, tecla Windows y modo juego
function opts(it, i0 = 0) {
  const L = [];
  if (it.t === 'game') {
    L.push([it.auto ? 'Dejar de abrirlo al iniciar' : 'Abrirlo solo al iniciar el launcher', async () => {
      await api.auto(it.id, !it.auto); toast(it.auto ? 'Ya no se abrirá solo' : 'Se abrirá solo al iniciar el launcher'); await refresh(); }]);
    L.push([`Cambiar nombre…<small>${esc(it.name)}</small>`, async () => { // el nombre que sale en el launcher (el archivo .exe no se toca)
      const v = await ask('Nombre del programa', { value: it.name, max: 60, ok: 'Guardar' });
      if (v === null) return;
      await api.rename(it.id, v); toast(v.trim() ? 'Nombre cambiado' : 'Nombre original restaurado'); await refresh(); }]);
    if (it.orig && it.name !== it.orig) L.push([`Volver al nombre original<small>${esc(it.orig)}</small>`, async () => { await api.rename(it.id, ''); toast('Nombre original restaurado'); await refresh(); }]);
    L.push(['Cambiar logo…', async () => {
      const r = await api.icon(it.id);
      if (r === true) { toast('Logo cambiado'); await refresh(); } else if (r) toast(r === 'grande' ? 'Esa imagen pesa demasiado' : 'No se pudo cambiar el logo'); }]);
    if (it.cover) L.push(['Quitar logo personalizado', async () => { await api.iconOff(it.id); toast('Logo original restaurado'); await refresh(); }]);
    // la foto grande de la derecha de los estilos PS5: por defecto es el logo del .exe, pero puede ser otra distinta
    L.push([`Foto de la derecha (estilos PS5)…<small>${it.hero ? 'otra foto' : 'la del programa'}</small>`, async () => {
      const r = await api.hero(it.id);
      if (r === true) { toast('Foto de la derecha cambiada'); await refresh(); } else if (r) toast(r === 'grande' ? 'Esa imagen pesa demasiado' : 'No se pudo cambiar la foto'); }]);
    if (it.hero) L.push(['Quitar la foto de la derecha', async () => { await api.heroOff(it.id); toast('Vuelve a salir la del programa'); await refresh(); }]);
    if (pmode) L.push([it.hidden ? 'Mostrar en el launcher' : 'Ocultar del launcher', async () => {
      await api.hide(it.id, !it.hidden); toast(it.hidden ? 'Ahora se muestra en el launcher' : 'Oculta del launcher'); await refresh(); }]);
    L.push(['Quitar de la lista', async () => { await api.remove(it.id); sel = Math.max(0, sel - 1); await refresh(); }]);
  }
  L.push(['Apariencia', () => appearance(0, 'apr'), 'sub', null, 'apr'], ['Navegador<small>anuncios · SponsorBlock · teclado</small>', () => webMenu(0, 'opts'), 'sub', null, 'web'],
    ['Resolución de pantalla<small>sin salir a Windows</small>', () => Mej.screenMenu(), 'sub', null, 'res'],
    [`Contador de FPS<small>${UI.fpsOn ? 'activado' : 'apagado'}</small>`, () => Mej.fpsMenu(), 'sub', null, 'fps'],
    [`Mandos Buzz<small>${UI.buzzOn === false ? 'apagados' : 'se activan solos'}</small>`, () => Mej.buzzMenu(), 'sub', null, 'buzz'],
    ['Modo Juego', gameMode], ['Cancelar']);
  openMenu(it.t === 'game' ? it.name : 'Opciones', L, i0);
}
// Modo Juego = el launcher como arranca al encender: corta los dos modos secretos (R×8: sin contraseña, P×8: apps ocultas) si estaban puestos,
// hasta que se vuelvan a poner. Por fuera solo parece un ajuste más: el aviso es el mismo se hubiera cortado algo o no.
const gameMode = async () => {
  await api.unbypass();
  const was = pmode; pmode = false;
  toast('Modo Juego activado');
  if (was) await refresh(); // las ocultas vuelven a esconderse
};

const power = () => openMenu('Sistema', [
  ['Suspender', () => api.power('sleep')], ['Reiniciar', () => api.power('restart')],
  ['Apagar', () => api.power('off')], ['Cerrar sesión', () => api.power('logout')],
  ['Escritorio de Windows', toDesktop], ['Ajustes del launcher', () => settings()], ['Cancelar']]);

// ───────────────────────── apariencia ─────────────────────────
const bgName = id => !id ? 'Del estilo' : id.startsWith(FX_ID) ? fxName(id.slice(FX_ID.length)) : ((FALL.find(f => f.id === id) || {}).name || 'Del estilo');
const photoPick = () => FALL.find(x => x.id === UI.introBg) || FALL.find(x => x.id === UI.bg) || F.find(x => /neon-colores/.test(x.id)) || F[0] || FALL[0];
const pswPhoto = () => FALL.find(x => x.id === UI.pswBg) || FALL.find(x => /ps5-bienvenida/.test(x.id));   // Precarga Post Intro: la elegida o la de siempre
const pswName = () => { const f = pswPhoto(); return f ? f.name : 'Sin foto'; };
const photoUrl = () => (photoPick() || {}).url || '';
const photoName = () => (photoPick() || {}).name || '';
const photoUrlB = () => { const f = FALL.find(x => x.id === UI.bg) || F[0] || FALL[0]; return f ? f.url : ''; }; // «Foto de fondo» (actualizacion): el fondo puesto o, si no hay, la primera foto
const ck = on => `<span class="ck">${on ? '●' : ''}</span>`;
const lb = (on, text, small = '') => `<span class="lb">${ck(on)}${esc(text)}</span>${small}`; // bolita + texto agrupados para que el flex los alinee a la izquierda
const playPreview = kind => Intro.play(kind, { name: UI.name, photo: photoUrl(), bphoto: photoUrlB(), snd: UI.introSndSrc, sce: UI.introText });
const themeName = id => (THEMES[id] || THEMES.classic).name;
const introLabel = () => { const i = INTROS[UI.intro] || INTROS.classic; return i[0] + (UI.intro === 'photo' ? ': ' + photoName() : ''); };
const barLabel = (v, set) => v === 'auto' || !set[v] ? 'Mismo del estilo' : set[v].name;
const menuSndName = () => UI.menuSnd === 'auto' || !FLAVORS[UI.menuSnd] ? 'Mismo del estilo' : FLAVORS[UI.menuSnd];
const introSndName = () => UI.introSndSrc === 'auto' || !ISRC[UI.introSndSrc] ? 'La de cada intro' : ISRC[UI.introSndSrc][0] + ' · ' + ORG[ISRC[UI.introSndSrc][1]];

// ── eliminar y restaurar estilos, fondos e intros ──
// Lo que trae el launcher no se borra del disco: se OCULTA de los selectores y se puede restaurar (Apariencia → Restaurar lo eliminado). Las fotos que importaste sí se borran de verdad.
// Se elimina con Supr / △ / START sobre la tarjeta del selector inferior (clic derecho con el ratón) o sobre la fila de la lista de intros. Siempre pregunta antes.
const KIND = { theme: 'estilo', bg: 'fondo', intro: 'intro', bar: 'barra inferior', top: 'barra superior', font: 'tipo de letra' };
const hiddenCount = () => { const h = hideLists(); return HK.reduce((n, k) => n + h[k].length, 0); };
const nameOf = (k, id) => k === 'theme' ? themeName(id) : k === 'intro' ? (INTROS[id] || [id])[0] : k === 'bar' ? (BARS[id] || { name: id }).name : k === 'top' ? (TOPS[id] || { name: id }).name : k === 'font' ? Mej.fonts.name(id) : bgName(id);
const neighbor = (ids, id) => { const j = ids.indexOf(id); return ids[j + 1] !== undefined ? ids[j + 1] : ids[j - 1]; }; // el que queda en su lugar al quitar uno
async function dropUserPhotos() { // borra las fotos importadas y deja en «normal» lo que las usaba (fondo, foto de la intro, foto de la Precarga)
  await api.fondoClear(); await loadFondos();
  const u = v => (v || '').startsWith('u:') ? '' : (v || '');
  await setUI({ bg: u(UI.bg), introBg: u(UI.introBg), pswBg: u(UI.pswBg) });
}
async function removeItem(k, id) {
  const ids = k === 'theme' ? shownThemes() : k === 'intro' ? shownIntros() : [], p = {};
  if (k === 'theme' && UI.theme === id) p.theme = neighbor(ids, id);   // si estaba en uso, lo sustituye el de al lado
  if (k === 'intro' && UI.intro === id) p.intro = neighbor(ids, id);
  if (k === 'bg') { if (UI.bg === id) p.bg = ''; if (UI.introBg === id) p.introBg = ''; if (UI.pswBg === id) p.pswBg = ''; }
  if (k === 'bar' && UI.bar === id) p.bar = 'auto';          // si estaba puesta, vuelve «Mismo del estilo»
  if (k === 'top' && UI.top === id) p.top = 'auto';
  if (k === 'font' && UI.font === id) p.font = 'auto';
  if (k === 'bg' && id.startsWith('u:')) { await api.fondoDel(id); await loadFondos(); }
  else if (k === 'font' && id.startsWith('u:')) await Mej.fonts.del(id);   // los tipos de letra que importaste se borran de verdad
  else { const h = hideLists(); if (!h[k].includes(id)) h[k].push(id); p.hide = h; }
  await setUI(p);
}
function askRemove(k, id, done) { // done(true|false): se eliminó o no
  const user = (k === 'bg' || k === 'font') && id.startsWith('u:'), name = nameOf(k, id);
  openMenu(`¿Eliminar ${KIND[k]} «${name}»?`, [
    [user ? (k === 'font' ? 'Eliminar (se borra el tipo de letra importado)' : 'Eliminar (se borra la foto importada)') : 'Eliminar', async () => { await removeItem(k, id); toast(user ? (k === 'font' ? 'Tipo de letra borrado' : 'Foto borrada') : name + ' eliminado'); done(true); }],
    ['Cancelar', () => done(false)]
  ], 1, { back: () => done(false), help: user ? 'Solo se borra la copia importada; tu archivo original no se toca' : 'Se recupera en Apariencia → Restaurar lo eliminado' });
}
// Eliminar DEFINITIVAMENTE: lo de aquí se borra del todo. Las fotos de Fondo se borran del disco; los estilos pierden sus imágenes de muestra y,
// como el estilo, el fondo animado o la intro viven en el código, se anotan como eliminados para siempre (ya no salen ni aquí). No se puede deshacer.
async function purge(list) {
  const g = goneLists(), h = hideLists();
  for (const [k, id] of list) {
    h[k] = h[k].filter(x => x !== id); if (!g[k].includes(id)) g[k].push(id);
    try { await api.purge(k, id); } catch {}   // borra los archivos que haya (foto, imágenes de muestra)
  }
  await setUI({ hide: h, gone: g }); await loadFondos();
}
function askPurge(list, done) { // list: [[tipo, id], …] · done(true|false): se eliminó o no
  const one = list.length === 1, name = one ? nameOf(list[0][0], list[0][1]) : '';
  openMenu(one ? `¿Eliminar «${name}» definitivamente?` : `¿Eliminar ${list.length} elementos definitivamente?`, [
    ['Eliminar definitivamente', async () => { await purge(list); toast(one ? name + ' eliminado del todo' : 'Eliminados del todo'); done(true); }],
    ['Cancelar', () => done(false)]
  ], 1, { back: () => done(false), help: 'Se borra del todo y no se puede recuperar' });
}
function restoreMenu(pj, at = 0) {
  const h = hideLists(), L = [], all = [], back = () => appearance('restore', pj);
  for (const k of ['theme', 'intro', 'bg', 'bar', 'top', 'font']) for (const id of h[k]) { all.push([k, id]); L.push([`${esc(nameOf(k, id))}<small>${KIND[k]}</small>`, async () => {
    const n = hideLists(); n[k] = n[k].filter(x => x !== id); await setUI({ hide: n }); toast(nameOf(k, id) + ' restaurado'); restoreMenu(pj, 0);
  }]); }
  if (!L.length) return appearance('theme', pj);
  L.push(['Restaurar todo', async () => { await setUI({ hide: Object.fromEntries(HK.map(k => [k, []])) }); toast('Todo restaurado'); appearance('theme', pj); }]);
  L.push(['Eliminar todo definitivamente<small>no se puede deshacer</small>', () => askPurge(all, ok => ok ? appearance('theme', pj) : restoreMenu(pj, all.length + 1))]);
  L.push(['Volver', back]);
  openMenu('Restaurar lo eliminado', L, at, { back, help: `Intro/${GLYPH.x} restaurar · Supr/${GLYPH.t} eliminar definitivamente (se borra del todo)`,
    onOpt: i => { if (!all[i]) return toast('Marca un elemento de la lista'); askPurge([all[i]], () => restoreMenu(pj, Math.min(i, Math.max(0, all.length - 2)))); } });
}

function appearance(at = 'theme', pj = 0) {
  const back = () => opts(items[sel], pj), nh = hiddenCount();
  const L = [
    [`Estilo<small>${esc(themeName(UI.theme))}</small>`, () => openTray('theme', pj), 'sub', null, 'theme'],
    [`Fondo<small>${esc(bgName(UI.bg))}</small>`, () => openTray('bg', pj), 'sub', null, 'bg'],
    ['Añadir foto de fondo…', async () => { await addPhoto(); appearance('addbg', pj); }, '', null, 'addbg'],
    [`Barra inferior<small>${esc(barLabel(UI.bar, BARS))}</small>`, () => openTray('bar', pj), 'sub', null, 'bar'],
    [`Barra superior<small>${esc(barLabel(UI.top, TOPS))}</small>`, () => openTray('top', pj), 'sub', null, 'top'],
    [`Tipo de letra<small>${esc(Mej.tab.label.font())}</small>`, () => openTray('font', pj), 'sub', null, 'font'],
    [`Intro para jugar<small>${esc(Mej.tab.label.play())}</small>`, () => openTray('play', pj), 'sub', null, 'play'],
    [`Tamaño de iconos<small>${Math.round((UI.tile || 1) * 100)} %</small>`, () => openTray('tile', pj), 'sub', null, 'tile'],
    [`Ampliación al pasar el ratón<small>${esc(Mej.tab.label.dock())}</small>`, () => openTray('dock', pj), 'sub', null, 'dock'],
    ...(emberOn() ? [[`Brasas · color<small>${esc(Mej.tab.label.emberc())}</small>`, () => openTray('emberc', pj), 'sub', null, 'emberc']] : []),
    ...(emberTh() ? [[`Brasas · altura de los iconos<small>${esc(Mej.tab.label.embery())}</small>`, () => openTray('embery', pj), 'sub', null, 'embery']] : []),
    [`Texto de arriba a la izquierda<small>${esc(UI.tabText ? '«' + UI.tabText + '»' : 'Sin texto')}</small>`, () => tabsMenu(pj), 'sub', null, 'tabs'],
    [`Intro<small>${esc(introLabel())}</small>`, () => pickIntro(UI.intro, pj), 'sub', null, 'intro'],
    [`Precarga Post Intro<small>${esc(UI.psWait ? 'Sí · ' + pswName() : 'No')}</small>`, () => precarga('on', pj), 'sub', null, 'ps'],
    [`Sonidos<small>${esc(menuSndName())}</small>`, () => sonidos('menusnd', pj), 'sub', null, 'sounds']
  ];
  if (nh) L.push([`Restaurar lo eliminado<small>${nh}</small>`, () => restoreMenu(pj), 'sub', null, 'restore']);
  L.push(['Volver', back, '', null, 'back']);
  openMenu('Apariencia', L, at, { back });
}

// ── Opciones › Navegador: bloqueador de anuncios, YouTube sin anuncios, SponsorBlock, cookies y teclado en pantalla ──
const ago = t => { const m = Math.max(1, Math.round((Date.now() - t) / 60000)); return m < 60 ? m + ' min' : m < 2880 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' días'; };
async function webMenu(at = 0, from = 'opts') { // from: 'opts' (vuelve a Opciones) | 'web' (vuelve al navegador)
  let st = {}; try { st = await api.webStats(); } catch {}
  const back = () => from === 'web' ? (wv && wv.focus()) : opts(items[sel], 'web'), on = v => v ? 'Sí' : 'No';
  const tog = (key, i, msg) => async () => { await setUI({ [key]: !UI[key] }); setShield(); Sound.ui('ok'); toast(msg(UI[key])); webMenu(i, from); };
  const L = [
    [`Bloquear anuncios y rastreadores<small>${on(UI.webAds)}</small>`, tog('webAds', 0, v => v ? 'Bloqueador encendido · vale para las páginas que abras ahora' : 'Bloqueador apagado'), '', null, 'ads'],
    [`YouTube sin anuncios<small>${on(UI.webYt)}</small>`, tog('webYt', 1, v => v ? 'Se saltarán los anuncios de YouTube' : 'YouTube con anuncios'), '', null, 'yt'],
    [`SponsorBlock · saltar patrocinadores<small>${on(UI.webSb)}</small>`, tog('webSb', 2, v => v ? 'Se saltarán los patrocinios en YouTube' : 'SponsorBlock apagado'), '', null, 'sb'],
    [`Ocultar avisos de cookies<small>${on(UI.webCookies)}</small>`, tog('webCookies', 3, v => v ? 'Avisos de cookies ocultos' : 'Avisos de cookies visibles'), '', null, 'ck'],
    [`Teclado en pantalla al escribir<small>${on(UI.webOsk)}</small>`, tog('webOsk', 4, v => v ? 'Saldrá el teclado al tocar un campo de texto' : 'Sin teclado en pantalla en el navegador'), '', null, 'osk'],
    [`Actualizar las listas ahora<small>${st.updated ? 'hace ' + esc(ago(st.updated)) : 'solo la incorporada'}</small>`, async () => {
      toast('Actualizando listas… (necesita internet)');
      let r = { ok: 0, fail: 0 }; try { r = await api.webUpdate(); } catch {}
      toast(r.ok ? r.ok + ' listas actualizadas' + (r.fail ? ' · ' + r.fail + ' sin conexión' : '') : 'No se pudo actualizar: ¿hay internet?'); webMenu(5, from); }, '', null, 'upd'],
    [`Peticiones bloqueadas<small>${(st.blocked || 0).toLocaleString('es-ES')} · ${(st.rules || 0).toLocaleString('es-ES')} reglas</small>`, () => webMenu(6, from), '', null, 'info'],
    ['Volver', back, '', null, 'back']
  ];
  openMenu('Navegador', L, at, { back, help: 'Los cambios valen para las páginas que abras a partir de ahora (↻ recarga la actual)' });
}

// ── Precarga Post Intro: la pantalla que sale justo después de la intro (antes «pantalla del botón PS») ──
function precarga(at = 'on', pj = 0) {
  const back = () => appearance('ps', pj);
  const L = [
    [`Activada<small>${UI.psWait ? 'Sí' : 'No'}</small>`, async () => {
      await setUI({ psWait: !UI.psWait, ...(UI.psWait ? { psReq: false } : {}) }); Sound.ui('ok'); // sin pantalla no hay nada que exigir
      if (UI.psWait) await PSW.show({ force: true, preview: true }); // al activarla se ve cómo queda
      precarga('on', pj); }, '', null, 'on'],
    [`Foto<small>${esc(pswName())}</small>`, () => pickPswBg(pj), 'sub', null, 'foto'],
    [`Exigir el mando<small>${UI.psReq ? 'Sí' : 'No'}</small>`, async () => { // con «Sí», no se salta con teclado ni ratón: solo avanza al encender un mando
      const on = !UI.psReq; await setUI(on ? { psReq: true, psWait: true } : { psReq: false }); Sound.ui('ok');
      toast(on ? 'Sin mando no se pasa de esa pantalla. Salida de emergencia: Esc ×8' : 'La pantalla ya se puede saltar con teclado o ratón');
      precarga('req', pj); }, '', null, 'req'],
    ['Probar<small>cómo queda</small>', async () => { await PSW.show({ force: true, preview: true }); precarga('test', pj); }, '', null, 'test'],
    ['Volver', back, '', null, 'back']
  ];
  openMenu('Precarga Post Intro', L, at, { back, help: 'Sale justo después de la intro y pasa sola en cuanto se enciende el mando' });
}
// foto de la Precarga Post Intro: cualquiera de las de Fondo o una tuya. Intro la elige (y se ve como queda); □ / T la ve sin elegirla
async function pickPswBg(pj) {
  await loadFondos();
  const def = FALL.find(x => /ps5-bienvenida/.test(x.id)), now = UI.pswBg || (def ? def.id : ''), L = [], ids = [];
  const back = () => precarga('foto', pj);
  const done = async id => { await setUI({ pswBg: def && id === def.id ? '' : id }); await PSW.show({ force: true, preview: true }); pickPswBg(pj); };
  F.forEach(f => { ids.push(f.id); L.push([lb(f.id === now, f.name, f.user ? '<small>Mía</small>' : def && f.id === def.id ? '<small>La de siempre</small>' : ''), () => done(f.id)]); });
  L.push(['Importar foto…', async () => {
    const n = await api.fondoAdd();
    if (!n.length) return pickPswBg(pj);
    await loadFondos(); await done(n[n.length - 1]);
  }]);
  if (F.some(f => f.user)) L.push(['Quitar mis fotos importadas', async () => { await dropUserPhotos(); toast('Fotos importadas quitadas'); pickPswBg(pj); }]);
  L.push(['Volver', back]);
  openMenu('Foto de la Precarga Post Intro', L, Math.max(0, ids.indexOf(now)), { back, help: `${GLYPH.q}/T ver sin elegir · Supr/${GLYPH.t} eliminar la foto`,
    onSq: async i => { if (ids[i] === undefined) return; closeMenu(); await PSW.show({ force: true, preview: true, photo: ids[i] }); pickPswBg(pj); },
    onOpt: i => { if (ids[i] !== undefined) askRemove('bg', ids[i], () => pickPswBg(pj)); } });
}
// «Juegos» y «Web» de arriba a la izquierda: otra palabra o nada
function tabsMenu(pj, at = 0) {
  const back = () => appearance('tabs', pj), q = v => v ? '«' + esc(v) + '»' : 'vacío';
  const edit = (key, title, i) => async () => {
    const v = await ask(title, { value: UI[key] || '', max: 24, ok: 'Guardar' });
    if (v !== null) { await setUI({ [key]: v.trim() }); toast(v.trim() ? 'Texto guardado' : 'Ya no se muestra nada ahí'); }
    tabsMenu(pj, i);
  };
  openMenu('Texto de arriba a la izquierda', [
    [`Texto principal<small>${q(UI.tabText)}</small>`, edit('tabText', 'Texto de arriba a la izquierda', 0)],
    [`Texto de «Web»<small>${q(UI.webText)}</small>`, edit('webText', 'Texto de «Web» (solo se ve con la barra superior PS5)', 1)],
    ['No mostrar nada', async () => { await setUI({ tabText: '', webText: '' }); toast('Sin textos arriba a la izquierda'); tabsMenu(pj, 2); }],
    ['Volver a «Juegos» y «Web»', async () => { await setUI({ tabText: 'Juegos', webText: 'Web' }); toast('Textos originales'); tabsMenu(pj, 3); }],
    ['Volver', back]
  ], at, { back, help: '«Web» solo se ve con la barra superior de PS5' });
}

// ── selector inferior: estilo, fondo, barra inferior, barra superior y tamaño de iconos ──
// El menú baja a una bandeja pegada al borde de abajo, así el estilo/fondo que cambias se ve casi a pantalla completa. ←/→ desliza (se ve en directo),
// Intro elige, Esc cancela (vuelve a lo que había), ↑/↓ cambia de apartado sin salir y Supr/△ elimina la tarjeta (estilos y fondos).
// [clave, nombre del apartado, fila de Apariencia a la que se vuelve]. «Brasas · color» sale con el estilo o el fondo Brasas; «Brasas · altura» solo con el estilo (es el que coloca los iconos).
const TABS = [['theme', 'Estilo', 'theme'], ['bg', 'Fondo', 'bg'], ['bar', 'Barra inferior', 'bar'], ['top', 'Barra superior', 'top'], ['font', 'Tipo de letra', 'font'], ['play', 'Intro para jugar', 'play'],
  ['tile', 'Tamaño de iconos', 'tile'], ['dock', 'Ampliación', 'dock'], ['emberc', 'Brasas · color', 'emberc'], ['embery', 'Brasas · altura', 'embery']];
const emberOn = () => UI.theme === 'ember' || fxIdFor(UI.bg, UI.theme) === 'ember';
const emberTh = () => UI.theme === 'ember';
const tabsNow = () => TABS.filter(([k]) => k === 'emberc' ? emberOn() || (tray && tray.tab === k) : k === 'embery' ? emberTh() || (tray && tray.tab === k) : true);
const DELETABLE = ['theme', 'bg', 'bar', 'top', 'font'];   // apartados con tarjetas que se pueden eliminar
const TILES = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160];
const shownFx = () => Object.keys(FX).filter(id => id !== 'b-classic' && (!hid('bg', FX_ID + id) || FX_ID + id === UI.bg));
function trayList(tab) {
  if (tab === 'theme') return { now: UI.theme, list: Object.keys(THEMES).filter(id => !hid('theme', id) || id === UI.theme).map(id => ({ id, name: THEMES[id].name, desc: THEMES[id].desc, org: ORG[THEMES[id].origin], isNew: THEMES[id].origin === N_, thumb: 'assets/estilos/miniaturas/' + id + '.jpg' })) };
  if (tab === 'bg') {
    const list = [{ id: '', name: 'Del estilo', desc: 'Ahora: ' + fxName(fxIdFor('', UI.theme)) + ' (el fondo animado de cada estilo)', cls: 'txt auto' }];
    // fondos animados: son independientes del estilo, así que se puede poner el de cualquiera con la colocación de otro
    shownFx().forEach(id => list.push({ id: FX_ID + id, name: FX[id].name, desc: (FX[id].fijo ? 'Liso · ' : 'Animado · ') + FX[id].desc, org: ORG[FX[id].origin], isNew: FX[id].origin === N_, thumb: 'assets/fondos/animados/' + id + '.jpg' }));
    F.forEach(f => list.push({ id: f.id, name: f.name, desc: f.user ? 'Mía' : '', thumb: f.thumb || f.url }));
    list.push({ id: '@add', name: 'Añadir foto de fondo…', desc: 'Elige una foto de tu PC', cls: 'txt add', plus: true });
    if (F.some(f => f.user)) list.push({ id: '@clear', name: 'Quitar mis fotos importadas', desc: 'Solo las que añadiste tú', cls: 'txt del' });
    return { now: UI.bg, list };
  }
  if (tab === 'tile') return { now: String(Math.round((UI.tile || 1) * 100)), list: TILES.map(p => ({ id: String(p), name: p + ' %', desc: p === 100 ? 'Tamaño de siempre' : p < 100 ? 'Más pequeños' : 'Más grandes', cls: 'txt' })) };
  if (tab !== 'bar' && tab !== 'top') return Mej.tab.cards(tab);               // tipo de letra, intro para jugar, ampliación y Brasas (js/mejoras.js)
  const set = tab === 'bar' ? BARS : TOPS, now = tab === 'bar' ? UI.bar : UI.top, auto = set[tab === 'bar' ? T().bar : T().top];
  const list = [{ id: 'auto', name: 'Mismo del estilo', desc: 'Ahora: ' + auto.name, cls: 'txt auto' }];
  for (const id in set) if (id === 'none' || !hid(tab, id) || id === now) list.push({ id, name: set[id].name, desc: set[id].desc, org: ORG[set[id].origin], cls: 'txt' });   // las eliminadas no salen (salvo la puesta)
  return { now, list };
}
const restoreLook = () => { tileS = UI.tile || 1; playPrev = null; applyTheme(UI.theme); applyBg(UI.bg); applyBars(); Mej.tab.restore(); applyPlay(); if (items.length) show(); };
async function openTray(tab, pj = 0, at) { // at: posición donde abrirla (si no, en lo que está puesto)
  if (tab === 'bg') await loadFondos();
  const L = trayList(tab);
  tray = { tab, pj, ...L, i: at !== undefined ? Math.max(0, Math.min(at, L.list.length - 1)) : Math.max(0, L.list.findIndex(c => c.id === L.now)) };
  drawTray(); trayMove(true);
  requestAnimationFrame(() => $('#tray').classList.add('on'));
}
function drawTray() {
  const t = tray;
  $('#tray').classList.toggle('hi', t.tab === 'bar'); $('#tray').classList.toggle('short', t.tab !== 'theme' && t.tab !== 'bg');
  document.body.classList.add('tray-open'); document.body.classList.toggle('tray-bar', t.tab === 'bar'); // la barra de abajo solo se ve si es lo que eliges
  $('#ttabs').innerHTML = tabsNow().map(([k, l]) => `<span class="tt${k === t.tab ? ' s' : ''}" data-k="${k}">${l}</span>`).join('');
  $('#ttrack').innerHTML = t.list.map((c, i) =>
    `<div class="tc${c.cls ? ' ' + c.cls : ''}${c.id === t.now && c.id[0] !== '@' ? ' cur' : ''}" data-i="${i}">${c.org ? `<span class="org${c.isNew ? ' new' : ''}">${esc(c.org)}</span>` : ''}<div class="tl">${c.plus ? '<b>＋</b>' : ''}${esc(c.name)}${c.desc && !c.thumb ? `<small>${esc(c.desc)}</small>` : ''}</div></div>`).join('');
  [...$('#ttrack').children].forEach((e, i) => { const c = t.list[i]; if (c.thumb) e.style.backgroundImage = 'url("' + c.thumb + '")'; else if (c.bg) e.style.background = c.bg; if (c.ff) e.querySelector('.tl').style.fontFamily = c.ff; });
  const del = DELETABLE.includes(t.tab) ? `<span>Supr/${GLYPH.t} eliminar</span>` : '';   // los fondos animados, las barras y los tipos de letra también se pueden eliminar (y restaurar)
  $('#thelp').innerHTML = `<span>←/→ deslizar</span><span>Intro/${GLYPH.x} elegir</span><span>Esc/${GLYPH.o} volver</span><span>↑/↓ cambiar de apartado</span>${del}`;
}
function trayMove(preview = true) {
  const t = tray, u = innerHeight / 1080, cw = 300 * u, gap = 20 * u;
  [...$('#ttrack').children].forEach((e, i) => e.classList.toggle('s', i === t.i));
  $('#ttrack').style.transform = `translateX(${innerWidth / 2 - (t.i * (cw + gap) + cw / 2)}px)`;
  const c = t.list[t.i];
  $('#tn').textContent = c.name; $('#td').textContent = [c.desc, c.org && !c.cat && (c.isNew ? 'Nuevo' : 'de «' + c.org + '»')].filter(Boolean).join(' · ');
  if (!preview) return;
  if (t.tab === 'theme') applyTheme(c.id);
  else if (t.tab === 'bg') applyBg(c.id[0] === '@' ? UI.bg : c.id);
  else if (t.tab === 'bar') drawBar(c.id);
  else if (t.tab === 'tile') { tileS = +c.id / 100; layout(); }   // se ve en directo detrás de la bandeja
  else if (t.tab === 'top') drawTop(c.id);
  else Mej.tab.preview(t.tab, c);                                 // tipo de letra, intro para jugar, ampliación, color y altura de Brasas
}
function trayTab(d) {
  const tb = tabsNow(), k = Math.max(0, tb.findIndex(x => x[0] === tray.tab)), n = (k + d + tb.length) % tb.length;
  restoreLook(); Sound.ui('move');
  return openTray(tb[n][0], tray.pj);
}
function trayClose(restore) { // devuelve a qué fila de Apariencia hay que volver
  const r = { pj: tray.pj, line: TABS.find(x => x[0] === tray.tab)[2], tab: tray.tab };
  tray = null; Mej.dock.kick(); $('#tray').classList.remove('on', 'hi'); document.body.classList.remove('tray-open', 'tray-bar');
  if (restore) restoreLook();
  return r;
}
async function trayPick() {
  const t = tray, c = t.list[t.i];
  Sound.ui('ok');
  if (c.id === '@add') { const r = trayClose(true); await addPhoto(); return openTray('bg', r.pj); }
  if (c.id === '@clear') {
    const r = trayClose(true);
    await dropUserPhotos();
    toast('Fotos importadas quitadas'); return openTray('bg', r.pj);
  }
  if (c.id === '@addfont') { // importar un tipo de letra del PC (.ttf, .otf, .woff, .woff2)
    const r = trayClose(true), ids = await Mej.fonts.add();
    if (ids.length) { await setUI({ font: ids[ids.length - 1] }); toast(ids.length > 1 ? ids.length + ' tipos de letra añadidos' : 'Tipo de letra añadido'); }
    return openTray('font', r.pj);
  }
  playPrev = null;
  await setUI(['font', 'play', 'dock', 'emberc', 'embery'].includes(t.tab) ? Mej.tab.patch(t.tab, c) : { [t.tab]: t.tab === 'tile' ? +c.id / 100 : c.id });
  const r = trayClose(false);
  toast(TABS.find(x => x[0] === r.tab)[1] + ': ' + c.name);
  appearance(r.line, r.pj);
}
function trayDelete() { // Supr / △ / START / clic derecho sobre una tarjeta de estilo o de fondo
  const t = tray, c = t.list[t.i];
  if (!DELETABLE.includes(t.tab)) return toast('Esto no se puede eliminar: solo estilos, fondos, barras y tipos de letra');
  if (!c.id || c.id[0] === '@' || c.id === 'auto') return toast('Esa tarjeta no se puede eliminar');
  if (c.id === 'none') return toast('«Nada» no se puede eliminar');
  if (t.tab === 'theme' && t.list.length <= 1) return toast('Tiene que quedar al menos un estilo');
  Sound.ui('open');
  const r = trayClose(true), at = t.i;
  askRemove(t.tab, c.id, () => openTray(r.tab, r.pj, at)); // al terminar, la bandeja se vuelve a abrir donde estaba
}
function trayAct(a) {
  const n = tray.list.length;
  if (a === 'l' || a === 'r' || a === 'first' || a === 'last' || a === 'pu' || a === 'pd') {
    const j = Math.max(0, Math.min(n - 1, a === 'first' ? 0 : a === 'last' ? n - 1 : tray.i + ({ l: -1, r: 1, pu: -5, pd: 5 })[a]));
    if (j !== tray.i) { tray.i = j; Sound.ui('move'); trayMove(); }
  } else if (a === 'u' || a === 'l1') trayTab(-1);
  else if (a === 'd' || a === 'r1') trayTab(1);
  else if (a === 'ok') trayPick();
  else if (a === 'opt') trayDelete();
  else if (a === 'back') { Sound.ui('back'); const r = trayClose(true); appearance(r.line, r.pj); }
}
// subir fotos del PC. Se copian tal cual (sin perder calidad) a %APPDATA%\gameshell\fondos
async function addPhoto() {
  const n = await api.fondoAdd();
  if (!n.length) return false;
  await loadFondos();
  await setUI({ bg: n[n.length - 1] });
  toast(n.length > 1 ? n.length + ' fotos añadidas' : 'Foto añadida');
  return true;
}

// ── intro ──
function pickIntro(at, pj) { // at: id de la intro o posición en la lista
  const ids = shownIntros(), back = () => appearance('intro', pj), i0 = typeof at === 'number' ? at : Math.max(0, ids.indexOf(at));
  const L = ids.map(id => {
    const [name, org] = INTROS[id], small = [id === 'photo' ? photoName() : '', ORG[org]].filter(Boolean).join(' · ');
    return [lb(id === UI.intro, name, small ? `<small>${esc(small)}</small>` : ''), async () => {
      if (id === 'photo') return pickIntroBg(pj);
      await setUI({ intro: id });   // ✕ / Intro solo la ELIGE; para verla y oírla sin elegir: □ / T
      if (id === 'none') { toast('Sin intro'); return appearance('intro', pj); }
      toast('Intro elegida · □ o T para probarla'); pickIntro(id, pj);
    }];
  });
  const n = ids.length;
  L.push(['Probar la intro elegida', async () => { await playPreview(UI.intro === 'none' ? 'b-text' : UI.intro); pickIntro(n, pj); }]);
  if (ids.includes('ps2-boot')) { // el texto del centro de «PS2 · Arranque» (por defecto, el de la consola)
    L.push([`Texto de «PS2 · Arranque»<small>${esc(UI.introText || 'Sony Computer Entertainment')}</small>`, async () => {
      const v = await ask('Texto de la intro PS2', { value: UI.introText || 'Sony Computer Entertainment', max: 40, ok: 'Guardar' });
      if (v) { await setUI({ introText: v === 'Sony Computer Entertainment' ? '' : v }); toast('Texto guardado'); }
      pickIntro(n + 1, pj); }]);
    if (UI.introText) L.push(['Volver al texto original', async () => { await setUI({ introText: '' }); toast('Texto original'); pickIntro(n + 1, pj); }]);
  }
  L.push(['Volver', back]);
  openMenu('Intro', L, i0, { back, help: `${GLYPH.q}/T probar la intro marcada · Supr/${GLYPH.t} eliminar`,
    onSq: async i => { // □ / T: prueba la intro marcada SIN elegirla (cualquier tecla la salta)
      const id = ids[i]; if (id === undefined) return;
      if (id === 'none') return toast('«Sin intro» no tiene nada que probar');
      closeMenu(); await playPreview(id); pickIntro(i, pj); },
    onOpt: i => { const id = ids[i]; if (id === undefined) return toast('Solo se pueden eliminar las intros de la lista'); if (id === 'none') return toast('«Sin intro» no se puede eliminar'); askRemove('intro', id, () => pickIntro(i, pj)); } });
}
// foto de la intro «Foto» (la de «actualizado»)
async function pickIntroBg(pj) {
  await loadFondos();
  const now = UI.introBg, L = [], ids = [];
  const back = () => pickIntro('photo', pj);
  const done = async id => { await setUI({ introBg: id, intro: 'photo' }); await playPreview('photo'); pickIntro('photo', pj); };
  F.forEach(f => { ids.push(f.id); L.push([lb(f.id === now, f.name, f.user ? '<small>Mía</small>' : ''), () => done(f.id)]); });
  L.push(['Importar foto…', async () => {
    const n = await api.fondoAdd();
    if (!n.length) return pickIntroBg(pj);
    await loadFondos(); await done(n[n.length - 1]);
  }]);
  if (F.some(f => f.user)) L.push(['Quitar mis fotos importadas', async () => { await dropUserPhotos(); toast('Fotos importadas quitadas'); pickIntroBg(pj); }]);
  L.push(['Volver', back]);
  openMenu('Foto de la intro', L, Math.max(0, ids.indexOf(now)), { back, help: `${GLYPH.q}/T ver esa foto como intro sin elegirla · Supr/${GLYPH.t} eliminar`,
    onSq: async i => { const f = F.find(x => x.id === ids[i]); if (!f) return; closeMenu(); await Intro.play('photo', { name: UI.name, photo: f.url, bphoto: f.url, snd: UI.introSndSrc, sce: UI.introText }); pickIntroBg(pj); },
    onOpt: i => { if (ids[i] !== undefined) askRemove('bg', ids[i], () => pickIntroBg(pj)); } });
}

// ── sonidos ──
// Dos reguladores: el de los menús (todos los efectos al moverte, elegir, volver…) y el de la intro. ←/→ cambian de 5 en 5 y suenan al momento; Intro sube de 10 en 10; clic en la barra va directo.
const volBar = v => `<span class="vb"><i style="width:${Math.round(v * 100)}%"></i></span>${Math.round(v * 100)}%`;
const volClamp = v => Math.max(0, Math.min(1, Math.round(v * 20) / 20));
function volRow(k, label, key, pj, sample) {
  const set = v => { // aplica el volumen al instante (sin reabrir el menú) y lo guarda
    v = volClamp(v); if (v === UI[k]) return;
    UI[k] = v; k === 'menuVol' ? Sound.menuVolume(v) : Sound.volume(v); api.uiSet({ [k]: v }).catch(() => {}); sample();
    if (menu) rowHtml(menu.list.findIndex(l => l[4] === key), `${label}<small>${volBar(v)}</small>`);
  };
  const r = [`${label}<small>${volBar(UI[k])}</small>`, () => { set(UI[k] >= 1 ? 0 : UI[k] + .1); sonidos(key, pj); }, 'vol', d => set(UI[k] + d * .05), key];
  r.quiet = true; r.set = set; return r;
}
function sonidos(at = 'menusnd', pj = 0) {
  const back = () => appearance('sounds', pj);
  const flip = (k, key) => async () => { await setUI({ [k]: !UI[k] }); Sound.ui('ok'); sonidos(key, pj); };
  openMenu('Sonidos', [
    [`Sonidos de los menús<small>${esc(menuSndName())}</small>`, () => pickMenuSnd(pj), 'sub', null, 'menusnd'],
    [`Activar sonidos de menú<small>${UI.sounds ? 'Sí' : 'No'}</small>`, flip('sounds', 'sounds'), '', flip('sounds', 'sounds'), 'sounds'],
    volRow('menuVol', 'Volumen de los menús', 'menuvol', pj, () => Sound.ui('ok')),
    [`Sonido de la intro<small>${esc(introSndName())}</small>`, () => pickIntroSnd(pj), 'sub', null, 'introsnd'],
    [`Activar sonido de la intro<small>${UI.introSnd ? 'Sí' : 'No'}</small>`, flip('introSnd', 'introon'), '', flip('introSnd', 'introon'), 'introon'],
    volRow('vol', 'Volumen de la intro', 'introvol', pj, () => Sound.introSample()),
    ['Probar la intro', async () => { await playPreview(UI.intro === 'none' ? 'b-text' : UI.intro); sonidos('test', pj); }, '', null, 'test'],
    ['Volver', back, '', null, 'back']
  ], at, { back });
}
// Cada timbre tiene seis sonidos (los que suenan al mover, elegir, volver, abrir, teclear y al fallar). Para oírlos: □ / T los pasa todos seguidos, ←/→ de uno en uno,
// y con el ratón el ▶ de cada fila. Al recorrer la lista con ↑/↓ suena el «elegir» de cada timbre, como antes.
const SND_EV = [['move', 'Mover'], ['ok', 'Elegir'], ['back', 'Volver'], ['open', 'Abrir'], ['key', 'Tecla'], ['err', 'Error']];
let sndT = [];
const sndStop = () => { sndT.forEach(clearTimeout); sndT = []; };
function sndAll(fid) { sndStop(); SND_EV.forEach(([ev, name], k) => sndT.push(setTimeout(() => { Sound.sample(fid, ev); toast('Sonido «' + name + '»'); }, k * 560))); }
const TP = '<span class="tp" title="Probar todos los sonidos">▶</span>';
function pickMenuSnd(pj) {
  const ids = ['auto', ...Object.keys(FLAVORS)], now = UI.menuSnd === 'auto' || !FLAVORS[UI.menuSnd] ? 'auto' : UI.menuSnd, back = () => { sndStop(); sonidos('menusnd', pj); };
  const fid = id => id === 'auto' ? T().snd : id;
  let ev = -1;                                   // el sonido suelto que toca con ←/→
  const one = (id, d) => { sndStop(); ev = ev < 0 ? (d > 0 ? 0 : SND_EV.length - 1) : (ev + d + SND_EV.length) % SND_EV.length; Sound.sample(fid(id), SND_EV[ev][0]); toast('Sonido «' + SND_EV[ev][1] + '» (' + (ev + 1) + ' de ' + SND_EV.length + ')'); };
  const L = ids.map(id => { const r = [(id === 'auto' ? lb(now === 'auto', 'Mismo del estilo', `<small>ahora: ${esc(FLAVORS[T().snd])}</small>`) : lb(id === now, FLAVORS[id], `<small>${FL_NEW.has(id) ? 'nuevo' : 'actualizado'}</small>`)) + TP,
    async () => { sndStop(); await setUI({ menuSnd: id }); toast('Sonidos de menú: ' + (id === 'auto' ? 'los del estilo' : FLAVORS[id])); sonidos('menusnd', pj); }, '', d => one(id, d)]; r.quiet = true; return r; });
  L.push(['Volver', back]);
  openMenu('Sonidos de los menús', L, Math.max(0, ids.indexOf(now)),
    { onMove: i => { sndStop(); ev = -1; i < ids.length && Sound.sample(fid(ids[i])); }, onSq: i => { if (i < ids.length) sndAll(fid(ids[i])); }, back, mute: true,
      help: `${GLYPH.q}/T oír los 6 sonidos · ←/→ de uno en uno · ▶ con el ratón` });
}
// sonido de la intro: el de cada intro, o cualquiera de los sintetizados (actualizado) o los wav (actualizacion). Aquí también se puede poner un sonido propio para «PS2 · Arranque»
let introH = null, introHT = 0;
const introStop = () => { clearTimeout(introHT); if (introH) { try { introH.stop(true); } catch {} introH = null; } };
function introPlay(src, ms) { introStop(); introH = Sound.intro(src); introHT = setTimeout(introStop, ms || Math.min(12000, ((introH && introH.dur) || 3) * 1000 + 400)); }
async function pickIntroSnd(pj, i0) {
  const ids = ['auto', ...Object.keys(ISRC)], now = UI.introSndSrc === 'auto' || !ISRC[UI.introSndSrc] ? 'auto' : UI.introSndSrc, back = () => { introStop(); sonidos('introsnd', pj); };
  let own = []; try { own = await api.soundOwn(); } catch {}
  const srcOf = id => id === 'auto' ? Intro.snd(UI.intro) || 'classic' : id;
  const L = ids.map(id => [lb(id === now, id === 'auto' ? 'La de cada intro' : ISRC[id][0], `<small>${id === 'auto' ? 'cada intro suena con la suya' : ORG[ISRC[id][1]]}</small>`) + TP, async () => {
    await setUI({ introSndSrc: id });
    introPlay(srcOf(id), 2600);                    // al elegirla se oye un momento
    pickIntroSnd(pj, ids.indexOf(id));
  }]);
  const n = ids.length, has = own.includes('ps2boot');
  L.push([`Cambiar el sonido de «PS2 · Arranque»…<small>${has ? 'el tuyo' : 'el incluido'}</small>`, async () => { // p. ej. la grabación original de tu consola (wav, mp3 u ogg)
    const ok = await api.soundImport('ps2boot');
    if (ok) { await loadSounds(); toast('Sonido cambiado'); const h = Sound.intro('wav:ps2boot'); setTimeout(() => h.stop(true), 3500); }
    pickIntroSnd(pj, n);
  }]);
  if (has) L.push(['Volver al sonido incluido de «PS2 · Arranque»', async () => { await api.soundDrop('ps2boot'); await loadSounds(); toast('Sonido incluido restaurado'); pickIntroSnd(pj, n); }]);
  L.push(['Volver', back]);
  openMenu('Sonido de la intro', L, i0 !== undefined ? i0 : Math.max(0, ids.indexOf(now)), { back, onMove: introStop,
    onSq: i => { if (ids[i] !== undefined) introPlay(srcOf(ids[i])); },     // □ / T: se oye entero SIN elegirlo (otra vez □ lo para)
    help: `${GLYPH.q}/T oír el sonido entero sin elegirlo · ▶ con el ratón · Intro lo elige` });
}

// ───────────────────────── mandos: los Buzz! no cuentan en el launcher ─────────────────────────
// A Windows (y al navegador del launcher) el pincho de los Buzz! le aparece como un mando de juego más. Antes el launcher cogía «el primer mando que hubiera»: con el pincho enchufado
// ese era el Buzz y el mando de verdad dejaba de responder. Los Buzz son solo para los juegos (PCSX2…): aquí se ignoran del todo (ni mueven el menú ni cuentan como «mando conectado»).
// Se reconocen por el nombre («…buzz…») o por su VID:PID de Sony (054C:1000 el pincho inalámbrico, 054C:0002 los de cable); el id que da Chromium trae las dos cosas.
const BUZZ_ID = [/buzz/i, /vendor:\s*(?:0x)?054c\s+product:\s*(?:0x)?(?:1000|0002)\b/i, /\b054c[-:](?:1000|0002)\b/i];
const isBuzz = g => { const id = String((g && g.id) || ''); return BUZZ_ID.some(r => r.test(id)); };
const seenPads = new Set();
function realPads() { // los mandos de verdad (sin los Buzz). De paso anota en gameshell.log cada mando que se ve la primera vez: si algún día un Buzz se colara, ahí está su id
  const out = [];
  for (const g of (navigator.getGamepads ? navigator.getGamepads() : [])) {
    if (!g) continue;
    const b = isBuzz(g);
    if (!seenPads.has(g.id)) { seenPads.add(g.id); try { window.gsx && window.gsx.log && window.gsx.log('mando visto: ' + g.id + (b ? ' → se ignora (es un Buzz)' : '')); } catch {} }
    if (!b) out.push(g);
  }
  return out;
}

// ───────────────────────── Precarga Post Intro (antes «pantalla del botón PS») ─────────────────────────
// Después de la intro: la foto «Welcome back to PlayStation · Press the PS button to use the controller» hasta que el mando se enciende
// (o se pulsa cualquier tecla / clic). Si el mando ya estaba encendido no se espera. Se activa o quita en Apariencia > Precarga Post Intro.
// Con «Exigir el mando» (UI.psReq) la pantalla NO se salta con teclado ni ratón: solo avanza cuando el mando responde. Para no quedarse encerrado si el
// mando falla hay una salida de emergencia que no sale en pantalla: pulsar Esc ocho veces seguidas.
// «Precarga Post Intro»: la pantalla que sale justo después de la intro y espera a que se encienda el mando (antes «pantalla del botón PS»).
// Se prepara DEBAJO de la intro (z-index menor), así cuando la intro se desvanece lo que aparece es esta pantalla y no un parpadeo del launcher.
// Pasa sola en cuanto Windows ve el mando (main.js lo vigila: el navegador solo lo «ve» tras pulsar un botón), sin tocar nada más.
const PSW = (() => {
  const el = $('#psw'); let on = false, ok = false, iv = 0, res = null, strict = false, prev = false, esc8 = { n: 0, t: 0 };
  const anyPad = () => realPads()[0];                       // un mando de verdad (los Buzz no cuentan)
  function finish() {
    if (!on) return; on = false; clearInterval(iv);
    el.classList.add('out');
    setTimeout(() => { el.className = ''; const r = res; res = null; r && r(); }, 700);
  }
  function connected() {
    if (ok || !on || prev) return; ok = true;   // en la vista previa nunca pasa sola
    el.classList.add('ok'); $('#pswmsg').textContent = '✓ Mando conectado';
    if (!Intro.active) Sound.ui('ok');          // si aún suena la intro, esta pantalla está debajo: sin pitido
    setTimeout(finish, 1100);
  }
  addEventListener('gamepadconnected', e => { if (!isBuzz(e.gamepad)) connected(); });   // si es el pincho de los Buzz, no es «el mando»
  if (api.onPad) api.onPad(v => { if (v) connected(); }); // Windows ve el mando encendido (aunque el navegador aún no lo vea)
  return {
    get active() { return on; },
    get strict() { return on && strict; },
    skip() { if (!on || strict) return; ok = true; finish(); },          // teclado / ratón: salta la pantalla, salvo que se exija el mando
    pad() { if (!on) return; strict ? connected() : (ok = true, finish()); }, // un botón del mando: ya responde, así que vale en los dos modos
    key(e) { // teclado: en modo estricto solo cuenta la salida de emergencia (Esc ×8 seguidas)
      if (!strict) return this.skip();
      if (e.key !== 'Escape') { esc8 = { n: 0, t: 0 }; return; }
      if (e.repeat) return;
      const now = performance.now(); esc8 = now - esc8.t < 1500 ? { n: esc8.n + 1, t: now } : { n: 1, t: now };
      if (esc8.n >= 8) { esc8 = { n: 0, t: 0 }; strict = false; ok = true; finish(); }
    },
    show(o = {}) { // o.force: aunque haya mando · o.preview: vista previa desde Apariencia (nunca se exige el mando ni pasa sola: se cierra con cualquier tecla o botón)
      return new Promise(r => {
        if (on) return r();
        if (!o.force && anyPad()) return r(); // el mando ya está encendido: no hace falta esperar
        const f = (o.photo && FALL.find(x => x.id === o.photo)) || pswPhoto(), std = !f || /ps5-bienvenida/.test(f.id);   // la foto estándar ya trae el texto escrito; las demás llevan el aviso debajo
        strict = !!UI.psReq && !o.preview; prev = !!o.preview; esc8 = { n: 0, t: 0 };
        $('#pswbg').style.backgroundImage = f ? `url("${f.url}")` : '';
        $('#pswmsg').textContent = strict ? 'Enciende el mando para continuar · pulsa el botón PS' : !f ? 'Pulsa el botón PS del mando para encenderlo' : std ? 'Pulsa cualquier tecla para saltar' : 'Enciende el mando para continuar · o pulsa cualquier tecla';
        on = true; ok = false; res = r;
        el.className = 'on' + (f ? '' : ' fb');
        if (!prev) {
          iv = setInterval(() => { if (anyPad()) connected(); }, 200);
          if (api.padState) api.padState().then(s => { if (s && s.on) connected(); }).catch(() => {}); // ¿Windows ya ve un mando encendido?
        }
        // si Windows no avisa y el navegador no ve el mando hasta pulsar un botón: pasados unos segundos a la vista (no mientras suena la intro) se avisa
        let seen = 0; const aviso = setInterval(() => {
          if (!on || ok) return clearInterval(aviso);
          if (Intro.active) { seen = 0; return; }
          if ((seen += 500) >= 7000) { clearInterval(aviso); if (f || strict) $('#pswmsg').textContent = strict || !std ? 'Si el mando ya está encendido, pulsa cualquier botón' : 'Si el mando ya está encendido, pulsa cualquier botón · o cualquier tecla para saltar'; }
        }, 500);
      });
    }
  };
})();

// ───────────────────────── contraseña, teclado y ajustes ─────────────────────────
const MINS = [0, 1, 5, 10, 30, 60];
const lab = m => m ? `tras ${m} min` : 'siempre';
const ask = (title, o) => OSK.open(title, o);
// pide la contraseña solo si hace falta (null = cancelado)
const gate = async title => (await api.locked()) ? ask(title, { pw: true }) : '';
const guarded = (title, fn) => async () => {
  const p = await gate(title);
  if (p === null) return;
  if (!await fn(p)) { toast('Contraseña incorrecta'); Sound.ui('err'); }
};
const toDesktop = guarded('Contraseña para ir al escritorio', p => api.desktop(p));
async function settings(first = true, i0 = 0) {
  const c = await api.cfg();
  if (first) {
    cur = '';
    if (c.hasPw && await api.locked()) {
      const p = await ask('Contraseña', { pw: true });
      if (p === null) return;
      if (!await api.check(p)) return toast('Contraseña incorrecta');
      cur = p;
    }
  }
  const fail = () => toast('No se pudo: vuelve a abrir Ajustes');
  openMenu('Ajustes del launcher', [
    [`Contraseña del escritorio<small>${c.hasPw ? 'definida' : 'sin definir'}</small>`, async () => {
      const n = await ask(c.hasPw ? 'Nueva contraseña (vacía para quitarla)' : 'Elige una contraseña', { pw: true });
      if (n === null) return settings(false);
      if (n && await ask('Repite la contraseña', { pw: true }) !== n) { toast('No coinciden'); return settings(false); }
      if (await api.setpw(cur, n)) { cur = n; toast(n ? 'Contraseña guardada' : 'Contraseña quitada'); } else fail();
      settings(false);
    }],
    [`Volver a pedirla<small>${lab(c.minutes)}</small>`, async () => {
      if (!await api.setmin(cur, MINS[(MINS.indexOf(c.minutes) + 1) % MINS.length])) fail();
      settings(false, 1);
    }],
    [`Nombre del launcher<small>${esc(UI.name)}</small>`, async () => {
      const n = await ask('Nombre del launcher', { value: UI.name, max: 24, ok: 'Guardar' });
      if (n !== null) { await setUI({ name: n }); toast('Nombre: ' + UI.name); }
      settings(false, 2);
    }],
    ['Volver']
  ], i0);
}

// ───────────────────────── navegador ─────────────────────────
// ── navegador ──
// El navegador es un <webview> con su propio script (js/webview-preload.js) que, al tocar un campo de texto, pide el teclado en pantalla de aquí (el de las contraseñas)
// y luego rellena el campo con lo escrito. El bloqueo de anuncios va en main.js; el escudo de la barra muestra cuántas peticiones se han bloqueado en esta página.
let wid = 0, shN = 0;
const setShield = () => { $('#shn').textContent = shN > 999 ? '999+' : shN; $('#sh').classList.toggle('off', !UI.webAds); };
if (api.onWebCount) api.onWebCount(d => { if (d && d.id === wid) { shN = d.n; setShield(); } });
async function onWebMsg(e) {
  if (e.channel !== 'gs-osk') return;
  const d = e.args[0] || {};
  const back = v => { try { wv.send('gs-osk-set', { id: d.id, v }); wv.focus(); } catch {} };
  if (!UI.webOsk || mode !== 'web' || menu || tray) return back(null);
  const v = await ask('Navegador · ' + String(d.title || 'Escribe').slice(0, 60), { pw: !!d.pw, value: String(d.value || ''), max: +d.max || 0, ok: d.go === 'go' ? 'Buscar' : d.go === 'pw' ? 'Entrar' : 'Listo' });
  back(v);   // v = lo escrito, o null si se canceló
}
function setMode(m) {
  mode = m; $('#br').classList.toggle('on', m === 'web');
  if (m === 'web' && !wv) {
    wv = document.createElement('webview');
    wv.setAttribute('partition', 'persist:web');
    wv.setAttribute('allowpopups', '');
    wv.setAttribute('useragent', navigator.userAgent.replace(/\s(Electron|gameshell)\/\S+/gi, ''));
    wv.src = 'https://www.google.com';
    const u = e => { $('#url').value = e.url; };
    wv.addEventListener('did-navigate', u); wv.addEventListener('did-navigate-in-page', u);
    wv.addEventListener('dom-ready', () => { try { wid = wv.getWebContentsId(); } catch {} });
    wv.addEventListener('did-start-navigation', e => { if (e.isMainFrame && !e.isInPlace) { shN = 0; setShield(); } });
    wv.addEventListener('ipc-message', onWebMsg);
    $('#br').append(wv); setShield();
  }
  try { wv && wv.setAudioMuted(m !== 'web'); } catch {}
  if (m === 'web') wv.focus();
}
const nav = v => { v = v.trim(); if (v) wv.src = /^https?:\/\//i.test(v) ? v : /^\S+\.\S{2,}$/.test(v) ? 'https://' + v : 'https://www.google.com/search?q=' + encodeURIComponent(v); };
async function typeUrl() { const v = await ask('Buscar o escribir una dirección', { ok: 'Ir' }); if (v) nav(v); wv && wv.focus(); } // con el mando: START abre el teclado
$('#url').onkeydown = e => { if (e.key === 'Enter') { nav(e.target.value); e.target.blur(); } };
$('#url').onfocus = e => e.target.select();
$('#bk').onclick = () => wv && wv.goBack();
$('#fw').onclick = () => wv && wv.goForward();
$('#rl').onclick = () => wv && wv.reload();
$('#hm').onclick = () => setMode('home');
$('#sh').onclick = () => webMenu(0, 'web');

// ───────────────────────── entrada: teclado, ratón y mando ─────────────────────────
// botón Share (Create en el DualSense) del mando: abre Apariencia directamente, desde cualquier sitio
function openAppearance() {
  if (tray || !items[sel]) return;      // en la bandeja ya se está dentro de Apariencia
  if (mode === 'web') setMode('home');
  closeMenu(); Sound.ui('open');
  appearance('theme', 'apr');           // «Volver» lleva a Opciones, sobre la fila de Apariencia
}
function act(a) {
  if (Intro.active) return Intro.skip();
  if (PSW.active) return PSW.pad();
  if (!live()) return;
  if (OSK.isOpen) return OSK.act(a);
  if (a === 'share') return openAppearance();
  if (a === 'tri' || a === 'start') a = 'opt';
  if (tray) return trayAct(a);
  if (menu) {
    const m = menu, n = m.list.length;
    if (a === 'u' || a === 'd' || a === 'first' || a === 'last' || a === 'pu' || a === 'pd' || a === 'l1' || a === 'r1') { // ↑ ↓ de uno en uno · Inicio/Fin · RePág/AvPág o L1/R1 de 5 en 5
      const j = Math.max(0, Math.min(n - 1, a === 'first' ? 0 : a === 'last' ? n - 1 : m.i + ({ u: -1, d: 1, pu: -5, l1: -5, pd: 5, r1: 5 })[a]));
      if (j !== m.i) { m.i = j; if (!m.o.mute) Sound.ui('move'); m.o.onMove && m.o.onMove(j); }
      mark();
    } else if ((a === 'l' || a === 'r') && m.list[m.i][3]) { if (!m.list[m.i].quiet) Sound.ui('move'); m.list[m.i][3](a === 'l' ? -1 : 1); } // ajustes con ‹ valor ›
    else if (a === 'opt' && m.o.onOpt) { Sound.ui('open'); m.o.onOpt(m.i); } // Supr / △ / START sobre la fila (p. ej. eliminar una intro)
    else if (a === 'sq' && m.o.onSq) m.o.onSq(m.i);                           // □ / T sobre la fila (p. ej. probar una intro sin elegirla)
    else if (a === 'ok') { const f = m.list[m.i][1]; Sound.ui('ok'); closeMenu(); return f && f(); }
    else if (a === 'back') { Sound.ui('back'); closeMenu(); return m.o.back && m.o.back(); }
    return;
  }
  if (mode === 'web') return a === 'back' ? setMode('home') : a === 'opt' ? typeUrl() : a === 'sq' ? webMenu(0, 'web') : undefined; // en el navegador: ○ vuelve · START busca · □ ajustes del navegador
  const was = sel;
  if (a === 'l') sel = Math.max(0, sel - 1);
  else if (a === 'r') sel = Math.min(items.length - 1, sel + 1);
  else if (a === 'ok') { Sound.ui('ok'); return openItem(items[sel]); }
  else if (a === 'opt') { Sound.ui('open'); return opts(items[sel]); }
  else if (a === 'back') { Sound.ui('open'); return power(); }
  else return;
  if (sel !== was) Sound.ui('move');
  show();
}

const K = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', Enter: 'ok', ' ': 'ok', Escape: 'back', Backspace: 'back', Delete: 'opt', ContextMenu: 'opt', Home: 'first', End: 'last', PageUp: 'pu', PageDown: 'pd', t: 'sq', T: 'sq' };
// secuencias secretas: 8 pulsaciones seguidas de R (modo oculto: no pide contraseña) o de P (muestra / vuelve a esconder las apps ocultas).
// «Modo Juego» (Opciones) corta las dos, como si no se hubieran puesto.
const SEQ = { r: { c: 0, t: 0 }, p: { c: 0, t: 0 } };
const flash = () => $('#clk').animate([{ opacity: 1 }, { opacity: .15 }, { opacity: 1 }], 700);
function secret(e) {
  const k = e.key.toLowerCase();
  if ((k === 'r' || k === 'p') && !e.repeat) {
    const s = SEQ[k], n = performance.now();
    s.c = n - s.t > 2000 ? 1 : s.c + 1; s.t = n; SEQ[k === 'r' ? 'p' : 'r'].c = 0;
    if (s.c >= 8) {
      s.c = 0; flash();
      if (k === 'r') api.bypass();
      else { pmode = !pmode; refresh(); }
    }
  } else if (e.key !== 'Shift' && e.key !== 'CapsLock') SEQ.r.c = SEQ.p.c = 0;
}
// ---------- W cuatro veces seguidas: alternar los dos modos (no cuenta mientras se escribe) ----------
// Antes cambiaba entre los dos launchers. Ahora es uno solo y W×4 alterna entre dos «aspectos» completos (estilo, fondo, barras y timbre de menú):
// el último que usaste y el otro. La primera vez te lleva al de «actualizacion»; la siguiente, de vuelta, y así. Cada vez que lo cambias queda guardado.
const LOOK = ['theme', 'bg', 'bar', 'top', 'menuSnd', 'font', 'play'];
const lookOf = u => Object.fromEntries(LOOK.map(k => [k, u[k]]));
const FAMILY = { actualizado: { theme: 'classic', bg: '', bar: 'auto', top: 'auto', menuSnd: 'auto', font: 'auto', play: 'auto' }, actualizacion: { theme: 'b-classic', bg: '', bar: 'auto', top: 'auto', menuSnd: 'auto', font: 'auto', play: 'auto' } };
const MODE_NAME = { actualizado: 'actualizado', actualizacion: 'actualización' };
const curMode = () => UI.mode || (String(UI.theme).startsWith('b-') ? 'actualizacion' : 'actualizado');
async function swapMode() {
  const to = curMode() === 'actualizado' ? 'actualizacion' : 'actualizado';
  const next = UI.alt && THEMES[UI.alt.theme] ? UI.alt : FAMILY[to];
  if (hid('theme', next.theme)) return toast(goneLists().theme.includes(next.theme) ? 'Ese aspecto usa un estilo eliminado definitivamente' : 'Ese aspecto tiene el estilo eliminado (Apariencia → Restaurar lo eliminado)');
  await setUI({ ...next, alt: lookOf(UI), mode: to });
  toast('Modo «' + MODE_NAME[to] + '»');
}
let wSeq = { n: 0, t: 0 };
function wwww(e) {
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key) || e.repeat) return; // modificadores y tecla mantenida: ni suman ni cortan la racha
  const w = String(e.key).toLowerCase() === 'w' && !e.ctrlKey && !e.altKey && !e.metaKey;
  if (!w || e.target.tagName === 'INPUT' || OSK.isOpen) { wSeq = { n: 0, t: 0 }; return; } // otra tecla, o se está escribiendo
  const now = performance.now();
  wSeq = now - wSeq.t < 1500 ? { n: wSeq.n + 1, t: now } : { n: 1, t: now };
  if (wSeq.n < 4) return;
  wSeq = { n: 0, t: 0 };
  if (tray) { const r = trayClose(true); closeMenu(); }
  swapMode();
}
addEventListener('keydown', e => {
  Sound.resume();
  wwww(e); // W x4: alternar los dos modos
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
  if (Intro.active) { e.preventDefault(); return Intro.skip(); }
  if (PSW.active) { e.preventDefault(); return PSW.key(e); }
  if (e.target.tagName === 'INPUT') return;
  secret(e);
  const a = K[e.key]; if (a) { e.preventDefault(); if (a === 'sq' && e.repeat) return; act(a); }
});
$('#row').onclick = e => { if (tray) return; const t = e.target.closest('.t'); if (!t) return; const i = +t.dataset.i; if (i === sel) act('ok'); else { sel = i; Sound.ui('move'); show(); } };
$('#row').oncontextmenu = e => { // clic derecho con el ratón sobre un icono: lo mismo que Supr / START (sus opciones)
  e.preventDefault();
  const t = e.target.closest('.t');
  if (!t || tray || menu || OSK.isOpen || mode !== 'home' || Intro.active || PSW.active || !live()) return;
  const i = +t.dataset.i; if (i !== sel) { sel = i; Sound.ui('move'); show(); }
  act('opt');
};
$('#mn').onclick = e => {
  const p = e.target.closest('p'); if (!p || !menu) return;
  if (e.target.closest('.tp') && menu.o.onSq) { menu.i = +p.dataset.i; mark(); menu.o.onSq(menu.i); return; }   // ▶: probar el sonido de esa fila sin elegirlo
  const vb = e.target.closest('.vb'), row = menu.list[+p.dataset.i];
  if (vb && row && row.set) { menu.i = +p.dataset.i; mark(); const r = vb.getBoundingClientRect(); row.set((e.clientX - r.left) / r.width); return; } // clic en la barra: ese volumen
  menu.i = +p.dataset.i; act('ok');
};
$('#ov').onclick = e => { if (e.target.id === 'ov') act('back'); };
$('#pw').onclick = () => act('back');
$('#opt').onclick = () => act('opt');
$('#av').onclick = () => { if (!menu && !tray && !OSK.isOpen && mode === 'home') settings(); };
$('#tweb').onclick = () => { if (!menu && !tray && !OSK.isOpen) setMode('web'); };
$('#play').onclick = () => act('ok');
$('#cta').onclick = () => act('ok');
$('#more').onclick = () => act('opt');
$('#psw').onclick = () => PSW.skip();
// selector inferior con el ratón: clic en una tarjeta (otro clic la elige), clic en un apartado, rueda para deslizar
$('#ttrack').onclick = e => { const c = e.target.closest('.tc'); if (!c || !tray) return; const i = +c.dataset.i; if (i === tray.i) trayPick(); else { tray.i = i; Sound.ui('move'); trayMove(); } };
$('#ttrack').oncontextmenu = e => { const c = e.target.closest('.tc'); if (!c || !tray) return; e.preventDefault(); tray.i = +c.dataset.i; trayMove(); trayDelete(); };
$('#ttabs').onclick = e => { const t = e.target.closest('.tt'); if (!t || !tray || t.dataset.k === tray.tab) return; restoreLook(); Sound.ui('move'); openTray(t.dataset.k, tray.pj); };
$('#tview').onwheel = e => { if (tray) { e.preventDefault(); trayAct((e.deltaY || e.deltaX) > 0 ? 'r' : 'l'); } };

// mando: ✕ abre · ○ sistema/atrás · START y △ opciones. Con el teclado en pantalla: ✕ escribe, □ borra, △ espacio, ○ cancela, START acepta
const held = {}, REP = new Set(['l', 'r', 'u', 'd', 'sq', 'l1', 'r1']);
(function poll() {
  const g = realPads()[0];   // el primer mando de verdad: los Buzz (el pincho de PCSX2) no mandan en el launcher
  if (g) {
    const b = i => !!(g.buttons[i] && g.buttons[i].pressed), ax = g.axes, now = performance.now();
    const s = { l: b(14) || ax[0] < -.6, r: b(15) || ax[0] > .6, u: b(12) || ax[1] < -.6, d: b(13) || ax[1] > .6,
      ok: b(0), back: b(1), sq: b(2), tri: b(3), start: b(9), share: b(8), l1: b(4), r1: b(5), l2: b(6), r2: b(7) };
    for (const k in s) {
      if (!s[k]) { delete held[k]; continue; }
      if (held[k] === undefined) { held[k] = now + 380; Sound.resume(); act(k); }
      else if (now > held[k] && REP.has(k) && (k !== 'sq' || OSK.isOpen)) { held[k] = now + 120; act(k); } // □ mantenido solo repite al borrar con el teclado en pantalla (en menús, repetir saltaría la intro que acaba de arrancar)
    }
  }
  requestAnimationFrame(poll);
})();

api.onHome(() => { gameOn = false; OSK.cancel(); closeMenu(); if (tray) trayClose(true); $('#ld').classList.remove('on'); setMode('home'); refresh(); });
addEventListener('focus', () => { gameOn = false; });
const tick = () => {
  const d = new Date();
  $('#clk').textContent = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  $('#dt').textContent = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
};
tick(); setInterval(tick, 1000);
addEventListener('resize', () => { scale(); items.length && show(); tray && trayMove(false); });

// mejoras.js (tipos de letra, ampliación tipo Dock, Brasas, FPS y resolución) recibe aquí lo que necesita de este archivo
Mej.init({
  ui: () => UI, hid, theme: () => theme, Sound, setUI: p => setUI(p), toast: t => toast(t), openMenu: (...a) => openMenu(...a), closeMenu: () => closeMenu(), rowHtml: (i, h) => rowHtml(i, h),
  opts: (...a) => opts(...a), items: () => items, sel: () => sel, layout: () => layout(), playId: v => playId(v),
  previewPlay: id => { playPrev = id === 'auto' ? null : id; applyPlay(); show(); },        // «Intro para jugar» en directo mientras se desliza el selector
  afterFont: () => { placePlay(); if (items.length) layout(); },                              // otro tipo de letra: lo colocado midiendo el texto se recoloca
  canDock: () => mode === 'home' && !menu && !OSK.isOpen && (!tray || tray.tab === 'dock') && !Intro.active && !PSW.active && live() && items.length > 0
});
Mej.fonts.load().then(() => Mej.fonts.apply(UI.font)).catch(() => {});                      // los tipos de letra que importaste

// ───────────────────────── arranque ─────────────────────────
// (negro) → intro → Precarga Post Intro, si está activada y el mando aún no está encendido → launcher. Nada del launcher se ve hasta el final:
// #boot es una cubierta negra desde el primer fotograma (index.html) que solo se quita cuando ya hay algo que enseñar (la intro, la Precarga o el launcher ya cargado).
(async function boot() {
  const uncover = fade => { const c = $('#boot'); if (!c) return; if (fade) { c.style.transition = 'opacity .35s'; c.style.opacity = '0'; setTimeout(() => c.remove(), 420); } else c.remove(); };
  setTimeout(() => uncover(true), 10000); // por si algo fallara: que la pantalla no se quede negra
  try {
    try { UI = { ...UI, ...(await api.ui()) }; } catch {}
    await Promise.all([loadFondos(), loadSounds(true)]); // solo se espera al sonido de la intro; los demás wav se decodifican detrás
    scale(); applyUI();
    const hay = Intro.kinds.includes(UI.intro);
    const pre = UI.psWait ? PSW.show() : null;         // la Precarga se pone ya, DEBAJO de la intro: al desvanecerse la intro sale ella, sin parpadeo del launcher
    const p = hay ? Intro.play(UI.intro, { name: UI.name, photo: photoUrl(), bphoto: photoUrlB(), snd: UI.introSndSrc, sce: UI.introText }) : Promise.resolve(); // se ve encima mientras la lista se carga debajo
    const lista = refresh();
    if (hay || PSW.active) uncover(false);              // ya hay algo (negro) delante: se quita la cubierta sin que se note
    else { await lista; uncover(true); }                // sin intro ni Precarga: el launcher aparece ya cargado, con un fundido
    await p;
    if (pre) await pre;
  } finally { uncover(true); try { window.gsx && window.gsx.bootDone && window.gsx.bootDone(); } catch {} }   // el launcher ya está listo: main.js activa ahora los mandos Buzz en segundo plano
  (window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 8000 }) : f => setTimeout(f, 3000))(() => { try { FXC.nebula(); } catch {} }); // la nebulosa de Cosmos se calcula una vez; así no se nota al deslizar por los estilos
})();
