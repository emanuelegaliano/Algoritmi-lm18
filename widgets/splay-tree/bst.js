// alberi binari di ricerca con le operazioni degli splay tree, senza grafica:
// run() esegue una sequenza di operazioni e restituisce i fotogrammi che il widget mostra uno alla volta.
// Ogni fotogramma contiene una copia dell'albero, quindi disegnarlo non dipende dai fotogrammi precedenti.

const node = (k) => ({ k, l: null, r: null, p: null });

// la copia di una foresta (durante Delete gli alberi sono due): [{ k, l, r }, ...]
const copy = (n) => n && { k: n.k, l: copy(n.l), r: copy(n.r) };

export const size = (n) => (n ? 1 + size(n.l) + size(n.r) : 0);
export const height = (n) => (n ? 1 + Math.max(height(n.l), height(n.r)) : 0);
export const potential = (roots) => {
  const phi = (n) => (n ? Math.log2(size(n)) + phi(n.l) + phi(n.r) : 0);
  return roots.reduce((acc, t) => acc + phi(t), 0);
};

// sostituisce nel padre (o tra le radici) il figlio old con nu
function replace(F, old, nu, parent) {
  if (!parent) F.roots[F.roots.indexOf(old)] = nu;
  else if (parent.l === old) parent.l = nu;
  else parent.r = nu;
  if (nu) nu.p = parent;
}

// porta x al posto del padre: rotazione a destra se x è figlio sinistro, a sinistra altrimenti
export function rotate(F, x) {
  const p = x.p;
  replace(F, p, x, p.p);
  if (p.l === x) {
    p.l = x.r; if (x.r) x.r.p = p;
    x.r = p;
  } else {
    p.r = x.l; if (x.l) x.l.p = p;
    x.l = p;
  }
  p.p = x;
}

// inserimento in un normale albero binario di ricerca (serve solo a costruire l'albero iniziale)
function leafInsert(F, k) {
  if (!F.roots.length) { const n = node(k); F.roots.push(n); return n; }
  let cur = F.roots[0];
  for (;;) {
    if (k === cur.k) return cur;
    const side = k < cur.k ? 'l' : 'r';
    if (!cur[side]) { const n = node(k); cur[side] = n; n.p = cur; return n; }
    cur = cur[side];
  }
}

// il cammino della ricerca binaria di k a partire da root, fino all'ultimo nodo visitato
function searchPath(root, k) {
  const path = [];
  for (let cur = root; cur; cur = k < cur.k ? cur.l : cur.r) {
    path.push(cur);
    if (cur.k === k) break;
  }
  return path;
}

const findRoot = (n) => { while (n.p) n = n.p; return n; };
const rank = (n) => Math.log2(size(n));

export function parseOp(s) {
  const m = String(s).trim().match(/^(search|splay|insert|delete)\s+(-?\d+)$/i);
  if (!m) return null;
  const type = m[1].toLowerCase() === 'splay' ? 'search' : m[1].toLowerCase();
  return { type, key: Number(m[2]) };
}

