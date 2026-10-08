import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0];
function fixture(){
  const node={innerHTML:''};
  const c={openSinger:'BTS',vidFilter:'fancam',videoFeedStatus:'ready',playerVideos:{BTS:[]},$:()=>node,esc:String,ytSearch:q=>'https://www.youtube.com/results?search_query='+encodeURIComponent(q)};
  vm.runInNewContext(html.match(/var KIND_LABEL = .*;/)[0]+'\n'+html.match(/var VID_FILTERS = \[[\s\S]*?\];/)[0]+'\n'+fn('videoIsFancam')+'\n'+fn('renderVidList')+'\n'+fn('sanitizeVideoFeed'),c);
  return {c,node};
}
test('fancam detection supports explicit feed classification and bounded title markers without labeling all live performances',()=>{
  const {c}=fixture();
  for(const title of ['BTS 직캠','[페이스캠] 무대','아이브 세로캠','BTS FANCAM','BTS fan cam','BTS FaceCam','BTS focus cam']) assert.equal(c.videoIsFancam({title,kind:'live'}),true,title);
  assert.equal(c.videoIsFancam({kind:'fancam',title:'무대'}),true);
  for(const title of ['공식 뮤직비디오','BTS live performance','focus album review','fan campaign']) assert.equal(c.videoIsFancam({title,kind:'live'}),false,title);
  assert.equal(c.videoIsFancam(null),false);
});
test('fancam filter uses the selected artists feed, retains native playback/save actions and separates external search',()=>{
  const {c,node}=fixture();
  c.playerVideos={BTS:[{title:'BTS 무대',kind:'live',videoId:'aaaaaaaaaaa'},{title:'BTS 직캠',kind:'live',videoId:'bbbbbbbbbbb'}],다른가수:[{title:'다른 직캠',kind:'fancam',videoId:'ccccccccccc'}]};
  c.renderVidList();assert.match(node.innerHTML,/BTS 직캠/);assert.doesNotMatch(node.innerHTML,/aaaaaaaaaaa|ccccccccccc/);
  assert.match(node.innerHTML,/data-act="play-video"/);assert.match(node.innerHTML,/data-act="save-video"/);
  assert.match(node.innerHTML,/제목 또는 분류/);assert.match(node.innerHTML,/전체 직캠 목록이나 공식 인증을 뜻하지/);
  assert.match(node.innerHTML,/YouTube에서 BTS 직캠 검색/);assert.match(node.innerHTML,/target="_blank" rel="noopener noreferrer"/);
  c.playerVideos.BTS=[];c.renderVidList();assert.match(node.innerHTML,/최근 수집한 영상이 아직 없어요/);assert.match(node.innerHTML,/search_query=BTS%20/);
  c.playerVideos.BTS=[{title:'뮤비',kind:'mv',videoId:'aaaaaaaaaaa'}];c.renderVidList();assert.match(node.innerHTML,/이 종류의 영상이 아직 없어요/);
});
test('sanitization preserves explicit fancam kind but rejects executable IDs before playback',()=>{
  const {c}=fixture();c.ARTISTS=[{name:'BTS'}];
  const safe=c.sanitizeVideoFeed({BTS:[{videoId:'aaaaaaaaaaa',title:'BTS 무대',kind:'fancam'},{videoId:'javascript:alert(1)',title:'직캠',kind:'fancam'}]});
  assert.equal(safe.BTS.length,1);assert.equal(safe.BTS[0].kind,'fancam');
});
