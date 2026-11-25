// Foresta di insiemi disgiunti con le procedure del capitolo, senza grafica: run() esegue una sequenza
// di operazioni e restituisce i fotogrammi che il widget mostra uno alla volta. Ogni fotogramma contiene
// una copia dei campi p e rank, quindi disegnarlo non dipende dai fotogrammi precedenti. layout()
// calcola le posizioni dei nodi di un fotogramma: la usano sia il widget sia lo script che genera le
// figure TikZ del PDF, così le due versioni mostrano gli stessi alberi.
//
// Le euristiche si possono spegnere: rank = false collega sempre la radice del primo argomento sotto
// quella del secondo, compress = false lascia i cammini come sono. Con tie si sceglie cosa succede a
// parità di rango: 'link' fa come LINK(x, y) dello pseudocodice (x diventa figlio di y), 'first' fa il
// contrario (la radice del primo argomento resta radice).

export const DIM = { r: 13, slot: 34, level: 56, pad: 22, top: 44 };

// le operazioni si scrivono come 'make-set 3', 'union 1 2' e 'find 0'
export function parseOp(raw) {
  const m = String(raw).trim().toLowerCase().match(/^(make-set|union|find|find-set)\s+(-?\d+)(?:\s+(-?\d+))?$/);
  if (!m) return null;
  const type = m[1] === 'find-set' ? 'find' : m[1];
  const a = Number(m[2]), b = m[3] == null ? null : Number(m[3]);
  if (type === 'union' && b == null) return null;
  if (type !== 'union' && b != null) return null;
  return { type, a, b };
}

