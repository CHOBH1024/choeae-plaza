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
await context.route('**/api/showcase?*',r=>{
  const kind=new URL(r.request().url()).searchParams.get('kind');
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,source:'youtube-search',scope:'artist-'+kind+'-search',order:'date',refreshSeconds:900,generatedAt:new Date().toISOString(),items:[{videoId:kind==='editorial'?'EdItOr12345':'CaMpAi12345',title:'BTS '+(kind==='editorial'?'화보 메이킹':'광고 캠페인'),channelTitle:'test channel',published:'2026-10-01T00:00:00Z'}]})});
});
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
    await page.goto(new URL('/',base).href);
    await page.waitForFunction(()=>document.documentElement.dataset.experience==='idol');
    await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
    assert.equal(await page.locator('[data-experience="idol"][data-act]').getAttribute('aria-pressed'),'true');
    assert.ok((await page.locator('#singerGrid .name').allTextContents()).includes('BTS'));
    assert.ok(!(await page.locator('#singerGrid .name').allTextContents()).includes('임영웅'));
    await page.waitForFunction(()=>!!window.CHOEAE_ARTIST_NAMES);
    for(const [query,name] of [['blackpink','블랙핑크'],['있지','ITZY'],['tomorrow x together','TXT']]){
      await page.locator('#searchInput').fill(query);
      await page.locator('#searchResults [data-act="open-singer"][data-name="'+name+'"]').waitFor();
      assert.equal(await page.locator('#searchResults [data-act="open-singer"]').count(),1,query+' resolves to one artist');
    }
    await page.locator('#searchInput').fill('');
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
      else {
        await page.locator('#mdInstagram').getByText('사이트의 Instagram 계정·권한 연결이 아직 완료되지 않았어요. 아래에서 외부 계정을 찾아볼 수 있습니다.').waitFor();
        assert.equal(await page.locator('#mdInstagram .link-line').getAttribute('href'),'https://www.google.com/search?q='+encodeURIComponent('BTS site:instagram.com'));
        assert.equal(await page.locator('#mdInstagram a[href^="https://www.instagram.com/"]').count(),0,'unconfigured search is not a retrieved Instagram post');
        instagramConfigured=true;
      }
      await audit(width+' '+theme+' artist detail');
      if(width<=900){
        const layout=await page.evaluate(()=>{
          const r=s=>document.querySelector(s).getBoundingClientRect().toJSON();
          return {hero:r('.md-artist-hero'),name:r('#mdName'),play:r('.md-play'),nav:r('.md-bottom-nav'),spotlight:r('.md-spotlight'),music:r('#detail-music'),videos:r('#detail-videos'),close:r('#singerBox .md-close'),playStyle:{width:getComputedStyle(document.querySelector('.md-play')).width,height:getComputedStyle(document.querySelector('.md-play')).height}};
        });
        assert.ok(layout.name.top>=layout.hero.top&&layout.name.bottom<=layout.hero.bottom,'artist title stays inside full-bleed hero');
        assert.ok(layout.close.top>=0&&layout.close.bottom<layout.name.top,'back control remains above artist title');
        assert.deepEqual(layout.playStyle,{width:'68px',height:'68px'},'round primary play control');
        assert.ok(layout.play.width>=44&&layout.play.height>=44,'play control remains a usable touch target during entrance animation');
        assert.ok(layout.nav.bottom<=961&&layout.nav.top>=880,'four-item navigation remains at viewport bottom');
        assert.ok(layout.spotlight.top>=layout.hero.bottom&&layout.music.top<layout.videos.top,'real recent video and song list lead the mobile detail');
        assert.equal(await page.locator('.md-bottom-nav button').count(),4);
        assert.equal(await page.locator('.md-play').getAttribute('aria-label'),'최신 영상 재생');
      } else assert.equal(await page.locator('.md-bottom-nav').isVisible(),false,'desktop does not get mobile navigation');
      await page.locator('#singerBox [data-target="detail-showcase"]').click();
      await page.locator('#showcaseResults [data-vid="CaMpAi12345"]').waitFor();
      const showcaseLinks=await page.locator('#detail-showcase .showcase-links a').evaluateAll(nodes=>nodes.map(n=>n.href));
      assert.deepEqual(showcaseLinks,[
        'https://www.youtube.com/results?search_query='+encodeURIComponent('방탄소년단 광고 CF'),
        'https://www.youtube.com/results?search_query='+encodeURIComponent('방탄소년단 화보 메이킹'),
        'https://www.google.com/search?q='+encodeURIComponent('방탄소년단 화보 매거진')
      ]);
      assert.match(await page.locator('#detail-showcase').textContent(),/공식 콘텐츠·아티스트 일치는 보장하지 않으며/);
      await page.locator('[data-showcase-kind="editorial"]').click();
      await page.locator('#showcaseResults [data-vid="EdItOr12345"]').waitFor();
      assert.equal(await page.locator('#showcaseResults [data-vid="CaMpAi12345"]').count(),0);
      assert.equal(await page.locator('[data-showcase-kind="editorial"]').getAttribute('aria-pressed'),'true');
      await audit(width+' '+theme+' campaign/editorial search');
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
        if(width===768){
          await page.setViewportSize({width,height:390});
          const landscape=await page.evaluate(()=>({nav:document.querySelector('.tabbar').getBoundingClientRect().toJSON(),player:document.getElementById('playerBar').getBoundingClientRect().toJSON(),video:document.querySelector('.pv').getBoundingClientRect().toJSON(),controls:[...document.querySelectorAll('.pbtn,.pclose')].map(n=>n.getBoundingClientRect().toJSON())}));
          assert.ok(landscape.video.width>=200&&landscape.video.height>=200);
          assert.ok(landscape.player.top>=64&&landscape.player.bottom<=landscape.nav.top+1);
          assert.ok(landscape.controls.every(r=>r.top>=landscape.player.top&&r.bottom<=landscape.player.bottom+1),'all landscape controls visible without scrolling');
          await audit('768x390 landscape player');
          await page.setViewportSize({width,height:960});
        }
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
    assert.equal(new URL(page.url()).pathname,'/trot');
    await chooseView('idol');
    assert.equal(new URL(page.url()).pathname,'/');
    await page.reload();
    assert.equal(await page.locator('[data-act="genre"][data-genre="idol"]').getAttribute('aria-pressed'),'true');
    if(width===1440 && process.env.CHOEAE_HUB_PROOF_PATH) await page.screenshot({path:resolve(process.env.CHOEAE_HUB_PROOF_PATH),fullPage:false});
  }
  // A detail can open before its feed arrives. Refresh previews without rebuilding the form.
  const arriving=await context.newPage();
  await arriving.setViewportSize({width:390,height:844});
  // Other smoke cases deliberately abort thumbnails and check the fallback.
  // This case needs a successfully loaded image to verify arriving artwork.
  await arriving.route('https://i.ytimg.com/**',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#222"/></svg>'}));
  let releaseFeed;
  const gate=new Promise(resolve=>releaseFeed=resolve);
  await arriving.route('https://api.pomyjo.com/api/singer/feed',async route=>{
    await gate;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({artists:{BTS:[{videoId:'LaTeFe12345',title:'BTS arriving video',kind:'live'}]}})});
  });
  try {
    await arriving.goto(new URL('/?view=idol',base).href);
    await arriving.locator('#singerGrid [data-act="open-singer"][data-name="BTS"]').click();
    assert.equal(await arriving.locator('#artistSpotlight button').count(),0,'no invented preview while the feed is pending');
    await arriving.locator('#cmText').fill('unsent draft');
    releaseFeed();
    await arriving.locator('#artistSpotlight [data-vid="LaTeFe12345"]').waitFor();
    assert.equal(await arriving.locator('#cmText').inputValue(),'unsent draft');
    assert.equal(await arriving.locator('#mdName').textContent(),'BTS');
    assert.match(await arriving.locator('#artistArtworkContainer img').getAttribute('src'),/LaTeFe12345/);
    await arriving.locator('[data-act="detail-search"]').click();
    assert.equal(await arriving.locator('#singerModal').isVisible(),false);
    assert.equal(await arriving.evaluate(()=>document.activeElement.id),'searchInput');
    await arriving.locator('#singerGrid [data-act="open-singer"][data-name="BTS"]').click();
    await arriving.locator('[data-act="detail-library"]').click();
    assert.equal(await arriving.locator('#singerModal').isVisible(),false);
    assert.equal(await arriving.locator('#driveModal').isVisible(),true);
  } finally {releaseFeed();await arriving.close();}
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
  assert.equal(await page.locator('#shareHeading').textContent(),'좋아하는 콘텐츠를 공유하세요');
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
          const name=mode==='idol'?'BTS':'임영웅';
          await page.locator('#singerGrid [data-act="open-singer"][data-name="'+name+'"]').click();
          await page.waitForFunction(text=>document.getElementById('detail-music').textContent===text,ownedText('musicListen',lang));
          assert.equal(await page.locator('#mdName').textContent(),name);
          for(const [selector,key] of [['#detail-videos','youtubeVideos'],['#detail-blogs','naverBlogs'],['#detail-fancams','latestFancams'],['#detail-instagram','instagramPosts'],['#vfilter [data-kind="talk"]','filter_talk']]){
            assert.equal(await page.locator(selector).textContent(),ownedText(key,lang));
          }
          assert.equal(await page.locator('#cmText').getAttribute('placeholder'),ownedText('commentPlaceholder',lang));
          assert.equal(await page.locator('#singerBox [data-act="close-singer"]').getAttribute('aria-label'),ownedText('close',lang));
          if(mode==='idol'){
            const nav=await page.locator('#singerBox .detail-nav').evaluate(el=>({height:el.getBoundingClientRect().height,clipped:[...el.querySelectorAll('button')].filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.textContent)}));
            assert.ok(nav.height<=80,'translated detail shortcuts stay on one row');
            assert.deepEqual(nav.clipped,[],'shortcut text is never clipped or split across lines');
            if(width<=900){
              const clippedBottom=await page.locator('.md-bottom-nav button span').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.textContent));
              assert.deepEqual(clippedBottom,[],'translated bottom labels remain on one readable line');
            }
            await page.locator('#singerBox .detail-nav button').last().focus();
            // Chromium may apply focus scrolling on the next animation frame.
            // Wait for visible geometry, not an arbitrary delay or a forced click.
            await page.waitForFunction(()=>{const el=document.querySelector('#singerBox .detail-nav');const r=el.getBoundingClientRect(),b=el.querySelector('button:last-child').getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1;},null,{timeout:3000});
            assert.ok(await page.locator('#singerBox .detail-nav').evaluate(el=>{const r=el.getBoundingClientRect(),b=el.querySelector('button:last-child').getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1;}),'keyboard focus reveals the last shortcut in the scrollable row');
          }
          await page.locator('#cmText').fill('draft retained');
          const following=await page.locator('#followBtn').getAttribute('data-i18n');
          await page.locator('#followBtn').click();
          await page.waitForFunction(text=>document.getElementById('followBtn').textContent===text,ownedText(following==='follow'?'following':'follow',lang));
          await page.locator('#followBtn').click();
          await page.waitForFunction(text=>document.getElementById('followBtn').textContent===text,ownedText(following,lang));
          assert.equal(await page.locator('#cmText').inputValue(),'draft retained','translation refresh preserves the unsubmitted draft');
          const share=page.locator('#singerBox .artist-share');
          await share.locator('summary').click();
          assert.equal(await share.locator('[data-share-url]').inputValue(),new URL('/singer/'+encodeURIComponent(name),base).href);
          for(const [action,key] of [['kakao-copy','shareKakao'],['naver','shareNaver'],['facebook','shareFacebook'],['instagram-copy','shareInstagram'],['copy','shareCopy'],['native','shareNative']])assert.equal(await share.locator('[data-share="'+action+'"]').textContent(),ownedText(key,lang));
          await audit(width+' '+mode+' '+lang+' '+theme+' artist sharing');
          await share.locator('summary').click();
          if(name==='BTS')assert.ok((await page.locator('#singerBox .song .t').allTextContents()).includes('Dynamite'),'song titles remain unmodified');
          await audit(width+' '+mode+' '+lang+' '+theme+' artist detail translation');
          await page.locator('#singerBox [data-act="close-singer"]').click();
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
  // Share only public URLs. External destinations and native handoff are fixtures, not posts.
  const sharedPage=await context.newPage();
  await sharedPage.setViewportSize({width:390,height:844});
  await sharedPage.addInitScript(()=>{
    window.__sharedLinks=[];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{if(window.__denyCopy)throw new Error('denied');window.__sharedLinks.push(value);}}});
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__nativeShareData=data;if(window.__shareError)throw Object.assign(new Error('fixture'),{name:window.__shareError});}});
  });
  try{
    await sharedPage.goto(new URL('/?view=idol&singer=BTS&login=no&user=PRIVATE&token=SECRET#library',base).href);
    assert.equal(await sharedPage.locator('#singerModal').isVisible(),true,'a registered public singer link opens its detail');
    assert.equal(await sharedPage.locator('#mdName').textContent(),'BTS');
    assert.equal(await sharedPage.locator('#playerBar').isVisible(),false,'shared entry never starts playback');
    const share=sharedPage.locator('#singerBox .artist-share');await share.locator('summary').click();
    const publicUrl=new URL('/singer/BTS',base).href;
    await share.locator('[data-share="copy"]').click();
    await sharedPage.waitForFunction(()=>window.__sharedLinks.length===1);
    assert.deepEqual(await sharedPage.evaluate(()=>window.__sharedLinks),[publicUrl]);
    await sharedPage.evaluate(()=>{window.__denyCopy=true;});
    await share.locator('[data-share="instagram-copy"]').click();
    await sharedPage.waitForFunction(()=>document.querySelector('#singerBox [data-share-status]').dataset.i18n==='shareCopyFailed');
    assert.equal(await share.locator('[data-share-url]').evaluate(e=>document.activeElement===e),true,'failed copy selects the public URL rather than falsely reporting success');
    assert.deepEqual(await sharedPage.evaluate(()=>window.__sharedLinks),[publicUrl]);
    await share.locator('[data-share="native"]').click();
    await sharedPage.waitForFunction(()=>document.querySelector('#singerBox [data-share-status]').dataset.i18n==='shareHandedOff');
    assert.equal((await sharedPage.evaluate(()=>window.__nativeShareData)).url,publicUrl);
    await sharedPage.evaluate(()=>{window.__shareError='AbortError';});
    await share.locator('[data-share="native"]').click();
    await sharedPage.waitForFunction(()=>document.querySelector('#singerBox [data-share-status]').dataset.i18n==='shareCancelled');
    assert.deepEqual(await sharedPage.evaluate(()=>window.__sharedLinks),[publicUrl],'cancelling share never copies without asking');
    for(const action of ['naver','facebook']){
      await context.route(action==='naver'?'https://share.naver.com/**':'https://www.facebook.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Share destination fixture</title>'}));
      const popupPromise=sharedPage.waitForEvent('popup');await share.locator('[data-share="'+action+'"]').click();
      const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
      const destination=new URL(popup.url());
      assert.equal(destination.searchParams.get(action==='naver'?'url':'u'),publicUrl);assert.equal(await popup.evaluate(()=>window.opener===null),true);await popup.close();
    }
    await sharedPage.evaluate(()=>{window.__denyCopy=false;});
    await sharedPage.locator('[data-act="close-singer"]').click();
    await sharedPage.locator('.share [data-share="copy"]').click();
    await sharedPage.waitForFunction(()=>window.__sharedLinks.length===2);
    assert.equal((await sharedPage.evaluate(()=>window.__sharedLinks))[1],new URL('/',base).href,'home shares exclude login query and hash');
  }finally{await sharedPage.close();}
  // SDK event fixture: validate localized UI/state wiring, not real YouTube playback.
  await chooseView('idol');
  await page.evaluate(()=>{
    window.__mediaState=5;
    window.YT={Player:function(_id,config){
      window.__mediaEvents=config.events;
      this.loadVideoById=()=>{window.__mediaState=5;};
      this.getPlayerState=()=>window.__mediaState;
      this.playVideo=()=>{window.__mediaState=1;config.events.onStateChange({data:1});};
      this.pauseVideo=()=>{window.__mediaState=2;config.events.onStateChange({data:2});};
      this.stopVideo=()=>{window.__mediaState=0;};
    }};
    window.onYouTubeIframeAPIReady();window.__mediaEvents.onReady();
  });
  let feedFails=false;
  const originalTitle='BTS 원문 <live> & #라이브';
  await page.route('https://api.pomyjo.com/api/singer/feed',route=>route.fulfill({status:feedFails?503:200,contentType:'application/json',body:JSON.stringify(feedFails?{error:'PRIVATE_PROVIDER_ERROR'}:{artists:{BTS:[{videoId:'AbCdEf12345',title:originalTitle,kind:'live'}]}})}));
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:width<=900?844:960});
    for(const lang of ['ko','zh','ja','en','es','fr']){
      await chooseLocale(lang);
      feedFails=false;await page.locator('#hubFeedRetry').click();
      await page.waitForFunction(()=>document.getElementById('hubFeedMessage').dataset.i18n==='feedReady');
      await page.waitForFunction(()=>document.getElementById('hubFeedMessage').lang===document.documentElement.dataset.locale);
      const time=await page.locator('#hubFeedMessage').evaluate((el,lang)=>new Intl.DateTimeFormat({ko:'ko-KR',zh:'zh-CN',ja:'ja-JP',en:'en-US',es:'es-ES',fr:'fr-FR'}[lang],{hour:'2-digit',minute:'2-digit'}).format(new Date(Number(el.dataset.i18nTime))),lang);
      assert.equal(await page.locator('#hubFeedMessage').textContent(),ownedText('feedReady',lang).replace('{time}',time));
      assert.equal(await page.locator('#hubFeedRetry').textContent(),ownedText('feedRefresh',lang));
      feedFails=true;await page.locator('#hubFeedRetry').click();
      await page.waitForFunction(()=>document.getElementById('hubFeedMessage').dataset.i18n==='feedFailedCached');
      await page.waitForFunction(text=>document.getElementById('hubFeedRetry').textContent===text,ownedText('feedRetry',lang));
      assert.equal(await page.locator('#hubFeedMessage').textContent(),ownedText('feedFailedCached',lang).replace('{time}',time));
      assert.equal(await page.locator('#hubFeedFailureReason').textContent(),ownedText('feed_http',lang));
      assert.ok(!(await page.locator('#hubFeedDetails').textContent()).includes('PRIVATE_PROVIDER_ERROR'));
      await page.locator('#singerGrid [data-act="open-singer"][data-name="BTS"]').click();
      await page.waitForFunction(text=>document.querySelector('#vidList .vkind').textContent===text,ownedText('videoKind_live',lang));
      assert.equal(await page.locator('#vidList .vt').textContent(),originalTitle,'provider title is not translated');
      assert.equal(await page.locator('#vidList [data-act="save-video"]').getAttribute('aria-label'),ownedText('videoSave',lang));
      assert.equal(await page.locator('#vidList [data-act="retry-videos"]').textContent(),ownedText('videoRetry',lang));
      await page.locator('.md-play').click();
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerLoading',lang));
      assert.equal(await page.locator('#pbTitle').textContent(),'BTS — '+originalTitle);
      assert.equal(await page.locator('[data-act="p-toggle"]').isEnabled(),true);
      await page.locator('[data-act="p-toggle"]').click();
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerPlaying',lang));
      assert.equal(await page.locator('[data-act="p-toggle"]').textContent(),ownedText('playerPause',lang));
      await page.locator('[data-act="p-toggle"]').click();
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerPaused',lang));
      assert.equal(await page.locator('[data-act="p-toggle"]').textContent(),ownedText('playerPlay',lang));
      await page.evaluate(()=>window.__mediaEvents.onAutoplayBlocked());
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerAutoplayBlocked',lang));
      await page.evaluate(()=>window.__mediaEvents.onError({data:150}));
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerNotEmbeddable',lang));
      const other=lang==='fr'?'en':'fr';
      await page.evaluate(()=>window.__mediaEvents.onAutoplayBlocked());
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerAutoplayBlocked',lang));
      await page.waitForFunction(()=>Math.abs(parseFloat(document.documentElement.style.getPropertyValue('--player-h'))-document.getElementById('playerBar').offsetHeight)<=1);
      await chooseLocale(other);
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerAutoplayBlocked',other));
      await page.waitForFunction(()=>Math.abs(parseFloat(document.documentElement.style.getPropertyValue('--player-h'))-document.getElementById('playerBar').offsetHeight)<=1);
      assert.equal(await page.locator('#pbTitle').textContent(),'BTS — '+originalTitle,'language changes preserve the selected video');
      await chooseLocale(lang);
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerAutoplayBlocked',lang));
      for(const [act,key] of [['p-next','playerNext'],['p-full','playerFullscreen'],['p-yt','playerYouTube']])assert.equal(await page.locator('[data-act="'+act+'"]').textContent(),ownedText(key,lang));
      assert.equal(await page.locator('[data-act="p-close"]').getAttribute('aria-label'),ownedText('playerClose',lang));
      await audit(width+' '+lang+' localized media failure');
      if(width<=900){
        const geometry=await page.evaluate(()=>({player:document.getElementById('playerBar').getBoundingClientRect().toJSON(),nav:document.querySelector('.tabbar').getBoundingClientRect().toJSON(),video:document.querySelector('.pv').getBoundingClientRect().toJSON()}));
        assert.ok(geometry.video.width>=200&&geometry.video.height>=200);
        assert.ok(geometry.player.top>=64&&geometry.player.bottom<=geometry.nav.top+1,'translated status and buttons never cover navigation');
      }
      await page.locator('[data-act="p-close"]').click();
    }
  }
  // The shared player also appears in the senior/trot view. Do not only test idol CSS.
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:width<=900?844:960});
    await chooseView('classic');
    const largeType=page.locator('[data-act="font"][data-level="2"]');
    if(!await largeType.isVisible())await page.locator('#mobileSettingsToggle').click();
    await largeType.click();
    if(await page.locator('#mobileDisplaySettings').evaluate(e=>e.open))await page.locator('#mobileSettingsToggle').click();
    for(const lang of ['ko','zh','ja','en','es','fr']){
      await chooseLocale(lang);
      await page.locator('#searchInput').fill('BTS');
      await page.locator('#searchResults [data-act="open-singer"][data-name="BTS"]').click();
      await page.locator('#singerBox [data-act="play-singer"]').click();
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerLoading',lang));
      await page.locator('[data-act="p-toggle"]').click();
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerPlaying',lang));
      await page.locator('[data-act="p-toggle"]').click();
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerPaused',lang));
      await page.evaluate(()=>window.__mediaEvents.onError({data:150}));
      await page.waitForFunction(text=>document.getElementById('pbStatus').textContent===text,ownedText('playerNotEmbeddable',lang));
      assert.equal(await page.locator('#pbTitle').textContent(),'BTS — '+originalTitle);
      await audit(width+' classic large type '+lang+' localized player');
      const bounds=await page.evaluate(()=>({height:innerHeight,player:document.getElementById('playerBar').getBoundingClientRect().toJSON(),controls:[...document.querySelectorAll('.pbtn,.pclose')].map(n=>n.getBoundingClientRect().toJSON())}));
      assert.ok(bounds.player.top>=0&&bounds.player.bottom<=bounds.height+1,'classic player fits the viewport');
      assert.ok(bounds.controls.every(r=>r.top>=bounds.player.top&&r.bottom<=bounds.player.bottom+1),width+' '+lang+' classic translated controls remain inside the player '+JSON.stringify(bounds));
      await page.locator('[data-act="p-close"]').click();
    }
    const normalType=page.locator('[data-act="font"][data-level="0"]');
    if(!await normalType.isVisible())await page.locator('#mobileSettingsToggle').click();
    await normalType.click();
    if(await page.locator('#mobileDisplaySettings').evaluate(e=>e.open))await page.locator('#mobileSettingsToggle').click();
  }
  await page.reload();
  await page.waitForFunction(()=>document.documentElement.dataset.locale==='fr');
  assert.equal(await page.locator('#localeSelect').inputValue(),'fr','manual choice survives reload and country response');
  await chooseLocale('auto');
  await page.waitForFunction(()=>document.documentElement.dataset.locale==='ko');
  assert.equal(await page.evaluate(()=>localStorage.getItem('choeae_locale')),null);
  assert.deepEqual(errors,[]);
  console.log('Music hub passed: 320/375/390/430/768/1024/1440px, light/dark, large type, artist/music/storage, view switching/reload, 5 additional menu languages in both views; 6-language feed/player status matrix at 320/390/1440px.');
} finally {await browser.close();}
