import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {ownedText,COPY} from '../public/locale-copy.js';
import {LANGUAGES,normalizeLanguage,selectLocale} from '../public/locale-core.js';
const source=(await readFile(new URL('../public/locale-ui.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
function fixture(saved=null){
  const nodes=new Map();let change,resolve,contentChanged;const writes=[];let localeWrites=0;
  const get=key=>{if(!nodes.has(key))nodes.set(key,{textContent:'',setAttribute(){},getAttribute:()=> 'true',addEventListener:(_name,fn)=>{change=fn;}});return nodes.get(key);};
  const root={dataset:new Proxy({experience:'idol'},{set(target,key,value){if(key==='locale')localeWrites++;target[key]=value;return true;}}),lang:'ko'};
  const c={ownedText,LANGUAGES,normalizeLanguage,selectLocale,MutationObserver:class{constructor(fn){this.fn=fn;}observe(_target,options){if(options.childList)contentChanged=this.fn;}},queueMicrotask,AbortSignal,navigator:{language:'ko-KR'},
    localStorage:{getItem:()=>saved,setItem:(k,v)=>writes.push([k,v]),removeItem:k=>writes.push([k,null])},
    fetch:()=>new Promise(r=>resolve=r),document:{documentElement:root,createElement:()=>({}),querySelectorAll:()=>[],querySelector:get,getElementById:id=>id==='main'?{prepend(){}}:get('#'+id)}};
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
