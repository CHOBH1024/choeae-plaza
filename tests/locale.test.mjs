import test from 'node:test';
import assert from 'node:assert/strict';
import {LANGUAGES,normalizeLanguage,selectLocale} from '../public/locale-core.js';
import {onRequestGet} from '../functions/api/locale.js';
test('country default supports requested languages while multilingual or unknown countries use browser preference',()=>{
  for(const [country,lang] of [['KR','ko'],['CN','zh'],['TW','zh'],['JP','ja'],['US','en'],['ES','es'],['MX','es'],['FR','fr']])assert.deepEqual(selectLocale(country,'en'),{lang,reason:'country'});
  assert.equal(selectLocale('CA','en;q=0.3,fr-CA;q=0.9').lang,'fr');
  assert.equal(selectLocale('XX','de-DE,ja-JP;q=0.8,en;q=0.2').lang,'ja');
  assert.equal(selectLocale(null,'fr;q=0,en;q=bad').lang,'ko');assert.equal(normalizeLanguage('zh-Hant'),'zh');
  assert.equal(normalizeLanguage('javascript:alert(1)'),null);assert.equal(LANGUAGES.length,6);
});
test('locale endpoint uses trusted platform metadata, ignores spoofed country headers and does not return identity data',async()=>{
  const request=new Request('https://example.test/api/locale',{headers:{'CF-IPCountry':'CN','Accept-Language':'es'}});
  const first=await onRequestGet({request});assert.equal(first.headers.get('Cache-Control'),'no-store');assert.deepEqual(await first.json(),{lang:'es',reason:'browser'});
  Object.defineProperty(request,'cf',{value:{country:'JP'}});
  assert.deepEqual(await (await onRequestGet({request})).json(),{lang:'ja',reason:'country'});
});
