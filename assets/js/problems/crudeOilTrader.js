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

/* ── CRUDE OIL FUTURES OPTIONS TRADER ────────────────────────────────────────
 *
 * OVERVIEW
 * ────────
 * The genome encodes the parameters of a systematic trading strategy applied
 * to WTI Crude Oil futures (CL).  Each organism represents one strategy
 * variant; the evolutionary engine searches the parameter space to maximise
 * risk-adjusted return (Sharpe-like score).
 *
 * STRATEGY: Momentum / Mean-Reversion with Options overlays
 * ──────────────────────────────────────────────────────────
 * On each bar the strategy evaluates two signals:
 *
 *   1. MOMENTUM (trend-following)
 *      If the fast EMA crosses above the slow EMA by more than
 *      `momentumThreshold`, go LONG; crossing below goes SHORT.
 *      Implemented as a futures position (no premium cost).
 *
 *   2. OPTIONS OVERLAY (mean-reversion income / protection)
 *      When RSI > `rsiBuyThreshold`  → sell a covered CALL (cap upside,
 *                                      collect premium, reduce exposure).
 *      When RSI < `rsiSellThreshold` → sell a cash-secured PUT (collect
 *                                      premium, potentially acquire at
 *                                      discount if exercised).
 *      Strike distance and days-to-expiry are genome parameters.
 *      Black-Scholes is used for premium pricing.
 *
 * GENOME (all values in [0, 1] before scaling — same convention as PeakFinder)
 * ─────────────────────────────────────────────────────────────────────────────
 *  [0] fastEmaLen       scaled to [3, 30]   bars
 *  [1] slowEmaLen       scaled to [10, 120]  bars   (always > fast)
 *  [2] momentumThresh   scaled to [0, 0.05]  fraction of price
 *  [3] rsiLen           scaled to [5, 30]    bars
 *  [4] rsiBuyThresh     scaled to [55, 85]   RSI level (sell call above)
 *  [5] rsiSellThresh    scaled to [15, 45]   RSI level (sell put below)
 *  [6] strikeOffset     scaled to [0.01, 0.10] fraction OTM for options
 *  [7] optionDTE        scaled to [7, 45]    days to expiry
 *  [8] positionSize     scaled to [0.05, 1.0] fraction of account per trade
 *  [9] stopLoss         scaled to [0.01, 0.15] max loss fraction before exit
 *
 * PRICE DATA
 * ──────────
 * ~500 daily OHLCV bars of synthetic WTI Crude Oil are generated
 * deterministically from a seed using a realistic GBM + mean-reversion +
 * volatility-clustering model.  No network calls required.
 *
 * FITNESS
 * ───────
 * fitness = sigmoid( sharpeRatio / 3 )   mapped to [0, 1]
 * A Sharpe of ≥ 3 maps to ≈ 0.95+ fitness; Sharpe ≤ 0 maps to ≤ 0.5.
 *
 * ──────────────────────────────────────────────────────────────────────────── */

/* ── UTILITIES ────────────────────────────────────────────────────────────── */

