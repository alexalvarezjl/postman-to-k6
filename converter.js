/**
 * converter.js
 * Core logic: Parse a Postman Collection v2.0/v2.1 and generate a k6 script.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PARSER  — Postman Collection JSON → internal representation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively extract all requests from a Postman collection item tree.
 * @param {Array} items
 * @param {string} folderPath  – current breadcrumb
 * @returns {{ folders: Set<string>, requests: Array }}
 */
function extractRequests(items, folderPath = '') {
  const result = { folders: new Set(), requests: [] };

  for (const item of items) {
    const currentPath = folderPath
      ? `${folderPath} / ${item.name}`
      : item.name;

    // It's a folder if it has a nested `item` array
    if (Array.isArray(item.item)) {
      result.folders.add(currentPath);
      const sub = extractRequests(item.item, currentPath);
      sub.folders.forEach(f => result.folders.add(f));
      result.requests.push(...sub.requests);
    } else if (item.request) {
      result.requests.push(normalizeRequest(item, folderPath));
    }
  }
  return result;
}

/**
 * Normalise a single Postman request item into a plain object.
 */
function normalizeRequest(item, folder) {
  const req = item.request;
  const method = (typeof req.method === 'string'
    ? req.method
    : 'GET'
  ).toUpperCase();

  // ── URL ──────────────────────────────────────────────────────
  let url = '';
  if (typeof req.url === 'string') {
    url = req.url;
  } else if (req.url && typeof req.url === 'object') {
    // v2.1 url object
    if (req.url.raw) {
      url = req.url.raw;
    } else if (Array.isArray(req.url.host) && Array.isArray(req.url.path)) {
      const protocol = req.url.protocol || 'https';
      const host = req.url.host.join('.');
      const path = req.url.path.join('/');
      url = `${protocol}://${host}/${path}`;
    }
  }

  // ── Query params ──────────────────────────────────────────────
  let queryParams = [];
  if (req.url && req.url.query && Array.isArray(req.url.query)) {
    queryParams = req.url.query
      .filter(q => !q.disabled)
      .map(q => ({ key: q.key, value: q.value }));
  } else if (url.includes('?')) {
    const qs = url.split('?')[1];
    queryParams = qs.split('&').map(p => {
      const [k, v] = p.split('=');
      return { key: decodeURIComponent(k || ''), value: decodeURIComponent(v || '') };
    });
  }

  // ── Headers ──────────────────────────────────────────────────
  const headers = [];
  if (Array.isArray(req.header)) {
    req.header.filter(h => !h.disabled).forEach(h => {
      headers.push({ key: h.key, value: h.value });
    });
  }

  // ── Auth → inject header ──────────────────────────────────────
  if (req.auth) {
    const auth = req.auth;
    if (auth.type === 'bearer') {
      const tokenObj = Array.isArray(auth.bearer)
        ? auth.bearer.find(b => b.key === 'token')
        : null;
      const token = tokenObj ? tokenObj.value : '{{bearerToken}}';
      if (!headers.some(h => h.key.toLowerCase() === 'authorization')) {
        headers.push({ key: 'Authorization', value: `Bearer ${token}` });
      }
    } else if (auth.type === 'basic') {
      const userObj = Array.isArray(auth.basic) ? auth.basic.find(b => b.key === 'username') : null;
      const passObj = Array.isArray(auth.basic) ? auth.basic.find(b => b.key === 'password') : null;
      const user = userObj ? userObj.value : '{{username}}';
      const pass = passObj ? passObj.value : '{{password}}';
      if (!headers.some(h => h.key.toLowerCase() === 'authorization')) {
        headers.push({ key: 'Authorization', value: `Basic ${btoa(`${user}:${pass}`)}` });
      }
    } else if (auth.type === 'apikey') {
      const keyObj = Array.isArray(auth.apikey) ? auth.apikey.find(b => b.key === 'key') : null;
      const valObj = Array.isArray(auth.apikey) ? auth.apikey.find(b => b.key === 'value') : null;
      const inHeader = Array.isArray(auth.apikey)
        ? auth.apikey.find(b => b.key === 'in')
        : null;
      if (!inHeader || inHeader.value === 'header') {
        headers.push({
          key: keyObj ? keyObj.value : 'X-API-Key',
          value: valObj ? valObj.value : '{{apiKey}}'
        });
      }
    }
  }

  // ── Body ──────────────────────────────────────────────────────
  let body = null;
  if (req.body) {
    const bodyMode = req.body.mode;
    if (bodyMode === 'raw') {
      body = {
        mode: 'raw',
        raw: req.body.raw || '',
        language: req.body.options?.raw?.language || 'text'
      };
      // Auto-set Content-Type
      if (!headers.some(h => h.key.toLowerCase() === 'content-type')) {
        if (body.language === 'json') {
          headers.push({ key: 'Content-Type', value: 'application/json' });
        } else if (body.language === 'xml') {
          headers.push({ key: 'Content-Type', value: 'application/xml' });
        }
      }
    } else if (bodyMode === 'urlencoded') {
      body = {
        mode: 'urlencoded',
        urlencoded: (req.body.urlencoded || [])
          .filter(f => !f.disabled)
          .map(f => ({ key: f.key, value: f.value }))
      };
      if (!headers.some(h => h.key.toLowerCase() === 'content-type')) {
        headers.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' });
      }
    } else if (bodyMode === 'formdata') {
      body = {
        mode: 'formdata',
        formdata: (req.body.formdata || [])
          .filter(f => !f.disabled && f.type !== 'file')
          .map(f => ({ key: f.key, value: f.value }))
      };
    } else if (bodyMode === 'graphql') {
      body = {
        mode: 'raw',
        raw: JSON.stringify({
          query: req.body.graphql?.query || '',
          variables: req.body.graphql?.variables || {}
        }),
        language: 'json'
      };
      if (!headers.some(h => h.key.toLowerCase() === 'content-type')) {
        headers.push({ key: 'Content-Type', value: 'application/json' });
      }
    }
  }

  // ── Tests → k6 checks ────────────────────────────────────────
  const checks = [];
  if (item.event) {
    const testEvent = item.event.find(e => e.listen === 'test');
    if (testEvent && testEvent.script && testEvent.script.exec) {
      const script = Array.isArray(testEvent.script.exec)
        ? testEvent.script.exec.join('\n')
        : testEvent.script.exec;
      extractK6Checks(script, checks);
    }
  }

  return {
    id: `req_${Math.random().toString(36).slice(2, 9)}`,
    name: item.name || 'Unnamed Request',
    folder,
    method,
    url: url.split('?')[0], // strip inline QS (we handle separately)
    queryParams,
    headers,
    body,
    checks,
    selected: true
  };
}

