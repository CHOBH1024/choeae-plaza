// Responsive presentation only: move the same controls, never clone account data.
const root=document.documentElement;
const settings=document.getElementById('mobileDisplaySettings');
const panel=document.getElementById('mobileDisplaySettingsBody');
const toggle=document.getElementById('mobileSettingsToggle');
const nav=document.querySelector('.tabbar');
const query=window.matchMedia('(max-width: 900px)');
const controls=[document.querySelector('.experience-switch'),document.getElementById('localeTools')].filter(Boolean);
const homes=controls.map(node=>{const anchor=document.createComment('responsive control home');node.before(anchor);return {node,anchor};});
function closeSettings(returnFocus=false){
  if(!settings.open)return;
  settings.open=false;
  if(returnFocus&&!settings.hidden)toggle.focus({preventScroll:true});
}
function measure(){
  const mobile=query.matches&&root.dataset.experience==='idol';
  root.style.setProperty('--hub-nav-h',mobile?nav.offsetHeight+'px':'0px');
  const player=document.getElementById('playerBar');
  root.style.setProperty('--player-h',player.hidden?'0px':player.offsetHeight+'px');
}
function render(){
  const mobile=query.matches&&root.dataset.experience==='idol';
  const focused=document.activeElement;
  if(mobile){
    settings.hidden=false;
    homes.forEach(({node})=>{if(node.parentNode!==panel)panel.append(node);});
    // Resizing must not strand keyboard focus inside a closed disclosure.
    if(panel.contains(focused))settings.open=true;
  }else{
    homes.forEach(({node,anchor})=>{if(node.previousSibling!==anchor)anchor.after(node);});
    closeSettings();settings.hidden=true;
    if(focused===toggle)homes[0]?.node.querySelector('button')?.focus({preventScroll:true});
  }
  measure();
}
query.addEventListener('change',render);
new MutationObserver(render).observe(root,{attributes:true,attributeFilter:['data-experience']});
document.addEventListener('click',event=>{
  const action=event.target.closest('[data-act]');
  if(action&&['experience','tab','drive','hub-drive','open-singer','play-singer'].includes(action.dataset.act))closeSettings();
  else if(!settings.contains(event.target))closeSettings();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&settings.open){event.preventDefault();closeSettings(true);}});
// Keep geometry correct for longer translations, player errors and safe areas.
const observer=new ResizeObserver(measure);
observer.observe(nav);observer.observe(document.getElementById('playerBar'));
window.addEventListener('resize',measure);
render();
