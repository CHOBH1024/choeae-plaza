import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.argv[2]||'http://127.0.0.1:8788';
const origin=new URL(base).origin;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({serviceWorkers:'allow'});
const page=await context.newPage();
let networkDown=false;const disconnectedRequests=[];
// This isolated context never reaches production content or a real account.
await context.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==origin)return route.abort();
  // Also fail actual worker-owned network requests. In pinned Chromium/PW,
  // offline emulation alone did not persist across successive navigations.
  // This gates the network, not app fetch(), worker code, or HTML responses.
  if(networkDown){disconnectedRequests.push({path:url.pathname,worker:!!request.serviceWorker()});return route.abort('internetdisconnected');}
  return route.continue();
});
try{
  await page.goto(new URL('/',base).href,{waitUntil:'domcontentloaded'});
  const manifestURL=await page.locator('#pwaManifest').getAttribute('href');
  assert.match(manifestURL,/^\/manifest-idol\.json\?v=20261009-library$/);
  const manifestResponse=await context.request.get(new URL(manifestURL,base).href);
  assert.equal(manifestResponse.status(),200);
  const manifest=await manifestResponse.json();assert.equal(manifest.start_url,'/');
  assert.deepEqual(manifest.icons,[{src:'/choeae-icon-512-v1.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]);
  assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'),'/choeae-icon-v1.svg');
  assert.equal(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'),'/choeae-apple-180-v1.png');
  for(const [path,width,height] of [['/choeae-icon-512-v1.png',512,512],['/choeae-apple-180-v1.png',180,180],['/choeae-og-v1.png',1200,630]]){
    const response=await context.request.get(new URL(path,base).href),png=await response.body();
    assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/^image\/png/);
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
  }
  const iconResponse=await context.request.get(new URL('/choeae-icon-v1.svg',base).href);
  assert.equal(iconResponse.status(),200);assert.match(iconResponse.headers()['content-type'],/^image\/svg\+xml/);
  assert.match(await iconResponse.text(),/<title id="title">최애광장<\/title>/);
  console.log('Brand runtime passed: actual idol manifest, shared 512px icon, Apple 180px icon, 1200x630 share image and SVG favicon served successfully.');
  await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.active,null,{timeout:10000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:10000});
  assert.deepEqual(await page.evaluate(()=>caches.keys()),[]);
  networkDown=true;
  await context.setOffline(true);
  for(const path of ['/','/trot','/discover?singer=BTS','/discover/?view=classic&singer=BTS','/blogs.html?name=BTS']){
    const before=disconnectedRequests.length;
    const response=await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded'});
    const failures=disconnectedRequests.slice(before);
    console.log(JSON.stringify({path,status:response.status(),fromWorker:response.fromServiceWorker(),failedRequests:failures}));
    assert.equal(response.status(),503,path+' has an explicit connection failure');
    assert.equal(response.fromServiceWorker(),true,path+' uses the actual app worker');
    assert.ok(failures.some(r=>r.worker&&r.path===new URL(path,base).pathname),path+' fails the actual worker-owned network request');
    assert.equal(response.headers()['cache-control'],'no-store');
    await page.getByRole('heading',{name:'인터넷 연결을 확인해주세요',exact:true}).waitFor();
    assert.doesNotMatch(await page.locator('main').innerText(),/BTS|검색결과|게시물/);
    assert.equal(await page.locator('iframe').count(),0);
    assert.deepEqual(await page.evaluate(()=>caches.keys()),[]);
  }
  const apiFailure=await page.evaluate(async()=>{try{await fetch('/api/blog?name=BTS');return false;}catch{return true;}});
  assert.equal(apiFailure,true,'offline APIs are not replaced with a successful HTML/result response');
  networkDown=false;
  await context.setOffline(false);
  const recovered=await page.goto(new URL('/discover',base).href,{waitUntil:'domcontentloaded'});
  assert.equal(recovered.status(),200);
  await page.locator('#main').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-blog-enabled'),'true');
  assert.equal(await page.locator('script[src*="googlesyndication.com"]').count(),0);
  assert.deepEqual(await page.evaluate(()=>caches.keys()),[]);
  console.log('App worker runtime passed: real registration/control, offline 503/no-store across home/trot/discover/blog routes, no cached results or API fallback, online recovery; isolated browser with external traffic blocked.');
}finally{await context.close();await browser.close();}
