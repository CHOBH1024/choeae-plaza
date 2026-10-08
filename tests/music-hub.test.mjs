import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/music-hub.js',import.meta.url),'utf8');
function fixture(url='https://example.test/?view=idol',theme=null) {
  const attrs={},events={},pops={};let writes=0;
  const badge={textContent:'FOR SENIORS'},heading={innerHTML:'original heading'},subtitle={textContent:'original intro'};
  const nodes={shareHeading:{textContent:"original share"},shareDescription:{textContent:"original share description"},hubFeedStatus:{},hubFeedMessage:{},hubFeedRetry:{},hubLibrary:{hidden:true},musicCollectionDescription:{},artistBrowseHeading:{},artistBrowseDescription:{},themeBtn:{setAttribute:(k,v)=>attrs['button-'+k]=v}};
  const buttons=['idol','classic'].map(value=>({dataset:{experience:value},setAttribute:(k,v)=>attrs[value+'-'+k]=v}));
  const c={videoFeedStatus:'ready',state:{genre:'trot',tab:'singer'},HERO_PICK:['임영웅','BTS'],location:{href:url},URL,
    history:{replaceState(a,b,path){c.location.href=new URL(path,c.location.href).href;}},localStorage:{getItem:()=>theme,setItem:()=>writes++},
    $:id=>nodes[id],document:{documentElement:{setAttribute:(k,v)=>attrs[k]=v},querySelector:()=>({querySelector:s=>({'.badge':badge,'h1':heading,'.sub':subtitle})[s]}),
      querySelectorAll:()=>buttons,addEventListener:(name,fn)=>events[name]=fn},window:{addEventListener:(name,fn)=>pops[name]=fn},
    setGenre:g=>c.state.genre=g,renderCollage(){},loadTodaySong(){},renderChart(){},initTheme(){}};
  vm.runInNewContext(source,c);
  const click=value=>events.click({target:{closest:()=>({dataset:{experience:value}})}});
  return {c,attrs,heading,nodes,click,writes:()=>writes};
}
test('idol URL opens a distinct discovery view without overwriting theme or account data',()=>{
  const f=fixture();assert.equal(f.c.state.genre,'idol');assert.equal(f.attrs['data-experience'],'idol');
  assert.equal(f.nodes.shareHeading.textContent,'좋은 취향은 함께 나눠요');assert.equal(f.nodes.hubLibrary.hidden,false);assert.match(f.heading.textContent,/오늘의 무드/);
  assert.equal(f.attrs['data-theme'],'dark');assert.equal(f.writes(),0);
  f.click('classic');assert.equal(f.c.state.genre,'trot');assert.equal(f.heading.innerHTML,'original heading');
  assert.equal(f.nodes.shareHeading.textContent,'original share');assert.equal(f.nodes.shareDescription.textContent,'original share description');assert.equal(f.nodes.hubLibrary.hidden,true);assert.equal(new URL(f.c.location.href).searchParams.has('view'),false);
  f.click('idol');assert.equal(new URL(f.c.location.href).searchParams.get('view'),'idol');assert.equal(f.writes(),0);
  assert.doesNotMatch(source,/driveData\s*=|fetch\(|localStorage\.setItem|innerHTML\s*=\s*.*location/);
});
test('existing light preference and invalid view values are preserved safely',()=>{
  const f=fixture('https://example.test/?view=idol','light');assert.equal(f.attrs['data-theme'],undefined);
  f.click('injected');assert.equal(f.attrs['data-experience'],'idol');
  const unknown=fixture('https://example.test/?view=not-real');assert.equal(unknown.attrs['data-experience'],'classic');
});
