/* =============================================================
   MODALS.JS  —  Organism Type Editor & Gene Editor Modals
   ============================================================= */

import { OrganismTypes, GeneRegistry } from './engine.js';

/* ── COLOUR PALETTE ── */
const PALETTE = [
  '#f0a500','#00d4e8','#39e080','#a080ff',
  '#ff4455','#ff8c42','#00e0b0','#e040fb',
  '#7ec8e3','#f7c59f','#b0f2b4','#ff6b9d',
  '#5ce1e6','#ffde59','#c9f0ff','#d4a5a5',
];

/* ══════════════════════════════════════════════════════════════
   MODAL STACK
   ──────────────────────────────────────────────────────────────
   Instead of closing the list modal before opening the editor,
   we keep both in the DOM simultaneously. The list slides to the
   left (pushed back) while the editor slides in from the right.
   Closing/cancelling the editor reverses the animation and
   reveals the list again — a natural drill-down / back pattern.
   ══════════════════════════════════════════════════════════════ */
function pushModal(overlay) {
  /* Slide any currently-visible modal-box to the left (behind) */
  document.querySelectorAll('.modal-overlay.modal-visible .modal-box').forEach(box => {
    box.classList.add('modal-box-behind');
  });
  requestAnimationFrame(() => overlay.classList.add('modal-visible'));
}

function popModal(id, onPopped) {
  const el = document.getElementById(id);
  if (!el) { onPopped?.(); return; }

  el.classList.remove('modal-visible');
  el.addEventListener('transitionend', () => {
    el.remove();
    /* Restore the previous modal-box to centre */
    document.querySelectorAll('.modal-overlay.modal-visible .modal-box').forEach(box => {
      box.classList.remove('modal-box-behind');
    });
    onPopped?.();
  }, { once: true });
}

/* Full close — removes all modals in the stack */
export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('modal-visible');
  el.addEventListener('transitionend', () => el.remove(), { once: true });
}