/**
 * Very simple heuristic to convert common Postman test assertions to k6 check objects.
 */
function extractK6Checks(script, checks) {
  // pm.response.to.have.status(200)
  const statusMatch = script.match(/\.status\((\d+)\)/g);
  if (statusMatch) {
    statusMatch.forEach(m => {
      const code = m.match(/\d+/)[0];
      checks.push({ name: `status is ${code}`, expr: `(r) => r.status === ${code}` });
    });
  }

  // pm.expect(pm.response.responseTime).to.be.below(500)
  const timeMatch = script.match(/responseTime.*?below\((\d+)\)/);
  if (timeMatch) {
    checks.push({ name: `response time < ${timeMatch[1]}ms`, expr: `(r) => r.timings.duration < ${timeMatch[1]}` });
  }

  // pm.response.to.be.json
  if (/to\.be\.json/.test(script)) {
    checks.push({ name: 'response is JSON', expr: `(r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('json')` });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR  — internal representation → k6 JS script string
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main entry point.
 * @param {Object} collection  – parsed collection { name, requests, variables }
 * @param {Object} config      – k6 configuration options
 * @returns {string}           – the full k6 script
 */
function generateK6Script(collection, config) {
  const selectedRequests = collection.requests.filter(r => r.selected);
  if (selectedRequests.length === 0) throw new Error('No hay requests seleccionadas.');

  // ── Modular config options ─────────────────────────────────────
  const useSetup         = config.useSetup !== false;         // default: true
  const useHandleSummary = config.useHandleSummary !== false; // default: true
  const authPath         = config.authPath   || '../../support/auth.js';
  const envPath          = config.envPath    || '../../support/env.js';
  const reportPath       = config.reportPath || 'results/reporte-smoke.html';
  const role             = config.role       || 'ciudadano';
  const onBehalfOf       = config.onBehalfOf || '';

  const lines = [];

  // ── Imports ───────────────────────────────────────────────────
  lines.push(`import http from 'k6/http';`);
  lines.push(`import { check, sleep } from 'k6';`);
  if (useSetup) {
    lines.push(`import { getAuthToken } from '${authPath}';`);
    lines.push(`import { envConfig } from '${envPath}';`);
  }
  if (useHandleSummary) {
    lines.push(`import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";`);
    lines.push(`import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';`);
  }
  lines.push('');

  // ── Options ───────────────────────────────────────────────────
  lines.push('export const options = {');
  lines.push(generateOptions(config));
  lines.push('};');
  lines.push('');

  // ── Standalone env vars (solo cuando NO se usa el patrón modular) ──
  if (!useSetup) {
    const variables = extractVariables(selectedRequests, collection.variables || []);
    if (variables.length > 0) {
      lines.push('// ─── Environment Variables ───────────────────────────────────');
      variables.forEach(v => {
        const varName = sanitizeVarName(v.key);
        const defaultVal = v.value ? JSON.stringify(v.value) : '""';
        lines.push(`const ${varName} = __ENV.${varName.toUpperCase()} || ${defaultVal};`);
      });
      lines.push('');
    }
  }

  // ── setup() — se ejecuta 1 sola vez, devuelve el token ────────
  if (useSetup) {
    lines.push('// ─── Setup (obtener token, se ejecuta 1 sola vez) ───────────');
    lines.push('export function setup() {');
    lines.push(`  const role = __ENV.ROLE || '${escStr(role)}';`);
    lines.push(`  const onBehalfOf = __ENV.ON_BEHALF_OF || '${escStr(onBehalfOf)}';`);
    lines.push('  const token = getAuthToken(role, onBehalfOf);');
    lines.push('  return { token };');
    lines.push('}');
    lines.push('');
  }

  // ── Default function ──────────────────────────────────────────
  lines.push('// ─── Default function ────────────────────────────────────────');
  lines.push(`export default function (${useSetup ? 'data' : ''}) {`);
  lines.push('');

  const detectedBase = (config.baseUrl ? config.baseUrl.replace(/\/$/, '') : '')
    || detectBaseUrl(selectedRequests);
  const grouped = groupByFolder(selectedRequests);

  for (const [folder, reqs] of grouped) {
    if (folder) {
      lines.push(`  // ── ${folder} ──`);
    }
    for (const req of reqs) {
      lines.push(...generateRequestBlock(req, detectedBase, config));
      lines.push('');
    }
  }

  if (config.sleep > 0) {
    lines.push(`  sleep(${config.sleep});`);
  }

  lines.push('}');

  // ── handleSummary() — reporte HTML al finalizar ───────────────
  if (useHandleSummary) {
    lines.push('');
    lines.push('// ─── Reporte HTML ────────────────────────────────────────────');
    lines.push('export function handleSummary(data) {');
    lines.push('  return {');
    lines.push(`    '${escStr(reportPath)}': htmlReport(data),`);
    lines.push(`    stdout: textSummary(data, { indent: ' ', enableColors: true }),`);
    lines.push('  };');
    lines.push('}');
  }

  return lines.join('\n');
}

// ── Options block ─────────────────────────────────────────────────────────────
function generateOptions(config) {
  const lines = [];

  if (config.mode === 'simple') {
    lines.push(`  vus: ${config.vus || 10},`);
    lines.push(`  duration: '${config.duration || 30}s',`);
  } else if (config.mode === 'stages') {
    lines.push('  stages: [');
    (config.stages || []).forEach((s, i) => {
      const last = i === config.stages.length - 1;
      lines.push(`    { duration: '${s.duration}s', target: ${s.target} }${last ? '' : ','}`);
    });
    lines.push('  ],');
  } else if (config.mode === 'ramping') {
    const half = Math.floor((config.rampDuration || 120) / 2);
    const rest = (config.rampDuration || 120) - half * 2;
    lines.push('  scenarios: {');
    lines.push('    ramp_up: {');
    lines.push(`      executor: 'ramping-vus',`);
    lines.push(`      startVUs: ${config.startVUs || 0},`);
    lines.push('      stages: [');
    lines.push(`        { duration: '${half}s', target: ${config.peakVUs || 100} },`);
    lines.push(`        { duration: '${rest}s', target: ${config.peakVUs || 100} },`);
    lines.push(`        { duration: '${half}s', target: 0 },`);
    lines.push('      ],');
    lines.push('    },');
    lines.push('  },');
  }

  // Thresholds
  const thresholds = config.thresholds || [];
  if (thresholds.length > 0) {
    lines.push('  thresholds: {');
    thresholds.forEach(t => {
      lines.push(`    '${t.metric}': ['${t.condition}'],`);
    });
    lines.push('  },');
  }

  return lines.join('\n');
}

// ── Single request block ──────────────────────────────────────────────────────
function generateRequestBlock(req, baseUrl, config) {
  const lines = [];
  const indent = '  ';
  const useModular = config && config.useSetup !== false;

  // Comment: request name
  lines.push(`${indent}// ${req.name}`);

  // Build URL as a named variable (matching detalleBoletasSmoke.js style)
  const urlExpr = buildUrlExpression(req, baseUrl, config);
  lines.push(`${indent}const url_${req.id} = ${urlExpr};`);

  // Headers object
  const hasHeaders = req.headers.length > 0;
  if (hasHeaders) {
    lines.push(`${indent}const params_${req.id} = {`);
    lines.push(`${indent}  headers: {`);
    req.headers.forEach(h => {
      let valueStr;
      if (useModular && h.key.toLowerCase() === 'authorization') {
        // Modular mode: replace Bearer/Basic with data.token (real JS interpolation via backtick)
        if (/^bearer/i.test(h.value.trim())) {
          valueStr = '`Bearer ${data.token}`';
        } else if (/^basic/i.test(h.value.trim())) {
          valueStr = '`Basic ${data.token}`';
        } else {
          valueStr = '`${data.token}`';
        }
      } else {
        const resolvedValue = resolvePostmanVar(h.value);
        // Use backtick template literal when the value has ${...} variable references
        if (resolvedValue.includes('${')) {
          valueStr = `\`${resolvedValue.replace(/`/g, '\\`')}\``;
        } else {
          valueStr = `'${escStr(resolvedValue)}'`;
        }
      }
      lines.push(`${indent}    '${escStr(h.key)}': ${valueStr},`);
    });
    lines.push(`${indent}  },`);
    lines.push(`${indent}};`);
  }

  // Body expression
  let bodyExpr = 'null';
  if (req.body) {
    if (req.body.mode === 'raw') {
      const raw = resolvePostmanVar(req.body.raw);
      if (req.body.language === 'json') {
        try {
          const parsed = JSON.parse(raw);
          bodyExpr = `JSON.stringify(${JSON.stringify(parsed, null, 6)
            .split('\n').join(`\n${indent}`)})`;
        } catch {
          bodyExpr = `\`${raw.replace(/`/g, '\\`')}\``;
        }
      } else {
        bodyExpr = `\`${raw.replace(/`/g, '\\`')}\``;
      }
    } else if (req.body.mode === 'urlencoded') {
      bodyExpr = `[${req.body.urlencoded.map(f =>
        `\`${encodeURIComponent(f.key)}=\${encodeURIComponent('${escStr(resolvePostmanVar(f.value))}')}\``
      ).join(', ')}].join('&')`;
    } else if (req.body.mode === 'formdata') {
      lines.push(`${indent}const formData_${req.id} = {`);
      req.body.formdata.forEach(f => {
        lines.push(`${indent}  '${escStr(f.key)}': '${escStr(resolvePostmanVar(f.value))}',`);
      });
      lines.push(`${indent}};`);
      bodyExpr = `formData_${req.id}`;
    }
  }

  // HTTP call — use url_<id> variable
  const method = req.method.toLowerCase();
  const methodsWithBody = ['post', 'put', 'patch', 'delete'];
  const paramsArg = hasHeaders ? `, params_${req.id}` : '';

  if (methodsWithBody.includes(method)) {
    lines.push(`${indent}const res_${req.id} = http.${method}(url_${req.id}, ${bodyExpr}${paramsArg});`);
  } else {
    lines.push(`${indent}const res_${req.id} = http.${method}(url_${req.id}${paramsArg});`);
  }

  // Checks: use Postman-extracted checks or fallback to default status check
  const allChecks = req.checks.length > 0
    ? req.checks
    : [{ name: 'Status es 200', expr: '(r) => r.status === 200' }];
  lines.push(`${indent}check(res_${req.id}, {`);
  allChecks.forEach(c => {
    lines.push(`${indent}  '${escStr(c.name)}': ${c.expr},`);
  });
  lines.push(`${indent}});`);

  return lines;
}

// ── URL builder ───────────────────────────────────────────────────────────────
/**
 * Builds a URL template literal expression.
 * - Modular mode (useSetup=true): first {{var}} → ${envConfig.apiUrl}, rest resolve normally.
 * - Standalone mode: {{var}} → ${VAR_NAME} (declared JS const from __ENV).
 * Always returns a backtick template literal so interpolation works at JS runtime.
 */
function buildUrlExpression(req, baseUrl, config) {
  let url = req.url;
  const useModular = config && config.useSetup !== false;

  // Detect whether the URL has any Postman variable placeholders
  const hasPostmanVars = /\{\{\w+\}\}/.test(url);

  // Strip explicit baseUrl override prefix only when there are no Postman vars
  // (if there are Postman vars the first one already becomes envConfig.apiUrl)
  if (baseUrl && url.startsWith(baseUrl) && !hasPostmanVars) {
    // Only strip if a baseUrl override was explicitly provided by the user config,
    // not when it was auto-detected — this preserves full URLs from cURL inputs.
    if (config && config.baseUrl && config.baseUrl.trim()) {
      url = url.slice(baseUrl.length).replace(/^\//, '');
    }
  }

  if (useModular) {
    // First {{...}} in the URL becomes ${envConfig.apiUrl}; the rest resolve normally
    let firstReplaced = false;
    url = url.replace(/\{\{(\w+)\}\}/g, (_, name) => {
      if (!firstReplaced) {
        firstReplaced = true;
        return '${envConfig.apiUrl}';
      }
      return `\${${sanitizeVarName(name)}}`;
    });
  } else {
    // Standalone: {{var}} → ${VAR} (JS variable declared from __ENV)
    url = resolvePostmanVar(url);
  }

  // Append query params inline in the template literal string
  let qs = '';
  if (req.queryParams.length > 0) {
    qs = '?' + req.queryParams.map(q => {
      const key = encodeURIComponent(q.key);
      const val = resolvePostmanVar(q.value);
      // If val has ${...} interpolation, embed directly; otherwise encode statically
      if (val.includes('${')) {
        return `${key}=${val}`;
      }
      return `${key}=${encodeURIComponent(val)}`;
    }).join('&');
  }

  // Always return a template literal — envConfig.apiUrl and __ENV vars need JS evaluation
  return `\`${(url + qs).replace(/`/g, '\\`')}\``;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Replace {{varName}} with ${VARNAME} for template literals */
