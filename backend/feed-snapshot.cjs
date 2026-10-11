'use strict';
const fs = require('node:fs');
const path = require('node:path');
const MAX_AGE = 24 * 60 * 60 * 1000;
const MAX_BYTES = 2 * 1024 * 1024;

// Public metadata only. Never persist request, session, or upstream credentials.
function cleanEntries(items) {
  if (!Array.isArray(items) || items.length > 50) throw Error('invalid_entries');
  return items.map(v => {
    if (!v || !/^[A-Za-z0-9_-]{11}$/.test(v.videoId)) throw Error('invalid_video');
    return { videoId: v.videoId, title: String(v.title || '').slice(0, 1000),
      published: String(v.published || '').slice(0, 40), kind: String(v.kind || 'other').slice(0, 30) };
  });
}
function createFeedSnapshot({ names, collect, file, now = Date.now, warn = () => {} }) {
  const allowed = new Set(names);
  let records = Object.create(null), pending = null;
  function readRecords(value) {
    if (!value || value.version !== 1 || !value.records) throw Error('invalid_snapshot');
    const clean = Object.create(null);
    for (const [name, r] of Object.entries(value.records)) {
      if (!allowed.has(name) || !Number.isFinite(r.at) || r.at > now() || now() - r.at >= MAX_AGE) continue;
      clean[name] = { at: r.at, items: cleanEntries(r.items) };
    }
    return clean;
  }
  try {
    if (fs.statSync(file).size > MAX_BYTES) throw Error('snapshot_too_large');
    records = readRecords(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (e) { if (e.code !== 'ENOENT') warn('feed_snapshot_read_failed'); }
  function get() {
    const artists = Object.create(null), dates = [];
    for (const name of names) {
      const r = records[name];
      if (r && r.at <= now() && now() - r.at < MAX_AGE) {
        artists[name] = r.items; dates.push(r.at);
      } else artists[name] = [];
    }
    return dates.length ? { ok: true, at: Math.min(...dates), artists } : null;
  }
  function refresh() {
    if (pending) return pending;
    pending = Promise.resolve().then(collect).then(result => {
      if (!result || !result.artists || !Array.isArray(result.failed)) throw Error('invalid_collection');
      const failed = new Set(result.failed), next = Object.assign(Object.create(null), records);
      let changed = false;
      for (const name of names) {
        if (failed.has(name) || !Object.hasOwn(result.artists, name)) continue;
        next[name] = { at: now(), items: cleanEntries(result.artists[name]) }; changed = true;
      }
      if (!changed) return false;
      const pruned = readRecords({ version: 1, records: next });
      const bytes = JSON.stringify({ version: 1, records: pruned });
      if (Buffer.byteLength(bytes) > MAX_BYTES) throw Error('snapshot_too_large');
      // Same-directory atomic rename, restrictive permissions; no API data deletion.
      const temp = file + '.pending';
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      fs.writeFileSync(temp, bytes, { mode: 0o600 }); fs.chmodSync(temp, 0o600);
      fs.renameSync(temp, file); records = pruned;
      return true;
    }).catch(() => { warn('feed_snapshot_refresh_failed'); return false; })
      .finally(() => { pending = null; });
    return pending;
  }
  return { get, refresh };
}
module.exports = { createFeedSnapshot, cleanEntries, MAX_AGE };
