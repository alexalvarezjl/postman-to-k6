/**
 * curl-parser.js
 * Parse a raw cURL (Bash) command string into the same normalized request
 * object that converter.js / generateK6Script() already understands.
 *
 * Supported flags:
 *   Positional URL            → url + queryParams
 *   -X / --request METHOD     → method
 *   --url URL                 → url (alternative placement)
 *   -H / --header 'K: V'      → headers[]
 *   -d / --data / --data-raw
 *       / --data-binary TEXT  → body (raw)
 *   --json TEXT               → body (raw, forces Content-Type: application/json)
 *   --data-urlencode TEXT     → body (urlencoded)
 *   -u / --user user:pass     → Authorization: Basic … header
 *   -b / --cookie TEXT        → Cookie header
 *   -A / --user-agent TEXT    → User-Agent header
 *   --compressed              → (ignored — k6 handles gzip automatically)
 *   -L / --location           → (ignored — not directly mapped)
 *   -k / --insecure           → (ignored — comment added to output name)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN SPLITTER
// Splits a cURL command into an array of tokens, handling:
//   • backslash-newline continuations  (\ + \n)
//   • single-quoted strings            ('...')
//   • double-quoted strings            ("...")
//   • unquoted tokens
// ─────────────────────────────────────────────────────────────────────────────
function tokenize(raw) {
  // Normalize line continuations: \ followed by \n (or \r\n)
  const normalized = raw.replace(/\\\r?\n/g, ' ');

  const tokens = [];
  let i = 0;
  const len = normalized.length;

  while (i < len) {
    // Skip whitespace
    while (i < len && /\s/.test(normalized[i])) i++;
    if (i >= len) break;

    const ch = normalized[i];

    if (ch === "'") {
      // Single-quoted: no escape sequences inside
      i++; // skip opening quote
      let tok = '';
      while (i < len && normalized[i] !== "'") {
        tok += normalized[i++];
      }
      i++; // skip closing quote
      tokens.push(tok);
    } else if (ch === '"') {
      // Double-quoted: handle \" and \\ escapes
      i++;
      let tok = '';
      while (i < len && normalized[i] !== '"') {
        if (normalized[i] === '\\' && i + 1 < len) {
          const next = normalized[i + 1];
          if (next === '"' || next === '\\' || next === 'n' || next === 't') {
            tok += next === 'n' ? '\n' : next === 't' ? '\t' : next;
            i += 2;
          } else {
            tok += normalized[i++];
          }
        } else {
          tok += normalized[i++];
        }
      }
      i++; // skip closing quote
      tokens.push(tok);
    } else {
      // Unquoted token — stop at whitespace
      let tok = '';
      while (i < len && !/\s/.test(normalized[i])) {
        tok += normalized[i++];
      }
      tokens.push(tok);
    }
  }

  return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLAG CONSUMER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Advance past `--flag=value` or `--flag value` styles.
 * Returns { value, nextIdx }.
 * For `--flag=value`, nextIdx === current idx (no extra token consumed).
 * For `--flag value`,  nextIdx === current idx + 1 (next token consumed).
 */
