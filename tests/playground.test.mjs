import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {COPY,ownedParamText} from '../public/locale-copy.js';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function attend()'),html.indexOf('function setRankPeriod('));
function fixture(){
  const nodes={},stored=new Map();let focus='',writes=0,fail=false;
  const node=id=>nodes[id]??={innerHTML:'',textContent:'',hidden:false,attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},focus(){focus=id;}};
  const c={state:{experience:'idol',loaded:{play:true}},ARTISTS:[{name:'BTS',cat:'아이돌'},{name:'에스파',cat:'아이돌'},{name:'아이유',cat:'아이돌'},{name:'아이브',cat:'아이돌'},{name:'임영웅',cat:'트로트'},{name:'영탁',cat:'트로트'},{name:'이찬원',cat:'트로트'},{name:'송가인',cat:'트로트'}],HITS:[{s:'BTS',t:'Butter'},{s:'BTS',t:'Dynamite'},{s:'에스파',t:'Drama'},{s:'아이유',t:'좋은 날'},{s:'아이브',t:'LOVE DIVE'},{s:'임영웅',t:'별빛 같은 나의 사랑아'},{s:'영탁',t:'찐이야'},{s:'이찬원',t:'편의점'},{s:'송가인',t:'엄마 아리랑'}],
    $:node,artistGenreKey:a=>a.cat==='트로트'?'trot':'idol',esc:x=>String(x).replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),localStorage:{getItem:k=>stored.get(k)??null,setItem(k,v){if(fail)throw Error('denied');writes++;stored.set(k,v);}}};
  vm.runInNewContext(source,c);return{c,nodes,stored,focus:()=>focus,writes:()=>writes,deny:()=>fail=true};
}
test('quiz pools are view-scoped, unique, bounded and exclude ambiguous song titles',()=>{
  const {c}=fixture();for(const view of ['idol','classic']){const items=c.buildQuiz(view);assert.equal(items.length,4);for(const item of items){assert.equal(new Set(item.opts).size,4);assert.equal(item.opts[item.a],item.artist);assert.ok(item.opts.every(name=>c.ARTISTS.find(a=>a.name===name).cat===(view==='idol'?'아이돌':'트로트')));}}
  c.HITS.push({s:'아이유',t:'Drama'},{s:'unknown',t:'unsafe'});assert.equal(c.buildQuiz('idol').some(x=>x.song==='Drama'),false);
  c.ARTISTS=c.ARTISTS.slice(0,3);assert.equal(c.buildQuiz('idol').length,0);
});
test('answers cannot be skipped, repeated, forged or rescored by rerendering',()=>{
  const f=fixture();f.c.showQuiz();f.c.nextQuiz();assert.equal(f.c.currentQuiz().index,0);
  for(const input of [-1,4,1.2,NaN,'0',null])f.c.quizPick(input);assert.equal(f.c.currentQuiz().score,0);
  f.c.quizPick(0);assert.equal(f.c.currentQuiz().score,1);assert.equal(f.focus(),'quizNext');
  f.c.showQuiz();f.c.quizPick(0);assert.equal(f.c.currentQuiz().score,1);assert.match(f.nodes.quizOpts.innerHTML,/ disabled/);assert.equal(f.nodes.quizScore.attrs['data-i18n'],'quizCorrect');
  f.c.nextQuiz();assert.equal(f.c.currentQuiz().index,1);assert.equal(f.focus(),'quizQ');
});
test('each view keeps its own answers, completed result and explicit restart',()=>{
  const f=fixture();f.c.showQuiz();f.c.quizPick(0);f.c.state.experience='classic';f.c.renderPlaygroundForView();assert.equal(f.c.currentQuiz().score,0);assert.equal(f.nodes.quizHeading.attrs['data-i18n'],'quizHeadingClassic');
  f.c.state.experience='idol';f.c.renderPlaygroundForView();assert.equal(f.c.currentQuiz().score,1);
  while(!f.c.currentQuiz().done){const run=f.c.currentQuiz();f.c.quizPick(run.items[run.index].a);f.c.nextQuiz();}
  assert.equal(f.c.currentQuiz().score,4);f.c.nextQuiz();f.c.showQuiz();assert.equal(f.c.currentQuiz().score,4);assert.equal(f.nodes.quizScore.attrs['data-i18n'],'quizResult');assert.match(f.nodes.quizOpts.innerHTML,/quiz-restart/);
  f.c.quizRestart();assert.equal(f.c.currentQuiz().score,0);assert.equal(f.c.currentQuiz().index,0);assert.equal(f.focus(),'quizQ');assert.equal(f.writes(),0);
});
test('quiz output escapes owned catalog names and titles and handles an empty pool',()=>{
  const f=fixture();f.c.HITS[0].t='<img onerror=x>';f.c.showQuiz();assert.equal(f.nodes.quizQ.textContent.includes('<img onerror=x>'),true);assert.equal(f.nodes.quizQ.attrs['data-i18n-name'],'<img onerror=x>');
  f.c.ARTISTS=[];f.c.quizRestart();assert.equal(f.nodes.quizQ.attrs['data-i18n'],'quizEmpty');assert.equal(f.nodes.quizOpts.innerHTML,'');assert.equal(f.nodes.quizNext.hidden,true);
});
test('attendance reads legacy and ISO dates, writes once, preserves old records and never grants a false streak',()=>{
  const f=fixture(),today=new Date(),old=new Date();old.setDate(old.getDate()-60);
  f.stored.set('st_days',JSON.stringify([old.toDateString(),old.toDateString(),'unrecognized']));f.c.attend();assert.equal(f.writes(),1);assert.equal(JSON.parse(f.stored.get('st_days')).length,4);assert.equal(f.nodes.attendMsg.attrs['data-i18n'],'attendSaved');assert.equal(f.nodes.attendBtn.disabled,true);assert.equal((f.nodes.stamps.innerHTML.match(/class="stamp on"/g)||[]).length,1);
  f.c.attend();assert.equal(f.writes(),1);assert.equal(f.nodes.attendMsg.attrs['data-i18n'],'attendAlready');assert.equal(f.c.hasAttendance([today.toDateString()],today),true);
});
test('storage denial and corrupt attendance never overwrite records or claim success',()=>{
  for(const value of ['{broken','{}','null',JSON.stringify(Array(10001).fill('old'))]){const f=fixture();f.stored.set('st_days',value);f.c.attend();assert.equal(f.writes(),0);assert.equal(f.stored.get('st_days'),value);assert.equal(f.nodes.attendMsg.attrs['data-i18n'],'attendError');f.c.renderStamps();}
  const f=fixture();f.deny();f.c.attend();assert.equal(f.writes(),0);assert.equal(f.nodes.attendMsg.attrs['data-i18n'],'attendError');
});
test('playground templates cover six languages with safe question, score and progress parameters',()=>{
  for(const [key,rows]of Object.entries(COPY).filter(([key])=>/^(quiz|attend)/.test(key))){assert.equal(rows.length,6,key);for(const lang of ['ko','zh','ja','en','es','fr'])assert.equal(typeof ownedParamText(key,lang,{name:'BTS',count:1,total:10,index:2}),'string',key+' '+lang);}
  assert.doesNotMatch(source,/건강|두뇌|하루 10|7일 연속/);assert.equal(ownedParamText('quizProgress','en',{index:2,total:10}),'Question 2 of 10');
});
