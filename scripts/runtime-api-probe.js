// Test-only worker. Never deployed: checks real workerd Request options, no external calls.
import {onRequestGet as fancams} from '../functions/api/fancams.js';
import {onRequestGet as instagram} from '../functions/api/instagram.js';
import {onRequestGet as showcase} from '../functions/api/showcase.js';
let redirectFixture=false;
globalThis.fetch=async(url,options)=>{
  // Node mocks alone cannot reveal options rejected by workerd's Request constructor.
  const req=new Request(url,options);
  if(req.redirect!=='manual')throw Error('MUST_NOT_FOLLOW');
  if(redirectFixture)return new Response(null,{status:302,headers:{Location:'https://untrusted.invalid/'}});
  if(new URL(req.url).hostname==='www.googleapis.com')return Response.json({items:[{id:{videoId:'aaaaaaaaaaa'},snippet:{title:'fixture',publishedAt:'2026-10-08T00:00:00Z'}}]});
  return Response.json({business_discovery:{username:'fixture_account',media:{data:[]}}});
};
export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    redirectFixture=path.endsWith('-redirect');
    const name=redirectFixture?'아이브':'BTS';
    const input=new Request('https://probe.test/api/'+(path.startsWith('/instagram')?'instagram':'fancams')+'?name='+encodeURIComponent(name));
    if(path.startsWith('/instagram'))return instagram({request:input,env:{META_ACCESS_TOKEN:'fake-test-token',META_IG_USER_ID:'1234567890',META_GRAPH_VERSION:'v99.0',INSTAGRAM_ARTIST_ACCOUNTS:JSON.stringify({BTS:'fixture_account',아이브:'fixture_account'})}});
    if(path.startsWith('/showcase'))return showcase({request:new Request('https://probe.test/api/showcase?name='+encodeURIComponent(name)+'&kind='+(path.includes('editorial')?'editorial':'campaign')),env:{YOUTUBE_API_KEY:'fake-test-key'},waitUntil:p=>ctx.waitUntil(p)});
    return fancams({request:input,env:{YOUTUBE_API_KEY:'fake-test-key'},waitUntil:p=>ctx.waitUntil(p)});
  }
};
