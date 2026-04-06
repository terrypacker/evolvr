/* =============================================================
   APP.JS  —  UI Controller & Simulation Loop
   ============================================================= */

import { Population, OrganismTypes, GeneRegistry } from './engine.js';
import { Problems } from './problems.js';
import {
  openOrganismList,
  openGeneList,
  openGeneEditor,
  openOrganismTypeEditor,
  openOrganismEditor
} from './modals.js';
import { openHelp } from './help.js';

/* ── ORGANISM TYPE DEFINITIONS ──────────────────────────────── */
OrganismTypes.register({
  id: 'explorer', label: 'Explorer', color: '#f0a500',
  description: 'Broad search, high mutation, favours diversity',
  genomeLength: 12,
  genePool:     ['boundaryPush', 'randomWalk', 'mirrorFold', 'gaussianNoise'],
  mutationRate: 0.18, mutationScale: 0.28,
});
OrganismTypes.register({
  id: 'climber', label: 'Climber', color: '#00d4e8',
  description: 'Local hill-climbing, conservative mutations',
  genomeLength: 12,
  genePool:     ['gradientNudge', 'elitePull', 'sinTransform'],
  mutationRate: 0.06, mutationScale: 0.10,
});
OrganismTypes.register({
  id: 'optimizer', label: 'Optimizer', color: '#39e080',
  description: 'Mathematical transforms, ranked selection',
  genomeLength: 12,
  genePool:     ['sinTransform', 'normalize', 'rankSort', 'gradientNudge'],
  mutationRate: 0.09, mutationScale: 0.14,
});
OrganismTypes.register({
  id: 'mutant', label: 'Mutant', color: '#a080ff',
  description: 'Chaotic high-entropy agents, escape local optima',
  genomeLength: 12,
  genePool:     ['bitFlip', 'gaussianNoise', 'boundaryPush', 'randomWalk', 'normalize'],
  mutationRate: 0.30, mutationScale: 0.40,
});

/* ── STATE DEFAULTS ───────────────────────────────────────── */
export const state = {
  population:   null,
  problem:      Problems[0],
  goal:         Problems[0].goals[1],
  running:      false,
  speed:        1,
  tickInterval: null,
  generation:   0,
  typeWeights:  { explorer: 30, climber: 30, optimizer: 25, mutant: 15 },
  maxPop:       40,
  mutRate:      10,
  mutScale:     20,
  eliteCount:   3,
  deathRate:    0.1,
};

/* ── DOM REFS ──────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const dom = {
  btnStart:      () => $('btnStart'),
  btnReset:      () => $('btnReset'),
  btnStep:       () => $('btnStep'),
  speedRange:    () => $('speedRange'),
  speedVal:      () => $('speedVal'),
  simStatus:     () => $('simStatus'),
  simGen:        () => $('simGen'),
  statusDot:     () => $('statusDot'),
  problemSel:    () => $('problemSel'),
  goalSel:       () => $('goalSel'),
  goalLabel:     () => $('goalLabel'),
  canvas:        () => $('vizCanvas'),
  eventLog:      () => $('eventLog'),
  cardGen:       () => $('cardGen'),
  cardBest:      () => $('cardBest'),
  cardAvg:       () => $('cardAvg'),
  cardPop:       () => $('cardPop'),
  cardGoalHit:   () => $('cardGoalHit'),
  fitnessChart:  () => $('fitnessChart'),
  typeChart:     () => $('typeChart'),
  popList:       () => $('popList'),
  maxPopInput:   () => $('maxPopInput'),
  mutRateInput:  () => $('mutRateInput'),
  mutScaleInput: () => $('mutScaleInput'),
  eliteCountInput: () => $('eliteCountInput'),
  deathRateInput: () => $('deathRateInput'),
  breedingChanceInput: () => $('breedingChanceInput'),
  problemSettings: () => $('problemSettings'),
  problemRegenerateButton: () => $('problemRegenerateButton')
};

/* ── CHART STATE ────────────────────────────────────────────── */
const charts = { fitness: null, type: null };

/* ── TIMING HELPERS ─────────────────────────────────────────── */
/*
 * At low speed (1–8×): one evolve() call per tick, delay = 1000/speed ms.
 * At high speed (>8×): five evolve() calls per tick, delay still 1000/speed ms
 *   but batching keeps the interval timer from firing too frequently.
 *
 * The render loop fires once per tick interval — matching exactly how often
 * the simulation state actually changes, with no wasted frames in between.
 * At speed 1 that's ~1 fps for the viz; at speed 20 it's ~20 fps.
 * This is intentional: there is nothing new to show between ticks.
 */
