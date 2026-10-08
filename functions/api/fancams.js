import {ALLOWED_ARTISTS} from '../_shared/artists.js';
const jobs = new Map();
const cooldowns = new Map();
const safeFailures = new Set(['YOUTUBE_SEARCH_QUOTA','YOUTUBE_SEARCH_CONFIGURATION','YOUTUBE_SEARCH_REQUEST_REJECTED','YOUTUBE_SEARCH_INVALID_RESPONSE']);
const json = (body,status=200) => Response.json(body,{status,headers:{'Cache-Control':status===200?'public, max-age=900, s-maxage=900':'no-store'}});
export async function onRequestGet({request,env,waitUntil}) {
  const name = new URL(request.url).searchParams.get('name')?.trim();
  if (!ALLOWED_ARTISTS.has(name)) return json({ok:false,error:'ARTIST_NOT_FOUND'},400);
  if (!env.YOUTUBE_API_KEY) return json({ok:false,error:'YOUTUBE_API_NOT_CONFIGURED'},503);
  const cache = globalThis.caches?.default;
  // Canonical key prevents arbitrary query parameters from bypassing the cache.
  const key = new Request(new URL('/api/fancams?name='+encodeURIComponent(name),request.url));
  const cached = cache && await cache.match(key);
  if (cached) return cached;
  const cooldown=cooldowns.get(name);
  if (cooldown?.until>Date.now()) return json({ok:false,error:cooldown.error},502);
  if (jobs.has(name)) return (await jobs.get(name)).clone();
  const job = (async()=>{
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    for (const [k,v] of Object.entries({part:'snippet',type:'video',q:name+' 직캠',order:'date',maxResults:'8',videoEmbeddable:'true',videoSyndicated:'true',safeSearch:'moderate',key:env.YOUTUBE_API_KEY})) url.searchParams.set(k,v);
    try {
      const upstream = await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'error'});
      if (!upstream.ok) {
        const reason=await upstream.json().then(d=>d?.error?.errors?.[0]?.reason).catch(()=>null);
        const code=['quotaExceeded','dailyLimitExceeded','rateLimitExceeded'].includes(reason) ? 'YOUTUBE_SEARCH_QUOTA' : ['keyInvalid','accessNotConfigured','ipRefererBlocked'].includes(reason) ? 'YOUTUBE_SEARCH_CONFIGURATION' : upstream.status===400 ? 'YOUTUBE_SEARCH_REQUEST_REJECTED' : 'YOUTUBE_SEARCH_UNAVAILABLE';
        throw Error(code);
      }
      const data = await upstream.json().catch(()=>{throw Error('YOUTUBE_SEARCH_INVALID_RESPONSE');});
      if (!data || !Array.isArray(data.items)) throw Error('YOUTUBE_SEARCH_INVALID_RESPONSE');
      const seen = new Set();
      const items = data.items.slice(0,8).flatMap(item=>{
        const id=item?.id?.videoId, s=item?.snippet;
        if (typeof id!=='string' || !/^[A-Za-z0-9_-]{11}$/.test(id) || seen.has(id) || !s || typeof s.title!=='string' || !Number.isFinite(Date.parse(s.publishedAt))) return [];
        seen.add(id);
        return [{videoId:id,title:s.title.slice(0,200),channelTitle:String(s.channelTitle||'').slice(0,100),published:new Date(s.publishedAt).toISOString(),kind:'fancam'}];
      });
      if (data.items.length && !items.length) throw Error('YOUTUBE_SEARCH_INVALID_RESPONSE');
      const response=json({ok:true,source:'youtube-search',scope:'artist-fancam-search',order:'date',generatedAt:new Date().toISOString(),refreshSeconds:900,items});
      if (cache) {
        const save=cache.put(key,response.clone()).catch(()=>{});
        if (waitUntil) waitUntil(save); else await save;
      }
      return response;
    } catch (error) {
      // Short per-isolate cooldown avoids tight retries after quota/provider failures.
      const code=safeFailures.has(error?.message) ? error.message : ['TimeoutError','AbortError'].includes(error?.name) ? 'YOUTUBE_SEARCH_TIMEOUT' : 'YOUTUBE_SEARCH_UNAVAILABLE';
      cooldowns.set(name,{until:Date.now()+60000,error:code});
      return json({ok:false,error:code},502);
    }
  })();
  jobs.set(name,job);
  try {return (await job).clone();} finally {if(jobs.get(name)===job) jobs.delete(name);}
}
