import { ALLOWED_ARTISTS } from "../_shared/artists.js";
// Server-side Naver Blog Search proxy. Credentials belong in Cloudflare Pages secrets.
const ALLOWED = ALLOWED_ARTISTS;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": status === 200 ? "public, max-age=300, s-maxage=300" : "no-store" } });
const upstreamTimeout = () => AbortSignal.timeout(8000);
const NAVER_BLOG_HOSTS = new Set(["openapi.naver.com", "blog.naver.com", "m.blog.naver.com", "post.naver.com"]);

function normalizeBlogLink(value) {
  try {
    const url = new URL(value);
    if (!NAVER_BLOG_HOSTS.has(url.hostname.toLowerCase()) || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return "";
    // Naver's documented search examples use an HTTP openapi.naver.com redirect; upgrade it before returning it to browsers.
    if (url.hostname.toLowerCase() === "openapi.naver.com" && url.pathname !== "/l") return "";
    url.protocol = "https:";
    return url.href;
  } catch { return ""; }
}

function cleanNaverText(value) {
  const namedEntities = { quot: '"', apos: "'", amp: "&", lt: "<", gt: ">", nbsp: " " };
  return String(value || "").replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|quot|apos|amp|lt|gt|nbsp);/gi, (entity, token) => {
      if (token[0] !== "#") return namedEntities[token.toLowerCase()] ?? entity;
      const codePoint = token[1].toLowerCase() === "x" ? parseInt(token.slice(2), 16) : parseInt(token.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "";
    }).replace(/\s+/g, " ").trim();
}

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
      title: cleanNaverText(item.title),
      description: cleanNaverText(item.description),
      link: normalizeBlogLink(item.link), bloggername: item.bloggername || "네이버 블로그", postdate: item.postdate || ""
    })).filter((item) => item.link);
    return json({ ok: true, items });
  } catch { return json({ ok: false, error: "NAVER_SEARCH_UNAVAILABLE" }, 502); }
}