function stepsPerTick()  { return state.speed > 8 ? 5 : 1; }
function tickDelayMs()   { return Math.max(50, 1000 / state.speed); }

/* ── INIT ───────────────────────────────────────────────────── */
function init() {
  buildProblemSelector();
  buildGoalSelector();
  buildProblemSettings();
  buildTypeWeightControls();
  buildGenePanel();
  initCharts();
  resetSim();   // seeds population and calls renderOnce()
  wireEvents();
}

/* Called after organism types or genes change via the editors */
function onRegistryChanged() {
  buildTypeWeightControls();
  buildGenePanel();
  // Sync typeWeights: add new types at 25, drop deleted ones
  for (const t of OrganismTypes.all()) {
    if (!(t.id in state.typeWeights)) state.typeWeights[t.id] = 25;
  }
  for (const tid of Object.keys(state.typeWeights)) {
    if (!OrganismTypes.get(tid)) delete state.typeWeights[tid];
  }
  const badge = $('geneBadge');
  if (badge) badge.textContent = GeneRegistry.all().length + ' genes';
}

/* ── BUILD UI ─────────────────────────────────────────────────*/
function buildProblemSelector() {
  const sel = dom.problemSel();
  sel.innerHTML = '';
  for (const p of Problems) {
    const opt = document.createElement('option');
    opt.value       = p.id;
    opt.textContent = p.label;
    sel.appendChild(opt);
  }
}

function buildGoalSelector() {
  const sel = dom.goalSel();
  sel.innerHTML = '';
  for (const g of state.problem.goals) {
    const opt = document.createElement('option');
    opt.value       = g.value;
    opt.textContent = g.label;
    sel.appendChild(opt);
  }
  state.goal = state.problem.goals[1] ?? state.problem.goals[0];
  sel.value = state.goal.value;
  dom.goalLabel().textContent   = state.problem.goalLabel;
  $('problemDesc').textContent  = state.problem.description;
}

function buildProblemSettings() {
  const paramsDiv = dom.problemSettings();
  paramsDiv.innerHTML = '';
  for (const p of state.problem.settings) {
    const label = document.createElement('label');
    label.textContent = p.label;
    label.classList.add('field-label');
    const input = document.createElement('input');
    input.value = p.value;
    input.id = 'problem-setting-' + p.id;
    input.classList.add('field-input');
    paramsDiv.appendChild(label);
    paramsDiv.appendChild(input)
  }
}

function buildTypeWeightControls() {
  const container = $('typeWeightControls');
  container.innerHTML = '';
  for (const type of OrganismTypes.all()) {
    const row = document.createElement('div');
    row.className = 'type-weight-row';
    row.innerHTML = `
      <div class="type-pill"
           style="background:${type.color}22;border-color:${type.color}66;color:${type.color}">
        ${type.label}
      </div>
      <input type="range" min="0" max="100"
             value="${state.typeWeights[type.id] ?? 25}"
             class="type-weight-range" data-type="${type.id}"
             title="${type.description}">
      <span class="type-weight-val" id="tw_${type.id}">
        ${state.typeWeights[type.id] ?? 25}
      </span>
    `;
    container.appendChild(row);
    row.querySelector('input').addEventListener('input', (e) => {
      state.typeWeights[type.id] = +e.target.value;
      $(`tw_${type.id}`).textContent = e.target.value;
    });
  }
}

function buildGenePanel() {
  const container = $('geneList');
  if (!container) return;
  container.innerHTML = '';
  for (const gene of GeneRegistry.all()) {
    const row = document.createElement('div');
    //row.classList.add('btn');
    row.addEventListener('click', (evt) => {
      openGeneEditor(gene.name, buildGenePanel);
    });
    let typesHTML = '';
    for (const type of gene.types) {
      const orgType = OrganismTypes.get(type);
      typesHTML += `<div class="gene-mini-tag"
           style="background:${orgType.color}22;border-color:${orgType.color}66;color:${orgType.color};">
        ${orgType.label}
      </div>
      `;
    }
    row.className = 'gene-row';
    row.innerHTML = `
      <div class="gene-row-top">
        <span class="gene-name">${gene.name}</span>
        <span class="gene-types" style="display:flex">
          ${typesHTML}
        </span>
      </div>
     `;
    container.appendChild(row);
  }
}

