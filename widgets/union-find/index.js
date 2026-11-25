import katex from 'katex';
import { defineWidget, h, svgRoot, createPlayer } from 'texweb/client';
import { sc } from '../lib/util.js';
import { createForestView } from '../lib/forest-view.js';
import { run, parseOp, layout, DIM } from './model.js';
import './style.css';

// Una foresta di insiemi disgiunti su cui si eseguono Make-Set, Union e Find-Set, un passo alla volta.
// Ogni nodo punta al padre con una freccia, e le radici puntano a sé stesse; accanto a ogni nodo c'è il
// suo rango. Find-Set evidenzia il cammino di ricerca, e poi lo comprime; Union mostra il collegamento
// tra le due radici fatto da Link, con l'unione per ranghi.

const MACROS = { '\\MakeSet': sc('Make-Set'), '\\FindSet': sc('Find-Set'), '\\Link': sc('Link'), '\\Union': sc('Union') };
const tex = (src, el) => katex.render(src, el, { throwOnError: false, macros: { ...MACROS } });

// l'anello sopra una radice, che punta a sé stessa, e la sua punta di freccia
const R = DIM.r;
const LOOP = `M${-R / 2},${-R * 0.87} C-16,-36 16,-36 ${R / 2},${-R * 0.87}`;
const HEAD = (() => {
  const tip = [R / 2, -R * 0.87], dir = [-0.36, 0.93], nrm = [0.93, 0.36];
  const b = [tip[0] - 6 * dir[0], tip[1] - 6 * dir[1]];
  const p1 = [b[0] + 3 * nrm[0], b[1] + 3 * nrm[1]], p2 = [b[0] - 3 * nrm[0], b[1] - 3 * nrm[1]];
  return `M${tip.join(',')} L${p1.join(',')} L${p2.join(',')} Z`;
})();

