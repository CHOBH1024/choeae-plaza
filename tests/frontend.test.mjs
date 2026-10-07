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

test("static page IDs are unique and interface contains no decorative emoji", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "duplicate static ID");
  assert.doesNotMatch(html, /\p{Extended_Pictographic}/u);
});

test("Google Drive requests include the API session credentials", () => {
  assert.match(html, /api\/drive\/load\?user=' \+ encodeURIComponent\(driveUser\), \{ credentials: 'include' \}\)/);
  assert.match(html, /method: 'POST', credentials: 'include', headers: \{ 'Content-Type': 'application\/json' \}/);
});
