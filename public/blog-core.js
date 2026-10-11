// Naver search results are previews, not verified artist posts or a complete feed.
export function safeBlogURL(value){
  if(typeof value!=='string'||value.length>4096)return '';
  try{
    const u=new URL(value),host=u.hostname.toLowerCase();
    if(u.username||u.password||u.port||!host.includes('.')||host.endsWith('.local')||host.endsWith('.localhost')||host.endsWith('.internal')||/^[\d.]+$/.test(host)||host.includes(':'))return '';
    const naver=['blog.naver.com','m.blog.naver.com','post.naver.com','openapi.naver.com'].includes(host);
    if(u.protocol!=='https:'&&!(u.protocol==='http:'&&naver))return '';
    if(host==='openapi.naver.com'&&u.pathname!=='/l')return '';
    return value;
  }catch{return '';}
}
export function plainBlogText(value){
  if(typeof value!=='string')return '';
  return value.slice(0,6000).replace(/<[^>]*>/g,'').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(entity,token)=>{
    if(token[0]!=='#')return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'}[token.toLowerCase()];
    const point=token[1].toLowerCase()==='x'?parseInt(token.slice(2),16):parseInt(token.slice(1),10);
    return Number.isInteger(point)&&point>0&&point<=0x10ffff&&!(point>=0xd800&&point<=0xdfff)?String.fromCodePoint(point):'';
  }).trim();
}
export function blogDate(value){
  if(typeof value!=='string'||!/^\d{8}$/.test(value))return '';
  const iso=value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6),date=new Date(iso+'T00:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===iso?iso:'';
}
export function normalizeBlogResults(data,sort){
  if(!data||data.ok!==true||!Object.hasOwn(data,'items')||!Array.isArray(data.items)||data.items.length>100||data.sort!==sort)throw new Error('Invalid blog response');
  const items=[];let partial=false;
  for(const row of data.items){
    const link=safeBlogURL(row?.link),title=plainBlogText(row?.title);
    if(!row||typeof row!=='object'||Array.isArray(row)||!link||!title||typeof row.title!=='string'||row.title.length>6000){partial=true;continue;}
    const date=blogDate(row.postdate);
    items.push({link,title,description:plainBlogText(row.description),blogger:plainBlogText(row.bloggername),date,host:new URL(link).hostname});
  }
  if(data.items.length&&!items.length)throw new Error('No usable blog results');
  return {items:items.slice(0,8),sort,partial};
}
export function createBlogSearch(transport=fetch,{timeoutMs=8000,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let active=null,sequence=0;
  function cancel(){sequence++;active?.controller.abort();active=null;}
  function load(name,sort='date'){
    if(typeof name!=='string'||!name.trim()||name.length>40||!['date','sim'].includes(sort))return Promise.resolve({status:'error',reason:'invalid'});
    const key=JSON.stringify([name,sort]);if(active?.key===key)return active.job;
    cancel();const token=sequence,controller=new AbortController(),entry={key,controller};active=entry;
    entry.job=(async()=>{
      let timedOut=false,timer;
      try{
        const aborted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('Blog request aborted')),{once:true}));
        timer=setTimer(()=>{timedOut=true;controller.abort();},timeoutMs);
        const data=await Promise.race([Promise.resolve().then(async()=>{
          if(controller.signal.aborted)throw new Error('Blog request cancelled');
          const r=await transport('/api/blog?name='+encodeURIComponent(name)+'&sort='+sort,{cache:'no-store',signal:controller.signal});
          if(!r.ok){const err=new Error('Blog search unavailable');if(r.status===503){const body=await r.json();if(body?.error==='NAVER_SEARCH_NOT_CONFIGURED')err.reason='not-configured';}throw err;}
          return r.json();
        }),aborted]);
        if(token!==sequence)return {status:'cancelled'};
        const result=normalizeBlogResults(data,sort);
        return {status:result.partial?'partial':'ready',data:result};
      }catch(error){return token!==sequence?{status:'cancelled'}:{status:'error',reason:timedOut?'timeout':error.reason||'unavailable'};}
      finally{clearTimer(timer);if(active===entry)active=null;}
    })();return entry.job;
  }
  return {load,cancel};
}
