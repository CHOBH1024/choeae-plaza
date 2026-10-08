import assert from "node:assert/strict";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { onRequestGet as renderSingerPage } from '../functions/singer/[name].js';
import { IDOL } from '../functions/_shared/artists.js';

const base = process.argv[2] || "http://127.0.0.1:8788";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
await page.route('**/api/locale',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({lang:'ko',reason:'country'})}));

await page.route("https://api.pomyjo.com/**", async (route) => {
  const path = new URL(route.request().url()).pathname;
  let body = {};
  if (path.endsWith("/feed")) body = { artists: { "임영웅": [{ title: "사랑은 늘 도망가 - 라이브", videoId: "AbCdEf12345", published: "2026-10-05", kind: "live" }] } };
  else if (path.endsWith("/popular")) body = { popular: [] };
  else if (path.endsWith("/sns")) body = { sns: [{ title: "임영웅 최신 소식", link: "https://news.example.test/1" }] };
  else if (path.endsWith("/comments") || path.endsWith("/yt-comments")) body = { comments: [] };
  else if (path.endsWith("/news")) body = { news: [{ title: "임영웅 공연 소식", link: "https://news.example.test/story/1", date: "2026-10-08", singer: "임영웅" }] };
  else if (path.endsWith("/naver")) body = { news: [] };
  else body = { ok: true };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
});
const blogSortRequests = [];
await page.route("**/api/blog?*", (route) => {
  blogSortRequests.push(new URL(route.request().url()).searchParams.get('sort'));
  return route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ ok: true, items: [
    { title: "임영웅 <b>콘서트</b> 후기 <img src=x onerror=alert(1)>", description: "팬이 작성한 공연 후기", link: "https://blog.naver.com/fan/1", bloggername: "영웅시대", postdate: "20261008" },
    { title: "임영웅 공연 기록", link: "https://fan.tistory.com/42", bloggername: "팬 블로그", postdate: "20261007" },
    { title: "로컬 링크 차단", link: "https://127.0.0.1/private" }
  ] })
  });
});
await page.route("**/api/popular-videos?*", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ ok: true, scope: "recent-feed", items: [{ videoId: "AbCdEf12345", title: "사랑은 늘 도망가 - 라이브", viewCount: 12000, channelTitle: "임영웅" }] })
}));
await context.route("https://music.youtube.com/search**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Music mock</title>" }));
await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({
  status: 200,
  contentType: "application/javascript",
  body: "window.YT={PlayerState:{ENDED:0},Player:function(id,c){let state=-1;const emit=s=>{state=s;c.events.onStateChange({data:s})};window.__ytEvents=c.events;this.loadVideoById=v=>{window.__lastVideo=v;emit(1)};this.playVideo=()=>emit(1);this.pauseVideo=()=>emit(2);this.stopVideo=()=>{state=0};this.getPlayerState=()=>state;setTimeout(()=>c.events.onReady({target:this}),0)}};const t=setInterval(()=>{if(window.onYouTubeIframeAPIReady&&window.YT){clearInterval(t);window.onYouTubeIframeAPIReady()}},0);"
}));
for (const url of ["https://pagead2.googlesyndication.com/**", "https://fonts.googleapis.com/**", "https://fonts.gstatic.com/**", "https://i.ytimg.com/**"]) {
  await page.route(url, (route) => route.abort());
}

async function audit(root = null) {
  const violations = await page.evaluate(async (selector) => {
    const result = await window.axe.run(selector ? document.querySelector(selector) : document);
    return result.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target), details: nodes.map(node=>node.failureSummary) }));
  }, root);
  assert.deepEqual(violations, [], `Accessibility violations at ${root || "home"}: ${JSON.stringify(violations)}`);
}

