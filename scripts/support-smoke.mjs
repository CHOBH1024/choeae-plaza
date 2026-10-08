import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {ownedText,ownedParamText} from '../public/locale-copy.js';
const base=process.argv[2]||'http://127.0.0.1:8788';
const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
let rankMode='ready',voteMode='http',releaseVote=null,voteArrival=null,posts=0;
const rows=[{singer:'아이유',c:Number.MAX_SAFE_INTEGER},{singer:'BTS',c:40},{singer:'에스파',c:40},{singer:'임영웅',c:30},{singer:'영탁',c:30},{singer:'아이브',c:0},{singer:'<img src=x onerror=alert(1)>',c:999}];
await context.route('**/api/locale',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({lang:'ko'})}));
await context.route('https://api.pomyjo.com/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/rank'))return route.fulfill({status:rankMode==='http'?503:200,contentType:'application/json',body:JSON.stringify(rankMode==='malformed'?{error:'failure'}:{rank:rankMode==='empty'?[]:rows})});
  if(path.endsWith('/vote')){posts++;if(voteMode==='pending')await new Promise(resolve=>{releaseVote=resolve;if(voteArrival)voteArrival();});return route.fulfill({status:voteMode==='http'?503:200,contentType:'application/json',body:JSON.stringify(voteMode==='malformed'?{}:{ok:true})});}
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(path.endsWith('/feed')?{artists:{}}:path.endsWith('/popular')?{popular:[]}:{news:[],comments:[],sns:[]})});
});
for(const url of ['https://www.youtube.com/**','https://pagead2.googlesyndication.com/**','https://fonts.googleapis.com/**','https://fonts.gstatic.com/**','https://i.ytimg.com/**'])await context.route(url,route=>route.abort());
async function settings(action){if(!await page.locator('#localeSelect').isVisible())await page.locator('#mobileSettingsToggle').click();await action();if(await page.locator('#mobileDisplaySettings').evaluate(el=>el.open))await page.locator('#mobileSettingsToggle').click();}
try{
  for(const width of [320,390,1440])for(const mode of ['idol','classic']){
    await page.setViewportSize({width,height:900});await page.goto(new URL(mode==='idol'?'/':'/trot',base).href,{waitUntil:'domcontentloaded'});await page.locator('#tab-play').click();
    await page.locator('#rankStatus[data-i18n="rankReady"]').waitFor();await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
    const answer=mode==='idol'?'BTS':'임영웅';
    await page.locator('#quizOpts').getByRole('button',{name:answer,exact:true}).click();
    await page.locator('#quizScore[data-i18n="quizCorrect"]').waitFor();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'quizNext');
    await page.locator('#tab-singer').click();await page.locator('#tab-play').click();
    assert.equal(await page.locator('#quizScore').getAttribute('data-i18n-count'),'1');
    assert.equal(await page.locator('#quizOpts button:disabled').count(),4);
    if(mode==='classic')await page.locator('[data-act="font"][data-level="2"]').click();
    const names=await page.locator('#rankList .rank-name').allTextContents();
    assert.deepEqual(new Set(names),new Set(mode==='idol'?['BTS','에스파','아이유']:['임영웅','영탁']));
    assert.deepEqual(await page.locator('#rankList .rank-num').allTextContents(),mode==='idol'?['1','2','2']:['1','1']);
    assert.equal(await page.locator('[data-act="vote-selection"]').isEnabled(),false);
    for(const lang of ['ko','zh','ja','en','es','fr']){
      await settings(()=>page.locator('#localeSelect').selectOption(lang));
      await page.waitForFunction(text=>document.getElementById('rankHeading').textContent===text,ownedText('rankHeading',lang));
      assert.equal(await page.locator('#quizHeading').textContent(),ownedText(mode==='idol'?'quizHeadingIdol':'quizHeadingClassic',lang));
      assert.equal(await page.locator('#quizScore').textContent(),ownedParamText('quizCorrect',lang,{count:1,total:10}));
      const artist=mode==='idol'?'BTS':'임영웅';
      assert.equal(await page.locator('#rankList [data-act="vote"][data-name="'+artist+'"]').getAttribute('aria-label'),ownedParamText('rankVoteNamed',lang,{name:artist}));
      for(const theme of ['dark','light']){
        if((await page.locator('html').getAttribute('data-theme')==='dark')!==(theme==='dark'))await page.locator('#themeBtn').click();
        await page.evaluate(()=>Promise.all(document.getAnimations().filter(animation=>animation instanceof CSSTransition).map(animation=>animation.finished.catch(()=>{}))));
        const audit=await page.evaluate(async()=>{const result=await axe.run(document.getElementById('supportPanel'));return result.violations.map(v=>({id:v.id,targets:v.nodes.map(node=>node.target)}));});
        assert.deepEqual(audit,[],width+' '+mode+' '+lang+' '+theme);
        const quizAudit=await page.evaluate(async()=>{const result=await axe.run(document.getElementById('quizPanel'));return result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));});assert.deepEqual(quizAudit,[],width+' '+mode+' '+lang+' '+theme+' quiz');
        const icons=await page.locator('#rankList .like-btn').evaluateAll(buttons=>buttons.map(button=>{const svg=button.querySelector('svg');const box=svg?.getBoundingClientRect();return Boolean(svg?.querySelector('path')&&svg.getAttribute('aria-hidden')==='true'&&box.width>=20&&box.height>=20&&getComputedStyle(svg).stroke!==getComputedStyle(button).backgroundColor);}));
        assert.ok(icons.length&&icons.every(Boolean),'Every response row must have a visible, decorative support icon');
        const geometry=await page.locator('#supportPanel').evaluate(el=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:Array.from(el.querySelectorAll('*')).filter(node=>{const r=node.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}).map(node=>node.outerHTML.slice(0,160))}));
        assert.ok(geometry.scroll<=geometry.width+1,JSON.stringify(geometry));assert.deepEqual(geometry.overflow,[],JSON.stringify(geometry));
      }
    }
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#tab-play').click();
  for(const mode of ['empty','http','malformed']){rankMode=mode;await page.locator('#rankRefresh').click();await page.locator('#rankStatus[data-i18n="'+(mode==='empty'?'rankEmpty':'rankError')+'"]').waitFor();assert.equal(await page.locator('#rankList .rank-item').count(),0);}
  rankMode='ready';await page.locator('#rankRefresh').click();await page.locator('#rankStatus[data-i18n="rankReady"]').waitFor();
  await page.locator('#rankArtist').selectOption('아이브');assert.equal(await page.locator('[data-act="vote-selection"]').isEnabled(),true);
  for(const mode of ['http','malformed']){voteMode=mode;await page.locator('[data-act="vote-selection"]').click();await page.locator('#rankVoteStatus[data-i18n="rankUnknown"]').waitFor();assert.equal(await page.locator('[data-act="vote-selection"]').isEnabled(),true);}
  voteMode='pending';let arrivalTimeout;const arrival=new Promise((resolve,reject)=>{voteArrival=resolve;arrivalTimeout=setTimeout(()=>reject(Error('fixture vote never arrived')),9000);});
  await page.locator('[data-act="vote-selection"]').click();await page.locator('#rankVoteStatus[data-i18n="rankVoting"]').waitFor();assert.equal(await page.locator('[data-act="vote-selection"]').isEnabled(),false);assert.equal(await page.locator('#rankList [data-act="vote"]').first().isEnabled(),false);
  try{await arrival;}finally{clearTimeout(arrivalTimeout);voteArrival=null;}voteMode='success';releaseVote();
  await page.locator('#rankVoteStatus[data-i18n="rankSuccess"]').waitFor();assert.equal(await page.locator('#rankVoteStatus').getAttribute('data-i18n-name'),'아이브');assert.equal(posts,3);assert.equal(await page.locator('[data-act="vote-selection"]').isEnabled(),false);
  assert.deepEqual(errors,[]);console.log('Support totals passed: scoped real response rows, ties, empty/errors, 6 languages at 320/390/1440px, large trot type, light/dark, pending/confirmed votes; all API traffic mocked.');
}finally{await browser.close();}
