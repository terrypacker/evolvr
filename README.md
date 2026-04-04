# EVOLVR — Genetic Algorithm Playground

A browser-based genetic algorithm simulation with a live visualization dashboard. Populations of typed organisms compete and breed to solve configurable optimization problems. Organism types, gene functions, and optimization problems are all designed to be extended through straightforward JavaScript — no build tools required.

![EVOLVR Screenshot](https://placeholder.example/screenshot.png)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Getting Started](#getting-started)
- [Core Concepts](#core-concepts)
- [Extension Points](#extension-points)
  - [Adding a New Problem](#adding-a-new-problem)
  - [Adding a New Gene](#adding-a-new-gene)
  - [Adding a New Organism Type](#adding-a-new-organism-type)
- [API Reference](#api-reference)
  - [GeneRegistry](#generegistry)
  - [OrganismTypes](#organismtypes)
  - [Organism](#organism)
  - [Population](#population)
- [The Evolution Loop](#the-evolution-loop)
- [CSS Architecture](#css-architecture)
- [UI Modules](#ui-modules)
- [Default Content](#default-content)
  - [Built-in Problems](#built-in-problems)
  - [Default Organism Types](#default-organism-types)
  - [Default Genes](#default-genes)
- [Design Decisions](#design-decisions)

---

## Overview

EVOLVR uses a classic genetic algorithm loop:

```
Seed random population
  └─> Evaluate fitness (problem-specific)
        └─> Sort by fitness, keep elite survivors
              └─> Reproduce top 50% via crossover + mutation
                    └─> Repeat
```

Each organism carries a **genome** (a `Float32Array` of values in `[0, 1]`) and a set of active **genes** (JavaScript transform functions). Before fitness is evaluated, each gene is applied in sequence to produce an **expressed values** array — this separation between raw genome and expressed phenotype is the key architectural hook that makes new gene behaviours easy to add without touching the evaluation logic.

---

## Architecture

The project is split into a pure simulation engine, a problem/gene library, and a UI layer. Dependencies flow in one direction only:

```
index.html
  ├── app.js          ← UI controller, wires everything together
  │     ├── engine.js ← Pure simulation core (no DOM)
  │     ├── problems.js ← Problem definitions + gene registrations
  │     ├── modals.js ← Organism type & gene editor modals
  │     └── help.js   ← Help documentation modal
  └── CSS (4 layers, described below)
```

`engine.js` has **zero DOM dependencies** and can be imported and driven from any JavaScript context (including Node.js for headless runs or testing).

---

## File Structure

```
evolvr/
├── index.html
└── assets/
    ├── css/
    │   ├── base.css          # From terrypacker.com/assets/css Reset, scrollbars, shared range input, utilities
    │   ├── theme-amber.css   # From terrypacker.com/assets/css CSS custom properties, typography, shared components
    │   ├── evo-sim.css       # Page layout, dashboard, visualization, population list
    │   ├── modals.css        # Organism type & gene editor modal styles
    │   └── help.css          # Help documentation modal styles
    └── js/
        ├── engine.js         # GeneRegistry, OrganismTypes, Organism, Population
        ├── problems.js       # Problem definitions + GeneRegistry.register() calls
        ├── app.js            # UI controller, simulation loop, chart rendering
        ├── modals.js         # Runtime type/gene editor UI
        └── help.js           # Help modal content and behaviour
```

---

## Getting Started

No build step. No package manager. Serve the directory over HTTP (required for ES module imports):

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .

# Deno
deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts
```

Then open `http://localhost:8080`.

> **Why not `file://`?** ES module `import` statements are blocked by browsers on the `file://` protocol due to CORS restrictions. Any static file server works fine.

---

## Core Concepts

### Genome

A `Float32Array` of `n` values, each clamped to `[0, 1]`. The length `n` is set per organism type (`genomeLength`). The genome is the organism's raw genetic material — its interpretation is entirely problem-dependent and shaped by active genes.

### Gene

A named JavaScript function registered in `GeneRegistry`. Signature:

```js
function(genome: number[], params: object): number[]
```

Genes are applied sequentially to transform the genome array before fitness evaluation. Each gene receives the output of the previous one. The final result is the **expressed values** array passed to `evaluate()`.

Genes are associated with one or more organism types at registration time. Each organism randomly expresses a subset (~70%) of its type's gene pool, creating behavioural variation within a type without changing the genome.

### Organism Type

A species template registered in `OrganismTypes`. Defines:
- `genomeLength` — how many values in the genome
- `genePool` — which gene names this type can express
- `mutationRate` — per-gene mutation probability (overrides the global setting on a per-type basis)
- `mutationScale` — magnitude of mutations when they occur
- `color` — hex colour used throughout the UI

### Fitness

A scalar `[0, 1]` returned by `problem.evaluate()`. `1.0` = perfect solution. The population is sorted by fitness each generation; the top 50% become parents of the next generation.

### Problem

A plain object conforming to the `ProblemDef` interface. The full shape is documented in [Adding a New Problem](#adding-a-new-problem).

---

## Extension Points

All extension happens in `problems.js` (for problems and genes) and `app.js` (for organism types). The UI picks up registered content automatically — no template changes needed.

### Adding a New Problem

Add an object to the `Problems` array at the bottom of `problems.js`. The object must conform to:

```js
{
  id:          string,      // unique, used as <option> value
  label:       string,      // shown in the problem selector dropdown
  description: string,      // shown below the dropdown
  goalLabel:   string,      // label above the goal selector
  params:      object,      // arbitrary — passed to evaluate() and gene functions
                            // mutate this object freely (e.g. lazy-generate data here)
  goals: [
    { label: string, value: number },  // value is the fitness threshold
    // ... at least one goal required
  ],

  evaluate(genome, expressed, organism) {
    // genome:    Float32Array — raw genome values
    // expressed: number[]    — genome after all genes have been applied
    // organism:  Organism    — full organism object (read age, type, id, etc.)
    // Must return a number in [0, 1]. Called once per organism per generation.
    return fitnessScore;
  },

  visualize(canvas, population, goal) {
    // canvas:     HTMLCanvasElement — sized to its container, resizes on window resize
    // population: Population        — access .organisms, .bestOrganism, .generation, etc.
    // goal:       number            — the active goal threshold value
    // Draw anything you want. Called at 60fps regardless of simulation speed.
    // Tip: call canvas.getContext('2d') here; the canvas is pre-cleared for you.
  }
}
```

**Minimal working example** — a problem where organisms try to maximise the sum of their genome values:

```js
const MaxSum = {
  id: 'maxSum',
  label: 'Max Sum',
  description: 'Maximise the sum of all genome values.',
  goalLabel: 'Target ratio (0–1)',
  params: {},
  goals: [
    { label: '≥ 0.80', value: 0.80 },
    { label: '≥ 0.95', value: 0.95 },
  ],

  evaluate(genome, expressed, organism) {
    const sum = expressed.reduce((a, v) => a + v, 0);
    return sum / expressed.length;  // normalised to [0, 1]
  },

  visualize(canvas, population, goal) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!population?.bestOrganism) return;
    const ex  = population.bestOrganism.express({});
    const barW = canvas.width / ex.length;
    ex.forEach((v, i) => {
      ctx.fillStyle = `hsl(40, 90%, ${v * 60}%)`;
      ctx.fillRect(i * barW, canvas.height * (1 - v), barW - 2, canvas.height * v);
    });
  }
};

export const Problems = [PeakFinder, FunctionApprox, Knapsack, TSP, MaxSum];
//                                                                    ^^^^^^ append here
```

### Adding a New Gene

Call `GeneRegistry.register()` anywhere in `problems.js` after the import line. Genes registered here are immediately available in the runtime gene editor UI.

```js
GeneRegistry.register(
  'myGene',             // unique name, camelCase
  ['explorer', 'mutant'],  // organism type IDs that can carry this gene
  (genome, params) => {
    // Transform and return a new array.
    // genome: number[] — current expressed values (output of previous gene)
    // params: object   — problem.params, may be empty
    // MUST return an array of numbers, ideally same length as input.
    return genome.map(v => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.05)));
  }
);
```

**Important constraints:**
- Always return an array. Returning `undefined` or a non-array silently no-ops.
- Values outside `[0, 1]` are not automatically clamped — clamp manually if your problem requires it.
- Gene functions run on every organism every generation. Keep them fast. Avoid closures that capture large data — use `params` instead.
- Genes are run synchronously in the simulation tick. Async functions will not work.
- If a gene throws, the error is caught and logged to `organism.log`; evaluation continues with the pre-throw genome state.

### Adding a New Organism Type

Call `OrganismTypes.register()` in `app.js` before `init()` is called, or add one at runtime through the UI (✎ EDIT TYPES button). Types added programmatically in `app.js` serve as the defaults that appear when the page first loads.

```js
OrganismTypes.register({
  id:            'drifter',                          // unique, no spaces
  label:         'Drifter',                          // display name
  description:   'Slow random walk, low mutation',   // shown in UI
  color:         '#ff8c42',                          // hex, used throughout UI
  genomeLength:  12,                                 // Float32Array length
  genePool:      ['randomWalk', 'gaussianNoise'],    // subset of registered gene names
  mutationRate:  0.04,                               // per-gene mutation probability
  mutationScale: 0.08,                               // mutation magnitude
});
```

**Notes:**
- `genomeLength` should be at least as large as the number of inputs your target problem expects. For TSP with 10 cities, use `genomeLength >= 10`.
- `genePool` names must match registered genes. Unrecognised names are silently skipped.
- `mutationRate` and `mutationScale` override the global Population settings for organisms of this type. The global settings are used for types that don't specify their own.
- The `color` is used verbatim in CSS `background`, `border`, and canvas drawing calls — any valid CSS colour value works, but 6-digit hex is most consistent across contexts.

---

## API Reference

### GeneRegistry

Singleton module-level object. All methods are synchronous.

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(name: string, types: string[], fn: Function) => void` | Register or overwrite a gene. Overwrites silently if name already exists. |
| `get` | `(name: string) => GeneDef \| undefined` | Returns `{ name, types, fn }` or `undefined`. |
| `delete` | `(name: string) => void` | Remove a gene from the registry. Does not update organism type gene pools. |
| `all` | `() => GeneDef[]` | All registered genes as an array. Order matches registration order. |
| `allNames` | `() => string[]` | Just the names. |
| `forType` | `(typeId: string) => GeneDef[]` | Genes whose `types` array includes `typeId`. |

### OrganismTypes

Singleton module-level object.

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(def: TypeDef) => void` | Register or overwrite a type definition. |
| `get` | `(id: string) => TypeDef \| undefined` | Returns the type definition or `undefined`. |
| `delete` | `(id: string) => void` | Remove a type. Organisms of this type already in a population are unaffected until reset. |
| `all` | `() => TypeDef[]` | All registered types. |
| `ids` | `() => string[]` | Just the IDs. |

### Organism

Instantiated by `Population.seed()` and `Organism.reproduce()`. Do not construct directly in application code.

```ts
class Organism {
  id:       number         // monotonically increasing, resets on Population.seed()
  type:     string         // OrganismType id
  genome:   Float32Array   // raw genome values, each in [0, 1]
  genes:    string[]       // active gene names (subset of type's genePool)
  fitness:  number         // last computed fitness score, 0 on construction
  age:      number         // generations survived
  children: number         // reproduction count
  alive:    boolean        // always true in current implementation
  log:      string[]       // last 20 error/event messages from gene execution

  express(params?: object): number[]
  // Applies all active genes in sequence. Returns the final transformed array.
  // Safe to call outside of the evolution loop — used by visualize() every frame.

  reproduce(mate: Organism, mutationRate: number, mutationScale: number): Organism
  // Single-point crossover + per-gene mutation. Returns a new Organism.
  // The child's type is the calling organism's type with 80% probability,
  // or the mate's type with 20% probability.
  // Gene inheritance: ~60% chance of inheriting each gene from each parent,
  // deduplicated. 15% chance of picking up a random gene from the combined pool.
}
```

### Population

```ts
class Population {
  constructor(config?: {
    maxSize?:       number   // default 30
    eliteCount?:    number   // default 3 — organisms that survive without reproducing
    mutationRate?:  number   // default 0.1 — per-gene mutation probability [0, 1]
    mutationScale?: number   // default 0.2 — mutation magnitude [0, 1]
  })

  organisms:    Organism[]   // current generation
  generation:   number       // incremented after each evolve() call
  bestFitness:  number       // all-time best fitness seen
  bestOrganism: Organism     // organism with bestFitness (reference, not copy)
  history:      Array<{ gen: number, best: number, avg: number, size: number }>
                             // per-generation stats, capped at 200 entries
  events:       Array<{ gen: number, msg: string, ts: number }>
                             // notable events, capped at 50 entries

  setProblem(problemDef: ProblemDef): void
  // Must be called before evolve(). Stores a reference — mutating problemDef.params
  // after this call is reflected in subsequent evaluations.

  seed(typeWeights?: { [typeId: string]: number }): void
  // Resets the population. Weights are normalised — { a: 30, b: 10 } ≡ { a: 0.75, b: 0.25 }.
  // Resets generation counter and history. Resets the organism ID sequence to 0.

  evaluate(): void
  // Scores all organisms. Increments organism.age. Called internally by evolve().

  evolve(): void
  // One full generation: evaluate → sort → record history → elite carryover →
  // crossover → mutate → replace population. Increments generation counter.

  stats(): {
    best:       Organism
    avg:        number
    typeCounts: { [typeId: string]: number }
    generation: number
    size:       number
  }
}
```

---

## The Evolution Loop

`app.js` drives the loop via `setInterval`. The tick rate is derived from the speed slider:

```js
const delay = Math.max(30, 300 / state.speed);   // ms between ticks
// At speed 8+, 5 evolve() calls are batched per tick for higher throughput.
```

The visualization runs on a separate `requestAnimationFrame` loop at 60fps, completely decoupled from the simulation tick rate. `population.bestOrganism` is a live reference, so the canvas always shows the latest state of the best organism even between ticks.

Elite carryover means `eliteCount` (default 3) organisms survive each generation unchanged. These are the organisms with the highest fitness from the previous generation. This prevents the best-seen fitness from ever regressing.

Selection pressure: the top 50% of the sorted population become parents. All offspring are produced by random pairings within this parent pool. There is no tournament selection or fitness-proportionate sampling — straight truncation selection.

---

## CSS Architecture

Four files, loaded in strict order:

| File | Role | Modifiable? |
|------|------|-------------|
| `base.css` | Box-model reset, scrollbar styling, shared `input[type=range]`, `.hidden` / `.mono` utilities | No |
| `theme-amber.css` | All CSS custom properties (`--amber`, `--bg-panel`, etc.), typography imports, shared component classes (`.panel`, `.btn`, `.field-input`, `.status-dot`) | No |
| `evo-sim.css` | Page grid, dashboard cards, visualization wrapper, population list, fitness charts, organism type weight controls | Yes — page layout lives here |
| `modals.css` | Organism type editor and gene editor modal styles, gene chip grid, colour palette picker, code editor textarea | Yes |
| `help.css` | Help modal two-column layout, concept grids, code blocks, gene reference table | Yes |

All colours reference CSS custom properties from `theme-amber.css`. To add a new theme, create a new theme file that redefines the same property names and swap it in instead of `theme-amber.css`.

**Key custom properties:**

```css
/* Backgrounds */
--bg-base, --bg-panel, --bg-panel2, --bg-input

/* Borders */
--border, --border-hi

/* Accent colours */
--amber, --amber-dim, --amber-glow
--cyan, --cyan-dim
--green, --green-dim
--red, --red-dim
--purple

/* Text */
--text-primary, --text-dim, --text-muted

/* Typography */
--font-mono   /* Share Tech Mono */
--font-head   /* Barlow Condensed */
--font-body   /* Barlow */

/* Spacing */
--radius, --panel-gap
```

---

## UI Modules

### `app.js`

The top-level controller. Responsibilities:
- Registers default organism types at startup
- Builds and rebuilds the type weight slider controls (`buildTypeWeightControls`)
- Drives the simulation tick via `setInterval`, batching steps at high speeds
- Runs the 60fps render loop via `requestAnimationFrame`
- Renders the fitness history sparkline and type distribution bar on `<canvas>` elements (manual Canvas 2D — no charting library)
- Exports `onRegistryChanged()` — call this after any programmatic change to `GeneRegistry` or `OrganismTypes` to sync the UI

### `modals.js`

Four exported functions:

| Function | Opens |
|----------|-------|
| `openOrganismList(onChanged)` | Scrollable list of all types with inline stats |
| `openOrganismEditor(typeId, onDone)` | Full type editor; `typeId = null` creates a new type |
| `openGeneList(onChanged)` | Scrollable list of all genes with type memberships |
| `openGeneEditor(geneName, onDone)` | Full gene editor with live test runner; `geneName = null` creates a new gene |

Both list modals use event delegation for their edit buttons, so they don't need to be re-rendered when the list changes.

The gene editor compiles the function body with `new Function('genome', 'params', body)` and runs it against a sample input before saving — invalid functions are rejected with the error message shown inline.

### `help.js`

Single exported function `openHelp()`. Content is declared as a `SECTIONS` array of plain objects — add or reorder sections by editing that array. Each section has an `id`, `icon`, `label`, `color`, and `content` (raw HTML string). The modal is a two-column layout: fixed sidebar nav on the left, scrollable content pane on the right.

---

## Default Content

### Built-in Problems

| ID | Label | Genome Encoding | Fitness Signal |
|----|-------|-----------------|----------------|
| `peakFinder` | Peak Finder | `expressed[0]` = X, `expressed[1]` = Y in a 2D landscape | Sum of Gaussian peaks at (X, Y), clamped to 1 |
| `funcApprox` | Function Approximation | Polynomial coefficients `[a₀, a₁, a₂, …]` | `1 - 20 × MSE` against `sin(x·2π)·0.5 + 0.5` over 20 sample points |
| `knapsack` | Binary Knapsack | `expressed[i] > 0.5` = item `i` selected | Value ratio, penalised if over capacity |
| `tsp` | Traveling Salesman | Ranked ordering of expressed values gives city visit order | `max(0, 1 - tourLength / 5)` |

### Default Organism Types

| ID | Colour | Genome | Gene Pool | Mut Rate | Mut Scale | Strategy |
|----|--------|--------|-----------|----------|-----------|----------|
| `explorer` | `#f0a500` | 12 | `boundaryPush`, `randomWalk`, `mirrorFold`, `gaussianNoise` | 18% | 28% | Broad search, high diversity |
| `climber` | `#00d4e8` | 12 | `gradientNudge`, `elitePull`, `sinTransform` | 6% | 10% | Local refinement, conservative |
| `optimizer` | `#39e080` | 12 | `sinTransform`, `normalize`, `rankSort`, `gradientNudge` | 9% | 14% | Mathematical transforms, ordered |
| `mutant` | `#a080ff` | 12 | `bitFlip`, `gaussianNoise`, `boundaryPush`, `randomWalk`, `normalize` | 30% | 40% | Chaos, optima escape |

### Default Genes

| Name | Types | Behaviour |
|------|-------|-----------|
| `boundaryPush` | explorer, mutant | Nudges values near 0 or 1 back toward the interior |
| `randomWalk` | explorer, mutant | Randomly shifts one genome position by ±0.05 |
| `mirrorFold` | explorer | Copies first half into second half inverted |
| `gradientNudge` | climber, optimizer | Pulls all values toward 0.5 by 2% |
| `elitePull` | climber | Scales genome by 0.98, shifts by +0.01 |
| `sinTransform` | optimizer, climber | Applies `(sin(v·π) + 1) / 2` to each value |
| `normalize` | optimizer, mutant | Divides all values by their maximum |
| `rankSort` | optimizer | Replaces values with fractional rank positions |
| `bitFlip` | mutant | Randomly replaces ~5% of values with `Math.random()` |
| `gaussianNoise` | mutant, explorer | Adds Box-Muller Gaussian noise (σ ≈ 0.05) to each value |

---

## Design Decisions

**No build tooling.** The project uses native ES modules (`import`/`export`). This keeps the feedback loop short during development — edit a file, reload the browser. The tradeoff is that a static file server is required (browsers block cross-origin module imports on `file://`).

**`Float32Array` for genomes.** Saves memory in large populations and signals intent — genome values are always finite floats. Converted to a plain `number[]` at the start of `express()` so gene functions can use standard array methods without worrying about typed array constraints.

**Genes transform, they don't evaluate.** Fitness evaluation is entirely the problem's responsibility. Genes only shape the expressed phenotype. This clean separation means the same gene can be useful across completely different problems without modification.

**Single-point crossover.** Simple and effective for continuous-valued genomes. The crossover point is chosen uniformly at random, so on average half the genome comes from each parent. More exotic operators (uniform crossover, multi-point) could be substituted in `Organism.reproduce()`.

**Truncation selection (top 50%).** Chosen for simplicity and speed over roulette-wheel or tournament selection. It applies strong selection pressure, which combined with the Mutant type's high entropy prevents premature convergence in most cases.

**Type as a heritable trait.** An organism inherits its type from one of its parents (80% chance it takes the calling organism's type). This means type proportions can drift across generations — a type that produces fitter offspring will gradually dominate even if it started as a minority. The type distribution chart in the UI makes this visible.

**Decoupled render loop.** The 60fps `requestAnimationFrame` loop and the simulation tick `setInterval` are completely independent. The visualization calls `organism.express()` each frame, so it always shows the live best-organism state rather than a snapshot. At high simulation speeds, many generations may elapse between frames, but the visualization still reflects the current population.

**Runtime-editable types and genes.** The modal editors use `new Function()` to compile gene bodies at runtime. This is a deliberate choice — it makes EVOLVR a live playground rather than a static demo. The test-before-save validation catches the most common errors (syntax errors, non-array returns) before they reach the simulation. In a production environment you'd want a sandboxed eval instead.
