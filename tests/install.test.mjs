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
  await f.clicks.install();assert.equal(f.dialog.open,true);assert.equal(f.dialog.scrollTop,0);f.clicks.close();assert.equal(f.dialog.open,false);
  f.events.beforeinstallprompt({preventDefault(){prevented++;},prompt:async()=>prompts++,userChoice:Promise.resolve({outcome:'accepted'})});
  assert.equal(prevented,1);assert.equal(prompts,0);
  await f.clicks.install();assert.equal(prompts,1);assert.match(f.nodes.installStatus.textContent,/기기의 완료 화면/);
  f.events.appinstalled();assert.equal(f.nodes.installApp.hidden,true);assert.match(f.nodes.installStatus.textContent,/설치가 확인/);
  assert.equal(fixture(true).nodes.installApp.hidden,true);
});
test('Apple and Android instructions distinguish PWA from app stores and no offline playback is promised',async()=>{
  const f=fixture();assert.match(f.dialog.innerHTML,/아이폰·아이패드/);assert.match(f.dialog.innerHTML,/안드로이드/);
  assert.match(f.dialog.innerHTML,/App Store·Play Store.*아닌 웹앱/);assert.match(f.dialog.innerHTML,/인터넷이 필요/);
  for(const [file,start] of [['manifest.json','/trot'],['manifest-idol.json','/']]){
    const m=JSON.parse(await readFile(new URL('../public/'+file,import.meta.url),'utf8'));
    assert.equal(m.start_url,start);assert.equal(m.scope,'/');assert.equal(m.display,'standalone');assert.equal(m.id,'/');
    for(const icon of m.icons){const bytes=await readFile(new URL('../public'+icon.src,import.meta.url));assert.equal(bytes.readUInt32BE(16),512);assert.equal(bytes.readUInt32BE(20),512);}
  }
  const sw=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
  assert.doesNotMatch(sw,/caches\.|indexedDB|localStorage|cookie|Authorization|postMessage/);
  assert.match(sw,/Cache-Control':'no-store/);assert.match(sw,/request\.mode!=='navigate'/);
});

test('network-only app navigation includes discover without capturing APIs or caching provider results',async()=>{
  const sw=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
  const origin='https://choeae-plaza.pomyjo.com';let listener,offline=false,seen=[],responded;
  const live=new Response('upstream body',{status:200});
  vm.runInNewContext(sw,{URL,Response,self:{location:{origin},addEventListener(name,fn){assert.equal(name,'fetch');listener=fn;}},fetch:async request=>{seen.push(request);if(offline)throw Error('offline');return live;}});
  function navigate(path,extra={}){
    responded=undefined;const request={url:new URL(path,origin).href,method:'GET',mode:'navigate',...extra};
    listener({request,respondWith(value){assert.equal(responded,undefined);responded=value;}});return request;
  }
  for(const path of ['/','/trot','/trot/','/discover?singer=BTS','/discover/?view=classic','/index.html','/blogs.html?name=BTS']){
    const request=navigate(path);assert.equal(await responded,live);assert.equal(seen.at(-1),request);
  }
  const calls=seen.length;
  for(const [path,extra] of [['/api/blog?name=BTS',{}],['/api/instagram?name=BTS',{}],['/discover',{method:'POST'}],['/discover',{mode:'cors'}],['https://api.pomyjo.com/feed',{}],['/auth/google/callback?code=private',{}]]){
    navigate(path,extra);assert.equal(responded,undefined);
  }
  assert.equal(seen.length,calls);
  offline=true;
  navigate('/discover?singer=BTS&user=private-marker');const failure=await responded;
  assert.equal(failure.status,503);assert.equal(failure.headers.get('Cache-Control'),'no-store');
  assert.match(failure.headers.get('Content-Type'),/^text\/html; charset=utf-8$/);
  const html=await failure.text();assert.match(html,/インターネット|인터넷 연결/);assert.doesNotMatch(html,/private-marker|BTS|upstream body/);
});
