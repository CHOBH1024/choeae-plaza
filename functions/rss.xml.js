// 최애광장 RSS 피드 — 최신 영상 + 소식 자동 생성 (네이버/구글/빙 수집용)
import { ARTIST_NAMES } from "./_shared/artists.js";

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function onRequest(context) {
  const base = 'https://choeae-plaza.pomyjo.com';
  let items = '';
  try {
    const r = await fetch('https://api.pomyjo.com/api/singer/feed', { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('Singer feed unavailable');
    const d = await r.json();
    const artists = d && d.artists && typeof d.artists === 'object' ? d.artists : {};
    const flat = [];
    for (const name of ARTIST_NAMES) {
      const videos = Array.isArray(artists[name]) ? artists[name] : [];
      videos.filter(v => v && typeof v.title === 'string' && typeof v.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v.videoId) &&
        typeof v.published === 'string' && Number.isFinite(Date.parse(v.published))).slice(0, 3).forEach(v => {
        flat.push({ title: name + ' — ' + v.title.slice(0, 300), id: v.videoId, date: v.published });
      });
    }
    flat.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    items = flat.slice(0, 20).map(v => {
      return '<item>' +
        '<title>' + esc(v.title) + '</title>' +
        '<link>' + base + '/?v=' + v.id + '</link>' +
        '<guid>' + base + '/?v=' + v.id + '</guid>' +
        '<pubDate>' + esc(new Date(v.date).toUTCString()) + '</pubDate>' +
        '</item>';
    }).join('');
  } catch (e) {
    items = '';
  }
  const rss = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0"><channel>' +
    '<title>최애광장 — 가수 최신 영상·소식</title>' +
    '<link>' + base + '</link>' +
    '<description>임영웅, 영탁, BTS 등 인기 가수의 최신 영상과 소식</description>' +
    '<language>ko</language>' +
    items +
    '</channel></rss>';
  return new Response(rss, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
}
