import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {ARTIST_NAME_HELPERS} from '../public/artist-names.js';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];

function fixture() {
  const attrs={};const selected=[];let opened=false,markup='';
  const input={value:'BTS',setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k]};
  const status={textContent:''};
  const list={items:[],classList:{contains:()=>opened,add:()=>opened=true,remove:()=>opened=false},querySelectorAll(){return this.items;},
    set innerHTML(value){markup=value;this.items=[...value.matchAll(/id="(sr-[^"]+)" role="option"/g)].map(m=>({id:m[1],attrs:{},setAttribute(k,v){this.attrs[k]=v;},scrollIntoView(){}}));},get innerHTML(){return markup;}};
  const c={searchActiveIndex:-1,$:id=>({searchInput:input,searchResults:list,searchStatus:status})[id],
    ARTISTS:[{name:'BTS'},{name:'IU'}],HITS:[{s:'BTS',t:'Spring Day'},{s:'BTS',t:'Dynamite'}],
    ytMusicSearch:q=>'https://music.youtube.com/search?q='+encodeURIComponent(q),handleAction:item=>selected.push(item.id)};
  vm.runInNewContext(['esc','setSearchActive','searchKeydown','doSearch','closeSearch'].map(fn).join('\n'),c);
  const key=(name,extras={})=>{let prevented=false;c.searchKeydown({key:name,preventDefault(){prevented=true;},...extras});return prevented;};
  return {c,input,list,status,attrs,selected,key};
}
test('verified alternate spellings find artists and songs, deduplicating only displayed artist results',()=>{
  const {c,list}=fixture();
  c.window={CHOEAE_ARTIST_NAMES:ARTIST_NAME_HELPERS};
  c.ARTISTS=[{name:'ITZY'},{name:'있지'},{name:'블랙핑크'},{name:'아이브'},{name:'TXT'}];
  c.HITS=[{s:'있지',t:'WANNABE'},{s:'블랙핑크',t:'SHUT DOWN'}];
  const saved=JSON.stringify([c.ARTISTS,c.HITS]);
  c.doSearch('있지');assert.equal(list.items.length,2);assert.match(list.innerHTML,/data-name="ITZY"/);
  assert.doesNotMatch(list.innerHTML,/data-name="있지"/);assert.match(list.innerHTML,/WANNABE/);
  c.doSearch('blackpink');assert.equal(list.items.length,2);assert.match(list.innerHTML,/data-name="블랙핑크"/);
  c.doSearch('ＴＸＴ');assert.equal(list.items.length,1);assert.match(list.innerHTML,/data-name="TXT"/);
  c.doSearch('ive');assert.equal(list.items.length,1);assert.match(list.innerHTML,/data-name="아이브"/);
  assert.equal(JSON.stringify([c.ARTISTS,c.HITS]),saved,'catalog and saved-name inputs are not migrated');
});

test('search arrows select one scoped result, Enter acts once and Escape/Tab clear the active descendant',()=>{
  const {c,list,attrs,selected,key,input}=fixture();
  c.doSearch('BTS');assert.equal(list.items.length,3);assert.equal(c.searchActiveIndex,-1);
  assert.equal(key('Enter'),false);assert.equal(selected.length,0);
  assert.equal(key('ArrowDown'),true);assert.equal(attrs['aria-activedescendant'],'sr-artist-0');
  key('ArrowDown');assert.equal(attrs['aria-activedescendant'],'sr-song-0');
  key('ArrowDown');key('ArrowDown');assert.equal(attrs['aria-activedescendant'],'sr-song-1');
  assert.equal(list.items.filter(i=>i.attrs['aria-selected']==='true').length,1);
  key('ArrowUp');assert.equal(attrs['aria-activedescendant'],'sr-song-0');
  assert.equal(key('Enter'),true);assert.deepEqual(selected,['sr-song-0']);
  assert.equal(attrs['aria-expanded'],'false');assert.equal(attrs['aria-activedescendant'],undefined);
  assert.equal(key('Enter'),false);assert.equal(selected.length,1);
  key('ArrowUp');assert.equal(attrs['aria-activedescendant'],'sr-song-1');
  assert.equal(key('Tab'),false);assert.equal(attrs['aria-activedescendant'],undefined);
  key('ArrowDown');assert.equal(key('Escape'),true);assert.equal(attrs['aria-expanded'],'false');assert.equal(input.value,'BTS');
});

test('typing/new query and no matches reset selection; IME and native editing shortcuts are not intercepted',()=>{
  const {c,list,attrs,status,key}=fixture();
  c.doSearch('BTS');key('ArrowDown');
  for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}]) {
    assert.equal(key('ArrowDown',extra),false);assert.equal(c.searchActiveIndex,0);
  }
  assert.equal(key('ArrowLeft'),false);
  c.doSearch('Spring');assert.equal(c.searchActiveIndex,-1);assert.equal(attrs['aria-activedescendant'],undefined);
  assert.match(list.innerHTML,/aria-label="Spring Day — BTS YouTube Music에서 검색 \(새 창\)"/);
  assert.match(status.textContent,/가수 0명 · 노래 1곡/);
  c.doSearch('not-found');assert.equal(attrs['aria-expanded'],'false');assert.equal(list.items.length,0);
  assert.match(status.textContent,/다른 이름으로 검색/);assert.equal(key('Enter'),false);
  c.doSearch('');assert.equal(status.textContent,'');assert.equal(attrs['aria-activedescendant'],undefined);
  assert.match(html,/aria-autocomplete="list" aria-haspopup="listbox" aria-describedby="searchHelp"/);
});

test('song Enter follows its native href once without a second scripted popup',()=>{
  const {c,list,key,selected}=fixture();c.doSearch('Spring');key('ArrowDown');
  const option=list.items[0];let clicks=0;
  option.tagName='A';option.getAttribute=k=>k==='href'?'https://music.youtube.com/search?q=BTS%20Spring%20Day':null;
  option.click=()=>clicks++;
  assert.match(list.innerHTML,/href="https:\/\/music.youtube.com\/search\?q=BTS%20Spring%20Day" target="_blank" rel="noopener"/);
  key('Enter');key('Enter');assert.equal(clicks,1);assert.equal(selected.length,0);
});

test('theme toggle and restored preference expose the actual mode with a stable accessible label',()=>{
  const rootAttrs={'data-theme':'dark'},buttonAttrs={'aria-label':'다크 모드'},stored=new Map();
  const root={setAttribute:(k,v)=>rootAttrs[k]=v,removeAttribute:k=>delete rootAttrs[k],getAttribute:k=>rootAttrs[k]??null};
  const button={textContent:'',setAttribute:(k,v)=>buttonAttrs[k]=v};
  const c={document:{documentElement:root},$:()=>button,localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)}};
  vm.runInNewContext(fn('initTheme')+'\n'+fn('toggleTheme'),c);
  c.initTheme();assert.equal(rootAttrs['data-theme'],undefined);assert.equal(buttonAttrs['aria-pressed'],'false');
  c.toggleTheme();assert.equal(rootAttrs['data-theme'],'dark');assert.equal(buttonAttrs['aria-pressed'],'true');
  assert.equal(buttonAttrs['aria-label'],'다크 모드');assert.equal(stored.get('st_theme'),'dark');
  c.initTheme();assert.equal(buttonAttrs['aria-pressed'],'true');
  c.toggleTheme();assert.equal(buttonAttrs['aria-pressed'],'false');assert.equal(stored.get('st_theme'),'light');
});
