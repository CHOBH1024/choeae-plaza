import {queueTarget,swipeDirection} from './shortform-core.js';
const player=document.getElementById('playerBar');
const controls=player.querySelector('.pbtns');
controls.insertAdjacentHTML('beforeend','<button type="button" class="browse-toggle" data-shortform="enter" data-i18n="browseEnter">넘겨 보기</button>');
player.insertAdjacentHTML('beforeend','<p class="browse-help" data-i18n="browseHelp">양옆 영역을 위아래로 밀어 영상을 넘기세요. 영상 안에서는 유튜브 조작을 사용하세요.</p><button type="button" class="browse-rail browse-prev" data-shortform="prev" aria-label="이전 영상" data-i18n-aria-label="browsePrev">↑</button><button type="button" class="browse-rail browse-next" data-shortform="next" aria-label="다음 영상" data-i18n-aria-label="browseNext">↓</button><p class="browse-position" aria-live="polite"></p><button type="button" class="browse-exit" data-shortform="exit" data-i18n="browseExit">작은 재생기로 돌아가기</button>');
const prev=player.querySelector('.browse-prev'),next=player.querySelector('.browse-next');
let active=false,opener=null,background=[],oldOverflow='',gesture=null,skipRailClickUntil=0;
function refresh() {
  prev.disabled=queueTarget(currentQueue.length,currentQIdx,-1)===null;
  next.disabled=queueTarget(currentQueue.length,currentQIdx,1)===null;
  player.querySelector('.browse-position').textContent=currentQueue.length?(currentQIdx+1)+' / '+currentQueue.length:'';
}
function leave() {
  if(!active)return;
  active=false;player.classList.remove('shortform-mode');player.setAttribute('role','region');player.removeAttribute('aria-modal');player.removeAttribute('aria-labelledby');
  background.forEach(([el,inert])=>{el.inert=inert;});background=[];document.body.style.overflow=oldOverflow;
  if(!player.hidden&&opener?.isConnected)opener.focus();
  requestAnimationFrame(syncPlayerHeight);
}
function enter(button) {
  if(active||player.hidden||!currentVideoId)return;
  active=true;opener=button;oldOverflow=document.body.style.overflow;
  background=Array.from(document.body.children).filter(el=>el!==player&&!['SCRIPT','STYLE','LINK'].includes(el.tagName)).map(el=>[el,el.inert]);
  background.forEach(([el])=>{el.inert=true;});document.body.style.overflow='hidden';
  player.classList.add('shortform-mode');player.setAttribute('role','dialog');player.setAttribute('aria-modal','true');player.setAttribute('aria-labelledby','pbTitle');
  refresh();player.querySelector('.browse-exit').focus();requestAnimationFrame(syncPlayerHeight);
}
function step(direction) {
  const target=queueTarget(currentQueue.length,currentQIdx,direction);
  if(target===null)return;
  const video=currentQueue[target];if(!/^[A-Za-z0-9_-]{11}$/.test(video?.videoId||''))return;
  currentQIdx=target;playVideo(video.videoId,video.title);refresh();
}
player.addEventListener('click',event=>{
  const button=event.target.closest('[data-shortform]');if(!button)return;
  if(button.matches('.browse-rail')&&performance.now()<skipRailClickUntil){event.preventDefault();return;}
  const action=button.dataset.shortform;
  if(action==='enter')enter(button);else if(action==='exit')leave();else step(action==='prev'?-1:1);
});
// Native iframe gestures cannot bubble to this document. These visible rails
// sit beside, never over, the provider frame and preserve its native controls.
for(const rail of [prev,next]){
  rail.addEventListener('pointerdown',e=>{if(!active||e.isPrimary===false)return;gesture={x:e.clientX,y:e.clientY,id:e.pointerId};rail.setPointerCapture(e.pointerId);});
  rail.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;const direction=swipeDirection(gesture,{x:e.clientX,y:e.clientY});gesture=null;if(direction){skipRailClickUntil=performance.now()+350;step(direction);}});
  rail.addEventListener('pointercancel',()=>{gesture=null;});
}
player.addEventListener('keydown',event=>{
  if(!active)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();leave();return;}
  if(event.key==='Tab'){
    // Include the native provider iframe; never intercept its internal controls.
    const focusable=Array.from(player.querySelectorAll('button:not([disabled]),iframe')).filter(el=>el.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  if(event.target.closest('.browse-rail')&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();step(event.key==='ArrowUp'?-1:1);}
});
new MutationObserver(()=>{if(player.hidden)leave();if(active)refresh();}).observe(player,{attributes:true,attributeFilter:['hidden']});
new MutationObserver(()=>{if(active)refresh();}).observe(document.getElementById('pbTitle'),{childList:true});
