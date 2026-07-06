/**
 * playwright-generator.js
 * Modular generator for Playwright API tests.
 * Produces Playwright spec files and playwright.config files.
 */

const PlaywrightGenerator = {
  /**
   * Main entry point for a single consolidated script (Preview/Copy).
   */
  generatePlaywrightScript(collection, config) {
    const selectedRequests = collection.requests.filter(r => r.selected);
    if (selectedRequests.length === 0) throw new Error('No hay requests seleccionadas.');

    const isTS = !!(config && config.useTypescript);
    const lines = [];

    lines.push('/**');
    lines.push(` * Playwright API Test: ${collection.name || 'Postman Collection'}`);
    lines.push(` * Generated on: ${new Date().toLocaleString()}`);
    lines.push(' */');
    lines.push('');
    lines.push(`import { test, expect } from '@playwright/test';`);
    lines.push('');

    const detectedBase = (config.baseUrl ? config.baseUrl.replace(/\/$/, '') : '')
      || PostmanConverter.detectBaseUrl(selectedRequests);

    const grouped = PostmanConverter.groupByFolder(selectedRequests);

    for (const [folder, reqs] of grouped) {
      const indent = folder ? '  ' : '';
      if (folder) {
        lines.push(`test.describe('${this.escStr(folder)}', () => {`);
      }

      reqs.forEach(req => {
        lines.push(`${indent}test('${this.escStr(req.name)}', async ({ request }) => {`);
        lines.push(...this.generateRequestBlock(req, detectedBase, config, indent + '  '));
        lines.push(`${indent}});`);
        lines.push('');
      });

      if (folder) {
        lines.push('});');
        lines.push('');
      }
    }

    return lines.join('\n');
  },

  /**
   * Generates a folder structure / project files list.
   */
  generatePlaywrightProject(collection, config) {
    const files = [];
    const selectedRequests = collection.requests.filter(r => r.selected);
    const isTS = !!(config && config.useTypescript);
    const ext = isTS ? 'ts' : 'js';

    // 1. playwright.config
    files.push({
      filename: `playwright.config.${ext}`,
      content: this.generateConfig(config)
    });

    // 2. specs
    const grouped = PostmanConverter.groupByFolder(selectedRequests);
    for (const [folder, reqs] of grouped) {
      const slug = (folder || 'api')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const specContent = this.generatePlaywrightScript({
        name: folder || collection.name,
        requests: reqs
      }, config);

      files.push({
        filename: `tests/${slug}.spec.${ext}`,
        content: specContent
      });
    }

    return files;
  },

  /**
   * Generates request block.
   */
  generateRequestBlock(req, baseUrl, config, indent) {
    const lines = [];

    // Debug comments
    lines.push(`${indent}// Request: ${req.name}`);
    if (req.folder) lines.push(`${indent}// Origin: ${req.folder}`);

    const urlExpr = this.buildUrlExpression(req, baseUrl);
    const methodLower = req.method.toLowerCase();

    lines.push(`${indent}const response = await request.${methodLower}(${urlExpr}, {`);

    let optionsLines = [];

    // Headers
    if (req.headers.length > 0) {
      optionsLines.push(`  headers: {`);
      req.headers.forEach(h => {
        const value = this.resolvePlaywrightVars(h.value);
        optionsLines.push(`    '${this.escStr(h.key)}': ${this.wrapValue(value)},`);
      });
      optionsLines.push(`  },`);
    }

    // Body/Data
    if (req.body) {
      optionsLines.push(`  data: ${this.generateBody(req.body, '  ')},`);
    }

    if (optionsLines.length > 0) {
      optionsLines.forEach(l => lines.push(indent + l));
    }

    lines.push(`${indent}});`);
    lines.push('');

    // Assertions
    const assertions = [];
    if (req.assertions && req.assertions.length > 0) {
      lines.push(`${indent}// Semantic Assertions`);
      req.assertions.forEach(a => {
        if (a.type === 'status') {
          assertions.push(`expect(response.status()).toBe(${a.value});`);
        } else if (a.type === 'responseTime') {
          // Playwright doesn't have a direct response duration in the client-side API out of the box
          // but we can comment it or check response header performance timings if available
          assertions.push(`// Check response time: expect below ${a.value}ms`);
        } else if (a.type === 'header' && a.operator === 'contains') {
          assertions.push(`expect(response.headers()['${a.value.key.toLowerCase()}']).toContain('${a.value.val}');`);
        } else {
          assertions.push(`// Unmapped assertion: ${a.type}`);
        }
      });
    }

    if (assertions.length === 0) {
      lines.push(`${indent}expect(response.ok()).toBeTruthy();`);
    } else {
      assertions.forEach(a => lines.push(`${indent}${a}`));
    }

    return lines;
  },

  buildUrlExpression(req, baseUrl) {
    let url = req.url;
    if (!url.startsWith('http') && baseUrl) {
      url = baseUrl.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
    }

    const resolvedUrl = this.resolvePlaywrightVars(url);

    let qs = '';
    if (req.queryParams.length > 0) {
      qs = '?' + req.queryParams.map(q => {
        const key = encodeURIComponent(q.key);
        const val = this.resolvePlaywrightVars(q.value);
        if (val.includes('${')) return `${key}=${val}`;
        return `${key}=${encodeURIComponent(val)}`;
      }).join('&');
    }

    return this.wrapValue(resolvedUrl + qs);
  },

  generateBody(body, indent) {
    if (body.mode === 'raw') {
      const resolved = this.resolvePlaywrightVars(body.raw);
      if (body.language === 'json') {
        try {
          if (!resolved.includes('${')) {
            return JSON.stringify(JSON.parse(resolved), null, 2).split('\n').join(`\n${indent}  `);
          }
        } catch (e) {}
      }
      return this.wrapValue(resolved);
    }

    if (body.mode === 'urlencoded') {
      const obj = {};
      body.urlencoded.forEach(f => { obj[f.key] = this.resolvePlaywrightVars(f.value); });
      return JSON.stringify(obj, null, 2).split('\n').join(`\n${indent}  `);
    }

    return 'null';
  },

  resolvePlaywrightVars(str) {
    if (!str) return '';
    // Replace {{var}} with ${process.env.VAR}
    return str.replace(/\{\{([$\w]+)\}\}/g, (_, name) => {
      if (name === '$guid') {
        return '${crypto.randomUUID()}';
      }
      if (name === '$timestamp') {
        return '${Date.now()}';
      }
      if (name === '$randomInt') {
        return '${Math.floor(Math.random() * 1000)}';
      }
      return `\${process.env.${name.toUpperCase()} || ''}`;
    });
  },

  wrapValue(val) {
    if (val.includes('${')) return `\`${val.replace(/`/g, '\\`')}\``;
    return `'${this.escStr(val)}'`;
  },

  escStr(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  },

  generateConfig(config) {
    const isTS = !!(config && config.useTypescript);
    return `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  reporter: 'html',
  use: {
    baseURL: '${this.escStr(config.baseUrl || '')}',
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },
});
`;
  }
};

window.PlaywrightGenerator = PlaywrightGenerator;
