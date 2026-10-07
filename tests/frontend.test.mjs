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

test("saved-item links reject executable and untrusted URLs", () => {
  const source = html.match(/function safeSavedURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, "missing saved URL validator");
  const safeSavedURL = vm.runInNewContext("(" + source + ")", { URL });
  assert.equal(safeSavedURL("https://music.youtube.com/search?q=artist"), "https://music.youtube.com/search?q=artist");
  assert.equal(safeSavedURL("https://blog.naver.com/user/post"), "https://blog.naver.com/user/post");
  assert.equal(safeSavedURL("https://openapi.naver.com/l?token=abc"), "https://openapi.naver.com/l?token=abc");
  assert.equal(safeSavedURL("https://openapi.naver.com/unknown"), "");
  for (const url of ["javascript:alert(1)", "http://blog.naver.com/user", "https://youtube.com.evil.test/watch", "https://user@youtube.com/watch", "https://youtube.com:444/watch"]) {
    assert.equal(safeSavedURL(url), "", "unsafe URL accepted: " + url);
  }
});

test("privacy notice uses correct Korean brand particles", async () => {
  const privacy = await readFile(new URL("../public/privacy.html", import.meta.url), "utf8");
  assert.doesNotMatch(privacy, /최애광장는/);
  assert.match(privacy, /최애광장은/);
});

test("local Cloudflare cache and secret files are ignored", async () => {
  const ignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  assert.match(ignore, /^\.wrangler\/$/m);
  assert.match(ignore, /^\.dev\.vars\*$/m);
  assert.match(ignore, /^\.env\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
});
