'use strict';
// Executes only the isolated patched feed block, with fake YouTube responses.
const fs = require('node:fs'), vm = require('node:vm'), os = require('node:os');
const path = require('node:path'), assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2], 'utf8');
const modulePath = path.resolve(process.argv[3]);
const start = source.indexOf("const { createFeedSnapshot } = require('./feed-snapshot.cjs');");
const end = source.indexOf('// ----------', start);
assert(start >= 0 && end > start);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feed-runtime-'));
fs.mkdirSync(path.join(dir, '.cache'));
const file = path.join(dir, '.cache/singer-feed.json');
const at = Date.now() - 11 * 60 * 1000;
const video = { videoId: 'abcdefghijk', title: 'seed', published: '2026-10-11', kind: 'mv' };
fs.writeFileSync(file, JSON.stringify({ version: 1, records: { A: { at, items: [video] }, B: { at, items: [] } } }));
let handler, interval, requests = 0, releases = [], fail = false;
const context = { require: () => require(modulePath), __dirname: dir, Date, Object, Array, Math,
  SINGER_CHANNELS: { A: 'UCabcdefghijklmnopqrstuv', B: 'UCzyxwvutsrqponmlkjihgfe' }, YT_API_KEY: 'FAKE_ONLY',
  AbortSignal, console: { warn() {} }, setTimeout,
  setInterval(fn, ms) { assert.equal(ms, 3600000); interval = fn; return { unref() {} }; },
  app: { get(url, fn) { assert.equal(url, '/api/singer/feed'); handler = fn; } },
  fetch() { requests++; return new Promise(resolve => releases.push(() => resolve({ ok: !fail, json: async () => ({ items: [] }) }))); },
};
function request() {
  const headers = {}, response = { status: 200 };
  handler({}, { set(k, v) { headers[k] = v; }, status(s) { response.status = s; return this; }, json(data) { response.data = data; return this; } });
  return { headers, ...response };
}
(async () => {
  try {
    vm.runInNewContext(source.slice(start, end), context);
    const first = request(); assert.equal(first.status, 200); assert.equal(first.data.at, at);
    assert.equal(first.data.artists.A[0].title, 'seed'); assert.equal(requests, 0);
    await new Promise(r => setImmediate(r)); assert.equal(requests, 2);
    for (let i = 0; i < 20; i++) { assert.equal(request().data.at, at); interval(); }
    await new Promise(r => setImmediate(r)); assert.equal(requests, 2);
    releases.splice(0).forEach(fn => fn()); await new Promise(r => setImmediate(r));
    const fresh = request(); assert.deepEqual(fresh.data.artists.A, []); assert(fresh.data.at > at);
    assert.equal(fresh.headers['Cache-Control'], 'public, max-age=30, stale-while-revalidate=60');
    const bytes = fs.readFileSync(file, 'utf8'); fail = true; interval();
    await new Promise(r => setImmediate(r)); releases.splice(0).forEach(fn => fn());
    await new Promise(r => setImmediate(r)); assert.equal(fs.readFileSync(file, 'utf8'), bytes);
    console.log('FEED_RUNTIME_PASS: immediate disk response, single-flight, valid empty update, failure preserves bytes');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