export function run({ n = 0, ops = [], tie = 'link', rank: byRank = true, compress = true } = {}) {
  const p = new Map(), rank = new Map(), kids = new Map(), order = [];
  const frames = [], opStart = [];
  let op = null;

  function makeSet(x) {
    p.set(x, x); rank.set(x, 0); kids.set(x, []); order.push(x);
  }
  for (let x = 0; x < n; x++) makeSet(x);

  const setParent = (x, y) => {
    const old = p.get(x);
    if (old !== x) kids.set(old, kids.get(old).filter((c) => c !== x));
    p.set(x, y);
    if (y !== x) kids.get(y).push(x);
  };
  const pathOf = (x) => { const path = [x]; while (p.get(path[path.length - 1]) !== path[path.length - 1]) path.push(p.get(path[path.length - 1])); return path; };
  const rootOf = (x) => pathOf(x).pop();
  const sets = () => order.filter((x) => p.get(x) === x).length;

  function emit(note, { hl = [], path = [], fresh = [], eq = null } = {}) {
    frames.push({
      p: Object.fromEntries(p), rank: Object.fromEntries(rank),
      kids: Object.fromEntries([...kids].map(([k, v]) => [k, [...v]])),
      order: [...order], op, eq, note, hl: [...hl], path: [...path], fresh: [...fresh], sets: sets(),
    });
  }

  // FIND-SET(x): un fotogramma con il cammino di ricerca, e uno con la compressione se cambia qualcosa
  function findSet(x, label) {
    const path = pathOf(x);
    const r = path[path.length - 1];
    if (path.length === 1) return { r, framed: false };
    const pairs = path.slice(0, -1).map((v, i) => [v, path[i + 1]]);
    emit(`${label}: il cammino di ricerca risale da ${x} fino alla radice ${r}, che è il rappresentante.`,
      { hl: path, path: pairs, eq: `\\FindSet(${x}) = ${r}` });
    const moved = path.slice(0, -2);
    if (compress && moved.length) {
      for (const v of moved) setParent(v, r);
      emit(`Compressione dei cammini: ${moved.length === 1 ? `il nodo ${moved[0]} punta` : `i nodi ${moved.join(', ')} puntano`} ora direttamente alla radice ${r}. I ranghi non cambiano.`,
        { hl: [...moved, r], fresh: moved.map((v) => [v, r]), eq: `\\FindSet(${x}) = ${r}` });
    }
    return { r, framed: true };
  }

  function link(x, y, a, b) {
    const rx = rank.get(x), ry = rank.get(y);
    const eq = `\\Link(${x}, ${y})`;
    let child, parent, note;
    if (!byRank) {
      [child, parent] = [x, y];
      note = `Senza l'unione per ranghi, la radice ${x} diventa figlio della radice ${y}.`;
    } else if (rx !== ry) {
      [child, parent] = rx > ry ? [y, x] : [x, y];
      note = `rank[${x}] = ${rx} e rank[${y}] = ${ry}: la radice di rango minore, ${child}, diventa figlio di ${parent}, e i ranghi non cambiano.`;
    } else {
      [child, parent] = tie === 'first' ? [y, x] : [x, y];
      rank.set(parent, rank.get(parent) + 1);
      note = `rank[${x}] = rank[${y}] = ${rx}: ${child} diventa figlio di ${parent}, e il rango di ${parent} sale a ${rx + 1}.`;
    }
    setParent(child, parent);
    const pre = a === x && b === y ? '' : `${a === x ? '' : `FIND-SET(${a}) = ${x}, `}${b === y ? '' : `FIND-SET(${b}) = ${y}. `}`;
    emit(`${pre}${note}`, { hl: [child, parent], fresh: [[child, parent]], eq: `${eq}: \\mathit{rank}[${x}] = ${rx},\\ \\mathit{rank}[${y}] = ${ry}` });
  }

  emit(n ? `${n} insiemi con un solo elemento, creati da ${n} operazioni MAKE-SET: ogni nodo è la radice del suo albero, con rango 0.` : 'La foresta è vuota.');

  for (const raw of ops) {
    const o = parseOp(raw);
    if (!o) continue;
    op = o;
    opStart.push(frames.length);
    if (o.type === 'make-set') {
      if (p.has(o.a)) { emit(`${o.a} appartiene già a un insieme: MAKE-SET non si può eseguire.`); continue; }
      makeSet(o.a);
      emit(`MAKE-SET(${o.a}) crea un albero con il solo nodo ${o.a}, che punta a sé stesso e ha rango 0.`, { hl: [o.a], eq: `\\MakeSet(${o.a})` });
    } else if (o.type === 'find') {
      if (!p.has(o.a)) { emit(`${o.a} non appartiene a nessun insieme.`); continue; }
      const { r, framed } = findSet(o.a, `FIND-SET(${o.a})`);
      if (!framed) emit(`${o.a} è una radice, quindi FIND-SET(${o.a}) restituisce ${r} senza risalire nessun arco.`, { hl: [r], eq: `\\FindSet(${o.a}) = ${r}` });
    } else {
      const { a, b } = o;
      if (!p.has(a) || !p.has(b)) { emit(`${!p.has(a) ? a : b} non appartiene a nessun insieme.`); continue; }
      const { r: x } = findSet(a, `UNION(${a}, ${b}) cerca prima il rappresentante di ${a}`);
      const { r: y } = findSet(b, `Poi cerca il rappresentante di ${b}`);
      if (x === y) { emit(`${a} e ${b} stanno già nello stesso insieme, con rappresentante ${x}: UNION non ha niente da unire.`, { hl: [x], eq: `\\FindSet(${a}) = \\FindSet(${b}) = ${x}` }); continue; }
      link(x, y, a, b);
    }
  }
  return { frames, opStart };
}

// le posizioni dei nodi di un fotogramma: gli alberi stanno da sinistra a destra, nell'ordine in cui
// sono stati creati i loro elementi; ogni foglia occupa una colonna e un padre sta sopra i suoi figli
export function layout(f, { r = DIM.r, slot = DIM.slot, level = DIM.level, pad = DIM.pad, top = DIM.top } = {}) {
  const nodes = [], arrows = [];
  let col = 0, maxDepth = 0;
  function place(v, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const cs = f.kids[v] ?? [];
    let x;
    if (!cs.length) { x = pad + r + col * slot; col++; }
    else {
      const xs = cs.map((c) => place(c, depth + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    nodes.push({ id: v, x, y: top + depth * level, rank: f.rank[v], root: depth === 0 });
    for (const c of cs) arrows.push({ a: c, b: v });
    return x;
  }
  // tra due alberi c'è una colonna di spazio in più, tranne che tra due nodi isolati
  const roots = f.order.filter((v) => f.p[v] === v);
  const alone = (v) => !(f.kids[v] ?? []).length;
  roots.forEach((v, i) => { place(v, 0); if (i < roots.length - 1 && !(alone(v) && alone(roots[i + 1]))) col += 0.35; });
  return { nodes, arrows, width: pad * 2 + 2 * r + Math.max(0, col - 1) * slot, height: top + maxDepth * level + r + pad };
}
