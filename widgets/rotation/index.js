import { defineWidget, h, s, svgRoot, createPlayer } from 'texweb/client';
import { createTreeView, layout } from '../lib/tree-view.js';
import './style.css';

// una rotazione, oppure uno dei tre passi dello Splay (zig, zig-zag, zig-zig), una rotazione alla volta.
// Le chiavi sono disegnate in ordine da sinistra a destra: i nodi si muovono solo in verticale,
// perché le rotazioni non cambiano l'ordinamento. I sottoalberi sono i triangoli A, B, C, D.

const T = (k, l, r) => ({ k, l, r });

const CASES = {
  rotate: {
    states: [T('y', T('x', 'A', 'B'), 'C'), T('x', 'A', T('y', 'B', 'C')), T('y', T('x', 'A', 'B'), 'C')],
    // l'arco della prossima rotazione
    next: [['y', 'x'], ['x', 'y'], ['y', 'x']],
    notes: [
      'x è il figlio sinistro di y: la rotazione a destra su y porta x al suo posto.',
      'Dopo la rotazione a destra: x e A salgono di un livello, y e C scendono, B resta alla stessa profondità. La rotazione a sinistra su x è l\'operazione inversa.',
      'La rotazione a sinistra su x riporta l\'albero di partenza. In entrambe le forme l\'ordine resta A < x < B < y < C.',
    ],
  },
  zig: {
    states: [T('p', T('x', 'A', 'B'), 'C'), T('x', 'A', T('p', 'B', 'C'))],
    next: [['p', 'x'], null],
    notes: [
      'p è la radice: x non ha un nonno e basta una sola rotazione.',
      'Zig: x prende il posto di p con una rotazione, quindi costa 1.',
    ],
  },
  zigzag: {
    states: [T('g', T('p', 'A', T('x', 'B', 'C')), 'D'), T('g', T('x', T('p', 'A', 'B'), 'C'), 'D'), T('x', T('p', 'A', 'B'), T('g', 'C', 'D'))],
    next: [['p', 'x'], ['g', 'x'], null],
    notes: [
      'Il cammino da g a x cambia direzione: x è figlio destro di p, che è figlio sinistro di g.',
      'Prima rotazione: x con il padre p.',
      'Seconda rotazione: x con il nonno g. Ora x è al posto di g, con p e g come figli: 2 rotazioni.',
    ],
  },
  zigzig: {
    states: [T('g', T('p', T('x', 'A', 'B'), 'C'), 'D'), T('p', T('x', 'A', 'B'), T('g', 'C', 'D')), T('x', 'A', T('p', 'B', T('g', 'C', 'D')))],
    next: [['g', 'p'], ['p', 'x'], null],
    notes: [
      'Il cammino da g a x procede sempre nella stessa direzione: x e p sono entrambi figli sinistri.',
      'Prima rotazione: il padre p con il nonno g, e non x con p.',
      'Seconda rotazione: x con p. Ora x è al posto di g, p è suo figlio e g è figlio di p: 2 rotazioni.',
    ],
  },
};

export default defineWidget({
  name: 'rotation',
  params: {
    case: { type: 'enum', values: Object.keys(CASES), default: 'rotate' },
    interval: { type: 'number', default: 1600, min: 300 },
  },

  mount(el, { case: which, interval }) {
    el.classList.add('w-rotation', 'w-tree');
    const { states, next, notes } = CASES[which];
    const SLOT = 46, LEVEL = 52, LEFT = 26, TOP = 22;
    const first = layout([states[0]]);
    const depth = Math.max(...states.map((st) => Math.max(...layout([st]).nodes.map((n) => n.depth))));
    const W = 2 * LEFT + (first.width - 1) * SLOT, AXIS = TOP + depth * LEVEL + LEVEL * 0.95 + 26;
    const svg = svgRoot(W, AXIS + 12, { 'aria-label': 'Rotazioni su un albero binario di ricerca, con i sottoalberi come triangoli' });
    const view = createTreeView(svg, { slot: SLOT, level: LEVEL, left: LEFT, top: TOP, radius: 15 });

    // l'ordine delle chiavi, che nessuna rotazione cambia: A < x < B < ...
    const order = first.nodes.map((n) => n.id);
    order.forEach((id, i) => {
      const [x] = view.xy(i, 0);
      svg.append(s('text', { x, y: AXIS, class: `rot-axis${id.length === 1 && id === id.toUpperCase() ? '' : ' var'}` }, id));
      if (i) svg.append(s('text', { x: x - SLOT / 2, y: AXIS, class: 'rot-axis lt' }, '<'));
    });

    const note = h('p', { class: 'widget-note' });

    function draw(n) {
      const { nodes, edges } = layout([states[n]]);
      for (const nd of nodes) if (nd.kind === 'node') nd.cls = `tv-var${nd.id === 'x' ? ' tv-hl' : ''}`;
      const nx = next[n];
      for (const e of edges) if (nx && e.a === nx[0] && e.b === nx[1]) e.cls = 'tv-rot';
      view.render(nodes, edges);
      note.textContent = notes[n];
    }

    const player = createPlayer({ steps: states.length, onStep: draw, interval });
    el.append(svg, note, player.el);
  },
});
