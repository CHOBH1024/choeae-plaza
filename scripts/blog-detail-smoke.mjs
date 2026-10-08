import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {ownedText,ownedParamText} from '../public/locale-copy.js';
const base=process.argv[2]||'http://127.0.0.1:8788';
const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage();
const errors=[],calls=[],held=[];let mode='ready';page.on('pageerror',e=>errors.push(e.message));
await context.route('**/api/locale',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({lang:'ko'})}));
const videoFixtures=Object.fromEntries(['BTS','임영웅','에스파'].map(name=>[name,[
  {videoId:'AbCdEf12345',title:name+' 무대 영상 '+ 'A very long collected video title '.repeat(4),kind:'live'},
  {videoId:'ZyXwVu98765',title:name+' 직캠 '+ 'UnbrokenLongTitle'.repeat(8),kind:'shorts'}
]]));
await context.route('https://api.pomyjo.com/**',r=>{const source=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(source==='feed'?{artists:videoFixtures}:{news:[],sns:[],comments:[],rank:[],popular:[]})});});
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
        const bounds=await page.locator('#mdBlogInline').evaluate(el=>({width:innerWidth,ancestors:[el,el.parentElement,document.getElementById('singerBox')].map(n=>({id:n.id,rect:n.getBoundingClientRect().toJSON(),scrollLeft:n.scrollLeft,scrollWidth:n.scrollWidth,display:getComputedStyle(n).display})),overflow:Array.from(el.querySelectorAll('*')).filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}).map(n=>({tag:n.tagName,rect:n.getBoundingClientRect().toJSON()}))}));assert.deepEqual(bounds.overflow,[],view+' '+lang+' '+theme+' '+JSON.stringify(bounds));
        if(view==='classic'){
          assert.ok(await page.locator('#vidList .vid').count()>0,'Include collected video rows, not an empty feed');
          const pane=await page.locator('#singerBox').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,overflow:Array.from(el.querySelectorAll('*')).filter(n=>{const r=n.getBoundingClientRect(),p=el.getBoundingClientRect();return r.width>0&&(r.left<p.left-1||r.right>p.right+1);}).map(n=>({tag:n.tagName,class:n.className,rect:n.getBoundingClientRect().toJSON()}))}));
          assert.ok(pane.scroll<=pane.client+1,view+' '+width+' '+lang+' '+theme+' '+JSON.stringify(pane));assert.deepEqual(pane.overflow,[],JSON.stringify(pane));
          if(width<=600){
            const targets=await page.locator('#singerBox .vid>.save-label,#singerBox .md-song-row>.save-label').evaluateAll(els=>els.map(n=>n.getBoundingClientRect().toJSON()));assert.ok(targets.length>2);assert.ok(targets.every(r=>r.width>=44&&r.height>=44));
          }
        }
      }
    }
    await page.locator('[data-blog-sort]').selectOption('sim');await loaded(ownedParamText('blogReady','fr',{count:2}));assert.equal(calls.at(-1).sort,'sim');assert.equal(calls.at(-1).name,name);assert.ok((await page.url()).includes('/discover'));
  }
  await page.goto(new URL('/discover?singer=BTS',base).href);await page.locator('[data-act="detail-jump"][data-target="detail-blogs"]').click();await loaded(ownedParamText('blogReady','fr',{count:2}));
  for(let i=0;i<2;i++){
    await page.locator('#singerBox .md-close').click();assert.equal(await page.locator('.artist-blog-card').count(),0);
    // Exercise the real owned player state; provider traffic remains blocked.
    await page.evaluate(()=>playVideo('abcdefghijk','Player fixture'));assert.equal(await page.locator('#playerBar').isVisible(),true);
    await page.locator('#singerGrid [data-act="open-singer"][data-name="BTS"]').click();await page.locator('[data-act="detail-jump"][data-target="detail-blogs"]').click();await loaded(ownedParamText('blogReady','fr',{count:2}));
    assert.equal(await page.locator('#playerBar').isVisible(),false);assert.equal(await page.evaluate(()=>pendingPlay),null);
  }
  for(const [state,key] of [['setup','blogNotConfigured'],['error','blogError'],['malformed','blogError'],['empty','blogEmpty']]){mode=state;await page.locator('[data-blog-load]').click();await page.locator('[data-blog-status]').filter({hasText:ownedText(key,'fr')}).waitFor();assert.equal(await page.locator('.artist-blog-card').count(),0);}
  mode='held';await page.locator('[data-blog-load]').click();await page.locator('[data-blog-results][aria-busy="true"]').waitFor({state:'attached'});assert.equal(await page.locator('[data-blog-load]').isEnabled(),false);
  for(let i=0;i<100&&!held.length;i++)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(held.length,1);
  await page.locator('#singerBox .md-close').click();held.forEach(fn=>fn());mode='ready';await page.locator('#singerGrid [data-act="open-singer"][data-name="에스파"]').click();await page.locator('[data-act="detail-jump"][data-target="detail-blogs"]').click();await loaded(ownedParamText('blogReady','fr',{count:2}));assert.ok((await page.locator('.artist-blog-title').allTextContents()).every(t=>t.includes('에스파')));
  assert.deepEqual(errors,[]);console.log('Inline blogs passed: root ad preserved with no inline API; discover has no publisher ads; auto artist entry, separate views, Naver source order/HTTP originals/text safety, six-language 320/390/1440px theme/large-type accessibility, player hidden and pending play cleared before results, failures/empty/retry/cancellation and no result saving; all APIs mocked.');
}finally{await browser.close();}
