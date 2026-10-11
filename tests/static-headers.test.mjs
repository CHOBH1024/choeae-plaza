import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Pages static policy revalidates mutable app assets and preserves cacheable artwork and API separation',async()=>{
  const text=(await readFile(new URL('../public/_headers',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  for(const extension of ['js','css','json','html'])assert.ok(text.includes('/*.'+extension+'\n  Cache-Control: no-cache'));
  for(const header of ['X-Content-Type-Options: nosniff','Referrer-Policy: strict-origin-when-cross-origin','X-Frame-Options: SAMEORIGIN','camera=(), microphone=(), geolocation=()'])assert.ok(text.includes(header));
  assert.doesNotMatch(text,/Access-Control-Allow-Origin|Content-Security-Policy|api\/|Cache-Control:.*immutable|\*\.(png|jpg)/);
});
