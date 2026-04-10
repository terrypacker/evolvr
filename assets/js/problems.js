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
   PROBLEMS.JS  —  Optimization Problem Definitions
   ─────────────────────────────────────────────────────────────
   Each problem must be of class Problem:
   {
     id:          string           unique identifier
     label:       string           display name
     description: string           short description
     goalLabel:   string           what the goal value means
     params:      object           passed to gene.fn and evaluate
     goals: [                      selectable target values
       { label, value }
     ],
     settings:    array            array of settings that can be adjusted

     evaluate(genome, expressed, organism) → number [0, 1]
                                  1 = perfect fitness
     visualize(canvas, population, goal)
                                  draw to a canvas element
   }

   TO ADD A NEW PROBLEM: just push a new object into this array.
   The UI will pick it up automatically.
   ============================================================= */

import { OrganismTypes } from './organism.js';

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
  evaluate(chromosomeVector, expressed, organism) {
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
