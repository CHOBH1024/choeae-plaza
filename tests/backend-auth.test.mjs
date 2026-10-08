import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { registerGoogleDriveAuth, normalizeData } = createRequire(import.meta.url)('../backend/google-drive-auth.cjs');
const origin = 'https://choeae-plaza.pomyjo.com';
const preview = 'https://ec13398c.choeae-plaza.pages.dev';

function fixture({ verifiedEmail = true, duplicateFiles = false, legacyFiles = false } = {}) {
  const routes = new Map();
  const calls = [];
  const app = Object.fromEntries(['get', 'post', 'options'].map(method => [method, (path, handler) => routes.set(method.toUpperCase() + ' ' + path, handler)]));
  let time = 1_000_000;
  let fail = false;
  let file = null;
  let saved = null;
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (fail) return { ok: false, json: async () => ({ access_token: 'not-to-be-shown' }) };
    let data;
    if (url === 'https://oauth2.googleapis.com/token') data = { access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600 };
    else if (url.endsWith('/userinfo')) data = { email: 'owner@example.test', verified_email: verifiedEmail };
    else if (url.includes('/upload/drive/')) { saved = init.body; file = 'test-file'; data = { id: file }; }
    else if (url.includes('alt=media')) data = { favorites: [url.includes('legacy-two') ? '임영웅' : 'BTS'] };
    else {
      const isCanonicalQuery = new URL(url).searchParams.get('q')?.includes('appProperties');
      data = { files: duplicateFiles ? [{ id: 'one' }, { id: 'two' }] : file ? [{ id: file }] : legacyFiles && !isCanonicalQuery ? [{ id: 'legacy-one', size: '100' }, { id: 'legacy-two', size: '100' }] : [] };
    }
    return { ok: true, json: async () => data };
  };
  registerGoogleDriveAuth(app, { clientId: 'test-client', clientSecret: 'test-secret', redirectUri: 'https://api.pomyjo.com/auth/google/callback', allowedOrigins: [origin, preview], defaultOrigin: origin, fetchImpl, now: () => time });
  async function request(method, path, { query = {}, body = {}, cookie = '', headers = {} } = {}) {
    const res = { code: 200, headers: {}, cookies: [], status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; }, end() { return this; }, set(k,v) { this.headers[k] = v; }, vary(k) { this.headers.Vary = k; }, append(k,v) { assert.equal(k, 'Set-Cookie'); this.cookies.push(v); }, redirect(url) { this.code = 302; this.location = url; } };
    await routes.get(method + ' ' + path)({ method, query, body, headers: { cookie, ...headers } }, res);
    return res;
  }
  async function begin(returnTo) {
    const res = await request('GET', '/auth/google', { query: returnTo ? { returnTo } : {} });
    return { res, state: new URL(res.location).searchParams.get('state'), cookie: res.cookies[0].split(';')[0] };
  }
  async function login() {
    const begun = await begin();
    const result = await request('GET', '/auth/google/callback', { query: { code: 'test-code', state: begun.state }, cookie: begun.cookie });
    return result.cookies.find(x => x.startsWith('__Host-choeae-session=')).split(';')[0];
  }
  return { request, begin, login, calls, advance: n => { time += n; }, fail: () => { fail = true; }, saved: () => saved };
}