export default defineWidget({
  name: 'union-find',
  params: {
    // gli insiemi di partenza: n = 17 vuol dire MAKE-SET(0), ..., MAKE-SET(16)
    n: { type: 'integer', default: 8, min: 0, max: 40 },
    // ad esempio {union 1 2, union 3 4, find 0}
    ops: { type: 'list', default: [] },
    // a parità di rango: link fa come LINK(x, y) (x diventa figlio di y), first il contrario
    tie: { type: 'enum', values: ['link', 'first'], default: 'link' },
    rank: { type: 'boolean', default: true },
    compress: { type: 'boolean', default: true },
    // se il lettore può aggiungere operazioni
    actions: { type: 'boolean', default: true },
    interval: { type: 'number', default: 1900, min: 300 },
  },

  mount(el, { n, ops: ops0, tie, rank, compress, actions, interval }) {
    el.classList.add('w-forest', 'w-uf');
    const initialOps = ops0.map(String).filter(parseOp);
    let ops = initialOps;
    let sel = []; // i nodi scelti con un clic: il primo è x, il secondo y

    const svg = svgRoot(500, 200, { 'aria-label': 'Foresta di insiemi disgiunti: le operazioni un passo alla volta' });
    const view = createForestView(svg, {
      radius: R,
      onClick: actions ? (id) => {
        if (!String(id).startsWith('n')) return;
        const v = Number(String(id).slice(1));
        sel = sel.includes(v) ? sel.filter((u) => u !== v) : [...sel, v].slice(-2);
        draw(player.index, { animate: false });
      } : null,
    });
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    let frames, opStart, W, Hh;
    let elements = n; // il prossimo elemento creato da Make-Set
    function compute() {
      ({ frames, opStart } = run({ n, ops, tie, rank, compress }));
      W = 0; Hh = 0;
      for (const f of frames) {
        const L = layout(f);
        W = Math.max(W, L.width); Hh = Math.max(Hh, L.height);
      }
      W = Math.max(W, 280);
      svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      svg.style.maxWidth = `${Math.round(W * 1.4)}px`;
      const last = frames[frames.length - 1];
      elements = Math.max(-1, ...last.order) + 1;
    }

    function draw(i, { animate = true } = {}) {
      const f = frames[i];
      const L = layout(f);
      const dx = (W - L.width) / 2; // ogni fotogramma sta al centro della figura
      const hl = new Set(f.hl);
      const onPath = new Set(f.path.map(([a, b]) => `${a}>${b}`));
      const fresh = new Set(f.fresh.map(([a, b]) => `${a}>${b}`));
      const items = [], arrows = [];
      for (const v of L.nodes) {
        const x = v.x + dx;
        const cls = [hl.has(v.id) && 'fv-hl', sel.includes(v.id) && 'fv-sel'].filter(Boolean).join(' ');
        items.push({ id: `n${v.id}`, x, y: v.y, label: String(v.id), cls });
        items.push({ id: `rk${v.id}`, kind: 'text', x: x + R + 3, y: v.y - R + 1, text: String(v.rank), anchor: 'start', cls: v.root ? 'uf-rank uf-rank-root' : 'uf-rank' });
        if (v.root) {
          items.push({ id: `lp${v.id}`, kind: 'shape', x, y: v.y, d: LOOP, cls: 'uf-loop' });
          items.push({ id: `lh${v.id}`, kind: 'shape', x, y: v.y, d: HEAD, cls: 'uf-loophead' });
        }
        const k = sel.indexOf(v.id);
        if (k >= 0) items.push({ id: `sel${k}`, kind: 'text', x: x - R - 4, y: v.y + R, text: k ? 'y' : 'x', anchor: 'end', cls: 'uf-sel' });
      }
      for (const a of L.arrows) {
        const key = `${a.a}>${a.b}`;
        arrows.push({ a: `n${a.a}`, b: `n${a.b}`, cls: onPath.has(key) ? 'uf-path' : fresh.has(key) ? 'uf-fresh' : '' });
      }
      view.render({ items, arrows }, { animate });

      const parts = [];
      if (f.eq) parts.push(f.eq);
      parts.push(`\\text{insiemi: } ${f.sets}`);
      eq.replaceChildren(...parts.map((p) => { const span = h('span', { class: 'eq-part' }); tex(p, span); return span; }));
      note.textContent = f.note;
    }

    compute();
    const player = createPlayer({ steps: frames.length, onStep: (i) => draw(i), interval, autoplay: ops.length > 0 });

    // una nuova operazione si aggiunge in fondo alla sequenza e si guarda subito
    function act(raw) {
      if (!parseOp(raw)) return;
      ops = [...ops, raw];
      sel = [];
      compute();
      player.setSteps(frames.length, { keep: true });
      const start = opStart[opStart.length - 1];
      player.go(start);
      if (start < frames.length - 1) player.play(); else player.pause();
    }

    const btn = (label, title, onclick) => h('button', { type: 'button', class: 'seg-btn sc', title, onclick }, label);
    const controls = actions && h('div', { class: 'controls' }, [
      h('div', { class: 'seg' }, [
        btn('Union', 'Unisce gli insiemi dei due nodi scelti', () => { if (sel.length === 2) act(`union ${sel[0]} ${sel[1]}`); }),
        btn('Find-Set', 'Cerca il rappresentante del nodo scelto', () => { if (sel.length) act(`find ${sel[0]}`); }),
        btn('Make-Set', 'Aggiunge un nuovo elemento', () => act(`make-set ${elements}`)),
      ]),
      h('div', { class: 'seg' }, h('button', { type: 'button', class: 'seg-btn', title: 'Torna alle operazioni di partenza',
        onclick: () => { ops = initialOps; sel = []; compute(); player.pause(); player.setSteps(frames.length); } }, '↺ Ripristina')),
    ]);
    const hint = actions && h('p', { class: 'widget-note hint' },
      'Si clicca su un nodo per sceglierlo come x e su un secondo nodo per sceglierlo come y: Union unisce i loro insiemi, Find-Set cerca il rappresentante di x.');
    el.append(...[controls, svg, eq, note, player.el, hint].filter(Boolean));
  },
});
