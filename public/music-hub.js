/* View layer only: the canonical catalog, APIs and saved data are shared. */
(function () {
  var currentExperience = 'classic';
  var classicGenre = state.genre;
  var classicPicks = HERO_PICK.slice();
  var lead = document.querySelector('#heroLead');
  var badge = lead.querySelector('.badge');
  var heading = lead.querySelector('h1');
  var subtitle = lead.querySelector('.sub');
  var original = {badge: badge.textContent, heading: heading.innerHTML, subtitle: subtitle.textContent};
  window.updateHubFeedStatus = function () {
    var box = $('hubFeedStatus');
    box.hidden = currentExperience !== 'idol';
    if (box.hidden) return;
    var loading = videoFeedStatus === 'loading' || videoFeedStatus === 'idle';
    $('hubFeedMessage').textContent = loading ? '최근 영상 표지를 불러오는 중이에요.' : videoFeedStatus === 'error' ?
      '영상 목록을 불러오지 못했어요. 기본 아티스트 카드로 둘러보거나 다시 시도하세요.' :
      '최근 영상 미리보기 · 실시간 인기 순위나 앨범 커버가 아닙니다.';
    $('hubFeedRetry').hidden = videoFeedStatus !== 'error';
    $('hubFeedRetry').disabled = loading;
  };
  function hasThemePreference() { try { return !!localStorage.getItem('st_theme'); } catch (e) { return false; } }
  function setExperience(value, updateUrl) {
    if (value !== 'idol' && value !== 'classic') return;
    var idol = value === 'idol';
    if (idol && currentExperience !== 'idol') classicGenre = state.genre;
    currentExperience = value;
    state.experience = value;
    document.documentElement.setAttribute('data-experience', value);
    document.querySelectorAll('[data-act="experience"]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.experience === value));
    });
    $('hubLibrary').hidden = !idol;
    window.updateHubFeedStatus();
    if (idol) {
      badge.textContent = 'CHOEAE MUSIC · ARTIST DISCOVERY';
      heading.textContent = '오늘의 무드,\n나의 최애.';
      subtitle.textContent = '뮤직비디오부터 무대, 노래와 팬들의 이야기까지. 좋아하는 아티스트의 세계를 한 곳에서 발견하세요.';
      HERO_PICK = ['BTS', '블랙핑크', '뉴진스', '아이브'];
      $('artistBrowseHeading').textContent = '다음 최애를 발견하세요';
      $('artistBrowseDescription').textContent = '표지는 최근 영상 미리보기예요. 바로 듣기로 재생하거나 더보기에서 노래·블로그·기사를 확인하세요.';
      $('musicCollectionDescription').textContent = '사이트 대표곡 목록 중 아이돌·팝 아티스트의 곡을 모았어요. 실시간 인기 순위가 아니며, 곡을 누르면 YouTube Music 검색이 새 창으로 열립니다.';
      if (!hasThemePreference()) {
        document.documentElement.setAttribute('data-theme', 'dark');
        $('themeBtn').setAttribute('aria-pressed', 'true');
        $('themeBtn').textContent = '밝게';
      }
      setGenre('idol');
    } else {
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
  setExperience(new URL(location.href).searchParams.get('view') === 'idol' ? 'idol' : 'classic', false);
})();
