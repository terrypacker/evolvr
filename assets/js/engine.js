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
import { Organism } from "./organism.js";


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
    this._oidSeq = 0;
  }

  setProblem(problemDef) {
    this._problem = problemDef;
  }

  nextOrganismId() {
    return this._oidSeq++;
  }

  /* Seed the population with random organisms */
  seed(typeWeights) {
    this.typeWeights = typeWeights ?? this.typeWeights;
    this.organisms   = [];
    this._oidSeq     = 0;

    const types  = Object.entries(this.typeWeights).filter(([, w]) => w > 0);
    const target = this.maxSize;

    // normalise weights
    const total = types.reduce((s, [, w]) => s + w, 0);
    for (const [tid, w] of types) {
      const count = Math.round((w / total) * target);
      for (let i = 0; i < count; i++) {
        this.organisms.push(new Organism(this.nextOrganismId(), tid));
      }
    }

    // Fill to maxSize if rounding left gaps
    while (this.organisms.length < target) {
      const [tid] = types[Math.floor(Math.random() * types.length)];
      this.organisms.push(new Organism(this.nextOrganismId(), tid));
    }

    this.generation = 0;
    this.history    = [];
    this.events     = [];
  }

  /* Evaluate fitness for every organism using the active problem */
  evaluate() {
    if (!this._problem) return;
    for (const org of this.organisms) {
      const expressed = org.genome.express(this._problem.params ?? {});
      let chromosomeVector = org.genome.chromosomesToFloat32();
      org.fitness = this._problem.evaluate(chromosomeVector, expressed, org);
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

      const child = a.reproduce(b, this.mutationRate, this.mutationScale, this);
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
