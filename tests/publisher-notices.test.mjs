import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('publisher notices explain cookies and opt-outs without claiming ad approval or completed CMP',async()=>{
  const html=await readFile(new URL('../public/privacy.html',import.meta.url),'utf8');
  for(const value of ['다른 웹사이트를 방문한 기록','웹 비콘','IP 주소','브라우저 식별자','https://myadcenter.google.com/','https://www.aboutads.info/choices/','설정·검증이 완료되었다는 안내가 아닙니다'])assert.ok(html.includes(value),value);
  assert.doesNotMatch(html,/adsbygoogle|googlesyndication/);
});
test('public editorial policy is linked, ad-free, noindex and distinguishes sources from owned commentary',async()=>{
  const about=await readFile(new URL('../public/about.html',import.meta.url),'utf8'),home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(home,/href="\/about.html"/);assert.match(about,/noindex, nofollow/);assert.doesNotMatch(about,/adsbygoogle|googlesyndication/);
  for(const value of ['편집 의견','자료 확인일','원본 화보 사진','광고 클릭을 요청하거나','malrang1024@gmail.com','실제 게시물 연동'])assert.ok(about.includes(value),value);
  assert.doesNotMatch(about,/90점|반드시 승인|승인 완료|nokira1024/);
});
