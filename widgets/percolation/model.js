// Percolazione con le operazioni sugli insiemi disgiunti, senza grafica. Una griglia n x n di siti,
// numerati da 0 a n^2 - 1 per righe, parte con tutti i siti bloccati; a ogni passo si apre un sito
// bloccato scelto a caso, e lo si unisce ai siti aperti vicini. Due siti virtuali, top (n^2) e bottom
// (n^2 + 1), sono uniti ai siti aperti della prima e dell'ultima riga: il sistema percola quando top e
// bottom stanno nello stesso insieme. La usano sia il widget sia lo script che genera la figura TikZ.

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// una foresta con l'unione per ranghi e la compressione dei cammini
function forest(size) {
  const p = Array.from({ length: size }, (_, i) => i), rank = new Array(size).fill(0);
  const findRec = (x) => (p[x] === x ? x : (p[x] = findRec(p[x])));
  const union = (a, b) => {
    const x = findRec(a), y = findRec(b);
    if (x === y) return false;
    if (rank[x] > rank[y]) p[y] = x; else { p[x] = y; if (rank[x] === rank[y]) rank[y]++; }
    return true;
  };
  return { find: findRec, union };
}

// l'ordine in cui si aprono i siti: una permutazione casuale con un seme
export function order(n, seed) {
  const o = Array.from({ length: n * n }, (_, i) => i), rnd = rng(seed);
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

const neighbours = (n, s) => {
  const r = Math.floor(s / n), c = s % n, nb = [];
  if (r > 0) nb.push(s - n);
  if (r < n - 1) nb.push(s + n);
  if (c > 0) nb.push(s - 1);
  if (c < n - 1) nb.push(s + 1);
  return nb;
};

// i siti pieni: i siti aperti raggiungibili da un sito aperto della prima riga (una visita, così il
// sito virtuale bottom non colora di blu i siti collegati soltanto al fondo)
function fullSites(n, open) {
  const full = new Uint8Array(n * n), queue = [];
  for (let c = 0; c < n; c++) if (open[c]) { full[c] = 1; queue.push(c); }
  while (queue.length) {
    const s = queue.pop();
    for (const t of neighbours(n, s)) if (open[t] && !full[t]) { full[t] = 1; queue.push(t); }
  }
  return full;
}

// la simulazione completa: un fotogramma per ogni sito aperto, fino a quando il sistema percola
export function simulate(n, seed, { labels = false } = {}) {
  const N = n * n, top = N, bottom = N + 1;
  const uf = forest(N + 2), open = new Uint8Array(N), frames = [];
  const snap = (f) => {
    const full = fullSites(n, open);
    const rep = labels ? Array.from({ length: N }, (_, s) => uf.find(s)) : null;
    frames.push({ open: open.slice(), full, rep, repTop: uf.find(top), repBottom: uf.find(bottom), percolates: uf.find(top) === uf.find(bottom), ...f });
  };
  snap({ opened: 0, site: null, links: [] });
  let k = 0;
  for (const s of order(n, seed)) {
    open[s] = 1; k++;
    const links = [];
    for (const t of neighbours(n, s)) if (open[t] && uf.union(s, t)) links.push(t);
    if (s < n) { uf.union(s, top); links.push('top'); }
    if (s >= N - n) { uf.union(s, bottom); links.push('bottom'); }
    snap({ opened: k, site: s, links });
    if (uf.find(top) === uf.find(bottom)) break;
  }
  return frames;
}

// la stima di p*: la frazione di siti aperti nel momento in cui il sistema percola, su molte prove
export function estimate(n, trials, seed) {
  const N = n * n, top = N, bottom = N + 1, rnd = rng(seed), xs = [];
  for (let t = 0; t < trials; t++) {
    const uf = forest(N + 2), open = new Uint8Array(N);
    const o = order(n, Math.floor(rnd() * 2 ** 31) + 1);
    let k = 0;
    for (const s of o) {
      open[s] = 1; k++;
      for (const u of neighbours(n, s)) if (open[u]) uf.union(s, u);
      if (s < n) uf.union(s, top);
      if (s >= N - n) uf.union(s, bottom);
      if (uf.find(top) === uf.find(bottom)) break;
    }
    xs.push(k / N);
  }
  const mean = xs.reduce((a, b) => a + b, 0) / trials;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, trials - 1));
  return { mean, sd, xs };
}

// la probabilità di percolazione con probabilità di apertura p: ogni sito è aperto con probabilità p,
// indipendentemente dagli altri (serve per il grafico della transizione di fase)
export function percolationProbability(n, p, trials, seed) {
  const N = n * n, rnd = rng(seed);
  let yes = 0;
  for (let t = 0; t < trials; t++) {
    const uf = forest(N + 2), open = new Uint8Array(N);
    for (let s = 0; s < N; s++) open[s] = rnd() < p ? 1 : 0;
    for (let s = 0; s < N; s++) {
      if (!open[s]) continue;
      for (const u of neighbours(n, s)) if (u > s && open[u]) uf.union(s, u);
      if (s < n) uf.union(s, N);
      if (s >= N - n) uf.union(s, N + 1);
    }
    if (uf.find(N) === uf.find(N + 1)) yes++;
  }
  return yes / trials;
}
