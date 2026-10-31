import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer } from 'texweb/client';
import { sc } from '../lib/util.js';
import './style.css';

// inserimenti e cancellazioni in una tabella dinamica che raddoppia quando è piena e si dimezza
// quando il fattore di carico scende sotto 1/4 (oppure sotto 1/2, la strategia che non funziona):
// lo stato della tabella, il punto (α, Φ/size) sul grafico del potenziale e il costo di ogni operazione

const MAXNUM = 32; // la tabella più grande che sta nella figura ha dimensione 32

const phiOf = (num, size) => (size === 0 ? 0 : num / size >= 0.5 ? 2 * num - size : size / 2 - num);

function simulate(ops, policy) {
  const lim = policy === 'half' ? 0.5 : 0.25;
  const frames = [{ num: 0, size: 0, c: 0, sum: 0, op: null }];
  for (const op of ops) {
    const p = frames[frames.length - 1];
    let { num, size } = p, c = 0, event = null;
    if (op === 'I') {
      if (num >= MAXNUM && num === size) { frames.push({ ...p, op, c: 0, skipped: true }); continue; }
      if (size === 0) { size = 1; event = 'alloc'; }
      else if (num === size) { size *= 2; event = 'expand'; }
      c = event === 'expand' ? num + 1 : 1;
      num++;
    } else {
      if (num === 0) { frames.push({ ...p, op, c: 0, skipped: true }); continue; }
      c = 1;
      num--;
      if (num === 0) { size = 0; event = 'free'; }
      else if (num / size < lim) { size /= 2; event = 'contract'; c = num + 1; }
    }
    frames.push({ num, size, c, op, event, before: p, sum: p.sum + c });
  }
  return frames;
}

