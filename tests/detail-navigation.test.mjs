import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const source=html.match(/function revealDetailShortcut\([^)]*\) \{[\s\S]*?\n\}/)[0];
test('keyboard shortcuts reveal only the clipped horizontal edge without changing vertical position or classic view',()=>{
  const nav={scrollLeft:20,scrollTop:400,getBoundingClientRect:()=>({left:0,right:320})};
  let rect={left:250,right:430};
  const button={closest:()=>nav,getBoundingClientRect:()=>rect};
  const c={document:{documentElement:{dataset:{experience:'idol'}}}};
  vm.runInNewContext(source,c);
  c.revealDetailShortcut(button);assert.equal(nav.scrollLeft,138);assert.equal(nav.scrollTop,400);
  rect={left:-10,right:90};c.revealDetailShortcut(button);assert.equal(nav.scrollLeft,120);
  rect={left:16,right:240};c.revealDetailShortcut(button);assert.equal(nav.scrollLeft,120);
  c.document.documentElement.dataset.experience='classic';rect={left:400,right:500};c.revealDetailShortcut(button);assert.equal(nav.scrollLeft,120);
  assert.doesNotMatch(source,/localStorage|fetch\(|scrollIntoView|scrollTop\s*=/);
});
