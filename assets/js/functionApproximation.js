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
import { PolyFit } from './polyfit.js';

/* ── PROBLEM: FUNCTION APPROXIMATION ─────────────────────── */
class FunctionApproximation extends Problem {
  constructor(config = {}) {
    super(config);
    this._targetFn = (x) => {
      return Math.sin(x * Math.PI * 2) * 0.5 + 0.5
      //return x + 0.2 * Math.pow(x,2) + 0.3 * Math.pow(x,3) + 0.4 * Math.pow(x,4)
    };
    this.predictionMode = 'COEFFICIENTS'; //['COEFFICIENTS','POLYFIT'];
    this.fitnessMode = 'MSE'; //['MSE', 'SMOOTH']
    this.yTrue = [];
    this.xTrue = [];
    this._generateFit();
  }

  /**
   * Evaluate the polynomial over the X values
   * @private
   */
  _generateFit() {
    const n   = this.params.samples;
    for (let i = 0; i < n; i++) {
      const x    = i / (n - 1);
      this.xTrue.push(x);
      const tgt  = this._targetFn(x);
      this.yTrue.push(tgt);
    }
  }

  regenerate(args) {
    this._targetFn = new Function("x", args[0]);
    this._generateFit();
  }

  evaluate(chromosomes, expressed, organism) {
    //Compute coefficients
    let coefficients = this._computeCoefficients(expressed);

    const yPred = [];
    for (let i = 0; i < this.xTrue.length; i++) {
      const x = this.xTrue[i];
      const pred = this._evaluatePolynomial(coefficients, x);
      yPred.push(pred);
    }

    //Evaluate fitness of prediction
    if(this.fitnessMode === 'MSE') {
      return this._polynomialFitness(yPred);
    }else if(this.fitnessMode === 'SMOOTH') {
      return this._smoothFitness(yPred);
    }else {
      throw new Error('Unknown fitness mode ' + this.fitnessMode);
    }
  }

  /**
   * Compute the coefficients of the polynomial using genes in
   * the configured mode
   * @param expressed
   * @returns {Array}
   * @private
   */
  _computeCoefficients(expressed) {
    if(this.predictionMode === 'COEFFICIENTS') {
      return this._expressPolyCoeffs(expressed); //Nothing to do, these are our coeffs
    }else if(this.predictionMode === 'POLYFIT') {
      return this._expressPolyfit(expressed);
    }else {
      throw new Error('Unknown prediction mode ' + this.predictionMode);
    }
  }

  /**
   * Express genes as polynomial coefficients by
   * scaling each to between -10 to 10
   * @param expressed - genes to use
   * @returns {Array} - of predicted values
   * @private
   */
  _expressPolyCoeffs(expressed) {
    return expressed.map(v => -10 + 20 * v)
  }

  /**
   * Evaluate by using expressed to compute a polynomial degree which
   * creates a polynomial we then compare.
   * @param expressed - genes to use
   * @return {Array} - predicted y values
   * @private
   */
   _expressPolyfit(expressed) {
    const n   = this.params.samples;
    const degree = expressed.reduce((s,g) => s + g, 0);
    return PolyFit.polyFit(this.xTrue, this.yTrue, degree);
  }

  /**
   * Horner's method to evaluate polynomials efficiently
   */
  _evaluatePolynomial(coefficients, x) {
    // genome = [a0, a1, a2, ...] → Σ aᵢ * xⁱ
    return coefficients.reduce((sum, c, i) => {
      return sum + c * Math.pow(x, i)
    }, 0);
  }

  /**
   * Calculate the fitness of the fit of our genome by comparing to
   * the MSE to the variance
   * - clamped to [0,1].
   * - MSE = variance → “no skill” model
   * - MSE < variance → good
   * - MSE > variance → worse than guessing the mean
   *
   * @param yPred
   * @returns {number}
   * @private
   */
  _polynomialFitness(yPred) {
    if (this.yTrue.length !== yPred.length) {
      throw new Error("Arrays must have the same length");
    }

    const n = this.yTrue.length;

    // --- Mean of yTrue ---
    const mean =
        this.yTrue.reduce((sum, v) => sum + v, 0) / n;

    // --- Variance (baseline error) ---
    let variance = 0;
    for (let i = 0; i < n; i++) {
      const diff = this.yTrue[i] - mean;
      variance += diff * diff;
    }
    variance /= n;

    // Avoid divide-by-zero if data is constant
    if (variance === 0) {
      return 1; // perfect fit (all values identical)
    }

    // --- MSE ---
    let mse = 0;
    for (let i = 0; i < n; i++) {
      const diff = this.yTrue[i] - yPred[i];
      mse += diff * diff;
    }
    mse /= n;

    // --- Normalize and invert ---
    let fitness = 1 - (mse / variance);

    // --- Clamp to [0, 1] ---
    fitness = Math.max(0, Math.min(1, fitness));

    return fitness;
  }

