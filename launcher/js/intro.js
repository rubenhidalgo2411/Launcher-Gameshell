// Intros del launcher: animación (css/intro.css) + sonido (js/audio.js). Cualquier tecla, botón o clic la salta.
const Intro = (() => {
  const el = document.getElementById('intro');
  let tm = [], snd = null, res = null, running = false, stopFx = null;
  const later = (ms, f) => tm.push(setTimeout(f, ms));
  const esc = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
  const letters = s => [...s].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');

  // dur = milisegundos totales · cue = [ms, clase] para cambios a mitad · init = cosas que no son solo css
  const M = {
    classic: { dur: 2900, snd: 'classic', html: o => `<div class="nm">${letters(o.name)}</div><i class="ln"></i>` },
    ps2: { dur: 6900, snd: 'ps2', cue: [[3150, 'go2']],
      html: o => `<div class="tws">${Towers.html(34)}</div><div class="mist"></div><div class="nm">${esc(o.name)}</div><div class="flash"></div>` },
    ps3: { dur: 5300, snd: 'ps3', cue: [[1500, 'go2']],
      html: o => `<canvas class="wv"></canvas><i class="hl"></i><div class="nm">${esc(o.name)}</div>`,
      init: e => { stopFx = Waves.start(e.querySelector('canvas'), 205); } },
    ps5: { dur: 5100, snd: 'ps5',
      html: o => `<i class="silk a"></i><i class="silk b"></i><div class="nm">${esc(o.name)}</div><div class="wl">Te damos la bienvenida de nuevo</div><div class="pr">Pulsa ${GLYPH.x} para continuar</div>` },
    neon: { dur: 5800, snd: 'neon', cue: [[2800, 'go2']], html: o => `<div class="nrow">${Symbols.row()}</div><div class="nm">${esc(o.name)}</div>` },
    // recreación del arranque de la PlayStation 2: barras en 3D, resplandor azul y el texto en el centro (js/ps2boot.js). El golpe del sonido cae en el segundo 4,6
    'ps2-boot': { dur: 8300, fade: 900, snd: 'wav:ps2boot', cue: [[2200, 'go2'], [4600, 'go3']],
      html: o => `<canvas class="pbc"></canvas><div class="sce">${esc(o.sce || 'Sony Computer Entertainment')}</div>`,
      init: e => { stopFx = PS2Boot.start(e.querySelector('canvas')); } },
    photo: { dur: 5300, snd: 'photo', html: o => `<div class="ph"></div><i class="vg"></i><div class="nm">${esc(o.name)}</div>`,
      init: (e, o) => { e.querySelector('.ph').style.backgroundImage = 'url("' + o.photo + '")'; } }
  };

  // ───── intros que vienen de «actualizacion» (b-*) ─────
  // Allí la imagen duraba `dur` y se desvanecía durante los 750 ms siguientes (fade); el sonido era un wav. Aquí igual.
  const BSYMS = '<svg class="isym" viewBox="0 0 900 190"><defs><filter id="gl" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#gl)" fill="none" stroke="#7db4ff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"><path class="d" pathLength="1" style="--i:0" d="M105 22L178 160H32Z"/><circle class="d" pathLength="1" style="--i:1" cx="345" cy="92" r="70"/><path class="d" pathLength="1" style="--i:2" d="M485 28L625 156M625 28L485 156"/><rect class="d" pathLength="1" style="--i:3" x="715" y="24" width="136" height="136" rx="5"/></g></svg>';
  // canvas de torres / ondas (fxb.js) a media resolución; devuelve la función que lo para
  function bCanvas(cv, mode) {
    const g = cv.getContext('2d'), t0 = performance.now(); let raf = 0, alive = true;
    const k = FXC.res() * (mode === 'wave' ? .5 : 1); cv.width = Math.ceil(innerWidth * k); cv.height = Math.ceil(innerHeight * k); // las torres a resolución completa, las ondas (borrosas) a la mitad
    const loop = n => {
      if (!alive) return;
      const t = (n - t0) / 1000;
      if (mode === 'towers') FXB.towers(g, cv.width, cv.height, t, Math.min(1, t / 3.4));
      else { FXB.wave(g, cv.width, cv.height, t, Math.min(1, t / 1.6)); cv.style.opacity = Math.min(1, t / 1.2); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }
  const nm = o => `<div class="iname">${esc(o.name)}</div>`;
  Object.assign(M, {
    'b-ps2': { dur: 6400 + 750, fade: 750, snd: 'wav:ps2', html: o => '<canvas class="icv"></canvas>' + nm(o), init: e => { stopFx = bCanvas(e.querySelector('canvas'), 'towers'); } },
    'b-ps5': { dur: 5000 + 750, fade: 750, snd: 'wav:ps5', html: o => '<div class="istack">' + BSYMS + nm(o) + '</div><div class="isw"></div>' },
    'b-ps3': { dur: 5400 + 750, fade: 750, snd: 'wav:ps3', html: o => '<canvas class="icv"></canvas>' + nm(o), init: e => { stopFx = bCanvas(e.querySelector('canvas'), 'wave'); } },
    'b-photo': { dur: 5600 + 750, fade: 750, snd: 'wav:ps2', html: o => '<div class="iph"></div>' + nm(o), init: (e, o) => { if (o.bphoto) e.querySelector('.iph').style.setProperty('--ip', 'url("' + o.bphoto + '")'); } },
    'b-text': { dur: 3400 + 750, fade: 750, snd: 'wav:ps2', html: o => nm(o) }
  });

  function end(skipped) {
    tm.forEach(clearTimeout); tm = [];
    if (stopFx) { stopFx(); stopFx = null; }
    if (snd) { if (skipped || snd.fadeAtEnd) snd.stop(skipped); snd = null; }
    el.className = ''; el.innerHTML = '';
    const r = res; res = null; running = false;
    r && r();
  }

  // kind: classic | ps2 | ps3 | ps5 | neon | photo | b-ps2 | b-ps5 | b-ps3 | b-photo | b-text ; o = { name, photo, bphoto, snd }. Devuelve una promesa que se cumple al terminar (o al saltarla)
  function play(kind, o = {}) {
    if (kind === 'photo' && !o.photo) kind = 'classic';
    const m = M[kind];
    if (!m) return Promise.resolve();
    if (running) end(true);
    running = true;
    el.className = 'on in-' + kind; el.innerHTML = m.html(o);
    m.init && m.init(el, o);
    snd = Sound.intro(o.snd && o.snd !== 'auto' ? o.snd : m.snd); // o.snd: el elegido en Sonidos > Sonido de la intro
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('go')));
    (m.cue || []).forEach(([ms, cls]) => later(ms, () => el.classList.add(cls)));
    later(m.dur - (m.fade || 800), () => el.classList.add('out'));
    later(m.dur, () => end(false));
    return new Promise(r => { res = r; });
  }
  function skip() {
    if (!running) return;
    el.classList.add('out', 'fast');
    if (snd) snd.stop(true);
    tm.forEach(clearTimeout); tm = [];
    later(320, () => end(true));
  }
  el.addEventListener('click', skip);

  return { play, skip, get active() { return running; }, kinds: Object.keys(M), snd: k => (M[k] || {}).snd };
})();
