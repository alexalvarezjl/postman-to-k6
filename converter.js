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

  const lines = [];
  const needsCheck = selectedRequests.some(r => r.checks.length > 0);

  // ── Imports ───────────────────────────────────────────────────
  lines.push(`import http from 'k6/http';`);
  lines.push(`import { sleep${needsCheck ? ', check' : ''} } from 'k6';`);
  if (needsCheck) lines.push(`import { Rate } from 'k6/metrics';`);
  lines.push('');

  // ── Custom metrics ────────────────────────────────────────────
  if (needsCheck) {
    lines.push(`const errorRate = new Rate('errors');`);
    lines.push('');
  }

  // ── Options ──────────────────────────────────────────────────
  lines.push('export const options = {');
  lines.push(generateOptions(config));
  lines.push('};');
  lines.push('');

  // ── Variables ────────────────────────────────────────────────
  const variables = extractVariables(selectedRequests, collection.variables || []);
  const baseUrl = config.baseUrl ? config.baseUrl.replace(/\/$/, '') : '';

  if (variables.length > 0 || baseUrl) {
    lines.push('// ─── Environment Variables ───────────────────────────────────');
    if (baseUrl) {
      lines.push(`const BASE_URL = '${baseUrl}';`);
    } else {
      // Try to detect base URL from requests
      const detectedBase = detectBaseUrl(selectedRequests);
      if (detectedBase) {
        lines.push(`const BASE_URL = '${detectedBase}';`);
      }
    }
    variables.forEach(v => {
      const safe = JSON.stringify(v.value || '');
      lines.push(`const ${sanitizeVarName(v.key)} = __ENV.${sanitizeVarName(v.key).toUpperCase()} || ${safe};`);
    });
    lines.push('');
  }

  // ── Setup (collection-level variables) ───────────────────────
  lines.push('// ─── Default function ────────────────────────────────────────');
  lines.push('export default function () {');
  lines.push('');

  // Group by folder
  const grouped = groupByFolder(selectedRequests);
  for (const [folder, reqs] of grouped) {
    if (folder) {
      lines.push(`  // ── ${folder} ──`);
    }
    for (const req of reqs) {
      lines.push(...generateRequestBlock(req, baseUrl || detectBaseUrl(selectedRequests), config));
      lines.push('');
    }
  }

  if (config.sleep > 0) {
    lines.push(`  sleep(${config.sleep});`);
  }

  lines.push('}');

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

  // Comment: request name
  lines.push(`${indent}// ${req.name}`);

  // Build URL
  let urlExpr = buildUrlExpression(req, baseUrl);

  // Headers object
  const hasHeaders = req.headers.length > 0;
  if (hasHeaders) {
    lines.push(`${indent}const params_${req.id} = {`);
    lines.push(`${indent}  headers: {`);
    req.headers.forEach(h => {
      lines.push(`${indent}    '${escStr(h.key)}': '${escStr(resolvePostmanVar(h.value))}',`);
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
        // Try to parse/reformat for readability
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
      const pairs = req.body.urlencoded.map(f =>
        `'${encodeURIComponent(f.key)}=${encodeURIComponent(resolvePostmanVar(f.value))}'`
      ).join(' + \'&\' +\n${indent}    ');
      bodyExpr = req.body.urlencoded.length > 0
        ? `${req.body.urlencoded.map(f =>
          `'${encodeURIComponent(f.key)}=${encodeURIComponent(resolvePostmanVar(f.value))}'`
        ).join(' + \'&\' + ')}`
        : `''`;
      bodyExpr = `[${req.body.urlencoded.map(f =>
        `\`${encodeURIComponent(f.key)}=\${encodeURIComponent('${escStr(resolvePostmanVar(f.value))}'}\``
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

  // HTTP call
  const method = req.method.toLowerCase();
  const methodsWithBody = ['post', 'put', 'patch', 'delete'];
  const paramsArg = hasHeaders ? `, params_${req.id}` : '';

  if (methodsWithBody.includes(method)) {
    lines.push(`${indent}const res_${req.id} = http.${method}(${urlExpr}, ${bodyExpr}${paramsArg});`);
  } else {
    lines.push(`${indent}const res_${req.id} = http.${method}(${urlExpr}${paramsArg});`);
  }

  // Checks
  if (req.checks.length > 0) {
    lines.push(`${indent}const ok_${req.id} = check(res_${req.id}, {`);
    req.checks.forEach(c => {
      lines.push(`${indent}  '${escStr(c.name)}': ${c.expr},`);
    });
    lines.push(`${indent}});`);
    lines.push(`${indent}errorRate.add(!ok_${req.id});`);
  }

  return lines;
}

// ── URL builder ───────────────────────────────────────────────────────────────
function buildUrlExpression(req, baseUrl) {
  let url = req.url;

  // If baseUrl override is provided, strip the detected base from the url
  if (baseUrl && url.startsWith(baseUrl)) {
    url = url.slice(baseUrl.length);
  }

  // Replace Postman variables {{var}} → ${VAR}
  url = resolvePostmanVar(url);

  // Has a BASE_URL?
  const hasBaseUrl = baseUrl;
  const urlFull = hasBaseUrl
    ? `\`\${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}\``
    : `'${url}'`;

  // Query params
  if (req.queryParams.length > 0) {
    const qsExpr = req.queryParams.map(q =>
      `${encodeURIComponent(q.key)}=\${encodeURIComponent('${escStr(resolvePostmanVar(q.value))}')}`
    ).join('&');
    return `\`${urlFull.slice(1, -1)}?${qsExpr}\``;
  }

  return urlFull;
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

// Export for app.js
window.PostmanConverter = {
  extractRequests,
  generateK6Script,
  highlightK6,
  detectBaseUrl
};
