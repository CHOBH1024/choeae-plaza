import {createBlogSearch} from './blog-core.js?v=20261010-journey';
import {ownedText,ownedParamText} from './locale-copy.js?v=20261010-journey';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function prepareBlogReading(doc,closePlayer){
  const player=doc.getElementById('playerBar');
  if(!player||player.hidden)return true;
  try{if(typeof closePlayer==='function')closePlayer();}catch{}
  return player.hidden;
}
export function blogCards(data,lang){
  return (data?.items||[]).map(row=>'<article class="artist-blog-card"><a href="'+escape(row.link)+'" target="_blank" rel="noopener noreferrer"><span class="artist-blog-title">'+escape(row.title)+'</span><span class="artist-blog-meta">'+escape([row.blogger,row.host,row.date].filter(Boolean).join(' · '))+'</span>'+(row.description?'<span class="artist-blog-description">'+escape(row.description)+'</span>':'')+'</a></article>').join('');
}
if(typeof document!=='undefined'){
  const search=createBlogSearch();let context=null,observer=null,attempt=0,expiry=null;
  const language=()=>document.documentElement.dataset.locale||'ko';
  function render(){
    if(!context?.host.isConnected)return;
    const {host,state,sort}=context,lang=language(),t=key=>ownedText(key,lang);
    const key=state.status==='loading'?'blogLoading':state.status==='error'?(state.reason==='playback'?'blogPlaybackConflict':state.reason==='not-configured'?'blogNotConfigured':state.reason==='timeout'?'blogTimeout':'blogError'):state.status==='partial'?'blogPartial':state.status==='ready'?(state.data.items.length?'blogReady':'blogEmpty'):'blogIdle';
    const status=host.querySelector('[data-blog-status]');status.lang=lang;status.textContent=ownedParamText(key,lang,{count:state.data?.items.length||0});
    host.querySelector('[data-blog-order-note]').textContent=t(sort==='date'?'blogDateNote':'blogRelevanceNote');
    host.querySelector('[data-blog-results]').innerHTML=blogCards(state.data,lang);
    host.querySelector('[data-blog-results]').setAttribute('aria-busy',String(state.status==='loading'));
    const retry=host.querySelector('[data-blog-load]');retry.disabled=state.status==='loading';retry.textContent=t(state.status==='idle'?'blogLoad':'blogRefresh');
  }
  function bind(){
    const host=document.querySelector('#mdBlogInline');if(host===context?.host)return;
    attempt++;search.cancel();observer?.disconnect();clearTimeout(expiry);context=host?{host,sort:'date',state:{status:'idle'}}:null;
    if(!host)return;render();
    if(typeof IntersectionObserver!=='undefined'){
      observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();start();}},{root:document.getElementById('singerBox'),threshold:0.01});observer.observe(host);
    }
  }
  async function start(){
    bind();if(!context||context.state.status==='loading'||document.documentElement.dataset.blogEnabled!=='true'||document.querySelector('script[src*="googlesyndication.com"]'))return;
    observer?.disconnect();const ctx=context,token=++attempt;
    // YouTube may serve its own ads. Do not load Naver output while our embedded
    // player is visible; closing a detail modal already clears its blog output.
    if(!prepareBlogReading(document,window.closePlayer)){ctx.state={status:'error',reason:'playback'};render();return;}
    clearTimeout(expiry);ctx.state={status:'loading'};render();
    const result=await search.load(ctx.host.dataset.name,ctx.sort);
    if(token!==attempt||context!==ctx||!ctx.host.isConnected||result.status==='cancelled')return;
    ctx.state=result;render();
    if(result.data)expiry=setTimeout(()=>{if(context===ctx){ctx.state={status:'idle'};render();}},24*60*60*1000);
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-blog-load]')||event.target.closest('[data-act="detail-jump"][data-target="detail-blogs"]'))start();
  });
  document.addEventListener('change',event=>{
    if(!event.target.matches('[data-blog-sort]'))return;bind();if(!context)return;
    attempt++;search.cancel();context.sort=event.target.value==='sim'?'sim':'date';context.state={status:'idle'};start();
  });
  const box=document.getElementById('singerBox'),modal=document.getElementById('singerModal');
  if(box)new MutationObserver(bind).observe(box,{childList:true});
  if(modal)new MutationObserver(()=>{if(modal.hidden){attempt++;search.cancel();observer?.disconnect();clearTimeout(expiry);if(context){context.state={status:'idle'};render();}}}).observe(modal,{attributes:true,attributeFilter:['hidden']});
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-locale']});bind();
  if(document.documentElement.dataset.blogEnabled==='true'){
    const name=new URL(location.href).searchParams.get('singer');
    if(name&&window.ARTISTS?.some(a=>a.name===name)&&typeof window.openSingerDetail==='function')window.openSingerDetail(name);
  }
}
