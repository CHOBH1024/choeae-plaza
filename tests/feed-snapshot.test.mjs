import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const names=['sanitizeVideoFeed','validateVideoFeed','readVideoSnapshot','saveVideoSnapshot','restoreVideoSnapshot','readVideoFeed','loadVideos'];
const source=names.map(name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0]).join('\n');
const now=Date.now(),artists={BTS:[{videoId:'AbCdEf12345',title:'last good',kind:'live',privateField:'not retained'}]};
function fixture(snapshot){
  let raw=JSON.stringify(snapshot),writes=0;
  const c={ARTISTS:[{name:'BTS'}],KIND_LABEL:{live:'live'},playerVideos:{},videoFeedUpdatedAt:0,
    API:'https://api.test/singer',videoFeedJob:null,openSinger:null,AbortController,setTimeout,clearTimeout,renderSingers(){},renderCollage(){},
    localStorage:{getItem:key=>{assert.equal(key,'choeae.video-feed.v1');return raw;},setItem(key,value){assert.equal(key,'choeae.video-feed.v1');raw=value;writes++;}}};
  vm.runInNewContext(source,c);
  return {c,raw:()=>raw,writes:()=>writes,setRaw:value=>raw=value};
}
test('last normal feed is restored before network work, sanitized and retains its original receipt time',()=>{
  const f=fixture({version:1,receivedAt:now-60000,artists});
  assert.equal(f.c.restoreVideoSnapshot(),true);
  assert.equal(f.c.playerVideos.BTS[0].title,'last good');
  assert.equal(f.c.videoFeedUpdatedAt,now-60000);
  assert.equal(f.c.playerVideos.BTS[0].privateField,undefined);
  assert.equal(f.writes(),0);
  assert.match(html,/restoreVideoSnapshot\(\);\r?\nrenderSingers\(\);/);
});
test('expired, future, malformed, oversized or incompatible snapshots never become visible',()=>{
  for(const snapshot of [null,{version:2,receivedAt:now,artists},{version:1,receivedAt:now+60000,artists},
    {version:1,receivedAt:now-86400001,artists},{version:1,receivedAt:'today',artists},
    {version:1,receivedAt:now,artists:{unknown:[]}},{version:1,receivedAt:now,artists:{BTS:[{videoId:'<script>'}]}}]){
    const f=fixture(snapshot);assert.equal(f.c.restoreVideoSnapshot(),false);assert.equal(f.c.videoFeedUpdatedAt,0);
  }
  for(const raw of ['{','x'.repeat(524289)]){const f=fixture(null);f.setRaw(raw);assert.equal(f.c.restoreVideoSnapshot(),false);}
});
test('successful snapshots store public sanitized metadata only; valid empty updates replace old lists',()=>{
  const f=fixture(null);assert.equal(f.c.saveVideoSnapshot(artists,now),true);
  const saved=JSON.parse(f.raw());assert.equal(saved.version,1);assert.equal(saved.receivedAt,now);
  assert.equal(saved.artists.BTS[0].privateField,undefined);
  assert.equal(f.c.saveVideoSnapshot({},now),true);assert.deepEqual(JSON.parse(f.raw()).artists,{});
  assert.equal(f.c.restoreVideoSnapshot(),true);assert.equal(Object.keys(f.c.playerVideos).length,0);
});
test('storage read/write denial never prevents using the site or erases current in-memory content',()=>{
  const f=fixture(null);f.c.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
  f.c.playerVideos=artists;
  assert.equal(f.c.restoreVideoSnapshot(),false);assert.equal(f.c.saveVideoSnapshot(artists,now),false);
  assert.equal(f.c.playerVideos.BTS[0].title,'last good');
});
test('a failed refresh keeps the snapshot timestamp and items; a later successful empty response replaces both',async()=>{
  const f=fixture({version:1,receivedAt:now-60000,artists});f.c.restoreVideoSnapshot();
  const original=f.raw();f.c.fetch=async()=>({ok:false,status:503});
  await f.c.loadVideos();assert.equal(f.c.videoFeedStatus,'error');assert.equal(f.raw(),original);
  assert.equal(f.c.videoFeedUpdatedAt,now-60000);assert.equal(f.c.playerVideos.BTS[0].title,'last good');
  f.c.fetch=async()=>({ok:true,json:async()=>({artists:{}})});
  await f.c.loadVideos();assert.equal(f.c.videoFeedStatus,'ready');assert.equal(f.writes(),1);
  assert.deepEqual(JSON.parse(f.raw()).artists,{});assert.ok(f.c.videoFeedUpdatedAt>now-60000);
});
