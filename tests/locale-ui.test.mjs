import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {ownedText,COPY} from '../public/locale-copy.js';
import {LANGUAGES,normalizeLanguage,selectLocale} from '../public/locale-core.js';
const source=(await readFile(new URL('../public/locale-ui.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
function fixture(saved=null){
  const nodes=new Map();let change,resolve,contentChanged;const writes=[];let localeWrites=0;
  const get=key=>{if(!nodes.has(key))nodes.set(key,{textContent:'',attrs:{'aria-pressed':'true'},attributeWrites:0,setAttribute(k,v){this.attrs[k]=v;this.attributeWrites++;},getAttribute(k){return this.attrs[k]??null;},addEventListener:(_name,fn)=>{change=fn;}});return nodes.get(key);};
  const root={dataset:new Proxy({experience:'idol'},{set(target,key,value){if(key==='locale')localeWrites++;target[key]=value;return true;}}),lang:'ko'};
  const c={ownedText,LANGUAGES,normalizeLanguage,selectLocale,MutationObserver:class{constructor(fn){this.fn=fn;}observe(_target,options){if(options.childList)contentChanged=this.fn;}},queueMicrotask,AbortSignal,navigator:{language:'ko-KR'},
    localStorage:{getItem:()=>saved,setItem:(k,v)=>writes.push([k,v]),removeItem:k=>writes.push([k,null])},
    fetch:()=>new Promise(r=>resolve=r),document:{documentElement:root,createElement:()=>({}),querySelectorAll:selector=>{const marker=selector.slice(1,-1);return [...nodes.values()].filter(n=>Object.hasOwn(n.attrs,marker));},querySelector:get,getElementById:id=>id==='main'?{prepend(){}}:get('#'+id)}};
  vm.runInNewContext(source,c);
  return {nodes,get,root,writes,localeWrites:()=>localeWrites,contentChanged:()=>contentChanged(),select(lang){get('#localeSelect').value=lang;change();},resolve:lang=>resolve({ok:true,json:async()=>({lang})})};
}

test('async card DOM updates do not re-emit the same locale and trigger a mutation feedback loop',async()=>{
  const f=fixture();assert.equal(f.localeWrites(),1);
  for(let i=0;i<4;i++){f.contentChanged();await new Promise(r=>setImmediate(r));}
  assert.equal(f.localeWrites(),1);assert.equal(f.root.dataset.locale,'ko');
  f.select('fr');assert.equal(f.localeWrites(),2);
  f.contentChanged();await new Promise(r=>setImmediate(r));assert.equal(f.localeWrites(),2);
  assert.deepEqual(f.writes,[['choeae_locale','fr']]);
});
test('marked detail attributes and labels translate idempotently without changing drafts, provider content or target IDs',async()=>{
  const f=fixture(),input=f.get('#cmText'),close=f.get('#detailClose'),follow=f.get('#followBtn'),provider=f.get('#providerTitle');
  input.attrs['data-i18n-placeholder']='commentPlaceholder';input.value='내가 쓴 댓글';input.attrs.id='cmText';
  close.attrs['data-i18n-aria-label']='close';close.textContent='✕';
  follow.attrs['data-i18n']='follow';follow.attrs['data-name']='BTS';
  provider.textContent='BTS 공개 무대';provider.attrs.href='https://www.youtube.com/watch?v=AbCdEf12345';
  for(const lang of LANGUAGES){
    f.select(lang);
    assert.equal(input.attrs.placeholder,ownedText('commentPlaceholder',lang));
    assert.equal(close.attrs['aria-label'],ownedText('close',lang));assert.equal(close.textContent,'✕');
    assert.equal(follow.textContent,ownedText('follow',lang));
    assert.equal(input.value,'내가 쓴 댓글');assert.equal(input.attrs.id,'cmText');
    assert.equal(follow.attrs['data-name'],'BTS');assert.equal(provider.textContent,'BTS 공개 무대');
    assert.equal(provider.attrs.href,'https://www.youtube.com/watch?v=AbCdEf12345');
    const count=input.attributeWrites+close.attributeWrites;
    f.contentChanged();await new Promise(r=>setImmediate(r));
    assert.equal(input.attributeWrites+close.attributeWrites,count,'repeated child updates do not rewrite unchanged attributes');
  }
  follow.attrs['data-i18n']='following';f.contentChanged();await new Promise(r=>setImmediate(r));
  assert.equal(follow.textContent,ownedText('following',LANGUAGES.at(-1)));
  assert.ok(f.writes.every(([key])=>key==='choeae_locale'));
});
test('favorite and follow actions update localization keys alongside their unchanged data semantics',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];
  const button=()=>({dataset:{name:'BTS'},attrs:{},setAttribute(k,v){this.attrs[k]=v;},classList:{toggle(){}}});
  const favorite=button(),follow=button(),follows=[],writes=[];
  const c={driveData:{favorites:[]},driveUser:null,artist:name=>name==='BTS',toast(){},saveDrive(){throw Error('guest must not sync');},renderSingers(){},
    document:{querySelector:()=>favorite},$:()=>follow,store:()=>follows,save:(key,value)=>writes.push([key,[...value]]),localStorage:{setItem:(key,value)=>writes.push([key,value])}};
  vm.runInNewContext(fn('driveToggleFavorite')+'\n'+fn('toggleFollow'),c);
  c.driveToggleFavorite('BTS');assert.equal(favorite.attrs['data-i18n'],'favoriteSaved');assert.equal(favorite.attrs['aria-pressed'],'true');
  c.driveToggleFavorite('BTS');assert.equal(favorite.attrs['data-i18n'],'favoriteSave');assert.equal(favorite.attrs['aria-pressed'],'false');
  assert.equal(c.driveData.favorites.length,0);
  c.toggleFollow('BTS');assert.equal(follow.attrs['data-i18n'],'following');assert.deepEqual(follows,['BTS']);
  c.toggleFollow('BTS');assert.equal(follow.attrs['data-i18n'],'follow');assert.deepEqual(follows,[]);
  assert.deepEqual(writes.map(([key])=>key),['st_drive_data','st_drive_data','st_follows','st_follows']);
});
test('manual language choice wins a late country response and never writes account or favorite storage',async()=>{
  const f=fixture();f.select('fr');f.resolve('ja');await new Promise(r=>setImmediate(r));
  assert.equal(f.root.dataset.locale,'fr');assert.equal(f.get('#tab-music').textContent,'Musique');assert.equal(f.root.lang,'ko');
  assert.deepEqual(f.writes,[['choeae_locale','fr']]);
  f.select('auto');assert.equal(f.root.dataset.locale,'ja');assert.equal(f.get('#tab-music').textContent,'音楽');
  assert.deepEqual(f.writes.at(-1),['choeae_locale',null]);
});
test('all requested manual languages are supported and stored selection overrides automatic location',async()=>{
  const f=fixture('es');f.resolve('en');await new Promise(r=>setImmediate(r));assert.equal(f.get('#tab-music').textContent,'Música');
  for(const [lang,label] of [['zh','音乐'],['ja','音楽'],['en','Music'],['es','Música'],['fr','Musique'],['ko','음악']]){f.select(lang);assert.equal(f.get('#tab-music').textContent,label);assert.equal(f.get('#tab-music').lang,lang);}
});

test('owned interface catalog covers each language, never returns inherited keys or HTML markup',()=>{
  for(const [key,values] of Object.entries(COPY)){assert.equal(values.length,LANGUAGES.length,key);for(const lang of LANGUAGES){assert.ok(ownedText(key,lang).length>0,key+' '+lang);assert.doesNotMatch(ownedText(key,lang),/<[^>]*>/);}}
  assert.equal(ownedText('toString','en'),null);assert.equal(ownedText('close','unknown'),'닫기');
});
