import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestGet as searchBlogs } from "../functions/api/blog.js";
import { onRequestGet as popularVideos } from "../functions/api/popular-videos.js";
import { onRequestGet as singerPage } from "../functions/singer/[name].js";
import { onRequestGet as sitemap } from "../functions/sitemap.xml.js";
import { onRequest as rss } from "../functions/rss.xml.js";
import { ALLOWED_ARTISTS, ARTIST_NAMES, IDOL, TROT } from "../functions/_shared/artists.js";

const request = (path) => new Request("https://site.test" + path);

test("blog, popular-video, and singer routes use the canonical artist catalog", async () => {
  const [blogSource, videoSource, singerSource] = await Promise.all([
    readFile(new URL("../functions/api/blog.js", import.meta.url), "utf8"),
    readFile(new URL("../functions/api/popular-videos.js", import.meta.url), "utf8"),
    readFile(new URL("../functions/singer/[name].js", import.meta.url), "utf8")
  ]);
  assert.deepEqual([...ALLOWED_ARTISTS].sort(), [...new Set([...TROT, ...IDOL])].sort());
  assert.deepEqual([...ARTIST_NAMES].sort(), [...ALLOWED_ARTISTS].sort());
  assert.match(blogSource, /import \{ ALLOWED_ARTISTS \} from "\.\.\/_shared\/artists\.js"/);
  assert.match(videoSource, /import \{ ALLOWED_ARTISTS \} from "\.\.\/_shared\/artists\.js"/);
  assert.match(singerSource, /import \{ TROT, IDOL \} from "\.\.\/_shared\/artists\.js"/);
});

