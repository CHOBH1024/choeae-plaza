import test from 'node:test';
import assert from 'node:assert/strict';
import {providerText} from '../functions/_shared/provider-text.js';
test('provider title entities decode once as bounded plain text, preserving non-Latin titles',()=>{
  assert.equal(providerText('BTS &#39;무대&#39; &amp; &quot;LIVE&quot; &#x1f49a;'),'BTS \'무대\' & "LIVE" 💚');
  assert.equal(providerText('日本語 &nbsp; 中文 &mdash; Français'),'日本語 中文 — Français');
  assert.equal(providerText('&amp;lt;script&amp;gt;'),'&lt;script&gt;');
  assert.equal(providerText('&lt;img src=x onerror=alert(1)&gt;'),'<img src=x onerror=alert(1)>');
  assert.equal(providerText('&#0; &#xD800; &#x110000;'),'� � �');
  assert.equal(providerText('hello\u0000\nworld'),'hello world');
  assert.equal(providerText({title:'do not stringify'}),'');
  assert.equal(providerText('a'.repeat(3000),100).length,100);
});
