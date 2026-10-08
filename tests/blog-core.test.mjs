import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {safeBlogURL,plainBlogText,blogDate,normalizeBlogResults,createBlogSearch} from '../public/blog-core.js';
import {blogCards,prepareBlogReading} from '../public/artist-blogs.js';
import {COPY,ownedParamText} from '../public/locale-copy.js';
const item=(title='BTS 공연 기록',link='https://blog.naver.com/fan/1')=>({title,link,description:'제공처의 짧은 검색 미리보기',bloggername:'팬',postdate:'20261009'});
const response=(items=[],sort='date')=>({ok:true,status:200,json:async()=>({ok:true,sort,items})});
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(transport){const timers=new Map();let id=0;return {timers,search:createBlogSearch(transport,{setTimer(fn,ms){assert.equal(ms,8000);timers.set(++id,fn);return id;},clearTimer:n=>timers.delete(n)}),expire(){for(const fn of [...timers.values()])fn();}};}
test('blog source URLs preserve documented Naver HTTP redirects and external HTTPS, not private or executable URLs',()=>{
  for(const url of ['http://openapi.naver.com/l?x=1','http://blog.naver.com/fan/1','https://fan.tistory.com/42'])assert.equal(safeBlogURL(url),url);
  for(const url of ['javascript:alert(1)','http://external.example.test/1','https://user:pass@blog.naver.com/a','https://127.0.0.1/a','https://private.internal/a','https://[::1]/a','https://openapi.naver.com/not-l','https://foo.local/a'])assert.equal(safeBlogURL(url),'');
});
test('blog formatting is text only, calendar dates are validated and API order is preserved',()=>{
  assert.equal(plainBlogText(' <b>BTS</b> &amp; &#x1f49a; <img src=x> '),'BTS & 💚');
  assert.equal(blogDate('20260229'),'');assert.equal(blogDate('20240229'),'2024-02-29');
  const data=normalizeBlogResults({ok:true,sort:'date',items:[{...item('first'),postdate:'20200101'},item('second')]},'date');
  assert.equal(data.items[0].title,'first','Do not re-rank Naver search output');
  const card=blogCards(normalizeBlogResults({ok:true,sort:'date',items:[item('&lt;img src=x onerror=alert(1)&gt;')]},'date'),'ko');
  assert.match(card,/&lt;img/);assert.doesNotMatch(card,/<img|data-act="save|data-url=/);
});
test('blog schema errors are not empty success, valid empty stays empty and unsafe rows are disclosed',()=>{
  for(const data of [null,{},Object.create({ok:true,sort:'date',items:[]}),{ok:false,sort:'date',items:[]},{ok:true,sort:'sim',items:[]},{ok:true,sort:'date',items:[item('', 'javascript:alert(1)')]}])assert.throws(()=>normalizeBlogResults(data,'date'));
  assert.equal(normalizeBlogResults({ok:true,sort:'date',items:[]},'date').items.length,0);
  const data=normalizeBlogResults({ok:true,sort:'date',items:[item(),item('bad','javascript:alert(1)')]},'date');assert.equal(data.partial,true);assert.equal(data.items.length,1);
});
test('blog loads distinguish missing setup, provider failure, malformed response and empty results',async()=>{
  for(const [transport,expected] of [[()=>({ok:false,status:503,json:async()=>({error:'NAVER_SEARCH_NOT_CONFIGURED'})}),['error','not-configured']],[()=>({ok:false,status:502}),['error','unavailable']],[()=>({ok:true,json:async()=>({})}),['error','unavailable']],[()=>response([]),['ready',undefined]]]){
    const f=fixture(transport),result=await f.search.load('BTS');assert.equal(result.status,expected[0]);assert.equal(result.reason,expected[1]);assert.equal(f.timers.size,0);
  }
});
test('blog deadlines cover stalled response bodies and never turn late success into ready',async()=>{
  let release;const f=fixture(()=>({ok:true,json:()=>new Promise(resolve=>release=resolve)}));const job=f.search.load('BTS');await tick();f.expire();const result=await job;assert.equal(result.reason,'timeout');assert.equal(f.timers.size,0);release({ok:true,sort:'date',items:[item()]});await tick();assert.equal(result.status,'error');
});
test('blog cancellation and coalescing isolate each query without persisting results from earlier queries',async()=>{
  const releases=[],calls=[];const f=fixture((url,options)=>{calls.push({url,signal:options.signal});return new Promise(resolve=>releases.push(resolve));});
  const old=f.search.load('BTS');assert.equal(f.search.load('BTS'),old);await tick();const current=f.search.load('에스파','sim');await tick();assert.equal(calls[0].signal.aborted,true);
  releases[1](response([item('에스파')],'sim'));assert.equal((await current).data.items[0].title,'에스파');assert.equal((await old).status,'cancelled');
  releases[0](response([item('stale BTS')]));await tick();assert.equal(f.timers.size,0);
  assert.equal(typeof f.search.cached,'undefined');
});
test('inline blogs are gated to a server-rendered ad-free view and do not save API output',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),ui=await readFile(new URL('../public/artist-blogs.js',import.meta.url),'utf8'),core=await readFile(new URL('../public/blog-core.js',import.meta.url),'utf8');
  assert.match(html,/dataset\.blogEnabled==='true' \?/);assert.match(html,/\/discover\?singer=/);assert.match(html,/\/blogs\.html\?name=/);
  assert.match(ui,/googlesyndication\.com/);assert.match(ui,/24\*60\*60\*1000/);assert.match(ui,/state=\{status:'loading'\}/);assert.doesNotMatch(ui+core,/localStorage|indexedDB|save-article|st_drive_data/);
  for(const [key,values] of Object.entries(COPY).filter(([key])=>key.startsWith('blog'))){assert.equal(values.length,6,key);for(const lang of ['ko','zh','ja','en','es','fr'])assert.equal(typeof ownedParamText(key,lang,{count:8}),'string');}
});

