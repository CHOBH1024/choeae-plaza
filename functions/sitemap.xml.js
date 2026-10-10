// 현재 모든 페이지가 noindex이므로 검색 노출 준비가 끝날 때까지 사이트맵을 비워 둡니다.
export async function onRequestGet() {
  const urls = [];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map(function (u) { return '<url><loc>' + u + '</loc></url>'; }).join('') +
    '</urlset>';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
