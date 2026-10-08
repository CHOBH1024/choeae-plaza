'use strict';

const { randomBytes, createHash } = require('node:crypto');
const SESSION_COOKIE = '__Host-choeae-session';
const STATE_COOKIE = '__Host-choeae-state';
const FILE_NAME = '최애광장-내저장소.json';
const SESSION_TTL = 8 * 60 * 60 * 1000;
const STATE_TTL = 10 * 60 * 1000;
const STORE_PROPERTY = 'choeaePlazaStore';
const random = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest('hex');

function normalizeData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_DATA');
  const output = {};
  for (const key of ['favorites', 'videos', 'songs', 'articles']) {
    const list = value[key] ?? [];
    if (!Array.isArray(list) || list.length > 200) throw new Error('INVALID_DATA');
    output[key] = list.map(item => {
      if (key === 'favorites') {
        if (typeof item !== 'string' || !item.trim() || item.length > 80) throw new Error('INVALID_DATA');
        return item.trim();
      }
      if (!item || typeof item.t !== 'string' || !item.t.trim() || item.t.length > 300) throw new Error('INVALID_DATA');
      let link = '';
      if (item.url) {
        const url = new URL(item.url);
        const hosts = ['youtube.com', 'www.youtube.com', 'music.youtube.com', 'youtu.be'];
        if (url.protocol !== 'https:' || url.username || url.password || url.port || (key !== 'articles' && !hosts.includes(url.hostname))) throw new Error('INVALID_DATA');
        link = url.href;
      }
      return { t: item.t.trim(), url: link, at: Number.isSafeInteger(item.at) && item.at >= 0 ? item.at : 0 };
    });
  }
  if (Buffer.byteLength(JSON.stringify(output)) > 50_000) throw new Error('INVALID_DATA');
  return output;
}

function mergeData(values) {
  const output = { favorites: [], videos: [], songs: [], articles: [] };
  for (const value of values.map(normalizeData)) {
    for (const key of Object.keys(output)) {
      const items = new Map(output[key].map(item => [key === 'favorites' ? item : item.url || item.t, item]));
      for (const item of value[key]) {
        const id = key === 'favorites' ? item : item.url || item.t;
        if (!items.has(id) || (key !== 'favorites' && item.at > items.get(id).at)) items.set(id, item);
      }
      output[key] = [...items.values()];
    }
  }
  // Never silently discard records when merging old files.
  return normalizeData(output);
}