function resolvePostmanVar(str) {
  if (!str) return '';
  return str.replace(/\{\{(\w+)\}\}/g, (_, name) => `\${${sanitizeVarName(name)}}`);
}

/** Sanitize to valid JS identifier */
function sanitizeVarName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

/** Escape single-quote strings */
function escStr(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Group requests by folder, preserving insertion order */
function groupByFolder(requests) {
  const map = new Map();
  for (const req of requests) {
    const key = req.folder || '';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(req);
  }
  return map;
}

/** Extract distinct Postman variables used across all requests */
function extractVariables(requests, collectionVars) {
  const seen = new Set();
  const vars = [];
  // Collection-level variables first
  (collectionVars || []).forEach(v => {
    if (!seen.has(v.key)) {
      seen.add(v.key);
      vars.push(v);
    }
  });
  // Scan all fields for {{variable}} references
  const re = /\{\{(\w+)\}\}/g;
  const scan = str => {
    let m;
    while ((m = re.exec(str)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        vars.push({ key: m[1], value: '' });
      }
    }
  };
  requests.forEach(r => {
    scan(r.url);
    r.headers.forEach(h => { scan(h.key); scan(h.value); });
    r.queryParams.forEach(q => { scan(q.key); scan(q.value); });
    if (r.body?.raw) scan(r.body.raw);
  });
  return vars;
}

/** Try to detect a common base URL from request URLs */
function detectBaseUrl(requests) {
  const urls = requests.map(r => r.url).filter(Boolean);
  if (!urls.length) return '';
  try {
    const parsed = urls.map(u => new URL(u));
    const first = parsed[0];
    const allSameOrigin = parsed.every(u => u.origin === first.origin);
    return allSameOrigin ? first.origin : '';
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNTAX HIGHLIGHT (simple, client-side)
// ─────────────────────────────────────────────────────────────────────────────
function highlightK6(code) {
  // Escape HTML first
  let out = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Comments (// ...)
  out = out.replace(/(\/\/[^\n]*)/g, '<span class="cmt">$1</span>');

  // Strings: single, double, template
  out = out.replace(/(`[^`]*`|'[^']*'|"[^"]*")/g, s =>
    `<span class="str">${s}</span>`
  );

  // Numbers
  out = out.replace(/\b(\d+)\b/g, '<span class="num">$1</span>');

  // Keywords
  const kw = ['import', 'from', 'export', 'const', 'let', 'var', 'function',
    'return', 'if', 'else', 'for', 'while', 'new', 'true', 'false', 'null'];
  kw.forEach(k => {
    out = out.replace(new RegExp(`\\b(${k})\\b`, 'g'), '<span class="kw">$1</span>');
  });

  // k6 built-ins
  const fns = ['http', 'check', 'sleep', 'Rate', 'Trend', 'Counter', 'Gauge'];
  fns.forEach(f => {
    out = out.replace(new RegExp(`\\b(${f})\\b`, 'g'), '<span class="fn">$1</span>');
  });

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-REQUEST GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a standalone k6 script for a single request.
 * @param {Object} req        – single request object from extractRequests()
 * @param {Object} collection – full collection { name, variables }
 * @param {Object} config     – k6 configuration options
 * @returns {string}          – complete k6 script string
 */
function generateK6ScriptForRequest(req, collection, config) {
  const miniCollection = {
    requests: [req],
    variables: collection.variables || []
  };
  return generateK6Script(miniCollection, config);
}

/**
 * Generate one script per selected request.
 * @param {Object} collection – parsed collection { name, requests, variables }
 * @param {Object} config     – k6 configuration options
 * @returns {Array<{filename: string, content: string}>}
 */
function generateK6ScriptsPerRequest(collection, config) {
  const selectedRequests = collection.requests.filter(r => r.selected);
  if (selectedRequests.length === 0) throw new Error('No hay requests seleccionadas.');

  return selectedRequests.map(req => {
    const slug = req.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
    const filename = `${slug}-test.js`;
    const content = generateK6ScriptForRequest(req, collection, config);
    return { filename, content, requestName: req.name, method: req.method };
  });
}

// Export for app.js
window.PostmanConverter = {
  extractRequests,
  generateK6Script,
  generateK6ScriptsPerRequest,
  highlightK6,
  detectBaseUrl
};
