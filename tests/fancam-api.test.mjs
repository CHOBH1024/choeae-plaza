import test from 'node:test';
import assert from 'node:assert/strict';
let sequence=0;
const fresh=async()=> (await import('../functions/api/fancams.js?case='+sequence++)).onRequestGet;
const request=name=>new Request('https://example.test/api/fancams?name='+encodeURIComponent(name)+'&junk=ignored');
test('automatic fancam search is allowlisted, bounded, latest-first and does not expose the key',async()=>{
  const original=globalThis.fetch;const run=await fresh();let seen;
  globalThis.fetch=async(url,opts)=>{seen={url:new URL(url),opts};return Response.json({items:[{id:{videoId:'aaaaaaaaaaa'},snippet:{title:'직캠',channelTitle:'channel',publishedAt:'2026-10-01T00:00:00Z'}},{id:{videoId:'aaaaaaaaaaa'},snippet:{title:'duplicate',publishedAt:'2026-10-01T00:00:00Z'}},{id:{videoId:'javascript:evil'},snippet:{title:'invalid',publishedAt:'2026-10-01T00:00:00Z'}}]});};
  try {
    assert.equal((await run({request:request('unknown'),env:{}})).status,400);
    assert.equal((await run({request:request('BTS'),env:{}})).status,503);
    const r=await run({request:request('BTS'),env:{YOUTUBE_API_KEY:'private-key'}});const d=await r.json();
    assert.equal(r.status,200);assert.equal(d.items.length,1);assert.equal(d.items[0].videoId,'aaaaaaaaaaa');
    assert.equal(seen.url.hostname,'www.googleapis.com');assert.equal(seen.url.searchParams.get('q'),'BTS 직캠');
    assert.equal(seen.url.searchParams.get('type'),'video');assert.equal(seen.url.searchParams.get('order'),'date');assert.equal(seen.url.searchParams.get('videoEmbeddable'),'true');
    assert.equal(seen.url.searchParams.get('maxResults'),'8');assert.equal(seen.opts.redirect,'error');
    assert.equal(d.refreshSeconds,900);assert.doesNotMatch(JSON.stringify(d),/private-key/);
  } finally {globalThis.fetch=original;}
});
test('search cache canonicalizes query parameters and failure cooldown avoids immediate repeated quota calls',async()=>{
  const original=globalThis.fetch,originalCache=globalThis.caches;let key,calls=0;
  globalThis.caches={default:{match:async req=>{key=req.url;return Response.json({ok:true,items:[],cached:true});}}};
  globalThis.fetch=async()=>{calls++;return Response.json({error:{message:'private'}},{status:403});};
  try {
    const cached=await (await fresh())({request:request('BTS'),env:{YOUTUBE_API_KEY:'key'}});
    assert.equal((await cached.json()).cached,true);assert.equal(calls,0);assert.equal(key,'https://example.test/api/fancams?name=BTS');
    globalThis.caches=undefined;const run=await fresh();
    for(let i=0;i<2;i++) {const r=await run({request:request('BTS'),env:{YOUTUBE_API_KEY:'key'}});assert.equal(r.status,502);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(await r.json(),{ok:false,error:'YOUTUBE_SEARCH_UNAVAILABLE'});}
    assert.equal(calls,1);
  } finally {globalThis.fetch=original;globalThis.caches=originalCache;}
});
test('concurrent same-artist searches share one upstream call and malformed responses fail closed',async()=>{
  const original=globalThis.fetch;let resolve,calls=0;const run=await fresh();
  globalThis.fetch=()=>{calls++;return new Promise(r=>resolve=r);};
  try {
    const first=run({request:request('BTS'),env:{YOUTUBE_API_KEY:'key'}}),second=run({request:request('BTS'),env:{YOUTUBE_API_KEY:'key'}});
    resolve(Response.json({items:[]}));assert.equal((await first).status,200);assert.equal((await second).status,200);assert.equal(calls,1);
    for(const payload of [null,{}, {items:{}}, {items:[{id:{videoId:'invalid'}}]}]) {
      globalThis.fetch=async()=>Response.json(payload);const r=await (await fresh())({request:request('BTS'),env:{YOUTUBE_API_KEY:'key'}});assert.equal(r.status,502);
    }
  } finally {globalThis.fetch=original;}
});

test('known quota and key configuration failures expose only safe reason codes and survive cooldown',async()=>{
  const original=globalThis.fetch;
  try {
    for(const [reason,expected] of [['quotaExceeded','YOUTUBE_SEARCH_QUOTA'],['keyInvalid','YOUTUBE_SEARCH_CONFIGURATION'],['forbidden','YOUTUBE_SEARCH_UNAVAILABLE']]) {
      let calls=0;const run=await fresh();
      globalThis.fetch=async()=>{calls++;return Response.json({error:{message:'private key or diagnostics',errors:[{reason}]}},{status:403});};
      for(let i=0;i<2;i++) {const r=await run({request:request('BTS'),env:{YOUTUBE_API_KEY:'private-key'}});assert.equal(r.status,502);assert.deepEqual(await r.json(),{ok:false,error:expected});}
      assert.equal(calls,1);
    }
  } finally {globalThis.fetch=original;}
});