  /**
   * Give a smoother fit.
   * - Always in (0,1]
   * - More gradient-friendly (great for optimization / evolution)
   * - By using an exponential you won’t get everything worse than baseline to collapse to 0
   * @param yPred - predicted y values by polynomial
   * @returns {number}
   * @private
   */
  _smoothFitness(yPred) {
    const n = this.yTrue.length;

    const mean = this.yTrue.reduce((s, v) => s + v, 0) / n;

    let variance = 0, mse = 0;

    for (let i = 0; i < n; i++) {
      const d1 = this.yTrue[i] - mean;
      variance += d1 * d1;

      const d2 = this.yTrue[i] - yPred[i];
      mse += d2 * d2;
    }

    variance /= n;
    mse /= n;

    if (variance === 0) return 1;

    // Smooth decay instead of hard cutoff
    return Math.exp(-mse / variance);
  }

  visualize(canvas, population, goal) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    this.clearCanvas(canvas, ctx);

    const pad = 20;
    const iW  = W - pad * 2;
    const iH  = H - pad * 2;

    const toX = (x) => pad + x * iW;
    const toY = (y) => pad + (1 - y) * iH;

    // Grid lines
    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= 4; i++) {
      const yv = i / 4;
      ctx.beginPath();
      ctx.moveTo(pad, toY(yv));
      ctx.lineTo(pad + iW, toY(yv));
      ctx.stroke();
    }

    // Target function
    ctx.beginPath();
    ctx.strokeStyle = '#f0a50060';
    ctx.lineWidth   = 2;
    for (let px = 0; px <= iW; px++) {
      const x   = px / iW;
      const y   = this._targetFn(x);
      px === 0 ? ctx.moveTo(toX(x), toY(y)) : ctx.lineTo(toX(x), toY(y));
    }
    ctx.stroke();

    // Draw each organism's curve
    if (population?.organisms) {
      const sorted = [...population.organisms].sort((a, b) => a.fitness - b.fitness);
      for (const org of sorted) {
        const ex  = org.express({});
        const col = this.typeColor(org.type);
        const alpha = 0.15 + org.fitness * 0.5;
        ctx.beginPath();
        ctx.strokeStyle = col + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = org.id === population.bestOrganism?.id ? 5 : 1;

        for (let px = 0; px <= iW; px++) {
          const x   = px / iW;
          const coefficients = this._computeCoefficients(ex);
          const y = this._evaluatePolynomial(coefficients, x);
          px === 0 ? ctx.moveTo(toX(x), toY(y)) : ctx.lineTo(toX(x), toY(y));
        }
        ctx.stroke();
      }
    }

    this.drawColoredText(ctx, [
      { text: 'TARGET', color: '#f0a50060' },
      { text: ' vs POPULATION', color: '#929db9' }
    ], pad, H - (pad/2));
  }

}
export const FA =  new FunctionApproximation({
  id: 'funcApprox',
  label: 'Function Approximation',
  description: 'Evolve a polynomial whose genome encodes coefficients. Fitness is how closely it matches a target function over [0,1].',
  goalLabel: 'Max MSE error (lower = harder)',
  goalDesc: '',
  params: { samples: 20 },
  goals: [
    { label: 'MSE < 0.05', value: 0.05 },
    { label: 'MSE < 0.02', value: 0.02 },
    { label: 'MSE < 0.01', value: 0.01 },
    { label: 'MSE < 0.005', value: 0.005 },
  ],
  settings: [
    {
      id: 'targetFn',
      label: 'Target function',
      description: 'The function to evaluate the solutions against, this must return a y value for each x supplied.',
      value: 'return Math.sin(x * Math.PI * 2) * 0.5 + 0.5',
      element: 'textarea',
      flex: '0 1 100%'
    },
    {
      id: 'predictionMode',
      label: 'Prediction mode',
      description: 'How to use the genes to fit a polynomial curve.',
      value: 'COEFFICIENTS',
      selectValues: [{id: 'COEFFICIENTS', label: 'Coefficient Scale'}, {id: 'POLYFIT', label: 'Polynomial Degree'}]
    },
    {
      id: 'fitnessMode',
      label: 'Fitness mode',
      description: 'How to evaluate the fitness of the predicted polynomail',
      value: 'MSE',
      selectValues: [{id: 'MSE', label: 'Mean square error'}, {id: 'SMOOTH', label: 'Smooth fit'}]
    }
  ]
});
