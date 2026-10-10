import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {ownedText} from '../public/locale-copy.js';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0];

test('artist cover and name open details; separate buttons play and save',()=>{
  const c={playerVideos:{BTS:[{videoId:'aaaaaaaaaaa'}]},driveData:{favorites:[]},artistCategoryLabel:()=> '가수·그룹',artistGenreKey:()=> 'idol',esc:String};
  vm.runInNewContext(fn('cardHTML'),c);
  let card=c.cardHTML({name:'BTS'});
  assert.match(card,/class="cover" data-act="open-singer"/);
  assert.match(card,/class="name artist-name" data-act="open-singer"/);
  assert.equal((card.match(/data-act="play-singer"/g)||[]).length,1);
  assert.match(card,/data-act="card-favorite"[^>]+aria-pressed="false"/);
  assert.doesNotMatch(card,/class="cta"[^]*?class="pl"/);
  c.driveData.favorites.push('BTS');card=c.cardHTML({name:'BTS'});
  assert.match(card,/data-act="card-favorite"[^>]+aria-pressed="true"/);
  assert.match(fn('renderCollage'),/class="col-tile" data-act="open-singer"/);
  assert.doesNotMatch(fn('renderCollage'),/data-act="play-singer"/);
});

test('external music search is labelled as search and a new tab in all languages',()=>{
  for(const lang of ['ko','zh','ja','en','es','fr']){
    const text=ownedText('musicListen',lang);
    assert.match(text,/YouTube Music/);
    assert.match(text,/검색|搜索|検索|Search|Buscar|Rechercher/);
    assert.match(text,/새 창|新窗口|新しいタブ|new tab|nueva pestaña|nouvel onglet/);
  }
  assert.doesNotMatch(html,/YouTube Music에서 듣기/);
  assert.match(fn('openSingerDetail'),/href="' \+ ytMusicSearch[\s\S]*?target="_blank"/);
});

test('closing details and navigating tabs never stop or replace the current player and queue',()=>{
  const nodes={singerModal:{hidden:false},myFavoritesBtn:{focus(){}},heroLead:{},...Object.fromEntries(['singer','music','news','play'].flatMap(t=>[['panel-'+t,{hidden:false,getBoundingClientRect:()=>({top:0})}],['tab-'+t,{setAttribute(){}}]]))};
  const queue=[{videoId:'aaaaaaaaaaa'}], player={stopVideo(){throw Error('navigation stopped playback');},loadVideoById(){throw Error('navigation replaced playback');}};
  const c={$:id=>nodes[id],document:{body:{style:{overflow:'hidden'}}},openSinger:'BTS',lastFocus:null,state:{tab:'singer'},stopNewsSpeech(){},ensureTab(){},window:{pageYOffset:0,scrollTo(){}},currentQueue:queue,currentVideoId:'aaaaaaaaaaa',ytPlayer:player};
  vm.runInNewContext(fn('closeSingerModal')+'\n'+fn('setTab'),c);
  c.closeSingerModal();assert.equal(nodes.singerModal.hidden,true);assert.equal(c.openSinger,null);
  for(const tab of ['music','news','singer'])c.setTab(tab);
  assert.equal(c.currentQueue,queue);assert.equal(c.ytPlayer,player);assert.equal(c.currentVideoId,'aaaaaaaaaaa');
  assert.doesNotMatch(fn('openDrive'),/closePlayer|stopVideo|currentQueue\s*=/);
});

test('text size is independent of genre, with visible original settings and no idol override',async()=>{
  const css=await readFile(new URL('../public/music-hub.css',import.meta.url),'utf8');
  const hub=await readFile(new URL('../public/music-hub.js',import.meta.url),'utf8');
  const shell=await readFile(new URL('../public/mobile-shell.js',import.meta.url),'utf8');
  assert.doesNotMatch(css,/--fs\s*:\s*1\s*!important/);
  assert.doesNotMatch(hub,/setFont\(|st_font/);
  assert.match(css,/font-size:calc\(16px \* var\(--fs,1\)\)/);
  assert.match(shell,/document.getElementById\('fontSettings'\)/);
  assert.equal((html.match(/id="fontSettings"/g)||[]).length,1);
});