test('OAuth uses browser-bound state, PKCE and safe host cookies', async () => {
  const f = fixture();
  const { res, state } = await f.begin();
  const url = new URL(res.location);
  assert.equal(url.hostname, 'accounts.google.com');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  assert.match(res.cookies[0], /Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=600/);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('missing/mismatched state cookie and replay never exchange the auth code', async () => {
  const f = fixture();
  const { state, cookie } = await f.begin();
  const query = { state, code: 'test-code' };
  assert.equal((await f.request('GET', '/auth/google/callback', { query })).code, 400);
  assert.equal(f.calls.length, 0);
  const valid = await f.request('GET', '/auth/google/callback', { query, cookie });
  assert.equal(valid.code, 302);
  assert.match(valid.cookies.join(' '), /__Host-choeae-session=.*HttpOnly; Secure; SameSite=None/);
  assert.equal(new URL(valid.location).origin, origin);
  assert.equal((await f.request('GET', '/auth/google/callback', { query, cookie })).code, 400);
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls[0].init.body.get('code_verifier'));
});

test('expired state and untrusted return origin are rejected', async () => {
  const f = fixture();
  const { state, cookie } = await f.begin();
  f.advance(600_001);
  assert.equal((await f.request('GET', '/auth/google/callback', { query: { state, code: 'test' }, cookie })).code, 400);
  assert.equal((await f.request('GET', '/auth/google', { query: { returnTo: origin + '.evil.test' } })).code, 400);
  assert.equal(new URL((await f.begin(preview)).res.location).hostname, 'accounts.google.com');
});

test('an email parameter is not authentication and cannot select another account', async () => {
  const f = fixture();
  assert.equal((await f.request('GET', '/api/drive/load', { query: { user: 'owner@example.test' } })).code, 401);
  const cookie = await f.login();
  const before = f.calls.length;
  assert.equal((await f.request('GET', '/api/drive/load', { cookie, query: { user: 'other@example.test' } })).code, 403);
  assert.equal((await f.request('POST', '/api/drive/save', { cookie, headers: { origin }, body: { user: 'other@example.test', data: {} } })).code, 403);
  assert.equal(f.calls.length, before);
  const session = await f.request('GET', '/api/auth/session', { cookie });
  assert.deepEqual(session.data, { user: 'owner@example.test' });
  assert.doesNotMatch(JSON.stringify(session), /test-access|test-refresh|test-secret/);
});

test('credentialed CORS is exact and writes reject missing or untrusted Origin', async () => {
  const f = fixture();
  const cookie = await f.login();
  for (const bad of [undefined, 'https://evil.test', origin + '.evil.test']) {
    assert.equal((await f.request('POST', '/api/drive/save', { cookie, body: { data: {} }, headers: bad ? { origin: bad } : {} })).code, 403);
  }
  const preflight = await f.request('OPTIONS', '/api/drive/save', { headers: { origin: preview, 'access-control-request-headers': 'content-type' } });
  assert.equal(preflight.code, 204);
  assert.equal(preflight.headers['Access-Control-Allow-Origin'], preview);
  assert.equal(preflight.headers['Access-Control-Allow-Credentials'], 'true');
  assert.equal(preflight.headers.Vary, 'Origin');
  assert.equal((await f.request('OPTIONS', '/api/drive/save', { headers: { origin, 'access-control-request-method': 'DELETE' } })).code, 403);
  assert.equal((await f.request('OPTIONS', '/api/drive/save', { headers: { origin, 'access-control-request-headers': 'x-unknown' } })).code, 403);
});

test('logout invalidates the server session and expiry requires sign-in again', async () => {
  const f = fixture();
  const cookie = await f.login();
  assert.equal((await f.request('POST', '/auth/logout', { cookie })).code, 403);
  const logout = await f.request('POST', '/auth/logout', { cookie, headers: { origin } });
  assert.equal(logout.code, 200);
  assert.match(logout.cookies[0], /Max-Age=0/);
  assert.equal((await f.request('GET', '/api/drive/load', { cookie })).code, 401);
  const nextCookie = await f.login();
  f.advance(8 * 60 * 60 * 1000 + 1);
  assert.equal((await f.request('GET', '/api/auth/session', { cookie: nextCookie })).code, 401);
});

test('Drive creates metadata and contents atomically; next save updates the existing file', async () => {
  const f = fixture();
  const cookie = await f.login();
  const save = () => f.request('POST', '/api/drive/save', { cookie, headers: { origin }, body: { data: { favorites: ['BTS'] } } });
  assert.equal((await save()).code, 200);
  assert.match(f.saved(), /최애광장-내저장소.json/);
  assert.match(f.calls.at(-1).url, /uploadType=multipart/);
  assert.equal((await save()).code, 200);
  assert.match(f.calls.at(-1).url, /test-file\?uploadType=media/);
  assert.equal(f.calls.at(-1).init.method, 'PATCH');
  const loaded = await f.request('GET', '/api/drive/load', { cookie });
  assert.equal(loaded.code, 200);
  assert.equal(loaded.data.data.favorites[0], 'BTS');
});

test('expired access tokens refresh without exposing tokens in responses', async () => {
  const f = fixture();
  const cookie = await f.login();
  f.advance(3_600_000);
  assert.equal((await f.request('GET', '/api/drive/load', { cookie })).code, 200);
  const refresh = f.calls.find(x => x.init.body?.get?.('grant_type') === 'refresh_token');
  assert.ok(refresh);
  assert.equal(refresh.init.body.get('refresh_token'), 'test-refresh');
});

test('upstream failures are not fake successful empty results and do not leak provider errors', async () => {
  const f = fixture();
  const cookie = await f.login();
  f.fail();
  const load = await f.request('GET', '/api/drive/load', { cookie });
  assert.equal(load.code, 502);
  assert.deepEqual(load.data, { error: 'DRIVE_LOAD_FAILED' });
  assert.equal(load.headers['Cache-Control'], 'no-store');
});

test('saved payload limits and executable/foreign media links are rejected', () => {
  for (const data of [null, [], { favorites: ['x'.repeat(81)] }, { favorites: Array(201).fill('BTS') }, { songs: [{ t: 'x', url: 'javascript:alert(1)' }] }, { videos: [{ t: 'x', url: 'https://evil.test/watch?v=abc' }] }]) assert.throws(() => normalizeData(data));
  assert.deepEqual(normalizeData({ favorites: [' BTS '], extra: 'ignored' }), { favorites: ['BTS'], videos: [], songs: [], articles: [] });
});

test('unverified Google email never creates a login session', async () => {
  const f = fixture({ verifiedEmail: false });
  const { state, cookie } = await f.begin();
  const res = await f.request('GET', '/auth/google/callback', { query: { state, code: 'test' }, cookie });
  assert.equal(res.code, 502);
  assert.ok(res.cookies.every(x => !x.startsWith('__Host-choeae-session=')));
});

test('concurrent saves cannot race file creation and duplicate existing files fail closed', async () => {
  const f = fixture();
  const cookie = await f.login();
  const options = { cookie, headers: { origin }, body: { data: {} } };
  const first = f.request('POST', '/api/drive/save', options);
  const second = await f.request('POST', '/api/drive/save', options);
  assert.equal(second.code, 409);
  assert.equal((await first).code, 200);
  const conflict = fixture({ duplicateFiles: true });
  const conflictCookie = await conflict.login();
  assert.equal((await conflict.request('GET', '/api/drive/load', { cookie: conflictCookie })).code, 502);
  assert.ok(conflict.calls.every(x => !x.url.includes('alt=media')));
});

test('legacy stores merge without deleting originals; canonical creation requires a successful read', async () => {
  const f = fixture({ legacyFiles: true });
  const cookie = await f.login();
  const save = () => f.request('POST', '/api/drive/save', { cookie, headers: { origin }, body: { data: { favorites: ['BTS', '임영웅'] } } });
  assert.equal((await save()).code, 409);
  const loaded = await f.request('GET', '/api/drive/load', { cookie });
  assert.equal(loaded.code, 200);
  assert.equal(loaded.data.migrationRequired, true);
  assert.deepEqual(loaded.data.data.favorites, ['BTS', '임영웅']);
  assert.equal((await save()).code, 200);
  assert.match(f.saved(), /"appProperties":\{"choeaePlazaStore":"v1"\}/);
  assert.ok(f.calls.every(x => x.init.method !== 'DELETE'));
  assert.ok(f.calls.every(x => !x.url.includes('/upload/drive/v3/files/legacy-')));
  assert.equal((await f.request('GET', '/api/drive/load', { cookie })).data.migrationRequired, false);
});