function createModal(id, title, bodyHTML, footerHTML) {
  document.getElementById(id)?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = id;
  overlay.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true">
      <div class="modal-header">
        <span class="panel-tag">CFG</span>
        <span class="modal-title">${title}</span>
        <button class="modal-close btn btn-ghost btn-sm" aria-label="Close">&#x2715;</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-footer">${footerHTML}</div>
    </div>
  `;

  document.body.appendChild(overlay);

  /* Clicking the backdrop closes the entire stack */
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAllModals();
  });
  overlay.querySelector('.modal-close').addEventListener('click', closeAllModals);

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  return overlay;
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.classList.remove('modal-visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  });
}

/* ══════════════════════════════════════════════════════════════
   ORGANISM TYPE LIST
   ══════════════════════════════════════════════════════════════ */
export function openOrganismList(onChanged) {
  const body = `<div id="otl_list">${buildTypeListInner()}</div>`;
  const footer = `
    <button class="btn" id="otl_close">CLOSE</button>
    <button class="btn btn-primary" id="otl_new">&#x2295; NEW TYPE</button>
  `;

  const modal = createModal('orgListModal', 'ORGANISM TYPES', body, footer);
  pushModal(modal);

  /* Wire edit buttons via delegation */
  modal.querySelector('#otl_list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edittype]');
    if (btn) openOrganismEditor(btn.dataset.edittype, onChanged);
  });

  modal.querySelector('#otl_new').addEventListener('click', () => {
    openOrganismEditor(null, onChanged);
  });

  modal.querySelector('#otl_close').addEventListener('click', closeAllModals);
}

function refreshTypeList() {
  const el = document.getElementById('otl_list');
  if (el) el.innerHTML = buildTypeListInner();
}

function buildTypeListInner() {
  const types = OrganismTypes.all();
  if (!types.length) {
    return '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:11px">No organism types defined.</div>';
  }
  return types.map(t => `
    <div class="type-list-row">
      <div class="type-list-swatch" style="background:${t.color}22;border-color:${t.color}66">
        <span style="color:${t.color};font-family:var(--font-mono);font-size:20px;line-height:1">&#x2B21;</span>
      </div>
      <div class="type-list-info">
        <div class="type-list-name" style="color:${t.color}">${t.label}
          <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);font-weight:400;margin-left:6px">${t.id}</span>
        </div>
        <div class="type-list-desc">${t.description || '&mdash;'}</div>
        <div class="type-list-meta">
          <span>genome: ${t.genomeLength}</span>
          <span>mut rate: ${Math.round(t.mutationRate * 100)}%</span>
          <span>mut scale: ${Math.round(t.mutationScale * 100)}%</span>
          <span>${t.genePool.length} gene${t.genePool.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="type-gene-tags">
          ${t.genePool.map(g => `<span class="gene-mini-tag">${g}</span>`).join('')}
        </div>
      </div>
      <button class="btn btn-sm type-list-edit" data-edittype="${t.id}">&#x270E; EDIT</button>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════════════════════
   ORGANISM TYPE EDITOR
   ══════════════════════════════════════════════════════════════ */
export function openOrganismEditor(typeId, onChanged) {
  const isEdit    = typeId != null;
  const existing  = isEdit ? OrganismTypes.get(typeId) : null;

  const selectedGenes = new Set(existing?.genePool ?? []);
  let   pickedColor   = existing?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)];

  const genePicker = GeneRegistry.all().length
    ? GeneRegistry.all().map(g => {
        const on = selectedGenes.has(g.name);
        return `<div class="gene-chip ${on ? 'gene-chip-on' : ''}" data-gene="${g.name}" title="${g.name}">
          <span class="gene-chip-name">${g.name}</span>
          <span class="gene-chip-check">&#x2713;</span>
        </div>`;
      }).join('')
    : '<div style="color:var(--text-muted);font-size:10px;padding:4px">No genes registered yet. Create genes first.</div>';

  const colourPicker = PALETTE.map(c =>
    `<div class="color-swatch ${c === pickedColor ? 'color-swatch-sel' : ''}"
          data-color="${c}" style="background:${c}" title="${c}"></div>`
  ).join('');

  const bodyHTML = `
    <div class="modal-form">
      <div class="mf-row">
        <div class="mf-group mf-flex2">
          <label class="field-label">Display Name</label>
          <input class="field-input" id="mo_label" placeholder="e.g. Drifter"
                 value="${existing?.label ?? ''}">
        </div>
        <div class="mf-group mf-flex1">
          <label class="field-label">ID <span style="color:var(--text-muted)">(no spaces)</span></label>
          <input class="field-input mono" id="mo_id" placeholder="e.g. drifter"
                 value="${existing?.id ?? ''}"
                 ${isEdit ? 'readonly style="opacity:0.5;cursor:not-allowed"' : ''}>
        </div>
      </div>

      <div class="mf-group">
        <label class="field-label">Description</label>
        <input class="field-input" id="mo_desc"
               placeholder="Short description of this organism's strategy"
               value="${existing?.description ?? ''}">
      </div>

      <div class="mf-row">
        <div class="mf-group mf-flex1">
          <label class="field-label">Genome Length</label>
          <input class="field-input mono" id="mo_glen" type="number" min="4" max="32"
                 value="${existing?.genomeLength ?? 12}">
        </div>
        <div class="mf-group mf-flex1">
          <label class="field-label">Mutation Rate %</label>
          <input class="field-input mono" id="mo_mrate" type="number" min="1" max="80"
                 value="${Math.round((existing?.mutationRate ?? 0.12) * 100)}">
        </div>
        <div class="mf-group mf-flex1">
          <label class="field-label">Mutation Scale %</label>
          <input class="field-input mono" id="mo_mscale" type="number" min="1" max="80"
                 value="${Math.round((existing?.mutationScale ?? 0.20) * 100)}">
        </div>
      </div>

      <div class="mf-group">
        <label class="field-label">Colour</label>
        <div class="color-palette" id="mo_palette">${colourPicker}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <input class="field-input mono" id="mo_colorHex" value="${pickedColor}"
                 placeholder="#rrggbb" style="max-width:110px">
          <div class="color-preview" id="mo_colorPreview" style="background:${pickedColor}"></div>
          <span style="font-size:9px;color:var(--text-muted)">or enter hex code</span>
        </div>
      </div>

      <div class="mf-group">
        <label class="field-label">
          Gene Pool
          <span class="gene-sel-count" id="mo_geneCount">${selectedGenes.size} selected</span>
        </label>
        <div class="gene-chip-grid" id="mo_geneGrid">${genePicker}</div>
        <div class="gene-pool-note">Click genes to toggle. Organisms randomly express a subset each generation.</div>
      </div>
    </div>
  `;

  const footerHTML = `
    ${isEdit ? `<button class="btn btn-warn btn-sm" id="mo_delete">&#x2297; DELETE</button>` : ''}
    <button class="btn" id="mo_back">&#x2190; BACK</button>
    <button class="btn btn-primary" id="mo_save">${isEdit ? '&#x270E; SAVE CHANGES' : '&#x2295; CREATE TYPE'}</button>
  `;

  const overlay = createModal('orgModal',
    isEdit ? `EDIT: ${existing.label.toUpperCase()}` : 'NEW ORGANISM TYPE',
    bodyHTML, footerHTML
  );
  pushModal(overlay);

  /* Colour */
  const updateColor = (hex) => {
    pickedColor = hex;
    overlay.querySelectorAll('.color-swatch').forEach(sw =>
      sw.classList.toggle('color-swatch-sel', sw.dataset.color === hex)
    );
    overlay.querySelector('#mo_colorHex').value = hex;
    overlay.querySelector('#mo_colorPreview').style.background = hex;
  };
  overlay.querySelector('#mo_palette').addEventListener('click', (e) => {
    const sw = e.target.closest('.color-swatch');
    if (sw) updateColor(sw.dataset.color);
  });
  overlay.querySelector('#mo_colorHex').addEventListener('input', (e) => {
    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) updateColor(e.target.value);
  });

  /* Gene chips */
  overlay.querySelector('#mo_geneGrid').addEventListener('click', (e) => {
    const chip = e.target.closest('.gene-chip[data-gene]');
    if (!chip) return;
    const name = chip.dataset.gene;
    selectedGenes.has(name) ? selectedGenes.delete(name) : selectedGenes.add(name);
    chip.classList.toggle('gene-chip-on', selectedGenes.has(name));
    overlay.querySelector('#mo_geneCount').textContent = `${selectedGenes.size} selected`;
  });

  /* Back — pop editor, list re-appears */
  overlay.querySelector('#mo_back').addEventListener('click', () => {
    popModal('orgModal', () => {
      refreshTypeList();
    });
  });

  /* Delete */
  overlay.querySelector('#mo_delete')?.addEventListener('click', () => {
    if (!confirm(`Delete organism type "${existing.label}"?\nThis cannot be undone. Reset the simulation after deleting.`)) return;
    OrganismTypes.delete(typeId);
    onChanged?.();
    popModal('orgModal', () => refreshTypeList());
  });

  /* Save */
  overlay.querySelector('#mo_save').addEventListener('click', () => {
    const label  = overlay.querySelector('#mo_label').value.trim();
    const rawId  = overlay.querySelector('#mo_id').value.trim();
    const id     = isEdit ? typeId : rawId.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const desc   = overlay.querySelector('#mo_desc').value.trim();
    const gLen   = Math.max(4, Math.min(32,  +overlay.querySelector('#mo_glen').value   || 12));
    const mRate  = Math.max(0.01, Math.min(0.8, (+overlay.querySelector('#mo_mrate').value  || 12) / 100));
    const mScale = Math.max(0.01, Math.min(0.8, (+overlay.querySelector('#mo_mscale').value || 20) / 100));

    if (!label)                           { showModalError(overlay, 'Display name is required.'); return; }
    if (!id)                              { showModalError(overlay, 'ID is required.'); return; }
    if (!isEdit && OrganismTypes.get(id)) { showModalError(overlay, `ID "${id}" is already in use.`); return; }
    if (selectedGenes.size === 0)         { showModalError(overlay, 'Select at least one gene for the gene pool.'); return; }

    OrganismTypes.register({
      id, label, description: desc, color: pickedColor,
      genomeLength: gLen,
      genePool:     [...selectedGenes],
      mutationRate: mRate,
      mutationScale: mScale,
    });

    onChanged?.();
    popModal('orgModal', () => refreshTypeList());
  });
}

/* ══════════════════════════════════════════════════════════════
   GENE LIST
   ══════════════════════════════════════════════════════════════ */
export function openGeneList(onChanged) {
  const body = `<div id="gl_list">${buildGeneListInner()}</div>`;
  const footer = `
    <button class="btn" id="gl_close">CLOSE</button>
    <button class="btn btn-primary" id="gl_new">&#x2295; NEW GENE</button>
  `;

  const modal = createModal('geneListModal', 'GENE REGISTRY', body, footer);
  pushModal(modal);

  modal.querySelector('#gl_list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-editgene]');
    if (btn) openGeneEditor(btn.dataset.editgene, onChanged);
  });

  modal.querySelector('#gl_new').addEventListener('click', () => {
    openGeneEditor(null, onChanged);
  });

  modal.querySelector('#gl_close').addEventListener('click', closeAllModals);
}

function refreshGeneList() {
  const el = document.getElementById('gl_list');
  if (el) el.innerHTML = buildGeneListInner();
}

function buildGeneListInner() {
  const genes = GeneRegistry.all();
  if (!genes.length) {
    return '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:11px">No genes registered.</div>';
  }
  return genes.map(g => {
    const typeTags = g.types.map(tid => {
      const t   = OrganismTypes.get(tid);
      const col = t?.color ?? 'var(--text-muted)';
      return `<span class="gene-mini-tag" style="color:${col};border-color:${col}44;background:${col}11">${t?.label ?? tid}</span>`;
    }).join('');

    return `
      <div class="gene-list-row">
        <div class="gene-list-info">
          <div class="gene-list-name">${g.name}</div>
          <div class="gene-type-tags">${typeTags || '<span style="color:var(--text-muted);font-size:9px">no types assigned</span>'}</div>
        </div>
        <button class="btn btn-sm" data-editgene="${g.name}">&#x270E; EDIT</button>
      </div>
    `;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════
   GENE EDITOR
   ══════════════════════════════════════════════════════════════ */
export function openGeneEditor(geneName, onChanged) {
  const isEdit   = geneName != null;
  const existing = isEdit ? GeneRegistry.get(geneName) : null;

  const allTypes      = OrganismTypes.all();
  const selectedTypes = new Set(existing?.types ?? []);

  const defaultBody = isEdit
    ? extractFnBody(existing.fn)
    : `// genome: number[]  — values in [0, 1], one per genome slot
