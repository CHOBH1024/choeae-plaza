export const LANGUAGES = ['ko','zh','ja','en','es','fr'];
export function normalizeLanguage(value){const base=String(value||'').toLowerCase().split('-')[0];return LANGUAGES.includes(base)?base:null;}
export function selectLocale(country,acceptLanguage=''){
  const c=String(country||'').toUpperCase();
  if(c==='KR')return {lang:'ko',reason:'country'};
  if(['CN','TW','HK','MO'].includes(c))return {lang:'zh',reason:'country'};
  if(c==='JP')return {lang:'ja',reason:'country'};
  if(['ES','MX','AR','CL','CO','PE','VE','UY','PY','BO','EC','PA','CR','GT','HN','SV','NI','DO','PR','GQ'].includes(c))return {lang:'es',reason:'country'};
  if(['FR','MC','GF','GP','MQ','RE','YT'].includes(c))return {lang:'fr',reason:'country'};
  if(['US','GB','AU','NZ','IE'].includes(c))return {lang:'en',reason:'country'};
  const candidates=String(acceptLanguage).slice(0,512).split(',').map((part,index)=>{
    const [tag,quality]=part.trim().split(';');const q=quality?Number(quality.trim().replace(/^q=/,'')):1;
    return {lang:normalizeLanguage(tag),q,index};
  }).filter(x=>x.lang && Number.isFinite(x.q) && x.q>0 && x.q<=1).sort((a,b)=>b.q-a.q||a.index-b.index);
  return {lang:candidates[0]?.lang || 'ko',reason:candidates.length?'browser':'fallback'};
}
