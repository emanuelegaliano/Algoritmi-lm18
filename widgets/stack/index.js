import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer } from 'texweb/client';
import { sc } from '../lib/util.js';
import './style.css';

// uno stack con Push, Pop e MultiPop e il costo reale di ogni operazione; con coins si vede anche
// il metodo degli accantonamenti: costo ammortizzato 2 per Push e 0 per le altre, e la moneta di
// credito che ogni elemento porta con sé

const CAP = 8; // elementi che stanno nella figura

function parseOp(raw) {
  const m = String(raw).trim().match(/^(push|pop|multipop)\s*(\S*)$/i);
  if (!m) return null;
  const type = m[1].toLowerCase();
  if (type === 'multipop') return Number.isInteger(Number(m[2])) && Number(m[2]) > 0 ? { type, k: Number(m[2]) } : null;
  if (type === 'push') return { type, v: m[2] || null };
  return { type };
}

export default defineWidget({
  name: 'stack',
  params: {
    items: { type: 'list', default: [] },
    ops: { type: 'list', default: [] },
    coins: { type: 'boolean', default: false },
    interval: { type: 'number', default: 1800, min: 300 },
  },

  mount(el, { items, ops: ops0, coins, interval }) {
    el.classList.add('w-stack');
    const initialOps = ops0.map(parseOp).filter(Boolean);
    let ops = initialOps;
    const numeric = items.every((v) => typeof v === 'number');

    // lo stato dopo ciascuna operazione: ogni elemento ha un identificativo, per seguirlo nella figura
    let frames;
    function compute() {
      let id = 0, next = numeric ? Math.max(0, ...items) + 1 : null;
      let stack = items.slice(0, CAP).map((v) => ({ id: id++, v }));
      let sumC = 0, pushes = 0;
      frames = [{ stack, op: null, removed: [], sumC, pushes }];
      for (const op of ops) {
        let removed = [], cost = 0, amort = 0;
        if (op.type === 'push') {
          if (stack.length >= CAP) { frames.push({ ...frames[frames.length - 1], op: { ...op, full: true }, removed: [], cost: 0, amort: 0 }); continue; }
          const v = op.v ?? (numeric ? next++ : 'x');
          stack = [...stack, { id: id++, v }];
          cost = 1; amort = 2; pushes++;
        } else {
          const k = op.type === 'pop' ? 1 : op.k;
          const kk = Math.min(stack.length, k);
          removed = stack.slice(stack.length - kk);
          stack = stack.slice(0, stack.length - kk);
          cost = kk;
        }
        sumC += cost;
        frames.push({ stack, op, removed, cost, amort, sumC, pushes, before: frames[frames.length - 1].stack.length });
      }
    }

    const W = 340, EH = 24, BOTTOM = 40 + CAP * (EH + 2), H = BOTTOM + 30;
    const SX = 70, RX = 230; // colonna dello stack e colonna degli elementi rimossi
    const svg = svgRoot(W, H, { 'aria-label': 'Uno stack con le operazioni Push, Pop e MultiPop' });
    svg.append(
      s('line', { x1: SX - 50, y1: BOTTOM + 2, x2: SX + 70, y2: BOTTOM + 2, class: 'base' }),
      s('text', { x: SX + 10, y: BOTTOM + 22, class: 'cap' }, 'stack'),
    );
    const removedLabel = s('text', { x: RX + 10, y: BOTTOM + 22, class: 'cap' });
    const top = s('text', { class: 'top-label' }, '← cima');
    const emptyLabel = s('text', { x: SX + 10, y: BOTTOM - 10, class: 'cap faint' }, 'vuoto');
    svg.append(removedLabel, top, emptyLabel);

    const els = new Map(); // id -> gruppo SVG
    const y = (i) => BOTTOM - (i + 1) * (EH + 2);
    function elem(e) {
      if (els.has(e.id)) return els.get(e.id);
      const g = s('g', { class: 'el new' }, [
        s('rect', { x: -38, y: 0, width: 76, height: EH, rx: 3, class: 'box' }),
        s('text', { x: 0, y: EH / 2, class: 'val' }, String(e.v)),
        s('g', { class: 'coin' }, [s('circle', { cx: 56, cy: EH / 2, r: 8 }), s('text', { x: 56, y: EH / 2 }, '1')]),
      ]);
      svg.append(g);
      els.set(e.id, g);
      // compare con una dissolvenza: si forza il calcolo dello stile iniziale, poi si toglie la classe
      g.getBoundingClientRect();
      g.classList.remove('new');
      return g;
    }
    const place = (g, x, yy) => { g.style.transform = `translate(${x}px, ${yy}px)`; };

    const chips = h('div', { class: 'chips' });
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    const opTex = (op) => op.type === 'push' ? `${sc('Push')}(S)` : op.type === 'pop' ? `${sc('Pop')}(S)` : `${sc('MultiPop')}(S,${op.k})`;
    const opText = (op) => op.type === 'push' ? 'Push(S)' : op.type === 'pop' ? 'Pop(S)' : `MultiPop(S, ${op.k})`;

    function draw(n) {
      const f = frames[n];
      const inStack = new Set(f.stack.map((e) => e.id));
      const out = new Map(f.removed.map((e, j) => [e.id, j]));
      for (let k = 0; k <= n; k++) for (const e of [...frames[k].stack, ...frames[k].removed]) elem(e);
      for (const [id, g] of els) {
        const i = f.stack.findIndex((e) => e.id === id);
        g.classList.toggle('gone', !inStack.has(id) && !out.has(id));
        g.classList.toggle('out', out.has(id));
        g.classList.toggle('with-coin', coins);
        if (i >= 0) place(g, SX, y(i));
        else if (out.has(id)) place(g, RX, y(out.get(id)));
        // un elemento non ancora inserito, o rimosso da un'operazione precedente, resta nascosto dov'era
        else if (!g.style.transform) place(g, SX, y(CAP));
      }
      top.setAttribute('x', SX + (coins ? 70 : 46));
      top.setAttribute('y', y(Math.max(0, f.stack.length - 1)) + EH / 2);
      top.classList.toggle('hidden', !f.stack.length);
      emptyLabel.classList.toggle('hidden', f.stack.length > 0);
      removedLabel.textContent = f.removed.length
        ? (coins ? `le ${f.removed.length} monete pagano i Pop` : `rimossi: ${f.removed.length}`) : '';

      chips.replaceChildren(...ops.map((op, j) => h('span', { class: `chip${j === n - 1 ? ' on' : ''}${j >= n ? ' later' : ''}` }, [
        h('span', { class: 'sc' }, opText(op)), h('small', {}, j < n ? `costo ${frames[j + 1].cost}` : ''),
      ])));

      const S0 = items.length;
      let tex;
      if (!f.op) tex = coins ? `\\text{credito} = |S| = ${S0}` : `|S| = ${S0}`;
      else {
        const cost = f.op.type === 'multipop' ? `\\min(|S|,k) = \\min(${f.before},${f.op.k}) = ${f.cost}` : `${f.cost}`;
        tex = coins
          ? `c_i = ${cost},\\quad \\hat c_i = ${f.amort},\\qquad \\text{credito} = |S| = ${f.stack.length}`
          : `${opTex(f.op)}:\\; c_i = ${cost},\\qquad \\textstyle\\sum c_i = ${f.sumC},\\quad |S| = ${f.stack.length}`;
      }
      katex.render(tex, eq, { throwOnError: false });
      note.textContent = !f.op
        ? (coins ? `Lo stack di partenza: ogni elemento porta con sé la moneta accantonata dal suo Push.` : 'Lo stack di partenza.')
        : f.op.full ? 'La figura non ha posto per altri elementi.'
        : f.op.type === 'push' ? (coins ? `Push costa 1, ma ne addebitiamo 2: l'unità in più resta sull'elemento come credito.` : 'Push inserisce un elemento in cima e costa 1.')
        : f.cost === 0 ? 'Lo stack è vuoto: l\'operazione non rimuove niente e costa 0.'
        : `${opText(f.op)} rimuove ${f.cost} element${f.cost === 1 ? 'o' : 'i'} e costa ${f.cost}${f.op.type === 'multipop' && f.op.k > f.cost ? `, non ${f.op.k}` : ''}: ${coins ? 'lo pagano le monete degli elementi rimossi, e il costo ammortizzato è 0' : 'non si può togliere più di quanto è stato inserito'}.`;
    }

    compute();
    const player = createPlayer({ steps: frames.length, onStep: draw, interval, autoplay: ops.length > 0 });

    function act(op) {
      ops = [...ops, op];
      compute();
      player.pause();
      player.setSteps(frames.length, { keep: true });
      player.go(frames.length - 1);
    }

    const kVal = h('output', { class: 'sl-val' }, '3');
    const kIn = h('input', { type: 'range', min: 1, max: 8, step: 1, value: 3, 'aria-label': 'k',
      oninput: (e) => { kVal.textContent = e.target.value; } });
    const btn = (text, onclick, cls = '') => h('button', { type: 'button', class: `seg-btn ${cls}`, onclick }, text);
    const controls = h('div', { class: 'controls' }, [
      h('div', { class: 'seg' }, [
        btn('Push', () => act({ type: 'push', v: null }), 'sc'),
        btn('Pop', () => act({ type: 'pop' }), 'sc'),
        btn('MultiPop', () => act({ type: 'multipop', k: Number(kIn.value) }), 'sc'),
      ]),
      h('label', { class: 'kpick' }, [h('span', { class: 'sl-name' }, 'k'), kIn, kVal]),
      h('div', { class: 'seg' }, btn('↺ Ripristina', () => { ops = initialOps; compute(); player.pause(); player.setSteps(frames.length); })),
    ]);

    el.append(controls, svg, chips, eq, note, player.el);
  },
});
