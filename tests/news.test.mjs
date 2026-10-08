import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {COPY,ownedParamText} from '../public/locale-copy.js';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0];
const source=html.slice(html.indexOf('function newsItemHTML('),html.indexOf('function loadSingerSNS('));
const response=(kind,items)=>({ok:true,json:async()=>({[kind==='sns'?'sns':'news']:items})});
const item=(name,source='news',date='2026-10-09')=>({title:name+' '+source,link:'https://news.example.test/'+encodeURIComponent(name)+'/'+source,date});
function fixture(handler=(url)=>{const u=new URL(url),source=u.pathname.split('/').pop(),name=u.searchParams.get('name');return response(source,[item(name,source)]);}){
  const nodes={},calls=[],timers=new Map();let n=0;
  const node=id=>nodes[id]??={hidden:id==='newsModal',attrs:{},textContent:'',innerHTML:'',value:'',disabled:false,setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]??null;},removeAttribute(k){delete this.attrs[k];}};
  const c={URL,AbortController,Date,Promise,state:{experience:'idol',newsWhich:'news',tab:'news'},ARTISTS:[...['BTS','에스파','아이유','아이브','블랙핑크','뉴진스'].map(name=>({name,cat:'아이돌'})),...['임영웅','영탁','이찬원','장민호','송가인','김호중'].map(name=>({name,cat:'트로트'}))],
    newsSelections:{idol:'',classic:''},newsScopes:Object.create(null),newsRenderedView:'',NEWS_ITEMS:[],SNS_ITEMS:[],API:'https://api.example.test/singer',ttsOn:false,newsSpeechRequest:0,window:{},
    $:node,artistGenreKey:a=>a.cat==='트로트'?'trot':'idol',esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),document:{querySelectorAll:()=>[]},
    fetch(url,options){calls.push({url,signal:options.signal});return Promise.resolve(handler(url,options));},
    setTimeout(cb,ms){assert.equal(ms,8000);timers.set(++n,cb);return n;},clearTimeout:id=>timers.delete(id),closeNewsModal(){node('newsModal').hidden=true;}};
  vm.runInNewContext([fn('safeExternalURL'),fn('playgroundText'),fn('stopNewsSpeech'),fn('toggleNewsTTS'),source].join('\n'),c);
  return{c,nodes,calls,node,expire(){for(const cb of [...timers.values()])cb();},pending:()=>timers.size};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('news overview requests only the current view first five; selector exposes the full view catalog',async()=>{
  const f=fixture();f.c.renderNewsForView();await f.c.currentNewsScope().job;
  const names=f.calls.map(x=>new URL(x.url).searchParams.get('name'));assert.equal(f.calls.length,10);assert.equal(new Set(names).size,5);assert.ok(names.every(x=>!['임영웅','뉴진스'].includes(x)));
  assert.match(f.nodes.newsArtist.innerHTML,/뉴진스/);assert.doesNotMatch(f.nodes.newsArtist.innerHTML,/임영웅/);assert.equal(f.nodes.newsStatus.attrs['data-i18n'],'newsReady');
  assert.ok(f.c.NEWS_ITEMS.every(x=>f.c.newsCatalog('idol').some(a=>a.name===x.singer)));assert.equal(f.pending(),0);
});
test('schemas, unsafe links, inherited arrays and false artist identities never become empty success',()=>{
  const f=fixture(),valid=item('BTS');
  for(const data of [{},null,{ok:false,news:[]},{news:{}},{news:Array(201).fill(valid)},Object.create({news:[]}),{news:[{...valid,link:'https://127.0.0.1/private'}]},{news:[{...valid,singer:'임영웅'}]}])assert.throws(()=>f.c.normalizeNewsRows(data,'news','BTS'));
  const mixed=f.c.normalizeNewsRows({news:[valid,{...valid,title:''}]} ,'news','BTS');assert.equal(mixed.partial,true);assert.equal(mixed.items.length,1);
  const unsafeTitle=f.c.normalizeNewsRows({news:[{...valid,title:'<img src=x onerror=alert(1)>'}]} ,'news','BTS').items[0];assert.match(f.c.newsItemHTML(unsafeTitle,'BTS','news',0),/&lt;img/);
  const merged=f.c.mergeNewsRows(Array.from({length:40},(_,i)=>({...valid,link:valid.link+'/'+i,date:new Date(2026,8,i+1).toISOString()})));assert.equal(merged.length,24);assert.ok(Date.parse(merged[0].date)>Date.parse(merged[23].date));
});
test('artist choices and topic requests are independent across idol and trot',async()=>{
  const f=fixture();f.c.chooseNewsArtist('에스파');await f.c.currentNewsScope().job;f.c.setNewsTab('sns');await f.c.currentNewsScope().job;
  assert.ok(f.c.SNS_ITEMS.every(x=>x.singer==='에스파'));assert.equal(new URL(f.calls.at(-1).url).pathname,'/singer/sns');
  f.c.state.experience='classic';f.c.renderNewsForView();await f.c.currentNewsScope().job;assert.ok(f.c.SNS_ITEMS.every(x=>x.singer!=='에스파'));
  f.c.chooseNewsArtist('영탁');await f.c.currentNewsScope().job;f.c.state.experience='idol';f.c.renderNewsForView();assert.equal(f.nodes.newsArtist.value,'에스파');assert.equal(f.c.SNS_ITEMS[0].singer,'에스파');
  f.c.chooseNewsArtist('영탁');assert.equal(f.c.newsSelections.idol,'에스파');
});
test('empty, total failure and partial response are distinct and cached results stay in their scope',async()=>{
  let mode='ready';const f=fixture(url=>{const u=new URL(url),source=u.pathname.split('/').pop(),name=u.searchParams.get('name');return mode==='error'||(mode==='partial'&&source==='naver')?{ok:false}:response(source,mode==='empty'?[]:[item(name,source)]);});
  f.c.chooseNewsArtist('BTS');await f.c.currentNewsScope().job;assert.equal(f.c.NEWS_ITEMS.length,2);
  mode='error';await f.c.loadCurrentNews(true);assert.equal(f.nodes.newsStatus.attrs['data-i18n'],'newsErrorCached');assert.equal(f.c.NEWS_ITEMS.length,2);
  mode='partial';await f.c.loadCurrentNews(true);assert.equal(f.nodes.newsStatus.attrs['data-i18n'],'newsPartial');assert.equal(f.c.NEWS_ITEMS.length,2);
  mode='empty';await f.c.loadCurrentNews(true);assert.equal(f.nodes.newsStatus.attrs['data-i18n'],'newsEmpty');assert.equal(f.c.NEWS_ITEMS.length,0);
  mode='error';await f.c.loadCurrentNews(true);assert.equal(f.nodes.newsStatus.attrs['data-i18n'],'newsError');assert.equal(f.nodes.newsRefresh.disabled,false);
});
test('late responses for another artist do not replace the current list or its state',async()=>{
  const releases=[];const f=fixture(url=>new Promise(resolve=>releases.push(()=>{const u=new URL(url),source=u.pathname.split('/').pop();resolve(response(source,[item(u.searchParams.get('name'),source)]));})));
  f.c.chooseNewsArtist('BTS');const old=f.c.currentNewsScope().job;await flush();f.c.chooseNewsArtist('에스파');const current=f.c.currentNewsScope().job;await flush();
  releases.slice(2).forEach(fn=>fn());await current;assert.ok(f.c.NEWS_ITEMS.every(x=>x.singer==='에스파'));
  releases.slice(0,2).forEach(fn=>fn());await old;assert.ok(f.c.NEWS_ITEMS.every(x=>x.singer==='에스파'));assert.equal(f.nodes.newsStatus.attrs['data-i18n'],'newsReady');
});
test('same-scope requests coalesce, deadlines abort and late transport success cannot report success',async()=>{
  let release;const f=fixture(()=>new Promise(resolve=>release=resolve));f.c.newsSelections.idol='BTS';const job=f.c.loadCurrentNews(true);assert.equal(f.c.loadCurrentNews(true),job);await flush();f.expire();await job;
  assert.equal(f.calls.length,2);assert.ok(f.calls.every(x=>x.signal.aborted));assert.equal(f.nodes.newsStatus.attrs['data-i18n'],'newsError');assert.equal(f.pending(),0);
  release(response('news',[item('BTS')]));await flush();assert.equal(f.c.NEWS_ITEMS.length,0);assert.equal(f.c.currentNewsScope().status,'error');
});
test('headline speech reads the current list, cancels on scope change and ignores stale callbacks',async()=>{
  const f=fixture();f.c.chooseNewsArtist('BTS');await f.c.currentNewsScope().job;const spoken=[];let cancels=0;
  f.c.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};f.c.speechSynthesis={cancel(){cancels++;},speak:u=>spoken.push(u)};f.c.window.speechSynthesis=f.c.speechSynthesis;
  f.c.toggleNewsTTS();assert.equal(spoken.length,1);assert.match(spoken[0].text,/BTS/);assert.doesNotMatch(spoken[0].text,/닫기|저장/);assert.equal(f.nodes.newsSpeak.attrs['aria-pressed'],'true');
  f.c.chooseNewsArtist('에스파');await f.c.currentNewsScope().job;assert.equal(f.c.ttsOn,false);f.c.toggleNewsTTS();spoken[0].onend({type:'end'});assert.equal(f.c.ttsOn,true);spoken[1].onend({type:'end'});assert.equal(f.c.ttsOn,false);assert.ok(cancels>=2);
});
test('owned news copy covers six languages, preserves provider titles and discloses topic source and limits',()=>{
  for(const [key,rows]of Object.entries(COPY).filter(([key])=>key.startsWith('news'))){assert.equal(rows.length,6,key);for(const lang of ['ko','zh','ja','en','es','fr'])assert.equal(typeof ownedParamText(key,lang,{count:3,name:'BTS <original>'}),'string');}
  assert.match(COPY.newsRefreshNote[0],/Instagram 게시물이 아닙니다/);assert.doesNotMatch(source,/loadSNS\('임영웅'\)/);assert.match(html,/state.tab==='news'&&!document.hidden/);
});
