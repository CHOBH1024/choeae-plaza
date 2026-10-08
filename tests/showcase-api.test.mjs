import test from 'node:test';
import assert from 'node:assert/strict';
let sequence=0;
const fresh=async()=> (await import('../functions/api/showcase.js?case='+sequence++)).onRequestGet;
const request=(kind='campaign',name='BTS')=>new Request('https://example.test/api/showcase?name='+encodeURIComponent(name)+'&kind='+kind+'&junk=ignored');
test('campaign and editorial API allow only catalog artists and fixed newest-first queries',async()=>{
  const original=globalThis.fetch,cache=globalThis.caches;const seen=[];globalThis.caches=undefined;
  globalThis.fetch=async(url,options)=>{seen.push({url:new URL(url),options});return Response.json({items:[{id:{videoId:'aaaaaaaaaaa'},snippet:{title:'방탄소년단 CF &amp; 촬영',channelTitle:'brand',publishedAt:'2026-10-08T00:00:00Z'}}]});};
  try{
    const run=await fresh();assert.equal((await run({request:request('campaign','unknown'),env:{}})).status,400);
    assert.equal((await run({request:request('__proto__'),env:{}})).status,400);assert.equal((await run({request:request(),env:{}})).status,503);
    for(const [kind,query] of [['campaign','방탄소년단 광고 CF'],['editorial','방탄소년단 화보 메이킹']]){
      const response=await run({request:request(kind),env:{YOUTUBE_API_KEY:'private-key'}}),data=await response.json();
      assert.equal(response.status,200);assert.equal(data.scope,'artist-'+kind+'-search');assert.equal(data.items[0].title,'방탄소년단 CF & 촬영');assert.equal(data.items[0].kind,'other');assert.equal(data.selection,'artist-name-v2');assert.doesNotMatch(JSON.stringify(data),/private-key|official/);
      const sent=seen.at(-1);assert.equal(sent.url.searchParams.get('q'),query);assert.equal(sent.url.searchParams.get('maxResults'),'24');assert.equal(sent.url.searchParams.get('order'),'date');assert.equal(sent.options.redirect,'manual');
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
    assert.ok(keys.every(url=>!url.includes('junk')));assert.ok(keys.some(url=>new URL(url).searchParams.get('kind')==='editorial'));
    assert.ok(keys.every(url=>new URL(url).searchParams.get('selection')==='artist-name-v2'),'old unfiltered caches are not reused');
  }finally{globalThis.fetch=original;globalThis.caches=cache;}
});

test('valid unrelated results become a successful empty shelf, not provider errors',async()=>{
  const original=globalThis.fetch,cache=globalThis.caches;globalThis.caches=undefined;
  try{
    globalThis.fetch=async()=>Response.json({items:[{id:{videoId:'aaaaaaaaaaa'},snippet:{title:'Jung Haein Photoshoot BTS',publishedAt:'2026-10-08T00:00:00Z'}}]});
    const response=await (await fresh())({request:request('editorial'),env:{YOUTUBE_API_KEY:'private-key'}}),data=await response.json();
    assert.equal(response.status,200);assert.deepEqual(data.items,[]);assert.equal(data.filteredOut,1);
    globalThis.fetch=async()=>Response.json({items:[{id:{videoId:'invalid'}}]});
    assert.equal((await (await fresh())({request:request(),env:{YOUTUBE_API_KEY:'private-key'}})).status,502,'malformed provider data is still an error');
  }finally{globalThis.fetch=original;globalThis.caches=cache;}
});
test('one bounded provider call filters before taking eight and never publishes descriptions',async()=>{
  const original=globalThis.fetch,cache=globalThis.caches;globalThis.caches=undefined;let calls=0;
  const item=(i,title)=>({id:{videoId:String(i).padStart(11,'0')},snippet:{title:'방탄소년단 '+title,description:'private description not published',publishedAt:new Date(Date.UTC(2026,9,24-i)).toISOString()}});
  try{
    globalThis.fetch=async()=>{calls++;return Response.json({items:[{...item(0,'[ONEW] 화보 메이킹'),snippet:{...item(0,'[ONEW] 화보 메이킹').snippet,title:'[ONEW] 화보 메이킹',description:'unrelated'}},...Array.from({length:30},(_,i)=>item(i+1,'촬영 '+(i+1)))]});};
    const response=await (await fresh())({request:request('editorial'),env:{YOUTUBE_API_KEY:'private-key'}}),data=await response.json();
    assert.equal(calls,1);assert.equal(data.items.length,8);assert.equal(data.filteredOut,1);
    assert.deepEqual(data.items.map(v=>v.videoId),Array.from({length:8},(_,i)=>String(i+1).padStart(11,'0')));
    assert.doesNotMatch(JSON.stringify(data),/description|private description|ONEW/);
  }finally{globalThis.fetch=original;globalThis.caches=cache;}
});
