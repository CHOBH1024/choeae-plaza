import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {COPY,ownedText} from '../public/locale-copy.js';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>{const text=html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];assert.ok(text,name);return text;};

test('opening the library resets its own scroll, retains focus and never implicitly saves',()=>{
  const box={scrollTop:480},body={innerHTML:''};let focus=0,renders=0,loads=0;
  const modal={hidden:true,querySelector:selector=>selector==='.sd-box'?box:selector==='.sd-close'?{focus(){focus++;}}:null};
  const c={driveUser:'',document:{activeElement:{}},$:id=>id==='driveBody'?body:modal,renderDrive(){renders++;},loadDrive(){loads++;},saveDrive(){throw Error('must not save');}};
  vm.runInNewContext(fn('openDrive'),c);c.openDrive();assert.equal(box.scrollTop,0);assert.equal(modal.hidden,false);assert.equal(focus,1);assert.equal(renders,1);assert.equal(loads,0);
  box.scrollTop=480;c.driveUser='member@example.test';c.openDrive();assert.equal(box.scrollTop,0);assert.equal(loads,1);assert.equal(focus,2);assert.match(body.innerHTML,/data-i18n="driveLoading"/);
});

test('library renderer marks only owned labels, escapes original titles and counts all four collections',()=>{
  const body={innerHTML:''},original='BTS <original> & 한글',url='https://www.youtube.com/watch?v=AbCdEf12345';
  const c={$:()=>body,driveUser:'member@example.test',driveData:{favorites:['BTS'],videos:[{t:original,url}],songs:[],articles:[]},
    esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),URL};
  vm.runInNewContext(['safeExternalURL','safeSavedURL','savedItemRow','renderDrive'].map(fn).join('\n'),c);c.renderDrive();
  assert.match(body.innerHTML,/data-i18n="driveCount" data-i18n-count="2"/);
  assert.match(body.innerHTML,/<span class="drive-account">member@example.test<\/span>/);
  assert.ok(body.innerHTML.includes('BTS &lt;original&gt; &amp; 한글'));
  assert.ok(body.innerHTML.includes('<a href="'+url+'" target="_blank" rel="noopener">'));
  assert.doesNotMatch(body.innerHTML,/<a[^>]*data-i18n/);
  assert.doesNotMatch(body.innerHTML,/data-i18n="[^"]+"[^>]*>member@example.test/);
  for(const key of ['driveSaveAll','driveLogout','driveFavorites','driveVideos','driveSongs','driveSongsEmpty','driveArticles','driveArticlesEmpty'])assert.ok(body.innerHTML.includes('data-i18n="'+key+'"'));
  c.driveUser='';c.renderDrive();for(const key of ['driveDevice','driveGoogleLogin','driveGuestNote'])assert.ok(body.innerHTML.includes('data-i18n="'+key+'"'));
  assert.equal(c.driveData.videos[0].t,original);
});

test('plain toasts clear all prior localization metadata so a later locale change cannot rewrite them',()=>{
  const node={attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}},timers=[];
  const c={$:()=>node,toastTimer:null,clearTimeout(){},setTimeout:fn=>{timers.push(fn);return timers.length;}};
  vm.runInNewContext(fn('toast'),c);c.toast(COPY.driveSaved[0],'driveSaved');
  assert.equal(node.attrs['data-i18n'],'driveSaved');assert.equal(node.hidden,false);
  for(const key of ['time','name','count','total','index'])node.attrs['data-i18n-'+key]='old';node.attrs.lang='fr';
  c.toast('Original plain text');assert.equal(node.textContent,'Original plain text');assert.deepEqual(node.attrs,{});
  assert.equal(timers.length,2);timers.at(-1)();assert.equal(node.hidden,true);
});

test('native deletion confirmation is localized but a dismissed prompt changes no device or server data',()=>{
  let prompt='',writes=0,loads=0;
  const c={driveUser:'member@example.test',driveReadUser:'member@example.test',window:{choeaeLocaleText:key=>ownedText(key,'fr'),confirm:text=>{prompt=text;return false;}},localStorage:{removeItem(){writes++;}},loadDrive(){loads++;}};
  vm.runInNewContext(fn('forgetDeviceBackup'),c);c.forgetDeviceBackup();
  assert.equal(prompt,ownedText('driveForgetConfirm','fr'));assert.equal(writes,0);assert.equal(loads,0);
  prompt='';c.driveReadUser='other@example.test';c.forgetDeviceBackup();assert.equal(prompt,'');
});

test('owned library status and backup markup has complete explicit keys, not provider translation',()=>{
  for(const name of ['openDrive','loadDrive','renderPendingDrive','renderDeviceImport']){
    const text=fn(name);
    for(const match of text.matchAll(/data-i18n="(drive[^"]+)"/g))assert.ok(COPY[match[1]],match[1]);
  }
  for(const match of html.matchAll(/toast\([^\n]+, '(drive[^']+)'\)/g))assert.ok(COPY[match[1]],match[1]);
  assert.match(fn('loadDrive'),/driveLoginImport.*driveLoginDone/);
  assert.match(fn('forgetDeviceBackup'),/driveReadUser !== driveUser/);
});
