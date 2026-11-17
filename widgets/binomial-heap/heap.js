// Heap binomiali con le operazioni dello pseudocodice del capitolo, senza grafica: run() esegue una
// sequenza di operazioni e restituisce i fotogrammi che il widget mostra uno alla volta. Ogni fotogramma
// contiene una copia delle liste delle radici, quindi disegnarlo non dipende dai fotogrammi precedenti.
// layout() calcola le posizioni dei nodi di un fotogramma: la usano sia il widget sia lo script che
// genera le figure TikZ del PDF, così le due versioni mostrano gli stessi alberi.
//
// Ogni nodo ha un id (la sua posizione nella struttura, che non cambia) e un tok (la chiave con i suoi
// dati satellite): Decrease-Key scambia le chiavi di due nodi, e nel disegno si vedono le chiavi salire
// lungo l'arco mentre la struttura resta ferma.

const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const sub = (k) => String(k).replace(/\d/g, (d) => SUB[d]);
export const B = (k) => `B${sub(k)}`;
export const fmtKey = (k) => (k === -Infinity ? '−∞' : String(k).replace('-', '−'));

// un heap si scrive come la sua lista delle radici, e ogni albero come (chiave figli...), con i figli
// nell'ordine della lista dei figli: ad esempio (10) (1 (12 (18)) (25)) (6 (8 (11 (27)) (17)) (14 (38)) (29))
export function parseHeap(src, newNode) {
  const tokens = String(src ?? '').match(/[()]|[^\s()]+/g) ?? [];
  let pos = 0;
  function tree(parent) {
    if (tokens[pos] !== '(') throw new Error(`heap binomiale: atteso "(" in posizione ${pos}`);
    pos++;
    const x = newNode(Number(tokens[pos++]));
    x.p = parent;
    const kids = [];
    while (pos < tokens.length && tokens[pos] !== ')') kids.push(tree(x));
    pos++;
    x.degree = kids.length;
    x.child = kids[0] ?? null;
    kids.forEach((c, i) => { c.sibling = kids[i + 1] ?? null; });
    return x;
  }
  const roots = [];
  while (pos < tokens.length) roots.push(tree(null));
  roots.forEach((r, i) => { r.sibling = roots[i + 1] ?? null; });
  return { head: roots[0] ?? null };
}

// la copia che finisce nel fotogramma: { id, tok, key, children }
function snap(x) {
  const t = { id: x.id, tok: x.tok, key: x.key, children: [] };
  for (let c = x.child; c; c = c.sibling) t.children.push(snap(c));
  return t;
}
const snapList = (head) => { const out = []; for (let r = head; r; r = r.sibling) out.push(snap(r)); return out; };
const size = (x) => { let n = 1; for (let c = x.child; c; c = c.sibling) n += size(c); return n; };
export const heapSize = (head) => { let n = 0; for (let r = head; r; r = r.sibling) n += size(r); return n; };
export const countTrees = (head) => { let n = 0; for (let r = head; r; r = r.sibling) n++; return n; };

