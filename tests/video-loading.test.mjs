import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];

test('the music collection opens the exact named song, not the artists latest video',()=>{
  const opened=[];
  const c={HITS:[{s:'BTS',t:'Spring Day'}],openTab:url=>opened.push(url),ytMusicSearch:q=>'https://music.youtube.com/search?q='+encodeURIComponent(q),
    playSingerLatest(){throw Error('must not substitute a latest video for a song');}};
  vm.runInNewContext(fn('playHit'),c);c.playHit(0);c.playHit(99);
  assert.deepEqual(opened,['https://music.youtube.com/search?q=BTS%20Spring%20Day']);
  assert.match(html,/실시간 인기 순위가 아니며/);
  assert.doesNotMatch(html,/노래 30곡 — 누르면 바로 들려드려요/);
});

test('feed loading is not a false failure, requests coalesce and completion refreshes the current artist comments', async()=>{
  const list={innerHTML:''};let resolve,requests=0,timeout,cleared=0;const comments=[];
  const c={ARTISTS:[{name:'BTS'},{name:'IU'}],videoFeedStatus:'idle',videoFeedJob:null,playerVideos:{},openSinger:'BTS',vidFilter:'all',VID_FILTERS:[{k:'all'}],
    API:'https://api.example.test/singer',AbortController,setTimeout:(f,ms)=>{assert.equal(ms,8000);timeout=f;return 1;},clearTimeout:()=>cleared++,
    fetch:()=>{requests++;return new Promise(r=>resolve=r);},$:()=>list,ytSearch:()=>'',sanitizeVideoFeed:x=>x,
    renderSingers(){},renderCollage(){},loadYTComments:n=>comments.push(n)};
  vm.runInNewContext(['renderVidList','readVideoFeed','validateVideoFeed','feedFailureMarkup','loadVideos'].map(fn).join('\n'),c);
  const job=c.loadVideos();assert.equal(c.loadVideos(),job);assert.equal(requests,1);
  assert.match(list.innerHTML,/불러오는 중/);assert.doesNotMatch(list.innerHTML,/불러오지 못/);
  c.openSinger='IU';resolve({ok:true,json:async()=>({artists:{}})});await job;
  assert.equal(c.videoFeedStatus,'ready');assert.equal(c.videoFeedJob,null);assert.equal(cleared,1);
  assert.deepEqual(comments,['IU']);assert.equal(typeof timeout,'function');
  assert.match(list.innerHTML,/최근 수집한 영상이 아직 없어요/);
});

test('feed failures preserve cached items, provide retry, reject malformed responses and abort stalled requests',async()=>{
  let response={ok:false,json:async()=>({})},timer;const list={innerHTML:''};
  const c={ARTISTS:[{name:'BTS'},{name:'IU'}],videoFeedStatus:'idle',videoFeedJob:null,playerVideos:{BTS:[{videoId:'aaaaaaaaaaa'}]},openSinger:'IU',vidFilter:'all',VID_FILTERS:[{k:'all'}],
    API:'https://api.example.test/singer',AbortController,setTimeout:f=>{timer=f;return 1;},clearTimeout(){},$:()=>list,ytSearch:()=>'',
    fetch:async()=>response,sanitizeVideoFeed:x=>x,renderSingers(){},renderCollage(){},loadYTComments(){}};
  vm.runInNewContext(['renderVidList','readVideoFeed','validateVideoFeed','feedFailureMarkup','loadVideos'].map(fn).join('\n'),c);
  await c.loadVideos();assert.equal(c.playerVideos.BTS.length,1);assert.match(list.innerHTML,/retry-videos/);
  response={ok:true,json:async()=>({artists:[]})};await c.loadVideos();assert.equal(c.videoFeedStatus,'error');
  response={ok:true,json:async()=>({artists:{}})};await c.loadVideos();assert.equal(c.videoFeedStatus,'ready');
  c.fetch=(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));
  const job=c.loadVideos();timer();await job;assert.equal(c.videoFeedStatus,'error');assert.equal(c.videoFeedJob,null);
});

test('YouTube comments use only the selected sanitized feed and ignore late same-artist requests',async()=>{
  const list={innerHTML:''},pending=[],urls=[];
  const c={playerVideos:{BTS:[{videoId:'aaaaaaaaaaa'}]},ytCommentRequest:0,videoFeedStatus:'ready',openSinger:'BTS',$:()=>list,
    document:{querySelector(){throw Error('must not read unrelated global DOM');}},esc:String,encodeURIComponent,
    fetch:url=>{urls.push(url);return new Promise(r=>pending.push(r));}};
  vm.runInNewContext(fn('loadYTComments'),c);
  const first=c.loadYTComments('BTS');c.playerVideos.BTS=[{videoId:'bbbbbbbbbbb'}];const second=c.loadYTComments('BTS');
  pending[1]({ok:true,json:async()=>({comments:[{author:'new',text:'new text',likes:1,date:''}]})});await second;
  pending[0]({ok:true,json:async()=>({comments:[{author:'old',text:'old text',likes:1,date:''}]})});await first;
  assert.match(list.innerHTML,/new text/);assert.doesNotMatch(list.innerHTML,/old text/);
  assert.ok(urls[0].endsWith('aaaaaaaaaaa')&&urls[1].endsWith('bbbbbbbbbbb'));
  c.playerVideos={};c.videoFeedStatus='loading';c.loadYTComments('BTS');assert.match(list.innerHTML,/영상 정보를 불러온 뒤/);
  assert.doesNotMatch(list.innerHTML,/댓글이 없어요/);assert.equal(urls.length,2);
  c.playerVideos={BTS:[{videoId:'aaaaaaaaaaa'}]};const malformed=c.loadYTComments('BTS');pending[2]({ok:true,json:async()=>({})});await malformed;
  assert.match(list.innerHTML,/불러오지 못했어요/);assert.doesNotMatch(list.innerHTML,/아직 댓글이 없어요/);
});