// params: object    — from the active problem (can be empty)
// Must return an array of the same length as genome.

return genome.map(v => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.1)));`;

  const typeChips = allTypes.length
    ? allTypes.map(t => {
        const on  = selectedTypes.has(t.id);
        const sty = on ? `background:${t.color}22;border-color:${t.color};color:${t.color}` : '';
        return `<div class="gene-chip type-chip ${on ? 'gene-chip-on' : ''}"
                     data-type="${t.id}" style="${sty}">
          <span class="gene-chip-name" style="${on ? `color:${t.color}` : ''}">${t.label}</span>
          <span class="gene-chip-check" style="color:${t.color}">&#x2713;</span>
        </div>`;
      }).join('')
    : '<div style="color:var(--text-muted);font-size:10px;padding:4px">No organism types defined yet.</div>';

  const bodyHTML = `
    <div class="modal-form">
      <div class="mf-row">
        <div class="mf-group mf-flex2">
          <label class="field-label">Gene Name <span style="color:var(--text-muted)">(camelCase, no spaces)</span></label>
          <input class="field-input mono" id="ge_name" placeholder="e.g. spiralSearch"
                 value="${existing?.name ?? ''}"
                 ${isEdit ? 'readonly style="opacity:0.5;cursor:not-allowed"' : ''}>
        </div>
      </div>

      <div class="mf-group">
        <label class="field-label">
          Organism Types
          <span class="gene-sel-count" id="ge_typeCount">${selectedTypes.size} selected</span>
        </label>
        <div class="gene-chip-grid" id="ge_typeGrid">${typeChips}</div>
        <div class="gene-pool-note">Which organism types are eligible to carry this gene.</div>
      </div>

      <div class="mf-group">
        <label class="field-label">
          Gene Function
          <span style="color:var(--text-muted);font-size:9px;margin-left:6px">
            body of: <code style="color:var(--cyan)">function(genome, params) { ... }</code>
          </span>
        </label>
        <textarea class="code-editor" id="ge_fn" rows="9" spellcheck="false">${escapeHTML(defaultBody)}</textarea>
        <div class="code-error" id="ge_error"></div>
      </div>

      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-sm" id="ge_test">&#x25B6; TEST WITH RANDOM GENOME</button>
        <span style="font-size:9px;color:var(--text-muted)">Runs against 8 random values to verify output</span>
      </div>
      <div class="gene-test-result" id="ge_testOut" style="display:none"></div>
    </div>
  `;

  const footerHTML = `
    ${isEdit ? `<button class="btn btn-warn btn-sm" id="ge_delete">&#x2297; DELETE GENE</button>` : ''}
    <button class="btn" id="ge_back">&#x2190; BACK</button>
    <button class="btn btn-primary" id="ge_save">${isEdit ? '&#x270E; SAVE GENE' : '&#x2295; CREATE GENE'}</button>
  `;

  const overlay = createModal('geneModal',
    isEdit ? `EDIT GENE: ${geneName}` : 'NEW GENE',
    bodyHTML, footerHTML
  );
  pushModal(overlay);

  /* Type chip toggles */
  overlay.querySelector('#ge_typeGrid').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-type]');
    if (!chip) return;
    const tid  = chip.dataset.type;
    const type = OrganismTypes.get(tid);
    selectedTypes.has(tid) ? selectedTypes.delete(tid) : selectedTypes.add(tid);
    const on = selectedTypes.has(tid);
    chip.classList.toggle('gene-chip-on', on);
    if (on && type) {
      chip.style.cssText = `background:${type.color}22;border-color:${type.color};color:${type.color}`;
      chip.querySelector('.gene-chip-name').style.color  = type.color;
      chip.querySelector('.gene-chip-check').style.color = type.color;
    } else {
      chip.style.cssText = '';
      chip.querySelector('.gene-chip-name').style.color  = '';
      chip.querySelector('.gene-chip-check').style.color = '';
    }
    overlay.querySelector('#ge_typeCount').textContent = `${selectedTypes.size} selected`;
  });

  /* Test */
  overlay.querySelector('#ge_test').addEventListener('click', () => {
    const errEl = overlay.querySelector('#ge_error');
    const outEl = overlay.querySelector('#ge_testOut');
    const body  = overlay.querySelector('#ge_fn').value;
    errEl.textContent   = '';
    outEl.style.display = 'none';
    try {
      // eslint-disable-next-line no-new-func
      const fn     = new Function('genome', 'params', body);
      const testIn = Array.from({ length: 8 }, () => +Math.random().toFixed(4));
      const result = fn([...testIn], {});
      if (!Array.isArray(result) && !(result instanceof Float32Array))
        throw new Error('Return value must be an Array (not ' + typeof result + ')');
      outEl.style.display = 'block';
      outEl.innerHTML = `
        <div class="test-in"> IN:  [${testIn.map(v => v.toFixed(4)).join(', ')}]</div>
        <div class="test-out">OUT: [${Array.from(result).map(v => (+v).toFixed(4)).join(', ')}]</div>
      `;
    } catch (e) {
      errEl.textContent = `&#x2717; ${e.message}`;
    }
  });

  /* Back — pop editor, gene list re-appears */
  overlay.querySelector('#ge_back').addEventListener('click', () => {
    popModal('geneModal', () => refreshGeneList());
  });

  /* Delete */
  overlay.querySelector('#ge_delete')?.addEventListener('click', () => {
    if (!confirm(`Delete gene "${geneName}"?\nOrganism types that reference it will still list it until you edit them.`)) return;
    GeneRegistry.delete(geneName);
    onChanged?.();
    popModal('geneModal', () => refreshGeneList());
  });

  /* Save */
  overlay.querySelector('#ge_save').addEventListener('click', () => {
    const errEl = overlay.querySelector('#ge_error');
    const name  = isEdit
      ? geneName
      : overlay.querySelector('#ge_name').value.trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '');
    const body  = overlay.querySelector('#ge_fn').value;
    errEl.textContent = '';

    if (!name)                                   { errEl.textContent = '&#x2717; Gene name is required.'; return; }
    if (!isEdit && GeneRegistry.get(name))        { errEl.textContent = `&#x2717; Gene "${name}" already exists.`; return; }
    if (selectedTypes.size === 0)                 { errEl.textContent = '&#x2717; Assign this gene to at least one organism type.'; return; }

    let fn;
    try {
      // eslint-disable-next-line no-new-func
      fn = new Function('genome', 'params', body);
      const testResult = fn([0.5, 0.3, 0.7, 0.2, 0.8, 0.1, 0.6, 0.4], {});
      if (!Array.isArray(testResult) && !(testResult instanceof Float32Array))
        throw new Error('Return value must be an Array');
    } catch (e) {
      errEl.textContent = `&#x2717; Function error: ${e.message}`;
      return;
    }

    const typeList = [...selectedTypes];
    GeneRegistry.register(name, typeList, fn);

    /* Auto-add to gene pool of selected types (new genes only) */
    if (!isEdit) {
      for (const tid of typeList) {
        const t = OrganismTypes.get(tid);
        if (t && !t.genePool.includes(name)) t.genePool.push(name);
      }
    }

    onChanged?.();
    popModal('geneModal', () => refreshGeneList());
  });
}

