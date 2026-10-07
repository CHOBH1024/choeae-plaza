import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("inline application scripts parse and required artist sections exist", () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim())
    .filter((source) => source && !source.startsWith("{"));
  assert.ok(scripts.length > 0);
  for (const [index, source] of scripts.entries()) {
    assert.doesNotThrow(() => new vm.Script(source, { filename: "inline-" + index + ".js" }));
  }
  for (const id of ["detail-videos", "detail-music", "detail-blogs"]) {
    assert.ok(html.includes('id="' + id + '"'), "missing " + id);
  }
  assert.ok(html.includes("music.youtube.com/search"));
});

test("artists without a curated song list still get a YouTube Music search fallback", () => {
  const artists = [...html.matchAll(/\{ name: '([^']+)', cat:/g)].map((match) => match[1]);
  const catalog = html.match(/var HIT_SONGS = \{([\s\S]*?)\n\};/)?.[1] || "";
  const curated = new Set([...catalog.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
  assert.ok(artists.some((name) => !curated.has(name)), "test should cover artists without curated songs");
  assert.match(html, /YouTube Music에서 ' \+ esc\(name\) \+ ' 대표곡 찾기/);
  assert.match(html, /ytMusicSearch\(name \+ ' 대표곡'\)/);
});

test("today's song opens the exact artist-and-song query in YouTube Music", () => {
  const fn = html.match(/function playTodaySong\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  const opened = [];
  const context = {
    todaySong: { s: "BTS", t: "Spring Day" },
    ytMusicSearch: (query) => "https://music.youtube.com/search?q=" + encodeURIComponent(query),
    openTab: (url) => opened.push(url)
  };
  vm.runInNewContext(fn + "\nplayTodaySong();", context);
  assert.deepEqual(opened, ["https://music.youtube.com/search?q=BTS%20Spring%20Day"]);
  assert.match(html, /YouTube Music에서 오늘의 노래 검색 \(새 창\)/);
});

test("HTML fallbacks from missing API routes show useful external search links", async () => {
  for (const [functionName, targetId, fallbackText, expectedHost] of [
    ["loadPopularVideos", "popularVideoList", "인기 영상 API가 아직 연결되지 않았어요", "youtube.com"],
    ["loadSingerBlogs", "mdBlogs", "네이버 블로그 검색 API가 아직 연결되지 않았어요", "search.naver.com"]
  ]) {
    const fn = html.match(new RegExp("function " + functionName + "\\(name\\) \\{[\\s\\S]*?\\n\\}"))?.[0];
    assert.ok(fn, functionName + " should exist");
    const element = { innerHTML: "" };
    const context = {
      openSinger: "임영웅",
      fetch: async () => ({ headers: { get: () => "text/html; charset=utf-8" } }),
      $: (id) => id === targetId ? element : null,
      ytSearch: (query) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(query),
      esc: (value) => String(value),
      encodeURIComponent
    };
    vm.runInNewContext(fn + "\n" + functionName + "('임영웅');", context);
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(element.innerHTML, new RegExp(fallbackText));
    assert.match(element.innerHTML, new RegExp(expectedHost));
  }
});

test("comment API requests use the live singer-comments routes", async () => {
  const loadComments = html.match(/function loadComments\(singer\) \{[\s\S]*?\n\}/)?.[0];
  const sendComment = html.match(/function sendComment\(singer\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(loadComments && sendComment);
  const calls = [];
  const input = { value: "테스트" };
  const list = { innerHTML: "" };
  const context = {
    API: "https://api.pomyjo.com/api/singer",
    openSinger: "BTS",
    encodeURIComponent,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { json: async () => options ? { ok: true } : { comments: [] } };
    },
    $: (id) => id === "cmName" || id === "cmText" ? input : list,
    toast() {}
  };
  vm.runInNewContext(loadComments + "\n" + sendComment + "\nloadComments('BTS'); sendComment('BTS');", context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls[0].url, "https://api.pomyjo.com/api/singer/comments?singer=BTS");
  assert.equal(calls[1].url, "https://api.pomyjo.com/api/singer/comments");
  assert.deepEqual(JSON.parse(calls[1].options.body), { singer: "BTS", name: "테스트", text: "테스트" });
});

test("comment names and text are escaped before HTML rendering", async () => {
  const esc = html.match(/function esc\(s\) \{[\s\S]*?\n\}/)?.[0];
  const fmtDate = html.match(/function fmtDate\(s\) \{[\s\S]*?\n\}/)?.[0];
  const loadComments = html.match(/function loadComments\(singer\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(esc && fmtDate && loadComments);
  const list = { innerHTML: "" };
  const context = {
    API: "https://api.pomyjo.com/api/singer",
    openSinger: "BTS",
    fetch: async () => ({ json: async () => ({ comments: [
      { name: "<img src=x onerror=alert(1)>", text: "<script>alert(1)</script>", created_at: "" }
    ] }) }),
    $: () => list
  };
  vm.runInNewContext([esc, fmtDate, loadComments, "loadComments('BTS');"].join("\n"), context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.doesNotMatch(list.innerHTML, /<img|<script/i);
  assert.match(list.innerHTML, /&lt;img/);
  assert.match(list.innerHTML, /&lt;script&gt;/);
});

test("YouTube comment metadata is escaped and likes are constrained to safe integers", async () => {
  const esc = html.match(/function esc\(s\) \{[\s\S]*?\n\}/)?.[0];
  const loadYTComments = html.match(/function loadYTComments\(name\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(esc && loadYTComments);
  const list = { innerHTML: "" };
  const context = {
    openSinger: "BTS",
    window: { __feed: { artists: { BTS: [{ videoId: "aaaaaaaaaaa" }] } } },
    document: { querySelector: () => null },
    fetch: async () => ({ json: async () => ({ comments: [
      { author: "<img src=x onerror=alert(1)>", text: "<script>alert(1)</script>", likes: "<svg onload=alert(2)>", date: "2026-10-08" }
    ] }) }),
    $: () => list,
    encodeURIComponent
  };
  vm.runInNewContext([esc, loadYTComments, "loadYTComments('BTS');"].join("\n"), context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.doesNotMatch(list.innerHTML, /<img|<svg|<script/i);
  assert.match(list.innerHTML, /&lt;img/);
  assert.match(list.innerHTML, /&lt;script&gt;/);
  assert.match(list.innerHTML, /> 0 · /);
});

test("rank API counts are numeric and limited to known artists", async () => {
  const loadRank = html.match(/function loadRank\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(loadRank);
  const element = { innerHTML: "" };
  const context = {
    API: "https://api.pomyjo.com/api/singer",
    state: { rankPeriod: "week" },
    ARTISTS: [{ name: "BTS" }, { name: "IU" }],
    fetch: async () => ({ json: async () => ({ rank: [
      { singer: "BTS", c: "<img src=x onerror=alert(1)>" },
      { singer: "IU", c: 1234 },
      { singer: "__proto__", c: 999999 }
    ] }) }),
    $: () => element,
    esc: (value) => String(value)
  };
  vm.runInNewContext(loadRank + "\nloadRank();", context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.doesNotMatch(element.innerHTML, /<img|<script/i);
  assert.match(element.innerHTML, /<span class="rc">0<\/span>/);
  assert.match(element.innerHTML, /<span class="rc">1,234<\/span>/);
  assert.doesNotMatch(element.innerHTML, /999,999/);
});

test("late artist-detail API responses cannot overwrite the newly selected singer", async () => {
  const cases = [
    ["loadPopularVideos", { ok: false }],
    ["loadSingerBlogs", { ok: false }],
    ["loadSingerSNS", { sns: [] }],
    ["loadYTComments", { comments: [] }],
    ["loadComments", { comments: [] }]
  ];
  for (const [name, data] of cases) {
    const fn = html.match(new RegExp("function " + name + "\\(\\w+\\) \\{[\\s\\S]*?\\n\\}"))?.[0];
    assert.ok(fn, name + " should exist");
    let resolveFetch;
    const element = { innerHTML: "IU current content" };
    const context = {
      API: "https://api.pomyjo.com/api/singer",
      openSinger: "BTS",
      state: { rankPeriod: "week" },
      window: { __feed: { artists: { BTS: [{ videoId: "aaaaaaaaaaa" }] } } },
      document: { querySelector: () => null },
      fetch: () => new Promise((resolve) => { resolveFetch = resolve; }),
      $: () => element,
      esc: (value) => String(value),
      fmtDate: () => "",
      encodeURIComponent,
      ytSearch: () => "https://www.youtube.com/",
      safeNaverBlogURL: () => null
    };
    vm.runInNewContext(fn + "\n" + name + "('BTS');", context);
    context.openSinger = "IU";
    resolveFetch({ headers: { get: () => "application/json" }, json: async () => data });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(element.innerHTML, "IU current content", name + " should discard stale response");
  }
});

test("program discovery avoids presenting stale broadcast slots as today's schedule", () => {
  assert.match(html, /var SHOWS = \[/);
  assert.match(html, /방송 시간은 각 방송사 편성표에서 확인/);
  assert.doesNotMatch(html, /var SCHEDULE = \[/);
  assert.doesNotMatch(html, /오후 3:30|밤 10시|오늘<\/span>/);
});

test("feed normalization drops unknown artists and malformed IDs and allowlists video kinds", () => {
  const fn = html.match(/function sanitizeVideoFeed\(artists\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  const sandbox = {
    ARTISTS: [{ name: "BTS" }],
    KIND_LABEL: { live: "stage", mv: "music video", other: "video" }
  };
  const context = {
    ...sandbox,
    input: {
      BTS: [
        { videoId: "aaaaaaaaaaa", title: "valid", kind: "live" },
        { videoId: "bbbbbbbbbbb", title: "bad category", kind: 'live\" onmouseover=\"alert(1)' },
        { videoId: "not-an-id", title: "invalid ID", kind: "mv" }
      ],
      Unknown: [{ videoId: "ccccccccccc", title: "unlisted" }]
    }
  };
  vm.runInNewContext(fn + "\nresult = sanitizeVideoFeed(input);", context);
  const result = context.result;
  assert.equal(result.BTS.length, 2);
  assert.equal(result.BTS[0].kind, "live");
  assert.equal(result.BTS[1].kind, "other");
  assert.equal(result.Unknown, undefined);
});

test("static page IDs are unique and branding contains no decorative emoji", async () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "duplicate static ID");
  assert.doesNotMatch(html, /\p{Extended_Pictographic}/u);
  assert.doesNotMatch(html, /\bemoji\s*:/, "legacy emoji data should not linger after UI cleanup");
  const icon = await readFile(new URL("../public/icon.svg", import.meta.url), "utf8");
  assert.doesNotMatch(icon, /\p{Extended_Pictographic}/u);
  assert.match(icon, />최</);
  assert.doesNotMatch(icon, /SINGERTUBE/);
});

test("mobile appbar wraps controls without shrinking 44px font-size targets", () => {
  assert.match(html, /\.appbar-in\{ padding:\.4rem \.9rem; gap:\.35rem; flex-wrap:wrap; \}/);
  assert.match(html, /\.fontsize \.fs-btn\{ min-width:44px; height:44px; flex-shrink:0; white-space:nowrap;/);
  assert.match(html, /\.fontsize \.fs-btn\[data-level\]\{min-width:44px;padding:0 3px;\}/);
});

test("Google Drive requests include the API session credentials", () => {
  assert.match(html, /api\/drive\/load\?user=' \+ encodeURIComponent\(driveUser\), \{ credentials: 'include' \}\)/);
  assert.match(html, /method: 'POST', credentials: 'include', headers: \{ 'Content-Type': 'application\/json' \}/);
});

test("Drive load failures preserve this device's saved items and explain retry or re-login", async () => {
  const loadDrive = html.match(/function loadDrive\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(loadDrive);
  let rendered = 0;
  const body = { insertAdjacentHTML(_position, html) { this.notice = html; } };
  const sandbox = {
    driveUser: "member@example.test",
    driveData: { favorites: ["BTS"], videos: [{ t: "cached" }], songs: [], articles: [] },
    fetch: async () => ({ ok: false, status: 401 }),
    $: () => body,
    renderDrive() { rendered++; }
  };
  vm.runInNewContext(loadDrive + "\nloadDrive();", sandbox);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sandbox.driveData.videos[0].t, "cached");
  assert.equal(rendered, 1);
  assert.match(body.notice, /기기에 저장된 항목은 그대로 보관/);
  assert.match(body.notice, /data-act="google-login"/);
});

test("Google callback is not announced as successful until the authenticated Drive read succeeds", async () => {
  const loadDrive = html.match(/function loadDrive\(\) \{[\s\S]*?\n\}/)?.[0];
  const checkLogin = html.match(/function checkDriveLogin\(\) \{[\s\S]*?\n\}/)?.[0];
  const normalize = html.match(/function normalizeDriveData\(value\) \{[\s\S]*?\n\}/)?.[0];
  const externalURL = html.match(/function safeExternalURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  const savedURL = html.match(/function safeSavedURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(loadDrive && checkLogin && normalize && externalURL && savedURL);
  const messages = [];
  const local = new Map();
  const context = {
    driveUser: "", driveData: { favorites: [], videos: [], songs: [], articles: [] }, pendingDriveLogin: false,
    location: { search: "?login=ok&user=member%40example.test" },
    URLSearchParams,
    history: { replaceState() {} },
    localStorage: { getItem: (key) => local.get(key), setItem: (key, value) => local.set(key, value), removeItem: (key) => local.delete(key) },
    fetch: async () => ({ ok: true, json: async () => ({ data: { favorites: ["BTS"], videos: [], songs: [], articles: [] } }) }),
    openDrive() { context.loadDrive(); },
    toast: (message) => messages.push(message),
    renderDrive() {},
    $: () => ({})
  };
  vm.runInNewContext([externalURL, savedURL, normalize, loadDrive, checkLogin, "checkDriveLogin();"].join("\n"), context);
  assert.equal(context.pendingDriveLogin, true);
  assert.deepEqual(messages, [], "callback query alone must not claim authentication succeeded");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(messages, ["Google 로그인과 저장소 연결을 확인했어요"]);
  assert.equal(context.pendingDriveLogin, false);
});

test("saved-item links reject executable and untrusted URLs", () => {
  const source = html.match(/function safeExternalURL\(value\) \{[\s\S]*?\n\}/)?.[0] + "\n" +
    html.match(/function safeSavedURL\(value\) \{[\s\S]*?\n\}/)?.[0] + "\nresult = safeSavedURL;";
  assert.ok(source, "missing saved URL validator");
  const context = { URL };
  vm.runInNewContext(source, context);
  const safeSavedURL = context.result;
  assert.equal(safeSavedURL("https://music.youtube.com/search?q=artist"), "https://music.youtube.com/search?q=artist");
  assert.equal(safeSavedURL("https://blog.naver.com/user/post"), "https://blog.naver.com/user/post");
  assert.equal(safeSavedURL("https://openapi.naver.com/l?token=abc"), "https://openapi.naver.com/l?token=abc");
  assert.equal(safeSavedURL("https://openapi.naver.com/unknown"), "");
  for (const url of ["javascript:alert(1)", "http://blog.naver.com/user", "https://youtube.com.evil.test/watch", "https://user@youtube.com/watch", "https://youtube.com:444/watch"]) {
    assert.equal(safeSavedURL(url), "", "unsafe URL accepted: " + url);
  }
});

test("Drive payloads are normalized before rendering or caching", () => {
  const normalizer = html.match(/function normalizeDriveData\(value\) \{[\s\S]*?\n\}/)?.[0];
  const externalURL = html.match(/function safeExternalURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  const savedURL = html.match(/function safeSavedURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(normalizer && externalURL && savedURL);
  const context = { URL, Number };
  const result = vm.runInNewContext([externalURL, savedURL, normalizer, "normalizeDriveData(input);"].join("\n"), {
    ...context,
    input: {
      favorites: ["BTS", { name: "injected" }, "x".repeat(81)],
      videos: [null, { t: "  Good video  ", url: "https://youtube.com/watch?v=abc", at: 123 }, { t: "Bad URL", url: "javascript:alert(1)" }],
      songs: "not-an-array",
      articles: [{ t: "x".repeat(400), url: "https://blog.naver.com/fan/post", at: "not-a-date" }]
    }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    favorites: ["BTS"],
    videos: [{ t: "Good video", url: "https://youtube.com/watch?v=abc", at: 123 }, { t: "Bad URL", url: "", at: 0 }],
    songs: [],
    articles: [{ t: "x".repeat(300), url: "https://blog.naver.com/fan/post", at: 0 }]
  });
});

test("Drive save status is account-scoped and rejects unsuccessful HTTP responses", async () => {
  const save = html.match(/function saveDrive\(extra\) \{[\s\S]*?\n\}/)?.[0];
  const normalize = html.match(/function normalizeDriveData\(value\) \{[\s\S]*?\n\}/)?.[0];
  const externalURL = html.match(/function safeExternalURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  const savedURL = html.match(/function safeSavedURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(save && normalize && externalURL && savedURL);
  const sent = [];
  const messages = [];
  let resolveRequest;
  const context = {
    driveUser: "first@example.test",
    driveData: { favorites: ["BTS"], videos: [{ t: "test", url: "javascript:bad()" }], songs: [], articles: [] },
    toast: (message) => messages.push(message),
    fetch: (url, options) => { sent.push({ url, options }); return new Promise((resolve) => { resolveRequest = resolve; }); },
    URL, Number
  };
  vm.runInNewContext([externalURL, savedURL, normalize, save, "saveDrive();"].join("\n"), context);
  assert.equal(JSON.parse(sent[0].options.body).user, "first@example.test");
  assert.equal(JSON.parse(sent[0].options.body).data.videos[0].url, "");
  context.driveUser = "second@example.test";
  resolveRequest({ ok: true, json: async () => ({ ok: true }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(messages, [], "a prior account's late response must not change current-account status");

  const failedMessages = [];
  const failureContext = {
    driveUser: "member@example.test", driveData: { favorites: [], videos: [], songs: [], articles: [] },
    toast: (message) => failedMessages.push(message), fetch: async () => ({ ok: false, json: async () => ({ ok: true }) }), URL, Number
  };
  vm.runInNewContext([externalURL, savedURL, normalize, save, "saveDrive();"].join("\n"), failureContext);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(failedMessages, ["저장 실패 — 다시 시도해주세요"]);
});

test("untrusted article links require a credential-free HTTPS URL", () => {
  const source = html.match(/function safeExternalURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, "missing external URL validator");
  const safeExternalURL = vm.runInNewContext("(" + source + ")", { URL });
  assert.equal(safeExternalURL("https://news.example.test/story/1"), "https://news.example.test/story/1");
  for (const url of ["javascript:alert(1)", "http://news.example.test/1", "https://user:pass@news.example.test/1", "https://news.example.test:444/1"]) {
    assert.equal(safeExternalURL(url), "", "unsafe external URL accepted: " + url);
  }
});

test("blog UI only links to Naver blog destinations", async () => {
  const external = html.match(/function safeExternalURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  const naver = html.match(/function safeNaverBlogURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  const esc = html.match(/function esc\(s\) \{[\s\S]*?\n\}/)?.[0];
  const load = html.match(/function loadSingerBlogs\(name\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(external && naver && esc && load);
  const body = { innerHTML: "" };
  const context = {
    URL,
    openSinger: "BTS",
    $: () => body,
    fetch: async () => ({ json: async () => ({ ok: true, items: [
      { title: "Naver 글", link: "https://blog.naver.com/fan/1", bloggername: "팬", postdate: "20261008", description: "후기" },
      { title: "피싱", link: "https://attacker.example/post", bloggername: "공격자", postdate: "20261008", description: "클릭 유도" }
    ] }) })
  };
  vm.runInNewContext([external, naver, esc, load, "loadSingerBlogs('BTS');"].join("\n"), context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(body.innerHTML, /href="https:\/\/blog\.naver\.com\/fan\/1"/);
  assert.doesNotMatch(body.innerHTML, /href="https:\/\/attacker\.example/);
  assert.match(body.innerHTML, /안전한 링크를 확인할 수 없어요/);
});

test("privacy notice uses correct Korean brand particles", async () => {
  const privacy = await readFile(new URL("../public/privacy.html", import.meta.url), "utf8");
  const terms = await readFile(new URL("../public/terms.html", import.meta.url), "utf8");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.equal((privacy.match(/<main\b/g) || []).length, 1);
  assert.equal((terms.match(/<main\b/g) || []).length, 1);
  assert.doesNotMatch(privacy, /최애광장는/);
  assert.match(privacy, /최애광장은/);
  assert.match(privacy, /실제 운영 설정을 확인한 뒤 확정해야 합니다/);
  assert.doesNotMatch(privacy, /최대 1년간 보관/);
  assert.match(privacy, /https:\/\/pomyjo\.com\/privacy/);
  assert.doesNotMatch(readme, /공통 개인정보처리방침은 개인 식별 정보를 수집하지 않는다고 안내/);
  assert.match(readme, /저장 동기화·댓글 API/);
});

test("local Cloudflare cache and secret files are ignored", async () => {
  const ignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  const example = await readFile(new URL("../.dev.vars.example", import.meta.url), "utf8");
  assert.match(ignore, /^\.wrangler\/$/m);
  assert.match(ignore, /^\.dev\.vars\*$/m);
  assert.match(ignore, /^!\.dev\.vars\.example$/m);
  assert.match(ignore, /^\.env\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
  for (const key of ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET", "YOUTUBE_API_KEY"]) assert.match(example, new RegExp("^" + key + "=replace-with-", "m"));
});
