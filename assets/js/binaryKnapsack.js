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

/* ── PROBLEM: BINARY KNAPSACK ─────────────────────────────── */
class BinaryKnapsack  extends Problem {
  constructor(config = {}) {
    super(config);
  }

  _generateItems(n = 12, seed = 99) {
    let rng = seed;
    const rand = () => { rng = (rng * 22695477 + 1) & 0x7fffffff; return rng / 0x7fffffff; };
    return Array.from({ length: n }, (_, i) => ({
      id: i, label: `Item${i}`,
      weight: 0.05 + rand() * 0.25,
      value:  0.02 + rand() * 0.30
    }));
  }

  regenerate(args) {
    this.params.items = this._generateItems(args[0], args[1]);
  }

  evaluate(genome, expressed, organism) {
    if (!this.params.items) this.params.items = this._generateItems(this.settings[0].value, this.settings[1].value);
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
  }

  visualize(canvas, population, goal) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    this.clearCanvas(canvas, ctx);

    if (!this.params.items) this.params.items = this._generateItems(this.settings[0].value, this.settings[1].value);
    const items    = this.params.items;
    const capacity = this.params.capacity;
    const n        = items.length;
    const barW     = (W - 30) / n;
    const pad      = 15;
    const innerH   = H - pad * 2 - 10;

    // Determine which items the best organism has selected
    let selected = new Array(n).fill(false);
    if (population?.bestOrganism) {
      const org = population.bestOrganism;
      const ex  = org.express({});
      for (let i = 0; i < n; i++) {
        selected[i] = (ex[i] ?? org.genome[i] ?? 0) > 0.5;
      }
    }

    // Draw item bars — static item properties (grey=weight, amber=value)
    // plus a highlighted selected state so bars react to selection changes
    for (let i = 0; i < n; i++) {
      const x   = pad + i * barW;
      const wh  = items[i].weight * innerH;
      const vh  = items[i].value  * innerH;
      const sel = selected[i];

      // Background slot
      ctx.fillStyle = sel ? '#1e2a40' : '#141820';
      ctx.fillRect(x + 2, pad, barW - 4, innerH);

      // Weight bar (left half of slot) — brighter when selected
      ctx.fillStyle = sel ? '#4a6090cc' : '#2e3a5060';
      ctx.fillRect(x + 2, pad + innerH - wh, (barW - 6) / 2, wh);

      // Value bar (right half of slot) — brighter when selected
      ctx.fillStyle = sel ? '#f0a500bb' : '#f0a50038';
      ctx.fillRect(x + 2 + (barW - 6) / 2, pad + innerH - vh, (barW - 6) / 2, vh);

      // Selected outline
      if (sel) {
        ctx.strokeStyle = '#00d4e8';
        ctx.lineWidth   = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(x + 2, pad, barW - 4, innerH);
      }
    }

    // Running total weight bar across the bottom showing how full the knapsack is
    if (population?.bestOrganism) {
      const org = population.bestOrganism;
      const ex  = org.express({});
      let totalW = 0, totalV = 0;
      const maxV = items.reduce((s, it) => s + it.value, 0);
      for (let i = 0; i < n; i++) {
        if ((ex[i] ?? org.genome[i] ?? 0) > 0.5) {
          totalW += items[i].weight;
          totalV += items[i].value;
        }
      }
      const overCapacity = totalW > capacity;

      // Weight fill bar
      const fillW = Math.min(totalW / capacity, 1.5) * (W - pad * 2);
      ctx.fillStyle = overCapacity ? '#ff445530' : '#2e3a5060';
      ctx.fillRect(pad, H - pad - 8, W - pad * 2, 6);
      ctx.fillStyle = overCapacity ? '#ff4455cc' : '#00d4e8cc';
      ctx.fillRect(pad, H - pad - 8, fillW, 6);

      // Labels
      ctx.fillStyle = overCapacity ? '#ff4455' : '#6a7590';
      ctx.font = '9px monospace';
      const wLabel = 'W:' + totalW.toFixed(2) + '/' + capacity.toFixed(2);
      const vLabel = '  V:' + totalV.toFixed(2) + '/' + maxV.toFixed(2);
      const label  = overCapacity
          ? 'OVER CAPACITY  ' + wLabel
          : wLabel + vLabel;
      ctx.fillText(label, pad, H - pad - 12);
    }

    // Capacity line
    const capY = pad + innerH - capacity * innerH;
    ctx.beginPath();
    ctx.strokeStyle = '#ff445570';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.moveTo(pad, capY);
    ctx.lineTo(W - pad, capY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    this.drawColoredText(ctx, [
      { text: '▌', color: '#2e3a5060' },
      { text: ' WEIGHT  ', color: '#929db9' },
      { text: '▌', color: '#f0a50038' },
      { text: ' VALUE   ', color: '#929db9' },
      { text: '---', color:'#ff445570' },
      { text: ' CAPACITY', color: '#929db9'}
    ], pad, H - pad);
  }
}
export const KS = new BinaryKnapsack({
  id: 'knapsack',
  label: 'Binary Knapsack',
  description: 'Genome bits select items to pack. Maximise value while staying within weight capacity.',
  goalLabel: 'Target value ratio (0–1)',
  params: { items: null, capacity: 0.5 },
  goals: [
    { label: '≥ 0.40', value: 0.40 },
    { label: '≥ 0.60', value: 0.60 },
    { label: '≥ 0.75', value: 0.75 },
    { label: '≥ 0.85', value: 0.85 },
  ],
  settings: [
    {
      id: 'numItems',
      label: 'Number of items',
      description: 'The number of items that are available to fill the Knapsack.',
      value: 12
    },
    {
      id: 'seed',
      label: 'Seed for weight and value',
      description: 'Allows you to vary the weights and values of the items.',
      value: 99
    }
  ]
});
