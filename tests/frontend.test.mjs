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

test("saved-item links reject executable and untrusted URLs", () => {
  const source = html.match(/function safeSavedURL\(value\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, "missing saved URL validator");
  const safeSavedURL = vm.runInNewContext("(" + source + ")", { URL });
  assert.equal(safeSavedURL("https://music.youtube.com/search?q=artist"), "https://music.youtube.com/search?q=artist");
  assert.equal(safeSavedURL("https://blog.naver.com/user/post"), "https://blog.naver.com/user/post");
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
