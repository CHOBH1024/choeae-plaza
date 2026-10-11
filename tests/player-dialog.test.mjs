import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../public/music-hub.css',import.meta.url),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];

test('playing keeps dialog space above the persistent player, including the artist bottom navigation',()=>{
  assert.match(css,/body\.playing \.modal\{[^}]*bottom:var\(--player-h/);
  assert.match(css,/body\.playing #singerBox\{[^}]*height:calc\(100dvh - var\(--player-h/);
  assert.match(css,/body\.playing \.md-bottom-nav\{[^}]*bottom:var\(--player-h/);
  assert.match(html,/\.player\{[\s\S]*?z-index:1000/);
});

test('dialog focus includes the visible player and iframe, but not hidden controls',()=>{
  const button={hidden:false,getAttribute:()=>null,getClientRects:()=>[{}]};
  const frame={...button}, hidden={...button,hidden:true};
  const dialog={querySelectorAll:()=>[button,hidden]};
  const player={hidden:false,querySelectorAll:selector=>{assert.match(selector,/iframe/);return [frame];}};
  const c={$:()=>player};
  vm.runInNewContext(fn('dialogFocusables'),c);
  assert.deepEqual(Array.from(c.dialogFocusables(dialog)),[button,frame]);
  player.hidden=true;
  assert.deepEqual(Array.from(c.dialogFocusables(dialog)),[button]);
});

test('height updates also describe dialogs as nonmodal while the separate player is visible',()=>{
  const attrs={},player={hidden:false,offsetHeight:320};
  const dialog={setAttribute:(key,value)=>attrs[key]=value};
  const c={$:()=>player,document:{documentElement:{style:{setProperty(){}}},querySelectorAll:()=>[dialog]}};
  vm.runInNewContext(fn('syncPlayerHeight'),c);
  c.syncPlayerHeight();assert.equal(attrs['aria-modal'],'false');
  player.hidden=true;c.syncPlayerHeight();assert.equal(attrs['aria-modal'],'true');
});