/* ── SIMULATION CONTROL ─────────────────────────────────────── */
function resetSim() {
  stopSim();
  const pop = new Population({
    maxSize:       +dom.maxPopInput().value   || state.maxPop,
    mutationRate:  (+dom.mutRateInput().value  || state.mutRate)  / 100,
    mutationScale: (+dom.mutScaleInput().value || state.mutScale) / 100,
    eliteCount:    +dom.eliteCountInput().value || state.eliteCount,
    deathRate: (+dom.deathRateInput().value || state.deathRate) / 100,
    breedingChanceRate: (+dom.breedingChanceInput().value || state.breedingChance) / 100,
  });
  pop.setProblem(state.problem);

  const weights = {};
  for (const [tid, w] of Object.entries(state.typeWeights)) {
    weights[tid] = w / 100;
  }
  pop.seed(weights);
  state.population = pop;
  state.generation  = 0;

  updateDashboard();
  renderOnce();   // one-shot draw so canvas isn't blank after reset
}

function startSim() {
  if (state.running) return;
  state.running = true;
  dom.statusDot().classList.add('running');
  dom.statusDot().classList.remove('stopped');
  dom.simStatus().textContent = 'RUNNING';
  dom.btnStart().textContent  = '⏸ PAUSE';
  dom.btnStart().classList.add('btn-warn');
  scheduleTick();
}

function stopSim() {
  state.running = false;
  clearInterval(state.tickInterval);
  state.tickInterval = null;
  dom.statusDot().classList.remove('running');
  dom.statusDot().classList.add('stopped');
  dom.simStatus().textContent = 'STOPPED';
  dom.btnStart().textContent  = '▶ RUN';
  dom.btnStart().classList.remove('btn-warn');
}

function toggleSim() {
  state.running ? stopSim() : startSim();
}

function stepOnce() {
  if (!state.population) return;
  state.population.evolve();
  updateDashboard();
  renderOnce();   // explicit one-shot draw; sim is stopped so no tick fires
}

/* ── TICK & RENDER ──────────────────────────────────────────────
 *
 * Single code path for all rendering while running:
 *
 *   scheduleTick()  sets up setInterval at tickDelayMs().
 *   Each tick:  evolve N steps → update dashboard → renderViz().
 *
 * The render is called directly inside the tick rather than via a
 * separate RAF loop. This keeps them in lock-step: one render per
 * batch of evolves, no redundant frames, no racing between two
 * independent timers.
 *
 * For the stopped state (STEP / RESET / goal change), renderOnce()
 * schedules a single RAF frame so the canvas reflects the new state
 * without coupling those code paths to the tick interval.
 * ─────────────────────────────────────────────────────────────── */
function scheduleTick() {
  clearInterval(state.tickInterval);
  state.tickInterval = setInterval(() => {
    if (!state.population) return;
    const steps = stepsPerTick();
    for (let i = 0; i < steps; i++) state.population.evolve();
    updateDashboard();
    renderViz();   // one render per tick, after all evolves for this tick
    console.log('Max size: ' + state.population.maxSize)
  }, tickDelayMs());
}

/* One-shot canvas update used when the sim is not running. */
function renderOnce() {
  requestAnimationFrame(renderViz);
}

/* ── DASHBOARD UPDATE ───────────────────────────────────────── */
function updateDashboard() {
  const pop = state.population;
  if (!pop) return;
  const s = pop.stats();
  if (!s.best) return;

  dom.cardGen().textContent  = pop.generation;
  dom.cardBest().textContent = s.best.fitness.toFixed(4);
  dom.cardAvg().textContent  = s.avg.toFixed(4);
  dom.cardPop().textContent  = s.size;
  dom.simGen().textContent   = `GEN ${pop.generation}`;

  const hit    = s.best.fitness >= state.goal.value;
  const goalEl = dom.cardGoalHit();
  goalEl.textContent = hit
    ? '✓ ACHIEVED'
    : `${(state.goal.value * 100).toFixed(0)}% target`;
  goalEl.style.color = hit ? 'var(--green)' : 'var(--text-dim)';

  updateEventLog(pop.events);
  updateFitnessChart(pop.history);
  updateTypeChart(s.typeCounts);
  updatePopList(pop.organisms, pop.bestOrganism);
}

