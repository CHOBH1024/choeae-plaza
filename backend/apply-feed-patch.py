"""Approved feed-only patch. Refuses any unexpected production source."""
import hashlib
from pathlib import Path
import sys

EXPECTED = 'd54ece33bf3ca8359e22c5d31d81244596d25f7f1d72dba526e87abbb3802e0b'

def patch(source):
    start = "const feedCache = { data: null, at: 0 };\napp.get('/api/singer/feed', async (req, res) => {"
    end = "  feedCache.data = { ok: true, at: Date.now(), artists: results };\n  feedCache.at = Date.now();\n  res.json(feedCache.data);\n});"
    assert source.count(start) == 1 and source.count(end) == 1, 'feed anchor mismatch'
    first, rest = source.split(start, 1)
    collector, last = rest.split(end, 1)
    # Only replace the known cache gate; preserve the original classification/IDs.
    gate = '  const MAX_AGE = 10 * 60 * 1000;'
    lines = collector.splitlines(keepends=True)
    assert any(line.startswith(gate) for line in lines), 'cache gate mismatch'
    assert sum('if (feedCache.data && Date.now() - feedCache.at < MAX_AGE)' in line for line in lines) == 1
    collector = ''.join(line for line in lines if not line.startswith(gate) and 'if (feedCache.data && Date.now() - feedCache.at < MAX_AGE)' not in line)
    changes = {
        '  const results = {};': '  const results = {};\n  const failed = [];',
        '      const apiD = await apiR.json();': "      if (!apiR.ok) throw Error('upstream_status');\n      const apiD = await apiR.json();",
        '      if (!apiD.items) { results[name] = []; return; }': "      if (!Array.isArray(apiD.items)) throw Error('upstream_shape');",
        '    } catch (e) { results[name] = []; }': '    } catch (e) { results[name] = []; failed.push(name); }',
    }
    for old, new in changes.items():
        assert collector.count(old) == 1, 'collector anchor mismatch'
        collector = collector.replace(old, new)
    runtime = """
const { createFeedSnapshot } = require('./feed-snapshot.cjs');
async function collectSingerFeed() {COLLECTOR
  return { artists: results, failed };
}
const singerFeedSnapshot = createFeedSnapshot({
  names: Object.keys(SINGER_CHANNELS), collect: collectSingerFeed,
  file: __dirname + '/.cache/singer-feed.json',
  warn: message => console.warn(message),
});
singerFeedSnapshot.refresh();
// 100 channels/hour = about 2,400 playlistItems units/day; never collect per request.
setInterval(() => singerFeedSnapshot.refresh(), 60 * 60 * 1000).unref();
app.get('/api/singer/feed', (req, res) => {
  const data = singerFeedSnapshot.get();
  if (!data) {
    singerFeedSnapshot.refresh();
    res.set('Cache-Control', 'no-store');
    res.set('Retry-After', '10');
    return res.status(503).json({ ok: false, error: 'feed_snapshot_unavailable' });
  }
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  res.set('X-Feed-Age-Seconds', String(Math.max(0, Math.floor((Date.now() - data.at) / 1000))));
  return res.json(data);
});
""".replace('COLLECTOR', collector)
    return first + runtime + last

if __name__ == '__main__':
    source, target = map(Path, sys.argv[1:3])
    original = source.read_bytes()
    assert hashlib.sha256(original).hexdigest() == EXPECTED, 'source hash changed; stop'
    assert not target.exists(), 'candidate already exists; stop'
    target.write_text(patch(original.decode('utf8')), encoding='utf8')
    target.chmod(0o600)
    print('FEED_CANDIDATE_READY', hashlib.sha256(target.read_bytes()).hexdigest())
