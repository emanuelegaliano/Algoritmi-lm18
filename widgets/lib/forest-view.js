import { s, getSpeed, prefersReducedMotion } from 'texweb/client';
import './forest-view.css';

// Disegno animato di una foresta, usato dai widget sugli alberi e sugli heap binomiali
// (questa cartella non ha index.js, quindi non è un widget).
//
// render() riceve lo stato da mostrare, con le coordinate già in pixel:
//   items:  le cose che si vedono e si spostano. Un nodo { id, x, y, label, cls, r } è un cerchio con
//           un'etichetta, un testo { id, kind: 'text', x, y, text, cls, anchor } è una scritta (al posto
//           di text si possono dare dei pezzi parts: [{ text, cls }] con stili diversi), e un punto
//           { id, kind: 'point', x, y } non si vede ma può essere l'estremo di un arco o di una freccia;
//   edges:  segmenti tra i centri di due elementi { a, b, cls }, disegnati sotto i nodi;
//   arrows: frecce tra due elementi { a, b, ra, rb, cls }, accorciate di ra all'inizio e di rb alla fine.
// Ogni elemento va dalla posizione attuale a quella nuova con un'animazione, e archi e frecce lo
// seguono a ogni fotogramma. Gli elementi nuovi compaiono con una dissolvenza, quelli che non ci sono
// più spariscono con una dissolvenza nel punto in cui si trovano.

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
let markers = 0;

export function createForestView(svg, { radius = 14, onClick } = {}) {
  const markerId = `fv-arrow-${++markers}`;
  svg.append(s('defs', {}, s('marker', {
    id: markerId, viewBox: '0 0 10 10', refX: 9.5, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse',
  }, s('path', { d: 'M0,0.6 L10,5 L0,9.4 z', class: 'fv-arrowhead' }))));
  const edgesG = s('g', { class: 'fv-edges' });
  const arrowsG = s('g', { class: 'fv-arrows' });
  const nodesG = s('g', { class: 'fv-nodes' });
  const textsG = s('g', { class: 'fv-texts' });
  svg.append(edgesG, arrowsG, nodesG, textsG);

  const items = new Map(); // id -> { kind, g, label, pos, from, to, fresh }
  const edges = new Map(); // 'a>b' -> { line, a, b }
  const arrows = new Map(); // 'a>b' -> { line, a, b, ra, rb }
  let raf = null;

  function make(spec) {
    const kind = spec.kind ?? 'node';
    let g = null, label = null;
    if (kind === 'node') {
      label = s('text', { class: 'fv-label' });
      g = s('g', { class: 'fv-node fv-new' }, [s('circle', { r: spec.r ?? radius, class: 'fv-circle' }), label]);
      if (onClick) g.addEventListener('click', () => onClick(spec.id));
      nodesG.append(g);
    } else if (kind === 'text') {
      g = label = s('text', { class: 'fv-text fv-new' });
      textsG.append(g);
    }
    const it = { kind, g, label, pos: null, fresh: g != null };
    items.set(spec.id, it);
    return it;
  }

  const put = (it, [x, y]) => {
    it.pos = [x, y];
    if (it.g) it.g.setAttribute('transform', `translate(${x} ${y})`);
  };

  function drawLines() {
    for (const { line, a, b } of edges.values()) {
      const A = items.get(a)?.pos, Bp = items.get(b)?.pos;
      if (!A || !Bp) continue;
      line.setAttribute('x1', A[0]); line.setAttribute('y1', A[1]);
      line.setAttribute('x2', Bp[0]); line.setAttribute('y2', Bp[1]);
    }
    for (const { line, a, b, ra, rb } of arrows.values()) {
      const A = items.get(a)?.pos, Bp = items.get(b)?.pos;
      if (!A || !Bp) continue;
      const dx = Bp[0] - A[0], dy = Bp[1] - A[1], d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      line.setAttribute('x1', A[0] + ux * ra); line.setAttribute('y1', A[1] + uy * ra);
      line.setAttribute('x2', Bp[0] - ux * rb); line.setAttribute('y2', Bp[1] - uy * rb);
    }
  }

  function syncLines(map, specs, layer, extra) {
    const want = new Set();
    for (const e of specs) {
      const key = `${e.a}>${e.b}`;
      want.add(key);
      let l = map.get(key);
      if (!l) { l = { line: s('line', {}) }; map.set(key, l); layer.append(l.line); }
      Object.assign(l, e);
      l.line.setAttribute('class', [extra, e.cls].filter(Boolean).join(' '));
    }
    for (const [key, l] of map) if (!want.has(key)) { l.line.remove(); map.delete(key); }
  }

  function render({ items: specs = [], edges: edgeSpecs = [], arrows: arrowSpecs = [] }, { animate = true } = {}) {
    const seen = new Set();
    for (const spec of specs) {
      const it = items.get(spec.id) ?? make(spec);
      seen.add(spec.id);
      if (it.kind === 'node') {
        it.label.textContent = spec.label ?? '';
        it.g.setAttribute('class', ['fv-node', spec.cls, onClick && 'fv-click', it.fresh && 'fv-new'].filter(Boolean).join(' '));
      } else if (it.kind === 'text') {
        // un testo può essere fatto di pezzi { text, cls } con stili diversi
        if (spec.parts) it.g.replaceChildren(...spec.parts.map((p) => s('tspan', { class: p.cls }, p.text)));
        else it.g.textContent = spec.text ?? '';
        it.g.setAttribute('class', ['fv-text', spec.cls, it.fresh && 'fv-new'].filter(Boolean).join(' '));
        it.g.setAttribute('text-anchor', spec.anchor ?? 'middle');
      }
      it.to = [spec.x, spec.y];
      it.from = it.pos ?? it.to;
      if (!it.pos) put(it, it.to);
    }
    for (const [id, it] of items) {
      if (seen.has(id)) continue;
      it.g?.classList.add('fv-gone');
      it.to = it.from = it.pos;
    }
    // gli elementi nuovi compaiono con una dissolvenza, già nella loro posizione: si forza il calcolo
    // dello stile iniziale (trasparente), poi si toglie la classe
    for (const it of items.values()) if (it.fresh) { it.fresh = false; it.g.getBoundingClientRect(); it.g.classList.remove('fv-new'); }

    syncLines(edges, edgeSpecs, edgesG, 'fv-edge');
    syncLines(arrows, arrowSpecs.map((a) => ({ ra: radius, rb: radius, ...a })), arrowsG, 'fv-arrow');
    for (const l of arrows.values()) l.line.setAttribute('marker-end', `url(#${markerId})`);

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
      drawLines();
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    frame(t0);
  }

  return { render };
}
