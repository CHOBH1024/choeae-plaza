import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
const {normalizeLoginReturnPath}=createRequire(import.meta.url)('../backend/google-drive-auth.cjs');
const base=new URL(process.argv[2]||'http://127.0.0.1:8788');
const browser=await chromium.launch({headless:true});
try{
  for(const [path,name,view] of [['/?singer=BTS','BTS','idol'],['/trot?singer=임영웅','임영웅','classic'],['/discover?singer=BTS','BTS','idol'],['/discover?singer=임영웅&view=classic','임영웅','classic'],['/trot','','classic']]){
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],authRequests=[];
    let writes=0;
    page.on('pageerror',error=>errors.push(error.message));
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===base.origin){
        if(url.pathname==='/api/locale')return route.fulfill({json:{lang:'ko',reason:'country'}});
        if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,items:[],comments:[]}});
        return route.continue();
      }
      if(url.origin!=='https://api.pomyjo.com')return route.abort();
      if(url.pathname==='/auth/google'){
        authRequests.push(url);const returnPath=url.searchParams.get('returnPath');assert.equal(normalizeLoginReturnPath(returnPath),returnPath);
        assert.equal(url.searchParams.get('returnTo'),'https://choeae-plaza.pomyjo.com');
        // Isolated auth-provider substitute. Real server state binding is checked separately.
        const callback=new URL(returnPath,base);callback.searchParams.set('login','ok');callback.searchParams.set('user','member@example.test');
        return route.fulfill({status:302,headers:{location:callback.href},body:''});
      }
      if(url.pathname==='/api/drive/load')return route.fulfill({json:{data:{favorites:['BTS'],videos:[],songs:[],articles:[]}}});
      if(request.method()==='POST'&&url.pathname==='/api/drive/save')writes++;
      return route.fulfill({json:{artists:{},popular:[],news:[],comments:[],sns:[],ok:true}});
    });
    await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded'});
    if(name){await page.locator('#mdName').filter({hasText:name}).waitFor();await page.locator('#singerBox .md-close').click();}
    await page.locator('[data-act="drive"]').first().click();
    await page.locator('#driveModal [data-act="google-login"]').click();
    await page.waitForFunction(()=>window.driveReadUser==='member@example.test');
    // Authenticated fetch completion can precede deferred UI modules. Require the
    // intended screen to actually appear, not just a successful storage read.
    await page.locator(name?'#singerModal':'#driveModal').waitFor({state:'visible'});
    assert.equal(authRequests.length,1);
    assert.equal(authRequests[0].searchParams.get('returnPath'),normalizeLoginReturnPath(path));
    const after=new URL(page.url());assert.equal(after.pathname+after.search,normalizeLoginReturnPath(path));assert.equal(after.searchParams.has('login'),false);assert.equal(after.searchParams.has('user'),false);
    assert.equal(await page.locator('html').getAttribute('data-experience'),view);
    if(name){assert.equal(await page.locator('#singerModal').isVisible(),true);assert.equal(await page.locator('#driveModal').isVisible(),false);assert.equal(await page.locator('#mdName').innerText(),name);}
    else assert.equal(await page.locator('#driveModal').isVisible(),true);
    assert.equal(await page.locator('.modal:visible').count(),1,'one dialog, not overlapping artist and storage dialogs');
    assert.equal(writes,0,'login never implicitly saves device/Drive contents');assert.deepEqual(errors,[]);
    console.log(JSON.stringify({path:normalizeLoginReturnPath(path),view,visibleDialogs:1,writes,errors:errors.length}));
    await context.close();
  }
  console.log('Login return smoke passed: root/trot/discover artist/view preserved, callback credentials removed, one dialog, no automatic saves; isolated fake account/provider only.');
}finally{await browser.close();}
