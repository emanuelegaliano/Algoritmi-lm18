import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer } from 'texweb/client';
import './style.css';

// inserimenti in una tabella dinamica che raddoppia quando è piena: il costo di ogni inserimento,
// le monete del metodo degli accantonamenti (scure sugli elementi inseriti dopo l'ultima espansione,
// chiare su quelli già ricopiati) e, se richiesto, l'andamento di num, size e del potenziale

const name = (i, n) => (n <= 26 ? String.fromCharCode(96 + i) : String(i));

export default defineWidget({
  name: 'dynamic-table',
  params: {
    steps: { type: 'integer', default: 9, min: 1, max: 64 },
    coins: { type: 'boolean', default: true },
    chart: { type: 'boolean', default: false },
    interval: { type: 'number', default: 1300, min: 300 },
  },

  mount(el, { steps, coins, chart, interval }) {
    el.classList.add('w-dyntable');

    // dopo i inserimenti: dimensione, costo dell'ultimo inserimento, monete su ogni posizione (1 = scura, 2 = chiara)
    const frames = [{ num: 0, size: 0, c: 0, sum: 0, coin: [] }];
    for (let i = 1; i <= steps; i++) {
      const p = frames[i - 1];
      const expand = p.size > 0 && p.num === p.size;
      const size = p.size === 0 ? 1 : expand ? 2 * p.size : p.size;
      const c = expand ? i : 1;
      const coin = Array(size + 1).fill(0);
      if (i === 1) coin[1] = 1;
      else {
        const half = size / 2;
        for (let j = 1; j <= i - half; j++) { coin[half + j] = 1; coin[half - j + 1] = 2; }
      }
      frames.push({ num: i, size, c, expand, copies: expand ? i - 1 : 0, sum: p.sum + c, coin });
    }

    const maxSize = frames[steps].size;
    const W = 560, CELL = Math.min(44, (W - 40) / maxSize), X0 = (W - maxSize * CELL) / 2, Y0 = 34;
    const CH = chart ? 190 : 0;
    const svg = svgRoot(W, Y0 + CELL + 30 + CH, { 'aria-label': 'Una tabella dinamica che raddoppia quando è piena' });
    const small = CELL < 26;

    const cells = Array.from({ length: maxSize }, (_, j) => {
      const g = s('g', { class: 'slot' }, [
        s('rect', { x: X0 + j * CELL, y: Y0, width: CELL, height: CELL, class: 'cellt' }),
        s('text', { x: X0 + (j + 0.5) * CELL, y: Y0 + CELL / 2, class: `elt${small ? ' tiny' : ''}` }, name(j + 1, steps)),
        s('circle', { cx: X0 + (j + 0.5) * CELL, cy: Y0 - 11, r: Math.min(6, CELL / 4), class: 'coin' }),
      ]);
      svg.append(g);
      return g;
    });
    const sizeLabel = s('text', { x: W / 2, y: Y0 + CELL + 20, class: 'cap' });
    svg.append(sizeLabel);

    // grafico di num, size e Φ = 2 num - size, come nella figura del PDF
    let draws = null;
    if (chart) {
      const GX = 50, GY = Y0 + CELL + 30 + CH - 22, GW = W - 130, GH = CH - 40;
      const ymax = maxSize;
      const px = (i) => GX + (i / steps) * GW, py = (v) => GY - (v / ymax) * GH;
      svg.append(
        s('line', { x1: GX, y1: GY, x2: GX + GW, y2: GY, class: 'axis' }),
        s('line', { x1: GX, y1: GY, x2: GX, y2: GY - GH - 6, class: 'axis' }),
        s('text', { x: GX - 6, y: py(ymax), class: 'tick end' }, String(ymax)),
        s('text', { x: GX - 6, y: GY, class: 'tick end' }, '0'),
        s('text', { x: GX + GW, y: GY + 14, class: 'tick end' }, `i = ${steps}`),
      );
      const series = [['num', 'l-num', (f) => f.num], ['size', 'l-size', (f) => f.size], ['Φ', 'l-phi', (f) => (f.size ? 2 * f.num - f.size : 0)]];
      draws = series.map(([label, cls, get], k) => {
        const line = s('polyline', { class: `series ${cls}` });
        svg.append(line, s('line', { x1: GX + GW + 14, y1: GY - GH + 10 + k * 18, x2: GX + GW + 32, y2: GY - GH + 10 + k * 18, class: `series ${cls}` }),
          s('text', { x: GX + GW + 38, y: GY - GH + 10 + k * 18, class: 'tick' }, label));
        return (n) => line.setAttribute('points', frames.slice(0, n + 1).map((f, i) => `${px(i)},${py(get(f))}`).join(' '));
      });
      const cursor = s('line', { y1: GY, y2: GY - GH, class: 'cursor' });
      svg.append(cursor);
      draws.push((n) => { cursor.setAttribute('x1', px(n)); cursor.setAttribute('x2', px(n)); });
    }

    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    function draw(n) {
      const f = frames[n];
      cells.forEach((g, j) => {
        g.classList.toggle('alloc', j < f.size);
        g.classList.toggle('full', j < f.num);
        g.classList.toggle('new', j === f.num - 1 && n > 0);
        g.classList.toggle('copied', f.expand && j < f.copies);
        const c = coins ? f.coin[j + 1] ?? 0 : 0;
        g.classList.toggle('dark', c === 1);
        g.classList.toggle('light', c === 2);
      });
      sizeLabel.textContent = f.size ? `num = ${f.num},  size = ${f.size}` : 'tabella vuota (size = 0)';
      draws?.forEach((d) => d(n));

      const amort = n === 1 ? 2 : 3;
      const phi = f.size ? 2 * f.num - f.size : 0;
      const sumHat = n ? 3 * n - 1 : 0;
      katex.render(n
        ? `c_{${n}} = ${f.expand ? `${f.copies} + 1 = ${f.c}` : f.c},\\quad \\hat c_{${n}} = ${amort},\\qquad \\Phi = 2\\cdot\\mathit{num} - \\mathit{size} = ${phi},\\qquad \\textstyle\\sum c_i = ${f.sum} \\le \\sum \\hat c_i = ${sumHat}`
        : '\\mathit{num} = \\mathit{size} = 0,\\quad \\Phi = 0', eq, { throwOnError: false });
      note.textContent = !n ? 'La tabella è vuota.'
        : coins ? (n === 1 ? 'Primo inserimento: si alloca una tabella di dimensione 1. Costa 1 e addebitiamo 2: una moneta resta sull\'elemento.'
          : f.expand ? `La tabella era piena: espansione a dimensione ${f.size}, con ${f.copies} copie pagate dalle ${f.copies} monete accumulate, poi l'inserimento. Ora i vecchi elementi sono senza credito.`
          : 'Inserimento senza espansione: costa 1, e delle 3 unità addebitate 2 diventano monete, una sul nuovo elemento e una su un elemento già ricopiato.')
        : (n === 1 ? 'Primo inserimento: si alloca una tabella di dimensione 1, e il potenziale vale 2 · 1 − 1 = 1.'
          : f.expand ? `Espansione a dimensione ${f.size}: il potenziale, arrivato a ${f.copies}, paga le ${f.copies} copie; l'inserimento lo riporta a 2.`
          : 'Inserimento senza espansione: costa 1, e il potenziale cresce di 2.');
    }

    const player = createPlayer({ steps: steps + 1, onStep: draw, interval });
    el.append(svg, eq, note, player.el);
  },
});
