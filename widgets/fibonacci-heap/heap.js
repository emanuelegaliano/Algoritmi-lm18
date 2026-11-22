// Heap di Fibonacci con le procedure del capitolo, senza grafica: run() esegue una sequenza di operazioni
// e restituisce i fotogrammi che il widget mostra uno alla volta. Ogni fotogramma contiene una copia della
// lista delle radici, quindi disegnarlo non dipende dai fotogrammi precedenti. layout() calcola le
// posizioni dei nodi di un fotogramma: la usano sia il widget sia lo script che genera le figure TikZ
// del PDF, così le due versioni mostrano gli stessi alberi.
//
// La lista delle radici e le liste dei figli sono circolari e doppiamente concatenate: qui sono array,
// nell'ordine in cui si disegnano, e right[x] è l'elemento successivo (dopo l'ultimo viene il primo).
// Una nuova radice va a sinistra di min[H], e un nuovo figlio all'inizio della lista dei figli, come
// nelle figure del libro.

export const PHI = (1 + Math.sqrt(5)) / 2;
// il limite al grado massimo dimostrato nel capitolo, D(n) = floor(log_phi n)
export const maxDegree = (n) => (n < 1 ? 0 : Math.floor(Math.log(n) / Math.log(PHI) + 1e-9));
export const fmtKey = (k) => (k === -Infinity ? '−∞' : String(k).replace('-', '−'));

// un heap si scrive come la sua lista delle radici, e ogni albero come (chiave figli...); un asterisco
// dopo la chiave indica un nodo marcato, ad esempio (23) (7) (3 (18* (39*)) (52) (38 (41))) (17 (30));
// min[H] è la prima radice con la chiave minima
export function parseHeap(src, newNode) {
  const tokens = String(src ?? '').match(/[()]|[^\s()]+/g) ?? [];
  let pos = 0;
  function tree(parent) {
    if (tokens[pos] !== '(') throw new Error(`heap di Fibonacci: atteso "(" in posizione ${pos}`);
    pos++;
    const raw = tokens[pos++];
    const x = newNode(Number(raw.replace('*', '')));
    x.mark = raw.endsWith('*');
    x.p = parent;
    while (pos < tokens.length && tokens[pos] !== ')') x.children.push(tree(x));
    pos++;
    return x;
  }
  const roots = [];
  while (pos < tokens.length) roots.push(tree(null));
  let min = null;
  for (const r of roots) if (!min || r.key < min.key) min = r;
  return { roots, min };
}

