import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];
function fixture({hidden=false,left=0,top=0,width=300,height=200,cover=false,clip=null,opacity='1',viewport=null}={}) {
  const parent=clip?{parentElement:null,getBoundingClientRect:()=>clip,style:{overflowX:'hidden',overflowY:'hidden'}}:null;
  const frame={hidden:false,parentElement:parent,getBoundingClientRect:()=>({left,top,right:left+width,bottom:top+height,width,height}),contains:()=>false};
  const c={document:{visibilityState:hidden?'hidden':'visible',getElementById:()=>frame,elementFromPoint:()=>cover?{}:frame},
    window:{innerWidth:400,innerHeight:400,visualViewport:viewport},$:()=>({hidden:false}),
    getComputedStyle:node=>({display:'block',visibility:'visible',opacity:node===frame?opacity:'1',overflowX:'visible',overflowY:'visible',...node.style}),
    currentQueue:[{videoId:'aaaaaaaaaaa'},{videoId:'bbbbbbbbbbb'}],currentQIdx:0,playVideo(){c.loads++;},loads:0,toast(){}};
  vm.runInNewContext([fn('playerAllowsAutoplay'),fn('playerNext')].join('\n'),c);
  return c;
}
for(const [name,options,allowed] of [
  ['fully visible',{},true],['hidden tab',{hidden:true},false],['zero size',{height:0},false],
  ['offscreen',{top:450},false],['exactly half visible',{top:300},false],['more than half visible',{top:299},true],
  ['overlay',{cover:true},false],['transparent ancestor/frame',{opacity:'0'},false],
  ['clipped by scrolling parent',{clip:{left:0,top:0,right:300,bottom:90}},false],
  ['visual viewport smaller than layout viewport',{viewport:{offsetLeft:0,offsetTop:0,width:400,height:90}},false]
]) test('automatic playback visibility: '+name,()=>assert.equal(fixture(options).playerAllowsAutoplay(),allowed));
test('denied automatic next preserves queue and manual next remains explicit',()=>{
  const c=fixture({hidden:true});c.playerNext(true);assert.equal(c.currentQIdx,0);assert.equal(c.loads,0);
  c.playerNext(false);assert.equal(c.currentQIdx,1);assert.equal(c.loads,1);
});
test('visible automatic next advances once and queue end does not replay',()=>{
  const c=fixture();c.playerNext(true);c.playerNext(true);assert.equal(c.currentQIdx,1);assert.equal(c.loads,1);
});
