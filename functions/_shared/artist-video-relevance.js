import {ALLOWED_ARTISTS} from './artists.js';
import {artistNameVariants,artistSearchName} from '../../public/artist-names.js';

// BTS also means behind-the-scenes. Use the unambiguous group name in searches.
// Stage names: https://ibighit.com/ko/bts/profile/ . These are search hints,
// not proof of the identity of the uploader or the people shown in a video.
const btsNames=Object.freeze(['방탄소년단','방탄','Bangtan','BANGTANTV','슈가','제이홉','지민','정국','뷔','석진','남준','SUGA','j-hope','Jimin','Jung Kook','Jungkook']);
const normalize=value=>typeof value==='string'?value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim().slice(0,6000):'';
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function containsName(text,name){
  const normalized=normalize(name);
  // Do not match TXT inside context, or 아이브 inside 아카이브. Korean particles
  // may follow a name, but arbitrary letters are not accepted as its suffix.
  return new RegExp('(^|[^\\p{L}\\p{N}])'+escape(normalized)+'(?=$|[^\\p{L}\\p{N}]|(?:의|은|는|이|가|을|를|와|과|님)(?:$|[^\\p{L}\\p{N}]))','u').test(text);
}
export function artistQueryName(name){
  return ALLOWED_ARTISTS.has(name)?artistSearchName(name):'';
}
export function matchesArtistMetadata(name,item){
  if(!ALLOWED_ARTISTS.has(name)||!item||typeof item!=='object')return false;
  const text=normalize([item.title,item.channelTitle].filter(v=>typeof v==='string').join(' '));
  if(name!=='BTS')return artistNameVariants(name).some(alias=>containsName(text,alias));
  if(btsNames.some(alias=>containsName(text,alias)))return true;
  // V/Jin/RM and BTS alone are ambiguous. Accept their combination, not each
  // isolated abbreviation (e.g. Jung Haein Photoshoot BTS must be excluded).
  const shortName=['V','Jin','RM'].some(alias=>containsName(text,alias));
  const description=normalize(item.description);
  return shortName&&(containsName(text,'BTS')||['BTS','방탄소년단','Bangtan'].some(alias=>containsName(description,alias)));
}
