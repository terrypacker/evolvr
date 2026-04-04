/* =============================================================
   ENGINE.JS  —  Evolutionary Simulation Core
   Handles: organism lifecycle, gene expression, reproduction,
            fitness evaluation, and population management.
   ============================================================= */

'use strict';

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

  const api = {
    register(name, types, fn, description = '') {
      _genes.set(name, { name, types, fn, description });
    },
    delete(name) { _genes.delete(name); },
    get(name) { return _genes.get(name); },
    forType(type) {
      return [..._genes.values()].filter(g => g.types.includes(type));
    },
    allNames() { return [..._genes.keys()]; },
    all() { return [..._genes.values()]; },
    get _genes() { return _genes; }
  };
  return api;
})();

/* ── ORGANISM TYPE REGISTRY ───────────────────────────────────
   Define organism types with their associated gene pools.
   Each type can have a custom color and display name.

   To add a new type:
     OrganismTypes.register({
       id: 'myType',
       label: 'My Type',
       color: '#ff00ff',
       description: 'What it does',
       genomeLength: 8,       // how many genome values
       genePool: ['gene1', 'gene2'],  // available genes
       mutationRate: 0.1,     // probability per gene per generation
       mutationScale: 0.2,    // how large mutations are (0–1 scale)
     });
   ============================================================= */
export const OrganismTypes = (() => {
  const _types = new Map();

  return {
    register(def) { _types.set(def.id, def); },
    delete(id) { _types.delete(id); },
    get(id) { return _types.get(id); },
    all() { return [..._types.values()]; },
    ids() { return [..._types.keys()]; },
    get _types() { return _types; }
  };
})();

/* ── ORGANISM ─────────────────────────────────────────────────
   A single agent in the simulation.
   - genome: Float32Array of values in [0,1]
   - genes:  array of gene names this organism expresses
   - fitness: last computed fitness score
   ============================================================= */