function consumeValue(tokens, idx, token) {
  const eqPos = token.indexOf('=');
  if (eqPos !== -1) {
    return { value: token.slice(eqPos + 1), nextIdx: idx };
  }
  // Next token is the value
  return { value: tokens[idx + 1] || '', nextIdx: idx + 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// URL NORMALIZER
// ─────────────────────────────────────────────────────────────────────────────
function splitUrl(fullUrl) {
  let clean = fullUrl.trim();

  // Strip surrounding quotes that tokenizer may have left on unquoted URLs
  if ((clean.startsWith("'") && clean.endsWith("'")) ||
      (clean.startsWith('"') && clean.endsWith('"'))) {
    clean = clean.slice(1, -1);
  }

  const queryIdx = clean.indexOf('?');
  if (queryIdx === -1) {
    return { base: clean, queryParams: [] };
  }

  const base = clean.slice(0, queryIdx);
  const qs   = clean.slice(queryIdx + 1);
  const queryParams = qs.split('&').map(p => {
    const eqIdx = p.indexOf('=');
    if (eqIdx === -1) return { key: decodeURIComponent(p), value: '' };
    return {
      key:   decodeURIComponent(p.slice(0, eqIdx)),
      value: decodeURIComponent(p.slice(eqIdx + 1))
    };
  }).filter(p => p.key);

  return { base, queryParams };
}

// ─────────────────────────────────────────────────────────────────────────────
// BODY LANGUAGE DETECTOR
// ─────────────────────────────────────────────────────────────────────────────
function detectBodyLanguage(raw) {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return 'json';
  }
  return 'text';
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVE REQUEST NAME FROM URL
// ─────────────────────────────────────────────────────────────────────────────
function nameFromUrl(url, method) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || parsed.hostname;
    // Capitalize and clean
    const clean = last.replace(/[^a-zA-Z0-9\s-]/g, ' ').trim();
    return `${method} ${clean || parsed.hostname}`;
  } catch {
    return `${method} Request`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PARSE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a cURL Bash command into a normalized request object.
 *
 * @param {string} raw  – the raw cURL string (may be multi-line with \ continuations)
 * @returns {Object}    – request object compatible with converter.js
 * @throws  {Error}     – if no URL can be found
 */
function parseCurl(raw) {
  const tokens = tokenize(raw);

  if (!tokens.length || tokens[0].toLowerCase() !== 'curl') {
    throw new Error('El comando debe comenzar con "curl"');
  }

  let method     = null;   // will default to GET or POST (if body present)
  let rawUrl     = null;
  let headers    = [];
  let bodyRaw    = null;
  let bodyMode   = 'raw';  // 'raw' | 'urlencoded'
  let forceJson  = false;

  let i = 1; // skip 'curl'

  while (i < tokens.length) {
    const tok = tokens[i];

    // ── Method ──────────────────────────────────────────────────
    if (tok === '-X' || tok === '--request') {
      method = (tokens[i + 1] || 'GET').toUpperCase();
      i += 2;
      continue;
    }
    if (tok.startsWith('--request=')) {
      method = tok.slice('--request='.length).toUpperCase();
      i++;
      continue;
    }

    // ── URL (explicit) ───────────────────────────────────────────
    if (tok === '--url') {
      const r = consumeValue(tokens, i, tok);
      rawUrl = r.value;
      i = r.nextIdx + 1;
      continue;
    }
    if (tok.startsWith('--url=')) {
      rawUrl = tok.slice('--url='.length);
      i++;
      continue;
    }

    // ── Headers ──────────────────────────────────────────────────
    if (tok === '-H' || tok === '--header') {
      const val = tokens[i + 1] || '';
      const colonIdx = val.indexOf(':');
      if (colonIdx !== -1) {
        headers.push({
          key:   val.slice(0, colonIdx).trim(),
          value: val.slice(colonIdx + 1).trim()
        });
      }
      i += 2;
      continue;
    }
    if (tok.startsWith('--header=')) {
      const val = tok.slice('--header='.length);
      const colonIdx = val.indexOf(':');
      if (colonIdx !== -1) {
        headers.push({
          key:   val.slice(0, colonIdx).trim(),
          value: val.slice(colonIdx + 1).trim()
        });
      }
      i++;
      continue;
    }

    // ── Body (raw) ───────────────────────────────────────────────
    if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary') {
      bodyRaw  = tokens[i + 1] || '';
      bodyMode = 'raw';
      i += 2;
      continue;
    }
    if (tok.startsWith('--data=') || tok.startsWith('--data-raw=') || tok.startsWith('--data-binary=')) {
      bodyRaw  = tok.slice(tok.indexOf('=') + 1);
      bodyMode = 'raw';
      i++;
      continue;
    }

    // ── Body (--json, curl 7.82+) ────────────────────────────────
    if (tok === '--json') {
      bodyRaw   = tokens[i + 1] || '';
      bodyMode  = 'raw';
      forceJson = true;
      i += 2;
      continue;
    }
    if (tok.startsWith('--json=')) {
      bodyRaw   = tok.slice('--json='.length);
      bodyMode  = 'raw';
      forceJson = true;
      i++;
      continue;
    }

    // ── Body (urlencoded) ─────────────────────────────────────────
    if (tok === '--data-urlencode') {
      // Append to body as-is; we'll handle it as raw urlencoded text
      const val = tokens[i + 1] || '';
      bodyRaw  = bodyRaw ? `${bodyRaw}&${val}` : val;
      bodyMode = 'urlencoded';
      i += 2;
      continue;
    }

    // ── Basic Auth ───────────────────────────────────────────────
    if (tok === '-u' || tok === '--user') {
      const val = tokens[i + 1] || '';
      if (!headers.some(h => h.key.toLowerCase() === 'authorization')) {
        headers.push({
          key:   'Authorization',
          value: `Basic ${PostmanConverter.safeBtoa(val)}`
        });
      }
      i += 2;
      continue;
    }
    if (tok.startsWith('--user=')) {
      const val = tok.slice('--user='.length);
      if (!headers.some(h => h.key.toLowerCase() === 'authorization')) {
        headers.push({
          key:   'Authorization',
          value: `Basic ${PostmanConverter.safeBtoa(val)}`
        });
      }
      i++;
      continue;
    }

    // ── Cookie ───────────────────────────────────────────────────
    if (tok === '-b' || tok === '--cookie') {
      const val = tokens[i + 1] || '';
      if (!headers.some(h => h.key.toLowerCase() === 'cookie')) {
        headers.push({ key: 'Cookie', value: val });
      }
      i += 2;
      continue;
    }

    // ── User-Agent ───────────────────────────────────────────────
    if (tok === '-A' || tok === '--user-agent') {
      const val = tokens[i + 1] || '';
      if (!headers.some(h => h.key.toLowerCase() === 'user-agent')) {
        headers.push({ key: 'User-Agent', value: val });
      }
      i += 2;
      continue;
    }

    // ── Ignored flags (boolean, no value) ────────────────────────
    if (['-L', '--location', '--compressed', '-k', '--insecure',
         '-s', '--silent', '-v', '--verbose', '-i', '--include',
         '-I', '--head', '--http1.1', '--http2'].includes(tok)) {
      i++;
      continue;
    }

    // ── Ignored flags (consume one value) ────────────────────────
    if (['-o', '--output', '--max-time', '-m', '--connect-timeout',
         '--limit-rate', '--retry', '-e', '--referer', '--cert',
         '--cacert', '--capath', '--proxy', '-x'].includes(tok)) {
      i += 2;
      continue;
    }

    // ── Positional URL ───────────────────────────────────────────
    // Anything that looks like a URL (starts with http or is not a flag)
    if (!tok.startsWith('-') && rawUrl === null) {
      rawUrl = tok;
      i++;
      continue;
    }

    // Unknown flag — skip it (and its likely value if next token isn't a flag)
    i++;
    if (i < tokens.length && !tokens[i].startsWith('-')) i++;
  }

  // ── Validate ──────────────────────────────────────────────────
  if (!rawUrl) {
    throw new Error('No se encontró una URL en el comando cURL');
  }

  // ── Resolve URL ───────────────────────────────────────────────
  const { base: urlBase, queryParams } = splitUrl(rawUrl);

  // ── Method defaults ───────────────────────────────────────────
  if (!method) {
    method = bodyRaw !== null ? 'POST' : 'GET';
  }

  // ── Content-Type inference ────────────────────────────────────
  const hasContentType = headers.some(h => h.key.toLowerCase() === 'content-type');
  if (bodyRaw !== null && !hasContentType) {
    if (forceJson || detectBodyLanguage(bodyRaw) === 'json') {
      headers.push({ key: 'Content-Type', value: 'application/json' });
    } else if (bodyMode === 'urlencoded') {
      headers.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' });
    }
  }

  // ── Build body object ─────────────────────────────────────────
  let body = null;
  if (bodyRaw !== null) {
    if (bodyMode === 'urlencoded') {
      // Parse key=value pairs
      const pairs = bodyRaw.split('&').map(p => {
        const eqIdx = p.indexOf('=');
        if (eqIdx === -1) return { key: p, value: '' };
        return { key: p.slice(0, eqIdx), value: p.slice(eqIdx + 1) };
      }).filter(p => p.key);
      body = { mode: 'urlencoded', urlencoded: pairs };
    } else {
      const language = forceJson ? 'json' : detectBodyLanguage(bodyRaw);
      body = { mode: 'raw', raw: bodyRaw, language };
    }
  }

  // ── Build result ──────────────────────────────────────────────
  const id   = `req_${Math.random().toString(36).slice(2, 9)}`;
  const name = nameFromUrl(urlBase, method);

  return {
    id,
    name,
    folder: '',
    method,
    url: urlBase,
    queryParams,
    headers,
    body,
    postmanScript: '',
    checks: [],
    selected: true
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────
window.CurlParser = { parse: parseCurl };