export function parseOp(raw) {
  const m = String(raw).trim().toLowerCase().match(/^(insert|delete|decrease-key|extract-min|minimum|union)(?:\s+(-?\d+(?:\.\d+)?))?(?:\s+(-?\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const [, type, a, b] = m;
  if ((type === 'insert' || type === 'delete') && a == null) return null;
  if (type === 'decrease-key' && (a == null || b == null)) return null;
  return { type, a: a == null ? null : Number(a), b: b == null ? null : Number(b) };
}

// i nodi in ordine di visita (le radici da sinistra a destra, ogni radice prima dei suoi figli)
function* nodes(head) {
  for (let r = head; r; r = r.sibling) {
    yield r;
    yield* nodes(r.child);
  }
}

export function run(heapSrc, otherSrc, ops) {
  let nextId = 0, nextTok = 0;
  const newNode = (key) => ({ id: nextId++, tok: nextTok++, key, degree: 0, p: null, child: null, sibling: null });
  const H = parseHeap(heapSrc, newNode);
  const frames = [], opStart = [];
  let op = null, links = 0, mainName = 'H', extra = null, ptrs = [];

  function emit(note, { hl = [] } = {}) {
    const lists = [{ name: mainName, roots: snapList(H.head) }];
    if (extra) lists.push({ name: extra.name, roots: snapList(extra.heap.head) });
    frames.push({
      lists, note, op, links,
      ptrs: ptrs.filter((p) => p.node).map((p) => ({ name: p.name, id: p.node.id, at: p.at })),
      hl: hl.filter(Boolean).map((x) => x.tok),
      n: heapSize(H.head) + (extra ? heapSize(extra.heap.head) : 0),
      trees: countTrees(H.head) + (extra ? countTrees(extra.heap.head) : 0),
    });
  }
  // aggiunge una frase alla nota dell'ultimo fotogramma
  const append = (text) => { const f = frames[frames.length - 1]; f.note = `${f.note} ${text}`; };

  // ---------- Binomial-Link: y diventa il primo figlio di z ----------
  function link(y, z) {
    y.p = z;
    y.sibling = z.child;
    z.child = y;
    z.degree++;
    links++;
  }

  // ---------- Binomial-Heap-Merge: le radici in ordine di grado, a parità di grado prima quelle di H ----------
  function merge(a, b) {
    const dummy = { sibling: null };
    let t = dummy;
    while (a && b) {
      if (a.degree <= b.degree) { t.sibling = a; a = a.sibling; } else { t.sibling = b; b = b.sibling; }
      t = t.sibling;
    }
    t.sibling = a ?? b;
    return dummy.sibling;
  }

  // ---------- Binomial-Heap-Union(H, other) ----------
  function union(other) {
    const empty = !H.head || !other.head;
    H.head = merge(H.head, other.head);
    extra = null;
    mainName = 'H';
    if (!H.head) { ptrs = []; emit('Entrambe le liste sono vuote: l\'heap risultante è vuoto.'); return; }
    let prev = null, x = H.head, next = x.sibling;
    const setPtrs = () => { ptrs = [{ name: 'prev-x', node: prev, at: 'above' }, { name: 'x', node: x, at: 'above' }, { name: 'next-x', node: next, at: 'above' }]; };
    setPtrs();
    emit(`${empty ? 'Una delle due liste è vuota, quindi Binomial-Heap-Merge restituisce l\'altra.' : 'Binomial-Heap-Merge fonde le due liste delle radici in una sola, ordinata per grado crescente.'} `
      + `x punta alla prima radice${next ? ' e next-x alla seconda.' : ', e next-x = NIL: il ciclo non viene eseguito.'}`);
    const ran = next != null;
    while (next) {
      const sib = next.sibling, k = x.degree;
      if (x.degree !== next.degree) {
        prev = x; x = next; next = x.sibling;
        setPtrs();
        emit(`Caso 1: x e next-x hanno gradi diversi (${k} e ${x.degree}), quindi x avanza di una posizione.`);
      } else if (sib && sib.degree === k) {
        prev = x; x = next; next = x.sibling;
        setPtrs();
        emit(`Caso 2: x, next-x e sibling[next-x] hanno tutti grado ${k}, quindi x avanza: saranno collegate le ultime due radici.`);
      } else if (x.key <= next.key) {
        const a = x.key, b = next.key, child = next;
        x.sibling = next.sibling;
        link(next, x);
        next = x.sibling;
        setPtrs();
        emit(`Caso 3: x e next-x hanno grado ${k} e key[x] = ${fmtKey(a)} ≤ ${fmtKey(b)} = key[next-x], quindi next-x diventa il primo figlio di x, che ora è la radice di un ${B(k + 1)}.`, { hl: [x, child] });
      } else {
        const a = x.key, b = next.key, child = x;
        if (prev) prev.sibling = next; else H.head = next;
        link(x, next);
        x = next; next = x.sibling;
        setPtrs();
        emit(`Caso 4: x e next-x hanno grado ${k} e key[x] = ${fmtKey(a)} > ${fmtKey(b)} = key[next-x], quindi x diventa il primo figlio di next-x, che ora è la radice di un ${B(k + 1)}, e x avanza su di essa.`, { hl: [x, child] });
      }
    }
    // l'ultimo fotogramma ha già next-x = NIL: lo si dice nella sua nota
    if (ran) append('Ora next-x = NIL e il ciclo termina.');
  }

  // ---------- operazioni ----------
  function minimum() {
    let y = null, min = Infinity;
    if (!H.head) { ptrs = []; emit('L\'heap è vuoto: Minimum restituisce NIL.'); return; }
    for (let x = H.head; x; x = x.sibling) {
      const better = x.key < min;
      const old = min;
      if (better) { min = x.key; y = x; }
      ptrs = [{ name: 'x', node: x, at: 'above' }, { name: 'y', node: y, at: 'above' }];
      emit(better
        ? `key[x] = ${fmtKey(x.key)} < ${old === Infinity ? '∞' : fmtKey(old)} = min, quindi min = ${fmtKey(x.key)} e y = x.`
        : `key[x] = ${fmtKey(x.key)} ≥ ${fmtKey(min)} = min: y non cambia.`, { hl: [y] });
    }
    ptrs = [{ name: 'y', node: y, at: 'above' }];
    emit(`La lista delle radici è finita: Minimum restituisce y, con chiave ${fmtKey(min)}.`, { hl: [y] });
  }

  function insert(k) {
    const x = newNode(k);
    extra = { name: 'H′', heap: { head: x } };
    ptrs = [];
    emit(`Make-Binomial-Heap crea un heap vuoto H′, e il nuovo nodo ${fmtKey(k)} diventa la sua unica radice, un ${B(0)}. Poi si chiama Binomial-Heap-Union(H, H′).`, { hl: [x] });
    union(extra.heap);
  }

  function extractMin() {
    if (!H.head) { ptrs = []; emit('L\'heap è vuoto: Extract-Min restituisce NIL.'); return null; }
    let x = H.head, before = null;
    for (let p = null, r = H.head; r; p = r, r = r.sibling) if (r.key < x.key) { x = r; before = p; }
    ptrs = [{ name: 'x', node: x, at: 'above' }];
    emit(`Il minimo tra le radici è ${fmtKey(x.key)}, la radice di un ${B(x.degree)}: x punta a questa radice.`, { hl: [x] });
    if (before) before.sibling = x.sibling; else H.head = x.sibling;
    let rev = null;
    for (let c = x.child; c;) { const nx = c.sibling; c.sibling = rev; c.p = null; rev = c; c = nx; }
    x.child = null; x.sibling = null;
    extra = { name: 'H′', heap: { head: rev } };
    ptrs = [];
    emit(x.degree
      ? `x viene tolto dalla lista delle radici. I suoi ${x.degree === 1 ? 'figlio forma' : `${x.degree} figli, in ordine inverso, formano`} la lista delle radici di un nuovo heap H′.`
      : 'x viene tolto dalla lista delle radici. Non ha figli, quindi H′ è vuoto.');
    union(extra.heap);
    append(`Extract-Min restituisce il nodo tolto all'inizio, con chiave ${fmtKey(x.key)}.`);
    return x;
  }

  function decreaseKey(x, k, { quiet = false } = {}) {
    if (k > x.key) {
      ptrs = [];
      emit(`La nuova chiave ${fmtKey(k)} è maggiore di quella attuale (${fmtKey(x.key)}): Decrease-Key segnala un errore e l'heap non cambia.`);
      return false;
    }
    const old = x.key;
    x.key = k;
    let y = x, z = y.p;
    const setPtrs = () => { ptrs = [{ name: 'y', node: y, at: 'left' }, { name: 'z', node: z, at: 'left' }]; };
    setPtrs();
    emit(`${quiet ? 'Il nodo da cancellare riceve la chiave −∞' : `La chiave ${fmtKey(old)} diventa ${fmtKey(k)}`}: y = x e z = p[y]${z ? '' : ' = NIL'}.`, { hl: [y] });
    let swaps = 0;
    while (z && y.key < z.key) {
      const a = y.key, b = z.key;
      [y.key, z.key] = [z.key, y.key];
      [y.tok, z.tok] = [z.tok, y.tok];
      y = z; z = y.p;
      setPtrs();
      swaps++;
      emit(`key[y] = ${fmtKey(a)} < ${fmtKey(b)} = key[z]: le due chiavi si scambiano, e y e z salgono di un livello.`, { hl: [y] });
    }
    append(z ? `key[y] = ${fmtKey(y.key)} ≥ ${fmtKey(z.key)} = key[z]: il ciclo termina${swaps ? '' : ' subito'}.` : 'z = NIL, ovvero y è una radice: il ciclo termina.');
    return true;
  }

  const find = (k) => { for (const x of nodes(H.head)) if (x.key === k) return x; return null; };

  // se si comincia con un'unione, il primo fotogramma è quello con i due heap da unire
  if (parseOp(ops.find((o) => parseOp(o)) ?? '')?.type !== 'union') emit(H.head ? 'L\'heap di partenza.' : 'L\'heap di partenza è vuoto: head[H] = NIL.');
  for (const raw of ops) {
    const o = parseOp(raw);
    if (!o) continue;
    opStart.push(frames.length);
    op = o; links = 0;
    if (o.type === 'insert') insert(o.a);
    else if (o.type === 'minimum') minimum();
    else if (o.type === 'extract-min') extractMin();
    else if (o.type === 'union') {
      extra = { name: 'H₂', heap: parseHeap(otherSrc, newNode) };
      mainName = 'H₁';
      ptrs = [];
      emit('I due heap da unire, H₁ e H₂.');
      union(extra.heap);
    } else if (o.type === 'decrease-key' || o.type === 'delete') {
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
// dei suoi figli, uno accanto all'altro, e sta sopra l'ultimo figlio (come nelle figure del libro).
// In un albero binomiale B_k servono quindi max(1, 2^(k-1)) colonne.
// Le liste di un fotogramma stanno una accanto all'altra, e davanti a ogni lista c'è il puntatore head:
// head.x è il punto in cui finisce la scritta head[H] e comincia la freccia verso la prima radice.
export const DIM = { col: 36, level: 46, r: 14, head: 78, gap: 0.75, listGap: 26, top: 30, pad: 14 };

export function layout(frame, dim = DIM) {
  const { col, level, head, gap, listGap, top, pad } = dim;
  const nodesOut = [], edges = [], arrows = [], heads = [];
  let x0 = pad, maxDepth = 0;
  for (const list of frame.lists) {
    const left = x0 + head;
    let c = 0;
    const place = (t, depth) => {
      maxDepth = Math.max(maxDepth, depth);
      let x;
      if (!t.children.length) x = c++;
      else for (const ch of t.children) { x = place(ch, depth + 1); edges.push({ a: t.id, b: ch.id }); }
      nodesOut.push({ id: t.id, tok: t.tok, key: t.key, col: x, depth, x: left + (x + 0.5) * col, y: top + depth * level });
      return x;
    };
    const rootIds = list.roots.map((t, i) => {
      if (i) c += gap;
      place(t, 0);
      return t.id;
    });
    rootIds.forEach((id, i) => { if (i) arrows.push({ a: rootIds[i - 1], b: id }); });
    heads.push({ name: list.name, x: left - 20, y: top, first: rootIds[0] ?? null });
    // una lista vuota lascia lo spazio per la scritta "= NIL"
    x0 = left + (rootIds.length ? c * col : 46) + listGap;
  }
  return { nodes: nodesOut, edges, arrows, heads, width: x0 - listGap + pad, height: top + maxDepth * level + dim.r + pad };
}