// mode: 'splay' (zig, zig-zig, zig-zag) oppure 'rotate' (sole rotazioni singole)
export function run(initial, ops, mode = 'splay') {
  const F = { roots: [] };
  for (const k of initial) leafInsert(F, k);
  const frames = [];
  const opStart = [];
  let total = 0, opRot = 0, op = null;

  const emit = (extra = {}) => frames.push({
    trees: F.roots.map(copy), op, opRot, total, hl: [], path: [], gone: null, note: '', step: null, ...extra,
  });

  // porta alla radice (del proprio albero) il nodo z, emettendo un fotogramma per rotazione
  function splayNode(z) {
    while (z.p) {
      const p = z.p, g = p.p;
      const before = { phi: potential(F.roots), rx: rank(z) };
      let kind, cost;
      if (mode === 'rotate' || !g) {
        kind = mode === 'rotate' ? 'rotazione' : 'zig';
        rotate(F, z); cost = 1; opRot++; total++;
        emit({ hl: [z.k], kind, note: `${kind === 'zig' ? 'Zig' : 'Rotazione'}: ${z.k} prende il posto del padre ${p.k}.` });
      } else if ((z === p.l) === (p === g.l)) {
        kind = 'zig-zig';
        rotate(F, p); opRot++; total++;
        emit({ hl: [z.k], kind, note: `Zig-zig su ${z.k}, ${p.k} e ${g.k}: prima si ruota il padre ${p.k} con il nonno ${g.k}…` });
        rotate(F, z); cost = 2; opRot++; total++;
        emit({ hl: [z.k], kind, note: `…poi ${z.k} con ${p.k}: ${z.k} è salito di due livelli e ${p.k}, ${g.k} sono scesi sotto di lui.` });
      } else {
        kind = 'zig-zag';
        rotate(F, z); opRot++; total++;
        emit({ hl: [z.k], kind, note: `Zig-zag su ${z.k}, ${p.k} e ${g.k}: prima si ruota ${z.k} con il padre ${p.k}…` });
        rotate(F, z); cost = 2; opRot++; total++;
        emit({ hl: [z.k], kind, note: `…poi ${z.k} con il nonno ${g.k}: ${z.k} ha preso il posto di ${g.k}, con ${p.k} e ${g.k} come figli.` });
      }
      // l'ultimo fotogramma del passo riporta il costo ammortizzato del passo (lemma principale)
      const f = frames[frames.length - 1];
      f.step = { kind, cost, x: z.k, phiBefore: before.phi, phiAfter: potential(F.roots), rxBefore: before.rx, rxAfter: rank(z) };
    }
    return z;
  }

  // Splay(k, T) sull'albero di radice root: ricerca, poi rotazioni fino alla radice
  function splay(root, k, describe) {
    const path = searchPath(root, k);
    const z = path[path.length - 1];
    const keys = path.map((n) => n.k);
    const then = z.p ? `, che verrà portato alla radice` : `, che è già la radice: nessuna rotazione`;
    emit({
      hl: [z.k], path: keys,
      note: describe?.(keys, z, then) ?? (z.k === k
        ? `La ricerca di ${k} percorre ${keys.join(', ')}.`
        : `${k} non c'è: la ricerca percorre ${keys.join(', ')} e si ferma su ${z.k}${then}.`),
    });
    return splayNode(z);
  }

  emit({ note: 'L\'albero di partenza.' });
  for (const raw of ops) {
    const o = typeof raw === 'string' ? parseOp(raw) : raw;
    if (!o) continue;
    op = o; opRot = 0;
    opStart.push(frames.length);
    const { type, key } = o;

    if (type === 'search') {
      if (!F.roots.length) { emit({ note: 'L\'albero è vuoto.' }); continue; }
      const z = splay(F.roots[0], key);
      emit({ hl: [z.k], note: z.k === key ? `${key} è alla radice: la ricerca ha successo.` : `La radice è ${z.k} e non ${key}: la ricerca fallisce.`, end: true });
    } else if (type === 'insert') {
      if (!F.roots.length) {
        const n = node(key); F.roots.push(n);
        emit({ hl: [key], note: `L'albero era vuoto: ${key} diventa la radice.`, end: true });
        continue;
      }
      if (mode === 'rotate') {
        const path = searchPath(F.roots[0], key);
        if (path[path.length - 1].k === key) { emit({ hl: [key], note: `${key} è già presente.`, end: true }); continue; }
        const x = leafInsert(F, key);
        emit({ hl: [key], path: [...path.map((n) => n.k), key], note: `${key} viene inserito come foglia, come in un normale albero binario di ricerca.` });
        splayNode(x);
        emit({ hl: [key], note: `${key} è arrivato alla radice.`, end: true });
        continue;
      }
      const r = splay(F.roots[0], key);
      if (r.k === key) { emit({ hl: [key], note: `${key} è già presente, ed è ora alla radice.`, end: true }); continue; }
      const x = node(key);
      if (key > r.k) {
        x.r = r.r; if (x.r) x.r.p = x;
        r.r = x;
      } else {
        x.l = r.l; if (x.l) x.l.p = x;
        r.l = x;
      }
      x.p = r;
      emit({
        hl: [key], path: [r.k, key],
        note: key > r.k
          ? `${r.k} è il predecessore di ${key}: il nuovo nodo diventa il figlio destro di ${r.k}, sopra il suo vecchio sottoalbero destro.`
          : `${r.k} è il successore di ${key}: il nuovo nodo diventa il figlio sinistro di ${r.k}, sopra il suo vecchio sottoalbero sinistro.`,
      });
      splayNode(x);
      emit({ hl: [key], note: `Il secondo Splay è un solo zig: ${key} è alla radice.`, end: true });
    } else if (type === 'delete') {
      if (!F.roots.length) { emit({ note: 'L\'albero è vuoto.' }); continue; }
      const z = splay(F.roots[0], key);
      if (z.k !== key) { emit({ hl: [z.k], note: `${key} non è presente: non c'è niente da cancellare.`, end: true }); continue; }
      const T1 = z.l, T2 = z.r;
      if (T1) T1.p = null;
      if (T2) T2.p = null;
      F.roots = [T1, T2].filter(Boolean);
      emit({
        gone: key,
        note: `Cancellando ${key} restano due alberi: T₁ ${T1 ? `di radice ${T1.k}` : 'vuoto'} e T₂ ${T2 ? `di radice ${T2.k}` : 'vuoto'}.`,
      });
      if (!T1) { emit({ note: 'T₁ è vuoto: il risultato è T₂.', end: true }); continue; }
      const r = splay(T1, key, (keys, z, then) =>
        `Splay di ${key} in T₁: tutte le sue chiavi sono minori di ${key}, quindi la ricerca scende sempre a destra e si ferma sul massimo, ${z.k}${then}.`);
      if (T2) { r.r = T2; T2.p = r; }
      F.roots = [findRoot(r)];
      emit({ hl: [r.k], note: `${r.k}, il massimo di T₁, non ha figlio destro: ${T2 ? `T₂ viene agganciato al suo posto.` : 'T₂ è vuoto, e il risultato è T₁.'}`, end: true });
    }
  }
  return { frames, opStart };
}
