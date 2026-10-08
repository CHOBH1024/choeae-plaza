import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicShareData,shareDestination,copyPublicLink,nativePublicShare} from '../public/share-core.js';
import {ownedText} from '../public/locale-copy.js';
test('public shares contain only a registered artist or the selected public home',()=>{
  const origin='https://example.test/private?user=private%40example.test&token=SECRET#saved-library';
  const data=publicShareData({origin,artistName:'에스파',names:['에스파','BTS'],idol:true});
  assert.deepEqual(data,{title:'에스파 · 최애광장',url:'https://example.test/singer/%EC%97%90%EC%8A%A4%ED%8C%8C'});
  for(const name of [null,undefined,'constructor','<script>','BTS?user=SECRET']){
    assert.equal(publicShareData({origin,artistName:name,names:['BTS'],idol:true}).url,'https://example.test/?view=idol');
  }
  assert.equal(publicShareData({origin}).url,'https://example.test/');
  for(const bad of ['javascript:alert(1)','file:///c:/private','https://user:password@example.test'])assert.throws(()=>publicShareData({origin:bad}));
});
test('Naver and Facebook URL-encode a public page and never fabricate unsupported share URLs',()=>{
  const data=publicShareData({origin:'https://example.test',artistName:'(여자)아이들',names:['(여자)아이들']});
  const naver=new URL(shareDestination('naver',data));
  assert.equal(naver.origin,'https://share.naver.com');assert.equal(naver.searchParams.get('url'),data.url);assert.equal(naver.searchParams.get('title'),data.title);
  const facebook=new URL(shareDestination('facebook',data));
  assert.equal(facebook.origin,'https://www.facebook.com');assert.equal(facebook.pathname,'/sharer/sharer.php');assert.equal(facebook.searchParams.get('u'),data.url);
  for(const key of ['instagram','kakao','constructor','unknown'])assert.equal(shareDestination(key,data),null);
  assert.throws(()=>shareDestination('facebook',{url:'javascript:alert(1)'}));
});
test('clipboard success is reported only after the public link has actually been copied',async()=>{
  let copied='';assert.equal(await copyPublicLink({writeText:async value=>{copied=value;}},'https://example.test/'),true);assert.equal(copied,'https://example.test/');
  assert.equal(await copyPublicLink(null,'https://example.test/'),false);
  assert.equal(await copyPublicLink({writeText:async()=>{throw new Error('denied');}},'https://example.test/'),false);
});
test('native sharing distinguishes handoff, cancellation, no support and failure without automatic copy or post',async()=>{
  const data={title:'BTS · 최애광장',url:'https://example.test/singer/BTS'};let received;
  assert.equal(await nativePublicShare(async value=>{received=value;},data),'handed-off');assert.deepEqual(received,data);
  assert.equal(await nativePublicShare(null,data),'unsupported');
  assert.equal(await nativePublicShare(async()=>{throw Object.assign(new Error('cancel'),{name:'AbortError'});},data),'cancelled');
  assert.equal(await nativePublicShare(async()=>{throw new Error('denied');},data),'failed');
});
test('share controls and truthful status messages have copy in all six interface languages',()=>{
  for(const lang of ['ko','zh','ja','en','es','fr'])for(const key of ['shareArtist','shareHelp','shareKakao','shareNaver','shareFacebook','shareInstagram','shareCopy','shareNative','shareUrl','sharePlatformNote','shareMessage','shareWindow','shareCopied','shareKakaoCopied','shareInstagramCopied','shareCopyFailed','shareUnsupported','shareCancelled','shareFailed','shareHandedOff'])assert.ok(ownedText(key,lang)?.length,key+' '+lang);
});
test('artist entry points are allowlisted, do not auto-play, and include sharing in the keyboard trap',async()=>{
  const ui=await readFile(new URL('../public/share-ui.js',import.meta.url),'utf8');
  assert.match(ui,/ARTISTS\.some\(a=>a\.name===requested\)/);assert.match(ui,/openSingerDetail\(requested\)/);assert.doesNotMatch(ui,/playVideo|playSinger|localStorage|driveData|fetch\(/);
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/shareArtistHTML\(name\)/);assert.match(html,/button:not\(\[disabled\]\),summary,input/);assert.doesNotMatch(html,/function shareKakao|function copyLink|function shareNative/);
  assert.match(html,/var publicUrl = location\.origin \+ '\/singer\/' \+ encodeURIComponent\(name\)/,'the share URL is present when the artist form is created, not only after a deferred toggle event');
});
