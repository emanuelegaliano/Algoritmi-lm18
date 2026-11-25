import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer } from 'texweb/client';
import { sc } from '../lib/util.js';
import { simulate, estimate } from './model.js';
import './style.css';

// La simulazione Monte Carlo della percolazione: si aprono siti a caso, uno alla volta, finché i siti
// virtuali top e bottom finiscono nello stesso insieme. I siti bloccati sono scuri, quelli aperti
// bianchi, e quelli pieni (collegati alla prima riga da siti aperti) blu. Con le etichette, ogni sito
// mostra il suo rappresentante, come le due barre dei siti virtuali. Sotto il player, un riquadro
// stima p* ripetendo la simulazione molte volte, senza animazione.

const MACROS = { '\\FindSet': sc('Find-Set') };
const tex = (src, el) => katex.render(src, el, { throwOnError: false, macros: { ...MACROS } });
const fmt = (x, d = 3) => x.toFixed(d).replace('.', ',');

export default defineWidget({
  name: 'percolation',
  params: {
    n: { type: 'integer', default: 8, min: 2, max: 60 },
    seed: { type: 'integer', default: 7 },
    labels: { type: 'boolean', default: true },
    trials: { type: 'integer', default: 200, min: 10, max: 2000 },
    interval: { type: 'number', default: 900, min: 30 },
  },

  mount(el, { n, seed: seed0, labels: labels0, trials, interval }) {
    el.classList.add('w-perc');
    const labels = labels0 && n <= 12;
    const N = n * n;
    let seed = seed0;

    const S = Math.max(8, Math.min(40, Math.floor(360 / n)));
    const BAR = Math.round(S * 0.62), GAP = 6, MX = 78, MY = 10;
    const gy = MY + BAR + GAP, W = MX * 2 + n * S, H = gy + n * S + GAP + BAR + MY;
    const svg = svgRoot(W, H, { 'aria-label': 'Percolazione: simulazione Monte Carlo con le operazioni sugli insiemi disgiunti' });

    const cells = [], texts = [];
    for (let i = 0; i < N; i++) {
      const x = MX + (i % n) * S, y = gy + Math.floor(i / n) * S;
      const rect = s('rect', { x, y, width: S, height: S, class: 'pc-cell' });
      svg.append(rect);
      cells.push(rect);
      if (labels) { const t = s('text', { x: x + S / 2, y: y + S / 2, class: 'pc-num' }); svg.append(t); texts.push(t); }
    }
    // i due siti virtuali, come due barre sopra e sotto la griglia
    const bar = (y, name) => {
      const rect = s('rect', { x: MX, y, width: n * S, height: BAR, rx: 3, class: 'pc-bar' });
      const t = s('text', { x: MX + (n * S) / 2, y: y + BAR / 2, class: 'pc-num pc-barnum' });
      svg.append(rect, t, s('text', { x: MX - 8, y: y + BAR / 2, class: 'pc-side', 'text-anchor': 'end' }, name));
      return { rect, t };
    };
    const topBar = bar(MY, labels ? `top (${N})` : 'top'), botBar = bar(gy + n * S + GAP, labels ? `bottom (${N + 1})` : 'bottom');

    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });
    let frames;
    const compute = () => { frames = simulate(n, seed, { labels }); };

    function draw(i) {
      const f = frames[i];
      for (let j = 0; j < N; j++) {
        const st = f.open[j] ? (f.full[j] ? 'pc-full' : 'pc-open') : 'pc-blocked';
        cells[j].setAttribute('class', ['pc-cell', st, j === f.site && 'pc-new'].filter(Boolean).join(' '));
        if (labels) { texts[j].textContent = String(f.rep[j]); texts[j].setAttribute('class', `pc-num ${f.open[j] ? '' : 'pc-num-dark'}`); }
      }
      topBar.rect.setAttribute('class', 'pc-bar pc-full');
      botBar.rect.setAttribute('class', `pc-bar ${f.percolates ? 'pc-full' : ''}`);
      if (labels) { topBar.t.textContent = String(f.repTop); botBar.t.textContent = String(f.repBottom); }

      const parts = [`\\text{siti aperti: } ${f.opened}/${N} = ${fmt(f.opened / N).replace(',', '{,}')}`];
      if (f.percolates) parts.push(`\\FindSet(\\mathit{top}) = \\FindSet(\\mathit{bottom})`);
      eq.replaceChildren(...parts.map((p) => { const span = h('span', { class: 'eq-part' }); tex(p, span); return span; }));
      if (f.site == null) note.textContent = `All'inizio tutti i siti sono bloccati. Ogni sito è un insieme a sé, e lo sono anche i due siti virtuali top e bottom.`;
      else {
        const [r, c] = [Math.floor(f.site / n) + 1, (f.site % n) + 1];
        const nb = f.links.filter((t) => typeof t === 'number');
        const virt = f.links.filter((t) => typeof t === 'string');
        const what = [nb.length && `${nb.length === 1 ? 'al sito aperto vicino' : `ai ${nb.length} siti aperti vicini`}`, virt.length && `al sito virtuale ${virt.join(' e ')}`].filter(Boolean).join(' e ');
        note.textContent = `Si apre il sito ${f.site} (riga ${r}, colonna ${c})${what ? `, e lo si unisce ${what}` : ', che non ha vicini aperti'}.`
          + (f.percolates ? ` Ora top e bottom stanno nello stesso insieme: il sistema percola, e ${f.opened}/${N} = ${fmt(f.opened / N)} è una stima di p*.` : '');
      }
    }

    compute();
    const player = createPlayer({ steps: frames.length, onStep: draw, interval });
    const restart = () => { compute(); player.pause(); player.setSteps(frames.length); player.play(); };
    const controls = h('div', { class: 'controls' }, h('div', { class: 'seg' }, [
      h('button', { type: 'button', class: 'seg-btn', title: 'Apre i siti in un nuovo ordine casuale',
        onclick: () => { seed = (seed * 48271 + 11) % 2147483647; restart(); } }, 'Nuova simulazione'),
      h('button', { type: 'button', class: 'seg-btn', title: 'Torna alla simulazione di partenza', onclick: () => { seed = seed0; restart(); } }, '↺ Ripristina'),
    ]));

    // la stima di p* con molte simulazioni, per griglie di dimensioni diverse
    const sizes = [8, 20, 50, 100];
    let size = sizes.includes(n) ? n : sizes[0];
    const out = h('div', { class: 'pc-out' });
    const hist = svgRoot(260, 70, { class: 'fig-svg pc-hist', 'aria-label': 'Istogramma delle stime' });
    const sizeBtns = sizes.map((m) => h('button', { type: 'button', class: `seg-btn${m === size ? ' on' : ''}`, onclick: () => {
      size = m; sizeBtns.forEach((b, k) => b.classList.toggle('on', sizes[k] === m));
    } }, `${m}×${m}`));
    let runs = 0;
    const go = () => {
      const t = size >= 100 ? Math.min(trials, 100) : trials;
      const { mean, sd, xs } = estimate(size, t, 1000 + ++runs);
      out.replaceChildren();
      tex(`n = ${size}:\\quad \\hat p^* = ${fmt(mean, 4).replace(',', '{,}')}\\ \\text{su ${t} prove, con deviazione standard ${fmt(sd, 3)}}`, out);
      // l'istogramma delle stime, tra 0,3 e 0,9
      const bins = new Array(24).fill(0);
      for (const x of xs) bins[Math.min(23, Math.max(0, Math.floor((x - 0.3) / 0.025)))]++;
      const top = Math.max(...bins);
      hist.replaceChildren(
        ...bins.map((b, k) => s('rect', { x: 10 + k * 10, y: 60 - (b / top) * 50, width: 8.5, height: (b / top) * 50, class: 'pc-bin' })),
        s('line', { x1: 10 + ((0.592746 - 0.3) / 0.025) * 10, x2: 10 + ((0.592746 - 0.3) / 0.025) * 10, y1: 4, y2: 62, class: 'pc-pstar' }),
        s('text', { x: 10, y: 69, class: 'pc-axis' }, '0,3'), s('text', { x: 250, y: 69, class: 'pc-axis', 'text-anchor': 'end' }, '0,9'),
        s('text', { x: 14 + ((0.592746 - 0.3) / 0.025) * 10, y: 10, class: 'pc-axis' }, 'p* ≈ 0,5927'),
      );
    };
    const est = h('div', { class: 'pc-est' }, [
      h('div', { class: 'controls' }, [
        h('span', { class: 'pc-lab' }, 'Stima di p*:'),
        h('div', { class: 'seg' }, sizeBtns),
        h('div', { class: 'seg' }, h('button', { type: 'button', class: 'seg-btn', onclick: go }, `${trials} prove`)),
      ]),
      out, hist,
    ]);
    el.append(controls, svg, eq, note, player.el, est);
  },
});
