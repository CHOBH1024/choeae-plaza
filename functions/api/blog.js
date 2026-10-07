// Server-side Naver Blog Search proxy. Credentials belong in Cloudflare Pages secrets.
const ALLOWED = new Set([
  "임영웅", "영탁", "이찬원", "장민호", "김호중", "정동원", "송가인", "장윤정", "태진아", "설운도", "진성", "나훈아", "박서진", "홍진영", "조항조", "신유", "김연자", "주현미", "현철", "이미자", "남진", "송대관", "김희재", "김수찬", "황영웅", "김다현", "박군", "신성", "송민준", "김용임", "강진", "박상철", "윤수현", "요요미", "마이진", "오유진", "진해성", "박현빈", "서지오", "문희옥", "강혜연", "양지은", "정미애", "김태연", "영기", "나상도", "김호영", "최향", "정동하", "조승구",
  "BTS", "블랙핑크", "뉴진스", "아이브", "에스파", "트와이스", "세븐틴", "싸이", "엑소", "르세라핌", "아이유", "스트레이키즈", "엔하이픈", "TXT", "레드벨벳", "NCT 127", "NCT DREAM", "라이즈", "제로베이스원", "트레저", "ITZY", "오마이걸", "마마무", "(여자)아이들", "빅뱅", "샤이니", "태연", "선미", "보아", "슈퍼주니어", "소녀시대", "에이핑크", "비투비", "에이티즈", "더보이즈", "몬스타엑스", "스테이씨", "케플러", "드림캐쳐", "위너", "아이콘", "갓세븐", "박진영", "현아", "청하", "이효리", "강다니엘", "김세정", "전소미", "제시", "있지"
]);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": status === 200 ? "public, max-age=300, s-maxage=300" : "no-store" } });
const upstreamTimeout = () => AbortSignal.timeout(8000);

export async function onRequestGet({ request, env }) {
  const name = new URL(request.url).searchParams.get("name")?.trim();
  if (!ALLOWED.has(name)) return json({ ok: false, error: "ARTIST_NOT_FOUND" }, 400);
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) return json({ ok: false, error: "NAVER_SEARCH_NOT_CONFIGURED" }, 503);
  try {
    const url = new URL("https://openapi.naver.com/v1/search/blog.json");
    url.searchParams.set("query", name);
    url.searchParams.set("display", "8");
    url.searchParams.set("sort", "sim");
    const response = await fetch(url, { signal: upstreamTimeout(), headers: { "X-Naver-Client-Id": env.NAVER_CLIENT_ID, "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET } });
    if (!response.ok) return json({ ok: false, error: "NAVER_SEARCH_UNAVAILABLE" }, 502);
    const data = await response.json();
    const items = (data.items || []).map((item) => ({
      title: (item.title || "").replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
      description: (item.description || "").replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
      link: item.link, bloggername: item.bloggername || "네이버 블로그", postdate: item.postdate || ""
    })).filter((item) => { try { return new URL(item.link).protocol === "https:"; } catch { return false; } });
    return json({ ok: true, items });
  } catch { return json({ ok: false, error: "NAVER_SEARCH_UNAVAILABLE" }, 502); }
}
