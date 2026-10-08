import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script=await readFile(new URL('../public/install.js',import.meta.url),'utf8');
function fixture(standalone=false){
  const events={},clicks={},nodes={installApp:{setAttribute(){},addEventListener:(n,f)=>clicks.install=f,focus(){}},installHeading:{focus(){}},installClose:{addEventListener:(n,f)=>clicks.close=f,focus(){}},installStatus:{setAttribute(){}}};
  const dialog={setAttribute(){},showModal(){this.open=true;},close(){this.open=false;}};let created=0,registered;
  const c={document:{querySelector:()=>({prepend(){}}),createElement:()=>++created===1?{}:dialog,body:{append(){}},getElementById:id=>nodes[id]},
    window:{matchMedia:()=>({matches:standalone}),isSecureContext:true,addEventListener:(n,f)=>events[n]=f},navigator:{serviceWorker:{register:(url,options)=>{registered={url,options};return Promise.resolve();}}}};
  vm.runInNewContext(script,c);return {events,clicks,nodes,dialog,registered};
}
test('web app install is user initiated, dismissible, and only claims confirmed installation after appinstalled',async()=>{
  const f=fixture();let prompts=0,prevented=0;
  assert.equal(f.registered.url,'/sw.js');assert.equal(f.registered.options.updateViaCache,'none');
  await f.clicks.install();assert.equal(f.dialog.open,true);f.clicks.close();assert.equal(f.dialog.open,false);
  f.events.beforeinstallprompt({preventDefault(){prevented++;},prompt:async()=>prompts++,userChoice:Promise.resolve({outcome:'accepted'})});
  assert.equal(prevented,1);assert.equal(prompts,0);
  await f.clicks.install();assert.equal(prompts,1);assert.match(f.nodes.installStatus.textContent,/기기의 완료 화면/);
  f.events.appinstalled();assert.equal(f.nodes.installApp.hidden,true);assert.match(f.nodes.installStatus.textContent,/설치가 확인/);
  assert.equal(fixture(true).nodes.installApp.hidden,true);
});
test('Apple and Android instructions distinguish PWA from app stores and no offline playback is promised',async()=>{
  const f=fixture();assert.match(f.dialog.innerHTML,/아이폰·아이패드/);assert.match(f.dialog.innerHTML,/안드로이드/);
  assert.match(f.dialog.innerHTML,/App Store·Play Store.*아닌 웹앱/);assert.match(f.dialog.innerHTML,/인터넷이 필요/);
  for(const [file,start] of [['manifest.json','/'],['manifest-idol.json','/?view=idol']]){
    const m=JSON.parse(await readFile(new URL('../public/'+file,import.meta.url),'utf8'));
    assert.equal(m.start_url,start);assert.equal(m.scope,'/');assert.equal(m.display,'standalone');assert.equal(m.id,'/');
    for(const icon of m.icons){const bytes=await readFile(new URL('../public'+icon.src,import.meta.url));assert.equal(bytes.readUInt32BE(16),512);assert.equal(bytes.readUInt32BE(20),512);}
  }
  const sw=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
  assert.doesNotMatch(sw,/caches\.|indexedDB|localStorage|cookie|Authorization|postMessage/);
  assert.match(sw,/Cache-Control':'no-store/);assert.match(sw,/request\.mode!=='navigate'/);
});
