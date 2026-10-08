import {ownedText} from './locale-copy.js?v=20261009-fanspace';
import {createShowcaseSearch} from './showcase-core.js';
const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function showcaseCards(items,lang){
  return items.map(v=>{
    const id=v.videoId,url='https://www.youtube.com/watch?v='+id;
    const date=new Date(v.published).toLocaleDateString(lang,{year:'numeric',month:'short',day:'numeric'});
    return '<article class="showcase-card"><button type="button" class="hub-video-card" data-showcase-focus="play-'+id+'" data-act="play-video" data-vid="'+id+'" data-title="'+escape(v.title)+'" aria-label="'+escape(v.title)+'"><span class="hub-video-cover"><img src="https://i.ytimg.com/vi/'+id+'/mqdefault.jpg" alt="" loading="lazy" onerror="this.remove()"><span class="hub-video-play" aria-hidden="true"></span></span><span class="hub-video-title">'+escape(v.title)+'</span></button><p class="showcase-source">'+escape(v.channelTitle)+' · '+escape(date)+'</p><div class="showcase-actions"><a href="'+url+'" target="_blank" rel="noopener noreferrer" data-showcase-focus="source-'+id+'" lang="'+lang+'">'+escape(ownedText('sourceVideo',lang))+'</a><button type="button" data-act="save-video" data-showcase-focus="save-'+id+'" data-title="'+escape(v.title)+'" data-url="'+url+'" lang="'+lang+'">'+escape(ownedText('saveVideo',lang))+'</button></div></article>';
  }).join('');
}
if(typeof document!=='undefined'){
  const search=createShowcaseSearch((url,options)=>fetch(url,options));
  let context=null,attempt=0,visibility=null;
  const lang=()=>document.documentElement.dataset.locale||'ko';
  function render(){
    if(!context?.host.isConnected)return;
    const {host,kind,state}=context,l=lang(),t=key=>ownedText(key,l);
    const status=host.querySelector('#showcaseStatus'),results=host.querySelector('#showcaseResults'),retry=host.querySelector('[data-showcase-retry]');
    host.querySelector('.showcase-modes').setAttribute('aria-label',t('showcaseKinds'));
    host.querySelectorAll('[data-showcase-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.showcaseKind===kind)));
    // The locale module also handles static labels. Dynamic status stays owned-only.
    status.removeAttribute('data-i18n');status.lang=l;
    const updated=state.data?t('showcaseUpdated')+' '+new Date(state.data.generatedAt).toLocaleString(l)+' · '+t('showcaseCache'):'';
    status.textContent=state.status==='loading'?t('showcaseLoading'):state.status==='error'?t('showcaseFailure')+(state.data?' '+t('showcaseRetained')+' '+updated:''):state.status==='ready'?(state.data.items.length?updated:t('showcaseEmpty')+' '+updated):t('showcaseIdle');
    const focus=document.activeElement?.dataset?.showcaseFocus;
    results.innerHTML=state.data?showcaseCards(state.data.items,l):'';
    if(focus&&/^(play|source|save)-[A-Za-z0-9_-]{11}$/.test(focus))results.querySelector('[data-showcase-focus="'+focus+'"]')?.focus({preventScroll:true});
    retry.hidden=state.status!=='error';retry.disabled=state.status==='loading';
  }
  function bind(){
    const host=document.getElementById('detail-showcase');
    if(host===context?.host)return;
    attempt++;search.cancel();visibility?.disconnect();
    context=host?{host,kind:'campaign',state:{status:'idle'},data:new Map()}:null;
    if(host&&typeof IntersectionObserver!=='undefined'){
      visibility=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){visibility.disconnect();start('campaign');}},{root:document.getElementById('singerBox'),threshold:0.01});
      visibility.observe(host);
    }
  }
  async function start(kind){
    bind();if(!context||!['campaign','editorial'].includes(kind))return;
    if(context.state.status==='loading'&&context.kind===kind)return;
    visibility?.disconnect();
    const ctx=context,token=++attempt;ctx.kind=kind;ctx.state={status:'loading',data:ctx.data.get(kind)};render();
    const result=await search.load(ctx.host.dataset.name,kind);
    if(token!==attempt||context!==ctx||!ctx.host.isConnected||result.status==='cancelled')return;
    ctx.state=result;if(result.data)ctx.data.set(kind,result.data);render();
  }
  document.addEventListener('click',event=>{
    const kind=event.target.closest('[data-showcase-kind]');
    if(kind)start(kind.dataset.showcaseKind);
    else if(event.target.closest('[data-showcase-retry]'))start(context?.kind||'campaign');
    else if(event.target.closest('[data-act="detail-jump"][data-target="detail-showcase"]'))start(context?.kind||'campaign');
  });
  const box=document.getElementById('singerBox'),modal=document.getElementById('singerModal');
  if(box)new MutationObserver(bind).observe(box,{childList:true});
  if(modal)new MutationObserver(()=>{if(modal.hidden){attempt++;search.cancel();visibility?.disconnect();}}).observe(modal,{attributes:true,attributeFilter:['hidden']});
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-locale']});
  bind();
}
