import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/instagram.js';
const env={META_ACCESS_TOKEN:'private-test-token',META_IG_USER_ID:'1234567890',META_GRAPH_VERSION:'v99.0',INSTAGRAM_ARTIST_ACCOUNTS:JSON.stringify({BTS:'verified_test_account'})};
const request=name=>new Request('https://example.test/api/instagram?name='+encodeURIComponent(name));
test('Instagram refuses missing configuration, arbitrary artists and injected usernames before network calls',async()=>{
  const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('not expected');};
  try{
    assert.equal((await onRequestGet({request:request('BTS'),env:{}})).status,503);
    assert.equal((await onRequestGet({request:request('unknown'),env})).status,400);
    assert.equal((await onRequestGet({request:request('BTS'),env:{...env,INSTAGRAM_ARTIST_ACCOUNTS:JSON.stringify({BTS:'evil){id}'})}})).status,404);
    assert.equal(calls,0);
  }finally{globalThis.fetch=original;}
});
test('Instagram keeps the token server-side, limits media and normalizes safe links without retaining captions',async()=>{
  const original=globalThis.fetch;let call;
  globalThis.fetch=async(url,options)=>{call={url:String(url),options};return Response.json({business_discovery:{username:'verified_test_account',media:{data:[
    {id:'1',media_type:'IMAGE',permalink:'https://instagram.com/p/abc_123/?tracking=1',timestamp:'2026-10-01T00:00:00Z',media_url:'https://scontent.cdninstagram.com/image.jpg',caption:'not republished'},
    {id:'2',media_type:'VIDEO',permalink:'https://www.instagram.com/reel/def_456/',timestamp:'2026-10-02T00:00:00Z',thumbnail_url:'https://attacker.invalid/private'},
    {id:'3',media_type:'IMAGE',permalink:'javascript:alert(1)',timestamp:'2026-10-03T00:00:00Z'},
    {id:'4',media_type:'IMAGE',permalink:'https://www.instagram.com/p/xyz/',timestamp:'invalid'}
  ]}}});};
  try{
    const r=await onRequestGet({request:request('BTS'),env});const data=await r.json();
    assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');
    assert.equal(data.items.length,2);assert.equal(data.items[0].permalink,'https://www.instagram.com/p/abc_123/');assert.equal(data.items[1].thumbnail,null);
    assert.equal(call.options.headers.Authorization,'Bearer private-test-token');assert.equal(call.options.redirect,'manual');
    assert.equal(call.url.includes('private-test-token'),false);assert.match(new URL(call.url).searchParams.get('fields'),/media.limit\(6\)/);
    assert.doesNotMatch(JSON.stringify(data),/private-test-token|not republished/);
  }finally{globalThis.fetch=original;}
});
test('Instagram provider errors and unexpected accounts fail closed without leaking response bodies',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>Response.json({error:{message:'private provider detail'}},{status:403});
    const r=await onRequestGet({request:request('BTS'),env});assert.equal(r.status,502);assert.equal((await r.json()).error,'INSTAGRAM_UNAVAILABLE');
    globalThis.fetch=async()=>Response.json({business_discovery:{username:'different_account',media:{data:[]}}});
    assert.equal((await onRequestGet({request:request('BTS'),env})).status,502);
  }finally{globalThis.fetch=original;}
});