/** Fast seedable LCG RNG (same algorithm as PeakFinder for consistency). */
function makePrng(seed) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Clamp value to [lo, hi]. */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Standard-normal sample via Box-Muller. */
function boxMuller(rand) {
  const u1 = Math.max(1e-12, rand());
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Sigmoid mapping ℝ → (0, 1). */
const sigmoid = x => 1 / (1 + Math.exp(-x));

/** Cumulative standard normal (Hart approximation, sufficient for options). */
function normCDF(x) {
  const t = 1 / (1 + 0.2315419 * Math.abs(x));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const pdf  = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const c    = 1 - pdf * poly;
  return x >= 0 ? c : 1 - c;
}

/**
 * Black-Scholes option premium.
 * @param {string} type     'call' | 'put'
 * @param {number} S        spot price
 * @param {number} K        strike price
 * @param {number} T        time to expiry in years
 * @param {number} r        risk-free rate (fraction, e.g. 0.05)
 * @param {number} sigma    implied volatility (fraction annualised)
 */
function blackScholes(type, S, K, T, r, sigma) {
  if (T <= 0 || S <= 0 || K <= 0 || sigma <= 0) return 0;
  const sqrtT = Math.sqrt(T);
  const d1    = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2    = d1 - sigma * sqrtT;
  if (type === 'call') return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
  return K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
}

/* ── SYNTHETIC PRICE DATA GENERATOR ─────────────────────────────────────── */

/**
 * Generate `numBars` daily OHLCV bars for WTI Crude Oil.
 * Model: GBM with mean-reversion (Ornstein-Uhlenbeck drift) + GARCH(1,1)
 * volatility clustering.
 *
 * Typical WTI parameters reproduced:
 *   starting price ~$75,  annualised vol ~35%,  mean-reversion half-life ~120d
 */
function generateCrudeBars(numBars, seed, startPrice = 75) {
  const rand = makePrng(seed);

  // GARCH parameters
  const omega = 0.000002;
  const alpha = 0.08;     // weight on lagged squared shock
  const beta  = 0.90;     // weight on lagged variance
  const annualMean = 0.03;  // long-run drift (3 % pa)
  const meanRevLevel = startPrice;
  const kappa = 0.003;      // daily mean-reversion speed (~120-day half-life)
  const riskFreeRate = 0.05;
  const tradingDaysPerYear = 252;
  const dt = 1 / tradingDaysPerYear;

  const bars = [];
  let price   = startPrice;
  let variance = (0.35 * 0.35) / tradingDaysPerYear; // initial daily variance

  for (let i = 0; i < numBars; i++) {
    // Update GARCH variance
    const shock = boxMuller(rand);
    const prevDailyReturn = i === 0 ? 0 : (bars[i - 1].close - (i > 1 ? bars[i - 2].close : startPrice)) / (i > 1 ? bars[i - 2].close : startPrice);
    variance = clamp(omega + alpha * prevDailyReturn * prevDailyReturn + beta * variance, 1e-8, 0.05);

    const sigma = Math.sqrt(variance);
    const muDaily = (annualMean - 0.5 * variance * tradingDaysPerYear) * dt
        + kappa * (meanRevLevel - price); // mean-reversion pull

    const dailyReturn = muDaily + sigma * shock;
    const open   = price;
    const close  = Math.max(1, price * (1 + dailyReturn));
    const hiMult = 1 + Math.abs(boxMuller(rand)) * sigma * 0.6;
    const loMult = 1 - Math.abs(boxMuller(rand)) * sigma * 0.6;
    const high   = Math.max(open, close) * hiMult;
    const low    = Math.min(open, close) * loMult;
    const volume = Math.floor(200000 + rand() * 800000);

    bars.push({ open, high, low, close, volume });
    price = close;
  }
  return bars;
}

/* ── TECHNICAL INDICATORS ────────────────────────────────────────────────── */

/** Compute EMA series of given length over a close-price array. */
function computeEMA(closes, len) {
  const k   = 2 / (len + 1);
  const ema = new Float64Array(closes.length);
  ema[0]    = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

/** Compute RSI series of given length. */
function computeRSI(closes, len) {
  const rsi = new Float64Array(closes.length);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= len; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss += -d;
  }
  avgGain /= len; avgLoss /= len;
  rsi[len] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = len + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (len - 1) + g) / len;
    avgLoss = (avgLoss * (len - 1) + l) / len;
    rsi[i]  = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

/** Historical 20-bar realised volatility (annualised). */
function computeVol(closes, winLen = 20) {
  const vol = new Float64Array(closes.length);
  for (let i = winLen; i < closes.length; i++) {
    let sumSq = 0;
    for (let j = i - winLen + 1; j <= i; j++) {
      const r = Math.log(closes[j] / closes[j - 1]);
      sumSq  += r * r;
    }
    vol[i] = Math.sqrt(sumSq / winLen * 252);
  }
  // fill early bars with first valid value
  for (let i = 0; i < winLen; i++) vol[i] = vol[winLen];
  return vol;
}

/* ── BACKTEST ENGINE ─────────────────────────────────────────────────────── */

/**
 * Run the strategy backtest.
 *
 * @param {Float32Array|number[]} gv   raw genome vector [0..1] values
 * @param {object}                p    params (bars, riskFreeRate, etc.)
 * @param {number}                acct initial account value ($)
 * @returns {{ finalValue, sharpe, maxDrawdown, numTrades, equity[] }}
 */
function runBacktest(gv, p, acct) {
  const { bars, riskFreeRate } = p;
  const N = bars.length;
  const closes = new Float64Array(N);
  for (let i = 0; i < N; i++) closes[i] = bars[i].close;

  // ── Decode genome ──────────────────────────────────────────────
  const fastLen    = Math.max(3,  Math.round(3   + gv[0] * 27));
  let   slowLen    = Math.max(10, Math.round(10  + gv[1] * 110));
  if (slowLen <= fastLen) slowLen = fastLen + 5;

  const momThresh    = gv[2] * 0.05;
  const rsiLen       = Math.max(5, Math.round(5 + gv[3] * 25));
  const rsiBuyThresh = 55 + gv[4] * 30;   // [55, 85]
  const rsiSellThresh= 15 + gv[5] * 30;   // [15, 45]
  const strikeOffset = 0.01 + gv[6] * 0.09;
  const optionDTE    = Math.round(7 + gv[7] * 38);
  const posSize      = 0.05 + gv[8] * 0.95;
  const stopLoss     = 0.01 + gv[9] * 0.14;

  // ── Pre-compute indicators ─────────────────────────────────────
  const fastEMA = computeEMA(closes, fastLen);
  const slowEMA = computeEMA(closes, slowLen);
  const rsi     = computeRSI(closes, rsiLen);
  const hVol    = computeVol(closes);

  // ── Sim state ─────────────────────────────────────────────────
  const warmup      = slowLen + rsiLen + 2;
  let   cash        = acct;
  let   futuresPnL  = 0;     // open futures P&L (mark-to-market)
  let   futuresPos  = 0;     // +1 long, -1 short, 0 flat (1 contract = 100 bbl)
  let   futuresEntry= 0;
  let   optionPnL   = 0;
  let   numTrades   = 0;
  const CONTRACT    = 100;   // barrels per futures contract (simplified)

  // Active short option: { type, strike, premium, expireBar }
  let   activeOption = null;

  const equity = new Float32Array(N);
  let   peak   = acct;
  let   maxDD  = 0;

  // Daily risk-free rate for Sharpe
  const rfDaily = riskFreeRate / 252;
  const returns = [];

  for (let i = 0; i < N; i++) {
    const price  = closes[i];
    const prevEq = cash + futuresPnL + optionPnL;

    // Mark-to-market futures
    if (futuresPos !== 0) {
      futuresPnL = futuresPos * (price - futuresEntry) * CONTRACT;

      // Stop-loss check
      const pctLoss = -futuresPnL / acct;
      if (pctLoss > stopLoss) {
        cash      += futuresPnL;
        futuresPnL = 0;
        futuresPos = 0;
        numTrades++;
      }
    }

    // Expire / exercise short option
    if (activeOption && i >= activeOption.expireBar) {
      const opt = activeOption;
      let settlePnL = opt.premium; // we keep premium if OTM
      if (opt.type === 'call' && price > opt.strike) {
        // ITM call: we owe the difference (short call losses)
        settlePnL -= (price - opt.strike) * CONTRACT;
      } else if (opt.type === 'put' && price < opt.strike) {
        // ITM put: we owe the difference
        settlePnL -= (opt.strike - price) * CONTRACT;
      }
      optionPnL   = 0;
      cash       += settlePnL;
      activeOption = null;
    }

    // Mark-to-market open short option (unrealised)
    if (activeOption) {
      const T = (activeOption.expireBar - i) / 252;
      const sigma = Math.max(0.05, hVol[i]);
      const curVal = blackScholes(activeOption.type, price, activeOption.strike, T, riskFreeRate, sigma);
      optionPnL = (activeOption.premium - curVal) * CONTRACT; // short = we profit when value drops
    }

    // ── SIGNAL LOGIC (skip warmup) ─────────────────────────────
    if (i >= warmup) {
      const fema  = fastEMA[i];
      const sema  = slowEMA[i];
      const diff  = (fema - sema) / sema;
      const rsiV  = rsi[i];
      const sigma = Math.max(0.05, hVol[i]);

      // Momentum signal → futures direction
      const newFutDir = diff > momThresh ? 1 : diff < -momThresh ? -1 : 0;

      if (newFutDir !== futuresPos) {
        // Close existing futures position
        if (futuresPos !== 0) {
          cash      += futuresPnL;
          futuresPnL = 0;
          numTrades++;
        }
        // Size the new position (fraction of account equity)
        const availCash  = cash;
        const contractVal = price * CONTRACT;
        const maxContracts= Math.max(0, Math.floor(availCash * posSize / contractVal));

        if (newFutDir !== 0 && maxContracts > 0) {
          futuresPos  = newFutDir;
          futuresEntry= price;
          numTrades++;
        } else {
          futuresPos = 0;
        }
      }

      // Options overlay — only write one option at a time
      if (!activeOption) {
        const T        = optionDTE / 252;
        const optContracts = 1; // 1 short option contract

        if (rsiV > rsiBuyThresh) {
          // Elevated RSI → sell OTM call (collect premium, cap upside)
          const K       = price * (1 + strikeOffset);
          const premium = blackScholes('call', price, K, T, riskFreeRate, sigma) * optContracts * CONTRACT;
          if (premium > 1) {
            activeOption = { type: 'call', strike: K, premium, expireBar: i + optionDTE };
          }
        } else if (rsiV < rsiSellThresh) {
          // Depressed RSI → sell OTM put (collect premium, risk buying at discount)
          const K       = price * (1 - strikeOffset);
          const premium = blackScholes('put', price, K, T, riskFreeRate, sigma) * optContracts * CONTRACT;
          if (premium > 1) {
            activeOption = { type: 'put', strike: K, premium, expireBar: i + optionDTE };
          }
        }
      }
    }

    // ── Record equity ──────────────────────────────────────────
    const eq = Math.max(0, cash + futuresPnL + optionPnL);
    equity[i] = eq;
    if (eq > peak) peak = eq;
    const dd = (peak - eq) / peak;
    if (dd > maxDD) maxDD = dd;

    if (i > 0) returns.push((eq - prevEq) / Math.max(1, prevEq) - rfDaily);
  }

  // ── Sharpe ratio ──────────────────────────────────────────────
  const n   = returns.length;
  const mu  = n > 0 ? returns.reduce((a, b) => a + b, 0) / n : 0;
  const variance = n > 1 ? returns.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1) : 1e-9;
  const sharpe   = (mu / Math.sqrt(Math.max(1e-12, variance))) * Math.sqrt(252);

  return {
    finalValue: equity[N - 1],
    sharpe,
    maxDrawdown: maxDD,
    numTrades,
    equity
  };
}

