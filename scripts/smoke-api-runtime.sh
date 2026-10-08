#!/usr/bin/env bash
set -euo pipefail
base=http://127.0.0.1:8789
log="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/choeae-api-runtime.log"
setsid npx --yes wrangler@4.148.0 dev --config scripts/runtime-probe.wrangler.json --local --ip 127.0.0.1 --port 8789 >"$log" 2>&1 &
pid=$!
trap 'kill -- -"$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true' EXIT
ready=0
for _ in $(seq 1 30); do
  if curl --fail --silent "$base/fancams" -o /tmp/choeae-fancams-runtime.json; then ready=1; break; fi
  if ! kill -0 "$pid" 2>/dev/null; then cat "$log"; exit 1; fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then cat "$log"; exit 1; fi
grep -q '"videoId":"aaaaaaaaaaa"' /tmp/choeae-fancams-runtime.json
curl --fail --silent "$base/instagram" | grep -q '"ok":true'
for route in fancams instagram; do
  status="$(curl --silent --output /tmp/choeae-${route}-redirect.json --write-out '%{http_code}' "$base/${route}-redirect")"
  [[ "$status" == 502 ]]
  grep -q '"ok":false' "/tmp/choeae-${route}-redirect.json"
  ! grep -q 'fake-test-\|untrusted.invalid' "/tmp/choeae-${route}-redirect.json"
done
echo 'Actual workerd API transport options passed; success fixtures and fail-closed redirects, no external calls.'