function updateEventLog(events) {
  const el = dom.eventLog();
  if (!el || !events.length) return;
  el.innerHTML = events.slice(0, 12).map(e =>
    `<div class="log-entry"><span class="log-gen">G${e.gen}</span> ${e.msg}</div>`
  ).join('');
}

function updatePopList(organisms, best) {
  const el = dom.popList();
  if (!el) return;
  //Top 20 max
  const sorted = [...organisms]
    .sort((a, b) => b.fitness - a.fitness)
    .slice(0,20)
    .filter(item => item !== null);
  el.replaceChildren();

  sorted.map(org => {
        const type = OrganismTypes.get(org.type);
        const col = type?.color ?? '#6a7590';
        const isBest = org === best;
        const popRow = document.createElement('div');
        popRow.classList.add('pop-row');
        if (isBest) popRow.classList.add('pop-row-best');
        popRow.dataset.orgId = org.id;
        popRow.addEventListener('click', (evt) => {
          openOrganismEditor(Number(evt.currentTarget.dataset.orgId), evt,() => updatePopList(state.population.organisms, state.population.bestOrganism))
        });
        //ID Column
        const idColumn = document.createElement('span');
        idColumn.classList.add('pop-id');
        idColumn.style = 'color:' + col;
        idColumn.innerText = '#' + org.id;
        popRow.appendChild(idColumn);

        //ID Column
        const typeColumn = document.createElement('span');
        typeColumn.classList.add('pop-type');
        typeColumn.style = 'color:' + col;
        typeColumn.innerText = type?.label ?? org.type
        popRow.appendChild(typeColumn);

        //ID Column
        const fitnessColumn = document.createElement('span');
        fitnessColumn.classList.add('pop-fitness');
        fitnessColumn.innerText = org.fitness.toFixed(4)
        popRow.appendChild(fitnessColumn);

        //ID Column
        const ageColumn = document.createElement('span');
        ageColumn.classList.add('pop-age');
        ageColumn.style = `color:${col}`
        ageColumn.innerText = `${org.age}g`;
        popRow.appendChild(ageColumn);

        //ID Column
        const genomeColumn = document.createElement('div');
        genomeColumn.classList.add('pop-genome-bar');
        const genomeBar = document.createElement('div');
        genomeBar.classList.add('pop-genome-fill');
        genomeBar.style = `width:${org.fitness*100}%;background:${col}44;border-right:2px solid ${col}`
        genomeColumn.appendChild(genomeBar);
        popRow.appendChild(genomeColumn);

    return popRow;
      }).forEach(row => el.appendChild(row));
}

/* ── CHARTS ─────────────────────────────────────────────────── */
function initCharts() {
  const fc = dom.fitnessChart();
  if (fc) charts.fitness = fc.getContext('2d');
  const tc = dom.typeChart();
  if (tc) charts.type    = tc.getContext('2d');
}

function updateFitnessChart(history) {
  const ctx = charts.fitness;
  if (!ctx || !history.length) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;

  ctx.fillStyle = '#080b10';
  ctx.fillRect(0, 0, W, H);

  const n   = history.length;
  const pts = (arr) => arr.map((_, i) => ({
    x: (i / Math.max(n - 1, 1)) * W,
    y: H - arr[i] * (H - 4) - 2,
  }));

  const bestPts = pts(history.map(h => h.best));
  const avgPts  = pts(history.map(h => h.avg));

  // Goal threshold line
  const goalY = H - state.goal.value * (H - 4) - 2;
  ctx.beginPath();
  ctx.strokeStyle = '#f0a50040';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);
  ctx.moveTo(0, goalY);
  ctx.lineTo(W, goalY);
  ctx.stroke();
  ctx.setLineDash([]);

  const drawLine = (points, color, width) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth   = width;
    points.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p.x, p.y));
    ctx.stroke();
  };

  drawLine(avgPts,  '#3a4258', 1.5);
  drawLine(bestPts, '#f0a500', 2);
}

