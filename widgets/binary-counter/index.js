import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer } from 'texweb/client';
import './style.css';

// un contatore binario a k bit incrementato n volte: a ogni passo i bit che cambiano,
// il costo dell'incremento e il costo totale, contro il limite 2n; con le monete si vede
// anche il credito accantonato sui bit uguali a 1 (accantonamenti e potenziale)

const ones = (v) => { let c = 0; for (; v; v &= v - 1) c++; return c; };

export default defineWidget({
  name: 'binary-counter',
  params: {
    bits: { type: 'integer', default: 8, min: 2, max: 12 },
    steps: { type: 'integer', default: 16, min: 1, max: 64 },
    start: { type: 'integer', default: 0, min: 0 },
    coins: { type: 'boolean', default: false },
    interval: { type: 'number', default: 1100, min: 300 },
  },

  mount(el, { bits: k, steps, start, coins: coins0, interval }) {
    el.classList.add('w-counter');
    let coins = coins0;
    const MOD = 2 ** k, v0 = start % MOD;

    // il passo i: valore, bit cambiati, costo, costo totale
    const frames = [{ v: v0, set: 0, reset: 0, c: 0, T: 0 }];
    for (let i = 1; i <= steps; i++) {
      const prev = frames[i - 1].v, v = (prev + 1) % MOD;
      const changed = prev ^ v;
      const set = changed & v, reset = changed & prev;
      frames.push({ v, set, reset, c: ones(changed), T: frames[i - 1].T + ones(changed) });
    }

    const CELL = 38, GAP = 4, W = 560;
    const X0 = (W - (k * CELL + (k - 1) * GAP)) / 2 + 20;
    const cx = (j) => X0 + (k - 1 - j) * (CELL + GAP); // A[k-1] a sinistra, A[0] a destra
    const svg = svgRoot(W, 312, { 'aria-label': `Un contatore binario a ${k} bit durante ${steps} incrementi` });

    const cells = [];
    for (let j = 0; j < k; j++) {
      svg.append(s('text', { x: cx(j) + CELL / 2, y: 14, class: 'hdr' }, `A[${j}]`));
      const g = s('g', { class: 'bit' }, [
        s('rect', { x: cx(j), y: 44, width: CELL, height: CELL, rx: 4, class: 'cellb' }),
        s('text', { x: cx(j) + CELL / 2, y: 44 + CELL / 2, class: 'digit' }),
        s('g', { class: 'coin' }, [s('circle', { cx: cx(j) + CELL / 2, cy: 32, r: 7 }), s('text', { x: cx(j) + CELL / 2, y: 32 }, '1')]),
      ]);
      svg.append(g);
      cells.push(g);
    }
    const valueText = s('text', { x: X0 - 18, y: 44 + CELL / 2, class: 'value' });
    svg.append(valueText);

    // grafico: costo di ogni incremento (barre), costo totale e limite 2i
    const CX = 50, CY = 290, CW = W - 80, CH = 160;
    const ymax = Math.max(2 * steps + (v0 ? k : 0), frames[steps].T);
    const px = (i) => CX + (i - 0.5) * (CW / steps), py = (val) => CY - (val / ymax) * CH;
    const bw = Math.max(2, (CW / steps) * 0.6);
    svg.append(
      s('line', { x1: CX, y1: CY, x2: CX + CW, y2: CY, class: 'axis' }),
      s('line', { x1: CX, y1: CY, x2: CX, y2: CY - CH - 6, class: 'axis' }),
      s('text', { x: CX - 6, y: py(ymax), class: 'tick end' }, String(ymax)),
      s('text', { x: CX - 6, y: CY, class: 'tick end' }, '0'),
      s('text', { x: CX + CW, y: CY + 14, class: 'tick end' }, `${steps} incrementi`),
    );
    const bound = (i) => 2 * i + (v0 ? k : 0);
    svg.append(s('polyline', { points: Array.from({ length: steps + 1 }, (_, i) => `${CX + i * (CW / steps)},${py(bound(i))}`).join(' '), class: 'bound' }));
    svg.append(s('text', { x: CX + CW + 4, y: py(bound(steps)), class: 'tick bound-l' }, v0 ? '2i + k' : '2i'));
    const bars = frames.slice(1).map((f, i) => {
      const r = s('rect', { x: px(i + 1) - bw / 2, y: py(f.c), width: bw, height: CY - py(f.c), class: 'bar' });
      svg.append(r);
      return r;
    });
    const totalLine = s('polyline', { class: 'total' });
    const totalDot = s('circle', { r: 3.5, class: 'total-dot' });
    const totalLabel = s('text', { class: 'tick total-l' });
    svg.append(totalLine, totalDot, totalLabel);

    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    function draw(n) {
      const f = frames[n];
      for (let j = 0; j < k; j++) {
        const b = (f.v >> j) & 1, m = 1 << j;
        const g = cells[j];
        g.querySelector('.digit').textContent = b;
        g.classList.toggle('one', b === 1);
        g.classList.toggle('set', n > 0 && (f.set & m) !== 0);
        g.classList.toggle('reset', n > 0 && (f.reset & m) !== 0);
        g.classList.toggle('with-coin', coins && b === 1);
      }
      valueText.textContent = f.v;
      bars.forEach((r, i) => { r.classList.toggle('shown', i < n); r.classList.toggle('cur', i === n - 1); });
      const pts = frames.slice(0, n + 1).map((g, i) => `${CX + i * (CW / steps)},${py(g.T)}`).join(' ');
      totalLine.setAttribute('points', pts);
      totalDot.setAttribute('cx', CX + n * (CW / steps)); totalDot.setAttribute('cy', py(f.T));
      // verso la fine del grafico l'etichetta va a sinistra del punto, per non uscire dalla figura
      const late = n > steps * 0.6;
      totalLabel.setAttribute('x', CX + n * (CW / steps) + (late ? -8 : 6)); totalLabel.setAttribute('y', py(f.T) - 8);
      totalLabel.classList.toggle('end', late);
      totalLabel.textContent = n ? `T(${n}) = ${f.T}` : '';

      const lim = v0 ? `2\\cdot${n} + ${k} = ${2 * n + k}` : `2\\cdot ${n} = ${2 * n}`;
      let tex = n ? `c_{${n}} = ${f.c},\\qquad T(${n}) = ${f.T} < ${lim}` : `\\text{valore iniziale} = ${f.v}`;
      if (coins && n) {
        const dphi = ones(f.v) - ones(frames[n - 1].v);
        tex += `,\\qquad \\Phi = ${ones(f.v)},\\quad \\hat c_{${n}} = c_{${n}} + \\Delta\\Phi = ${f.c} ${dphi < 0 ? '-' : '+'} ${Math.abs(dphi)} = ${f.c + dphi}`;
      }
      katex.render(tex, eq, { throwOnError: false });

      const list = (mask) => Array.from({ length: k }, (_, j) => j).filter((j) => mask & (1 << j)).map((j) => `A[${j}]`);
      const r = list(f.reset), st = list(f.set);
      note.textContent = !n ? 'Il contatore di partenza.'
        : `Incremento ${n}: ${r.length ? `il riporto azzera ${r.join(', ')}` : 'nessun riporto'}${st.length ? `${r.length ? ' e porta' : ', porta'} a 1 ${st[0]}` : ' e il contatore torna a 0'}${coins && r.length ? ', pagati con le loro monete' : ''}.`;
    }

    const player = createPlayer({ steps: steps + 1, onStep: draw, interval });
    const toggle = h('label', { class: 'check' }, [
      h('input', { type: 'checkbox', checked: coins || null, onchange: (e) => { coins = e.target.checked; draw(player.index); } }),
      'monete sui bit uguali a 1 (accantonamenti)',
    ]);
    el.append(h('div', { class: 'controls' }, toggle), svg, eq, note, player.el);
  },
});
