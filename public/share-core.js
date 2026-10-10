// Share public pages only. Never reuse the current query, login return URL or saved data.
export function publicShareData({origin, artistName, names=[], idol=false}) {
  const base=new URL(origin);
  if(!['https:','http:'].includes(base.protocol)||base.username||base.password)throw new Error('INVALID_SHARE_ORIGIN');
  const name=typeof artistName==='string'&&names.includes(artistName)?artistName:null;
  const url=new URL(name?'/singer/'+encodeURIComponent(name):(idol?'/':'/trot'),base.origin);
  return {title:name?name+' · 최애광장':'최애광장',url:url.href};
}
export function shareDestination(platform, data) {
  const url=new URL(data.url);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('INVALID_SHARE_URL');
  if(platform==='naver')return 'https://share.naver.com/web/shareView?url='+encodeURIComponent(url.href)+'&title='+encodeURIComponent(data.title);
  if(platform==='facebook')return 'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url.href);
  return null;
}
export async function copyPublicLink(clipboard, url) {
  if(!clipboard||typeof clipboard.writeText!=='function')return false;
  try{await clipboard.writeText(url);return true;}catch{return false;}
}
export async function nativePublicShare(share, data) {
  if(typeof share!=='function')return 'unsupported';
  try{await share(data);return 'handed-off';}catch(error){return error?.name==='AbortError'?'cancelled':'failed';}
}
