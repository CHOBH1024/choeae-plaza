import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>{const source=html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];assert.ok(source,name);return source;};
const context=()=>{const c={URL};vm.runInNewContext(['safeExternalURL','savedVideoId'].map(fn).join('\n'),c);return c;};
test('playing library height overrides the ID-specific mobile full-height rule',async()=>{
  const css=await readFile(new URL('../public/music-hub.css',import.meta.url),'utf8');
  assert.match(css,/body\.playing #driveModal \.sd-box\{max-height:calc\(100dvh - var\(--browse-player-space\) - 32px\)!important\}/);
});
test('only exact HTTPS YouTube video routes become playable, never search or arbitrary hosts',()=>{
  const c=context(),id='AbCdEf12345';
  for(const url of ['https://www.youtube.com/watch?v='+id,'https://youtube.com/shorts/'+id,'https://youtu.be/'+id,'https://www.youtube.com/embed/'+id,'https://www.youtube.com/live/'+id])assert.equal(c.savedVideoId(url),id);
  for(const url of ['http://youtu.be/'+id,'https://youtube.com.evil.test/watch?v='+id,'https://user@youtube.com/watch?v='+id,'https://music.youtube.com/search?q='+id,'https://youtube.com/watch?v='+id+'&v=aaaaaaaaaaa','https://youtube.com/watch?v=bad','https://youtu.be/'+id+'/extra','https://youtube.com:444/watch?v='+id,'javascript:alert(1)'])assert.equal(c.savedVideoId(url),'');
});
test('saved video playback builds the ordered valid queue without changing saved data or opening windows',()=>{
  const c=context(),videos=[{t:'A',url:'https://youtu.be/aaaaaaaaaaa'},{t:'search',url:'https://youtube.com/results?search_query=A'},{t:'B',url:'https://youtube.com/watch?v=bbbbbbbbbbb'},{t:'duplicate',url:'https://youtu.be/aaaaaaaaaaa'}];
  let plays=[],focus=0;Object.assign(c,{driveData:{videos},playVideo:(...args)=>plays.push(args),$:()=>({focus(){focus++;}}),currentQueue:[{videoId:'old'}],currentQIdx:4});
  vm.runInNewContext(fn('playLibraryVideo'),c);c.playLibraryVideo('bbbbbbbbbbb');
  assert.deepEqual(Array.from(c.currentQueue,x=>x.videoId),['aaaaaaaaaaa','bbbbbbbbbbb']);assert.equal(c.currentQIdx,1);assert.deepEqual(plays,[['bbbbbbbbbbb','B']]);assert.equal(focus,1);assert.equal(c.driveData.videos,videos);
  c.playLibraryVideo('ccccccccccc');assert.equal(plays.length,1);assert.equal(c.currentQIdx,1);
});
test('video rows separate explicit in-app play from original links and escape titles',()=>{
  const c=context();c.esc=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');vm.runInNewContext(['safeSavedURL','savedItemRow'].map(fn).join('\n'),c);
  const item={t:'<img src=x>',url:'https://youtu.be/aaaaaaaaaaa'};
  assert.match(c.savedItemRow(item,'videos'),/data-act="library-video"/);assert.match(c.savedItemRow(item,'videos'),/data-video-id="aaaaaaaaaaa"/);assert.doesNotMatch(c.savedItemRow(item,'videos'),/<img/);
  for(const kind of ['songs','articles'])assert.doesNotMatch(c.savedItemRow(item,kind),/library-video/);
});
