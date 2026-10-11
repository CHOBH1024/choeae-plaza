import guides from '../../data/artist-guides.json' with { type: 'json' };
export { guides };
function esc(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
export function renderGuide(name) {
  const guide = Object.hasOwn(guides, name) ? guides[name] : null;
  if (!guide) return '<section aria-labelledby="guide-title"><h2 id="guide-title">콘텐츠를 고르는 방법</h2><p>이 가수의 개별 감상 안내는 아직 준비하지 않았어요. 영상은 업로더와 버전을, 음악은 곡명과 가수를, 블로그는 작성일과 방문 날짜를 확인하며 골라보세요. 아래 목록은 가수의 전체 활동이나 전체 인기 순위를 뜻하지 않습니다.</p></section>';
  return '<article aria-labelledby="guide-title"><h2 id="guide-title">' + esc(guide.title) + '</h2>' +
    '<p>' + esc(guide.intro) + '</p><p class="notice">최애광장 편집 안내 · 감상 순서와 비교 방법은 편집 의견이며 인기 순위·공식 추천이 아닙니다. 출처는 곡명·공개 버전 확인에 사용했습니다. 가사나 외부 글을 전재하지 않습니다.</p>' +
    guide.steps.map((step, i) => '<section><h3>' + (i + 1) + '. ' + esc(step.title) + '</h3><p>' + esc(step.body) + '</p><a class="action" href="https://music.youtube.com/search?q=' + encodeURIComponent(step.query) + '" target="_blank" rel="noopener noreferrer">' + esc(step.query) + ' 검색 · 새 창</a></section>').join('') +
    '<h3>확인한 원문</h3><ul>' + guide.sources.map(source => '<li><a class="source" href="' + esc(source.url) + '" target="_blank" rel="noopener noreferrer">' + esc(source.label) + ' · 새 창</a></li>').join('') + '</ul>' +
    '<p class="notice">자료 확인일: ' + esc(guide.reviewed) + ' · 발매·공연 정보는 원문에서 다시 확인하세요. 정정 문의: <a href="mailto:malrang1024@gmail.com">malrang1024@gmail.com</a></p></article>';
}
