import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/discovery-shelves.js',import.meta.url),'utf8');
function fixture(recent=[]){
  const nodes={hubRecent:{},hubRecentGrid:{}};
  const c={window:{},playerVideos:{BTS:[{videoId:'AbCdEf12345'}]},store:()=>recent,$:id=>nodes[id],esc:s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))};
  vm.runInNewContext(source,c);return {c,nodes};
}
test('personal discovery shelf uses actual validated history, escapes titles and does not invent empty data',()=>{
  const f=fixture([{v:'AbCdEf12345',t:'<img src=x onerror="evil">'}, {v:'javascript:evil',t:'bad'}, {v:'ZyXwVu98765',t:{fake:1}}]);
  assert.equal(f.nodes.hubRecent.hidden,false);
  assert.match(f.nodes.hubRecentGrid.innerHTML,/data-vid="AbCdEf12345"/);
  assert.match(f.nodes.hubRecentGrid.innerHTML,/&lt;img/);
  assert.doesNotMatch(f.nodes.hubRecentGrid.innerHTML,/javascript:|ZyXwVu98765|<img src=x/);
  assert.equal(fixture().nodes.hubRecent.hidden,true);
  assert.equal(fixture({malformed:1}).nodes.hubRecent.hidden,true);
  assert.equal((fixture(Array(12).fill({v:'AbCdEf12345',t:'actual'})).nodes.hubRecentGrid.innerHTML.match(/class="hub-video-card"/g)||[]).length,6);
  assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|save\(/);
});
test('artist canvas only uses a valid existing provider video and escapes the artist name',()=>{
  const f=fixture();assert.match(f.c.window.artistArtwork({name:'BTS'}),/AbCdEf12345\/hqdefault.jpg/);
  assert.equal(f.c.window.artistArtwork({name:'unknown'}),'');
  f.c.playerVideos['<BTS>']=[{videoId:'ZyXwVu98765'}];
  assert.match(f.c.window.artistArtwork({name:'<BTS>'}),/alt="&lt;BTS&gt;/);
  f.c.playerVideos.BTS=[{videoId:'bad" onload="evil'}];
  assert.equal(f.c.window.artistArtwork({name:'BTS'}),'');
});
test('artist spotlight is a real recent video, never an invented release or listener count',()=>{
  const f=fixture();assert.equal(f.c.window.artistSpotlight({name:'BTS'}),'');
  f.c.playerVideos.BTS=[{videoId:'AbCdEf12345',title:'<script>provider</script>'}];
  const markup=f.c.window.artistSpotlight({name:'BTS'});
  assert.match(markup,/data-act="play-video"/);assert.match(markup,/data-vid="AbCdEf12345"/);
  assert.match(markup,/&lt;script&gt;provider/);assert.match(markup,/recentVideoPreview/);
  assert.doesNotMatch(markup,/<script>|EP|앨범|월간|구독자/);
  f.c.playerVideos.BTS=[{videoId:'bad',title:'bad'}];assert.equal(f.c.window.artistSpotlight({name:'BTS'}),'');
});
test('arriving feed updates only preview areas, never favorites, focus or an unsubmitted draft',()=>{
  const f=fixture();let writes=0;
  const area=()=>({dataset:{},set innerHTML(_value){writes++;}});
  f.nodes.artistArtworkContainer=area();f.nodes.artistSpotlight=area();
  f.c.state={experience:'idol'};f.c.openSinger='BTS';f.c.artist=name=>({name});
  f.c.playerVideos.BTS=[{videoId:'AbCdEf12345',title:'first'}];
  f.c.window.refreshArtistPreview();assert.equal(writes,2);
  f.c.window.refreshArtistPreview();assert.equal(writes,2,'unchanged provider markup does not redraw');
  f.c.playerVideos.BTS=[{videoId:'ZyXwVu98765',title:'second'}];
  f.c.window.refreshArtistPreview();assert.equal(writes,4);
  f.c.state.experience='classic';f.c.window.refreshArtistPreview();assert.equal(writes,4);
  f.c.state.experience='idol';f.c.openSinger=null;f.c.window.refreshArtistPreview();assert.equal(writes,4);
  assert.doesNotMatch(source,/singerBox|cmText|focus\(|driveData\s*=/);
});
