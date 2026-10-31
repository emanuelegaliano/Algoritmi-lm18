// B-tree con le operazioni Search, Insert e Delete in versione top-down (una sola discesa), senza grafica:
// run() esegue una sequenza di operazioni e restituisce i fotogrammi che il widget mostra uno alla volta.
// Ogni fotogramma contiene una copia dell'albero, quindi disegnarlo non dipende dai fotogrammi precedenti.
// Si contano anche le pagine lette e scritte (Page-Read e Page-Write), con la radice sempre in RAM.

// le chiavi sono numeri oppure stringhe (lettere): si confrontano allo stesso modo
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// un albero scritto tra parentesi: ogni nodo è (chiavi figli...), ad esempio (P (C G (A B) (D E F) (J K)) (T X ...))
export function parseTree(src) {
  const tokens = String(src).match(/[()]|[^\s()]+/g) ?? [];
  let pos = 0, id = 0;
  const key = (tok) => (/^-?\d+(\.\d+)?$/.test(tok) ? Number(tok) : tok);
  function node() {
    if (tokens[pos] !== '(') throw new Error(`atteso "(" in posizione ${pos}`);
    pos++;
    const x = { id: id++, keys: [], c: [] };
    while (pos < tokens.length && tokens[pos] !== ')') {
      if (tokens[pos] === '(') x.c.push(node());
      else x.keys.push(key(tokens[pos++]));
    }
    pos++;
    x.leaf = x.c.length === 0;
    return x;
  }
  if (!tokens.length) return { root: { id: 0, keys: [], c: [], leaf: true }, next: 1 };
  const root = node();
  return { root, next: id };
}

// la copia che finisce nel fotogramma
const copy = (x) => ({ id: x.id, keys: [...x.keys], leaf: x.leaf, c: x.c.map(copy) });

export const height = (x) => (x.leaf || !x.c.length ? 0 : 1 + height(x.c[0]));
export const allKeys = (x) => [...x.keys, ...x.c.flatMap(allKeys)];

export function parseOp(raw) {
  const m = String(raw).trim().match(/^(search|insert|delete)\s+(\S+)$/i);
  if (!m) return null;
  return { type: m[1].toLowerCase(), key: /^-?\d+(\.\d+)?$/.test(m[2]) ? Number(m[2]) : m[2] };
}

const ORD = ['primo', 'secondo', 'terzo', 'quarto', 'quinto', 'sesto', 'settimo', 'ottavo'];
const ord = (i) => ORD[i] ?? `${i + 1}°`;
const list = (keys) => `[${keys.join(', ')}]`;

// dove cade la chiave k rispetto alle chiavi del nodo, a parole
function interval(x, k, i) {
  const n = x.keys.length;
  if (n === 0) return '';
  if (i === 0) return `${k} < ${x.keys[0]}`;
  if (i === n) return `${k} > ${x.keys[n - 1]}`;
  return `${x.keys[i - 1]} < ${k} < ${x.keys[i]}`;
}

