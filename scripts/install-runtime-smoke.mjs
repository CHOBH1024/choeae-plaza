import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.argv[2]||'http://127.0.0.1:8788';
const origin=new URL(base).origin;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({serviceWorkers:'allow'});
const page=await context.newPage();
// This isolated context never reaches production content or a real account.
await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
try{
  await page.goto(new URL('/',base).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.active,null,{timeout:10000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:10000});
  assert.deepEqual(await page.evaluate(()=>caches.keys()),[]);
  await context.setOffline(true);
  for(const path of ['/','/trot','/discover?singer=BTS','/discover/?view=classic&singer=BTS','/blogs.html?name=BTS']){
    const response=await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded'});
    assert.equal(response.status(),503,path+' has an explicit connection failure');
    assert.equal(response.fromServiceWorker(),true,path+' uses the actual app worker');
    assert.equal(response.headers()['cache-control'],'no-store');
    await page.getByRole('heading',{name:'인터넷 연결을 확인해주세요',exact:true}).waitFor();
    assert.doesNotMatch(await page.locator('main').innerText(),/BTS|검색결과|게시물/);
    assert.equal(await page.locator('iframe').count(),0);
    assert.deepEqual(await page.evaluate(()=>caches.keys()),[]);
  }
  const apiFailure=await page.evaluate(async()=>{try{await fetch('/api/blog?name=BTS');return false;}catch{return true;}});
  assert.equal(apiFailure,true,'offline APIs are not replaced with a successful HTML/result response');
  await context.setOffline(false);
  const recovered=await page.goto(new URL('/discover',base).href,{waitUntil:'domcontentloaded'});
  assert.equal(recovered.status(),200);
  await page.locator('#main').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-blog-enabled'),'true');
  assert.equal(await page.locator('script[src*="googlesyndication.com"]').count(),0);
  assert.deepEqual(await page.evaluate(()=>caches.keys()),[]);
  console.log('App worker runtime passed: real registration/control, offline 503/no-store across home/trot/discover/blog routes, no cached results or API fallback, online recovery; isolated browser with external traffic blocked.');
}finally{await context.close();await browser.close();}
