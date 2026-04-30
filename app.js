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
  inputMode: 'postman',   // 'postman' | 'curl'
  targetFramework: 'k6',  // 'k6' | 'cypress'
  generatedScript: '',
  scriptFilename: 'load-test.js'
};

// ─────────────────────────────────────────────────────────────────────────────
// DOM REFS
// ─────────────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const DOM = {
  // Target toggle
  targetToggle: $('target-framework-toggle'),
  targetBtns:   document.querySelectorAll('.target-btn'),

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
  codeLang:    $('code-lang'),
  codeContent: $('code-content'),
  codeLines:   $('code-lines'),
  runCmd:      $('run-cmd'),
  runStepsK6:  $('run-steps-k6'),
  runStepsCy:  $('run-steps-cypress'),

  // k6 modules
  cfgUseSetup:    $('cfg-use-setup'),
  cfgAuthPath:    $('cfg-auth-path'),
  cfgEnvPath:     $('cfg-env-path'),
  cfgRole:        $('cfg-role'),
  cfgOnBehalfOf:  $('cfg-on-behalf-of'),
  cfgUseSummary:  $('cfg-use-summary'),
  cfgReportPath:  $('cfg-report-path'),

  // Input mode tabs + panels
  tabPostman:    $('tab-postman'),
  tabCurl:       $('tab-curl'),
  postmanPanel:  $('postman-panel'),
  curlPanel:     $('curl-panel'),
  curlInput:     $('curl-input'),
  curlStatus:    $('curl-status'),
  btnParseCurl:  $('btn-parse-curl'),
};

// ─────────────────────────────────────────────────────────────────────────────
// FRAMEWORK TOGGLE
// ─────────────────────────────────────────────────────────────────────────────
DOM.targetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    if (target === state.targetFramework) return;

    state.targetFramework = target;
    
    // Update active UI state
    DOM.targetBtns.forEach(b => b.classList.toggle('active', b.dataset.target === target));
    
    // Update Step 3 Visibility
    const isK6 = target === 'k6';
    $('step-config').querySelector('.step-title').textContent = isK6 ? 'Configurar k6' : 'Configurar Cypress';
    $('step-config').querySelector('.step-desc').textContent = isK6 
      ? 'Define las opciones de carga para tu prueba'
      : 'Configura las opciones de tu suite de Cypress';

    // Hide/Show K6-specific panels
    const k6Panels = [
      $('mode-simple').parentElement, // mode-tabs wrapper
      $('config-simple'),
      $('config-stages'),
      $('config-ramping'),
      $('th-http-duration').closest('.config-section'), // Thresholds section
      $('module-setup-card').closest('.config-section') // Modules section
    ];

    k6Panels.forEach(p => p.classList.toggle('hidden', !isK6));

    // Update generate button text
    DOM.btnGenerate.innerHTML = isK6 
      ? '<span class="btn-icon">⚡</span> Generar script k6'
      : '<span class="btn-icon">🌲</span> Generar suite Cypress';

    // Update Result step text
    $('step-result').querySelector('.step-title').textContent = isK6 ? 'Script generado' : 'Suite generada';
    $('step-result').querySelector('.step-desc').textContent = isK6 
      ? 'Tu script k6 listo para ejecutar'
      : 'Tus archivos de Cypress listos para tu proyecto';

    // Update language label
    if (DOM.codeLang) {
      DOM.codeLang.textContent = isK6 ? 'javascript · k6' : 'javascript · cypress';
    }

    // Update run instructions visibility
    if (DOM.runStepsK6 && DOM.runStepsCy) {
      DOM.runStepsK6.classList.toggle('hidden', !isK6);
      DOM.runStepsCy.classList.toggle('hidden', isK6);
    }
    
    // Update Docs link
    const navDocs = $('nav-docs');
    if (navDocs) {
      navDocs.textContent = isK6 ? 'Docs k6 \u2197' : 'Docs Cypress \u2197';
      navDocs.href = isK6 ? 'https://k6.io/docs/' : 'https://docs.cypress.io/';
    }
    
    state.scriptFilename = isK6 ? 'load-test.js' : 'cypress-test.cy.js';
  });
});

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
// INPUT MODE TAB SWITCHER
// ─────────────────────────────────────────────────────────────────────────────
[DOM.tabPostman, DOM.tabCurl].forEach(tab => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.inputMode;
    if (mode === state.inputMode) return;
    state.inputMode = mode;

    DOM.tabPostman.classList.toggle('active', mode === 'postman');
    DOM.tabCurl.classList.toggle('active', mode === 'curl');

    DOM.postmanPanel.classList.toggle('hidden', mode !== 'postman');
    DOM.curlPanel.classList.toggle('hidden', mode !== 'curl');

    // Update step 1 description
    const step1desc = $('step1-desc');
    if (step1desc) {
      step1desc.textContent = mode === 'postman'
        ? 'Arrastra un archivo .json o pega el contenido directamente'
        : 'Pega tu comando cURL de Bash y gen\u00e9ralo en k6';
    }

    // Reset step 3 button so it re-renders when mode changes
    step3BtnAdded = false;
    const oldBtn = DOM.stepPreview.querySelector('.btn.btn-primary');
    if (oldBtn) oldBtn.remove();
  });
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
    if (i + 1 < n) el.classList.add('done'), el.textContent = '\u2713';
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
    setJsonStatus('Archivo cargado \u2713', 'ok');
  };
  reader.readAsText(file);
}

