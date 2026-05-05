/**
 * converter.js
 * Core logic: Parse a Postman Collection v2.0/v2.1 into a Normalized Intermediate Object.
 */

const PostmanConverter = {
  /**
   * Recursively extract all requests from a Postman collection item tree.
   */
  extractRequests(items, folderPath = '') {
    const result = { folders: new Set(), requests: [] };

    for (const item of items) {
      const currentPath = folderPath
        ? `${folderPath} / ${item.name}`
        : item.name;

      if (Array.isArray(item.item)) {
        result.folders.add(currentPath);
        const sub = this.extractRequests(item.item, currentPath);
        sub.folders.forEach(f => result.folders.add(f));
        result.requests.push(...sub.requests);
      } else if (item.request) {
        result.requests.push(this.normalizeRequest(item, folderPath));
      }
    }
    return result;
  },

  /**
   * Normalise a single Postman request item into a framework-agnostic object.
   */
  normalizeRequest(item, folder) {
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

    // ── Auth ──────────────────────────────────────────────────────
    if (req.auth) {
      const auth = req.auth;
      if (auth.type === 'bearer') {
        const tokenObj = Array.isArray(auth.bearer) ? auth.bearer.find(b => b.key === 'token') : null;
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
          headers.push({ key: 'Authorization', value: `Basic ${this.safeBtoa(`${user}:${pass}`)}` });
        }
      } else if (auth.type === 'apikey') {
        const keyObj = Array.isArray(auth.apikey) ? auth.apikey.find(b => b.key === 'key') : null;
        const valObj = Array.isArray(auth.apikey) ? auth.apikey.find(b => b.key === 'value') : null;
        const inHeader = Array.isArray(auth.apikey) ? auth.apikey.find(b => b.key === 'in') : null;
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
        if (!headers.some(h => h.key.toLowerCase() === 'content-type')) {
          if (body.language === 'json') headers.push({ key: 'Content-Type', value: 'application/json' });
          else if (body.language === 'xml') headers.push({ key: 'Content-Type', value: 'application/xml' });
        }
      } else if (bodyMode === 'urlencoded') {
        body = {
          mode: 'urlencoded',
          urlencoded: (req.body.urlencoded || []).filter(f => !f.disabled).map(f => ({ key: f.key, value: f.value }))
        };
        if (!headers.some(h => h.key.toLowerCase() === 'content-type')) {
          headers.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' });
        }
      } else if (bodyMode === 'formdata') {
        body = {
          mode: 'formdata',
          formdata: (req.body.formdata || []).filter(f => !f.disabled && f.type !== 'file').map(f => ({ key: f.key, value: f.value }))
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

    // ── Pre-request Script ──────────────────────────────────────────
    let preRequestScript = '';
    if (item.event) {
      const preEvent = item.event.find(e => e.listen === 'prerequest');
      if (preEvent && preEvent.script && preEvent.script.exec) {
        preRequestScript = Array.isArray(preEvent.script.exec)
          ? preEvent.script.exec.join('\n')
          : preEvent.script.exec;
      }
    }

    // ── Tests Script & Assertions ────────────────────────────────────
    let postmanScript = '';
    const assertions = [];
    if (item.event) {
      const testEvent = item.event.find(e => e.listen === 'test');
      if (testEvent && testEvent.script && testEvent.script.exec) {
        const lines = Array.isArray(testEvent.script.exec)
          ? testEvent.script.exec
          : testEvent.script.exec.split('\n');
        
        postmanScript = lines.join('\n');
        
        // Basic Semantic Extraction
        lines.forEach(line => {
          // Status code
          const statusMatch = line.match(/pm\.response\.to\.have\.status\((\d+)\)/);
          if (statusMatch) {
            assertions.push({ name: `Status is ${statusMatch[1]}`, type: 'status', operator: 'eq', value: parseInt(statusMatch[1]), raw: line.trim() });
          }
          // Response time
          const timeMatch = line.match(/responseTime\)\.to\.be\.below\((\d+)\)/);
          if (timeMatch) {
            assertions.push({ name: `Response time below ${timeMatch[1]}ms`, type: 'responseTime', operator: 'lt', value: parseInt(timeMatch[1]), raw: line.trim() });
          }
          // Content-Type
          if (line.includes('json') && line.includes('Content-Type')) {
            assertions.push({ name: 'Content-Type is JSON', type: 'header', operator: 'contains', value: { key: 'Content-Type', val: 'application/json' }, raw: line.trim() });
          }
        });
      }
    }

    return {
      id: `req_${Math.random().toString(36).slice(2, 9)}`,
      name: item.name || 'Unnamed Request',
      folder,
      method,
      url: url.split('?')[0],
      queryParams,
      headers,
      body,
      preRequestScript,
      postmanScript,
      assertions,
      selected: true
    };
  },

  /** Replace {{varName}} with ${VARNAME} for template literals */
  resolvePostmanVar(str) {
    if (!str) return '';
    return str.replace(/\{\{(\w+)\}\}/g, (_, name) => `\${${this.sanitizeVarName(name)}}`);
  },

  /** Sanitize to valid JS identifier */
  sanitizeVarName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
  },

  /** Group requests by folder */
  groupByFolder(requests) {
    const map = new Map();
    for (const req of requests) {
      const key = req.folder || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(req);
    }
    return map;
  },

  /** Extract variables */
  extractVariables(requests, collectionVars) {
    const seen = new Set();
    const vars = [];
    (collectionVars || []).forEach(v => {
      if (!seen.has(v.key)) {
        seen.add(v.key);
        vars.push(v);
      }
    });
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
  },

  /** Detect base URL */
  detectBaseUrl(requests) {
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
  },

  /** Syntax highlight (Generic JS) */
  highlightCode(code) {
    let out = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    out = out.replace(/(\/\/[^\n]*)/g, '<span class="cmt">$1</span>');
    out = out.replace(/(`[^`]*`|'[^']*'|"[^"]*")/g, s => `<span class="str">${s}</span>`);
    out = out.replace(/\b(\d+)\b/g, '<span class="num">$1</span>');
    const kw = ['import', 'from', 'export', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'new', 'true', 'false', 'null'];
    kw.forEach(k => { out = out.replace(new RegExp(`\\b(${k})\\b`, 'g'), '<span class="kw">$1</span>'); });
    
    // Framework built-ins (Merge k6 and Cypress for the highlighter)
    const fns = ['http', 'check', 'sleep', 'Rate', 'Trend', 'Counter', 'Gauge', 'cy', 'describe', 'it', 'expect'];
    fns.forEach(f => { out = out.replace(new RegExp(`\\b(${f})\\b`, 'g'), '<span class="fn">$1</span>'); });
    return out;
  },

  /** Safe base64 encoding that handles non-ASCII characters */
  safeBtoa(str) {
    try {
      return btoa(str);
    } catch {
      // Fallback for non-Latin1 characters: encode via TextEncoder
      const bytes = new TextEncoder().encode(str);
      let binary = '';
      bytes.forEach(b => binary += String.fromCharCode(b));
      return btoa(binary);
    }
  }
};

// Compatibility Layer for app.js (mapping old API to new generators)
PostmanConverter.generateK6Script = (col, cfg) => window.K6Generator.generateK6Script(col, cfg);
PostmanConverter.generateK6ScriptsPerRequest = (col, cfg) => {
  const selectedRequests = col.requests.filter(r => r.selected);
  if (selectedRequests.length === 0) throw new Error('No hay requests seleccionadas.');

  return selectedRequests.map(req => {
    const slug = req.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
    const filename = `${slug}-test.js`;
    const miniCollection = { requests: [req], variables: col.variables || [] };
    const content = window.K6Generator.generateK6Script(miniCollection, cfg);
    return { filename, content, requestName: req.name, method: req.method };
  });
};
PostmanConverter.highlightK6 = (code) => PostmanConverter.highlightCode(code);

// Export
window.PostmanConverter = PostmanConverter;
