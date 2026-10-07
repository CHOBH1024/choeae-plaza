import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/_middleware.js";

test("adds browser security headers to site responses", async () => {
  const response = await onRequest({
    request: new Request("https://choeae-plaza.pomyjo.com/"),
    next: async () => new Response("ok", { headers: { "Content-Type": "text/html" } })
  });
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(response.headers.get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()");
  assert.equal(await response.text(), "ok");
});

test("preserves the legacy-domain redirect behavior", async () => {
  let nextCalled = false;
  const response = await onRequest({
    request: new Request("https://singer-tube.pomyjo.com/path?q=1"),
    next: async () => { nextCalled = true; return new Response("unexpected"); }
  });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("Location"), "https://choeae-plaza.pomyjo.com/path?q=1");
  assert.equal(nextCalled, false);
});
