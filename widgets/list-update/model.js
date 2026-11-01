// il problema List Update nel modello uniforme: MOVE-TO-FRONT e l'ottimo offline (FORSEE),
// calcolato con la programmazione dinamica sulle n! configurazioni della lista

// tutte le permutazioni di una lista
export function permutations(list) {
  if (list.length <= 1) return [list.slice()];
  const out = [];
  list.forEach((v, i) => {
    for (const p of permutations([...list.slice(0, i), ...list.slice(i + 1)])) out.push([v, ...p]);
  });
  return out;
}

// numero di inversioni tra due liste con gli stessi elementi, ovvero il numero minimo di scambi adiacenti
export function inversions(a, b) {
  const pos = new Map(b.map((v, i) => [v, i]));
  const r = a.map((v) => pos.get(v));
  let count = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i] > r[j]) count++;
  return count;
}

// MOVE-TO-FRONT: per ogni richiesta, la lista prima, la posizione dell'elemento e la lista dopo
export function runMTF(list, requests) {
  let cur = list.slice();
  return requests.map((x) => {
    const p = cur.indexOf(x) + 1;
    const after = [x, ...cur.filter((v) => v !== x)];
    const step = { x, before: cur, after, access: p, swaps: p - 1 };
    cur = after;
    return step;
  });
}

// FORSEE: D_i(π') = min_π { D_{i-1}(π) + r_π(x_i) + d(π, π') }, con D_0(L) = 0;
// la strategia ottima si ricostruisce all'indietro, dall'ultima richiesta alla prima
export function runOPT(list, requests) {
  const perms = permutations(list);
  const key = (p) => p.join('\u0001');
  const index = new Map(perms.map((p, i) => [key(p), i]));
  const N = perms.length;
  const dist = perms.map((a) => perms.map((b) => inversions(a, b)));
  const pos = perms.map((p) => new Map(p.map((v, i) => [v, i + 1])));

  // D[i][π]: costo minimo delle prime i richieste terminando in π
  let D = new Array(N).fill(Infinity);
  D[index.get(key(list))] = 0;
  const Ds = [D];
  for (const x of requests) {
    const next = new Array(N).fill(Infinity);
    for (let a = 0; a < N; a++) {
      if (D[a] === Infinity) continue;
      const base = D[a] + pos[a].get(x);
      for (let b = 0; b < N; b++) if (base + dist[a][b] < next[b]) next[b] = base + dist[a][b];
    }
    D = next;
    Ds.push(D);
  }

  // a parità di costo, a ogni passo si sceglie il predecessore da cui si arriva con meno scambi
  // (sulla sequenza 5, 3, 4, 4 si ottiene la strategia del testo: 4 va in testa dopo l'accesso a 3)
  const m = requests.length;
  let best = 0;
  for (let b = 1; b < N; b++) if (Ds[m][b] < Ds[m][best]) best = b;
  const states = new Array(m + 1);
  states[m] = best;
  for (let i = m; i >= 1; i--) {
    const b = states[i], x = requests[i - 1];
    let pick = -1;
    for (let a = 0; a < N; a++) {
      if (Ds[i - 1][a] === Infinity) continue;
      if (Ds[i - 1][a] + pos[a].get(x) + dist[a][b] !== Ds[i][b]) continue;
      if (pick < 0 || dist[a][b] < dist[pick][b]) pick = a;
    }
    states[i - 1] = pick;
  }
  return requests.map((x, i) => {
    const before = perms[states[i]], after = perms[states[i + 1]];
    return { x, before, after, access: before.indexOf(x) + 1, swaps: dist[states[i]][states[i + 1]] };
  });
}
