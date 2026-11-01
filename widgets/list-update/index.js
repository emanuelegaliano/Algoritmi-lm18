import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer } from 'texweb/client';
import { runMTF, runOPT } from './model.js';
import './style.css';

// MOVE-TO-FRONT e FORSEE sulla stessa sequenza di richieste, nel modello di costo uniforme:
// per ogni richiesta prima l'accesso (gli elementi esaminati), poi la riorganizzazione (gli scambi).
// FORSEE è l'ottimo offline, calcolato con la programmazione dinamica sulle n! configurazioni:
// per questo la lista ha al più 6 elementi

const MAXN = 6, MAXREQ = 14;

export default defineWidget({
  name: 'list-update',
  params: {
    list: { type: 'list', default: [1, 2, 3, 4, 5] },
    requests: { type: 'list', default: [5, 3, 4, 4] },
    interval: { type: 'number', default: 1500, min: 300 },
  },

  mount(el, { list: list0, requests: req0, interval }) {
    el.classList.add('w-lupd');
    const list = list0.slice(0, MAXN).map(String);
    const initialReq = req0.map(String).filter((x) => list.includes(x)).slice(0, MAXREQ);
    let requests = initialReq, mtf, opt, frames;

    // un fotogramma iniziale, poi due per ogni richiesta: accesso e riorganizzazione
    function compute() {
      mtf = runMTF(list, requests);
      opt = runOPT(list, requests);
      frames = [{ i: -1 }];
      requests.forEach((_, i) => frames.push({ i, phase: 'access' }, { i, phase: 'after' }));
    }

    const CELL = 46, X0 = 120, ROWS = { M: 40, F: 120 };
    const W = X0 + MAXN * CELL + 20, H = 160;
    const svg = svgRoot(W, H, { 'aria-label': 'Le liste di Move-To-Front e di FORSEE, richiesta dopo richiesta' });
    svg.append(
      s('text', { x: 14, y: ROWS.M, class: 'row-l' }, 'MTF'),
      s('text', { x: 14, y: ROWS.F, class: 'row-l' }, 'FORSEE'),
    );
    const costM = s('text', { x: 14, y: ROWS.M + 22, class: 'row-c' });
    const costF = s('text', { x: 14, y: ROWS.F + 22, class: 'row-c' });
    svg.append(costM, costF);

    // una cella per ogni elemento e per ogni lista, che si sposta con una transizione CSS
    const cells = {};
    for (const row of ['M', 'F']) {
      cells[row] = new Map(list.map((v) => {
        const g = s('g', { class: 'cell' }, [
          s('rect', { x: -CELL / 2 + 3, y: -17, width: CELL - 6, height: 34, rx: 4 }),
          s('text', { x: 0, y: 0 }, v),
        ]);
        svg.append(g);
        return [v, g];
      }));
    }
    const place = (row, arr) => arr.forEach((v, j) => {
      cells[row].get(v).style.transform = `translate(${X0 + j * CELL + CELL / 2}px, ${ROWS[row]}px)`;
    });

    const table = h('div', { class: 'costs' });
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    const cost = (st) => st.access + st.swaps;
    // costo delle richieste da 0 a i (nessuna se i < 0)
    const sumTo = (steps, i) => (i < 0 ? 0 : steps.slice(0, i + 1).reduce((a, st) => a + cost(st), 0));

    function drawTable(i, phase) {
      const done = (j) => j < i || (j === i && phase === 'after');
      const row = (name, steps) => h('tr', {}, [
        h('th', {}, name),
        ...steps.map((st, j) => h('td', { class: `${j === i ? 'on' : ''}${j > i ? ' later' : ''}` }, done(j) ? String(cost(st)) : j === i ? `${st.access} + ?` : '')),
        h('td', { class: 'tot' }, String(sumTo(steps, phase === 'after' ? i : i - 1))),
      ]);
      table.replaceChildren(h('table', {}, [
        h('tr', {}, [h('th', {}, ''), ...requests.map((x, j) => h('th', { class: j === i ? 'on' : '' }, x)), h('th', { class: 'tot' }, 'totale')]),
        row('MTF', mtf), row('FORSEE', opt),
      ]));
    }

    function draw(n) {
      const f = frames[n];
      const i = f.i;
      for (const row of ['M', 'F']) {
        const steps = row === 'M' ? mtf : opt;
        const st = steps[i];
        const arr = i < 0 ? list : f.phase === 'access' ? st.before : st.after;
        place(row, arr);
        for (const [v, g] of cells[row]) {
          const pos = arr.indexOf(v);
          const before = st ? st.before.indexOf(v) : pos;
          g.classList.toggle('req', !!st && v === st.x);
          g.classList.toggle('seen', !!st && f.phase === 'access' && pos < st.access - 1);
          // in ocra gli elementi che FORSEE sposta pur non essendo stati richiesti
          g.classList.toggle('moved', !!st && f.phase === 'after' && v !== st.x && pos !== before && row === 'F' && pos < before);
        }
      }
      const cM = i < 0 ? 0 : sumTo(mtf, f.phase === 'after' ? i : i - 1);
      const cF = i < 0 ? 0 : sumTo(opt, f.phase === 'after' ? i : i - 1);
      costM.textContent = `C = ${cM}`;
      costF.textContent = `C = ${cF}`;
      drawTable(i, f.phase);

      if (i < 0) {
        katex.render(`L = (${list.join(', ')}),\\qquad \\sigma = (${requests.join(', ')})`, eq, { throwOnError: false });
        note.textContent = requests.length
          ? 'Le due liste partono dalla stessa configurazione. FORSEE conosce l\'intera sequenza, MTF no.'
          : 'Scegli un elemento da richiedere con i pulsanti qui sopra.';
        return;
      }
      const m = mtf[i], o = opt[i];
      if (f.phase === 'access') {
        katex.render(`x_{${i + 1}} = ${m.x}:\\quad r_{L^M}(x) = ${m.access},\\qquad r_{L^F}(x) = ${o.access}`, eq, { throwOnError: false });
        note.textContent = `Richiesta ${i + 1}: entrambi scorrono la lista fino a trovare ${m.x} (in grigio gli elementi già esaminati), e pagano la sua posizione.`;
      } else {
        katex.render(`c^M_{${i + 1}} = 2 \\cdot ${m.access} - 1 = ${cost(m)},\\qquad c^F_{${i + 1}} = ${o.access} + ${o.swaps} = ${cost(o)}`
          + (i === requests.length - 1 ? `,\\qquad \\frac{C_{\\mathrm{MTF}}}{C_{\\mathrm{FORSEE}}} = \\frac{${cM}}{${cF}} \\approx ${(cM / cF).toFixed(2).replace('.', '{,}')}` : ''), eq, { throwOnError: false });
        note.textContent = (m.swaps ? `MTF porta ${m.x} in testa con ${m.swaps} scambi. ` : `${m.x} è già in testa alla lista di MTF. `)
          + (o.swaps ? `FORSEE fa ${o.swaps} scambi, perché sa cosa verrà richiesto dopo.` : 'FORSEE non fa scambi: in base alle richieste future non gli conviene.')
          + (i === requests.length - 1 ? ' Il rapporto tra i costi non supera mai 4.' : '');
      }
    }

    compute();
    const player = createPlayer({ steps: frames.length, onStep: draw, interval, autoplay: requests.length > 0 });

    function request(x) {
      if (requests.length >= MAXREQ) return;
      requests = [...requests, x];
      compute();
      player.pause();
      player.setSteps(frames.length, { keep: true });
      player.go(frames.length - 2);
      note.textContent += ' FORSEE conosce tutta la sequenza: con una richiesta in più può cambiare anche le scelte che ha fatto prima.';
    }

    const btn = (text, onclick, cls = '') => h('button', { type: 'button', class: `seg-btn ${cls}`, onclick }, text);
    el.append(
      h('div', { class: 'controls' }, [
        h('span', { class: 'sl-name' }, 'richiedi'),
        h('div', { class: 'seg' }, list.map((v) => btn(v, () => request(v)))),
        h('div', { class: 'seg' }, [
          btn('↺ Ripristina', () => { requests = initialReq; compute(); player.pause(); player.setSteps(frames.length); player.go(0); }),
          btn('Svuota', () => { requests = []; compute(); player.pause(); player.setSteps(frames.length); player.go(0); }),
        ]),
      ]),
      svg, table, eq, note, player.el,
    );
  },
});
