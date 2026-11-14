'use strict';
// GameShell · efectos de canvas de los estilos nuevos (PS4 Dinámico, Cyberpunk, Cosmos, Brasas, Sakura) y ayudas de resolución.
// Cada efecto devuelve la función que lo para. Todo se dibuja en píxeles CSS (el canvas se escala con la pantalla) y las medidas
// van multiplicadas por u = alto / 1080, así se ven igual en 1080p que en 4K. Si el canvas no se ve (hay foto de fondo) no se dibuja.
const FXC = (() => {
  // resolución interna de un canvas animado: la de la pantalla (con su escala) con un tope, para que en 4K no pese
  const res = () => { const k = Math.min(devicePixelRatio || 1, 2), w = innerWidth * k; return k * Math.min(1, (window.__FXMAX || 1920) / w); };
  const fit = cv => { const r = res(); cv.width = Math.max(2, Math.round(innerWidth * r)); cv.height = Math.max(2, Math.round(innerHeight * r)); return r; };
  const seeded = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const sprite = (size, stops) => { // bolita de luz con degradado radial, se dibuja con drawImage (mucho más barato que crear degradados a cada fotograma)
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), h = size / 2, r = g.createRadialGradient(h, h, 0, h, h, h);
    stops.forEach(([o, col]) => r.addColorStop(o, col)); g.fillStyle = r; g.fillRect(0, 0, size, size); return c;
  };

  // bucle común: init(W,H,g,r) crea el estado; draw(g,estado,W,H,t,dt) pinta un fotograma
  function loop(cv, init, draw, fps = 30) {
    const g = cv.getContext('2d'); let raf = 0, alive = true, last = 0, st = null;
    const size = () => { const r = fit(cv); g.setTransform(r, 0, 0, r, 0, 0); st = init(innerWidth, innerHeight, g, r); };
    size(); addEventListener('resize', size);
    const t0 = performance.now();
    const tick = now => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / fps - 3) return;
      if (document.hidden || !cv.getClientRects().length) return;
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      draw(g, st, innerWidth, innerHeight, (now - t0) / 1000, dt);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', size); };
  }

  // ───── polvo de luz (PS4): motas suaves que suben despacio y brillan ─────
  function dust(cv, o = {}) {
    const hue = o.hue === undefined ? 210 : o.hue, n = o.n || 140;
    const sp = sprite(64, [[0, `hsla(${hue},100%,94%,1)`], [.22, `hsla(${hue},100%,82%,.55)`], [1, `hsla(${hue},100%,70%,0)`]]);
    return loop(cv, (W, H) => ({ p: Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.pow(Math.random(), 1.7), ph: Math.random() * 6.28 })) }),
      (g, s, W, H, t, dt) => {
        const u = H / 1080; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
        for (const p of s.p) {
          p.y -= (5 + 20 * p.z) * u * dt; p.x += Math.sin(t * .35 + p.ph) * 8 * u * dt * (.4 + p.z);
          if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
          const r = (3 + 12 * p.z) * u; g.globalAlpha = (.1 + .5 * p.z) * (.65 + .35 * Math.sin(t * (.6 + p.z) + p.ph));
          g.drawImage(sp, p.x - r, p.y - r, r * 2, r * 2);
        }
        g.globalAlpha = 1;
      });
  }

  // ───── brasas: chispas que suben desde abajo y se enfrían (de blanco-amarillo a rojo oscuro) ─────
  // o = { hue, sat }: giro de tono (grados) y saturación (×) respecto al fuego de siempre. Es un objeto vivo: si cambia, las chispas se recolorean solas en el siguiente fotograma
  const tint = (c, dh, sm) => { // [r,g,b] 0-255 → mismo color con el tono girado dh grados y la saturación multiplicada por sm
    if (!dh && sm === 1) return c;
    const [r, g, b] = c.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    if (d) h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = ((h * 60 + dh) % 360 + 360) % 360; s = Math.max(0, Math.min(1, s * sm));
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
  };
  function embers(cv, o = {}) {
    const BASE = [[255, 240, 190], [255, 186, 84], [255, 108, 28], [190, 36, 10]];
    const mk = () => BASE.map(c => tint(c, o.hue || 0, o.sat === undefined ? 1 : o.sat)).map(c => sprite(64, [[0, `rgba(${c},1)`], [.3, `rgba(${c},.65)`], [1, `rgba(${c},0)`]]));
    let SP = mk(), lh = o.hue || 0, ls = o.sat === undefined ? 1 : o.sat;
    const spawn = (W, H, first) => ({ x: W * (.5 + (Math.random() + Math.random() - 1) * .66), y: first ? Math.random() * H : H + 10 + Math.random() * 60,
      vy: 46 + Math.random() * 120, sw: 6 + Math.random() * 20, ph: Math.random() * 6.28, life: 3 + Math.random() * 6, age: first ? Math.random() * 3 : 0, sz: 2 + Math.random() * 6, f: 2 + Math.random() * 6 });
    return loop(cv, (W, H) => ({ p: Array.from({ length: 120 }, () => spawn(W, H, true)) }),
      (g, s, W, H, t, dt) => {
        const u = H / 1080; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
        if ((o.hue || 0) !== lh || (o.sat === undefined ? 1 : o.sat) !== ls) { lh = o.hue || 0; ls = o.sat === undefined ? 1 : o.sat; SP = mk(); }   // cambió el color en Apariencia
        s.p.forEach((p, i) => {
          p.age += dt; p.y -= p.vy * u * dt * (1 - .35 * p.age / p.life); p.x += Math.sin(t * .9 + p.ph) * p.sw * u * dt;
          if (p.age > p.life || p.y < -30) { s.p[i] = spawn(W, H, false); return; }
          const heat = 1 - p.age / p.life, k = heat > .75 ? 0 : heat > .5 ? 1 : heat > .25 ? 2 : 3;
          const fl = .75 + .25 * Math.sin(t * p.f + p.ph), r = p.sz * u * (.55 + .8 * heat) * 2.2;
          g.globalAlpha = Math.min(1, p.age * 3) * Math.pow(heat, .55) * fl; g.drawImage(SP[k], p.x - r, p.y - r, r * 2, r * 2);
        });
        g.globalAlpha = 1;
      });
  }

  // ───── ciudad cyberpunk: tres capas de edificios (se dibujan una vez) + lluvia que cae ─────
  function skyline(cv) {
    const r = fit(cv), g = cv.getContext('2d'), W = innerWidth, H = innerHeight, u = H / 1080, R = seeded(4242);
    g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, H);
    // tres capas: lejana (violeta, bruma), media y cercana (casi negra, más alta en los bordes para dejar el centro libre)
    const L = [
      { h0: .14, h1: .34, w0: 46, w1: 120, c: [44, 22, 100], lit: .55, fog: .55, sign: 0, wc: ['#ff4fb3', '#4df3ff', '#ffd35a'], rim: .16 },
      { h0: .2, h1: .46, w0: 70, w1: 170, c: [20, 11, 58], lit: .65, fog: .32, sign: .3, wc: ['#ffd35a', '#4df3ff', '#ff4fb3', '#ffe9a8'], rim: .3 },
      { h0: .26, h1: .64, w0: 110, w1: 250, c: [7, 4, 20], lit: .5, fog: 0, sign: .5, wc: ['#ffd35a', '#ff3b8d', '#4df3ff'], edges: true, rim: .5 }
    ];
    const sign = (x, y, w, h, col) => { // cartel de neón vertical con «letras» (rayitas) dentro
      g.save(); g.shadowColor = col; g.shadowBlur = 26 * u; g.fillStyle = col; g.globalAlpha = .9; g.fillRect(x, y, w, h); g.restore();
      g.fillStyle = 'rgba(255,255,255,.85)'; const n = Math.max(3, (h / (22 * u)) | 0);
      for (let i = 0; i < n; i++) { const yy = y + (i + .5) * h / n; g.fillRect(x + w * .22, yy, w * (.25 + R() * .5), 3 * u); if (R() < .5) g.fillRect(x + w * .22, yy - 7 * u, 3 * u, 12 * u); }
    };
    L.forEach(l => {
      let x = -60 * u;
      while (x < W + 60 * u) {
        const w = (l.w0 + R() * (l.w1 - l.w0)) * u, mid = Math.abs((x + w / 2) / W - .5) * 2;
        let h = (l.h0 + R() * (l.h1 - l.h0)) * H; if (l.edges) h *= .5 + .85 * mid;
        const y = H * 1.03 - h, c = l.c, kind = R();
        const body = (bx, by, bw, bh) => { // un cuerpo de edificio con degradado y borde superior iluminado
          const gr = g.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, `rgb(${c[0] + 26},${c[1] + 16},${c[2] + 40})`); gr.addColorStop(1, `rgb(${c[0]},${c[1]},${c[2]})`);
          g.fillStyle = gr; g.fillRect(bx, by, bw + 1, bh);
          g.fillStyle = `rgba(255,110,190,${l.rim})`; g.fillRect(bx, by, bw + 1, 1.6 * u);
          g.fillStyle = `rgba(120,200,255,${l.rim * .5})`; g.fillRect(bx, by, 1.4 * u, bh);
          // ventanas: por plantas, cada planta con su propia probabilidad de tener luz (así se ven pisos encendidos y otros apagados)
          const cw = 11 * u, ch = 15 * u;
          for (let wy = by + 14 * u; wy < by + bh - 10 * u; wy += ch) {
            const pr = R() < .35 ? 0 : l.lit * R(), col = l.wc[(R() * l.wc.length) | 0];
            for (let wx = bx + 9 * u; wx < bx + bw - 11 * u; wx += cw) if (R() < pr) { g.globalAlpha = .35 + R() * .6; g.fillStyle = col; g.fillRect(wx, wy, 5.5 * u, 7.5 * u); }
          }
          g.globalAlpha = 1;
        };
        if (kind < .35) { // escalonado: cuerpo ancho + cuerpo más estrecho encima
          const h2 = h * (.2 + R() * .22), w2 = w * (.5 + R() * .25); body(x, y + h2, w, h - h2); body(x + (w - w2) * (R() < .5 ? .15 : .85) - w2 * .5 + w2 * .5, y, w2, h2 + 2);
        } else body(x, y, w, h);
        g.fillStyle = `rgb(${l.c[0] + 10},${l.c[1] + 6},${l.c[2] + 18})`;
        if (kind > .8) { g.beginPath(); g.moveTo(x + w * .5 - 3 * u, y); g.lineTo(x + w * .5, y - 70 * u * (.6 + R())); g.lineTo(x + w * .5 + 3 * u, y); g.fill(); } // aguja
        else if (R() < .5) g.fillRect(x + w * (.2 + R() * .6), y - 14 * u * (1 + R() * 2), 2.4 * u, 44 * u);                                           // antena
        if (R() < .25) { g.save(); g.shadowColor = '#ff2a2a'; g.shadowBlur = 12 * u; g.fillStyle = '#ff4a4a'; g.beginPath(); g.arc(x + w * (.2 + R() * .6), y - 12 * u, 2.2 * u, 0, 6.3); g.fill(); g.restore(); } // luz roja
        if (R() < l.sign && w > 80 * u) { const col = ['#ff2fa0', '#2fe6ff', '#ffe14a', '#7a5cff'][(R() * 4) | 0]; sign(x + w * (R() < .5 ? .06 : .72), y + h * (.12 + R() * .3), 24 * u + R() * 14 * u, 110 * u + R() * 120 * u, col); }
        x += w + (R() * 10 - 4) * u;
      }
      if (l.fog) { // bruma entre capas, rosada en el horizonte
        const f = g.createLinearGradient(0, H * .5, 0, H); f.addColorStop(0, 'rgba(255,60,150,0)'); f.addColorStop(1, `rgba(255,70,150,${l.fog * .65})`);
        g.fillStyle = f; g.fillRect(0, H * .5, W, H * .5);
      }
    });
    // calle mojada: brillo rosa en el suelo
    const st = g.createLinearGradient(0, H * .92, 0, H); st.addColorStop(0, 'rgba(255,50,150,0)'); st.addColorStop(1, 'rgba(255,50,150,.28)'); g.fillStyle = st; g.fillRect(0, H * .92, W, H * .08);
  }
  function rain(cv) {
    return loop(cv, (W, H) => ({ d: Array.from({ length: 240 }, () => ({ x: Math.random() * (W + 300), y: Math.random() * H, l: 14 + Math.random() * 34, v: 950 + Math.random() * 520, a: .1 + Math.random() * .3 })) }),
      (g, s, W, H, t, dt) => {
        const u = H / 1080, sx = .22; g.clearRect(0, 0, W, H); g.lineWidth = 1.1 * u; g.lineCap = 'round';
        for (let b = 0; b < 3; b++) {
          g.strokeStyle = `rgba(170,215,255,${.12 + b * .1})`; g.beginPath();
          for (let i = b; i < s.d.length; i += 3) {
            const d = s.d[i]; d.y += d.v * u * dt; d.x -= d.v * u * dt * sx;
            if (d.y > H + 40) { d.y = -40 - Math.random() * 100; d.x = Math.random() * (W + 300); }
            g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * u * sx, d.y - d.l * u);
          }
          g.stroke();
        }
        // destello lejano de un neón (parpadea)
        const fl = Math.max(0, Math.sin(t * 7.3) * Math.sin(t * 2.1)); g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(255,40,140,${.05 * fl})`; g.fillRect(0, H * .5, W, H * .5); g.globalCompositeOperation = 'source-over';
      }, 30);
  }

  // ───── Cosmos: nebulosa (ruido fractal en baja resolución, se amplía suave) y estrellas ─────
  const nebula = (() => {
    let cache = null;
    return () => {
      if (cache) return cache;
      const w = 480, h = 270, c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data, R = seeded(99), P = new Uint8Array(512);
      for (let i = 0; i < 256; i++) P[i] = i; for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0, t = P[i]; P[i] = P[j]; P[j] = t; } for (let i = 0; i < 256; i++) P[i + 256] = P[i];
      const sm = t => t * t * (3 - 2 * t), hv = (x, y) => P[P[x & 255] + (y & 255)] / 255;
      const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
        const a = hv(xi, yi), b = hv(xi + 1, yi), c2 = hv(xi, yi + 1), d2 = hv(xi + 1, yi + 1); return a + (b - a) * fx + (c2 - a) * fy + (a - b - c2 + d2) * fx * fy; };
      const fbm = (x, y) => { let s = 0, a = .5; for (let i = 0; i < 5; i++) { s += a * vn(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; a *= .5; } return s; };
      const mix = (a, b, t) => a + (b - a) * t, cl = (v, a, b) => Math.max(a, Math.min(b, v)), ss = (a, b, v) => sm(cl((v - a) / (b - a), 0, 1));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const px = x / w * 3.2, py = y / h * 1.8;
        const qx = fbm(px, py), qy = fbm(px + 5.2, py + 1.3), rr = fbm(px + 3.2 * qx, py + 3.2 * qy);
        const dens = ss(.34, .82, rr) * (.35 + .9 * qx), lane = ss(.45, .8, fbm(px * 1.7 + 9, py * 1.7 + 4));      // lane: vetas de polvo oscuro
        const hue = qy;                                                                                                   // el color cambia por zonas
        let r = mix(70, 215, ss(.25, .8, hue)) * dens, gg = mix(40, 70, hue) * dens, b = mix(215, 170, hue) * dens;
        r += 30 * ss(.6, 1, rr) * dens; gg += 55 * ss(.55, 1, qx) * dens;                                                  // núcleos más claros
        const k = 1 - .62 * lane * dens, vx = (x / w - .5) * 2, vy = (y / h - .5) * 2, vg = 1 - .55 * Math.min(1, (vx * vx + vy * vy) * .55);
        const i = (y * w + x) * 4; d[i] = cl(6 + r * k * vg, 0, 255); d[i + 1] = cl(4 + gg * k * vg, 0, 255); d[i + 2] = cl(22 + b * k * vg, 0, 255); d[i + 3] = 255;
      }
      g.putImageData(im, 0, 0); return (cache = c);
    };
  })();
  function stars(cv) { // estrellas fijas (una sola vez): miles de puntitos, unas cuantas con brillo y alguna con destellos en cruz
    const r = fit(cv), g = cv.getContext('2d'), W = innerWidth, H = innerHeight, u = H / 1080, R = seeded(7);
    g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, W, H);
    for (let i = 0; i < 1100; i++) { const z = Math.pow(R(), 3); g.globalAlpha = .25 + .75 * z; g.fillStyle = R() < .18 ? '#bcd4ff' : R() < .12 ? '#ffd9b0' : '#fff'; const s = (.6 + z * 1.7) * u; g.fillRect(R() * W, R() * H, s, s); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'lighter';
    const halo = sprite(64, [[0, 'rgba(255,255,255,.9)'], [.2, 'rgba(180,200,255,.35)'], [1, 'rgba(120,150,255,0)']]);
    for (let i = 0; i < 34; i++) { const x = R() * W, y = R() * H, s = (10 + R() * 22) * u; g.globalAlpha = .55 + R() * .4; g.drawImage(halo, x - s, y - s, s * 2, s * 2); }
    for (let i = 0; i < 6; i++) { // destello en cruz
      const x = W * (.1 + R() * .8), y = H * (.08 + R() * .6), s = (40 + R() * 60) * u;
      g.globalAlpha = .75; g.drawImage(halo, x - s * .5, y - s * .5, s, s);
      for (const [dx, dy] of [[1, 0], [0, 1]]) { const gr = g.createLinearGradient(x - dx * s * 1.4, y - dy * s * 1.4, x + dx * s * 1.4, y + dy * s * 1.4); gr.addColorStop(0, 'rgba(200,220,255,0)'); gr.addColorStop(.5, 'rgba(235,242,255,.85)'); gr.addColorStop(1, 'rgba(200,220,255,0)');
        g.fillStyle = gr; g.fillRect(x - (dx ? s * 1.4 : .6 * u), y - (dy ? s * 1.4 : .6 * u), dx ? s * 2.8 : 1.2 * u, dy ? s * 2.8 : 1.2 * u); }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  function twinkle(cv) {
    const halo = sprite(64, [[0, 'rgba(255,255,255,1)'], [.18, 'rgba(190,210,255,.6)'], [1, 'rgba(150,170,255,0)']]);
    return loop(cv, (W, H) => ({ s: Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * H * .92, r: 6 + Math.random() * 16, f: .4 + Math.random() * 1.4, ph: Math.random() * 6.28 })) }),
      (g, s, W, H, t) => { const u = H / 1080; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
        for (const p of s.s) { g.globalAlpha = Math.max(0, Math.sin(t * p.f + p.ph)) * .85; const r = p.r * u; g.drawImage(halo, p.x - r, p.y - r, r * 2, r * 2); }
        g.globalAlpha = 1; }, 24);
  }

  // ───── Sakura: pétalos que caen con el viento + la rama (SVG) ─────
  function petals(cv) {
    const col = ['255,214,228', '255,190,212', '255,160,192', '255,226,236'];
    const mk = (W, H, first) => ({ x: Math.random() * (W + 400), y: first ? Math.random() * H : -30 - Math.random() * 200, z: Math.random(), rot: Math.random() * 6.28, vr: (Math.random() - .5) * 2.2,
      fl: Math.random() * 6.28, vf: 1.2 + Math.random() * 2.2, sw: 14 + Math.random() * 30, ph: Math.random() * 6.28, c: col[(Math.random() * col.length) | 0] });
    return loop(cv, (W, H) => ({ p: Array.from({ length: 64 }, () => mk(W, H, true)) }),
      (g, s, W, H, t, dt) => {
        const u = H / 1080; g.clearRect(0, 0, W, H);
        s.p.forEach((p, i) => {
          const sp = 28 + 52 * p.z; p.y += sp * u * dt; p.x -= (22 + 34 * p.z) * u * dt + Math.sin(t * .8 + p.ph) * p.sw * u * dt * .5; p.rot += p.vr * dt; p.fl += p.vf * dt;
          if (p.y > H + 30 || p.x < -60) { s.p[i] = mk(W, H, false); return; }
          const sz = (5 + 11 * p.z) * u, fx = Math.cos(p.fl), a = .35 + .6 * p.z;
          g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(.45 + .55 * Math.abs(fx), 1); g.globalAlpha = a;
          const gr = g.createLinearGradient(0, -sz, 0, sz); gr.addColorStop(0, `rgba(${p.c},1)`); gr.addColorStop(1, 'rgba(255,120,160,.9)'); g.fillStyle = gr;
          g.beginPath(); g.moveTo(0, -sz); g.bezierCurveTo(sz * .95, -sz * .75, sz * .85, sz * .6, 0, sz); g.bezierCurveTo(-sz * .85, sz * .6, -sz * .95, -sz * .75, 0, -sz); g.closePath(); g.fill();
          g.restore();
        });
        g.globalAlpha = 1;
      });
  }
  function branch(W, H) { // rama de cerezo en flor, entra por la esquina de arriba a la derecha (sin tapar el centro). Devuelve un <svg>
    const R = seeded(2024), bl = [], tw = [];
    const blossom = (x, y, s) => { let o = ''; const rot = R() * 72;
      for (let k = 0; k < 5; k++) { const a = (rot + k * 72) * Math.PI / 180; o += `<circle cx="${(x + Math.cos(a) * s * .6).toFixed(1)}" cy="${(y + Math.sin(a) * s * .6).toFixed(1)}" r="${(s * .6).toFixed(1)}"/>`; }
      return `<g class="fl">${o}<circle class="ct" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(s * .24).toFixed(1)}"/></g>`; };
    const bud = (x, y, s) => `<circle class="bd" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(s * .42).toFixed(1)}"/>`;
    function grow(x, y, ang, len, wd, depth) {
      const pts = [[x, y]], n = Math.max(3, Math.round(len / 46)); let a = ang;
      for (let i = 0; i < n; i++) {
        a += (R() - .5) * .45 + .03; x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; pts.push([x, y]);
        if (x < W * .46 || y > H * .36) break;
        if (depth > 0 && i > 0 && R() < .5) grow(x, y, a + (R() < .5 ? -1 : 1) * (.5 + R() * .55), len * (.42 + R() * .22), wd * .6, depth - 1);
        if (depth <= 1 && R() < .55) bl.push(blossom(x + (R() - .5) * 26, y + (R() - .5) * 26, 9 + R() * 6));
        if (depth === 0 && R() < .4) bl.push(bud(x + (R() - .5) * 30, y + (R() - .5) * 30, 9));
      }
      tw.push(`<path d="M${pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L')}" stroke-width="${wd.toFixed(1)}"/>`);
      if (depth <= 1) for (let k = 0, m = 3 + ((R() * 3) | 0); k < m; k++) bl.push(blossom(x + (R() - .5) * 40, y + (R() - .5) * 40, 10 + R() * 7));
    }
    grow(W + 40, -30, 2.78, W * .4, 15, 3); grow(W * .95, -50, 2.2, H * .5, 9, 2); grow(W * .72, -40, 2.0, H * .34, 7, 2);
    return `<svg class="br" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMaxYMin slice"><g class="tw" fill="none" stroke-linecap="round" stroke-linejoin="round">${tw.join('')}</g><g class="bs">${bl.join('')}</g></svg>`;
  }

  return { res, fit, loop, sprite, seeded, dust, embers, skyline, rain, nebula, stars, twinkle, petals, branch };
})();