let _oidSeq = 0;
export class Organism {
  constructor(type, genome = null) {
    this.id       = ++_oidSeq;
    this.type     = type;            // OrganismType id
    this.age      = 0;
    this.fitness  = 0;
    this.alive    = true;
    this.children = 0;
    this.mate     = null;            // last mate id
    this.log      = [];              // event log

    const typeDef = OrganismTypes.get(type);
    const len = typeDef?.genomeLength ?? 8;

    if (genome) {
      this.genome = Float32Array.from(genome);
    } else {
      this.genome = new Float32Array(len);
      for (let i = 0; i < len; i++) this.genome[i] = Math.random();
    }

    // Assign active genes (subset of type's gene pool)
    const pool = typeDef?.genePool ?? [];
    this.genes = pool.length > 0
      ? pool.filter(() => Math.random() < 0.7)
      : [];
    if (this.genes.length === 0 && pool.length > 0) {
      this.genes.push(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  /* Apply all active genes to produce an output vector */
  express(params = {}) {
    let values = [...this.genome];
    for (const geneName of this.genes) {
      const gene = GeneRegistry.get(geneName);
      if (gene) {
        try {
          const result = gene.fn(values, params);
          if (Array.isArray(result) || result instanceof Float32Array) {
            values = Array.from(result);
          }
        } catch (e) {
          // gene threw — mark it but continue
          this._log(`gene error: ${geneName} — ${e.message}`);
        }
      }
    }
    return values;
  }

  _log(msg) {
    if (this.log.length > 20) this.log.shift();
    this.log.push(msg);
  }

  /* Create a child by crossover with a mate organism */
  reproduce(mate, mutationRate, mutationScale) {
    const myLen   = this.genome.length;
    const mateLen = mate.genome.length;
    const len     = Math.max(myLen, mateLen);

    // Single-point crossover
    const cut   = Math.floor(Math.random() * len);
    const child = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const src = i < cut ? this.genome : mate.genome;
      child[i]  = src[i % src.length] ?? Math.random();
    }

    // Mutation
    for (let i = 0; i < len; i++) {
      if (Math.random() < mutationRate) {
        child[i] = Math.max(0, Math.min(1,
          child[i] + (Math.random() * 2 - 1) * mutationScale
        ));
      }
    }

    // Inherit genes from both parents, with potential new genes
    const myTypeDef   = OrganismTypes.get(this.type);
    const mateTypeDef = OrganismTypes.get(mate.type);
    const pool = [...new Set([
      ...(myTypeDef?.genePool ?? []),
      ...(mateTypeDef?.genePool ?? [])
    ])];

    const childGenes = [...new Set([
      ...this.genes.filter(() => Math.random() < 0.6),
      ...mate.genes.filter(() => Math.random() < 0.6)
    ])];

    // Occasionally pick up a random gene from the combined pool
    if (Math.random() < 0.15 && pool.length > 0) {
      const candidate = pool[Math.floor(Math.random() * pool.length)];
      if (!childGenes.includes(candidate)) childGenes.push(candidate);
    }

    const childOrg   = new Organism(this.type, child);
    childOrg.genes   = childGenes.length ? childGenes : this.genes.slice();
    childOrg.type    = Math.random() < 0.8 ? this.type : mate.type;
    return childOrg;
  }
}

/* ── POPULATION ───────────────────────────────────────────────
   Manages a pool of organisms. Runs selection, reproduction,
   and generational turnover.
   ============================================================= */
export class Population {
  constructor(config = {}) {
    this.maxSize        = config.maxSize        ?? 30;
    this.eliteCount     = config.eliteCount     ?? 3;
    this.mutationRate   = config.mutationRate   ?? 0.1;
    this.mutationScale  = config.mutationScale  ?? 0.2;
    this.typeWeights    = config.typeWeights    ?? {};  // {typeId: weight 0-1}

    this.organisms      = [];
    this.generation     = 0;
    this.bestFitness    = 0;
    this.bestOrganism   = null;
    this.history        = [];   // [{gen, best, avg, size}]
    this.events         = [];   // recent notable events
    this._problem       = null;
  }

  setProblem(problemDef) {
    this._problem = problemDef;
  }

  /* Seed the population with random organisms */
  seed(typeWeights) {
    this.typeWeights = typeWeights ?? this.typeWeights;
    this.organisms   = [];
    _oidSeq          = 0;

    const types  = Object.entries(this.typeWeights).filter(([, w]) => w > 0);
    const target = this.maxSize;

    // normalise weights
    const total = types.reduce((s, [, w]) => s + w, 0);
    for (const [tid, w] of types) {
      const count = Math.round((w / total) * target);
      for (let i = 0; i < count; i++) {
        this.organisms.push(new Organism(tid));
      }
    }

    // Fill to maxSize if rounding left gaps
    while (this.organisms.length < target) {
      const [tid] = types[Math.floor(Math.random() * types.length)];
      this.organisms.push(new Organism(tid));
    }

    this.generation = 0;
    this.history    = [];
    this.events     = [];
  }

  /* Evaluate fitness for every organism using the active problem */
  evaluate() {
    if (!this._problem) return;
    for (const org of this.organisms) {
      const expressed = org.express(this._problem.params ?? {});
      org.fitness     = this._problem.evaluate(org.genome, expressed, org);
      org.age++;
    }
  }

  /* Selection + reproduction → next generation */
  evolve() {
    this.evaluate();

    // Sort by fitness descending
    this.organisms.sort((a, b) => b.fitness - a.fitness);

    const best = this.organisms[0];
    const avg  = this.organisms.reduce((s, o) => s + o.fitness, 0) / this.organisms.length;

    if (!this.bestOrganism || best.fitness > this.bestFitness) {
      this.bestFitness  = best.fitness;
      this.bestOrganism = best;
      this._addEvent(`New best: Org #${best.id} (${best.type}) fitness ${best.fitness.toFixed(4)}`);
    }

    this.history.push({ gen: this.generation, best: best.fitness, avg, size: this.organisms.length });
    if (this.history.length > 200) this.history.shift();

    // Elite survivors carry over
    const elites  = this.organisms.slice(0, this.eliteCount);
    const parents = this.organisms.slice(0, Math.ceil(this.organisms.length * 0.5));

    const nextGen = [...elites];

    while (nextGen.length < this.maxSize) {
      const a = parents[Math.floor(Math.random() * parents.length)];
      const b = parents[Math.floor(Math.random() * parents.length)];
      if (a === b) continue;

      const child = a.reproduce(b, this.mutationRate, this.mutationScale);
      child.fitness = 0;
      a.children++;
      b.children++;
      nextGen.push(child);
    }

    this.organisms  = nextGen;
    this.generation++;

    // Occasionally note an interesting event
    if (this.generation % 10 === 0) {
      this._addEvent(`Gen ${this.generation}: pop ${this.organisms.length}, avg fitness ${avg.toFixed(4)}`);
    }
  }

  _addEvent(msg) {
    this.events.unshift({ gen: this.generation, msg, ts: Date.now() });
    if (this.events.length > 50) this.events.pop();
  }

  stats() {
    if (!this.organisms.length) return {};
    const sorted  = [...this.organisms].sort((a, b) => b.fitness - a.fitness);
    const best    = sorted[0];
    const avg     = this.organisms.reduce((s, o) => s + o.fitness, 0) / this.organisms.length;
    const typeCounts = {};
    for (const o of this.organisms) typeCounts[o.type] = (typeCounts[o.type] ?? 0) + 1;

    return { best, avg, typeCounts, generation: this.generation, size: this.organisms.length };
  }
}
