import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer } from 'texweb/client';
import './style.css';

// un accesso con MOVE-TO-FRONT, un passo alla volta: prima la ricerca sequenziale (un elemento
// esaminato per passo), poi gli scambi adiacenti che portano l'elemento in testa. Il costo cresce
// di 1 a ogni passo nel modello uniforme, mentre nel modello standard gli scambi sono gratuiti.
// Un clic su un elemento lo richiede, a partire dalla lista lasciata dall'accesso precedente

export default defineWidget({
  name: 'mtf-access',
  params: {
    list: { type: 'list', default: ['a', 'b', 'c', 'd', 'e'] },
    x: { type: 'string', default: 'd' },
    model: { type: 'enum', values: ['uniforme', 'standard'], default: 'uniforme' },
    interval: { type: 'number', default: 1100, min: 300 },
  },

  mount(el, { list: list0, x: x0, model: model0, interval }) {
    el.classList.add('w-mtfa');
    const initial = list0.map(String);
    let base = initial, x = initial.includes(x0) ? x0 : initial[initial.length - 1], model = model0;
    let p, frames;

    // fotogramma 0: niente esaminato; k = 1..p: esaminati i primi k; p + j: dopo j scambi
    function compute() {
      p = base.indexOf(x) + 1;
      frames = [{ list: base, seen: 0, swaps: 0 }];
      for (let k = 1; k <= p; k++) frames.push({ list: base, seen: k, swaps: 0 });
      let cur = base;
      for (let j = 1; j < p; j++) {
        const i = cur.indexOf(x);
        cur = [...cur.slice(0, i - 1), x, cur[i - 1], ...cur.slice(i + 1)];
        frames.push({ list: cur, seen: p, swaps: j, partner: cur[i] });
      }
    }

    const n = initial.length, CELL = 50, X0 = 20, Y = 62;
    const svg = svgRoot(X0 * 2 + n * CELL, 110, { 'aria-label': 'Un accesso con Move-To-Front: ricerca e scambi' });
    const cx = (j) => X0 + j * CELL + CELL / 2;
    const pointer = s('path', { d: 'M -7 0 L 7 0 L 0 -10 Z', class: 'pointer' });
    const phase = s('text', { x: X0, y: 16, class: 'phase' });
    svg.append(phase, pointer);
    const cells = new Map(initial.map((v) => {
      const g = s('g', { class: 'cell', role: 'button', tabindex: 0, 'aria-label': `richiedi ${v}`,
        onclick: () => request(v), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); request(v); } } }, [
        s('rect', { x: -CELL / 2 + 3, y: -18, width: CELL - 6, height: 36, rx: 4 }),
        s('text', { x: 0, y: 0 }, v),
      ]);
      svg.append(g);
      return [v, g];
    }));

    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    function draw(k) {
      const f = frames[k];
      f.list.forEach((v, j) => {
        const g = cells.get(v);
        g.style.transform = `translate(${cx(j)}px, ${Y}px)`;
        const pos = base.indexOf(v) + 1;
        g.classList.toggle('seen', v !== x && f.swaps === 0 && pos <= f.seen);
        g.classList.toggle('cur', f.swaps === 0 && pos === f.seen && v !== x);
        g.classList.toggle('req', v === x);
        g.classList.toggle('found', v === x && f.seen === p);
        g.classList.toggle('partner', v === f.partner);
      });
      const scanning = f.seen > 0 && f.swaps === 0;
      pointer.classList.toggle('hidden', !scanning);
      if (scanning) pointer.style.transform = `translate(${cx(f.seen - 1)}px, ${Y + 32}px)`;
      phase.textContent = f.seen === 0 ? `richiesta: ${x}` : f.swaps === 0 ? `fase 1: ricerca di ${x}` : `fase 2: scambio ${f.swaps} di ${p - 1}`;

      const sCost = model === 'uniforme' ? f.swaps : 0;
      const cost = f.seen + sCost;
      let tex;
      if (f.seen === 0) tex = `r_L(${x}) = ${p}`;
      else if (f.swaps === 0) tex = f.seen < p
        ? `\\text{elementi esaminati} = ${f.seen},\\qquad \\text{costo} = ${cost}`
        : `p = r_L(${x}) = ${p},\\qquad \\text{costo} = ${cost}`;
      else tex = `\\text{costo} = p + s = ${p} + ${sCost} = ${cost}`;
      if (k === frames.length - 1 && p > 1) tex += model === 'uniforme' ? `\\qquad (= 2p - 1)` : `\\qquad (= p)`;
      katex.render(tex, eq, { throwOnError: false });

      note.textContent = f.seen === 0
        ? `Si cerca ${x} scorrendo la lista da sinistra a destra. Clicca su un elemento per richiederne un altro.`
        : f.swaps === 0
          ? (f.seen < p ? `Esaminato ${base[f.seen - 1]}: non è ${x}, si passa al successivo. Ogni elemento esaminato costa 1.`
            : `Trovato ${x} in posizione ${p}: l'accesso costa ${p}.${p === 1 ? ' È già in testa, non servono scambi.' : ''}`)
          : `${x} si scambia con ${f.partner}, che scende di una posizione. `
            + (model === 'uniforme' ? 'Nel modello uniforme lo scambio costa 1.' : 'Nel modello standard lo spostamento in testa è gratuito.')
            + (f.swaps === p - 1 ? ` ${x} è in testa: la prossima richiesta parte da questa lista.` : '');
    }

    compute();
    const player = createPlayer({ steps: frames.length, onStep: draw, interval });

    function restart() { compute(); player.pause(); player.setSteps(frames.length); player.go(0); player.play(); }
    function request(v) {
      // il nuovo accesso parte dalla lista lasciata da quello precedente
      base = frames[frames.length - 1].list;
      x = v;
      restart();
    }

    const btn = (text, onclick, cls = '') => h('button', { type: 'button', class: `seg-btn ${cls}`, onclick }, text);
    const models = ['uniforme', 'standard'].map((m) => btn(`modello ${m}`, () => {
      model = m;
      models.forEach((b, i) => b.classList.toggle('on', ['uniforme', 'standard'][i] === m));
      draw(player.index);
    }, m === model ? 'on' : ''));
    el.append(
      h('div', { class: 'controls' }, [
        h('div', { class: 'seg' }, models),
        h('div', { class: 'seg' }, btn('↺ Ripristina', () => { base = initial; x = initial.includes(x0) ? x0 : initial[n - 1]; restart(); })),
      ]),
      svg, eq, note, player.el,
    );
  },
});
