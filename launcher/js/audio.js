// Sonido. Los efectos de menú y casi todas las intros se sintetizan con WebAudio; las de «actualizacion» (ps2, ps3, ps5) y la de «PS2 · Arranque» (ps2boot)
// son archivos wav en assets/sonidos (se pueden sustituir por otros, wav/mp3/ogg, en %APPDATA%\gameshell\sonidos o desde Sonidos → Cambiar el sonido…).
// Los wav se decodifican una vez y suenan por WebAudio, así el volumen puede subir de verdad y hay un limitador que evita saturar.
// Se eligen por separado: si suenan los menús, si suena la intro, QUÉ suena en la intro (la suya, la del estilo u otra) y el VOLUMEN de los menús y de la intro.
// Volumen: el 60 % es el nivel de siempre; la curva es cuadrática (como un regulador de verdad), de 0 % (silencio) a 100 % (+9 dB).
const Sound = (() => {
  let ctx = null, G = null, on = true, introOn = true, flavor = 'classic', forced = '', vol = .6, mvol = .6, wavs = {};
  const NZ = new WeakMap(), BUF = {};              // BUF: wav ya decodificados { nombre: AudioBuffer }
  const lvl = v => Math.pow(Math.max(0, Math.min(1, +v || 0)) / .6, 2);   // regulador → ganancia (0,6 → 1)
  const uiLevel = () => { if (G) { const k = lvl(mvol); G.ui.out.gain.value = k; G.ui.send.gain.value = k; } };

  // reverb: ruido con caída exponencial, más apagado según avanza (suena a sala grande, no a metal)
  const ir = (c, secs, decay) => {
    const n = (c.sampleRate * secs) | 0, b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const a = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) { const k = i / n; lp += ((Math.random() * 2 - 1) - lp) * (.9 - .8 * k); a[i] = lp * Math.pow(1 - k, decay) * 1.6; }
    }
    return b;
  };
  const noise = c => {
    if (NZ.has(c)) return NZ.get(c);
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    NZ.set(c, b); return b;
  };

  // cadena maestra: señal seca + envío a reverb, todo pasa por un compresor para que nada sature
  function graph(c) {
    const out = c.createGain(), send = c.createGain(), rv = c.createConvolver(), rg = c.createGain(), master = c.createGain(), comp = c.createDynamicsCompressor();
    rv.buffer = ir(c, 3.6, 2.4); rg.gain.value = .6; master.gain.value = .9;
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .3;
    out.connect(comp); send.connect(rv); rv.connect(rg); rg.connect(comp); comp.connect(master); master.connect(c.destination);
    const uo = c.createGain(), us = c.createGain(); uo.connect(out); us.connect(send);   // bus de los sonidos de menú (su volumen va aparte)
    return { out, send, master, rg, ui: { out: uo, send: us } };
  }
  const mk = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); G = graph(ctx); uiLevel(); } catch { ctx = null; }
    return ctx;
  };

  // ---- piezas básicas ----
  const wire = (c, B, v, wet) => {
    v.connect(B.out);
    if (wet > 0) { const w = c.createGain(); w.gain.value = wet; v.connect(w); w.connect(B.send); }
  };
  function voice(c, B, o) { // nota con ataque, sostén y caída
    const { f, t, d = .2, type = 'sine', g = .2, a = .01, r = .3, det = 0, f2 = 0, wet = .3, lp = 0 } = o, hold = Math.max(a, d);
    const osc = c.createOscillator(), v = c.createGain(); let n = osc;
    osc.type = type; osc.frequency.setValueAtTime(f, t); if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + hold + r);
    if (det) osc.detune.value = det;
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; osc.connect(fl); n = fl; }
    n.connect(v);
    v.gain.setValueAtTime(.0001, t); v.gain.linearRampToValueAtTime(g, t + a); v.gain.setValueAtTime(g, t + hold); v.gain.exponentialRampToValueAtTime(.0001, t + hold + r);
    wire(c, B, v, wet); osc.start(t); osc.stop(t + hold + r + .05);
  }
  function swell(c, B, o) { // colchón: sube despacio, se mantiene y se apaga; el filtro se va abriendo
    const { f, t, up = 2, hold = 0, down = 2, g = .1, type = 'sawtooth', det = 0, lp1 = 0, lp2 = 0, wet = .4 } = o;
    const osc = c.createOscillator(), v = c.createGain(); let n = osc;
    osc.type = type; osc.frequency.value = f; if (det) osc.detune.value = det;
    if (lp1) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = .6; fl.frequency.setValueAtTime(lp1, t); fl.frequency.exponentialRampToValueAtTime(lp2 || lp1, t + up); osc.connect(fl); n = fl; }
    n.connect(v);
    v.gain.setValueAtTime(.0001, t); v.gain.linearRampToValueAtTime(g, t + up); v.gain.setValueAtTime(g, t + up + hold); v.gain.exponentialRampToValueAtTime(.0001, t + up + hold + down);
    wire(c, B, v, wet); osc.start(t); osc.stop(t + up + hold + down + .05);
  }
  function bell(c, B, f, t, o = {}) { // campana: varios parciales que se apagan a distinta velocidad
    const { g = .1, dec = 2, wet = .55 } = o;
    [[1, 1, 1], [2.76, .5, .62], [5.4, .26, .38], [8.93, .13, .22]].forEach(([k, a, dk]) => { if (f * k < 12000) voice(c, B, { f: f * k, t, d: 0, a: .003, r: dec * dk, g: g * a, wet }); });
  }
  function whoosh(c, B, o) { // soplido de aire: ruido filtrado cuyo tono sube
    const { t, d = 1.2, f1 = 300, f2 = 4000, g = .12, q = 1.4, wet = .4 } = o;
    const s = c.createBufferSource(), bp = c.createBiquadFilter(), v = c.createGain();
    s.buffer = noise(c); s.loop = true; bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f1, t); bp.frequency.exponentialRampToValueAtTime(f2, t + d);
    v.gain.setValueAtTime(.0001, t); v.gain.linearRampToValueAtTime(g, t + d * .7); v.gain.linearRampToValueAtTime(.0001, t + d * 1.15);
    s.connect(bp); bp.connect(v); wire(c, B, v, wet); s.start(t); s.stop(t + d * 1.2 + .05);
  }

  // ---- intros (devuelven su duración en segundos) ----
  const R = {
    classic(c, B, t) {
      bell(c, B, 659.25, t + .25, { g: .09, dec: 1.7 }); bell(c, B, 987.77, t + .6, { g: .08, dec: 2.2 });
      [220, 277.18, 329.63].forEach(f => swell(c, B, { f, t, type: 'triangle', up: .9, hold: .3, down: 1.5, g: .04, wet: .6 }));
      return 2.9;
    },
    ps2(c, B, t) { // zumbido grave que crece + destellos + soplido + acorde final (La mayor con novena)
      [[55, 'sawtooth', -7, .05], [55, 'sawtooth', 7, .05], [82.41, 'triangle', 0, .09], [110, 'sine', 0, .1], [164.81, 'sine', 0, .06]]
        .forEach(([f, type, det, g]) => swell(c, B, { f, type, det, g, t, up: 3.1, hold: .15, down: 2.9, lp1: 130, lp2: 900 }));
      const N = [880, 1174.66, 1318.51, 1760, 2093, 2349.32, 2637, 3136];
      for (let i = 0, tt = .5; tt < 3.05; i++) { bell(c, B, N[(i * 3 + (i >> 1)) % N.length], t + tt, { g: .03 + tt * .012, dec: 1.7 }); tt += Math.max(.075, .44 - i * .04); }
      whoosh(c, B, { t: t + 1.5, d: 1.7, f1: 400, f2: 5200, g: .1, q: 1.2 });
      const T = t + 3.2;
      [110, 164.81, 220, 277.18, 329.63, 440, 554.37, 659.26, 987.77].forEach((f, i) => swell(c, B, { f, t: T, up: .16, hold: .5, down: 3, g: .05 - i * .003, type: i % 2 ? 'triangle' : 'sine', wet: .65 }));
      bell(c, B, 1318.51, T, { g: .1, dec: 3.4 }); bell(c, B, 659.26, T, { g: .09, dec: 3.6 }); bell(c, B, 220, T, { g: .1, dec: 4.4 });
      return 6.9;
    },
    ps3(c, B, t) { // golpe grave de campana + brillo que sube + acorde
      bell(c, B, 110, t + .2, { g: .17, dec: 5 }); swell(c, B, { f: 55, t, type: 'sine', up: .8, hold: .6, down: 3.2, g: .12, wet: .4 });
      whoosh(c, B, { t: t + .3, d: 1.9, f1: 600, f2: 6500, g: .07, q: 2 });
      [146.83, 220, 293.66, 369.99, 440].forEach(f => swell(c, B, { f, t: t + 1.8, up: .5, hold: .4, down: 2.6, g: .045, type: 'triangle', wet: .6 }));
      [2349.32, 3136, 3951].forEach((f, i) => bell(c, B, f, t + 2 + i * .13, { g: .035, dec: 2.6 }));
      return 5.3;
    },
    ps5(c, B, t) { // aire cálido que se abre + acorde suave + campanita de cristal
      swell(c, B, { f: 73.42, t, type: 'sine', up: 2.2, hold: .3, down: 2.6, g: .1, wet: .3 });
      [146.83, 220, 293.66, 369.99, 659.25].forEach((f, i) => swell(c, B, { f, t, type: i % 2 ? 'sine' : 'triangle', up: 2.1, hold: .4, down: 2.7, g: .04, lp1: 500, lp2: 2200, wet: .6 }));
      whoosh(c, B, { t: t + .2, d: 2.4, f1: 1100, f2: 8000, g: .05, q: .8, wet: .5 });
      bell(c, B, 1568, t + 2.4, { g: .06, dec: 2.4 }); bell(c, B, 2093, t + 2.62, { g: .045, dec: 2.4 });
      return 5.1;
    },
    neon(c, B, t) { // un tono por símbolo (△ ○ ✕ □) y acorde mayor
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { bell(c, B, f, t + .2 + i * .5, { g: .1, dec: 1.9 }); voice(c, B, { f: f / 2, t: t + .2 + i * .5, d: .03, r: .22, g: .05, type: 'triangle', wet: .3 }); });
      [130.81, 196, 261.63, 329.63, 392].forEach(f => swell(c, B, { f, t: t + 2.8, up: .25, hold: .6, down: 2.3, g: .045, type: 'triangle', wet: .6 }));
      bell(c, B, 2093, t + 2.9, { g: .06, dec: 2.8 });
      return 5.8;
    }
  };
  R.photo = R.ps2;

  // ---- efectos de menú (cada estilo les da un timbre distinto) ----
  const FL = { classic: [1, 'sine'], ps5: [1.12, 'sine'], ps3: [.9, 'sine'], ps2: [.72, 'triangle'], neon: [1.2, 'triangle'], aurora: [1.05, 'sine'], synth: [1, 'square'],
    ps4: [.96, 'sine'], cyber: [1.34, 'triangle'], cosmos: [.82, 'sine'], ember: [.68, 'triangle'], sakura: [1.26, 'sine'] };
  const UI = {
    move: [{ f: 1250, f2: 900, r: .05, g: .05 }],
    ok:   [{ f: 660, r: .09, g: .07 }, { f: 990, t: .07, r: .15, g: .07 }],
    back: [{ f: 760, f2: 520, r: .13, g: .06 }],
    open: [{ f: 880, r: .1, g: .05 }, { f: 1320, t: .06, r: .17, g: .045 }],
    key:  [{ f: 1700, f2: 1300, r: .04, g: .04 }],
    err:  [{ f: 190, f2: 140, d: .06, r: .13, g: .07, type: 'square', lp: 700 }]
  };

  // efecto de menú con el timbre de un estilo (fid). Lo usan ui() y sample()
  function playUi(name, fid) {
    const c = mk(), s = UI[name]; if (!c || !s) return;
    const [mul, type] = FL[fid] || FL.classic, t0 = c.currentTime + .005;
    for (const n of s) voice(c, G.ui, { type: n.type || type, d: 0, a: .004, wet: .12, ...n, f: n.f * (n.type ? 1 : mul), f2: n.f2 ? n.f2 * (n.type ? 1 : mul) : 0, t: t0 + (n.t || 0) });
  }

  // intro en archivo wav. Si ya está decodificado suena por WebAudio (volumen real + limitador); si no, con un elemento <audio> como siempre
  const WAVDUR = { ps2: 6.8, ps3: 7, ps5: 6, ps2boot: 9.2 };
  function wavIntro(name) {
    const b = BUF[name], c = b && mk();
    if (!c) return wavIntroEl(name);
    if (c.state === 'suspended') c.resume().catch(() => {});
    const src = c.createBufferSource(), g = c.createGain(), lim = c.createDynamicsCompressor();
    src.buffer = b; g.gain.value = .6 * lvl(vol);                       // con el 60 % suena igual que antes (volume = .6)
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .1;
    src.connect(g); g.connect(lim); lim.connect(c.destination); src.start(c.currentTime + .03);
    let stopped = false;
    return {
      dur: b.duration, fadeAtEnd: true, // si la imagen acaba antes que el sonido, se apaga suave
      stop(skipped) {
        if (stopped) return; stopped = true;
        const t = c.currentTime, d = skipped ? .35 : .9; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + d);
        try { src.stop(t + d + .05); } catch {}
      }
    };
  }
  function wavIntroEl(name) { // plan B: el wav no se pudo decodificar → elemento <audio> (volumen máximo 100 %)
    const url = wavs[name]; if (!url) return { dur: 0, stop() {} };
    let a = null;
    try { a = new Audio(url); a.volume = Math.min(1, .6 * lvl(vol)); a.play().catch(() => {}); } catch { return { dur: 0, stop() {} }; }
    return {
      dur: WAVDUR[name] || 6, fadeAtEnd: true,
      stop(skipped) {
        const v0 = a.volume, t0 = performance.now(), ms = skipped ? 350 : 900;
        const iv = setInterval(() => {
          const k = Math.min(1, (performance.now() - t0) / ms);
          try { a.volume = v0 * (1 - k); } catch {}
          if (k >= 1) { clearInterval(iv); try { a.pause(); } catch {} }
        }, 40);
      }
    };
  }

  return {
    enable(b) { on = !!b; },                         // sonidos de los menús sí/no
    introEnable(b) { introOn = !!b; },               // sonido de la intro sí/no
    volume(v) { vol = Math.max(0, Math.min(1, +v || 0)); }, // volumen de la intro (0..1; 0,6 = el de siempre)
    menuVolume(v) { mvol = Math.max(0, Math.min(1, +v || 0)); uiLevel(); }, // volumen de los sonidos de menú (0..1; 0,6 = el de siempre)
    flavor(id) { flavor = FL[id] ? id : 'classic'; },// timbre «del estilo»
    use(id) { forced = FL[id] ? id : ''; },          // timbre elegido en Sonidos ('' = el del estilo)
    get current() { return forced || flavor; },
    resume() { const c = mk(); if (c && c.state === 'suspended') c.resume().catch(() => {}); },
    ui(name) { if (on) playUi(name, forced || flavor); },
    sample(fid, name = 'ok') { if (on) playUi(name, fid); }, // oír un timbre sin cambiar nada (lista de Sonidos)
    wav(map) { wavs = map || {}; },                  // rutas de los wav: { ps2, ps3, ps5, ps2boot }
    async decode(name, bytes) { // decodifica un wav/mp3/ogg (bytes: Uint8Array/ArrayBuffer) para reproducirlo por WebAudio
      const c = mk(); if (!c || !bytes) return false;
      try { const ab = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); BUF[name] = await c.decodeAudioData(ab.slice(0)); return true; }
      catch { delete BUF[name]; return false; }
    },
    has(name) { return !!BUF[name]; },
    // oír el nivel de la intro al mover su regulador: dos campanitas por el mismo camino que la intro
    introSample() {
      if (!introOn) return; const c = mk(); if (!c) return;
      const bus = c.createGain(), sbus = c.createGain(); bus.connect(G.out); sbus.connect(G.send); bus.gain.value = sbus.gain.value = Math.min(2.4, lvl(vol));
      const t = c.currentTime + .03; bell(c, { out: bus, send: sbus }, 783.99, t, { g: .09, dec: 1.1 }); bell(c, { out: bus, send: sbus }, 1174.66, t + .17, { g: .08, dec: 1.4 });
    },
    // reproduce el sonido de una intro; src = 'classic' | 'ps2' | 'ps3' | 'ps5' | 'neon' | 'photo' (sintetizados) o 'wav:ps2' | 'wav:ps3' | 'wav:ps5' | 'wav:ps2boot'.
    // Devuelve { dur, stop(skipped) }
    intro(src) {
      if (!introOn || !src) return { dur: 0, stop() {} };
      if (String(src).startsWith('wav:')) return wavIntro(src.slice(4));
      const c = R[src] && mk(); if (!c) return { dur: 0, stop() {} };
      if (c.state === 'suspended') c.resume().catch(() => {});
      const bus = c.createGain(), sbus = c.createGain(); bus.connect(G.out); sbus.connect(G.send);
      bus.gain.value = sbus.gain.value = Math.min(2.4, lvl(vol)); // con el volumen por defecto (60 %) suena igual que siempre
      const dur = R[src](c, { out: bus, send: sbus }, c.currentTime + .08);
      return {
        dur,
        stop() { // al saltar la intro: se apaga todo, incluida la cola de reverb, y luego se restaura para los sonidos de menú
          const t = c.currentTime;
          [bus, sbus, G.rg].forEach(n => { n.gain.cancelScheduledValues(t); n.gain.setValueAtTime(n.gain.value, t); n.gain.linearRampToValueAtTime(0, t + .3); });
          setTimeout(() => { const n = c.currentTime; G.rg.gain.cancelScheduledValues(n); G.rg.gain.setValueAtTime(.6, n); }, 4000);
        }
      };
    },
    // para pruebas: renderiza una intro sin altavoces y devuelve las muestras
    async render(kind, extra = 1) {
      const sr = 44100, probe = new OfflineAudioContext(2, sr, sr), d = R[kind](probe, { out: probe.createGain(), send: probe.createGain() }, 0);
      const c = new OfflineAudioContext(2, Math.ceil(sr * (d + extra)), sr), B = graph(c);
      R[kind](c, B, 0);
      const buf = await c.startRendering();
      return { dur: d, sr, l: Array.from(buf.getChannelData(0)), r: Array.from(buf.getChannelData(1)) };
    },
    kinds: Object.keys(R),
    flavors: Object.keys(FL)
  };
})();
