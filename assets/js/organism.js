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
'use strict';
import { Chromosome, GeneRegistry, Genome } from './genes.js';

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
export class Organism {
  constructor(id, type, genome = null) {
    this.id       = id;
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
      this.genome = genome;
      this.genome.organism = this;
    } else {
      const chromosomes = new Array(len);
      for (let i = 0; i < len; i++) {
        chromosomes[i] = new Chromosome(GeneRegistry.nextChromosomeId(), Math.random());
      }
      // Assign active genes (subset of type's gene pool)
      const pool = [];
      if(typeDef.genePool) {
        typeDef.genePool.forEach(t => pool.push(GeneRegistry.get(t)));
      }
      const genes = this._selectGenes(pool);
      this.genome = new Genome({genes: genes, chromosomes: chromosomes, organism: this})
    }
  }

  /* Apply all active genes to produce an output vector */
  express(params = {}) {
    return this.genome.express(params);
  }

  /* Create a child by crossover with a mate organism */
  reproduce(mate, mutationRate, mutationScale, population) {
    // --- Species compatibility check ---
    const sameSpecies = this.type === mate.type;

    // Reduce crossover effectiveness if cross-species
    const crossoverRate = sameSpecies ? 1.0 : 0.3;

    // crossover genomes
    const childGenome = this.crossoverNEATControlled(
        mate,
        mutationRate,
        mutationScale,
        crossoverRate
    );

    // --- Logging ---
    this.mate = mate.id;
    mate.mate = this.id;

    this.logMessage(`Mated with ${mate.id}`);
    mate.logMessage(`Mated with ${this.id}`);

    // --- Child ---
    // Mostly inherit species, but allow rare drift
    const childType = Math.random() < 0.9 ? this.type : mate.type;

    const child = new Organism(population.nextOrganismId(), childType, childGenome);
    return child;
  }

  crossoverNEATControlled(mate, mutationRate, mutationScale, crossoverRate) {
    const childGenes = this._selectGenes([...this.genome.genes, ...mate.genome.genes]);
    const childChromosomes = this.genome.crossoverChromosomes(mate, mutationRate, mutationScale, crossoverRate);

    return new Genome({
      genes: childGenes,
      chromosomes: childChromosomes
    });
  }

  _selectGenes(pool = []) {
    const genes = pool.length > 0
        ? pool.filter(() => Math.random() < 0.7)
        : [];
    if (genes.length === 0 && pool.length > 0) {
      genes.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return genes;
  }

  logMessage(msg) {
    this.log.push({age: this.age, msg: msg});
  }
}