// Register instead of the old OAuth/Drive routes, not alongside them.
// Tokens remain in process memory; a service restart requires sign-in again.
function registerGoogleDriveAuth(app, options) {
  const { clientId, clientSecret, redirectUri, fetchImpl = globalThis.fetch, now = Date.now } = options;
  const allowed = new Set(options.allowedOrigins);
  const defaultOrigin = options.defaultOrigin;
  if (!allowed.has(defaultOrigin) || new URL(redirectUri).protocol !== 'https:') throw new Error('INVALID_AUTH_CONFIG');
  for (const origin of allowed) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw new Error('INVALID_AUTH_CONFIG');
  }
  const states = new Map();
  const sessions = new Map();
  const writes = new Set();
  function report(operation, error) {
    const codes = ['UPSTREAM_FAILED', 'DRIVE_FILE_CONFLICT', 'INVALID_FILE', 'INVALID_DATA', 'RELOGIN_REQUIRED'];
    const code = codes.includes(error.message) ? error.message : error.name === 'TimeoutError' ? 'UPSTREAM_TIMEOUT' : 'INTERNAL_ERROR';
    // Fixed codes/status only: never log tokens, emails, URLs, provider bodies or saved items.
    console.warn('[choeae-auth]', operation, code, Number.isInteger(error.status) ? error.status : '');
  }
  function sweep() {
    for (const [key, value] of states) if (value.expires <= now()) states.delete(key);
    for (const [key, value] of sessions) if (value.expires <= now()) sessions.delete(key);
  }
  function cookie(req, name) {
    const parts = String(req.headers.cookie || '').split(';').map(x => x.trim()).filter(x => x.startsWith(name + '='));
    return parts.length === 1 ? parts[0].slice(name.length + 1) : '';
  }
  function setCookie(res, name, value, maxAge, sameSite) {
    res.append('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${maxAge}`);
  }
  function headers(req, res, write = false) {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.vary('Origin');
    const origin = req.headers.origin;
    if ((origin && !allowed.has(origin)) || (write && !origin)) {
      res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
      return false;
    }
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Credentials', 'true');
    }
    return true;
  }
  function session(req, res) {
    sweep();
    const id = cookie(req, SESSION_COOKIE);
    const value = id && sessions.get(digest(id));
    if (!value) { res.status(401).json({ error: 'LOGIN_REQUIRED' }); return null; }
    const asserted = req.method === 'POST' ? req.body?.user : req.query?.user;
    if (asserted && asserted !== value.email) { res.status(403).json({ error: 'ACCOUNT_MISMATCH' }); return null; }
    return value;
  }
  async function json(url, init = {}) {
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) { const error = new Error('UPSTREAM_FAILED'); error.status = response.status; throw error; }
    return response.json();
  }
  async function access(value) {
    if (value.tokenExpires > now() + 60_000) return value.tokens.access_token;
    if (!value.tokens.refresh_token) throw new Error('RELOGIN_REQUIRED');
    if (!value.refreshing) value.refreshing = json('https://oauth2.googleapis.com/token', {
      method: 'POST', body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: value.tokens.refresh_token, grant_type: 'refresh_token' })
    }).then(tokens => {
      if (!tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) throw new Error('RELOGIN_REQUIRED');
      value.tokens = { ...value.tokens, ...tokens };
      value.tokenExpires = now() + tokens.expires_in * 1000;
    }).finally(() => { value.refreshing = null; });
    await value.refreshing;
    return value.tokens.access_token;
  }
  async function findStore(token) {
    async function list(extra) {
      const query = new URLSearchParams({ q: `name='${FILE_NAME}' and trashed=false` + extra, fields: 'files(id,size),nextPageToken', pageSize: '21' });
      const data = await json('https://www.googleapis.com/drive/v3/files?' + query, { headers: { Authorization: 'Bearer ' + token } });
      if (!Array.isArray(data.files) || data.files.length > 20 || data.nextPageToken) throw new Error('DRIVE_FILE_CONFLICT');
      for (const item of data.files) if (!item || !/^[A-Za-z0-9_-]+$/.test(item.id) || (item.size !== undefined && (!/^\d+$/.test(String(item.size)) || Number(item.size) > 64_000))) throw new Error('INVALID_FILE');
      return data.files;
    }
    const canonical = await list(` and appProperties has { key='${STORE_PROPERTY}' and value='v1' }`);
    if (canonical.length > 1) throw new Error('DRIVE_FILE_CONFLICT');
    if (canonical.length === 1) return { file: canonical[0].id, legacy: [] };
    return { file: null, legacy: await list('') };
  }
  for (const path of ['/api/drive/load', '/api/drive/save', '/api/auth/session', '/auth/logout']) app.options(path, (req, res) => {
    if (!headers(req, res)) return;
    const method = path === '/api/drive/load' || path === '/api/auth/session' ? 'GET' : 'POST';
    if (req.headers['access-control-request-method'] && req.headers['access-control-request-method'] !== method) return res.status(403).json({ error: 'METHOD_NOT_ALLOWED' });
    const requested = String(req.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
    if (requested.some(x => x !== 'content-type')) return res.status(403).json({ error: 'HEADERS_NOT_ALLOWED' });
    res.set('Access-Control-Allow-Methods', method + ', OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
  });
  app.get('/auth/google', (req, res) => {
    if (!headers(req, res)) return;
    if (!clientId || !clientSecret) return res.status(503).json({ error: 'OAUTH_NOT_CONFIGURED' });
    const origin = req.query.returnTo || defaultOrigin;
    if (!allowed.has(origin)) return res.status(400).json({ error: 'INVALID_RETURN_ORIGIN' });
    sweep();
    if (states.size >= 1000) return res.status(503).json({ error: 'TRY_LATER' });
    const previous = cookie(req, STATE_COOKIE);
    if (previous) states.delete(digest(previous));
    const state = random();
    const verifier = random();
    states.set(digest(state), { origin, verifier, expires: now() + STATE_TTL });
    setCookie(res, STATE_COOKIE, state, STATE_TTL / 1000, 'Lax');
    const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file', access_type: 'offline', prompt: 'consent', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
    res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + query);
  });
  app.get('/auth/google/callback', async (req, res) => {
    if (!headers(req, res)) return;
    sweep();
    const state = req.query.state;
    const expected = cookie(req, STATE_COOKIE);
    const pending = typeof state === 'string' && states.get(digest(state));
    if (!pending || !expected || state !== expected) return res.status(400).json({ error: 'INVALID_OAUTH_STATE' });
    states.delete(digest(state));
    setCookie(res, STATE_COOKIE, '', 0, 'Lax');
    if (req.query.error || typeof req.query.code !== 'string' || req.query.code.length > 4096) return res.status(400).json({ error: 'OAUTH_CANCELLED' });
    try {
      const tokens = await json('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: req.query.code, code_verifier: pending.verifier, redirect_uri: redirectUri, grant_type: 'authorization_code' }) });
      if (!tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) throw new Error('INVALID_TOKEN');
      const user = await json('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + tokens.access_token } });
      if (typeof user.email !== 'string' || user.email.length > 254 || !user.email.includes('@') || user.verified_email !== true) throw new Error('INVALID_ACCOUNT');
      if (sessions.size >= 1000) throw new Error('CAPACITY');
      const previous = cookie(req, SESSION_COOKIE);
      if (previous) sessions.delete(digest(previous));
      const id = random();
      sessions.set(digest(id), { email: user.email, tokens, tokenExpires: now() + tokens.expires_in * 1000, expires: now() + SESSION_TTL });
      setCookie(res, SESSION_COOKIE, id, SESSION_TTL / 1000, 'None');
      const destination = new URL(pending.origin);
      destination.searchParams.set('login', 'ok');
      destination.searchParams.set('user', user.email);
      res.redirect(destination.href);
    } catch (error) { report('login', error); res.status(502).json({ error: 'LOGIN_FAILED' }); }
  });
  app.get('/api/auth/session', (req, res) => {
    if (!headers(req, res)) return;
    const value = session(req, res);
    if (value) res.json({ user: value.email });
  });
  app.post('/auth/logout', (req, res) => {
    if (!headers(req, res, true)) return;
    const id = cookie(req, SESSION_COOKIE);
    if (id) sessions.delete(digest(id));
    setCookie(res, SESSION_COOKIE, '', 0, 'None');
    res.json({ ok: true });
  });
  app.get('/api/drive/load', async (req, res) => {
    if (!headers(req, res)) return;
    const value = session(req, res);
    if (!value) return;
    try {
      const token = await access(value);
      const store = await findStore(token);
      const ids = store.file ? [store.file] : store.legacy.map(file => file.id);
      const documents = await Promise.all(ids.map(id => json(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: { Authorization: 'Bearer ' + token } })));
      const data = documents.length ? mergeData(documents) : null;
      value.legacyLoaded = !store.file && store.legacy.length > 0;
      res.json({ data, migrationRequired: value.legacyLoaded });
    } catch (error) { report('load', error); res.status(502).json({ error: 'DRIVE_LOAD_FAILED' }); }
  });
  app.post('/api/drive/save', async (req, res) => {
    if (!headers(req, res, true)) return;
    const value = session(req, res);
    if (!value) return;
    let payload;
    try { payload = normalizeData(req.body?.data); } catch (_) { return res.status(400).json({ error: 'INVALID_DATA' }); }
    if (writes.has(value.email)) return res.status(409).json({ error: 'SAVE_IN_PROGRESS' });
    writes.add(value.email);
    try {
      const token = await access(value);
      const store = await findStore(token);
      const file = store.file;
      if (!file && store.legacy.length && !value.legacyLoaded) return res.status(409).json({ error: 'LOAD_BEFORE_SAVE' });
      const body = JSON.stringify(payload);
      if (file) {
        await json(`https://www.googleapis.com/upload/drive/v3/files/${file}?uploadType=media`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body });
      } else {
        const boundary = 'choeae_' + random();
        const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: FILE_NAME, mimeType: 'application/json', appProperties: { [STORE_PROPERTY]: 'v1' } })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--\r\n`;
        await json('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart });
      }
      res.json({ ok: true });
    } catch (error) { report('save', error); res.status(502).json({ error: 'DRIVE_SAVE_FAILED' }); }
    finally { writes.delete(value.email); }
  });
}

module.exports = { registerGoogleDriveAuth, normalizeData, mergeData };
