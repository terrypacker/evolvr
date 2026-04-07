import { Problem } from './problems.js';

/* ── PROBLEM: FUNCTION APPROXIMATION ─────────────────────── */
class FunctionApproximation extends Problem {
  constructor(config = {}) {
    super(config);
    this._targetFn = (x) => {
      return Math.sin(x * Math.PI * 2) * 0.5 + 0.5;
    };
  }

  _evalPoly(genome, x) {
    // genome = [a0, a1, a2, ...] → Σ aᵢ * xⁱ
    let val = 0;
    for (let i = 0; i < genome.length; i++) {
      val += genome[i] * Math.pow(x, i);
    }
    return Math.max(0, Math.min(1, val));
  }

  regenerate(args) {
    this._targetFn = new Function("x", args[0]);
  }

  evaluate(genome, expressed, organism) {
    const n   = this.params.samples;
    let mse = 0;
    for (let i = 0; i < n; i++) {
      const x    = i / (n - 1);
      const pred = this._evalPoly(expressed, x);
      const tgt  = this._targetFn(x);
      mse += (pred - tgt) ** 2;
    }
    mse /= n;
    return Math.max(0, 1 - mse * 20);
  }

  visualize(canvas, population, goal) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    this.clearCanvas(canvas, ctx);

    const pad = 20;
    const iW  = W - pad * 2;
    const iH  = H - pad * 2;

    const toX = (x) => pad + x * iW;
    const toY = (y) => pad + (1 - y) * iH;

    // Grid lines
    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= 4; i++) {
      const yv = i / 4;
      ctx.beginPath();
      ctx.moveTo(pad, toY(yv));
      ctx.lineTo(pad + iW, toY(yv));
      ctx.stroke();
    }

    // Target function
    ctx.beginPath();
    ctx.strokeStyle = '#f0a50060';
    ctx.lineWidth   = 2;
    for (let px = 0; px <= iW; px++) {
      const x   = px / iW;
      const y   = this._targetFn(x);
      px === 0 ? ctx.moveTo(toX(x), toY(y)) : ctx.lineTo(toX(x), toY(y));
    }
    ctx.stroke();

    // Draw each organism's curve
    if (population?.organisms) {
      const sorted = [...population.organisms].sort((a, b) => a.fitness - b.fitness);
      for (const org of sorted) {
        const ex  = org.express({});
        const col = this.typeColor(org.type);
        const alpha = 0.15 + org.fitness * 0.5;
        ctx.beginPath();
        ctx.strokeStyle = col + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = org === population.bestOrganism ? 2.5 : 1;
        for (let px = 0; px <= iW; px++) {
          const x   = px / iW;
          const y   = this._evalPoly(ex, x);
          px === 0 ? ctx.moveTo(toX(x), toY(y)) : ctx.lineTo(toX(x), toY(y));
        }
        ctx.stroke();
      }
    }

    this.drawColoredText(ctx, [
      { text: 'TARGET', color: '#f0a50060' },
      { text: ' vs POPULATION', color: '#929db9' }
    ], pad, H - (pad/2));
  }

}
export const FA =  new FunctionApproximation({
  id: 'funcApprox',
  label: 'Function Approximation',
  description: 'Evolve a polynomial whose genome encodes coefficients. Fitness is how closely it matches a target function over [0,1].',
  goalLabel: 'Max MSE error (lower = harder)',
  goalDesc: '',
  params: { samples: 20 },
  goals: [
    { label: 'MSE < 0.05', value: 0.05 },
    { label: 'MSE < 0.02', value: 0.02 },
    { label: 'MSE < 0.01', value: 0.01 },
    { label: 'MSE < 0.005', value: 0.005 },
  ],
  settings: [
    {
      id: 'targetFn',
      label: 'Target function',
      description: 'The function to evaluate the solutions against, this must return a y value for each x supplied.',
      value: 'return Math.sin(x * Math.PI * 2) * 0.5 + 0.5'
    }
  ]
});