export function parseOp(raw) {
  const m = String(raw).trim().toLowerCase().match(/^(insert|delete|decrease-key|extract-min|minimum)(?:\s+(-?\d+(?:\.\d+)?))?(?:\s+(-?\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const [, type, a, b] = m;
  if ((type === 'insert' || type === 'delete') && a == null) return null;
  if (type === 'decrease-key' && (a == null || b == null)) return null;
  return { type, a: a == null ? null : Number(a), b: b == null ? null : Number(b) };
}

// la copia che finisce nel fotogramma: { id, key, mark, children }
const snap = (x) => ({ id: x.id, key: x.key, mark: x.mark, children: x.children.map(snap) });

export function run(heapSrc, ops) {
  let nextId = 0;
  const newNode = (key) => ({ id: nextId++, key, mark: false, p: null, children: [] });
  const H = parseHeap(heapSrc, newNode);
  const frames = [], opStart = [];
  let op = null, ptrs = [], A = null, acur = null;

  function counts() {
    let n = 0, m = 0;
    const visit = (x) => { n++; if (x.mark) m++; x.children.forEach(visit); };
    H.roots.forEach(visit);
    return { n, m, t: H.roots.length };
  }

  function emit(note, { hl = [] } = {}) {
    frames.push({
      roots: H.roots.map(snap), min: H.min?.id ?? null, note, op,
      ptrs: ptrs.filter((p) => p.node).map((p) => ({ name: p.name, id: p.node.id })),
      A: A && A.map((x) => (x ? { id: x.id, key: x.key } : null)), acur,
      hl: hl.filter(Boolean).map((x) => x.id),
      ...counts(),
    });
  }
  // aggiunge una frase alla nota dell'ultimo fotogramma
  const append = (text) => { const f = frames[frames.length - 1]; f.note = `${f.note} ${text}`; };

  // ---------- la lista delle radici ----------
  function addRoot(x) {
    x.p = null;
    const i = H.min ? H.roots.indexOf(H.min) : -1;
    if (i < 0) H.roots.push(x); else H.roots.splice(i, 0, x);
  }
  const removeRoot = (x) => H.roots.splice(H.roots.indexOf(x), 1);
  const rightOf = (x) => H.roots[(H.roots.indexOf(x) + 1) % H.roots.length];

  // ---------- Fib-Heap-Link(H, y, x): y diventa il primo figlio di x ----------
  function link(y, x) {
    removeRoot(y);
    y.p = x;
    x.children.unshift(y);
    y.mark = false;
  }

  // ---------- operazioni ----------
  function insert(k) {
    const x = newNode(k);
    addRoot(x);
    const newMin = !H.min || k < H.min.key;
    if (newMin) H.min = x;
    ptrs = [];
    emit(`Il nodo ${fmtKey(k)} diventa una nuova radice, a sinistra di min[H]. ${newMin ? 'La sua chiave è la nuova minima, quindi min[H] punta a questo nodo.' : 'La sua chiave non è minore del minimo, quindi min[H] non cambia.'}`, { hl: [x] });
  }

  function minimum() {
    ptrs = [];
    emit(H.min ? `Minimum restituisce min[H], la radice con chiave ${fmtKey(H.min.key)}.` : 'L\'heap è vuoto: Minimum restituisce NIL.', { hl: [H.min] });
  }

  function consolidate(n) {
    const D = maxDegree(n);
    A = Array(D + 1).fill(null);
    acur = null;
    // le radici nell'ordine in cui il ciclo le visita, a partire da min[H]
    const start = H.roots.indexOf(H.min);
    const order = [...H.roots.slice(start), ...H.roots.slice(0, start)];
    for (const w of order) {
      let x = w, d = x.children.length;
      ptrs = [{ name: 'w', node: w }, { name: 'x', node: x }];
      acur = d;
      if (!A[d]) {
        A[d] = x;
        emit(`w = x = ${fmtKey(x.key)}, di grado ${d}. A[${d}] è vuota, quindi A[${d}] ← x.`, { hl: [x] });
        continue;
      }
      emit(`w = x = ${fmtKey(x.key)}, di grado ${d}. A[${d}] contiene già ${fmtKey(A[d].key)}, un'altra radice di grado ${d}.`, { hl: [x, A[d]] });
      // il ciclo while dello pseudocodice: si collega finché A[d] contiene un'altra radice di grado d
      for (;;) {
        let y = A[d];
        const swap = x.key > y.key;
        if (swap) [x, y] = [y, x];
        link(y, x);
        A[d] = null;
        d++;
        if (d >= A.length) A.push(null);
        acur = d;
        ptrs = [{ name: 'w', node: w }, { name: 'x', node: x }, { name: 'y', node: y }];
        const head = `${swap ? `key[x] > key[y], quindi x e y si scambiano: ora x = ${fmtKey(x.key)} e y = ${fmtKey(y.key)}. ` : ''}`
          + `y diventa figlio di x con Fib-Heap-Link, e x ha ora grado ${d}. A[${d - 1}] torna vuota`;
        if (A[d]) {
          emit(`${head}, e A[${d}] contiene ${fmtKey(A[d].key)}, con lo stesso grado di x.`, { hl: [x, y, A[d]] });
          continue;
        }
        A[d] = x;
        emit(`${head}, e A[${d}] è vuota: A[${d}] ← x.`, { hl: [x, y] });
        break;
      }
    }
    // la nuova lista delle radici contiene le radici rimaste in A, e il nuovo minimo è una di queste
    H.min = null;
    for (const r of H.roots) if (!H.min || r.key < H.min.key) H.min = r;
    A = null; acur = null; ptrs = [];
    emit(`La lista delle radici viene ricostruita con le radici rimaste in A, che hanno gradi tutti diversi, e min[H] punta alla minima, con chiave ${fmtKey(H.min.key)}.`, { hl: [H.min] });
  }

  function extractMin() {
    const z = H.min;
    if (!z) { ptrs = []; emit('L\'heap è vuoto: Extract-Min restituisce NIL.'); return null; }
    const n = counts().n;
    ptrs = [{ name: 'z', node: z }];
    emit(`z punta al minimo, la radice con chiave ${fmtKey(z.key)}.`, { hl: [z] });
    if (z.children.length) {
      const kids = z.children.slice();
      z.children = [];
      for (const c of kids) addRoot(c);
      emit(`${kids.length === 1 ? 'L\'unico figlio di z diventa una radice' : `I ${kids.length} figli di z diventano radici`}, a sinistra di z, che è ancora min[H].`, { hl: kids });
    }
    if (H.roots.length === 1) {
      H.roots = []; H.min = null; ptrs = [];
      emit('z = right[z]: z era l\'unica radice e non aveva figli, quindi l\'heap diventa vuoto e min[H] = NIL.');
    } else {
      const r = rightOf(z);
      removeRoot(z);
      H.min = r;
      ptrs = [];
      emit(`z viene tolto dalla lista delle radici, e min[H] punta per ora a right[z], con chiave ${fmtKey(r.key)}, che non è detto sia il minimo. Poi si chiama Consolidate.`, { hl: [r] });
      consolidate(n);
    }
    append(`Extract-Min restituisce z, con chiave ${fmtKey(z.key)}.`);
    return z;
  }

  function cut(x, y) {
    y.children.splice(y.children.indexOf(x), 1);
    addRoot(x);
    x.mark = false;
  }

  function decreaseKey(x, k, { quiet = false } = {}) {
    if (k > x.key) {
      ptrs = [];
      emit(`La nuova chiave ${fmtKey(k)} è maggiore di quella attuale (${fmtKey(x.key)}): Decrease-Key segnala un errore e l'heap non cambia.`);
      return false;
    }
    const old = x.key;
    x.key = k;
    const y = x.p;
    const what = quiet ? 'Il nodo da cancellare riceve la chiave −∞' : `La chiave ${fmtKey(old)} diventa ${fmtKey(k)}`;
    if (!y || x.key >= y.key) {
      ptrs = [{ name: 'x', node: x }];
      const newMin = x.key < H.min.key;
      if (newMin) H.min = x;
      emit(`${what}. ${y ? `La chiave del padre è ${fmtKey(y.key)}, quindi` : 'x è una radice, quindi'} la proprietà di min-heap vale ancora e non serve nessun taglio.${newMin ? ' La chiave di x è la nuova minima, e min[H] punta a x.' : ''}`, { hl: [x] });
      return true;
    }
    ptrs = [{ name: 'x', node: x }, { name: 'y', node: y }];
    emit(`${what}, minore della chiave ${fmtKey(y.key)} del padre y: la proprietà di min-heap non vale più.`, { hl: [x] });
    cut(x, y);
    emit('Cut(H, x, y): x viene staccato da y e diventa una radice non marcata, a sinistra di min[H].', { hl: [x] });
    // Cascading-Cut risale finché trova una radice o un nodo non marcato
    let c = y;
    for (;;) {
      const z = c.p;
      ptrs = [{ name: 'y', node: c }, { name: 'z', node: z }];
      if (!z) { emit(`Cascading-Cut(H, y): y = ${fmtKey(c.key)} è una radice, quindi non succede niente.`); break; }
      if (!c.mark) {
        c.mark = true;
        emit(`Cascading-Cut(H, y): y = ${fmtKey(c.key)} non era marcato, quindi ha appena perso il primo figlio e viene marcato.`, { hl: [c] });
        break;
      }
      cut(c, z);
      emit(`Cascading-Cut(H, y): y = ${fmtKey(c.key)} era marcato, quindi ha appena perso il secondo figlio. Viene tagliato da z = ${fmtKey(z.key)} e diventa una radice non marcata, poi si prosegue con z.`, { hl: [c] });
      c = z;
    }
    ptrs = [{ name: 'x', node: x }];
    if (x.key < H.min.key) {
      H.min = x;
      emit(`key[x] = ${fmtKey(x.key)} è minore della chiave di min[H], quindi min[H] punta a x.`, { hl: [x] });
    } else append('min[H] non cambia.');
    return true;
  }

  function* nodes(list) { for (const x of list) { yield x; yield* nodes(x.children); } }
  const find = (k) => { for (const x of nodes(H.roots)) if (x.key === k) return x; return null; };

  emit(H.roots.length ? 'L\'heap di partenza.' : 'L\'heap di partenza è vuoto: min[H] = NIL.');
  for (const raw of ops) {
    const o = parseOp(raw);
    if (!o) continue;
    opStart.push(frames.length);
    op = o;
    if (o.type === 'insert') insert(o.a);
    else if (o.type === 'minimum') minimum();
    else if (o.type === 'extract-min') extractMin();
    else {
      const x = find(o.a);
      if (!x) { ptrs = []; emit(`La chiave ${fmtKey(o.a)} non è nell'heap.`); continue; }
      if (o.type === 'decrease-key') decreaseKey(x, o.b);
      else { decreaseKey(x, -Infinity, { quiet: true }); extractMin(); }
    }
  }
  return { frames, opStart };
}

// ---------- disposizione dei nodi ----------
// Ogni albero occupa un intervallo di colonne: una foglia occupa una colonna, un nodo interno le colonne
// dei suoi figli, e sta al centro sopra di essi. Gli alberi stanno uno accanto all'altro, nell'ordine della
// lista delle radici, con le radici alla quota top. Sopra le radici c'è spazio per l'array A di Consolidate.
export const DIM = { col: 34, level: 44, r: 13, gap: 0.55, pad: 14, cell: 26 };

export function layout(frame, top, dim = DIM) {
  const { col, level, gap, pad } = dim;
  const nodes = [], edges = [], rootIds = [];
  let c = 0, maxDepth = 0;
  const place = (t, depth, root) => {
    maxDepth = Math.max(maxDepth, depth);
    let x;
    if (!t.children.length) x = c++;
    else {
      const xs = t.children.map((ch) => { edges.push({ a: t.id, b: ch.id }); return place(ch, depth + 1, false); });
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    nodes.push({ id: t.id, key: t.key, mark: t.mark, root, depth, x: pad + (x + 0.5) * col, y: top + depth * level });
    return x;
  };
  frame.roots.forEach((t, i) => {
    if (i) c += gap;
    place(t, 0, true);
    rootIds.push(t.id);
  });
  const rootLinks = rootIds.slice(1).map((id, i) => ({ a: rootIds[i], b: id }));
  const cells = frame.A ? frame.A.map((v, i) => ({ i, x: pad + i * dim.cell, v })) : [];
  return {
    nodes, edges, rootLinks, cells,
    width: Math.max(pad * 2 + c * col, cells.length ? pad * 2 + cells.length * dim.cell : 0),
    height: top + maxDepth * level + dim.r + pad,
  };
}
