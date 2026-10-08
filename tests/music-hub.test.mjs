import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/music-hub.js',import.meta.url),'utf8');
function fixture(url='https://example.test/?view=idol',theme=null) {
  const attrs={},events={},pops={};let writes=0,refreshes=0,tick;
  const badge={textContent:'FOR SENIORS'},heading={innerHTML:'original heading'},subtitle={textContent:'original intro'};
  const nodes={hubFavorites:{},hubFavoriteGrid:{},hubQuickNav:{},attendHeading:{textContent:"original attend"},attendDescription:{textContent:"original attend description"},quizHeading:{textContent:"original quiz"},shareHeading:{textContent:"original share"},shareDescription:{textContent:"original share description"},hubFeedStatus:{},hubFeedMessage:{},hubFeedRetry:{},hubLibrary:{hidden:true},musicCollectionDescription:{},artistBrowseHeading:{},artistBrowseDescription:{},themeBtn:{setAttribute:(k,v)=>attrs['button-'+k]=v}};
  const buttons=['idol','classic'].map(value=>({dataset:{experience:value},setAttribute:(k,v)=>attrs[value+'-'+k]=v}));
  const c={navigator:{onLine:true},openSinger:null,loadVideos:()=>refreshes++,ARTISTS:[],driveData:{favorites:[]},artistGenreKey:a=>a.cat,cardHTML:()=>'',videoFeedUpdatedAt:0,videoFeedStatus:'ready',state:{genre:'trot',tab:'singer'},HERO_PICK:['임영웅','BTS'],location:{href:url},URL,
    history:{replaceState(a,b,path){c.location.href=new URL(path,c.location.href).href;}},localStorage:{getItem:()=>theme,setItem:()=>writes++},
    $:id=>nodes[id],document:{documentElement:{setAttribute:(k,v)=>attrs[k]=v},querySelector:()=>({querySelector:s=>({'.badge':badge,'h1':heading,'.sub':subtitle})[s]}),
      querySelectorAll:()=>buttons,addEventListener:(name,fn)=>events[name]=fn},window:{setInterval(fn,ms){assert.equal(ms,300000);tick=fn;},addEventListener:(name,fn)=>pops[name]=fn},
    setGenre:g=>c.state.genre=g,renderCollage(){},loadTodaySong(){},renderChart(){},initTheme(){}};
  vm.runInNewContext(source,c);
  const click=value=>events.click({target:{closest:()=>({dataset:{experience:value}})}});
  return {c,attrs,heading,nodes,click,writes:()=>writes,tick:()=>tick(),refreshes:()=>refreshes};
}
test('idol URL opens a distinct discovery view without overwriting theme or account data',()=>{
  const f=fixture();assert.equal(f.c.state.genre,'idol');assert.equal(f.attrs['data-experience'],'idol');
  assert.equal(f.nodes.shareHeading.textContent,'좋은 취향은 함께 나눠요');assert.equal(f.nodes.hubLibrary.hidden,false);assert.match(f.heading.textContent,/지금, 이 아티스트/);
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
test('active view clicks do not reset the filter and each view remembers its genre',()=>{
  const f=fixture();
  f.c.state.genre='favorites';
  f.click('idol');assert.equal(f.c.state.genre,'favorites');
  f.click('classic');assert.equal(f.c.state.genre,'trot');
  f.c.state.genre='all';
  f.click('idol');assert.equal(f.c.state.genre,'favorites');
  f.click('classic');assert.equal(f.c.state.genre,'all');
});
test('idol hero never fills a partial feed with trot artists; classic still can',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const render=html.slice(html.indexOf('function renderCollage()'),html.indexOf('function loadTodaySong()'));
  const artists=[{name:'임영웅',cat:'트로트'},{name:'BTS',cat:'아이돌'},{name:'에스파',cat:'아이돌'}];
  const node={innerHTML:''};
  const c={state:{experience:'idol'},HERO_PICK:['BTS','블랙핑크','뉴진스','아이브'],ARTISTS:artists,
    playerVideos:{'임영웅':[{videoId:'AbCdEf12345'}],BTS:[{videoId:'ZyXwVu98765'}],'에스파':[{videoId:'AaBbCc12345'}]},
    artist:n=>artists.find(a=>a.name===n),artistGenreKey:a=>a.cat==='트로트'?'trot':'idol',esc:s=>s,$:()=>node};
  vm.runInNewContext(render+';renderCollage();',c);
  assert.match(node.innerHTML,/BTS/);assert.match(node.innerHTML,/에스파/);assert.doesNotMatch(node.innerHTML,/임영웅/);
  c.state.experience='classic';c.renderCollage();assert.match(node.innerHTML,/임영웅/);
  c.state.experience='idol';c.playerVideos={};c.renderCollage();
  assert.match(node.innerHTML,/블랙핑크/);assert.doesNotMatch(node.innerHTML,/<img/);
});
test('all public contact surfaces use the new inquiry address',async()=>{
  for(const file of ['public/index.html','public/privacy.html','public/terms.html','functions/_shared/guides.js']){
    const text=await readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.match(text,/mailto:malrang1024@gmail\.com/);
    assert.doesNotMatch(text,/nokira1024@gmail\.com/);
  }
});
test('five-minute updates only run in the visible, online idol view without storage writes',()=>{
  const f=fixture();f.tick();assert.equal(f.refreshes(),1);
  f.c.document.hidden=true;f.tick();assert.equal(f.refreshes(),1);
  f.c.document.hidden=false;f.c.navigator.onLine=false;f.tick();assert.equal(f.refreshes(),1);
  f.c.navigator.onLine=true;f.click('classic');f.tick();assert.equal(f.refreshes(),1);
  assert.equal(f.writes(),0);
});
