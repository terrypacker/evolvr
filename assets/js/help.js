/* =============================================================
   HELP.JS  —  Help Modal: full page documentation
   ============================================================= */

/* ── SECTION DEFINITIONS ─────────────────────────────────────
   Each section maps to a panel on the main page.
   ============================================================= */
const SECTIONS = [
  {
    id: 'intro',
    icon: '⬡',
    label: 'What is EVOLVR?',
    color: 'var(--amber)',
    content: `
      <p>EVOLVR is a <strong>genetic algorithm playground</strong> — a live simulation where populations of programs called <em>organisms</em> compete and breed to solve optimization problems.</p>

      <p>Instead of being hand-coded, each organism <strong>evolves</strong>. It combines its genome with a partner's to produce offspring that inherit traits from both parents, with small random mutations introduced along the way. Organisms that score higher on the active problem survive and reproduce more; weaker ones are replaced by their children.</p>

      <div class="help-concept-grid">
        <div class="help-concept">
          <div class="help-concept-icon" style="color:var(--amber)">⬡</div>
          <div class="help-concept-label">Genome</div>
          <div class="help-concept-desc">An array of decimal numbers between 0 and 1. This is the organism's raw "DNA" — the numbers that get recombined and mutated across generations.</div>
        </div>
        <div class="help-concept">
          <div class="help-concept-icon" style="color:var(--cyan)">◈</div>
          <div class="help-concept-label">Gene</div>
          <div class="help-concept-desc">A JavaScript function that transforms the genome array before it's evaluated. Genes are the "skills" an organism expresses — they shape how the genome is interpreted.</div>
        </div>
        <div class="help-concept">
          <div class="help-concept-icon" style="color:var(--green)">◎</div>
          <div class="help-concept-label">Organism Type</div>
          <div class="help-concept-desc">A species template — defines which genes are available, genome length, and how aggressively the organism mutates. Different types have different evolutionary strategies.</div>
        </div>
        <div class="help-concept">
          <div class="help-concept-icon" style="color:var(--purple)">⬟</div>
          <div class="help-concept-label">Fitness</div>
          <div class="help-concept-desc">A score from 0 to 1 that measures how well an organism solves the active problem. Higher fitness = better solution. This drives selection — fitter organisms breed more.</div>
        </div>
      </div>

      <div class="help-flow">
        <div class="help-flow-step">Seed<br><span>random genomes</span></div>
        <div class="help-flow-arrow">→</div>
        <div class="help-flow-step">Express<br><span>apply genes</span></div>
        <div class="help-flow-arrow">→</div>
        <div class="help-flow-step">Evaluate<br><span>score fitness</span></div>
        <div class="help-flow-arrow">→</div>
        <div class="help-flow-step">Select<br><span>keep best 50%</span></div>
        <div class="help-flow-arrow">→</div>
        <div class="help-flow-step">Reproduce<br><span>crossover + mutate</span></div>
        <div class="help-flow-arrow">↻</div>
      </div>
    `
  },

  {
    id: 'header',
    icon: '▶',
    label: 'Header — Simulation Controls',
    color: 'var(--amber)',
    content: `
      <p>The header bar runs the simulation and controls its speed. These controls affect all panels simultaneously.</p>

      <div class="help-item-list">
        <div class="help-item">
          <div class="help-item-head">
            <span class="help-tag" style="background:var(--amber-glow);border-color:var(--amber-dim);color:var(--amber)">▶ RUN / ⏸ PAUSE</span>
          </div>
          <p>Starts or pauses the simulation loop. While running, the population evolves automatically at the rate set by the Speed slider. The status dot turns green and pulses when the simulation is active.</p>
        </div>

        <div class="help-item">
          <div class="help-item-head">
            <span class="help-tag">↷ STEP</span>
          </div>
          <p>Advances the simulation by exactly <strong>one generation</strong> then pauses. Useful for watching evolution happen slowly and inspecting each generation's changes in the Organisms panel.</p>
        </div>

        <div class="help-item">
          <div class="help-item-head">
            <span class="help-tag" style="background:rgba(255,68,85,0.08);border-color:var(--red-dim);color:var(--red)">⟳ RESET</span>
          </div>
          <p>Stops the simulation and re-seeds a brand new population from scratch using the current Parameters and Type Weight settings. All history is cleared. <strong>Always reset after changing organism types, genes, or population parameters</strong> so the changes take effect.</p>
        </div>

        <div class="help-item">
          <div class="help-item-head">
            <span class="help-tag">SPEED 1×–20×</span>
          </div>
          <p>Controls how many generations evolve per second. At low speeds (1×–4×) you can watch each generation clearly. At higher speeds (10×–20×) the simulation runs multiple steps per tick — useful for letting it converge on a solution quickly. The visualization updates in real time regardless of speed.</p>
        </div>
      </div>

      <div class="help-tip">
        <span class="help-tip-icon">⚡</span>
        <span>Start with <strong>STEP</strong> to understand what one generation looks like, then switch to <strong>RUN</strong> at a comfortable speed to watch the population converge.</span>
      </div>
    `
  },

  {
    id: 'problem',
    icon: '◎',
    label: 'PROB — Problem Panel',
    color: 'var(--cyan)',
    content: `
      <p>The Problem panel defines <em>what the population is trying to solve</em>. Every organism's genome is evaluated against the active problem to produce its fitness score.</p>

      <div class="help-item-list">
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--cyan);border-color:var(--cyan-dim)">Optimization Target</span></div>
          <p>Choose one of the built-in problems from the dropdown. Changing the problem automatically updates the Goal options and refreshes the visualization. <strong>Reset the simulation after switching problems</strong> to start fresh.</p>
        </div>

        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--cyan);border-color:var(--cyan-dim)">Goal</span></div>
          <p>Sets the fitness threshold that counts as "achieved." The Dashboard Goal card turns green when the best organism crosses this threshold. Setting a harder goal gives the population more to strive for.</p>
        </div>
      </div>

      <h4 class="help-subhead">Built-in Problems</h4>

      <div class="help-problem-grid">
        <div class="help-problem-card">
          <div class="help-problem-name">Peak Finder</div>
          <p>The genome encodes X and Y coordinates in a 2D search space filled with hidden peaks of varying heights. Organisms must find the tallest peak. The visualization shows the landscape as a heat map — brighter areas are higher — with organisms shown as coloured dots. The best organism gets a highlighted ring.</p>
          <div class="help-problem-tip">Explorer and Mutant types tend to perform well here because the space is multi-modal — there are many local peaks to escape.</div>
        </div>
        <div class="help-problem-card">
          <div class="help-problem-name">Function Approximation</div>
          <p>The genome encodes polynomial coefficients. Organisms try to match a target sine-like curve over the interval [0, 1]. Fitness is based on how closely the polynomial matches the target. The visualization shows the target curve in amber and each organism's curve overlaid.</p>
          <div class="help-problem-tip">Optimizer and Climber types do well here as the problem rewards precision over exploration.</div>
        </div>
        <div class="help-problem-card">
          <div class="help-problem-name">Binary Knapsack</div>
          <p>Each genome bit decides whether to include a corresponding item in a virtual knapsack. The goal is to maximise total value without exceeding the weight capacity. Cyan-outlined bars show which items the best organism selected. The red dashed line marks the capacity limit.</p>
          <div class="help-problem-tip">A mixed population of Optimizers and Climbers tends to find good packing strategies quickly.</div>
        </div>
        <div class="help-problem-card">
          <div class="help-problem-name">Traveling Salesman</div>
          <p>The genome encodes a visit order for a set of cities. Organisms evolve the shortest possible tour visiting all cities and returning to the start. The best tour is shown in amber; other population tours are shown faintly in their type colour.</p>
          <div class="help-problem-tip">This problem is NP-hard, so a diverse mix of all four types works best — Mutants escape local optima while Climbers refine short routes.</div>
        </div>
      </div>

      <div class="help-tip">
        <span class="help-tip-icon">🔧</span>
        <span>To add your own problem, open <code>problems.js</code> and push a new object into the <code>Problems</code> array. It needs an <code>id</code>, <code>label</code>, <code>evaluate(genome, expressed, organism)</code> function returning 0–1, and a <code>visualize(canvas, population, goal)</code> function. The UI picks it up automatically.</span>
      </div>
    `
  },

  {
    id: 'params',
    icon: '⚙',
    label: 'CFG — Parameters Panel',
    color: 'var(--amber)',
    content: `
      <p>The Parameters panel controls the global population dynamics and the mix of organism types. Changes here take effect on the next <strong>RESET</strong>.</p>

      <div class="help-item-list">
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">Max Pop</span></div>
          <p>The maximum number of organisms in the population. Range: 10–200. Larger populations explore the fitness landscape more broadly but run slower. Smaller populations converge faster but may get stuck in local optima. <strong>40–60</strong> is a good starting range.</p>
        </div>

        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">Mut% Rate</span></div>
          <p>The probability (as a percentage) that any individual genome value is mutated during reproduction. Range: 1–50%. A low rate (5–10%) means offspring closely resemble their parents. A high rate (25%+) introduces more diversity but can disrupt good solutions. <strong>10%</strong> is the default.</p>
        </div>

        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">Mut% Scale</span></div>
          <p>How large each mutation is when it occurs. A scale of 20% means a mutated gene shifts by up to ±0.20 from its current value (clamped to [0, 1]). Higher scale = wilder mutations that can leap across the search space. Lower scale = fine-grained local adjustments. <strong>20%</strong> is the default.</p>
        </div>
      </div>

      <h4 class="help-subhead">Organism Type Weights</h4>
      <p>Each registered organism type has a slider controlling what proportion of the initial population it makes up. The sliders are relative — they're normalised so the population is always filled to Max Pop. Setting a type's weight to <strong>0</strong> excludes it entirely.</p>

      <div class="help-tip">
        <span class="help-tip-icon">💡</span>
        <span>Try running with a single type at 100% to see how it behaves in isolation, then mix types to observe how different strategies interact and compete.</span>
      </div>

      <h4 class="help-subhead">✎ EDIT TYPES Button</h4>
      <p>Opens the <strong>Organism Types</strong> editor (see the <em>Organism Types</em> section below for full details). After editing types, click <strong>RESET</strong> on the main page to apply the changes.</p>
    `
  },

  {
    id: 'organisms-editor',
    icon: '⬡',
    label: 'Editing Organism Types',
    color: 'var(--amber)',
    content: `
      <p>Organism types are species templates. Each type defines a unique evolutionary strategy through its combination of genome settings and available genes. The four default types — Explorer, Climber, Optimizer, and Mutant — are a starting point. You can edit them, delete them, and create entirely new ones.</p>

      <h4 class="help-subhead">Opening the Editor</h4>
      <p>Click <strong>✎ EDIT TYPES</strong> in the Parameters panel. This opens the <strong>Organism Types list</strong>, which shows all registered types with their current settings and gene pools at a glance.</p>

      <div class="help-item-list">
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--amber);border-color:var(--amber-dim)">⊕ NEW TYPE</span></div>
          <p>Creates a brand new organism type from scratch. Fill in all fields in the editor that appears.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">✎ EDIT (per row)</span></div>
          <p>Opens the full editor for an existing type. All fields are pre-filled with current values. The ID cannot be changed after creation.</p>
        </div>
      </div>

      <h4 class="help-subhead">Type Editor Fields</h4>

      <div class="help-field-grid">
        <div class="help-field">
          <div class="help-field-name">Display Name</div>
          <div class="help-field-desc">The human-readable name shown in the type weight sliders, population list, and visualizations. Can include spaces and special characters.</div>
        </div>
        <div class="help-field">
          <div class="help-field-name">ID</div>
          <div class="help-field-desc">A unique machine identifier — no spaces, letters and numbers only. This is set once at creation and cannot be changed. Used internally to link organisms to their type definition.</div>
        </div>
        <div class="help-field">
          <div class="help-field-name">Description</div>
          <div class="help-field-desc">A short description of this type's evolutionary strategy. Shown as a tooltip on the weight sliders. Helps you remember what each type is optimised for.</div>
        </div>
        <div class="help-field">
          <div class="help-field-name">Genome Length</div>
          <div class="help-field-desc">How many values are in this type's genome array. Range: 4–32. Longer genomes can encode more complex solutions but take longer to optimise. Match this to the problem — e.g. TSP with 10 cities needs at least 10 genome values.</div>
        </div>
        <div class="help-field">
          <div class="help-field-name">Mutation Rate %</div>
          <div class="help-field-desc">Per-gene mutation probability for this type only. Overrides the global Mut% Rate for organisms of this type. Use high rates (20–40%) for exploratory types, low rates (3–8%) for convergence-focused types.</div>
        </div>
        <div class="help-field">
          <div class="help-field-name">Mutation Scale %</div>
          <div class="help-field-desc">How much each mutation shifts a gene value. Per-type override of the global Mut% Scale. High scale = bold leaps; low scale = careful refinement.</div>
        </div>
        <div class="help-field">
          <div class="help-field-name">Colour</div>
          <div class="help-field-desc">The colour used to represent this type in the visualizations, population list, and type distribution bar. Click a swatch from the palette or type any valid hex colour directly.</div>
        </div>
        <div class="help-field">
          <div class="help-field-name">Gene Pool</div>
          <div class="help-field-desc">The set of genes this type can express. Click gene chips to toggle them on (highlighted in amber) or off. At least one gene must be selected. Each organism randomly expresses a subset of its pool each generation — having more genes in the pool creates more behavioural variety within the type.</div>
        </div>
      </div>

      <div class="help-tip">
        <span class="help-tip-icon">⚠</span>
        <span>Deleting a type removes it from future populations but does not affect organisms already in a running simulation. Always <strong>RESET</strong> after editing types to see the changes.</span>
      </div>
    `
  },

  {
    id: 'genes',
    icon: '◈',
    label: 'DNA — Gene Registry & Editing Genes',
    color: 'var(--purple)',
    content: `
      <p>The Gene Registry panel lists all registered genes — the transformation functions that organisms express before their genome is evaluated. Genes are the core "intelligence" of the simulation: they shape how a raw genome array gets processed into a useful solution.</p>

      <h4 class="help-subhead">How Genes Work</h4>
      <p>When an organism is evaluated, each of its active genes is called in sequence, passing the genome through a chain of transformations:</p>

      <div class="help-code-block"><span class="hljs-comment">// Each gene receives the current genome array and returns a new one</span>
genome <span class="hljs-op">→</span> gene1(genome) <span class="hljs-op">→</span> gene2(result) <span class="hljs-op">→</span> gene3(result) <span class="hljs-op">→</span> expressed_values
      </div>

      <p>The final <code>expressed_values</code> array is what the problem's <code>evaluate()</code> function receives. This means genes can pre-process, sort, scale, or otherwise reshape the genome before it's scored — allowing the same raw genome to be interpreted very differently depending on which genes are active.</p>

      <h4 class="help-subhead">Opening the Gene Editor</h4>
      <p>Click <strong>✎ EDIT</strong> in the Gene Registry panel header, or the <strong>✎ EDIT</strong> button next to any gene in the gene list modal.</p>

      <div class="help-item-list">
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--purple);border-color:#604090">⊕ NEW GENE</span></div>
          <p>Opens a blank gene editor. Write the function body, assign organism types, then save. The gene is immediately available for use in organism type gene pools.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">✎ EDIT (per gene)</span></div>
          <p>Pre-fills the editor with the gene's current function body and type assignments. The name cannot be changed after creation.</p>
        </div>
      </div>

      <h4 class="help-subhead">Gene Editor Fields</h4>

      <div class="help-field-grid">
        <div class="help-field">
          <div class="help-field-name">Gene Name</div>
          <div class="help-field-desc">A unique camelCase identifier — no spaces or special characters. Examples: <code>spiralSearch</code>, <code>mirrorFold</code>, <code>boltzmannSelect</code>. The name is shown in organism type gene pools and the registry panel.</div>
        </div>
        <div class="help-field">
          <div class="help-field-name">Organism Types</div>
          <div class="help-field-desc">Which organism types are eligible to carry this gene. Shown as coloured chips matching each type's colour. Saving a gene automatically adds or removes it from each type's gene pool to match your selection.</div>
        </div>
        <div class="help-field">
          <div class="help-field-name">Function Body</div>
          <div class="help-field-desc">The JavaScript code that runs when this gene is expressed. It receives <code>genome</code> (a number array) and <code>params</code> (an object from the active problem). It <strong>must return a new array</strong> of numbers, ideally the same length as the input.</div>
        </div>
      </div>

      <h4 class="help-subhead">Writing Gene Functions</h4>
      <p>The function signature is always <code>function(genome, params)</code>. Here are examples ranging from simple to advanced:</p>

      <div class="help-code-block"><span class="hljs-comment">// Clamp all values toward the centre — reduces extremes</span>
<span class="hljs-kw">return</span> genome.<span class="hljs-fn">map</span>(v <span class="hljs-op">=&gt;</span> v + (<span class="hljs-num">0.5</span> - v) * <span class="hljs-num">0.05</span>);
      </div>

      <div class="help-code-block"><span class="hljs-comment">// Sort genome values by rank — good for ordering problems like TSP</span>
<span class="hljs-kw">const</span> idx = genome.<span class="hljs-fn">map</span>((v, i) <span class="hljs-op">=&gt;</span> [v, i]).<span class="hljs-fn">sort</span>((a, b) <span class="hljs-op">=&gt;</span> a[<span class="hljs-num">0</span>] - b[<span class="hljs-num">0</span>]);
<span class="hljs-kw">const</span> out = <span class="hljs-kw">new</span> <span class="hljs-fn">Array</span>(genome.length);
idx.<span class="hljs-fn">forEach</span>(([, i], rank) <span class="hljs-op">=&gt;</span> { out[i] = rank / (genome.length - <span class="hljs-num">1</span>); });
<span class="hljs-kw">return</span> out;
      </div>

      <div class="help-code-block"><span class="hljs-comment">// Mirror second half — forces symmetry in the genome</span>
<span class="hljs-kw">const</span> half = Math.<span class="hljs-fn">floor</span>(genome.length / <span class="hljs-num">2</span>);
<span class="hljs-kw">const</span> out  = [...genome];
<span class="hljs-kw">for</span> (<span class="hljs-kw">let</span> i = <span class="hljs-num">0</span>; i &lt; half; i++) out[i + half] = <span class="hljs-num">1</span> - out[i];
<span class="hljs-kw">return</span> out;
      </div>

      <div class="help-code-block"><span class="hljs-comment">// Gaussian noise — subtle perturbation using Box-Muller transform</span>
<span class="hljs-kw">return</span> genome.<span class="hljs-fn">map</span>(v <span class="hljs-op">=&gt;</span> {
  <span class="hljs-kw">const</span> u  = Math.<span class="hljs-fn">random</span>(), u2 = Math.<span class="hljs-fn">random</span>();
  <span class="hljs-kw">const</span> n  = Math.<span class="hljs-fn">sqrt</span>(-<span class="hljs-num">2</span> * Math.<span class="hljs-fn">log</span>(u)) * Math.<span class="hljs-fn">cos</span>(<span class="hljs-num">2</span> * Math.PI * u2);
  <span class="hljs-kw">return</span> Math.<span class="hljs-fn">max</span>(<span class="hljs-num">0</span>, Math.<span class="hljs-fn">min</span>(<span class="hljs-num">1</span>, v + n * <span class="hljs-num">0.04</span>));
});
      </div>

      <div class="help-item-list" style="margin-top:8px">
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--green);border-color:var(--green-dim)">▶ TEST Button</span></div>
          <p>Runs the current function body with 8 random genome values and shows the input and output arrays side by side. Use this to verify your function works and returns the expected kind of values before saving. Any JavaScript error will appear in red beneath the editor.</p>
        </div>
      </div>

      <h4 class="help-subhead">Default Genes Reference</h4>
      <div class="help-gene-table">
        <div class="help-gene-row header">
          <span>Gene</span><span>Types</span><span>What it does</span>
        </div>
        <div class="help-gene-row"><span class="mono">boundaryPush</span><span>Explorer, Mutant</span><span>Nudges extreme values (near 0 or 1) back toward the interior of the search space</span></div>
        <div class="help-gene-row"><span class="mono">randomWalk</span><span>Explorer, Mutant</span><span>Randomly shifts one genome value by a small amount each time — creates local exploration</span></div>
        <div class="help-gene-row"><span class="mono">mirrorFold</span><span>Explorer</span><span>Mirrors the first half of the genome into the second half (inverted) — forces structural symmetry</span></div>
        <div class="help-gene-row"><span class="mono">gradientNudge</span><span>Climber, Optimizer</span><span>Gently pulls all values toward 0.5 — reduces extremes and stabilises the genome</span></div>
        <div class="help-gene-row"><span class="mono">elitePull</span><span>Climber</span><span>Scales the whole genome slightly toward the centre — conservative convergence</span></div>
        <div class="help-gene-row"><span class="mono">sinTransform</span><span>Optimizer, Climber</span><span>Applies a sine curve to each value — remaps the genome non-linearly, compressing extremes</span></div>
        <div class="help-gene-row"><span class="mono">normalize</span><span>Optimizer, Mutant</span><span>Divides all values by the maximum — scales the genome to fill [0, 1] relative to itself</span></div>
        <div class="help-gene-row"><span class="mono">rankSort</span><span>Optimizer</span><span>Replaces values with their rank order (as fractions of genome length) — useful for ordering problems</span></div>
        <div class="help-gene-row"><span class="mono">bitFlip</span><span>Mutant</span><span>Randomly replaces ~5% of genome values with new random numbers — high-entropy disruption</span></div>
        <div class="help-gene-row"><span class="mono">gaussianNoise</span><span>Mutant, Explorer</span><span>Adds normally-distributed noise to every value — realistic biological mutation model</span></div>
      </div>

      <div class="help-tip">
        <span class="help-tip-icon">⚠</span>
        <span>Deleting a gene removes it from the registry but does not remove it from organism type gene pools automatically. Open each affected type in the type editor and deselect the deleted gene, then reset.</span>
      </div>
    `
  },

  {
    id: 'dashboard',
    icon: '◉',
    label: 'LIVE — Dashboard',
    color: 'var(--amber)',
    content: `
      <p>The Dashboard shows five live metrics updated every generation. These give you an instant read on how the simulation is progressing.</p>

      <div class="help-item-list">
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">Generation</span></div>
          <p>How many generations have elapsed since the last reset. A <em>generation</em> is one full cycle of evaluation → selection → reproduction. At speed 1× roughly one generation passes per second; at 20× with batch stepping it can be hundreds per second.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">Best Fitness</span></div>
          <p>The highest fitness score (0–1) achieved by any organism in the current population. This value monotonically increases or stays flat — it can never decrease because elite organisms always survive to the next generation.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">Avg Fitness</span></div>
          <p>The mean fitness across all organisms. The gap between Best and Avg tells you about population diversity — a large gap means a few exceptional individuals in a sea of struggling ones; a small gap means the population has converged.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">Population</span></div>
          <p>Current organism count. This should remain close to Max Pop. If it drops significantly, check that your organism type weights add up to a meaningful number of organisms.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">Goal</span></div>
          <p>Shows the active goal threshold and turns <span style="color:var(--green)">green with ✓ ACHIEVED</span> when Best Fitness crosses it. This is purely informational — the simulation continues running after the goal is reached, often finding even better solutions.</p>
        </div>
      </div>
    `
  },

  {
    id: 'viz',
    icon: '▣',
    label: 'VIZ — Live Population View',
    color: 'var(--cyan)',
    content: `
      <p>The central canvas renders a live visualization of the population, updated every frame. Each problem has its own visualization style designed to make the evolutionary process visible and intuitive.</p>

      <div class="help-item-list">
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--amber);border-color:var(--amber-dim)">Peak Finder</span></div>
          <p>Shows the multi-modal fitness landscape as a heat map — brighter (more orange) areas are higher fitness peaks. Each organism appears as a coloured dot sized by its fitness. The <strong>best organism</strong> is shown with a bright ring around it. Watch the population drift toward peaks and cluster around the global maximum over time.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--cyan);border-color:var(--cyan-dim)">Function Approximation</span></div>
          <p>The amber line is the target function. Each organism's polynomial curve is drawn in its type colour, with higher-fitness organisms drawn more opaque. The best organism's curve is thicker. You'll see the population's curves converge toward the target over generations.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--green);border-color:var(--green-dim)">Knapsack</span></div>
          <p>Each vertical bar pair represents an item — the blue portion is its weight, the amber portion its value. Cyan outlines mark which items the best organism selected. The red dashed line is the weight capacity limit. A good solution keeps total weight under the line while maximising total value.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--purple);border-color:#604090">Traveling Salesman</span></div>
          <p>Cities are cyan dots. Each organism's tour is drawn as faint lines in its type colour. The best organism's tour is highlighted in amber. Watch the amber tour shorten and straighten as the population discovers more efficient routes.</p>
        </div>
      </div>

      <div class="help-tip">
        <span class="help-tip-icon">💡</span>
        <span>The visualization updates at 60fps independently of the simulation speed — you'll always see a smooth live picture even at maximum speed.</span>
      </div>
    `
  },

  {
    id: 'history',
    icon: '〜',
    label: 'HIST — Fitness History',
    color: 'var(--amber)',
    content: `
      <p>The Fitness History panel shows two live charts beneath the main visualization.</p>

      <div class="help-item-list">
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--amber);border-color:var(--amber-dim)">━ BEST (amber line)</span></div>
          <p>The best fitness score each generation. This line should trend upward as the population improves. A flat plateau means the population has converged — try increasing mutation rate or adding Mutant-type organisms to escape it.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">━ AVG (grey line)</span></div>
          <p>The average fitness each generation. This line being well below Best indicates high diversity; tracking close to Best means the population has converged. The amber goal line is drawn horizontally for reference.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">TYPE DISTRIBUTION bar</span></div>
          <p>A segmented horizontal bar showing the current proportion of each organism type in the population. Each segment is coloured by type. Because new organisms can inherit the type of either parent, the mix can shift across generations — watch which types come to dominate as evolution progresses.</p>
        </div>
      </div>
    `
  },

  {
    id: 'organisms',
    icon: '≡',
    label: 'POP — Organisms Panel',
    color: 'var(--green)',
    content: `
      <p>The Organisms panel lists the top 20 organisms by fitness, updated each generation. Each row shows key information about a single organism.</p>

      <div class="help-item-list">
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--green);border-color:var(--green-dim)">ID</span></div>
          <p>A unique sequential number assigned at birth. IDs increase monotonically — higher IDs are younger organisms. The ID resets to 1 on each simulation reset.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--green);border-color:var(--green-dim)">TYPE</span></div>
          <p>The organism type, coloured to match its type definition. Types can shift across generations — an organism inherits the type of one of its parents, and occasionally "crosses" to the other parent's type.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--green);border-color:var(--green-dim)">FITNESS</span></div>
          <p>The most recently computed fitness score (0–1). The list is sorted by this value, highest first.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--green);border-color:var(--green-dim)">AGE</span></div>
          <p>How many generations this organism has survived (shown as "g"). Elite organisms — the top 3 by fitness — survive intact to the next generation without reproduction, so they can accumulate age while everyone else is replaced.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag" style="color:var(--green);border-color:var(--green-dim)">GENOME bar</span></div>
          <p>A proportional bar showing the organism's fitness visually. The bar fills in the organism's type colour, making it easy to scan for the strongest performers at a glance.</p>
        </div>
      </div>

      <p>The <strong>best organism</strong> has a highlighted amber border on its row. This is the organism whose genome and gene expression is used as the "champion" in the visualization.</p>
    `
  },

  {
    id: 'eventlog',
    icon: '❯',
    label: 'LOG — Event Stream',
    color: 'var(--text-dim)',
    content: `
      <p>The Event Stream records notable milestones as the simulation runs. Entries are prepended to the top, so the most recent events appear first.</p>

      <div class="help-item-list">
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">New best</span></div>
          <p>Logged whenever a new highest fitness is achieved. Shows the organism ID, type, and exact fitness score. These events mark real evolutionary progress.</p>
        </div>
        <div class="help-item">
          <div class="help-item-head"><span class="help-tag">Generation summaries</span></div>
          <p>Every 10 generations a summary is logged showing the generation number, population size, and average fitness. Use these to gauge overall convergence speed.</p>
        </div>
      </div>

      <p>The generation number prefix (e.g. <span style="color:var(--amber-dim);font-family:var(--font-mono)">G47</span>) lets you correlate events with the fitness history chart. Up to 50 events are stored; older entries are discarded as new ones arrive.</p>
    `
  },

  {
    id: 'tips',
    icon: '★',
    label: 'Tips & Experiments',
    color: 'var(--amber)',
    content: `
      <h4 class="help-subhead">Getting Started</h4>
      <div class="help-item-list">
        <div class="help-item">
          <p>1. Leave all defaults. Click <strong>▶ RUN</strong> at speed 3×. Watch the population converge on Peak Finder. The best organism's dot will migrate toward the brightest part of the heat map.</p>
        </div>
        <div class="help-item">
          <p>2. Once it plateaus, increase <strong>Mut% Rate</strong> to 30%, hit <strong>RESET</strong>, and run again. Notice the more chaotic initial search, which often finds better peaks.</p>
        </div>
        <div class="help-item">
          <p>3. Try setting all type weights to 0 except <strong>Mutant</strong>. Reset and run. Then try with only <strong>Climber</strong>. Compare how quickly each type converges and how high it gets.</p>
        </div>
      </div>

      <h4 class="help-subhead">Interesting Experiments</h4>
      <div class="help-tip-grid">
        <div class="help-tip-card">
          <div class="help-tip-card-title">Monoculture vs Diversity</div>
          <p>Run with a single type at 100%, note the final fitness reached after 200 generations. Then run with all four types balanced equally. Mixed populations often find better solutions because different strategies complement each other.</p>
        </div>
        <div class="help-tip-card">
          <div class="help-tip-card-title">Gene Surgery</div>
          <p>Open the Gene editor and add the <code>rankSort</code> gene to the Explorer type. Reset and try the Traveling Salesman problem. The ordering capability of rankSort makes Explorers suddenly much more competitive on TSP.</p>
        </div>
        <div class="help-tip-card">
          <div class="help-tip-card-title">Custom Type Design</div>
          <p>Create a new type called "Hybrid" with a low mutation rate (5%), medium scale (15%), and every gene from every type in its pool. It will express a random mix of strategies each generation — sometimes this outperforms specialists.</p>
        </div>
        <div class="help-tip-card">
          <div class="help-tip-card-title">Write Your Own Gene</div>
          <p>Open the Gene editor, create a new gene. Try: <code>return genome.map((v,i) => i%2===0 ? v*v : Math.sqrt(v));</code> — this applies a power curve to alternating values, creating asymmetric genome processing. Assign it to Optimizer and see if it helps on Function Approximation.</p>
        </div>
      </div>

      <h4 class="help-subhead">Understanding Convergence</h4>
      <p>When the Best and Avg fitness lines in the History chart both flatten out, the population has <em>converged</em> — most organisms are similar and further improvement is slow. To break out of convergence:</p>
      <div class="help-item-list">
        <div class="help-item"><p>Increase the global <strong>Mut% Rate</strong> and reset — more mutation = more exploration.</p></div>
        <div class="help-item"><p>Add more <strong>Mutant</strong> type weight — Mutants are specifically designed to escape local optima via high-entropy disruption.</p></div>
        <div class="help-item"><p>Create a gene with aggressive random behaviour and assign it to your main type — a single high-entropy gene can restart exploration.</p></div>
        <div class="help-item"><p>Simply <strong>RESET</strong> and run again — genetic algorithms are stochastic, and a fresh seed sometimes finds a better basin of attraction.</p></div>
      </div>
    `
  }
];

