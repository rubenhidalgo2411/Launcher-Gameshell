// Decorados de fondo que se reutilizan en los estilos del launcher y en las intros.

// Símbolos de PlayStation (los mismos que en los botones del mando)
const GLYPH = {
  x: '<svg class="pg gx" viewBox="0 0 24 24"><path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/></svg>',
  o: '<svg class="pg go" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.2"/></svg>',
  q: '<svg class="pg gq" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>',
  t: '<svg class="pg gt" viewBox="0 0 24 24"><path d="M12 4.6l8 13.9H4z"/></svg>'
};

// Ondas de seda estilo PS3: cintas translúcidas que se mueven despacio. Devuelve una función para pararlas.
const Waves = {
  start(cv, hue = 205) {
    const c = cv.getContext('2d');
    let raf = 0, alive = true;
    const t0 = performance.now();
    const rs = () => { cv.width = Math.max(2, (cv.clientWidth / 2) | 0); cv.height = Math.max(2, (cv.clientHeight / 2) | 0); }; // media resolución: son borrosas y así pesan menos
    rs(); addEventListener('resize', rs);
    const R = [ // y base, amplitud, repeticiones, velocidad, grosor, opacidad, tono
      { y: .50, a: .07, f: 1.5, s: .32, th: .20, al: .20, h: hue },
      { y: .58, a: .09, f: 1.1, s: .26, th: .26, al: .16, h: hue + 12 },
      { y: .44, a: .06, f: 2.1, s: .42, th: .11, al: .15, h: hue - 10 },
      { y: .54, a: .05, f: 2.9, s: .55, th: .07, al: .18, h: hue + 25 },
      { y: .62, a: .04, f: 1.8, s: .38, th: .05, al: .12, h: hue }
    ];
    const tick = now => {
      if (!alive) return;
      const t = (now - t0) / 1000, W = cv.width, H = cv.height;
      c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H); c.globalCompositeOperation = 'lighter';
      for (const r of R) {
        const g = c.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, `hsla(${r.h},90%,65%,0)`); g.addColorStop(.28, `hsla(${r.h},90%,68%,${r.al})`);
        g.addColorStop(.7, `hsla(${r.h + 18},90%,82%,${r.al * 1.5})`); g.addColorStop(1, `hsla(${r.h},90%,65%,0)`);
        c.fillStyle = g; c.beginPath();
        const N = 48, top = [], bot = [];
        for (let i = 0; i <= N; i++) {
          const x = i / N, ph = x * Math.PI * 2 * r.f + t * r.s;
          const y = r.y + r.a * Math.sin(ph) + r.a * .5 * Math.sin(ph * 1.7 - t * r.s * .8);
          const th = r.th * (.55 + .45 * Math.sin(ph * .7 + 1 + t * .2));
          top.push([x * W, y * H]); bot.push([x * W, (y + th) * H]);
        }
        c.moveTo(top[0][0], top[0][1]);
        for (const p of top) c.lineTo(p[0], p[1]);
        for (let i = N; i >= 0; i--) c.lineTo(bot[i][0], bot[i][1]);
        c.closePath(); c.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', rs); };
  }
};

// Torres azules translúcidas estilo PS2 (tres capas de profundidad)
const Towers = {
  html(n = 34) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const d = i % 3, w = [1.5, 2.6, 4.4][d] + Math.random() * [1.2, 1.8, 3][d], h = 16 + Math.random() * 62;
      s += `<i class="tw d${d}" style="--w:${w.toFixed(2)}vw;--h:${h.toFixed(1)}vh;--x:${(Math.random() * 98).toFixed(1)}%;--dl:${(Math.random() * 2.2).toFixed(2)}s;--sp:${(7 + Math.random() * 7).toFixed(1)}s"></i>`;
    }
    for (let i = 0; i < 26; i++) s += `<b class="mote" style="--x:${(Math.random() * 100).toFixed(1)}%;--dl:${(Math.random() * 6).toFixed(2)}s;--sp:${(5 + Math.random() * 6).toFixed(1)}s;--z:${(1 + Math.random() * 2.2).toFixed(1)}px"></b>`;
    return s;
  }
};

// Los cuatro símbolos con su color clásico
const SYMS = [
  ['t', '#2de58a', '<path d="M12 4.2l8.4 14.6H3.6z"/>'],
  ['o', '#ff4d5e', '<circle cx="12" cy="12" r="7.6"/>'],
  ['x', '#4d8dff', '<path d="M5.2 5.2l13.6 13.6M18.8 5.2L5.2 18.8"/>'],
  ['q', '#ff6fd0', '<rect x="4.6" y="4.6" width="14.8" height="14.8" rx="1.2"/>']
];
const Symbols = {
  // los cuatro flotando en el fondo (estilo Neón)
  bg() { return SYMS.map((s, i) => `<svg class="sh s${i}" viewBox="0 0 24 24" style="--sc:${s[1]}">${s[2]}</svg>`).join(''); },
  // fila para la intro
  row() { return SYMS.map((s, i) => `<svg class="ni n${i}" viewBox="0 0 24 24" style="--sc:${s[1]}">${s[2].replace(/\/>/g, ' pathLength="100"/>')}</svg>`).join(''); }
};
