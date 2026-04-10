/*
 * Copyright (c) 2026 Terry Packer.
 *
 * This file is part of Terry Packer's Work.
 * See www.terrypacker.com for further info.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* =============================================================
   GENES.JS  —  Handle gene registry and default genes.
   ============================================================= */
'use strict';

export class Genome {
  constructor(config = {}) {
    this.genes = config.genes;
    this.chromosomes = config.chromosomes;
    this.organism = config.organism ?? null;
  }

  //TODO Replace this and use genome in problem implementations
  chromosomesToFloat32() {
    return new Float32Array(
        this.chromosomes
        .sort((a, b) => a.id - b.id) // stable order
        .map(g => g.value)
    );
  }

  express(params = {}) {
    let values = this.chromosomesToFloat32();
    for (const gene of this.genes) {
      try {
        const result = gene.fn(values, params);
        if (Array.isArray(result) || result instanceof Float32Array) {
          values = Array.from(result); //Combine results so they are additive per gene
        }
      } catch (e) {
        // gene threw — mark it but continue
        this.organism.logMessage(`gene error: ${gene.name} — ${e.message}`);
      }
    }
    return values;
  }

  crossoverChromosomes(mate, mutationRate, mutationScale, crossoverRate) {
    const myChromosomeMap = new Map(this.chromosomes.map(c => [c.id, c]));
    const mateChromosomeMap = new Map(mate.genome.chromosomes.map(c => [c.id, c]));

    const childChromosomes = [];

    const totalFitness = Math.max(0.0001, this.organism.fitness + mate.fitness);
    const myWeight = this.organism.fitness / totalFitness;

    const fitterIsMe = this.organism.fitness >= mate.fitness;
    const primary = fitterIsMe ? myChromosomeMap : mateChromosomeMap;
    const secondary = fitterIsMe ? mateChromosomeMap : myChromosomeMap;

    //Worse performers explore more, Better performers exploit the genome they have
    const INNOVATION_RATE = this.organism.fitness < mate.fitness ? 0.25 : 0.05;

    // --- 1. Always include primary genes ---
    for (const [id, gPrimary] of primary.entries()) {
      const gOther = secondary.get(id);

      let chosen;

      if (gOther && Math.random() < crossoverRate) {
        chosen = Math.random() < myWeight ? gPrimary : gOther;
      } else {
        chosen = gPrimary;
      }

      let value = chosen.value;

      if (Math.random() < mutationRate) {
        const delta =
            (Math.random() * 2 - 1) *
            mutationScale *
            (Math.random() < 0.9 ? 1 : 5);

        value = Math.max(0, Math.min(1, value + delta));
      }

      childChromosomes.push(new Chromosome(id, value));
    }

    // --- 2. Occasionally include secondary-only genes ---
    for (const [id, gSecondary] of secondary.entries()) {
      if (!primary.has(id) && Math.random() < INNOVATION_RATE) {
        childChromosomes.push(new Chromosome(id, gSecondary.value));
      }
    }

    // --- Structural mutation (controlled) ---
    // Try to adjust genome length based on fitness, if a fitter parent has a larger genome then
    // add a gene, smaller then remove
    let maybeAddChromosome
    if(this.organism.fitness >= mate.fitness) {
      if(this.chromosomes.length > mate.genome.chromosomes.length) {
        //Good mutations may add
        maybeAddChromosome = true;
      }else {
        //Good mutations may remove
        maybeAddChromosome = false;
      }
    }

    if(maybeAddChromosome) {
      if (Math.random() < mutationRate * 50) {
        childChromosomes.push(new Chromosome(GeneRegistry.nextChromosomeId(), Math.random()));
      }
    }else {
      //Min length is set here to 2
      if (childChromosomes.length > 2 && Math.random() < mutationRate * 50) {
        childChromosomes.splice(Math.floor(Math.random() * childChromosomes.length), 1);
      }
    }

    // --- Soft cap (prevents runaway growth) ---
    const MAX_CHROMOSOMES = 32;
    if (childChromosomes.length > MAX_CHROMOSOMES) {
      childChromosomes.length = MAX_CHROMOSOMES;
    }

    return childChromosomes;
  }

}

