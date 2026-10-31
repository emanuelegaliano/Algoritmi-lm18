import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer, getSpeed, prefersReducedMotion } from 'texweb/client';
import { sc } from '../lib/util.js';
import { run, parseOp, parseTree, allKeys } from './btree.js';
import './style.css';

// un B-tree su cui si eseguono Search, Insert e Delete in una sola discesa, un passo alla volta;
// sotto la figura si contano le pagine lette e scritte dall'operazione corrente

const OPS = { search: 'Search', insert: 'Insert', delete: 'Delete' };
const CW = 28, H = 26, GAP = 16, LEVEL = 62, PAD = 16, TOP = 12;

const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

// posizioni dei nodi (rettangoli), delle chiavi (celle) e degli archi di un albero { id, keys, c }
function width(x) {
  const own = Math.max(1, x.keys.length) * CW;
  if (!x.c.length) return own;
  return Math.max(own, x.c.reduce((a, c) => a + width(c), 0) + GAP * (x.c.length - 1));
}
function layout(root) {
  const boxes = [], keys = [], edges = [];
  let depthMax = 0;
  const place = (x, left, depth) => {
    depthMax = Math.max(depthMax, depth);
    const w = width(x), own = Math.max(1, x.keys.length) * CW;
    const bx = left + (w - own) / 2, by = TOP + depth * LEVEL;
    boxes.push({ id: x.id, x: bx, y: by, w: own });
    x.keys.forEach((k, j) => keys.push({ id: k, x: bx + j * CW, y: by, first: j === 0, node: x.id }));
    let cx = left + (w - (x.c.reduce((a, c) => a + width(c), 0) + GAP * (x.c.length - 1))) / 2;
    x.c.forEach((c, i) => {
      edges.push({ a: x.id, i, b: c.id });
      place(c, cx, depth + 1);
      cx += width(c) + GAP;
    });
  };
  place(root, PAD, 0);
  return { boxes, keys, edges, width: width(root) + 2 * PAD, height: TOP + depthMax * LEVEL + H + PAD };
}

