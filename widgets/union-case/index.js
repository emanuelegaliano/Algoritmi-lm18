import katex from 'katex';
import { defineWidget, h, svgRoot, createPlayer } from 'texweb/client';
import { sc } from '../lib/util.js';
import { createForestView } from '../lib/forest-view.js';
import './style.css';

// Un'iterazione del ciclo di Binomial-Heap-Union in uno dei quattro casi, una riga dello pseudocodice
// alla volta. Le radici a, b, c, d sono consecutive nella lista delle radici: all'inizio prev-x punta
// ad a, x a b, next-x a c, e d è sibling[next-x]. Sotto ogni radice c'è il suo albero, disegnato come
// un triangolo. Una radice tolta dalla lista scende di un livello, e con Binomial-Link diventa il
// primo figlio dell'altra radice.

const R = 14, S = 96, LEFT = 66, TOP = 50, DROP = 50, CHILD = 52, TRI_H = 44, TRI_W = 17;
const COL = { a: LEFT, b: LEFT + S, c: LEFT + 2 * S, d: LEFT + 3 * S };
const W = COL.d + LEFT, H = 200;
const NODES = ['a', 'b', 'c', 'd'];
const PTRS = ['prev-x', 'x', 'next-x', 'sibling[next-x]'];
const TRI = `M0,0 L${-TRI_W},${TRI_H} L${TRI_W},${TRI_H} Z`;
// la graffa sotto il nuovo B_{k+1}, che va dal sottoalbero del figlio a quello della radice
const HB = CHILD / 2 + TRI_W + 2;
const BRACE = `M${-HB},0 q0,5 5,5 H-5 q5,0 5,5 q0,-5 5,-5 H${HB - 5} q5,0 5,-5`;

const MACROS = { '\\prevx': '\\mathit{prev}\\text{-}x', '\\nextx': '\\mathit{next}\\text{-}x', '\\Link': sc('Binomial-Link') };
const tex = (src, el) => katex.render(src, el, { throwOnError: false, macros: { ...MACROS } });

// un testo con le formule tra dollari, come nel LaTeX; la punteggiatura subito dopo una formula
// resta sulla sua riga, invece di andare a capo da sola
function rich(el, str) {
  const parts = str.split('$');
  el.replaceChildren(...parts.map((part, i) => {
    if (i % 2 === 0) return document.createTextNode(part);
    const span = h('span', { class: 'uc-math' });
    tex(part, span);
    const punct = parts[i + 1]?.match(/^[,.;:]+/)?.[0];
    if (punct) { span.append(punct); parts[i + 1] = parts[i + 1].slice(punct.length); }
    return span;
  }));
}

const DEG = '\\mathit{degree}';
const SAME = [`${DEG}[x] = ${DEG}[\\nextx] = k`, `${DEG}[\\mathit{sibling}[\\nextx]] = l \\ne k`];
const ADVANCE = [
  { ptr: { 'prev-x': 'b' }, eq: ['\\prevx \\gets x'], note: '$\\prevx$ avanza sulla radice corrente.' },
  { ptr: { x: 'c' }, eq: ['x \\gets \\nextx'], note: '$x$ avanza sulla radice successiva.' },
];
// next-x avanza: sibling[next-x] è ora la radice dopo d, che non è disegnata
const NEXT = { ptr: { 'next-x': 'd', 'sibling[next-x]': null }, eq: ['\\nextx \\gets \\mathit{sibling}[x]'] };

