import katex from 'katex';
import { defineWidget, h, svgRoot, createPlayer } from 'texweb/client';
import { sc } from '../lib/util.js';
import { createForestView } from '../lib/forest-view.js';
import { run, parseOp, layout, DIM, fmtKey } from './heap.js';
import './style.css';

// Un heap binomiale su cui si eseguono Insert, Minimum, Extract-Min, Union, Decrease-Key e Delete,
// un passo alla volta, con i puntatori dello pseudocodice (prev-x, x, next-x nell'unione, y e z nel
// decremento di una chiave). Sotto la figura, per ogni lista delle radici, il numero di alberi di ogni
// grado: durante l'unione un grado con due o tre alberi è un riporto della somma binaria.

const OPS = { insert: 'Insert', minimum: 'Minimum', 'extract-min': 'Extract-Min', 'decrease-key': 'Decrease-Key', delete: 'Delete', union: 'Union' };
const SUBS = { 'H₁': 'H_1', 'H₂': 'H_2', 'H′': "H'", H: 'H' };

function opTex(op) {
  const name = sc(OPS[op.type]);
  if (op.type === 'insert') return `${name}(H, ${op.a})`;
  if (op.type === 'union') return `${name}(H_1, H_2)`;
  if (op.type === 'decrease-key') return `${name}(H, x, ${op.b}),\\ \\mathit{key}[x] = ${op.a}`;
  if (op.type === 'delete') return `${name}(H, x),\\ \\mathit{key}[x] = ${op.a}`;
  return `${name}(H)`;
}

