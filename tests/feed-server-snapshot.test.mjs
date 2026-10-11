import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import snapshot from '../backend/feed-snapshot.cjs';
const item = { videoId: 'abcdefghijk', title: 'Public title', published: '2026-10-11', kind: 'mv', token: 'never persist' };
function fixture(t, collect) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feed-snapshot-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let time = 1000000000;
  const options = { names: ['A', 'B'], file: path.join(dir, 'feed.json'), collect, now: () => time };
  return { options, cache: snapshot.createFeedSnapshot(options), advance: ms => { time += ms; } };
}
test('persisted public snapshot immediately survives a process restart', async t => {
  const f = fixture(t, async () => ({ artists: { A: [item], B: [] }, failed: [] }));
  assert.equal(f.cache.get(), null); assert.equal(await f.cache.refresh(), true);
  const recovered = snapshot.createFeedSnapshot(f.options);
  assert.deepEqual(recovered.get(), f.cache.get());
  assert.equal(fs.readFileSync(f.options.file, 'utf8').includes('never persist'), false);
  assert.equal(Object.keys(recovered.get().artists).length, 2);
});
test('expired freshness serves immediately while one slow refresh is in flight', async t => {
  let resolve, count = 0;
  const f = fixture(t, () => { count++; return new Promise(r => { resolve = r; }); });
  const p = f.cache.refresh(); await Promise.resolve();
  resolve({ artists: { A: [item] }, failed: ['B'] }); await p;
  f.advance(11 * 60 * 1000);
  const original = f.cache.get(); const a = f.cache.refresh(), b = f.cache.refresh();
  assert.equal(a, b); await Promise.resolve(); assert.equal(count, 2);
  assert.deepEqual(f.cache.get(), original);
  resolve({ artists: { A: [] }, failed: ['B'] }); await a;
  assert.deepEqual(f.cache.get().artists.A, []);
});
test('partial failure preserves the previous channel and its original timestamp', async t => {
  let result = { artists: { A: [item], B: [item] }, failed: [] };
  const f = fixture(t, async () => result); await f.cache.refresh();
  const at = f.cache.get().at; f.advance(600000);
  result = { artists: { A: [], B: [] }, failed: ['A'] }; await f.cache.refresh();
  assert.equal(f.cache.get().at, at); assert.equal(f.cache.get().artists.A.length, 1);
  assert.deepEqual(f.cache.get().artists.B, []);
});
test('complete upstream failure never freshens or overwrites normal snapshot', async t => {
  let fail = false;
  const f = fixture(t, async () => { if (fail) throw Error('secret URL'); return { artists: { A: [item] }, failed: [] }; });
  await f.cache.refresh(); const bytes = fs.readFileSync(f.options.file, 'utf8'), at = f.cache.get().at;
  fail = true; f.advance(600000); assert.equal(await f.cache.refresh(), false);
  assert.equal(f.cache.get().at, at); assert.equal(fs.readFileSync(f.options.file, 'utf8'), bytes);
  f.advance(snapshot.MAX_AGE); assert.equal(f.cache.get(), null);
});
test('corrupt, future, and over-age files are not published', t => {
  const f = fixture(t, async () => null);
  for (const bytes of ['{', JSON.stringify({ version: 1, records: { A: { at: 1, items: [item] } } }), JSON.stringify({ version: 1, records: { A: { at: 9999999999999, items: [item] } } })]) {
    fs.writeFileSync(f.options.file, bytes); assert.equal(snapshot.createFeedSnapshot(f.options).get(), null);
  }
});
test('invalid refresh cannot replace the known normal public payload', async t => {
  let result = { artists: { A: [item] }, failed: [] };
  const f = fixture(t, async () => result); await f.cache.refresh(); const original = f.cache.get();
  result = { artists: { A: [{ videoId: 'not-id' }] }, failed: [] };
  assert.equal(await f.cache.refresh(), false); assert.deepEqual(f.cache.get(), original);
});
test('storage failure cannot publish an unpersisted replacement', async t => {
  let result = { artists: { A: [item] }, failed: [] };
  const f = fixture(t, async () => result); await f.cache.refresh(); const original = f.cache.get();
  fs.mkdirSync(f.options.file + '.pending'); result = { artists: { A: [] }, failed: [] };
  assert.equal(await f.cache.refresh(), false); assert.deepEqual(f.cache.get(), original);
});
test('a failed channel expires independently instead of being freshened by another channel', async t => {
  let result = { artists: { A: [item], B: [item] }, failed: [] };
  const f = fixture(t, async () => result); await f.cache.refresh();
  f.advance(snapshot.MAX_AGE - 1000); result = { artists: { B: [] }, failed: ['A'] }; await f.cache.refresh();
  f.advance(1001); assert.deepEqual(f.cache.get().artists.A, []);
  assert.deepEqual(f.cache.get().artists.B, []); assert(f.cache.get().at > 1000000000);
});
test('runtime patch stays feed-only and does not refresh 100 channels every five minutes', () => {
  const patch = fs.readFileSync(new URL('../backend/apply-feed-patch.py', import.meta.url), 'utf8');
  assert.match(patch, /setInterval\(\(\) => singerFeedSnapshot.refresh\(\), 60 \* 60 \* 1000\)/);
  assert.doesNotMatch(patch, /app\.(?:get|post)\(['"]\/(?:auth|api\/drive)/);
  assert.match(patch, /source hash changed; stop/);
  assert.match(patch, /upstream_status/);
});
