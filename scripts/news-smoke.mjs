import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {ownedText} from '../public/locale-copy.js';
const base=process.argv[2]||'http://127.0.0.1:8788';
const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage();
const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));let mode='ready',held=[];
await context.route('**/api/locale',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({lang:'ko'})}));
await context.route('https://api.pomyjo.com/**',async r=>{
  const u=new URL(r.request().url()),source=u.pathname.split('/').pop(),name=u.searchParams.get('name');
  if(['news','naver','sns'].includes(source)){
    calls.push({source,name});if(mode==='held'&&name==='BTS')await new Promise(resolve=>held.push(resolve));
    return r.fulfill({status:mode==='error'?503:200,contentType:'application/json',body:JSON.stringify(mode==='malformed'?{}:{[source==='sns'?'sns':'news']:mode==='empty'?[]:[{title:name+' <img src=x onerror=alert(1)> '+source,link:'https://news.example.test/'+encodeURIComponent(name)+'/'+source,date:'2026-10-09',singer:name}]})});
  }
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(source==='feed'?{artists:{}}:source==='popular'?{popular:[]}:{news:[],sns:[],comments:[],rank:[]})});
});
for(const url of ['https://www.youtube.com/**','https://pagead2.googlesyndication.com/**','https://fonts.googleapis.com/**','https://fonts.gstatic.com/**','https://i.ytimg.com/**'])await context.route(url,r=>r.abort());
async function settings(action){if(!await page.locator('#localeSelect').isVisible())await page.locator('#mobileSettingsToggle').click();await action();if(await page.locator('#mobileDisplaySettings').evaluate(el=>el.open))await page.locator('#mobileSettingsToggle').click();}
async function ready(){await page.locator('#newsStatus[data-i18n="newsReady"]').waitFor();}
try{
  for(const width of [320,390,1440])for(const view of ['idol','classic']){
    await page.setViewportSize({width,height:900});const start=calls.length;await page.goto(new URL(view==='idol'?'/':'/trot',base).href,{waitUntil:'domcontentloaded'});await page.locator('#tab-news').click();await ready();
    const allowed=view==='idol'?['BTS','블랙핑크','뉴진스','아이브','에스파']:['임영웅','영탁','이찬원','장민호','김호중'];
    assert.deepEqual(new Set(calls.slice(start).map(x=>x.name)),new Set(allowed));assert.equal(calls.slice(start).length,10);assert.equal(await page.locator('#newsBody img').count(),0);
    const name=view==='idol'?'아이유':'송가인';await page.locator('#newsArtist').selectOption(name);await ready();
    assert.equal(await page.locator('#newsBody .news-wrap').count(),2);assert.ok((await page.locator('#newsBody .nt').allTextContents()).every(t=>t.includes(name)));
    if(view==='classic')await page.locator('[data-act="font"][data-level="2"]').click();await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
    for(const lang of ['ko','zh','ja','en','es','fr']){
      await settings(()=>page.locator('#localeSelect').selectOption(lang));assert.equal(await page.locator('.news-scope summary').textContent(),ownedText('newsScopeHeading',lang));
      for(const theme of ['dark','light']){
        if((await page.locator('html').getAttribute('data-theme')==='dark')!==(theme==='dark'))await page.locator('#themeBtn').click();
        const audit=await page.evaluate(async()=>{const r=await axe.run(document.getElementById('panel-news'));return r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target),details:v.nodes.map(n=>n.failureSummary)}));});assert.deepEqual(audit,[],width+' '+view+' '+lang+' '+theme);
        const bounds=await page.locator('#panel-news').evaluate(el=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:Array.from(el.querySelectorAll('*')).filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}).map(n=>n.outerHTML.slice(0,140))}));assert.ok(bounds.scroll<=bounds.width+1,JSON.stringify(bounds));assert.deepEqual(bounds.overflow,[],JSON.stringify(bounds));
      }
    }
    await page.locator('#newsBody [data-act="open-news"]').first().click();await page.locator('#newsModal').waitFor({state:'visible'});assert.match(await page.locator('#newsModalBody').textContent(),new RegExp(name));
    assert.equal(await page.locator('#newsModalBody a').getAttribute('href'),'https://news.example.test/'+encodeURIComponent(name)+'/naver');
    const modalAudit=await page.evaluate(async()=>{const r=await axe.run(document.getElementById('newsModal'));return r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));});assert.deepEqual(modalAudit,[]);
    await page.locator('#newsModal .md-close').click();await page.locator('[data-act="news-tab"][data-which="sns"]').click();await ready();assert.equal(await page.locator('#newsBody .news-wrap').count(),1);assert.equal(calls.at(-1).name,name);assert.equal(calls.at(-1).source,'sns');
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#tab-news').click();await ready();
  await page.locator('#newsArtist').selectOption('BTS');await ready();mode='error';await page.locator('#newsRefresh').click();await page.locator('#newsStatus[data-i18n="newsErrorCached"]').waitFor();assert.equal(await page.locator('#newsBody .news-wrap').count(),2);
  mode='empty';await page.locator('#newsRefresh').click();await page.locator('#newsStatus[data-i18n="newsEmpty"]').waitFor();assert.equal(await page.locator('#newsBody .news-wrap').count(),0);
  mode='malformed';await page.locator('#newsRefresh').click();await page.locator('#newsStatus[data-i18n="newsError"]').waitFor();assert.equal(await page.locator('#newsBody .news-wrap').count(),0);
  mode='held';await page.locator('#newsRefresh').click();await page.locator('#newsStatus[data-i18n="newsLoading"]').waitFor();assert.equal(await page.locator('#newsRefresh').isEnabled(),false);
  for(let i=0;i<100&&held.length<2;i++)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(held.length,2,'Both delayed fixture requests must have arrived');
  await page.locator('#newsArtist').selectOption('에스파');await ready();held.forEach(release=>release());mode='ready';await page.locator('#newsArtist').selectOption('BTS');await ready();await page.locator('#newsArtist').selectOption('에스파');await ready();assert.ok((await page.locator('#newsBody .nt').allTextContents()).every(t=>t.includes('에스파')));
  assert.deepEqual(errors,[]);console.log('News scope passed: first-five overview, all registered artist choices, separate topic requests, original modal links, empty/error/cache/race states; 320/390/1440px x views x six languages x themes, large trot type, no injected images or overflow; all API traffic mocked.');
}finally{await browser.close();}
