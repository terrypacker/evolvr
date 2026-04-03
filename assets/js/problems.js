/* =============================================================
   PROBLEMS.JS  —  Optimization Problem Definitions
   ─────────────────────────────────────────────────────────────
   Each problem must export an object conforming to ProblemDef:
   {
     id:          string           unique identifier
     label:       string           display name
     description: string           short description
     goalLabel:   string           what the goal value means
     params:      object           passed to gene.fn and evaluate
     goals: [                      selectable target values
       { label, value }
     ],
     evaluate(genome, expressed, organism) → number [0, 1]
                                  1 = perfect fitness
     visualize(canvas, population, goal)
                                  draw to a canvas element
   }

   TO ADD A NEW PROBLEM: just push a new object into this array.
   The UI will pick it up automatically.
   ============================================================= */

import { OrganismTypes } from './engine.js';

/* ── SHARED DRAW HELPERS ─────────────────────────────────────── */
function clearCanvas(canvas, ctx) {
  ctx.fillStyle = '#080b10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function typeColor(typeId) {
  const colors = {
    explorer:   '#f0a500',
    climber:    '#00d4e8',
    optimizer:  '#39e080',
    mutant:     '#a080ff',
    default:    '#6a7590'
  };
  return colors[typeId] ?? colors.default;
}