/* ════════════════════════════════════════════════════════════
   HELP MODAL
   ════════════════════════════════════════════════════════════ */
export function openHelp() {
  const existing = document.getElementById('helpModal');
  if (existing) { existing.remove(); return; }

  const sidebarItems = SECTIONS.map((s, i) => `
    <div class="help-nav-item ${i === 0 ? 'active' : ''}" data-section="${s.id}">
      <span class="help-nav-icon" style="color:${s.color}">${s.icon}</span>
      <span class="help-nav-label">${s.label}</span>
    </div>
  `).join('');

  const contentPanes = SECTIONS.map((s, i) => `
    <div class="help-pane ${i === 0 ? 'active' : ''}" id="help-pane-${s.id}">
      <div class="help-pane-header" style="border-left:3px solid ${s.color}">
        <span class="help-pane-icon" style="color:${s.color}">${s.icon}</span>
        <h2 class="help-pane-title">${s.label}</h2>
      </div>
      <div class="help-pane-body">
        ${s.content}
      </div>
    </div>
  `).join('');

  const modal = document.createElement('div');
  modal.id = 'helpModal';
  modal.className = 'help-modal';
  modal.innerHTML = `
    <div class="help-box">
      <div class="help-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="color:var(--amber);font-size:20px">⬡</span>
          <span class="modal-title">EVOLVR DOCUMENTATION</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted)">v1.0</span>
          <button class="modal-close btn btn-ghost btn-sm" id="helpClose">&#x2715;</button>
        </div>
      </div>
      <div class="help-body">
        <nav class="help-sidebar">
          ${sidebarItems}
        </nav>
        <div class="help-content">
          ${contentPanes}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Animate in
  requestAnimationFrame(() => modal.classList.add('modal-visible'));

  // Close
  const close = () => {
    modal.classList.remove('modal-visible');
    modal.addEventListener('transitionend', () => modal.remove(), { once: true });
  };
  modal.querySelector('#helpClose').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  const escHandler = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  // Nav
  modal.querySelector('.help-sidebar').addEventListener('click', (e) => {
    const item = e.target.closest('.help-nav-item');
    if (!item) return;
    const sid = item.dataset.section;

    modal.querySelectorAll('.help-nav-item').forEach(el => el.classList.remove('active'));
    modal.querySelectorAll('.help-pane').forEach(el => el.classList.remove('active'));

    item.classList.add('active');
    modal.querySelector(`#help-pane-${sid}`)?.classList.add('active');
    modal.querySelector('.help-content').scrollTop = 0;
  });
}
