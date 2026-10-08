import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {queueTarget,swipeDirection} from '../public/shortform-core.js';
import {ownedText} from '../public/locale-copy.js';
test('swipe queues stop at each end and reject malformed indices',()=>{
  assert.equal(queueTarget(3,0,1),1);assert.equal(queueTarget(3,2,-1),1);
  for(const args of [[3,0,-1],[3,2,1],[0,0,1],[3,-1,1],[3,1.5,1],[3,0,2]])assert.equal(queueTarget(...args),null);
});
test('only deliberate vertical rail gestures advance the queue',()=>{
  const start={x:20,y:200};
  assert.equal(swipeDirection(start,{x:22,y:100}),1);assert.equal(swipeDirection(start,{x:20,y:300}),-1);
  assert.equal(swipeDirection(start,{x:20,y:180}),0);assert.equal(swipeDirection(start,{x:180,y:120}),0);
});
test('browse labels cover all six languages; the persistent iframe is never cloned or covered',async()=>{
  for(const lang of ['ko','zh','ja','en','es','fr'])for(const key of ['browseEnter','browseExit','browsePrev','browseNext','browseHelp'])assert.ok(ownedText(key,lang));
  const source=await readFile(new URL('../public/shortform-ui.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/cloneNode|appendChild|new YT|fetch\(|localStorage|driveData|pbFrame.*innerHTML/);
  assert.match(source,/playVideo\(video.videoId,video.title\)/);assert.match(source,/el.inert=inert/);assert.match(source,/pointercancel/);
});
