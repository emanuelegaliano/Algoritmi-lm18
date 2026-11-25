// Generazione di un labirinto senza cicli con le operazioni sugli insiemi disgiunti, senza grafica.
// Le celle di una griglia size x size sono numerate da 1 a size^2 per righe, e ogni muro interno separa
// due celle adiacenti. run() considera i muri nell'ordine dato: se le due celle stanno in insiemi
// diversi il muro si abbatte e i due insiemi si uniscono, altrimenti il muro resta. Ogni fotogramma
// contiene lo stato completo, quindi disegnarlo non dipende dai fotogrammi precedenti. La usano sia il
// widget sia lo script che genera la figura TikZ del PDF.

export const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// tutti i muri interni: tra due celle vicine sulla stessa riga e tra due celle una sopra l'altra
export function allWalls(size) {
  const w = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = r * size + c + 1;
      if (c < size - 1) w.push([v, v + 1]);
      if (r < size - 1) w.push([v, v + size]);
    }
  }
  return w;
}

export function parseWall(raw, size) {
  const m = String(raw).trim().match(/^\(?\s*(\d+)\s*[-,]\s*(\d+)\s*\)?$/);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (lo < 1 || hi > size * size) return null;
  const adjacent = (hi - lo === 1 && (lo - 1) % size !== size - 1) || hi - lo === size;
  return adjacent ? [lo, hi] : null;
}

// un generatore pseudo-casuale con un seme, così lo stesso seme dà sempre lo stesso labirinto
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function randomWalls(size, seed) {
  const w = allWalls(size), rnd = rng(seed);
  for (let i = w.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [w[i], w[j]] = [w[j], w[i]]; }
  return w;
}

export function run(size, seq) {
  const N = size * size;
  const p = new Array(N + 1).fill(0).map((_, i) => i), rank = new Array(N + 1).fill(0), sz = new Array(N + 1).fill(1);
  const find = (x) => (p[x] === x ? x : (p[x] = find(p[x])));
  const color = new Map(); // radice -> colore dell'insieme, per gli insiemi con almeno due celle
  let nextColor = 0, unions = 0;
  const removed = [], rejected = [], frames = [];

  const snapshot = () => {
    const cells = [];
    for (let v = 1; v <= N; v++) { const r = find(v); cells.push(sz[r] > 1 ? color.get(r) : null); }
    return cells;
  };
  const emit = (f) => frames.push({ removed: [...removed], rejected: [...rejected], cells: snapshot(), unions, ...f });

  emit({ step: -1, note: `All'inizio ci sono tutti i muri, e ogni cella è un insieme a sé, creato da MAKE-SET(1), …, MAKE-SET(${N}).` });
  for (let i = 0; i < seq.length && unions < N - 1; i++) {
    const [a, b] = seq[i];
    const ra = find(a), rb = find(b);
    if (ra !== rb) {
      const c = sz[ra] >= sz[rb] ? (color.get(ra) ?? color.get(rb)) : (color.get(rb) ?? color.get(ra));
      let root = ra, child = rb;
      if (rank[ra] < rank[rb]) [root, child] = [rb, ra];
      else if (rank[ra] === rank[rb]) rank[ra]++;
      p[child] = root; sz[root] += sz[child];
      color.delete(child); color.set(root, c ?? nextColor++);
      unions++;
      removed.push(key(a, b));
      emit({ step: i, cur: key(a, b), ok: true, pair: [a, b],
        note: `Muro tra ${a} e ${b}: FIND-SET(${a}) ≠ FIND-SET(${b}), quindi le due celle non sono ancora collegate. Il muro si abbatte, con UNION(${a}, ${b}).` });
    } else {
      rejected.push(key(a, b));
      emit({ step: i, cur: key(a, b), ok: false, pair: [a, b],
        note: `Muro tra ${a} e ${b}: FIND-SET(${a}) = FIND-SET(${b}), quindi le due celle sono già collegate da un cammino. Abbattere il muro creerebbe un ciclo, e il muro resta.` });
    }
  }
  // l'unico cammino tra l'entrata (la cella 1) e l'uscita (l'ultima cella), se le due celle sono collegate
  let path = null;
  if (find(1) === find(N)) {
    const open = new Set(removed), prev = new Map([[1, 0]]), queue = [1];
    while (queue.length) {
      const v = queue.shift();
      const r = Math.floor((v - 1) / size), c = (v - 1) % size;
      const nb = [c > 0 && v - 1, c < size - 1 && v + 1, r > 0 && v - size, r < size - 1 && v + size].filter(Boolean);
      for (const u of nb) if (!prev.has(u) && open.has(key(u, v))) { prev.set(u, v); queue.push(u); }
    }
    path = [];
    for (let v = N; v; v = prev.get(v)) path.unshift(v);
  }
  if (unions === N - 1) {
    emit({ step: seq.length, done: true, path,
      note: `Tutte le celle stanno nello stesso insieme: i muri abbattuti sono ${N - 1}, uno in meno delle celle, e tra l'entrata e l'uscita c'è un solo cammino.` });
  } else if (path) {
    emit({ step: seq.length, done: true, path, note: `L'entrata e l'uscita sono collegate da un solo cammino, ma non tutte le celle sono raggiungibili.` });
  }
  return frames;
}
