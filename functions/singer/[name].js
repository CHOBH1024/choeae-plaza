// 가수별 SEO 페이지 — /singer/{이름}
const TROT = ["임영웅", "영탁", "이찬원", "장민호", "김호중", "정동원", "송가인", "장윤정", "태진아", "설운도", "진성", "나훈아", "박서진", "홍진영", "조항조", "신유", "김연자", "주현미", "현철", "이미자", "남진", "송대관", "김희재", "김수찬", "황영웅", "김다현", "박군", "신성", "송민준", "김용임", "강진", "박상철", "윤수현", "요요미", "마이진", "오유진", "진해성", "박현빈", "서지오", "문희옥", "강혜연", "양지은", "정미애", "김태연", "영기", "나상도", "김호영", "최향", "정동하", "조승구"];
const IDOL = ["BTS", "블랙핑크", "뉴진스", "아이브", "에스파", "트와이스", "세븐틴", "싸이", "엑소", "르세라핌", "아이유", "스트레이키즈", "엔하이픈", "TXT", "레드벨벳", "NCT 127", "NCT DREAM", "라이즈", "제로베이스원", "트레저", "ITZY", "오마이걸", "마마무", "(여자)아이들", "빅뱅", "샤이니", "태연", "선미", "보아", "슈퍼주니어", "소녀시대", "에이핑크", "비투비", "에이티즈", "더보이즈", "몬스타엑스", "스테이씨", "케플러", "드림캐쳐", "위너", "아이콘", "갓세븐", "박진영", "현아", "청하", "이효리", "강다니엘", "김세정", "전소미", "제시", "있지"];
const CHANNELS = {"임영웅": "UC3WZlO2Zl8NE1yIUgtwUtQw", "영탁": "UCjL2bp7EDRIk7rwwEYeofeg", "이찬원": "UC4UnP3v-iaFaLdtKwp84Pmw", "장민호": "UC00wMKeoF72UURd3WO9pZHw", "김호중": "UC73yn5mmJSr3hh9jKe2AdWw", "정동원": "UCrLQ0ovys23H9xBV6U-Sd4A", "송가인": "UCJ-8qxJb6_YCLIS1Fwb0aZw", "장윤정": "search", "태진아": "UCq_EUfj7wDnd1lOGEq8-6Gw", "설운도": "UCXIF1aXKmE6x5gyyt5z88YQ", "진성": "search", "나훈아": "UCej9znwYQ2C2zRjroMjysRA", "박서진": "UCInYIznyqojL4rJc83pSJQA", "홍진영": "UCTi8ulXcp2jdugEsJr73fQA", "조항조": "search", "신유": "search", "김연자": "UCIV0bU6MSCbgCqehGUwpcXw", "주현미": "UCEDXalKckJ-JqVCjusmHm3g", "현철": "UChbT4WsEoRgRVp_YB-8COaA", "이미자": "UC-0APnrbM_du-WFmwGqLJOA", "남진": "UCcHOyqKo9yWTKNpcW642lTA", "송대관": "UCQuEZ2m1R4UhGlximk3jV7g", "김희재": "UChna8lSxMjKnbIHwmfHEf4Q", "김수찬": "UCgLn4rH3Ey9OWSd88-HMUyQ", "황영웅": "UCrmsG-9nm7wHufb6aoM0f1A", "김다현": "UCfZlsE2li3OVLyLcx-ffanA", "박군": "UC_I8B3HjmdR_YYIrFZagCGA", "신성": "UCyo_qZ6z2rlwBbjDvHpdSPA", "송민준": "search", "김용임": "UCSa0RBUgWHjmcPNaHDR6G6A", "강진": "UCyzbz6ynQCccrhO80rg39tQ", "박상철": "UCm3i6IEUCj3YK-7K9C0eJcw", "윤수현": "UCtnpVABr8iWNLx8RiiA5rYQ", "요요미": "UC_UKEsQBkJ9ZOJkKpJs_54g", "오유진": "UCVxS1Kshgnw6xPT-sGF3lWQ", "진해성": "UCMelh2Oz9P7Huy3MaKllPHg", "박현빈": "UCeHmWf9GUHPJTGO-MzA59gw", "서지오": "search", "문희옥": "UC-8uYKtj639jE5hFVFlbnKg", "강혜연": "UCKdOqSsLXwMFyOMf5iy8ADQ", "양지은": "search", "정미애": "UCEKJVRYtcOhlDY6GFs0KbAQ", "김태연": "search", "나상도": "UCIDkJ9VVpLNlKUI6v9omEVw", "김호영": "UC_w6vBBczYwQ-4hCwgqWW9w", "정동하": "UCxGeWUZwDIGt2PyBMbfzR7w", "조승구": "UCUzmYNywFc9D48VzkiipAvA", "BTS": "UCLkAepWjdylmXSltofFvsYQ", "블랙핑크": "UCOmHUn--16B90oW2L6FRR3A", "뉴진스": "UCMki_UkHb4qSc0qyEcOHHJw", "아이브": "UC-Fnix71vRP64WXeo0ikd0Q", "에스파": "UC9GtSLeksfK4yuJ_g1lgQbg", "트와이스": "UCzgxx_DM2Dcb9Y1spb9mUJA", "세븐틴": "UCfkXDY7vwkcJ8ddFGz8KusA", "싸이": "UCrDkAvwZum-UTjHmzDI2iIw", "엑소": "UCzCedBCSSltI1TFd3bKyN6g", "르세라핌": "UCs-QBT4qkj_YiQw1ZntDO3g", "아이유": "UC3SyT4_WLHzN7JmHQwKQZww", "NCT 127": "UCk2E0dbAyEJWnrN2bbQOcbg", "NCT DREAM": "UCXURHJRGr4-EB3l87kcbElw", "오마이걸": "UCACvSkFoyzG8I1QeREBnxAA", "마마무": "UCuhAUMLzJxlP1W7mEk0_6lA", "샤이니": "UCyPwRgc3gQGqhk6RoGS50Ug", "태연": "UCFPI8MI3zmzTlV4W-oSy-Ig", "선미": "UCsVpgRB8YHLWA0ZrkhtHvTA", "보아": "UCYPtgd76D-o15reXD94BIoQ", "에이핑크": "UCmW1Pq56lA-k-GWpX1z8WPg", "비투비": "UC35n5Z6waD62xc-JBwmeS0w", "스테이씨": "UCod5V2dpnpJLklGvVOv5FcQ", "드림캐쳐": "UCijULR2sXLutCRBtW3_WEfA", "위너": "UCbWZ00bZ6CS5vTtXqDZifBA", "아이콘": "UCWxCyZibDIWIrGIgP25mbfw", "박진영": "UCaO6TYtlC8U5ttz62hTrZgg", "현아": "UC0uTcuuOtUFwtn9aKUVGjXg", "청하": "UCtC14nS1y4T54RJMk4t08Uw", "이효리": "UCLdpqi-SRtV-utyYjQNx6Uw", "강다니엘": "UCGLXVdGDgXoUgDZnxCNPRog", "김세정": "UChZqXG2F3SWohqvr_E2ZmCg", "전소미": "UCMLPg1cJYe8w1ekg9TnRHFA", "제시": "UCIyv01p5z27eT5mih5wb7Ug", "영기": "UCmrsH4cNP-_OzS9fl22hhkw", "스트레이키즈": "UC9rMiEjNaCSsebs31MRDCRA", "TXT": "UCtiObj3CsEAdNU6ZPWDsddQ", "레드벨벳": "UCk9GmdlDTBfgGRb7vXeRMoQ", "제로베이스원": "UCzudfwcO3OdC8PcksuGhEqQ", "ITZY": "UCDhM2k2Cua-JdobAh5moMFg", "빅뱅": "UCQi67q4kGdmnJaRzX81uK5g", "슈퍼주니어": "UCFipx49muiJ8-d2YsnLlNVw", "소녀시대": "UCPENYtHg4Xhmm6oX8zaQA7Q", "몬스타엑스": "UCZvCP6sWj75MwpUP4LVtpNw", "케플러": "search", "갓세븐": "UC8HEl74jL3bLLwfDP1OALxw", "엔하이픈": "search", "라이즈": "UCdVD0MsYecQaIE5Ru-pOIQQ", "(여자)아이들": "UC8InqoEcGtllmVMyPiqCmcA", "에이티즈": "UCi65bmCsJ8uqoP_v4dbYp7w", "더보이즈": "UCWZmCMB7mmKWcXJSIPRhzZw", "마이진": "search", "최향": "search", "트레저": "UCx9hXYOCvUYwrprEqe4ZQHA"};

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function notFound() {
  return new Response('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta name="viewport" content="width=device-width, initial-scale=1"><title>가수를 찾을 수 없어요 — 최애광장</title></head><body><main><h1>가수를 찾을 수 없어요</h1><p>요청한 가수 페이지를 찾지 못했어요.</p><a href="/">최애광장 홈으로</a></main></body></html>', {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  });
}

