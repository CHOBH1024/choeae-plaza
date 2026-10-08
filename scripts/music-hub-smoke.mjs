import {ownedText} from '../public/locale-copy.js';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
const base=process.argv[2]||'http://127.0.0.1:8788';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
// Keep the original Korean regression deterministic; locale behavior has separate cases below.
await context.route('**/api/locale',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({lang:'ko',reason:'country'})}));
await context.route('https://api.pomyjo.com/**',route=>{
  const path=new URL(route.request().url()).pathname;
  const body=path.endsWith('/feed')?{artists:{BTS:[{videoId:'AbCdEf12345',title:'BTS 공개 무대',kind:'live'},{videoId:'ZyXwVu98765',title:'BTS 직캠',kind:'live'}]}}:
    path.endsWith('/popular')?{popular:[]}:path.endsWith('/news')?{news:[]}:path.endsWith('/rank')?{ranking:[]}:path.includes('drive')?{ok:false}:{comments:[],sns:[],news:[]};
  return route.fulfill({status:path.includes('drive')?401:200,contentType:'application/json',body:JSON.stringify(body)});
});
await context.route('**/api/popular-videos?*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:[]})}));
await context.route('**/api/fancams?*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,generatedAt:'2026-10-08T01:00:00Z',items:[{videoId:'QwErTy12345',title:'BTS 자동검색 직캠',channelTitle:'test channel'}]})}));
let instagramConfigured=false;
await context.route('**/api/instagram?*',r=>r.fulfill({status:instagramConfigured?200:503,contentType:'application/json',body:JSON.stringify(instagramConfigured?{ok:true,items:[{permalink:'https://www.instagram.com/reel/test123/',type:'VIDEO',published:'2026-10-01T00:00:00Z'}]}:{ok:false,error:'INSTAGRAM_NOT_CONFIGURED'})}));
for(const url of ['https://www.youtube.com/iframe_api','https://pagead2.googlesyndication.com/**','https://fonts.googleapis.com/**','https://fonts.gstatic.com/**','https://i.ytimg.com/**']) await context.route(url,r=>r.abort());
async function chooseView(mode) {
  const button=page.locator('[data-experience="'+mode+'"][data-act]');
  if(!await button.isVisible()) await page.locator('#mobileSettingsToggle').click();
  await button.click();
  await page.waitForFunction(m=>document.documentElement.dataset.experience===m,mode);
}
async function chooseLocale(lang) {
  if(!await page.locator('#localeSelect').isVisible()) await page.locator('#mobileSettingsToggle').click();
  await page.locator('#localeSelect').selectOption(lang);
  if(await page.locator('#mobileDisplaySettings').evaluate(e=>e.open)) {
    const clipped=await page.locator('#mobileDisplaySettingsBody button,#localeSelect').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}).map(n=>n.textContent));
    assert.deepEqual(clipped,[],lang+' expanded settings controls stay on screen');
    await page.locator('#mobileSettingsToggle').click();
  }
}
async function audit(label) {
  const violations=await page.evaluate(async()=>{
    const report=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','best-practice']}});
    return report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,reason:n.failureSummary}))}));
  });
  assert.deepEqual(violations,[],label+': '+JSON.stringify(violations));
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1;}).slice(0,8).map(e=>({tag:e.tagName,id:e.id,class:e.className,right:e.getBoundingClientRect().right}))}));
  assert.ok(metrics.scroll<=metrics.width+1,label+' overflow '+JSON.stringify(metrics));
}
try {
  for(const width of [320,375,390,430,768,1024,1440]) {
    await page.setViewportSize({width,height:960});
    await page.goto(new URL('/?view=idol',base).href);
    await page.waitForFunction(()=>document.documentElement.dataset.experience==='idol');
    await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
    assert.equal(await page.locator('[data-experience="idol"][data-act]').getAttribute('aria-pressed'),'true');
    assert.ok((await page.locator('#singerGrid .name').allTextContents()).includes('BTS'));
    assert.ok(!(await page.locator('#singerGrid .name').allTextContents()).includes('임영웅'));
    if(width<=900){
      assert.ok(await page.locator('.appbar').evaluate(e=>e.getBoundingClientRect().height<=72),'single-row mobile header');
      assert.equal(await page.locator('#localeTools').isVisible(),false,'settings do not displace discovery content');
      await page.locator('#mobileSettingsToggle').click();
      assert.equal(await page.locator('#localeSelect').isVisible(),true);
      await audit(width+' mobile settings');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'mobileSettingsToggle');
      assert.equal(await page.locator('#localeSelect').isVisible(),false);
      const small=await page.locator('#singerGrid .name,#singerGrid .cat,#singerGrid .btn,.tab-btn').evaluateAll(nodes=>nodes.filter(n=>parseFloat(getComputedStyle(n).fontSize)<13).map(n=>n.className));
      assert.deepEqual(small,[],'readable mobile type');
      const targets=await page.locator('#headerTools .fs-btn:not([data-act="font"]),#mobileSettingsToggle,.tab-btn,#singerGrid .btn').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width<44||r.height<44;}).map(n=>n.className));
      assert.deepEqual(targets,[],'44px touch targets');
    }

    for(const theme of ['dark','light']) {
      const current=await page.locator('html').getAttribute('data-theme');
      if((current==='dark')!==(theme==='dark')) await page.locator('#themeBtn').click();
      await audit(width+' '+theme+' artists');
      assert.equal(await page.locator('[data-act="font"][data-level="2"]').isVisible(),false);
      await chooseView('classic');
      await page.locator('[data-act="font"][data-level="2"]').click();
      await chooseView('idol');
      assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).fontSize),'18px');
      await audit(width+' '+theme+' large type');
      await chooseView('classic');
      assert.equal(await page.locator('[data-act="font"][data-level="2"]').getAttribute('aria-pressed'),'true');
      await page.locator('[data-act="font"][data-level="0"]').click();
      await chooseView('idol');
      await page.locator('[data-act="open-singer"][data-name="BTS"]').click();
      if(instagramConfigured) await page.locator('#mdInstagram a[href="https://www.instagram.com/reel/test123/"]').waitFor();
      else {await page.locator('#mdInstagram').getByText('이 가수의 Instagram 게시물 API는 아직 연결되지 않았어요. 계정 검색과 실제 게시물 수집은 다릅니다.').waitFor();instagramConfigured=true;}
      await audit(width+' '+theme+' artist detail');
      await page.locator('#mdFancams [data-vid="QwErTy12345"]').waitFor();
      assert.match(await page.locator('#mdFancams').textContent(),/YouTube 검색 · 최신순/);
      assert.equal(await page.locator('#singerBox a[data-song="Spring Day"]').getAttribute('href'),'https://music.youtube.com/search?q=BTS%20Spring%20Day');
      await page.locator('#vfilter button[data-kind="fancam"]').click();
      assert.equal(await page.locator('#vfilter button[data-kind="fancam"]').getAttribute('aria-pressed'),'true');
      assert.deepEqual(await page.locator('#vidList [data-act="play-video"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.vid)),['ZyXwVu98765']);
      assert.match(await page.locator('#vidList').textContent(),/제목 또는 분류/);
      assert.equal(await page.locator('#vidList a').getAttribute('href'),'https://www.youtube.com/results?search_query=BTS%20%EC%A7%81%EC%BA%A0%20fancam');
      await audit(width+' '+theme+' fancam detail');
      await page.locator('#mdFancams [data-act="play-video"]').click();
      assert.equal(await page.locator('#singerModal').isVisible(),false,'artist overlay cannot cover playback controls');
      assert.equal(await page.locator('#playerBar').isVisible(),true);
      assert.equal(await page.locator('#pbTitle').textContent(),'BTS 자동검색 직캠');
      if(width<=900){
        const geometry=await page.evaluate(()=>({player:document.getElementById('playerBar').getBoundingClientRect().toJSON(),nav:document.querySelector('.tabbar').getBoundingClientRect().toJSON(),video:document.querySelector('.pv').getBoundingClientRect().toJSON()}));
        assert.ok(geometry.player.bottom<=geometry.nav.top+1,'player cannot cover navigation');
        assert.ok(geometry.video.width>=200&&geometry.video.height>=200,'visible YouTube minimum viewport');
        await audit(width+' mobile player');
      }

      assert.equal(await page.evaluate(()=>document.activeElement.id),'playerBar');
      await page.locator('[data-act="p-close"]').click();
      await page.locator('#tab-music').click();
      assert.ok(!(await page.locator('#chartList .t2').allTextContents()).includes('임영웅'));
      await audit(width+' '+theme+' music');
      await page.locator('#tab-news').click();
      await audit(width+' '+theme+' news');
      await page.locator('#tab-play').click();
      await audit(width+' '+theme+' fan lounge');
      assert.equal(await page.locator('#quizHeading').textContent(),'가수 퀴즈 — 얼마나 알고 있나요?');
      await page.locator('#tab-singer').click();
      await page.locator('[data-act="drive"]').click();
      await audit(width+' '+theme+' storage');
      await page.locator('[data-act="close-drive"]').click();
      await page.locator('#installApp').click();
      assert.equal(await page.locator('.install-dialog').isVisible(),true);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'installHeading','long guide opens at its heading, not scrolled to the close button');
      assert.match(await page.locator('.install-dialog').textContent(),/아이폰·아이패드/);
      assert.match(await page.locator('.install-dialog').textContent(),/안드로이드/);
      await audit(width+' '+theme+' install guide');
      await page.locator('#installClose').click();
      assert.equal(await page.locator('.install-dialog').isVisible(),false);
    }
    await chooseView('classic');
    assert.equal(await page.locator('html').getAttribute('data-experience'),'classic');
    assert.ok((await page.locator('#singerGrid .name').allTextContents()).includes('임영웅'));
    assert.equal(new URL(page.url()).searchParams.has('view'),false);
    await chooseView('idol');
    assert.equal(new URL(page.url()).searchParams.get('view'),'idol');
    await page.reload();
    assert.equal(await page.locator('[data-act="genre"][data-genre="idol"]').getAttribute('aria-pressed'),'true');
    if(width===1440 && process.env.CHOEAE_HUB_PROOF_PATH) await page.screenshot({path:resolve(process.env.CHOEAE_HUB_PROOF_PATH),fullPage:false});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#singerGrid [data-act="open-singer"][data-name="BTS"]').click();
  await page.locator('#singerBox .drive-fav').click();
  await page.locator('[data-act="close-singer"]').click();
  assert.deepEqual(await page.locator('#hubFavoriteGrid .name').allTextContents(),['BTS']);
  await page.reload();
  assert.deepEqual(await page.locator('#hubFavoriteGrid .name').allTextContents(),['BTS']);
  await page.locator('#tab-music').click();
  assert.equal(await page.locator('#panel-music').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.equal(await page.locator('#tab-music').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  await page.locator('#tab-singer').click();
  await page.locator('#singerGrid .cover').first().focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');
  assert.equal(await page.locator('#shareHeading').textContent(),'좋은 취향은 함께 나눠요');
  await chooseView('classic');
  assert.equal(await page.locator('#shareHeading').textContent(),'가족·친구에게 알려주세요');
  // The preceding reload created a new document; restore the auditor before language cases.
  await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
  for(const width of [320,375,1440]){
    await page.setViewportSize({width,height:960});
    for(const mode of ['idol','classic']){
      await chooseView(mode);
      for(const [lang,label] of [['zh','音乐'],['ja','音楽'],['en','Music'],['es','Música'],['fr','Musique']]){
        await chooseLocale(lang);
        await page.waitForFunction(l=>document.documentElement.dataset.locale===l,lang);
        assert.equal(await page.locator('#tab-music').textContent(),label);
        assert.equal(await page.locator('#tab-music').getAttribute('lang'),lang);
        assert.equal(await page.locator('html').getAttribute('lang'),'ko','untranslated content retains its actual language');
        assert.equal(await page.locator('#searchInput').getAttribute('placeholder'),ownedText(mode==='idol'?'searchIdol':'searchClassic',lang));
        assert.equal(await page.locator('#searchHelp').textContent(),ownedText('searchHelp',lang));
        assert.equal(await page.locator('#moreSingers').textContent(),ownedText('moreArtists',lang));
        const artistNames=await page.locator('#singerGrid .name').allTextContents();
        assert.ok(artistNames.includes(mode==='idol'?'BTS':'임영웅'),'provider artist names remain unchanged');
        for(const theme of ['dark','light']){
          const current=await page.locator('html').getAttribute('data-theme');
          if((current==='dark')!==(theme==='dark')) await page.locator('#themeBtn').click();
          await audit(width+' '+mode+' '+lang+' '+theme+' locale');
          await page.locator('#installApp').click();
          assert.equal(await page.locator('#installHeading').textContent(),ownedText('installTitle',lang));
          assert.equal(await page.evaluate(()=>document.activeElement.id),'installHeading');
          const guidePosition=await page.locator('.install-dialog').evaluate(e=>({scroll:e.scrollTop,rect:e.getBoundingClientRect().toJSON()}));
          assert.equal(guidePosition.scroll,0,'install instructions start at the top');
          assert.ok(guidePosition.rect.left>=8 && guidePosition.rect.right<=width-8,'guide stays inset and centered');
          assert.equal(await page.locator('.install-dialog [data-i18n=installIntro]').textContent(),ownedText('installIntro',lang));
          assert.equal(await page.locator('#installClose').textContent(),ownedText('close',lang));
          await audit(width+' '+mode+' '+lang+' '+theme+' install translation');
          await page.locator('#installClose').click();
          assert.equal(await page.evaluate(()=>document.activeElement.id),'installApp');
        }
        const clipped=await page.locator('.tab-btn').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1 || n.scrollHeight>n.clientHeight+1).map(n=>n.id));
        assert.deepEqual(clipped,[],lang+' navigation labels clipped');
        // Closed native <details> retain internal layout rectangles in Chromium.
        // Audit those controls while expanded above, and only rendered controls here.
        const offscreen=await page.locator('#headerTools button:visible,.experience-switch button:visible,.tab-btn:visible').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width>0 && (r.left<0 || r.right>innerWidth+1);}).map(n=>n.textContent));
        assert.deepEqual(offscreen,[],width+' '+mode+' '+lang+' visible header controls offscreen');
      }
    }
  }
  await page.reload();
  await page.waitForFunction(()=>document.documentElement.dataset.locale==='fr');
  assert.equal(await page.locator('#localeSelect').inputValue(),'fr','manual choice survives reload and country response');
  await chooseLocale('auto');
  await page.waitForFunction(()=>document.documentElement.dataset.locale==='ko');
  assert.equal(await page.evaluate(()=>localStorage.getItem('choeae_locale')),null);
  assert.deepEqual(errors,[]);
  console.log('Music hub passed: 320/375/390/430/768/1024/1440px, light/dark, large type, artist/music/storage, view switching/reload, 5 additional menu languages in both views.');
} finally {await browser.close();}
