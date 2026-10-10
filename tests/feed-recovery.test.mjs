import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0];
const ok=artists=>({ok:true,json:async()=>({artists})});
function fixture(responses){
  const calls=[];let timeout,timers=0,clears=0;
  const c={ARTISTS:[{name:'BTS'}],KIND_LABEL:{live:'live'},API:'https://api.test/singer',AbortController,
    videoFeedStatus:'idle',videoFeedJob:null,videoFeedError:'network',openSinger:null,
    playerVideos:{BTS:[{videoId:'AbCdEf12345',title:'cached'}]},renderCollage(){},renderSingers(){},
    setTimeout(fn,ms){assert.equal(ms,8000);timeout=fn;timers++;return 1;},clearTimeout(){clears++;},
    fetch(url,{signal}){calls.push({url,signal});const r=responses.shift();return typeof r==='function'?r(signal):Promise.resolve(r);}};
  vm.runInNewContext(['readVideoFeed','validateVideoFeed','sanitizeVideoFeed','feedFailureMarkup','loadVideos'].map(fn).join('\n'),c);
  return {c,calls,abort:()=>timeout(),counts:()=>({timers,clears})};
}
test('gateway recovery retries once within the same eight-second budget and signal',async()=>{
  for(const status of [502,504]){
    let released=0;
    const f=fixture([{ok:false,status,body:{cancel:async()=>{released++;}}},ok({BTS:[{videoId:'ZyXwVu98765',title:'new'}]})]);
    const job=f.c.loadVideos();assert.equal(f.c.loadVideos(),job);await job;
    assert.equal(f.c.videoFeedStatus,'ready');assert.equal(f.c.videoFeedError,'');assert.equal(f.calls.length,2);
    assert.equal(f.calls[0].url,f.calls[1].url);assert.equal(f.calls[0].signal,f.calls[1].signal);
    assert.equal(released,1);assert.deepEqual(f.counts(),{timers:1,clears:1});
    assert.equal(f.c.playerVideos.BTS[0].title,'new');
  }
});
test('rate limits, maintenance, authorization, retry-after and non-gateway errors do not retry',async()=>{
  for(const status of [401,403,429,500,503,502]){
    const f=fixture([{ok:false,status,headers:{get:()=>status===502?'120':null}}]);
    await f.c.loadVideos();assert.equal(f.calls.length,1);assert.equal(f.c.videoFeedError,'http');
    assert.equal(f.c.playerVideos.BTS[0].title,'cached');
  }
  const f=fixture([{ok:false,status:502},{ok:false,status:504}]);await f.c.loadVideos();
  assert.equal(f.calls.length,2);assert.equal(f.c.videoFeedError,'http');assert.equal(f.c.playerVideos.BTS[0].title,'cached');
});
test('invalid feeds cannot replace cached content; genuinely empty feeds remain valid',async()=>{
  for(const artists of [[],{unknown:[]},{BTS:{}},{BTS:[{videoId:'javascript:bad'}]}]){
    const f=fixture([ok(artists)]);await f.c.loadVideos();assert.equal(f.c.videoFeedError,'invalid');
    assert.equal(f.calls.length,1);assert.equal(f.c.playerVideos.BTS[0].title,'cached');
  }
  for(const artists of [{},{BTS:[]}]){
    const f=fixture([ok(artists)]);await f.c.loadVideos();assert.equal(f.c.videoFeedStatus,'ready');
  }
  const f=fixture([{ok:true,json:async()=>{throw Error('secret provider error');}}]);await f.c.loadVideos();
  assert.equal(f.c.videoFeedError,'invalid');assert.doesNotMatch(f.c.feedFailureMarkup(),/secret/);
});
test('network failures do not loop and timeout prevents a gateway retry after body release',async()=>{
  const f=fixture([()=>Promise.reject(Error('private error'))]);await f.c.loadVideos();
  assert.equal(f.calls.length,1);assert.equal(f.c.videoFeedError,'network');
  let release;const timed=fixture([{ok:false,status:502,body:{cancel:()=>new Promise(r=>release=r)}}]);
  const job=timed.c.loadVideos();await Promise.resolve();timed.abort();release();await job;
  assert.equal(timed.calls.length,1);assert.equal(timed.c.videoFeedError,'timeout');assert.equal(timed.c.videoFeedJob,null);
  timed.c.videoFeedError='<script>evil</script>';assert.equal(timed.c.feedFailureMarkup(),'');
});