export class Chromosome {
  constructor(id, value) {
    this.id = id;
    this.value = value;
    //NEAT
    //NEAT support: enabled
    //NEAT support: age, do genes really die out?
  }
}

export class GeneType {
  constructor(config = {}) {
    this.name           = config.name           ?? 'default-gene';
    this.types          = config.types          ?? [];
    this.fn             = config.fn             ?? null;
    this.description    = config.description    ?? '';
  }
}

/* ── GENE REGISTRY ────────────────────────────────────────────
   Each gene is a named function that belongs to one or more
   organism types. Genes are the "skills" available to an
   organism type. They operate on the organism's genome array.

   To add a new gene:
     GeneRegistry.register('myGene', ['TypeA', 'TypeB'], function(genome, params) {
       // mutate or return a value
       return modifiedValue;
     });
   ============================================================= */
export const GeneRegistry = (() => {
  const _genes = new Map();
  let _NEXT_CHROMOSOME_ID = 1;

  const api = {
    nextChromosomeId() {
      return _NEXT_CHROMOSOME_ID++;
    },
    register(gene) {
      _genes.set(gene.name, gene);
    },
    delete(name) { _genes.delete(name); },
    get(name) { return _genes.get(name); },
    forType(type) {
      return [..._genes.values()].filter(g => g.types.includes(type));
    },
    allNames() { return [..._genes.keys()]; },
    all() { return [..._genes.values()]; },
    get_genes() { return _genes; }
  };
  return api;
})();

/*
   Genes are registered here so they live alongside the problems
   they support. Import this module after engine.js.

   TO ADD GENES: call GeneRegistry.register(...) below.
*/
/* Explorer genes — good for spatial search */
const boundaryPush = new GeneType({
  name: 'boundaryPush',
  types: ['explorer', 'mutant'],
  fn: (genome, params) => {
    return genome.map(v => v < 0.1 ? v + 0.05 : v > 0.9 ? v - 0.05 : v);
  },
  description: 'Nudges values near the boundaries of [0,1] back toward the interior. Values below 0.1 are pushed up; values above 0.9 are pushed down. Prevents genomes from getting permanently stuck at extreme values where small mutations have less effect.'
});
GeneRegistry.register(boundaryPush);

const randomWalk = new GeneType({
  name: 'randomWalk',
  types: ['explorer', 'mutant'],
  fn: (genome, params) => {
    const out = genome.slice();
    const idx = Math.floor(Math.random() * out.length);
    out[idx] = Math.max(0, Math.min(1, out[idx] + (Math.random() - 0.5) * 0.1));
    return out;
  },
  description: 'Randomly selects one genome position and shifts it by a uniform random amount in [-0.05, +0.05]. All other positions are unchanged. Creates local exploration around the current solution — like a single step of a random walk in one dimension of the search space.'
});
GeneRegistry.register(randomWalk);

const mirrorFold = new GeneType({
  name: 'mirrorFold',
  types: ['explorer'],
  fn: (genome, params) => {
    const half = Math.floor(genome.length / 2);
    const out  = genome.slice();
    for (let i = 0; i < half; i++) out[i + half] = 1 - out[i];
    return out;
  },
  description: 'Copies the first half of the genome into the second half, inverted: out[i + half] = 1 - genome[i]. Forces a structural symmetry — if genome[0] = 0.3, then genome[half] = 0.7. Useful when problems benefit from complementary value pairs, but harmful for problems like TSP where all positions need independent values.'
});
GeneRegistry.register(mirrorFold);

/* Climber genes — local hill climbing */
const gradientNudge = new GeneType({
  name: 'gradientNudge',
  types: ['climber', 'optimizer'],
  fn: (genome, params) => {
    return genome.map(v => v + (0.5 - v) * 0.02);
  },
  description: 'Pulls every genome value 2% of the way toward the midpoint 0.5. Equivalent to applying the recurrence v_new = 0.98·v + 0.01, which converges to 0.5 over many generations. Reduces variance across the genome and stabilises it near the centre of [0,1] — helpful when problems are sensitive to extreme values.'
});
GeneRegistry.register(gradientNudge);

