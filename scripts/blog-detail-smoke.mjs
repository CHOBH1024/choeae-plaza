import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {ownedText,ownedParamText} from '../public/locale-copy.js';
const base=process.argv[2]||'http://127.0.0.1:8788';
const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage();
const errors=[],calls=[],held=[];let mode='ready';page.on('pageerror',e=>errors.push(e.message));
await context.route('**/api/locale',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({lang:'ko'})}));
await context.route('https://api.pomyjo.com/**',r=>{const source=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(source==='feed'?{artists:{}}:{news:[],sns:[],comments:[],rank:[],popular:[]})});});
await context.route('**/api/blog?*',async r=>{
  const u=new URL(r.request().url()),name=u.searchParams.get('name'),sort=u.searchParams.get('sort');calls.push({name,sort});if(mode==='held')await new Promise(resolve=>held.push(resolve));
  const items=[{title:name+' <b>검색</b> &lt;img src=x onerror=alert(1)&gt;',link:'https://fan.tistory.com/1',bloggername:'팬',postdate:'20261008',description:'외부 블로그의 검색 미리보기'},{title:name+' 두 번째 결과',link:'http://openapi.naver.com/l?x=1',postdate:'20261009'}];
  return r.fulfill({status:mode==='setup'?503:mode==='error'?502:200,contentType:'application/json',body:JSON.stringify(mode==='setup'?{ok:false,error:'NAVER_SEARCH_NOT_CONFIGURED'}:mode==='malformed'?{}:{ok:true,sort,items:mode==='empty'?[]:items})});
});
for(const url of ['https://www.youtube.com/**','https://pagead2.googlesyndication.com/**','https://fonts.googleapis.com/**','https://fonts.gstatic.com/**','https://i.ytimg.com/**'])await context.route(url,r=>r.abort());
async function settings(action){if(!await page.locator('#localeSelect').isVisible())await page.locator('#mobileSettingsToggle').click();await action();if(await page.locator('#mobileDisplaySettings').evaluate(el=>el.open))await page.locator('#mobileSettingsToggle').click();}
async function loaded(text=/검색결과 2건/){await page.locator('[data-blog-status]').filter({hasText:text}).waitFor();}
try{
  // The published home keeps its existing ad tag and offers a link, not inline API output.
  await page.goto(base);await page.getByRole('button',{name:'BTS 노래·소식 더보기',exact:true}).click();
  assert.equal(await page.locator('script[src*="googlesyndication.com"]').count(),1);assert.equal(await page.locator('#mdBlogInline').count(),0);assert.equal(calls.length,0);
  assert.equal(await page.locator('#mdBlogs a[href^="/discover"]').getAttribute('href'),'/discover?singer=BTS');await page.locator('#singerBox .md-close').click();
  for(const width of [320,390,1440])for(const view of ['idol','classic']){
    await page.setViewportSize({width,height:900});const name=view==='idol'?'BTS':'임영웅';await page.goto(new URL('/discover?singer='+encodeURIComponent(name)+(view==='classic'?'&view=classic':''),base).href);
    await page.locator('#singerModal').waitFor({state:'visible'});assert.equal(await page.locator('html').getAttribute('data-blog-enabled'),'true');assert.equal(await page.locator('script[src*="googlesyndication.com"]').count(),0);assert.equal(await page.locator('html').getAttribute('data-experience'),view);
    await page.locator('#singerBox .md-close').click();await settings(()=>page.locator('#localeSelect').selectOption('ko'));await page.locator('#singerGrid [data-act="open-singer"][data-name="'+name+'"]').click();
    await page.locator('[data-act="detail-jump"][data-target="detail-blogs"]').click();await loaded();assert.equal(await page.locator('.artist-blog-card').count(),2);assert.equal(await page.locator('#mdBlogInline img,#mdBlogInline [data-act="save-article"]').count(),0);
    assert.equal(await page.locator('.artist-blog-card a').nth(1).getAttribute('href'),'http://openapi.naver.com/l?x=1');assert.match(await page.locator('.artist-blog-card').first().innerText(),/2026-10-08/);
    if(view==='classic')await page.locator('#singerBox .md-close').click(),await page.locator('[data-act="font"][data-level="2"]').click(),await page.getByRole('button',{name:'임영웅 노래·소식 더보기',exact:true}).click(),await page.locator('[data-act="detail-jump"][data-target="detail-blogs"]').click(),await loaded();
    await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
    for(const lang of ['ko','zh','ja','en','es','fr']){
      // Settings are outside the modal; close/reopen without saving any API output.
      await page.locator('#singerBox .md-close').click();await settings(()=>page.locator('#localeSelect').selectOption(lang));
      await page.locator('#singerGrid [data-act="open-singer"][data-name="'+name+'"]').click();await page.locator('[data-act="detail-jump"][data-target="detail-blogs"]').click();await loaded(ownedParamText('blogReady',lang,{count:2}));
      for(const theme of ['dark','light']){
        await page.locator('#singerBox .md-close').click();if((await page.locator('html').getAttribute('data-theme')==='dark')!==(theme==='dark'))await page.locator('#themeBtn').click();
        await page.locator('#singerGrid [data-act="open-singer"][data-name="'+name+'"]').click();await page.locator('[data-act="detail-jump"][data-target="detail-blogs"]').click();await loaded(ownedParamText('blogReady',lang,{count:2}));
        await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a instanceof CSSTransition).map(a=>a.finished.catch(()=>{}))));
        const violations=await page.evaluate(async()=>{const r=await axe.run(document.getElementById('mdBlogInline'));return r.violations.map(v=>({id:v.id,details:v.nodes.map(n=>n.failureSummary)}));});assert.deepEqual(violations,[],width+' '+view+' '+lang+' '+theme);
        const bounds=await page.locator('#mdBlogInline').evaluate(el=>({width:innerWidth,overflow:Array.from(el.querySelectorAll('*')).filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}).map(n=>n.tagName)}));assert.deepEqual(bounds.overflow,[],JSON.stringify(bounds));
      }
    }
    await page.locator('[data-blog-sort]').selectOption('sim');await loaded(ownedParamText('blogReady','fr',{count:2}));assert.equal(calls.at(-1).sort,'sim');assert.equal(calls.at(-1).name,name);assert.ok((await page.url()).includes('/discover'));
  }
  await page.goto(new URL('/discover?singer=BTS',base).href);await page.locator('[data-act="detail-jump"][data-target="detail-blogs"]').click();await loaded(ownedParamText('blogReady','fr',{count:2}));
  for(const [state,key] of [['setup','blogNotConfigured'],['error','blogError'],['malformed','blogError'],['empty','blogEmpty']]){mode=state;await page.locator('[data-blog-load]').click();await page.locator('[data-blog-status]').filter({hasText:ownedText(key,'fr')}).waitFor();assert.equal(await page.locator('.artist-blog-card').count(),0);}
  mode='held';await page.locator('[data-blog-load]').click();await page.locator('[data-blog-results][aria-busy="true"]').waitFor();assert.equal(await page.locator('[data-blog-load]').isEnabled(),false);
  for(let i=0;i<100&&!held.length;i++)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(held.length,1);
  await page.locator('#singerBox .md-close').click();held.forEach(fn=>fn());mode='ready';await page.locator('#singerGrid [data-act="open-singer"][data-name="에스파"]').click();await page.locator('[data-act="detail-jump"][data-target="detail-blogs"]').click();await loaded(ownedParamText('blogReady','fr',{count:2}));assert.ok((await page.locator('.artist-blog-title').allTextContents()).every(t=>t.includes('에스파')));
  assert.deepEqual(errors,[]);console.log('Ad-free inline blogs passed: root ad preserved with no inline API; discover auto artist entry, separate views, Naver source order/HTTP originals/text safety, six-language 320/390/1440px theme/large-type accessibility, failures/empty/retry/cancellation and no result saving; all APIs mocked.');
}finally{await browser.close();}
