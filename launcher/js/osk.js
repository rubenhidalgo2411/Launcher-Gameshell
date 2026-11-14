// Teclado en pantalla estilo PlayStation. Se usa con el mando (cruceta/stick + ✕ □ △ ○ START), con el ratón o con el teclado físico.
//   ✕ escribe la tecla · □ borra · △ espacio · ○ cancela · START acepta · L1/R1 mueven el cursor · L2 símbolos · R2 mayúsculas
const OSK = (() => {
  const $ = s => document.querySelector(s);
  const S = (t, w = 1) => ({ t, w });
  const C = s => [...s].map(c => ({ c, w: 1 }));
  const BOTTOM = [S('sym', 2), S('space', 5), S('eye'), S('cancel', 2), S('ok', 2)];
  const LAY = {
    abc: [[...C('1234567890'), S('bs', 2)], C('qwertyuiop@_'), C('asdfghjklñ-.'), [S('shift', 2), ...C('zxcvbnm,/:')], BOTTOM],
    sym: [[...C('1234567890'), S('bs', 2)], C('!"#$%&/()=?¿'), C('¡+*~^<>[]{}|'), [S('sym', 2), ...C("\\'`;:_-.,@")], BOTTOM]
  };
  const SVG = {
    bs: '<svg viewBox="0 0 24 24"><path d="M9 5h11a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>',
    shift: '<svg viewBox="0 0 24 24"><path d="M12 4l8 9h-5v7H9v-7H4z"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeoff: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>'
  };
  let st = null; // { layer, shift (0 no, 1 una letra, 2 fijo), r, c, o, inp, res }
  const rows = () => LAY[st.layer];

  function label(k) {
    if (k.c) return st.layer === 'abc' && st.shift ? k.c.toUpperCase() : k.c;
    switch (k.t) {
      case 'bs': return SVG.bs;
      case 'shift': return SVG.shift;
      case 'sym': return st.layer === 'abc' ? '?123' : 'abc';
      case 'space': return 'espacio';
      case 'eye': return st.o.pw ? (st.inp.type === 'password' ? SVG.eye : SVG.eyeoff) : '.';
      case 'cancel': return 'Cancelar';
      case 'ok': return st.o.ok || 'OK';
    }
  }
  function render() {
    $('#ks').innerHTML = rows().map((row, r) => `<div class="kr">${row.map((k, c) =>
      `<button class="k${k.t ? ' sp' : ''}${k.t === 'shift' && st.shift ? ' on' : ''}${k.t === 'shift' && st.shift === 2 ? ' lock' : ''}${k.t === 'ok' ? ' okk' : ''}" data-r="${r}" data-c="${c}" style="--w:${k.w}">${label(k)}</button>`).join('')}</div>`).join('');
    mark();
  }
  function mark() {
    const f = $('#ks .k.f'); if (f) f.classList.remove('f');
    const n = $(`#ks .k[data-r="${st.r}"][data-c="${st.c}"]`); if (n) n.classList.add('f');
  }

  // ---- edición (sobre el <input> real, así el cursor, el teclado físico y el pegado siguen funcionando) ----
  function put(s) {
    const i = st.inp, a = i.selectionStart, b = i.selectionEnd;
    if (st.o.max && i.value.length - (b - a) + s.length > st.o.max) return Sound.ui('err');
    i.setRangeText(s, a, b, 'end');
  }
  function del() {
    const i = st.inp, a = i.selectionStart, b = i.selectionEnd;
    if (a !== b) i.setRangeText('', a, b, 'end'); else if (a > 0) i.setRangeText('', a - 1, a, 'end');
  }
  const caret = d => { const i = st.inp, p = Math.max(0, Math.min(i.value.length, i.selectionStart + d)); i.setSelectionRange(p, p); };

  function press(k) {
    Sound.ui('key');
    switch (k.t) {
      case 'bs': return del();
      case 'shift': st.shift = (st.shift + 1) % 3; return render();
      case 'sym': st.layer = st.layer === 'abc' ? 'sym' : 'abc'; st.shift = 0; return render();
      case 'space': return put(' ');
      case 'eye': if (!st.o.pw) return put('.'); st.inp.type = st.inp.type === 'password' ? 'text' : 'password'; return render();
      case 'cancel': return finish(null);
      case 'ok': return finish(st.inp.value);
    }
    put(st.layer === 'abc' && st.shift ? k.c.toUpperCase() : k.c);
    if (st.shift === 1) { st.shift = 0; render(); }
  }

  // ---- movimiento por las teclas ----
  const ctr = (r, c) => { const row = rows()[r]; let x = 0; for (let i = 0; i < c; i++) x += row[i].w; return x + row[c].w / 2; };
  function move(a) {
    const R = rows();
    if (a === 'l' || a === 'r') { const n = R[st.r].length; st.c = (st.c + (a === 'r' ? 1 : n - 1)) % n; }
    else {
      const x = ctr(st.r, st.c); st.r = (st.r + (a === 'd' ? 1 : R.length - 1)) % R.length;
      let best = 0, bd = 1e9;
      R[st.r].forEach((_, i) => { const d = Math.abs(ctr(st.r, i) - x); if (d < bd) { bd = d; best = i; } });
      st.c = best;
    }
    mark();
  }

  function act(a) {
    if (!st) return;
    if (a === 'l' || a === 'r' || a === 'u' || a === 'd') { Sound.ui('move'); return move(a); }
    if (a === 'ok') return press(rows()[st.r][st.c]);
    if (a === 'back') return finish(null);
    if (a === 'sq') { Sound.ui('key'); return del(); }
    if (a === 'tri') { Sound.ui('key'); return put(' '); }
    if (a === 'start') return finish(st.inp.value);
    if (a === 'l1') return caret(-1);
    if (a === 'r1') return caret(1);
    if (a === 'l2') { st.layer = st.layer === 'abc' ? 'sym' : 'abc'; st.shift = 0; return render(); }
    if (a === 'r2') { st.shift = st.shift ? 0 : 1; return render(); }
  }

  function finish(v) {
    if (!st) return;
    const { res, inp } = st; st = null;
    inp.onkeydown = null; inp.blur(); inp.value = ''; // no se deja la contraseña escrita en el campo
    $('#pp').classList.remove('on');
    Sound.ui(v === null ? 'back' : 'ok');
    res(v);
  }

  // abre el teclado; devuelve el texto escrito o null si se cancela
  //   o = { pw: oculta lo escrito, value: texto inicial, max: longitud máxima, ok: texto de la tecla de aceptar }
  function open(title, o = {}) {
    if (st) finish(null);
    return new Promise(res => {
      const inp = $('#pi');
      st = { layer: 'abc', shift: 0, r: 1, c: 0, o, inp, res };
      $('#pt').textContent = title;
      inp.type = o.pw ? 'password' : 'text';
      if (o.max) inp.maxLength = o.max; else inp.removeAttribute('maxlength');
      inp.value = o.value || '';
      $('#pp').classList.add('on'); Sound.ui('open');
      render(); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
      inp.onkeydown = e => {
        if (e.key === 'Enter') { e.preventDefault(); finish(inp.value); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      };
    });
  }

  // ratón / pantalla táctil: no se roba el foco al campo de texto
  document.addEventListener('DOMContentLoaded', () => {
    const ks = $('#ks');
    ks.addEventListener('mousedown', e => e.preventDefault());
    ks.addEventListener('click', e => {
      const b = e.target.closest('.k'); if (!b || !st) return;
      st.r = +b.dataset.r; st.c = +b.dataset.c; mark(); press(rows()[st.r][st.c]);
      st.inp && st.inp.focus();
    });
    $('#oh').innerHTML = `<span>${GLYPH.x} Escribir</span><span>${GLYPH.q} Borrar</span><span>${GLYPH.t} Espacio</span><span>${GLYPH.o} Cancelar</span><span><b class="st">START</b> Aceptar</span>`;
  });

  return { open, act, cancel() { finish(null); }, get isOpen() { return !!st; } };
})();