try {
  await page.goto(new URL("/trot",base).href, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
  await page.locator("#popularList").getByText(/실시간 인기 데이터를 불러오지 못했어요/).waitFor();
  await page.locator('#popularList [data-act="open-singer"][data-name="임영웅"]').waitFor();
  await page.locator('[data-act="genre"][data-genre="trot"]').click();
  const trotLabels = await page.locator("#singerGrid .cat").allTextContents();
  assert.ok(trotLabels.length > 0 && trotLabels.every((label) => label === "트로트 가수"), `Trot filter/category mismatch: ${trotLabels.join(", ")}`);
  await page.locator('[data-act="genre"][data-genre="idol"]').click();
  const idolLabels = await page.locator("#singerGrid .cat").allTextContents();
  assert.ok(idolLabels.length > 0 && idolLabels.every((label) => label === "가수·그룹"), `Idol filter/category mismatch: ${idolLabels.join(", ")}`);
  assert.ok((await page.locator('#singerGrid .name').allTextContents()).every(name => IDOL.includes(name)), 'idol browse filter retains canonical membership');
  await page.locator('[data-act="genre"][data-genre="all"]').click();
  await audit();
  await page.locator("#themeBtn").click();
  await page.waitForTimeout(500);
  await audit();
  await page.locator("#themeBtn").click();
  await page.waitForTimeout(500);

  await page.locator('[data-act="open-singer"][data-name="임영웅"]').first().click();
  await page.getByText('처음 듣는다면 · 감상 길잡이', {exact:true}).click();
  assert.equal(await page.getByRole('link',{name:'비교 방법 3단계와 출처 읽기',exact:true}).getAttribute('href'),'/singer/' + encodeURIComponent('임영웅'));
  assert.match(await page.locator('#singerBox').innerText(),/편집 의견이며 인기 순위나 공식 추천이 아닙니다/);
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
  const instagramSearch = new URL(await page.getByRole('link', { name: '임영웅 Instagram 관련 계정 검색 (새 창)', exact: true }).getAttribute('href'));
  assert.equal(instagramSearch.hostname, 'www.google.com');
  assert.equal(instagramSearch.searchParams.get('q'), '임영웅 site:instagram.com');
  assert.match(await page.locator('#singerBox').innerText(), /검색결과가 공식 계정을 보장하지 않습니다/);

  await page.locator("#mdBlogs a").click();
  await page.waitForURL(/\/blogs(?:\.html)?\?name=/);
  await page.locator(".result a").first().waitFor({ state: "visible" });
  assert.match(await page.locator(".result a").first().innerText(), /^임영웅 콘서트 후기/);
  assert.equal(await page.locator("#results img, #results script").count(), 0);
  assert.equal(await page.getByLabel('검색 정렬', { exact: true }).inputValue(), 'date');
  assert.equal(blogSortRequests.at(-1), 'date');
  assert.equal(await page.locator('.result a').count(), 2);
  assert.equal(await page.locator('.result a').nth(1).getAttribute('href'), 'https://fan.tistory.com/42');
  assert.match(await page.locator('.result .meta').nth(1).innerText(), /fan\.tistory\.com/);
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
  await page.goto(new URL("/trot",base).href, { waitUntil: "domcontentloaded" });
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
  await page.evaluate(() => document.querySelector("#themeBtn").click());
  await page.waitForTimeout(500);
  await audit("#driveModal");
  await page.evaluate(() => document.querySelector("#themeBtn").click());
  await page.waitForTimeout(500);
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
  assert.equal(await page.locator('#pbStatus').innerText(), '재생 중');
  assert.equal(await page.evaluate(()=>ytPlayer.getPlayerState()),1);
  assert.equal(await page.locator('#singerModal').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'playerBar');
  await page.locator('[data-act="p-toggle"]').click();
  assert.equal(await page.locator('#pbStatus').innerText(),'일시정지됨');
  assert.equal(await page.evaluate(()=>ytPlayer.getPlayerState()),2);
  await page.evaluate(() => window.__ytEvents.onAutoplayBlocked());
  assert.match(await page.locator('#pbStatus').innerText(), /자동 재생이 차단/);
  assert.equal(await page.locator('[data-act="p-toggle"]').innerText(), '재생');
  await page.evaluate(() => window.__ytEvents.onError({data:150}));
  assert.match(await page.locator('#pbStatus').innerText(), /사이트 안에서 재생할 수 없/);
  await page.locator('[data-act="p-toggle"]').click();
  assert.equal(await page.locator('#pbStatus').innerText(), '재생 중');
  assert.equal(await page.evaluate(()=>ytPlayer.getPlayerState()),1);
  await page.locator('[data-act="open-singer"][data-name="임영웅"]').first().click();
  await page.locator('[data-act="detail-jump"][data-target="detail-blogs"]').click();
  assert.ok(await page.locator("#detail-blogs").isVisible());
  await page.locator('[data-act="close-singer"]').click();
  await page.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') });

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
    const playerSize = await page.locator('.pv').boundingBox();
    assert.ok(playerSize.width >= 200 && playerSize.height >= 200, 'Embedded player must retain minimum dimensions');
    await audit('#playerBar');
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1440);
  assert.deepEqual(pageErrors, [], `Browser errors: ${pageErrors.join("; ")}`);

  await page.locator('#tab-news').click();
  const articleSave = page.locator('#newsBody [data-act="save-article"]').first();
  await articleSave.waitFor({ state: 'visible' });
  assert.equal(await articleSave.getAttribute('data-url'), 'https://news.example.test/story/1');
  await articleSave.click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-act="drive"]').click();
  await page.locator('#driveBody a[href="https://news.example.test/story/1"]').waitFor({ state: 'visible' });
  await page.locator('[data-act="close-drive"]').click();

  await page.locator('#tab-singer').click();
  await page.locator('#myFavoritesBtn').click();
  assert.equal(await page.locator('#singerGrid .card').count(), 0);
  assert.match(await page.locator('#singerGrid').innerText(), /아직 저장한 최애/);
  await page.locator('#singerGrid [data-genre="all"]').click();
  await page.locator('#singerGrid [data-act="open-singer"][data-name="임영웅"]').click();
  const favoriteButton = page.locator('#singerBox .drive-fav');
  await favoriteButton.click();
  assert.equal(await favoriteButton.getAttribute('aria-pressed'), 'true');
  await page.locator('[data-act="close-singer"]').click();
  await page.locator('#myFavoritesBtn').click();
  assert.equal(await page.locator('#singerGrid .card').count(), 1);
  assert.equal(await page.locator('#singerGrid .name').innerText(), '임영웅');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#myFavoritesBtn').click();
  assert.equal(await page.locator('#singerGrid .name').innerText(), '임영웅');
  await page.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') });
  await audit();
  await page.locator('#singerGrid [data-act="open-singer"]').click();
  assert.equal(await favoriteButton.getAttribute('aria-pressed'), 'true');
  await favoriteButton.click();
  assert.equal(await favoriteButton.getAttribute('aria-pressed'), 'false');
  await page.locator('[data-act="close-singer"]').click();
  assert.equal(await page.locator('#singerGrid .card').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'myFavoritesBtn');

  let popularityAttempts = 0;
  await page.route('**/api/popular-videos?*', (route) => {
    popularityAttempts++;
    return route.fulfill({ status: popularityAttempts === 1 ? 502 : 200, contentType: 'application/json',
      body: JSON.stringify(popularityAttempts === 1 ? { ok: false, error: 'YOUTUBE_API_UNAVAILABLE' } : { ok: true, items: [{ videoId: 'AbCdEf12345', title: '복구된 영상', viewCount: 12000, channelTitle: '임영웅' }] }) });
  });
  await page.goto(base);
  await page.locator('[data-act="open-singer"][data-name="임영웅"]').first().click();
  await page.getByRole('button', { name: '조회수 다시 불러오기', exact: true }).waitFor({ state: 'visible' });
  assert.match(await page.locator('#popularVideoList').innerText(), /일시적으로/);
  await page.getByRole('button', { name: '조회수 다시 불러오기', exact: true }).click();
  await page.locator('#popularVideoList .nt').waitFor({ state: 'visible' });
  assert.equal(popularityAttempts, 2);
  assert.match(await page.locator('#popularVideoList').innerText(), /12,000회/);
  await page.goto(new URL('/blogs?name=' + encodeURIComponent('임영웅'), base).href);
  await page.locator('.result a').first().waitFor({ state: 'visible' });
  await page.getByLabel('검색 정렬', { exact: true }).selectOption('sim');
  await page.getByRole('button', { name: '적용', exact: true }).click();
  await page.waitForURL(/sort=sim/);
  await page.locator('.result a').first().waitFor({ state: 'visible' });
  assert.equal(blogSortRequests.at(-1), 'sim');
  assert.match(await page.locator('#search-order').innerText(), /정확도순/);
  await page.reload();
  await page.locator('.result a').first().waitFor({ state: 'visible' });
  assert.equal(await page.getByLabel('검색 정렬', { exact: true }).inputValue(), 'sim');
  await page.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') });
  await audit();
  // Fake account only: verify UI logout failure/retry without contacting real Google/Drive.
  let logoutAttempts = 0;
  await page.route('https://api.pomyjo.com/api/drive/load**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ migrationRequired: true, data: { favorites: ['BTS'], videos: [], songs: [], articles: [] } }) }));
  await page.route('https://api.pomyjo.com/auth/logout', route => {
    logoutAttempts++;
    return route.fulfill({ status: logoutAttempts === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(logoutAttempts === 1 ? { error: 'temporary' } : { ok: true }) });
  });
  await page.goto(base);
  await page.evaluate(() => { localStorage.setItem('st_drive_user', 'mock@example.test'); localStorage.setItem('st_drive_data', JSON.stringify({ favorites: ['BTS'], videos: [], songs: [], articles: [] })); });
  await page.reload();
  await page.locator('[data-act="drive"]').click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).waitFor({ state: 'visible' });
  await page.getByText('이전 저장 파일 복구 안내', {exact:true}).click();
  await page.getByText(/기존 파일은 삭제하지 않아요/).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByText(/서버 로그아웃을 확인하지 못했어요/).waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => localStorage.getItem('st_drive_user')), 'mock@example.test');
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByText(/이 기기의 저장소 · 저장된 항목이 0개/).waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => localStorage.getItem('st_drive_user')), null);
  assert.equal(logoutAttempts, 2);
  await page.addScriptTag({ path: resolve('node_modules/axe-core/axe.min.js') });
  await audit('#driveModal');
  // First-login guest recovery: fake callback/Drive only, never a Google session.
  let importAttempts = 0;
  await page.route('https://api.pomyjo.com/api/drive/save', route => {
    importAttempts++;
    return route.fulfill({status: importAttempts === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(importAttempts === 1 ? {error:'temporary'} : {ok:true})});
  });
  await page.goto(base);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('st_drive_data', JSON.stringify({favorites:['IU'],videos:[],songs:[],articles:[]})); });
  await page.goto(new URL('/?login=ok&user=mock%40example.test',base).href);
  await page.getByRole('button', {name:'기기 항목 가져오기',exact:true}).waitFor({state:'visible'});
  assert.match(await page.locator('#driveBody').innerText(), /저장된 항목이 1개/);
  assert.equal(importAttempts,0);
  await page.getByRole('button', {name:'기기 항목 가져오기',exact:true}).click();
  await page.getByText('저장 실패 — 다시 시도해주세요', {exact:true}).waitFor({state:'visible'});
  assert.match(await page.locator('#driveBody').innerText(), /저장된 항목이 2개/);
  await page.reload();
  await page.locator('[data-act="drive"]').click();
  await page.getByText('미저장 기기 변경을 보관 중이에요', {exact:true}).waitFor({state:'visible'});
  assert.match(await page.locator('#driveBody').innerText(), /저장된 항목이 2개/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name:'기기 백업 내려받기',exact:true}).click();
  const backupDownload = await downloadPromise;
  assert.equal(backupDownload.suggestedFilename(), 'choeae-device-backup.json');
  const recoveryClose = await page.locator('#driveModal [data-act="close-drive"]').boundingBox();
  const recoveryBox = await page.locator('#driveModal .sd-box').boundingBox();
  assert.ok(recoveryClose && recoveryBox && recoveryClose.y >= recoveryBox.y && recoveryClose.y + recoveryClose.height <= recoveryBox.y + recoveryBox.height, 'close remains visible when long recovery contents scroll');
  if (process.env.CHOEAE_PROOF_PATH) {
    await page.locator('#driveModal .sd-box').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({path:resolve(process.env.CHOEAE_PROOF_PATH),fullPage:false});
  }
  await page.getByRole('button', {name:'지금 저장',exact:true}).click();
  await page.getByText('드라이브에 저장했어요!', {exact:true}).waitFor({state:'visible'});
  assert.equal(importAttempts,2);
  assert.equal(await page.evaluate(() => localStorage.getItem('st_drive_import:' + encodeURIComponent('mock@example.test'))),null);
  assert.equal(await page.evaluate(() => localStorage.getItem('st_drive_pending:' + encodeURIComponent('mock@example.test'))),null);
  await page.addScriptTag({path: resolve('node_modules/axe-core/axe.min.js')});
  await audit('#driveModal');
  // Every named music row opens that song query, never an unrelated latest video.
  await page.goto(base);
  await page.locator('#tab-music').click();
  await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
  for (const width of [320,375,1440]) {
    await page.setViewportSize({width,height:900});
    for (const dark of [false,true]) {
      if ((await page.locator('#themeBtn').getAttribute('aria-pressed')==='true')!==dark) {
        await page.locator('#themeBtn').click();
        await page.waitForTimeout(500);
      }
      assert.equal(await page.locator('html').getAttribute('data-theme'),dark?'dark':null);
      for (const panel of ['music','news','play']) {
        await page.locator('#tab-'+panel).click();
        assert.equal(await page.locator('h1:visible').count(),1);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
        await audit();
      }
    }
  }
  await page.locator('#tab-music').click();
  const musicRow=page.locator('#chartList [data-act="play-hit"]').first();
  const musicTitle=await musicRow.locator('.t1').innerText();
  const musicArtist=await musicRow.locator('.t2').innerText();
  assert.equal(await musicRow.getAttribute('target'),'_blank');
  assert.equal(await musicRow.getAttribute('rel'),'noopener');
  assert.equal(new URL(await musicRow.getAttribute('href')).searchParams.get('q'),musicArtist+' '+musicTitle);
  const chartPopupPromise=page.waitForEvent('popup');
  await musicRow.click();
  const chartPopup=await chartPopupPromise;
  await chartPopup.waitForURL(/music\.youtube\.com\/search\?q=/);
  assert.equal(new URL(chartPopup.url()).searchParams.get('q'),musicArtist+' '+musicTitle);
  await chartPopup.close();
  // Actual keyboard dispatch and ARIA state: fake external responses, real page DOM.
  await page.locator('#tab-singer').click();
  const searchInput=page.locator('#searchInput');
  for (const width of [320,375]) {
    await page.setViewportSize({width,height:900});
    for (const dark of [false,true]) {
      if ((await page.locator('#themeBtn').getAttribute('aria-pressed')==='true')!==dark) {
        await page.locator('#themeBtn').click(); await page.waitForTimeout(500);
      }
      assert.equal(await page.locator('html').getAttribute('data-theme'),dark?'dark':null);
      await searchInput.fill('BTS');
      await searchInput.press('ArrowDown');
      assert.equal(await searchInput.getAttribute('aria-activedescendant'),'sr-artist-0');
      assert.equal(await page.locator('#searchResults [aria-selected="true"]').count(),1);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'searchInput');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
      await audit();
    }
  }
  await searchInput.press('Enter');
  await page.locator('#singerModal:not([hidden])').waitFor();
  assert.match(await page.locator('#singerBox').innerText(),/BTS/);
  assert.equal(await searchInput.getAttribute('aria-expanded'),'false');
  await page.locator('[data-act="close-singer"]').click();
  await searchInput.fill(musicTitle);
  await searchInput.press('ArrowUp');
  assert.equal(await page.locator('#searchResults [aria-selected="true"][data-act="play-hit"]').count(),1);
  const searchPopupPromise=page.waitForEvent('popup');
  await searchInput.press('Enter');
  const searchPopup=await searchPopupPromise;
  await searchPopup.waitForURL(/music\.youtube\.com\/search\?q=/);
  assert.equal(new URL(searchPopup.url()).searchParams.get('q'),musicArtist+' '+musicTitle);
  await searchPopup.close();
  assert.equal(await searchInput.getAttribute('aria-activedescendant'),null);
  await searchInput.fill('BTS'); await searchInput.press('ArrowDown'); await searchInput.press('Escape');
  assert.equal(await searchInput.inputValue(),'BTS');
  assert.equal(await searchInput.getAttribute('aria-expanded'),'false');
  await searchInput.fill('no-artist-with-this-name');
  assert.equal(await searchInput.getAttribute('aria-expanded'),'false');
  await page.locator('#searchStatus').getByText(/다른 이름으로 검색/).waitFor();
  await searchInput.press('Tab');
  assert.equal(await searchInput.getAttribute('aria-activedescendant'),null);
  // A slow feed must not be announced as failed; its arrival also refreshes comments.
  let releaseFeed;
  const slowFeed = new Promise(resolve => { releaseFeed = resolve; });
  const feedURL = 'https://api.pomyjo.com/api/singer/feed';
  const feedBody = {artists: {'임영웅': [{title:'늦게 도착한 영상',videoId:'AbCdEf12345',kind:'live'}]}};
  await page.route(feedURL, async route => { await slowFeed; await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(feedBody)}); });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('[data-act="open-singer"][data-name="임영웅"]').first().click();
  assert.match(await page.locator('#vidList').innerText(),/불러오는 중/);
  assert.doesNotMatch(await page.locator('#vidList').innerText(),/불러오지 못/);
  assert.match(await page.locator('#ytCmList').innerText(),/영상 정보를 불러온 뒤/);
  releaseFeed();
  await page.locator('#vidList .vid').waitFor();
  await page.locator('#ytCmList').getByText(/아직 댓글이 없어요/).waitFor();
  await page.unroute(feedURL);
  let feedAttempts = 0;
  await page.route(feedURL, route => {
    feedAttempts++;
    return route.fulfill({status:feedAttempts===1?503:200,contentType:'application/json',body:JSON.stringify(feedAttempts===1?{error:'temporary'}:feedBody)});
  });
  await page.goto(base);
  await page.locator('[data-act="open-singer"][data-name="임영웅"]').first().click();
  await page.getByRole('button',{name:'최신 영상 다시 불러오기',exact:true}).waitFor();
  await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
  await audit('#singerModal');
  await page.getByRole('button',{name:'최신 영상 다시 불러오기',exact:true}).click();
  await page.locator('#vidList .vid').waitFor();
  assert.equal(feedAttempts,2);
  await page.unroute(feedURL);
  // SSR guide HTML is generated by the real handler, with only its upstream feed mocked.
  await page.route('**/singer/*', async route => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1));
    const originalFetch = globalThis.fetch;
    let response;
    try {
      globalThis.fetch = async () => Response.json({artists: {[name]: [{videoId:'AbCdEf12345',title:'검증 영상'}]}});
      response = await renderSingerPage({params: {name}});
    } finally { globalThis.fetch = originalFetch; }
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({width,height:900});
    for (const name of ['BTS','아이유','임영웅','블랙핑크','트레저']) {
      await page.goto(new URL('/singer/' + encodeURIComponent(name),base).href);
      assert.equal(await page.locator('main').count(),1);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
      assert.equal(await page.getByRole('link',{name:'검증 영상 · YouTube 새 창',exact:true}).getAttribute('href'),'https://www.youtube.com/watch?v=AbCdEf12345');
      await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
      await audit();
      if(name==='BTS' && width===375 && process.env.CHOEAE_EDITORIAL_PROOF_PATH) await page.screenshot({path:resolve(process.env.CHOEAE_EDITORIAL_PROOF_PATH),fullPage:false});
    }
  }
  for (const route of ["/privacy", "/terms"]) {
    await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
    await audit();
  }
  console.log("Browser smoke passed: 320/375px and desktop, video/music/blog, keyboard trap, and light/dark accessibility audits.");
} finally {
  await browser.close();
}