// per ogni caso: i pedici dei sottoalberi e i passi, ciascuno con le modifiche rispetto al precedente
// (list: la lista delle radici, out: le radici tolte dalla lista, stale: i puntatori sibling di una
// radice tolta, links: le coppie padre-figlio create da Binomial-Link, hl: le radici evidenziate)
const CASES = {
  1: {
    sub: { b: 'k', c: 'l' },
    steps: [
      { eq: [`${DEG}[x] = k \\ne l = ${DEG}[\\nextx]`],
        note: '$x$ è la radice di un $B_k$ e $\\nextx$ di un $B_l$, con $l > k$: $x$ è l\'unica radice di grado $k$, e non c\'è niente da collegare.' },
      ...ADVANCE,
      { ...NEXT, note: 'Anche $\\nextx$ avanza. La lista non è cambiata: i tre puntatori sono avanzati di una posizione.' },
    ],
  },
  2: {
    sub: { b: 'k', c: 'k', d: 'k' },
    steps: [
      { eq: [`${DEG}[x] = ${DEG}[\\nextx] = ${DEG}[\\mathit{sibling}[\\nextx]] = k`],
        note: 'Le radici $x$, $\\nextx$ e $\\mathit{sibling}[\\nextx]$ hanno tutte grado $k$. La prima resta nel risultato, mentre le altre due vanno collegate.' },
      ...ADVANCE,
      { ...NEXT, note: 'Anche $\\nextx$ avanza. Alla prossima iterazione $x$ e $\\nextx$ sono le ultime due radici di grado $k$, e si collegano con il caso 3 o 4.' },
    ],
  },
  3: {
    sub: { b: 'k', c: 'k', d: 'l' },
    steps: [
      { eq: [...SAME, '\\mathit{key}[x] \\le \\mathit{key}[\\nextx]'],
        note: '$x$ e $\\nextx$ sono le uniche due radici di grado $k$, e la chiave di $x$ non supera quella di $\\nextx$: $\\nextx$ diventerà figlio di $x$.' },
      { list: ['a', 'b', 'd'], out: ['c'], stale: [['c', 'd']], hl: ['c'], eq: ['\\mathit{sibling}[x] \\gets \\mathit{sibling}[\\nextx]'],
        note: '$\\nextx$ esce dalla lista delle radici: ora dopo $x$ viene la radice che seguiva $\\nextx$.' },
      { out: [], stale: [], links: [['b', 'c']], ptr: { 'sibling[next-x]': null }, eq: ['\\Link(\\nextx, x)'],
        note: '$\\nextx$ diventa il primo figlio di $x$, che ora è la radice di un $B_{k+1}$.' },
      { hl: [], ptr: { 'next-x': 'd' }, eq: ['\\nextx \\gets \\mathit{sibling}[x]'],
        note: '$\\nextx$ avanza sulla radice che segue $x$, mentre $x$ resta dov\'è: se anche la nuova $\\nextx$ ha grado $k+1$, la prossima iterazione la collegherà a $x$.' },
    ],
  },
  4: {
    sub: { b: 'k', c: 'k', d: 'l' },
    steps: [
      { eq: [...SAME, '\\mathit{key}[x] > \\mathit{key}[\\nextx]'],
        note: '$x$ e $\\nextx$ sono le uniche due radici di grado $k$, ma questa volta è $\\nextx$ ad avere la chiave minore: $x$ diventerà figlio di $\\nextx$.' },
      { list: ['a', 'c', 'd'], out: ['b'], stale: [['b', 'c']], hl: ['b'], eq: ['\\mathit{sibling}[\\prevx] \\gets \\nextx'],
        note: '$x$ esce dalla lista delle radici: ora dopo $\\prevx$ viene $\\nextx$. Se $x$ fosse la prima radice, si aggiornerebbe invece $\\mathit{head}[H]$.' },
      { out: [], stale: [], links: [['c', 'b']], eq: ['\\Link(x, \\nextx)'],
        note: '$x$ diventa il primo figlio di $\\nextx$, che ora è la radice di un $B_{k+1}$.' },
      { hl: [], ptr: { x: 'c' }, eq: ['x \\gets \\nextx'],
        note: '$x$ avanza sulla radice del nuovo $B_{k+1}$.' },
      { ...NEXT, note: '$\\nextx$ avanza sulla radice successiva. Come nel caso 3, se anche questa ha grado $k+1$, la prossima iterazione la collegherà a $x$.' },
    ],
  },
};

const START = {
  list: NODES, out: [], stale: [], links: [], hl: [],
  ptr: { 'prev-x': 'a', x: 'b', 'next-x': 'c', 'sibling[next-x]': 'd' },
};

// gli stati completi, applicando a ogni passo le modifiche al precedente
function build(steps) {
  let st = START;
  return steps.map(({ ptr = {}, ...rest }) => {
    const p = { ...st.ptr };
    for (const [name, v] of Object.entries(ptr)) if (v == null) delete p[name]; else p[name] = v;
    st = { ...st, ...rest, ptr: p };
    return st;
  });
}

// una radice sta nella sua colonna; se è stata tolta dalla lista scende di un livello, e da figlio
// si mette in basso a sinistra del padre
function place(st, v) {
  const link = st.links.find(([, child]) => child === v);
  if (link) return [COL[link[0]] - CHILD, TOP + DROP];
  return [COL[v], st.out.includes(v) ? TOP + DROP : TOP];
}

