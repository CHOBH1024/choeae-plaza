const KINDS=new Set(['campaign','editorial']);
export function normalizeShowcaseResponse(data,kind){
  if(!KINDS.has(kind)||!data||data.ok!==true||data.source!=='youtube-search'||data.scope!=='artist-'+kind+'-search'||data.order!=='date'||data.refreshSeconds!==900||!Number.isFinite(Date.parse(data.generatedAt))||!Array.isArray(data.items))throw Error('INVALID_SEARCH');
  const seen=new Set();
  const items=data.items.slice(0,8).flatMap(v=>{
    if(!v||typeof v.videoId!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(v.videoId)||seen.has(v.videoId)||typeof v.title!=='string'||!v.title.trim()||!Number.isFinite(Date.parse(v.published)))return [];
    seen.add(v.videoId);
    return [Object.freeze({videoId:v.videoId,title:v.title.trim().slice(0,200),channelTitle:typeof v.channelTitle==='string'?v.channelTitle.slice(0,100):'',published:new Date(v.published).toISOString()})];
  });
  if(data.items.length&&!items.length)throw Error('INVALID_SEARCH');
  return Object.freeze({generatedAt:new Date(data.generatedAt).toISOString(),items:Object.freeze(items)});
}
// One active view request. Public metadata only; no cookies, accounts or device writes.
export function createShowcaseSearch(fetcher,now=Date.now){
  const cache=new Map();let serial=0,controller=null;
  function cancel(){serial++;controller?.abort();controller=null;}
  async function load(name,kind){
    cancel();const current=serial;
    if(typeof name!=='string'||!name.trim()||name.length>80||!KINDS.has(kind))return {status:'error'};
    const key=name+'|'+kind,cached=cache.get(key);
    if(cached?.until>now())return {status:'ready',data:cached.data};
    const request=new AbortController();controller=request;
    const timer=setTimeout(()=>request.abort(),10000);
    try{
      const response=await fetcher('/api/showcase?name='+encodeURIComponent(name)+'&kind='+kind,{signal:request.signal,credentials:'omit'});
      if(!response.ok)throw Error('SEARCH_FAILED');
      const data=normalizeShowcaseResponse(await response.json(),kind);
      if(serial!==current||request.signal.aborted)return {status:'cancelled'};
      cache.delete(key);cache.set(key,{data,until:Math.min(now()+900000,Date.parse(data.generatedAt)+900000)});
      while(cache.size>200)cache.delete(cache.keys().next().value);
      return {status:'ready',data};
    }catch{
      if(serial!==current)return {status:'cancelled'};
      return {status:'error',data:cached?.data};
    }finally{clearTimeout(timer);if(controller===request)controller=null;}
  }
  return {load,cancel};
}
