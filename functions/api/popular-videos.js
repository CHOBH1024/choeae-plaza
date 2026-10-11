import { ALLOWED_ARTISTS } from "../_shared/artists.js";
const ALLOWED = ALLOWED_ARTISTS;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": status === 200 ? "public, max-age=300, s-maxage=300" : "no-store" } });
const upstreamTimeout = () => AbortSignal.timeout(8000);

export async function onRequestGet({ request, env }) {
  const name = new URL(request.url).searchParams.get("name")?.trim();
  if (!ALLOWED.has(name)) return json({ ok: false, error: "ARTIST_NOT_FOUND" }, 400);
  if (!env.YOUTUBE_API_KEY) return json({ ok: false, error: "YOUTUBE_API_NOT_CONFIGURED" }, 503);
  try {
    const feedResponse = await fetch("https://api.pomyjo.com/api/singer/feed", { signal: upstreamTimeout() });
    if (!feedResponse.ok) return json({ ok: false, error: "VIDEO_FEED_UNAVAILABLE" }, 502);
    const feed = await feedResponse.json();
    if (!feed || !feed.artists || typeof feed.artists !== "object" || Array.isArray(feed.artists)) return json({ ok: false, error: "VIDEO_FEED_UNAVAILABLE" }, 502);
    const videos = Object.hasOwn(feed.artists, name) ? feed.artists[name] : [];
    if (!Array.isArray(videos)) return json({ ok: false, error: "VIDEO_FEED_UNAVAILABLE" }, 502);
    const ids = [...new Set(videos.map((video) => video?.videoId).filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id)))].slice(0, 15);
    if (videos.length && !ids.length) return json({ ok: false, error: "VIDEO_FEED_UNAVAILABLE" }, 502);
    const success = items => json({ ok: true, scope: "recent-feed", generatedAt: new Date().toISOString(), refreshSeconds: 300, items });
    if (!ids.length) return success([]);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,statistics"); url.searchParams.set("id", ids.join(",")); url.searchParams.set("key", env.YOUTUBE_API_KEY);
    const response = await fetch(url, { signal: upstreamTimeout() });
    if (!response.ok) return json({ ok: false, error: "YOUTUBE_API_UNAVAILABLE" }, 502);
    const data = await response.json();
    if (!data || !Array.isArray(data.items)) return json({ ok: false, error: "YOUTUBE_API_UNAVAILABLE" }, 502);
    const requestedIds = new Set(ids);
    const items = (Array.isArray(data.items) ? data.items : []).filter((item) =>
      item && typeof item.id === "string" && requestedIds.has(item.id)
    ).map((item) => {
      const parsedViewCount = Number(item.statistics?.viewCount || 0);
      return {
        videoId: item.id, title: item.snippet?.title || "영상", published: item.snippet?.publishedAt || "",
        channelTitle: item.snippet?.channelTitle || "",
        viewCount: Number.isSafeInteger(parsedViewCount) && parsedViewCount >= 0 ? parsedViewCount : 0
      };
    }).sort((a, b) => b.viewCount - a.viewCount).slice(0, 5);
    return success(items);
  } catch { return json({ ok: false, error: "YOUTUBE_API_UNAVAILABLE" }, 502); }
}
