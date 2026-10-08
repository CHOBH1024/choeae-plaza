import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
const base=process.argv[2]||'http://127.0.0.1:8788';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await context.route('https://api.pomyjo.com/**',route=>{
  const path=new URL(route.request().url()).pathname;
  const body=path.endsWith('/feed')?{artists:{BTS:[{videoId:'AbCdEf12345',title:'BTS 공개 무대',kind:'live'}]}}:
    path.endsWith('/popular')?{popular:[]}:path.endsWith('/news')?{news:[]}:path.endsWith('/rank')?{ranking:[]}:path.includes('drive')?{ok:false}:{comments:[],sns:[],news:[]};
  return route.fulfill({status:path.includes('drive')?401:200,contentType:'application/json',body:JSON.stringify(body)});
});
await context.route('**/api/popular-videos?*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:[]})}));
for(const url of ['https://www.youtube.com/iframe_api','https://pagead2.googlesyndication.com/**','https://fonts.googleapis.com/**','https://fonts.gstatic.com/**','https://i.ytimg.com/**']) await context.route(url,r=>r.abort());
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
  for(const width of [320,375,768,1024,1440]) {
    await page.setViewportSize({width,height:960});
    await page.goto(new URL('/?view=idol',base).href);
    await page.waitForFunction(()=>document.documentElement.dataset.experience==='idol');
    await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
    assert.equal(await page.locator('[data-experience="idol"][data-act]').getAttribute('aria-pressed'),'true');
    assert.ok((await page.locator('#singerGrid .name').allTextContents()).includes('BTS'));
    assert.ok(!(await page.locator('#singerGrid .name').allTextContents()).includes('임영웅'));
    for(const theme of ['dark','light']) {
      const current=await page.locator('html').getAttribute('data-theme');
      if((current==='dark')!==(theme==='dark')) await page.locator('#themeBtn').click();
      await audit(width+' '+theme+' artists');
      assert.equal(await page.locator('[data-act="font"][data-level="2"]').isVisible(),false);
      await page.locator('[data-experience="classic"][data-act]').click();
      await page.locator('[data-act="font"][data-level="2"]').click();
      await page.locator('[data-experience="idol"][data-act]').click();
      assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).fontSize),'18px');
      await audit(width+' '+theme+' large type');
      await page.locator('[data-experience="classic"][data-act]').click();
      assert.equal(await page.locator('[data-act="font"][data-level="2"]').getAttribute('aria-pressed'),'true');
      await page.locator('[data-act="font"][data-level="0"]').click();
      await page.locator('[data-experience="idol"][data-act]').click();
      await page.locator('[data-act="open-singer"][data-name="BTS"]').click();
      await audit(width+' '+theme+' artist detail');
      assert.equal(await page.locator('#singerBox a[data-song="Spring Day"]').getAttribute('href'),'https://music.youtube.com/search?q=BTS%20Spring%20Day');
      await page.locator('[data-act="close-singer"]').click();
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
    }
    await page.locator('[data-experience="classic"][data-act]').click();
    assert.equal(await page.locator('html').getAttribute('data-experience'),'classic');
    assert.ok((await page.locator('#singerGrid .name').allTextContents()).includes('임영웅'));
    assert.equal(new URL(page.url()).searchParams.has('view'),false);
    await page.locator('[data-experience="idol"][data-act]').click();
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
  await page.locator('[data-experience="classic"][data-act]').click();
  assert.equal(await page.locator('#shareHeading').textContent(),'가족·친구에게 알려주세요');
  assert.deepEqual(errors,[]);
  console.log('Music hub passed: 320/375/768/1024/1440px, light/dark, large type, artist/music/storage, view switching and reload.');
} finally {await browser.close();}
