import {ALLOWED_ARTISTS} from '../_shared/artists.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const usernameOK=value=>typeof value==='string'&&/^[A-Za-z0-9._]{1,30}$/.test(value);
function permalink(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['instagram.com','www.instagram.com'].includes(u.hostname)&&/^\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)?'https://www.instagram.com'+u.pathname:null;}catch{return null;}
}
function thumbnail(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['cdninstagram.com','fbcdn.net'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))&&!['access_token','token'].some(k=>u.searchParams.has(k))?u.href:null;}catch{return null;}
}
export async function onRequestGet({request,env}){
  const name=new URL(request.url).searchParams.get('name')?.trim();
  if(!ALLOWED_ARTISTS.has(name)) return json({ok:false,error:'ARTIST_NOT_FOUND'},400);
  if(!env.META_ACCESS_TOKEN||!/^\d{5,30}$/.test(env.META_IG_USER_ID||'')||!/^v\d{1,3}\.\d{1,2}$/.test(env.META_GRAPH_VERSION||'')) return json({ok:false,error:'INSTAGRAM_NOT_CONFIGURED'},503);
  let accounts;try{accounts=JSON.parse(env.INSTAGRAM_ARTIST_ACCOUNTS||'{}');}catch{return json({ok:false,error:'INSTAGRAM_NOT_CONFIGURED'},503);}
  const username=accounts&&Object.hasOwn(accounts,name)?accounts[name]:null;
  if(!usernameOK(username)) return json({ok:false,error:'INSTAGRAM_ACCOUNT_NOT_CONFIGURED'},404);
  const url=new URL('https://graph.facebook.com/'+env.META_GRAPH_VERSION+'/'+env.META_IG_USER_ID);
  url.searchParams.set('fields','business_discovery.username('+username+'){username,media.limit(6){id,media_type,media_url,thumbnail_url,permalink,timestamp}}');
  try{
    const response=await fetch(url,{headers:{Authorization:'Bearer '+env.META_ACCESS_TOKEN},signal:AbortSignal.timeout(8000),redirect:'error'});
    if(!response.ok) return json({ok:false,error:'INSTAGRAM_UNAVAILABLE'},502);
    const data=(await response.json())?.business_discovery;
    if(!data||typeof data.username!=='string'||data.username.toLowerCase()!==username.toLowerCase()||!Array.isArray(data.media?.data)) return json({ok:false,error:'INSTAGRAM_UNAVAILABLE'},502);
    const items=data.media.data.slice(0,6).flatMap(post=>{
      const link=post&&permalink(post.permalink);
      if(!link||!['IMAGE','VIDEO','CAROUSEL_ALBUM'].includes(post.media_type)||!Number.isFinite(Date.parse(post.timestamp))) return [];
      return [{permalink:link,type:post.media_type,published:new Date(post.timestamp).toISOString(),thumbnail:thumbnail(post.media_type==='IMAGE'?post.media_url:post.thumbnail_url)}];
    });
    return json({ok:true,source:'meta-business-discovery',username,profile:'https://www.instagram.com/'+username+'/',generatedAt:new Date().toISOString(),items});
  }catch{return json({ok:false,error:'INSTAGRAM_UNAVAILABLE'},502);}
}
