import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("homepage preserves the existing AdSense installation and noindex policy", () => {
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  const adScript = html.match(/<script async src="([^"]+)" crossorigin="anonymous"><\/script>/);
  assert.ok(adScript, "keep the existing async AdSense script");
  const adUrl = new URL(adScript[1]);
  assert.equal(adUrl.hostname, "pagead2.googlesyndication.com");
  assert.match(adUrl.searchParams.get("client") || "", /^ca-pub-\d+$/);
});

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

test("Naver API results stay on a no-ad, noindex results page and are not saved", async () => {
  const page = await readFile(new URL("../public/blogs.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../public/blog-results.js", import.meta.url), "utf8");
  assert.match(html, /\/blogs\.html\?name=/);
  assert.doesNotMatch(html, /loadSingerBlogs|\/api\/blog\?/);
  assert.match(page, /name="robots" content="noindex, nofollow"/);
  assert.match(page, /developers\.naver\.com/);
  assert.doesNotMatch(page, /adsbygoogle|googlesyndication/);
  assert.match(script, /cache: 'no-store'/);
  assert.match(script, /noopener noreferrer/);
  assert.doesNotMatch(script, /localStorage|save-article|st_drive_data/);
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

test("popular singer UI validates API names and shows useful shortcuts when rankings are unavailable", async () => {
  const fn = html.match(/function loadPopular\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  const el = { innerHTML: "" };
  const context = {
    $: () => el,
    window: {}, state: {experience:'idol'},
    artistGenreKey: a => a.cat === '트로트' ? 'trot' : 'idol',
    ARTISTS: [{ name: "BTS", cat:'아이돌' }, { name: "임영웅", cat:'트로트' }],
    esc: (value) => String(value).replace(/[&<>"']/g, ""),
    fetch: async () => ({ ok:true,json: async () => ({ popular: [
      { singer: "BTS" }, { singer: "BTS" }, { singer: "임영웅" }, { singer: "<img src=x onerror=alert(1)>" }
    ] }) })
  };
  vm.runInNewContext(fn + "\nloadPopular();", context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(el.innerHTML, /BTS/);
  assert.equal((el.innerHTML.match(/BTS/g) || []).length, 2, "only one result button should be rendered");
  assert.doesNotMatch(el.innerHTML, /<img|onerror=/);
  assert.doesNotMatch(el.innerHTML, /임영웅|[1-9]위/);
  context.state.experience='classic';
  context.fetch=()=>{throw new Error('view changes must not refetch');};
  context.window.renderPopularForView();
  assert.match(el.innerHTML,/data-name="임영웅"/);
  assert.doesNotMatch(el.innerHTML,/BTS/);

  context.state.experience='idol';
  context.fetch = async () => { throw new Error("API unavailable"); };
  vm.runInNewContext(fn + "\nloadPopular();", context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(el.innerHTML, /인기 조회 데이터를 불러오지 못했어요/);
  assert.match(el.innerHTML, /data-name="BTS"/);
  assert.doesNotMatch(el.innerHTML,/임영웅/);
  assert.match(el.innerHTML,/순위가 아닙니다/);
  for(const response of [{ok:false,json:async()=>({popular:[{singer:'BTS'}]})},{ok:true,json:async()=>({error:'failed'})}]){
    context.fetch=async()=>response;
    vm.runInNewContext(fn + "\nloadPopular();", context);
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(el.innerHTML,/인기 조회 데이터를 불러오지 못했어요/,'HTTP/schema errors must not be treated as successful popularity data');
  }
});

test("Korean artist categories drive the English genre filters and correct card labels", () => {
  const functions = ["artistGenreKey", "artistCategoryLabel", "visibleArtists", "cardHTML"]
    .map((name) => html.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"))?.[0]);
  assert.ok(functions.every(Boolean));
  const context = {
    ARTISTS: [{ name: "임영웅", cat: "트로트" }, { name: "BTS", cat: "아이돌" }],
    state: { genre: "trot" }, playerVideos: {}, driveData: {favorites: []},
    esc: (value) => String(value).replace(/[&<>"']/g, "")
  };
  vm.runInNewContext(functions.join("\n"), context);
  assert.deepEqual(Array.from(vm.runInNewContext("visibleArtists().map((a) => a.name)", context)), ["임영웅"]);
  assert.match(vm.runInNewContext("cardHTML(ARTISTS[0])", context), /트로트 가수/);
  context.state.genre = "idol";
  assert.deepEqual(Array.from(vm.runInNewContext("visibleArtists().map((a) => a.name)", context)), ["BTS"]);
  assert.match(vm.runInNewContext("cardHTML(ARTISTS[1])", context), /가수·그룹/);
});

test("HTML fallbacks from missing API routes show useful external search links", async () => {
  for (const [functionName, targetId, fallbackText, expectedHost] of [
    ["loadPopularVideos", "popularVideoList", "인기 영상을 불러오지 못했어요", "youtube.com"]
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

test("popular-video errors distinguish missing credentials from temporary failure", async () => {
  const fn = html.match(/function loadPopularVideos\(name\) \{[\s\S]*?\n\}/)?.[0];
  for (const [error, message] of [['YOUTUBE_API_NOT_CONFIGURED', /API 키 설정 후/], ['YOUTUBE_API_UNAVAILABLE', /일시적으로/], ['VIDEO_FEED_UNAVAILABLE', /일시적으로/]]) {
    const element = { innerHTML: '' };
    const context = { openSinger: '임영웅', $: () => element, encodeURIComponent,
      ytSearch: () => 'https://www.youtube.com/results?search_query=artist',
      fetch: async () => ({ headers: { get: () => 'application/json' }, json: async () => ({ ok: false, error }) }) };
    vm.runInNewContext(fn + "\nloadPopularVideos('임영웅');", context);
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(element.innerHTML, message);
    assert.match(element.innerHTML, /data-act="retry-popular-videos"/);
    if (error !== 'YOUTUBE_API_NOT_CONFIGURED') assert.doesNotMatch(element.innerHTML, /API 키 설정 후/);
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
    playerVideos: { BTS: [{ videoId: "aaaaaaaaaaa" }] }, ytCommentRequest: 0,
    document: { querySelector: () => null },
    fetch: async () => ({ ok: true, json: async () => ({ comments: [
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

test("rank API counts are numeric and limited to known artists without inventing zero totals", () => {
  const normalizeRank = html.match(/function normalizeRank\(data\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(normalizeRank);
  const context = {artist:name=>['BTS','IU'].includes(name)};
  vm.runInNewContext(normalizeRank,context);
  const rows=context.normalizeRank({rank:[{singer:'BTS',c:'<img src=x onerror=alert(1)>'},{singer:'IU',c:1234},{singer:'__proto__',c:999999}]});
  assert.deepEqual(Array.from(rows,row=>[row.name,row.count]),[['IU',1234]]);
});

test("late artist-detail API responses cannot overwrite the newly selected singer", async () => {
  const cases = [
    ["loadPopularVideos", { ok: false }],
    ["loadSingerSNS", { sns: [] }],
    ["loadYTComments", { comments: [] }],
    ["loadComments", { comments: [] }]
  ];
  for (const [name, data] of cases) {
    const fn = html.match(new RegExp("function " + name + "\\(\\w+\\) \\{[\\s\\S]*?\\n\\}"))?.[0];
    assert.ok(fn, name + " should exist");
    let resolveFetch;
    const element = { innerHTML: "IU current content",setAttribute(){} };
    const context = {
      API: "https://api.pomyjo.com/api/singer",
      openSinger: "BTS",
      ARTISTS: [{name:"BTS"}],singerSNSRequest:0,singerSNSCache:Object.create(null),URL,AbortController,setTimeout,clearTimeout,
      state: { rankPeriod: "week" },
      playerVideos: { BTS: [{ videoId: "aaaaaaaaaaa" }] }, ytCommentRequest: 0,
      document: { querySelector: () => null },
      fetch: () => new Promise((resolve) => { resolveFetch = resolve; }),
      $: () => element,
      esc: (value) => String(value),
      fmtDate: () => "",
      encodeURIComponent,
      ytSearch: () => "https://www.youtube.com/",
      safeNaverBlogURL: () => null
    };
    const dependencies=name==='loadSingerSNS'?['renderSingerSNS','readNewsResponse','normalizeNewsRows','mergeNewsRows','newsStatusKey','newsStatusFallback','safeExternalURL'].map(helper=>html.match(new RegExp('function '+helper+'\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'))[0]).join('\n'):'';
    vm.runInNewContext(dependencies+'\n'+fn + "\n" + name + "('BTS');", context);
    await new Promise(resolve=>setImmediate(resolve));
    context.openSinger = "IU";
    // Selecting the next artist replaces its content before the old request resolves.
    element.innerHTML = "IU current content";
    resolveFetch({ ok: true, headers: { get: () => "application/json" }, json: async () => data });
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
  const icon = await readFile(new URL("../public/choeae-icon-v1.svg", import.meta.url), "utf8");
  assert.doesNotMatch(icon, /\p{Extended_Pictographic}/u);
  assert.match(icon, /<title id="title">최애광장<\/title>/);
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

test('server logout preserves local state on failure, clears it only on confirmation, and ignores stale account responses', async () => {
  const source = html.match(/function logoutDrive\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(source);
  let resolveFetch;
  let calls = 0;
  const removed = [];
  const messages = [];
  const button = { disabled: false, setAttribute() {}, removeAttribute() {} };
  const context = { driveUser: 'member@example.test', pendingDriveLogin: true, driveLogoutPending: false,
    driveData: { favorites: ['BTS'], videos: [], songs: [], articles: [] },
    fetch: (url, options) => { calls++; assert.equal(url, 'https://api.pomyjo.com/auth/logout'); assert.equal(options.credentials, 'include'); return new Promise(resolve => { resolveFetch = resolve; }); },
    document: { querySelector: () => button }, localStorage: { removeItem: key => removed.push(key) },
    renderSingers() {}, openDrive() {}, toast: message => messages.push(message) };
  vm.runInNewContext(source, context);
  context.logoutDrive(); context.logoutDrive();
  assert.equal(calls, 1);
  assert.equal(button.disabled, true);
  resolveFetch({ ok: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.driveUser, 'member@example.test');
  assert.equal(context.driveData.favorites[0], 'BTS');
  assert.deepEqual(removed, []);
  assert.match(messages[0], /서버 로그아웃을 확인하지 못/);
  assert.equal(button.disabled, false);
  context.logoutDrive();
  context.driveUser = 'other@example.test';
  resolveFetch({ ok: true, json: async () => ({ ok: true }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.driveUser, 'other@example.test');
  assert.deepEqual(removed, []);
  context.logoutDrive();
  resolveFetch({ ok: true, json: async () => ({ ok: true }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.driveUser, '');
  assert.equal(context.driveData.favorites.length, 0);
  assert.equal(context.pendingDriveLogin, false);
  assert.deepEqual(removed, ['st_drive_user', 'st_drive_data']);
});

test('Google login returns only to production or the registered stable Preview alias', () => {
  const source = html.match(/function googleReturnPath\(\) \{[\s\S]*?\n\}/)?.[0] + '\n' + html.match(/function googleLogin\(\) \{[\s\S]*?\n\}/)?.[0];
  for (const [hostname, expected] of [['choeae-plaza.pomyjo.com', 'https://choeae-plaza.pomyjo.com'], ['new.choeae-plaza.pages.dev', 'https://codex-finish-choeae-plaza.choeae-plaza.pages.dev']]) {
    const context = { URLSearchParams,ARTISTS:[],state:{},location: { hostname, origin: 'https://' + hostname, href: '' }, driveUser: '', driveData: { favorites: [], videos: [], songs: [], articles: [] } };
    context.window = { location: context.location };
    vm.runInNewContext(source + '\ngoogleLogin();', context);
    const url = new URL(context.location.href);
    assert.equal(url.origin, 'https://api.pomyjo.com');
    assert.equal(url.searchParams.get('returnTo'), expected);
    assert.equal(url.searchParams.get('returnPath'), '/');
  }
});

test("Drive load failures preserve this device's saved items and explain retry or re-login", async () => {
  const loadDrive = html.match(/function loadDrive\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(loadDrive);
  let rendered = 0;
  const body = { insertAdjacentHTML(_position, html) { this.notice = html; } };
  const sandbox = {
    driveUser: "member@example.test",
    pendingDriveLogin: false,
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
  const returnPath = html.match(/function googleReturnPath\(\) \{[\s\S]*?\n\}/)?.[0];
  const normalize = html.match(/function normalizeDriveData\(value\) \{[\s\S]*?\n\}/)?.[0];
  const externalURL = html.match(/function safeExternalURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  const savedURL = html.match(/function safeSavedURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(loadDrive && checkLogin && normalize && externalURL && savedURL);
  const messages = [];
  const local = new Map();
  const context = {
    driveUser: "", driveData: { favorites: [], videos: [], songs: [], articles: [] }, pendingDriveLogin: false,
    location: { search: "?login=ok&user=member%40example.test" },
    URLSearchParams,ARTISTS:[],state:{},
    history: { replaceState() {} },
    localStorage: { getItem: (key) => local.get(key), setItem: (key, value) => local.set(key, value), removeItem: (key) => local.delete(key) },
    fetch: async () => ({ ok: true, json: async () => ({ data: { favorites: ["BTS"], videos: [], songs: [], articles: [] } }) }),
    openDrive() { context.loadDrive(); },
    toast: (message) => messages.push(message),
    renderDrive() {},
    readDeviceImport() { return null; }, readPendingDrive() { return null; }, renderDeviceImport() {}, renderPendingDrive() {},
    $: () => ({})
  };
  vm.runInNewContext([externalURL, savedURL, normalize, loadDrive, returnPath, checkLogin, "checkDriveLogin();"].join("\n"), context);
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
    driveReadUser: "first@example.test", driveSaveJob: null, localStorage: {setItem() {}}, readDeviceImport() { return null; }, readPendingDrive() { return null; }, renderDrive() {}, renderDeviceImport() {}, renderPendingDrive() {},
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
    driveReadUser: "member@example.test", driveSaveJob: null, localStorage: {setItem() {}}, readDeviceImport() { return null; }, readPendingDrive() { return null; }, renderDrive() {}, renderDeviceImport() {}, renderPendingDrive() {},
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

test("standalone Naver results render text safely and reject untrusted links", async () => {
  const script = await readFile(new URL("../public/blog-results.js", import.meta.url), "utf8");
  assert.match(script, /document\.createElement\('span'\)/);
  assert.match(script, /appendNaverField\(title, item\.title\)/);
  assert.match(script, /createTextNode\(text\)/);
  assert.match(script, /blog\.naver\.com/);
  assert.match(script, /openapi\.naver\.com/);
  assert.match(script, /noopener noreferrer/);
  assert.doesNotMatch(script, /innerHTML|save-article|localStorage/);
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
    assert.match(privacy, /최근 50개 표시가 이전 댓글의 삭제를 뜻하지 않으며/);
    assert.match(privacy, /정확히 30일 후 삭제를 보장하지 않으며/);
    assert.match(privacy, /댓글 1년·최애광장 이용 통계 30일/);
    assert.match(privacy, /삭제 요청은 운영자가 대상과 요청 권한을 확인한 뒤 처리/);
    assert.match(privacy, /정기 정리 작업은 아직 설치·활성화하지 않았으므로/);
    assert.match(privacy, /기존 데이터 삭제는 별도 승인 전에는 실행하지 않습니다/);
    assert.match(privacy, /백업의 최종 보유·파기 기준/);
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
  for (const key of ["NAVER_API_HUB_CLIENT_ID", "NAVER_API_HUB_CLIENT_SECRET", "YOUTUBE_API_KEY"]) assert.match(example, new RegExp("^" + key + "=replace-with-", "m"));
  assert.match(example, /^# NAVER_CLIENT_ID=replace-with-/m, "legacy key is documented as optional only");
});


test("news saves retain publisher HTTPS links through normalization and rendering", () => {
  const names = ["safeExternalURL", "safeSavedURL", "normalizeDriveData", "savedItemRow", "newsItemHTML"];
  const functions = names.map(name => html.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"))?.[0]);
  assert.ok(functions.every(Boolean));
  const context = { URL, Number, esc: value => String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])) };
  vm.runInNewContext(functions.join("\n"), context);
  const url = "https://news.example.test/story/1?x=1&y=2";
  assert.match(context.newsItemHTML({ title: "공연 소식", link: url }, "출처", "news", 0), /data-url="https:\/\/news\.example\.test\/story\/1\?x=1&amp;y=2"/);
  const normalized = context.normalizeDriveData({ articles: [{ t: "공연 소식", url, at: 1 }], videos: [{ t: "not a video", url }] });
  assert.equal(normalized.articles[0].url, url);
  assert.equal(normalized.videos[0].url, "", "video/song links keep their host allowlist");
  assert.match(context.savedItemRow(normalized.articles[0], "articles"), /href="https:\/\/news\.example\.test/);
  for (const bad of ["javascript:alert(1)", "http://news.example.test/1", "https://user:pass@news.example.test/1"]) {
    assert.match(context.newsItemHTML({ title: "bad", link: bad }, "", "news", 0), /data-url="" disabled/);
    assert.equal(context.normalizeDriveData({ articles: [{ t: "bad", url: bad }] }).articles[0].url, "");
  }
});
