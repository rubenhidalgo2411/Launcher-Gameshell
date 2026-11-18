'use strict';
// GameShell · intros2.js — seis intros nuevas, cada una con su sonido (assets/sonidos) y su CSS (css/intros2.css):
//   ps4-polvo        PS4 · Polvo de luz       motas de luz que se juntan en el centro y estallan con el acorde de campanas
//   cyber-glitch     Cyberpunk · Glitch       pantalla que se enciende, ciudad bajo la lluvia de neón y el nombre entra a trompicones
//   cosmos-orbita    Cosmos · Órbita          viaje a velocidad warp que frena en seco, nebulosa y una órbita alrededor del nombre
//   brasas-ignicion  Brasas · Ignición        chispas que suben cada vez más y el nombre se enciende como una brasa
//   sakura-petalos   Sakura · Pétalos         anochecer con luna, pétalos en el aire y el nombre al ritmo del koto
//   retro-arcade     Retro · Arcade           arranque de recreativa: rejilla, sol a bandas y «PULSA START»
// Todo se dibuja en píxeles CSS y las medidas llevan u = alto / 1080, igual que fxc.js, así se ven igual en 1080p que en 4K.
// Cada una se registra con Intro.add(id, { dur, fade, snd, cue, html, init }); init devuelve la función que para su canvas.
(() => {
  const TAU = Math.PI * 2;
  const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const esc = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
  const letters = s => { const a = [...String(s)]; return `<span class="ls" style="--n:${a.length}">${a.map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</span>`; };

  // ── PS4 · Polvo de luz ──────────────────────────────────────────────────────────────────────────────────────
  function polvo(cv) {
    const halo = FXC.sprite(64, [[0, 'rgba(240,248,255,1)'], [.2, 'rgba(160,198,255,.6)'], [1, 'rgba(90,140,255,0)']]), R = FXC.seeded(4040);
    return FXC.loop(cv, () => ({ p: Array.from({ length: 200 }, () => ({ a: R() * TAU, d: .1 + R() * .78, z: Math.pow(R(), 1.5), ph: R() * TAU, sp: .5 + R() })) }),
      (g, s, W, H, t) => {
        t = Math.max(0, t);                                 // (el primer fotograma puede traer un t algo negativo: Math.pow(negativo, fracción) da NaN)
        const u = H / 1080, cx = W / 2, cy = H * .5;
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
        const pull = sm(.9, 3.0, t), after = t > 3 ? 1 - Math.exp(-(t - 3) * 1.1) : 0, boom = t >= 3 ? Math.exp(-(t - 3) * 1.6) : 0;
        // resplandor del centro: crece mientras se juntan las motas y estalla con el acorde (segundo 3)
        const bl = sm(1.4, 3.0, t) * (.4 + .6 * Math.exp(-Math.max(0, t - 3) * .55)) + boom * .9;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, H * (.22 + .5 * sm(1.4, 3.3, t)));
        gr.addColorStop(0, `rgba(175,210,255,${Math.min(1, .5 * bl)})`); gr.addColorStop(.4, `rgba(60,110,230,${.17 * bl})`); gr.addColorStop(1, 'rgba(10,30,120,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        for (const p of s.p) {                              // las motas giran alrededor del centro, se juntan (pull) y vuelven a abrirse al estallar (after)
          const rad = p.d * H * .62, rr = rad * (1 - .94 * pull * (1 - after)) + H * .26 * p.z * boom, ang = p.a + t * (.12 + .28 * pull) * p.sp;
          const x = cx + Math.cos(ang) * rr * 1.3, y = cy + Math.sin(ang) * rr * .8, near = pull * (1 - after);
          const r = (2.5 + 9 * p.z) * u * (1 + 1.2 * near), al = Math.min(1, (.12 + .5 * p.z) * (.7 + .3 * Math.sin(t * (.7 + p.z) + p.ph)) * (1 + .9 * near));
          g.globalAlpha = al; g.drawImage(halo, x - r, y - r, r * 2, r * 2);
        }
        if (t >= 3) { g.globalAlpha = Math.exp(-(t - 3) * 2.4) * .4; g.strokeStyle = 'rgb(170,205,255)'; g.lineWidth = 2.5 * u; g.beginPath(); g.ellipse(cx, cy, H * .95 * (1 - Math.exp(-(t - 3) * 2.2)) * 1.3, H * .95 * (1 - Math.exp(-(t - 3) * 2.2)) * .8, 0, 0, TAU); g.stroke(); }
        g.globalAlpha = 1;
      }, 30);
  }

  // ── Cyberpunk · Glitch ──────────────────────────────────────────────────────────────────────────────────────
  function ciudad(cv) {
    const R = FXC.seeded(2077);
    return FXC.loop(cv, (W, H, g, r) => {
      const u = H / 1080, layers = [], off = document.createElement('canvas'); off.width = Math.round(W * r); off.height = Math.round(H * r);
      const o = off.getContext('2d'); o.setTransform(r, 0, 0, r, 0, 0);
      const sky = o.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0b0020'); sky.addColorStop(.55, '#2a0638'); sky.addColorStop(.82, '#7a1456'); sky.addColorStop(1, '#14031f'); o.fillStyle = sky; o.fillRect(0, 0, W, H);
      const glow = o.createRadialGradient(W / 2, H * .7, 0, W / 2, H * .7, H * .6); glow.addColorStop(0, 'rgba(255,60,160,.34)'); glow.addColorStop(1, 'rgba(255,60,160,0)'); o.fillStyle = glow; o.fillRect(0, 0, W, H);
      const lit = [], signs = [];
      for (let k = 0; k < 3; k++) {                         // tres capas de edificios: la de atrás más clara y baja, la de delante casi negra
        const sc = 1 - k * .2, tone = ['#1a0a30', '#0f0522', '#06010f'][k]; let x = -30 * u;
        while (x < W + 30 * u) {
          const w = (60 + R() * 120) * sc * u, h = (200 + R() * 520) * (1 - k * .18) * u, top = H * .96 - h; o.fillStyle = tone; o.fillRect(x, top, w, H);
          for (let wy = top + 14 * u; wy < H * .94; wy += 24 * u) for (let wx = x + 9 * u; wx < x + w - 9 * u; wx += 15 * u) if (R() < (k === 2 ? .2 : .13)) {
            const hue = R() < .5 ? 185 : R() < .6 ? 320 : 50, win = { x: wx, y: wy, w: 6 * u, h: 9 * u, hue, ph: R() * TAU, f: R() < .12 };
            if (win.f) lit.push(win); else { o.fillStyle = `hsla(${hue},100%,62%,${k === 2 ? .8 : .5})`; o.fillRect(wx, wy, win.w, win.h); }
          }
          if (k === 2 && R() < .3 && w > 90 * u) signs.push({ x: x + w * .15, y: top + h * (.12 + R() * .4), w: w * .7, h: 16 * u + R() * 14 * u, hue: R() < .5 ? 322 : 185, ph: R() * TAU });
          x += w + (3 + R() * 14) * u;
        }
      }
      const rain = Array.from({ length: 220 }, () => ({ x: R() * (W + 300), y: R() * H, l: 16 + R() * 30, v: 1000 + R() * 800 }));
      return { off, lit, signs, rain, u };
    }, (g, s, W, H, t, dt) => {
      t = Math.max(0, t); const u = s.u; g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.drawImage(s.off, 0, 0, W, H);
      const beat = t > .4 ? Math.pow(1 - ((t - .45) / .2143) % 1, 2.2) : 0, hit = t >= 2.6 ? Math.exp(-(t - 2.6) * 2.2) : 0;   // 140 BPM: una corchea cada 0,214 s; el golpe cae en el segundo 2,6
      g.globalCompositeOperation = 'lighter';
      for (const w of s.lit) { g.fillStyle = `hsla(${w.hue},100%,62%,${(.35 + .65 * Math.max(0, Math.sin(t * 7 + w.ph))) * .9})`; g.fillRect(w.x, w.y, w.w, w.h); }
      for (const n of s.signs) {                            // carteles de neón: laten con el ritmo y se encienden del todo con el golpe
        const k = .45 + .35 * beat + .6 * hit; g.shadowColor = `hsl(${n.hue},100%,60%)`; g.shadowBlur = 22 * u; g.fillStyle = `hsla(${n.hue},100%,68%,${Math.min(1, k)})`; g.fillRect(n.x, n.y, n.w, 5 * u); g.fillRect(n.x, n.y + n.h, n.w * .6, 5 * u);
      }
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(160,200,255,.35)'; g.lineWidth = 1.2 * u; g.beginPath();          // lluvia
      for (const d of s.rain) { d.y += d.v * u * dt; d.x -= d.v * .22 * u * dt; if (d.y > H) { d.y = -40; d.x = Math.random() * (W + 300); } g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * .22 * u, d.y - d.l * u); }
      g.stroke();
      if (hit > .01) { const f = g.createRadialGradient(W / 2, H * .6, 0, W / 2, H * .6, H * .8); f.addColorStop(0, `rgba(255,90,190,${.5 * hit})`); f.addColorStop(1, 'rgba(255,90,190,0)'); g.fillStyle = f; g.fillRect(0, 0, W, H); }
      g.globalCompositeOperation = 'source-over';
    }, 30);
  }

  // ── Cosmos · Órbita ─────────────────────────────────────────────────────────────────────────────────────────
  function warp(cv) {
    const R = FXC.seeded(1969), neb = FXC.nebula();
    return FXC.loop(cv, () => ({ st: Array.from({ length: 480 }, () => ({ x: (R() - .5) * 2.2, y: (R() - .5) * 2.2, z: .04 + R() * .96, c: R(), ph: R() * TAU })) }),
      (g, s, W, H, t, dt) => {
        t = Math.max(0, t);
        const u = H / 1080, cx = W / 2, cy = H / 2, f = H * .5;
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#01020a'; g.fillRect(0, 0, W, H);
        const na = sm(2.4, 4.8, t) * .62; if (na > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = na; const k = 1.1 + .03 * Math.sin(t * .25); g.drawImage(neb, -W * (k - 1) / 2, -H * (k - 1) / 2, W * k, H * k); g.globalAlpha = 1; }
        const v = t < 2.6 ? .22 + 2.5 * Math.pow(t / 2.6, 2.3) : .015 + 2.7 * Math.exp(-(t - 2.6) * 7);     // velocidad del viaje: sube hasta el segundo 2,6 y frena en seco
        g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        for (const p of s.st) {
          if (!isFinite(p.z)) p.z = 1;
          const dz = v * dt * (.55 + .7 * p.c), z0 = p.z + dz; p.z -= dz;
          if (p.z <= .03) { p.z = .96 + R() * .04; p.x = (R() - .5) * 2.2; p.y = (R() - .5) * 2.2; continue; }
          const x1 = cx + p.x / p.z * f, y1 = cy + p.y / p.z * f; if (x1 < -50 || x1 > W + 50 || y1 < -50 || y1 > H + 50) { p.z = .96; p.x = (R() - .5) * 2.2; p.y = (R() - .5) * 2.2; continue; }
          const x0 = cx + p.x / z0 * f, y0 = cy + p.y / z0 * f, b = Math.min(1, (1 - p.z) * 1.4 + .1), tw = t > 2.7 ? .75 + .25 * Math.sin(t * (1 + p.c * 2) + p.ph) : 1;
          g.strokeStyle = p.c > .86 ? `rgba(255,214,150,${b * tw})` : p.c < .3 ? `rgba(150,180,255,${b * tw})` : `rgba(235,240,255,${b * tw})`;
          g.lineWidth = (.7 + 2.1 * (1 - p.z)) * u; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 + .01, y1); g.stroke();
        }
        g.globalCompositeOperation = 'source-over';
      }, 30);
  }

  // ── Brasas · Ignición ───────────────────────────────────────────────────────────────────────────────────────
  function brasas(cv) {
    const tint = c => FXC.sprite(48, [[0, `rgba(${c},1)`], [.25, `rgba(${c},.6)`], [1, `rgba(${c},0)`]]);
    const sp = [tint('255,244,200'), tint('255,190,90'), tint('255,112,30'), tint('196,40,12')];
    return FXC.loop(cv, () => ({ p: [], acc: 0, flared: false }), (g, s, W, H, t, dt) => {
      t = Math.max(0, t); const u = H / 1080; g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
      const glow = .22 + .78 * sm(.5, 3.1, t) * (t < 3.1 ? 1 : .55 + .45 * Math.exp(-(t - 3.1) * .5));
      const gr = g.createLinearGradient(0, H, 0, H * .3); gr.addColorStop(0, `rgba(255,96,24,${.42 * glow})`); gr.addColorStop(.45, `rgba(150,28,6,${.15 * glow})`); gr.addColorStop(1, 'rgba(40,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const rate = t < 4.4 ? 8 + 130 * Math.pow(Math.sin(Math.PI * t / 4.4), 1.3) : 4 + 16 * Math.exp(-(t - 4.4));   // sigue el crepitar del sonido: más y más hasta el segundo 3 y luego se apaga
      s.acc += rate * dt;
      if (t >= 3 && !s.flared) { s.flared = true; s.acc += 90; }                                                      // llamarada del segundo 3
      while (s.acc >= 1) { s.acc--; s.p.push({ x: W * (.1 + .8 * Math.random()), y: H + 10 * u, vx: (Math.random() - .5) * 70 * u, vy: -(110 + Math.random() * 300) * u, age: 0, max: 1.8 + Math.random() * 3.4, r: (1.6 + Math.random() * 4.8) * u, ph: Math.random() * TAU }); }
      s.p = s.p.filter(p => (p.age += dt) < p.max && p.y > -30);
      for (const p of s.p) {
        const a = p.age / p.max; p.vx += Math.sin(t * 1.7 + p.ph) * 40 * u * dt; p.vy *= 1 - .22 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const r = p.r * (1 - .55 * a) * 3.2; g.globalAlpha = Math.pow(1 - a, 1.2) * (.7 + .3 * Math.sin(t * 9 + p.ph)); g.drawImage(sp[Math.min(3, a * 4 | 0)], p.x - r, p.y - r, r * 2, r * 2);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }, 30);
  }

  // ── registro ────────────────────────────────────────────────────────────────────────────────────────────────
  const cv = e => e.querySelector('canvas');
  const nm = o => esc(o.name);
  Intro.add('ps4-polvo', { dur: 6300, fade: 800, snd: 'wav:ps4-pulso', cue: [[3000, 'go2']],
    html: o => `<canvas class="pdc"></canvas><i class="pdl"></i><div class="nm pdn">${nm(o)}</div>`, init: e => polvo(cv(e)) });
  Intro.add('cyber-glitch', { dur: 5500, fade: 700, snd: 'wav:neotokio', cue: [[2100, 'go3'], [2600, 'go2']],
    html: o => `<canvas class="cyc"></canvas><div class="nm cyn" data-t="${nm(o)}">${nm(o)}</div><i class="cyu"></i><i class="cys"></i><i class="cyo"></i>`, init: e => ciudad(cv(e)) });
  Intro.add('cosmos-orbita', { dur: 7900, fade: 900, snd: 'wav:cosmos-eco', cue: [[2700, 'go2'], [3400, 'go3']],
    html: o => `<canvas class="coc"></canvas><svg class="cor" viewBox="-520 -230 1040 460"><g transform="rotate(-14)"><ellipse class="rg" rx="440" ry="150" pathLength="1"/><circle class="dt" r="7"><animateMotion begin="3.1s" dur="5.5s" repeatCount="indefinite" path="M440,0 A440,150 0 1,1 -440,0 A440,150 0 1,1 440,0"/></circle></g></svg><div class="nm con">${nm(o)}</div>`, init: e => warp(cv(e)) });
  Intro.add('brasas-ignicion', { dur: 6300, fade: 800, snd: 'wav:brasas', cue: [[2300, 'go2'], [3000, 'go3']],
    html: o => `<canvas class="bec"></canvas><div class="bef"></div><div class="nm ben">${nm(o)}</div>`, init: e => brasas(cv(e)) });
  Intro.add('sakura-petalos', { dur: 7000, fade: 900, snd: 'wav:sakura-koto', cue: [[3550, 'go2']],
    html: o => `<i class="spm"></i><div class="spb"></div><canvas class="spc"></canvas><div class="nm spn">${letters(o.name)}</div><i class="spl"></i>`,
    init: e => { e.querySelector('.spb').innerHTML = FXC.branch(innerWidth, innerHeight); return FXC.petals(cv(e)); } });
  Intro.add('retro-arcade', { dur: 4800, fade: 700, snd: 'wav:retro-8bits', cue: [[720, 'go2'], [2100, 'go3']],
    html: o => `<div class="rsk"></div><div class="rsn"></div><div class="rgd"></div><div class="nm rnm">${letters(o.name)}</div><div class="rps">PULSA START</div><i class="rsc"></i><i class="rcr"></i>` });
})();
