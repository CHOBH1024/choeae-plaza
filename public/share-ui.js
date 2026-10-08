import {ownedText} from './locale-copy.js';
import {publicShareData,shareDestination,copyPublicLink,nativePublicShare} from './share-core.js';
const language=()=>document.documentElement.dataset.locale||'ko';
function dataFor(panel) {
  return publicShareData({origin:location.origin,artistName:panel.dataset.shareArtist,names:ARTISTS.map(a=>a.name),idol:state.experience==='idol'});
}
function show(panel,key) {
  const status=panel.querySelector('[data-share-status]');
  if(status){status.dataset.i18n=key;status.textContent=ownedText(key,language());status.lang=language();}
}
function refresh(panel) {
  const input=panel.querySelector('[data-share-url]');
  if(input)input.value=dataFor(panel).url;
}
document.addEventListener('toggle',event=>{
  if(event.target.matches?.('[data-share-panel]'))refresh(event.target);
},true);
document.addEventListener('click',async event=>{
  const button=event.target.closest?.('[data-share]');if(!button)return;
  const panel=button.closest('[data-share-panel]');if(!panel)return;
  const action=button.dataset.share;
  const data=dataFor(panel);refresh(panel);
  const destination=shareDestination(action,data);
  if(destination){window.open(destination,'_blank','noopener,noreferrer');show(panel,'shareWindow');return;}
  if(action==='native') {
    // Call in the original user gesture; no asynchronous SDK load or automatic posting.
    button.disabled=true;
    const result=await nativePublicShare(typeof navigator.share==='function'?navigator.share.bind(navigator):null,{...data,text:ownedText('shareMessage',language())});
    button.disabled=false;
    show(panel,{unsupported:'shareUnsupported',cancelled:'shareCancelled',failed:'shareFailed','handed-off':'shareHandedOff'}[result]);
    return;
  }
  if(['copy','kakao-copy','instagram-copy'].includes(action)) {
    button.disabled=true;const copied=await copyPublicLink(navigator.clipboard,data.url);button.disabled=false;
    show(panel,copied?(action==='kakao-copy'?'shareKakaoCopied':action==='instagram-copy'?'shareInstagramCopied':'shareCopied'):'shareCopyFailed');
    if(!copied){const input=panel.querySelector('[data-share-url]');if(input){input.focus();input.select();}}
  }
});
document.querySelectorAll('[data-share-panel]').forEach(refresh);
// The existing artist landing links use ?singer=. Open only a registered name; never auto-play.
const requested=new URL(location.href).searchParams.get('singer');
if(typeof requested==='string'&&ARTISTS.some(a=>a.name===requested))openSingerDetail(requested);
