// Alberi binomiali senza grafica: i nodi, i fotogrammi della costruzione e le posizioni.
// La usano il widget e lo script che genera la figura TikZ del PDF.
//
// Un nodo di B_k è una stringa di k bit. Il primo bit dice in quale copia di B_{k-1} si trova il nodo
// ('0' per la copia la cui radice diventa il primo figlio, '1' per quella che resta radice), il resto
// dice dove si trova dentro la copia. La radice è 11...1, e ne seguono due fatti comodi:
//   - la profondità di un nodo è il numero dei suoi zeri, quindi a profondità i ci sono C(k, i) nodi;
//   - il padre di un nodo si ottiene trasformando in 1 il suo ultimo zero, e i figli trasformando in 0
//     uno degli 1 finali: il grado è il numero degli 1 finali.
// Nell'animazione B_{k-1} diventa la copia di destra di B_k, ovvero il nodo t diventa '1' + t: togliendo
// gli 1 iniziali, i due nodi hanno lo stesso nome canon(), e nel disegno sono lo stesso elemento.

export const width = (d) => (d === 0 ? 1 : 2 ** (d - 1)); // le colonne occupate da un B_d
export const degree = (s) => { let i = s.length; while (i > 0 && s[i - 1] === '1') i--; return s.length - i; };
export const depthOf = (s) => [...s].filter((c) => c === '0').length;
export const children = (s) => {
  const d = degree(s), p = s.length - d;
  return Array.from({ length: d }, (_, j) => `${s.slice(0, p + j)}0${s.slice(p + j + 1)}`);
};
export const canon = (s) => s.replace(/^1+/, '') || 'r';
export const binom = (n, k) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};

// i passi della costruzione fino a B_K: B_0, poi per ogni k le due copie di B_{k-1} e B_k
export function steps(K) {
  const out = [{ kind: 'tree', k: 0 }];
  for (let k = 1; k <= K; k++) out.push({ kind: 'copies', k }, { kind: 'tree', k });
  return out;
}

// posizioni (in colonne e livelli) dei nodi di un albero con radice root; ogni foglia occupa una
// colonna, ogni nodo interno sta sopra il suo ultimo figlio
function place(root, col0, depth0, prefix, out) {
  let c = col0;
  const visit = (s, depth) => {
    const ch = children(s);
    let col;
    if (!ch.length) col = c++;
    else for (const t of ch) { col = visit(t, depth + 1); out.edges.push({ a: prefix + s, b: prefix + t }); }
    out.nodes.push({ s: prefix + s, local: s, col, depth });
    return col;
  };
  const col = visit(root, depth0);
  return { col, end: c };
}

// i nodi di un passo: per le due copie di B_{k-1} il nodo '0' + t (copia di sinistra) e il nodo '1' + t
// (copia di destra), ancora alla stessa profondità; per B_k i nodi di B_k
export function arrange(step, gap = 1) {
  const out = { nodes: [], edges: [], trees: [] };
  if (step.kind === 'tree') {
    const root = '1'.repeat(step.k);
    const r = place(root, 0, 0, '', out);
    out.trees.push({ root, prefix: '', start: 0, end: r.end });
    out.cols = r.end;
  } else {
    const k = step.k, sub = '1'.repeat(k - 1), w = width(k - 1);
    const a = place(sub, 0, 0, '0', out);
    const b = place(sub, w + gap, 0, '1', out);
    out.trees.push({ root: `0${sub}`, prefix: '0', start: 0, end: a.end }, { root: `1${sub}`, prefix: '1', start: w + gap, end: b.end });
    out.cols = b.end;
  }
  out.depth = Math.max(0, ...out.nodes.map((v) => v.depth));
  return out;
}

// il grado del sottoalbero di un figlio della radice che contiene il nodo (local è il nome del nodo
// dentro il suo albero), oppure null per la radice
export function subtreeOf(local) {
  const j = local.indexOf('0');
  return j < 0 ? null : local.length - 1 - j;
}