export default defineWidget({
  name: 'binomial-heap',
  params: {
    // la lista delle radici, ogni albero come (chiave figli...), ad esempio {(10) (1 (12 (18)) (25))}
    heap: { type: 'string', default: '' },
    // il secondo heap dell'operazione union, nello stesso formato
    other: { type: 'string', default: '' },
    // ad esempio {insert 5, extract-min, decrease-key 26 7, delete 77, union, minimum}
    ops: { type: 'list', default: [] },
    // le operazioni che il lettore può eseguire
    actions: { type: 'list', default: ['insert', 'extract-min', 'decrease-key', 'delete'] },
    // la tabella con il numero di alberi di ogni grado
    degrees: { type: 'boolean', default: true },
    // costo effettivo, potenziale e costo ammortizzato degli inserimenti
    potential: { type: 'boolean', default: false },
    interval: { type: 'number', default: 1900, min: 300 },
  },

  mount(el, { heap, other, ops: ops0, actions: actions0, degrees, potential, interval }) {
    el.classList.add('w-forest', 'w-binheap');
    const initialOps = ops0.map(String).filter(parseOp);
    let ops = initialOps;
    const actions = actions0.map((a) => String(a).toLowerCase()).filter((a) => OPS[a] && a !== 'union');

    let selected = null; // il tok del nodo scelto con un clic
    const svg = svgRoot(400, 200, { 'aria-label': 'Heap binomiale: i passi di ogni operazione, uno alla volta' });
    const view = createForestView(svg, {
      radius: DIM.r,
      onClick: actions.length ? (id) => {
        const tok = Number(String(id).slice(1));
        selected = selected === tok ? null : tok;
        input.placeholder = selected == null ? 'chiave' : 'nuova chiave';
        draw(player.index, { animate: false });
      } : null,
    });
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });
    const table = h('div', { class: 'bh-degrees' });

    let frames, opStart, maxDeg;
    function compute() {
      ({ frames, opStart } = run(heap, other, ops));
      let W = 0, Hh = 0;
      maxDeg = 1;
      for (const f of frames) {
        const L = layout(f);
        W = Math.max(W, L.width); Hh = Math.max(Hh, L.height);
        for (const l of f.lists) for (const t of l.roots) maxDeg = Math.max(maxDeg, t.children.length);
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      svg.style.maxWidth = `${Math.round(W * 1.4)}px`;
    }

    // l'operazione a cui appartiene il fotogramma n, e il numero di alberi prima di essa
    const opOf = (n) => { let i = -1; opStart.forEach((s, j) => { if (s <= n) i = j; }); return i; };

    function draw(n, { animate = true } = {}) {
      const f = frames[n];
      const L = layout(f);
      const hl = new Set(f.hl);
      const items = [], edges = [], arrows = [];
      for (const v of L.nodes) {
        items.push({ id: `n${v.id}`, kind: 'point', x: v.x, y: v.y });
        items.push({ id: `t${v.tok}`, x: v.x, y: v.y, label: fmtKey(v.key), cls: [hl.has(v.tok) && 'fv-hl', selected === v.tok && 'fv-sel'].filter(Boolean).join(' ') });
      }
      for (const e of L.edges) edges.push({ a: `n${e.a}`, b: `n${e.b}` });
      for (const a of L.arrows) arrows.push({ a: `n${a.a}`, b: `n${a.b}` });
      L.heads.forEach((hd, i) => {
        items.push({ id: `head${i}`, kind: 'text', x: hd.x, y: hd.y, text: `head[${hd.name}]`, anchor: 'end', cls: 'bh-head' });
        if (hd.first == null) {
          items.push({ id: `nil${i}`, kind: 'text', x: hd.x + 6, y: hd.y, text: '= NIL', anchor: 'start', cls: 'bh-head' });
          return;
        }
        items.push({ id: `hp${i}`, kind: 'point', x: hd.x + 4, y: hd.y });
        arrows.push({ a: `hp${i}`, b: `n${hd.first}`, ra: 0 });
      });
      const pos = new Map(L.nodes.map((v) => [v.id, v]));
      for (const p of f.ptrs) {
        const v = pos.get(p.id);
        if (!v) continue;
        // a sinistra di una radice il puntatore finirebbe sulla freccia della lista: lo si mette sopra
        items.push(p.at === 'left' && v.depth > 0
          ? { id: `p:${p.name}`, kind: 'text', x: v.x - DIM.r - 5, y: v.y, text: p.name, anchor: 'end', cls: 'bh-ptr' }
          : { id: `p:${p.name}`, kind: 'text', x: v.x, y: v.y - DIM.r - 9, text: p.name, anchor: 'middle', cls: 'bh-ptr' });
      }
      view.render({ items, edges, arrows }, { animate });

      // la riga sotto la figura: l'operazione, poi le misure dell'heap
      const parts = [];
      const k = opOf(n);
      if (f.op) parts.push(opTex(f.op));
      parts.push(`n = ${f.n}`, `\\#\\text{alberi} = ${f.trees}`);
      if (f.op && ['insert', 'union', 'extract-min', 'delete'].includes(f.op.type)) parts.push(`\\text{link} = ${f.links}`);
      if (potential && f.op?.type === 'insert' && (k === opStart.length - 1 ? frames.length - 1 : opStart[k + 1] - 1) === n) {
        const before = frames[opStart[k] - 1].trees;
        const dphi = f.trees - before;
        parts.push(`c_i = 2 + ${f.links} = ${2 + f.links}`, `\\hat c_i = c_i + \\Delta\\Phi = ${2 + f.links} ${dphi < 0 ? '-' : '+'} ${Math.abs(dphi)} = ${2 + f.links + dphi}`);
      }
      eq.replaceChildren(...parts.map((p) => {
        const span = h('span', { class: 'eq-part' });
        katex.render(p, span, { throwOnError: false });
        return span;
      }));
      note.textContent = f.note;

      // numero di alberi di ogni grado, per ogni lista delle radici
      if (degrees) {
        const head = h('tr', {}, [h('th', {}, ''), ...Array.from({ length: maxDeg + 1 }, (_, j) => {
          const th = h('th', {});
          katex.render(`B_{${maxDeg - j}}`, th, { throwOnError: false });
          return th;
        }), h('th', { class: 'bh-n' }, 'n')]);
        const rows = f.lists.map((l) => {
          const cnt = Array(maxDeg + 1).fill(0);
          let size = 0;
          const sz = (t) => 1 + t.children.reduce((a, c) => a + sz(c), 0);
          for (const t of l.roots) { cnt[t.children.length]++; size += sz(t); }
          const name = h('th', {});
          katex.render(SUBS[l.name] ?? l.name, name, { throwOnError: false });
          return h('tr', {}, [name, ...cnt.reverse().map((c) => h('td', { class: c > 1 ? 'bh-carry' : c ? 'bh-one' : '' }, String(c))), h('td', { class: 'bh-n' }, String(size))]);
        });
        table.replaceChildren(h('table', {}, [head, ...rows]));
      }
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
      // con un solo fotogramma (ad esempio un errore) il player sarebbe già all'ultimo passo,
      // e play() ricomincerebbe dall'inizio
      if (opStart[opStart.length - 1] < frames.length - 1) player.play();
      else player.pause();
    }

    const input = h('input', { type: 'text', class: 'key-in', inputmode: 'numeric', value: '', placeholder: 'chiave', 'aria-label': 'chiave' });
    const typed = () => { const v = input.value.trim(); return /^-?\d+$/.test(v) ? Number(v) : null; };
    // la chiave del nodo scelto nell'ultimo fotogramma, dove si aggiungono le operazioni
    const selectedKey = () => {
      if (selected == null) return null;
      for (const l of frames[frames.length - 1].lists) {
        const find = (t) => (t.tok === selected ? t.key : t.children.reduce((a, c) => a ?? find(c), null));
        for (const t of l.roots) { const k = find(t); if (k != null) return k; }
      }
      return null;
    };
    const run1 = {
      insert: () => { const k = typed(); if (k != null) { act(`insert ${k}`); input.value = ''; } },
      minimum: () => act('minimum'),
      'extract-min': () => act('extract-min'),
      delete: () => { const k = selectedKey() ?? typed(); if (k != null) { act(`delete ${k}`); input.value = ''; } },
      'decrease-key': () => { const k = selectedKey(), v = typed(); if (k != null && v != null) { act(`decrease-key ${k} ${v}`); input.value = ''; } },
    };
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (selected != null && actions.includes('decrease-key')) run1['decrease-key']();
      else if (actions.includes('insert')) run1.insert();
    });
    const opBtn = (type) => h('button', { type: 'button', class: 'seg-btn sc', onclick: run1[type] }, OPS[type]);
    const reset = h('button', { type: 'button', class: 'seg-btn', title: 'Torna all\'heap e alle operazioni di partenza',
      onclick: () => { ops = initialOps; selected = null; compute(); player.pause(); player.setSteps(frames.length); } }, '↺ Ripristina');

    const controls = actions.length > 0 && h('div', { class: 'controls' }, [
      h('div', { class: 'seg' }, [input, ...actions.map(opBtn)]),
      h('div', { class: 'seg' }, reset),
    ]);
    const hint = (actions.includes('delete') || actions.includes('decrease-key')) && h('p', { class: 'widget-note hint' },
      `Si può cliccare su un nodo per sceglierlo: ${[actions.includes('delete') && 'Delete lo cancella', actions.includes('decrease-key') && 'Decrease-Key gli assegna la chiave scritta nel riquadro'].filter(Boolean).join(', ')}.`);
    el.append(...[controls, svg, eq, note, degrees && table, player.el, hint].filter(Boolean));
  },
});