test("blog search rejects unknown artist and does not call Naver", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; };
  try {
    const response = await searchBlogs({ request: request("/api/blog?name=unknown"), env: {} });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(called, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("blog search prefers NAVER API HUB credentials and uses its documented endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl;
  let calledOptions;
  globalThis.fetch = async (url, options) => {
    calledUrl = new URL(String(url));
    calledOptions = options;
    return Response.json({ items: [{ title: "<b>BTS</b> 소식", link: "https://blog.naver.com/fan/1", description: "글", bloggername: "팬", postdate: "20261008" }] });
  };
  try {
    const response = await searchBlogs({
      request: request("/api/blog?name=BTS"),
      env: {
        NAVER_API_HUB_CLIENT_ID: "hub-id", NAVER_API_HUB_CLIENT_SECRET: "hub-secret",
        NAVER_CLIENT_ID: "legacy-id", NAVER_CLIENT_SECRET: "legacy-secret"
      }
    });
    assert.equal(response.status, 200);
    assert.equal(calledUrl.origin, "https://naverapihub.apigw.ntruss.com");
    assert.equal(calledUrl.pathname, "/search/v1/blog");
    assert.equal(calledUrl.searchParams.get("query"), "BTS");
    assert.equal(calledUrl.searchParams.get("format"), "json");
    assert.equal(calledOptions.headers["X-NCP-APIGW-API-KEY-ID"], "hub-id");
    assert.equal(calledOptions.headers["X-NCP-APIGW-API-KEY"], "hub-secret");
    assert.equal(JSON.stringify(await response.json()).includes("hub-secret"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("blog search keeps legacy credentials as a migration fallback", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl;
  let calledHeaders;
  globalThis.fetch = async (url, options) => {
    calledUrl = new URL(String(url));
    calledHeaders = options.headers;
    return Response.json({ items: [] });
  };
  try {
    const response = await searchBlogs({
      request: request("/api/blog?name=BTS"),
      env: { NAVER_CLIENT_ID: "legacy-id", NAVER_CLIENT_SECRET: "legacy-secret" }
    });
    assert.equal(response.status, 200);
    assert.equal(calledUrl.hostname, "openapi.naver.com");
    assert.equal(calledHeaders["X-Naver-Client-Id"], "legacy-id");
    assert.equal(calledHeaders["X-Naver-Client-Secret"], "legacy-secret");
  } finally { globalThis.fetch = originalFetch; }
});

test("blog search forwards supported ordering and rejects arbitrary sorts before calling upstream", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(new URL(url)); return Response.json({ items: [] }); };
  try {
    for (const [query, expected] of [["", "sim"], ["&sort=sim", "sim"], ["&sort=date", "date"]]) {
      const response = await searchBlogs({ request: request("/api/blog?name=BTS" + query), env: { NAVER_CLIENT_ID: "id", NAVER_CLIENT_SECRET: "secret" } });
      assert.equal(response.status, 200);
      assert.equal(calls.at(-1).searchParams.get("sort"), expected);
      assert.equal((await response.json()).sort, expected);
    }
    const invalid = await searchBlogs({ request: request("/api/blog?name=BTS&sort=anything"), env: {} });
    assert.equal(invalid.status, 400);
    assert.equal(calls.length, 3);
    assert.equal(invalid.headers.get("Cache-Control"), "no-store");
  } finally { globalThis.fetch = originalFetch; }
});

test("partial NAVER API HUB credentials do not silently fall back to legacy keys", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; return Response.json({ items: [] }); };
  try {
    const response = await searchBlogs({
      request: request("/api/blog?name=BTS"),
      env: { NAVER_API_HUB_CLIENT_ID: "hub-id", NAVER_CLIENT_ID: "legacy-id", NAVER_CLIENT_SECRET: "legacy-secret" }
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(called, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("blog search does not report malformed upstream responses as empty success", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    for (const payload of [null, {}, { items: {} }, { items: [{ link: "javascript:alert(1)" }] }]) {
      globalThis.fetch = async () => Response.json(payload);
      const response = await searchBlogs({ request: request("/api/blog?name=BTS"), env: { NAVER_CLIENT_ID: "id", NAVER_CLIENT_SECRET: "secret" } });
      assert.equal(response.status, 502);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(await response.json(), { ok: false, error: "NAVER_SEARCH_UNAVAILABLE" });
    }
    globalThis.fetch = async () => Response.json({ items: [] });
    const empty = await searchBlogs({ request: request("/api/blog?name=BTS"), env: { NAVER_CLIENT_ID: "id", NAVER_CLIENT_SECRET: "secret" } });
    assert.equal(empty.status, 200);
  } finally { globalThis.fetch = originalFetch; console.warn = originalWarn; }
});

test("current POMYJO feed artist Treasure is allowed by both content endpoints", async () => {
  const query = "/api/blog?name=%ED%8A%B8%EB%A0%88%EC%A0%80";
  const blog = await searchBlogs({ request: request(query), env: {} });
  const videos = await popularVideos({ request: request("/api/popular-videos?name=%ED%8A%B8%EB%A0%88%EC%A0%80"), env: {} });
  assert.equal(blog.status, 503, "known artist reaches missing-secret handling rather than allowlist rejection");
  assert.equal(videos.status, 503, "known artist reaches missing-secret handling rather than allowlist rejection");
});

test("Treasure singer page renders, stays noindex, and contains no decorative emoji", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ artists: { "트레저": [{ videoId: "aaaaaaaaaaa", title: "트레저 무대" }] } });
  try {
    const response = await singerPage({ params: { name: "트레저" } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /트레저 최신 영상·노래 모음/);
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(html, /트레저 무대/);
    assert.doesNotMatch(html, /\p{Extended_Pictographic}/u);
  } finally { globalThis.fetch = originalFetch; }
});

test("singer landing pages ignore failed feeds and reject malformed video IDs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ artists: { "트레저": [
    { videoId: 'aaaaaaaaaaa', title: '정상 영상' },
    { videoId: '\"><script>alert(1)</script>', title: '주입 시도' }
  ] } });
  try {
    const response = await singerPage({ params: { name: "트레저" } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /정상 영상/);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  } finally { globalThis.fetch = originalFetch; }
});

test("singer pages render their fallback when the upstream feed times out", async () => {
  const originalFetch = globalThis.fetch;
  let signal;
  globalThis.fetch = async (_url, options) => {
    signal = options.signal;
    throw new DOMException("Timed out", "TimeoutError");
  };
  try {
    const response = await singerPage({ params: { name: "트레저" } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(signal instanceof AbortSignal);
    assert.match(html, /현재 영상 목록을 불러오지 못했거나 수집된 영상이 없어요/);
    assert.doesNotMatch(html, /최신 영상을 불러오는 중이에요/);
  } finally { globalThis.fetch = originalFetch; }
});

test("unknown and malformed singer routes return explicit noindex 404 responses", async () => {
  const unknown = await singerPage({ params: { name: "없는가수" } });
  const malformed = await singerPage({ params: { name: "%E0%A4%A" } });
  for (const response of [unknown, malformed]) {
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.match(await response.text(), /가수를 찾을 수 없어요/);
  }
});

test("sitemap does not advertise pages that currently carry noindex", async () => {
  const response = await sitemap();
  const xml = await response.text();
  assert.equal(response.headers.get("Content-Type"), "application/xml; charset=utf-8");
  assert.match(xml, /<urlset[\s\S]*><\/urlset>/);
  assert.doesNotMatch(xml, /<loc>/);
});

test("RSS uses the canonical artist catalog and excludes malformed upstream video links", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ artists: {
    "트레저": [
      { videoId: "AbCdEf12345", title: "트레저 & <무대>", published: "2026-10-08T10:00:00Z" },
      { videoId: "QwErTy12345", title: "깨진\u0001제목", published: "2026-10-08T09:00:00Z" },
      { videoId: "\"><script>alert(1)</script>", title: "잘못된 영상", published: "2026-10-08T11:00:00Z" },
      { videoId: "NotAnId", title: "잘못된 ID", published: "2026-10-08T12:00:00Z" },
      { videoId: "XyZ98765432", title: "날짜 오류", published: "not-a-date" }
    ]
  } });
  try {
    const response = await rss();
    const xml = await response.text();
    assert.equal(response.status, 200);
    assert.match(xml, /<title>트레저 — 트레저 &amp; &lt;무대&gt;<\/title>/);
    assert.match(xml, /<title>트레저 — 깨진제목<\/title>/);
    assert.doesNotMatch(xml, /\u0001/);
    assert.match(xml, /https:\/\/choeae-plaza\.pomyjo\.com\/\?v=AbCdEf12345/);
    assert.doesNotMatch(xml, /잘못된 영상|잘못된 ID|날짜 오류|<script>alert/);
    assert.equal((xml.match(/<item>/g) || []).length, 2);
    assert.ok(ARTIST_NAMES.includes("트레저"), "RSS shares the supported artist catalog");
  } finally { globalThis.fetch = originalFetch; }
});

