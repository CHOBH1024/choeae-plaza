import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('publisher notices say advertising is disabled on Choeae Plaza',async()=>{
  const html=await readFile(new URL('../public/privacy.html',import.meta.url),'utf8');
  for(const value of ['Google AdSense를 포함한 광고 태그를 설치하지 않았으며 광고를 게재하지 않습니다','POMYJO 메인 사이트에서 별도로 운영합니다'])assert.ok(html.includes(value),value);
  assert.doesNotMatch(html,/adsbygoogle|googlesyndication/);
  assert.doesNotMatch(html,/myadcenter\.google\.com|aboutads\.info/);
});
test('public editorial policy is linked, ad-free, noindex and distinguishes sources from owned commentary',async()=>{
  const about=await readFile(new URL('../public/about.html',import.meta.url),'utf8'),home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(home,/href="\/about.html"/);assert.match(about,/noindex, nofollow/);assert.doesNotMatch(about,/adsbygoogle|googlesyndication/);
  for(const value of ['편집 의견','자료 확인일','원본 화보 사진','광고 태그를 설치하지 않았으며 광고를 게재하지 않습니다','malrang1024@gmail.com','실제 게시물 연동'])assert.ok(about.includes(value),value);
  assert.doesNotMatch(about,/90점|반드시 승인|승인 완료|nokira1024/);
});
test('Instagram disclosure matches the bounded API preview rather than claiming complete collection',async()=>{
  const html=await readFile(new URL('../public/privacy.html',import.meta.url),'utf8');
  for(const phrase of ['최대 6개','최대 240자','원문 링크','DM·개인 계정·전체 게시물 수집','실제 계정 연결은 확인되지 않았습니다'])assert.ok(html.includes(phrase));
  assert.ok(html.indexOf('Instagram 공식 게시물')<html.indexOf('5. 쿠키 및 로컬 저장소'),'provider data handling sits in the external service section');
});
