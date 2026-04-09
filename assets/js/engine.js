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
import { Gene, GeneRegistry } from './genes.js';

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
      this.genome = genome; //TODO Ensure genome is immutable?
    } else {
      this.genome = new Array(len);
      for (let i = 0; i < len; i++) {
        this.genome[i] = new Gene(GeneRegistry.nextGeneId(), Math.random());
      }
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

  //TODO Replace this and use genome of Genes in problem implementations
  genomeToFloat32() {
    return new Float32Array(
        this.genome
        .sort((a, b) => a.id - b.id) // stable order
        .map(g => g.value)
    );
  }

  /* Apply all active genes to produce an output vector */
  express(params = {}) {
    let values = this.genomeToFloat32();
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
    // --- Species compatibility check ---
    const sameSpecies = this.type === mate.type;

    // Reduce crossover effectiveness if cross-species
    const crossoverRate = sameSpecies ? 1.0 : 0.3;

    // crossover genes
    const childGenes = this.crossoverNEATControlled(
        mate,
        mutationRate,
        mutationScale,
        crossoverRate
    );

    // --- Structural mutation (controlled) ---
    // Try to adjust genome length based on fitness, if a fitter parent has a larger genome then
    // add a gene, smaller then remove
    let maybeAddGene;
    if(this.fitness >= mate.fitness) {
      if(this.genome.length > mate.genome.length) {
        //Good mutations may add gene
        maybeAddGene = true;
      }else {
        //Good mutations may remove gene
        maybeAddGene = false;
      }
    }

    if(maybeAddGene) {
      if (Math.random() < mutationRate * 50) {
        childGenes.push(new Gene(GeneRegistry.nextGeneId(), Math.random()));
      }
    }else {
      //Min length of genes is set here to 2
      if (childGenes.length > 2 && Math.random() < mutationRate * 50) {
        childGenes.splice(Math.floor(Math.random() * childGenes.length), 1);
      }
    }

    // --- Soft cap (prevents runaway growth) ---
    const MAX_GENOME = 32;
    if (childGenes.length > MAX_GENOME) {
      childGenes.length = MAX_GENOME;
    }

    // --- Logging ---
    this.mate = mate.id;
    mate.mate = this.id;

    this.logMessage(`Mated with ${mate.id}`);
    mate.logMessage(`Mated with ${this.id}`);

    // --- Child ---
    const child = new Organism(this.type, childGenes);

    // Mostly inherit species, but allow rare drift
    child.type = Math.random() < 0.9 ? this.type : mate.type;

    return child;
  }

  crossoverNEATControlled(mate, mutationRate, mutationScale, crossoverRate) {
    const child = [];

    const myGenes = new Map(this.genome.map(g => [g.id, g]));
    const mateGenes = new Map(mate.genome.map(g => [g.id, g]));

    const totalFitness = Math.max(0.0001, this.fitness + mate.fitness);
    const myWeight = this.fitness / totalFitness;

    const fitterIsMe = this.fitness >= mate.fitness;
    const primary = fitterIsMe ? myGenes : mateGenes;
    const secondary = fitterIsMe ? mateGenes : myGenes;

    //Worse performers explore more, Better performers exploit the genome they have
    const INNOVATION_RATE = this.fitness < mate.fitness ? 0.25 : 0.05;

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

      child.push(new Gene(id, value));
    }

    // --- 2. Occasionally include secondary-only genes ---
    for (const [id, gSecondary] of secondary.entries()) {
      if (!primary.has(id) && Math.random() < INNOVATION_RATE) {
        child.push(new Gene(id, gSecondary.value));
      }
    }

    return child;
  }

  /**
   * NEAT-lite crossover: aligns genes by ID
   */
  crossoverNEATLite(mate, mutationRate, mutationScale) {
    const child = [];

    const myGenes = new Map(this.genome.map(g => [g.id, g]));
    const mateGenes = new Map(mate.genome.map(g => [g.id, g]));

    const allIds = new Set([...myGenes.keys(), ...mateGenes.keys()]);

    const totalFitness = Math.max(0.0001, this.fitness + mate.fitness);
    const myWeight = this.fitness / totalFitness;

    for (const id of allIds) {
      const g1 = myGenes.get(id);
      const g2 = mateGenes.get(id);

      let chosen;

      if (g1 && g2) {
        // Matching gene → fitness-weighted pick
        chosen = Math.random() < myWeight ? g1 : g2;
      } else {
        // Disjoint/excess gene → take from fitter parent
        if (g1 && this.fitness >= mate.fitness) chosen = g1;
        else if (g2 && mate.fitness >= this.fitness) chosen = g2;
        else continue;
      }

      let value = chosen.value;

      // Mutation
      if (Math.random() < mutationRate) {
        const delta = Math.random() < 0.9
            ? (Math.random() * 2 - 1) * mutationScale
            : (Math.random() * 2 - 1) * mutationScale * 5;

        value = Math.max(0, Math.min(1, value + delta));
      }

      child.push(new Gene(id, value));
    }

    return child;
  }

  _crossoverNEATGenes(mate, mutationRate, mutationScale) {
    const childGenes = [];

    const myGenes = new Map(this.genome.map(g => [g.id, g]));
    const mateGenes = new Map(mate.genome.map(g => [g.id, g]));

    const allIds = new Set([...myGenes.keys(), ...mateGenes.keys()]);

    const totalFitness = Math.max(0.0001, this.fitness + mate.fitness);
    const myWeight = this.fitness / totalFitness;

    for (const id of allIds) {
      const g1 = myGenes.get(id);
      const g2 = mateGenes.get(id);

      let chosen;

      if (g1 && g2) {
        // Matching gene → pick randomly (fitness-biased)
        chosen = Math.random() < myWeight ? g1 : g2;
      } else {
        // Disjoint/excess gene → take from fitter parent
        if (g1 && this.fitness >= mate.fitness) chosen = g1;
        else if (g2 && mate.fitness >= this.fitness) chosen = g2;
        else continue;
      }

      let value = chosen.value;

      // Mutation
      if (Math.random() < mutationRate) {
        const delta = Math.random() < 0.9
            ? (Math.random() * 2 - 1) * mutationScale
            : (Math.random() * 2 - 1) * mutationScale * 5;

        value = Math.max(0, Math.min(1, value + delta));
      }

      childGenes.push({
        id,
        value,
        enabled: true
      });
    }

    //TODO Do we want to add/remove genes and support NEAT
    // Add new gene
    if (Math.random() < mutationRate) {
      childGenes.push({
        id: getNextInnovationId(),
        value: Math.random(),
        enabled: true
      });
    }

    // Remove gene
    if (childGenes.length > 1 && Math.random() < mutationRate) {
      childGenes.splice(Math.floor(Math.random() * childGenes.length), 1);
    }

    return childGenes;
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
      let genomeVector = org.genomeToFloat32();
      org.fitness     = this._problem.evaluate(genomeVector, expressed, org);
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
    const selected = this._groupAndSelect(this.organisms, this.maxSize - maxDead, this.sameFitnessRandomness)

    // Setup next generation and select the parents that will breed, ensure there are at least 2
    const nextGen = [...elites, ...selected];
    const parents = nextGen.slice(0, Math.max(2, Math.ceil(selected.length * this.breedingChance)));

    //Find the best surviving organism, make sure its still alive!
    const best = nextGen[0];
    if (!this.bestOrganism || best.fitness > this.bestFitness || (best.id != this.bestOrganism.id)) {
      this.bestFitness  = best.fitness;
      this.bestOrganism = best;
      this._addEvent(`New best: Org #${best.id} (${best.type}) fitness ${best.fitness.toFixed(4)}`);
    }

    // Document this generation
    this.history.push({ gen: this.generation, best: best.fitness, avg, size: this.organisms.length });
    if (this.history.length > 200) this.history.shift();

    // Occasionally note an interesting event
    if (this.generation % 10 === 0) {
      this._addEvent(`Gen ${this.generation}: pop ${this.organisms.length}, avg fitness ${avg.toFixed(4)}`);
    }

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
