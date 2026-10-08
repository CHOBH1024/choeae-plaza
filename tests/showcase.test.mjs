import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeShowcaseResponse,createShowcaseSearch} from '../public/showcase-core.js';
import {showcaseCards} from '../public/showcase-ui.js';
const fixture=(kind='campaign',time='2026-10-08T01:00:00Z')=>({ok:true,source:'youtube-search',scope:'artist-'+kind+'-search',order:'date',refreshSeconds:900,generatedAt:time,items:[{videoId:'aaaaaaaaaaa',title:'BTS <script> & "CF"',channelTitle:'Brand <img>',published:time}]});
test('campaign/editorial metadata validates scope, IDs and dates without official-content claims',()=>{
  const data=fixture();data.items.push({...data.items[0]},{videoId:'javascript:1',title:'bad',published:data.generatedAt});
  const normalized=normalizeShowcaseResponse(data,'campaign');assert.equal(normalized.items.length,1);assert.ok(Object.isFrozen(normalized.items));
  for(const change of [{scope:'official'},{order:'rating'},{generatedAt:'bad'},{refreshSeconds:0},{items:[{videoId:'bad'}]}])assert.throws(()=>normalizeShowcaseResponse({...fixture(),...change},'campaign'));
  assert.throws(()=>normalizeShowcaseResponse(fixture(),'editorial'));
  const html=showcaseCards(normalized.items,'en');assert.match(html,/&lt;script&gt;/);assert.match(html,/Brand &lt;img&gt;/);assert.match(html,/data-act="play-video"/);assert.match(html,/data-act="save-video"/);assert.match(html,/noopener noreferrer/);assert.doesNotMatch(html,/<script>|<img>/);
});
test('public search caches each kind separately and never extends provider cache age',async()=>{
  let time=Date.parse('2026-10-08T01:05:00Z'),calls=[];
  const service=createShowcaseSearch(async(url,opts)=>{calls.push(url);assert.equal(opts.credentials,'omit');return Response.json(fixture(url.endsWith('editorial')?'editorial':'campaign'));},()=>time);
  assert.equal((await service.load('BTS','campaign')).status,'ready');await service.load('BTS','campaign');assert.equal(calls.length,1);
  await service.load('BTS','editorial');assert.equal(calls.length,2);
  time+=600001;await service.load('BTS','campaign');assert.equal(calls.length,3);
  assert.equal((await service.load('BTS','__proto__')).status,'error');assert.equal(calls.length,3);
});
test('late artist/kind responses and cancelled requests cannot replace the active view',async()=>{
  const pending=[];const service=createShowcaseSearch((url,opts)=>new Promise(resolve=>pending.push({url,opts,resolve})),()=>Date.parse('2026-10-08T01:01:00Z'));
  const first=service.load('BTS','campaign'),second=service.load('아이브','editorial');
  assert.equal(pending[0].opts.signal.aborted,true);pending[1].resolve(Response.json(fixture('editorial')));assert.equal((await second).status,'ready');
  pending[0].resolve(Response.json(fixture()));assert.equal((await first).status,'cancelled');
  const third=service.load('BTS','campaign');service.cancel();pending[2].resolve(Response.json(fixture()));assert.equal((await third).status,'cancelled');
});
test('failed refresh retains previously validated results but does not report fresh success',async()=>{
  let time=Date.parse('2026-10-08T01:01:00Z'),fail=false;
  const service=createShowcaseSearch(async()=>{if(fail)throw Error('private diagnostics');return Response.json(fixture());},()=>time);
  const initial=await service.load('BTS','campaign');time+=900001;fail=true;
  const result=await service.load('BTS','campaign');assert.equal(result.status,'error');assert.equal(result.data,initial.data);assert.doesNotMatch(JSON.stringify(result),/private/);
});
