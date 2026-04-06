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
    file: './assets/help/intro.htm'
  },

  {
    id: 'header',
    icon: '▶',
    label: 'Header — Simulation Controls',
    color: 'var(--amber)',
    file: './assets/help/header.htm'
  },

  {
    id: 'problem',
    icon: '◎',
    label: 'PROB — Problem Panel',
    color: 'var(--cyan)',
    file: `./assets/help/problem.htm`
  },

  {
    id: 'params',
    icon: '⚙',
    label: 'CFG — Parameters Panel',
    color: 'var(--amber)',
    file: `./assets/help/params.htm`
  },

  {
    id: 'organism-types',
    icon: '●',
    label: 'Organism Types',
    color: 'var(--amber)',
    file: './assets/help/organism-types.htm'
  },

  {
    id: 'organisms-editor',
    icon: '⬡',
    label: 'Editing Organism Types',
    color: 'var(--amber)',
    file: './assets/help/organisms-editor.htm'
  },

  {
    id: 'genes',
    icon: '◈',
    label: 'DNA — Gene Registry & Editing Genes',
    color: 'var(--purple)',
    file: './assets/help/genes.htm'
  },

  {
    id: 'dashboard',
    icon: '◉',
    label: 'LIVE — Dashboard',
    color: 'var(--amber)',
    file: './assets/help/dashboard.htm'
  },

  {
    id: 'viz',
    icon: '▣',
    label: 'VIZ — Live Population View',
    color: 'var(--cyan)',
    file: './assets/help/viz.htm'
  },

  {
    id: 'history',
    icon: '〜',
    label: 'HIST — Fitness History',
    color: 'var(--amber)',
    file: './assets/help/history.htm'
  },

  {
    id: 'organisms',
    icon: '≡',
    label: 'POP — Organisms Panel',
    color: 'var(--green)',
    file: './assets/help/organisms.htm'
  },

  {
    id: 'eventlog',
    icon: '❯',
    label: 'LOG — Event Stream',
    color: 'var(--text-dim)',
    file: './assets/help/eventlog.htm'
  },

  {
    id: 'tips',
    icon: '★',
    label: 'Tips & Experiments',
    color: 'var(--amber)',
    file: './assets/help/tips.htm'
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
      <div class="help-pane-body" id="help-pane-body-${s.id}">
        ${s?.content}
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

  //Load file if necessary
  SECTIONS.forEach(s => {
    if(s.file) {
      const loaded = loadHTM(s.file);
      loaded.then(content => {
        document.getElementById('help-pane-body-' + s.id).innerHTML = content;
      })
    }
  });
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

/**
 * Load the htm content
 * @param file
 * @param id
 * @returns {Promise<string>}
 */
async function loadHTM(file, id) {
  try {
    const response = await fetch(file);
    if (!response.ok) throw new Error('Network response was not ok');

    return await response.text();
  } catch (error) {
    console.error('Error loading HTML:', error);
  }
}
