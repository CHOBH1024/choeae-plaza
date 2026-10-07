import { ALLOWED_ARTISTS } from "../_shared/artists.js";
// Server-side Naver Blog Search proxy. Credentials belong in Cloudflare Pages secrets.
const ALLOWED = ALLOWED_ARTISTS;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const upstreamTimeout = () => AbortSignal.timeout(8000);
const NAVER_BLOG_HOSTS = new Set(["openapi.naver.com", "blog.naver.com", "m.blog.naver.com", "post.naver.com"]);

function normalizeBlogLink(value) {
  try {
    const url = new URL(value);
    if (!NAVER_BLOG_HOSTS.has(url.hostname.toLowerCase()) || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return "";
    if (url.hostname.toLowerCase() === "openapi.naver.com" && url.pathname !== "/l") return "";
    // Preserve Naver's source URL exactly; their official Search API examples return an HTTP /l redirect URL.
    return String(value);
  } catch { return ""; }
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
      title: typeof item.title === "string" ? item.title : "",
      description: typeof item.description === "string" ? item.description : "",
      link: normalizeBlogLink(item.link), bloggername: typeof item.bloggername === "string" ? item.bloggername : "네이버 블로그", postdate: typeof item.postdate === "string" ? item.postdate : ""
    })).filter((item) => item.link);
    return json({ ok: true, items });
  } catch { return json({ ok: false, error: "NAVER_SEARCH_UNAVAILABLE" }, 502); }
}
