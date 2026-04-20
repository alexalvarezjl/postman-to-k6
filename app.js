/**
 * app.js
 * UI orchestration: file upload, drag-drop, step management, form reads, output.
 */

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
const state = {
  collection: null,  // { name, requests, variables }
  currentMode: 'simple',
  generatedScript: '',
  scriptFilename: 'load-test.js'
};

// ─────────────────────────────────────────────────────────────────────────────
// DOM REFS
// ─────────────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const DOM = {
  dropZone:     $('drop-zone'),
  fileInput:    $('file-input'),
  jsonInput:    $('json-input'),
  jsonStatus:   $('json-status'),
  btnParse:     $('btn-parse'),

  stepImport:   $('step-import'),
  stepPreview:  $('step-preview'),
  stepConfig:   $('step-config'),
  stepResult:   $('step-result'),

  stepNum1:     $('step-num-1'),
  stepNum2:     $('step-num-2'),
  stepNum3:     $('step-num-3'),
  stepNum4:     $('step-num-4'),

  requestsList: $('requests-list'),
  collSummary:  $('collection-summary'),
  previewActions: $('preview-actions'),
  summaryTotal:   $('summary-total'),
  summarySelected:$('summary-selected'),
  summaryFolders: $('summary-folders'),
  btnSelectAll:   $('btn-select-all'),
  btnDeselectAll: $('btn-deselect-all'),

  modeTabs:     document.querySelectorAll('.mode-tab'),
  configSimple: $('config-simple'),
  configStages: $('config-stages'),
  configRamping:$('config-ramping'),
  stagesList:   $('stages-list'),
  btnAddStage:  $('btn-add-stage'),

  btnGenerate: $('btn-generate'),
  btnCopy:     $('btn-copy'),
  btnDownload: $('btn-download'),
  btnDownloadPerRequest: $('btn-download-per-request'),
  codeContent: $('code-content'),
  codeLines:   $('code-lines'),
  runCmd:      $('run-cmd'),

  // k6 modules
  cfgUseSetup:    $('cfg-use-setup'),
  cfgAuthPath:    $('cfg-auth-path'),
  cfgEnvPath:     $('cfg-env-path'),
  cfgRole:        $('cfg-role'),
  cfgOnBehalfOf:  $('cfg-on-behalf-of'),
  cfgUseSummary:  $('cfg-use-summary'),
  cfgReportPath:  $('cfg-report-path'),
};

// ─────────────────────────────────────────────────────────────────────────────
// MODULE TOGGLES
// ─────────────────────────────────────────────────────────────────────────────
DOM.cfgUseSetup.addEventListener('change', function () {
  $('module-setup-body').style.display = this.checked ? '' : 'none';
  $('module-setup-body').style.opacity = this.checked ? '1' : '0.4';
});
DOM.cfgUseSummary.addEventListener('change', function () {
  $('module-summary-body').style.display = this.checked ? '' : 'none';
  $('module-summary-body').style.opacity = this.checked ? '1' : '0.4';
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
function activateStep(n) {
  [DOM.stepImport, DOM.stepPreview, DOM.stepConfig, DOM.stepResult].forEach((el, i) => {
    el.classList.remove('step-card--locked', 'step-card--active', 'step-card--done');
    if (i + 1 < n) {
      el.classList.add('step-card--done');
    } else if (i + 1 === n) {
      el.classList.add('step-card--active');
    } else {
      el.classList.add('step-card--locked');
    }
  });
  [DOM.stepNum1, DOM.stepNum2, DOM.stepNum3, DOM.stepNum4].forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i + 1 < n) el.classList.add('done'), el.textContent = '✓';
    else if (i + 1 === n) el.classList.add('active'), el.textContent = i + 1;
    else el.textContent = i + 1;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE / DRAG-DROP
// ─────────────────────────────────────────────────────────────────────────────
DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());
DOM.fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) readFile(file);
});

DOM.dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  DOM.dropZone.classList.add('drag-over');
});
DOM.dropZone.addEventListener('dragleave', () => DOM.dropZone.classList.remove('drag-over'));
DOM.dropZone.addEventListener('drop', e => {
  e.preventDefault();
  DOM.dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) readFile(file);
});

