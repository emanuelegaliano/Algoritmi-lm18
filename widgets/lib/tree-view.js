import { s, getSpeed, prefersReducedMotion } from 'texweb/client';
import './tree-view.css';

// Codice comune ai widget sugli alberi (questa cartella non ha index.js, quindi non è un widget).
//
// Gli alberi si disegnano con le chiavi in ordine da sinistra a destra (in-order): una rotazione
// non cambia l'ordine, quindi sposta i nodi solo in verticale, ed è proprio ciò che si vede.
// render() riceve lo stato da mostrare (nodi, sottoalberi e archi) e porta ogni elemento dalla
// posizione attuale a quella nuova con un'animazione; gli archi seguono i nodi a ogni fotogramma.

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function createTreeView(svg, { slot = 40, level = 50, left = 30, top = 26, radius = 15, onClick } = {}) {
  const edgesG = s('g', { class: 'tv-edges' });
  const itemsG = s('g', { class: 'tv-items' });
  svg.append(edgesG, itemsG);

  const items = new Map(); // id -> { g, label, note, pos, from, to }
  const lines = new Map(); // 'a>b' -> { line, a, b }
  let raf = null;

  const xy = (x, depth) => [left + x * slot, top + depth * level];

  function make(spec) {
    const g = s('g', { class: 'tv-item tv-new' });
    let label;
    if (spec.kind === 'tri') {
      // un sottoalbero: triangolo con il vertice nel punto dell'arco
      g.append(s('path', { d: `M0 0 L${-slot * 0.42} ${level * 0.95} L${slot * 0.42} ${level * 0.95} Z`, class: 'tv-tri' }));
      label = s('text', { x: 0, y: level * 0.66, class: 'tv-tri-label' });
    } else {
      g.append(s('circle', { r: radius, class: 'tv-node' }));
      label = s('text', { class: 'tv-label' });
      if (onClick) {
        g.classList.add('tv-click');
        g.addEventListener('click', () => onClick(spec.id));
      }
    }
    const note = s('text', { x: radius + 6, y: -radius - 3, class: 'tv-note' });
    g.append(label, note);
    itemsG.append(g);
    const it = { g, label, note, pos: null, fresh: true };
    items.set(spec.id, it);
    return it;
  }

  const put = (it, [x, y]) => { it.pos = [x, y]; it.g.setAttribute('transform', `translate(${x} ${y})`); };

  function drawEdges() {
    for (const { line, a, b } of lines.values()) {
      const A = items.get(a)?.pos, B = items.get(b)?.pos;
      if (!A || !B) continue;
      line.setAttribute('x1', A[0]); line.setAttribute('y1', A[1]);
      line.setAttribute('x2', B[0]); line.setAttribute('y2', B[1]);
    }
  }

  // nodes: [{ id, x, depth, label, kind: 'node' | 'tri', cls, note }], edges: [{ a, b, cls }]
  function render(nodes, edges, { animate = true } = {}) {
    const seen = new Set();
    for (const spec of nodes) {
      const it = items.get(spec.id) ?? make(spec);
      seen.add(spec.id);
      it.label.textContent = spec.label ?? spec.id;
      it.note.textContent = spec.note ?? '';
      it.g.setAttribute('class', ['tv-item', spec.kind === 'tri' ? 'tv-sub' : 'tv-key', spec.cls, it.g.classList.contains('tv-new') && 'tv-new', onClick && spec.kind !== 'tri' && 'tv-click'].filter(Boolean).join(' '));
      it.to = xy(spec.x, spec.depth);
      it.from = it.pos ?? it.to;
      if (!it.pos) put(it, it.to);
    }
    for (const [id, it] of items) if (!seen.has(id)) { it.g.classList.add('tv-gone'); it.to = it.from = it.pos; }
    // gli elementi nuovi compaiono con una dissolvenza, già nella loro posizione: si forza il calcolo
    // dello stile iniziale (trasparente), poi si toglie la classe
    for (const it of items.values()) if (it.fresh) { it.fresh = false; it.g.getBoundingClientRect(); it.g.classList.remove('tv-new'); }

    const want = new Set();
    for (const e of edges) {
      const key = `${e.a}>${e.b}`;
      want.add(key);
      let l = lines.get(key);
      if (!l) { l = { line: s('line', { class: 'tv-edge' }), a: e.a, b: e.b }; lines.set(key, l); edgesG.append(l.line); }
      l.line.setAttribute('class', ['tv-edge', e.cls].filter(Boolean).join(' '));
    }
    for (const [key, l] of lines) if (!want.has(key)) { l.line.remove(); lines.delete(key); }

    cancelAnimationFrame(raf);
    const dur = animate && !prefersReducedMotion() ? 650 / getSpeed() : 0;
    const t0 = performance.now();
    const frame = (now) => {
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = ease(t);
      for (const it of items.values()) {
        if (!it.to) continue;
        put(it, [it.from[0] + (it.to[0] - it.from[0]) * e, it.from[1] + (it.to[1] - it.from[1]) * e]);
      }
      drawEdges();
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    frame(t0);
  }

  return { render, xy };
}

// un albero come { k, l, r } (oppure una stringa per un sottoalbero disegnato come triangolo):
// posizioni in ordine (in-order) e profondità, per tutta una foresta
// gap: colonne vuote tra un albero e il successivo della foresta
export function layout(roots, { label = (k) => String(k), gap = 0 } = {}) {
  const nodes = [], edges = [];
  let x = 0;
  const visit = (t, depth, parent) => {
    if (t == null) return;
    if (typeof t === 'string') {
      nodes.push({ id: t, kind: 'tri', label: t, x: x++, depth });
      if (parent != null) edges.push({ a: parent, b: t });
      return;
    }
    visit(t.l, depth + 1, t.k);
    nodes.push({ id: t.k, kind: 'node', label: label(t.k), x: x++, depth });
    if (parent != null) edges.push({ a: parent, b: t.k });
    visit(t.r, depth + 1, t.k);
  };
  roots.forEach((t, i) => { if (i) x += gap; visit(t, 0, null); });
  return { nodes, edges, width: x };
}