/* ── HELPERS ── */
function showModalError(overlay, msg) {
  const footer = overlay.querySelector('.modal-footer');
  let err = footer.querySelector('.modal-inline-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'modal-inline-error';
    err.style.cssText = 'font-size:11px;color:var(--red);font-family:var(--font-mono);margin-right:auto;order:-1';
    footer.prepend(err);
  }
  err.textContent = `\u2717 ${msg}`;
  overlay.querySelector('.modal-box').classList.add('modal-shake');
  overlay.querySelector('.modal-box').addEventListener('animationend', () =>
    overlay.querySelector('.modal-box')?.classList.remove('modal-shake'), { once: true }
  );
}

/*
 * extractFnBody
 * ─────────────
 * new Function('genome','params', body).toString() always produces:
 *   "function anonymous(genome,params\n) {\n<body>\n}"
 *
 * We extract by finding the first '{' and the last '}' in the string,
 * then taking everything in between and stripping the surrounding newlines.
 * This is more robust than a regex because it handles any body content,
 * including nested braces, without worrying about greedy matching.
 *
 * For arrow functions stored without new Function() (e.g. defined inline
 * in problems.js), there may be no braces at all (concise arrow). In that
 * case we return the source as-is with a comment so the user can see it.
 */
function extractFnBody(fn) {
  try {
    const src        = fn.toString();
    const firstBrace = src.indexOf('{');
    const lastBrace  = src.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      // Concise arrow function — no braces, the whole expression is the body.
      // Wrap it so the user can see the intent and edit it properly.
      return `// Converted from concise arrow — edit as needed:\nreturn ${src.slice(src.indexOf('=>') + 2).trim()};`;
    }

    const inner = src.slice(firstBrace + 1, lastBrace);
    // Strip the single leading newline and trailing newline that new Function adds.
    return inner.replace(/^\n/, '').replace(/\n$/, '');
  } catch {
    return '// Could not decompile — write your own body here.\nreturn genome;';
  }
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
