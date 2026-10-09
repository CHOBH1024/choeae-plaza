import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestGet as singerPage} from '../functions/singer/[name].js';

const asset=name=>readFile(new URL('../public/'+name,import.meta.url));
const text=async name=>(await asset(name)).toString('utf8');
const mark='/choeae-icon-v1.svg',image='https://choeae-plaza.pomyjo.com/choeae-og-v1.png';

test('installed app and Apple icons use the reviewed Choeae mark, with real PNG sizes',async()=>{
  for(const name of ['manifest.json','manifest-idol.json']){
    const manifest=JSON.parse(await text(name));
    assert.equal(manifest.icons.length,1);
    assert.deepEqual(manifest.icons[0],{src:'/choeae-icon-512-v1.png',sizes:'512x512',type:'image/png',purpose:'any maskable'});
  }
  for(const [name,width,height] of [['choeae-icon-512-v1.png',512,512],['choeae-apple-180-v1.png',180,180],['choeae-og-v1.png',1200,630]]){
    const png=await asset(name);
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
  }
  const icon=await text('choeae-icon-v1.svg'),og=await text('choeae-og-v1.svg');
  for(const svg of [icon,og]){
    assert.match(svg,/<title id="title">최애광장<\/title>/);
    assert.doesNotMatch(svg,/SINGERTUBE|singer-tube|\p{Extended_Pictographic}|<(?:script|foreignObject|image)\b|(?:href|src)=/u);
  }
  assert.match(icon,/<rect width="512" height="512" fill="#0c0f14"\/>/,'opaque maskable background');
  assert.match(og,/choeae-plaza\.pomyjo\.com/);
  assert.doesNotMatch(og,/실시간|공식 계정|큰 글씨|시니어/);
});

test('home, artist shares, and blog search reference existing branded files, not the legacy bitmap',async()=>{
  const home=await text('index.html'),blogs=await text('blogs.html'),hub=await text('music-hub.js');
  assert.match(home,/<link rel="icon" href="\/choeae-icon-v1\.svg"/);
  assert.match(blogs,/<link rel="icon" href="\/choeae-icon-v1\.svg"/);
  assert.match(home,/<link rel="apple-touch-icon" sizes="180x180" href="\/choeae-apple-180-v1\.png"/);
  assert.match(home,/<link rel="manifest" id="pwaManifest" href="\/manifest-idol\.json\?v=20261009-library"/);
  assert.ok(hub.includes("idol ? '/manifest-idol.json?v=20261009-library' : '/manifest.json?v=20261009-library'"));
  assert.ok(home.includes('<meta property="og:image" content="'+image+'">'));
  assert.match(home,/<meta property="og:image:width" content="1200">/);
  assert.match(home,/<meta property="og:image:height" content="630">/);
  const head=home.split('</head>')[0];assert.doesNotMatch(head,/노인 노래|시니어|큰 글씨/);
  assert.match(head,/<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(home+blogs,/og-banner\.png|icon-512\.png|favicon\.svg|20261009-blogs/);
  for(const name of ['about.html','privacy.html','terms.html'])assert.ok((await text(name)).includes('<link rel="icon" href="'+mark+'"'));
  const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({artists:{}});
  try{
    for(const name of ['BTS','아이유','임영웅']){
      const html=await(await singerPage({params:{name}})).text();
      assert.ok(html.includes('<meta property="og:image" content="'+image+'">'));
      assert.ok(html.includes('<link rel="icon" href="'+mark+'"'));
      assert.match(html,/noindex, nofollow/);assert.doesNotMatch(html,/og-banner\.png|adsbygoogle|pagead2/);
      if(name==='임영웅')assert.match(html,/트로트 전용 화면.*큰 글씨/);
      else assert.doesNotMatch(html,/큰 글씨|시니어|노인/);
    }
  }finally{globalThis.fetch=original;}
});