function readFile(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    DOM.jsonInput.value = ev.target.result;
    setJsonStatus('Archivo cargado ✓', 'ok');
  };
  reader.readAsText(file);
}

// Live JSON validation
DOM.jsonInput.addEventListener('input', () => {
  const val = DOM.jsonInput.value.trim();
  if (!val) { setJsonStatus('', ''); return; }
  try {
    JSON.parse(val);
    setJsonStatus('JSON válido ✓', 'ok');
  } catch {
    setJsonStatus('JSON inválido ✗', 'err');
  }
});

function setJsonStatus(msg, cls) {
  DOM.jsonStatus.textContent = msg;
  DOM.jsonStatus.className = `json-status ${cls}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSE COLLECTION
// ─────────────────────────────────────────────────────────────────────────────
DOM.btnParse.addEventListener('click', parseCollection);

function parseCollection() {
  const raw = DOM.jsonInput.value.trim();
  if (!raw) { showToast('Pega o sube una colección primero', 'error'); return; }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    showToast('JSON inválido — revisa el formato', 'error');
    return;
  }

  // Validate basic Postman structure
  if (!json.info || !Array.isArray(json.item)) {
    showToast('No parece ser una colección Postman válida (falta info o item)', 'error');
    return;
  }

  const { requests, folders } = PostmanConverter.extractRequests(json.item);

  if (requests.length === 0) {
    showToast('No se encontraron requests en la colección', 'error');
    return;
  }

  // Collection-level variables
  const variables = [];
  if (json.variable && Array.isArray(json.variable)) {
    json.variable.forEach(v => variables.push({ key: v.key, value: v.value }));
  }

  state.collection = {
    name: json.info.name || 'Mi Colección',
    requests,
    variables,
    folderCount: folders.size
  };
  state.scriptFilename = `${json.info.name?.replace(/\s+/g, '-').toLowerCase() || 'load'}-test.js`;

  renderRequests();
  activateStep(2);
  scrollToEl(DOM.stepPreview);
  showToast(`✅ ${requests.length} requests encontradas`, 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER REQUESTS LIST
// ─────────────────────────────────────────────────────────────────────────────
function renderRequests() {
  const { requests, folderCount } = state.collection;
  const grouped = groupByFolder(requests);
  const container = DOM.requestsList;
  container.innerHTML = '';

  for (const [folder, reqs] of grouped) {
    if (folder) {
      const folderEl = document.createElement('div');
      folderEl.className = 'folder-group';
      folderEl.innerHTML = `
        <div class="folder-header" data-folder="${escHtml(folder)}">
          <span class="folder-chevron open">▶</span>
          <span>📁 ${escHtml(folder)}</span>
          <span style="margin-left:auto;font-size:0.75rem;font-weight:400">${reqs.length} requests</span>
        </div>
        <div class="folder-items" data-folder-items="${escHtml(folder)}">
          ${reqs.map(r => requestRowHTML(r)).join('')}
        </div>
      `;
      container.appendChild(folderEl);

      folderEl.querySelector('.folder-header').addEventListener('click', function () {
        const chevron = this.querySelector('.folder-chevron');
        const items = folderEl.querySelector('.folder-items');
        const isOpen = chevron.classList.contains('open');
        chevron.classList.toggle('open', !isOpen);
        items.style.display = isOpen ? 'none' : 'flex';
      });
    } else {
      reqs.forEach(r => {
        const el = document.createElement('div');
        el.innerHTML = requestRowHTML(r);
        container.appendChild(el.firstElementChild);
      });
    }
  }

  // Attach checkbox events
  container.querySelectorAll('.request-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      const req = state.collection.requests.find(r => r.id === id);
      if (req) req.selected = cb.checked;
      cb.closest('.request-row').classList.toggle('selected', cb.checked);
      updateSummary();
    });
  });

  // Show summary
  DOM.collSummary.style.display = 'flex';
  DOM.previewActions.style.display = 'flex';
  DOM.summaryFolders.textContent = folderCount;
  updateSummary();

  // Continue button — unlock step 3
  addContinueToStep3();
}

function requestRowHTML(r) {
  const methodCls = `method-${r.method.toLowerCase()}`;
  return `
    <div class="request-row selected" data-id="${r.id}">
      <input type="checkbox" class="request-check" data-id="${r.id}" ${r.selected ? 'checked' : ''} id="chk-${r.id}" />
      <span class="method-badge ${methodCls}">${escHtml(r.method)}</span>
      <span class="request-name">${escHtml(r.name)}</span>
      <span class="request-url">${escHtml(r.url)}</span>
    </div>
  `;
}

function updateSummary() {
  const total = state.collection.requests.length;
  const selected = state.collection.requests.filter(r => r.selected).length;
  DOM.summaryTotal.textContent = total;
  DOM.summarySelected.textContent = selected;
}

let step3BtnAdded = false;
function addContinueToStep3() {
  if (step3BtnAdded) return;
  step3BtnAdded = true;
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.style.marginTop = '20px';
  btn.innerHTML = '<span>Configurar k6</span><span class="btn-icon">→</span>';
  btn.addEventListener('click', () => {
    activateStep(3);
    scrollToEl(DOM.stepConfig);
  });
  DOM.stepPreview.appendChild(btn);
}

// Bulk select / deselect
DOM.btnSelectAll.addEventListener('click', () => {
  state.collection.requests.forEach(r => r.selected = true);
  document.querySelectorAll('.request-check').forEach(cb => {
    cb.checked = true;
    cb.closest('.request-row').classList.add('selected');
  });
  updateSummary();
});
DOM.btnDeselectAll.addEventListener('click', () => {
  state.collection.requests.forEach(r => r.selected = false);
  document.querySelectorAll('.request-check').forEach(cb => {
    cb.checked = false;
    cb.closest('.request-row').classList.remove('selected');
  });
  updateSummary();
});

// ─────────────────────────────────────────────────────────────────────────────
// MODE TABS
// ─────────────────────────────────────────────────────────────────────────────
DOM.modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    DOM.modeTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.currentMode = tab.dataset.mode;
    DOM.configSimple.style.display  = state.currentMode === 'simple'  ? '' : 'none';
    DOM.configStages.style.display  = state.currentMode === 'stages'  ? '' : 'none';
    DOM.configRamping.style.display = state.currentMode === 'ramping' ? '' : 'none';
  });
});

// Stages — add stage
let stageCount = 3;
DOM.btnAddStage.addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'stage-row';
  row.dataset.stage = stageCount++;
  row.innerHTML = `
    <span class="stage-label">Stage ${stageCount}</span>
    <div class="input-with-unit">
      <input type="number" class="config-input stage-duration" value="30" min="1" />
      <span class="input-unit">seg</span>
    </div>
    <span class="stage-arrow">→</span>
    <div class="input-with-unit">
      <input type="number" class="config-input stage-target" value="10" min="0" />
      <span class="input-unit">VUs</span>
    </div>
    <button class="btn btn-ghost btn-sm" style="padding:4px 8px" onclick="this.closest('.stage-row').remove()">✕</button>
  `;
  DOM.stagesList.appendChild(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// READ CONFIG FROM FORM
// ─────────────────────────────────────────────────────────────────────────────
function readConfig() {
  const mode = state.currentMode;

  const config = {
    mode,
    sleep: parseFloat($('cfg-sleep').value) || 0,
    baseUrl: $('cfg-base-url').value.trim(),
    thresholds: readThresholds(),
    // k6 project modules
    useSetup:        DOM.cfgUseSetup.checked,
    authPath:        DOM.cfgAuthPath.value.trim(),
    envPath:         DOM.cfgEnvPath.value.trim(),
    role:            DOM.cfgRole.value.trim(),
    onBehalfOf:      DOM.cfgOnBehalfOf.value.trim(),
    useHandleSummary: DOM.cfgUseSummary.checked,
    reportPath:      DOM.cfgReportPath.value.trim(),
  };

  if (mode === 'simple') {
    config.vus = parseInt($('cfg-vus').value) || 10;
    config.duration = parseInt($('cfg-duration').value) || 30;
  } else if (mode === 'stages') {
    const rows = DOM.stagesList.querySelectorAll('.stage-row');
    config.stages = [];
    rows.forEach(row => {
      const dur = parseInt(row.querySelector('.stage-duration').value) || 30;
      const tgt = parseInt(row.querySelector('.stage-target').value) || 0;
      config.stages.push({ duration: dur, target: tgt });
    });
  } else if (mode === 'ramping') {
    config.startVUs = parseInt($('cfg-start-vus').value) || 0;
    config.peakVUs = parseInt($('cfg-peak-vus').value) || 100;
    config.rampDuration = parseInt($('cfg-ramp-duration').value) || 120;
  }

  return config;
}

function readThresholds() {
  const thresholds = [];

  if ($('th-http-duration').checked) {
    const val = parseFloat($('th-http-duration-val').value) || 500;
    thresholds.push({ metric: 'http_req_duration', condition: `p(95)<${val}` });
  }
  if ($('th-http-failed').checked) {
    const val = parseFloat($('th-http-failed-val').value) || 1;
    thresholds.push({ metric: 'http_req_failed', condition: `rate<${val / 100}` });
  }
  if ($('th-http-waiting').checked) {
    const val = parseFloat($('th-http-waiting-val').value) || 1000;
    thresholds.push({ metric: 'http_req_waiting', condition: `p(99)<${val}` });
  }
  if ($('th-iterations').checked) {
    const val = parseInt($('th-iterations-val').value) || 100;
    thresholds.push({ metric: 'iterations', condition: `count>${val}` });
  }
  return thresholds;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE
// ─────────────────────────────────────────────────────────────────────────────
DOM.btnGenerate.addEventListener('click', () => {
  if (!state.collection) { showToast('Primero importa una colección', 'error'); return; }

  const config = readConfig();
  let script;
  try {
    script = PostmanConverter.generateK6Script(state.collection, config);
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }

  state.generatedScript = script;

  const lines = script.split('\n');
  DOM.codeLines.textContent = `${lines.length} líneas`;
  DOM.codeContent.innerHTML = PostmanConverter.highlightK6(script);

  DOM.runCmd.textContent = `k6 run ${state.scriptFilename}`;

  activateStep(4);
  scrollToEl(DOM.stepResult);
  showToast('✅ Script generado exitosamente', 'success');
});

// ─────────────────────────────────────────────────────────────────────────────
// COPY & DOWNLOAD
// ─────────────────────────────────────────────────────────────────────────────
DOM.btnCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.generatedScript);
    DOM.btnCopy.textContent = '✅ Copiado!';
    setTimeout(() => { DOM.btnCopy.innerHTML = '📋 Copiar'; }, 2000);
  } catch {
    showToast('No se pudo copiar — usa Ctrl+A en el código', 'error');
  }
});

DOM.btnDownload.addEventListener('click', () => {
  const blob = new Blob([state.generatedScript], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = state.scriptFilename;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`⬇️ Descargando ${state.scriptFilename}`, 'success');
});

DOM.btnDownloadPerRequest.addEventListener('click', async () => {
  if (!state.collection) { showToast('Primero importa una coleccion', 'error'); return; }

  const config = readConfig();
  let scripts;
  try {
    scripts = PostmanConverter.generateK6ScriptsPerRequest(state.collection, config);
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }

  if (scripts.length === 1) {
    // Only one request — download directly, no ZIP needed
    const { filename, content } = scripts[0];
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`⬇️ Descargando ${filename}`, 'success');
    return;
  }

  // Multiple requests — bundle into a ZIP
  if (typeof JSZip === 'undefined') {
    showToast('JSZip no cargado — revisa tu conexion a internet', 'error');
    return;
  }
  const zip = new JSZip();
  scripts.forEach(({ filename, content }) => {
    zip.file(filename, content);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const collectionSlug = state.collection.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const zipName = `${collectionSlug}-k6-scripts.zip`;

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`⬇️ Descargando ${zipName} (${scripts.length} archivos)`, 'success');
});

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function groupByFolder(requests) {
  const map = new Map();
  for (const req of requests) {
    const key = req.folder || '';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(req);
  }
  return map;
}

function scrollToEl(el) {
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

let toastTimer;
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  clearTimeout(toastTimer);

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);

  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
activateStep(1);
