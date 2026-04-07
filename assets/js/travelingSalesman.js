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
import { Problem } from './problems.js';

/* ── PROBLEM: TRAVELING SALESMAN (TSP) ────────────────────── */
class TravelingSalesmanProblem extends Problem {
  constructor(config = {}) {
    super(config);
  }

  _generateCities(n = 10, seed = 7) {
    let rng = seed;
    const rand = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
    return Array.from({ length: n }, (_, i) => ({ id: i, x: rand(), y: rand() }));
  }

  _tourLength(order, cities) {
    let dist = 0;
    for (let i = 0; i < order.length; i++) {
      const a = cities[order[i] % cities.length];
      const b = cities[order[(i + 1) % order.length] % cities.length];
      dist += Math.hypot(a.x - b.x, a.y - b.y);
    }
    return dist;
  }

  regenerate(args) {
    this.params.cities = this._generateCities(args[0], args[1]);
  }

  evaluate(genome, expressed, organism) {
    if (!this.params.cities) this.params.cities = this._generateCities(this.settings[0].value, this.settings[1].value);
    const n = this.params.cities.length;
    // Decode genome into tour order by ranking
    const indexed = expressed.slice(0, n).map((v, i) => [v, i]);
    indexed.sort((a, b) => a[0] - b[0]);
    const order = indexed.map(([, i]) => i);
    const dist  = this._tourLength(order, this.params.cities);
    organism._tourLen = dist;
    return Math.max(0, 1 - dist / 5);
  }

  visualize(canvas, population, goal) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    this.clearCanvas(canvas, ctx);

    if (!this.params.cities) this.params.cities = this._generateCities(this.settings[0].value, this.settings[1].value);
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
        ctx.strokeStyle = this.typeColor(org.type) + '22';
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
}

export const TSP = new TravelingSalesmanProblem({
  id: 'tsp',
  label: 'Traveling Salesman',
  description: 'Genome encodes a city-visit order. Minimise total tour distance through all cities.',
  goalLabel: 'Max tour length (lower = better)',
  params: { cities: null },
  goals: [
    { label: 'Tour < 3.5', value: 3.5 },
    { label: 'Tour < 3.0', value: 3.0 },
    { label: 'Tour < 2.5', value: 2.5 },
    { label: 'Tour < 2.0', value: 2.0 },
  ],
  settings: [
    {
      id: 'cities',
      label: 'Number of cities',
      description: 'The number of cities in the solution space.',
      value: 10
    },
    {
      id: 'seed',
      label: 'Seed distances',
      description: 'The seed used to randomly generated the distances between cities.',
      value: 7
    }
  ]
});
