import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {LANGUAGES} from '../public/locale-core.js';
import {ownedText,ownedParamText} from '../public/locale-copy.js';
const base=new URL(process.argv[2]||'http://127.0.0.1:8788');
const owner='member@example.test',title='Original 한글 & <not HTML> '+ 'LongTitle'.repeat(18);
const saved={favorites:['BTS'],videos:[{t:title,url:'https://www.youtube.com/watch?v=AbCdEf12345',at:0}],songs:[],articles:[]};
const browser=await chromium.launch({headless:true});let audits=0;
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
        await page.evaluate(()=>{window.driveUser='';window.driveReadUser='';window.driveData={favorites:[],videos:[],songs:[],articles:[]};});
        await open();await page.locator('#driveTitle').filter({hasText:ownedText('driveTitle',lang)}).waitFor();
        for(const key of ['driveDevice','driveGuestNote','driveGoogleLogin','driveFavoritesEmpty','driveVideosEmpty','driveSongsEmpty','driveArticlesEmpty'])assert.equal(await page.locator('#driveModal [data-i18n="'+key+'"]').textContent(),ownedText(key,lang));
        assert.equal(await page.locator('.drive-count').textContent(),ownedParamText('driveCount',lang,{count:0}));
        await audit(`${width} ${view} ${lang} ${theme} guest`);await close();
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
  console.log(`Library smoke passed: ${audits} accessibility/layout audits; 320/390/1440px, idol/large-type trot, six languages, both themes, guest/account/backups and 401/503; original titles/links preserved, deletion dismissed, no account/Drive writes. Isolated synthetic account only; existing page-view telemetry is separate.`);
}finally{await browser.close();}
