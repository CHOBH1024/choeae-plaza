import test from 'node:test';
import assert from 'node:assert/strict';
import {artistNameKey,artistNameVariants,artistNameMatchesQuery,artistSearchName,ARTIST_NAME_HELPERS} from '../public/artist-names.js';
test('discovery helpers normalize supported names, not unknown data or inherited object keys',()=>{
  assert.equal(artistNameKey(' ＢＬＡＣＫＰＩＮＫ '),'블랙핑크');
  assert.equal(artistNameKey('있지'),'ITZY');
  assert.equal(artistNameKey('임영웅'),'임영웅');
  assert.deepEqual(artistNameVariants('__proto__'),['__proto__']);
  assert.deepEqual(artistNameVariants(null),[]);
  assert.equal(artistNameMatchesQuery('TXT','tomorrow x together'),true);
  assert.equal(artistNameMatchesQuery('블랙핑크','BLACKPINK'),true);
  assert.equal(artistNameMatchesQuery('블랙핑크',''),false);
  assert.equal(artistNameMatchesQuery('블랙핑크',{}),false);
  assert.equal(artistSearchName('BTS'),'방탄소년단');
  assert.equal(artistSearchName('TXT'),'투모로우바이투게더');
  assert.equal(artistSearchName('있지'),'ITZY');
  assert.equal(artistSearchName('임영웅'),'임영웅');
});
test('shared name arrays and helper surface are immutable and do not require browser globals',()=>{
  assert.equal(Object.isFrozen(ARTIST_NAME_HELPERS),true);
  assert.throws(()=>artistNameVariants('블랙핑크').push('unverified'),TypeError);
  assert.throws(()=>ARTIST_NAME_HELPERS.query=()=>'',TypeError);
  assert.deepEqual(artistNameVariants('블랙핑크'),['블랙핑크','BLACKPINK']);
});
