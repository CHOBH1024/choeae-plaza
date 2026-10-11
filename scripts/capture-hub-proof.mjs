import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const [base,out]=process.argv.slice(2);
if(!base||!out) throw new Error('Pass Preview URL and screenshot directory');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
    const context=await browser.newContext({viewport:{width,height}});
    const page=await context.newPage();
    await page.goto(new URL('/?view=idol',base).href,{waitUntil:'domcontentloaded'});
    await page.locator('#hubFeedMessage').filter({hasNotText:'불러오는 중'}).waitFor({timeout:20000});
    try{await page.waitForFunction(()=>[...document.querySelectorAll('#collage img')].filter(i=>i.complete&&i.naturalWidth>0).length>=2,{},{timeout:15000});}catch{}
    const loaded=await page.locator('#collage img').evaluateAll(items=>items.filter(i=>i.complete&&i.naturalWidth>0).length);
    await page.screenshot({path:resolve(out,'choeae-idol-v2-'+name+'.png')});
    console.log(JSON.stringify({viewport:name,width,height,loadedCovers:loaded,fontControlsVisible:await page.locator('[data-act="font"]').first().isVisible()}));
    await context.close();
  }
}finally{await browser.close();}