test("RSS upstream failures return an empty no-store feed rather than cache a transient outage", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("upstream unavailable", { status: 503 });
  try {
    const response = await rss();
    const xml = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.match(xml, /<rss version="2\.0"><channel>[\s\S]*<\/channel><\/rss>/);
    assert.doesNotMatch(xml, /<item>/);
  } finally { globalThis.fetch = originalFetch; }
});

test("blog search requires secrets, preserves Naver content, and filters unsafe links", async () => {
  const originalFetch = globalThis.fetch;
  let sentHeaders;
  globalThis.fetch = async (_url, options) => {
    sentHeaders = options.headers;
    return Response.json({ items: [
      { title: "<b>가수</b> &amp; &#39;팬&#39;", description: "<b>후기</b>&nbsp;한 줄", link: "https://blog.naver.com/fan/1", bloggername: "팬", postdate: "20261008" },
      { title: "보안 연결로 고친 검색 링크", link: "http://openapi.naver.com/l?token=abc" },
      { title: "티스토리 검색 결과", link: "https://fan.tistory.com/42" },
      { title: "실행형 링크", link: "javascript:alert(1)" },
      { title: "인증정보 포함 링크", link: "https://user:secret@fan.tistory.com/42" },
      { title: "로컬 주소", link: "https://127.0.0.1/post" },
      { title: "로컬 호스트", link: "https://fan.local/post" },
      { title: "비보안 외부 링크", link: "http://example.com/post" }
    ] });
  };
  try {
    const missing = await searchBlogs({ request: request("/api/blog?name=%EC%9E%84%EC%98%81%EC%9B%85"), env: {} });
    assert.equal(missing.status, 503);
    const response = await searchBlogs({
      request: request("/api/blog?name=%EC%9E%84%EC%98%81%EC%9B%85"),
      env: { NAVER_CLIENT_ID: "test-id", NAVER_CLIENT_SECRET: "test-secret" }
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.items.length, 3);
    assert.equal(data.items[0].title, "<b>가수</b> &amp; &#39;팬&#39;");
    assert.equal(data.items[0].description, "<b>후기</b>&nbsp;한 줄");
    assert.equal(data.items[1].link, "http://openapi.naver.com/l?token=abc");
    assert.equal(data.items[2].link, "https://fan.tistory.com/42");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(sentHeaders["X-Naver-Client-Secret"], "test-secret");
    assert.equal(JSON.stringify(data).includes("test-secret"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("upstream timeouts fail closed with a non-cacheable service error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new DOMException("Timed out", "TimeoutError"); };
  try {
    const blog = await searchBlogs({
      request: request("/api/blog?name=BTS"),
      env: { NAVER_CLIENT_ID: "test-id", NAVER_CLIENT_SECRET: "test-secret" }
    });
    const videos = await popularVideos({
      request: request("/api/popular-videos?name=BTS"), env: { YOUTUBE_API_KEY: "test-key" }
    });
    assert.equal(blog.status, 502);
    assert.equal(videos.status, 502);
    assert.equal(blog.headers.get("Cache-Control"), "no-store");
    assert.equal(videos.headers.get("Cache-Control"), "no-store");
  } finally { globalThis.fetch = originalFetch; }
});

test("popular-video malformed feed and provider payloads fail closed rather than returning empty success", async () => {
  const originalFetch = globalThis.fetch;
  const run = () => popularVideos({request:request('/api/popular-videos?name=BTS'),env:{YOUTUBE_API_KEY:'private-key'}});
  try {
    for (const payload of [null, {}, {artists:[]}, {artists:{BTS:{}}}, {artists:{BTS:[null,{videoId:'invalid'}]}}]) {
      let calls=0;
      globalThis.fetch=async()=>{calls++;return Response.json(payload);};
      const r=await run();
      assert.equal(r.status,502);assert.equal(r.headers.get('Cache-Control'),'no-store');
      assert.equal((await r.json()).error,'VIDEO_FEED_UNAVAILABLE');assert.equal(calls,1);
    }
    for (const payload of [null, {}, {items:{}}, {error:{message:'private provider diagnostic'}}]) {
      globalThis.fetch=async url=>String(url).includes('api.pomyjo.com') ? Response.json({artists:{BTS:[{videoId:'aaaaaaaaaaa'}]}}) : Response.json(payload);
      const r=await run();assert.equal(r.status,502);
      assert.deepEqual(await r.json(),{ok:false,error:'YOUTUBE_API_UNAVAILABLE'});
    }
    for (const artists of [{}, {BTS:[]}]) {
      let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({artists});};
      const r=await run();const d=await r.json();
      assert.equal(r.status,200);assert.equal(calls,1);assert.deepEqual(d.items,[]);
      assert.equal(d.scope,'recent-feed');assert.equal(d.refreshSeconds,300);assert.ok(Number.isFinite(Date.parse(d.generatedAt)));
    }
  } finally {globalThis.fetch=originalFetch;}
});

test("popular videos deduplicates feed IDs before the fifteen-video limit", async () => {
  const originalFetch=globalThis.fetch;let requested;
  globalThis.fetch=async url=>{
    if(String(url).includes('api.pomyjo.com')) return Response.json({artists:{BTS:[...Array(16).fill({videoId:'aaaaaaaaaaa'}),{videoId:'bbbbbbbbbbb'}]}});
    requested=new URL(url).searchParams.get('id');return Response.json({items:[]});
  };
  try {
    const r=await popularVideos({request:request('/api/popular-videos?name=BTS'),env:{YOUTUBE_API_KEY:'private-key'}});
    assert.equal(r.status,200);assert.equal(requested,'aaaaaaaaaaa,bbbbbbbbbbb');
  } finally {globalThis.fetch=originalFetch;}
});

test("popular videos only ranks the recent feed and never returns the API key", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    const value = String(url);
    urls.push(value);
    if (value.includes("api.pomyjo.com")) {
      return Response.json({ artists: { BTS: [
        { videoId: "aaaaaaaaaaa" }, { videoId: "ccccccccccc" }, { videoId: "bbbbbbbbbbb" },
        { videoId: "ddddddddddd" }, { videoId: "not an id" }
      ] } });
    }
    return Response.json({ items: [
      { id: "aaaaaaaaaaa", snippet: { title: "Low" }, statistics: { viewCount: "10" } },
      { id: "ccccccccccc", snippet: { title: "High" }, statistics: { viewCount: "900" } },
      { id: "bbbbbbbbbbb", snippet: { title: "Mid" }, statistics: { viewCount: "100" } },
      { id: "ddddddddddd", snippet: { title: "Unsafe count" }, statistics: { viewCount: "9999999999999999" } },
      { id: "zzzzzzzzzzz", snippet: { title: "Not requested" }, statistics: { viewCount: "9999999999999999" } }
    ] });
  };
  try {
    const missing = await popularVideos({ request: request("/api/popular-videos?name=BTS"), env: {} });
    assert.equal(missing.status, 503);
    const response = await popularVideos({
      request: request("/api/popular-videos?name=BTS"), env: { YOUTUBE_API_KEY: "test-key" }
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.scope, "recent-feed");
    assert.equal(data.refreshSeconds, 300);
    assert.ok(Number.isFinite(Date.parse(data.generatedAt)));
    assert.match(response.headers.get('Cache-Control'), /max-age=300/);
    assert.deepEqual(data.items.map((item) => item.videoId), ["ccccccccccc", "bbbbbbbbbbb", "aaaaaaaaaaa", "ddddddddddd"]);
    assert.equal(data.items[3].viewCount, 0);
    assert.equal(data.items.some((item) => item.videoId === "zzzzzzzzzzz"), false);
    assert.equal(JSON.stringify(data).includes("test-key"), false);
    assert.equal(urls.some((url) => url.includes("id=aaaaaaaaaaa%2Cccccccccccc%2Cbbbbbbbbbbb%2Cddddddddddd")), true);
    assert.equal(urls.some((url) => url.includes("not%20an%20id")), false);
  } finally { globalThis.fetch = originalFetch; }
});
