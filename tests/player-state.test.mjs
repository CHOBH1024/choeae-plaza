import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];
function fixture() {
  const nodes={playerBar:{hidden:true},pbStatus:{textContent:''},pbTitle:{textContent:''}};
  const attributes=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}});
  Object.assign(nodes.pbStatus,attributes());
  const button={disabled:true,textContent:'',...attributes()};let timer,stops=0,loads=[],plays=0;
  const c={currentVideoId:'',currentQueue:[],currentQIdx:0,pendingPlay:null,ytReady:false,ytPlayer:null,
    playerWaitTimer:null,playerFailed:false,$:id=>nodes[id],document:{querySelector:()=>button,body:{classList:{add(){},remove(){}}}},
    requestAnimationFrame(){},syncPlayerHeight(){},setTimeout(f,ms){assert.equal(ms,12000);timer=f;return 1;},clearTimeout(){timer=null;},
    store:()=>[],save(){},renderRecent(){},playerNext(){},YT:{Player:function(id,config){c.events=config.events;this.loadVideoById=v=>loads.push(v);this.stopVideo=()=>stops++;this.playVideo=()=>plays++;this.pauseVideo=()=>{};this.getPlayerState=()=>0;}}};
  c.window=c;
  vm.runInNewContext(['setPlayerStatus','clearPlayerWait','waitForPlayback','playerStateChanged','playerError','playerAutoplayBlocked','onYouTubeIframeAPIReady','togglePlay','playVideo','closePlayer'].map(fn).join('\n'),c);
  return {c,nodes,button,loads,timeout:()=>timer?.(),stops:()=>stops,plays:()=>plays};
}
test('player reports preparation, timeout and actual state rather than claiming playback',()=>{
  const f=fixture(),{c,nodes,button}=f;
  c.playVideo('bad','bad');assert.equal(nodes.playerBar.hidden,true);
  c.playVideo('aaaaaaaaaaa','BTS');assert.equal(button.disabled,true);assert.doesNotMatch(button.textContent,/일시정지/);
  f.timeout();assert.match(nodes.pbStatus.textContent,/재생을 확인하지 못/);assert.equal(button.disabled,true);
  c.onYouTubeIframeAPIReady();c.events.onReady();assert.deepEqual(f.loads,['aaaaaaaaaaa']);assert.equal(button.disabled,false);
  c.events.onStateChange({data:1});assert.equal(button.textContent,'일시정지');assert.equal(nodes.pbStatus.textContent,'재생 중');
  c.events.onStateChange({data:2});assert.equal(button.textContent,'재생');
  c.togglePlay();assert.equal(f.plays(),1);assert.notEqual(button.textContent,'일시정지');
  c.events.onAutoplayBlocked();assert.match(nodes.pbStatus.textContent,/자동 재생이 차단/);
  c.events.onError({data:150});assert.match(nodes.pbStatus.textContent,/사이트 안에서 재생할 수 없/);
  c.togglePlay();assert.equal(f.loads.length,2);assert.equal(c.playerFailed,false);
});
test('closing clears pending playback and prevents late ready/events from restarting a hidden player',()=>{
  const f=fixture(),{c,nodes}=f;c.playVideo('aaaaaaaaaaa','BTS');c.closePlayer();
  assert.equal(c.pendingPlay,null);assert.equal(c.currentVideoId,'');assert.equal(c.playerWaitTimer,null);
  c.onYouTubeIframeAPIReady();c.events.onReady();assert.equal(f.loads.length,0);
  c.events.onStateChange({data:0});c.events.onError({data:100});assert.equal(nodes.playerBar.hidden,true);
  c.playVideo('bbbbbbbbbbb','IU');assert.equal(f.loads.length,1);c.closePlayer();assert.equal(f.stops(),1);
});
test('player state localization keys follow actual SDK events and never change disabled or pending semantics',()=>{
  const f=fixture(),{c,nodes,button}=f;
  c.playVideo('aaaaaaaaaaa','Original provider title');
  assert.equal(nodes.pbStatus.attrs['data-i18n'],'playerLoading');assert.equal(button.attrs['data-i18n'],'playerPreparing');assert.equal(button.disabled,true);
  f.timeout();assert.equal(nodes.pbStatus.attrs['data-i18n'],'playerTimeout');assert.equal(button.attrs['data-i18n'],'playerRetry');
  c.onYouTubeIframeAPIReady();c.events.onReady();
  for(const [state,key,label] of [[1,'playerPlaying','playerPause'],[2,'playerPaused','playerPlay'],[3,'playerLoading','playerPlay'],[5,'playerStart','playerPlay'],[0,'playerEnded','playerReplay']]){
    c.events.onStateChange({data:state});assert.equal(nodes.pbStatus.attrs['data-i18n'],key);assert.equal(button.attrs['data-i18n'],label);
  }
  c.events.onAutoplayBlocked();assert.equal(nodes.pbStatus.attrs['data-i18n'],'playerAutoplayBlocked');
  for(const [error,key] of [[100,'playerMissing'],[101,'playerNotEmbeddable'],[150,'playerNotEmbeddable'],[2,'playerFailed']]){
    c.events.onError({data:error});assert.equal(nodes.pbStatus.attrs['data-i18n'],key);
  }
  assert.equal(nodes.pbTitle.textContent,'Original provider title');
  c.setPlayerStatus('unmarked owned message','unmarked label',false);
  assert.equal(nodes.pbStatus.attrs['data-i18n'],undefined);assert.equal(button.attrs['data-i18n'],undefined);assert.equal(button.disabled,true);
});
test('selecting a video replaces the previous artists queue and starts at the selected index',()=>{
  const played=[];const c={openSinger:'IU',playerVideos:{IU:[{videoId:'aaaaaaaaaaa'},{videoId:'bbbbbbbbbbb'}]},
    currentQueue:[{videoId:'ccccccccccc'}],currentQIdx:0,playVideo:(id,title)=>played.push({id,title}),closeSingerModal(){c.openSinger=null;},$:()=>({focus(){}})};
  vm.runInNewContext(fn('playSelectedVideo'),c);
  c.playSelectedVideo('bbbbbbbbbbb','IU second');assert.equal(c.currentQIdx,1);assert.equal(c.currentQueue.length,2);
  assert.equal(played[0].id,'bbbbbbbbbbb');
  assert.equal(c.openSinger,null,'playback closes the modal that covered player controls');
  c.playSelectedVideo('ddddddddddd','not in feed');assert.equal(c.currentQueue.length,0);
});
test('YouTube script is loaded only after the callback is installed; an already loaded API initializes once',()=>{
  let appended,creates=0,ready=0;
  const c={window:{},document:{getElementById:()=>appended,createElement:()=>{creates++;return {};},head:{appendChild:s=>appended=s}},onYouTubeIframeAPIReady:()=>ready++};
  vm.runInNewContext(fn('initYouTubePlayerAPI'),c);
  c.initYouTubePlayerAPI();assert.equal(appended.src,'https://www.youtube.com/iframe_api');assert.equal(appended.async,true);
  c.initYouTubePlayerAPI();assert.equal(creates,1);
  c.window.YT={Player(){}};appended.onload();assert.equal(ready,1);
  const f=fixture();f.c.onYouTubeIframeAPIReady();const player=f.c.ytPlayer;
  f.c.onYouTubeIframeAPIReady();assert.equal(f.c.ytPlayer,player);
  assert.doesNotMatch(html,/<script src="https:\/\/www.youtube.com\/iframe_api"><\/script>/);
  assert.ok(html.indexOf('window.onYouTubeIframeAPIReady =')<html.indexOf('\ninitYouTubePlayerAPI();'));
});
test('outer player resizing updates the content inset without reading the provider iframe',()=>{
  const values=[];let callback,observed;
  const outer={hidden:true,offsetHeight:340};
  const c={$:()=>outer,document:{documentElement:{style:{setProperty:(key,value)=>values.push([key,value])}},querySelector(){throw Error('must not inspect provider contents');}},
    ResizeObserver:class{constructor(fn){callback=fn;}observe(node){observed=node;}}};
  const observer=html.match(/var playerResizeObserver =[^\n]+\nif \(playerResizeObserver\)[^\n]+/)[0];
  vm.runInNewContext(fn('syncPlayerHeight')+'\n'+observer,c);
  assert.equal(observed,outer);callback();assert.deepEqual(values.at(-1),['--player-h','0px']);
  outer.hidden=false;callback();assert.deepEqual(values.at(-1),['--player-h','340px']);
  outer.offsetHeight=390;callback();assert.deepEqual(values.at(-1),['--player-h','390px']);
  const without={...c,ResizeObserver:undefined};vm.runInNewContext(fn('syncPlayerHeight')+'\n'+observer,without);
  assert.equal(without.playerResizeObserver,null,'window resize and player callbacks remain the fallback');
});