test('classic mobile shortcuts wrap translated large-type labels without panning the reading pane',async()=>{
  const css=await readFile(new URL('../public/music-hub.css',import.meta.url),'utf8');
  assert.match(css,/html\[data-experience="classic"\] #singerBox \.detail-nav\{position:static;display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);margin:0 0 \.9rem;padding:\.65rem 0;min-width:0\}/);
  assert.match(css,/html\[data-experience="classic"\] #singerBox \.detail-nav button\{min-width:0;min-height:44px;white-space:normal;overflow-wrap:anywhere\}/);
});

test('blog reading closes the visible provider player and fails closed if it stays visible',()=>{
  const player={hidden:false},doc={getElementById:id=>id==='playerBar'?player:null};let calls=0;
  assert.equal(prepareBlogReading(doc,()=>{calls++;player.hidden=true;}),true);assert.equal(calls,1);
  assert.equal(prepareBlogReading(doc,()=>{throw Error('must not stop twice');}),true);
  player.hidden=false;assert.equal(prepareBlogReading(doc,()=>{}),false);
  assert.equal(prepareBlogReading(doc,()=>{throw Error('provider failure');}),false);
  assert.equal(prepareBlogReading(doc,undefined),false);assert.equal(prepareBlogReading({getElementById:()=>null}),true);
});

test('classic narrow video and music rows reflow their save buttons without reducing selected type',async()=>{
  const css=await readFile(new URL('../public/music-hub.css',import.meta.url),'utf8'),html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(css,/html\[data-experience="classic"\] #singerBox :is\(\.vid,\.md-song-row\)\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/:is\(\.vid,\.md-song-row\)>\.save-label\{justify-self:end;min-width:44px;min-height:44px;max-width:100%;white-space:normal;overflow-wrap:anywhere\}/);
  assert.doesNotMatch(html,/<div class="md-song-row" style=/);
  assert.match(css,/#singerBox :is\(\.md-name,\.md-cat\)\{white-space:normal;overflow-wrap:anywhere\}/);
  assert.match(css,/#singerBox \.md-detail-links\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/html\[data-experience="classic"\] #singerBox \.vid-main>span\{min-width:0;overflow-wrap:anywhere\}/);
});

test('the player guard runs before the search and its explanation is present in all six owned languages',async()=>{
  const ui=await readFile(new URL('../public/artist-blogs.js',import.meta.url),'utf8'),html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.ok(ui.indexOf('prepareBlogReading(document,window.closePlayer)')<ui.indexOf('await search.load('));
  assert.match(html,/data-i18n="blogPlaybackNote"/);
  assert.equal(COPY.blogPlaybackNote.length,6);assert.equal(COPY.blogPlaybackConflict.length,6);
});
