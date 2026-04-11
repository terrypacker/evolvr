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
import { Problem } from '../problems.js';

/* ── PROBLEM: PEAK FINDER ──────────────────────────────────── */
class PeakFinder extends Problem {
  constructor(config = {}) {
    super(config);
  }

  _generatePeaks(numPeaks, seed = 42) {
    const peaks = [];
    let rng = seed;
    const rand = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0xffffffff; };
    for (let i = 0; i < numPeaks; i++) {
      peaks.push({ x: rand(), y: rand(), h: 0.3 + rand() * 0.7, w: 0.05 + rand() * 0.15 });
    }
    return peaks;
  }

  _heightAt(x, y, peaks) {
    let h = 0;
    for (const p of peaks) {
      const dx = x - p.x, dy = y - p.y;
      h += p.h * Math.exp(-(dx*dx + dy*dy) / (2 * p.w * p.w));
    }
    return Math.min(1, h);
  }

  regenerate(args) {
    this.params.peaks = this._generatePeaks(args[0], args[1]);
  }

  evaluate(chromosomeVector, expressed, organism) {
    if (!this.params.peaks) this.params.peaks = this._generatePeaks(this.settings[0].value, this.settings[1].value);
    const x = expressed[0] ?? chromosomeVector[0];
    const y = expressed[1] ?? chromosomeVector[1];
    return this._heightAt(x, y, this.params.peaks);
  }

  visualize(canvas, population, goal) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    this.clearCanvas(canvas, ctx);

    if (!this.params.peaks) this.params.peaks = this._generatePeaks(this.settings[0].value, this.settings[1].value);
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

    // Draw goal contour — horizontal line at the goal fitness height
    // (fitness maps linearly to Y in the heatmap; highest peak ~top)
    if (goal) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(240,165,0,0.5)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      const goalY = H * (1 - goal);
      ctx.moveTo(0, goalY);
      ctx.lineTo(W, goalY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw organisms
    if (population?.organisms) {
      for (const org of population.organisms) {
        if (!org.alive) continue;
        const ex = org.express({});
        const ox = (ex[0] ?? org.genome.chromosomes[0]) * W;
        const oy = (ex[1] ?? org.genome.chromosomes[1]) * H;
        const r  = 3 + (org.fitness * 4);
        const col = this.typeColor(org.type);

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
}

export const PF = new PeakFinder({
  id: 'peakFinder',
  label: 'Peak Finder',
  description: 'Find the global maximum of a rugged multi-modal landscape. Genomes encode X,Y coordinates in the search space.',
  goalLabel: 'Target peak height (0–1)',
  params: { peaks: null },  // generated on first use
  goals: [
    { label: '≥ 0.60', value: 0.60 },
    { label: '≥ 0.75', value: 0.75 },
    { label: '≥ 0.90', value: 0.90 },
    { label: '≥ 0.95', value: 0.95 },
  ],
  settings: [
    {
      id: 'numPeaks',
      label: 'Peaks to generate',
      description: 'The number of peaks to place in the solution space.',
      value: 7
    },
    {
      id: 'seed',
      label: 'Seed heights',
      description: 'Seed to help randomly generate heights.',
      value: 42
    }
  ]
});