export function run(treeSrc, t, ops) {
  const T = parseTree(treeSrc);
  let nextId = T.next;
  const frames = [], opStart = [];
  let op = null, reads = 0, writes = 0;

  // hl: nodo corrente; keys: chiavi evidenziate; path: nodi già visitati dall'operazione
  let path = [];
  function emit(note, { hl = null, keys = [] } = {}) {
    frames.push({ tree: copy(T.root), op, note, hl: hl?.id ?? null, keys, path: [...path], reads, writes, h: height(T.root) });
  }
  const visit = (x) => { if (!path.includes(x.id)) path.push(x.id); };
  const firstGE = (x, k) => { let i = 0; while (i < x.keys.length && cmp(k, x.keys[i]) > 0) i++; return i; };
  const isRoot = (x) => x === T.root;

  // ---------- ricerca ----------
  function search(x, k) {
    visit(x);
    const i = firstGE(x, k);
    if (i < x.keys.length && cmp(k, x.keys[i]) === 0) {
      emit(`${k} è nel nodo ${list(x.keys)}, in posizione ${i + 1}: la ricerca restituisce il nodo e l'indice ${i + 1}.`, { hl: x, keys: [k] });
      return;
    }
    if (x.leaf) {
      emit(`${x.keys.length ? `${interval(x, k, i)}, ma ` : ''}il nodo è una foglia: ${k} non è presente e la ricerca restituisce NIL.`, { hl: x });
      return;
    }
    emit(`Nel nodo ${list(x.keys)} vale ${interval(x, k, i)}: si legge il ${ord(i)} figlio con Page-Read e si scende.`, { hl: x });
    reads++;
    search(x.c[i], k);
  }

  // ---------- inserimento ----------
  function splitChild(x, i) {
    const y = x.c[i];
    const z = { id: nextId++, keys: y.keys.slice(t), c: y.leaf ? [] : y.c.slice(t), leaf: y.leaf };
    const median = y.keys[t - 1];
    y.keys = y.keys.slice(0, t - 1);
    if (!y.leaf) y.c = y.c.slice(0, t);
    x.keys.splice(i, 0, median);
    x.c.splice(i + 1, 0, z);
    writes += 3;
    return median;
  }

  function insertNonfull(x, k) {
    visit(x);
    if (x.leaf) {
      const i = firstGE(x, k);
      x.keys.splice(i, 0, k);
      writes++;
      emit(`La foglia non è piena: ${k} si inserisce nella posizione ordinata, spostando a destra le chiavi maggiori, e la foglia si scrive con Page-Write.`, { hl: x, keys: [k] });
      return;
    }
    let i = firstGE(x, k);
    reads++;
    const y = x.c[i];
    if (y.keys.length === 2 * t - 1) {
      emit(`Nel nodo ${list(x.keys)} ${x.keys.length ? `vale ${interval(x, k, i)}` : 'c\'è un solo figlio'}, ma il ${ord(i)} figlio ${list(y.keys)} è pieno: lo dividiamo prima di scendere.`, { hl: y, keys: [y.keys[t - 1]] });
      const median = splitChild(x, i);
      emit(`La mediana ${median} sale nel padre, e le chiavi a destra della mediana passano in un nuovo nodo: entrambe le metà hanno ${t - 1} chiavi.`, { hl: x, keys: [median] });
      if (cmp(k, median) > 0) i++;
    } else {
      emit(`Nel nodo ${list(x.keys)} vale ${interval(x, k, i)}: il ${ord(i)} figlio non è pieno, quindi si scende direttamente.`, { hl: x });
    }
    insertNonfull(x.c[i], k);
  }

  function insert(k) {
    const r = T.root;
    if (r.keys.length === 2 * t - 1) {
      const s = { id: nextId++, keys: [], c: [r], leaf: false };
      T.root = s;
      emit(`La radice ${list(r.keys)} è piena: creiamo una nuova radice vuota, che ha la vecchia radice come unico figlio.`, { hl: s });
      const median = splitChild(s, 0);
      emit(`Dividiamo la vecchia radice: la mediana ${median} sale nella nuova radice e l'altezza aumenta di uno.`, { hl: s, keys: [median] });
      insertNonfull(s, k);
    } else insertNonfull(r, k);
  }

  // ---------- cancellazione ----------
  // pending: in un caso 2a o 2b, la chiave k del nodo x che il predecessore (o successore) deve sostituire
  let pending = null;

  function shrinkRoot(merged) {
    if (T.root.keys.length === 0 && !T.root.leaf) {
      T.root = merged;
      emit(`La radice è rimasta senza chiavi: il suo unico figlio diventa la nuova radice e l'altezza diminuisce di uno.`, { hl: merged });
    }
  }

  // fonde x.c[i], la chiave x.keys[i] e x.c[i+1] nel nodo x.c[i]
  function merge(x, i) {
    const y = x.c[i], z = x.c[i + 1];
    const sep = x.keys[i];
    y.keys = [...y.keys, sep, ...z.keys];
    y.c = [...y.c, ...z.c];
    x.keys.splice(i, 1);
    x.c.splice(i + 1, 1);
    writes += 2;
    return { y, sep };
  }

  function del(x, k) {
    visit(x);
    const n = x.keys.length;
    const i = firstGE(x, k);
    if (i < n && cmp(k, x.keys[i]) === 0) {
      if (x.leaf) {
        x.keys.splice(i, 1);
        writes++;
        if (pending) {
          const { node, idx, old } = pending;
          node.keys[idx] = k;
          writes++;
          pending = null;
          emit(`${k} si toglie dalla foglia e prende il posto di ${old}.`, { hl: node, keys: [k] });
        } else emit(`Caso 1: ${k} è in una foglia e si elimina direttamente.${isRoot(x) ? '' : ` La foglia ha ancora almeno ${t - 1} chiavi.`}`, { hl: x });
        return;
      }
      const y = x.c[i], z = x.c[i + 1];
      reads++;
      if (y.keys.length >= t) {
        let p = y; while (!p.leaf) p = p.c[p.c.length - 1];
        const pred = p.keys[p.keys.length - 1];
        emit(`Caso 2a: ${k} è nel nodo interno ${list(x.keys)} e il figlio che lo precede ha ${y.keys.length} ≥ t chiavi. Sostituiamo ${k} con il predecessore ${pred}, la chiave più a destra di quel sottoalbero.`, { hl: x, keys: [k, pred] });
        pending = { node: x, idx: i, old: k };
        del(y, pred);
        return;
      }
      reads++;
      if (z.keys.length >= t) {
        let p = z; while (!p.leaf) p = p.c[0];
        const succ = p.keys[0];
        emit(`Caso 2b: il figlio che precede ${k} ha solo ${t - 1} chiavi, ma quello che lo segue ne ha ${z.keys.length} ≥ t. Sostituiamo ${k} con il successore ${succ}, la chiave più a sinistra di quel sottoalbero.`, { hl: x, keys: [k, succ] });
        pending = { node: x, idx: i, old: k };
        del(z, succ);
        return;
      }
      emit(`Caso 2c: ${k} è nel nodo interno ${list(x.keys)} ed entrambi i figli adiacenti hanno ${t - 1} chiavi. Li fondiamo insieme a ${k}.`, { hl: x, keys: [k] });
      merge(x, i);
      emit(`Il nodo fuso ha (t − 1) + 1 + (t − 1) = ${2 * t - 1} chiavi: ora si cancella ${k} da questo nodo.`, { hl: y, keys: [k] });
      shrinkRoot(y);
      del(y, k);
      return;
    }
    if (x.leaf) {
      emit(`${k} non è presente nell'albero.`, { hl: x });
      return;
    }
    reads++;
    let c = x.c[i];
    if (c.keys.length >= t) {
      emit(`${k} non è nel nodo ${list(x.keys)}: vale ${interval(x, k, i)} e il ${ord(i)} figlio ha ${c.keys.length} ≥ t chiavi, quindi si scende direttamente.`, { hl: x });
      del(c, k);
      return;
    }
    const left = i > 0 ? x.c[i - 1] : null, right = i < n ? x.c[i + 1] : null;
    emit(`${k} non è nel nodo ${list(x.keys)}: vale ${interval(x, k, i)}, ma il ${ord(i)} figlio ${list(c.keys)} ha solo ${t - 1} chiavi. Prima di scendere bisogna dargliene una in più.`, { hl: c });
    if (right) reads++;
    if (right && right.keys.length >= t) {
      const up = right.keys[0], down = x.keys[i];
      c.keys.push(down);
      x.keys[i] = right.keys.shift();
      if (!c.leaf) c.c.push(right.c.shift());
      writes += 3;
      emit(`Caso 3a: il fratello destro ha ${right.keys.length + 1} ≥ t chiavi. ${down} scende dal padre nel figlio e ${up} sale dal fratello nel padre${c.leaf ? '' : ', portando con sé il suo primo sottoalbero'}.`, { hl: c, keys: [down, up] });
      del(c, k);
      return;
    }
    if (left) reads++;
    if (left && left.keys.length >= t) {
      const up = left.keys[left.keys.length - 1], down = x.keys[i - 1];
      c.keys.unshift(down);
      x.keys[i - 1] = left.keys.pop();
      if (!c.leaf) c.c.unshift(left.c.pop());
      writes += 3;
      emit(`Caso 3a: il fratello sinistro ha ${left.keys.length + 1} ≥ t chiavi. ${down} scende dal padre nel figlio e ${up} sale dal fratello nel padre${c.leaf ? '' : ', portando con sé il suo ultimo sottoalbero'}.`, { hl: c, keys: [down, up] });
      del(c, k);
      return;
    }
    const { y, sep } = right ? merge(x, i) : merge(x, i - 1);
    emit(`Caso 3b: ${left && right ? 'anche i fratelli adiacenti hanno' : 'anche il fratello adiacente ha'} solo ${t - 1} chiavi. Fondiamo il figlio con un fratello e con la chiave ${sep} del padre: il nodo fuso ha ${2 * t - 1} chiavi.`, { hl: y, keys: [sep] });
    shrinkRoot(y);
    c = y;
    del(c, k);
  }

  // ---------- la sequenza di operazioni ----------
  emit('L\'albero di partenza.');
  for (const raw of ops) {
    const o = parseOp(raw);
    if (!o) continue;
    op = o; reads = 0; writes = 0; path = [];
    opStart.push(frames.length);
    const present = allKeys(T.root).some((v) => cmp(v, o.key) === 0);
    if (o.type === 'search') search(T.root, o.key);
    else if (o.type === 'insert') {
      if (present) emit(`${o.key} è già presente nell'albero: le chiavi sono distinte e non si inserisce niente.`);
      else insert(o.key);
    } else if (!present) emit(`${o.key} non è presente nell'albero: non c'è niente da cancellare.`);
    else del(T.root, o.key);
    frames[frames.length - 1].end = true;
  }
  return { frames, opStart };
}
