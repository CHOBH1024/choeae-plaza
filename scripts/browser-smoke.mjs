import assert from "node:assert/strict";
import { chromium } from "playwright";
import { resolve } from "node:path";

const base = process.argv[2] || "http://127.0.0.1:8788";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.route("https://api.pomyjo.com/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  let body = {};
  if (path.endsWith("/feed")) body = { artists: { "임영웅": [{ title: "사랑은 늘 도망가 - 라이브", videoId: "AbCdEf12345", published: "2026-10-05", kind: "live" }] } };
  else if (path.endsWith("/popular")) body = { popular: [] };
  else if (path.endsWith("/sns")) body = { sns: [{ title: "임영웅 최신 소식", link: "https://news.example.test/1" }] };
  else if (path.endsWith("/comments") || path.endsWith("/yt-comments")) body = { comments: [] };
  else if (path.endsWith("/news") || path.endsWith("/naver")) body = { items: [] };
  else body = { ok: true };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
});
await page.route("**/api/blog?*", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ ok: true, items: [{ title: "임영웅 <b>콘서트</b> 후기 <img src=x onerror=alert(1)>", description: "팬이 작성한 공연 후기", link: "https://blog.naver.com/fan/1", bloggername: "영웅시대", postdate: "20261008" }] })
}));
await page.route("**/api/popular-videos?*", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ ok: true, scope: "recent-feed", items: [{ videoId: "AbCdEf12345", title: "사랑은 늘 도망가 - 라이브", viewCount: 12000, channelTitle: "임영웅" }] })
}));
await context.route("https://music.youtube.com/search**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Music mock</title>" }));
await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({
  status: 200,
  contentType: "application/javascript",
  body: "window.YT={PlayerState:{ENDED:0},Player:function(id,c){this.loadVideoById=v=>window.__lastVideo=v;this.playVideo=()=>{};this.pauseVideo=()=>{};this.getPlayerState=()=>0;setTimeout(()=>c.events.onReady({target:this}),0)}};const t=setInterval(()=>{if(window.onYouTubeIframeAPIReady&&window.YT){clearInterval(t);window.onYouTubeIframeAPIReady()}},0);"
}));
for (const url of ["https://pagead2.googlesyndication.com/**", "https://fonts.googleapis.com/**", "https://fonts.gstatic.com/**", "https://i.ytimg.com/**"]) {
  await page.route(url, (route) => route.abort());
}

async function audit(root = null) {
  const violations = await page.evaluate(async (selector) => {
    const result = await window.axe.run(selector ? document.querySelector(selector) : document);
    return result.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) }));
  }, root);
  assert.deepEqual(violations, [], `Accessibility violations at ${root || "home"}: ${JSON.stringify(violations)}`);
}

