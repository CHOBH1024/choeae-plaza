import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/_middleware.js";
import { readFile } from 'node:fs/promises';

test('discover serves the real app without ads, with blog enablement, noindex and security headers',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');let forwarded;
  const r=await onRequest({request:new Request('https://example.test/discover?singer=BTS'),next:async request=>{forwarded=request;return new Response(html,{headers:{'Content-Type':'text/html'}});}});
  const output=await r.text();assert.equal(forwarded.url,'https://example.test/?singer=BTS');assert.equal(r.status,200);assert.match(output,/<html data-blog-enabled="true"/);assert.doesNotMatch(output,/googlesyndication\.com|adsbygoogle/);assert.match(html,/googlesyndication\.com/);assert.match(output,/id="singerBox"/);
  assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow');assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(r.headers.get('Cache-Control'),'no-cache');
});
test('discover fails closed on unrecognized advertising instead of rendering a mixed page',async()=>{
  const r=await onRequest({request:new Request('https://example.test/discover'),next:async()=>new Response('<html><script>adsbygoogle.push({})</script></html>')});assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/adsbygoogle/);
  const slash=await onRequest({request:new Request('https://example.test/discover/?view=classic'),next:()=>{throw Error('not reached');}});assert.equal(slash.headers.get('Location'),'https://example.test/discover?view=classic');
});

test('trot entry serves the shared HTML without changing the public URL or weakening headers',async()=>{
  for(const method of ['GET','HEAD']){
    let forwarded;
    const response=await onRequest({request:new Request('https://example.test/trot?singer=BTS',{method}),next:async request=>{forwarded=request;return new Response('app');}});
    assert.equal(forwarded.url,'https://example.test/?singer=BTS');assert.equal(forwarded.method,method);
    assert.equal(response.status,200);assert.equal(response.headers.get('X-Frame-Options'),'SAMEORIGIN');
  }
  for(const path of ['/api/locale','/trot/other','/','/singer/BTS']){
    let forwarded='not-called';await onRequest({request:new Request('https://example.test'+path),next:async request=>{forwarded=request;return new Response('ok');}});assert.equal(forwarded,undefined);
  }
  const canonical=await onRequest({request:new Request('https://example.test/trot/?singer=BTS'),next:()=>{throw new Error('not reached');}});
  assert.equal(canonical.status,308);assert.equal(canonical.headers.get('Location'),'https://example.test/trot?singer=BTS');
});

test("adds browser security headers to site responses", async () => {
  const response = await onRequest({
    request: new Request("https://choeae-plaza.pomyjo.com/"),
    next: async () => new Response("ok", { headers: { "Content-Type": "text/html" } })
  });
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(response.headers.get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()");
  assert.equal(response.headers.get("Strict-Transport-Security"), "max-age=31536000");
  assert.equal(response.headers.get('Cache-Control'),'no-cache');
  assert.equal(await response.text(), "ok");
});

test("does not send HSTS over plain HTTP", async () => {
  const response = await onRequest({
    request: new Request("http://localhost/"),
    next: async () => new Response("ok")
  });
  assert.equal(response.headers.get("Strict-Transport-Security"), null);
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
