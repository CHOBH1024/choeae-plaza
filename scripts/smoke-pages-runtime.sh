#!/usr/bin/env bash
set -euo pipefail

port=8788
base="http://127.0.0.1:${port}"
log="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/choeae-pages-runtime.log"

setsid npx --yes wrangler@4.148.0 pages dev "${PAGES_DIRECTORY:-public}" --ip 127.0.0.1 --port "$port" --compatibility-date=2026-10-06 >"$log" 2>&1 &
server_pid=$!
cleanup() {
  kill -- -"$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT

ready=0
for _ in $(seq 1 30); do
  if curl --fail --silent "$base/" -o /dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    cat "$log"
    exit 1
  fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  cat "$log"
  echo "Pages runtime did not become ready" >&2
  exit 1
fi

home_html="$(curl --fail --silent "$base/")"
grep -qi '<meta name="robots" content="noindex, nofollow">' <<<"$home_html"

trot_html="$(curl --fail --silent "$base/trot")"
grep -q 'id="playerBar"' <<<"$trot_html"

# Static assets skip Functions; enforce Pages _headers in the real runtime.
for asset in music-hub.js music-hub.css locale-copy.js manifest-idol.json privacy.html; do
  curl --fail --silent --dump-header /tmp/choeae-asset-headers "$base/$asset?v=header-check" --output /dev/null
  grep -qi '^cache-control:.*no-cache' /tmp/choeae-asset-headers
  grep -qi '^x-content-type-options: nosniff' /tmp/choeae-asset-headers
done

for route in blog popular-videos; do
  status="$(curl --silent --output /tmp/choeae-${route}.json --write-out '%{http_code}' "$base/api/${route}?name=%EC%9E%84%EC%98%81%EC%9B%85")"
  [[ "$status" == 503 ]]
  grep -q '"ok":false' "/tmp/choeae-${route}.json"
done

status="$(curl --silent --dump-header /tmp/choeae-unknown-headers --output /dev/null --write-out '%{http_code}' "$base/singer/no-such-singer")"
[[ "$status" == 404 ]]
grep -qi '^x-robots-tag: noindex, nofollow' /tmp/choeae-unknown-headers
grep -qi '^x-content-type-options: nosniff' /tmp/choeae-unknown-headers
echo "Pages runtime smoke passed: home, no-secret API fallbacks, noindex 404, security headers"
node scripts/shortform-smoke.mjs "$base"
node scripts/browser-smoke.mjs "$base"
node scripts/music-hub-smoke.mjs "$base"
node scripts/support-smoke.mjs "$base"
node scripts/news-smoke.mjs "$base"
node scripts/blog-detail-smoke.mjs "$base"
