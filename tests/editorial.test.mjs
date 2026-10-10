import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {guides,renderGuide} from '../functions/_shared/guides.js';
import {ALLOWED_ARTISTS} from '../functions/_shared/artists.js';
import {browserGuideSource} from '../scripts/generate-guides.mjs';
import {onRequestGet as singerPage} from '../functions/singer/[name].js';

test('curated guides have bounded original steps, source attribution, review dates, and known artists',()=>{
  assert.equal(Object.keys(guides).length,4);
  for(const [name,guide] of Object.entries(guides)){
    assert.ok(ALLOWED_ARTISTS.has(name)); assert.ok(guide.title.includes(name));
    assert.ok(guide.intro.length>=100 && guide.intro.length<500);
    assert.equal(guide.steps.length,3); assert.equal(new Set(guide.steps.map(s=>s.body)).size,3);
    for(const step of guide.steps){assert.ok(step.body.length>=70);assert.ok(step.query.length<100);}
    assert.match(guide.reviewed,/^\d{4}-\d{2}-\d{2}$/);
    for(const source of guide.sources){const url=new URL(source.url);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.ok(['bts.ibighit.com','ygfamily.com','www.youtube.com'].includes(url.hostname));}
    assert.match(renderGuide(name),/편집 의견이며 인기 순위·공식 추천이 아닙니다/);
    assert.match(renderGuide(name),/확인한 원문/);
    assert.doesNotMatch(JSON.stringify(guide),/\p{Extended_Pictographic}/u);
  }
});
test('browser guide asset is generated from the same source and cannot break out of a script',async()=>{
  const asset=await readFile(new URL('../public/artist-guides.js',import.meta.url),'utf8');
  assert.equal(asset,browserGuideSource(guides));
  const context={window:{}};vm.runInNewContext(asset,context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.CHOEAE_ARTIST_GUIDES)),guides);
  assert.doesNotMatch(browserGuideSource({x:'</script><script>bad()</script>'}),/<\/script>/i);
});
test('unprepared artists get honest navigation guidance, not fabricated editorial articles',()=>{
  const text=renderGuide('트레저');assert.match(text,/개별 감상 안내는 아직 준비하지 않았어요/);
  assert.doesNotMatch(text,/자료 확인일|편집 안내 ·/);
  assert.doesNotMatch(renderGuide('__proto__'),/\[object Object\]/);
});
test('singer landing exposes exact video links and valid musician JSON-LD, keeping noindex and no ads',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({artists:{BTS:[{videoId:'AbCdEf12345',title:'<script>bad()</script>'}]}});
  try{
    const html=await(await singerPage({params:{name:'BTS'}})).text();
    assert.match(html,/href="https:\/\/www.youtube.com\/watch\?v=AbCdEf12345"/);
    assert.match(html,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);
    assert.match(html,/<main>/);assert.match(html,/BTS 감상 길잡이/);
    const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
    assert.equal(schema['@type'],'MusicGroup');assert.equal(schema.name,'BTS');
    assert.match(html,/noindex, nofollow/);assert.doesNotMatch(html,/adsbygoogle|pagead2/);
  }finally{globalThis.fetch=original;}
});
test('browser guide preview escapes content, links to the exact artist, and tolerates a missing asset',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const fn=html.match(/function artistGuidePreview\(name\) \{[\s\S]*?\n\}/)[0];
  const esc=html.match(/function esc\(s\) \{[\s\S]*?\n\}/)[0];
  const c={window:{CHOEAE_ARTIST_GUIDES:{BTS:{title:'<img onerror=bad()>',intro:'<script>bad()</script>'}}},encodeURIComponent};
  vm.runInNewContext(esc+'\n'+fn,c);const out=c.artistGuidePreview('BTS');
  assert.match(out,/href="\/singer\/BTS"/);assert.doesNotMatch(out,/<img|<script>/);
  assert.match(out,/&lt;img/);assert.equal(c.artistGuidePreview('Unknown'),'');
  c.window={};assert.equal(c.artistGuidePreview('BTS'),'');
});
test('solo artists are not labelled as idol groups by the browse-category renderer',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const source=html.match(/function artistCategoryLabel\(a\) \{[\s\S]*?\n\}/)[0];
  const c={artistGenreKey:()=> 'idol'};vm.runInNewContext(source,c);
  assert.equal(c.artistCategoryLabel({name:'아이유'}),'가수·그룹');
});
test('empty or failed singer feeds keep useful editorial content and do not cache a transient fallback',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>new Response('temporary',{status:503});
    const response=await singerPage({params:{name:'아이유'}});const html=await response.text();
    assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.match(html,/아이유 감상 길잡이/);assert.match(html,/둘러보기 분류: 아이돌·대중가요/);
    assert.doesNotMatch(html,/아이유.*아이돌 그룹/);
    assert.match(html,/현재 영상 목록을 불러오지 못했거나/);
  }finally{globalThis.fetch=original;}
});
