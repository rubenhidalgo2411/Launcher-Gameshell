'use strict';
// Intro «PS2 · Arranque»: recreación del arranque de la PlayStation 2. Barras translúcidas que salen de la oscuridad en perspectiva, un resplandor
// azul en el centro, puntitos de luz de colores y el texto en medio. Es una escena 3D sencilla (proyección propia en canvas 2D) y TODO es función
// del tiempo: draw(t) pinta el fotograma del segundo t, sin estado, así se puede comprobar cualquier momento. El sonido va aparte (assets/sonidos/ps2boot.wav).
const PS2Boot = (() => {
  const TAU = Math.PI * 2, IMPACT = 4.6;                          // IMPACT: el golpe grave del sonido y el destello de la imagen
  const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  function create(cv) {
    const g = cv.getContext('2d'), R = FXC.seeded(20001204);
    // barras: salen en abanico alrededor del eje de la cámara; casi paralelas entre sí (con una ligera inclinación) y giradas sobre su eje
    const bars = Array.from({ length: 28 }, () => {
      const ang = R() * TAU, rad = .9 + Math.pow(R(), .8) * 3.7;
      return { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * .72, z: 3.6 + R() * 9.5, len: 1.5 + R() * 3.4, w: .12 + R() * .1,
        tx: (R() - .5) * .2, ty: (R() - .5) * .2, roll: R() * 1.57, delay: R() * 2.4, tone: R() < .3 ? .3 + R() * .2 : .62 + R() * .3 };
    });
    const dots = ['#2dff6a', '#ff3434', '#5c5aff', '#ffe04a', '#35ff7a', '#ff4040', '#9a86ff'].map(c => ({ c, x: (R() - .5) * 5.2, y: (R() - .5) * 3.2, z: 1.8 + R() * 9, ph: R() * TAU, f: .5 + R() * 1.1 }));
    const blobs = Array.from({ length: 18 }, () => ({ a: R() * TAU, r: R() * .2, s: .05 + R() * .15, k: .22 + R() * .5, sp: (R() - .5) * .3, h: 226 + R() * 36 }));
    const halo = FXC.sprite(64, [[0, 'rgba(255,255,255,1)'], [.2, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]);
    const dotSp = {}; dots.forEach(d => { dotSp[d.c] = FXC.sprite(64, [[0, '#fff'], [.18, d.c], [.5, d.c + '55'], [1, d.c + '00']]); });
    const gc = document.createElement('canvas'); gc.width = gc.height = 64; // grano: bloques de ruido, como la compresión de la imagen original
    { const x = gc.getContext('2d'), im = x.createImageData(64, 64); for (let i = 0; i < im.data.length; i += 4) { const v = R() < .5 ? 0 : 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = R() * 64; } x.putImageData(im, 0, 0); }
    let grain = null;

    function draw(t) {
      const W = cv.width, H = cv.height, cx = W / 2, cy = H * .485, f = H * .8, S = H / 1080;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      if (!grain) { grain = g.createPattern(gc, 'repeat'); try { grain.setTransform(new DOMMatrix().scale(Math.max(1, S * 1.6))); } catch {} }
      const hit = Math.exp(-Math.max(0, t - IMPACT) * 2.4) * (t >= IMPACT ? 1 : 0), glowK = sm(.2, 2.6, t) * (.8 + .35 * sm(IMPACT - .6, IMPACT, t)) + hit * .5;

      // resplandor azul del centro: un halo ancho y varias manchas que se mueven despacio (como las nubes de la imagen original)
      g.globalCompositeOperation = 'lighter';
      let gr = g.createRadialGradient(cx, cy, 0, cx, cy, H * .46); gr.addColorStop(0, `rgba(34,52,220,${.15 * glowK})`); gr.addColorStop(.4, `rgba(20,28,140,${.07 * glowK})`); gr.addColorStop(1, 'rgba(8,10,60,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (const b of blobs) {
        const a = b.a + t * b.sp, x = cx + Math.cos(a) * b.r * H * 1.1, y = cy + Math.sin(a * 1.3) * b.r * H * .7, r = b.s * H * 1.5, k = b.k * glowK * (.7 + .3 * Math.sin(t * .8 + b.a * 5));
        const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, `hsla(${b.h},90%,56%,${.2 * k})`); q.addColorStop(1, `hsla(${b.h},90%,40%,0)`); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      gr = g.createRadialGradient(cx, cy, 0, cx, cy, H * .16); gr.addColorStop(0, `rgba(130,150,255,${.1 * glowK})`); gr.addColorStop(1, 'rgba(90,110,255,0)'); g.fillStyle = gr; g.fillRect(cx - H * .2, cy - H * .2, H * .4, H * .4);

      // cámara: avanza despacio (y se lanza tras el golpe) con un ligero vaivén
      const zc = .3 * t + Math.pow(Math.max(0, t - IMPACT), 1.7) * .1, yaw = .05 * Math.sin(t * .4), pit = .035 * Math.sin(t * .31 + 1), cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
      const cam = p => { let X = p[0], Y = p[1], Z = p[2] - zc; const X2 = X * cyw + Z * syw, Z2 = -X * syw + Z * cyw; const Y2 = Y * cp - Z2 * sp; return [X2, Y2, Y * sp + Z2 * cp]; };
      const NEAR = .32, proj = p => [cx + f * p[0] / p[2], cy + f * p[1] / p[2]];
      const clip = poly => { // recorta un polígono (en espacio de cámara) contra el plano cercano
        const o = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], ia = a[2] >= NEAR, ib = b[2] >= NEAR;
          if (ia) o.push(a); if (ia !== ib) { const k = (NEAR - a[2]) / (b[2] - a[2]); o.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, NEAR]); } } return o; };

      // puntitos de luz de colores
      for (const d of dots) {
        const p = cam([d.x + Math.sin(t * .2 + d.ph) * .3, d.y + Math.cos(t * .17 + d.ph) * .25, d.z]); if (p[2] < NEAR) continue;
        const s = proj(p), r = (11 + 6 * Math.sin(t * d.f + d.ph)) * S * (1.6 / Math.max(.8, p[2] * .45)), a = sm(1.2, 2.4, t) * (.5 + .5 * Math.sin(t * d.f * 1.7 + d.ph)) * (1 - sm(9, 15, p[2]));
        g.globalAlpha = Math.min(1, a * 1.3); g.drawImage(dotSp[d.c], s[0] - r, s[1] - r, r * 2, r * 2);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

      // barras, de las lejanas a las cercanas
      const list = [];
      for (const b of bars) {
        const ap = sm(b.delay + .5, b.delay + 2.5, t); if (ap <= 0) continue;
        const a = norm([b.tx, b.ty, 1]), u0 = norm(cross(a, [0, 1, 0])), v0 = cross(a, u0), cr = Math.cos(b.roll), sr = Math.sin(b.roll);
        const u1 = [u0[0] * cr + v0[0] * sr, u0[1] * cr + v0[1] * sr, u0[2] * cr + v0[2] * sr], u2 = cross(a, u1);
        const P0 = [b.x, b.y, b.z], ends = [P0, [P0[0] + a[0] * b.len, P0[1] + a[1] * b.len, P0[2] + a[2] * b.len]], C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
        const cs = ends.map(E => C.map(([i, j]) => cam([E[0] + (u1[0] * i + u2[0] * j) * b.w, E[1] + (u1[1] * i + u2[1] * j) * b.w, E[2] + (u1[2] * i + u2[2] * j) * b.w])));
        const zn = Math.min(...cs[0].map(p => p[2])), zf = Math.max(...cs[1].map(p => p[2])); if (zf < NEAR) continue;
        list.push({ b, cs, ap, key: zn, ctr: cam([(P0[0] + ends[1][0]) / 2, (P0[1] + ends[1][1]) / 2, (P0[2] + ends[1][2]) / 2]) });
      }
      list.sort((p, q) => q.key - p.key);
      for (const { b, cs, ap, ctr } of list) {
        const faces = [{ pts: cs[0], cap: true }, { pts: cs[1].slice().reverse(), cap: true }];
        for (let k = 0; k < 4; k++) faces.push({ pts: [cs[0][k], cs[0][(k + 1) % 4], cs[1][(k + 1) % 4], cs[1][k]], cap: false, k });
        for (const F of faces) {
          let c = [0, 0, 0]; F.pts.forEach(p => { c = [c[0] + p[0] / 4, c[1] + p[1] / 4, c[2] + p[2] / 4]; });
          let n = norm(cross(sub(F.pts[1], F.pts[0]), sub(F.pts[2], F.pts[0]))); if (dot(n, sub(c, ctr)) < 0) n = [-n[0], -n[1], -n[2]];
          const toCam = norm([-c[0], -c[1], -c[2]]), face = dot(n, toCam); if (face <= 0) continue;                    // cara que mira hacia otro lado: no se ve
          const poly = clip(F.pts); if (poly.length < 3) continue;
          const fog = sm(.3, 1.5, c[2]) * (1 - sm(8, 14, c[2])), lum = (.3 + .7 * Math.pow(face, .75)) * b.tone, al = ap * fog; if (al < .01) continue;
          const col = F.cap ? [188, 202, 244] : [82, 106, 186], rgb = k => `rgba(${col.map(v => Math.round(v * lum * k)).join(',')}`, sp2 = poly.map(proj);
          g.beginPath(); sp2.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
          if (F.cap) { g.fillStyle = rgb(1) + `,${al * .95})`; g.fill(); }
          else { // las caras laterales se desvanecen hacia el fondo de la barra (donde se pierde en el resplandor)
            const m0 = proj([(F.pts[0][0] + F.pts[1][0]) / 2, (F.pts[0][1] + F.pts[1][1]) / 2, Math.max(NEAR, (F.pts[0][2] + F.pts[1][2]) / 2)]), m1 = proj([(F.pts[2][0] + F.pts[3][0]) / 2, (F.pts[2][1] + F.pts[3][1]) / 2, Math.max(NEAR, (F.pts[2][2] + F.pts[3][2]) / 2)]);
            const lg = g.createLinearGradient(m0[0], m0[1], m1[0], m1[1]); lg.addColorStop(0, rgb(1) + `,${al * .9})`); lg.addColorStop(1, rgb(.55) + `,${al * .5})`); g.fillStyle = lg; g.fill();
          }
          if (F.cap && grain) { g.save(); g.clip(); g.globalAlpha = al * .55; g.fillStyle = grain; g.fill(); g.restore(); g.globalAlpha = 1; }
          if (F.cap) { g.lineWidth = Math.max(1, S * 1.1); g.strokeStyle = `rgba(235,242,255,${al * .4})`; g.stroke(); }
        }
      }

      // golpe: destello suave y una onda que se abre desde el centro
      if (hit > .01) {
        g.globalCompositeOperation = 'lighter';
        const q = g.createRadialGradient(cx, cy, 0, cx, cy, H * .8); q.addColorStop(0, `rgba(140,165,255,${.2 * hit})`); q.addColorStop(1, 'rgba(60,80,255,0)'); g.fillStyle = q; g.fillRect(0, 0, W, H);
        const rr = (t - IMPACT) * H * .75; g.lineWidth = 2 * S; g.strokeStyle = `rgba(170,200,255,${.18 * hit})`; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke();
        g.globalCompositeOperation = 'source-over';
      }
    }

    return { draw };
  }

  // arranca la animación en un canvas; devuelve la función que la para
  function start(cv) {
    const r = FXC.fit(cv), sc = create(cv), t0 = performance.now(); let raf = 0, alive = true;
    const rs = () => FXC.fit(cv); addEventListener('resize', rs);
    const tick = now => { if (!alive) return; sc.draw((now - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', rs); };
  }
  return { create, start, IMPACT };
})();