export async function onRequestGet(context) {
  let name;
  try { name = decodeURIComponent(context.params.name || '').trim(); }
  catch { return notFound(); }
  const isTrot = TROT.includes(name);
  const isIdol = IDOL.includes(name);
  if (!isTrot && !isIdol) return notFound();
  const cat = isTrot ? '트로트' : '아이돌';
  const cid = CHANNELS[name] || '';
  const ytUrl = cid && cid !== 'search' ? 'https://www.youtube.com/channel/' + cid : 'https://www.youtube.com/results?search_query=' + encodeURIComponent(name);

  // 최신 영상 (API — 실패해도 페이지는 정상)
  let vids = [];
  try {
    const r = await fetch('https://api.pomyjo.com/api/singer/feed', { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error('Singer feed unavailable');
    const d = await r.json();
    vids = ((d.artists || {})[name] || []).filter(v => v && typeof v.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v.videoId)).slice(0, 6);
  } catch (e) {}

  const title = name + ' 최신 영상·노래 모음 — 최애광장';
  const desc = name + '(' + cat + ')의 최신 영상, 히트곡, 뉴스를 한곳에서! ' + name + ' 노래 듣기와 소식을 큰 글씨로 편하게.';

  const vidHtml = vids.map(v =>
    '<li style="margin:.5rem 0;padding:.7rem;background:#faf7f2;border-radius:.6rem;">' +
    '<img src="https://i.ytimg.com/vi/' + esc(v.videoId) + '/mqdefault.jpg" alt="' + esc(v.title) + '" loading="lazy" style="width:120px;height:68px;border-radius:.4rem;vertical-align:middle;margin-right:.7rem;">' +
    '<a href="/?singer=' + encodeURIComponent(name) + '" style="color:#2b2620;font-weight:700;text-decoration:none;">' + esc(v.title) + '</a></li>'
  ).join('') || '<li>최신 영상을 불러오는 중이에요. 홈에서 확인해주세요!</li>';

  const html = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, nofollow">' +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<meta name="keywords" content="' + esc(name) + ', ' + esc(cat) + ', 가수, 최신 영상, 노래, 트로트, 아이돌">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:url" content="https://choeae-plaza.pomyjo.com/singer/' + encodeURIComponent(name) + '">' +
    '<meta property="og:image" content="https://choeae-plaza.pomyjo.com/og-banner.png">' +
    '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","name":"' + esc(name) + '","url":"' + ytUrl + '"}</script>' +
    '</head><body style="font-family:Noto Sans KR,sans-serif;margin:0;background:#faf7f2;color:#2b2620;line-height:1.7;">' +
    '<div style="max-width:720px;margin:0 auto;padding:1.2rem;">' +
    '<p><a href="/" style="color:#8a6d3b;font-weight:800;text-decoration:none;">← 최애광장 홈</a></p>' +
    '<h1 style="font-size:1.8rem;margin:.3rem 0;">' + esc(name) + '</h1>' +
    '<p style="color:#6b6355;">' + esc(cat) + ' 가수 · 최신 영상과 소식을 모았어요</p>' +
    '<a href="/?singer=' + encodeURIComponent(name) + '" style="display:inline-block;background:#8a6d3b;color:#fff;padding:.7rem 1.3rem;border-radius:.6rem;text-decoration:none;font-weight:800;margin:.5rem .2rem;">홈에서 ' + esc(name) + ' 노래 듣기</a>' +
    '<a href="' + esc(ytUrl) + '" style="display:inline-block;background:#2b2620;color:#fff;padding:.7rem 1.3rem;border-radius:.6rem;text-decoration:none;font-weight:800;margin:.5rem .2rem;">유튜브 채널</a>' +
    '<h2 style="font-size:1.3rem;margin-top:1.5rem;">최신 영상</h2>' +
    '<ul style="list-style:none;padding:0;">' + vidHtml + '</ul>' +
    '<p style="color:#6b6355;font-size:.9rem;margin-top:2rem;">' + esc(name) + '의 노래·영상·소식을 큰 글씨로 편하게 보려면 최애광장 홈에서 만나보세요!</p>' +
    '</div></body></html>';

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
