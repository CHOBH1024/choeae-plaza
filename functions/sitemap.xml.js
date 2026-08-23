// 동적 sitemap — 홈 + 약관만 (가수 페이지는 noindex 처리되어 사이트맵에서 제외)
export async function onRequestGet() {
  const base = 'https://choeae-plaza.pomyjo.com';
  const urls = [
    base + '/', base + '/privacy', base + '/terms'
  ];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map(function (u) { return '<url><loc>' + u + '</loc></url>'; }).join('') +
    '</urlset>';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
