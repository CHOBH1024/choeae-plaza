import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestGet as searchBlogs } from "../functions/api/blog.js";
import { onRequestGet as popularVideos } from "../functions/api/popular-videos.js";
import { onRequestGet as singerPage } from "../functions/singer/[name].js";

const request = (path) => new Request("https://site.test" + path);

test("blog, popular-video, and singer routes share one artist catalog", async () => {
  const [blogSource, videoSource, singerSource] = await Promise.all([
    readFile(new URL("../functions/api/blog.js", import.meta.url), "utf8"),
    readFile(new URL("../functions/api/popular-videos.js", import.meta.url), "utf8"),
    readFile(new URL("../functions/singer/[name].js", import.meta.url), "utf8")
  ]);
  const parseArray = (match) => JSON.parse(match?.[1] || "null");
  const blog = parseArray(blogSource.match(/const ALLOWED = new Set\((\[[\s\S]*?\])\);/));
  const videos = parseArray(videoSource.match(/const ALLOWED = new Set\((\[[\s\S]*?\])\);/));
  const trot = parseArray(singerSource.match(/const TROT = (\[[^;]+\]);/));
  const idols = parseArray(singerSource.match(/const IDOL = (\[[^;]+\]);/));
  const expected = [...new Set([...trot, ...idols])].sort();
  assert.deepEqual([...blog].sort(), expected);
  assert.deepEqual([...videos].sort(), expected);
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

test("current POMYJO feed artist Treasure is allowed by both content endpoints", async () => {
  const query = "/api/blog?name=%ED%8A%B8%EB%A0%88%EC%A0%80";
  const blog = await searchBlogs({ request: request(query), env: {} });
  const videos = await popularVideos({ request: request("/api/popular-videos?name=%ED%8A%B8%EB%A0%88%EC%A0%80"), env: {} });
  assert.equal(blog.status, 503, "known artist reaches missing-secret handling rather than allowlist rejection");
  assert.equal(videos.status, 503, "known artist reaches missing-secret handling rather than allowlist rejection");
});

test("Treasure singer page renders, stays noindex, and contains no decorative emoji", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ artists: { "트레저": [{ videoId: "video-1", title: "트레저 무대" }] } });
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

test("blog search requires secrets and sanitizes the Naver response", async () => {
  const originalFetch = globalThis.fetch;
  let sentHeaders;
  globalThis.fetch = async (_url, options) => {
    sentHeaders = options.headers;
    return Response.json({ items: [
      { title: "<b>가수</b> &amp; 팬", description: "<b>후기</b>", link: "https://blog.naver.com/fan/1", bloggername: "팬", postdate: "20261008" },
      { title: "비보안 링크", link: "http://example.com/post" }
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
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0].title, "가수 & 팬");
    assert.equal(data.items[0].description, "후기");
    assert.equal(sentHeaders["X-Naver-Client-Secret"], "test-secret");
    assert.equal(JSON.stringify(data).includes("test-secret"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("popular videos only ranks the recent feed and never returns the API key", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    const value = String(url);
    urls.push(value);
    if (value.includes("api.pomyjo.com")) {
      return Response.json({ artists: { BTS: [
        { videoId: "low" }, { videoId: "high" }, { videoId: "mid" }
      ] } });
    }
    return Response.json({ items: [
      { id: "low", snippet: { title: "Low" }, statistics: { viewCount: "10" } },
      { id: "high", snippet: { title: "High" }, statistics: { viewCount: "900" } },
      { id: "mid", snippet: { title: "Mid" }, statistics: { viewCount: "100" } }
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
    assert.deepEqual(data.items.map((item) => item.videoId), ["high", "mid", "low"]);
    assert.equal(JSON.stringify(data).includes("test-key"), false);
    assert.equal(urls.some((url) => url.includes("id=low%2Chigh%2Cmid")), true);
  } finally { globalThis.fetch = originalFetch; }
});