/* ── PROBLEM 1: PEAK FINDER ──────────────────────────────────── */
const PeakFinder = {
  id: 'peakFinder',
  label: 'Peak Finder',
  description: 'Find the global maximum of a rugged multi-modal landscape. Genomes encode X,Y coordinates in the search space.',
  goalLabel: 'Target peak height (0–1)',
  params: { peaks: null },  // generated on first use

  _generatePeaks(seed = 42) {
    const peaks = [];
    let rng = seed;
    const rand = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0xffffffff; };
    for (let i = 0; i < 7; i++) {
      peaks.push({ x: rand(), y: rand(), h: 0.3 + rand() * 0.7, w: 0.05 + rand() * 0.15 });
    }
    return peaks;
  },

  _heightAt(x, y, peaks) {
    let h = 0;
    for (const p of peaks) {
      const dx = x - p.x, dy = y - p.y;
      h += p.h * Math.exp(-(dx*dx + dy*dy) / (2 * p.w * p.w));
    }
    return Math.min(1, h);
  },

  goals: [
    { label: '≥ 0.60', value: 0.60 },
    { label: '≥ 0.75', value: 0.75 },
    { label: '≥ 0.90', value: 0.90 },
    { label: '≥ 0.95', value: 0.95 },
  ],

  evaluate(genome, expressed, organism) {
    if (!this.params.peaks) this.params.peaks = this._generatePeaks();
    const x = expressed[0] ?? genome[0];
    const y = expressed[1] ?? genome[1];
    return this._heightAt(x, y, this.params.peaks);
  },

  visualize(canvas, population, goal) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    clearCanvas(canvas, ctx);

    if (!this.params.peaks) this.params.peaks = this._generatePeaks();
    const peaks = this.params.peaks;

    // Draw landscape heatmap
    const step = 4;
    for (let px = 0; px < W; px += step) {
      for (let py = 0; py < H; py += step) {
        const h = this._heightAt(px / W, py / H, peaks);
        const v = Math.floor(h * 255);
        ctx.fillStyle = `rgb(${Math.floor(v * 0.6)},${Math.floor(v * 0.4)},${Math.floor(v * 0.1)})`;
        ctx.fillRect(px, py, step, step);
      }
    }

    // Draw goal contour
    ctx.strokeStyle = 'rgba(240,165,0,0.4)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([2, 4]);
    // simple horizontal target line overlay
    ctx.beginPath();
    ctx.strokeStyle = `rgba(240,165,0,${goal ? 0.7 : 0})`;
    ctx.setLineDash([4, 4]);

    // Draw organisms
    if (population?.organisms) {
      for (const org of population.organisms) {
        if (!org.alive) continue;
        const ex = org.express({});
        const ox = (ex[0] ?? org.genome[0]) * W;
        const oy = (ex[1] ?? org.genome[1]) * H;
        const r  = 3 + (org.fitness * 4);
        const col = typeColor(org.type);

        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.fillStyle = col + '99';
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();

        // Best organism gets a crown
        if (org === population.bestOrganism) {
          ctx.beginPath();
          ctx.arc(ox, oy, r + 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#f0a500';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  }
};

/* ── PROBLEM 2: FUNCTION APPROXIMATION ─────────────────────── */
const FunctionApprox = {
  id: 'funcApprox',
  label: 'Function Approximation',
  description: 'Evolve a polynomial whose genome encodes coefficients. Fitness is how closely it matches a target function over [0,1].',
  goalLabel: 'Max MSE error (lower = harder)',
  params: { samples: 20 },

  _targetFn: (x) => Math.sin(x * Math.PI * 2) * 0.5 + 0.5,

  _evalPoly(genome, x) {
    // genome = [a0, a1, a2, ...] → Σ aᵢ * xⁱ
    let val = 0;
    for (let i = 0; i < genome.length; i++) {
      val += genome[i] * Math.pow(x, i);
    }
    return Math.max(0, Math.min(1, val));
  },

  goals: [
    { label: 'MSE < 0.05', value: 0.05 },
    { label: 'MSE < 0.02', value: 0.02 },
    { label: 'MSE < 0.01', value: 0.01 },
    { label: 'MSE < 0.005', value: 0.005 },
  ],

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
  },

  visualize(canvas, population, goal) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    clearCanvas(canvas, ctx);

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
        const col = typeColor(org.type);
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

    // Labels
    ctx.fillStyle   = '#3a4258';
    ctx.font        = '9px monospace';
    ctx.fillText('TARGET (amber) vs POPULATION CURVES', pad, pad - 6);
  }
};

/* ── PROBLEM 3: BINARY KNAPSACK ─────────────────────────────── */
const Knapsack = {
  id: 'knapsack',
  label: 'Binary Knapsack',
  description: 'Genome bits select items to pack. Maximise value while staying within weight capacity.',
  goalLabel: 'Target value ratio (0–1)',
  params: { items: null, capacity: 0.5 },

  _generateItems(n = 12, seed = 99) {
    let rng = seed;
    const rand = () => { rng = (rng * 22695477 + 1) & 0x7fffffff; return rng / 0x7fffffff; };
    return Array.from({ length: n }, (_, i) => ({
      id: i, label: `Item${i}`,
      weight: 0.05 + rand() * 0.25,
      value:  0.02 + rand() * 0.30
    }));
  },

  goals: [
    { label: '≥ 0.40', value: 0.40 },
    { label: '≥ 0.60', value: 0.60 },
    { label: '≥ 0.75', value: 0.75 },
    { label: '≥ 0.85', value: 0.85 },
  ],

  evaluate(genome, expressed, organism) {
    if (!this.params.items) this.params.items = this._generateItems();
    const items    = this.params.items;
    const capacity = this.params.capacity;

    let totalW = 0, totalV = 0;
    const maxV = items.reduce((s, it) => s + it.value, 0);

    for (let i = 0; i < items.length; i++) {
      if ((expressed[i] ?? genome[i] ?? 0) > 0.5) {
        totalW += items[i].weight;
        totalV += items[i].value;
      }
    }

    if (totalW > capacity) return Math.max(0, 1 - (totalW - capacity) * 2);
    return totalV / maxV;
  },

  visualize(canvas, population, goal) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    clearCanvas(canvas, ctx);

    if (!this.params.items) this.params.items = this._generateItems();
    const items    = this.params.items;
    const capacity = this.params.capacity;
    const n        = items.length;
    const barW     = (W - 30) / n;
    const pad      = 15;

    // Draw item bars (weight and value)
    for (let i = 0; i < n; i++) {
      const x  = pad + i * barW;
      const wh = items[i].weight * (H - pad * 2 - 10);
      const vh = items[i].value  * (H - pad * 2 - 10);

      ctx.fillStyle = '#1a2030';
      ctx.fillRect(x + 2, pad, barW - 4, H - pad * 2 - 10);

      ctx.fillStyle = '#2e3a5090';
      ctx.fillRect(x + 2, H - pad - 10 - wh, barW - 4, wh);

      ctx.fillStyle = '#f0a50060';
      ctx.fillRect(x + 2 + (barW - 6) / 2, H - pad - 10 - vh, (barW - 6) / 2, vh);
    }

    // Overlay selections from best organism
    if (population?.bestOrganism) {
      const org = population.bestOrganism;
      const ex  = org.express({});
      for (let i = 0; i < n; i++) {
        if ((ex[i] ?? org.genome[i]) > 0.5) {
          const x = pad + i * barW;
          ctx.strokeStyle = '#00d4e8';
          ctx.lineWidth   = 2;
          ctx.strokeRect(x + 2, pad, barW - 4, H - pad * 2 - 10);
        }
      }
    }

    // Capacity line
    const capY = H - pad - 10 - capacity * (H - pad * 2 - 10);
    ctx.beginPath();
    ctx.strokeStyle = '#ff445580';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.moveTo(pad, capY);
    ctx.lineTo(W - pad, capY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
};

/* ── PROBLEM 4: TRAVELING SALESMAN (TSP) ────────────────────── */
const TSP = {
  id: 'tsp',
  label: 'Traveling Salesman',
  description: 'Genome encodes a city-visit order. Minimise total tour distance through all cities.',
  goalLabel: 'Max tour length (lower = better)',
  params: { cities: null },

  _generateCities(n = 10, seed = 7) {
    let rng = seed;
    const rand = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
    return Array.from({ length: n }, (_, i) => ({ id: i, x: rand(), y: rand() }));
  },

  _tourLength(order, cities) {
    let dist = 0;
    for (let i = 0; i < order.length; i++) {
      const a = cities[order[i] % cities.length];
      const b = cities[order[(i + 1) % order.length] % cities.length];
      dist += Math.hypot(a.x - b.x, a.y - b.y);
    }
    return dist;
  },

  goals: [
    { label: 'Tour < 3.5', value: 3.5 },
    { label: 'Tour < 3.0', value: 3.0 },
    { label: 'Tour < 2.5', value: 2.5 },
    { label: 'Tour < 2.0', value: 2.0 },
  ],

  evaluate(genome, expressed, organism) {
    if (!this.params.cities) this.params.cities = this._generateCities();
    const n = this.params.cities.length;
    // Decode genome into tour order by ranking
    const indexed = expressed.slice(0, n).map((v, i) => [v, i]);
    indexed.sort((a, b) => a[0] - b[0]);
    const order = indexed.map(([, i]) => i);
    const dist  = this._tourLength(order, this.params.cities);
    organism._tourLen = dist;
    return Math.max(0, 1 - dist / 5);
  },

  visualize(canvas, population, goal) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    clearCanvas(canvas, ctx);

    if (!this.params.cities) this.params.cities = this._generateCities();
    const cities = this.params.cities;
    const pad    = 20;

    const cx = (c) => pad + c.x * (W - pad * 2);
    const cy = (c) => pad + c.y * (H - pad * 2);

    // Draw all organisms' tours faintly
    if (population?.organisms) {
      for (const org of population.organisms) {
        if (org === population.bestOrganism) continue;
        const ex = org.express({});
        const n  = cities.length;
        const indexed = ex.slice(0, n).map((v, i) => [v, i]);
        indexed.sort((a, b) => a[0] - b[0]);
        const order = indexed.map(([, i]) => i);

        ctx.beginPath();
        ctx.strokeStyle = typeColor(org.type) + '22';
        ctx.lineWidth   = 1;
        for (let i = 0; i <= order.length; i++) {
          const c = cities[order[i % order.length]];
          i === 0 ? ctx.moveTo(cx(c), cy(c)) : ctx.lineTo(cx(c), cy(c));
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Best tour highlighted
    if (population?.bestOrganism) {
      const org = population.bestOrganism;
      const ex  = org.express({});
      const n   = cities.length;
      const indexed = ex.slice(0, n).map((v, i) => [v, i]);
      indexed.sort((a, b) => a[0] - b[0]);
      const order = indexed.map(([, i]) => i);

      ctx.beginPath();
      ctx.strokeStyle = '#f0a500';
      ctx.lineWidth   = 2;
      for (let i = 0; i <= order.length; i++) {
        const c = cities[order[i % order.length]];
        i === 0 ? ctx.moveTo(cx(c), cy(c)) : ctx.lineTo(cx(c), cy(c));
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Cities
    for (const c of cities) {
      ctx.beginPath();
      ctx.arc(cx(c), cy(c), 5, 0, Math.PI * 2);
      ctx.fillStyle   = '#00d4e8';
      ctx.fill();
      ctx.strokeStyle = '#080b10';
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.fillStyle = '#6a7590';
      ctx.font      = '8px monospace';
      ctx.fillText(c.id, cx(c) + 7, cy(c) + 3);
    }
  }
};

/* ── EXPORT ALL PROBLEMS ─────────────────────────────────────── */
export const Problems = [PeakFinder, FunctionApprox, Knapsack, TSP];

/* ── GENE REGISTRATION ───────────────────────────────────────── */
/*
   Genes are registered here so they live alongside the problems
   they support. Import this module after engine.js.

   TO ADD GENES: call GeneRegistry.register(...) below.
*/
import { GeneRegistry } from './engine.js';

/* Explorer genes — good for spatial search */
GeneRegistry.register('boundaryPush', ['explorer', 'mutant'], (genome, params) => {
  return genome.map(v => v < 0.1 ? v + 0.05 : v > 0.9 ? v - 0.05 : v);
});

GeneRegistry.register('randomWalk', ['explorer', 'mutant'], (genome, params) => {
  const out = genome.slice();
  const idx = Math.floor(Math.random() * out.length);
  out[idx]  = Math.max(0, Math.min(1, out[idx] + (Math.random() - 0.5) * 0.1));
  return out;
});

GeneRegistry.register('mirrorFold', ['explorer'], (genome, params) => {
  const half = Math.floor(genome.length / 2);
  const out  = genome.slice();
  for (let i = 0; i < half; i++) out[i + half] = 1 - out[i];
  return out;
});

/* Climber genes — local hill climbing */
GeneRegistry.register('gradientNudge', ['climber', 'optimizer'], (genome, params) => {
  // Nudge all values slightly toward their nearest midpoint
  return genome.map(v => v + (0.5 - v) * 0.02);
});

GeneRegistry.register('elitePull', ['climber'], (genome, params) => {
  // Scale genome toward center with slight shrink
  return genome.map(v => v * 0.98 + 0.01);
});

/* Optimizer genes — mathematical transforms */
GeneRegistry.register('sinTransform', ['optimizer', 'climber'], (genome, params) => {
  return genome.map(v => (Math.sin(v * Math.PI) + 1) / 2);
});

GeneRegistry.register('normalize', ['optimizer', 'mutant'], (genome, params) => {
  const max = Math.max(...genome, 1e-9);
  return genome.map(v => v / max);
});

GeneRegistry.register('rankSort', ['optimizer'], (genome, params) => {
  const indexed = genome.map((v, i) => [v, i]);
  indexed.sort((a, b) => a[0] - b[0]);
  const out = new Array(genome.length);
  indexed.forEach(([, i], rank) => { out[i] = rank / (genome.length - 1 || 1); });
  return out;
});

/* Mutant genes — high entropy */
GeneRegistry.register('bitFlip', ['mutant'], (genome, params) => {
  return genome.map(v => Math.random() < 0.05 ? Math.random() : v);
});

GeneRegistry.register('gaussianNoise', ['mutant', 'explorer'], (genome, params) => {
  return genome.map(v => {
    const u = Math.random(), u2 = Math.random();
    const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.min(1, v + n * 0.05));
  });
});
