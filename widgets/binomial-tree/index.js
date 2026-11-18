import katex from 'katex';
import { defineWidget, h, svgRoot, createPlayer } from 'texweb/client';
import { createForestView } from '../lib/forest-view.js';
import { steps as makeSteps, arrange, canon, binom, width, subtreeOf } from './model.js';
import './style.css';

// La costruzione degli alberi binomiali fino a B_K: a ogni passo due copie di B_{k-1}, poi la radice
// di quella di sinistra diventa il primo figlio della radice dell'altra. Si possono colorare le due copie
// (a destra il numero di nodi per profondità, come somma dei contributi delle due copie) oppure i
// sottoalberi dei figli della radice, che sono B_{k-1}, ..., B_0.

const SUB = '₀₁₂₃₄₅₆₇₈₉';
// B_k con il pedice: nelle note (HTML) con le cifre Unicode, nella figura (SVG) con un pedice vero,
// perché il font delle etichette non ha le cifre a pedice e le disegnerebbe a grandezza normale
const Bname = (k) => `B${String(k).replace(/\d/g, (d) => SUB[d])}`;
const Bparts = (k) => [{ text: 'B' }, { text: String(k), sub: true }];
const COL = 30, LEVEL = 42, R = 8.5, TOP = 34, LEFT = 86, RIGHT = 128, GAP = 1;

