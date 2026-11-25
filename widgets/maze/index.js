import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer } from 'texweb/client';
import { sc } from '../lib/util.js';
import { run, allWalls, parseWall, randomWalls, key } from './model.js';
import './style.css';

// La generazione di un labirinto senza cicli: i muri interni si considerano uno alla volta, e un muro
// si abbatte soltanto se separa due celle che stanno in insiemi diversi. Le celle dello stesso insieme
// hanno lo stesso colore (le celle ancora isolate restano bianche). Sotto la figura c'è l'elenco dei
// muri: sottolineati quelli abbattuti, nel riquadro quelli che restano.

const MACROS = { '\\FindSet': sc('Find-Set'), '\\Union': sc('Union') };
const tex = (src, el) => katex.render(src, el, { throwOnError: false, macros: { ...MACROS } });
const COLORS = 8;

export default defineWidget({
  name: 'maze',
  params: {
    size: { type: 'integer', default: 4, min: 2, max: 30 },
    // i muri nell'ordine in cui si considerano, ad esempio {6-7, 14-15, 4-8}; senza, un ordine casuale
    walls: { type: 'list', default: [] },
    seed: { type: 'integer', default: 1 },
    labels: { type: 'boolean', default: true },
    interval: { type: 'number', default: 1700, min: 30 },
  },

  mount(el, { size, walls: walls0, seed: seed0, labels, interval }) {
    el.classList.add('w-maze');
    const given = walls0.map((w) => parseWall(w, size)).filter(Boolean);
    let seed = seed0;
    let seq = given.length ? given : randomWalls(size, seed);
    const N = size * size;

    const S = Math.max(12, Math.min(46, Math.floor(400 / size)));
    const MX = labels && S >= 26 ? 70 : 24, MY = 14;
    const W = MX * 2 + size * S, H = MY * 2 + size * S;
    const svg = svgRoot(W, H, { 'aria-label': 'Generazione di un labirinto con le operazioni sugli insiemi disgiunti' });
    // al più 460 pixel di larghezza, così il labirinto e il player stanno insieme sullo schermo
    svg.style.maxWidth = `${Math.min(Math.round(W * 1.4), 460)}px`;
    const cx = (v) => MX + ((v - 1) % size) * S, cy = (v) => MY + Math.floor((v - 1) / size) * S;

    // le celle, con il loro numero
    const cellsG = s('g'), numsG = s('g'), cells = [];
    for (let v = 1; v <= N; v++) {
      const rect = s('rect', { x: cx(v), y: cy(v), width: S, height: S, class: 'mz-cell' });
      cellsG.append(rect);
      if (labels && S >= 26) numsG.append(s('text', { x: cx(v) + S / 2, y: cy(v) + S / 2, class: 'mz-num' }, String(v)));
      cells.push(rect);
    }
    // i muri interni e il bordo, con l'entrata a sinistra della cella 1 e l'uscita a destra dell'ultima
    const wallsG = s('g'), wallEl = new Map();
    for (const [a, b] of allWalls(size)) {
      const line = b === a + 1
        ? s('line', { x1: cx(b), y1: cy(b), x2: cx(b), y2: cy(b) + S })
        : s('line', { x1: cx(b), y1: cy(b), x2: cx(b) + S, y2: cy(b) });
      line.setAttribute('class', 'mz-wall');
      wallsG.append(line);
      wallEl.set(key(a, b), line);
    }
    const x0 = MX, y0 = MY, x1 = MX + size * S, y1 = MY + size * S;
    // il bordo è aperto a sinistra della cella 1 (l'entrata) e a destra dell'ultima cella (l'uscita)
    const border = s('path', { class: 'mz-border', d: `M${x0},${y0 + S} V${y1} H${x1} M${x1},${y1 - S} V${y0} H${x0}` });
    const path = s('polyline', { class: `mz-path${labels && S >= 26 ? ' mz-path-soft' : ''}` });
    svg.append(cellsG, path, numsG, wallsG, border);
    if (MX > 40) {
      svg.append(s('text', { x: x0 - 8, y: y0 + S / 2, class: 'mz-io', 'text-anchor': 'end' }, 'entrata'));
      svg.append(s('text', { x: x1 + 8, y: y1 - S / 2, class: 'mz-io', 'text-anchor': 'start' }, 'uscita'));
    }

    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });
    const chipsBox = h('div', { class: 'mz-chips' });
    let frames, chips = [];

    function compute() {
      frames = run(size, seq);
      // l'elenco dei muri ha senso solo se è corto, come nell'esempio con 16 celle
      chips = seq.length <= 40 ? seq.map(([a, b]) => h('span', { class: 'mz-chip' }, `(${a}, ${b})`)) : [];
      chipsBox.replaceChildren(...chips);
      chipsBox.hidden = !chips.length;
    }

    function draw(i) {
      const f = frames[i];
      const removed = new Set(f.removed), rejected = new Set(f.rejected);
      for (const [k, line] of wallEl) {
        const cur = k === f.cur;
        line.setAttribute('class', ['mz-wall', removed.has(k) && (cur ? 'mz-cur-ok' : 'mz-gone'), rejected.has(k) && (cur ? 'mz-cur-ko' : 'mz-kept')].filter(Boolean).join(' '));
      }
      cells.forEach((rect, j) => {
        const c = f.cells[j];
        const inPair = f.pair && f.pair.includes(j + 1);
        rect.setAttribute('class', ['mz-cell', c != null && `mz-c${c % COLORS}`, inPair && 'mz-pair'].filter(Boolean).join(' '));
      });
      if (f.done && f.path) {
        const pts = [[x0 - 3, cy(1) + S / 2], ...f.path.map((v) => [cx(v) + S / 2, cy(v) + S / 2]), [x1 + 3, cy(N) + S / 2]];
        path.setAttribute('points', pts.map((p) => p.join(',')).join(' '));
        path.classList.add('on');
      } else path.classList.remove('on');
      chips.forEach((chip, j) => {
        const k = key(...seq[j]);
        chip.className = ['mz-chip', j === f.step && 'cur', j <= f.step && (removed.has(k) ? 'ok' : rejected.has(k) ? 'ko' : ''), f.done && j > f.step && 'skip'].filter(Boolean).join(' ');
      });
      const parts = [];
      if (f.pair) {
        const [a, b] = f.pair;
        parts.push(f.ok ? `\\FindSet(${a}) \\ne \\FindSet(${b}) \\;\\Rightarrow\\; \\Union(${a}, ${b})` : `\\FindSet(${a}) = \\FindSet(${b})`);
      }
      parts.push(`\\text{muri abbattuti: } ${f.unions}`);
      eq.replaceChildren(...parts.map((p) => { const span = h('span', { class: 'eq-part' }); tex(p, span); return span; }));
      note.textContent = f.note;
    }

    compute();
    const player = createPlayer({ steps: frames.length, onStep: draw, interval });
    const restart = () => { compute(); player.pause(); player.setSteps(frames.length); player.play(); };
    const controls = h('div', { class: 'controls' }, h('div', { class: 'seg' }, [
      h('button', { type: 'button', class: 'seg-btn', title: 'Considera i muri in un nuovo ordine casuale',
        onclick: () => { seed = (seed * 48271 + 11) % 2147483647; seq = randomWalls(size, seed); restart(); } }, 'Nuovo labirinto'),
      given.length > 0 && h('button', { type: 'button', class: 'seg-btn', title: 'Torna all\'ordine dei muri di partenza',
        onclick: () => { seq = given; restart(); } }, '↺ Ripristina'),
    ]));
    el.append(controls, svg, chipsBox, eq, note, player.el);
  },
});
