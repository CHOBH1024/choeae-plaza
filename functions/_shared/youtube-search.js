import {ALLOWED_ARTISTS} from './artists.js';
import {providerText} from './provider-text.js';
const safeFailures = new Set(['YOUTUBE_SEARCH_QUOTA','YOUTUBE_SEARCH_CONFIGURATION','YOUTUBE_SEARCH_REQUEST_REJECTED','YOUTUBE_SEARCH_INVALID_RESPONSE']);
const json = (body,status=200) => Response.json(body,{status,headers:{'Cache-Control':status===200?'public, max-age=900, s-maxage=900':'no-store'}});
// Each route gets isolated coalescing/cooldown state, bounded by catalog x query kinds.
export function createArtistVideoSearch({path,queries,defaultKind,scope,kindParameter=false,queryName=name=>name,acceptItem=()=>true,maxCandidates=8,cacheVersion=''}) {
 if(!Number.isInteger(maxCandidates)||maxCandidates<8||maxCandidates>50)throw new TypeError('Invalid search candidate limit');
 const jobs=new Map(),cooldowns=new Map();
 return async function onRequestGet({request,env,waitUntil}) {
  const params=new URL(request.url).searchParams;
  const name=params.get('name')?.trim();
  const kind=kindParameter ? (params.get('kind')||defaultKind) : defaultKind;
  if(!Object.hasOwn(queries,kind))return json({ok:false,error:'SEARCH_KIND_INVALID'},400);
  if (!ALLOWED_ARTISTS.has(name)) return json({ok:false,error:'ARTIST_NOT_FOUND'},400);
  if (!env.YOUTUBE_API_KEY) return json({ok:false,error:'YOUTUBE_API_NOT_CONFIGURED'},503);
  const cache = globalThis.caches?.default;
  // Canonical key prevents arbitrary query parameters from bypassing the cache.
  const key = new Request(new URL(path+'?name='+encodeURIComponent(name)+(kindParameter?'&kind='+encodeURIComponent(kind):'')+(cacheVersion?'&selection='+encodeURIComponent(cacheVersion):''),request.url));
  const jobKey=name+'|'+kind;
  // Cache storage is an optimization, never a reason to discard usable provider data.
  let cached;
  try {cached = cache && await cache.match(key);} catch {}
  if (cached) return cached;
  const cooldown=cooldowns.get(jobKey);
  if (cooldown?.until>Date.now()) return json({ok:false,error:cooldown.error},502);
  if (jobs.has(jobKey)) return (await jobs.get(jobKey)).clone();
  const job = (async()=>{
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    for (const [k,v] of Object.entries({part:'snippet',type:'video',q:queryName(name)+queries[kind],order:'date',maxResults:String(maxCandidates),videoEmbeddable:'true',videoSyndicated:'true',safeSearch:'moderate',key:env.YOUTUBE_API_KEY})) url.searchParams.set(k,v);
    try {
      // Manual rejects redirect responses without forwarding the key to a new origin.
      const upstream = await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'manual'});
      if (!upstream.ok) {
        const reason=await upstream.json().then(d=>d?.error?.errors?.[0]?.reason).catch(()=>null);
        const code=['quotaExceeded','dailyLimitExceeded','rateLimitExceeded'].includes(reason) ? 'YOUTUBE_SEARCH_QUOTA' : ['keyInvalid','accessNotConfigured','ipRefererBlocked'].includes(reason) ? 'YOUTUBE_SEARCH_CONFIGURATION' : upstream.status===400 ? 'YOUTUBE_SEARCH_REQUEST_REJECTED' : 'YOUTUBE_SEARCH_UNAVAILABLE';
        throw Error(code);
      }
      const data = await upstream.json().catch(()=>{throw Error('YOUTUBE_SEARCH_INVALID_RESPONSE');});
      if (!data || !Array.isArray(data.items)) throw Error('YOUTUBE_SEARCH_INVALID_RESPONSE');
      const seen = new Set();
      const candidates = data.items.slice(0,maxCandidates).flatMap(item=>{
        const id=item?.id?.videoId, s=item?.snippet;
        if (typeof id!=='string' || !/^[A-Za-z0-9_-]{11}$/.test(id) || seen.has(id) || !s || typeof s.title!=='string' || !Number.isFinite(Date.parse(s.publishedAt))) return [];
        const title = providerText(s.title);
        if (!title) return [];
        seen.add(id);
        return [{videoId:id,title,channelTitle:providerText(s.channelTitle,100),description:providerText(s.description,2000),published:new Date(s.publishedAt).toISOString(),kind:'other'}];
      });
      if (data.items.length && !candidates.length) throw Error('YOUTUBE_SEARCH_INVALID_RESPONSE');
      // A valid but unrelated result is not a provider failure. Never fill an
      // empty artist shelf with unrelated videos. Descriptions stay server-side.
      const selected=candidates.filter(item=>acceptItem(name,item));
      const items=selected.slice(0,8).map(({description,...item})=>item);
      const response=json({ok:true,source:'youtube-search',scope:scope(kind),order:'date',generatedAt:new Date().toISOString(),refreshSeconds:900,...(cacheVersion?{selection:cacheVersion,filteredOut:candidates.length-selected.length}:{}),items});
      if (cache) {
        try {
          const save=cache.put(key,response.clone()).catch(()=>{});
          if (waitUntil) {try {waitUntil(save);} catch {await save;}}
          else await save;
        } catch {}
      }
      return response;
    } catch (error) {
      // Short per-isolate cooldown avoids tight retries after quota/provider failures.
      const code=safeFailures.has(error?.message) ? error.message : ['TimeoutError','AbortError'].includes(error?.name) ? 'YOUTUBE_SEARCH_TIMEOUT' : 'YOUTUBE_SEARCH_UNAVAILABLE';
      cooldowns.set(jobKey,{until:Date.now()+60000,error:code});
      return json({ok:false,error:code},502);
    }
  })();
  jobs.set(jobKey,job);
  try {return (await job).clone();} finally {if(jobs.get(jobKey)===job) jobs.delete(jobKey);}
}

}
