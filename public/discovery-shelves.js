// Actual device history and provider previews; no invented chart or cover data.
(function(){
  function validId(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{11}$/.test(value);}
  window.artistArtwork=function(a){
    var video=(playerVideos[a.name]||[])[0];
    if(!video||!validId(video.videoId))return '';
    return '<div class="md-artwork"><img src="https://i.ytimg.com/vi/'+video.videoId+'/hqdefault.jpg" alt="'+esc(a.name)+' 최근 영상 미리보기" onerror="this.parentNode.remove()"></div>';
  };
  window.artistSpotlight=function(a){
    var video=(playerVideos[a.name]||[])[0];
    if(!video||!validId(video.videoId)||typeof video.title!=='string')return '';
    return '<button type="button" class="md-spotlight" data-act="play-video" data-vid="'+video.videoId+'" data-title="'+esc(video.title)+'" aria-label="'+esc(video.title)+' 재생">'+
      '<span class="md-spotlight-cover"><img src="https://i.ytimg.com/vi/'+video.videoId+'/mqdefault.jpg" alt="" onerror="this.remove()"></span>'+
      '<span class="md-spotlight-copy"><span class="md-spotlight-label" data-i18n="recentVideoPreview">최근 영상 보기</span><span class="md-spotlight-title">'+esc(video.title)+'</span><span class="md-spotlight-source">YouTube</span></span><span class="md-spotlight-arrow" aria-hidden="true">›</span></button>';
  };
  window.refreshArtistPreview=function(){
    if(!openSinger||state.experience!=='idol')return;
    var a=artist(openSinger);if(!a)return;
    var areas=[{id:'artistArtworkContainer',markup:window.artistArtwork(a)},
      {id:'artistSpotlight',markup:window.artistSpotlight(a)}];
    areas.forEach(function(item){
      var element=$(item.id);
      // Compare the source string, since the browser normalizes serialized HTML.
      if(element&&element.dataset.previewMarkup!==item.markup){element.innerHTML=item.markup;element.dataset.previewMarkup=item.markup;}
    });
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
