import test from 'node:test';
import assert from 'node:assert/strict';
let sequence=0;
const fresh=async()=> (await import('../functions/api/showcase.js?case='+sequence++)).onRequestGet;
const request=(kind='campaign',name='BTS')=>new Request('https://example.test/api/showcase?name='+encodeURIComponent(name)+'&kind='+kind+'&junk=ignored');
test('campaign and editorial API allow only catalog artists and fixed newest-first queries',async()=>{
  const original=globalThis.fetch,cache=globalThis.caches;const seen=[];globalThis.caches=undefined;
  globalThis.fetch=async(url,options)=>{seen.push({url:new URL(url),options});return Response.json({items:[{id:{videoId:'aaaaaaaaaaa'},snippet:{title:'CF &amp; 촬영',channelTitle:'brand',publishedAt:'2026-10-08T00:00:00Z'}}]});};
  try{
    const run=await fresh();assert.equal((await run({request:request('campaign','unknown'),env:{}})).status,400);
    assert.equal((await run({request:request('__proto__'),env:{}})).status,400);assert.equal((await run({request:request(),env:{}})).status,503);
    for(const [kind,query] of [['campaign','BTS 광고 CF'],['editorial','BTS 화보 메이킹']]){
      const response=await run({request:request(kind),env:{YOUTUBE_API_KEY:'private-key'}}),data=await response.json();
      assert.equal(response.status,200);assert.equal(data.scope,'artist-'+kind+'-search');assert.equal(data.items[0].title,'CF & 촬영');assert.equal(data.items[0].kind,'other');assert.doesNotMatch(JSON.stringify(data),/private-key|official/);
      const sent=seen.at(-1);assert.equal(sent.url.searchParams.get('q'),query);assert.equal(sent.url.searchParams.get('maxResults'),'8');assert.equal(sent.url.searchParams.get('order'),'date');assert.equal(sent.options.redirect,'manual');
    }
  }finally{globalThis.fetch=original;globalThis.caches=cache;}
});
test('campaign/editorial cache keys, in-flight jobs and failure cooldowns are kind-isolated',async()=>{
  const original=globalThis.fetch,cache=globalThis.caches;const keys=[],pending=[];
  globalThis.caches={default:{match:async key=>{keys.push(key.url);},put:async()=>{}}};
  globalThis.fetch=()=>new Promise(resolve=>pending.push(resolve));
  try{
    const run=await fresh(),env={YOUTUBE_API_KEY:'private-key'};
    const a=run({request:request('campaign'),env}),b=run({request:request('campaign'),env}),c=run({request:request('editorial'),env});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.length,2);
    pending[0](Response.json({error:{errors:[{reason:'quotaExceeded'}]}},{status:403}));pending[1](Response.json({items:[]}));
    assert.equal((await a).status,502);assert.equal((await b).status,502);assert.equal((await c).status,200);
    assert.equal((await run({request:request('campaign'),env})).status,502);assert.equal(pending.length,2);
    assert.ok(keys.every(url=>!url.includes('junk')));assert.ok(keys.some(url=>url.endsWith('kind=editorial')));
  }finally{globalThis.fetch=original;globalThis.caches=cache;}
});
