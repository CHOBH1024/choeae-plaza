import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/mobile-shell.js',import.meta.url),'utf8');
function fixture(){
  let change,mutation;const events={};
  class Node{
    constructor(id){this.id=id;this.children=[];this.hidden=false;this.open=false;this.offsetHeight=69;}
    append(node){if(node.parentNode)node.parentNode.children.splice(node.parentNode.children.indexOf(node),1);this.children.push(node);node.parentNode=this;}
    insertBefore(node,reference){reference.before(node);}
    before(node){const p=this.parentNode;p.append(node);p.children.splice(p.children.indexOf(node),1);p.children.splice(p.children.indexOf(this),0,node);}
    after(node){const p=this.parentNode;p.append(node);p.children.splice(p.children.indexOf(node),1);p.children.splice(p.children.indexOf(this)+1,0,node);}
    get previousSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)-1];}
    contains(node){return this===node||this.children.some(n=>n.contains(node));}
    focus(){doc.activeElement=this;}
    querySelector(){return this.children[0];}
  }
  const ids=['mobileDisplaySettings','mobileDisplaySettingsBody','mobileSettingsToggle','localeTools','playerBar','headerTools'];
  const nodes=Object.fromEntries(ids.map(id=>[id,new Node(id)]));
  const header=new Node('header'),main=new Node('main'),view=new Node('view'),nav=new Node('nav'),button=new Node('viewButton');view.append(button);
  const search=new Node('search');header.append(view);header.append(nodes.headerTools);main.append(search);main.append(nodes.localeTools);nodes.mobileDisplaySettings.hidden=true;
  nodes.mobileDisplaySettings.append(nodes.mobileSettingsToggle);nodes.mobileDisplaySettings.append(nodes.mobileDisplaySettingsBody);
  nodes.playerBar.hidden=true;const style={};
  const root={dataset:{experience:'idol'},style:{setProperty:(key,value)=>style[key]=value}};
  const doc={documentElement:root,activeElement:null,getElementById:id=>nodes[id],querySelector:s=>({'.tabbar':nav,'.experience-switch':view,'.search':search,'.appbar-in':header,'.appbar':header})[s],createComment:()=>new Node('anchor'),addEventListener:(name,fn)=>events[name]=fn};
  const query={matches:true,addEventListener:(_name,fn)=>change=fn};
  const context={document:doc,window:{matchMedia:()=>query,addEventListener(){}},MutationObserver:class{constructor(fn){mutation=fn;}observe(){}},ResizeObserver:class{observe(){}}};
  vm.runInNewContext(source,context);
  return {doc,root,nodes,view,header,main,search,query,style,events,resize(value){query.matches=value;change();},mode(value){root.dataset.experience=value;mutation();}};
}
test('responsive settings move original controls and restore their exact homes, without cloning or data writes',()=>{
  const f=fixture(),panel=f.nodes.mobileDisplaySettingsBody;
  assert.equal(f.view.parentNode,panel);assert.equal(f.nodes.localeTools.parentNode,panel);
  assert.equal(f.nodes.mobileDisplaySettings.hidden,false);assert.equal(f.style['--hub-nav-h'],'69px');
  assert.equal(f.style['--app-header-h'],'69px');
  f.resize(false);assert.equal(f.view.parentNode,panel);assert.equal(f.nodes.localeTools.parentNode,panel);
  assert.equal(f.nodes.mobileDisplaySettings.hidden,false);assert.equal(f.style['--hub-nav-h'],'0px');assert.equal(f.search.parentNode,f.header);
  f.resize(true);assert.equal(f.view.parentNode,panel);assert.equal(f.search.parentNode,f.main);
  f.mode('classic');assert.equal(f.view.parentNode,f.header);assert.equal(f.nodes.localeTools.parentNode,f.main);assert.equal(f.search.parentNode,f.main);
  assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|cloneNode|innerHTML|driveData/);
});
test('Escape returns focus, action/outside clicks close settings, and resizing does not hide the focused control',()=>{
  const f=fixture(),settings=f.nodes.mobileDisplaySettings;
  settings.open=true;let prevented=false;f.events.keydown({key:'Escape',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(settings.open,false);assert.equal(f.doc.activeElement,f.nodes.mobileSettingsToggle);
  settings.open=true;f.events.click({target:{closest:()=>({dataset:{act:'tab'}})}});assert.equal(settings.open,false);
  settings.open=true;f.events.click({target:{closest:()=>null}});assert.equal(settings.open,false);
  f.resize(false);f.doc.activeElement=f.view.children[0];f.resize(true);assert.equal(settings.open,true);
  f.mode('classic');assert.equal(settings.open,false);assert.equal(f.doc.activeElement,f.view.children[0]);
});
