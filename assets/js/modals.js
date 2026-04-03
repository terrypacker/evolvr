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
   SHARED MODAL SCAFFOLDING
   ══════════════════════════════════════════════════════════════ */
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
        <button class="modal-close btn btn-ghost btn-sm" data-close="${id}">✕</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-footer">${footerHTML}</div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.dataset.close === id) closeModal(id);
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') { closeModal(id); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  requestAnimationFrame(() => overlay.classList.add('modal-visible'));
  return overlay;
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('modal-visible');
  el.addEventListener('transitionend', () => el.remove(), { once: true });
}

/* ══════════════════════════════════════════════════════════════
   ORGANISM TYPE LIST MODAL
   ══════════════════════════════════════════════════════════════ */
export function openOrganismList(onChanged) {
  const body = `<div id="otl_list">${buildTypeListInner(onChanged)}</div>`;
  const footer = `
    <button class="btn" data-close="orgListModal">CLOSE</button>
    <button class="btn btn-primary" id="otl_new">⊕ NEW TYPE</button>
  `;

  const modal = createModal('orgListModal', 'ORGANISM TYPES', body, footer);

  wireTypeListEdits(modal, onChanged);

  modal.querySelector('#otl_new').addEventListener('click', () => {
    closeModal('orgListModal');
    openOrganismEditor(null, () => {
      onChanged?.();
      openOrganismList(onChanged);
    });
  });
}

function buildTypeListInner(onChanged) {
  const types = OrganismTypes.all();
  if (!types.length) return '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:11px">No organism types defined.</div>';

  return types.map(t => `
    <div class="type-list-row">
      <div class="type-list-swatch" style="background:${t.color}22;border-color:${t.color}66">
        <span style="color:${t.color};font-family:var(--font-mono);font-size:20px;line-height:1">⬡</span>
      </div>
      <div class="type-list-info">
        <div class="type-list-name" style="color:${t.color}">${t.label}
          <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);font-weight:400;margin-left:6px">${t.id}</span>
        </div>
        <div class="type-list-desc">${t.description || '—'}</div>
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
      <button class="btn btn-sm type-list-edit" data-edittype="${t.id}">✎ EDIT</button>
    </div>
  `).join('');
}

