import katex from 'katex';
import { defineWidget, h, svgRoot, createPlayer } from 'texweb/client';
import { sc } from '../lib/util.js';
import { createForestView } from '../lib/forest-view.js';
import { run, parseOp, layout, DIM, fmtKey } from './heap.js';
import './style.css';

// Un heap di Fibonacci su cui si eseguono Insert, Minimum, Extract-Min, Decrease-Key e Delete, un passo
// alla volta, con i puntatori dello pseudocodice (z, w, x, y) e l'array A di Consolidate. I nodi marcati
// sono neri, come nelle figure del libro. Sotto la figura: il numero di nodi, di alberi e di nodi marcati,
// e il potenziale Phi(H) = t(H) + 2 m(H).

const OPS = { insert: 'Fib-Heap-Insert', minimum: 'Minimum', 'extract-min': 'Fib-Heap-Extract-Min', 'decrease-key': 'Fib-Heap-Decrease-Key', delete: 'Fib-Heap-Delete' };
const BTN = { insert: 'Insert', 'extract-min': 'Extract-Min', 'decrease-key': 'Decrease-Key', delete: 'Delete' };
const CH = 7; // larghezza media di un carattere delle etichette, per affiancarle
const ROW = 22; // distanza tra il centro di una radice e la riga dei puntatori
const MIN_UP = 40; // distanza tra il centro di una radice e la scritta min[H]

function opTex(op) {
  const name = sc(OPS[op.type]);
  if (op.type === 'insert') return `${name}(H, ${op.a})`;
  if (op.type === 'decrease-key') return `${name}(H, x, ${op.b}),\\ \\mathit{key}[x] = ${op.a}`;
  if (op.type === 'delete') return `${name}(H, x),\\ \\mathit{key}[x] = ${op.a}`;
  return `${name}(H)`;
}
const phi = (f) => f.t + 2 * f.m;