const elitePull = new GeneType({
  name: 'elitePull',
  types: ['climber'],
  fn: (genome, params) => {
    return genome.map(v => v * 0.98 + 0.01);
  },
  description: 'Applies a linear contraction: v_new = 0.98·v + 0.01. This maps [0,1] to [0.01, 0.99], gently compressing the genome away from the extremes. Across many generations it converges all values to 0.5. More conservative than gradientNudge — the shift per step is smaller for values already near the centre.'
});
GeneRegistry.register(elitePull);

/* Optimizer genes — mathematical transforms */
const sinTransform = new GeneType({
  name: 'sinTransform',
  types: ['optimizer', 'climber'],
  fn: (genome, params) => {
    return genome.map(v => (Math.sin(v * Math.PI) + 1) / 2);
  },
  description: 'Applies a sine-based remapping: out = (sin(v·π) + 1) / 2. This is a smooth, non-linear compression that maps [0,1]→[0.5,1]→[0.5] — values near 0 and 1 are pushed toward 0.5, while the midpoint 0.5 maps to 1.0. Creates a bias toward mid-range expressed values. Useful when the fitness landscape rewards moderate, non-extreme values.'
});
GeneRegistry.register(sinTransform);

const normalize = new GeneType({
  name: 'normalize',
  types: ['optimizer', 'mutant'],
  fn: (genome, params) => {
    const max = Math.max(...genome, 1e-9);
    return genome.map(v => v / max);
  },
  description: 'Divides every value by the maximum value in the genome, scaling the vector so its largest component becomes 1.0. Preserves relative proportions between values while stretching the range to fill [0,1]. Particularly useful for TSP and ordering problems where relative magnitude matters more than absolute values.'
});
GeneRegistry.register(normalize);

const rankSort = new GeneType({
  name: 'rankSort',
  types: ['optimizer'],
  fn: (genome, params) => {
    const indexed = genome.map((v, i) => [v, i]);
    indexed.sort((a, b) => a[0] - b[0]);
    const out = new Array(genome.length);
    indexed.forEach(([, i], rank) => { out[i] = rank / (genome.length - 1 || 1); });
    return out;
  },
  description: 'Replaces each value with its fractional rank within the genome: the smallest value becomes 0, the largest becomes 1, and intermediate values are evenly spaced. Destroys absolute magnitude information but perfectly preserves ordinal relationships. Essential for TSP, where the evaluation function decodes a tour by ranking expressed values — this gene makes that decoding lossless.'
});
GeneRegistry.register(rankSort);

/* Mutant genes — high entropy */
const bitFlip = new GeneType({
  name: 'bitFlip',
  types: ['mutant'],
  fn: (genome, params) => {
    return genome.map(v => Math.random() < 0.05 ? Math.random() : v);
  },
  description: 'Independently replaces each genome value with a uniform random number with 5% probability. On average, mutates 1 in 20 positions per expression. Unlike gradual perturbations, bit flips make large, discontinuous jumps — a value of 0.95 might become 0.02. High disruption that can escape deep local optima but just as easily destroys a good solution.'
});
GeneRegistry.register(bitFlip);

const guassianNoise = new GeneType({
  name: 'gaussianNoise',
  types: ['mutant', 'explorer'],
  fn: (genome, params) => {
    return genome.map(v => {
      const u = Math.random(), u2 = Math.random();
      const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * u2);
      return Math.max(0, Math.min(1, v + n * 0.05));
    });
  },
  description: 'Adds independent Gaussian noise (σ = 0.05) to every genome value using the Box-Muller transform. Unlike bitFlip or randomWalk, perturbations follow a normal distribution — small changes are far more likely than large ones, matching how biological mutation works. Perturbs all positions simultaneously, making it a dense but gentle exploration operator.'
});
GeneRegistry.register(guassianNoise);
