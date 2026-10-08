import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const names = ['safeExternalURL','safeSavedURL','normalizeDriveData','deviceImportKey','readPendingDrive','renderPendingDrive','readDeviceImport','mergeDeviceImport','renderDeviceImport','forgetDeviceBackup','importDeviceItems','loadDrive','saveDrive','checkDriveLogin','googleLogin'];
const source = names.map(name => {
  const fn = html.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];
  assert.ok(fn, name); return fn;
}).join('\n');
const empty = () => ({ favorites: [], videos: [], songs: [], articles: [] });
const turn = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const storage = new Map(); const messages = []; const requests = [];
  const body = { notice: '', insertAdjacentHTML(_position, text) { this.notice += text; } };
  const context = {
    URL, URLSearchParams, Number, encodeURIComponent, driveUser: '', driveReadUser: '', driveSaveJob: null, pendingDriveLogin: false,
    driveData: { ...empty(), favorites: ['BTS'] },
    location: { search: '?login=ok&user=member%40example.test', hostname: 'choeae-plaza.pomyjo.com', origin: 'https://choeae-plaza.pomyjo.com', href: '' },
    history: { replaceState() {} }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    renderDrive() { body.notice = ''; }, renderSingers() {}, $: () => body, toast: message => messages.push(message),
    fetch: async (url, options) => { requests.push({ url, options }); return url.includes('/load')
      ? { ok: true, json: async () => ({ data: { ...empty(), favorites: ['IU'] } }) }
      : { ok: false, status: 503 }; }
  };
  context.window = { location: context.location };
  context.openDrive = () => context.loadDrive();
  vm.runInNewContext(source, context);
  return { context, storage, messages, requests, body };
}
test('first login backs up device items separately, verifies server read, and imports only on choice', async () => {
  const { context:c, storage, requests, body } = fixture();
  c.checkDriveLogin(); await turn();
  assert.deepEqual(Array.from(c.driveData.favorites), ['IU']);
  const key = c.deviceImportKey(c.driveUser);
  assert.equal(JSON.parse(storage.get(key)).guest.favorites[0], 'BTS');
  assert.match(body.notice, /기기 항목 가져오기/);
  assert.equal(requests.length, 1, 'no implicit write or mixing');
  c.importDeviceItems(); await turn();
  assert.deepEqual(Array.from(c.driveData.favorites), ['IU', 'BTS']);
  assert.equal(JSON.parse(storage.get(key)).merged.favorites.length, 2);
  assert.equal(requests.length, 2);
  c.driveData = empty(); c.loadDrive(); await turn();
  assert.deepEqual(Array.from(c.driveData.favorites), ['IU', 'BTS'], 'failed import survives another server read');
  assert.match(body.notice, /원본은 따로 보관/);
  c.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  c.saveDrive(); await turn();
  assert.equal(storage.has(key), false, 'remove backup only after confirmed save');
});
test('unverified load and a different account cannot import another account draft', async () => {
  const { context:c, storage, requests } = fixture();
  c.checkDriveLogin(); await turn();
  const key = c.deviceImportKey(c.driveUser);
  c.driveReadUser = ''; c.importDeviceItems();
  assert.equal(requests.length, 1);
  c.driveUser = 'other@example.test'; c.driveReadUser = c.driveUser;
  assert.equal(c.readDeviceImport(c.driveUser), null);
  c.importDeviceItems();
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(storage.get(key)).owner, 'member@example.test');
  c.driveReadUser = ''; c.saveDrive();
  assert.equal(requests.length, 1, 'writes require an authenticated read for the same account');
});
test('quota failure and oversized union preserve originals without truncated import', async () => {
  const { context:c, storage, requests } = fixture();
  c.localStorage.setItem = () => { throw new Error('quota'); };
  c.checkDriveLogin(); await turn();
  assert.equal(c.driveUser, ''); assert.equal(c.driveData.favorites[0], 'BTS'); assert.equal(requests.length, 0);
  c.localStorage.setItem = (key,value) => storage.set(key,value);
  c.driveUser = 'member@example.test'; c.driveReadUser = c.driveUser;
  c.driveData = { ...empty(), favorites: Array.from({length:200}, (_,i) => 'Artist' + i) };
  const key = c.deviceImportKey(c.driveUser);
  const original = JSON.stringify({owner:c.driveUser, guest:{ ...empty(), favorites:['BTS'] }, merged:null});
  storage.set(key,original); c.importDeviceItems();
  assert.equal(c.driveData.favorites.length,200); assert.equal(storage.get(key),original); assert.equal(requests.length,0);
  assert.throws(() => c.mergeDeviceImport(empty(), {...empty(),favorites:Array(201).fill('BTS')}), /import limit/);
});
test('late save acknowledgement never discards an import with newer unsaved changes', async () => {
  const { context:c, storage } = fixture(); c.checkDriveLogin(); await turn();
  c.importDeviceItems(); await turn();
  let resolveFetch; c.fetch = () => new Promise(resolve => {resolveFetch=resolve;});
  c.saveDrive(); c.driveData.favorites.push('New artist');
  resolveFetch({ok:true,json:async()=>({ok:true})}); await turn();
  assert.equal(storage.has(c.deviceImportKey(c.driveUser)),true);
});
test('Preview never silently redirects device items to a different storage origin', () => {
  const { context:c, messages } = fixture();
  c.location.origin = 'https://immutable.choeae-plaza.pages.dev'; c.location.hostname = 'immutable.choeae-plaza.pages.dev';
  c.googleLogin(); assert.equal(c.location.href,''); assert.match(messages.at(-1), /원본은 이 주소에 남아/);
});
test('account-scoped pending edits survive save failure and logout/re-login reads without cross-account exposure', async () => {
  const { context:c, storage } = fixture();
  c.driveUser='member@example.test'; c.driveReadUser=c.driveUser; c.driveData={...empty(),favorites:['BTS']};
  c.saveDrive(); await turn();
  const key='st_drive_pending:' + encodeURIComponent(c.driveUser);
  assert.equal(JSON.parse(storage.get(key)).data.favorites[0],'BTS');
  c.driveData=empty(); c.loadDrive(); await turn();
  assert.equal(c.driveData.favorites[0],'BTS');
  c.driveUser='other@example.test'; c.loadDrive(); await turn();
  assert.deepEqual(Array.from(c.driveData.favorites),['IU']);
  assert.equal(c.readPendingDrive(c.driveUser),null);
  assert.equal(storage.has(key),true);
});
test('rapid saves serialize and coalesce the newest pending snapshot rather than racing writes', async () => {
  const { context:c, storage } = fixture();
  c.driveUser='member@example.test'; c.driveReadUser=c.driveUser;
  const calls=[]; const resolve=[];
  c.fetch=(url,options)=>{calls.push(JSON.parse(options.body));return new Promise(done=>resolve.push(done));};
  c.saveDrive(); c.driveData.favorites.push('IU'); c.saveDrive(); c.driveData.favorites.push('New artist'); c.saveDrive();
  assert.equal(calls.length,1);
  resolve[0]({ok:true,json:async()=>({ok:true})}); await turn();
  assert.equal(calls.length,2);
  assert.deepEqual(calls[1].data.favorites,['BTS','IU','New artist']);
  assert.equal(c.readPendingDrive(c.driveUser).data.favorites.length,3);
  resolve[1]({ok:true,json:async()=>({ok:true})}); await turn();
  assert.equal(storage.has('st_drive_pending:' + encodeURIComponent(c.driveUser)),false);
  assert.equal(c.driveSaveJob,null);
});

test('forgetting a device backup requires explicit confirmation and never calls Drive deletion', async () => {
  const { context:c,storage,requests }=fixture(); c.checkDriveLogin(); await turn();
  const key=c.deviceImportKey(c.driveUser); assert.equal(storage.has(key),true);
  c.window.confirm=()=>false; c.forgetDeviceBackup(); assert.equal(storage.has(key),true); assert.equal(requests.length,1);
  c.window.confirm=()=>true; c.forgetDeviceBackup(); await turn(); assert.equal(storage.has(key),false);
  assert.equal(requests.length,2); assert.equal(requests.every(r=>r.url.includes('/load')),true);
});