// Live JSON validation
DOM.jsonInput.addEventListener('input', () => {
  const val = DOM.jsonInput.value.trim();
  if (!val) { setJsonStatus('', ''); return; }
  try {
    JSON.parse(val);
    setJsonStatus('JSON v\u00e1lido \u2713', 'ok');
  } catch {
    setJsonStatus('JSON inv\u00e1lido \u2717', 'err');
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
  if (!raw) { showToast('Pega o sube una colecci\u00f3n primero', 'error'); return; }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    showToast('JSON inv\u00e1lido \u2014 revisa el formato', 'error');
    return;
  }

  // Validate basic Postman structure
  if (!json.info || !Array.isArray(json.item)) {
    showToast('No parece ser una colecci\u00f3n Postman v\u00e1lida (falta info o item)', 'error');
    return;
  }

  const { requests, folders } = PostmanConverter.extractRequests(json.item);

  if (requests.length === 0) {
    showToast('No se encontraron requests en la colecci\u00f3n', 'error');
    return;
  }

  // Collection-level variables
  const variables = [];
  if (json.variable && Array.isArray(json.variable)) {
    json.variable.forEach(v => variables.push({ key: v.key, value: v.value }));
  }

  state.collection = {
    name: json.info.name || 'Mi Colecci\u00f3n',
    requests,
    variables,
    folderCount: folders.size
  };
  state.scriptFilename = state.targetFramework === 'k6' 
    ? `${json.info.name?.replace(/\s+/g, '-').toLowerCase() || 'load'}-test.js`
    : `${json.info.name?.replace(/\s+/g, '-').toLowerCase() || 'api'}-test.cy.js`;

  // Update step 2 headings for Postman mode
  const s2title = $('step2-title');
  const s2desc  = $('step2-desc');
  if (s2title) s2title.textContent = 'Requests detectadas';
  if (s2desc)  s2desc.textContent  = 'Revisa y selecciona las requests que deseas incluir';

  renderRequests();
  activateStep(2);
  scrollToEl(DOM.stepPreview);
  showToast(`\u2705 ${requests.length} requests encontradas`, 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER REQUESTS LIST
// ─────────────────────────────────────────────────────────────────────────────
function renderRequests() {
  const { requests, folderCount } = state.collection;
  const grouped = PostmanConverter.groupByFolder(requests);
  const container = DOM.requestsList;
  container.innerHTML = '';

  for (const [folder, reqs] of grouped) {
    if (folder) {
      const folderEl = document.createElement('div');
      folderEl.className = 'folder-group';
      folderEl.innerHTML = `
        <div class="folder-header" data-folder="${escHtml(folder)}">
          <span class="folder-chevron open">\u25b6</span>
          <span>\ud83d\udcc1 ${escHtml(folder)}</span>
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
  DOM.collSummary.classList.remove('hidden');
  DOM.previewActions.classList.remove('hidden');
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
  btn.innerHTML = `<span>Configurar ${state.targetFramework}</span><span class="btn-icon">\u2192</span>`;
  btn.addEventListener('click', () => {
    activateStep(3);
    scrollToEl(DOM.stepConfig);
  });
  DOM.stepPreview.appendChild(btn);
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSE cURL COMMAND
// ─────────────────────────────────────────────────────────────────────────────
DOM.btnParseCurl.addEventListener('click', parseCurlCommand);
DOM.curlInput.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') parseCurlCommand();
});

function parseCurlCommand() {
  const raw = DOM.curlInput.value.trim();
  if (!raw) { showToast('Pega un comando cURL primero', 'error'); return; }

  let req;
  try {
    req = CurlParser.parse(raw);
  } catch (err) {
    DOM.curlStatus.textContent = 'cURL inv\u00e1lido \u2717';
    DOM.curlStatus.className = 'json-status err';
    showToast('cURL inv\u00e1lido: ' + err.message, 'error');
    return;
  }

  DOM.curlStatus.textContent = 'cURL v\u00e1lido \u2713';
  DOM.curlStatus.className = 'json-status ok';

  state.collection = {
    name: req.name,
    requests: [req],
    variables: [],
    folderCount: 0
  };
  const slug = req.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  state.scriptFilename = state.targetFramework === 'k6' ? `${slug}-test.js` : `${slug}-test.cy.js`;

  const s2title = $('step2-title');
  const s2desc  = $('step2-desc');
  if (s2title) s2title.textContent = 'Request detectada';
  if (s2desc)  s2desc.textContent  = 'Revisa el request que ser\u00e1 convertido';

  renderCurlPreview(req);
  activateStep(2);
  scrollToEl(DOM.stepPreview);
  showToast(`\u2705 cURL analizado \u2014 ${req.method} ${req.url}`, 'success');
}

function renderCurlPreview(req) {
  const methodCls = `method-${req.method.toLowerCase()}`;
  const headerCount = req.headers.length;
  const bodyLabel = req.body ? `\u00b7 body: ${req.body.language || req.body.mode}` : '';

  DOM.requestsList.innerHTML = `
    <div class="request-row selected curl-preview" data-id="${req.id}">
      <span class="method-badge ${methodCls}">${escHtml(req.method)}</span>
      <span class="request-name">${escHtml(req.name)}</span>
      <span class="request-url">${escHtml(req.url)}</span>
    </div>
    <div class="curl-preview-detail">
      ${headerCount} header${headerCount !== 1 ? 's' : ''}${bodyLabel}
      ${req.queryParams.length ? ` \u00b7 ${req.queryParams.length} query param${req.queryParams.length !== 1 ? 's' : ''}` : ''}
    </div>
  `;

  DOM.collSummary.classList.remove('hidden');
  DOM.previewActions.classList.add('hidden');
  DOM.summaryTotal.textContent    = '1';
  DOM.summarySelected.textContent = '1';
  DOM.summaryFolders.textContent  = '0';

  addContinueToStep3();
}

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
    DOM.configSimple.classList.toggle('hidden', state.currentMode !== 'simple');
    DOM.configStages.classList.toggle('hidden', state.currentMode !== 'stages');
    DOM.configRamping.classList.toggle('hidden', state.currentMode !== 'ramping');
  });
});

let stageCount = 3;
DOM.btnAddStage.addEventListener('click', () => {
  const idx = stageCount++;
  const row = document.createElement('div');
  row.className = 'stage-row';
  row.dataset.stage = idx;
  row.innerHTML = `
    <span class="stage-label">Stage ${idx + 1}</span>
    <div class="input-with-unit">
      <input type="number" class="config-input stage-duration" value="30" min="1" />
      <span class="input-unit">seg</span>
    </div>
    <span class="stage-arrow">\u2192</span>
    <div class="input-with-unit">
      <input type="number" class="config-input stage-target" value="10" min="0" />
      <span class="input-unit">VUs</span>
    </div>
    <button class="btn btn-ghost btn-sm stage-remove-btn" style="padding:4px 8px">\u2715</button>
  `;
  row.querySelector('.stage-remove-btn').addEventListener('click', () => row.remove());
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
// GENERATE SCRIPT
// ─────────────────────────────────────────────────────────────────────────────
DOM.btnGenerate.addEventListener('click', () => {
  if (!state.collection) return;

  const config = readConfig();
  const target = state.targetFramework;

  try {
    let script = '';
    if (target === 'k6') {
      script = window.K6Generator.generateK6Script(state.collection, config);
    } else {
      script = window.CypressGenerator.generateCypressScript(state.collection, config);
    }

    state.generatedScript = script;
    DOM.codeContent.innerHTML = PostmanConverter.highlightCode(script);
    
    const lines = script.split('\n').length;
    DOM.codeLines.textContent = `${lines} l\u00edneas`;

    activateStep(4);
    scrollToEl(DOM.stepResult);
    showToast(`Script de ${target.toUpperCase()} generado con \u00e9xito`);

  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COPY & DOWNLOAD
// ─────────────────────────────────────────────────────────────────────────────
DOM.btnCopy.addEventListener('click', () => {
  if (!state.generatedScript) return;
  navigator.clipboard.writeText(state.generatedScript).then(() => {
    showToast('Copiado al portapapeles');
  });
});

DOM.btnDownload.addEventListener('click', () => {
  if (!state.generatedScript) return;
  const blob = new Blob([state.generatedScript], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = state.scriptFilename;
  a.click();
  URL.revokeObjectURL(url);
});

DOM.btnDownloadPerRequest.addEventListener('click', async () => {
  if (!state.collection) return;
  const config = readConfig();
  const target = state.targetFramework;
  const zip = new JSZip();

  try {
    if (target === 'k6') {
      const scripts = PostmanConverter.generateK6ScriptsPerRequest(state.collection, config);
      scripts.forEach(s => zip.file(s.filename, s.content));
    } else {
      const files = window.CypressGenerator.generateCypressProject(state.collection, config);
      files.forEach(f => zip.file(f.filename, f.content));
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = target === 'k6' ? 'k6-scripts.zip' : 'cypress-project.zip';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Archivo .zip generado');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
