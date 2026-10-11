import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=(await readFile(new URL('../public/index.html',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const names=['rankArtists','normalizeRank','rankMessage','renderVoteControls','renderRank','readSupportResponse','loadRank','setRankPeriod','confirmedVoteResult','vote'];
const functions=names.map(name=>{const fn=html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];assert.ok(fn,name);return fn;}).join('\n');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const json=(body,ok=true,type='application/json')=>({ok,headers:{get:()=>type},json:async()=>body});
function fixture(fetcher=async()=>json({rank:[]})){
  const node=()=>({innerHTML:'',textContent:'',value:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}});
  const nodes=Object.fromEntries(['rankList','rankStatus','rankVoteStatus','rankArtist'].map(id=>[id,node()]));
  const buttons=[{dataset:{act:'vote'},disabled:false},{dataset:{act:'vote-selection'},disabled:false}];
  const timers=new Map();let timerId=0;
  const c={ARTISTS:[{name:'BTS',cat:'아이돌'},{name:'에스파',cat:'아이돌'},{name:'아이유',cat:'아이돌'},{name:'임영웅',cat:'트로트'},{name:'영탁',cat:'트로트'}],
    state:{experience:'idol',rankPeriod:'week',supportConfirmed:false},rankState:{request:0,job:null,status:'idle',entries:[]},votePending:false,
    API:'https://api.example.test/api/singer',AbortController,fetch:fetcher,$:id=>nodes[id],
    document:{querySelectorAll:selector=>selector.includes('rank-period')?[]:buttons},
    artistGenreKey:a=>a.cat==='트로트'?'trot':'idol',artist:name=>c.ARTISTS.find(a=>a.name===name),
    esc:value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    setTimeout(fn,delay){assert.equal(delay,8000);timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(functions,c);
  return {c,nodes,buttons,timers};
}
test('support totals reject invalid counts, duplicates, oversized and inherited schemas without coercion',()=>{
  const {c}=fixture();
  for(const count of [null,true,false,'',' ','01','-1','1e4',-1,0,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,{valueOf(){throw Error('coercion');}}])assert.equal(c.normalizeRank({rank:[{singer:'BTS',c:count}]}).length,0);
  assert.deepEqual(Array.from(c.normalizeRank({rank:[{singer:'BTS',c:'12'},{singer:'BTS',c:99},{singer:'아이유',c:2},{singer:'<script>',c:999}]}),x=>[x.name,x.count]),[['아이유',2]]);
  for(const data of [null,{}, {rank:{}},{rank:Array(1001).fill(null)},Object.create({rank:[]})])assert.throws(()=>c.normalizeRank(data),/RANK_INVALID_RESPONSE/);
});
test('empty and failed totals never manufacture ranks; view scopes and ties preserve saved selections',async()=>{
  const f=fixture(async()=>json({rank:[{singer:'BTS',c:10},{singer:'에스파',c:10},{singer:'아이유',c:1},{singer:'임영웅',c:20}]}));
  f.nodes.rankArtist.value='BTS';await f.c.loadRank();
  assert.deepEqual([...f.nodes.rankList.innerHTML.matchAll(/class="rank-num">(\d+)/g)].map(x=>x[1]),['1','1','3']);
  assert.doesNotMatch(f.nodes.rankList.innerHTML,/임영웅|영탁/);assert.equal(f.nodes.rankArtist.value,'BTS');
  f.c.state.experience='classic';f.c.renderRank();assert.match(f.nodes.rankList.innerHTML,/임영웅/);assert.doesNotMatch(f.nodes.rankList.innerHTML,/BTS|에스파|아이유|영탁/);assert.equal(f.nodes.rankArtist.value,'');assert.match(f.nodes.rankArtist.innerHTML,/영탁/,'unranked registered artists remain available to support');
  for(const response of [json({rank:[]}),json({rank:[{singer:'BTS',c:9}]},false),json({error:'failed'}),json({rank:[]},true,'text/html')]){
    f.c.fetch=async()=>response;await f.c.loadRank();assert.equal(f.nodes.rankList.innerHTML,'');assert.ok(['rankEmpty','rankError'].includes(f.nodes.rankStatus.attrs['data-i18n']));
  }
  assert.equal(f.timers.size,0);
});
test('a late period response cannot overwrite current totals and view changes use the current scope',async()=>{
  const pending=[];const f=fixture((url,options)=>new Promise(resolve=>pending.push({url,options,resolve})));
  const old=f.c.loadRank();await tick();f.c.setRankPeriod('all');await tick();assert.ok(pending[0].options.signal.aborted);assert.match(pending[1].url,/period=all$/);
  f.c.state.experience='classic';pending[1].resolve(json({rank:[{singer:'임영웅',c:30},{singer:'BTS',c:40}]}));await tick();assert.match(f.nodes.rankList.innerHTML,/임영웅/);assert.doesNotMatch(f.nodes.rankList.innerHTML,/BTS/);
  pending[0].resolve(json({rank:[{singer:'영탁',c:9999}]}));await old;assert.doesNotMatch(f.nodes.rankList.innerHTML,/영탁/);
  f.c.setRankPeriod('all&admin=true');assert.equal(pending.length,2);assert.equal(f.timers.size,0);
});
test('ranking deadline settles the UI even if a transport ignores abort',async()=>{
  const f=fixture(()=>new Promise(()=>{}));const job=f.c.loadRank();await tick();for(const fn of [...f.timers.values()])fn();await job;
  assert.equal(f.c.rankState.status,'error');assert.equal(f.nodes.rankList.attrs['aria-busy'],'false');assert.equal(f.nodes.rankList.innerHTML,'');assert.equal(f.timers.size,0);
});
test('vote result flags require explicit own booleans, not truthiness or inherited success',()=>{
  const {c}=fixture();assert.equal(c.confirmedVoteResult({ok:true}),'success');assert.equal(c.confirmedVoteResult({ok:false,already:true}),'already');
  for(const body of [{},{ok:false},{ok:'true'},{ok:true,already:'false'},Object.create({ok:true}),[],null])assert.throws(()=>c.confirmedVoteResult(body),/VOTE_UNCONFIRMED/);
});
test('failed or malformed votes never mark confirmed, invalid targets make no request, and POSTs are not retried',async()=>{
  let calls=0;const f=fixture(async()=>{calls++;return json({ok:true},false);});
  f.c.vote('임영웅');f.c.vote('<script>');assert.equal(calls,0);assert.equal(f.nodes.rankVoteStatus.attrs['data-i18n'],'rankInvalid');
  for(const response of [json({ok:true},false),json({}),json({ok:'true'}),json({ok:true},true,'text/html')]){
    f.c.fetch=async()=>{calls++;return response;};await f.c.vote('BTS');assert.equal(f.c.state.supportConfirmed,false);assert.equal(f.c.votePending,false);assert.equal(f.nodes.rankVoteStatus.attrs['data-i18n'],'rankUnknown');
  }
  assert.equal(calls,4);assert.equal(f.timers.size,0);
});
test('pending votes disable controls and suppress duplicate requests; confirmation refreshes GET only',async()=>{
  const posts=[];let reads=0;
  const f=fixture((url,options)=>url.endsWith('/vote')?new Promise(resolve=>posts.push({options,resolve})):(reads++,Promise.resolve(json({rank:[]}))));
  const job=f.c.vote('BTS');assert.ok(f.buttons.every(button=>button.disabled));f.c.vote('에스파');await tick();assert.equal(posts.length,1);assert.equal(JSON.parse(posts[0].options.body).singer,'BTS');
  posts[0].resolve(json({ok:true}));await job;await tick();assert.equal(f.c.state.supportConfirmed,true);assert.equal(f.nodes.rankVoteStatus.attrs['data-i18n'],'rankSuccess');assert.equal(f.nodes.rankVoteStatus.attrs['data-i18n-name'],'BTS');assert.equal(reads,1);
  f.c.vote('에스파');assert.equal(posts.length,1);assert.equal(f.nodes.rankVoteStatus.attrs['data-i18n'],'rankAlready');assert.equal(f.timers.size,0);
});
test('a timed-out POST stays unconfirmed when its late response arrives and is never automatically resent',async()=>{
  let complete,calls=0;const f=fixture(()=>{calls++;return new Promise(resolve=>complete=resolve);});const job=f.c.vote('BTS');await tick();for(const fn of [...f.timers.values()])fn();await job;
  assert.equal(f.c.state.supportConfirmed,false);assert.equal(f.c.votePending,false);assert.equal(f.nodes.rankVoteStatus.attrs['data-i18n'],'rankUnknown');
  complete(json({ok:true}));await tick();assert.equal(calls,1);assert.equal(f.c.state.supportConfirmed,false);assert.equal(f.nodes.rankVoteStatus.attrs['data-i18n'],'rankUnknown');
});
