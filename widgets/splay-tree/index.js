import katex from 'katex';
import { defineWidget, h, svgRoot, createPlayer } from 'texweb/client';
import { createTreeView, layout } from '../lib/tree-view.js';
import { sc, num } from '../lib/util.js';
import { run, parseOp, height, potential } from './bst.js';
import './style.css';

// uno splay tree su cui si eseguono Search, Insert e Delete, una rotazione alla volta;
// si può confrontare lo Splay (zig, zig-zig, zig-zag) con le sole rotazioni singole

const OPS = { search: 'Search', insert: 'Insert', delete: 'Delete' };

// dimensioni dei sottoalberi di una foresta di copie { k, l, r }
function sizes(roots) {
  const S = new Map();
  const visit = (t) => (t ? (S.set(t.k, 1 + visit(t.l) + visit(t.r)), S.get(t.k)) : 0);
  roots.forEach(visit);
  return S;
}

export default defineWidget({
  name: 'splay-tree',
  params: {
    tree: { type: 'list', default: [7, 6, 5, 4, 3, 2, 1] },
    ops: { type: 'list', default: [] },
    mode: { type: 'enum', values: ['splay', 'rotate'], default: 'splay' },
    ranks: { type: 'boolean', default: false },
    // compare: il pulsante per passare dallo Splay alle rotazioni singole e viceversa
    compare: { type: 'boolean', default: true },
    // le operazioni che il lettore può eseguire, ad esempio solo quella spiegata accanto alla figura
    actions: { type: 'list', default: ['search', 'insert', 'delete'] },
    interval: { type: 'number', default: 1500, min: 300 },
  },

  mount(el, { tree, ops: ops0, mode: mode0, ranks, compare, actions: actions0, interval }) {
    el.classList.add('w-splay', 'w-tree');
    const SLOT = 38, LEVEL = 46, LEFT = 24, TOP = 22;
    let mode = mode0;
    // le operazioni scritte male nel .tex si ignorano
    const initialOps = ops0.map(String).filter(parseOp);
    let ops = initialOps;
    let labels = ranks ? 'S' : 'none';
    let frames, opStart;
    const actions = actions0.map((a) => String(a).toLowerCase()).filter((a) => OPS[a]);
    // un clic su un nodo lo cerca, oppure lo cancella se la figura parla della cancellazione
    const clickAction = actions.includes('search') ? 'search' : actions.includes('delete') ? 'delete' : null;

    const svg = svgRoot(400, 300, { 'aria-label': 'Splay tree: le rotazioni di ogni operazione, una alla volta' });
    const view = createTreeView(svg, { slot: SLOT, level: LEVEL, left: LEFT, top: TOP, radius: 14, onClick: clickAction && ((k) => act(clickAction, k)) });
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    function compute() {
      ({ frames, opStart } = run(tree.map(Number), ops, mode));
      // la figura ha sempre la stessa dimensione: quella che basta per tutti i fotogrammi
      let w = 1, d = 0;
      for (const f of frames) {
        w = Math.max(w, layout(f.trees, { gap: 1 }).width);
        d = Math.max(d, ...f.trees.map((t) => height(t) - 1));
      }
      const W = 2 * LEFT + (w - 1) * SLOT + (ranks ? 30 : 0), H = TOP + d * LEVEL + 24;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.style.maxWidth = `${Math.round(W * 1.4)}px`;
    }

    function formula(n) {
      const f = frames[n];
      if (ranks && f.step) {
        const { cost, phiBefore, phiAfter, rxBefore, rxAfter, kind } = f.step;
        const zig = kind === 'zig' || kind === 'rotazione';
        const amort = cost + phiAfter - phiBefore;
        const bound = 3 * (rxAfter - rxBefore) + (zig ? 1 : 0);
        return `\\hat c_{\\text{${kind}}} = ${cost} + \\Delta\\Phi = ${cost} + (${num(phiAfter)} - ${num(phiBefore)}) = ${num(amort)}`
          + ` \\;\\le\\; 3\\big(R_f(${f.step.x}) - R_i(${f.step.x})\\big)${zig ? ' + 1' : ''} = ${num(bound)}`;
      }
      if (ranks && f.end && f.op?.type === 'search') {
        // lo Splay intero: costo reale più variazione di potenziale, contro il lemma principale
        const start = frames[opStart.findLast((i) => i <= n)];
        const x = f.hl[0];
        const rx = Math.log2(sizes(start.trees).get(x)), rroot = Math.log2(sizes(f.trees).get(x));
        const amort = f.opRot + potential(f.trees) - potential(start.trees);
        return `\\hat c_{${sc('Splay')}} = ${f.opRot} + \\Delta\\Phi = ${num(amort)} \\;\\le\\; 3\\big(R(\\mathit{root}) - R(${x})\\big) + 1 = ${num(3 * (rroot - rx) + 1)}`;
      }
      const parts = [];
      if (f.op) parts.push(`\\text{rotazioni di } ${sc(OPS[f.op.type])}(${f.op.key}) = ${f.opRot}`, `\\text{in totale} = ${f.total}`);
      parts.push(`\\text{altezza} = ${Math.max(0, ...f.trees.map((t) => height(t) - 1))}`);
      if (ranks) parts.push(`\\Phi(T) = \\textstyle\\sum_v R(v) \\approx ${num(potential(f.trees))}`);
      return parts.join(',\\qquad ');
    }

    function draw(n) {
      const f = frames[n];
      const S = sizes(f.trees);
      const { nodes, edges } = layout(f.trees, { gap: 1 });
      const onPath = new Set(f.path);
      const pathEdges = new Set(f.path.slice(1).map((k, i) => `${f.path[i]}>${k}`));
      for (const nd of nodes) {
        nd.cls = [f.hl.includes(nd.id) && 'tv-hl', onPath.has(nd.id) && 'tv-onpath'].filter(Boolean).join(' ');
        if (labels === 'S') nd.note = String(S.get(nd.id));
        if (labels === 'R') nd.note = num(Math.log2(S.get(nd.id)));
      }
      for (const e of edges) if (pathEdges.has(`${e.a}>${e.b}`)) e.cls = 'tv-path';
      view.render(nodes, edges);
      katex.render(formula(n), eq, { throwOnError: false });
      note.textContent = f.note;
    }

    compute();
    const player = createPlayer({ steps: frames.length, onStep: draw, interval, autoplay: ops.length > 0 });

    // una nuova operazione si aggiunge in fondo alla sequenza e si guarda subito
    function act(type, key) {
      if (!Number.isFinite(key)) return;
      ops = [...ops, `${type} ${key}`];
      compute();
      player.setSteps(frames.length, { keep: true });
      player.go(opStart[opStart.length - 1]);
      player.play();
    }

    const input = h('input', { type: 'number', class: 'key-in', value: '', placeholder: 'chiave', 'aria-label': 'chiave' });
    const keyOf = () => (input.value.trim() === '' ? NaN : Math.trunc(Number(input.value)));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && actions.length) act(actions[0], keyOf()); });
    const opBtn = (type) => h('button', { type: 'button', class: 'seg-btn sc', onclick: () => act(type, keyOf()) }, OPS[type]);

    const modeBtns = [['splay', 'Splay'], ['rotate', 'Rotazioni singole']].map(([m, text]) =>
      h('button', { type: 'button', class: `seg-btn${m === mode ? ' on' : ''}`, onclick: () => setMode(m) }, text));
    function setMode(m) {
      mode = m;
      modeBtns.forEach((b, i) => b.classList.toggle('on', ['splay', 'rotate'][i] === m));
      compute();
      player.setSteps(frames.length);
      if (ops.length) player.play();
    }

    const reset = h('button', { type: 'button', class: 'seg-btn', title: 'Torna all\'albero e alle operazioni di partenza',
      onclick: () => { ops = initialOps; compute(); player.pause(); player.setSteps(frames.length); } }, '↺ Ripristina');

    const controls = h('div', { class: 'controls' }, [
      compare && h('div', { class: 'seg' }, modeBtns),
      actions.length > 0 && h('div', { class: 'seg' }, [input, ...actions.map(opBtn)]),
      h('div', { class: 'seg' }, reset),
    ]);
    if (ranks) {
      const choices = [['S', 'S(v)'], ['R', 'R(v)'], ['none', 'nessuna']];
      const lb = choices.map(([v, text]) => h('button', { type: 'button', class: `seg-btn${v === labels ? ' on' : ''}`, onclick: () => {
        labels = v;
        lb.forEach((b, i) => b.classList.toggle('on', choices[i][0] === v));
        draw(player.index);
      } }, text));
      controls.append(h('span', { class: 'ctl-label' }, 'etichette'), h('div', { class: 'seg' }, lb));
    }

    const hint = clickAction && h('p', { class: 'widget-note hint' },
      `Si può anche cliccare su un nodo per ${clickAction === 'search' ? 'cercarlo' : 'cancellarlo'}.`);
    el.append(...[controls, svg, eq, note, player.el, hint].filter(Boolean));
  },
});
