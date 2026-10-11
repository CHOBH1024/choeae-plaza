import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>{const text=html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];assert.ok(text,name);return text;};
function fixture(){
  const nodes={};
  const c={ARTISTS:[{name:'임영웅',cat:'트로트'},{name:'BTS',cat:'아이돌'}],HITS:[{s:'임영웅',t:'사랑은 늘 도망가'},{s:'BTS',t:'Spring Day'}],
    state:{experience:'classic',genre:'all',hitLimit:8},driveData:{favorites:['임영웅','BTS']},Date,esc:s=>s,ytMusicSearch:q=>'https://music.youtube.com/search?q='+encodeURIComponent(q),
    $:id=>nodes[id]||=( {attrs:{},setAttribute(key,value){this.attrs[key]=value;}} )};
  vm.runInNewContext(['artist','artistGenreKey','visibleArtists','loadTodaySong','renderChart'].map(fn).join('\n'),c);
  return {c,nodes};
}
test('all and favorite catalogs stay in their chosen view without rewriting the shared saved list',()=>{
  const {c}=fixture();const original=JSON.stringify(c.driveData);
  for(const [mode,name] of [['classic','임영웅'],['idol','BTS']]){
    c.state.experience=mode;
    for(const genre of ['all','favorites']){c.state.genre=genre;assert.deepEqual(Array.from(c.visibleArtists(),a=>a.name),[name]);}
  }
  assert.equal(JSON.stringify(c.driveData),original);
});
test('daily discovery and signature songs respect view membership and retain the exact Music query',()=>{
  const {c,nodes}=fixture();
  for(const [mode,name,song] of [['classic','임영웅','사랑은 늘 도망가'],['idol','BTS','Spring Day']]){
    c.state.experience=mode;c.loadTodaySong();c.renderChart();
    assert.equal(nodes.todayTitle.textContent,song);assert.ok(nodes.todaySub.textContent.startsWith(name));
    assert.equal(new URL(nodes.todaySongLink.href).searchParams.get('q'),name+' '+song);
    assert.match(nodes.chartList.innerHTML,new RegExp(name));assert.doesNotMatch(nodes.chartList.innerHTML,new RegExp(mode==='classic'?'BTS':'임영웅'));
    assert.equal(nodes.moreHits.attrs['data-i18n-count'],'1');
    assert.ok(nodes.chartList.innerHTML.includes('data-i="'+(mode==='classic'?0:1)+'"'),'filtered positions still address the original catalog');
  }
});