function wireTypeListEdits(modal, onChanged) {
  modal.querySelectorAll('[data-edittype]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.edittype;
      closeModal('orgListModal');
      openOrganismEditor(id, () => {
        onChanged?.();
        openOrganismList(onChanged);
      });
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   ORGANISM TYPE EDITOR MODAL
   ══════════════════════════════════════════════════════════════ */
export function openOrganismEditor(typeId, onSave) {
  const isEdit   = typeId !== null && typeId !== undefined;
  const existing = isEdit ? OrganismTypes.get(typeId) : null;

  const allGenes     = GeneRegistry.all();
  const selectedGenes = new Set(existing?.genePool ?? []);
  let pickedColor     = existing?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)];

  /* ── Gene picker chips ── */
  const genePicker = allGenes.length
    ? allGenes.map(g => {
        const on = selectedGenes.has(g.name);
        return `<div class="gene-chip ${on ? 'gene-chip-on' : ''}" data-gene="${g.name}" title="${g.name}">
          <span class="gene-chip-name">${g.name}</span>
          <span class="gene-chip-check">✓</span>
        </div>`;
      }).join('')
    : '<div style="color:var(--text-muted);font-size:10px;padding:4px">No genes registered yet. Create genes first.</div>';

  /* ── Colour palette ── */
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
                 value="${existing?.id ?? ''}" ${isEdit ? 'readonly style="opacity:0.5;cursor:not-allowed"' : ''}>
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
    ${isEdit ? `<button class="btn btn-warn btn-sm" id="mo_delete">⊗ DELETE</button>` : ''}
    <button class="btn" data-close="orgModal">CANCEL</button>
    <button class="btn btn-primary" id="mo_save">${isEdit ? '✎ SAVE CHANGES' : '⊕ CREATE TYPE'}</button>
  `;

  const overlay = createModal('orgModal', isEdit ? 'EDIT ORGANISM TYPE' : 'NEW ORGANISM TYPE', bodyHTML, footerHTML);

  /* ── Colour palette wiring ── */
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

  /* ── Gene chip wiring ── */
  overlay.querySelector('#mo_geneGrid').addEventListener('click', (e) => {
    const chip = e.target.closest('.gene-chip[data-gene]');
    if (!chip) return;
    const name = chip.dataset.gene;
    selectedGenes.has(name) ? selectedGenes.delete(name) : selectedGenes.add(name);
    chip.classList.toggle('gene-chip-on', selectedGenes.has(name));
    overlay.querySelector('#mo_geneCount').textContent = `${selectedGenes.size} selected`;
  });

  /* ── Delete ── */
  overlay.querySelector('#mo_delete')?.addEventListener('click', () => {
    if (!confirm(`Delete organism type "${existing.label}"?\nThis cannot be undone. Reset the simulation after deleting.`)) return;
    OrganismTypes.delete(typeId);
    closeModal('orgModal');
    onSave?.();
  });

  /* ── Cancel ── */
  overlay.querySelector('[data-close="orgModal"]').addEventListener('click', () => closeModal('orgModal'));

  /* ── Save ── */
  overlay.querySelector('#mo_save').addEventListener('click', () => {
    const label  = overlay.querySelector('#mo_label').value.trim();
    const rawId  = overlay.querySelector('#mo_id').value.trim();
    const id     = isEdit ? typeId : rawId.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const desc   = overlay.querySelector('#mo_desc').value.trim();
    const gLen   = Math.max(4, Math.min(32, +overlay.querySelector('#mo_glen').value || 12));
    const mRate  = Math.max(0.01, Math.min(0.8, (+overlay.querySelector('#mo_mrate').value || 12) / 100));
    const mScale = Math.max(0.01, Math.min(0.8, (+overlay.querySelector('#mo_mscale').value || 20) / 100));

    if (!label)               { showModalError(overlay, 'Display name is required.'); return; }
    if (!id)                  { showModalError(overlay, 'ID is required.'); return; }
    if (!isEdit && OrganismTypes.get(id)) { showModalError(overlay, `ID "${id}" is already in use.`); return; }
    if (selectedGenes.size === 0) { showModalError(overlay, 'Select at least one gene for the gene pool.'); return; }

    OrganismTypes.register({
      id, label, description: desc, color: pickedColor,
      genomeLength: gLen,
      genePool: [...selectedGenes],
      mutationRate: mRate,
      mutationScale: mScale,
    });

    closeModal('orgModal');
    onSave?.();
  });
}

/* ══════════════════════════════════════════════════════════════
   GENE LIST MODAL
   ══════════════════════════════════════════════════════════════ */
export function openGeneList(onChanged) {
  const body   = `<div id="gl_list">${buildGeneListInner()}</div>`;
  const footer = `
    <button class="btn" data-close="geneListModal">CLOSE</button>
    <button class="btn btn-primary" id="gl_new">⊕ NEW GENE</button>
  `;

  const modal = createModal('geneListModal', 'GENE REGISTRY', body, footer);
  wireGeneListEdits(modal, onChanged);

  modal.querySelector('#gl_new').addEventListener('click', () => {
    closeModal('geneListModal');
    openGeneEditor(null, () => {
      onChanged?.();
      openGeneList(onChanged);
    });
  });
}

function buildGeneListInner() {
  const genes = GeneRegistry.all();
  if (!genes.length) return '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:11px">No genes registered.</div>';

  return genes.map(g => {
    const typeTags = g.types.map(tid => {
      const t = OrganismTypes.get(tid);
      const col = t?.color ?? 'var(--text-muted)';
      return `<span class="gene-mini-tag" style="color:${col};border-color:${col}44;background:${col}11">${t?.label ?? tid}</span>`;
    }).join('');

    return `
      <div class="gene-list-row">
        <div class="gene-list-info">
          <div class="gene-list-name">${g.name}</div>
          <div class="gene-type-tags">${typeTags || '<span style="color:var(--text-muted);font-size:9px">no types assigned</span>'}</div>
        </div>
        <button class="btn btn-sm gene-list-edit" data-editgene="${g.name}">✎ EDIT</button>
      </div>
    `;
  }).join('');
}

function wireGeneListEdits(modal, onChanged) {
  modal.querySelectorAll('[data-editgene]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.editgene;
      closeModal('geneListModal');
      openGeneEditor(name, () => {
        onChanged?.();
        openGeneList(onChanged);
      });
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   GENE EDITOR MODAL
   ══════════════════════════════════════════════════════════════ */
export function openGeneEditor(geneName, onSave) {
  const isEdit   = geneName !== null && geneName !== undefined;
  const existing = isEdit ? GeneRegistry.get(geneName) : null;

  const allTypes      = OrganismTypes.all();
  const selectedTypes = new Set(existing?.types ?? []);

  /* ── Default function body ── */
  const defaultBody = existing
    ? extractFnBody(existing.fn)
    : `// genome: number[]  — values in [0, 1], one per genome slot
// params: object   — from the active problem (can be empty)
// Must return an array of the same length as genome.

return genome.map(v => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.1)));`;

  /* ── Type chips ── */
  const typeChips = allTypes.length
    ? allTypes.map(t => {
        const on  = selectedTypes.has(t.id);
        const sty = on ? `background:${t.color}22;border-color:${t.color};color:${t.color}` : '';
        return `<div class="gene-chip type-chip ${on ? 'gene-chip-on' : ''}"
                     data-type="${t.id}" style="${sty}">
          <span class="gene-chip-name" style="${on ? `color:${t.color}` : ''}">${t.label}</span>
          <span class="gene-chip-check" style="color:${t.color}">✓</span>
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
        <button class="btn btn-sm" id="ge_test">▶ TEST WITH RANDOM GENOME</button>
        <span style="font-size:9px;color:var(--text-muted)">Runs against 8 random values to verify output</span>
      </div>
      <div class="gene-test-result" id="ge_testOut" style="display:none"></div>

    </div>
  `;

  const footerHTML = `
    ${isEdit ? `<button class="btn btn-warn btn-sm" id="ge_delete">⊗ DELETE GENE</button>` : ''}
    <button class="btn" data-close="geneModal">CANCEL</button>
    <button class="btn btn-primary" id="ge_save">${isEdit ? '✎ SAVE GENE' : '⊕ CREATE GENE'}</button>
  `;

  const overlay = createModal('geneModal', isEdit ? `EDIT GENE: ${geneName}` : 'NEW GENE', bodyHTML, footerHTML);

  /* ── Type chip toggles ── */
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
      chip.querySelector('.gene-chip-name').style.color = type.color;
      chip.querySelector('.gene-chip-check').style.color = type.color;
    } else {
      chip.style.cssText = '';
      chip.querySelector('.gene-chip-name').style.color = '';
      chip.querySelector('.gene-chip-check').style.color = '';
    }
    overlay.querySelector('#ge_typeCount').textContent = `${selectedTypes.size} selected`;
  });

  /* ── Test function ── */
  overlay.querySelector('#ge_test').addEventListener('click', () => {
    const errEl = overlay.querySelector('#ge_error');
    const outEl = overlay.querySelector('#ge_testOut');
    const body  = overlay.querySelector('#ge_fn').value;
    errEl.textContent   = '';
    outEl.style.display = 'none';
    try {
      // eslint-disable-next-line no-new-func
      const fn      = new Function('genome', 'params', body);
      const testIn  = Array.from({ length: 8 }, () => +Math.random().toFixed(4));
      const result  = fn([...testIn], {});
      if (!Array.isArray(result) && !(result instanceof Float32Array))
        throw new Error('Return value must be an Array (not ' + typeof result + ')');
      outEl.style.display = 'block';
      outEl.innerHTML = `
        <div class="test-in"> IN:  [${testIn.map(v => v.toFixed(4)).join(', ')}]</div>
        <div class="test-out">OUT: [${Array.from(result).map(v => (+v).toFixed(4)).join(', ')}]</div>
      `;
    } catch (e) {
      errEl.textContent = `✗ ${e.message}`;
    }
  });

  /* ── Delete ── */
  overlay.querySelector('#ge_delete')?.addEventListener('click', () => {
    if (!confirm(`Delete gene "${geneName}"?\nOrganism types that reference it will still list it until you edit them.`)) return;
    GeneRegistry.delete(geneName);
    closeModal('geneModal');
    onSave?.();
  });

  /* ── Cancel ── */
  overlay.querySelector('[data-close="geneModal"]').addEventListener('click', () => closeModal('geneModal'));

  /* ── Save ── */
  overlay.querySelector('#ge_save').addEventListener('click', () => {
    const errEl = overlay.querySelector('#ge_error');
    const name  = isEdit
      ? geneName
      : overlay.querySelector('#ge_name').value.trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '');
    const body  = overlay.querySelector('#ge_fn').value;
    errEl.textContent = '';

    if (!name)  { errEl.textContent = '✗ Gene name is required.'; return; }
    if (!isEdit && GeneRegistry.get(name)) { errEl.textContent = `✗ Gene "${name}" already exists.`; return; }
    if (selectedTypes.size === 0) { errEl.textContent = '✗ Assign this gene to at least one organism type.'; return; }

    let fn;
    try {
      // eslint-disable-next-line no-new-func
      fn = new Function('genome', 'params', body);
      const testResult = fn([0.5, 0.3, 0.7, 0.2, 0.8, 0.1, 0.6, 0.4], {});
      if (!Array.isArray(testResult) && !(testResult instanceof Float32Array))
        throw new Error('Return value must be an Array');
    } catch (e) {
      errEl.textContent = `✗ Function error: ${e.message}`;
      return;
    }

    const typeList = [...selectedTypes];
    GeneRegistry.register(name, typeList, fn);

    /* If this is a new gene, auto-add it to the gene pool of its selected types */
    if (!isEdit) {
      for (const tid of typeList) {
        const t = OrganismTypes.get(tid);
        if (t && !t.genePool.includes(name)) t.genePool.push(name);
      }
    }

    closeModal('geneModal');
    onSave?.();
  });
}

/* ── HELPERS ── */
function showModalError(overlay, msg) {
  // Show a quick shake + brief error banner at footer
  const footer = overlay.querySelector('.modal-footer');
  let err = footer.querySelector('.modal-inline-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'modal-inline-error';
    err.style.cssText = 'font-size:11px;color:var(--red);font-family:var(--font-mono);margin-right:auto;order:-1';
    footer.prepend(err);
  }
  err.textContent = `✗ ${msg}`;
  overlay.querySelector('.modal-box').classList.add('modal-shake');
  overlay.querySelector('.modal-box').addEventListener('animationend', () =>
    overlay.querySelector('.modal-box')?.classList.remove('modal-shake'), { once: true });
}

function extractFnBody(fn) {
  try {
    const src   = fn.toString();
    const match = src.match(/^\s*(?:function[^{]*)?\{([\s\S]*)\}\s*$/);
    if (match) return match[1].replace(/^\n/, '').replace(/\n\s*$/, '');
    return src;
  } catch {
    return '// Could not decompile — write your own body\nreturn genome;';
  }
}

function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
