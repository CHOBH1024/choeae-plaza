// Actual device history and provider previews; no invented chart or cover data.
(function(){
  function validId(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{11}$/.test(value);}
  window.artistArtwork=function(a){
    var video=(playerVideos[a.name]||[])[0];
    if(!video||!validId(video.videoId))return '';
    return '<div class="md-artwork"><img src="https://i.ytimg.com/vi/'+video.videoId+'/hqdefault.jpg" alt="'+esc(a.name)+' 최근 영상 미리보기" onerror="this.parentNode.remove()"></div>';
  };
  window.renderHubRecent=function(){
    var box=$('hubRecent'),grid=$('hubRecentGrid');
    if(!box||!grid)return;
    var recent=store('st_recent','[]');
    var items=Array.isArray(recent)?recent.filter(function(item){return item&&validId(item.v)&&typeof item.t==='string';}).slice(0,6):[];
    box.hidden=!items.length;
    grid.innerHTML=items.map(function(item){
      var title=item.t.slice(0,200);
      return '<button type="button" class="hub-video-card" data-act="play-video" data-vid="'+item.v+'" data-title="'+esc(title)+'" aria-label="'+esc(title)+' 다시 보기"><span class="hub-video-cover"><img src="https://i.ytimg.com/vi/'+item.v+'/mqdefault.jpg" alt="" loading="lazy" onerror="this.remove()"><span class="hub-video-play" aria-hidden="true"></span></span><span class="hub-video-title">'+esc(title)+'</span></button>';
    }).join('');
  };
  window.renderHubRecent();
})();