/* ── VISUALIZE HELPERS ───────────────────────────────────────────────────── */

function drawEquityCurve(ctx, equity, x0, y0, w, h, color, lineWidth = 1.5) {
  const n   = equity.length;
  const min = Math.min(...equity);
  const max = Math.max(...equity);
  const rng = Math.max(max - min, 1);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineWidth;
  for (let i = 0; i < n; i++) {
    const px = x0 + (i / (n - 1)) * w;
    const py = y0 + h - ((equity[i] - min) / rng) * h;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function fmtMoney(v) {
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtPct(v) {
  return (v * 100).toFixed(1) + '%';
}

/* ── THE PROBLEM CLASS ───────────────────────────────────────────────────── */

class CrudeOilTrader extends Problem {
  constructor(config = {}) {
    super(config);
    this._cache = null; // { seed, numBars, bars }
  }

  /**
   * Lazily build or re-use bar data.
   * Returns the current bars array, rebuilding if settings changed.
   */
  _getBars() {
    const numBars = this.settings.find(s => s.id === 'numBars').value;
    const seed    = this.settings.find(s => s.id === 'seed').value;
    const start   = this.settings.find(s => s.id === 'startPrice').value;

    if (!this._cache || this._cache.seed !== seed || this._cache.numBars !== numBars || this._cache.start !== start) {
      this._cache = { seed, numBars, start, bars: generateCrudeBars(numBars, seed, start) };
    }
    return this._cache.bars;
  }

  regenerate(args) {
    // args[0] = initialAccount, args[1] = numBars, args[2] = startPrice
    // args[3] = seed, args[4] = riskFreeRate
    const numBarsIdx   = this.settings.findIndex(s => s.id === 'numBars');
    const seedIdx      = this.settings.findIndex(s => s.id === 'seed');
    const startPriceIdx= this.settings.findIndex(s => s.id === 'startPrice');
    if (args[0] !== undefined && numBarsIdx >= 0)    this.settings[numBarsIdx].value    = args[numBarsIdx];
    if (args[1] !== undefined && seedIdx >= 0)       this.settings[seedIdx].value       = args[seedIdx];
    if (args[2] !== undefined && startPriceIdx >= 0) this.settings[startPriceIdx].value = args[startPriceIdx];
    this._cache = null; // force rebuild
  }

  evaluate(chromosomeVector, expressed, organism) {
    const gv    = expressed?.length >= 10 ? expressed : chromosomeVector;
    const bars  = this._getBars();
    const acct  = this.settings.find(s => s.id === 'initialAccount').value;
    const rf    = this.settings.find(s => s.id === 'riskFreeRate').value / 100;

    const result = runBacktest(gv, { bars, riskFreeRate: rf }, acct);

    // Cache on organism for visualise
    if (organism) organism._cotResult = result;

    // Fitness: sigmoid of Sharpe scaled by drawdown penalty
    const drawdownPenalty = Math.max(0, 1 - result.maxDrawdown * 2);
    const rawScore = result.sharpe * drawdownPenalty;
    return clamp(sigmoid(rawScore / 2), 0, 1);
  }

  visualize(canvas, population, goal) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    this.clearCanvas(canvas, ctx);

    const bars  = this._getBars();
    const N     = bars.length;
    const acct  = this.settings.find(s => s.id === 'initialAccount').value;

    /* ── Panel layout ───────────────────────────────────────────── */
    const MARGIN = { top: 28, left: 8, right: 8, bottom: 8 };
    const GAP    = 6;

    // Top 40%: price chart, Bottom 40%: equity curves, middle 20%: stats
    const priceH  = Math.floor((H - MARGIN.top - MARGIN.bottom) * 0.40);
    const statsH  = Math.floor((H - MARGIN.top - MARGIN.bottom) * 0.20);
    const equityH = H - MARGIN.top - MARGIN.bottom - priceH - statsH;

    const panelW  = W - MARGIN.left - MARGIN.right;
    const priceY  = MARGIN.top;
    const statsY  = priceY + priceH + GAP;
    const equityY = statsY + statsH + GAP;

    /* ── Title ──────────────────────────────────────────────────── */
    ctx.font      = 'bold 12px monospace';
    ctx.fillStyle = '#c8d0e0';
    ctx.fillText('WTI CRUDE OIL — Momentum + Options Overlay Strategy', MARGIN.left, 18);

    /* ── PRICE CHART ────────────────────────────────────────────── */
    const closes    = bars.map(b => b.close);
    const priceMin  = Math.min(...closes) * 0.98;
    const priceMax  = Math.max(...closes) * 1.02;
    const priceRng  = priceMax - priceMin;
    const toCanvasY = v => priceY + priceH - ((v - priceMin) / priceRng) * priceH;

    // Candles (draw every bar if narrow, else subsample)
    const step = Math.max(1, Math.floor(N / panelW));
    for (let i = 0; i < N; i += step) {
      const b  = bars[i];
      const px = MARGIN.left + (i / (N - 1)) * panelW;
      const cw = Math.max(1, (panelW / N) * step - 1);
      const bull = b.close >= b.open;
      const col  = bull ? '#22c55e' : '#ef4444';

      // Wick
      ctx.strokeStyle = col;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(px, toCanvasY(b.high));
      ctx.lineTo(px, toCanvasY(b.low));
      ctx.stroke();

      // Body
      const top = toCanvasY(Math.max(b.open, b.close));
      const bot = toCanvasY(Math.min(b.open, b.close));
      ctx.fillStyle = col;
      ctx.fillRect(px - cw / 2, top, cw, Math.max(1, bot - top));
    }

    // Overlay best organism's EMAs if available
    const best = population?.bestOrganism;
    if (best) {
      const gv      = best.expressed?.length >= 10 ? best.expressed : best.genome?.chromosomes ?? [];
      const fastLen = Math.max(3,  Math.round(3  + (gv[0] ?? 0.5) * 27));
      let   slowLen = Math.max(10, Math.round(10 + (gv[1] ?? 0.5) * 110));
      if (slowLen <= fastLen) slowLen = fastLen + 5;

      const fEMA = computeEMA(closes, fastLen);
      const sEMA = computeEMA(closes, slowLen);

      const drawLine = (series, color) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;
        for (let i = slowLen; i < N; i++) {
          const px = MARGIN.left + (i / (N - 1)) * panelW;
          const py = toCanvasY(series[i]);
          i === slowLen ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      };
      drawLine(fEMA, '#60a5fa');
      drawLine(sEMA, '#f59e0b');
    }

    // Price panel border
    ctx.strokeStyle = '#2a3040';
    ctx.lineWidth   = 1;
    ctx.strokeRect(MARGIN.left, priceY, panelW, priceH);

    // Price axis labels
    ctx.fillStyle = '#6a7590';
    ctx.font      = '9px monospace';
    for (let tick = 0; tick <= 4; tick++) {
      const v  = priceMin + (priceRng * tick) / 4;
      const py = toCanvasY(v);
      ctx.fillText('$' + v.toFixed(1), MARGIN.left + 2, py - 2);
    }

    /* ── STATS PANEL (middle band) ──────────────────────────────── */
    if (population?.organisms) {
      const alive = population.organisms.filter(o => o.alive);

      // Collect stats from all cached results
      const results = alive
      .map(o => o._cotResult)
      .filter(Boolean)
      .sort((a, b) => b.sharpe - a.sharpe);

      const bestR = population.bestOrganism?._cotResult;

      ctx.fillStyle = '#1a2030';
      ctx.fillRect(MARGIN.left, statsY, panelW, statsH);
      ctx.strokeStyle = '#2a3040';
      ctx.strokeRect(MARGIN.left, statsY, panelW, statsH);

      ctx.font      = 'bold 10px monospace';
      ctx.fillStyle = '#8090a8';
      ctx.fillText('BEST STRATEGY METRICS', MARGIN.left + 6, statsY + 14);

      if (bestR) {
        const returnPct = (bestR.finalValue - acct) / acct;
        const metrics   = [
          { label: 'Return',      value: fmtPct(returnPct),          color: returnPct >= 0 ? '#22c55e' : '#ef4444' },
          { label: 'Sharpe',      value: bestR.sharpe.toFixed(2),    color: bestR.sharpe > 1.5 ? '#22c55e' : bestR.sharpe > 0.5 ? '#f59e0b' : '#ef4444' },
          { label: 'Max DD',      value: fmtPct(-bestR.maxDrawdown), color: bestR.maxDrawdown < 0.15 ? '#22c55e' : bestR.maxDrawdown < 0.30 ? '#f59e0b' : '#ef4444' },
          { label: 'Trades',      value: String(bestR.numTrades),    color: '#c8d0e0' },
          { label: 'Final Value', value: fmtMoney(bestR.finalValue), color: '#c8d0e0' },
        ];

        const colW = panelW / metrics.length;
        metrics.forEach((m, idx) => {
          const mx = MARGIN.left + colW * idx + 6;
          ctx.font      = '9px monospace';
          ctx.fillStyle = '#6a7590';
          ctx.fillText(m.label, mx, statsY + 28);
          ctx.font      = 'bold 11px monospace';
          ctx.fillStyle = m.color;
          ctx.fillText(m.value, mx, statsY + 42);
        });
      }

      // Goal line indicator
      if (goal !== undefined) {
        ctx.font      = '9px monospace';
        ctx.fillStyle = '#f0a500';
        ctx.fillText('Target fitness: ' + goal.toFixed(2), MARGIN.left + panelW - 110, statsY + 14);
      }
    }

    /* ── EQUITY CURVE PANEL ─────────────────────────────────────── */
    ctx.fillStyle   = '#12181f';
    ctx.fillRect(MARGIN.left, equityY, panelW, equityH);
    ctx.strokeStyle = '#2a3040';
    ctx.lineWidth   = 1;
    ctx.strokeRect(MARGIN.left, equityY, panelW, equityH);

    ctx.font      = 'bold 10px monospace';
    ctx.fillStyle = '#8090a8';
    ctx.fillText('EQUITY CURVES', MARGIN.left + 6, equityY + 12);

    // Flat "buy & hold" baseline
    const lastClose = bars[N - 1].close;
    const firstClose= bars[0].close;
    const bnh       = new Float32Array(N);
    for (let i = 0; i < N; i++) bnh[i] = acct * (bars[i].close / firstClose);
    drawEquityCurve(ctx, bnh, MARGIN.left, equityY + 16, panelW, equityH - 20, '#334155', 1);

    // Draw population equity curves (dimmed)
    if (population?.organisms) {
      for (const org of population.organisms) {
        if (!org.alive || !org._cotResult) continue;
        const col = this.typeColor(org.type);
        drawEquityCurve(ctx, org._cotResult.equity, MARGIN.left, equityY + 16, panelW, equityH - 20, col + '44', 1);
      }

      // Best organism on top
      const bestR = population.bestOrganism?._cotResult;
      if (bestR) {
        const col = this.typeColor(population.bestOrganism.type);
        drawEquityCurve(ctx, bestR.equity, MARGIN.left, equityY + 16, panelW, equityH - 20, col, 2);

        // Crown marker on best final point
        const bfinal = bestR.equity;
        const minE   = Math.min(...bfinal);
        const maxE   = Math.max(...bfinal);
        const finalPx= MARGIN.left + panelW;
        const finalPy= equityY + 16 + (equityH - 20) - ((bfinal[N - 1] - minE) / Math.max(1, maxE - minE)) * (equityH - 20);
        ctx.beginPath();
        ctx.arc(finalPx, finalPy, 4, 0, Math.PI * 2);
        ctx.fillStyle   = '#f0a500';
        ctx.fill();
      }
    }

    // Equity panel labels
    ctx.font      = '9px monospace';
    ctx.fillStyle = '#334155';
    ctx.fillText('── Buy & Hold', MARGIN.left + panelW - 90, equityY + 12);
  }
}

/* ── EXPORT INSTANCE ─────────────────────────────────────────────────────── */

export const COT = new CrudeOilTrader({
  id: 'crudeOilTrader',
  label: 'Crude Oil Trader',
  description:
      'Evolve a systematic trading strategy for WTI Crude Oil futures. ' +
      'Genomes encode EMA crossover windows, RSI thresholds, OTM option ' +
      'parameters, position sizing, and stop-loss. ' +
      'Fitness = Sharpe ratio (drawdown-penalised), mapped to [0, 1].',
  goalLabel: 'Target fitness (≈ Sharpe-based score)',

  params: {},  // bars generated lazily from settings

  goals: [
    { label: 'Fit > 0.55 (Sharpe ≈ 0.2)', value: 0.55 },
    { label: 'Fit > 0.65 (Sharpe ≈ 0.7)', value: 0.65 },
    { label: 'Fit > 0.75 (Sharpe ≈ 1.5)', value: 0.75 },
    { label: 'Fit > 0.82 (Sharpe ≈ 2.5)', value: 0.82 },
  ],

  settings: [
    {
      id: 'initialAccount',
      label: 'Initial Account ($)',
      description: 'Starting capital for the simulated trading account.',
      value: 100000
    },
    {
      id: 'numBars',
      label: 'History bars',
      description: 'Number of daily OHLCV bars to simulate (~trading days). 252 ≈ 1 year.',
      value: 504
    },
    {
      id: 'startPrice',
      label: 'WTI Start Price ($)',
      description: 'Initial WTI crude oil price used for synthetic data generation.',
      value: 75
    },
    {
      id: 'seed',
      label: 'Price series seed',
      description: 'Seed for the synthetic price generator. Change to test on different market regimes.',
      value: 42
    },
    {
      id: 'riskFreeRate',
      label: 'Risk-free rate (%)',
      description: 'Annualised risk-free rate (%) used for Sharpe calculation and Black-Scholes pricing.',
      value: 5.0
    }
  ]
});
