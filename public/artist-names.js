// Discovery names only. Saved favorites and provider titles keep their original names.
// Verified name sources and coverage are recorded in RELEASE_REVIEW.md.
const variants=Object.freeze({
  BTS:['BTS','방탄소년단','방탄'],
  블랙핑크:['블랙핑크','BLACKPINK'],
  뉴진스:['뉴진스','NewJeans'],
  아이브:['아이브','IVE'],
  에스파:['에스파','aespa'],
  트와이스:['트와이스','TWICE'],
  세븐틴:['세븐틴','SEVENTEEN'],
  스트레이키즈:['스트레이키즈','Stray Kids'],
  엔하이픈:['엔하이픈','ENHYPEN'],
  TXT:['TXT','투모로우바이투게더','TOMORROW X TOGETHER'],
  르세라핌:['르세라핌','LE SSERAFIM'],
  ITZY:['ITZY','있지'],
  빅뱅:['빅뱅','BIGBANG'],
  위너:['위너','WINNER'],
  트레저:['트레저','TREASURE']
});
const fold=value=>typeof value==='string'?value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim().slice(0,80):'';
const lookup=new Map();
for(const [name,names] of Object.entries(variants)){
  Object.freeze(names);
  for(const value of names){
    const key=fold(value);
    if(lookup.has(key)&&lookup.get(key)!==name)throw Error('Ambiguous artist name');
    lookup.set(key,name);
  }
}
export function artistNameKey(name){return lookup.get(fold(name))||name;}
export function artistNameVariants(name){
  const key=artistNameKey(name);
  return Object.hasOwn(variants,key)?variants[key]:Object.freeze(typeof name==='string'?[name]:[]);
}
export function artistNameMatchesQuery(name,query){
  const q=fold(query);
  return !!q&&artistNameVariants(name).some(alias=>fold(alias).includes(q));
}
export function artistSearchName(name){
  const key=artistNameKey(name);
  return key==='BTS'?'방탄소년단':key==='TXT'?'투모로우바이투게더':key;
}
export const ARTIST_NAME_HELPERS=Object.freeze({key:artistNameKey,variants:artistNameVariants,matches:artistNameMatchesQuery,query:artistSearchName});
if(typeof window!=='undefined'){
  window.CHOEAE_ARTIST_NAMES=ARTIST_NAME_HELPERS;
  const input=document.getElementById('searchInput');
  if(document.activeElement===input&&input?.value.trim()&&typeof window.doSearch==='function')window.doSearch(input.value);
}
