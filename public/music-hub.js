/* View layer only: the canonical catalog, APIs and saved data are shared. */
(function () {
  var currentExperience = 'classic';
  var initialized = false;
  var idolGenre = 'idol';
  var classicGenre = state.genre;
  var classicPicks = HERO_PICK.slice();
  var lead = document.querySelector('#heroLead');
  var badge = lead.querySelector('.badge');
  var heading = lead.querySelector('h1');
  var subtitle = lead.querySelector('.sub');
  var original = {badge: badge.textContent, heading: heading.innerHTML, subtitle: subtitle.textContent,
    shareHeading: $('shareHeading').textContent, shareDescription: $('shareDescription').textContent,
    searchPlaceholder: $('searchInput').placeholder};
  var playCopy = ['attendHeading','attendDescription','quizHeading'].map(function(id){return {id:id,text:$(id).textContent};});
  window.renderHubFavorites = function () {
    $('hubFavorites').hidden = currentExperience !== 'idol';
    if ($('hubFavorites').hidden) return;
    var favorites = ARTISTS.filter(function(a){return artistGenreKey(a) === 'idol' && driveData.favorites.indexOf(a.name) >= 0;});
    $('hubFavoriteGrid').innerHTML = favorites.length ? favorites.map(cardHTML).join('') :
      '<div class="empty"><p>아직 선택한 최애가 없어요. 아래에서 가수·그룹의 더보기를 열고 최애 저장을 눌러주세요.</p><p>로그인 없이 이 기기에 저장할 수 있어요. Google 연결은 선택입니다.</p></div>';
  };
  window.updateHubFeedStatus = function () {
    var box = $('hubFeedStatus');
    box.hidden = currentExperience !== 'idol';
    if (box.hidden) return;
    var loading = videoFeedStatus === 'loading' || videoFeedStatus === 'idle';
    var hasVideos = ARTISTS.some(function(a){return artistGenreKey(a) === 'idol' && Array.isArray(playerVideos[a.name]) && playerVideos[a.name].length > 0;});
    var receivedTime = videoFeedUpdatedAt ? new Date(videoFeedUpdatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '확인 중';
    $('hubFeedMessage').textContent = loading ? (hasVideos ? '이전 영상 목록을 유지하며 새로고침 중이에요.' : '최근 영상 표지를 불러오는 중이에요.') : videoFeedStatus === 'error' ?
      (hasVideos ? '새로고침에 실패했어요. 이전에 받은 영상 목록(조회 ' + receivedTime + ')을 유지하고 있어요. 다시 시도할 수 있어요.' : '영상 목록을 불러오지 못했어요. 기본 아티스트 카드로 둘러보거나 다시 시도하세요.') : !hasVideos ?
      '응답은 받았지만 현재 아이돌·팝 영상 목록이 비어 있어요. 기본 아티스트 카드로 둘러보거나 영상 새로고침을 눌러주세요.' :
      '최근 수집 영상 · 조회 ' + receivedTime + ' · 화면이 열려 있는 동안 5분마다 갱신합니다. 앨범 커버나 전체 인기 순위가 아닙니다.';
    $('hubFeedRetry').hidden = false;
    $('hubFeedRetry').textContent = videoFeedStatus === 'error' ? '표지·영상 다시 불러오기' : '영상 새로고침';
    $('hubFeedRetry').disabled = loading;
  };
  function hasThemePreference() { try { return !!localStorage.getItem('st_theme'); } catch (e) { return false; } }
  function setExperience(value, updateUrl) {
    if (value !== 'idol' && value !== 'classic') return;
    if (initialized && value === currentExperience) return;
    var idol = value === 'idol';
    if (idol && currentExperience !== 'idol') classicGenre = state.genre;
    if (!idol && currentExperience === 'idol') idolGenre = state.genre;
    initialized = true;
    currentExperience = value;
    state.experience = value;
    document.documentElement.setAttribute('data-experience', value);
    document.querySelectorAll('[data-act="experience"]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.experience === value));
    });
    $('hubLibrary').hidden = !idol;
    $('hubQuickNav').hidden = !idol;
    window.renderHubFavorites();
    playCopy.forEach(function(item,index){$(item.id).textContent = idol ? ['오늘의 체크인','오늘도 취향을 쌓아보세요. 매일 체크인하고 7일 스탬프를 모아보세요.','가수 퀴즈 — 얼마나 알고 있나요?'][index] : item.text;});
    window.updateHubFeedStatus();
    if (idol) {
      $('searchInput').placeholder = '가수·그룹·노래 검색 (예: BTS, Super Shy)';
      $('shareHeading').textContent = '좋은 취향은 함께 나눠요';
      $('shareDescription').textContent = '새로 발견한 아티스트와 좋아하는 노래를 친구에게 소개하세요.';
      badge.textContent = 'DISCOVER YOUR NEXT FAVORITE';
      heading.textContent = '지금, 이 아티스트';
      subtitle.textContent = '영상에서 노래로, 소식에서 컬렉션으로. 나의 취향을 이어보세요.';
      HERO_PICK = ['BTS', '블랙핑크', '뉴진스', '아이브'];
      $('artistBrowseHeading').textContent = '다음 최애를 발견하세요';
      $('artistBrowseDescription').textContent = '표지는 최근 영상 미리보기예요. 바로 듣기로 재생하거나 더보기에서 노래·블로그·기사를 확인하세요.';
      $('musicCollectionDescription').textContent = '사이트 대표곡 목록 중 아이돌·팝 아티스트의 곡을 모았어요. 실시간 인기 순위가 아니며, 곡을 누르면 YouTube Music 검색이 새 창으로 열립니다.';
      if (!hasThemePreference()) {
        document.documentElement.setAttribute('data-theme', 'dark');
        $('themeBtn').setAttribute('aria-pressed', 'true');
        $('themeBtn').textContent = '밝게';
      }
      setGenre(idolGenre);
    } else {
      $('searchInput').placeholder = original.searchPlaceholder;
      $('shareHeading').textContent = original.shareHeading;
      $('shareDescription').textContent = original.shareDescription;
      badge.textContent = original.badge;
      heading.innerHTML = original.heading;
      subtitle.textContent = original.subtitle;
      HERO_PICK = classicPicks.slice();
      $('artistBrowseHeading').textContent = '가수 둘러보기';
      $('artistBrowseDescription').textContent = '사진을 누르면 이 사이트에서 최신 영상이 바로 재생돼요.';
      $('musicCollectionDescription').textContent = '노래 30곡 모음입니다. 실시간 인기 순위가 아니며, 곡을 누르면 YouTube Music 검색이 새 창으로 열립니다.';
      initTheme();
      setGenre(classicGenre);
    }
    renderCollage();
    loadTodaySong();
    if (state.tab === 'music') renderChart();
    if (updateUrl) {
      var url = new URL(location.href);
      if (idol) url.searchParams.set('view', 'idol');
      else url.searchParams.delete('view');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-act="experience"]');
    if (button) setExperience(button.dataset.experience, true);
  });
  window.addEventListener('popstate', function () { setExperience(new URL(location.href).searchParams.get('view') === 'idol' ? 'idol' : 'classic', false); });
  window.setInterval(function () {
    if (currentExperience !== 'idol' || document.hidden || navigator.onLine === false) return;
    loadVideos();
    if (openSinger) loadPopularVideos(openSinger);
  }, 300000);
  setExperience(new URL(location.href).searchParams.get('view') === 'idol' ? 'idol' : 'classic', false);
})();