// i puntatori sopra uno stesso nodo si impilano: più in basso quello che ci è arrivato prima,
// così chi arriva si mette sopra e gli altri non si spostano
function stacks(states, n) {
  const st = states[n];
  const since = (p) => { let m = n; while (m > 0 && states[m - 1].ptr[p] === st.ptr[p]) m--; return m; };
  const at = {};
  for (const p of PTRS) if (st.ptr[p]) (at[st.ptr[p]] ??= []).push(p);
  const res = [];
  for (const ps of Object.values(at)) {
    ps.sort((u, v) => since(u) - since(v) || PTRS.indexOf(u) - PTRS.indexOf(v));
    ps.forEach((p, i) => res.push({ p, node: st.ptr[p], i }));
  }
  return res;
}

const Bsub = (k) => [{ text: 'B' }, { text: k, sub: true }];

export default defineWidget({
  name: 'union-case',
  params: {
    case: { type: 'integer', default: 1, min: 1, max: 4 },
    interval: { type: 'number', default: 2200, min: 300 },
  },

  mount(el, { case: which, interval }) {
    el.classList.add('w-forest', 'w-ucase');
    const { sub, steps } = CASES[which];
    const states = build(steps);
    const svg = svgRoot(W, H, { 'aria-label': `Il caso ${which} di un'iterazione del ciclo di Binomial-Heap-Union, un passo alla volta` });
    svg.style.maxWidth = `${Math.round(W * 1.35)}px`;
    const view = createForestView(svg, { radius: R });
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    function draw(n) {
      const st = states[n];
      const items = [], edges = [], arrows = [];
      const pos = Object.fromEntries(NODES.map((v) => [v, place(st, v)]));
      for (const v of NODES) {
        const [x, y] = pos[v];
        const hl = st.hl.includes(v);
        items.push({ id: `tri:${v}`, kind: 'shape', x, y, d: TRI, cls: `uc-tri${hl ? ' uc-tri-hl' : ''}` });
        items.push({ id: `n:${v}`, x, y, label: v, cls: hl ? 'fv-hl' : '' });
        if (sub[v]) items.push({ id: `sub:${v}`, kind: 'text', x, y: y + TRI_H + 14, parts: Bsub(sub[v]), cls: 'uc-sub' });
      }
      // la lista delle radici prosegue a sinistra di a e a destra di d
      items.push({ id: 'dots:L', kind: 'text', x: 14, y: TOP, text: '⋯', cls: 'uc-dots' }, { id: 'pt:L', kind: 'point', x: 30, y: TOP });
      items.push({ id: 'dots:R', kind: 'text', x: W - 14, y: TOP, text: '⋯', cls: 'uc-dots' }, { id: 'pt:R', kind: 'point', x: W - 30, y: TOP });
      arrows.push({ a: 'pt:L', b: `n:${st.list[0]}`, ra: 0 });
      st.list.forEach((v, i) => arrows.push(i + 1 < st.list.length
        ? { a: `n:${v}`, b: `n:${st.list[i + 1]}` }
        : { a: `n:${v}`, b: 'pt:R', rb: 0 }));
      for (const [u, v] of st.stale) arrows.push({ a: `n:${u}`, b: `n:${v}`, cls: 'uc-stale' });
      for (const [p, child] of st.links) {
        edges.push({ a: `n:${p}`, b: `n:${child}` });
        const x = COL[p] - CHILD / 2, y = TOP + DROP + TRI_H + 24;
        items.push({ id: 'brace', kind: 'shape', x, y, d: BRACE, cls: 'uc-brace' });
        items.push({ id: 'brace:lab', kind: 'text', x, y: y + 22, parts: Bsub('k+1'), cls: 'uc-sub' });
      }
      for (const { p, node, i } of stacks(states, n)) {
        const [x, y] = pos[node];
        // sopra una radice tolta dalla lista l'etichetta si sposta a sinistra, lontano dall'arco
        // verso il padre e dal vecchio puntatore sibling
        items.push({ id: `p:${p}`, kind: 'text', x: y > TOP ? x - 8 : x, y: y - R - 9 - 15 * i, text: p, cls: 'uc-ptr' });
      }
      view.render({ items, edges, arrows });

      eq.replaceChildren(...st.eq.map((src) => {
        const span = h('span', { class: 'eq-part' });
        tex(src, span);
        return span;
      }));
      rich(note, st.note);
    }

    const player = createPlayer({ steps: states.length, onStep: draw, interval });
    el.append(svg, eq, note, player.el);
  },
});
