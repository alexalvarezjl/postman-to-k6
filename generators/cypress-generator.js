/**
 * cypress-generator.js
 * Modular generator for Cypress E2E API tests.
 * Produces a complete Cypress project structure: specs, commands, and config.
 */

const CypressGenerator = {
  /**
   * Main entry point for a single consolidated script (Preview/Copy).
   */
  generateCypressScript(collection, config) {
    const selectedRequests = collection.requests.filter(r => r.selected);
    if (selectedRequests.length === 0) throw new Error('No hay requests seleccionadas.');

    const lines = [];
    lines.push('/**');
    lines.push(` * Cypress API Test: ${collection.name || 'Postman Collection'}`);
    lines.push(` * Generated on: ${new Date().toLocaleString()}`);
    lines.push(' */');
    lines.push('');

    const detectedBase = (config.baseUrl ? config.baseUrl.replace(/\/$/, '') : '')
      || PostmanConverter.detectBaseUrl(selectedRequests);

    const grouped = PostmanConverter.groupByFolder(selectedRequests);

    for (const [folder, reqs] of grouped) {
      const indent = folder ? '  ' : '';
      if (folder) {
        lines.push(`describe('${this.escStr(folder)}', () => {`);
      }

      reqs.forEach(req => {
        lines.push(`${indent}it('${this.escStr(req.name)}', () => {`);
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
   * Generates a zip-ready structure for the entire collection.
   */
  generateCypressProject(collection, config) {
    const files = [];
    const selectedRequests = collection.requests.filter(r => r.selected);
    
    // 1. cypress.config.js
    files.push({
      filename: 'cypress.config.js',
      content: this.generateConfig(config)
    });

    // 2. cypress/support/commands.js
    files.push({
      filename: 'cypress/support/commands.js',
      content: this.generateCommands(collection, config)
    });

    // 3. cypress/e2e/ specs
    const grouped = PostmanConverter.groupByFolder(selectedRequests);
    for (const [folder, reqs] of grouped) {
      const slug = (folder || 'api')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      const specContent = this.generateCypressScript({
        name: folder || collection.name,
        requests: reqs
      }, config);

      files.push({
        filename: `cypress/e2e/${slug}.cy.js`,
        content: specContent
      });
    }

    return files;
  },

  /**
   * Generates the cy.request block with assertions.
   */
  generateRequestBlock(req, baseUrl, config, indent) {
    const lines = [];
    
    // Debug comments
    lines.push(`${indent}// Request: ${req.name}`);
    if (req.folder) lines.push(`${indent}// Origin: ${req.folder}`);

    const urlExpr = this.buildUrlExpression(req, baseUrl);
    
    lines.push(`${indent}cy.request({`);
    lines.push(`${indent}  method: '${req.method}',`);
    lines.push(`${indent}  url: ${urlExpr},`);
    
    // Headers
    if (req.headers.length > 0) {
      lines.push(`${indent}  headers: {`);
      req.headers.forEach(h => {
        const value = this.resolveCypressVars(h.value);
        lines.push(`${indent}    '${this.escStr(h.key)}': ${this.wrapValue(value)},`);
      });
      lines.push(`${indent}  },`);
    }

    // Body
    if (req.body) {
      lines.push(`${indent}  body: ${this.generateBody(req.body, indent)},`);
    }

    lines.push(`${indent}  failOnStatusCode: false`);
    lines.push(`${indent}}).then((response) => {`);
    
    // Assertions
    const assertions = [];
    if (req.assertions && req.assertions.length > 0) {
      lines.push(`${indent}  // Semantic Assertions`);
      req.assertions.forEach(a => {
        if (a.type === 'status') {
          assertions.push(`expect(response.status).to.eq(${a.value});`);
        } else if (a.type === 'responseTime') {
          assertions.push(`expect(response.duration).to.be.below(${a.value});`);
        } else if (a.type === 'header' && a.operator === 'contains') {
          assertions.push(`expect(response.headers['${a.value.key.toLowerCase()}']).to.include('${a.value.val}');`);
        } else {
          assertions.push(`// Unmapped assertion: ${a.type}`);
        }
      });
    } else if (req.postmanScript) {
      lines.push(`${indent}  // Postman Script Assertions`);
      this.extractCypressAssertions(req.postmanScript, assertions);
    }
    
    if (assertions.length === 0) {
      lines.push(`${indent}  expect(response.status).to.be.oneOf([200, 201, 204]);`);
    } else {
      assertions.forEach(a => lines.push(`${indent}  ${a}`));
    }

    lines.push(`${indent}});`);
    return lines;
  },

  /**
   * Maps Postman variable patterns to Cypress.env().
   */
  resolveCypressVars(str) {
    if (!str) return '';
    // Replace {{var}} with ${Cypress.env('var')}
    return str.replace(/\{\{(\w+)\}\}/g, (_, name) => `\${Cypress.env('${name}')}`);
  },

  /**
   * Wraps a value in backticks if it contains interpolations, otherwise single quotes.
   */
  wrapValue(val) {
    if (val.includes('${')) return `\`${val.replace(/`/g, '\\`')}\``;
    return `'${this.escStr(val)}'`;
  },

  buildUrlExpression(req, baseUrl) {
    let url = req.url;
    // Basic logic: if url doesn't start with http, assume it uses base
    if (!url.startsWith('http') && baseUrl) {
      url = baseUrl.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
    }
    
    const resolvedUrl = this.resolveCypressVars(url);
    
    let qs = '';
    if (req.queryParams.length > 0) {
      qs = '?' + req.queryParams.map(q => {
        const key = encodeURIComponent(q.key);
        const val = this.resolveCypressVars(q.value);
        if (val.includes('${')) return `${key}=${val}`;
        return `${key}=${encodeURIComponent(val)}`;
      }).join('&');
    }

    return this.wrapValue(resolvedUrl + qs);
  },

  generateBody(body, indent) {
    if (body.mode === 'raw') {
      const resolved = this.resolveCypressVars(body.raw);
      if (body.language === 'json') {
        try {
          // If it's pure JSON without vars, parse and re-format
          if (!resolved.includes('${')) {
            return JSON.stringify(JSON.parse(resolved), null, 2).split('\n').join(`\n${indent}  `);
          }
        } catch (e) {}
      }
      return this.wrapValue(resolved);
    }
    
    if (body.mode === 'urlencoded') {
      const obj = {};
      body.urlencoded.forEach(f => { obj[f.key] = this.resolveCypressVars(f.value); });
      return JSON.stringify(obj, null, 2).split('\n').join(`\n${indent}  `);
    }

    if (body.mode === 'formdata') {
      const obj = {};
      body.formdata.forEach(f => { obj[f.key] = this.resolveCypressVars(f.value); });
      return JSON.stringify(obj, null, 2).split('\n').join(`\n${indent}  `);
    }

    return 'null';
  },

  /**
   * Translates Postman tests to Chai assertions.
   */
  extractCypressAssertions(script, assertions) {
    // status code
    const statusMatch = script.match(/\.status\((\d+)\)/g);
    if (statusMatch) {
      statusMatch.forEach(m => {
        const code = m.match(/\d+/)[0];
        assertions.push(`expect(response.status).to.eq(${code});`);
      });
    }

    // response time
    const timeMatch = script.match(/responseTime.*?below\((\d+)\)/);
    if (timeMatch) {
      assertions.push(`expect(response.duration).to.be.below(${timeMatch[1]});`);
    }

    // JSON body
    if (/to\.be\.json/.test(script)) {
      assertions.push(`expect(response.headers['content-type']).to.include('application/json');`);
    }
    
    // pm.expect in general (very basic mapping)
    if (script.includes('pm.expect')) {
      // Example mapping: pm.expect(data.id).to.eql(1) -> expect(response.body.id).to.eql(1)
      // This is a placeholder for more complex regex-based mapping
      assertions.push('// Manual review needed for complex pm.expect patterns');
    }
  },

  generateConfig(config) {
    return `const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "${config.baseUrl || ''}",
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    supportFile: "cypress/support/e2e.js",
    specPattern: "cypress/e2e/**/*.cy.js"
  },
  env: {
    // Add your Postman variables here
  }
});`;
  },

  generateCommands(collection, config) {
    return `/**
 * Custom commands for API testing
 */

// Command for abstracted authentication
Cypress.Commands.add('login', (role = 'default') => {
  cy.log(\`Logging in as \${role}...\`);
  // This is a template based on Postman auth patterns
  // Replace with your actual login request
  /*
  cy.request('POST', '/auth/login', { role }).then((res) => {
    Cypress.env('token', res.body.token);
  });
  */
});

// Helper for dynamic tokens if detected in Postman
if (Cypress.env('bearerToken')) {
  // Logic to handle token refresh could go here
}`;
  },

  escStr(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
};

window.CypressGenerator = CypressGenerator;
