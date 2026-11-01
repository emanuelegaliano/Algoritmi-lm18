import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer, getSpeed, prefersReducedMotion } from 'texweb/client';
import { inversions } from '../list-update/model.js';
import './style.css';

// la lista di MOVE-TO-FRONT (sopra) e quella di FORSEE (sotto), con un segmento tra le due copie di
// ogni elemento: ogni incrocio è un'inversione. Gli elementi sono colorati in base agli insiemi BB, BA, AB
// rispetto all'elemento richiesto x, e MTF porta x in testa uno scambio alla volta: ogni scambio con un
// elemento di BB aggiunge un'inversione, ogni scambio con un elemento di BA ne toglie una

const SETS = { bb: 'BB', ba: 'BA', ab: 'AB', aa: 'dopo x in entrambe' };

export default defineWidget({
  name: 'inversions',
  params: {
    top: { type: 'list', default: [1, 2, 3, 4, 5, 6, 'x', 7, 8, 9, 10, 11] },
    bottom: { type: 'list', default: [4, 8, 5, 2, 10, 'x', 3, 7, 6, 1, 9, 11] },
    x: { type: 'string', default: 'x' },
    interval: { type: 'number', default: 1100, min: 300 },
  },

  mount(el, { top: top0, bottom: bottom0, x: x0, interval }) {
    el.classList.add('w-inv');
    const top = top0.map(String);
    const initialBottom = bottom0.map(String);
    let bottom = initialBottom, x = top.includes(x0) ? x0 : top[0];
    let sets, frames;

    function compute() {
      const bi = bottom.indexOf(x), ti = top.indexOf(x);
      sets = new Map(top.map((v) => {
        if (v === x) return [v, 'x'];
        const bt = top.indexOf(v) < ti, bf = bottom.indexOf(v) < bi;
        return [v, bt && bf ? 'bb' : bt ? 'ba' : bf ? 'ab' : 'aa'];
      }));
      // fotogramma k: x ha scavalcato i k elementi che lo precedevano più da vicino
      frames = [{ list: top, I: inversions(top, bottom) }];
      let cur = top;
      for (let k = 1; k <= ti; k++) {
        const p = cur.indexOf(x), y = cur[p - 1];
        cur = [...cur.slice(0, p - 1), x, y, ...cur.slice(p + 1)];
        frames.push({ list: cur, I: inversions(cur, bottom), y, delta: sets.get(y) === 'bb' ? 1 : -1 });
      }
    }

    const n = top.length, CELL = 46, X0 = 70, YT = 34, YB = 150;
    const W = X0 + n * CELL + 16, H = 190;
    const svg = svgRoot(W, H, { 'aria-label': 'Inversioni tra la lista di MTF e quella di FORSEE' });
    svg.append(
      s('text', { x: 14, y: YT, class: 'row-l' }, 'MTF'),
      s('text', { x: 14, y: YB, class: 'row-l' }, 'FORSEE'),
    );
    const cx = (j) => X0 + j * CELL + CELL / 2;
    const linesG = s('g'), cellsG = s('g');
    svg.append(linesG, cellsG);

    const lines = new Map(), topCells = new Map(), botCells = new Map();
    const mkCell = (v, row) => {
      const g = s('g', { class: 'cell', role: 'button', tabindex: 0, 'aria-label': `richiedi ${v}`,
        onclick: () => choose(v), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(v); } } }, [
        s('rect', { x: -CELL / 2 + 4, y: -16, width: CELL - 8, height: 32, rx: 4 }),
        s('text', { x: 0, y: 0 }, v),
      ]);
      cellsG.append(g);
      (row === 'T' ? topCells : botCells).set(v, g);
    };
    for (const v of top) {
      lines.set(v, s('line', { y1: YT + 16, y2: YB - 16, class: 'conn' }));
      linesG.append(lines.get(v));
      mkCell(v, 'T');
      mkCell(v, 'B');
    }

    // le celle di sopra si muovono insieme ai segmenti, quindi l'animazione è in JavaScript
    const shown = new Map();
    let raf = null;
    const setTop = (v, xx) => {
      shown.set(v, xx);
      topCells.get(v).setAttribute('transform', `translate(${xx}, ${YT})`);
      lines.get(v).setAttribute('x1', xx);
    };
    function moveTop(list) {
      cancelAnimationFrame(raf);
      const from = new Map(shown), to = new Map(list.map((v, j) => [v, cx(j)]));
      const dur = prefersReducedMotion() || !from.size ? 0 : 450 / getSpeed();
      const t0 = performance.now();
      const step = (now) => {
        const t = dur ? Math.min(1, (now - t0) / dur) : 1, e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        for (const [v, b] of to) setTop(v, (from.get(v) ?? b) + (b - (from.get(v) ?? b)) * e);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      if (dur) raf = requestAnimationFrame(step); else step(t0);
    }
    function placeBottom() {
      bottom.forEach((v, j) => {
        botCells.get(v).setAttribute('transform', `translate(${cx(j)}, ${YB})`);
        lines.get(v).setAttribute('x2', cx(j));
      });
    }

    const legend = h('div', { class: 'legend' }, Object.entries(SETS).map(([k, t]) => h('span', { class: `chip ${k}` }, [h('i'), t])));
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    function draw(nn) {
      const f = frames[nn];
      moveTop(f.list);
      for (const v of top) {
        const cls = sets.get(v);
        for (const g of [topCells.get(v), botCells.get(v)]) g.setAttribute('class', `cell ${cls}${f.y === v ? ' swapped' : ''}`);
        lines.get(v).setAttribute('class', `conn ${cls}`);
      }
      const count = (k) => [...sets.values()].filter((c) => c === k).length;
      const BB = count('bb'), BA = count('ba'), AB = count('ab');
      const last = frames.length - 1;
      if (nn === 0) {
        katex.render(`I(L^M_{i-1}, L^F_{i-1}) = ${f.I},\\qquad |BB| = ${BB},\\ |BA| = ${BA},\\ |AB| = ${AB}`, eq, { throwOnError: false });
        note.textContent = last
          ? `Richiesta a ${x}: ogni incrocio tra due segmenti è un'inversione. Gli elementi di BA e di AB sono quelli il cui segmento incrocia quello di ${x}. Clicca su un elemento per richiederlo.`
          : `${x} è già in testa alla lista di MTF: non ci sono scambi da fare. Clicca su un altro elemento per richiederlo.`;
      } else {
        const tail = nn === last ? `,\\qquad \\Delta I = |BB| - |BA| = ${BB} - ${BA} = ${f.I - frames[0].I}` : '';
        katex.render(`I = ${f.I} \\;(${f.delta > 0 ? '+1' : '-1'})${tail}`, eq, { throwOnError: false });
        note.textContent = f.delta > 0
          ? `Scambio con ${f.y} ∈ BB: prima ${f.y} precedeva ${x} in entrambe le liste, ora sono in disaccordo. Un'inversione in più.`
          : `Scambio con ${f.y} ∈ BA: prima le liste erano in disaccordo su ${f.y} e ${x}, ora ${x} lo precede in entrambe. Un'inversione in meno.`;
        if (nn === last) note.textContent += ` ${x} è in testa: in tutto le inversioni sono cambiate di |BB| − |BA|.`;
      }
    }

    compute();
    placeBottom();
    const player = createPlayer({ steps: frames.length, onStep: draw, interval });

    function choose(v) {
      x = v;
      compute();
      player.pause();
      player.setSteps(frames.length);
      player.go(0);
    }
    function shuffle() {
      const b = bottom.slice();
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      bottom = b;
      placeBottom();
      choose(x);
    }

    const btn = (text, onclick) => h('button', { type: 'button', class: 'seg-btn', onclick }, text);
    el.append(
      h('div', { class: 'controls' }, h('div', { class: 'seg' }, [
        btn('Mescola la lista di FORSEE', shuffle),
        btn('↺ Ripristina', () => { bottom = initialBottom; placeBottom(); choose(top.includes(x0) ? x0 : top[0]); }),
      ])),
      svg, legend, eq, note, player.el,
    );
  },
});
