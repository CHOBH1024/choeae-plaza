import {ALLOWED_ARTISTS} from '../_shared/artists.js';
const jobs = new Map();
const cooldowns = new Map();
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
  if ((cooldowns.get(name)||0)>Date.now()) return json({ok:false,error:'YOUTUBE_SEARCH_UNAVAILABLE'},502);
  if (jobs.has(name)) return (await jobs.get(name)).clone();
  const job = (async()=>{
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    for (const [k,v] of Object.entries({part:'snippet',type:'video',q:name+' 직캠',order:'date',maxResults:'8',videoEmbeddable:'true',videoSyndicated:'true',safeSearch:'moderate',key:env.YOUTUBE_API_KEY})) url.searchParams.set(k,v);
    try {
      const upstream = await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'error'});
      if (!upstream.ok) throw Error('SEARCH_FAILED');
      const data = await upstream.json();
      if (!data || !Array.isArray(data.items)) throw Error('SEARCH_INVALID');
      const seen = new Set();
      const items = data.items.slice(0,8).flatMap(item=>{
        const id=item?.id?.videoId, s=item?.snippet;
        if (typeof id!=='string' || !/^[A-Za-z0-9_-]{11}$/.test(id) || seen.has(id) || !s || typeof s.title!=='string' || !Number.isFinite(Date.parse(s.publishedAt))) return [];
        seen.add(id);
        return [{videoId:id,title:s.title.slice(0,200),channelTitle:String(s.channelTitle||'').slice(0,100),published:new Date(s.publishedAt).toISOString(),kind:'fancam'}];
      });
      if (data.items.length && !items.length) throw Error('SEARCH_INVALID');
      const response=json({ok:true,source:'youtube-search',scope:'artist-fancam-search',order:'date',generatedAt:new Date().toISOString(),refreshSeconds:900,items});
      if (cache) {
        const save=cache.put(key,response.clone()).catch(()=>{});
        if (waitUntil) waitUntil(save); else await save;
      }
      return response;
    } catch {
      // Short per-isolate cooldown avoids tight retries after quota/provider failures.
      cooldowns.set(name,Date.now()+60000);
      return json({ok:false,error:'YOUTUBE_SEARCH_UNAVAILABLE'},502);
    }
  })();
  jobs.set(name,job);
  try {return (await job).clone();} finally {if(jobs.get(name)===job) jobs.delete(name);}
}
