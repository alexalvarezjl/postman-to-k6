/**
 * k6-generator.js
 * Specific logic for generating k6 scripts.
 */

const K6Generator = {
  /**
   * Main entry point.
   */
  generateK6Script(collection, config) {
    const selectedRequests = collection.requests.filter(r => r.selected);
    if (selectedRequests.length === 0) throw new Error('No hay requests seleccionadas.');

    const useSetup         = config.useSetup !== false;
    const useHandleSummary = config.useHandleSummary !== false;
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
    lines.push(this.generateOptions(config));
    lines.push('};');
    lines.push('');

    // ── Standalone env vars (solo cuando NO se usa el patrón modular) ──
    if (!useSetup) {
      const variables = PostmanConverter.extractVariables(selectedRequests, collection.variables || []);
      if (variables.length > 0) {
        lines.push('// ─── Environment Variables ───────────────────────────────────');
        variables.forEach(v => {
          const varName = PostmanConverter.sanitizeVarName(v.key);
          const defaultVal = v.value ? JSON.stringify(v.value) : '""';
          lines.push(`const ${varName} = __ENV.${varName.toUpperCase()} || ${defaultVal};`);
        });
        lines.push('');
      }
    }

    // ── setup() ──
    if (useSetup) {
      lines.push('// ─── Setup (obtener token, se ejecuta 1 sola vez) ───────────');
      lines.push('export function setup() {');
      lines.push(`  const role = __ENV.ROLE || '${this.escStr(role)}';`);
      lines.push(`  const onBehalfOf = __ENV.ON_BEHALF_OF || '${this.escStr(onBehalfOf)}';`);
      lines.push('  const token = getAuthToken(role, onBehalfOf);');
      lines.push('  return { token };');
      lines.push('}');
      lines.push('');
    }

    // ── Default function ──
    lines.push('// ─── Default function ────────────────────────────────────────');
    lines.push(`export default function (${useSetup ? 'data' : ''}) {`);
    lines.push('');

    const detectedBase = (config.baseUrl ? config.baseUrl.replace(/\/$/, '') : '')
      || PostmanConverter.detectBaseUrl(selectedRequests);
    const grouped = PostmanConverter.groupByFolder(selectedRequests);

    for (const [folder, reqs] of grouped) {
      if (folder) {
        lines.push(`  // ── ${folder} ──`);
      }
      for (const req of reqs) {
        lines.push(...this.generateRequestBlock(req, detectedBase, config));
        lines.push('');
      }
    }

    if (config.sleep > 0) {
      lines.push(`  sleep(${config.sleep});`);
    }

    lines.push('}');

    // ── handleSummary() ──
    if (useHandleSummary) {
      lines.push('');
      lines.push('// ─── Reporte HTML ────────────────────────────────────────────');
      lines.push('export function handleSummary(data) {');
      lines.push('  return {');
      lines.push(`    '${this.escStr(reportPath)}': htmlReport(data),`);
      lines.push(`    stdout: textSummary(data, { indent: ' ', enableColors: true }),`);
      lines.push('  };');
      lines.push('}');
    }

    return lines.join('\n');
  },

  generateOptions(config) {
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

    const thresholds = config.thresholds || [];
    if (thresholds.length > 0) {
      lines.push('  thresholds: {');
      thresholds.forEach(t => {
        lines.push(`    '${t.metric}': ['${t.condition}'],`);
      });
      lines.push('  },');
    }
    return lines.join('\n');
  },

  generateRequestBlock(req, baseUrl, config) {
    const lines = [];
    const indent = '  ';
    const useModular = config && config.useSetup !== false;

    lines.push(`${indent}// ${req.name}`);
    const urlExpr = this.buildUrlExpression(req, baseUrl, config);
    lines.push(`${indent}const url_${req.id} = ${urlExpr};`);

    const hasHeaders = req.headers.length > 0;
    if (hasHeaders) {
      lines.push(`${indent}const params_${req.id} = {`);
      lines.push(`${indent}  headers: {`);
      req.headers.forEach(h => {
        let valueStr;
        if (useModular && h.key.toLowerCase() === 'authorization') {
          if (/^bearer/i.test(h.value.trim())) {
            valueStr = '`Bearer ${data.token}`';
          } else if (/^basic/i.test(h.value.trim())) {
            valueStr = '`Basic ${data.token}`';
          } else {
            valueStr = '`${data.token}`';
          }
        } else {
          const resolvedValue = PostmanConverter.resolvePostmanVar(h.value);
          if (resolvedValue.includes('${')) {
            valueStr = `\`${resolvedValue.replace(/`/g, '\\`')}\``;
          } else {
            valueStr = `'${this.escStr(resolvedValue)}'`;
          }
        }
        lines.push(`${indent}    '${this.escStr(h.key)}': ${valueStr},`);
      });
      lines.push(`${indent}  },`);
      lines.push(`${indent}};`);
    }

    let bodyExpr = 'null';
    if (req.body) {
      if (req.body.mode === 'raw') {
        const raw = PostmanConverter.resolvePostmanVar(req.body.raw);
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
          `\`${encodeURIComponent(f.key)}=\${encodeURIComponent('${this.escStr(PostmanConverter.resolvePostmanVar(f.value))}')}\``
        ).join(', ')}].join('&')`;
      } else if (req.body.mode === 'formdata') {
        lines.push(`${indent}const formData_${req.id} = {`);
        req.body.formdata.forEach(f => {
          lines.push(`${indent}  '${this.escStr(f.key)}': '${this.escStr(PostmanConverter.resolvePostmanVar(f.value))}',`);
        });
        lines.push(`${indent}};`);
        bodyExpr = `formData_${req.id}`;
      }
    }

    const method = req.method.toLowerCase();
    const methodsWithBody = ['post', 'put', 'patch', 'delete'];
    const paramsArg = hasHeaders ? `, params_${req.id}` : '';

    if (methodsWithBody.includes(method)) {
      lines.push(`${indent}const res_${req.id} = http.${method}(url_${req.id}, ${bodyExpr}${paramsArg});`);
    } else {
      lines.push(`${indent}const res_${req.id} = http.${method}(url_${req.id}${paramsArg});`);
    }

    // Checks
    const checks = [];
    if (req.postmanScript) {
      this.extractK6Checks(req.postmanScript, checks);
    }
    const allChecks = checks.length > 0
      ? checks
      : [{ name: 'Status es 200', expr: '(r) => r.status === 200' }];

    lines.push(`${indent}check(res_${req.id}, {`);
    allChecks.forEach(c => {
      lines.push(`${indent}  '${this.escStr(c.name)}': ${c.expr},`);
    });
    lines.push(`${indent}});`);

    return lines;
  },

  buildUrlExpression(req, baseUrl, config) {
    let url = req.url;
    const useModular = config && config.useSetup !== false;
    const hasPostmanVars = /\{\{\w+\}\}/.test(url);

    if (baseUrl && url.startsWith(baseUrl) && !hasPostmanVars) {
      if (config && config.baseUrl && config.baseUrl.trim()) {
        url = url.slice(baseUrl.length).replace(/^\//, '');
      }
    }

    if (useModular) {
      let firstReplaced = false;
      url = url.replace(/\{\{(\w+)\}\}/g, (_, name) => {
        if (!firstReplaced) {
          firstReplaced = true;
          return '${envConfig.apiUrl}';
        }
        return `\${${PostmanConverter.sanitizeVarName(name)}}`;
      });
    } else {
      url = PostmanConverter.resolvePostmanVar(url);
    }

    let qs = '';
    if (req.queryParams.length > 0) {
      qs = '?' + req.queryParams.map(q => {
        const key = encodeURIComponent(q.key);
        const val = PostmanConverter.resolvePostmanVar(q.value);
        if (val.includes('${')) return `${key}=${val}`;
        return `${key}=${encodeURIComponent(val)}`;
      }).join('&');
    }
    return `\`${(url + qs).replace(/`/g, '\\`')}\``;
  },

  extractK6Checks(script, checks) {
    const statusMatch = script.match(/\.status\((\d+)\)/g);
    if (statusMatch) {
      statusMatch.forEach(m => {
        const code = m.match(/\d+/)[0];
        checks.push({ name: `status is ${code}`, expr: `(r) => r.status === ${code}` });
      });
    }
    const timeMatch = script.match(/responseTime.*?below\((\d+)\)/);
    if (timeMatch) {
      checks.push({ name: `response time < ${timeMatch[1]}ms`, expr: `(r) => r.timings.duration < ${timeMatch[1]}` });
    }
    if (/to\.be\.json/.test(script)) {
      checks.push({ name: 'response is JSON', expr: `(r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('json')` });
    }
  },

  escStr(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
};

// Export for global access
window.K6Generator = K6Generator;
