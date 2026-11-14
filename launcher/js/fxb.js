'use strict';
// Fondos animados dibujados en canvas (de «actualizacion»). Se usan como fondo de los estilos «PS2 · Torres» y «PS3 · Onda XMB» y dentro de sus intros.
const FXB = (() => {
  const cv = document.getElementById('fxb'), g0 = cv.getContext('2d');
  let mode = '', raf = 0, last = 0, t0 = performance.now(), W = 0, H = 0;
  const rnd = (() => { let s = 1234567; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  const TW = Array.from({ length: 56 }, () => ({ x: rnd(), w: .008 + rnd() * .03, h: .18 + rnd() * .62, ph: rnd() * 6.28, sp: .12 + rnd() * .35, z: rnd() })).sort((a, b) => a.z - b.z);
  const PA = Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd(), s: rnd(), v: .004 + rnd() * .016 }));
  const smooth = e => e * e * (3 - 2 * e);

  // PS2: torres que suben desde abajo; k (0..1) = cuánto han crecido (en la intro sube de 0 a 1)
  function towers(g, W, H, t, k = 1, calm = 0) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#01030c'); bg.addColorStop(1, '#03133c');
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (const o of TW) {
      const e = smooth(Math.min(1, Math.max(0, k * 1.35 - o.z * .45)));
      const h = (o.h + .08 * Math.sin(t * o.sp + o.ph)) * H * (.5 + o.z * .6) * e * (1 - .3 * calm);
      const w = o.w * W * (.6 + o.z), x = o.x * W - w / 2, a = (.10 + o.z * .30) * (1 - .35 * calm);
      const gr = g.createLinearGradient(0, H - h, 0, H);
      gr.addColorStop(0, `rgba(175,218,255,${a + .25})`); gr.addColorStop(.1, `rgba(90,150,255,${a})`); gr.addColorStop(1, 'rgba(10,40,120,0)');
      g.fillStyle = gr; g.fillRect(x, H - h, w, h);
      g.fillStyle = `rgba(225,242,255,${.4 * e})`; g.fillRect(x, H - h, w, Math.max(1, H / 270));
    }
    g.fillStyle = '#cfe6ff';
    for (const p of PA) {
      const y = (((p.y - t * p.v) % 1) + 1) % 1, s = (1 + p.s * 1.6) * H / 540;
      g.globalAlpha = (.15 + .5 * p.s) * Math.min(1, k * 1.5); g.fillRect(p.x * W, y * H, s, s);
    }
    g.globalAlpha = 1;
  }

  // PS3 (XMB): cintas de seda; el color cambia con el mes y la luz con la hora
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const MONTH = ['#cfe3ff', '#ffe08a', '#a8f0c0', '#ffb6d3', '#9be8b4', '#8fdcff', '#8cb8ff', '#ffd199', '#ff9f8a', '#d3a8ff', '#ffbd7a', '#bcd4ff'];
  function wave(g, W, H, t, k = 1) {
    const d = new Date(), c = hex(MONTH[d.getMonth()]), hr = d.getHours() + d.getMinutes() / 60;
    const day = .45 + .4 * Math.cos((hr - 14) / 24 * 6.2832);
    const mix = f => `rgb(${c.map(v => Math.round(v * f)).join(',')})`;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, mix(.15 * day + .07)); bg.addColorStop(1, mix(.52 * day + .12));
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let r = 0; r < 5; r++) {
      const y0 = H * (.46 + r * .05), A = H * (.06 + r * .012), sp = .10 + r * .045, ph = r * 1.9, th = H * (.07 + r * .022);
      const f1 = u => y0 + A * Math.sin(u * 3.1 + t * sp + ph) + A * .55 * Math.sin(u * 6.7 - t * sp * 1.4 + ph * 2);
      g.beginPath();
      for (let x = 0; x <= W + 8; x += 8) g.lineTo(x, f1(x / W));
      for (let x = W + 8; x >= 0; x -= 8) { const u = x / W; g.lineTo(x, f1(u) + th * (.65 + .35 * Math.sin(u * 2.2 + t * .21 + r))); }
      g.closePath();
      const gr = g.createLinearGradient(0, y0 - A, 0, y0 + A + th * 1.2);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(${c.join(',')},${.24 * k})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  const size = () => { const k = FXC.res() * (mode === 'wave' ? .5 : 1); W = cv.width = Math.ceil(innerWidth * k); H = cv.height = Math.ceil(innerHeight * k); }; // torres a resolución completa (con tope 1920 de ancho); las ondas, borrosas, a la mitad
  const frame = now => {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return; last = now; // 30 fps: sobra para un fondo lento
    if (mode === 'wave') wave(g0, W, H, (now - t0) / 1000, 1); else towers(g0, W, H, (now - t0) / 1000, 1, 1);
  };
  addEventListener('resize', () => mode && size());
  return {
    towers, wave,
    // m: 'towers' | 'wave' | '' (sin efecto)
    set(m) {
      mode = m; cancelAnimationFrame(raf); cv.classList.toggle('on', !!m);
      if (m) { size(); last = 0; raf = requestAnimationFrame(frame); }
    }
  };
})();
