import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {normalizeLoginReturnPath}=createRequire(import.meta.url)('../backend/google-drive-auth.cjs');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const source=['googleReturnPath','googleLogin','checkDriveLogin'].map(name=>html.match(new RegExp('function '+name+'\\(\\) \\{[\\s\\S]*?\\n\\}'))?.[0]).join('\n');
const loadSource=html.match(/function loadDrive\(\) \{[\s\S]*?\n\}/)[0];
function fixture(path,search='',openSinger=''){
  const events=[],storage=new Map();
  const context={URLSearchParams,encodeURIComponent,ARTISTS:[{name:'BTS'},{name:'임영웅'}],state:{},openSinger,driveUser:'',driveData:{favorites:[],videos:[],songs:[],articles:[]},pendingDriveLogin:false,
    location:{hostname:'choeae-plaza.pomyjo.com',origin:'https://choeae-plaza.pomyjo.com',pathname:path,search,href:''},
    localStorage:{setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},history:{replaceState:(_state,_title,url)=>events.push({type:'history',url})},
    openDrive:()=>events.push({type:'open-drive'}),loadDrive:()=>events.push({type:'load-drive'}),toast:()=>{}};
  context.window={location:context.location};vm.runInNewContext(source,context);return{context,events,storage};
}
test('login request keeps active artist and view but never copies callback/tracking/private parameters',()=>{
  for(const [path,query,active,expected] of [['/','?user=secret&login=ok&token=secret','BTS','/?singer=BTS'],['/trot/','','임영웅','/trot?singer=%EC%9E%84%EC%98%81%EC%9B%85'],['/discover/','?singer=BTS&view=classic&campaign=x','','/discover?singer=BTS&view=classic'],['/discover','?singer=unknown&view=idol&returnTo=https://evil.example','','/discover'],['/api/drive/load','?token=secret','','/']]){
    const {context:c}=fixture(path,query,active);c.googleLogin();const url=new URL(c.location.href);
    assert.equal(url.origin,'https://api.pomyjo.com');assert.equal(url.pathname,'/auth/google');assert.equal(url.searchParams.get('returnTo'),'https://choeae-plaza.pomyjo.com');assert.equal(url.searchParams.get('returnPath'),expected);assert.equal(normalizeLoginReturnPath(expected),expected);assert.deepEqual([...url.searchParams.keys()],['returnTo','returnPath']);assert.ok(!url.href.includes('secret'));
  }
});
test('callback removes credentials without losing the public route and avoids stacked artist/storage dialogs',()=>{
  for(const [path,query,expected,resume] of [['/discover','?singer=BTS&view=classic','/discover?singer=BTS&view=classic',true],['/trot','?singer=임영웅','/trot?singer=%EC%9E%84%EC%98%81%EC%9B%85',true],['/','?singer=BTS','/?singer=BTS',true],['/trot','','/trot',false],['/discover','?singer=unknown','/discover',false]]){
    const {context:c,events}=fixture(path,query+(query?'&':'?')+'login=ok&user=member%40example.test&token=secret');c.checkDriveLogin();
    assert.equal(c.driveUser,'member@example.test');assert.equal(c.pendingDriveLogin,true,'query alone never confirms authentication');assert.equal(events[0].url,expected);assert.equal(events[1].type,resume?'load-drive':'open-drive');assert.equal(events.length,2);
  }
});
test('failed callback background read remains unverified and exposes a retry notice outside the hidden storage dialog',async()=>{
  const messages=[],body={hidden:true,insertAdjacentHTML(_position,value){this.notice=value;}};
  const context={driveUser:'member@example.test',driveReadUser:'',pendingDriveLogin:true,driveData:{favorites:['BTS']},fetch:async()=>({ok:false,status:401}),renderDrive(){},$:()=>body,toast:value=>messages.push(value)};
  vm.runInNewContext(loadSource,context);context.loadDrive();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(context.driveReadUser,'');assert.equal(context.pendingDriveLogin,false);assert.equal(context.driveData.favorites[0],'BTS');assert.match(body.notice,/Google 로그인 다시 하기/);assert.equal(messages.length,1);assert.match(messages[0],/계정 연결을 확인하지 못/);assert.ok(!messages[0].includes('연결을 확인했어요'));
});