export default defineWidget({
  name: 'table-potential',
  params: {
    ops: { type: 'string', default: 'IIIIIIIIICCCCCCII' },
    policy: { type: 'enum', values: ['quarter', 'half'], default: 'quarter' },
    interval: { type: 'number', default: 1300, min: 300 },
  },

  mount(el, { ops: ops0, policy: policy0, interval }) {
    el.classList.add('w-tpot');
    const initialOps = ops0.toUpperCase().replace(/[^IC]/g, '').split('');
    let ops = initialOps, policy = policy0, frames;

    const W = 600, H = 330;
    const svg = svgRoot(W, H, { 'aria-label': 'Una tabella dinamica con inserimenti e cancellazioni, e il suo potenziale' });

    // la tabella
    const CELL = (W - 40) / MAXNUM, TY = 22;
    const cells = Array.from({ length: MAXNUM }, (_, j) => {
      const r = s('rect', { x: 20 + j * CELL, y: TY, width: CELL, height: 22, class: 'cellt' });
      svg.append(r);
      return r;
    });
    const tLabel = s('text', { x: W / 2, y: TY + 40, class: 'cap' });
    svg.append(tLabel);

    // il grafico di Φ/size in funzione di α (la figura del PDF), con il punto dello stato attuale
    const PX = 46, PY = 300, PW = 250, PH = 200;
    const px = (a) => PX + a * PW, py = (v) => PY - v * PH;
    svg.append(
      s('rect', { x: px(0.25), y: py(1.1), width: px(0.5) - px(0.25), height: py(0) - py(1.1), class: 'zone-c' }),
      s('rect', { x: px(0.5), y: py(1.1), width: px(1) - px(0.5), height: py(0) - py(1.1), class: 'zone-e' }),
      s('line', { x1: px(0), y1: py(0), x2: px(1.05), y2: py(0), class: 'axis' }),
      s('line', { x1: px(0), y1: py(0), x2: px(0), y2: py(1.12), class: 'axis' }),
      s('line', { x1: px(0), y1: py(0), x2: px(1.04), y2: py(1.04), class: 'ref' }),
      s('text', { x: px(0.84), y: py(0.94), class: 'tick ref-l' }, 'Φ = num'),
      s('polyline', { points: `${px(0.25)},${py(0.25)} ${px(0.5)},${py(0)} ${px(1)},${py(1)}`, class: 'vcurve' }),
      s('text', { x: px(1.07), y: py(0), class: 'tick' }, 'α'),
      s('text', { x: px(0), y: py(1.17), class: 'tick mid' }, 'Φ / size'),
      ...[[0.25, '1/4'], [0.5, '1/2'], [1, '1']].map(([a, t]) => s('text', { x: px(a), y: py(0) + 14, class: 'tick mid' }, t)),
      s('text', { x: px(0) - 6, y: py(1), class: 'tick end' }, '1'),
    );
    const trail = s('polyline', { class: 'trail' });
    const dot = s('circle', { r: 6, class: 'dot' });
    svg.append(trail, dot);

    // il costo di ogni operazione, in barre
    const BX = 340, BY = 300, BW = 240, BH = 200;
    svg.append(
      s('line', { x1: BX, y1: BY, x2: BX + BW, y2: BY, class: 'axis' }),
      s('text', { x: BX, y: BY - BH - 8, class: 'tick' }, 'costo reale di ogni operazione'),
    );
    const barsG = s('g');
    svg.append(barsG);

    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    function compute() {
      frames = simulate(ops, policy);
      barsG.replaceChildren();
      const cmax = Math.max(4, ...frames.map((f) => f.c));
      const bw = BW / Math.max(16, ops.length);
      frames.slice(1).forEach((f, i) => {
        const hgt = (f.c / cmax) * BH;
        barsG.append(s('rect', { x: BX + i * bw + bw * 0.15, y: BY - hgt, width: bw * 0.7, height: hgt, class: `bar ${f.op === 'I' ? 'ins' : 'del'}` }));
      });
    }

    function draw(n) {
      const f = frames[n];
      cells.forEach((r, j) => r.setAttribute('class', `cellt${j < f.size ? ' alloc' : ''}${j < f.num ? ' full' : ''}`));
      const alpha = f.size ? f.num / f.size : 1;
      const phi = phiOf(f.num, f.size);
      tLabel.textContent = f.size ? `num = ${f.num},  size = ${f.size},  α = ${f.num}/${f.size}` : 'tabella vuota';
      const pts = frames.slice(Math.max(0, n - 6), n + 1).filter((g) => g.size).map((g) => `${px(g.num / g.size)},${py(phiOf(g.num, g.size) / g.size)}`);
      trail.setAttribute('points', pts.join(' '));
      dot.setAttribute('cx', px(f.size ? alpha : 0)); dot.setAttribute('cy', py(f.size ? phi / f.size : 0));
      barsG.childNodes.forEach((b, i) => { b.classList.toggle('later', i >= n); b.classList.toggle('cur', i === n - 1); });

      const len = n; // operazioni eseguite
      let tex = `\\Phi = ${phi}`;
      if (f.op && !f.skipped) {
        const p = f.before, phiB = phiOf(p.num, p.size), amort = f.c + phi - phiB;
        tex = `${sc(f.op === 'I' ? 'Table-Insert' : 'Table-Delete')}:\\; c_i = ${f.c},\\quad \\hat c_i = c_i + \\Delta\\Phi = ${f.c} ${phi - phiB < 0 ? '-' : '+'} ${Math.abs(phi - phiB)} = ${amort}`;
      }
      if (len) tex += `,\\qquad \\textstyle\\sum c_i = ${f.sum} ${f.sum <= 3 * len ? '\\le' : '>'} 3n = ${3 * len}`;
      eq.classList.toggle('bad', f.sum > 3 * len);
      katex.render(tex, eq, { throwOnError: false });

      const lim = policy === 'half' ? '1/2' : '1/4';
      note.textContent = !f.op ? 'La tabella è vuota e il potenziale è 0.'
        : f.skipped ? (f.op === 'I' ? 'La figura non ha posto per una tabella più grande.' : 'La tabella è vuota: non c\'è niente da cancellare.')
        : f.event === 'expand' ? `Tabella piena: espansione a dimensione ${f.size} con ${f.c - 1} copie, pagate dal potenziale che era arrivato a ${phiOf(f.before.num, f.before.size)}.`
        : f.event === 'contract' ? (policy === 'half'
          ? `α è sceso sotto 1/2: contrazione a dimensione ${f.size} con ${f.c - 1} copie. Il potenziale era quasi nullo e non può pagarle: il costo ammortizzato è alto.`
          : `α sarebbe sceso sotto 1/4: contrazione a dimensione ${f.size} con ${f.c - 1} copie, pagate dal potenziale accumulato.`)
        : f.event === 'free' ? 'La tabella si è svuotata e viene deallocata.'
        : f.event === 'alloc' ? 'Primo inserimento: si alloca una tabella di dimensione 1.'
        : alpha >= 0.5 ? `Nessuna riallocazione. Con α ≥ 1/2 il potenziale è 2·num − size: ${f.op === 'I' ? 'un inserimento lo fa crescere' : 'una cancellazione lo fa scendere'}.`
        : `Nessuna riallocazione. Con α < 1/2 il potenziale è size/2 − num: ${f.op === 'I' ? 'un inserimento lo fa scendere' : 'una cancellazione lo fa crescere'}, verso la contrazione sotto ${lim}.`;
    }

    compute();
    const player = createPlayer({ steps: frames.length, onStep: draw, interval });

    function act(op) {
      ops = [...ops, op];
      compute();
      player.pause();
      player.setSteps(frames.length, { keep: true });
      player.go(frames.length - 1);
    }
    const restart = () => { compute(); player.setSteps(frames.length); player.play(); };

    const btn = (text, onclick, cls = '') => h('button', { type: 'button', class: `seg-btn ${cls}`, onclick }, text);
    const pol = [['quarter', 'contrae sotto 1/4'], ['half', 'contrae sotto 1/2']].map(([v, text]) =>
      btn(text, () => { policy = v; pol.forEach((b, i) => b.classList.toggle('on', i === (v === 'quarter' ? 0 : 1))); restart(); }, v === policy ? 'on' : ''));
    // la sequenza del testo: n/2 inserimenti, poi I, C, C, I, I, C, C, I, ...
    const critical = () => { ops = [...'I'.repeat(16), ...'ICCIICCIICCIICCI']; restart(); };

    el.append(
      h('div', { class: 'controls' }, [
        h('div', { class: 'seg' }, [btn('Table-Insert', () => act('I'), 'sc'), btn('Table-Delete', () => act('C'), 'sc')]),
        h('div', { class: 'seg' }, pol),
        h('div', { class: 'seg' }, [
          btn('Sequenza I, C, C, I', critical),
          btn('↺ Ripristina', () => { ops = initialOps; compute(); player.pause(); player.setSteps(frames.length); }),
        ]),
      ]),
      svg, eq, note, player.el,
    );
  },
});
