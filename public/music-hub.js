/* View layer only: the canonical catalog, APIs and saved data are shared. */
(function () {
  var currentExperience = 'classic';
  var initialized = false;
  var idolGenre = 'idol';
  var classicGenre = 'trot';
  var classicPicks = ['임영웅','송가인','이찬원','영탁','홍진영','장윤정'];
  var lead = document.querySelector('#heroLead');
  var badge = lead.querySelector('.badge');
  var heading = lead.querySelector('h1');
  var subtitle = lead.querySelector('.sub');
  var original = {badge: badge.textContent, heading: heading.innerHTML, subtitle: subtitle.textContent,
    shareHeading: $('shareHeading').textContent, shareDescription: $('shareDescription').textContent,
    searchPlaceholder: $('searchInput').placeholder};
  window.renderHubFavorites = function () {
    $('hubFavorites').hidden = currentExperience !== 'idol';
    if ($('hubFavorites').hidden) return;
    var favorites = ARTISTS.filter(function(a){return artistGenreKey(a) === 'idol' && driveData.favorites.indexOf(a.name) >= 0;});
    $('hubFavoriteGrid').innerHTML = favorites.length ? favorites.map(cardHTML).join('') :
      '<div class="empty"><p data-i18n="favoriteEmpty">최애를 골라보세요. 가수·그룹의 더보기에서 최애 저장을 누르면 여기에 모아 볼 수 있어요.</p><p data-i18n="guestStorage">로그인하지 않아도 이 기기에 저장할 수 있어요. Google 계정 연결은 원할 때 선택하세요.</p></div>';
  };
  window.updateHubFeedStatus = function () {
    var box = $('hubFeedStatus');
    box.hidden = currentExperience !== 'idol';
    if (box.hidden) return;
    var loading = videoFeedStatus === 'loading' || videoFeedStatus === 'idle';
    var hasVideos = ARTISTS.some(function(a){return artistGenreKey(a) === 'idol' && Array.isArray(playerVideos[a.name]) && playerVideos[a.name].length > 0;});
    var receivedTime = videoFeedUpdatedAt ? new Date(videoFeedUpdatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '확인 중';
    var messageKey=loading?(hasVideos?'feedLoadingCached':'feedLoading'):videoFeedStatus==='error'?(hasVideos?'feedFailedCached':'feedFailed'):hasVideos?'feedReady':'feedEmpty';
    $('hubFeedMessage').setAttribute('data-i18n',messageKey);
    $('hubFeedMessage').setAttribute('data-i18n-time',String(videoFeedUpdatedAt||0));
    $('hubFeedMessage').textContent = loading ? (hasVideos ? '이전 영상 목록을 유지하며 새로고침 중이에요.' : '최근 영상 표지를 불러오는 중이에요.') : videoFeedStatus === 'error' ?
      (hasVideos ? '새로고침에 실패했어요. 이전에 받은 영상 목록(조회 ' + receivedTime + ')을 유지하고 있어요. 다시 시도할 수 있어요.' : '영상 목록을 불러오지 못했어요. 기본 아티스트 카드로 둘러보거나 다시 시도하세요.') : !hasVideos ?
      '응답은 받았지만 현재 아이돌·팝 영상 목록이 비어 있어요. 기본 아티스트 카드로 둘러보거나 영상 새로고침을 눌러주세요.' :
      '최근 수집 영상 · 조회 ' + receivedTime + ' · 화면이 열려 있는 동안 5분마다 갱신합니다. 앨범 커버나 전체 인기 순위가 아닙니다.';
    $('hubFeedRetry').hidden = false;
    $('hubFeedRetry').setAttribute('data-i18n',videoFeedStatus==='error'?'feedRetry':'feedRefresh');
    $('hubFeedRetry').textContent = videoFeedStatus === 'error' ? '표지·영상 다시 불러오기' : '영상 새로고침';
    $('hubFeedRetry').disabled = loading;
    var details = $('hubFeedDetails');
    var failure = $('hubFeedFailureReason');
    if (failure) {
      failure.hidden = videoFeedStatus !== 'error';
      var markup = videoFeedStatus === 'error' && typeof feedFailureMarkup === 'function' ? feedFailureMarkup() : '';
      if (failure.innerHTML !== markup) failure.innerHTML = markup;
    }
    if (details && videoFeedStatus === 'error') details.open = true;
  };
  function hasThemePreference() { try { return !!localStorage.getItem('st_theme'); } catch (e) { return false; } }
  function setExperience(value, updateUrl) {
    if (value !== 'idol' && value !== 'classic') return;
    if (initialized && value === currentExperience) return;
    var idol = value === 'idol';
    if (initialized && idol && currentExperience !== 'idol') classicGenre = state.genre;
    if (!idol && currentExperience === 'idol') idolGenre = state.genre;
    initialized = true;
    currentExperience = value;
    state.experience = value;
    var manifest = $('pwaManifest');
    if (manifest) manifest.href = idol ? '/manifest-idol.json?v=20261009-library-mobile' : '/manifest.json?v=20261009-library-mobile';
    document.documentElement.setAttribute('data-experience', value);
    document.querySelectorAll('[data-act="experience"]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.experience === value));
    });
    $('hubLibrary').hidden = !idol;
    $('hubQuickNav').hidden = !idol;
    window.renderHubFavorites();
    if (typeof renderPlaygroundForView === 'function') renderPlaygroundForView();
    if (typeof renderNewsForView === 'function') renderNewsForView();
    window.updateHubFeedStatus();
    if (idol) {
      $('searchInput').placeholder = '가수·그룹·노래 검색 (예: BTS, Super Shy)';
      $('shareHeading').textContent = '좋아하는 콘텐츠를 공유하세요';
      $('shareDescription').textContent = '새로 발견한 아티스트와 좋아하는 노래를 친구에게 소개하세요.';
      badge.textContent = 'DISCOVER YOUR NEXT FAVORITE';
      heading.textContent = '지금, 이 아티스트';
      subtitle.textContent = '최애의 영상, 노래, 소식을 한 곳에서 찾아보세요.';
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
      $('artistBrowseDescription').textContent = '가수를 골라 영상, 노래와 소식을 찾아보세요.';
      $('musicCollectionDescription').textContent = '트로트 대표곡 목록입니다. 실시간 인기 순위가 아니며, 곡을 누르면 YouTube Music 검색이 새 창으로 열립니다.';
      initTheme();
      setGenre(classicGenre);
    }
    renderCollage();
    if (typeof window.renderPopularForView === 'function') window.renderPopularForView();
    loadTodaySong();
    if (state.tab === 'music') renderChart();
    if (state.loaded && state.loaded.play && typeof renderRank === 'function') renderRank();
    if (updateUrl) {
      var url = new URL(location.href);
      if(url.pathname==='/discover'){if(idol)url.searchParams.delete('view');else url.searchParams.set('view','classic');}
      else{url.pathname = idol ? '/' : '/trot';url.searchParams.delete('view');}
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-act="experience"]');
    if (button) setExperience(button.dataset.experience, true);
    var genre = event.target.closest('[data-act="genre"]');
    if (genre && genre.dataset.genre === 'idol' && currentExperience !== 'idol') setExperience('idol', true);
    if (genre && genre.dataset.genre === 'trot' && currentExperience !== 'classic') setExperience('classic', true);
  });
  function experienceFromUrl() {
    var url=new URL(location.href);
    return /^\/trot\/?$/.test(url.pathname)||(url.pathname==='/discover'&&url.searchParams.get('view')==='classic') ? 'classic' : 'idol';
  }
  window.addEventListener('popstate', function () { setExperience(experienceFromUrl(), false); });
  window.setInterval(function () {
    if (currentExperience !== 'idol' || document.hidden || navigator.onLine === false) return;
    loadVideos();
    if (openSinger) loadPopularVideos(openSinger);
  }, 300000);
  setExperience(experienceFromUrl(), false);
})();
