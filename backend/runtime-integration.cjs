'use strict';
// Run against the server's installed Express, never against production Google APIs.
const assert = require('node:assert/strict');
const express = require(process.env.CHOEAE_EXPRESS_PATH || 'express');
const { registerGoogleDriveAuth } = require('./google-drive-auth.cjs');
const origin = 'https://choeae-plaza.pomyjo.com';
const app = express();
app.use(express.json({ limit: '64kb' }));
let fileExists = false;
let stored = null;
registerGoogleDriveAuth(app, {
  clientId: 'integration-test', clientSecret: 'fake-secret',
  redirectUri: 'https://api.pomyjo.com/auth/google/callback', defaultOrigin: origin, allowedOrigins: [origin],
  fetchImpl: async (url, options) => {
    let data;
    if (url === 'https://oauth2.googleapis.com/token') data = { access_token: 'fake-access', refresh_token: 'fake-refresh', expires_in: 3600 };
    else if (url.endsWith('/userinfo')) data = { email: 'test@example.test', verified_email: true };
    else if (url.includes('/upload/drive/')) {
      if (options.method === 'POST') {
        assert.match(options.body, /"name":"최애광장-내저장소.json"/);
        assert.match(options.body, /"favorites":\["BTS"\]/);
        fileExists = true;
        stored = { favorites: ['BTS'], videos: [], songs: [], articles: [] };
      } else stored = JSON.parse(options.body);
      data = { id: 'test-file' };
    } else if (url.includes('alt=media')) data = stored;
    else data = { files: fileExists ? [{ id: 'test-file' }] : [] };
    return { ok: true, json: async () => data };
  }
});
const server = app.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  const req = (path, init = {}) => fetch(base + path, { ...init, redirect: 'manual' });
  try {
    assert.equal((await req('/auth/google?returnPath='+encodeURIComponent('//evil.example/'))).status,400);
    const returnPath='/discover?singer=BTS&view=classic';
    const start = await req('/auth/google?returnPath='+encodeURIComponent(returnPath));
    assert.equal(start.status, 302);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const stateCookie = start.headers.getSetCookie()[0].split(';')[0];
    assert.equal((await req('/auth/google/callback?code=fake&state=' + state)).status, 400);
    const callback = await req('/auth/google/callback?code=fake&state=' + state + '&returnPath='+encodeURIComponent('/api/drive/load'), { headers: { Cookie: stateCookie } });
    assert.equal(callback.status, 302);
    const destination=new URL(callback.headers.get('location'));
    assert.equal(destination.origin,origin);assert.equal(destination.pathname,'/discover');assert.equal(destination.searchParams.get('singer'),'BTS');assert.equal(destination.searchParams.get('view'),'classic');assert.equal(destination.searchParams.get('login'),'ok');
    const sessionCookie = callback.headers.getSetCookie().find(x => x.startsWith('__Host-choeae-session=')).split(';')[0];
    assert.equal((await req('/api/drive/load?user=test@example.test')).status, 401);
    assert.equal((await req('/api/drive/load?user=other@example.test', { headers: { Cookie: sessionCookie } })).status, 403);
    const options = await req('/api/drive/save', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    assert.equal(options.status, 204);
    assert.equal(options.headers.get('access-control-allow-credentials'), 'true');
    const save = data => req('/api/drive/save', { method: 'POST', headers: { Cookie: sessionCookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ user: 'test@example.test', data }) });
    assert.equal((await save({ favorites: ['BTS'] })).status, 200);
    assert.equal((await save({ favorites: ['임영웅'] })).status, 200);
    const loaded = await req('/api/drive/load', { headers: { Cookie: sessionCookie, Origin: origin } });
    assert.deepEqual((await loaded.json()).data.favorites, ['임영웅']);
    assert.equal((await req('/auth/logout', { method: 'POST', headers: { Cookie: sessionCookie, Origin: origin } })).status, 200);
    assert.equal((await req('/api/drive/load', { headers: { Cookie: sessionCookie } })).status, 401);
    console.log('EXPRESS_INTEGRATION_PASS: state, ownership, CORS, create/update/read, logout');
  } catch (error) {
    console.error('EXPRESS_INTEGRATION_FAILED:', error.message);
    process.exitCode = 1;
  } finally { server.close(); }
});
