import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readTransportVM as vm} from './read-transport-fixture.mjs';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))?.[0];

test('comment plain text decodes entities once, retains newlines and does not truncate',()=>{
  assert.ok(fn('commentPlainText'));
  const c={};vm.runInNewContext(fn('commentPlainText'),c);
  for(const [input,expected] of [["I can&#39;t &amp; &#x1f49a;","I can't & 💚"],['&amp;lt;script&amp;gt;','&lt;script&gt;'],['&#0; &#xD800; &#x110000;','� � �'],['日本語\n한국어','日本語\n한국어'],['&constructor; &unknown;','&constructor; &unknown;'],[{},''],[null,''],['x'.repeat(5000),'x'.repeat(5000)]]) assert.equal(c.commentPlainText(input),expected);
});

test('rendered comments escape decoded markup and offer only a known YouTube video URL',async()=>{
  const list={innerHTML:''},c={openSinger:'BTS',ytCommentRequest:0,playerVideos:{BTS:[{videoId:'aaaaaaaaaaa'}]},$:()=>list,
    fetch:async()=>({ok:true,json:async()=>({comments:[{author:'&lt;img src=x&gt;',text:'&lt;script&gt;bad&lt;/script&gt;\n'+ 'x'.repeat(3000),date:'&quot;today&quot;',likes:2,link:'javascript:alert(1)'}]})})};
  vm.runInNewContext(['esc','commentPlainText','loadYTComments'].map(fn).join('\n'),c);await c.loadYTComments('BTS');
  assert.match(list.innerHTML,/&lt;script&gt;bad&lt;\/script&gt;/);
  assert.match(list.innerHTML,/&lt;img src=x&gt;/);
  assert.ok(list.innerHTML.includes('x'.repeat(3000)));
  assert.match(list.innerHTML,/white-space:pre-wrap/);
  assert.match(list.innerHTML,/href="https:\/\/www.youtube.com\/watch\?v=aaaaaaaaaaa"/);
  assert.match(list.innerHTML,/rel="noopener noreferrer"/);
  assert.doesNotMatch(list.innerHTML,/<script|<img|javascript:/);
});

test('empty comments retain original access; invalid video IDs never become external links',async()=>{
  for(const [id,linked] of [['aaaaaaaaaaa',true],['javascript:alert(1)',false]]){
    const list={innerHTML:''},c={openSinger:'BTS',ytCommentRequest:0,playerVideos:{BTS:[{videoId:id}]},$:()=>list,
      fetch:async()=>({ok:true,json:async()=>({comments:[]})})};
    vm.runInNewContext(['esc','commentPlainText','loadYTComments'].map(fn).join('\n'),c);await c.loadYTComments('BTS');
    assert.equal(list.innerHTML.includes('https://www.youtube.com/watch?v='),linked);
    assert.doesNotMatch(list.innerHTML,/javascript:/);
  }
});
