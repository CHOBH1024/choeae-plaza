// Network-only: never cache account, API, token, comment or viewing-history data.
self.addEventListener('fetch',function(event){
  var url=new URL(event.request.url);
  if(event.request.method!=='GET' || event.request.mode!=='navigate' || url.origin!==self.location.origin || !['/','/trot','/trot/','/discover','/discover/','/index.html','/blogs.html'].includes(url.pathname))return;
  event.respondWith(fetch(event.request).catch(function(){return new Response('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>최애광장 — 연결 확인</title><main><h1>인터넷 연결을 확인해주세요</h1><p>최애광장의 영상·검색에는 인터넷이 필요합니다. 연결한 뒤 다시 열어주세요.</p></main></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}));
});
