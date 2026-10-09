import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {LANGUAGES} from '../public/locale-core.js';
import {ownedText,ownedParamText} from '../public/locale-copy.js';
const base=new URL(process.argv[2]||'http://127.0.0.1:8788');
const owner='member@example.test',title='Original 한글 & <not HTML> '+ 'LongTitle'.repeat(18);
const saved={favorites:['BTS'],videos:[{t:title,url:'https://www.youtube.com/watch?v=AbCdEf12345',at:0}],songs:[],articles:[]};
const browser=await chromium.launch({headless:true});let audits=0,footerAudits=0;
const proofDirectory=process.env.CHOEAE_LIBRARY_PROOF_DIRECTORY;
const phase=process.env.PAGES_DIRECTORY?'precompiled':'original';
async function proof(page,name){
  if(!proofDirectory)return;
  const directory=resolve(proofDirectory,phase);await mkdir(directory,{recursive:true});
  await page.locator('#driveModal .sd-box').evaluate(el=>{el.scrollTop=0;});
  await page.screenshot({path:resolve(directory,name+'.png'),fullPage:false});
}
async function footerProof(page,name){
  if(!proofDirectory)return;
  const directory=resolve(proofDirectory,phase);await mkdir(directory,{recursive:true});
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(directory,name+'.png'),fullPage:false});
}
try{
  for(const width of [320,390,1440])for(const view of ['idol','classic']){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    let mode=200,writes=0,loads=0;page.on('pageerror',e=>errors.push(e.message));
    await context.route('**/*',async route=>{
      const req=route.request(),u=new URL(req.url());
      if(u.origin===base.origin){
        if(u.pathname==='/api/locale')return route.fulfill({json:{lang:'ko'}});
        if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,items:[],comments:[]}});
        return route.continue();
      }
      if(u.origin!=='https://api.pomyjo.com')return route.abort();
      // Existing page-view telemetry is separate from account/Drive writes.
      if(req.method()!=='GET'&&/^\/(?:api\/drive\/|auth\/)/.test(u.pathname))writes++;
      if(u.pathname==='/api/drive/load'){loads++;return route.fulfill({status:mode,json:mode===200?{data:saved,migrationRequired:true}:{ok:false}});}
      return route.fulfill({json:{artists:{},popular:[],news:[],comments:[],sns:[],rank:[],ok:true}});
    });
    await page.goto(new URL(view==='classic'?'/trot':'/',base).href,{waitUntil:'domcontentloaded'});
    await page.locator('#localeSelect').waitFor({state:'attached'});
    if(view==='classic')await page.locator('[data-act="font"][data-level="2"]').click();
    await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
    async function close(){if(await page.locator('#driveModal').isVisible())await page.locator('#driveModal [data-act="close-drive"]').click();}
    async function language(lang){
      await close();
      if(!await page.locator('#localeSelect').isVisible())await page.locator('#mobileSettingsToggle').click();
      await page.locator('#localeSelect').selectOption(lang);
      if(await page.locator('#mobileDisplaySettings').evaluate(el=>el.open))await page.locator('#mobileSettingsToggle').click();
    }
    async function open(){await page.locator('[data-act="drive"]').first().click();await page.locator('#driveModal').waitFor({state:'visible'});}
    async function auditFooter(lang,label){
      const footer=page.locator('footer');
      await footer.locator('[data-i18n="footerPrivacy"]').filter({hasText:ownedText('footerPrivacy',lang)}).waitFor({state:'visible'});
      for(const key of ['footerIdol','footerTrot','footerContact','footerAbout','footerPrivacy','footerTerms','footerEmailOptOut','footerUnofficial']){
        assert.equal(await footer.locator('[data-i18n="'+key+'"]').textContent(),ownedText(key,lang),label+' '+key);
      }
      for(const [key,href] of [['footerIdol','/'],['footerTrot','/trot'],['footerAbout','/about.html'],['footerPrivacy','/privacy.html'],['footerTerms','/terms.html']]){
        assert.equal(await footer.locator('[data-i18n="'+key+'"]').getAttribute('href'),href,label+' unchanged destination');
      }
      assert.equal(await footer.locator('a[href="mailto:malrang1024@gmail.com"]').textContent(),'malrang1024@gmail.com');
      for(const key of ['footerViews','footerPolicies'])assert.equal(await footer.locator('[data-i18n-aria-label="'+key+'"]').getAttribute('aria-label'),ownedText(key,lang));
      const metrics=await footer.evaluate(async el=>({
        violations:(await axe.run(el)).violations.map(v=>({id:v.id,details:v.nodes.map(n=>n.failureSummary)})),
        overflow:[...el.querySelectorAll('*')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}).map(n=>n.tagName+'.'+n.className),
        small:[...el.querySelectorAll('a,button')].filter(n=>n.getClientRects().length&&n.getBoundingClientRect().height<43.9).map(n=>n.tagName)
      }));
      assert.deepEqual(metrics.violations,[],label+' footer accessibility');assert.deepEqual(metrics.overflow,[],label+' footer wrapping');assert.deepEqual(metrics.small,[],label+' footer touch targets');footerAudits++;
    }
    async function audit(label){
      await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a instanceof CSSTransition).map(a=>a.finished.catch(()=>{}))));
      const result=await page.locator('#driveModal').evaluate(async el=>{
        const violations=(await axe.run(el)).violations.map(v=>({id:v.id,details:v.nodes.map(n=>n.failureSummary)}));
        const box=el.querySelector('.sd-box');
        const overflow=[...el.querySelectorAll('*')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}).map(n=>n.tagName+'.'+n.className);
        const small=[...el.querySelectorAll('button,summary')].filter(n=>n.getClientRects().length&&n.getBoundingClientRect().height<43.9).map(n=>n.outerHTML);
        return {violations,overflow,small,inner:box.clientWidth,scroll:box.scrollWidth};
      });
      assert.deepEqual(result.violations,[],label);assert.deepEqual(result.overflow,[],label);assert.deepEqual(result.small,[],label);
      assert.ok(result.scroll<=result.inner+1,label+' horizontal library overflow');audits++;
    }
    for(const lang of LANGUAGES){
      await language(lang);
      for(const theme of ['dark','light']){
        await close();
        if((await page.locator('html').getAttribute('data-theme')==='dark')!==(theme==='dark'))await page.locator('#themeBtn').click();
        await auditFooter(lang,`${width} ${view} ${lang} ${theme}`);
        if(theme==='dark'&&view==='idol'&&width===390&&lang==='ko')await footerProof(page,'footer-idol-390-ko-dark');
        if(theme==='dark'&&view==='classic'&&width===320&&lang==='fr')await footerProof(page,'footer-trot-320-fr-dark');
        if(theme==='dark'&&view==='idol'&&width===1440&&lang==='en')await footerProof(page,'footer-idol-1440-en-dark');
        await page.evaluate(()=>{window.driveUser='';window.driveReadUser='';window.driveData={favorites:[],videos:[],songs:[],articles:[]};});
        await open();await page.locator('#driveTitle').filter({hasText:ownedText('driveTitle',lang)}).waitFor();
        for(const key of ['driveDevice','driveGuestNote','driveGoogleLogin','driveFavoritesEmpty','driveVideosEmpty','driveSongsEmpty','driveArticlesEmpty'])assert.equal(await page.locator('#driveModal [data-i18n="'+key+'"]').textContent(),ownedText(key,lang));
        assert.equal(await page.locator('.drive-count').textContent(),ownedParamText('driveCount',lang,{count:0}));
        await audit(`${width} ${view} ${lang} ${theme} guest`);
        const entry=await page.locator('#driveModal').evaluate(el=>{const box=el.querySelector('.sd-box').getBoundingClientRect(),button=el.querySelector('[data-act="google-login"]').getBoundingClientRect();return {top:button.top,bottom:button.bottom,boxTop:box.top,boxBottom:box.bottom,scroll:el.querySelector('.sd-box').scrollTop};});
        assert.equal(entry.scroll,0,'opening library starts at the top');
        assert.ok(entry.top>=entry.boxTop&&entry.bottom<=entry.boxBottom,`${width} ${view} ${lang} guest sign-in must be visible without scrolling: ${JSON.stringify(entry)}`);
        if(width<700){
          await page.setViewportSize({width,height:568});
          await audit(`${width}x568 ${view} ${lang} ${theme} guest`);
          const short=await page.locator('#driveModal').evaluate(el=>{const box=el.querySelector('.sd-box').getBoundingClientRect(),button=el.querySelector('[data-act="google-login"]').getBoundingClientRect(),close=el.querySelector('.sd-close').getBoundingClientRect();return {top:button.top,bottom:button.bottom,boxTop:box.top,boxBottom:box.bottom,closeTop:close.top,closeBottom:close.bottom};});
          assert.ok(short.top>=short.boxTop&&short.bottom<=short.boxBottom,`short-screen sign-in needs no scroll: ${JSON.stringify(short)}`);
          assert.ok(short.closeTop>=0&&short.closeBottom<=568,'close control remains in the short viewport');
          const login=page.locator('#driveModal [data-act="google-login"]');
          assert.equal(await login.getAttribute('aria-describedby'),'driveGuestNote');
          await page.locator('#driveModal .sd-close').focus();await page.keyboard.press('Tab');assert.ok(await login.evaluate(el=>el===document.activeElement),'first keyboard action after close is Google sign-in');
          await page.keyboard.press('Tab');assert.ok(await page.locator('#driveModal .sd-close').evaluate(el=>el===document.activeElement),'guest keyboard navigation wraps inside the library');
          if(theme==='dark'&&width===320&&view==='classic'&&lang==='fr')await proof(page,'guest-trot-320x568-fr-dark');
          await page.setViewportSize({width,height:900});
        }
        if(theme==='dark'&&width===390&&view==='idol'&&lang==='ko')await proof(page,'guest-idol-390-ko-dark');
        if(theme==='dark'&&width===320&&view==='classic'&&lang==='fr')await proof(page,'guest-trot-320-fr-dark');
        await close();
        await page.evaluate(({owner,saved})=>{
          window.driveUser=owner;window.driveReadUser='';
          localStorage.setItem('st_drive_import:'+encodeURIComponent(owner),JSON.stringify({owner,guest:{favorites:['에스파'],videos:[],songs:[],articles:[]},merged:null}));
          localStorage.setItem('st_drive_pending:'+encodeURIComponent(owner),JSON.stringify({owner,data:saved}));
        },{owner,saved});
        mode=200;await open();await page.locator('#driveModal [data-i18n="driveMigrationTitle"]').waitFor();
        for(const key of ['driveSaveAll','driveLogout','driveMigrationTitle','driveMigrationNote','drivePendingTitle','drivePendingNote','driveImportChoice','driveImportAction','driveBackupNote','driveBackupExport','driveBackupForget']){
          await page.waitForFunction(({key,expected})=>document.querySelector('#driveModal [data-i18n="'+key+'"]')?.textContent===expected,{key,expected:ownedText(key,lang)});
        }
        assert.equal(await page.locator('.drive-account').textContent(),owner);
        assert.equal(await page.locator('#driveModal .row a').textContent(),title);
        assert.equal(await page.locator('#driveModal .row a').getAttribute('href'),saved.videos[0].url);
        assert.equal(await page.locator('#driveModal .row [data-i18n]').count(),0);
        const snapshot=await page.evaluate(()=>JSON.stringify([window.driveData,...Object.keys(localStorage).filter(k=>k.startsWith('st_drive')).sort().map(k=>[k,localStorage.getItem(k)])]));
        const dialogPromise=page.waitForEvent('dialog').then(async dialog=>{assert.equal(dialog.type(),'confirm');assert.equal(dialog.message(),ownedText('driveForgetConfirm',lang));await dialog.dismiss();});
        await page.locator('[data-act="drive-backup-forget"]').click();await dialogPromise;
        assert.equal(await page.evaluate(()=>JSON.stringify([window.driveData,...Object.keys(localStorage).filter(k=>k.startsWith('st_drive')).sort().map(k=>[k,localStorage.getItem(k)])])),snapshot);
        await page.locator('#driveModal .drive-notice').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
        await audit(`${width} ${view} ${lang} ${theme} account with backups`);
        if(theme==='dark'&&width===1440&&view==='idol'&&lang==='en')await proof(page,'synthetic-account-idol-1440-en-dark');
        const favorite=page.locator('#driveModal [data-act="library-artist"][data-name="BTS"]');
        assert.equal(await favorite.textContent(),'BTS','saved artist name remains original');
        await page.waitForFunction(expected=>document.querySelector('#driveModal [data-act="library-artist"]')?.getAttribute('aria-label')===expected,ownedParamText('cardMoreNamed',lang,{name:'BTS'}));
        const before=await page.evaluate(()=>JSON.stringify(window.driveData));
        const playback=await page.locator('iframe[src*="/embed/"]').count();
        await favorite.click();await page.locator('#singerModal').waitFor({state:'visible'});
        assert.ok(!await page.locator('#driveModal').isVisible(),'opening a saved artist never stacks two dialogs');
        assert.equal(await page.locator('.modal:visible').count(),1);
        assert.equal(await page.locator('#singerBox .md-name').textContent(),'BTS');
        assert.equal(await page.locator('iframe[src*="/embed/"]').count(),playback,'opening favorite never starts playback');
        await page.locator('#singerModal [data-act="close-singer"]').click();
        assert.ok(await page.evaluate(()=>document.activeElement?.getClientRects().length>0&&!document.activeElement?.closest('#driveModal')),'closing artist returns focus outside hidden library');
        assert.equal(await page.evaluate(()=>JSON.stringify(window.driveData)),before,'navigation does not alter saved data');
      }
      // Async session/server errors are also owned copy, never destructive retries.
      for(const status of [401,503]){
        await close();mode=status;await open();const key=status===401?'driveLoad401':'driveLoadFailed';
        await page.locator('#driveModal [data-i18n="'+key+'"]').waitFor();
        await page.waitForFunction(({key,expected})=>document.querySelector('[data-i18n="'+key+'"]')?.textContent===expected,{key,expected:ownedText(key,lang)});
        await audit(`${width} ${view} ${lang} error ${status}`);
        assert.equal(await page.locator('#driveModal .row a').textContent(),title);
      }
      mode=200;
    }
    await page.evaluate(()=>window.toast('드라이브에 저장했어요!','driveSaved'));
    await page.waitForFunction(expected=>document.getElementById('toast').textContent===expected,ownedText('driveSaved','fr'));
    await page.evaluate(()=>window.toast('Original plain message'));
    await language('en');assert.equal(await page.locator('#toast').textContent(),'Original plain message');
    assert.equal(await page.locator('#toast').getAttribute('data-i18n'),null);
    assert.equal(writes,0,'language changes, failed reads and cancelled deletion never write account/Drive data');assert.deepEqual(errors,[]);
    console.log(JSON.stringify({width,view,loads,writes,errors:errors.length}));await context.close();
  }
  assert.equal(footerAudits,72,'all languages, themes, view types and widths audit the footer');
  console.log(`Library smoke passed: ${audits} library and ${footerAudits} footer accessibility/layout audits; 320/390/1440px and 568px short mobile, idol/large-type trot, six languages, both themes, guest/account/backups and 401/503; favorite navigation has one dialog, visible return focus, no autoplay or changed saved data; original titles/links preserved, deletion dismissed, no account/Drive writes. Isolated synthetic account only; existing page-view telemetry is separate.`);
}finally{await browser.close();}
