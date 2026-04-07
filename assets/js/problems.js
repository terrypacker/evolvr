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

export class Problem {
  constructor(config = {}) {
    this.id             = config.id             ?? 'default-problem';
    this.label          = config.label          ?? '';
    this.description    = config.description    ?? '';
    this.goalLabel      = config.goalLabel      ?? '';
    this.params         = config.params         ?? {};
    this.goals          = config.goals         ?? {};
    this.settings       = config.settings       ?? {};
  }

  regenerate(args) {
    throw new Error('Not implemented for problem ' + this.label);
  };
  evaluate(genome, expressed, organism) {
    throw new Error('Not implemented for problem ' + this.label);
  };
  visualize(canvas, population, goal) {
    throw new Error('Not implemented for problem ' + this.label);
  };

  /* ── SHARED DRAW HELPERS ─────────────────────────────────────── */
  clearCanvas(canvas, ctx) {
    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  typeColor(typeId) {
    // Use the live registry so custom types get their configured colour.
    return OrganismTypes.get(typeId)?.color ?? '#6a7590';
  }

  drawColoredText(ctx, segments, x, y) {
    segments.forEach(seg => {
      ctx.fillStyle = seg.color;
      ctx.fillText(seg.text, x, y);
      x += ctx.measureText(seg.text).width;
    });
  }
}

/* ── EXPORT ALL PROBLEMS ─────────────────────────────────────── */
export const Problems = [];

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
}, 'Nudges values near the boundaries of [0,1] back toward the interior. Values below 0.1 are pushed up; values above 0.9 are pushed down. Prevents genomes from getting permanently stuck at extreme values where small mutations have less effect.');

GeneRegistry.register('randomWalk', ['explorer', 'mutant'], (genome, params) => {
  const out = genome.slice();
  const idx = Math.floor(Math.random() * out.length);
  out[idx]  = Math.max(0, Math.min(1, out[idx] + (Math.random() - 0.5) * 0.1));
  return out;
}, 'Randomly selects one genome position and shifts it by a uniform random amount in [-0.05, +0.05]. All other positions are unchanged. Creates local exploration around the current solution — like a single step of a random walk in one dimension of the search space.');

GeneRegistry.register('mirrorFold', ['explorer'], (genome, params) => {
  const half = Math.floor(genome.length / 2);
  const out  = genome.slice();
  for (let i = 0; i < half; i++) out[i + half] = 1 - out[i];
  return out;
}, 'Copies the first half of the genome into the second half, inverted: out[i + half] = 1 - genome[i]. Forces a structural symmetry — if genome[0] = 0.3, then genome[half] = 0.7. Useful when problems benefit from complementary value pairs, but harmful for problems like TSP where all positions need independent values.');

/* Climber genes — local hill climbing */
GeneRegistry.register('gradientNudge', ['climber', 'optimizer'], (genome, params) => {
  return genome.map(v => v + (0.5 - v) * 0.02);
}, 'Pulls every genome value 2% of the way toward the midpoint 0.5. Equivalent to applying the recurrence v_new = 0.98·v + 0.01, which converges to 0.5 over many generations. Reduces variance across the genome and stabilises it near the centre of [0,1] — helpful when problems are sensitive to extreme values.');

GeneRegistry.register('elitePull', ['climber'], (genome, params) => {
  return genome.map(v => v * 0.98 + 0.01);
}, 'Applies a linear contraction: v_new = 0.98·v + 0.01. This maps [0,1] to [0.01, 0.99], gently compressing the genome away from the extremes. Across many generations it converges all values to 0.5. More conservative than gradientNudge — the shift per step is smaller for values already near the centre.');

/* Optimizer genes — mathematical transforms */
GeneRegistry.register('sinTransform', ['optimizer', 'climber'], (genome, params) => {
  return genome.map(v => (Math.sin(v * Math.PI) + 1) / 2);
}, 'Applies a sine-based remapping: out = (sin(v·π) + 1) / 2. This is a smooth, non-linear compression that maps [0,1]→[0.5,1]→[0.5] — values near 0 and 1 are pushed toward 0.5, while the midpoint 0.5 maps to 1.0. Creates a bias toward mid-range expressed values. Useful when the fitness landscape rewards moderate, non-extreme values.');

GeneRegistry.register('normalize', ['optimizer', 'mutant'], (genome, params) => {
  const max = Math.max(...genome, 1e-9);
  return genome.map(v => v / max);
}, 'Divides every value by the maximum value in the genome, scaling the vector so its largest component becomes 1.0. Preserves relative proportions between values while stretching the range to fill [0,1]. Particularly useful for TSP and ordering problems where relative magnitude matters more than absolute values.');

GeneRegistry.register('rankSort', ['optimizer'], (genome, params) => {
  const indexed = genome.map((v, i) => [v, i]);
  indexed.sort((a, b) => a[0] - b[0]);
  const out = new Array(genome.length);
  indexed.forEach(([, i], rank) => { out[i] = rank / (genome.length - 1 || 1); });
  return out;
}, 'Replaces each value with its fractional rank within the genome: the smallest value becomes 0, the largest becomes 1, and intermediate values are evenly spaced. Destroys absolute magnitude information but perfectly preserves ordinal relationships. Essential for TSP, where the evaluation function decodes a tour by ranking expressed values — this gene makes that decoding lossless.');

/* Mutant genes — high entropy */
GeneRegistry.register('bitFlip', ['mutant'], (genome, params) => {
  return genome.map(v => Math.random() < 0.05 ? Math.random() : v);
}, 'Independently replaces each genome value with a uniform random number with 5% probability. On average, mutates 1 in 20 positions per expression. Unlike gradual perturbations, bit flips make large, discontinuous jumps — a value of 0.95 might become 0.02. High disruption that can escape deep local optima but just as easily destroys a good solution.');

GeneRegistry.register('gaussianNoise', ['mutant', 'explorer'], (genome, params) => {
  return genome.map(v => {
    const u = Math.random(), u2 = Math.random();
    const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.min(1, v + n * 0.05));
  });
}, 'Adds independent Gaussian noise (σ = 0.05) to every genome value using the Box-Muller transform. Unlike bitFlip or randomWalk, perturbations follow a normal distribution — small changes are far more likely than large ones, matching how biological mutation works. Perturbs all positions simultaneously, making it a dense but gentle exploration operator.');