export default defineWidget({
  name: 'b-tree',
  params: {
    // l'albero tra parentesi: (chiavi figli...), ad esempio {(G M (A B) (H K) (N O))}
    tree: { type: 'string', default: '' },
    t: { type: 'integer', default: 3, min: 2 },
    ops: { type: 'list', default: [] },
    // le operazioni che il lettore può eseguire
    actions: { type: 'list', default: ['search', 'insert', 'delete'] },
    interval: { type: 'number', default: 1900, min: 300 },
  },

  mount(el, { tree, t, ops: ops0, actions: actions0, interval }) {
    el.classList.add('w-btree');
    const initialOps = ops0.map(String).filter(parseOp);
    let ops = initialOps;
    const actions = actions0.map((a) => String(a).toLowerCase()).filter((a) => OPS[a]);
    const clickAction = actions.includes('search') ? 'search' : actions.includes('delete') ? 'delete' : null;
    // chiavi numeriche oppure lettere: l'input del lettore si adegua
    const sample = [...allKeys(parseTree(tree).root), ...initialOps.map((o) => parseOp(o).key)];
    const numeric = sample.length > 0 && sample.every((k) => typeof k === 'number');

    const svg = svgRoot(400, 200, { 'aria-label': 'B-tree: i passi di ogni operazione, uno alla volta' });
    const edgesG = s('g'), boxesG = s('g'), keysG = s('g');
    svg.append(edgesG, boxesG, keysG);
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    let frames, opStart;
    function compute() {
      ({ frames, opStart } = run(tree, t, ops));
      // la figura ha sempre la stessa dimensione: quella che basta per tutti i fotogrammi
      let W = 0, Hh = 0;
      for (const f of frames) { const L = layout(f.tree); W = Math.max(W, L.width); Hh = Math.max(Hh, L.height); }
      svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      svg.style.maxWidth = `${Math.round(W * 1.4)}px`;
    }

    // ---------- disegno, con animazione tra un fotogramma e il successivo ----------
    const boxes = new Map(); // id nodo -> { g, rect, pos, from, to }
    const cells = new Map(); // chiave -> { g, line, pos, from, to }
    const lines = new Map(); // 'a>b' -> { line, a, i, b }
    let raf = null;

    function boxItem(id) {
      if (boxes.has(id)) return boxes.get(id);
      const rect = s('rect', { height: H, rx: 2, class: 'bt-box' });
      const g = s('g', { class: 'bt-node bt-new' }, [rect]);
      boxesG.append(g);
      const it = { g, rect, pos: null, fresh: true };
      boxes.set(id, it);
      return it;
    }
    function cellItem(k) {
      if (cells.has(k)) return cells.get(k);
      const line = s('line', { x1: 0, y1: 0, x2: 0, y2: H, class: 'bt-div' });
      const g = s('g', { class: 'bt-key bt-new' }, [
        s('rect', { width: CW, height: H, class: 'bt-cell' }), line,
        s('text', { x: CW / 2, y: H / 2, class: 'bt-label' }, String(k)),
      ]);
      if (clickAction) g.addEventListener('click', () => act(clickAction, k));
      keysG.append(g);
      const it = { g, line, pos: null, fresh: true };
      cells.set(k, it);
      return it;
    }
    const putBox = (it, p) => { it.pos = p; it.rect.setAttribute('x', p.x); it.rect.setAttribute('y', p.y); it.rect.setAttribute('width', p.w); };
    const putCell = (it, p) => { it.pos = p; it.g.setAttribute('transform', `translate(${p.x} ${p.y})`); };
    function drawEdges() {
      for (const { line, a, i, b } of lines.values()) {
        const A = boxes.get(a)?.pos, B = boxes.get(b)?.pos;
        if (!A || !B) continue;
        line.setAttribute('x1', A.x + i * CW); line.setAttribute('y1', A.y + H);
        line.setAttribute('x2', B.x + B.w / 2); line.setAttribute('y2', B.y);
      }
    }

    function draw(n) {
      const f = frames[n];
      const L = layout(f.tree);
      const path = new Set(f.path), hlKeys = new Set(f.keys);
      const seenB = new Set(), seenK = new Set();
      for (const b of L.boxes) {
        const it = boxItem(b.id);
        seenB.add(b.id);
        it.g.setAttribute('class', ['bt-node', b.id === f.hl && 'bt-hl', path.has(b.id) && 'bt-path', it.g.classList.contains('bt-new') && 'bt-new'].filter(Boolean).join(' '));
        it.to = b; it.from = it.pos ?? b;
        if (!it.pos) putBox(it, b);
      }
      for (const k of L.keys) {
        const it = cellItem(k.id);
        seenK.add(k.id);
        it.g.setAttribute('class', ['bt-key', hlKeys.has(k.id) && 'bt-khl', k.first && 'bt-first', clickAction && 'bt-click', it.g.classList.contains('bt-new') && 'bt-new'].filter(Boolean).join(' '));
        it.to = k; it.from = it.pos ?? k;
        if (!it.pos) putCell(it, k);
      }
      for (const [id, it] of boxes) if (!seenB.has(id)) { it.g.classList.add('bt-gone'); it.to = it.from = it.pos; }
      for (const [k, it] of cells) if (!seenK.has(k)) { it.g.classList.add('bt-gone'); it.to = it.from = it.pos; }
      // gli elementi nuovi compaiono con una dissolvenza, già nella loro posizione
      for (const it of [...boxes.values(), ...cells.values()]) if (it.fresh) { it.fresh = false; it.g.getBoundingClientRect(); it.g.classList.remove('bt-new'); }

      const want = new Set();
      for (const e of L.edges) {
        const key = `${e.a}>${e.b}`;
        want.add(key);
        let l = lines.get(key);
        if (!l) { l = { line: s('line', { class: 'bt-edge' }) }; lines.set(key, l); edgesG.append(l.line); }
        Object.assign(l, e);
        l.line.setAttribute('class', `bt-edge${path.has(e.a) && path.has(e.b) ? ' bt-epath' : ''}`);
      }
      for (const [key, l] of lines) if (!want.has(key)) { l.line.remove(); lines.delete(key); }

      cancelAnimationFrame(raf);
      const dur = !prefersReducedMotion() ? 700 / getSpeed() : 0;
      const t0 = performance.now();
      const lerp = (a, b, e) => a + (b - a) * e;
      const step = (now) => {
        const u = dur ? Math.min(1, (now - t0) / dur) : 1;
        const e = ease(u);
        for (const it of boxes.values()) if (it.to) putBox(it, { x: lerp(it.from.x, it.to.x, e), y: lerp(it.from.y, it.to.y, e), w: lerp(it.from.w, it.to.w, e) });
        for (const it of cells.values()) if (it.to) putCell(it, { x: lerp(it.from.x, it.to.x, e), y: lerp(it.from.y, it.to.y, e) });
        drawEdges();
        if (u < 1) raf = requestAnimationFrame(step);
      };
      step(t0);

      const parts = [];
      if (f.op) parts.push(`${sc(OPS[f.op.type])}(${f.op.key})`, `${sc('Page-Read')} = ${f.reads}`, `${sc('Page-Write')} = ${f.writes}`);
      parts.push(`h = ${f.h}`, `t = ${t}`);
      // un pezzo per valore, così nelle figure strette la riga va a capo tra un valore e l'altro
      eq.replaceChildren(...parts.map((p) => {
        const span = h('span', { class: 'eq-part' });
        katex.render(p, span, { throwOnError: false });
        return span;
      }));
      note.textContent = f.note;
    }

    compute();
    const player = createPlayer({ steps: frames.length, onStep: draw, interval, autoplay: ops.length > 0 });

    // una nuova operazione si aggiunge in fondo alla sequenza e si guarda subito
    function act(type, key) {
      if (key === null || key === '' || (numeric && !Number.isFinite(key))) return;
      ops = [...ops, `${type} ${key}`];
      compute();
      player.setSteps(frames.length, { keep: true });
      player.go(opStart[opStart.length - 1]);
      player.play();
    }

    const input = h('input', { type: 'text', class: 'key-in', value: '', placeholder: 'chiave', 'aria-label': 'chiave' });
    const keyOf = () => {
      const v = input.value.trim();
      if (!v || /[\s()]/.test(v)) return null;
      return numeric ? Math.trunc(Number(v)) : v.toUpperCase();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && actions.length) act(actions[0], keyOf()); });
    const opBtn = (type) => h('button', { type: 'button', class: 'seg-btn sc', onclick: () => act(type, keyOf()) }, OPS[type]);
    const reset = h('button', { type: 'button', class: 'seg-btn', title: 'Torna all\'albero e alle operazioni di partenza',
      onclick: () => { ops = initialOps; compute(); player.pause(); player.setSteps(frames.length); } }, '↺ Ripristina');

    // senza azioni (la figura di un singolo caso) l'albero non cambia, e i controlli non servono
    const controls = actions.length > 0 && h('div', { class: 'controls' }, [
      h('div', { class: 'seg' }, [input, ...actions.map(opBtn)]),
      h('div', { class: 'seg' }, reset),
    ]);
    const hint = clickAction && h('p', { class: 'widget-note hint' },
      `Si può anche cliccare su una chiave per ${clickAction === 'search' ? 'cercarla' : 'cancellarla'}.`);
    el.append(...[controls, svg, eq, note, player.el, hint].filter(Boolean));
  },
});