try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
  await page.locator("#popularList").getByText(/실시간 인기 데이터를 불러오지 못했어요/).waitFor();
  await page.locator('#popularList [data-act="open-singer"][data-name="임영웅"]').waitFor();
  await page.locator('[data-act="genre"][data-genre="trot"]').click();
  const trotLabels = await page.locator("#singerGrid .cat").allTextContents();
  assert.ok(trotLabels.length > 0 && trotLabels.every((label) => label === "트로트 가수"), `Trot filter/category mismatch: ${trotLabels.join(", ")}`);
  await page.locator('[data-act="genre"][data-genre="idol"]').click();
  const idolLabels = await page.locator("#singerGrid .cat").allTextContents();
  assert.ok(idolLabels.length > 0 && idolLabels.every((label) => label === "아이돌 그룹"), `Idol filter/category mismatch: ${idolLabels.join(", ")}`);
  await page.locator('[data-act="genre"][data-genre="all"]').click();
  await audit();
  await page.locator("#themeBtn").click();
  await page.waitForTimeout(500);
  await audit();
  await page.locator("#themeBtn").click();
  await page.waitForTimeout(500);

  await page.locator('[data-act="open-singer"][data-name="임영웅"]').first().click();
  await page.locator("#mdBlogs a").first().waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  await audit("#singerModal");

  const focusTrap = await page.evaluate(() => {
    const dialog = document.querySelector("#singerModal");
    const controls = [...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
    controls.at(-1).focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    const tabWrap = document.activeElement === controls[0];
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    return { tabWrap, shiftTabWrap: document.activeElement === controls.at(-1) };
  });
  assert.deepEqual(focusTrap, { tabWrap: true, shiftTabWrap: true });

  await page.evaluate(() => document.querySelector("#themeBtn").click());
  await page.waitForTimeout(500);
  await audit("#singerModal");
  await page.evaluate(() => document.querySelector("#themeBtn").click());
  await page.waitForTimeout(500);

  assert.equal(await page.locator("#detail-videos").innerText(), "YouTube 영상");
  assert.match(await page.locator("#mdBlogs a").first().innerText(), /네이버 검색결과 보기/);
  assert.match(await page.locator("#popularVideoList").innerText(), /12,000회/);

  await page.locator("#mdBlogs a").click();
  await page.waitForURL(/\/blogs(?:\.html)?\?name=/);
  await page.locator(".result a").first().waitFor({ state: "visible" });
  assert.match(await page.locator(".result a").first().innerText(), /^임영웅 콘서트 후기/);
  assert.equal(await page.locator("#results img, #results script").count(), 0);
  assert.equal(await page.locator(".result .title b").innerText(), "콘서트");
  assert.equal(await page.locator('script[src*="adsbygoogle"],script[src*="googlesyndication"]').count(), 0);
  assert.equal(await page.locator('[data-act="save-article"]').count(), 0);
  await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
  await audit();
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    const metrics = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, back: document.querySelector('.back').getBoundingClientRect().toJSON() }));
    assert.equal(metrics.scroll, width, `Naver results page overflows: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.back.width >= 44 && metrics.back.height >= 44, `Small back target: ${JSON.stringify(metrics)}`);
  }
  await page.goBack();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator('[data-act="open-singer"][data-name="임영웅"]').first().click();

  const popupPromise = page.waitForEvent("popup");
  await page.locator("#singerBox .song").first().click();
  const popup = await popupPromise;
  await popup.waitForURL(/music\.youtube\.com\/search\?q=/, { timeout: 5000 });
  await popup.close();
  await page.locator('[data-act="save-video"]').first().click();
  await page.locator('[data-act="close-singer"]').click();
  await page.locator('[data-act="drive"]').click();
  assert.match(await page.locator("#driveBody").innerText(), /이 기기의 저장소/);
  assert.match(await page.locator("#driveBody").innerText(), /사랑은 늘 도망가/);
  assert.equal(await page.locator('#driveBody [data-act="drive-save-all"]').count(), 0);
  await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
  await audit("#driveModal");
  await page.locator('[data-act="close-drive"]').click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-act="drive"]').click();
  const savedVideo = page.locator('#driveBody a[href="https://www.youtube.com/watch?v=AbCdEf12345"]');
  await savedVideo.waitFor({ state: "visible" });
  assert.match(await savedVideo.innerText(), /사랑은 늘 도망가/);
  assert.equal(await savedVideo.getAttribute("target"), "_blank");
  await page.locator('[data-act="close-drive"]').click();
  await page.locator('[data-act="open-singer"][data-name="임영웅"]').first().click();
  await page.locator('[data-act="play-video"]').first().click();
  await page.locator("#playerBar:not([hidden])").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => window.__lastVideo), "AbCdEf12345");
  await page.locator('[data-act="detail-jump"][data-target="detail-blogs"]').click();
  assert.ok(await page.locator("#detail-blogs").isVisible());

  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth,
      scroll: document.documentElement.scrollWidth,
      fontButtons: [...document.querySelectorAll('.fontsize button[data-level]')].map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      })
    }));
    assert.equal(metrics.scroll, width, `Horizontal overflow: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.fontButtons.every(({ width: buttonWidth, height }) => buttonWidth >= 44 && height >= 44), `Small touch target: ${JSON.stringify(metrics)}`);
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1440);
  assert.deepEqual(pageErrors, [], `Browser errors: ${pageErrors.join("; ")}`);

  for (const route of ["/privacy", "/terms"]) {
    await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
    await audit();
  }
  console.log("Browser smoke passed: 320/375px and desktop, video/music/blog, keyboard trap, and light/dark accessibility audits.");
} finally {
  await browser.close();
}