export default defineWidget({
  name: 'fibonacci-heap',
  params: {
    // la lista delle radici, ogni albero come (chiave figli...), con * dopo la chiave dei nodi marcati
    heap: { type: 'string', default: '' },
    // ad esempio {insert 21, extract-min, decrease-key 46 15, delete 35}
    ops: { type: 'list', default: [] },
    // le operazioni che il lettore può eseguire
    actions: { type: 'list', default: ['insert', 'extract-min', 'decrease-key', 'delete'] },
    interval: { type: 'number', default: 1900, min: 300 },
  },

  mount(el, { heap, ops: ops0, actions: actions0, interval }) {
    el.classList.add('w-forest', 'w-fibheap');
    const initialOps = ops0.map(String).filter(parseOp);
    let ops = initialOps;
    const actions = actions0.map((a) => String(a).toLowerCase()).filter((a) => BTN[a]);

    let selected = null; // l'id del nodo scelto con un clic
    const svg = svgRoot(400, 200, { 'aria-label': 'Heap di Fibonacci: i passi di ogni operazione, uno alla volta' });
    const view = createForestView(svg, {
      radius: DIM.r,
      onClick: actions.length ? (id) => {
        if (!String(id).startsWith('n')) return;
        const nid = Number(String(id).slice(1));
        selected = selected === nid ? null : nid;
        input.placeholder = selected == null ? 'chiave' : 'nuova chiave';
        draw(player.index, { animate: false });
      } : null,
    });
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    let frames, opStart, top;
    function compute() {
      ({ frames, opStart } = run(heap, ops));
      // le radici stanno sempre alla stessa quota: sopra c'è posto per l'array A, se qualche passo lo usa
      const withA = frames.some((f) => f.A);
      top = DIM.pad + (withA ? 46 : 0) + MIN_UP + 12;
      let W = 0, Hh = 0;
      for (const f of frames) {
        const L = layout(f, top);
        W = Math.max(W, L.width); Hh = Math.max(Hh, L.height);
      }
      W = Math.max(W, 260);
      svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      svg.style.maxWidth = `${Math.round(W * 1.4)}px`;
    }

    // l'operazione a cui appartiene il fotogramma n
    const opOf = (n) => { let i = -1; opStart.forEach((s, j) => { if (s <= n) i = j; }); return i; };

    function draw(n, { animate = true } = {}) {
      const f = frames[n];
      const L = layout(f, top);
      const hl = new Set(f.hl);
      const items = [], edges = [], arrows = [];
      const pos = new Map(L.nodes.map((v) => [v.id, v]));
      for (const v of L.nodes) {
        const cls = [v.mark && 'fh-mark', hl.has(v.id) && 'fv-hl', selected === v.id && 'fv-sel'].filter(Boolean).join(' ');
        items.push({ id: `n${v.id}`, x: v.x, y: v.y, label: fmtKey(v.key), cls });
      }
      for (const e of L.edges) edges.push({ a: `n${e.a}`, b: `n${e.b}` });
      // la lista delle radici, come nelle figure del libro: una linea che passa per le radici
      for (const e of L.rootLinks) edges.push({ a: `n${e.a}`, b: `n${e.b}`, cls: 'fh-rl' });

      // min[H], con una freccia verso la radice; durante Consolidate punta ancora a right[z], che può
      // essere già diventato figlio di un'altra radice, quindi non lo si disegna finché si usa A
      const minId = f.A ? null : f.min;
      const m = pos.get(minId);
      if (m) {
        items.push({ id: 'min', kind: 'text', x: m.x, y: m.y - MIN_UP, text: 'min[H]', cls: 'fh-min' });
        items.push({ id: 'minpt', kind: 'point', x: m.x, y: m.y - MIN_UP + 8 });
        arrows.push({ a: 'minpt', b: `n${m.id}`, ra: 0, cls: 'fh-minarrow' });
      } else if (!L.nodes.length) {
        items.push({ id: 'nil', kind: 'text', x: DIM.pad, y: top, text: 'min[H] = NIL', anchor: 'start', cls: 'fh-min' });
      }

      // i puntatori delle procedure: sopra una radice in una riga (a destra della freccia di min[H]),
      // a sinistra di un nodo interno
      const by = new Map();
      for (const p of f.ptrs) { if (!by.has(p.id)) by.set(p.id, []); by.get(p.id).push(p.name); }
      for (const [id, names] of by) {
        const v = pos.get(id);
        if (!v) continue;
        const widths = names.map((s) => s.length * CH);
        const total = widths.reduce((a, b) => a + b, 0) + 6 * (names.length - 1);
        let x0;
        if (!v.root) x0 = v.x - DIM.r - 4 - total;
        else if (id === minId) x0 = v.x + 6;
        else x0 = v.x - total / 2;
        const y = v.root ? v.y - ROW : v.y;
        names.forEach((name, i) => {
          items.push({ id: `p:${name}`, kind: 'text', x: x0, y, text: name, anchor: 'start', cls: 'fh-ptr' });
          x0 += widths[i] + 6;
        });
      }

      // l'array A di Consolidate, con la chiave della radice a cui punta ogni cella
      if (L.cells.length) {
        const cy = DIM.pad + 12, cw = DIM.cell, x00 = DIM.pad + 18;
        items.push({ id: 'A:lab', kind: 'text', x: DIM.pad, y: cy + cw / 2, text: 'A', anchor: 'start', cls: 'fh-alab' });
        for (const c of L.cells) {
          const x = x00 + c.i * cw;
          items.push({ id: `A:c${c.i}`, kind: 'shape', x, y: cy, d: `M0,0 h${cw} v${cw} h${-cw} Z`, cls: `fh-cell${f.acur === c.i ? ' fh-cell-cur' : ''}` });
          items.push({ id: `A:i${c.i}`, kind: 'text', x: x + cw / 2, y: cy - 7, text: String(c.i), cls: 'fh-aidx' });
          if (c.v) items.push({ id: `A:v${c.i}:${c.v.id}`, kind: 'text', x: x + cw / 2, y: cy + cw / 2, text: fmtKey(c.v.key), cls: 'fh-aval' });
        }
      }
      view.render({ items, edges, arrows }, { animate });

      // la riga sotto la figura: l'operazione, poi le misure dell'heap e il potenziale
      const parts = [];
      if (f.op) parts.push(opTex(f.op));
      parts.push(`n = ${f.n}`, `t(H) = ${f.t}`, `m(H) = ${f.m}`, `\\Phi(H) = ${f.t} + 2 \\cdot ${f.m} = ${phi(f)}`);
      const k = opOf(n);
      const last = k >= 0 && (k === opStart.length - 1 ? frames.length - 1 : opStart[k + 1] - 1) === n;
      if (last) {
        const d = phi(f) - phi(frames[opStart[k] - 1]);
        parts.push(`\\Delta\\Phi = ${d < 0 ? '-' : '+'}${Math.abs(d)}`);
      }
      eq.replaceChildren(...parts.map((p) => {
        const span = h('span', { class: 'eq-part' });
        katex.render(p, span, { throwOnError: false });
        return span;
      }));
      note.textContent = f.note;
    }

    compute();
    const player = createPlayer({ steps: frames.length, onStep: (i) => draw(i), interval, autoplay: ops.length > 0 });

    // una nuova operazione si aggiunge in fondo alla sequenza e si guarda subito
    function act(raw) {
      if (!parseOp(raw)) return;
      ops = [...ops, raw];
      selected = null;
      input.placeholder = 'chiave';
      compute();
      player.setSteps(frames.length, { keep: true });
      player.go(opStart[opStart.length - 1]);
      if (opStart[opStart.length - 1] < frames.length - 1) player.play();
      else player.pause();
    }

    const input = h('input', { type: 'text', class: 'key-in', inputmode: 'numeric', value: '', placeholder: 'chiave', 'aria-label': 'chiave' });
    const typed = () => { const v = input.value.trim(); return /^-?\d+$/.test(v) ? Number(v) : null; };
    // la chiave del nodo scelto nell'ultimo fotogramma, dove si aggiungono le operazioni
    const selectedKey = () => {
      if (selected == null) return null;
      const find = (t) => (t.id === selected ? t.key : t.children.reduce((a, c) => a ?? find(c), null));
      return frames[frames.length - 1].roots.reduce((a, t) => a ?? find(t), null);
    };
    const run1 = {
      insert: () => { const k = typed(); if (k != null) { act(`insert ${k}`); input.value = ''; } },
      'extract-min': () => act('extract-min'),
      delete: () => { const k = selectedKey() ?? typed(); if (k != null) { act(`delete ${k}`); input.value = ''; } },
      'decrease-key': () => { const k = selectedKey(), v = typed(); if (k != null && v != null) { act(`decrease-key ${k} ${v}`); input.value = ''; } },
    };
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (selected != null && actions.includes('decrease-key')) run1['decrease-key']();
      else if (actions.includes('insert')) run1.insert();
    });
    const opBtn = (type) => h('button', { type: 'button', class: 'seg-btn sc', onclick: run1[type] }, BTN[type]);
    const reset = h('button', { type: 'button', class: 'seg-btn', title: 'Torna all\'heap e alle operazioni di partenza',
      onclick: () => { ops = initialOps; selected = null; compute(); player.pause(); player.setSteps(frames.length); } }, '↺ Ripristina');

    const controls = actions.length > 0 && h('div', { class: 'controls' }, [
      h('div', { class: 'seg' }, [input, ...actions.map(opBtn)]),
      h('div', { class: 'seg' }, reset),
    ]);
    const hint = (actions.includes('delete') || actions.includes('decrease-key')) && h('p', { class: 'widget-note hint' },
      `Si può cliccare su un nodo per sceglierlo: ${[actions.includes('delete') && 'Delete lo cancella', actions.includes('decrease-key') && 'Decrease-Key gli assegna la chiave scritta nel riquadro'].filter(Boolean).join(', ')}.`);
    el.append(...[controls, svg, eq, note, player.el, hint].filter(Boolean));
  },
});