export default defineWidget({
  name: 'binomial-tree',
  params: {
    k: { type: 'integer', default: 4, min: 1, max: 5 },
    view: { type: 'enum', values: ['copie', 'figli'], default: 'copie' },
    interval: { type: 'number', default: 1700, min: 300 },
  },

  mount(el, { k: K, view: view0, interval }) {
    el.classList.add('w-forest', 'w-bintree');
    let view = view0;
    const steps = makeSteps(K);
    const all = steps.map((st) => arrange(st, GAP));
    const cols = Math.max(...all.map((a) => a.cols));
    const W = LEFT + cols * COL + RIGHT, Hh = TOP + K * LEVEL + R + 34;
    const svg = svgRoot(W, Hh, { 'aria-label': `La costruzione degli alberi binomiali da B₀ a ${Bname(K)}` });
    const fv = createForestView(svg, { radius: R });
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });
    const legend = h('div', { class: 'bt-legend' }, [
      h('span', { class: 'bt-key' }, [h('span', { class: 'bt-dot c-a-dot' }), 'copia di sinistra, che scende di un livello']),
      h('span', { class: 'bt-key' }, [h('span', { class: 'bt-dot c-b-dot' }), 'copia di destra, che conserva la radice']),
    ]);
    const X = (col) => LEFT + (col + 0.5) * COL, Y = (d) => TOP + d * LEVEL;

    function draw(n) {
      const st = steps[n], A = all[n], k = st.k;
      const items = [], edges = [];
      const isTree = st.kind === 'tree';
      for (const v of A.nodes) {
        let cls;
        if (view === 'copie') cls = k === 0 ? 'c-b' : v.s[0] === '0' ? 'c-a' : 'c-b';
        else { const d = subtreeOf(v.local); cls = d == null ? 'c-root' : `c-d${d % 5}`; }
        items.push({ id: `v${canon(v.s)}`, x: X(v.col), y: Y(v.depth), r: R, label: '', cls });
      }
      for (const e of A.edges) edges.push({ a: `v${canon(e.a)}`, b: `v${canon(e.b)}` });

      // profondità a sinistra; a destra il numero di nodi per profondità di B_k
      const yLab = Y(A.depth) + R + 20;
      items.push({ id: 'dep:h', kind: 'text', x: LEFT - 18, y: TOP - 22, text: 'profondità', anchor: 'end', cls: 'bt-head' });
      for (let i = 0; i <= A.depth; i++) items.push({ id: `dep:${i}`, kind: 'text', x: LEFT - 18, y: Y(i), text: String(i), anchor: 'end', cls: 'bt-num' });
      if (isTree) {
        const xr = LEFT + cols * COL + 14;
        items.push({ id: 'cnt:h', kind: 'text', x: xr, y: TOP - 22, text: 'nodi', anchor: 'start', cls: 'bt-head' });
        for (let i = 0; i <= k; i++) {
          const parts = view === 'copie' && k > 0
            ? [{ text: String(binom(k - 1, i - 1)), cls: 'c-a-t' }, { text: ' + ' }, { text: String(binom(k - 1, i)), cls: 'c-b-t' }, { text: ` = ${binom(k, i)}` }]
            : [{ text: String(binom(k, i)) }];
          items.push({ id: `cnt:${i}`, kind: 'text', x: xr, y: Y(i), parts, anchor: 'start', cls: 'bt-num' });
        }
      }
      // i nomi dei sottoalberi: le due copie, oppure i figli della radice
      if (view === 'copie') {
        if (k === 0) items.push({ id: 'lab:R', kind: 'text', x: X(0), y: yLab, parts: Bparts(0), cls: 'bt-sub c-b-t' });
        else {
          const w = width(k - 1);
          const right = isTree ? (k === 1 ? 0 : w) : w + GAP;
          items.push({ id: 'lab:L', kind: 'text', x: X((w - 1) / 2), y: yLab, parts: Bparts(k - 1), cls: 'bt-sub c-a-t' });
          items.push({ id: 'lab:R', kind: 'text', x: X(right + (w - 1) / 2) + (isTree && k === 1 ? 26 : 0), y: yLab, parts: Bparts(k - 1), cls: 'bt-sub c-b-t' });
        }
      } else {
        for (const v of A.nodes) {
          if (v.local === '' || !/^1*01*$/.test(v.local)) continue; // solo i figli della radice
          const d = (v.local.length - 1) - v.local.indexOf('0');
          items.push({ id: `lab:${canon(v.s)}`, kind: 'text', x: X(v.col - (width(d) - 1) / 2), y: yLab, parts: Bparts(d), cls: `bt-sub c-d${d % 5}-t` });
        }
      }
      // la legenda dà un nome alle due copie, con i nomi usati nella dimostrazione del capitolo
      legend.style.visibility = view === 'copie' && k > 0 ? 'visible' : 'hidden';
      fv.render({ items, edges });

      const tex = isTree
        ? `B_{${k}}:\\quad 2^{${k}} = ${2 ** k}\\ \\text{nodi},\\quad h = ${k},\\quad \\deg(\\text{radice}) = ${k}`
        : `B_{${k}} = \\text{due copie di } B_{${k - 1}}`;
      katex.render(tex, eq, { throwOnError: false });
      if (!isTree) note.textContent = `Due copie di ${Bname(k - 1)}, con ${2 ** (k - 1)} nod${k === 1 ? 'o' : 'i'} ciascuna.`;
      else if (k === 0) note.textContent = `${Bname(0)} è formato da un solo nodo.`;
      else note.textContent = `La radice della copia di sinistra diventa il primo figlio della radice dell'altra: ${Bname(k)} ha ${2 ** k} nodi e altezza ${k}. `
        + (view === 'copie'
          ? 'La copia di sinistra scende di un livello, quindi a ogni profondità i si sommano i suoi nodi a profondità i − 1 e quelli a profondità i dell\'altra copia.'
          : `I figli della radice sono, da sinistra, le radici di ${Array.from({ length: k }, (_, j) => Bname(k - 1 - j)).join(', ')}.`);
    }

    const player = createPlayer({ steps: steps.length, onStep: draw, interval });
    const seg = h('div', { class: 'seg' }, [['copie', 'le due copie'], ['figli', 'i figli della radice']].map(([v, label]) => {
      const b = h('button', { type: 'button', class: `seg-btn${v === view ? ' on' : ''}`, onclick: () => {
        view = v;
        seg.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('on', x === b));
        draw(player.index);
      } }, label);
      return b;
    }));
    el.append(h('div', { class: 'controls' }, [h('span', { class: 'ctl-label' }, 'Colora'), seg]), svg, legend, eq, note, player.el);
  },
});
