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
   ENGINE.JS  —  Evolutionary Simulation Core
   Handles: organism lifecycle, gene expression, reproduction,
            fitness evaluation, and population management.
   ============================================================= */
'use strict';
import { GeneRegistry } from './genes.js';

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
    this.log      = [];              // event log {age: n, msg: 'message'}

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

    //Assign the last mate
    this.mate = mate;
    this.logMessage('Mated with ' + mate.id);
    mate.mate = this.mate;
    mate.logMessage('Mated with ' + this.id);

    const childOrg   = new Organism(this.type, child);
    childOrg.genes   = childGenes.length ? childGenes : this.genes.slice();
    childOrg.type    = Math.random() < 0.8 ? this.type : mate.type;
    return childOrg;
  }

  logMessage(msg) {
    this.log.push({age: this.age, msg: msg});
  }
}

/* ── POPULATION ───────────────────────────────────────────────
   Manages a pool of organisms. Runs selection, reproduction,
   and generational turnover.
   ============================================================= */
export class Population {
  constructor(config = {}) {
    this.maxSize        = config.maxSize        ?? 30;
    this.eliteCount     = config.eliteCount     ?? this.maxSize * 0.1;
    this.mutationRate   = config.mutationRate   ?? 0.1;
    this.mutationScale  = config.mutationScale  ?? 0.2;
    this.typeWeights    = config.typeWeights    ?? {};  // {typeId: weight 0-1}
    this.deathRate      = config.deathRate      ?? 0.2;
    this.breedingChance = config.breedingChance ?? 0.5;
    this.sameFitnessRandomness = config.sameFitnessRandomness ?? .5;

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

    //Compute average fitness of this generation
    const avg  = this.organisms.reduce((s, o) => s + o.fitness, 0) / this.organisms.length;

    // Sort by fitness descending and remove Elite survivors to carry over
    this.organisms = this.organisms.sort((a, b) => b.fitness - a.fitness);
    const elites  = this.organisms.slice(0, this.eliteCount);
    this.organisms = this.organisms.slice(this.eliteCount, this.organisms.length);

    // Trim population to max size, kill off the least fit, always keep 1
    //
    // Sort into groups of the same fitness, randomize those groups.
    // This prevents a steady state stagnation of a population that has the same fitness.
    // Kill off the lowest % of organisms.
    //
    const maxDead = Math.min(this.maxSize - 1, this.maxSize * this.deathRate);
    this.organisms = this._groupAndSelect(this.organisms, this.maxSize - maxDead, this.sameFitnessRandomness)

    // Setup next generation and select the parents that will breed, ensure there are at least 2
    const nextGen = [...elites, ...this.organisms];
    const parents = nextGen.slice(0, Math.max(2, Math.ceil(this.organisms.length * this.breedingChance)));

    //Find the best surviving organism, make sure its still alive!
    const best = nextGen[0];
    if (!this.bestOrganism || best.fitness > this.bestFitness || (best.fitness == this.bestFitness && best.id != this.bestOrganism.id)) {
      this.bestFitness  = best.fitness;
      this.bestOrganism = best;
      this._addEvent(`New best: Org #${best.id} (${best.type}) fitness ${best.fitness.toFixed(4)}`);
    }

    // Document this generation
    this.history.push({ gen: this.generation, best: best.fitness, avg, size: this.organisms.length });
    if (this.history.length > 200) this.history.shift();


    //Provide a chance for mating
    const mateChances = this.maxSize - nextGen.length;
    for (let i=0; i<mateChances; i++) {
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

  /* evolution helpers */

  /**
   * Shuffle the array randomly
   * @param array - array to randomize
   * @param randomness - 0: No shuffling (deterministic, original order preserved) .5: Midrange mixing 1: Full shuffle (classic Fisher–Yates)
   * @returns {*[]}
   * @private
   */
  _controlledShuffle(array, randomness = 1) {
    const arr = [...array];

    // 0 = no shuffle, 1 = full shuffle
    if (randomness <= 0) return arr;

    for (let i = arr.length - 1; i > 0; i--) {
      // Only shuffle this position based on randomness probability
      if (Math.random() < randomness) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }

    return arr;
  }

  /**
   *
   * @param items
   * @param randomness - 0: No shuffling (deterministic, original order preserved) .5: Midrange mixing 1: Full shuffle (classic Fisher–Yates)
   * @returns {{fitness: *, items: *[]}[]}
   * @private
   */
  _groupByFitness(organisms, randomness = 1) {
    const groupsMap = new Map();

    // Grouping
    for (const item of organisms) {
      const key = item.fitness;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key).push(item);
    }

    // Sort groups descending + shuffle within groups
    return Array.from(groupsMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([fitness, group]) => ({
      fitness,
      items: this._controlledShuffle(group, randomness)
    }));
  }

  /**
   * Select the top size items from the array into a new array
   * @param groups
   * @param size
   * @returns {*[]}
   * @private
   */
  _selectFromGroups(groups, size) {
    const result = [];

    for (const group of groups) {
      for (const item of group.items) {
        if (result.length >= size) return result;
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Produce a group of organisms that has random order of similar fitness
   * that can be smaller than the original group.
   * @param organisms - organisms to groups, randomize the organsims in the
   * group and slice it to size.
   * @param size - final size of organisms list
   * @param randomness - level of randomness [0 = none, 1 = fully randomized]
   * @returns {*}
   * @private
   */
  _groupAndSelect(organisms, size, randomness = 1) {
    const groups = this._groupByFitness(organisms, randomness);
    return this._selectFromGroups(groups, size);
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

  getOrganism(id) {
    return this.organisms.findLast((org) => org.id === id);
  }

  deleteOrganism(id) {
    const index = this.organisms.findIndex(org => org.id === id);
    if (index !== -1) {
      this.organisms.splice(index, 1);
    }
  }
}
