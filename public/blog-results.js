(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var name = (params.get('name') || '').trim().slice(0, 40);
  var sort = params.get('sort') === 'sim' ? 'sim' : 'date';
  document.getElementById('artist-query').value = name;
  document.getElementById('blog-sort').value = sort;
  document.getElementById('search-order').textContent = sort === 'date' ? '최신순 · 네이버가 제공한 작성일 기준입니다.' : '정확도순 · 네이버 검색 관련도 기준이며 최신 글이 아닐 수 있습니다.';
  var heading = document.getElementById('heading');
  var results = document.getElementById('results');
  function state(message) {
    results.replaceChildren(Object.assign(document.createElement('p'), { className: 'state', textContent: message }));
    results.setAttribute('aria-busy', 'false');
  }
  function appendNaverField(element, value) {
    var root = element;
    String(value || '').split(/(<\/?b>)/gi).forEach(function (part) {
      if (/^<b>$/i.test(part)) {
        var bold = document.createElement('b');
        root.appendChild(bold);
        root = bold;
      } else if (/^<\/b>$/i.test(part)) {
        root = element;
      } else {
        var text = part.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, function (entity, token) {
          if (token[0] !== '#') return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' })[token.toLowerCase()];
          var point = token[1].toLowerCase() === 'x' ? parseInt(token.slice(2), 16) : parseInt(token.slice(1), 10);
          return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
        });
        root.appendChild(document.createTextNode(text));
      }
    });
  }
  if (!name) { state('가수 이름을 확인할 수 없어요. 최애광장에서 가수를 선택해 주세요.'); return; }
  heading.textContent = name + ' 네이버 블로그 검색결과';
  fetch('/api/blog?name=' + encodeURIComponent(name) + '&sort=' + sort, { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('Search unavailable');
      return response.json();
    })
    .then(function (data) {
      if (!data.ok) throw new Error('Search unavailable');
      if (!Array.isArray(data.items) || !data.items.length) { state('검색결과가 없어요. 잠시 후 다시 확인해 주세요.'); return; }
      var fragment = document.createDocumentFragment();
      data.items.forEach(function (item) {
        var url;
        try {
          url = new URL(String(item.link || ''));
          var host = url.hostname.toLowerCase();
          if (url.username || url.password || url.port || !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || /^[\d.]+$/.test(host) || host.includes(':') ||
              (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['blog.naver.com', 'm.blog.naver.com', 'post.naver.com', 'openapi.naver.com'].includes(host))) ||
              (url.hostname.toLowerCase() === 'openapi.naver.com' && url.pathname !== '/l')) return;
        } catch (_) { return; }
        var article = document.createElement('article');
        article.className = 'result';
        var link = document.createElement('a');
        link.href = String(item.link);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        var title = document.createElement('span'); title.className = 'title'; appendNaverField(title, item.title);
        var meta = document.createElement('span'); meta.className = 'meta'; meta.textContent = [item.bloggername, url.hostname, item.postdate].filter(Boolean).join(' · ');
        var description = document.createElement('span'); description.className = 'description'; appendNaverField(description, item.description);
        link.append(title, meta, description);
        article.append(link);
        fragment.append(article);
      });
      if (!fragment.childNodes.length) { state('안전한 네이버 블로그 검색결과를 찾지 못했어요.'); return; }
      results.replaceChildren(fragment);
      results.setAttribute('aria-busy', 'false');
    })
    .catch(function () { state('네이버 검색을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); });
})();
