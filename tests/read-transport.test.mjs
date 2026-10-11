import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readTransportVM as vm} from './read-transport-fixture.mjs';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0];
function fixture(fetch){
  let deadline,clears=0;const calls=[];
  const c={fetch:(url,options)=>{calls.push({url,options});return fetch(url,options);},
    setTimeout(callback,ms){assert.equal(ms,8000);deadline=callback;return 1;},clearTimeout(){clears++;}};
  vm.runInNewContext('',c);return {c,calls,expire:()=>deadline(),clears:()=>clears};
}
test('read transport times out even when fetch ignores abort and never automatically repeats',async()=>{
  const f=fixture(()=>new Promise(()=>{}));const job=f.c.fetchJsonRead('/read');
  const result=assert.rejects(job,{code:'READ_TIMEOUT'});f.expire();await result;
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.method,'GET');assert.equal(f.calls[0].options.signal.aborted,true);assert.equal(f.clears(),1);
});
test('body parsing shares the deadline and late responses cannot settle timed-out reads',async()=>{
  let resolve;const f=fixture(async()=>({ok:true,json:()=>new Promise(r=>resolve=r)}));
  const job=f.c.fetchJsonRead('/read');await new Promise(setImmediate);
  const result=assert.rejects(job,{code:'READ_TIMEOUT'});f.expire();await result;resolve({data:'late'});assert.equal(f.clears(),1);
});
test('HTTP status is preserved, HTML and invalid JSON fail, success clears its timer',async()=>{
  for(const response of [{ok:false,status:401},{ok:false,status:503},{ok:true,headers:{get:()=> 'text/html'},json:async()=>({})},{ok:true,json:async()=>{throw Error('invalid json');}}]){
    const f=fixture(async()=>response);await assert.rejects(f.c.fetchJsonRead('/read'),error=>!response.status||error.status===response.status);assert.equal(f.clears(),1);
  }
  const f=fixture(async()=>({ok:true,json:async()=>({ok:true})}));assert.equal((await f.c.fetchJsonRead('/read',{credentials:'include'})).ok,true);assert.equal(f.calls[0].options.credentials,'include');assert.equal(f.clears(),1);
});
test('all four UI read requests exit loading on deadline and provide explicit retry',async()=>{
  for(const [name,args,target,retry] of [['loadPopularVideos',['BTS'],'popularVideoList','retry-popular-videos'],['loadYTComments',['BTS'],'ytCmList','retry-yt-comments'],['loadComments',['BTS'],'cmList','retry-fan-comments']]){
    const f=fixture(()=>new Promise(()=>{}));const element={innerHTML:''};Object.assign(f.c,{openSinger:'BTS',ytCommentRequest:0,playerVideos:{BTS:[{videoId:'aaaaaaaaaaa'}]},API:'https://example.test',videoFeedStatus:'ready',$:id=>id===target?element:null,ytSearch:()=> 'https://www.youtube.com/results'});
    vm.runInNewContext(fn(name),f.c);const job=f.c[name](...args);f.expire();await job;assert.match(element.innerHTML,/불러오지 못/);assert.ok(element.innerHTML.includes(retry));assert.equal(f.calls.length,1);
  }
  const f=fixture(()=>new Promise(()=>{})),body={notice:'',insertAdjacentHTML(_position,text){this.notice+=text;}};
  const stored={favorites:['BTS']};Object.assign(f.c,{driveUser:'member@example.test',driveReadUser:'',pendingDriveLogin:false,driveData:stored,renderDrive(){},$:()=>body,toast(){}});
  vm.runInNewContext(fn('loadDrive'),f.c);const job=f.c.loadDrive();f.expire();await job;
  assert.match(body.notice,/drive-retry/);assert.equal(f.c.driveData,stored);assert.equal(f.c.driveUser,'member@example.test');assert.equal(f.calls.length,1);
});
test('a late same-artist fan comment response cannot overwrite a newer read',async()=>{
  const pending=[],element={innerHTML:''};const c={fetch:()=>new Promise(r=>pending.push(r)),openSinger:'BTS',API:'https://example.test',$:()=>element,esc:String,fmtDate:()=>''};
  vm.runInNewContext(fn('loadComments'),c);const old=c.loadComments('BTS'),latest=c.loadComments('BTS');
  pending[1]({ok:true,json:async()=>({comments:[{name:'new',text:'new'}]})});await latest;
  pending[0]({ok:true,json:async()=>({comments:[{name:'old',text:'old'}]})});await old;assert.match(element.innerHTML,/new/);assert.doesNotMatch(element.innerHTML,/old/);
});
test('503 preserves the public missing-key guidance without rendering provider error text',async()=>{
  const element={innerHTML:''};const c={fetch:async()=>({ok:false,status:503,json:async()=>({error:'YOUTUBE_API_NOT_CONFIGURED',detail:'secret provider detail'})}),openSinger:'BTS',$:()=>element,ytSearch:()=> 'https://www.youtube.com/results'};
  vm.runInNewContext(fn('loadPopularVideos'),c);await c.loadPopularVideos('BTS');
  assert.match(element.innerHTML,/API 키 설정 후/);assert.doesNotMatch(element.innerHTML,/secret provider detail/);
});