function updateTypeChart(typeCounts) {
  const ctx = charts.type;
  if (!ctx) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;

  ctx.fillStyle = '#080b10';
  ctx.fillRect(0, 0, W, H);

  const types = OrganismTypes.all();
  const total = Object.values(typeCounts).reduce((s, v) => s + v, 0) || 1;
  let x = 0;
  for (const t of types) {
    const frac = (typeCounts[t.id] ?? 0) / total;
    const w    = frac * W;
    ctx.fillStyle = t.color + '99';
    ctx.fillRect(x, 0, w, H);
    if (w > 20) {
      ctx.fillStyle = t.color;
      ctx.font      = '9px monospace';
      ctx.fillText(t.label[0], x + w / 2 - 3, H / 2 + 3);
    }
    x += w;
  }
}

/* ── VISUALIZATION ──────────────────────────────────────────── */
function renderViz() {
  const canvas = dom.canvas();
  if (!canvas || !state.problem || !state.population) return;
  try {
    state.problem.visualize(canvas, state.population, state.goal.value);
  } catch (e) {
    console.warn('Viz error:', e);
  }
}

/* ── EVENT WIRING ───────────────────────────────────────────── */
function wireEvents() {
  dom.btnStart().addEventListener('click', toggleSim);
  dom.btnReset().addEventListener('click', resetSim);
  dom.btnStep().addEventListener('click', () => { stopSim(); stepOnce(); });

  dom.speedRange().addEventListener('input', (e) => {
    state.speed = +e.target.value;
    dom.speedVal().textContent = `${state.speed}×`;
    if (state.running) scheduleTick();  // restart interval with new delay
  });

  dom.problemSel().addEventListener('change', (e) => {
    const p = Problems.find(p => p.id === e.target.value);
    if (p) {
      state.problem = p;
      buildGoalSelector();
      buildProblemSettings();
      resetSim();
    }
  });

  dom.goalSel().addEventListener('change', (e) => {
    const val  = +e.target.value;
    state.goal = state.problem.goals.find(g => g.value === val)
              ?? state.problem.goals[0];
    updateDashboard();
    if (!state.running) renderOnce();
  });

  // Config inputs —
  dom.maxPopInput().addEventListener('change', (evt) => {
    state.population.maxSize = Number(evt.target.value);
  });

  dom.mutRateInput().addEventListener('change', (evt) => {
    state.population.mutationRate = Number(evt.target.value);
  });

  dom.mutScaleInput().addEventListener('change', (evt) => {
    state.population.mutationScale = Number(evt.target.value);
  });

  dom.eliteCountInput().addEventListener('change', (evt) => {
    state.population.eliteCount = Number(evt.target.value);
  });

  dom.deathRateInput().addEventListener('change', (evt) => {
    state.population.deathRate = Number(evt.target.value) / 100;
  });

  dom.breedingChanceInput().addEventListener('change', (evt) => {
    state.population.breedingChance = Number(evt.target.value) / 100;
  });

  document.getElementById('btnHelp')?.addEventListener('click', openHelp);

  document.getElementById('btnEditTypes')?.addEventListener('click', () => {
    openOrganismList(onRegistryChanged);
  });
  document.getElementById('btnEditGenes')?.addEventListener('click', () => {
    openGeneList(onRegistryChanged);
  });

  document.getElementById('problemTabHeader')?.addEventListener('click', (evt) => {
    openTab(evt, 'problemTab')
  });

  document.getElementById('problemSettingsTabHeader')?.addEventListener('click', (evt) => {
    openTab(evt, 'problemSettingsTab')
  });

  document.getElementById('problemRegenerateButton')?.addEventListener('click', (evt) => {
    const args = [];
    for (const p of state.problem.settings) {
      const s = $('problem-setting-' + p.id).value;
      args.push(s);
    }
    state.problem.regenerate(args);
    renderViz();
  });

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
}

function openTab(evt, tabName) {
  // Hide content, remove active class, then show target
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = "none");
  document.querySelectorAll('.tab-header').forEach(el => el.classList.remove("active"));
  const tab = document.getElementById(tabName);
  tab.style.display = "block";
  evt.currentTarget.classList.add("active");
}

function resizeCanvas() {
  const canvas = dom.canvas();
  if (!canvas) return;
  const rect    = canvas.parentElement.getBoundingClientRect();
  canvas.width  = rect.width  || 400;
  canvas.height = rect.height || 300;
  // Re-draw immediately so canvas doesn't go blank after resize
  if (!state.running) renderOnce();
}

/* ── BOOT ───────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', init);
