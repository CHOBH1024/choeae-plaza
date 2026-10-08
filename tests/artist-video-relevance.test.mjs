import test from 'node:test';
import assert from 'node:assert/strict';
import {ARTIST_NAMES} from '../functions/_shared/artists.js';
import {artistQueryName,matchesArtistMetadata} from '../functions/_shared/artist-video-relevance.js';

test('artist queries and metadata selection cover the catalog without arbitrary query input',()=>{
  for(const name of ARTIST_NAMES){
    const query=artistQueryName(name);
    assert.equal(query,name==='BTS'?'방탄소년단':name);
    assert.equal(matchesArtistMetadata(name,{title:query+' 광고 촬영'}),true,name);
  }
  assert.equal(artistQueryName('unknown -injection'),'');
  assert.equal(matchesArtistMetadata('__proto__',{title:'anything'}),false);
});
test('BTS behind-the-scenes ambiguity never identifies unrelated actors or artists',()=>{
  for(const title of ['Jung Haein Photoshoot BTS','[ONEW] 메이폴 화보 메이킹','지드래곤 화보촬영 메이킹','BTS generic behind the scenes'])assert.equal(matchesArtistMetadata('BTS',{title,channelTitle:'Fashion Magazine'}),false,title);
  for(const item of [{title:'방탄소년단 화보 촬영'},{title:'헤드폰 광고를 찍은 뷔?!'},{title:'Jung Kook photoshoot'},{title:'Look what RM can do',description:'RM of BTS'},{title:'촬영 현장',channelTitle:'BANGTANTV'}])assert.equal(matchesArtistMetadata('BTS',item),true,JSON.stringify(item));
  assert.equal(matchesArtistMetadata('BTS',{title:'VIEW 영국 모델 올리의 화보 영상',channelTitle:'VIEW Plastic Surgery',description:'뷔 방탄소년단 BTS #화보'}),false,'unrelated promotion cannot qualify through description tags alone');
});
test('name boundaries, Korean particles, Unicode normalization and malformed metadata are handled',()=>{
  assert.equal(matchesArtistMetadata('아이브',{title:'아카이브 화보'}),false);
  assert.equal(matchesArtistMetadata('아이브',{title:'아이브랜드 촬영'}),false);
  assert.equal(matchesArtistMetadata('TXT',{title:'context photoshoot'}),false);
  assert.equal(matchesArtistMetadata('TXT',{title:'ＴＸＴ 화보'}),true);
  assert.equal(matchesArtistMetadata('임영웅',{title:'임영웅의 새로운 광고'}),true);
  assert.equal(matchesArtistMetadata('아이브',{title:'촬영',channelTitle:'아이브'}),true);
  assert.equal(matchesArtistMetadata('아이브',{title:'모델 화보',description:'#아이브'}),false);
  assert.equal(matchesArtistMetadata('아이브',{title:{toString(){throw Error('must not convert objects');}},description:null}),false);
});
